// Subrota consolidada na funcao /api/expenses.
import {
    createExpensesSessionCookie,
    verifyExpensesPassword,
} from './_expenses-session.js'

import {
    parseBody,
} from './_db.js'

import {
    enforceRateLimit,
} from './_rate-limit.js'


export default async function handler(
    request,
    response,
) {
    response.setHeader(
        'Cache-Control',
        'no-store',
    )

    if (
        request.method !== 'POST'
    ) {
        response.setHeader(
            'Allow',
            'POST',
        )

        return response
            .status(405)
            .json({
                error:
                    'Metodo nao permitido.',
            })
    }

    const allowed =
        await enforceRateLimit({
            request,
            response,
            scope:
                'expenses-login',
            limit: 10,
            windowSeconds:
                15 * 60,
            message:
                'Muitas tentativas. Aguarde alguns minutos.',
        })

    if (!allowed) {
        return
    }

    const body =
        parseBody(
            request.body
        )

    const auth =
        verifyExpensesPassword(
            body.password
        )

    if (!auth.ok) {
        return response
            .status(
                auth.configError
                    ? 500
                    : 401
            )
            .json({
                error: auth.error,
            })
    }

    response.setHeader(
        'Set-Cookie',
        createExpensesSessionCookie(),
    )

    return response
        .status(200)
        .json({
            message:
                'Acesso autorizado.',
        })
}
