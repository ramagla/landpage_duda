import { createClient } from '@libsql/client'

let client
let schemaReady

function getClient() {
    if (!client) {
        const url = process.env.TURSO_DATABASE_URL
        const authToken = process.env.TURSO_AUTH_TOKEN

        if (!url || !authToken) {
            throw new Error('Turso nao configurado. Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na Vercel.')
        }

        client = createClient({ url, authToken })
    }

    return client
}

async function ensureSchema() {
    if (!schemaReady) {
        schemaReady = getClient().execute(`
            CREATE TABLE IF NOT EXISTS birthday_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `)
    }

    await schemaReady
}

function cleanText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ')
}

function parseBody(body) {
    if (typeof body !== 'string') {
        return body || {}
    }

    try {
        return JSON.parse(body)
    } catch {
        return {}
    }
}

function validatePayload(body) {
    const name = cleanText(body.name)
    const message = cleanText(body.message)

    if (name.length < 2) return { error: 'Informe seu nome.' }
    if (message.length < 5) return { error: 'Escreva uma mensagem um pouquinho maior.' }
    if (message.length > 500) return { error: 'A mensagem pode ter no maximo 500 caracteres.' }

    return { data: { name, message } }
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        return response.status(405).json({ error: 'Metodo nao permitido.' })
    }

    try {
        const validation = validatePayload(parseBody(request.body))
        if (validation.error) return response.status(400).json({ error: validation.error })

        await ensureSchema()
        await getClient().execute({
            sql: 'INSERT INTO birthday_messages (name, message) VALUES (?, ?)',
            args: [validation.data.name, validation.data.message],
        })

        return response.status(201).json({ message: 'Mensagem salva para a Duda.' })
    } catch (error) {
        return response.status(500).json({ error: error.message || 'Erro ao salvar mensagem.' })
    }
}
