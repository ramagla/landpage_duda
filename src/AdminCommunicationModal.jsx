import {
    useMemo,
    useState,
} from 'react'


const TYPES = {
    convite_inicial: {
        label: 'Convite inicial',
        shortLabel: 'Inicial',
        availableFrom: null,
    },

    lembrete_60d: {
        label: 'Lembrete de 60 dias',
        shortLabel: '60 dias',
        availableFrom: '2026-09-15T00:00:00-03:00',
        availableDisplay: '15/09/2026',
    },

    lembrete_30d: {
        label: 'Lembrete de 30 dias',
        shortLabel: '30 dias',
        availableFrom: '2026-10-15T00:00:00-03:00',
        availableDisplay: '15/10/2026',
    },

    lembrete_10d: {
        label: 'Lembrete de 10 dias',
        shortLabel: '10 dias',
        availableFrom: '2026-11-04T00:00:00-03:00',
        availableDisplay: '04/11/2026',
    },
}


const TEMPLATES = {
    convite_inicial: [
        '💚 Olá, {nome}!',
        '',
        'Este é o seu convite para os 16 anos da Duda. ✨🎉',
        '',
        'Para abrir o convite, acesse o link abaixo e informe o seu número de celular:',
        '👉 {link}',
        '',
        'Esperamos você! 💚',
    ].join('\n'),

    lembrete_60d: [
        '💚 Olá, {nome}!',
        '',
        'Faltam só 60 dias para os 16 anos da Duda! 🎉✨',
        '',
        'Estamos preparando tudo com muito carinho e gostaríamos que você confirmasse sua presença até 14/10/2026.',
        '',
        'Acesse seu convite individual:',
        '👉 {link}',
        '',
        'Por lá você também encontra todas as informações da festa e nossa lista de presentes/Pix. 🎁',
        '',
        'Esperamos você! 💚',
    ].join('\n'),

    lembrete_30d: [
        '💚 Olá, {nome}!',
        '',
        'Falta só 1 mês para os 16 anos da Duda! ✨🎉',
        '',
        '📅 14/11/2026',
        '🕔 17h',
        '📍 Quintal do Ibiza',
        '',
        'Seu convite e todas as informações estão aqui:',
        '👉 {link}',
        '',
        'Estamos ansiosos para comemorar esse momento com você! 💚',
    ].join('\n'),

    lembrete_10d: [
        '🎉 Está chegando, {nome}!',
        '',
        'Faltam apenas 10 dias para os 16 anos da Duda! ✨',
        '',
        '📅 14/11/2026',
        '🕔 A partir das 17h',
        '📍 Quintal do Ibiza',
        'Rua Corumbataí, 100 - Vila Virgínia, Itaquaquecetuba - SP',
        '',
        'Confira seu convite:',
        '👉 {link}',
        '',
        'Esperamos você para celebrar com a gente! 💚✨',
    ].join('\n'),
}


function digitsOnly(value) {
    return String(value || '')
        .replace(/\D/g, '')
}


function getInviteUrl(
    guest,
    baseUrl,
) {
    if (!guest?.inviteToken) {
        return ''
    }

    return (
        `${baseUrl}/?convite=`
        + guest.inviteToken
    )
}


function renderTemplate(
    template,
    guest,
    baseUrl,
) {
    return String(template || '')
        .replaceAll(
            '{nome}',
            guest?.name || 'convidado',
        )
        .replaceAll(
            '{link}',
            getInviteUrl(
                guest,
                baseUrl,
            ),
        )
}


function isCommunicationAvailable(type) {
    const item = TYPES[type]

    if (!item?.availableFrom) {
        return true
    }

    return (
        Date.now()
        >= new Date(
            item.availableFrom
        ).getTime()
    )
}


