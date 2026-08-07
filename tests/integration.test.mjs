import assert from 'node:assert/strict'
import {
    mkdtempSync,
    rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    fileURLToPath,
} from 'node:url'
import {
    spawn,
} from 'node:child_process'
import test from 'node:test'
import {
    detectCalendarPlatform,
} from '../src/calendar-platform.js'
import {
    queueOfflineCheckin,
} from '../src/admin-offline-checkins.js'


const ROOT = fileURLToPath(
    new URL('../', import.meta.url)
)

const TEMP_DIR = mkdtempSync(
    join(tmpdir(), 'duda-integration-')
)

const DB_PATH = join(
    TEMP_DIR,
    'integration.db'
)

const PORT = 5297
const HMR_PORT = 25297

const BASE_URL =
    `http://127.0.0.1:${PORT}`

const DATABASE_URL =
    `file:${DB_PATH}`

/*
 * Valores exclusivamente de teste.
 * Nenhuma credencial real e utilizada.
 */
const TEST_ADMIN_PASSWORD =
    'senha-administrativa-de-teste'

const TEST_ADMIN_SECRET =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const TEST_EXPENSES_PASSWORD =
    'senha-financeira-de-teste'

const TEST_EXPENSES_SECRET =
    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

const TEST_CHECKIN_PASSWORD =
    'senha-de-presenca-de-teste'

const TEST_CHECKIN_SECRET =
    '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

/*
 * Mantemos o RSVP aberto independentemente
 * da data em que npm test for executado.
 */
const TEST_RSVP_NOW =
    '2026-09-01T12:00:00-03:00'

process.env.NODE_ENV = 'development'
process.env.TURSO_DATABASE_URL =
    DATABASE_URL

process.env.TURSO_AUTH_TOKEN =
    'unused-local-test-token'

process.env.ADMIN_PASSWORD =
    TEST_ADMIN_PASSWORD

process.env.ADMIN_SESSION_SECRET =
    TEST_ADMIN_SECRET

process.env.EXPENSES_PASSWORD =
    TEST_EXPENSES_PASSWORD

process.env.EXPENSES_SESSION_SECRET =
    TEST_EXPENSES_SECRET

process.env.CHECKIN_PASSWORD =
    TEST_CHECKIN_PASSWORD

process.env.CHECKIN_SESSION_SECRET =
    TEST_CHECKIN_SECRET

process.env.ALLOW_LEGACY_INVITE_CODES =
    'false'

process.env.RSVP_TEST_NOW =
    TEST_RSVP_NOW

test(
    'fila offline mantém apenas a última alteração de cada pessoa',
    () => {
        let queue =
            queueOfflineCheckin(
                [],
                {
                    guestId: 10,
                    attendeeKey: 'guest',
                    checkedIn: true,
                },
            )

        queue =
            queueOfflineCheckin(
                queue,
                {
                    guestId: 10,
                    attendeeKey: 'guest',
                    checkedIn: false,
                },
            )

        assert.equal(queue.length, 1)
        assert.equal(
            queue[0].checkedIn,
            false,
        )
    },
)


const {
    ensureSchema,
    getClient,
} = await import(
    `../server/_db.js?integration=${Date.now()}`
)

await ensureSchema()

const db = getClient()

let serverProcess = null
let serverStdout = ''
let serverStderr = ''


