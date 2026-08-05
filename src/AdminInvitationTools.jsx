import {
    useEffect,
    useMemo,
    useState,
} from 'react'

import {
    DEFAULT_INVITATION_CONFIG,
    buildInvitationConfig,
} from '../shared/invitation-config.js'
import AdminHealthOverview from './AdminHealthOverview.jsx'

const ADMIN_SECTIONS = [
    ['resumo', 'Resumo', '⌂'],
    ['convidados', 'Convidados', '♙'],
    ['galeria', 'Galeria', '▣'],
    ['preview', 'Prévia', '◉'],
    ['comunicacao', 'Comunicação', '↗'],
    ['relatorios', 'Relatórios', '▥'],
    ['configuracoes', 'Configurações', '⚙'],
]

function loadImage(file) {
    return new Promise(
        (resolve, reject) => {
            const image = new Image()
            const url =
                URL.createObjectURL(file)

            image.onload = () => {
                URL.revokeObjectURL(url)
                resolve(image)
            }

            image.onerror = () => {
                URL.revokeObjectURL(url)
                reject(
                    new Error(
                        'Não foi possível abrir a imagem.',
                    ),
                )
            }

            image.src = url
        },
    )
}

async function optimizePhoto(file) {
    if (!file?.type?.startsWith('image/')) {
        throw new Error(
            'Escolha um arquivo de imagem.',
        )
    }

    if (file.size > 15 * 1024 * 1024) {
        throw new Error(
            'A imagem original deve ter no máximo 15 MB.',
        )
    }

    const image =
        await loadImage(file)

    const maxWidth = 1200
    const maxHeight = 1500
    const scale = Math.min(
        maxWidth / image.naturalWidth,
        maxHeight / image.naturalHeight,
        1,
    )

    const width =
        Math.max(
            Math.round(
                image.naturalWidth * scale,
            ),
            1,
        )

    const height =
        Math.max(
            Math.round(
                image.naturalHeight * scale,
            ),
            1,
        )

    const canvas =
        document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const context =
        canvas.getContext('2d', {
            alpha: false,
        })

    context.fillStyle = '#edebdd'
    context.fillRect(0, 0, width, height)
    context.drawImage(
        image,
        0,
        0,
        width,
        height,
    )

    let quality = .78
    let imageData =
        canvas.toDataURL(
            'image/webp',
            quality,
        )

    while (
        imageData.length > 420_000
        && quality > .48
    ) {
        quality -= .06
        imageData =
            canvas.toDataURL(
                'image/webp',
                quality,
            )
    }

    if (imageData.length > 450_000) {
        throw new Error(
            'Esta foto tem muitos detalhes. Use uma imagem menor para manter o convite rápido.',
        )
    }

    return imageData
}

function AdminNavigation({
    activeSection,
    onChange,
}) {
    return (
        <nav
            className="admin-main-navigation"
            aria-label="Menu principal do painel"
        >
            {ADMIN_SECTIONS.map(
                ([value, label, icon]) => (
                    <button
                        className={
                            activeSection === value
                                ? 'is-active'
                                : undefined
                        }
                        type="button"
                        key={value}
                        onClick={() => onChange(value)}
                        aria-current={
                            activeSection === value
                                ? 'page'
                                : undefined
                        }
                    >
                        <span aria-hidden="true">
                            {icon}
                        </span>
                        {label}
                    </button>
                ),
            )}

            <a href="/despesas">
                <span aria-hidden="true">R$</span>
                Financeiro
            </a>

            <a
                href="/presenca"
                target="_blank"
                rel="noreferrer"
            >
                <span aria-hidden="true">✓</span>
                Presença
            </a>
        </nav>
    )
}

