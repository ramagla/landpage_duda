// Modulo compartilhado; fora de /api para nao gerar funcao serverless.
import {
    createHmac,
    randomBytes,
    timingSafeEqual,
} from 'node:crypto'

const COOKIE_NAME = 'duda_admin_session'
const SESSION_TTL_SECONDS = 8 * 60 * 60

function getAdminPassword() {
    return String(
        process.env.ADMIN_PASSWORD || ''
    )
}

function getSessionSecret() {
    return String(
        process.env.ADMIN_SESSION_SECRET || ''
    )
}

function isProduction() {
    return process.env.NODE_ENV === 'production'
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

    if (left.length !== right.length) {
        return false
    }

    return timingSafeEqual(left, right)
}

function sign(value, secret) {
    return createHmac('sha256', secret)
        .update(value)
        .digest('base64url')
}

function getCookieHeader(request) {
    const headers = request?.headers

    if (!headers) return ''

    if (typeof headers.get === 'function') {
        return headers.get('cookie') || ''
    }

    return String(
        headers.cookie
        || headers.Cookie
        || ''
    )
}

function readCookie(request, name) {
    const cookieHeader = getCookieHeader(request)

    for (const part of cookieHeader.split(';')) {
        const separator = part.indexOf('=')

        if (separator === -1) continue

        const key = part
            .slice(0, separator)
            .trim()

        const value = part
            .slice(separator + 1)
            .trim()

        if (key !== name) continue

        try {
            return decodeURIComponent(value)
        } catch {
            return ''
        }
    }

    return ''
}

function validateSessionSecret() {
    const secret = getSessionSecret()

    if (!secret) {
        return {
            ok: false,
            error: 'ADMIN_SESSION_SECRET nao configurado.',
        }
    }

    if (
        isProduction()
        && secret.length < 32
    ) {
        return {
            ok: false,
            error: 'ADMIN_SESSION_SECRET deve possuir pelo menos 32 caracteres.',
        }
    }

    return {
        ok: true,
        secret,
    }
}

export function verifyAdminPassword(password) {
    const expected = getAdminPassword()

    if (!expected) {
        return {
            ok: false,
            configError: true,
            error: 'ADMIN_PASSWORD nao configurado.',
        }
    }

    if (!safeEqual(password, expected)) {
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

export function createAdminSessionCookie() {
    const validation = validateSessionSecret()

    if (!validation.ok) {
        throw new Error(validation.error)
    }

    const expiresAt = (
        Math.floor(Date.now() / 1000)
        + SESSION_TTL_SECONDS
    )

    const nonce = randomBytes(16)
        .toString('base64url')

    const unsigned = (
        `v1.${expiresAt}.${nonce}`
    )

    const signature = sign(
        unsigned,
        validation.secret,
    )

    const token = (
        `${unsigned}.${signature}`
    )

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

export function clearAdminSessionCookie() {
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

export function verifyAdminRequest(request) {
    const validation = validateSessionSecret()

    if (!validation.ok) {
        return {
            ok: false,
            configError: true,
            error: validation.error,
        }
    }

    const token = readCookie(
        request,
        COOKIE_NAME,
    )

    if (!token) {
        return {
            ok: false,
            configError: false,
            error: 'Sessao administrativa nao encontrada.',
        }
    }

    const parts = token.split('.')

    if (
        parts.length !== 4
        || parts[0] !== 'v1'
    ) {
        return {
            ok: false,
            configError: false,
            error: 'Sessao administrativa invalida.',
        }
    }

    const [
        ,
        expiresAtText,
        nonce,
        receivedSignature,
    ] = parts

    const expiresAt = Number(
        expiresAtText,
    )

    const now = Math.floor(
        Date.now() / 1000,
    )

    if (
        !Number.isInteger(expiresAt)
        || expiresAt <= now
    ) {
        return {
            ok: false,
            configError: false,
            error: 'Sessao administrativa expirada.',
        }
    }

    if (!nonce) {
        return {
            ok: false,
            configError: false,
            error: 'Sessao administrativa invalida.',
        }
    }

    const unsigned = (
        `v1.${expiresAt}.${nonce}`
    )

    const expectedSignature = sign(
        unsigned,
        validation.secret,
    )

    if (
        !safeEqual(
            receivedSignature,
            expectedSignature,
        )
    ) {
        return {
            ok: false,
            configError: false,
            error: 'Sessao administrativa invalida.',
        }
    }

    return {
        ok: true,
        configError: false,
        expiresAt,
    }
}
