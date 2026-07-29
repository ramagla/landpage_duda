import { randomBytes } from 'node:crypto'

import { verifyAdminRequest } from '../server/_admin-session.js'
import { cleanText, ensureSchema, getClient, guestPhonePlaceholder, isGuestPhonePlaceholder, normalizePhone, parseAge, parseBody, slugify } from '../server/_db.js'
import {
    getInvitationConfig,
    saveInvitationSettings,
} from '../server/_invitation-config.js'
import {
    listAdminAudit,
    recordAdminAudit,
} from '../server/_admin-audit.js'
import {
    createEventBackup,
    listEventBackups,
} from '../server/_event-backup.js'
import adminLoginHandler from '../server/admin-login.js'
import adminLogoutHandler from '../server/admin-logout.js'
import adminPreviewSessionHandler from '../server/admin-preview-session.js'

async function ensureCompanionAttendanceColumn() {
    await getClient().execute("ALTER TABLE rsvp_companions ADD COLUMN attending TEXT NOT NULL DEFAULT 'sim'").catch((error) => {
        if (!String(error?.message || '').toLowerCase().includes('duplicate column')) throw error
    })
}
function generateInviteToken() {
    return randomBytes(32)
        .toString('hex')
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

    await createEventBackup({
        source: 'admin',
    }).catch(() => null)

    const guestsResult = await getClient().execute(`
        SELECT
            g.id,
            g.guest_name,
            g.invite_code,
            g.invite_token,
            g.age,
            g.whatsapp_digits,
            g.max_companions,
            g.first_access_at,
            g.last_access_at,
            g.access_count,
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
        SELECT
            bm.id,
            bm.invited_guest_id,
            bm.name,
            bm.message,
            bm.created_at,
            ig.guest_name
        FROM birthday_messages bm
        LEFT JOIN invited_guests ig
            ON ig.id = bm.invited_guest_id
        ORDER BY bm.id DESC
        LIMIT 500
    `)

    const communicationsResult = await getClient().execute(`
        SELECT
            invited_guest_id,
            communication_type,
            sent_at
        FROM guest_communications
        ORDER BY sent_at DESC, id DESC
    `)

    const checkinsResult = await getClient().execute(`
        SELECT
            invited_guest_id,
            attendee_key,
            attendee_name,
            checked_in_at
        FROM guest_checkins
        ORDER BY checked_in_at DESC, id DESC
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

    const communicationsByGuest = new Map()
    const checkinsByGuest = new Map()

    for (const row of checkinsResult.rows) {
        const guestId = Number(
            row.invited_guest_id
        )

        if (!checkinsByGuest.has(guestId)) {
            checkinsByGuest.set(
                guestId,
                [],
            )
        }

        checkinsByGuest.get(guestId).push({
            attendeeKey: row.attendee_key,
            attendeeName: row.attendee_name,
            checkedInAt: row.checked_in_at,
        })
    }

    for (const row of communicationsResult.rows) {
        const guestId = Number(
            row.invited_guest_id
        )

        if (!communicationsByGuest.has(guestId)) {
            communicationsByGuest.set(
                guestId,
                {},
            )
        }

        communicationsByGuest
            .get(guestId)[row.communication_type] =
            row.sent_at || ''
    }

    const guests = guestsResult.rows.map((row) => {
        const id = Number(row.id)
        const confirmedCompanions = row.rsvp_id ? companionsByRsvp.get(Number(row.rsvp_id)) || [] : []
        const presetCompanions = confirmedCompanions.length > 0 ? confirmedCompanions : presetsByGuest.get(id) || []

        return {
            id,
            name: row.guest_name,
            inviteCode: row.invite_code || '',
            inviteToken: row.invite_token || '',
            age: row.age ?? '',
            whatsapp: isGuestPhonePlaceholder(row.whatsapp_digits) ? '' : row.whatsapp_digits || '',
            maxCompanions: Number(row.max_companions || 0),
            status: row.rsvp_id
                ? row.attending
                : row.last_access_at
                    ? 'visualizou'
                    : 'pendente',
            firstAccessAt: row.first_access_at || '',
            lastAccessAt: row.last_access_at || '',
            accessCount: Number(row.access_count || 0),
            declineReason: row.decline_reason || '',
            companionsCount: Number(row.companions_count || 0),
            buffetCount: Number(row.buffet_count || 0),
            confirmedAt: row.rsvp_created_at || '',
            companions: confirmedCompanions,
            presetCompanions,
            communications:
                communicationsByGuest.get(id)
                || {},
            checkins:
                checkinsByGuest.get(id)
                || [],
        }
    })

    const totals = guests.reduce((summary, guest) => {
        const maxCompanions = Number(guest.maxCompanions || 0)
        const companionAnswers = guest.companions || []
        const confirmedCompanions = companionAnswers.filter((companion) => companion.attending !== 'nao').length
        const declinedCompanions = companionAnswers.filter((companion) => companion.attending === 'nao').length
        const pendingCompanions = Math.max(maxCompanions - companionAnswers.length, 0)

        summary.invited += 1 + maxCompanions

        if (
            guest.communications
                ?.convite_inicial
        ) {
            summary.invitesSent += 1
        } else {
            summary.invitesNotSent += 1
        }

        if (guest.status === 'visualizou') {
            summary.viewed += 1
        }

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

        summary.checkedIn +=
            guest.checkins.length

        return summary
    }, {
        invited: 0,
        confirmed: 0,
        declined: 0,
        pending: 0,
        viewed: 0,
        buffet: 0,
        invitesSent: 0,
        invitesNotSent: 0,
        checkedIn: 0,
    })

    const invitationConfig =
        await getInvitationConfig()

    const [
        auditLog,
        backups,
    ] = await Promise.all([
        listAdminAudit(80),
        listEventBackups(10),
    ])

    return {
        totals,
        guests,
        messages: messagesResult.rows.map((row) => ({
            id: Number(row.id),
            invitedGuestId: row.invited_guest_id
                ? Number(row.invited_guest_id)
                : null,
            name: row.guest_name || row.name || 'Convidado',
            message: row.message,
            createdAt: row.created_at,
        })),
        invitationConfig,
        auditLog,
        backups,
    }
}

async function deleteMessage(body) {
    const id = Number.parseInt(
        String(body.id || ''),
        10,
    )

    if (!Number.isInteger(id) || id <= 0) {
        return {
            error: 'Mensagem inválida.',
        }
    }

    const existing = await getClient().execute({
        sql: `
            SELECT
                id,
                name
            FROM birthday_messages
            WHERE id = ?
            LIMIT 1
        `,
        args: [
            id,
        ],
    })

    const message = existing.rows[0]

    if (!message) {
        return {
            error: 'Mensagem não encontrada.',
        }
    }

    await getClient().execute({
        sql: `
            DELETE FROM birthday_messages
            WHERE id = ?
        `,
        args: [
            id,
        ],
    })

    return {
        message: `Mensagem de ${message.name || 'convidado'} excluída.`,
    }
}


const COMMUNICATION_TYPES = new Set([
    'convite_inicial',
    'lembrete_60d',
    'lembrete_30d',
    'lembrete_10d',
])


async function unmarkCommunication(body) {
    const guestId = Number.parseInt(
        String(body.guestId || ''),
        10,
    )

    const communicationType = String(
        body.communicationType || ''
    ).trim()

    if (
        !Number.isInteger(guestId)
        || guestId <= 0
    ) {
        return {
            error: 'Convidado invalido.',
        }
    }

    if (
        !COMMUNICATION_TYPES.has(
            communicationType
        )
    ) {
        return {
            error: 'Tipo de comunicacao invalido.',
        }
    }

    const guestResult =
        await getClient().execute({
            sql: `
                SELECT id, guest_name
                FROM invited_guests
                WHERE id = ?
                LIMIT 1
            `,
            args: [guestId],
        })

    const guest =
        guestResult.rows[0]

    if (!guest) {
        return {
            error: 'Convidado nao encontrado.',
        }
    }

    await getClient().execute({
        sql: `
            DELETE FROM guest_communications
            WHERE invited_guest_id = ?
              AND communication_type = ?
        `,
        args: [
            guestId,
            communicationType,
        ],
    })

    return {
        message:
            `Marcacao de envio removida para ${guest.guest_name}.`,
    }
}


async function markCommunication(body) {
    const guestId = Number.parseInt(
        String(body.guestId || ''),
        10,
    )

    const communicationType = String(
        body.communicationType || ''
    ).trim()

    if (
        !Number.isInteger(guestId)
        || guestId <= 0
    ) {
        return {
            error: 'Convidado invalido.',
        }
    }

    if (
        !COMMUNICATION_TYPES.has(
            communicationType
        )
    ) {
        return {
            error: 'Tipo de comunicacao invalido.',
        }
    }

    const guestResult =
        await getClient().execute({
            sql: `
                SELECT id, guest_name
                FROM invited_guests
                WHERE id = ?
                LIMIT 1
            `,
            args: [
                guestId,
            ],
        })

    const guest =
        guestResult.rows[0]

    if (!guest) {
        return {
            error: 'Convidado nao encontrado.',
        }
    }

    /*
     * INSERT OR IGNORE preserva a primeira data de envio.
     * Se houver reenvio, nao apagamos o historico inicial.
     */
    await getClient().execute({
        sql: `
            INSERT OR IGNORE INTO guest_communications (
                invited_guest_id,
                communication_type,
                channel,
                sent_at
            )
            VALUES (?, ?, 'whatsapp', datetime('now'))
        `,
        args: [
            guestId,
            communicationType,
        ],
    })

    return {
        message:
            `Envio registrado para ${guest.guest_name}.`,
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

async function setGuestCheckin(body) {
    const guestId = Number.parseInt(
        String(body.guestId || ''),
        10,
    )

    const attendeeKey =
        cleanText(body.attendeeKey)

    if (
        !Number.isInteger(guestId)
        || guestId <= 0
        || !/^guest$|^companion:\d+$/.test(attendeeKey)
    ) {
        return {
            error:
                'Pessoa inválida para o controle de presença.',
        }
    }

    const guestResult =
        await getClient().execute({
            sql: `
                SELECT
                    g.guest_name,
                    r.id AS rsvp_id,
                    r.attending
                FROM invited_guests g
                LEFT JOIN rsvps r
                    ON r.invited_guest_id = g.id
                WHERE g.id = ?
                LIMIT 1
            `,
            args: [
                guestId,
            ],
        })

    const guest =
        guestResult.rows[0]

    if (
        !guest
        || guest.attending !== 'sim'
    ) {
        return {
            error:
                'Somente presenças confirmadas podem fazer check-in.',
        }
    }

    let attendeeName =
        guest.guest_name

    if (attendeeKey.startsWith('companion:')) {
        const companionSlot =
            Number.parseInt(
                attendeeKey.split(':')[1],
                10,
            )

        const companionResult =
            await getClient().execute({
                sql: `
                    SELECT companion_name
                    FROM rsvp_companions
                    WHERE rsvp_id = ?
                      AND companion_slot = ?
                      AND COALESCE(attending, 'sim') = 'sim'
                    LIMIT 1
                `,
                args: [
                    Number(guest.rsvp_id),
                    companionSlot,
                ],
            })

        if (!companionResult.rows[0]) {
            return {
                error:
                    'Acompanhante confirmado não encontrado.',
            }
        }

        attendeeName =
            companionResult
                .rows[0]
                .companion_name
    }

    const checkedIn =
        body.checkedIn === true

    if (checkedIn) {
        await getClient().execute({
            sql: `
                INSERT INTO guest_checkins (
                    invited_guest_id,
                    attendee_key,
                    attendee_name,
                    checked_in_at
                )
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT (
                    invited_guest_id,
                    attendee_key
                )
                DO UPDATE SET
                    attendee_name = excluded.attendee_name,
                    checked_in_at = datetime('now')
            `,
            args: [
                guestId,
                attendeeKey,
                attendeeName,
            ],
        })
    } else {
        await getClient().execute({
            sql: `
                DELETE FROM guest_checkins
                WHERE invited_guest_id = ?
                  AND attendee_key = ?
            `,
            args: [
                guestId,
                attendeeKey,
            ],
        })
    }

    return {
        message:
            checkedIn
                ? `Entrada de ${attendeeName} registrada.`
                : `Entrada de ${attendeeName} removida.`,
        entityId:
            `${guestId}:${attendeeKey}`,
        label: attendeeName,
        checkedIn,
    }
}

async function deleteGuest(body) {
    const id = Number.parseInt(String(body.id || ''), 10)
    if (!Number.isInteger(id) || id <= 0) return { error: 'Convidado invalido.' }

    const exists = await getClient().execute({
        sql: 'SELECT id, guest_name FROM invited_guests WHERE id = ? LIMIT 1',
        args: [id],
    })
    if (!exists.rows[0]) return { error: 'Convidado nao encontrado.' }

    await getClient().batch([
        {
            sql: `
                DELETE FROM rsvp_companions
                WHERE rsvp_id IN (
                    SELECT id
                    FROM rsvps
                    WHERE invited_guest_id = ?
                )
            `,
            args: [id],
        },
        {
            sql: 'DELETE FROM rsvps WHERE invited_guest_id = ?',
            args: [id],
        },
        {
            sql: 'DELETE FROM guest_companions WHERE invited_guest_id = ?',
            args: [id],
        },
        {
            sql: 'DELETE FROM guest_communications WHERE invited_guest_id = ?',
            args: [id],
        },
        {
            sql: 'DELETE FROM guest_checkins WHERE invited_guest_id = ?',
            args: [id],
        },
        {
            sql: 'DELETE FROM invited_guests WHERE id = ?',
            args: [id],
        },
    ], 'write')

    return {
        message:
            `Convidado ${exists.rows[0].guest_name} excluido.`,
        entityId: id,
        label:
            exists.rows[0].guest_name,
    }
}

async function saveGuest(body) {
    const id = Number.parseInt(String(body.id || ''), 10)
    const name = cleanText(body.guestName)
    const age = parseAge(body.age)
    const whatsapp = normalizePhone(body.whatsapp)
    const maxCompanions = Math.max(Number.parseInt(String(body.maxCompanions || 0), 10) || 0, 0)
    const inviteCode = slugify(body.inviteCode || name)
    const inviteToken = generateInviteToken()
    const presetValidation = parsePresetCompanions(body.presetCompanions, maxCompanions)
    const storedWhatsapp = whatsapp || guestPhonePlaceholder(inviteCode)

    if (name.length < 2) return { error: 'Informe o nome do convidado.' }
    if (age !== null && (age < 0 || age > 120)) return { error: 'Idade do convidado invalida.' }
    if (whatsapp && !/^\d{10,11}$/.test(whatsapp)) return { error: 'WhatsApp invalido. Use DDD + numero.' }
    if (presetValidation.error) return { error: presetValidation.error }

    if (body.allowDuplicate !== true) {
        const duplicate =
            await getClient().execute({
                sql: `
                    SELECT
                        id,
                        guest_name,
                        whatsapp_digits
                    FROM invited_guests
                    WHERE id != ?
                      AND (
                        LOWER(TRIM(guest_name))
                            = LOWER(TRIM(?))
                        OR (
                            ? != ''
                            AND whatsapp_digits = ?
                        )
                      )
                    ORDER BY
                        CASE
                            WHEN whatsapp_digits = ?
                            THEN 0
                            ELSE 1
                        END,
                        id
                    LIMIT 1
                `,
                args: [
                    Number.isInteger(id)
                        ? id
                        : 0,
                    name,
                    whatsapp,
                    whatsapp,
                    whatsapp,
                ],
            })

        if (duplicate.rows[0]) {
            const item =
                duplicate.rows[0]
            const sameWhatsapp =
                Boolean(
                    whatsapp
                    && item.whatsapp_digits
                        === whatsapp,
                )

            return {
                error:
                    sameWhatsapp
                        ? `O WhatsApp informado já pertence a ${item.guest_name}. Edite o cadastro existente ou use outro número.`
                        : `Possível duplicidade: ${item.guest_name} já está cadastrado. Confirme para salvar mesmo assim.`,
                requiresDuplicateConfirmation:
                    !sameWhatsapp,
                duplicate: {
                    id: Number(item.id),
                    name:
                        item.guest_name,
                    sameWhatsapp,
                },
            }
        }
    }

    let guestId = id

    if (Number.isInteger(id) && id > 0) {
        await getClient().execute({
            sql: `
                UPDATE invited_guests
                SET
                    guest_name = ?,
                    invite_code = ?,
                    invite_token = CASE
                        WHEN invite_token IS NULL
                          OR invite_token = ''
                        THEN ?
                        ELSE invite_token
                    END,
                    age = ?,
                    whatsapp_digits = ?,
                    max_companions = ?
                WHERE id = ?
            `,
            args: [
                name,
                inviteCode,
                inviteToken,
                age,
                storedWhatsapp,
                maxCompanions,
                id,
            ],
        })
    } else {
        await getClient().execute({
            sql: `
                INSERT INTO invited_guests (
                    guest_name,
                    invite_code,
                    invite_token,
                    age,
                    whatsapp_digits,
                    max_companions
                )
                VALUES (?, ?, ?, ?, ?, ?)

                ON CONFLICT(invite_code) DO UPDATE SET
                    guest_name = excluded.guest_name,
                    invite_token = CASE
                        WHEN invited_guests.invite_token IS NULL
                          OR invited_guests.invite_token = ''
                        THEN excluded.invite_token
                        ELSE invited_guests.invite_token
                    END,
                    age = excluded.age,
                    whatsapp_digits = excluded.whatsapp_digits,
                    max_companions = excluded.max_companions
            `,
            args: [
                name,
                inviteCode,
                inviteToken,
                age,
                storedWhatsapp,
                maxCompanions,
            ],
        })
        guestId = await findGuestIdByInviteCode(inviteCode)
    }

    if (!guestId) return { error: 'Nao foi possivel localizar o convidado salvo.' }

    await savePresetCompanions(guestId, presetValidation.companions)
    await syncConfirmedCompanions(guestId, age, presetValidation.companions)

    return {
        message:
            Number.isInteger(id) && id > 0
                ? 'Convidado atualizado.'
                : 'Convidado salvo.',
        entityId: guestId,
        label: name,
        operation:
            Number.isInteger(id) && id > 0
                ? 'updated'
                : 'created',
    }
}

function parsePhotoId(value) {
    const id =
        Number.parseInt(
            String(value || ''),
            10,
        )

    return Number.isInteger(id)
        && id > 0
        ? id
        : 0
}

async function addInvitationPhoto(body) {
    const imageData =
        String(body.imageData || '')

    if (
        !/^data:image\/webp;base64,[a-z0-9+/=]+$/i
            .test(imageData)
    ) {
        return {
            error:
                'Envie uma imagem válida em formato WebP.',
        }
    }

    if (imageData.length > 450_000) {
        return {
            error:
                'A imagem ficou muito grande. Escolha outra foto ou reduza o arquivo.',
        }
    }

    const countResult =
        await getClient().execute(`
            SELECT COUNT(*) AS total
            FROM invitation_photos
        `)

    const total =
        Number(countResult.rows[0]?.total || 0)

    if (total >= 10) {
        return {
            error:
                'A galeria aceita no máximo 10 fotos.',
        }
    }

    const orderResult =
        await getClient().execute(`
            SELECT COALESCE(MAX(sort_order), -1) AS last_order
            FROM invitation_photos
        `)

    await getClient().execute({
        sql: `
            INSERT INTO invitation_photos (
                image_data,
                alt_text,
                object_position,
                sort_order,
                is_primary
            )
            VALUES (?, ?, ?, ?, ?)
        `,
        args: [
            imageData,
            cleanText(body.altText)
                || 'Foto da Duda',
            cleanText(body.objectPosition)
                || 'center',
            Number(
                orderResult.rows[0]
                    ?.last_order
                ?? -1,
            ) + 1,
            total === 0 ? 1 : 0,
        ],
    })

    return {
        message: 'Foto adicionada à galeria.',
    }
}

async function updateInvitationPhoto(body) {
    const id =
        parsePhotoId(body.photoId)

    if (!id) {
        return {
            error: 'Foto inválida.',
        }
    }

    await getClient().execute({
        sql: `
            UPDATE invitation_photos
            SET
                alt_text = ?,
                object_position = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `,
        args: [
            cleanText(body.altText)
                || 'Foto da Duda',
            cleanText(body.objectPosition)
                || 'center',
            id,
        ],
    })

    return {
        message: 'Enquadramento da foto atualizado.',
    }
}

async function setPrimaryInvitationPhoto(body) {
    const id =
        parsePhotoId(body.photoId)

    if (!id) {
        return {
            error: 'Foto inválida.',
        }
    }

    const existing =
        await getClient().execute({
            sql: `
                SELECT id
                FROM invitation_photos
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        })

    if (!existing.rows[0]) {
        return {
            error: 'Foto não encontrada.',
        }
    }

    await getClient().batch([
        {
            sql: `
                UPDATE invitation_photos
                SET is_primary = 0
            `,
            args: [],
        },
        {
            sql: `
                UPDATE invitation_photos
                SET
                    is_primary = 1,
                    updated_at = datetime('now')
                WHERE id = ?
            `,
            args: [id],
        },
    ], 'write')

    return {
        message: 'Foto principal atualizada.',
    }
}

