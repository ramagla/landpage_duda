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

async function ignoreDuplicateColumn(error) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column')) {
        throw error
    }
}

async function ensureSchema() {
    if (!schemaReady) {
        schemaReady = (async () => {
            const db = getClient()
            await db.execute(`
                CREATE TABLE IF NOT EXISTS invited_guests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guest_name TEXT,
                    whatsapp_digits TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `)
            await db.execute(`
                CREATE TABLE IF NOT EXISTS rsvps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    whatsapp TEXT NOT NULL,
                    whatsapp_digits TEXT,
                    attending TEXT NOT NULL CHECK (attending IN ('sim', 'nao')),
                    decline_reason TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `)
            await db.execute('ALTER TABLE rsvps ADD COLUMN whatsapp_digits TEXT').catch(ignoreDuplicateColumn)
        })()
    }

    await schemaReady
}

function cleanText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ')
}

function hasFirstAndLastName(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length >= 2
}

function normalizePhone(value) {
    let digits = String(value || '').replace(/\D/g, '')

    if (digits.startsWith('55') && digits.length > 11) {
        digits = digits.slice(2)
    }

    return digits
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
    const fullName = cleanText(body.fullName)
    const whatsapp = cleanText(body.whatsapp)
    const whatsappDigits = normalizePhone(whatsapp)
    const attending = body.attending === 'nao' ? 'nao' : 'sim'
    const declineReason = cleanText(body.declineReason)

    if (!hasFirstAndLastName(fullName)) return { error: 'Informe nome e sobrenome.' }
    if (!/^\d{10,11}$/.test(whatsappDigits)) return { error: 'Informe um WhatsApp valido com DDD.' }
    if (attending === 'nao' && declineReason.length < 4) return { error: 'Se nao puder ir, conte o motivo para a Duda.' }

    return {
        data: {
            fullName,
            whatsapp,
            whatsappDigits,
            attending,
            declineReason: attending === 'nao' ? declineReason : '',
        },
    }
}

async function isInvited(whatsappDigits) {
    const result = await getClient().execute({
        sql: 'SELECT id FROM invited_guests WHERE whatsapp_digits = ? LIMIT 1',
        args: [whatsappDigits],
    })

    return result.rows.length > 0
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        return response.status(405).json({ error: 'Metodo nao permitido.' })
    }

    try {
        const validation = validatePayload(parseBody(request.body))
        if (validation.error) return response.status(400).json({ error: validation.error })

        const payload = validation.data
        await ensureSchema()

        if (!(await isInvited(payload.whatsappDigits))) {
            return response.status(403).json({ error: 'Sinto muito, mas voce nao esta na lista de convidados.' })
        }

        await getClient().execute({
            sql: `
                INSERT INTO rsvps (full_name, whatsapp, whatsapp_digits, attending, decline_reason)
                VALUES (?, ?, ?, ?, ?)
            `,
            args: [
                payload.fullName,
                payload.whatsapp,
                payload.whatsappDigits,
                payload.attending,
                payload.declineReason,
            ],
        })

        const message = payload.attending === 'sim'
            ? 'Presenca confirmada. A Duda vai amar ter voce la!'
            : 'Resposta registrada. Obrigado por avisar com carinho.'

        return response.status(201).json({ message })
    } catch (error) {
        return response.status(500).json({ error: error.message || 'Erro ao salvar confirmacao.' })
    }
}


