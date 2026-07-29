import {
    createEventBackup,
} from '../server/_event-backup.js'

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
        const result =
            await createEventBackup({
                source: 'automatic',
                force: false,
            })

        return response
            .status(200)
            .json({
                ok: true,
                created:
                    result.created,
            })
    } catch (error) {
        return response
            .status(500)
            .json({
                error:
                    error.message
                    || 'Não foi possível criar o backup.',
            })
    }
}