async function reorderInvitationPhotos(body) {
    const ids =
        Array.isArray(body.photoIds)
            ? body.photoIds
                .map(parsePhotoId)
                .filter(Boolean)
            : []

    if (!ids.length) {
        return {
            error: 'Ordem das fotos inválida.',
        }
    }

    await getClient().batch(
        ids.map((id, index) => ({
            sql: `
                UPDATE invitation_photos
                SET
                    sort_order = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `,
            args: [
                index,
                id,
            ],
        })),
        'write',
    )

    return {
        message: 'Ordem da galeria atualizada.',
    }
}

async function deleteInvitationPhoto(body) {
    const id =
        parsePhotoId(body.photoId)

    if (!id) {
        return {
            error: 'Foto inválida.',
        }
    }

    const existing =
        await getClient().execute({
            sql: `
                SELECT is_primary
                FROM invitation_photos
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        })

    if (!existing.rows[0]) {
        return {
            error: 'Foto não encontrada.',
        }
    }

    await getClient().execute({
        sql: `
            DELETE FROM invitation_photos
            WHERE id = ?
        `,
        args: [id],
    })

    if (existing.rows[0].is_primary) {
        await getClient().execute(`
            UPDATE invitation_photos
            SET is_primary = 1
            WHERE id = (
                SELECT id
                FROM invitation_photos
                ORDER BY sort_order, id
                LIMIT 1
            )
        `)
    }

    return {
        message: 'Foto removida da galeria.',
    }
}

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store')

    if (request.query?.auth === 'login') {
        return adminLoginHandler(request, response)
    }

    if (request.query?.auth === 'logout') {
        return adminLogoutHandler(request, response)
    }

    if (request.query?.auth === 'preview') {
        return adminPreviewSessionHandler(request, response)
    }

    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        return response.status(405).json({ error: 'Metodo nao permitido.' })
    }

    try {
        const auth = verifyAdminRequest(request)

        if (!auth.ok) {
            return response
                .status(auth.configError ? 500 : 401)
                .json({ error: auth.error })
        }

        const body = parseBody(request.body)

        await ensureSchema()
        await ensureCompanionAttendanceColumn()

        const invitationActions = {
            saveInvitationSettings:
                async () => {
                    await saveInvitationSettings(
                        body.settings,
                    )

                    return {
                        message:
                            'Configurações do convite salvas.',
                    }
                },
            addInvitationPhoto:
                () => addInvitationPhoto(body),
            updateInvitationPhoto:
                () => updateInvitationPhoto(body),
            setPrimaryInvitationPhoto:
                () => setPrimaryInvitationPhoto(body),
            reorderInvitationPhotos:
                () => reorderInvitationPhotos(body),
            deleteInvitationPhoto:
                () => deleteInvitationPhoto(body),
            createEventBackup:
                async () => {
                    const result =
                        await createEventBackup({
                            source: 'manual',
                            force: true,
                        })

                    return {
                        message:
                            'Backup completo criado com sucesso.',
                        backup:
                            result.backup,
                    }
                },
        }

        if (
            body.action
            && invitationActions[body.action]
        ) {
            const result =
                await invitationActions[body.action]()

            if (result.error) {
                return response
                    .status(400)
                    .json({
                        error: result.error,
                    })
            }

            await recordAdminAudit({
                action: body.action,
                entityType:
                    body.action
                        === 'createEventBackup'
                        ? 'backup'
                        : body.action
                            .includes('Photo')
                            ? 'photo'
                            : 'invitation',
                entityId:
                    body.photoId
                    || result.backup?.id
                    || '',
                label:
                    body.action
                        === 'createEventBackup'
                        ? 'Backup manual'
                        : body.action
                            === 'saveInvitationSettings'
                            ? 'Configurações do convite'
                            : 'Galeria do convite',
            })

            return response
                .status(200)
                .json({
                    message: result.message,
                    ...await getSummary(),
                })
        }

        if (body.action === 'saveGuest') {
            const saved = await saveGuest(body)
            if (saved.error) {
                return response
                    .status(400)
                    .json({
                        error: saved.error,
                        requiresDuplicateConfirmation:
                            saved.requiresDuplicateConfirmation
                            || false,
                        duplicate:
                            saved.duplicate
                            || null,
                    })
            }

            await recordAdminAudit({
                action:
                    saved.operation
                        === 'created'
                        ? 'guest_created'
                        : 'guest_updated',
                entityType: 'guest',
                entityId: saved.entityId,
                label: saved.label,
            })

            const summary = await getSummary()
            return response.status(200).json({ message: saved.message, ...summary })
        }

        if (body.action === 'setGuestCheckin') {
            const checked =
                await setGuestCheckin(body)

            if (checked.error) {
                return response
                    .status(400)
                    .json({
                        error: checked.error,
                    })
            }

            await recordAdminAudit({
                action:
                    checked.checkedIn
                        ? 'checkin_added'
                        : 'checkin_removed',
                entityType: 'checkin',
                entityId:
                    checked.entityId,
                label:
                    checked.label,
            })

            const summary =
                await getSummary()

            return response
                .status(200)
                .json({
                    message:
                        checked.message,
                    ...summary,
                })
        }

        if (body.action === 'unmarkCommunication') {
            const unmarked =
                await unmarkCommunication(body)

            if (unmarked.error) {
                return response
                    .status(400)
                    .json({
                        error: unmarked.error,
                    })
            }

            const summary =
                await getSummary()

            return response
                .status(200)
                .json({
                    message:
                        unmarked.message,
                    ...summary,
                })
        }

        if (body.action === 'markCommunication') {
            const marked =
                await markCommunication(body)

            if (marked.error) {
                return response
                    .status(400)
                    .json({
                        error: marked.error,
                    })
            }

            const summary =
                await getSummary()

            return response
                .status(200)
                .json({
                    message:
                        marked.message,
                    ...summary,
                })
        }

        if (body.action === 'deleteGuest') {
            const deleted = await deleteGuest(body)
            if (deleted.error) return response.status(400).json({ error: deleted.error })

            await recordAdminAudit({
                action: 'guest_deleted',
                entityType: 'guest',
                entityId:
                    deleted.entityId,
                label:
                    deleted.label,
            })

            const summary = await getSummary()
            return response.status(200).json({ message: deleted.message, ...summary })
        }

        if (body.action === 'deleteMessage') {
            const deleted = await deleteMessage(body)
            if (deleted.error) return response.status(400).json({ error: deleted.error })
            const summary = await getSummary()
            return response.status(200).json({ message: deleted.message, ...summary })
        }

        return response.status(200).json(await getSummary())
    } catch (error) {
        return response.status(500).json({ error: error.message || 'Erro no painel admin.' })
    }
}
