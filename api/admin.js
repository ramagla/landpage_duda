import { cleanText, ensureSchema, getClient, guestPhonePlaceholder, isGuestPhonePlaceholder, normalizePhone, parseAge, parseBody, slugify } from './_db.js'

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


async function ensureCompanionAttendanceColumn() {
    await getClient().execute("ALTER TABLE rsvp_companions ADD COLUMN attending TEXT NOT NULL DEFAULT 'sim'").catch((error) => {
        if (!String(error?.message || '').toLowerCase().includes('duplicate column')) throw error
    })
}
function parsePresetCompanions(value, maxCompanions) {
    if (Array.isArray(value)) {
        const companions = value.map((item, index) => ({
            slot: Number.parseInt(String(item?.slot || index + 1), 10) || index + 1,
            name: cleanText(item?.name),
            age: parseAge(item?.age),
        })).filter((item) => item.name.length > 0)

        if (companions.some((item) => item.slot > maxCompanions)) {
            return { error: `Informe no maximo ${maxCompanions} acompanhante${maxCompanions === 1 ? '' : 's'} pre-cadastrado${maxCompanions === 1 ? '' : 's'}.` }
        }

        return { companions }
    }

    const raw = String(value || '')
    const lines = raw.split(/\r?\n/).map((line) => cleanText(line)).filter(Boolean)

    if (lines.length > maxCompanions) {
        return { error: `Informe no maximo ${maxCompanions} acompanhante${maxCompanions === 1 ? '' : 's'} pre-cadastrado${maxCompanions === 1 ? '' : 's'}.` }
    }

    return {
        companions: lines.map((line, index) => {
            const match = line.match(/^(.*?)(?:\s*[,;|-]\s*(\d{1,3}))?$/)
            const name = cleanText(match?.[1] || line)
            const age = match?.[2] ? parseAge(match[2]) : null

            return { slot: index + 1, name, age }
        }).filter((item) => item.name.length > 0),
    }
}

