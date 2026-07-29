import {
    useMemo,
    useState,
} from 'react'

import './admin-enhancements.css'

const ACTION_LABELS = {
    guest_created:
        'Convidado cadastrado',
    guest_updated:
        'Convidado atualizado',
    guest_deleted:
        'Convidado excluído',
    rsvp_created:
        'Resposta recebida',
    rsvp_updated:
        'Resposta atualizada',
    checkin_added:
        'Entrada registrada',
    checkin_removed:
        'Entrada removida',
    saveInvitationSettings:
        'Configurações publicadas',
    addInvitationPhoto:
        'Foto adicionada',
    updateInvitationPhoto:
        'Foto atualizada',
    setPrimaryInvitationPhoto:
        'Foto principal alterada',
    reorderInvitationPhotos:
        'Galeria reordenada',
    deleteInvitationPhoto:
        'Foto excluída',
    createEventBackup:
        'Backup manual criado',
}

function percentage(value, total) {
    if (!total) return 0

    return Math.min(
        Math.round(
            (value / total) * 100,
        ),
        100,
    )
}

function formatDate(value) {
    if (!value) return 'Ainda não criado'

    const date = new Date(
        String(value).endsWith('Z')
            ? value
            : `${value}Z`,
    )

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat(
        'pt-BR',
        {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone:
                'America/Sao_Paulo',
        },
    ).format(date)
}

export default function AdminHealthOverview({
    data,
    onAdminAction,
}) {
    const [creatingBackup, setCreatingBackup] =
        useState(false)
    const [feedback, setFeedback] =
        useState('')

    const health = useMemo(() => {
        const totals = data.totals
        const answered =
            totals.confirmed
            + totals.declined
        const responseRate =
            percentage(
                answered,
                totals.invited,
            )
        const sentRate =
            percentage(
                totals.invitesSent,
                data.guests.length,
            )

        const confirmedPeople =
            data.guests.flatMap(
                (guest) => (
                    guest.status === 'sim'
                        ? [
                            {
                                name: guest.name,
                                age: guest.age,
                            },
                            ...(guest.companions || [])
                                .filter(
                                    (companion) => (
                                        companion.attending
                                        !== 'nao'
                                    ),
                                ),
                        ]
                        : []
                ),
            )

        const missingAges =
            confirmedPeople.filter(
                (person) => (
                    person.age === ''
                    || person.age === null
                    || person.age === undefined
                ),
            ).length

        const ageRate =
            confirmedPeople.length > 0
                ? percentage(
                    confirmedPeople.length
                        - missingAges,
                    confirmedPeople.length,
                )
                : 100

        const score =
            Math.round(
                (
                    responseRate
                    + sentRate
                    + ageRate
                ) / 3,
            )

        const alerts = []

        if (totals.invitesNotSent > 0) {
            alerts.push(
                `${totals.invitesNotSent} convite${totals.invitesNotSent === 1 ? '' : 's'} ainda não enviado${totals.invitesNotSent === 1 ? '' : 's'}.`,
            )
        }

        if (totals.viewed > 0) {
            alerts.push(
                `${totals.viewed} convidado${totals.viewed === 1 ? '' : 's'} acessou sem responder.`,
            )
        }

        if (missingAges > 0) {
            alerts.push(
                `${missingAges} pessoa${missingAges === 1 ? '' : 's'} confirmada${missingAges === 1 ? '' : 's'} sem idade informada.`,
            )
        }

        return {
            responseRate,
            sentRate,
            ageRate,
            missingAges,
            score,
            alerts,
        }
    }, [data])

    const latestBackup =
        data.backups?.[0]

    async function createBackup() {
        setCreatingBackup(true)
        setFeedback('')

        try {
            await onAdminAction({
                action:
                    'createEventBackup',
            })

            setFeedback(
                'Backup atualizado com sucesso.',
            )
        } catch (error) {
            setFeedback(error.message)
        } finally {
            setCreatingBackup(false)
        }
    }

    return (
        <section className="admin-health-layout">
            <article className="confirm-panel admin-health-card">
                <header>
                    <div>
                        <p className="panel-kicker">
                            Visão operacional
                        </p>
                        <h2>Saúde do evento</h2>
                    </div>

                    <strong
                        className={
                            health.score >= 80
                                ? 'is-good'
                                : health.score >= 55
                                    ? 'is-attention'
                                    : 'is-critical'
                        }
                    >
                        {health.score}%
                    </strong>
                </header>

                <div className="admin-health-bars">
                    {[
                        [
                            'Respostas',
                            health.responseRate,
                        ],
                        [
                            'Convites enviados',
                            health.sentRate,
                        ],
                        [
                            'Idades preenchidas',
                            health.ageRate,
                        ],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <span>
                                {label}
                                <b>{value}%</b>
                            </span>
                            <i>
                                <em
                                    style={{
                                        width:
                                            `${value}%`,
                                    }}
                                />
                            </i>
                        </div>
                    ))}
                </div>

                <ul className="admin-health-alerts">
                    {health.alerts.length > 0
                        ? health.alerts.map(
                            (alert) => (
                                <li key={alert}>
                                    {alert}
                                </li>
                            ),
                        )
                        : (
                            <li className="is-clear">
                                Nenhuma pendência importante no momento.
                            </li>
                        )}
                </ul>
            </article>

            <article className="confirm-panel admin-backup-card">
                <header>
                    <div>
                        <p className="panel-kicker">
                            Proteção dos dados
                        </p>
                        <h2>Backups</h2>
                    </div>
                </header>

                <div className="admin-backup-status">
                    <span>Último backup</span>
                    <strong>
                        {formatDate(
                            latestBackup
                                ?.createdAt,
                        )}
                    </strong>
                    <small>
                        {latestBackup
                            ? `Origem: ${latestBackup.source === 'automatic' ? 'automático' : 'painel'}`
                            : 'O primeiro backup será criado automaticamente.'}
                    </small>
                </div>

                <button
                    type="button"
                    onClick={createBackup}
                    disabled={creatingBackup}
                >
                    {creatingBackup
                        ? 'Criando backup...'
                        : 'Criar backup agora'}
                </button>

                {feedback ? (
                    <p role="status">
                        {feedback}
                    </p>
                ) : null}
            </article>

            <article className="confirm-panel admin-audit-card">
                <header>
                    <div>
                        <p className="panel-kicker">
                            Rastreabilidade
                        </p>
                        <h2>Alterações recentes</h2>
                    </div>
                </header>

                <ol>
                    {(data.auditLog || [])
                        .slice(0, 12)
                        .map((item) => (
                            <li key={item.id}>
                                <span>
                                    <strong>
                                        {ACTION_LABELS[item.action]
                                        || item.action}
                                    </strong>
                                    <small>
                                        {item.label
                                        || item.entityType}
                                        {' · '}
                                        {item.actor === 'guest'
                                            ? 'pelo convidado'
                                            : 'pelo painel'}
                                    </small>
                                </span>
                                <time>
                                    {formatDate(
                                        item.createdAt,
                                    )}
                                </time>
                            </li>
                        ))}
                </ol>

                {(data.auditLog || []).length === 0 ? (
                    <p>
                        As próximas alterações aparecerão aqui.
                    </p>
                ) : null}
            </article>
        </section>
    )
}