function GalleryPanel({
    config,
    onAdminAction,
}) {
    const [uploading, setUploading] =
        useState(false)

    const [message, setMessage] =
        useState('')

    const photos = config.photos || []

    async function handleUpload(event) {
        const file =
            event.target.files?.[0]

        event.target.value = ''

        if (!file) return

        setUploading(true)
        setMessage(
            'Otimizando a foto...',
        )

        try {
            const imageData =
                await optimizePhoto(file)

            await onAdminAction({
                action:
                    'addInvitationPhoto',
                imageData,
                altText:
                    `Foto da ${config.settings.celebrantName}`,
                objectPosition:
                    'center 28%',
            })

            setMessage(
                'Foto adicionada e otimizada em WebP.',
            )
        } catch (error) {
            setMessage(error.message)
        } finally {
            setUploading(false)
        }
    }

    async function movePhoto(index, direction) {
        const nextIndex =
            index + direction

        if (
            nextIndex < 0
            || nextIndex >= photos.length
        ) {
            return
        }

        const nextPhotos = [...photos]

        ;[
            nextPhotos[index],
            nextPhotos[nextIndex],
        ] = [
            nextPhotos[nextIndex],
            nextPhotos[index],
        ]

        await onAdminAction({
            action:
                'reorderInvitationPhotos',
            photoIds:
                nextPhotos.map(
                    (photo) => photo.id,
                ),
        })
    }

    return (
        <section
            className="confirm-panel admin-tool-panel admin-gallery-panel"
            aria-labelledby="admin-gallery-title"
        >
            <header className="admin-tool-heading">
                <div>
                    <p className="panel-kicker">
                        Fotos do convite
                    </p>
                    <h2 id="admin-gallery-title">
                        Galeria da Duda
                    </h2>
                    <p>
                        Adicione até 10 fotos. O site comprime cada imagem e
                        cria o carrossel com troca automática a cada
                        5 segundos.
                    </p>
                </div>

                <label className="admin-upload-photo">
                    <span
                        className="admin-upload-photo__icon"
                        aria-hidden="true"
                    >
                        +
                    </span>
                    <span>
                        {uploading
                            ? 'Processando...'
                            : 'Adicionar foto'}
                    </span>
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleUpload}
                        disabled={uploading}
                    />
                </label>
            </header>

            {message ? (
                <p className="admin-tool-feedback" role="status">
                    {message}
                </p>
            ) : null}

            <div className="admin-gallery-summary">
                <div>
                    <strong>
                        {photos.length}
                        {' '}
                        de 10 fotos
                    </strong>
                    <span>
                        no carrossel do convite
                    </span>
                </div>

                <p>
                    Todas as fotos abaixo aparecem no carrossel. A foto
                    principal abre primeiro; use as setas para alterar a ordem.
                </p>
            </div>

            <div className="admin-gallery-grid">
                {photos.map((photo, index) => (
                    <article
                        className="admin-gallery-card"
                        key={photo.id}
                    >
                        <div className="admin-gallery-image">
                            <img
                                src={photo.src}
                                alt={photo.alt}
                                style={{
                                    objectPosition:
                                        photo.objectPosition,
                                }}
                            />
                            {photo.isPrimary ? (
                                <strong>
                                    Foto principal
                                </strong>
                            ) : null}

                            <span className="admin-gallery-position">
                                {index + 1}
                            </span>
                        </div>

                        <form
                            onSubmit={async (event) => {
                                event.preventDefault()

                                const form =
                                    new FormData(
                                        event.currentTarget,
                                    )

                                await onAdminAction({
                                    action:
                                        'updateInvitationPhoto',
                                    photoId:
                                        photo.id,
                                    altText:
                                        form.get('altText'),
                                    objectPosition:
                                        form.get('objectPosition'),
                                })
                            }}
                        >
                            <label>
                                <span>Descrição</span>
                                <input
                                    name="altText"
                                    defaultValue={photo.alt}
                                    maxLength="120"
                                />
                            </label>

                            <label>
                                <span>
                                    Posição da foto no carrossel
                                </span>
                                <select
                                    name="objectPosition"
                                    defaultValue={
                                        photo.objectPosition
                                    }
                                >
                                    <option value="center 20%">
                                        Mostrar mais a parte de cima
                                    </option>
                                    <option value="center 35%">
                                        Um pouco acima do centro
                                    </option>
                                    <option value="center">
                                        Mostrar o centro da foto
                                    </option>
                                    <option value="center 65%">
                                        Mostrar mais a parte de baixo
                                    </option>
                                </select>

                                <small>
                                    Define qual parte fica visível quando
                                    o carrossel recorta a foto para preencher
                                    a tela.
                                </small>
                            </label>

                            <button type="submit">
                                Salvar descrição e posição
                            </button>
                        </form>

                        <div className="admin-gallery-actions">
                            <button
                                type="button"
                                onClick={() => movePhoto(index, -1)}
                                disabled={index === 0}
                                aria-label="Mover foto para a esquerda"
                            >
                                ←
                            </button>
                            <button
                                type="button"
                                onClick={() => movePhoto(index, 1)}
                                disabled={index === photos.length - 1}
                                aria-label="Mover foto para a direita"
                            >
                                →
                            </button>
                            <button
                                type="button"
                                disabled={photo.isPrimary}
                                onClick={() => onAdminAction({
                                    action:
                                        'setPrimaryInvitationPhoto',
                                    photoId:
                                        photo.id,
                                })}
                            >
                                {photo.isPrimary
                                    ? 'Foto principal'
                                    : 'Tornar principal'}
                            </button>
                            <button
                                className="admin-gallery-delete"
                                type="button"
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            'Excluir esta foto da galeria?',
                                        )
                                    ) {
                                        onAdminAction({
                                            action:
                                                'deleteInvitationPhoto',
                                            photoId:
                                                photo.id,
                                        })
                                    }
                                }}
                            >
                                Excluir
                            </button>
                        </div>
                    </article>
                ))}

                {photos.length === 0 ? (
                    <p className="admin-tool-empty">
                        Nenhuma foto no carrossel. Clique em “Adicionar foto”
                        para começar.
                    </p>
                ) : null}
            </div>

            {photos.length === 0 ? (
                <p className="admin-tool-empty">
                    A foto padrão continuará aparecendo até você adicionar
                    a primeira imagem.
                </p>
            ) : null}
        </section>
    )
}

