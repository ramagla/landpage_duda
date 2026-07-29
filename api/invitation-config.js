import {
    getInvitationConfig,
} from '../server/_invitation-config.js'

export default async function handler(
    request,
    response,
) {
    if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET')

        return response
            .status(405)
            .json({
                error: 'Método não permitido.',
            })
    }

    try {
        const config =
            await getInvitationConfig()

        response.setHeader(
            'Cache-Control',
            'public, max-age=30, s-maxage=30, stale-while-revalidate=120',
        )

        return response
            .status(200)
            .json(config)
    } catch (error) {
        return response
            .status(500)
            .json({
                error:
                    error.message
                    || 'Não foi possível carregar o convite.',
            })
    }
}
