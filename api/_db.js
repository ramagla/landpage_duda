import { createClient } from '@libsql/client'

let client
let schemaReady

const INVITED_GUEST_SEEDS = [
    ['Maria Clodoalda', 'maria-clodoalda', 1],
    ['Wesley', 'wesley', 2],
    ['Giovana', 'giovana', 3],
    ['Glaucia', 'glaucia', 3],
    ['Bete', 'bete', 2],
    ['Conceicao', 'conceicao', 1],
    ['Gloriete', 'gloriete', 3],
    ['Luiz Felipe', 'luiz-felipe', 1],
    ['Maria Cristina', 'maria-cristina', 0],
    ['Claudinho', 'claudinho', 5],
    ['Talissa', 'talissa', 1],
    ['Maria Beatriz', 'maria-beatriz', 0],
    ['Tia fatima', 'tia-fatima', 0],
    ['Everton', 'everton', 0],
    ['Bruna', 'bruna', 3],
    ['Tia Cristina', 'tia-cristina', 2],
    ['Romeu', 'romeu', 1],
    ['Sonia', 'sonia', 1],
    ['Junior', 'junior', 1],
    ['Giulia', 'giulia', 3],
    ['Giovana', 'giovana-2', 1],
    ['Suely', 'suely', 2],
    ['Lena', 'lena', 1],
    ['Heloisa', 'heloisa', 1],
    ['Kimberly', 'kimberly', 1],
    ['Ana', 'ana', 0],
    ['Rafael Lena', 'rafael-lena', 3],
    ['Larissa', 'larissa', 1],
    ['Eloa', 'eloa', 2],
    ['Igor', 'igor', 0],
    ['Bernardo', 'bernardo', 0],
    ['Luane', 'luane', 0],
    ['Kaylane', 'kaylane', 0],
    ['Camila', 'camila', 0],
    ['Gustavo', 'gustavo', 0],
    ['Jessica', 'jessica', 0],
    ['Thaline', 'thaline', 1],
    ['Andreia', 'andreia', 2],
    ['Raquel', 'raquel', 2],
    ['Paloma', 'paloma', 5],
    ['Neia', 'neia', 2],
    ['Vilma', 'vilma', 3],
    ['Juliana', 'juliana', 2],
    ['Edna', 'edna', 1],
    ['Thalita', 'thalita', 1],
    ['Thalissa', 'thalissa', 0],
]

export function getClient() {
    if (!client) {
        const configuredUrl = process.env.TURSO_DATABASE_URL
        const url = configuredUrl || (process.env.NODE_ENV === 'production' ? '' : 'file:./duda-local.db')
        const authToken = process.env.TURSO_AUTH_TOKEN
        const isLocalSqlite = url.startsWith('file:') || url === ':memory:'

        if (!url) {
            throw new Error('Banco nao configurado. Defina TURSO_DATABASE_URL na Vercel ou use file:./duda-local.db localmente.')
        }

        if (!isLocalSqlite && !authToken) {
            throw new Error('Turso nao configurado. Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na Vercel.')
        }

        client = createClient(isLocalSqlite ? { url } : { url, authToken })
    }

    return client
}

async function ignoreDuplicateColumn(error) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column')) {
        throw error
    }
}

export function cleanText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ')
}

export function parseBody(body) {
    if (typeof body !== 'string') return body || {}

    try {
        return JSON.parse(body)
    } catch {
        return {}
    }
}

export function normalizePhone(value) {
    let digits = String(value || '').replace(/\D/g, '')

    if (digits.startsWith('55') && digits.length > 11) {
        digits = digits.slice(2)
    }

    return digits.slice(0, 11)
}

export function parseAge(value) {
    const normalized = Number.parseInt(String(value ?? '').trim(), 10)
    return Number.isInteger(normalized) ? normalized : null
}

export function slugify(value) {
    const slug = cleanText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

    return slug || `convidado-${Date.now()}`
}

export function isUniqueConstraintError(error) {
    return String(error?.message || '').toLowerCase().includes('unique')
}

