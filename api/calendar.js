import {
    getInvitationConfig,
} from './_invitation-config.js'

function escapeIcsText(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader(
            'Allow',
            'GET',
        )

        return res.status(405).send(
            'Method Not Allowed'
        )
    }

    const {
        event,
    } = await getInvitationConfig()

    const now = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')

    /*
     * Horario do evento:
     *
     * 14/11/2026
     * 17:00 ate 23:00
     *
     * Sao Paulo = UTC-3
     *
     * 17:00 -> 20:00 UTC
     * 23:00 -> 02:00 UTC do dia seguinte
     */
    const calendar = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Duda 16 Anos//Convite Digital//PT-BR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeIcsText(event.title)}`,

        'BEGIN:VEVENT',

        `UID:${event.calendarUid}`,

        `DTSTAMP:${now}`,

        `DTSTART:${event.utcStart}`,
        `DTEND:${event.utcEnd}`,

        `SUMMARY:${escapeIcsText(
            event.title
        )}`,

        `LOCATION:${escapeIcsText(
            event.address
        )}`,

        `DESCRIPTION:${escapeIcsText(
            event.description
        )}`,

        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',

        'END:VEVENT',
        'END:VCALENDAR',
        '',
    ].join('\r\n')

    res.setHeader(
        'Content-Type',
        'text/calendar; charset=utf-8; method=PUBLISH',
    )

    /*
     * INLINE e importante:
     * nao estamos deliberadamente forçando o download.
     */
    res.setHeader(
        'Content-Disposition',
        'inline; filename="duda-16-anos.ics"; filename*=UTF-8\'\'duda-16-anos.ics',
    )

    res.setHeader(
        'Content-Language',
        'pt-BR',
    )

    res.setHeader(
        'Cache-Control',
        'public, max-age=300, s-maxage=300',
    )

    return res.status(200).send(
        calendar
    )
}
