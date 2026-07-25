import {
    createAdminSessionCookie,
    verifyAdminPassword,
} from './_admin-session.js'

import {
    parseBody,
} from './_db.js'

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

    try {
        const body = parseBody(
            request.body,
        )

        const auth = verifyAdminPassword(
            body.password,
        )

        if (!auth.ok) {
            return response
                .status(
                    auth.configError
                        ? 500
                        : 401,
                )
                .json({
                    error: auth.error,
                })
        }

        response.setHeader(
            'Set-Cookie',
            createAdminSessionCookie(),
        )

        return response
            .status(200)
            .json({
                message: 'Acesso autorizado.',
            })
    } catch (error) {
        return response
            .status(500)
            .json({
                error:
                    error.message
                    || 'Erro ao iniciar sessao administrativa.',
            })
    }
}
