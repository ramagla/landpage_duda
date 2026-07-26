function escapeIcsText(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
}

export default function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader(
            'Allow',
            'GET',
        )

        return res.status(405).send(
            'Method Not Allowed'
        )
    }

    const eventAddress =
        'Rua Corumbataí, 100 - Vila Virgínia, Itaquaquecetuba - SP'

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

        'BEGIN:VEVENT',

        'UID:duda-16-20261114@dudanoibiza.com.br',

        `DTSTAMP:${now}`,

        'DTSTART:20261114T200000Z',
        'DTEND:20261115T020000Z',

        `SUMMARY:${escapeIcsText(
            '16 anos da Duda'
        )}`,

        `LOCATION:${escapeIcsText(
            eventAddress
        )}`,

        `DESCRIPTION:${escapeIcsText(
            'Aniversário de 16 anos da Duda no Quintal do Ibiza.'
        )}`,

        'STATUS:CONFIRMED',

        'END:VEVENT',
        'END:VCALENDAR',
        '',
    ].join('\r\n')

    res.setHeader(
        'Content-Type',
        'text/calendar; charset=utf-8',
    )

    /*
     * INLINE e importante:
     * nao estamos deliberadamente forçando o download.
     */
    res.setHeader(
        'Content-Disposition',
        'inline; filename="duda-16-anos.ics"',
    )

    res.setHeader(
        'Cache-Control',
        'public, max-age=3600',
    )

    return res.status(200).send(
        calendar
    )
}
