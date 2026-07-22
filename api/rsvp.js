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

async function ensureInvitedGuestsSchema(db) {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS invited_guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_name TEXT NOT NULL,
            age INTEGER,
            whatsapp_digits TEXT,
            max_companions INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `)

    const info = await db.execute('PRAGMA table_info(invited_guests)')
    const columns = new Map(info.rows.map((row) => [String(row.name), row]))
    const whatsappColumn = columns.get('whatsapp_digits')
    const mustMigrate = !columns.has('age')
        || !columns.has('max_companions')
        || Number(whatsappColumn?.notnull || 0) === 1

    if (mustMigrate) {
        const ageExpression = columns.has('age') ? 'age' : 'NULL'
        const companionsExpression = columns.has('max_companions') ? 'max_companions' : '0'

        await db.execute(`
            CREATE TABLE IF NOT EXISTS invited_guests_next (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guest_name TEXT NOT NULL,
                age INTEGER,
                whatsapp_digits TEXT,
                max_companions INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `)
        await db.execute(`
            INSERT OR IGNORE INTO invited_guests_next (id, guest_name, age, whatsapp_digits, max_companions, created_at)
            SELECT id, COALESCE(NULLIF(TRIM(guest_name), ''), 'Convidado'), ${ageExpression}, NULLIF(whatsapp_digits, ''), ${companionsExpression}, created_at
            FROM invited_guests
        `)
        await db.execute('DROP TABLE invited_guests')
        await db.execute('ALTER TABLE invited_guests_next RENAME TO invited_guests')
    }

    await db.execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS invited_guests_whatsapp_unique
        ON invited_guests (whatsapp_digits)
        WHERE whatsapp_digits IS NOT NULL AND whatsapp_digits <> ''
    `)
    await db.execute('CREATE INDEX IF NOT EXISTS invited_guests_name_index ON invited_guests (guest_name)')
}