function isEligible(
    guest,
    type,
) {
    if (
        !guest?.whatsapp
        || !guest?.inviteToken
    ) {
        return false
    }

    if (
        guest.communications?.[type]
    ) {
        return false
    }

    if (
        type === 'lembrete_30d'
        || type === 'lembrete_10d'
    ) {
        return guest.status === 'sim'
    }

    if (type === 'lembrete_60d') {
        return guest.status !== 'nao'
    }

    return true
}


export default function AdminCommunicationModal({
    guests,
    baseUrl,
    onClose,
    onMarkSent,
}) {
    const [type, setType] =
        useState('convite_inicial')

    const [statusFilter, setStatusFilter] =
        useState('todos')

    const [currentIndex, setCurrentIndex] =
        useState(0)

    const [template, setTemplate] =
        useState(
            TEMPLATES.convite_inicial
        )

    const [marking, setMarking] =
        useState(false)

    const typeAvailable =
        isCommunicationAvailable(type)

    const queue = useMemo(() => {
        if (!typeAvailable) {
            return []
        }

        return (guests || [])
            .filter(
                (guest) => (
                    isEligible(
                        guest,
                        type,
                    )
                )
            )
            .filter((guest) => {
                if (
                    statusFilter === 'todos'
                ) {
                    return true
                }

                return (
                    guest.status
                    === statusFilter
                )
            })
    }, [
        guests,
        type,
        statusFilter,
        typeAvailable,
    ])

    const safeIndex = Math.min(
        currentIndex,
        Math.max(
            queue.length - 1,
            0,
        ),
    )

    const currentGuest =
        queue[safeIndex] || null

    const message =
        currentGuest
            ? renderTemplate(
                template,
                currentGuest,
                baseUrl,
            )
            : ''

    function changeType(nextType) {
        setType(nextType)
        setCurrentIndex(0)

        setTemplate(
            TEMPLATES[nextType]
            || ''
        )
    }

    function openWhatsapp() {
        if (!currentGuest) {
            return
        }

        let phone = digitsOnly(
            currentGuest.whatsapp
        )

        if (
            !phone.startsWith('55')
            || phone.length < 12
        ) {
            phone = `55${phone}`
        }

        const url = (
            `https://wa.me/${phone}`
            + `?text=${encodeURIComponent(message)}`
        )

        window.open(
            url,
            '_blank',
            'noopener,noreferrer',
        )
    }

    async function markAndNext() {
        if (
            !currentGuest
            || marking
        ) {
            return
        }

        setMarking(true)

        try {
            await onMarkSent(
                currentGuest,
                type,
            )

            /*
             * O convidado marcado desaparece da fila
             * quando o estado do painel for atualizado.
             * Mantemos o indice atual para cair no próximo.
             */
            setCurrentIndex(
                (index) => Math.max(
                    index,
                    0,
                )
            )
        } finally {
            setMarking(false)
        }
    }

    return (
        <div
            className="communication-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (
                    event.target
                    === event.currentTarget
                ) {
                    onClose()
                }
            }}
        >
            <section
                className="communication-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="communication-title"
            >
                <header className="communication-modal__header">
                    <div>
                        <p className="panel-kicker">
                            WhatsApp
                        </p>

                        <h2 id="communication-title">
                            Disparos e lembretes
                        </h2>

                        <p>
                            Abra a mensagem no WhatsApp e,
                            após enviar, registre o envio no painel.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="communication-modal__close"
                        onClick={onClose}
                        aria-label="Fechar"
                    >
                        ×
                    </button>
                </header>

                <div className="communication-type-grid">
                    {Object.entries(TYPES)
                        .map(
                            ([key, item]) => {
                                const available =
                                    isCommunicationAvailable(
                                        key
                                    )

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        className={[
                                            'communication-type',
                                            key === type
                                                ? 'communication-type--active'
                                                : '',
                                            !available
                                                ? 'communication-type--locked'
                                                : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => changeType(key)}
                                    >
                                        <strong>
                                            {item.shortLabel}
                                        </strong>

                                        <small>
                                            {available
                                                ? 'Disponível'
                                                : `Libera ${item.availableDisplay}`}
                                        </small>
                                    </button>
                                )
                            }
                        )}
                </div>

                {!typeAvailable ? (
                    <div className="communication-date-lock">
                        <strong>
                            🔒 Este disparo ainda não está disponível
                        </strong>

                        <span>
                            {TYPES[type]?.label}
                            {' será liberado em '}
                            {TYPES[type]?.availableDisplay}.
                        </span>
                    </div>
                ) : null}

                <div className="communication-toolbar">
                    <label>
                        <span>Status</span>

                        <select
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(
                                    event.target.value
                                )

                                setCurrentIndex(0)
                            }}
                        >
                            <option value="todos">
                                Todos elegíveis
                            </option>

                            <option value="pendente">
                                Pendentes
                            </option>

                            <option value="visualizou">
                                Visualizaram
                            </option>

                            <option value="sim">
                                Confirmados
                            </option>
                        </select>
                    </label>

                    <div className="communication-counter">
                        <strong>
                            {queue.length}
                        </strong>

                        <span>
                            para enviar
                        </span>
                    </div>
                </div>

                {typeAvailable && currentGuest ? (
                    <>
                        <div className="communication-current">
                            <div>
                                <span>
                                    Envio atual
                                </span>

                                <strong>
                                    {currentGuest.name}
                                </strong>

                                <small>
                                    {safeIndex + 1}
                                    {' de '}
                                    {queue.length}
                                </small>
                            </div>

                            <div className="communication-history-mini">
                                <span>
                                    Inicial
                                    {' '}
                                    {currentGuest.communications?.convite_inicial
                                        ? '✓'
                                        : '—'}
                                </span>

                                <span>
                                    60d
                                    {' '}
                                    {currentGuest.communications?.lembrete_60d
                                        ? '✓'
                                        : '—'}
                                </span>

                                <span>
                                    30d
                                    {' '}
                                    {currentGuest.communications?.lembrete_30d
                                        ? '✓'
                                        : '—'}
                                </span>

                                <span>
                                    10d
                                    {' '}
                                    {currentGuest.communications?.lembrete_10d
                                        ? '✓'
                                        : '—'}
                                </span>
                            </div>
                        </div>

                        <label className="communication-message-editor">
                            <span>
                                Mensagem
                            </span>

                            <textarea
                                rows="13"
                                value={template}
                                onChange={(event) => (
                                    setTemplate(
                                        event.target.value
                                    )
                                )}
                            />
                        </label>

                        <div className="communication-preview">
                            <span>
                                Prévia para {currentGuest.name}
                            </span>

                            <pre>
                                {message}
                            </pre>
                        </div>

                        <div className="communication-actions">
                            <button
                                className="communication-whatsapp"
                                type="button"
                                onClick={openWhatsapp}
                            >
                                ◉ Abrir no WhatsApp
                            </button>

                            <button
                                className="communication-mark"
                                type="button"
                                onClick={markAndNext}
                                disabled={marking}
                            >
                                {marking
                                    ? 'Registrando...'
                                    : '✓ Marcar enviado e próximo'}
                            </button>
                        </div>

                        <p className="communication-warning">
                            O sistema não marca automaticamente:
                            abrir o WhatsApp não garante que a mensagem
                            tenha sido realmente enviada.
                        </p>
                    </>
                ) : typeAvailable ? (
                    <div className="communication-empty">
                        <strong>
                            Tudo certo por aqui ✓
                        </strong>

                        <p>
                            Não existem convidados pendentes
                            para este disparo com o filtro selecionado.
                        </p>
                    </div>
                ) : (
                    <div className="communication-empty communication-empty--locked">
                        <strong>
                            Aguardando a data do disparo
                        </strong>

                        <p>
                            Este lembrete será liberado automaticamente na data programada.
                        </p>
                    </div>
                )}
            </section>
        </div>
    )
}