function PreviewPanel() {
    const [device, setDevice] =
        useState('desktop')
    const [frameVersion, setFrameVersion] =
        useState(0)

    return (
        <section
            className="confirm-panel admin-tool-panel admin-preview-panel"
            aria-labelledby="admin-preview-title"
        >
            <header className="admin-tool-heading">
                <div>
                    <p className="panel-kicker">
                        Conferência antes do envio
                    </p>
                    <h2 id="admin-preview-title">
                        Convite real aberto
                    </h2>
                    <p>
                        Esta é a mesma página que o convidado recebe, já
                        aberta. Role dentro da prévia para conferir todas
                        as seções.
                    </p>
                </div>

                <a
                    className="admin-open-public-preview"
                    href="/?adminPreview=1"
                    target="_blank"
                    rel="noreferrer"
                >
                    Ver em tela cheia ↗
                </a>
            </header>

            <div className="admin-real-preview-note">
                <span aria-hidden="true">
                    ✓
                </span>

                <p>
                    <strong>
                        Prévia real e segura
                    </strong>
                    O conteúdo, as fotos e o visual são os publicados.
                    Formulários e links ficam desativados somente nesta
                    visualização administrativa.
                </p>
            </div>

            <div className="admin-preview-toolbar">
                <div
                    role="group"
                    aria-label="Tamanho da prévia"
                >
                    <button
                        className={
                            device === 'desktop'
                                ? 'is-active'
                                : undefined
                        }
                        type="button"
                        onClick={() => setDevice('desktop')}
                        aria-pressed={device === 'desktop'}
                    >
                        Computador
                    </button>
                    <button
                        className={
                            device === 'mobile'
                                ? 'is-active'
                                : undefined
                        }
                        type="button"
                        onClick={() => setDevice('mobile')}
                        aria-pressed={device === 'mobile'}
                    >
                        Celular
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => (
                        setFrameVersion(
                            (value) => value + 1,
                        )
                    )}
                >
                    Atualizar prévia
                </button>
            </div>

            <div
                className={
                    device === 'mobile'
                        ? 'admin-live-preview admin-live-preview--mobile'
                        : 'admin-live-preview'
                }
            >
                <div className="admin-live-preview__browser">
                    <span />
                    <span />
                    <span />
                    <strong>
                        dudanoibiza.com.br — convite aberto
                    </strong>
                </div>

                <iframe
                    key={frameVersion}
                    title="Prévia completa do convite"
                    src="/?adminPreview=1"
                    loading="eager"
                    sandbox="allow-same-origin allow-scripts"
                    referrerPolicy="same-origin"
                />
            </div>
        </section>
    )
}

