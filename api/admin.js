import { cleanText, ensureSchema, getClient, normalizePhone, parseAge, parseBody, slugify } from './_db.js'

function getAdminPassword() {
    return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'duda16')
}

function authorize(body) {
    const password = String(body.password || '')
    const expected = getAdminPassword()

    if (!expected) return { error: 'ADMIN_PASSWORD nao configurado na Vercel.' }
    if (password !== expected) return { error: 'Senha invalida.' }

    return {}
}

async function getSummary() {
    const guestsResult = await getClient().execute(`
        SELECT
            g.id,
            g.guest_name,
            g.invite_code,
            g.age,
            g.whatsapp_digits,
            g.max_companions,
            r.id AS rsvp_id,
            r.attending,
            r.decline_reason,
            r.companions_count,
            r.buffet_count,
            r.created_at AS rsvp_created_at
        FROM invited_guests g
        LEFT JOIN rsvps r ON r.invited_guest_id = g.id
        ORDER BY g.guest_name COLLATE NOCASE, g.id
    `)

    const companionsResult = await getClient().execute(`
        SELECT rsvp_id, companion_slot, companion_name, age, counts_buffet
        FROM rsvp_companions
        ORDER BY rsvp_id, companion_slot, id
    `)

    const messagesResult = await getClient().execute(`
        SELECT id, name, message, created_at
        FROM birthday_messages
        ORDER BY id DESC
        LIMIT 100
    `)

    const companionsByRsvp = new Map()
    for (const row of companionsResult.rows) {
        const key = Number(row.rsvp_id)
        if (!companionsByRsvp.has(key)) companionsByRsvp.set(key, [])
        companionsByRsvp.get(key).push({
            slot: row.companion_slot,
            name: row.companion_name,
            age: row.age,
            countsBuffet: Boolean(row.counts_buffet),
        })
    }

    const guests = guestsResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.guest_name,
        inviteCode: row.invite_code || '',
        age: row.age ?? '',
        whatsapp: row.whatsapp_digits || '',
        maxCompanions: Number(row.max_companions || 0),
        status: row.rsvp_id ? row.attending : 'pendente',
        declineReason: row.decline_reason || '',
        companionsCount: Number(row.companions_count || 0),
        buffetCount: Number(row.buffet_count || 0),
        confirmedAt: row.rsvp_created_at || '',
        companions: row.rsvp_id ? companionsByRsvp.get(Number(row.rsvp_id)) || [] : [],
    }))

    const totals = guests.reduce((summary, guest) => {
        summary.invited += 1
        if (guest.status === 'sim') {
            summary.confirmed += 1
            summary.buffet += guest.buffetCount
        } else if (guest.status === 'nao') {
            summary.declined += 1
        } else {
            summary.pending += 1
        }
        return summary
    }, { invited: 0, confirmed: 0, declined: 0, pending: 0, buffet: 0 })

    return {
        totals,
        guests,
        messages: messagesResult.rows.map((row) => ({
            id: Number(row.id),
            name: row.name,
            message: row.message,
            createdAt: row.created_at,
        })),
    }
}

async function saveGuest(body) {
    const id = Number.parseInt(String(body.id || ''), 10)
    const name = cleanText(body.guestName)
    const age = parseAge(body.age)
    const whatsapp = normalizePhone(body.whatsapp)
    const maxCompanions = Math.max(Number.parseInt(String(body.maxCompanions || 0), 10) || 0, 0)
    const inviteCode = slugify(body.inviteCode || name)

    if (name.length < 2) return { error: 'Informe o nome do convidado.' }
    if (whatsapp && !/^\d{10,11}$/.test(whatsapp)) return { error: 'WhatsApp invalido. Use DDD + numero.' }

    if (Number.isInteger(id) && id > 0) {
        await getClient().execute({
            sql: `
                UPDATE invited_guests
                SET guest_name = ?, invite_code = ?, age = ?, whatsapp_digits = ?, max_companions = ?
                WHERE id = ?
            `,
            args: [name, inviteCode, age, whatsapp || null, maxCompanions, id],
        })
        return { message: 'Convidado atualizado.' }
    }

    await getClient().execute({
        sql: `
            INSERT INTO invited_guests (guest_name, invite_code, age, whatsapp_digits, max_companions)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(invite_code) DO UPDATE SET
                guest_name = excluded.guest_name,
                age = excluded.age,
                whatsapp_digits = excluded.whatsapp_digits,
                max_companions = excluded.max_companions
        `,
        args: [name, inviteCode, age, whatsapp || null, maxCompanions],
    })

    return { message: 'Convidado salvo.' }
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        return response.status(405).json({ error: 'Metodo nao permitido.' })
    }

    try {
        const body = parseBody(request.body)
        const auth = authorize(body)
        if (auth.error) return response.status(auth.error.includes('configurado') ? 500 : 401).json({ error: auth.error })

        await ensureSchema()

        if (body.action === 'saveGuest') {
            const saved = await saveGuest(body)
            if (saved.error) return response.status(400).json({ error: saved.error })
            const summary = await getSummary()
            return response.status(200).json({ message: saved.message, ...summary })
        }

        return response.status(200).json(await getSummary())
    } catch (error) {
        return response.status(500).json({ error: error.message || 'Erro no painel admin.' })
    }
}
