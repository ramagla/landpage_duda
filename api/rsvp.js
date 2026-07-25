import {
    cleanText,
    ensureSchema,
    getClient,
    getGuestCompanionSlots,
    isUniqueConstraintError,
    isGuestPhonePlaceholder,
    normalizePhone,
    parseAge,
    parseBody,
    publicGuest,
} from './_db.js'
import {
    RSVP_CLOSED_MESSAGE,
    isRsvpClosedAt,
} from '../shared/rsvp-deadline.js'

import {
    enforceRateLimit,
} from './_rate-limit.js'

function getRsvpNow() {
    const testNow = process.env.NODE_ENV !== 'production'
        ? String(process.env.RSVP_TEST_NOW || '').trim()
        : ''

    if (testNow) {
        const parsed = new Date(testNow)

        if (!Number.isNaN(parsed.getTime())) {
            return parsed
        }
    }

    return new Date()
}

async function ensureCompanionAttendanceColumn() {
    await getClient().execute("ALTER TABLE rsvp_companions ADD COLUMN attending TEXT NOT NULL DEFAULT 'sim'").catch((error) => {
        if (!String(error?.message || '').toLowerCase().includes('duplicate column')) throw error
    })
}
function validPhoneDigits(value) {
    return /^\d{10,11}$/.test(value)
}

function normalizeCompanions(rawCompanions, attending, maxCompanions) {
    if (attending !== 'sim') return { companions: [] }

    const companions = Array.isArray(rawCompanions) ? rawCompanions : []
    const normalized = []

    for (const [index, companion] of companions.entries()) {
        const slot = Number(companion?.slot || index + 1)
        const companionAttending = companion?.attending === 'nao' ? 'nao' : 'sim'
        const name = cleanText(companion?.name)
        const age = parseAge(companion?.age)
        const hasAnyValue = Boolean(name) || age !== null || companionAttending === 'nao'

        if (!hasAnyValue) continue
        if (index >= maxCompanions || slot > maxCompanions) return { error: `Este convite permite ${maxCompanions} acompanhante${maxCompanions === 1 ? '' : 's'}.` }

        const displayName = name || `Acompanhante ${slot}`

        if (companionAttending === 'sim' && name.length < 2) return { error: `Informe o nome do acompanhante ${index + 1}.` }
        if (companionAttending === 'sim' && (age === null || age < 0 || age > 120)) return { error: `Informe uma idade valida para ${name}.` }
        if (age !== null && (age < 0 || age > 120)) return { error: `Informe uma idade valida para ${displayName}.` }

        normalized.push({
            slot,
            name: displayName,
            age: age ?? 0,
            attending: companionAttending,
            countsBuffet: companionAttending === 'sim' && age > 6 ? 1 : 0,
        })
    }

    return { companions: normalized }
}

function allowLegacyInviteCodes() {
    return String(process.env.ALLOW_LEGACY_INVITE_CODES || '').toLowerCase() === 'true'
}

async function findGuest({ whatsappDigits, invitationCode }) {
    const token = cleanText(invitationCode)

    if (token) {
        let result = await getClient().execute({
            sql: `
                SELECT
                    id,
                    guest_name,
                    invite_code,
                    invite_token,
                    age,
                    whatsapp_digits,
                    max_companions
                FROM invited_guests
                WHERE invite_token = ?
                LIMIT 1
            `,
            args: [token],
        })

        let guest = result.rows[0] || null

        if (!guest && allowLegacyInviteCodes()) {
            result = await getClient().execute({
                sql: `
                    SELECT
                        id,
                        guest_name,
                        invite_code,
                        invite_token,
                        age,
                        whatsapp_digits,
                        max_companions
                    FROM invited_guests
                    WHERE lower(invite_code) = ?
                    LIMIT 1
                `,
                args: [token.toLowerCase()],
            })

            guest = result.rows[0] || null
        }

        if (!guest) {
            return {
                guest: null,
                canBindPhone: false,
            }
        }

        const registeredPhone = isGuestPhonePlaceholder(guest.whatsapp_digits)
            ? ''
            : normalizePhone(guest.whatsapp_digits)

        if (registeredPhone && registeredPhone !== whatsappDigits) {
            return {
                error: 'Esse celular não pertence a este convite.',
            }
        }

        return {
            guest,
            canBindPhone: !registeredPhone,
        }
    }

    const result = await getClient().execute({
        sql: `
            SELECT
                id,
                guest_name,
                invite_code,
                invite_token,
                age,
                whatsapp_digits,
                max_companions
            FROM invited_guests
            WHERE whatsapp_digits = ?
            LIMIT 1
        `,
        args: [whatsappDigits],
    })

    return {
        guest: result.rows[0] || null,
        canBindPhone: false,
    }
}

