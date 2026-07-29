import { createServer as createHttpServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer as createViteServer } from 'vite'

function loadEnvFile(filePath) {
    if (!existsSync(filePath)) return

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

        const [key, ...valueParts] = trimmed.split('=')
        if (!process.env[key]) process.env[key] = valueParts.join('=').trim()
    }
}

loadEnvFile(resolve('.env.local'))
process.env.NODE_ENV ||= 'development'
process.env.TURSO_DATABASE_URL ||= 'file:./duda-local.db'

if (!process.env.ADMIN_PASSWORD) {
    throw new Error(
        'ADMIN_PASSWORD nao configurado em .env.local.'
    )
}

if (!process.env.ADMIN_SESSION_SECRET) {
    throw new Error(
        'ADMIN_SESSION_SECRET nao configurado em .env.local.'
    )
}

function readBody(request) {
    return new Promise((resolveBody, reject) => {
        let body = ''
        request.setEncoding('utf8')
        request.on('data', (chunk) => { body += chunk })
        request.on('end', () => {
            if (!body) return resolveBody({})

            try {
                resolveBody(JSON.parse(body))
            } catch {
                resolveBody(body)
            }
        })
        request.on('error', reject)
    })
}

function createResponseAdapter(response) {
    return {
        statusCode: 200,
        setHeader(name, value) {
            response.setHeader(name, value)
        },
        status(code) {
            this.statusCode = code
            return this
        },
        json(payload) {
            response.statusCode = this.statusCode
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(JSON.stringify(payload))
        },
        send(payload) {
            response.statusCode = this.statusCode

            if (!response.hasHeader('Content-Type')) {
                response.setHeader(
                    'Content-Type',
                    'text/plain; charset=utf-8',
                )
            }

            response.end(payload)
        },
    }
}

async function handleApi(request, response, url) {
    const endpoint = url.pathname.replace(/^\/api\//, '')
    const routes = {
        admin: { module: 'admin' },
        'admin-login': { module: 'admin', auth: 'login' },
        'admin-logout': { module: 'admin', auth: 'logout' },
        'admin-preview-session': { module: 'admin', auth: 'preview' },
        calendar: { module: 'calendar' },
        checkin: { module: 'checkin' },
        'checkin-login': { module: 'checkin', auth: 'login' },
        'checkin-logout': { module: 'checkin', auth: 'logout' },
        'cron-backup': { module: 'cron-backup' },
        expenses: { module: 'expenses' },
        'expenses-login': { module: 'expenses', auth: 'login' },
        'expenses-logout': { module: 'expenses', auth: 'logout' },
        guest: { module: 'guest' },
        'invitation-config': { module: 'invitation-config' },
        messages: { module: 'messages' },
        rsvp: { module: 'rsvp' },
    }
    const route = routes[endpoint]

    if (!route) return false

    const modulePath = `./api/${route.module}.js?dev=${Date.now()}`
    const { default: handler } = await import(modulePath)
    const body = request.method === 'GET' ? {} : await readBody(request)
    const query = Object.fromEntries(url.searchParams.entries())
    if (route.auth) query.auth = route.auth

    await handler({
        method: request.method,
        body,
        query,
        headers: request.headers,
        socket: request.socket,
    }, createResponseAdapter(response))
    return true
}

const port = Number(process.env.PORT || 5174)
const hmrPort = Number(process.env.HMR_PORT || port + 20000)

const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { port: hmrPort } },
    appType: 'spa',
})

const server = createHttpServer(async (request, response) => {
    try {
        const url = new URL(request.url || '/', 'http://localhost')
        if (url.pathname.startsWith('/api/')) {
            const handled = await handleApi(request, response, url)
            if (handled) return
        }

        vite.middlewares(request, response)
    } catch (error) {
        response.statusCode = 500
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: error.message || 'Erro local.' }))
    }
})

server.listen(port, () => {
    console.log(`Convite da Duda local: http://localhost:${port}`)
    console.log(`Admin local: http://localhost:${port}/admin`)
    console.log(`Despesas local: http://localhost:${port}/despesas`)
    console.log(`Presenca local: http://localhost:${port}/presenca`)
})
