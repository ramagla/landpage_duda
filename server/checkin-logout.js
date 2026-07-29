// Subrota consolidada na funcao /api/checkin.
import {
    clearCheckinSessionCookie,
} from './_checkin-session.js'


export default function handler(
    request,
    response,
) {
    response.setHeader(
        'Cache-Control',
        'no-store',
    )

    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')

        return response
            .status(405)
            .json({
                error:
                    'Metodo nao permitido.',
            })
    }

    response.setHeader(
        'Set-Cookie',
        clearCheckinSessionCookie(),
    )

    return response
        .status(200)
        .json({
            message:
                'Sessao encerrada.',
        })
}