async function bindPhoneIfNeeded(guestId, whatsappDigits, canBindPhone) {
    if (!canBindPhone) return

    await getClient().execute({
        sql: `
            UPDATE invited_guests
            SET whatsapp_digits = ?
            WHERE id = ? AND (whatsapp_digits IS NULL OR whatsapp_digits = '' OR whatsapp_digits LIKE 'seed-%')
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
    return parsedAge !== null && parsedAge <= 6 ? 0 : 1
}

async function saveCompanions(rsvpId, companions) {
    for (const companion of companions) {
        await getClient().execute({
            sql: `
                INSERT INTO rsvp_companions (rsvp_id, companion_slot, companion_name, age, counts_buffet, attending)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [rsvpId, companion.slot, companion.name, companion.age, companion.countsBuffet, companion.attending],
        })
    }
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        return response.status(405).json({ error: 'Metodo nao permitido.' })
    }

    if (isRsvpClosedAt(getRsvpNow())) {
        return response.status(403).json({
            error: RSVP_CLOSED_MESSAGE,
        })
    }

    try {
        const body = parseBody(request.body)
        const whatsappDigits = normalizePhone(body.whatsapp)
        const attending = body.attending === 'nao' ? 'nao' : 'sim'
        const declineReason = cleanText(body.declineReason)

        if (!validPhoneDigits(whatsappDigits)) return response.status(400).json({ error: 'Digite um WhatsApp valido com DDD.' })
        if (attending === 'nao' && declineReason.length < 4) return response.status(400).json({ error: 'Se nao puder ir, conte o motivo para a Duda.' })

        const rateAllowed = await enforceRateLimit({
            request,
            response,
            scope: 'rsvp',
            limit: 10,
            windowSeconds: 10 * 60,
            message: 'Muitas tentativas de confirmacao. Aguarde alguns minutos e tente novamente.',
        })

        if (!rateAllowed) return

        await ensureSchema()
        await ensureCompanionAttendanceColumn()
        const lookup = await findGuest({ whatsappDigits, invitationCode: body.invitationCode })
        if (lookup.error) return response.status(403).json({ error: lookup.error })
        if (!lookup.guest) return response.status(403).json({ error: 'Sinto muito, mas voce nao esta na lista de convidados.' })

        const maxCompanions = Number(lookup.guest.max_companions || 0)
        const companionValidation = normalizeCompanions(body.companions, attending, maxCompanions)
        if (companionValidation.error) return response.status(400).json({ error: companionValidation.error })

        const existingRsvp = await findExistingRsvp(
            lookup.guest.id,
            whatsappDigits
        )

        await bindPhoneIfNeeded(
            lookup.guest.id,
            whatsappDigits,
            lookup.canBindPhone
        )

        const companions = companionValidation.companions
        const confirmedCompanionCount = companions.filter((companion) => companion.attending === 'sim').length
        const buffetCount = attending === 'sim'
            ? countMainGuestForBuffet(lookup.guest.age) + companions.reduce((total, companion) => total + companion.countsBuffet, 0)
            : 0

        let rsvpId
        let wasUpdated = false

        if (existingRsvp) {
            rsvpId = Number(existingRsvp.id)
            wasUpdated = true

            await getClient().execute({
                sql: `
                    UPDATE rsvps
                    SET
                        full_name = ?,
                        whatsapp = ?,
                        whatsapp_digits = ?,
                        attending = ?,
                        decline_reason = ?,
                        companions_count = ?,
                        buffet_count = ?
                    WHERE id = ?
                `,
                args: [
                    lookup.guest.guest_name,
                    body.whatsapp,
                    whatsappDigits,
                    attending,
                    attending === 'nao' ? declineReason : '',
                    confirmedCompanionCount,
                    buffetCount,
                    rsvpId,
                ],
            })

            /*
             * Sempre removemos os acompanhantes da resposta anterior
             * antes de salvar o novo estado.
             *
             * Assim:
             * sim -> não = acompanhantes deixam de contar
             * não -> sim = nova seleção é gravada
             * sim -> sim = seleção atual substitui a anterior
             */
            await getClient().execute({
                sql: 'DELETE FROM rsvp_companions WHERE rsvp_id = ?',
                args: [rsvpId],
            })
        } else {
            const result = await getClient().execute({
                sql: `
                    INSERT INTO rsvps (
                        invited_guest_id,
                        full_name,
                        whatsapp,
                        whatsapp_digits,
                        attending,
                        decline_reason,
                        companions_count,
                        buffet_count
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    lookup.guest.id,
                    lookup.guest.guest_name,
                    body.whatsapp,
                    whatsappDigits,
                    attending,
                    attending === 'nao' ? declineReason : '',
                    confirmedCompanionCount,
                    buffetCount,
                ],
            })

            rsvpId = Number(result.lastInsertRowid)
        }

        if (attending === 'sim' && companions.length > 0) {
            await saveCompanions(rsvpId, companions)
        }

        let message

        if (attending === 'sim') {
            message = wasUpdated
                ? `Presença atualizada para ${lookup.guest.guest_name}. Nos vemos na festa!`
                : `Presença confirmada para ${lookup.guest.guest_name}. Nos vemos na festa!`
        } else {
            message = wasUpdated
                ? 'Presença desconfirmada. Obrigado por nos avisar.'
                : 'Resposta registrada. Obrigado por nos avisar.'
        }

        const slots = await getGuestCompanionSlots(
            lookup.guest.id,
            maxCompanions
        )

        return response.status(wasUpdated ? 200 : 201).json({
            message,
            guest: publicGuest(lookup.guest, slots),
            alreadyConfirmed: true,
            rsvp: {
                id: rsvpId,
                attending,
                decline_reason: attending === 'nao'
                    ? declineReason
                    : '',
            },
        })
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return response.status(409).json({ error: 'Este convite ja teve a presenca confirmada ou este celular ja esta em uso.' })
        }

        return response.status(500).json({ error: error.message || 'Erro ao salvar confirmacao.' })
    }
}
