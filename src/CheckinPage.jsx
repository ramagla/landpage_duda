import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'

import './checkin.css'


function normalizeSearch(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim()
}


function timeBr(value) {
    if (!value) return ''

    const normalized =
        String(value)
            .replace(' ', 'T')

    const date = new Date(
        normalized.endsWith('Z')
            ? normalized
            : `${normalized}Z`
    )

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat(
        'pt-BR',
        {
            hour: '2-digit',
            minute: '2-digit',
            timeZone:
                'America/Sao_Paulo',
        },
    ).format(date)
}


async function readResponseJson(response) {
    const body =
        await response.json()
            .catch(() => ({}))

    if (!response.ok) {
        const error =
            new Error(
                body.error
                || 'Não foi possível carregar a lista.'
            )

        error.status = response.status
        throw error
    }

    return body
}


export default function CheckinPage() {
    const [password, setPassword] =
        useState('')

    const [access, setAccess] =
        useState('checking')

    const [data, setData] =
        useState(null)

    const [message, setMessage] =
        useState('')

    const [search, setSearch] =
        useState('')

    const [updating, setUpdating] =
        useState('')

    const loadCheckin =
        useCallback(
            async ({
                silent = false,
            } = {}) => {
                try {
                    const response =
                        await fetch(
                            '/api/checkin',
                            {
                                method: 'GET',
                                credentials:
                                    'same-origin',
                                cache: 'no-store',
                            },
                        )

                    const body =
                        await readResponseJson(
                            response
                        )

                    setData(body)
                    setAccess('ready')

                    if (!silent) {
                        setMessage('')
                    }
                } catch (error) {
                    if (error.status === 401) {
                        setData(null)
                        setAccess('login')
                        return
                    }

                    setAccess(
                        (current) => (
                            current === 'ready'
                                ? 'ready'
                                : 'login'
                        )
                    )
                    setMessage(error.message)
                }
            },
            [],
        )


    useEffect(() => {
        const timer =
            window.setTimeout(
                () => loadCheckin(),
                0,
            )

        return () => {
            window.clearTimeout(timer)
        }
    }, [loadCheckin])


    useEffect(() => {
        if (access !== 'ready') {
            return undefined
        }

        const timer =
            window.setInterval(
                () => {
                    if (!document.hidden) {
                        loadCheckin({
                            silent: true,
                        })
                    }
                },
                30_000,
            )

        return () => {
            window.clearInterval(timer)
        }
    }, [
        access,
        loadCheckin,
    ])


    async function handleLogin(event) {
        event.preventDefault()
        setMessage('')

        try {
            const response =
                await fetch(
                    '/api/checkin-login',
                    {
                        method: 'POST',
                        credentials:
                            'same-origin',
                        headers: {
                            'Content-Type':
                                'application/json',
                        },
                        body:
                            JSON.stringify({
                                password,
                            }),
                    },
                )

            await readResponseJson(response)
            setPassword('')
            await loadCheckin()
        } catch (error) {
            setMessage(error.message)
        }
    }


    async function handleLogout() {
        await fetch(
            '/api/checkin-logout',
            {
                method: 'POST',
                credentials:
                    'same-origin',
            },
        ).catch(() => null)

        setData(null)
        setAccess('login')
        setMessage('')
    }


    async function toggleCheckin(attendee) {
        const key =
            `${attendee.guestId}:${attendee.attendeeKey}`

        setUpdating(key)
        setMessage('')

        try {
            const response =
                await fetch(
                    '/api/checkin',
                    {
                        method: 'POST',
                        credentials:
                            'same-origin',
                        headers: {
                            'Content-Type':
                                'application/json',
                        },
                        body:
                            JSON.stringify({
                                guestId:
                                    attendee.guestId,
                                attendeeKey:
                                    attendee.attendeeKey,
                                checkedIn:
                                    !attendee.checkedInAt,
                            }),
                    },
                )

            const body =
                await readResponseJson(
                    response
                )

            setData(body)
            setMessage(body.message)
        } catch (error) {
            if (error.status === 401) {
                setAccess('login')
                setData(null)
            }

            setMessage(error.message)
        } finally {
            setUpdating('')
        }
    }


    const filteredAttendees =
        useMemo(
            () => {
                const term =
                    normalizeSearch(search)

                if (!term) {
                    return data?.attendees
                    || []
                }

                return (
                    data?.attendees
                    || []
                ).filter((attendee) => (
                    normalizeSearch(
                        [
                            attendee.attendeeName,
                            attendee.invitationName,
                        ].join(' ')
                    ).includes(term)
                ))
            },
            [
                data,
                search,
            ],
        )


    if (access === 'checking') {
        return (
            <main
                className="presence-shell presence-loading"
                role="status"
            >
                Carregando lista de presença...
            </main>
        )
    }


    if (access === 'login') {
        return (
            <main className="presence-shell presence-login-shell">
                <section className="presence-login-card">
                    <span className="presence-logo" aria-hidden="true">
                        16
                    </span>

                    <p className="presence-kicker">
                        Acesso da recepção
                    </p>

                    <h1>
                        Check-in da festa
                    </h1>

                    <p>
                        Use a senha exclusiva da lista de presença.
                    </p>

                    <form onSubmit={handleLogin}>
                        <label>
                            <span>Senha do check-in</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => (
                                    setPassword(
                                        event.target.value
                                    )
                                )}
                                autoComplete="current-password"
                                required
                                autoFocus
                            />
                        </label>

                        <button type="submit">
                            Abrir lista
                        </button>
                    </form>

                    {message ? (
                        <p
                            className="presence-message presence-message--error"
                            role="alert"
                        >
                            {message}
                        </p>
                    ) : null}
                </section>
            </main>
        )
    }


    const confirmed =
        data?.totals?.confirmed
        || 0

    const checkedIn =
        data?.totals?.checkedIn
        || 0

    return (
        <main className="presence-shell">
            <header className="presence-header">
                <div>
                    <p className="presence-kicker">
                        Recepção • 16 anos da Duda
                    </p>
                    <h1>
                        Lista de presença
                    </h1>
                    <p>
                        Toque em “Registrar entrada” quando a pessoa chegar.
                    </p>
                </div>

                <button
                    type="button"
                    className="presence-logout"
                    onClick={handleLogout}
                >
                    Sair
                </button>
            </header>

            <section className="presence-summary" aria-label="Resumo">
                <article>
                    <span>Confirmados</span>
                    <strong>{confirmed}</strong>
                </article>
                <article className="presence-summary--checked">
                    <span>Presentes</span>
                    <strong>{checkedIn}</strong>
                </article>
                <article>
                    <span>Aguardando</span>
                    <strong>
                        {Math.max(
                            confirmed - checkedIn,
                            0,
                        )}
                    </strong>
                </article>
            </section>

            <section className="presence-list-panel">
                <div className="presence-toolbar">
                    <label>
                        <span>
                            Buscar convidado
                        </span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => (
                                setSearch(
                                    event.target.value
                                )
                            )}
                            placeholder="Digite o nome..."
                            autoComplete="off"
                        />
                    </label>

                    <button
                        type="button"
                        onClick={() => loadCheckin()}
                    >
                        Atualizar
                    </button>
                </div>

                {message ? (
                    <p
                        className="presence-message"
                        role="status"
                    >
                        {message}
                    </p>
                ) : null}

                <div className="presence-list">
                    {filteredAttendees.map((attendee) => {
                        const key =
                            `${attendee.guestId}:${attendee.attendeeKey}`

                        const present =
                            Boolean(
                                attendee.checkedInAt
                            )

                        return (
                            <article
                                className={
                                    present
                                        ? 'presence-card presence-card--checked'
                                        : 'presence-card'
                                }
                                key={key}
                            >
                                <div className="presence-card__status">
                                    {present
                                        ? '✓'
                                        : ''}
                                </div>

                                <div className="presence-card__person">
                                    <strong>
                                        {attendee.attendeeName}
                                    </strong>

                                    {attendee.attendeeKey !== 'guest' ? (
                                        <small>
                                            Convite de {attendee.invitationName}
                                        </small>
                                    ) : (
                                        <small>
                                            Titular do convite
                                        </small>
                                    )}

                                    {present ? (
                                        <span>
                                            Entrada às {timeBr(
                                                attendee.checkedInAt
                                            )}
                                        </span>
                                    ) : null}
                                </div>

                                <button
                                    type="button"
                                    aria-pressed={present}
                                    disabled={updating === key}
                                    onClick={() => (
                                        toggleCheckin(
                                            attendee
                                        )
                                    )}
                                >
                                    {updating === key
                                        ? 'Salvando...'
                                        : present
                                            ? '✓ Presente'
                                            : 'Registrar entrada'}
                                </button>
                            </article>
                        )
                    })}

                    {filteredAttendees.length === 0 ? (
                        <p className="presence-empty">
                            Nenhuma pessoa encontrada.
                        </p>
                    ) : null}
                </div>
            </section>
        </main>
    )
}
