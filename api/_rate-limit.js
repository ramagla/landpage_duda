import { createHash } from 'node:crypto'

import {
    getClient,
} from './_db.js'

let rateLimitSchemaReady

function getHeader(request, name) {
    const headers = request?.headers

    if (!headers) return ''

    if (typeof headers.get === 'function') {
        return String(
            headers.get(name) || ''
        ).trim()
    }

    const lowerName = name.toLowerCase()

    const value = (
        headers[lowerName]
        ?? headers[name]
        ?? ''
    )

    if (Array.isArray(value)) {
        return String(value[0] || '').trim()
    }

    return String(value || '').trim()
}

function normalizeIp(value) {
    let ip = String(value || '')
        .trim()

    if (!ip) return ''

    /*
     * X-Forwarded-For pode possuir uma cadeia:
     * cliente, proxy1, proxy2.
     *
     * Na Vercel usamos o primeiro endereco.
     */
    if (ip.includes(',')) {
        ip = ip
            .split(',')[0]
            .trim()
    }

    /*
     * Normaliza IPv4 encapsulado em IPv6.
     */
    if (ip.startsWith('::ffff:')) {
        ip = ip.slice(7)
    }

    return ip.slice(0, 100)
}

export function getClientIp(request) {
    const forwarded = normalizeIp(
        getHeader(
            request,
            'x-forwarded-for',
        ),
    )

    if (forwarded) {
        return forwarded
    }

    const realIp = normalizeIp(
        getHeader(
            request,
            'x-real-ip',
        ),
    )

    if (realIp) {
        return realIp
    }

    const socketIp = normalizeIp(
        request?.socket?.remoteAddress,
    )

    if (socketIp) {
        return socketIp
    }

    return 'unknown'
}

function hashIp(ip) {
    return createHash('sha256')
        .update(String(ip))
        .digest('hex')
}

async function ensureRateLimitSchema() {
    if (!rateLimitSchemaReady) {
        rateLimitSchemaReady = (async () => {
            const db = getClient()

            await db.execute(`
                CREATE TABLE IF NOT EXISTS api_rate_limits (
                    scope_key TEXT NOT NULL,
                    window_start INTEGER NOT NULL,
                    request_count INTEGER NOT NULL DEFAULT 0,
                    expires_at INTEGER NOT NULL,
                    PRIMARY KEY (
                        scope_key,
                        window_start
                    )
                )
            `)

            await db.execute(`
                CREATE INDEX IF NOT EXISTS api_rate_limits_expires_index
                ON api_rate_limits (
                    expires_at
                )
            `)
        })()
    }

    await rateLimitSchemaReady
}

async function consumeRateLimit({
    request,
    scope,
    limit,
    windowSeconds,
}) {
    await ensureRateLimitSchema()

    const db = getClient()

    const now = Math.floor(
        Date.now() / 1000,
    )

    const windowStart = (
        Math.floor(now / windowSeconds)
        * windowSeconds
    )

    const resetAt = (
        windowStart
        + windowSeconds
    )

    const retryAfter = Math.max(
        resetAt - now,
        1,
    )

    const ipHash = hashIp(
        getClientIp(request),
    )

    const scopeKey = (
        `${scope}:${ipHash}`
    )

    /*
     * Remove somente contadores expirados.
     * Nenhum dado de convidado e afetado.
     */
    await db.execute({
        sql: `
            DELETE FROM api_rate_limits
            WHERE expires_at < ?
        `,
        args: [
            now - 60,
        ],
    })

    await db.execute({
        sql: `
            INSERT INTO api_rate_limits (
                scope_key,
                window_start,
                request_count,
                expires_at
            )
            VALUES (?, ?, 1, ?)

            ON CONFLICT(
                scope_key,
                window_start
            )
            DO UPDATE SET
                request_count =
                    api_rate_limits.request_count + 1,
                expires_at =
                    excluded.expires_at
        `,
        args: [
            scopeKey,
            windowStart,
            resetAt,
        ],
    })

    const result = await db.execute({
        sql: `
            SELECT request_count
            FROM api_rate_limits
            WHERE scope_key = ?
              AND window_start = ?
            LIMIT 1
        `,
        args: [
            scopeKey,
            windowStart,
        ],
    })

    const count = Number(
        result.rows[0]?.request_count || 0,
    )

    return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(
            limit - count,
            0,
        ),
        retryAfter,
        resetAt,
    }
}

export async function enforceRateLimit({
    request,
    response,
    scope,
    limit,
    windowSeconds,
    message = 'Muitas tentativas. Aguarde e tente novamente.',
}) {
    const result = await consumeRateLimit({
        request,
        scope,
        limit,
        windowSeconds,
    })

    response.setHeader(
        'X-RateLimit-Limit',
        String(result.limit),
    )

    response.setHeader(
        'X-RateLimit-Remaining',
        String(result.remaining),
    )

    response.setHeader(
        'X-RateLimit-Reset',
        String(result.resetAt),
    )

    if (result.allowed) {
        return true
    }

    response.setHeader(
        'Retry-After',
        String(result.retryAfter),
    )

    response
        .status(429)
        .json({
            error: message,
            retryAfter: result.retryAfter,
        })

    return false
}
