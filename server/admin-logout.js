// Subrota consolidada na funcao /api/admin.
import {
    clearAdminSessionCookie,
} from './_admin-session.js'

export default async function handler(
    request,
    response,
) {
    response.setHeader(
        'Cache-Control',
        'no-store',
    )

    if (request.method !== 'POST') {
        response.setHeader(
            'Allow',
            'POST',
        )

        return response
            .status(405)
            .json({
                error: 'Metodo nao permitido.',
            })
    }

    response.setHeader(
        'Set-Cookie',
        clearAdminSessionCookie(),
    )

    return response
        .status(200)
        .json({
            message: 'Sessao encerrada.',
        })
}