function CommunicationPanel({
    data,
    baseUrl,
    config,
    onOpenCommunication,
}) {
    const [feedback, setFeedback] =
        useState('')

    const sent =
        data.guests.filter(
            (guest) => (
                guest.communications
                    ?.convite_inicial
            ),
        ).length

    const template = [
        `Olá! Este é o convite para os ${config.settings.age} anos da ${config.settings.celebrantName}.`,
        '',
        'Abra seu convite individual pelo link enviado nesta mensagem.',
        '',
        `Informações gerais: ${baseUrl}`,
    ].join('\n')

    async function copyTemplate() {
        try {
            await navigator.clipboard.writeText(
                template,
            )
            setFeedback(
                'Mensagem padrão copiada.',
            )
        } catch {
            setFeedback(
                'Não foi possível copiar automaticamente.',
            )
        }
    }

    return (
        <section
            className="confirm-panel admin-tool-panel admin-communication-panel"
            aria-labelledby="admin-communication-title"
        >
            <header className="admin-tool-heading">
                <div>
                    <p className="panel-kicker">
                        WhatsApp
                    </p>
                    <h2 id="admin-communication-title">
                        Envio dos convites
                    </h2>
                    <p>
                        Cada convidado continua recebendo um link seguro e
                        individual.
                    </p>
                </div>
            </header>

            <div className="admin-communication-metrics">
                <div>
                    <span>Enviados</span>
                    <strong>{sent}</strong>
                </div>
                <div>
                    <span>A enviar</span>
                    <strong>
                        {Math.max(data.guests.length - sent, 0)}
                    </strong>
                </div>
                <div>
                    <span>Visualizaram</span>
                    <strong>{data.totals.viewed || 0}</strong>
                </div>
            </div>

            <div className="admin-share-artwork">
                <img
                    src="/og-convite-duda-v2.jpg"
                    alt="Arte de compartilhamento do convite"
                />
                <div>
                    <h3>Arte do WhatsApp preservada</h3>
                    <p>
                        Baixe a imagem para enviá-la junto com o link
                        individual.
                    </p>
                    <a
                        href="/og-convite-duda-v2.jpg"
                        download="convite-duda-whatsapp.jpg"
                    >
                        Baixar imagem
                    </a>
                </div>
            </div>

            <div className="admin-tool-actions">
                <button
                    type="button"
                    onClick={onOpenCommunication}
                >
                    Abrir central de envios
                </button>
                <button
                    type="button"
                    onClick={copyTemplate}
                >
                    Copiar mensagem padrão
                </button>
            </div>

            {feedback ? (
                <p className="admin-tool-feedback" role="status">
                    {feedback}
                </p>
            ) : null}
        </section>
    )
}