async function seedInvitedGuests(db) {
    for (const [guestName, inviteCode, maxCompanions] of INVITED_GUEST_SEEDS) {
        await db.execute({
            sql: `
                INSERT INTO invited_guests (guest_name, invite_code, whatsapp_digits, max_companions)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(invite_code) DO UPDATE SET
                    guest_name = excluded.guest_name,
                    whatsapp_digits = COALESCE(invited_guests.whatsapp_digits, excluded.whatsapp_digits),
                    max_companions = excluded.max_companions
            `,
            args: [guestName, inviteCode, '', maxCompanions],
        })
    }
}

export async function ensureSchema() {
    if (!schemaReady) {
        schemaReady = (async () => {
            const db = getClient()

            await db.execute(`
                CREATE TABLE IF NOT EXISTS invited_guests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guest_name TEXT NOT NULL,
                    invite_code TEXT,
                    age INTEGER,
                    whatsapp_digits TEXT,
                    max_companions INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `)
            await db.execute('ALTER TABLE invited_guests ADD COLUMN invite_code TEXT').catch(ignoreDuplicateColumn)
            await db.execute('ALTER TABLE invited_guests ADD COLUMN age INTEGER').catch(ignoreDuplicateColumn)
            await db.execute('ALTER TABLE invited_guests ADD COLUMN whatsapp_digits TEXT').catch(ignoreDuplicateColumn)
            await db.execute('ALTER TABLE invited_guests ADD COLUMN max_companions INTEGER NOT NULL DEFAULT 0').catch(ignoreDuplicateColumn)
            await db.execute(`
                CREATE UNIQUE INDEX IF NOT EXISTS invited_guests_whatsapp_unique
                ON invited_guests (whatsapp_digits)
                WHERE whatsapp_digits IS NOT NULL AND whatsapp_digits <> ''
            `)
            await db.execute('DROP INDEX IF EXISTS invited_guests_invite_code_unique')
            await db.execute(`
                CREATE UNIQUE INDEX IF NOT EXISTS invited_guests_invite_code_unique
                ON invited_guests (invite_code)
            `)
            await db.execute('CREATE INDEX IF NOT EXISTS invited_guests_name_index ON invited_guests (guest_name)')

            await db.execute(`
                CREATE TABLE IF NOT EXISTS guest_companions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invited_guest_id INTEGER NOT NULL,
                    slot_number INTEGER NOT NULL,
                    companion_name TEXT,
                    age INTEGER,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(invited_guest_id, slot_number)
                )
            `)

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
                    companion_slot INTEGER,
                    companion_name TEXT NOT NULL,
                    age INTEGER NOT NULL,
                    counts_buffet INTEGER NOT NULL DEFAULT 1,
                    attending TEXT NOT NULL DEFAULT 'sim',
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `)
            await db.execute('ALTER TABLE rsvp_companions ADD COLUMN companion_slot INTEGER').catch(ignoreDuplicateColumn)
            await db.execute("ALTER TABLE rsvp_companions ADD COLUMN attending TEXT NOT NULL DEFAULT 'sim'").catch(ignoreDuplicateColumn)

            await db.execute(`
                CREATE TABLE IF NOT EXISTS birthday_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `)

            await seedInvitedGuests(db)
        })()
    }

    await schemaReady
}

export async function ensureCompanionAttendanceColumn() {
    await getClient().execute("ALTER TABLE rsvp_companions ADD COLUMN attending TEXT NOT NULL DEFAULT 'sim'").catch(ignoreDuplicateColumn)
}
export async function getGuestCompanionSlots(invitedGuestId, maxCompanions) {
    const result = await getClient().execute({
        sql: `
            SELECT slot_number, companion_name, age
            FROM guest_companions
            WHERE invited_guest_id = ?
            ORDER BY slot_number
        `,
        args: [invitedGuestId],
    })
    const presets = new Map(result.rows.map((row) => [Number(row.slot_number), row]))

    return Array.from({ length: Math.max(Number(maxCompanions || 0), 0) }, (_, index) => {
        const slot = index + 1
        const preset = presets.get(slot)

        return {
            slot,
            name: preset?.companion_name || '',
            age: preset?.age ?? '',
        }
    })
}

export function publicGuest(row, companions = []) {
    return {
        id: Number(row.id),
        name: row.guest_name,
        inviteCode: row.invite_code || '',
        maxCompanions: Number(row.max_companions || 0),
        hasRegisteredPhone: Boolean(row.whatsapp_digits),
        companions,
    }
}
