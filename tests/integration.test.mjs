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

process.env.ALLOW_LEGACY_INVITE_CODES =
    'false'

process.env.RSVP_TEST_NOW =
    TEST_RSVP_NOW


const {
    ensureSchema,
    getClient,
} = await import(
    `../api/_db.js?integration=${Date.now()}`
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