function ReportIcon({
    name,
}) {
    const paths = {
        confirmed: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12 2.5 2.5L16 9" />
            </>
        ),
        pending: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
            </>
        ),
        declined: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="m9 9 6 6m0-6-6 6" />
            </>
        ),
        buffet: (
            <>
                <path d="M6 3v8a3 3 0 0 0 6 0V3M9 3v18" />
                <path d="M17 3v18M17 3c3 3 3 7 0 10" />
            </>
        ),
        child: (
            <>
                <circle cx="12" cy="8" r="3" />
                <path d="M7 21v-3a5 5 0 0 1 10 0v3M9 12l-3 3m9-3 3 3" />
            </>
        ),
        youth: (
            <>
                <circle cx="12" cy="7" r="3" />
                <path d="M8 21v-5a4 4 0 0 1 8 0v5M5 14l3 2m11-2-3 2" />
            </>
        ),
        adult: (
            <>
                <circle cx="12" cy="7" r="3" />
                <path d="M5 21a7 7 0 0 1 14 0" />
            </>
        ),
        age: (
            <>
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M8 9h8M8 13h5M8 17h3" />
            </>
        ),
        unknown: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01" />
            </>
        ),
        presence: (
            <>
                <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                <circle cx="12" cy="7" r="4" />
                <path d="m16 12 2 2 4-4" />
            </>
        ),
    }

    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[name]}
        </svg>
    )
}


function ReportCard({
    label,
    value,
    icon,
    tone,
}) {
    return (
        <article
            className={
                `admin-report-card admin-report-card--${tone}`
            }
        >
            <div className="admin-report-card__top">
                <span>{label}</span>
                <i>
                    <ReportIcon name={icon} />
                </i>
            </div>
            <strong>{value}</strong>
        </article>
    )
}


