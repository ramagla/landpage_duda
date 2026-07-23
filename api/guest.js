import { cleanText, ensureSchema, getClient, getGuestCompanionSlots, normalizePhone, publicGuest } from './_db.js'

function validPhoneDigits(value) {
    return /^\d{10,11}$/.test(value)
}


async function ensureCompanionAttendanceColumn() {
    await getClient().execute("ALTER TABLE rsvp_companions ADD COLUMN attending TEXT NOT NULL DEFAULT 'sim'").catch((error) => {
        if (!String(error?.message || '').toLowerCase().includes('duplicate column')) throw error
    })
}
async function findGuest(whatsappDigits, invitationCode) {
    const code = cleanText(invitationCode).toLowerCase()

    if (code) {
        const result = await getClient().execute({
            sql: `
                SELECT id, guest_name, invite_code, age, whatsapp_digits, max_companions
                FROM invited_guests
                WHERE lower(invite_code) = ?
                LIMIT 1
            `,
            args: [code],
        })
        const guest = result.rows[0] || null
        if (!guest) return { guest: null }

        const registeredPhone = normalizePhone(guest.whatsapp_digits)
        if (registeredPhone && registeredPhone !== whatsappDigits) {
            return { error: 'Esse celular nao pertence a este convite.' }
        }

        return { guest }
    }

    const result = await getClient().execute({
        sql: `
            SELECT id, guest_name, invite_code, age, whatsapp_digits, max_companions
            FROM invited_guests
            WHERE whatsapp_digits = ?
            LIMIT 1
        `,
        args: [whatsappDigits],
    })

    return { guest: result.rows[0] || null }
}

async function getCompanionsForGuest(guestId, maxCompanions, rsvpId) {
    const slots = await getGuestCompanionSlots(guestId, maxCompanions)
    if (!rsvpId) return slots

    const result = await getClient().execute({
        sql: `
            SELECT companion_slot, companion_name, age, attending
            FROM rsvp_companions
            WHERE rsvp_id = ?
            ORDER BY companion_slot, id
        `,
        args: [rsvpId],
    })
    const confirmed = new Map(result.rows.map((row) => [Number(row.companion_slot), row]))

    return slots.map((slot) => {
        const companion = confirmed.get(Number(slot.slot))
        if (!companion) return slot

        return {
            slot: slot.slot,
            name: companion.companion_name || slot.name || '',
            age: companion.age ?? slot.age ?? '',
            attending: companion.attending === 'nao' ? 'nao' : 'sim',
        }
    })
}
export default async function handler(request, response) {
    if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET')
        return response.status(405).json({ error: 'Metodo nao permitido.' })
    }

    try {
        const whatsappDigits = normalizePhone(request.query?.whatsapp)
        const invitationCode = request.query?.code || ''

        if (!validPhoneDigits(whatsappDigits)) {
            return response.status(400).json({ error: 'Digite um WhatsApp valido com DDD.' })
        }

        await ensureSchema()
        await ensureCompanionAttendanceColumn()
        const lookup = await findGuest(whatsappDigits, invitationCode)
        if (lookup.error) return response.status(403).json({ error: lookup.error })
        if (!lookup.guest) return response.status(403).json({ error: 'Sinto muito, mas voce nao esta na lista de convidados.' })

        const rsvp = await getClient().execute({
            sql: 'SELECT id, attending, created_at FROM rsvps WHERE invited_guest_id = ? OR whatsapp_digits = ? LIMIT 1',
            args: [lookup.guest.id, whatsappDigits],
        })
        const companions = await getCompanionsForGuest(lookup.guest.id, lookup.guest.max_companions, rsvp.rows[0]?.id)

        return response.status(200).json({
            guest: publicGuest(lookup.guest, companions),
            alreadyConfirmed: Boolean(rsvp.rows[0]),
            rsvp: rsvp.rows[0] || null,
        })
    } catch (error) {
        return response.status(500).json({ error: error.message || 'Erro ao consultar convite.' })
    }
}
