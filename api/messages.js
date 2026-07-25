import {
    cleanText,
    ensureSchema,
    getClient,
    normalizePhone,
    parseBody,
} from './_db.js'

import {
    enforceRateLimit,
} from './_rate-limit.js'


function validPhoneDigits(value) {
    return /^\d{10,13}$/.test(
        String(value || '')
    )
}


function validatePayload(body) {
    const invitationCode = cleanText(
        body.invitationCode,
    )

    const whatsappDigits = normalizePhone(
        body.whatsapp,
    )

    const message = cleanText(
        body.message,
    )

    const hasInvitationCode = Boolean(
        invitationCode
    )

    /*
     * Quando existe token, ele continua sendo
     * a forma preferencial de identificar o convite.
     */
    if (
        hasInvitationCode
        && !/^[a-f0-9]{64}$/i.test(
            invitationCode
        )
    ) {
        return {
            error:
                'Não foi possível identificar este convite.',
        }
    }

    /*
     * Quem entrou pelo endereco principal pode ter
     * sido identificado somente pelo WhatsApp.
     */
    if (
        !hasInvitationCode
        && !validPhoneDigits(
            whatsappDigits
        )
    ) {
        return {
            error:
                'Não foi possível identificar este convite.',
        }
    }

    if (message.length < 5) {
        return {
            error:
                'Escreva uma mensagem um pouquinho maior.',
        }
    }

    if (message.length > 500) {
        return {
            error:
                'A mensagem pode ter no máximo 500 caracteres.',
        }
    }

    return {
        data: {
            invitationCode,
            whatsappDigits,
            message,
            lookupMode:
                hasInvitationCode
                    ? 'token'
                    : 'phone',
        },
    }
}


async function findGuestForMessage({
    invitationCode,
    whatsappDigits,
    lookupMode,
}) {
    if (lookupMode === 'token') {
        const result = await getClient().execute({
            sql: `
                SELECT
                    id,
                    guest_name
                FROM invited_guests
                WHERE invite_token = ?
                LIMIT 1
            `,
            args: [
                invitationCode,
            ],
        })

        return result.rows[0] || null
    }

    const result = await getClient().execute({
        sql: `
            SELECT
                id,
                guest_name
            FROM invited_guests
            WHERE whatsapp_digits = ?
            LIMIT 1
        `,
        args: [
            whatsappDigits,
        ],
    })

    return result.rows[0] || null
}


export default async function handler(
    request,
    response,
) {
    response.setHeader(
        'Cache-Control',
        'no-store'
    )

    if (request.method !== 'POST') {
        response.setHeader(
            'Allow',
            'POST',
        )

        return response
            .status(405)
            .json({
                error: 'Método não permitido.',
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

        /*
         * Limite contra tentativa de descobrir tokens validos.
         */
        const lookupAllowed = await enforceRateLimit({
            request,
            response,
            scope: 'messages-lookup',
            limit: 20,
            windowSeconds: 60 * 60,
            message: 'Muitas tentativas de envio. Aguarde um pouco e tente novamente.',
        })

        if (!lookupAllowed) return

        await ensureSchema()

        const guest = await findGuestForMessage({
            invitationCode:
                validation.data.invitationCode,
            whatsappDigits:
                validation.data.whatsappDigits,
            lookupMode:
                validation.data.lookupMode,
        })

        if (!guest) {
            return response
                .status(403)
                .json({
                    error: 'Este convite não foi encontrado.',
                })
        }

        /*
         * Limite de 5 mensagens/hora para o mesmo convidado + IP.
         */
        const rateAllowed = await enforceRateLimit({
            request,
            response,
            scope: `messages:${Number(guest.id)}`,
            limit: 5,
            windowSeconds: 60 * 60,
            message: 'Muitas mensagens enviadas. Aguarde um pouco e tente novamente.',
        })

        if (!rateAllowed) return

        /*
         * O nome NÃO vem do navegador.
         * Ele sempre e obtido diretamente do cadastro do convidado.
         */
        const guestName = cleanText(
            guest.guest_name,
        )

        await getClient().execute({
            sql: `
                INSERT INTO birthday_messages (
                    invited_guest_id,
                    name,
                    message
                )
                VALUES (?, ?, ?)
            `,
            args: [
                Number(guest.id),
                guestName,
                validation.data.message,
            ],
        })

        return response
            .status(201)
            .json({
                message: 'Mensagem guardada para a Duda.',
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