function ReportsPanel({
    data,
    onGoGuests,
    onPrint,
}) {
    const report = useMemo(() => {
        const people =
            data.guests.flatMap((guest) => [
                {
                    age: guest.age,
                    status: guest.status,
                    attending:
                        guest.status === 'sim',
                },
                ...(guest.companions || [])
                    .map((companion) => ({
                        age: companion.age,
                        status:
                            companion.attending === 'nao'
                                ? 'nao'
                                : guest.status,
                        attending:
                            guest.status === 'sim'
                            && companion.attending !== 'nao',
                    })),
            ])

        const knownAge =
            people.filter(
                (person) => (
                    person.age !== ''
                    && person.age !== null
                    && person.age !== undefined
                ),
            )

        const confirmedPeople =
            people.filter(
                (person) => (
                    person.attending
                ),
            )

        const confirmedKnownAge =
            confirmedPeople.filter(
                (person) => (
                    person.age !== ''
                    && person.age !== null
                    && person.age !== undefined
                ),
            )

        return {
            childrenUpTo6:
                knownAge.filter(
                    (person) => Number(person.age) <= 6,
                ).length,
            above6:
                knownAge.filter(
                    (person) => Number(person.age) > 6,
                ).length,
            youth:
                knownAge.filter(
                    (person) => (
                        Number(person.age) >= 7
                        && Number(person.age) < 18
                    ),
                ).length,
            adults:
                knownAge.filter(
                    (person) => Number(person.age) >= 18,
                ).length,
            withoutAge:
                people.length - knownAge.length,
            confirmedChildren:
                confirmedKnownAge.filter(
                    (person) => Number(person.age) <= 6,
                ).length,
            confirmedAbove6:
                confirmedKnownAge.filter(
                    (person) => Number(person.age) > 6,
                ).length,
            confirmedAdults:
                confirmedKnownAge.filter(
                    (person) => Number(person.age) >= 18,
                ).length,
            confirmedWithoutAge:
                confirmedPeople.length
                - confirmedKnownAge.length,
            confirmed:
                data.totals.confirmed,
            declined:
                data.totals.declined,
            pending:
                data.totals.pending,
            buffet:
                data.totals.buffet,
            checkedIn:
                data.totals.checkedIn || 0,
        }
    }, [data])

    return (
        <section
            className="confirm-panel admin-tool-panel admin-reports-panel"
            aria-labelledby="admin-reports-title"
        >
            <header className="admin-tool-heading">
                <div>
                    <p className="panel-kicker">
                        Planejamento da festa
                    </p>
                    <h2 id="admin-reports-title">
                        Relatórios do evento
                    </h2>
                    <p>
                        Resumo consolidado para buffet, respostas e
                        presença real.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onPrint}
                >
                    Imprimir relatório
                </button>
            </header>

            <div className="admin-report-grid">
                <ReportCard label="Confirmados" value={report.confirmed} icon="confirmed" tone="confirmed" />
                <ReportCard label="Pendentes" value={report.pending} icon="pending" tone="pending" />
                <ReportCard label="Não vão" value={report.declined} icon="declined" tone="declined" />
                <ReportCard label="Buffet" value={report.buffet} icon="buffet" tone="buffet" />
                <ReportCard label="Até 6 anos — total" value={report.childrenUpTo6} icon="child" tone="child" />
                <ReportCard label="7 a 17 anos — total" value={report.youth} icon="youth" tone="youth" />
                <ReportCard label="Adultos — total" value={report.adults} icon="adult" tone="adult" />
                <ReportCard label="Acima de 6 — total" value={report.above6} icon="age" tone="age" />
                <ReportCard label="Sem idade — total" value={report.withoutAge} icon="unknown" tone="unknown" />
                <ReportCard label="Crianças confirmadas" value={report.confirmedChildren} icon="child" tone="confirmed-child" />
                <ReportCard label="Acima de 6 confirmados" value={report.confirmedAbove6} icon="confirmed" tone="confirmed-age" />
                <ReportCard label="Adultos confirmados" value={report.confirmedAdults} icon="adult" tone="confirmed-adult" />
                <ReportCard label="Confirmados sem idade" value={report.confirmedWithoutAge} icon="unknown" tone="confirmed-unknown" />
                <ReportCard label="Presentes no dia" value={report.checkedIn} icon="presence" tone="presence" />
            </div>

            <div className="admin-report-comparison">
                <h3>Confirmação x presença real</h3>
                <div>
                    <span
                        style={{
                            width:
                                report.confirmed
                                    ? '100%'
                                    : '0%',
                        }}
                    >
                        Confirmados: {report.confirmed}
                    </span>
                    <span
                        style={{
                            width:
                                report.confirmed
                                    ? `${Math.min(
                                        (
                                            report.checkedIn
                                            / report.confirmed
                                        ) * 100,
                                        100,
                                    )}%`
                                    : '0%',
                        }}
                    >
                        Presentes: {report.checkedIn}
                    </span>
                </div>
            </div>

            <button
                className="admin-report-guests-link"
                type="button"
                onClick={onGoGuests}
            >
                Abrir lista e exportar PDF/XLSX
            </button>

            <a
                className="admin-report-checkin-link"
                href="/presenca"
                target="_blank"
                rel="noreferrer"
            >
                Abrir check-in da festa ↗
            </a>
        </section>
    )
}