async function refreshRsvpCounts() {
    await getClient().execute(`
        UPDATE rsvps
        SET
            companions_count = (
                SELECT COUNT(*)
                FROM rsvp_companions c
                WHERE c.rsvp_id = rsvps.id
                  AND COALESCE(c.attending, 'sim') = 'sim'
            ),
            buffet_count = CASE
                WHEN attending = 'sim' THEN
                    CASE
                        WHEN (SELECT g.age FROM invited_guests g WHERE g.id = rsvps.invited_guest_id) IS NOT NULL
                         AND (SELECT g.age FROM invited_guests g WHERE g.id = rsvps.invited_guest_id) <= 6
                        THEN 0
                        ELSE 1
                    END
                    + COALESCE((
                        SELECT SUM(CASE WHEN COALESCE(c.attending, 'sim') = 'sim' AND c.age > 6 THEN 1 ELSE 0 END)
                        FROM rsvp_companions c
                        WHERE c.rsvp_id = rsvps.id
                    ), 0)
                ELSE 0
            END
    `)
}
async function getSummary() {
    await refreshRsvpCounts()

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
        SELECT rsvp_id, companion_slot, companion_name, age, counts_buffet, attending
        FROM rsvp_companions
        ORDER BY rsvp_id, companion_slot, id
    `)

    const presetResult = await getClient().execute(`
        SELECT invited_guest_id, slot_number, companion_name, age
        FROM guest_companions
        ORDER BY invited_guest_id, slot_number
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
            attending: row.attending === 'nao' ? 'nao' : 'sim',
        })
    }

    const presetsByGuest = new Map()
    for (const row of presetResult.rows) {
        const key = Number(row.invited_guest_id)
        if (!presetsByGuest.has(key)) presetsByGuest.set(key, [])
        presetsByGuest.get(key).push({
            slot: Number(row.slot_number),
            name: row.companion_name || '',
            age: row.age ?? '',
        })
    }

    const guests = guestsResult.rows.map((row) => {
        const id = Number(row.id)
        const confirmedCompanions = row.rsvp_id ? companionsByRsvp.get(Number(row.rsvp_id)) || [] : []
        const presetCompanions = confirmedCompanions.length > 0 ? confirmedCompanions : presetsByGuest.get(id) || []

        return {
            id,
            name: row.guest_name,
            inviteCode: row.invite_code || '',
            age: row.age ?? '',
            whatsapp: isGuestPhonePlaceholder(row.whatsapp_digits) ? '' : row.whatsapp_digits || '',
            maxCompanions: Number(row.max_companions || 0),
            status: row.rsvp_id ? row.attending : 'pendente',
            declineReason: row.decline_reason || '',
            companionsCount: Number(row.companions_count || 0),
            buffetCount: Number(row.buffet_count || 0),
            confirmedAt: row.rsvp_created_at || '',
            companions: confirmedCompanions,
            presetCompanions,
        }
    })

    const totals = guests.reduce((summary, guest) => {
        const maxCompanions = Number(guest.maxCompanions || 0)
        const companionAnswers = guest.companions || []
        const confirmedCompanions = companionAnswers.filter((companion) => companion.attending !== 'nao').length
        const declinedCompanions = companionAnswers.filter((companion) => companion.attending === 'nao').length
        const pendingCompanions = Math.max(maxCompanions - companionAnswers.length, 0)

        summary.invited += 1 + maxCompanions
        if (guest.status === 'sim') {
            summary.confirmed += 1 + confirmedCompanions
            summary.declined += declinedCompanions
            summary.pending += pendingCompanions
            summary.buffet += guest.buffetCount
        } else if (guest.status === 'nao') {
            summary.declined += 1 + maxCompanions
        } else {
            summary.pending += 1 + maxCompanions
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

async function savePresetCompanions(guestId, companions) {
    await getClient().execute({
        sql: 'DELETE FROM guest_companions WHERE invited_guest_id = ?',
        args: [guestId],
    })

    for (const companion of companions) {
        await getClient().execute({
            sql: `
                INSERT INTO guest_companions (invited_guest_id, slot_number, companion_name, age)
                VALUES (?, ?, ?, ?)
            `,
            args: [guestId, companion.slot, companion.name, companion.age],
        })
    }
}

function countMainGuestForBuffet(age) {
    const parsedAge = parseAge(age)
    return parsedAge !== null && parsedAge <= 6 ? 0 : 1
}

async function syncConfirmedCompanions(guestId, guestAge, companions) {
    const rsvpResult = await getClient().execute({
        sql: 'SELECT id, attending FROM rsvps WHERE invited_guest_id = ? LIMIT 1',
        args: [guestId],
    })
    const rsvp = rsvpResult.rows[0]
    if (!rsvp) return

    for (const companion of companions) {
        await getClient().execute({
            sql: `
                UPDATE rsvp_companions
                SET companion_name = ?,
                    age = ?,
                    counts_buffet = CASE WHEN attending = 'sim' AND ? > 6 THEN 1 ELSE 0 END
                WHERE rsvp_id = ? AND companion_slot = ?
            `,
            args: [companion.name, companion.age ?? 0, companion.age ?? 0, rsvp.id, companion.slot],
        })
    }

    const counts = await getClient().execute({
        sql: `
            SELECT
                SUM(CASE WHEN attending = 'sim' THEN 1 ELSE 0 END) AS companions_count,
                SUM(counts_buffet) AS companions_buffet
            FROM rsvp_companions
            WHERE rsvp_id = ?
        `,
        args: [rsvp.id],
    })
    const companionsCount = Number(counts.rows[0]?.companions_count || 0)
    const companionBuffet = Number(counts.rows[0]?.companions_buffet || 0)
    const buffetCount = rsvp.attending === 'sim' ? countMainGuestForBuffet(guestAge) + companionBuffet : 0

    await getClient().execute({
        sql: 'UPDATE rsvps SET companions_count = ?, buffet_count = ? WHERE id = ?',
        args: [companionsCount, buffetCount, rsvp.id],
    })
}

async function findGuestIdByInviteCode(inviteCode) {
    const result = await getClient().execute({
        sql: 'SELECT id FROM invited_guests WHERE invite_code = ? LIMIT 1',
        args: [inviteCode],
    })

    return Number(result.rows[0]?.id || 0)
}

async function deleteGuest(body) {
    const id = Number.parseInt(String(body.id || ''), 10)
    if (!Number.isInteger(id) || id <= 0) return { error: 'Convidado invalido.' }

    const exists = await getClient().execute({
        sql: 'SELECT id, guest_name FROM invited_guests WHERE id = ? LIMIT 1',
        args: [id],
    })
    if (!exists.rows[0]) return { error: 'Convidado nao encontrado.' }

    await getClient().execute({
        sql: `
            DELETE FROM rsvp_companions
            WHERE rsvp_id IN (SELECT id FROM rsvps WHERE invited_guest_id = ?)
        `,
        args: [id],
    })
    await getClient().execute({
        sql: 'DELETE FROM rsvps WHERE invited_guest_id = ?',
        args: [id],
    })
    await getClient().execute({
        sql: 'DELETE FROM guest_companions WHERE invited_guest_id = ?',
        args: [id],
    })
    await getClient().execute({
        sql: 'DELETE FROM invited_guests WHERE id = ?',
        args: [id],
    })

    return { message: `Convidado ${exists.rows[0].guest_name} excluido.` }
}

async function saveGuest(body) {
    const id = Number.parseInt(String(body.id || ''), 10)
    const name = cleanText(body.guestName)
    const age = parseAge(body.age)
    const whatsapp = normalizePhone(body.whatsapp)
    const maxCompanions = Math.max(Number.parseInt(String(body.maxCompanions || 0), 10) || 0, 0)
    const inviteCode = slugify(body.inviteCode || name)
    const presetValidation = parsePresetCompanions(body.presetCompanions, maxCompanions)
    const storedWhatsapp = whatsapp || guestPhonePlaceholder(inviteCode)

    if (name.length < 2) return { error: 'Informe o nome do convidado.' }
    if (whatsapp && !/^\d{10,11}$/.test(whatsapp)) return { error: 'WhatsApp invalido. Use DDD + numero.' }
    if (presetValidation.error) return { error: presetValidation.error }

    let guestId = id

    if (Number.isInteger(id) && id > 0) {
        await getClient().execute({
            sql: `
                UPDATE invited_guests
                SET guest_name = ?, invite_code = ?, age = ?, whatsapp_digits = ?, max_companions = ?
                WHERE id = ?
            `,
            args: [name, inviteCode, age, storedWhatsapp, maxCompanions, id],
        })
    } else {
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
            args: [name, inviteCode, age, storedWhatsapp, maxCompanions],
        })
        guestId = await findGuestIdByInviteCode(inviteCode)
    }

    if (!guestId) return { error: 'Nao foi possivel localizar o convidado salvo.' }

    await savePresetCompanions(guestId, presetValidation.companions)
    await syncConfirmedCompanions(guestId, age, presetValidation.companions)

    return { message: Number.isInteger(id) && id > 0 ? 'Convidado atualizado.' : 'Convidado salvo.' }
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
        await ensureCompanionAttendanceColumn()

        if (body.action === 'saveGuest') {
            const saved = await saveGuest(body)
            if (saved.error) return response.status(400).json({ error: saved.error })
            const summary = await getSummary()
            return response.status(200).json({ message: saved.message, ...summary })
        }

        if (body.action === 'deleteGuest') {
            const deleted = await deleteGuest(body)
            if (deleted.error) return response.status(400).json({ error: deleted.error })
            const summary = await getSummary()
            return response.status(200).json({ message: deleted.message, ...summary })
        }

        return response.status(200).json(await getSummary())
    } catch (error) {
        return response.status(500).json({ error: error.message || 'Erro no painel admin.' })
    }
}
