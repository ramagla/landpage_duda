import {
    cleanText,
    ensureSchema,
    getClient,
    getGuestCompanionSlots,
    isUniqueConstraintError,
    normalizePhone,
    parseAge,
    parseBody,
    publicGuest,
} from './_db.js'

function validPhoneDigits(value) {
    return /^\d{10,11}$/.test(value)
}

function normalizeCompanions(rawCompanions, attending, maxCompanions) {
    if (attending !== 'sim') return { companions: [] }

    const companions = Array.isArray(rawCompanions) ? rawCompanions : []
    const normalized = []

    for (const [index, companion] of companions.entries()) {
        const name = cleanText(companion?.name)
        const age = parseAge(companion?.age)
        const hasAnyValue = Boolean(name) || age !== null

        if (!hasAnyValue) continue
        if (index >= maxCompanions) return { error: `Este convite permite ${maxCompanions} acompanhante${maxCompanions === 1 ? '' : 's'}.` }
        if (name.length < 2) return { error: `Informe o nome do acompanhante ${index + 1}.` }
        if (age === null || age < 0 || age > 120) return { error: `Informe uma idade valida para ${name}.` }

        normalized.push({
            slot: Number(companion?.slot || index + 1),
            name,
            age,
            countsBuffet: age >= 6 ? 1 : 0,
        })
    }

    return { companions: normalized }
}

async function findGuest({ whatsappDigits, invitationCode }) {
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

        return { guest, canBindPhone: !registeredPhone }
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

    return { guest: result.rows[0] || null, canBindPhone: false }
}

async function bindPhoneIfNeeded(guestId, whatsappDigits, canBindPhone) {
    if (!canBindPhone) return

    await getClient().execute({
        sql: `
            UPDATE invited_guests
            SET whatsapp_digits = ?
            WHERE id = ? AND (whatsapp_digits IS NULL OR whatsapp_digits = '')
        `,
        args: [whatsappDigits, guestId],
    })
}

async function findExistingRsvp(invitedGuestId, whatsappDigits) {
    const result = await getClient().execute({
        sql: `
            SELECT id, attending
            FROM rsvps
            WHERE invited_guest_id = ? OR whatsapp_digits = ?
            LIMIT 1
        `,
        args: [invitedGuestId, whatsappDigits],
    })

    return result.rows[0] || null
}

function countMainGuestForBuffet(age) {
    const parsedAge = parseAge(age)
    return parsedAge !== null && parsedAge < 6 ? 0 : 1
}

async function saveCompanions(rsvpId, companions) {
    for (const companion of companions) {
        await getClient().execute({
            sql: `
                INSERT INTO rsvp_companions (rsvp_id, companion_slot, companion_name, age, counts_buffet)
                VALUES (?, ?, ?, ?, ?)
            `,
            args: [rsvpId, companion.slot, companion.name, companion.age, companion.countsBuffet],
        })
    }
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        return response.status(405).json({ error: 'Metodo nao permitido.' })
    }

    try {
        const body = parseBody(request.body)
        const whatsappDigits = normalizePhone(body.whatsapp)
        const attending = body.attending === 'nao' ? 'nao' : 'sim'
        const declineReason = cleanText(body.declineReason)

        if (!validPhoneDigits(whatsappDigits)) return response.status(400).json({ error: 'Digite um WhatsApp valido com DDD.' })
        if (attending === 'nao' && declineReason.length < 4) return response.status(400).json({ error: 'Se nao puder ir, conte o motivo para a Duda.' })

        await ensureSchema()
        const lookup = await findGuest({ whatsappDigits, invitationCode: body.invitationCode })
        if (lookup.error) return response.status(403).json({ error: lookup.error })
        if (!lookup.guest) return response.status(403).json({ error: 'Sinto muito, mas voce nao esta na lista de convidados.' })

        const maxCompanions = Number(lookup.guest.max_companions || 0)
        const companionValidation = normalizeCompanions(body.companions, attending, maxCompanions)
        if (companionValidation.error) return response.status(400).json({ error: companionValidation.error })

        if (await findExistingRsvp(lookup.guest.id, whatsappDigits)) {
            return response.status(409).json({ error: 'Este convite ja teve a presenca confirmada.' })
        }

        await bindPhoneIfNeeded(lookup.guest.id, whatsappDigits, lookup.canBindPhone)

        const companions = companionValidation.companions
        const buffetCount = attending === 'sim'
            ? countMainGuestForBuffet(lookup.guest.age) + companions.reduce((total, companion) => total + companion.countsBuffet, 0)
            : 0

        const result = await getClient().execute({
            sql: `
                INSERT INTO rsvps (invited_guest_id, full_name, whatsapp, whatsapp_digits, attending, decline_reason, companions_count, buffet_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                lookup.guest.id,
                lookup.guest.guest_name,
                body.whatsapp,
                whatsappDigits,
                attending,
                attending === 'nao' ? declineReason : '',
                companions.length,
                buffetCount,
            ],
        })

        const rsvpId = Number(result.lastInsertRowid)
        if (attending === 'sim' && companions.length > 0) {
            await saveCompanions(rsvpId, companions)
        }

        const message = attending === 'sim'
            ? `Presenca confirmada para ${lookup.guest.guest_name}. Acompanhantes: ${companions.length}. Pessoas para buffet: ${buffetCount}.`
            : 'Resposta registrada. Obrigado por avisar com carinho.'
        const slots = await getGuestCompanionSlots(lookup.guest.id, maxCompanions)

        return response.status(201).json({ message, guest: publicGuest(lookup.guest, slots) })
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return response.status(409).json({ error: 'Este convite ja teve a presenca confirmada ou este celular ja esta em uso.' })
        }

        return response.status(500).json({ error: error.message || 'Erro ao salvar confirmacao.' })
    }
}