async function ensureSchema() {
    if (!schemaReady) {
        schemaReady = (async () => {
            const db = getClient()
            await ensureInvitedGuestsSchema(db)
            await db.execute(`
                CREATE TABLE IF NOT EXISTS rsvps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invited_guest_id INTEGER,
                    full_name TEXT NOT NULL,
                    whatsapp TEXT,
                    whatsapp_digits TEXT,
                    attending TEXT NOT NULL CHECK (attending IN ('sim', 'nao')),
                    decline_reason TEXT,
                    companions_count INTEGER NOT NULL DEFAULT 0,
                    buffet_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `)
            await db.execute('ALTER TABLE rsvps ADD COLUMN invited_guest_id INTEGER').catch(ignoreDuplicateColumn)
            await db.execute('ALTER TABLE rsvps ADD COLUMN whatsapp_digits TEXT').catch(ignoreDuplicateColumn)
            await db.execute('ALTER TABLE rsvps ADD COLUMN companions_count INTEGER NOT NULL DEFAULT 0').catch(ignoreDuplicateColumn)
            await db.execute('ALTER TABLE rsvps ADD COLUMN buffet_count INTEGER NOT NULL DEFAULT 0').catch(ignoreDuplicateColumn)
            await db.execute(`
                CREATE UNIQUE INDEX IF NOT EXISTS rsvps_invited_guest_unique
                ON rsvps (invited_guest_id)
                WHERE invited_guest_id IS NOT NULL
            `)
            await db.execute(`
                CREATE UNIQUE INDEX IF NOT EXISTS rsvps_whatsapp_digits_unique
                ON rsvps (whatsapp_digits)
                WHERE whatsapp_digits IS NOT NULL AND whatsapp_digits <> ''
            `)
            await db.execute(`
                CREATE TABLE IF NOT EXISTS rsvp_companions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rsvp_id INTEGER NOT NULL,
                    companion_name TEXT NOT NULL,
                    age INTEGER NOT NULL,
                    counts_buffet INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `)
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

function parseAge(value) {
    const normalized = Number.parseInt(String(value ?? '').trim(), 10)
    return Number.isInteger(normalized) ? normalized : null
}

function normalizeCompanions(rawCompanions, attending) {
    if (attending !== 'sim') return { companions: [] }

    const companions = Array.isArray(rawCompanions) ? rawCompanions : []
    if (companions.length > 10) return { error: 'Informe no maximo 10 acompanhantes no formulario.' }

    const normalized = []
    for (const [index, companion] of companions.entries()) {
        const name = cleanText(companion?.name)
        const age = parseAge(companion?.age)

        if (!name && age === null) continue
        if (name.length < 2) return { error: `Informe o nome do acompanhante ${index + 1}.` }
        if (age === null || age < 0 || age > 120) return { error: `Informe uma idade valida para ${name}.` }

        normalized.push({
            name,
            age,
            countsBuffet: age >= 6 ? 1 : 0,
        })
    }

    return { companions: normalized }
}

function validatePayload(body) {
    const fullName = cleanText(body.fullName)
    const whatsapp = cleanText(body.whatsapp)
    const whatsappDigits = normalizePhone(whatsapp)
    const attending = body.attending === 'nao' ? 'nao' : 'sim'
    const declineReason = cleanText(body.declineReason)
    const companionValidation = normalizeCompanions(body.companions, attending)

    if (!hasFirstAndLastName(fullName)) return { error: 'Informe nome e sobrenome.' }
    if (whatsappDigits && !/^\d{10,11}$/.test(whatsappDigits)) return { error: 'Informe um WhatsApp valido com DDD ou deixe em branco se for menor de idade.' }
    if (attending === 'nao' && declineReason.length < 4) return { error: 'Se nao puder ir, conte o motivo para a Duda.' }
    if (companionValidation.error) return { error: companionValidation.error }

    return {
        data: {
            fullName,
            whatsapp,
            whatsappDigits,
            attending,
            declineReason: attending === 'nao' ? declineReason : '',
            companions: companionValidation.companions,
        },
    }
}

async function findInvitedGuest(payload) {
    if (payload.whatsappDigits) {
        const result = await getClient().execute({
            sql: `
                SELECT id, guest_name, age, whatsapp_digits, max_companions
                FROM invited_guests
                WHERE whatsapp_digits = ?
                LIMIT 1
            `,
            args: [payload.whatsappDigits],
        })

        return { guest: result.rows[0] || null }
    }

    const result = await getClient().execute({
        sql: `
            SELECT id, guest_name, age, whatsapp_digits, max_companions
            FROM invited_guests
            WHERE lower(guest_name) = lower(?)
            LIMIT 2
        `,
        args: [payload.fullName],
    })

    if (result.rows.length > 1) {
        return { error: 'Existe mais de um convidado com esse nome. Informe o WhatsApp para confirmar.' }
    }

    return { guest: result.rows[0] || null }
}

async function findExistingRsvp(invitedGuestId, whatsappDigits) {
    const result = await getClient().execute({
        sql: `
            SELECT id, attending
            FROM rsvps
            WHERE invited_guest_id = ? OR (? <> '' AND whatsapp_digits = ?)
            LIMIT 1
        `,
        args: [invitedGuestId, whatsappDigits || '', whatsappDigits || ''],
    })

    return result.rows[0] || null
}

function isUniqueConstraintError(error) {
    return String(error?.message || '').toLowerCase().includes('unique')
}

function countMainGuestForBuffet(age) {
    const parsedAge = parseAge(age)
    return parsedAge !== null && parsedAge < 6 ? 0 : 1
}

async function saveCompanions(rsvpId, companions) {
    for (const companion of companions) {
        await getClient().execute({
            sql: `
                INSERT INTO rsvp_companions (rsvp_id, companion_name, age, counts_buffet)
                VALUES (?, ?, ?, ?)
            `,
            args: [rsvpId, companion.name, companion.age, companion.countsBuffet],
        })
    }
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

        const invitedLookup = await findInvitedGuest(payload)
        if (invitedLookup.error) return response.status(409).json({ error: invitedLookup.error })
        if (!invitedLookup.guest) {
            return response.status(403).json({ error: 'Sinto muito, mas voce nao esta na lista de convidados.' })
        }

        const maxCompanions = Number(invitedLookup.guest.max_companions || 0)
        if (payload.companions.length > maxCompanions) {
            return response.status(400).json({
                error: `Este convite permite ${maxCompanions} acompanhante${maxCompanions === 1 ? '' : 's'}.`,
            })
        }

        if (await findExistingRsvp(invitedLookup.guest.id, payload.whatsappDigits)) {
            return response.status(409).json({ error: 'Este convidado ja confirmou presenca neste convite.' })
        }

        const buffetCount = payload.attending === 'sim'
            ? countMainGuestForBuffet(invitedLookup.guest.age) + payload.companions.reduce((total, companion) => total + companion.countsBuffet, 0)
            : 0

        const result = await getClient().execute({
            sql: `
                INSERT INTO rsvps (invited_guest_id, full_name, whatsapp, whatsapp_digits, attending, decline_reason, companions_count, buffet_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                invitedLookup.guest.id,
                payload.fullName,
                payload.whatsapp,
                payload.whatsappDigits || null,
                payload.attending,
                payload.declineReason,
                payload.companions.length,
                buffetCount,
            ],
        })

        const rsvpId = Number(result.lastInsertRowid)
        if (payload.attending === 'sim' && payload.companions.length > 0) {
            await saveCompanions(rsvpId, payload.companions)
        }

        const message = payload.attending === 'sim'
            ? `Presenca confirmada. Acompanhantes: ${payload.companions.length}. Pessoas para buffet: ${buffetCount}.`
            : 'Resposta registrada. Obrigado por avisar com carinho.'

        return response.status(201).json({ message })
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return response.status(409).json({ error: 'Este convidado ja confirmou presenca neste convite.' })
        }

        return response.status(500).json({ error: error.message || 'Erro ao salvar confirmacao.' })
    }
}