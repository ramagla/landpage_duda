import {
    verifyCheckinRequest,
} from './_checkin-session.js'

import {
    getCheckinSummary,
    setCheckin,
} from './_checkin-data.js'

import {
    parseBody,
} from './_db.js'

import {
    recordAdminAudit,
} from './_admin-audit.js'


export default async function handler(
    request,
    response,
) {
    response.setHeader(
        'Cache-Control',
        'no-store',
    )

    if (
        request.method !== 'GET'
        && request.method !== 'POST'
    ) {
        response.setHeader(
            'Allow',
            'GET, POST',
        )

        return response
            .status(405)
            .json({
                error:
                    'Metodo nao permitido.',
            })
    }

    const auth =
        verifyCheckinRequest(request)

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

    try {
        if (request.method === 'POST') {
            const result =
                await setCheckin(
                    parseBody(request.body)
                )

            if (result.error) {
                return response
                    .status(400)
                    .json({
                        error: result.error,
                    })
            }

            await recordAdminAudit({
                action:
                    result.checkedIn
                        ? 'checkin_added'
                        : 'checkin_removed',
                entityType: 'checkin',
                entityId: result.entityId,
                label: result.label,
                actor: 'presenca',
            })

            return response
                .status(200)
                .json({
                    ...await getCheckinSummary(),
                    message: result.message,
                })
        }

        return response
            .status(200)
            .json(
                await getCheckinSummary()
            )
    } catch (error) {
        console.error(error)

        return response
            .status(500)
            .json({
                error:
                    'Nao foi possivel atualizar a lista de presenca.',
            })
    }
}
