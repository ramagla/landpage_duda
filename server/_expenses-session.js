// Modulo compartilhado; fora de /api para nao gerar funcao serverless.
import {
    createHmac,
    randomBytes,
    timingSafeEqual,
} from 'node:crypto'


const COOKIE_NAME =
    'duda_expenses_session'

const SESSION_TTL_SECONDS =
    8 * 60 * 60


function getPassword() {
    return String(
        process.env.EXPENSES_PASSWORD
        || ''
    )
}


function getSecret() {
    return String(
        process.env.EXPENSES_SESSION_SECRET
        || ''
    )
}


function isProduction() {
    return (
        process.env.NODE_ENV
        === 'production'
    )
}


function safeEqual(first, second) {
    const left = Buffer.from(
        String(first || ''),
        'utf8',
    )

    const right = Buffer.from(
        String(second || ''),
        'utf8',
    )

    if (
        left.length
        !== right.length
    ) {
        return false
    }

    return timingSafeEqual(
        left,
        right,
    )
}


function sign(value, secret) {
    return createHmac(
        'sha256',
        secret,
    )
        .update(value)
        .digest('base64url')
}


function readCookie(request) {
    const cookieHeader =
        String(
            request?.headers?.cookie
            || request?.headers?.Cookie
            || ''
        )

    for (
        const item
        of cookieHeader.split(';')
    ) {
        const separator =
            item.indexOf('=')

        if (separator === -1) {
            continue
        }

        const name =
            item
                .slice(0, separator)
                .trim()

        if (
            name !== COOKIE_NAME
        ) {
            continue
        }

        try {
            return decodeURIComponent(
                item
                    .slice(separator + 1)
                    .trim()
            )
        } catch {
            return ''
        }
    }

    return ''
}


function validateSecret() {
    const secret = getSecret()

    if (!secret) {
        return {
            ok: false,
            error:
                'EXPENSES_SESSION_SECRET nao configurado.',
        }
    }

    if (
        isProduction()
        && secret.length < 32
    ) {
        return {
            ok: false,
            error:
                'EXPENSES_SESSION_SECRET deve possuir pelo menos 32 caracteres.',
        }
    }

    return {
        ok: true,
        secret,
    }
}


export function verifyExpensesPassword(
    password,
) {
    const expected = getPassword()

    if (!expected) {
        return {
            ok: false,
            configError: true,
            error:
                'EXPENSES_PASSWORD nao configurado.',
        }
    }

    if (
        !safeEqual(
            password,
            expected,
        )
    ) {
        return {
            ok: false,
            configError: false,
            error: 'Senha invalida.',
        }
    }

    return {
        ok: true,
        configError: false,
    }
}


export function createExpensesSessionCookie() {
    const validation =
        validateSecret()

    if (!validation.ok) {
        throw new Error(
            validation.error
        )
    }

    const expiresAt =
        Math.floor(
            Date.now() / 1000
        )
        + SESSION_TTL_SECONDS

    const nonce =
        randomBytes(16)
            .toString('base64url')

    const unsigned =
        `v1.${expiresAt}.${nonce}`

    const signature = sign(
        unsigned,
        validation.secret,
    )

    const token =
        `${unsigned}.${signature}`

    const attributes = [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${SESSION_TTL_SECONDS}`,
    ]

    if (isProduction()) {
        attributes.push('Secure')
    }

    return attributes.join('; ')
}


export function clearExpensesSessionCookie() {
    const attributes = [
        `${COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        'Max-Age=0',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    ]

    if (isProduction()) {
        attributes.push('Secure')
    }

    return attributes.join('; ')
}


export function verifyExpensesRequest(
    request,
) {
    const validation =
        validateSecret()

    if (!validation.ok) {
        return {
            ok: false,
            configError: true,
            error:
                validation.error,
        }
    }

    const token =
        readCookie(request)

    if (!token) {
        return {
            ok: false,
            configError: false,
            error:
                'Sessao financeira nao encontrada.',
        }
    }

    const parts =
        token.split('.')

    if (
        parts.length !== 4
        || parts[0] !== 'v1'
    ) {
        return {
            ok: false,
            configError: false,
            error:
                'Sessao financeira invalida.',
        }
    }

    const [
        ,
        expiresText,
        nonce,
        signature,
    ] = parts

    const expiresAt =
        Number(expiresText)

    if (
        !Number.isInteger(
            expiresAt
        )
        || expiresAt
            <= Math.floor(
                Date.now() / 1000
            )
    ) {
        return {
            ok: false,
            configError: false,
            error:
                'Sessao financeira expirada.',
        }
    }

    const unsigned =
        `v1.${expiresAt}.${nonce}`

    const expected =
        sign(
            unsigned,
            validation.secret,
        )

    if (
        !safeEqual(
            signature,
            expected,
        )
    ) {
        return {
            ok: false,
            configError: false,
            error:
                'Sessao financeira invalida.',
        }
    }

    return {
        ok: true,
        configError: false,
    }
}