async function insertGuest({
    name,
    code,
    token,
    age,
    phone,
    maxCompanions = 0,
}) {
    await db.execute({
        sql: `
            INSERT INTO invited_guests (
                guest_name,
                invite_code,
                invite_token,
                age,
                whatsapp_digits,
                max_companions
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
            name,
            code,
            token,
            age,
            phone,
            maxCompanions,
        ],
    })

    const result = await db.execute({
        sql: `
            SELECT id
            FROM invited_guests
            WHERE invite_token = ?
            LIMIT 1
        `,
        args: [
            token,
        ],
    })

    const id = Number(
        result.rows[0]?.id || 0
    )

    assert.ok(
        id > 0,
        `Falha ao criar ${name}`
    )

    return {
        id,
        name,
        code,
        token,
        age,
        phone,
        maxCompanions,
    }
}


const primaryGuest = await insertGuest({
    name: 'Convidado Teste Principal',
    code: 'teste-principal',
    token: 'a'.repeat(64),
    age: 6,
    phone: '11900000001',
    maxCompanions: 2,
})

const declineGuest = await insertGuest({
    name: 'Convidado Teste Ausencia',
    code: 'teste-ausencia',
    token: 'b'.repeat(64),
    age: 30,
    phone: '11900000002',
})

const messageGuest = await insertGuest({
    name: 'Convidado Teste Mensagem',
    code: 'teste-mensagem',
    token: 'c'.repeat(64),
    age: 25,
    phone: '11900000003',
})


async function waitForServer() {
    const deadline =
        Date.now() + 15_000

    while (Date.now() < deadline) {
        if (
            serverProcess
            && serverProcess.exitCode !== null
        ) {
            throw new Error(
                [
                    'Servidor local encerrou antes do teste.',
                    '',
                    'STDOUT:',
                    serverStdout,
                    '',
                    'STDERR:',
                    serverStderr,
                ].join('\n')
            )
        }

        try {
            const response = await fetch(
                BASE_URL,
                {
                    signal:
                        AbortSignal.timeout(1000),
                }
            )

            if (response.status < 500) {
                return
            }
        } catch {
            // Servidor ainda iniciando.
        }

        await new Promise(
            resolve =>
                setTimeout(resolve, 100)
        )
    }

    throw new Error(
        [
            'Timeout aguardando servidor.',
            '',
            'STDOUT:',
            serverStdout,
            '',
            'STDERR:',
            serverStderr,
        ].join('\n')
    )
}


async function stopServer() {
    if (
        !serverProcess
        || serverProcess.exitCode !== null
    ) {
        return
    }

    serverProcess.kill('SIGTERM')

    await Promise.race([
        new Promise(resolve => {
            serverProcess.once(
                'exit',
                resolve
            )
        }),

        new Promise(resolve => {
            setTimeout(
                resolve,
                3000
            )
        }),
    ])

    if (
        serverProcess.exitCode === null
    ) {
        serverProcess.kill(
            'SIGKILL'
        )
    }
}


async function requestJson(
    path,
    {
        method = 'POST',
        body,
        ip = '10.0.0.1',
        headers = {},
    } = {},
) {
    const requestHeaders = {
        'x-forwarded-for': ip,
        ...headers,
    }

    const options = {
        method,
        headers: requestHeaders,
        signal:
            AbortSignal.timeout(5000),
    }

    if (body !== undefined) {
        requestHeaders[
            'content-type'
        ] = 'application/json'

        options.body =
            JSON.stringify(body)
    }

    const response = await fetch(
        `${BASE_URL}${path}`,
        options,
    )

    const raw =
        await response.text()

    let data = null

    try {
        data = raw
            ? JSON.parse(raw)
            : null
    } catch {
        data = {
            raw,
        }
    }

    return {
        response,
        data,
        raw,
    }
}

test(
    'agenda identifica iPhone, iPad e Android',
    () => {
        assert.equal(
            detectCalendarPlatform({
                userAgent:
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)',
                platform:
                    'iPhone',
            }),
            'ios',
        )

        assert.equal(
            detectCalendarPlatform({
                userAgent:
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
                platform:
                    'MacIntel',
                maxTouchPoints:
                    5,
            }),
            'ios',
        )

        assert.equal(
            detectCalendarPlatform({
                userAgent:
                    'Mozilla/5.0 (Linux; Android 15; Pixel 9)',
                platform:
                    'Linux armv8l',
            }),
            'android',
        )

        assert.equal(
            detectCalendarPlatform({
                userAgent:
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                platform:
                    'Win32',
            }),
            'desktop',
        )
    },
)


test(
    'fluxos criticos do convite',
    async (t) => {
        serverProcess = spawn(
            process.execPath,
            [
                'local-dev-server.mjs',
            ],
            {
                cwd: ROOT,

                env: {
                    ...process.env,

                    PORT:
                        String(PORT),

                    HMR_PORT:
                        String(HMR_PORT),

                    TURSO_DATABASE_URL:
                        DATABASE_URL,

                    TURSO_AUTH_TOKEN:
                        'unused-local-test-token',

                    ADMIN_PASSWORD:
                        TEST_ADMIN_PASSWORD,

                    ADMIN_SESSION_SECRET:
                        TEST_ADMIN_SECRET,

                    ALLOW_LEGACY_INVITE_CODES:
                        'false',

                    RSVP_TEST_NOW:
                        TEST_RSVP_NOW,

                    NODE_ENV:
                        'development',
                },

                stdio: [
                    'ignore',
                    'pipe',
                    'pipe',
                ],
            },
        )

        serverProcess.stdout.on(
            'data',
            chunk => {
                serverStdout +=
                    String(chunk)
            },
        )

        serverProcess.stderr.on(
            'data',
            chunk => {
                serverStderr +=
                    String(chunk)
            },
        )

        await waitForServer()

        await t.test(
            'guest aceita somente POST',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/guest',
                    {
                        method: 'GET',
                        ip: '10.0.0.10',
                    },
                )

                assert.equal(
                    response.status,
                    405,
                )

                assert.equal(
                    response.headers.get(
                        'allow'
                    ),
                    'POST',
                )
            },
        )

        await t.test(
            'calendario entrega evento ICS compativel com iPhone',
            async () => {
                const {
                    response,
                    raw,
                } = await requestJson(
                    '/api/calendar?platform=ios',
                    {
                        method: 'GET',
                        ip: '10.0.0.9',
                    },
                )

                assert.equal(
                    response.status,
                    200,
                )

                assert.match(
                    response.headers.get(
                        'content-type',
                    ),
                    /^text\/calendar;/,
                )

                assert.match(
                    response.headers.get(
                        'content-disposition',
                    ),
                    /^inline;.*\.ics/,
                )

                assert.equal(
                    response.headers.get(
                        'content-language',
                    ),
                    'pt-BR',
                )

                assert.match(
                    raw,
                    /^BEGIN:VCALENDAR\r\n/,
                )

                assert.match(
                    raw,
                    /\r\nBEGIN:VEVENT\r\n/,
                )

                assert.match(
                    raw,
                    /\r\nDTSTART:20261114T200000Z\r\n/,
                )

                assert.match(
                    raw,
                    /\r\nDTEND:20261115T020000Z\r\n/,
                )

                assert.match(
                    raw,
                    /\r\nSUMMARY:16 anos da Duda\r\n/,
                )

                assert.match(
                    raw,
                    /\r\nEND:VCALENDAR\r\n$/,
                )
            },
        )

        await t.test(
            'abre convite com telefone e token validos',
            async () => {
                const {
                    response,
                    data,
                } = await requestJson(
                    '/api/guest',
                    {
                        ip: '10.0.0.11',

                        body: {
                            whatsapp:
                                primaryGuest.phone,

                            invitationCode:
                                primaryGuest.token,
                        },
                    },
                )

                assert.equal(
                    response.status,
                    200,
                )

                assert.match(
                    response.headers.get(
                        'cache-control'
                    ) || '',
                    /no-store/i,
                )

                const serialized =
                    JSON.stringify(data)

                /*
                 * A resposta publica nunca deve
                 * revelar credenciais do convite.
                 */
                assert.equal(
                    serialized.includes(
                        primaryGuest.token
                    ),
                    false,
                )

                assert.equal(
                    serialized.includes(
                        primaryGuest.phone
                    ),
                    false,
                )
            },
        )

        await t.test(
            'rejeita token correto com telefone errado',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/guest',
                    {
                        ip: '10.0.0.12',

                        body: {
                            whatsapp:
                                '11900000999',

                            invitationCode:
                                primaryGuest.token,
                        },
                    },
                )

                assert.equal(
                    response.status,
                    403,
                )
            },
        )

        await t.test(
            'rejeita token incorreto',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/guest',
                    {
                        ip: '10.0.0.13',

                        body: {
                            whatsapp:
                                primaryGuest.phone,

                            invitationCode:
                                'd'.repeat(64),
                        },
                    },
                )

                assert.equal(
                    response.status,
                    403,
                )
            },
        )

        await t.test(
            'RSVP aplica corretamente a regra de buffet',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/rsvp',
                    {
                        ip: '10.0.0.20',

                        body: {
                            whatsapp:
                                primaryGuest.phone,

                            invitationCode:
                                primaryGuest.token,

                            attending:
                                'sim',

                            declineReason:
                                '',

                            companions: [
                                {
                                    slot: 1,
                                    name:
                                        'Acompanhante Maior',

                                    age: 7,
                                    attending:
                                        'sim',
                                },

                                {
                                    slot: 2,
                                    name:
                                        'Acompanhante Menor',

                                    age: 4,
                                    attending:
                                        'sim',
                                },
                            ],
                        },
                    },
                )

                assert.equal(
                    response.status,
                    201,
                )

                const rsvpResult =
                    await db.execute({
                        sql: `
                            SELECT
                                attending,
                                companions_count,
                                buffet_count
                            FROM rsvps
                            WHERE invited_guest_id = ?
                            LIMIT 1
                        `,
                        args: [
                            primaryGuest.id,
                        ],
                    })

                const rsvp =
                    rsvpResult.rows[0]

                assert.ok(rsvp)

                assert.equal(
                    rsvp.attending,
                    'sim',
                )

                /*
                 * Convidado principal tem 6 anos:
                 * nao conta no buffet.
                 *
                 * Acompanhante de 7 anos:
                 * conta.
                 *
                 * Acompanhante de 4 anos:
                 * nao conta.
                 */
                assert.equal(
                    Number(
                        rsvp.companions_count
                    ),
                    2,
                )

                assert.equal(
                    Number(
                        rsvp.buffet_count
                    ),
                    1,
                )

                const companions =
                    await db.execute({
                        sql: `
                            SELECT
                                age,
                                counts_buffet,
                                attending
                            FROM rsvp_companions
                            WHERE rsvp_id = (
                                SELECT id
                                FROM rsvps
                                WHERE invited_guest_id = ?
                                LIMIT 1
                            )
                            ORDER BY companion_slot
                        `,
                        args: [
                            primaryGuest.id,
                        ],
                    })

                assert.equal(
                    companions.rows.length,
                    2,
                )

                assert.equal(
                    Number(
                        companions
                            .rows[0]
                            .counts_buffet
                    ),
                    1,
                )

                assert.equal(
                    Number(
                        companions
                            .rows[1]
                            .counts_buffet
                    ),
                    0,
                )
            },
        )

        await t.test(
            'RSVP nao exige e grava motivo da ausencia',
            async () => {
                const reason =
                    'Viagem marcada para a data'

                const {
                    response,
                } = await requestJson(
                    '/api/rsvp',
                    {
                        ip: '10.0.0.21',

                        body: {
                            whatsapp:
                                declineGuest.phone,

                            invitationCode:
                                declineGuest.token,

                            attending:
                                'nao',

                            declineReason:
                                reason,

                            companions: [],
                        },
                    },
                )

                assert.equal(
                    response.status,
                    201,
                )

                const result =
                    await db.execute({
                        sql: `
                            SELECT
                                attending,
                                decline_reason,
                                companions_count,
                                buffet_count
                            FROM rsvps
                            WHERE invited_guest_id = ?
                            LIMIT 1
                        `,
                        args: [
                            declineGuest.id,
                        ],
                    })

                const rsvp =
                    result.rows[0]

                assert.equal(
                    rsvp.attending,
                    'nao',
                )

                assert.equal(
                    rsvp.decline_reason,
                    reason,
                )

                assert.equal(
                    Number(
                        rsvp.companions_count
                    ),
                    0,
                )

                assert.equal(
                    Number(
                        rsvp.buffet_count
                    ),
                    0,
                )
            },
        )

        await t.test(
            'mensagem funciona somente com WhatsApp validado',
            async () => {
                const message =
                    'Parabens de teste automatizado.'

                const {
                    response,
                } = await requestJson(
                    '/api/messages',
                    {
                        ip: '10.0.0.30',

                        body: {
                            invitationCode:
                                '',

                            whatsapp:
                                messageGuest.phone,

                            message,
                        },
                    },
                )

                assert.equal(
                    response.status,
                    201,
                )

                assert.match(
                    response.headers.get(
                        'cache-control'
                    ) || '',
                    /no-store/i,
                )

                const result =
                    await db.execute({
                        sql: `
                            SELECT COUNT(*) AS total
                            FROM birthday_messages
                            WHERE invited_guest_id = ?
                              AND message = ?
                        `,
                        args: [
                            messageGuest.id,
                            message,
                        ],
                    })

                assert.equal(
                    Number(
                        result.rows[0]
                            ?.total
                        || 0
                    ),
                    1,
                )
            },
        )

        await t.test(
            'admin rejeita sessao inexistente',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/admin',
                    {
                        ip: '10.0.0.40',
                        body: {},
                    },
                )

                assert.equal(
                    response.status,
                    401,
                )
            },
        )

        let adminCookie = ''

        await t.test(
            'admin rejeita senha incorreta',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/admin-login',
                    {
                        ip: '10.0.0.41',

                        body: {
                            password:
                                'senha-incorreta',
                        },
                    },
                )

                assert.equal(
                    response.status,
                    401,
                )
            },
        )

        await t.test(
            'admin cria sessao HttpOnly valida',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/admin-login',
                    {
                        ip: '10.0.0.42',

                        body: {
                            password:
                                TEST_ADMIN_PASSWORD,
                        },
                    },
                )

                assert.equal(
                    response.status,
                    200,
                )

                const setCookie =
                    response.headers.get(
                        'set-cookie'
                    ) || ''

                assert.match(
                    setCookie,
                    /duda_admin_session=/,
                )

                assert.match(
                    setCookie,
                    /HttpOnly/i,
                )

                assert.match(
                    setCookie,
                    /SameSite=Strict/i,
                )

                adminCookie =
                    setCookie.split(';')[0]

                assert.ok(
                    adminCookie
                )
            },
        )

        await t.test(
            'admin autenticado acessa o painel',
            async () => {
                const {
                    response,
                    data,
                } = await requestJson(
                    '/api/admin',
                    {
                        ip: '10.0.0.43',

                        headers: {
                            cookie:
                                adminCookie,
                        },

                        body: {},
                    },
                )

                assert.equal(
                    response.status,
                    200,
                )

                assert.ok(
                    Array.isArray(
                        data?.guests
                    )
                )

                assert.ok(
                    data.guests.length >= 3
                )
            },
        )

        await t.test(
            'prévia completa exige sessão administrativa',
            async () => {
                let result =
                    await requestJson(
                        '/api/admin-preview-session',
                        {
                            method: 'GET',
                            ip: '10.0.0.43',
                        },
                    )

                assert.equal(
                    result.response.status,
                    401,
                )

                result =
                    await requestJson(
                        '/api/admin-preview-session',
                        {
                            method: 'GET',
                            ip: '10.0.0.44',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data.authorized,
                    true,
                )
            },
        )

        await t.test(
            'admin publica configurações e gerencia a galeria',
            async () => {
                let result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip: '10.0.0.44',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                            body: {},
                        },
                    )

                const originalSettings =
                    result.data
                        .invitationConfig
                        .settings

                result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip: '10.0.0.45',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                            body: {
                                action:
                                    'saveInvitationSettings',
                                settings: {
                                    ...originalSettings,
                                    venue:
                                        'Local de teste',
                                },
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data
                        .invitationConfig
                        .settings
                        .venue,
                    'Local de teste',
                )

                result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip: '10.0.0.46',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                            body: {
                                action:
                                    'addInvitationPhoto',
                                imageData:
                                    'data:image/webp;base64,UklGRg==',
                                altText:
                                    'Foto de teste',
                                objectPosition:
                                    'center',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data
                        .invitationConfig
                        .photos
                        .length,
                    6,
                )

                const addedPhoto =
                    result.data
                        .invitationConfig
                        .photos
                        .find(
                            (photo) => (
                                photo.alt
                                === 'Foto de teste'
                            )
                        )

                assert.equal(
                    addedPhoto?.alt,
                    'Foto de teste',
                )

                const photoId =
                    addedPhoto.id

                const publicConfig =
                    await requestJson(
                        '/api/invitation-config',
                        {
                            method: 'GET',
                            ip: '10.0.0.47',
                        },
                    )

                assert.equal(
                    publicConfig.response.status,
                    200,
                )

                assert.equal(
                    publicConfig.data
                        .settings
                        .venue,
                    'Local de teste',
                )

                assert.equal(
                    publicConfig.data
                        .photos
                        .length,
                    6,
                )

                assert.ok(
                    publicConfig.data
                        .photos
                        .some(
                            (photo) => (
                                photo.alt
                                === 'Duda celebrando seus 16 anos com o bolo'
                            )
                        ),
                )

                assert.ok(
                    publicConfig.data
                        .photos
                        .some(
                            (photo) => (
                                photo.alt
                                === 'Foto de teste'
                            )
                        ),
                    'A foto adicionada deve permanecer junto da principal',
                )

                assert.equal(
                    publicConfig.data
                        .photos[0]
                        .alt,
                    'Duda celebrando seus 16 anos com o bolo',
                )

                assert.equal(
                    publicConfig.data
                        .photos[1]
                        .alt,
                    'Retrato da Duda para seus 16 anos',
                )

                await requestJson(
                    '/api/admin',
                    {
                        ip: '10.0.0.48',
                        headers: {
                            cookie:
                                adminCookie,
                        },
                        body: {
                            action:
                                'deleteInvitationPhoto',
                            photoId,
                        },
                    },
                )

                await requestJson(
                    '/api/admin',
                    {
                        ip: '10.0.0.49',
                        headers: {
                            cookie:
                                adminCookie,
                        },
                        body: {
                            action:
                                'saveInvitationSettings',
                            settings:
                                originalSettings,
                        },
                    },
                )
            },
        )

        await t.test(
            'admin cria backup e registra histórico de alterações',
            async () => {
                const result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip: '10.0.0.50',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                            body: {
                                action:
                                    'createEventBackup',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.ok(
                    result.data.backups.length >= 1,
                )

                assert.ok(
                    result.data.auditLog.some(
                        (item) => (
                            item.action
                            === 'createEventBackup'
                        ),
                    ),
                )

                const cron =
                    await requestJson(
                        '/api/cron-backup',
                        {
                            method: 'GET',
                            ip: '10.0.0.51',
                        },
                    )

                assert.equal(
                    cron.response.status,
                    200,
                )

                assert.equal(
                    cron.data.ok,
                    true,
                )
            },
        )

        await t.test(
            'admin alerta e permite confirmar possível duplicidade',
            async () => {
                const payload = {
                    action:
                        'saveGuest',
                    guestName:
                        'Possível duplicado',
                    inviteCode:
                        'possivel-duplicado',
                    age: 28,
                    whatsapp:
                        primaryGuest.phone,
                    maxCompanions: 0,
                    presetCompanions: [],
                }

                let result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip: '10.0.0.52',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                            body: payload,
                        },
                    )

                assert.equal(
                    result.response.status,
                    400,
                )

                assert.equal(
                    result.data
                        .requiresDuplicateConfirmation,
                    false,
                )

                assert.equal(
                    result.data
                        .duplicate
                        .sameWhatsapp,
                    true,
                )

                payload.guestName =
                    primaryGuest.name
                payload.whatsapp =
                    '11987654321'

                result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip: '10.0.0.53',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                            body: payload,
                        },
                    )

                assert.equal(
                    result.response.status,
                    400,
                )

                assert.equal(
                    result.data
                        .requiresDuplicateConfirmation,
                    true,
                )

                result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip: '10.0.0.54',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                            body: {
                                ...payload,
                                allowDuplicate: true,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const duplicate =
                    result.data.guests.find(
                        (guest) => (
                            guest.inviteCode
                            === 'possivel-duplicado'
                        ),
                    )

                assert.ok(duplicate)

                const deleted =
                    await requestJson(
                        '/api/admin',
                        {
                            ip: '10.0.0.55',
                            headers: {
                                cookie:
                                    adminCookie,
                            },
                            body: {
                                action:
                                    'deleteGuest',
                                id:
                                    duplicate.id,
                            },
                        },
                    )

                assert.equal(
                    deleted.response.status,
                    200,
                )
            },
        )

        await t.test(
            'admin separa confirmação de presença real por check-in',
            async () => {
                let result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip:
                                '10.0.43.1',

                            headers: {
                                cookie:
                                    adminCookie,
                            },

                            body: {
                                action:
                                    'setGuestCheckin',
                                guestId:
                                    primaryGuest.id,
                                attendeeKey:
                                    'guest',
                                checkedIn:
                                    true,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const checkedGuest =
                    result.data.guests.find(
                        (guest) => (
                            guest.id
                            === primaryGuest.id
                        ),
                    )

                assert.equal(
                    checkedGuest.checkins.length,
                    1,
                )

                assert.equal(
                    checkedGuest
                        .checkins[0]
                        .attendeeKey,
                    'guest',
                )

                assert.ok(
                    result.data.totals
                        .checkedIn >= 1,
                )

                result =
                    await requestJson(
                        '/api/admin',
                        {
                            ip:
                                '10.0.43.2',

                            headers: {
                                cookie:
                                    adminCookie,
                            },

                            body: {
                                action:
                                    'setGuestCheckin',
                                guestId:
                                    primaryGuest.id,
                                attendeeKey:
                                    'guest',
                                checkedIn:
                                    false,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data.guests
                        .find(
                            (guest) => (
                                guest.id
                                === primaryGuest.id
                            ),
                        )
                        .checkins.length,
                    0,
                )
            },
        )

        await t.test(
            'check-in usa senha e sessão separadas do admin',
            async () => {
                let result =
                    await requestJson(
                        '/api/checkin',
                        {
                            method: 'GET',
                            ip:
                                '10.0.43.10',
                        },
                    )

                assert.equal(
                    result.response.status,
                    401,
                )

                result =
                    await requestJson(
                        '/api/checkin-login',
                        {
                            ip:
                                '10.0.43.11',
                            body: {
                                password:
                                    TEST_CHECKIN_PASSWORD,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const setCookie =
                    result.response.headers
                        .get('set-cookie')
                    || ''

                assert.match(
                    setCookie,
                    /duda_checkin_session=/,
                )

                assert.match(
                    setCookie,
                    /HttpOnly/i,
                )

                const checkinCookie =
                    setCookie.split(';')[0]

                result =
                    await requestJson(
                        '/api/checkin',
                        {
                            method: 'GET',
                            ip:
                                '10.0.43.12',
                            headers: {
                                cookie:
                                    checkinCookie,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data.totals
                        .confirmed,
                    3,
                )

                assert.equal(
                    result.data.attendees
                        .length,
                    3,
                )

                result =
                    await requestJson(
                        '/api/checkin',
                        {
                            ip:
                                '10.0.43.13',
                            headers: {
                                cookie:
                                    checkinCookie,
                            },
                            body: {
                                guestId:
                                    primaryGuest.id,
                                attendeeKey:
                                    'companion:1',
                                checkedIn:
                                    true,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data.totals
                        .checkedIn,
                    1,
                )

                result =
                    await requestJson(
                        '/api/checkin',
                        {
                            ip:
                                '10.0.43.14',
                            headers: {
                                cookie:
                                    checkinCookie,
                            },
                            body: {
                                guestId:
                                    primaryGuest.id,
                                attendeeKey:
                                    'companion:1',
                                checkedIn:
                                    false,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data.totals
                        .checkedIn,
                    0,
                )
            },
        )

        await t.test(
            'admin permite cadastrar convidado sem idade',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/admin',
                    {
                        ip: '10.0.0.44',

                        headers: {
                            cookie: adminCookie,
                        },

                        body: {
                            action: 'saveGuest',
                            guestName: 'Convidado Sem Idade',
                            inviteCode: 'convidado-sem-idade',
                            age: '',
                            whatsapp: '11988886666',
                            maxCompanions: 0,
                            presetCompanions: [],
                        },
                    },
                )

                assert.equal(
                    response.status,
                    200,
                )
            },
        )


        await t.test(
            'admin cria convidado com token seguro',
            async () => {
                const phone = '11988887777'

                const {
                    response,
                } = await requestJson(
                    '/api/admin',
                    {
                        ip: '10.0.0.45',

                        headers: {
                            cookie: adminCookie,
                        },

                        body: {
                            action: 'saveGuest',
                            guestName: 'Convidado Token Teste',
                            inviteCode: 'convidado-token-teste',
                            age: 30,
                            whatsapp: phone,
                            maxCompanions: 0,
                            presetCompanions: [],
                        },
                    },
                )

                assert.equal(
                    response.status,
                    200,
                )

                const result = await db.execute({
                    sql: `
                        SELECT invite_token
                        FROM invited_guests
                        WHERE whatsapp_digits = ?
                        LIMIT 1
                    `,
                    args: [phone],
                })

                const token = String(
                    result.rows[0]?.invite_token
                    || ''
                )

                assert.match(
                    token,
                    /^[a-f0-9]{64}$/,
                )
            },
        )


        await t.test(
            'admin registra envio de convite',
            async () => {
                const guestResult =
                    await db.execute(`
                        SELECT id
                        FROM invited_guests
                        ORDER BY id
                        LIMIT 1
                    `)

                const guestId =
                    Number(
                        guestResult
                            .rows[0]
                            ?.id
                        || 0
                    )

                assert.ok(
                    guestId > 0
                )

                const {
                    response,
                    data,
                } = await requestJson(
                    '/api/admin',
                    {
                        ip:
                            '10.0.0.46',

                        headers: {
                            cookie:
                                adminCookie,
                        },

                        body: {
                            action:
                                'markCommunication',

                            guestId,

                            communicationType:
                                'convite_inicial',
                        },
                    },
                )

                assert.equal(
                    response.status,
                    200,
                )

                const guest =
                    data.guests.find(
                        (item) => (
                            item.id
                            === guestId
                        )
                    )

                assert.ok(
                    guest
                        ?.communications
                        ?.convite_inicial
                )

                const saved =
                    await db.execute({
                        sql: `
                            SELECT
                                communication_type,
                                sent_at
                            FROM guest_communications
                            WHERE invited_guest_id = ?
                              AND communication_type = ?
                            LIMIT 1
                        `,
                        args: [
                            guestId,
                            'convite_inicial',
                        ],
                    })

                assert.equal(
                    saved.rows[0]
                        ?.communication_type,
                    'convite_inicial',
                )

                assert.ok(
                    saved.rows[0]
                        ?.sent_at
                )
            },
        )


        await t.test(
            'financeiro rejeita acesso sem sessao',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/expenses',
                    {
                        ip:
                            '10.0.0.50',

                        body: {},
                    },
                )

                assert.equal(
                    response.status,
                    401,
                )
            },
        )


        let expensesCookie = ''

        await t.test(
            'financeiro cria sessao separada valida',
            async () => {
                const {
                    response,
                } = await requestJson(
                    '/api/expenses-login',
                    {
                        ip:
                            '10.0.0.51',

                        body: {
                            password:
                                TEST_EXPENSES_PASSWORD,
                        },
                    },
                )

                assert.equal(
                    response.status,
                    200,
                )

                const setCookie =
                    response.headers.get(
                        'set-cookie'
                    ) || ''

                assert.match(
                    setCookie,
                    /duda_expenses_session=/,
                )

                assert.match(
                    setCookie,
                    /HttpOnly/i,
                )

                expensesCookie =
                    setCookie.split(';')[0]

                assert.ok(
                    expensesCookie
                )
            },
        )


        await t.test(
            'financeiro controla orcamento fornecedor parcelas e pagamento inicial',
            async () => {
                let result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.52',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveBudget',

                                budgetLimit:
                                    '20000,00',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.53',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveSupplier',

                                name:
                                    'Buffet Teste',

                                contactName:
                                    'Contato Teste',

                                whatsapp:
                                    '11999990000',

                                service:
                                    'Buffet',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const supplier =
                    result.data.suppliers
                        .find(
                            (item) => (
                                item.name
                                === 'Buffet Teste'
                            )
                        )

                assert.ok(
                    supplier?.id
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.54',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveExpense',

                                description:
                                    'Buffet Festa Teste',

                                category:
                                    'Buffet',

                                supplierId:
                                    supplier.id,

                                budgetAmount:
                                    '6000,00',

                                totalAmount:
                                    '5500,00',

                                installmentCount:
                                    4,

                                dueDate:
                                    '2026-08-10',

                                initialPaidAmount:
                                    '1500,00',

                                initialPaymentDate:
                                    '2026-07-01',

                                initialPaymentMethod:
                                    'Pix',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data.totals
                        .budgetLimit,
                    2_000_000,
                )

                assert.equal(
                    result.data.totals
                        .total,
                    550_000,
                )

                assert.equal(
                    result.data.totals
                        .paid,
                    150_000,
                )

                assert.equal(
                    result.data.totals
                        .remaining,
                    400_000,
                )

                assert.equal(
                    result.data.totals
                        .confirmedGuests,
                    3,
                )

                const invitedTotalResult =
                    await db.execute(`
                        SELECT COALESCE(
                            SUM(
                                1 + COALESCE(max_companions, 0)
                            ),
                            0
                        ) AS total
                        FROM invited_guests
                    `)

                assert.equal(
                    result.data.totals
                        .invitedGuests,
                    Number(
                        invitedTotalResult
                            .rows[0]
                            ?.total
                        || 0
                    ),
                )

                assert.ok(
                    result.data.totals
                        .invitedGuests
                    > result.data.totals
                        .confirmedGuests,
                )

                const expense =
                    result.data.expenses
                        .find(
                            (item) => (
                                item.description
                                === 'Buffet Festa Teste'
                            )
                        )

                assert.ok(expense)

                assert.equal(
                    expense.supplierId,
                    supplier.id,
                )

                assert.equal(
                    expense
                        .installments
                        .length,
                    4,
                )

                const installmentTotal =
                    expense.installments
                        .reduce(
                            (
                                sum,
                                installment,
                            ) => (
                                sum
                                + installment
                                    .amountCents
                            ),
                            0,
                        )

                assert.equal(
                    installmentTotal,
                    550_000,
                )

                assert.equal(
                    expense
                        .payments
                        .length,
                    1,
                )

                assert.equal(
                    expense
                        .payments[0]
                        .amountCents,
                    150_000,
                )
            },
        )


        await t.test(
            'financeiro controla contratos com sinal e cancelamento',
            async () => {
                let result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.60',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveExpense',

                                description:
                                    'DJ com Sinal Teste',

                                category:
                                    'DJ / Som',

                                totalAmount:
                                    '5500,00',

                                installmentCount:
                                    4,

                                dueDate:
                                    '2026-09-15',

                                requiresSignal:
                                    'sim',

                                signalType:
                                    'fixed',

                                signalAmount:
                                    '1500,00',

                                signalDueDate:
                                    '2026-08-15',

                                initialPaidAmount:
                                    '500,00',

                                initialPaymentType:
                                    'sinal',

                                initialPaymentDate:
                                    '2026-08-01',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                let contract =
                    result.data.expenses.find(
                        (item) => (
                            item.description
                            === 'DJ com Sinal Teste'
                        )
                    )

                assert.ok(contract)

                assert.equal(
                    contract.signalAmountCents,
                    150_000,
                )

                assert.equal(
                    contract.signalPaidAmountCents,
                    50_000,
                )

                assert.equal(
                    contract.signalRemainingAmountCents,
                    100_000,
                )

                assert.equal(
                    contract.payments[0].paymentType,
                    'sinal',
                )

                assert.equal(
                    contract.installments.reduce(
                        (sum, installment) => (
                            sum
                            + installment.amountCents
                        ),
                        0,
                    ),
                    400_000,
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.61',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'addPayment',

                                expenseId:
                                    contract.id,

                                paymentType:
                                    'sinal',

                                amount:
                                    '1000,00',

                                paidAt:
                                    '2026-08-10',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                contract =
                    result.data.expenses.find(
                        (item) => (
                            item.id
                            === contract.id
                        )
                    )

                assert.equal(
                    contract.signalStatus,
                    'sinal_pago',
                )

                assert.equal(
                    contract.signalPaidAmountCents,
                    150_000,
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.64',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveDocument',

                                name:
                                    'Contrato DJ assinado',

                                documentType:
                                    'contrato',

                                expenseId:
                                    contract.id,

                                documentDate:
                                    '2026-08-10',

                                documentUrl:
                                    'https://example.com/contrato-dj.pdf',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const savedDocument =
                    result.data.documents.find(
                        (item) => (
                            item.name
                            === 'Contrato DJ assinado'
                        )
                    )

                assert.equal(
                    savedDocument?.expenseId,
                    contract.id,
                )

                assert.equal(
                    result.data.expenses.find(
                        (item) => (
                            item.id
                            === contract.id
                        )
                    )?.documents.length,
                    1,
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.65',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveExpense',

                                description:
                                    'Salao Sinal Geral Teste',

                                category:
                                    'Salao',

                                totalAmount:
                                    '2000,00',

                                installmentCount:
                                    2,

                                dueDate:
                                    '2026-09-25',

                                requiresSignal:
                                    'sim',

                                signalType:
                                    'fixed',

                                signalAmount:
                                    '500,00',

                                initialPaidAmount:
                                    '500,00',

                                initialPaymentDate:
                                    '2026-08-05',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const generalSignalContract =
                    result.data.expenses.find(
                        (item) => (
                            item.description
                            === 'Salao Sinal Geral Teste'
                        )
                    )

                assert.equal(
                    generalSignalContract.signalPaidAmountCents,
                    50_000,
                )

                assert.equal(
                    generalSignalContract.signalStatus,
                    'sinal_pago',
                )

                assert.equal(
                    generalSignalContract.installments.reduce(
                        (sum, installment) => (
                            sum
                            + installment.paidAmountCents
                        ),
                        0,
                    ),
                    0,
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.62',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveExpense',

                                description:
                                    'Decoracao Sinal Percentual Teste',

                                category:
                                    'Decora??o',

                                totalAmount:
                                    '2200.00',

                                installmentCount:
                                    2,

                                dueDate:
                                    '2026-09-20',

                                requiresSignal:
                                    'sim',

                                signalType:
                                    'percent',

                                signalPercent:
                                    '30',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const percentContract =
                    result.data.expenses.find(
                        (item) => (
                            item.description
                            === 'Decoracao Sinal Percentual Teste'
                        )
                    )

                assert.equal(
                    percentContract.signalAmountCents,
                    66_000,
                )

                assert.equal(
                    percentContract.installments.reduce(
                        (sum, installment) => (
                            sum
                            + installment.amountCents
                        ),
                        0,
                    ),
                    154_000,
                )

                const activeTotalBeforeCancel =
                    result.data.totals.total

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.63',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'updateContractStatus',

                                expenseId:
                                    percentContract.id,

                                contractStatus:
                                    'cancelled',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data.expenses.find(
                        (item) => (
                            item.id
                            === percentContract.id
                        )
                    )?.status,
                    'cancelado',
                )

                assert.equal(
                    result.data.totals.total,
                    activeTotalBeforeCancel
                    - 220_000,
                )
            },
        )


        await t.test(
            'financeiro gerencia checklist cronograma e lista de compras',
            async () => {
                let result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.55',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveTask',

                                title:
                                    'Confirmar quantidade final do buffet',

                                category:
                                    'Buffet',

                                responsible:
                                    'Responsavel Teste',

                                priority:
                                    'alta',

                                dueDate:
                                    '2026-10-20',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const task =
                    result.data.tasks
                        .find(
                            (item) => (
                                item.title
                                === 'Confirmar quantidade final do buffet'
                            )
                        )

                assert.ok(
                    task?.id
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.56',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'toggleTask',

                                id:
                                    task.id,

                                completed:
                                    true,
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.equal(
                    result.data.tasks
                        .find(
                            (item) => (
                                item.id
                                === task.id
                            )
                        )
                        ?.completed,
                    true,
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.57',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveTimelineItem',

                                eventTime:
                                    '17:00',

                                title:
                                    'Inicio da festa',

                                responsible:
                                    'Equipe',

                                location:
                                    'Quintal do Ibiza',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                assert.ok(
                    result.data.timeline
                        .some(
                            (item) => (
                                item.title
                                === 'Inicio da festa'
                            )
                        )
                )

                result =
                    await requestJson(
                        '/api/expenses',
                        {
                            ip:
                                '10.0.0.58',

                            headers: {
                                cookie:
                                    expensesCookie,
                            },

                            body: {
                                action:
                                    'saveShoppingItem',

                                itemName:
                                    'Gelo',

                                category:
                                    'Bebidas',

                                quantity:
                                    '10',

                                unit:
                                    'sacos',

                                unitPrice:
                                    '15,50',

                                store:
                                    'Mercado Teste',
                            },
                        },
                    )

                assert.equal(
                    result.response.status,
                    200,
                )

                const shopping =
                    result.data.shoppingItems
                        .find(
                            (item) => (
                                item.itemName
                                === 'Gelo'
                            )
                        )

                assert.ok(
                    shopping?.id
                )

                assert.equal(
                    shopping.totalPriceCents,
                    15_500,
                )

                assert.equal(
                    result.data.management
                        .tasksCompleted,
                    1,
                )

                assert.equal(
                    result.data.management
                        .timelineTotal,
                    1,
                )

                assert.equal(
                    result.data.management
                        .shoppingTotal,
                    1,
                )
            },
        )


        await t.test(
            'rate limit bloqueia excesso de login',
            async () => {
                /*
                 * IP exclusivo deste teste.
                 * Assim os testes anteriores nao
                 * consomem esta janela.
                 */
                const ip =
                    '10.0.0.50'

                for (
                    let attempt = 1;
                    attempt <= 10;
                    attempt += 1
                ) {
                    const {
                        response,
                    } = await requestJson(
                        '/api/admin-login',
                        {
                            ip,

                            body: {
                                password:
                                    'senha-errada',
                            },
                        },
                    )

                    assert.equal(
                        response.status,
                        401,
                        `Tentativa ${attempt}`
                    )
                }

                const {
                    response,
                } = await requestJson(
                    '/api/admin-login',
                    {
                        ip,

                        body: {
                            password:
                                'senha-errada',
                        },
                    },
                )

                assert.equal(
                    response.status,
                    429,
                )

                assert.ok(
                    Number(
                        response.headers.get(
                            'retry-after'
                        )
                    ) > 0
                )
            },
        )

        await stopServer()
    },
)


test(
    'exportacao da lista de convidados gera PDF e XLSX validos',
    async () => {
        const {
            createGuestsPdf,
            createGuestsXlsx,
            guestMatchesAgeFilter,
        } = await import(
            `../src/admin-guest-export.js?test=${Date.now()}`
        )

        const guestWithChild = {
            name: 'Convidado Teste',
            age: 30,
            companions: [
                {
                    name: 'Criança Teste',
                    age: 6,
                },
            ],
        }

        assert.equal(
            guestMatchesAgeFilter(
                guestWithChild,
                'ate6',
            ),
            true,
        )

        assert.equal(
            guestMatchesAgeFilter(
                guestWithChild,
                'acima6',
            ),
            true,
        )

        assert.equal(
            guestMatchesAgeFilter(
                {
                    age: '',
                    companions: [],
                },
                'sem_idade',
            ),
            true,
        )

        const columns = [
            {
                key: 'name',
                label: 'Nome',
                xlsxWidth: 28,
                pdfWidth: 220,
            },
            {
                key: 'status',
                label: 'Status',
                xlsxWidth: 16,
                pdfWidth: 120,
            },
            {
                key: 'children',
                label: 'Crianças até 6 anos',
                xlsxWidth: 30,
                pdfWidth: 300,
            },
        ]

        const rows = [
            {
                name: 'José da Silva',
                status: 'Confirmou',
                children: 'Lívia (6)',
            },
        ]

        const xlsx =
            createGuestsXlsx({
                columns,
                rows,
            })

        assert.deepEqual(
            Array.from(
                xlsx.slice(0, 4),
            ),
            [
                0x50,
                0x4B,
                0x03,
                0x04,
            ],
        )

        const pdf =
            createGuestsPdf({
                title:
                    'Lista de convidados',
                subtitle:
                    'Teste automatizado',
                filterDescription:
                    'Status: Confirmou',
                columns,
                rows,
            })

        assert.equal(
            new TextDecoder()
                .decode(
                    pdf.slice(0, 8),
                ),
            '%PDF-1.4',
        )
    },
)


test.after(async () => {
    await stopServer()

    try {
        await db.close?.()
    } catch {
        // Nenhuma acao necessaria.
    }

    rmSync(
        TEMP_DIR,
        {
            recursive: true,
            force: true,
        },
    )
})
