import {
    cleanText,
    ensureSchema,
    getClient,
} from './_db.js'


export async function getCheckinSummary() {
    await ensureSchema()

    const [
        guestsResult,
        companionsResult,
        checkinsResult,
    ] = await Promise.all([
        getClient().execute(`
            SELECT
                g.id AS guest_id,
                g.guest_name,
                r.id AS rsvp_id
            FROM invited_guests g
            INNER JOIN rsvps r
                ON r.invited_guest_id = g.id
            WHERE r.attending = 'sim'
            ORDER BY g.guest_name COLLATE NOCASE, g.id
        `),
        getClient().execute(`
            SELECT
                r.invited_guest_id AS guest_id,
                r.id AS rsvp_id,
                c.companion_slot,
                c.companion_name
            FROM rsvps r
            INNER JOIN rsvp_companions c
                ON c.rsvp_id = r.id
            WHERE r.attending = 'sim'
              AND COALESCE(c.attending, 'sim') = 'sim'
            ORDER BY
                r.invited_guest_id,
                c.companion_slot,
                c.id
        `),
        getClient().execute(`
            SELECT
                invited_guest_id,
                attendee_key,
                attendee_name,
                checked_in_at
            FROM guest_checkins
        `),
    ])

    const checkins =
        new Map(
            checkinsResult.rows.map((row) => [
                `${Number(row.invited_guest_id)}:${row.attendee_key}`,
                {
                    attendeeName:
                        row.attendee_name,
                    checkedInAt:
                        row.checked_in_at,
                },
            ])
        )

    const companionsByGuest = new Map()

    for (const row of companionsResult.rows) {
        const guestId = Number(row.guest_id)

        if (!companionsByGuest.has(guestId)) {
            companionsByGuest.set(guestId, [])
        }

        companionsByGuest
            .get(guestId)
            .push(row)
    }

    const attendees =
        guestsResult.rows.flatMap((row) => {
            const guestId = Number(row.guest_id)
            const invitationName = row.guest_name

            function attendee(
                attendeeKey,
                attendeeName,
            ) {
                const checkin =
                    checkins.get(
                        `${guestId}:${attendeeKey}`
                    )

                return {
                    guestId,
                    attendeeKey,
                    attendeeName,
                    invitationName,
                    checkedInAt:
                        checkin?.checkedInAt
                        || '',
                }
            }

            return [
                attendee(
                    'guest',
                    invitationName,
                ),
                ...(
                    companionsByGuest
                        .get(guestId)
                    || []
                ).map((companion) => (
                    attendee(
                        `companion:${companion.companion_slot}`,
                        companion.companion_name,
                    )
                )),
            ]
        })

    return {
        attendees,
        totals: {
            confirmed:
                attendees.length,
            checkedIn:
                attendees.filter(
                    (item) => item.checkedInAt
                ).length,
        },
    }
}


export async function setCheckin(body) {
    await ensureSchema()

    const guestId =
        Number.parseInt(
            String(body.guestId || ''),
            10,
        )

    const attendeeKey =
        cleanText(body.attendeeKey)

    if (
        !Number.isInteger(guestId)
        || guestId <= 0
        || !/^guest$|^companion:\d+$/
            .test(attendeeKey)
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
            args: [guestId],
        })

    const guest = guestResult.rows[0]

    if (
        !guest
        || guest.attending !== 'sim'
    ) {
        return {
            error:
                'Somente presenças confirmadas podem fazer check-in.',
        }
    }

    let attendeeName = guest.guest_name

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
