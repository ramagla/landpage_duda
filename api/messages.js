import {
    cleanText,
    ensureSchema,
    getClient,
    parseBody,
} from './_db.js'

import {
    enforceRateLimit,
} from './_rate-limit.js'

function validatePayload(body) {
    const name = cleanText(
        body.name,
    )

    const message = cleanText(
        body.message,
    )

    if (name.length < 2) {
        return {
            error: 'Informe seu nome.',
        }
    }

    if (message.length < 5) {
        return {
            error: 'Escreva uma mensagem um pouquinho maior.',
        }
    }

    if (message.length > 500) {
        return {
            error: 'A mensagem pode ter no maximo 500 caracteres.',
        }
    }

    return {
        data: {
            name,
            message,
        },
    }
}

export default async function handler(
    request,
    response,
) {
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
        const validation = validatePayload(
            parseBody(request.body),
        )

        if (validation.error) {
            return response
                .status(400)
                .json({
                    error: validation.error,
                })
        }

        const rateAllowed = await enforceRateLimit({
            request,
            response,
            scope: 'messages',
            limit: 5,
            windowSeconds: 60 * 60,
            message: 'Muitas mensagens enviadas. Aguarde um pouco e tente novamente.',
        })

        if (!rateAllowed) return

        await ensureSchema()

        await getClient().execute({
            sql: `
                INSERT INTO birthday_messages (
                    name,
                    message
                )
                VALUES (?, ?)
            `,
            args: [
                validation.data.name,
                validation.data.message,
            ],
        })

        return response
            .status(201)
            .json({
                message: 'Mensagem salva para a Duda.',
            })
    } catch (error) {
        return response
            .status(500)
            .json({
                error:
                    error.message
                    || 'Erro ao salvar mensagem.',
            })
    }
}
