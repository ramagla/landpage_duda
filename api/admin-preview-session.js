import {
    verifyAdminRequest,
} from './_admin-session.js'

export default function handler(
    request,
    response,
) {
    response.setHeader(
        'Cache-Control',
        'no-store',
    )

    if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET')

        return response
            .status(405)
            .json({
                error: 'Método não permitido.',
            })
    }

    const auth =
        verifyAdminRequest(request)

    if (!auth.ok) {
        return response
            .status(auth.configError ? 500 : 401)
            .json({
                error: auth.error,
            })
    }

    return response
        .status(200)
        .json({
            authorized: true,
        })
}