function SettingsPanel({
    config,
    onAdminAction,
}) {
    const [feedback, setFeedback] =
        useState('')

    const settings =
        config.settings

    async function handleSubmit(event) {
        event.preventDefault()

        const form =
            new FormData(event.currentTarget)

        const nextSettings =
            Object.fromEntries(
                [...form.entries()]
                    .map(([key, value]) => [
                        key,
                        String(value).trim(),
                    ]),
            )

        try {
            await onAdminAction({
                action:
                    'saveInvitationSettings',
                settings:
                    nextSettings,
            })

            setFeedback(
                'Configurações publicadas.',
            )
        } catch (error) {
            setFeedback(error.message)
        }
    }

    const fields = [
        ['celebrantName', 'Nome da aniversariante', 'text'],
        ['age', 'Idade em destaque', 'number'],
        ['title', 'Título do evento', 'text'],
        ['tagline', 'Frase principal', 'text'],
        ['openingTagline', 'Frase da abertura', 'text'],
        ['eventDate', 'Data da festa', 'date'],
        ['startTime', 'Horário inicial', 'time'],
        ['endTime', 'Horário final', 'time'],
        ['venue', 'Nome do local', 'text'],
        ['address', 'Endereço', 'text'],
        ['venueInstagramHandle', 'Instagram do local', 'text'],
        ['venueInstagramUrl', 'Link do Instagram do local', 'url'],
        ['dudaInstagramHandle', 'Instagram da Duda', 'text'],
        ['dudaInstagramUrl', 'Link do Instagram da Duda', 'url'],
        ['dressCode', 'Orientação de traje', 'text'],
        ['rsvpDeadline', 'Prazo de confirmação', 'date'],
        ['pixKey', 'Chave PIX', 'text'],
        ['pixName', 'Nome do recebedor do PIX', 'text'],
        ['youtubeVideoId', 'ID do vídeo do YouTube', 'text'],
    ]

    return (
        <section
            className="confirm-panel admin-tool-panel admin-settings-panel"
            aria-labelledby="admin-settings-title"
        >
            <header className="admin-tool-heading">
                <div>
                    <p className="panel-kicker">
                        Conteúdo sem alterar código
                    </p>
                    <h2 id="admin-settings-title">
                        Configurações do convite
                    </h2>
                    <p>
                        As alterações são aplicadas à página pública,
                        calendário e prazo de RSVP.
                    </p>
                </div>
            </header>

            <form
                className="admin-settings-form"
                key={JSON.stringify(settings)}
                onSubmit={handleSubmit}
            >
                {fields.map(
                    ([name, label, type]) => (
                        <label key={name}>
                            <span>{label}</span>
                            <input
                                name={name}
                                type={type}
                                defaultValue={settings[name]}
                                required
                            />
                        </label>
                    ),
                )}

                <label className="admin-settings-wide">
                    <span>Descrição do evento</span>
                    <textarea
                        name="description"
                        defaultValue={settings.description}
                        rows="3"
                        required
                    />
                </label>

                <label className="admin-settings-wide">
                    <span>Texto da área de presentes</span>
                    <textarea
                        name="giftIntro"
                        defaultValue={settings.giftIntro}
                        rows="3"
                        required
                    />
                </label>

                <label className="admin-settings-wide">
                    <span>PIX copia e cola</span>
                    <textarea
                        name="pixCopyPaste"
                        defaultValue={settings.pixCopyPaste}
                        rows="4"
                        required
                    />
                </label>

                <button type="submit">
                    Salvar e publicar configurações
                </button>
            </form>

            {feedback ? (
                <p className="admin-tool-feedback" role="status">
                    {feedback}
                </p>
            ) : null}
        </section>
    )
}

export default function AdminInvitationTools({
    data,
    activeSection,
    onSectionChange,
    onAdminAction,
    onOpenCommunication,
    baseUrl,
}) {
    const config =
        buildInvitationConfig(
            data.invitationConfig
            || DEFAULT_INVITATION_CONFIG,
        )

    useEffect(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        })
    }, [activeSection])

    return (
        <>
            <AdminNavigation
                activeSection={activeSection}
                onChange={onSectionChange}
            />

            {activeSection === 'resumo' ? (
                <AdminHealthOverview
                    data={data}
                    onAdminAction={onAdminAction}
                />
            ) : null}

            {activeSection === 'galeria' ? (
                <GalleryPanel
                    config={config}
                    onAdminAction={onAdminAction}
                />
            ) : null}

            {activeSection === 'preview' ? (
                <PreviewPanel />
            ) : null}

            {activeSection === 'comunicacao' ? (
                <CommunicationPanel
                    data={data}
                    baseUrl={baseUrl}
                    config={config}
                    onOpenCommunication={onOpenCommunication}
                />
            ) : null}

            {activeSection === 'relatorios' ? (
                <ReportsPanel
                    data={data}
                    onGoGuests={() => (
                        onSectionChange('convidados')
                    )}
                    onPrint={() => window.print()}
                />
            ) : null}

            {activeSection === 'configuracoes' ? (
                <SettingsPanel
                    config={config}
                    onAdminAction={onAdminAction}
                />
            ) : null}
        </>
    )
}
