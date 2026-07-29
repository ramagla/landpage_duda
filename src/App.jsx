import {
    Suspense,
    lazy,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    guestMatchesAgeFilter,
} from './admin-guest-filters.js'
import {
    getCalendarPlatform,
} from './calendar-platform.js'

import {
    RSVP_CLOSED_MESSAGE,
    RSVP_DEADLINE_DISPLAY,
    dateKeyInSaoPaulo,
} from '../shared/rsvp-deadline.js'
import {
    DEFAULT_INVITATION_CONFIG,
    buildInvitationConfig,
} from '../shared/invitation-config.js'
import {
    EVENT,
} from '../shared/event-config.js'

const ExpensesPage = lazy(
    () => import('./ExpensesPage.jsx'),
)

const AdminCommunicationModal = lazy(
    () => import('./AdminCommunicationModal.jsx'),
)

const AdminInvitationTools = lazy(
    () => import('./AdminInvitationTools.jsx'),
)

const YOUTUBE_VIDEO_ID = '_zR6ROjoOX0'

/*
 * Novas fotos podem ser adicionadas em public e cadastradas aqui.
 * O carrossel exibe controles somente quando houver mais de uma foto.
 */
const DUDA_PHOTOS = [
    {
        id: 'paris',
        src: '/media/duda-photo.webp',
        alt: 'Duda em frente à Torre Eiffel',
        objectPosition: 'center 28%',
    },
]

function getYoutubePlayerUrl(
    autoplay = false,
    videoId = YOUTUBE_VIDEO_ID,
) {
    const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        loop: '1',
        playlist: videoId,
        controls: '0',
        playsinline: '1',
        enablejsapi: '1',
        rel: '0',
    })

    if (
        typeof window !== 'undefined'
        && window.location?.origin
    ) {
        params.set(
            'origin',
            window.location.origin,
        )
    }

    return (
        `https://www.youtube.com/embed/${videoId}`
        + `?${params.toString()}`
    )
}
async function copyTextToClipboard(value) {
    const textValue = String(value || '').trim()

    if (!textValue) {
        throw new Error('Não há conteúdo para copiar.')
    }

    /*
     * Safari/iPhone costuma ser mais confiavel quando a copia
     * acontece imediatamente dentro do toque.
     */
    const textarea = document.createElement('textarea')

    textarea.value = textValue
    textarea.setAttribute('readonly', '')

    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    textarea.style.width = '1px'
    textarea.style.height = '1px'
    textarea.style.fontSize = '16px'
    textarea.style.opacity = '0.01'

    document.body.appendChild(textarea)

    textarea.focus()
    textarea.select()

    textarea.setSelectionRange(
        0,
        textarea.value.length,
    )

    let copied

    try {
        copied = document.execCommand('copy')
    } catch {
        copied = false
    }

    textarea.remove()

    if (copied) return

    if (
        navigator.clipboard
        && window.isSecureContext
    ) {
        try {
            await navigator.clipboard.writeText(textValue)
            return
        } catch {
            // Continua para o erro amigavel.
        }
    }

    throw new Error(
        'Não foi possível copiar automaticamente. Toque e segure sobre o código para copiar.'
    )
}


function scrollToSection(id) {
    if (typeof window === 'undefined') return

    const element = document.getElementById(id)
    if (!element) return

    const top =
        element.getBoundingClientRect().top
        + window.scrollY
        - 14

    window.scrollTo({
        top,
        behavior: 'smooth',
    })
}

function formatCountdown(targetDate) {
    const now = new Date()
    const diff = Math.max(targetDate.getTime() - now.getTime(), 0)

    return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
    }
}

function formatWhatsapp(value) {
    let digits = String(value || '').replace(/\D/g, '')

    if (digits.startsWith('55') && digits.length > 11) {
        digits = digits.slice(2)
    }

    digits = digits.slice(0, 11)

    if (digits.length === 0) return ''
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '')
}

function getRsvpNow() {
    const testNow = import.meta.env.DEV
        ? String(import.meta.env.VITE_RSVP_TEST_NOW || '').trim()
        : ''

    if (testNow) {
        const parsed = new Date(testNow)

        if (!Number.isNaN(parsed.getTime())) {
            return parsed
        }
    }

    return new Date()
}

function getDayAfter(dateValue) {
    const parsed =
        new Date(`${dateValue}T12:00:00Z`)

    if (Number.isNaN(parsed.getTime())) {
        return '2026-10-15'
    }

    parsed.setUTCDate(
        parsed.getUTCDate() + 1,
    )

    return parsed
        .toISOString()
        .slice(0, 10)
}

function isRsvpClosed(
    deadline = '2026-10-14',
) {
    return (
        dateKeyInSaoPaulo(
            getRsvpNow(),
        )
        >= getDayAfter(deadline)
    )
}

function getRsvpClosedMessage(
    deadlineDisplay = RSVP_DEADLINE_DISPLAY,
) {
    if (
        deadlineDisplay
        === RSVP_DEADLINE_DISPLAY
    ) {
        return RSVP_CLOSED_MESSAGE
    }

    return (
        `O prazo para confirmação terminou em ${deadlineDisplay}. `
        + 'Para qualquer alteração, fale com o Rafael.'
    )
}

async function readApiJson(response) {
    const text = await response.text()

    if (!text) {
        throw new Error('Servidor de confirmacao indisponivel. Para testar localmente, rode com vercel dev ou publique na Vercel.')
    }

    try {
        return JSON.parse(text)
    } catch {
        throw new Error('Servidor de confirmacao indisponivel. Para testar localmente, rode com vercel dev ou publique na Vercel.')
    }
}

async function fetchGuestInvitation({
    whatsapp,
    invitationCode,
}) {
    const response = await fetch(
        '/api/guest',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
            body: JSON.stringify({
                whatsapp,
                invitationCode,
            }),
        }
    )

    const data = await readApiJson(
        response
    )

    if (!response.ok) {
        throw new Error(
            data?.error
            || 'Não foi possível consultar seu convite.'
        )
    }

    return data
}

function getInvitationCode() {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('convite') || ''
}


const OPENING_SESSION_KEY = 'dudaInvitationUnlocked'

function clearOpeningSession() {
    if (typeof window === 'undefined') return

    window.sessionStorage.removeItem(
        OPENING_SESSION_KEY
    )
}

function readOpeningSession() {
    if (typeof window === 'undefined') return null

    try {
        const stored = JSON.parse(
            window.sessionStorage.getItem(
                OPENING_SESSION_KEY
            ) || 'null'
        )

        if (
            !stored?.guest?.name
            || digitsOnly(stored.whatsapp).length < 10
        ) {
            clearOpeningSession()
            return null
        }

        const currentInvitationCode = getInvitationCode()
        const storedInvitationCode = String(
            stored.invitationCode || ''
        )

        /*
         * Uma sessao aberta por um convite individual nunca pode
         * ser reutilizada quando o navegador recebe outro token.
         *
         * Isso evita, por exemplo:
         * convite da Andreia -> abre convite do Rafael
         * e a sessao antiga continuar aparecendo.
         */
        if (
            storedInvitationCode
            !== currentInvitationCode
        ) {
            clearOpeningSession()
            return null
        }

        return stored
    } catch {
        clearOpeningSession()
        return null
    }
}

function saveOpeningSession(data) {
    if (typeof window === 'undefined') return

    window.sessionStorage.setItem(
        OPENING_SESSION_KEY,
        JSON.stringify({
            invitationCode: getInvitationCode(),
            guest: data.guest,
            whatsapp: data.whatsapp,
            alreadyConfirmed: Boolean(
                data.alreadyConfirmed
            ),
            rsvp: data.rsvp || null,
        })
    )
}

function InviteIcon({ name }) {
    const paths = {
        calendar: (
            <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 10h18" />
            </>
        ),
        check: <path d="m5 12 4 4L19 6" />,
        gift: (
            <>
                <rect x="3" y="9" width="18" height="12" rx="2" />
                <path d="M12 9v12M3 13h18M7.5 9C5 9 4 7.6 4 6.3 4 5 5 4 6.3 4 9 4 12 9 12 9s3-5 5.7-5C16 4 17 5 17 6.3 17 7.6 16 9 13.5 9" />
            </>
        ),
        heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
        map: (
            <>
                <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
                <path d="M9 3v15M15 6v15" />
            </>
        ),
        message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
        navigation: <path d="m3 11 19-9-9 19-2-8Z" />,
        pin: (
            <>
                <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.5" />
            </>
        ),
    }

    return (
        <svg
            className="invite-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            {paths[name] || paths.heart}
        </svg>
    )
}

function InvitationPhotoCarousel({ photos = DUDA_PHOTOS }) {
    const availablePhotos = useMemo(
        () => photos.filter((photo) => photo?.src),
        [photos],
    )
    const [activeIndex, setActiveIndex] = useState(0)
    const pointerStartRef = useRef(null)
    const photoCount = availablePhotos.length
    const hasMultiplePhotos = photoCount > 1

    if (!photoCount) return null

    function selectPhoto(index) {
        const nextIndex = (
            (index % photoCount) + photoCount
        ) % photoCount

        setActiveIndex(nextIndex)
    }

    function handlePointerDown(event) {
        if (!hasMultiplePhotos) return

        pointerStartRef.current = {
            x: event.clientX,
            y: event.clientY,
        }
    }

    function handlePointerUp(event) {
        if (!hasMultiplePhotos || !pointerStartRef.current) {
            return
        }

        const deltaX =
            event.clientX - pointerStartRef.current.x
        const deltaY =
            event.clientY - pointerStartRef.current.y

        pointerStartRef.current = null

        if (
            Math.abs(deltaX) < 44
            || Math.abs(deltaX) <= Math.abs(deltaY)
        ) {
            return
        }

        selectPhoto(
            deltaX < 0
                ? activeIndex + 1
                : activeIndex - 1,
        )
    }

    return (
        <div
            className={`invitation-hero__photo invitation-photo-carousel${hasMultiplePhotos
                ? ' invitation-photo-carousel--multiple'
                : ''}`}
            role={hasMultiplePhotos ? 'region' : undefined}
            aria-roledescription={hasMultiplePhotos
                ? 'carrossel'
                : undefined}
            aria-label={hasMultiplePhotos
                ? 'Fotos da Duda'
                : undefined}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
                pointerStartRef.current = null
            }}
        >
            {availablePhotos.map((photo, index) => (
                <figure
                    className={`invitation-photo-carousel__slide${index === activeIndex
                        ? ' invitation-photo-carousel__slide--active'
                        : ''}`}
                    key={photo.id || photo.src}
                    aria-hidden={index !== activeIndex}
                    role={hasMultiplePhotos ? 'group' : undefined}
                    aria-roledescription={hasMultiplePhotos
                        ? 'slide'
                        : undefined}
                    aria-label={hasMultiplePhotos
                        ? `${index + 1} de ${photoCount}`
                        : undefined}
                >
                    <img
                        src={photo.src}
                        alt={index === activeIndex ? photo.alt : ''}
                        style={{
                            objectPosition:
                                photo.objectPosition || 'center',
                        }}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        decoding="async"
                        draggable={false}
                    />
                </figure>
            ))}

            {hasMultiplePhotos ? (
                <div
                    className="invitation-photo-carousel__controls"
                    aria-label="Navegação das fotos"
                >
                    <button
                        type="button"
                        onClick={() => selectPhoto(activeIndex - 1)}
                        aria-label="Ver foto anterior"
                    >
                        <span aria-hidden="true">‹</span>
                    </button>

                    {photoCount <= 3 ? (
                        <div className="invitation-photo-carousel__dots">
                            {availablePhotos.map((photo, index) => (
                                <button
                                    type="button"
                                    className={index === activeIndex
                                        ? 'is-active'
                                        : undefined}
                                    key={`dot-${photo.id || photo.src}`}
                                    onClick={() => selectPhoto(index)}
                                    aria-label={`Ver foto ${index + 1} de ${photoCount}`}
                                    aria-current={index === activeIndex
                                        ? 'true'
                                        : undefined}
                                />
                            ))}
                        </div>
                    ) : (
                        <span
                            className="invitation-photo-carousel__count"
                            aria-hidden="true"
                        >
                            {activeIndex + 1} / {photoCount}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => selectPhoto(activeIndex + 1)}
                        aria-label="Ver próxima foto"
                    >
                        <span aria-hidden="true">›</span>
                    </button>

                    <span
                        className="invitation-photo-carousel__status"
                        aria-live="polite"
                    >
                        Foto {activeIndex + 1} de {photoCount}
                    </span>
                </div>
            ) : null}
        </div>
    )
}

function InvitationQuickActions() {
    return (
        <section
            className="hero-quick-actions"
            aria-label="Acessos rápidos do convite"
        >
            <button
                className="hero-quick-actions__primary"
                type="button"
                onClick={() => scrollToSection('confirmar-presenca')}
            >
                <InviteIcon name="check" />
                <span>Confirmar presença</span>
            </button>

            <div className="hero-quick-actions__grid">
                <button
                    className="hero-quick-actions__secondary"
                    type="button"
                    onClick={() => scrollToSection('local-evento')}
                >
                    <InviteIcon name="pin" />
                    <span>Local</span>
                </button>

                <button
                    className="hero-quick-actions__secondary"
                    type="button"
                    onClick={() => scrollToSection('presentes')}
                >
                    <InviteIcon name="gift" />
                    <span>Presente</span>
                </button>

                <button
                    className="hero-quick-actions__secondary"
                    type="button"
                    onClick={() => scrollToSection('mensagem-duda')}
                >
                    <InviteIcon name="message" />
                    <span>Mensagem</span>
                </button>
            </div>

            <button
                className="hero-scroll-hint"
                type="button"
                onClick={() => scrollToSection('confirmar-presenca')}
            >
                <span>Ver todos os detalhes</span>
                <strong aria-hidden="true">↓</strong>
            </button>
        </section>
    )
}

function Countdown({
    startsAt = EVENT.startsAt,
}) {
    const targetDate = useMemo(
        () => new Date(startsAt),
        [startsAt],
    )
    const [time, setTime] = useState(() => formatCountdown(targetDate))

    useEffect(() => {
        const timer = window.setInterval(() => setTime(formatCountdown(targetDate)), 1000)
        return () => window.clearInterval(timer)
    }, [targetDate])

    return (
        <section className="countdown" aria-label="Contagem regressiva para o aniversário">
            {[
                ['dias', time.days],
                ['horas', time.hours],
                ['min', time.minutes],
                ['seg', time.seconds],
            ].map(([label, value]) => (
                <div className="countdown__item" key={label}>
                    <strong>{String(value).padStart(2, '0')}</strong>
                    <span>{label}</span>
                </div>
            ))}
        </section>
    )
}


function MusicPlayer({
    enabled,
    videoId = YOUTUBE_VIDEO_ID,
}) {
    const iframeRef = useRef(null)
    const [playing, setPlaying] = useState(Boolean(enabled))

    function sendCommand(command) {
        iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({
                event: 'command',
                func: command,
                args: [],
            }),
            '*',
        )
    }

    useEffect(() => {
        window.__dudaMusicPlay = () => {
            /*
             * O player já está carregado antes do toque.
             * No gesto do usuário enviamos playVideo diretamente,
             * sem recarregar o iframe.
             */
            sendCommand('playVideo')
            setPlaying(true)
        }

        window.__dudaMusicPause = () => {
            sendCommand('pauseVideo')
            setPlaying(false)
        }

        return () => {
            delete window.__dudaMusicPlay
            delete window.__dudaMusicPause
        }
    }, [])

    function toggleMusic() {
        if (playing) {
            sendCommand('pauseVideo')
            setPlaying(false)
            return
        }

        sendCommand('playVideo')
        setPlaying(true)
    }

    function handlePlayerLoad() {
        /*
         * Apenas confirma que o iframe terminou de carregar.
         * A reprodução com som continua dependente do gesto
         * explícito do usuário.
         */
        if (enabled) {
            setPlaying(false)
        }
    }

    return (
        <div className="music-player">
            <iframe
                ref={iframeRef}
                className="music-player__frame"
                title="Música do convite da Duda"
                src={getYoutubePlayerUrl(
                    false,
                    videoId,
                )}
                allow="autoplay; encrypted-media; picture-in-picture"
                onLoad={handlePlayerLoad}
            />

            <button
                className={`music-player__control${playing ? ' music-player__control--playing' : ''}`}
                type="button"
                onClick={toggleMusic}
                aria-pressed={playing}
                aria-label={playing ? 'Pausar música' : 'Tocar música'}
                title={playing ? 'Pausar música' : 'Tocar música'}
            >
                <span aria-hidden="true">
                    {playing ? '❚❚' : '♪'}
                </span>

                <small>
                    {playing ? 'Pausar' : 'Música'}
                </small>
            </button>
        </div>
    )
}

function createCompanion(slot) {
    return {
        id: String(slot.slot),
        slot: slot.slot,
        name: slot.name || '',
        age: slot.age === '' ? '' : String(slot.age),
        attending: slot.attending === 'nao' ? 'nao' : 'sim',
    }
}

function RsvpForm({
    initialGuest = null,
    initialWhatsapp = '',
    initialAlreadyConfirmed = false,
    initialRsvp = null,
    onGuestResolved,
    onGuestCleared,
    onRsvpSaved,
    rsvpDeadline = '2026-10-14',
    rsvpDeadlineDisplay =
        RSVP_DEADLINE_DISPLAY,
    event = EVENT,
}) {
    const invitationCode = useMemo(() => getInvitationCode(), [])
    const [lookupStatus, setLookupStatus] = useState(initialGuest ? 'success' : 'idle')
    const [submitStatus, setSubmitStatus] = useState('idle')
    const [message, setMessage] = useState('')
    const [attending, setAttending] = useState(
        () => initialRsvp?.attending === 'nao' ? 'nao' : 'sim'
    )
    const [whatsappValue, setWhatsappValue] = useState(() => formatWhatsapp(initialWhatsapp))
    const [guest, setGuest] = useState(initialGuest)
    const [companions, setCompanions] = useState(() => (initialGuest?.companions || []).map(createCompanion))
    const [alreadyConfirmed, setAlreadyConfirmed] = useState(Boolean(initialAlreadyConfirmed))
    const [confirmationVisible, setConfirmationVisible] = useState(Boolean(initialAlreadyConfirmed))
    const confirmationRef = useRef(null)
    const rsvpClosed =
        isRsvpClosed(rsvpDeadline)

    const rsvpClosedMessage =
        getRsvpClosedMessage(
            rsvpDeadlineDisplay,
        )
    const formLocked = rsvpClosed

    useEffect(() => {
        if (
            submitStatus === 'success'
            && confirmationVisible
        ) {
            confirmationRef.current
                ?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                })
        }
    }, [
        confirmationVisible,
        submitStatus,
    ])

    function resetGuest() {
        setGuest(null)
        setCompanions([])
        setAlreadyConfirmed(false)
        setConfirmationVisible(false)
        setAttending('sim')
        setSubmitStatus('idle')
        onGuestCleared?.()
    }

    function handlePhoneChange(value) {
        setWhatsappValue(formatWhatsapp(value))
        resetGuest()
    }

    function updateCompanion(id, field, value) {
        setConfirmationVisible(false)

        setCompanions((current) => current.map((companion) => (
            companion.id === id ? { ...companion, [field]: value } : companion
        )))
    }

    async function lookupGuest(event) {
        event.preventDefault()
        setLookupStatus('loading')
        setMessage('')
        resetGuest()

        try {
            if (digitsOnly(whatsappValue).length < 10) {
                throw new Error('Digite um WhatsApp válido com DDD.')
            }

            const data = await fetchGuestInvitation({
                whatsapp: whatsappValue,
                invitationCode,
            })

            setGuest(data.guest)
            onGuestResolved?.(data.guest)
            setCompanions((data.guest.companions || []).map(createCompanion))
            setAlreadyConfirmed(Boolean(data.alreadyConfirmed))
            setConfirmationVisible(Boolean(data.alreadyConfirmed))
            setAttending(
                data.rsvp?.attending === 'nao'
                    ? 'nao'
                    : 'sim'
            )
            setLookupStatus('success')
            setMessage(
                data.alreadyConfirmed
                    ? `Sua resposta foi encontrada. Você pode alterá-la até ${rsvpDeadlineDisplay}.`
                    : `Convite encontrado para ${data.guest.name}.`
            )
        } catch (error) {
            setLookupStatus('error')
            setMessage(error.message)
        }
    }

    function handleAttendingChange(value) {
        setAttending(value)
        setConfirmationVisible(false)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSubmitStatus('loading')
        setMessage('')

        const form = new FormData(event.currentTarget)
        const payload = {
            invitationCode,
            whatsapp: whatsappValue.trim(),
            attending: String(form.get('attending') || 'sim'),
            declineReason: String(form.get('declineReason') || '').trim(),
            companions: attending === 'sim'
                ? companions.map((companion) => ({
                    slot: companion.slot,
                    name: companion.name.trim(),
                    age: companion.age,
                    attending: companion.attending === 'nao' ? 'nao' : 'sim',
                }))
                : [],
        }

        try {
            if (rsvpClosed) {
                throw new Error(
                    rsvpClosedMessage,
                )
            }
            if (!guest) throw new Error('Consulte seu celular antes de confirmar.')

            const response = await fetch('/api/rsvp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await readApiJson(response)

            if (!response.ok) throw new Error(data?.error || 'Não foi possível confirmar agora.')

            setSubmitStatus('success')

            if (data.guest) {
                onGuestResolved?.(data.guest)
            }

            if (data.rsvp) {
                onRsvpSaved?.(data.rsvp)
            }

            setAlreadyConfirmed(true)
            setConfirmationVisible(true)
            setMessage(
                data.message
                || 'Resposta salva com carinho.'
            )
        } catch (error) {
            setSubmitStatus('error')
            setMessage(error.message)
        }
    }

    return (
        <div className="rsvp-flow">
            {!guest ? <form className="lookup-form" onSubmit={lookupGuest}>
                <label>
                    <span>Digite seu celular</span>
                    <input
                        name="lookupWhatsapp"
                        type="tel"
                        inputMode="numeric"
                        placeholder="(11) 99999-9999"
                        value={whatsappValue}
                        onChange={(event) => handlePhoneChange(event.target.value)}
                        autoComplete="tel"
                        maxLength="15"
                        required
                    />
                </label>
                <button className="secondary-button" disabled={lookupStatus === 'loading'} type="submit">
                    {lookupStatus === 'loading' ? 'Consultando...' : 'Abrir meu convite'}
                </button>
            </form> : null}

            {guest ? (
                <form className="rsvp" onSubmit={handleSubmit}>
                    <div className="guest-found-card">
                        <span>Convite liberado</span>
                        <strong>{guest.name}</strong>
                        <small>{guest.maxCompanions === 0 ? 'Sem acompanhantes.' : `Até ${guest.maxCompanions} acompanhante${guest.maxCompanions === 1 ? '' : 's'} neste convite.`}</small>
                    </div>

                    {rsvpClosed ? (
                        <div className="deadline-closed" role="status">
                            <strong>Prazo de confirmação encerrado</strong>
                            <span>{rsvpClosedMessage}</span>
                        </div>
                    ) : null}

                    <fieldset className="choice-group" disabled={formLocked}>
                        <legend>Você vai?</legend>
                        <label className="choice">
                            <input
                                checked={attending === 'sim'}
                                name="attending"
                                type="radio"
                                value="sim"
                                onChange={() => handleAttendingChange('sim')}
                            />
                            <span>Sim, vou comemorar</span>
                        </label>
                        <label className="choice">
                            <input
                                checked={attending === 'nao'}
                                name="attending"
                                type="radio"
                                value="nao"
                                onChange={() => handleAttendingChange('nao')}
                            />
                            <span>Não vou</span>
                        </label>
                    </fieldset>

                    {attending === 'nao' ? (
                        <label>
                            <span>Conta pra Duda o motivo</span>
                            <textarea
                                name="declineReason"
                                placeholder="Uma justificativa curtinha e carinhosa"
                                defaultValue={initialRsvp?.decline_reason || ''}
                                disabled={formLocked}
                                required
                            />
                        </label>
                    ) : null}

                    {attending === 'sim' && guest.maxCompanions > 0 ? (
                        <section className="companions-box" aria-label="Acompanhantes">
                            <div className="companions-box__header">
                                <div>
                                    <span>Acompanhantes liberados</span>
                                    <p>Marque se cada acompanhante vai ou não. Até 6 anos não conta no buffet.</p>
                                </div>
                            </div>

                            <div className="companions-list">
                                {companions.map((companion, index) => (
                                    <div className="companion-row companion-row--fixed" key={companion.id}>
                                        <fieldset className="companion-attendance" disabled={formLocked}>
                                            <legend>Acompanhante {index + 1}</legend>
                                            <label>
                                                <input
                                                    checked={companion.attending !== 'nao'}
                                                    name={`companionAttendance${companion.slot}`}
                                                    type="radio"
                                                    value="sim"
                                                    onChange={() => updateCompanion(companion.id, 'attending', 'sim')}
                                                />
                                                <span>Vai</span>
                                            </label>
                                            <label>
                                                <input
                                                    checked={companion.attending === 'nao'}
                                                    name={`companionAttendance${companion.slot}`}
                                                    type="radio"
                                                    value="nao"
                                                    onChange={() => updateCompanion(companion.id, 'attending', 'nao')}
                                                />
                                                <span>Não vai</span>
                                            </label>
                                        </fieldset>
                                        <label>
                                            <span>Nome</span>
                                            <input
                                                type="text"
                                                placeholder="Nome do acompanhante"
                                                value={companion.name}
                                                onChange={(event) => updateCompanion(companion.id, 'name', event.target.value)}
                                                disabled={formLocked || companion.attending === 'nao'}
                                                required={companion.attending !== 'nao'}
                                            />
                                        </label>
                                        <label>
                                            <span>Idade</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="120"
                                                inputMode="numeric"
                                                placeholder="Idade"
                                                value={companion.age}
                                                onChange={(event) => updateCompanion(companion.id, 'age', event.target.value)}
                                                disabled={formLocked || companion.attending === 'nao'}
                                                required={companion.attending !== 'nao'}
                                            />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <p className="guest-check-note">Este convite é individual. Use o celular informado para abrir e confirmar somente os nomes deste convite.</p>

                    <button disabled={submitStatus === 'loading' || formLocked} type="submit">
                        {submitStatus === 'loading'
                            ? 'Salvando...'
                            : rsvpClosed
                                ? 'Prazo encerrado'
                                : alreadyConfirmed
                                    ? 'Salvar alteração'
                                    : 'Confirmar presença'}
                    </button>
                </form>
            ) : null}

            {guest && confirmationVisible ? (
                <section
                    className={
                        attending === 'sim'
                            ? 'rsvp-confirmation-summary'
                            : 'rsvp-confirmation-summary rsvp-confirmation-summary--declined'
                    }
                    ref={confirmationRef}
                    role="status"
                    aria-live="polite"
                    aria-labelledby="rsvp-confirmation-title"
                >
                    <span className="rsvp-confirmation-summary__icon" aria-hidden="true">
                        {attending === 'sim' ? '✓' : '–'}
                    </span>

                    <div>
                        <p className="panel-kicker">
                            Resposta registrada
                        </p>

                        <h3 id="rsvp-confirmation-title">
                            {attending === 'sim'
                                ? 'Presença confirmada!'
                                : 'Sentiremos sua falta'}
                        </h3>

                        {attending === 'sim' ? (
                            <>
                                <p>
                                    Confira quem está confirmado neste convite:
                                </p>

                                <ul>
                                    <li>
                                        <strong>{guest.name}</strong>
                                        <span>Convidado principal</span>
                                    </li>

                                    {companions
                                        .filter(
                                            (companion) => (
                                                companion.attending
                                                !== 'nao'
                                                && companion.name.trim()
                                            ),
                                        )
                                        .map((companion) => (
                                            <li key={companion.id}>
                                                <strong>{companion.name}</strong>
                                                <span>
                                                    Acompanhante
                                                    {companion.age !== ''
                                                        ? ` · ${companion.age} anos`
                                                        : ''}
                                                </span>
                                            </li>
                                        ))}
                                </ul>

                                <small>
                                    {event.dateDisplay}
                                    {' · '}
                                    {event.timeDisplay}
                                    {' · '}
                                    {event.venue}
                                </small>
                            </>
                        ) : (
                            <p>
                                A resposta de que você não irá foi salva. Se mudar de ideia antes do prazo, ainda é possível alterar.
                            </p>
                        )}
                    </div>
                </section>
            ) : null}

            {message ? (
                <p
                    className={`form-message form-message--${lookupStatus === 'error' || submitStatus === 'error' ? 'error' : 'success'}`}
                    role="status"
                    aria-live="polite"
                >
                    {message}
                </p>
            ) : null}

            <details className="privacy-notice">
                <summary>Como usamos seus dados</summary>
                <p>
                    Nome, telefone, idade e confirmação são usados somente para organizar a festa e a lista do buffet. Para corrigir ou remover seus dados, fale com o Rafael.
                </p>
            </details>
        </div>
    )
}


function GiftPanel({
    settings =
        DEFAULT_INVITATION_CONFIG.settings,
}) {
    const [copyStatus, setCopyStatus] = useState('')

    async function handleCopyPixKey() {
        try {
            await copyTextToClipboard(
                settings.pixKey,
            )
            setCopyStatus('✓ Chave Pix copiada.')
        } catch (error) {
            setCopyStatus(error.message)
        }
    }

    async function handleCopyPixCode() {
        try {
            await copyTextToClipboard(
                settings.pixCopyPaste
            )

            setCopyStatus(
                '✓ Pix copia e cola copiado.'
            )
        } catch (error) {
            setCopyStatus(error.message)
        }
    }

    return (
        <section
            id="presentes"
            className="confirm-panel gift-panel"
            aria-labelledby="gift-title"
        >
            <p className="panel-kicker">
                Sugestão de presente
            </p>

            <h2 id="gift-title">
                Um carinho para a Duda
            </h2>

            <p>
                {settings.giftIntro}
            </p>

            <div className="gift-suggestions" aria-label="Ideias de presente">
                <span>Perfume</span>
                <span>Acessórios</span>
                <span>Cremes</span>
                <span>Maquiagem</span>
            </div>

            <p className="pix-intro">
                Se preferir, você também pode enviar um Pix para
                ela escolher algo especial.
            </p>

            <div className="pix-card">
                <img
                    src="/pix-duda.svg"
                    alt="QR Code Pix para presente da Duda"
                />

                <div>
                    <span>Chave Pix</span>

                    <strong>{settings.pixKey}</strong>

                    <small>
                        Antes de fazer o Pix, confirme se o nome
                        aparece como <b>{settings.pixName}</b>.
                    </small>

                    <div className="pix-actions">
                        <button
                            type="button"
                            className="utility-button"
                            onClick={handleCopyPixKey}
                        >
                            Copiar chave Pix
                        </button>

                        <button
                            type="button"
                            className="utility-button"
                            onClick={handleCopyPixCode}
                        >
                            Copiar Pix copia e cola
                        </button>
                    </div>

                    {copyStatus ? (
                        <p
                            className="copy-feedback"
                            role="status"
                            aria-live="polite"
                        >
                            {copyStatus}
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    )
}

function BirthdayMessageForm({
    guest,
    invitationCode,
}) {
    const [status, setStatus] = useState('idle')
    const [feedback, setFeedback] = useState('')

    const guestName = String(
        guest?.name || '',
    ).trim()

    /*
     * O convite pode ter sido aberto de duas formas:
     *
     * 1. pelo link individual com token;
     * 2. pelo endereco principal, validando o WhatsApp.
     *
     * A sessao de abertura guarda o WhatsApp ja validado.
     */
    const sessionWhatsapp = (() => {
        if (typeof window === 'undefined') {
            return ''
        }

        try {
            const stored = JSON.parse(
                window.sessionStorage.getItem(
                    OPENING_SESSION_KEY
                ) || 'null'
            )

            return digitsOnly(
                stored?.whatsapp || ''
            )
        } catch {
            return ''
        }
    })()

    const canSend = Boolean(
        guestName
        && (
            invitationCode
            || sessionWhatsapp.length >= 10
        )
    )

    async function handleSubmit(event) {
        event.preventDefault()

        const formElement = event.currentTarget

        setStatus('loading')
        setFeedback('')

        const form = new FormData(
            formElement,
        )

        const message = String(
            form.get('message') || '',
        ).trim()

        try {
            if (!canSend) {
                throw new Error(
                    'Não foi possível identificar o convidado.'
                )
            }

            const response = await fetch(
                '/api/messages',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },

                    body: JSON.stringify({
                        invitationCode,
                        whatsapp: sessionWhatsapp,
                        message,
                    }),
                },
            )

            const data = await readApiJson(
                response,
            )

            if (!response.ok) {
                throw new Error(
                    data?.error
                    || 'Não foi possível salvar a mensagem agora.'
                )
            }

            setStatus('success')

            setFeedback(
                data.message
                || 'Mensagem guardada para a Duda.',
            )

            formElement.reset()
        } catch (error) {
            setStatus('error')
            setFeedback(error.message)
        }
    }

    return (
        <form
            className="message-form"
            onSubmit={handleSubmit}
        >
            <div className="message-sender">
                <span>Enviando como</span>

                <strong>
                    {guestName || 'Convidado'}
                </strong>
            </div>

            <label>
                <span>Mensagem de parabéns</span>

                <textarea
                    name="message"
                    placeholder="Escreva uma mensagem para a Duda"
                    maxLength="500"
                    minLength="5"
                    required
                />
            </label>

            <button
                type="submit"
                disabled={
                    status === 'loading'
                    || !canSend
                }
            >
                {status === 'loading'
                    ? 'Salvando...'
                    : 'Enviar mensagem'}
            </button>

            {feedback ? (
                <p
                    className={`form-message form-message--${status}`}
                    role="status"
                    aria-live="polite"
                >
                    {feedback}
                </p>
            ) : null}
        </form>
    )
}


function formatAdminAccessDate(value) {
    if (!value) return ''

    const normalized = value.includes('T')
        ? value
        : `${value.replace(' ', 'T')}Z`

    const date = new Date(normalized)

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}


function AdminPage() {
    const [password, setPassword] = useState('')
    const [status, setStatus] = useState('idle')
    const [message, setMessage] = useState('')
    const [data, setData] = useState(null)
    const [editing, setEditing] = useState(null)
    const [adminCompanionCount, setAdminCompanionCount] = useState(0)
    const [messageSearch, setMessageSearch] = useState('')
    const [guestSearch, setGuestSearch] = useState('')
    const [guestStatusFilter, setGuestStatusFilter] = useState('todos')
    const [guestAgeFilter, setGuestAgeFilter] = useState('todos')
    const [lastUpdatedAt, setLastUpdatedAt] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [communicationModalOpen, setCommunicationModalOpen] = useState(false)
    const [activeAdminSection, setActiveAdminSection] = useState('resumo')
    const adminRefreshRef = useRef(null)
    const lastAutoRefreshAtRef = useRef(0)

    useEffect(() => {
        let cancelled = false

        async function restoreAdminSession() {
            try {
                const response = await fetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({}),
                })

                if (cancelled) return

                if (response.status === 401) {
                    setData(null)
                    setStatus('idle')
                    return
                }

                const body = await readApiJson(response)

                if (!response.ok) {
                    throw new Error(
                        body?.error
                        || 'Nao foi possivel restaurar a sessao.'
                    )
                }

                setData(body)
                setStatus('success')
                setLastUpdatedAt(
                    new Date().toISOString()
                )
                lastAutoRefreshAtRef.current = Date.now()
            } catch (error) {
                if (cancelled) return

                setData(null)
                setStatus('error')
                setMessage(error.message)
            }
        }

        restoreAdminSession()

        return () => {
            cancelled = true
        }
    }, [])


    async function callAdmin(payload = {}) {
        setStatus('loading')
        setMessage('')

        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        })

        const body = await readApiJson(response)

        if (response.status === 401) {
            setData(null)
            throw new Error(
                body?.error
                || 'Sua sessao expirou. Entre novamente.'
            )
        }

        if (!response.ok) {
            throw new Error(
                body?.error
                || 'Nao foi possivel abrir o painel.'
            )
        }

        setData(body)
        setStatus('success')
        setLastUpdatedAt(
            new Date().toISOString()
        )

        return body
    }

    useEffect(() => {
        /*
         * Mantem no ref sempre a versao mais recente de callAdmin.
         *
         * O ref e atualizado apos o render, nunca durante o render.
         */
        adminRefreshRef.current = callAdmin
    })

    async function handleRefreshAdmin({
        automatic = false,
    } = {}) {
        if (refreshing) {
            return
        }

        setRefreshing(true)

        try {
            lastAutoRefreshAtRef.current = Date.now()

            await callAdmin()

            if (!automatic) {
                setMessage(
                    'Dados do painel atualizados.'
                )
            }
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
        } finally {
            setRefreshing(false)
        }
    }

    useEffect(() => {
        if (!data) {
            return undefined
        }

        function handleVisibilityChange() {
            if (
                document.visibilityState
                !== 'visible'
            ) {
                return
            }

            const now = Date.now()

            /*
             * Evita consultas repetidas caso o usuario
             * alterne entre abas varias vezes em poucos segundos.
             */
            if (
                now
                - lastAutoRefreshAtRef.current
                < 30_000
            ) {
                return
            }

            lastAutoRefreshAtRef.current = now

            setRefreshing(true)

            Promise.resolve(
                adminRefreshRef.current?.()
            )
                .catch((error) => {
                    setStatus('error')
                    setMessage(
                        error.message
                    )
                })
                .finally(() => {
                    setRefreshing(false)
                })
        }

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange
        )

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            )
        }
    }, [data])

    async function handleLogin(event) {
        event.preventDefault()

        setStatus('loading')
        setMessage('')

        try {
            const response = await fetch('/api/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ password }),
            })

            const body = await readApiJson(response)

            if (!response.ok) {
                throw new Error(
                    body?.error
                    || 'Senha invalida.'
                )
            }

            setPassword('')

            await callAdmin()

            setMessage(
                body?.message
                || 'Acesso autorizado.'
            )
        } catch (error) {
            setData(null)
            setStatus('error')
            setMessage(error.message)
        }
    }

    async function handleLogout() {
        setStatus('loading')
        setMessage('')

        try {
            const response = await fetch('/api/admin-logout', {
                method: 'POST',
                credentials: 'same-origin',
            })

            const body = await readApiJson(response)

            if (!response.ok) {
                throw new Error(
                    body?.error
                    || 'Nao foi possivel encerrar a sessao.'
                )
            }

            setData(null)
            setEditing(null)
            setAdminCompanionCount(0)
            setPassword('')
            setStatus('idle')
            setLastUpdatedAt('')
            setRefreshing(false)
            lastAutoRefreshAtRef.current = 0
            setMessage('Sessao encerrada.')
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
        }
    }

    async function handleSaveGuest(event) {
        event.preventDefault()

        /*
         * Guardamos o formulario antes do primeiro await.
         * Depois de uma operacao assincrona, event.currentTarget
         * pode nao estar mais disponivel.
         */
        const formElement = event.currentTarget
        const form = new FormData(formElement)

        const maxCompanions = Math.max(Number.parseInt(String(form.get('maxCompanions') || 0), 10) || 0, 0)
        const presetCompanions = Array.from({ length: maxCompanions }, (_, index) => {
            const slot = index + 1

            return {
                slot,
                name: String(form.get(`companionName${slot}`) || '').trim(),
                age: String(form.get(`companionAge${slot}`) || '').trim(),
            }
        })

        try {
            const result = await callAdmin({
                action: 'saveGuest',
                id: form.get('id'),
                guestName: form.get('guestName'),
                inviteCode: form.get('inviteCode'),
                age: form.get('age'),
                whatsapp: form.get('whatsapp'),
                maxCompanions,
                presetCompanions,
            })
            setMessage(result.message || 'Convidado salvo.')
            setEditing(null)
            setAdminCompanionCount(0)
            formElement.reset()
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
        }
    }

    async function handleDeleteGuest(guestItem) {
        const confirmed = window.confirm(`Excluir ${guestItem.name} da lista? Isso tambem remove confirmacoes e acompanhantes deste convite.`)
        if (!confirmed) return

        try {
            const result = await callAdmin({ action: 'deleteGuest', id: guestItem.id })
            setMessage(result.message || 'Convidado excluido.')
            if (editing?.id === guestItem.id) {
                setEditing(null)
                setAdminCompanionCount(0)
            }
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
        }
    }

    async function handleDeleteMessage(messageItem) {
        const confirmed = window.confirm(
            `Excluir a mensagem de ${messageItem.name}?`
        )

        if (!confirmed) return

        try {
            const result = await callAdmin({
                action: 'deleteMessage',
                id: messageItem.id,
            })

            setMessage(
                result.message
                || 'Mensagem excluída.'
            )
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
        }
    }

    const normalizedMessageSearch = messageSearch
        .trim()
        .toLocaleLowerCase('pt-BR')

    const filteredMessages = (
        data?.messages
        || []
    ).filter((item) => {
        if (!normalizedMessageSearch) {
            return true
        }

        const searchable = `${item.name || ''} ${item.message || ''}`
            .toLocaleLowerCase('pt-BR')

        return searchable.includes(
            normalizedMessageSearch
        )
    })

    function handleExportMessages() {
        if (filteredMessages.length === 0) {
            setMessage(
                'Não existem mensagens para exportar com o filtro atual.'
            )
            return
        }

        const escapeCsv = (value) => (
            `"${String(value ?? '').replaceAll('"', '""')}"`
        )

        const rows = [
            [
                'Convidado',
                'Mensagem',
                'Data/Hora',
            ],

            ...filteredMessages.map((item) => [
                item.name,
                item.message,
                formatAdminAccessDate(
                    item.createdAt,
                ),
            ]),
        ]

        const csv = '\uFEFF' + rows
            .map(
                (row) => row
                    .map(escapeCsv)
                    .join(';')
            )
            .join('\r\n')

        const blob = new Blob(
            [csv],
            {
                type:
                    'text/csv;charset=utf-8',
            },
        )

        const url = URL.createObjectURL(
            blob,
        )

        const link = document.createElement(
            'a',
        )

        link.href = url
        link.download = 'mensagens-duda.csv'

        document.body.appendChild(
            link,
        )

        link.click()
        link.remove()

        URL.revokeObjectURL(
            url,
        )
    }

    const baseUrl = typeof window === 'undefined'
        ? ''
        : window.location.origin

    function normalizeAdminSearch(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR')
            .trim()
    }

    function getGuestStatusLabel(statusValue) {
        if (statusValue === 'sim') {
            return 'Confirmou'
        }

        if (statusValue === 'nao') {
            return 'Não vai'
        }

        if (statusValue === 'visualizou') {
            return 'Visualizou'
        }

        return 'Pendente'
    }

    function getGuestInviteUrl(guestItem) {
        if (!guestItem?.inviteToken) {
            return ''
        }

        return `${baseUrl}/?convite=${guestItem.inviteToken}`
    }

    async function copyAdminText(value) {
        if (!value) {
            throw new Error(
                'Não existe conteúdo para copiar.'
            )
        }

        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(
                    value,
                )

                return
            } catch {
                // Usa fallback abaixo.
            }
        }

        const textarea = document.createElement(
            'textarea',
        )

        textarea.value = value
        textarea.setAttribute(
            'readonly',
            '',
        )

        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        textarea.style.pointerEvents = 'none'

        document.body.appendChild(
            textarea,
        )

        textarea.select()

        const copied = document.execCommand(
            'copy',
        )

        textarea.remove()

        if (!copied) {
            throw new Error(
                'Não foi possível copiar automaticamente.'
            )
        }
    }

    async function handleCopyGuestLink(guestItem) {
        const inviteUrl = getGuestInviteUrl(
            guestItem,
        )

        if (!inviteUrl) {
            setStatus('error')
            setMessage(
                'Este convidado ainda não possui link seguro.'
            )
            return
        }

        try {
            await copyAdminText(
                inviteUrl,
            )

            setStatus('success')

            setMessage(
                `Link de ${guestItem.name} copiado.`
            )
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
        }
    }

    async function handleUnmarkCommunication(
        guestItem,
        communicationType,
    ) {
        const confirmed = window.confirm(
            `Desmarcar o envio para ${guestItem.name}?`
        )

        if (!confirmed) {
            return
        }

        try {
            const result =
                await callAdmin({
                    action:
                        'unmarkCommunication',

                    guestId:
                        guestItem.id,

                    communicationType,
                })

            setStatus('success')

            setMessage(
                result.message
                || 'Marcacao removida.'
            )

            return result
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
            throw error
        }
    }


    async function handleMarkCommunication(
        guestItem,
        communicationType,
    ) {
        try {
            const result =
                await callAdmin({
                    action:
                        'markCommunication',

                    guestId:
                        guestItem.id,

                    communicationType,
                })

            setStatus('success')

            setMessage(
                result.message
                || 'Envio registrado.'
            )

            return result
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
            throw error
        }
    }


    function handleOpenGuestWhatsapp(guestItem) {
        const phone = digitsOnly(
            guestItem.whatsapp || '',
        )

        if (!phone) {
            setStatus('error')

            setMessage(
                `Cadastre o WhatsApp de ${guestItem.name} primeiro.`
            )

            return
        }

        const inviteUrl = getGuestInviteUrl(
            guestItem,
        )

        if (!inviteUrl) {
            setStatus('error')

            setMessage(
                'Este convidado ainda não possui link seguro.'
            )

            return
        }

        const brazilPhone = phone.startsWith('55')
            && phone.length >= 12
            ? phone
            : `55${phone}`

        const whatsappMessage = [
            `Olá, ${guestItem.name}!`,
            '',
            'Este é o seu convite para os 16 anos da Duda.',
            '',
            'Para abrir o convite, acesse o link abaixo e informe o seu número de celular:',
            inviteUrl,
            '',
            'Esperamos você!',
        ].join('\n')

        const whatsappUrl = (
            `https://wa.me/${brazilPhone}`
            + `?text=${encodeURIComponent(whatsappMessage)}`
        )

        window.open(
            whatsappUrl,
            '_blank',
            'noopener,noreferrer',
        )
    }

    const normalizedGuestSearch = normalizeAdminSearch(
        guestSearch,
    )

    const filteredGuests = (
        data?.guests
        || []
    ).filter((guestItem) => {
        const matchesStatus = (
            guestStatusFilter === 'todos'
            || guestItem.status === guestStatusFilter
        )

        const matchesAge =
            guestMatchesAgeFilter(
                guestItem,
                guestAgeFilter,
            )

        if (
            !matchesStatus
            || !matchesAge
        ) {
            return false
        }

        if (!normalizedGuestSearch) {
            return true
        }

        const companionNames = [
            ...(guestItem.companions || []),
            ...(guestItem.presetCompanions || []),
        ]
            .map((item) => item.name || '')
            .join(' ')

        const searchable = normalizeAdminSearch(
            [
                guestItem.name,
                guestItem.whatsapp,
                companionNames,
            ].join(' ')
        )

        return searchable.includes(
            normalizedGuestSearch
        )
    })

    function getGuestAgeFilterLabel(
        filterValue,
    ) {
        if (filterValue === 'ate6') {
            return 'Crianças até 6 anos'
        }

        if (filterValue === 'acima6') {
            return 'Maiores de 6 anos'
        }

        if (filterValue === 'sem_idade') {
            return 'Sem idade informada'
        }

        return 'Todas as idades'
    }

    function formatCompanionForExport(
        companion,
        answered,
    ) {
        const name = String(
            companion?.name || '',
        ).trim()

        const age = (
            companion?.age === ''
            || companion?.age === null
            || companion?.age === undefined
        )
            ? 'idade não informada'
            : `${companion.age} anos`

        if (!answered) {
            return [
                name,
                age,
                'pré-cadastrado',
            ]
                .filter(Boolean)
                .join(' - ')
        }

        return [
            name,
            age,
            companion.attending === 'nao'
                ? 'não vai'
                : 'vai',
            companion.countsBuffet
                ? 'buffet: sim'
                : 'buffet: não',
        ]
            .filter(Boolean)
            .join(' - ')
    }

    function getChildrenUpToSix(
        guestItem,
    ) {
        const children = []

        const mainAge =
            guestItem.age === ''
                ? null
                : Number(
                    guestItem.age,
                )

        if (
            Number.isFinite(mainAge)
            && mainAge <= 6
        ) {
            children.push(
                `${guestItem.name} (${mainAge})`,
            )
        }

        const companions = (
            guestItem.companions?.length > 0
                ? guestItem.companions
                : guestItem.presetCompanions
        ) || []

        for (const companion of companions) {
            if (
                companion.age === ''
                || companion.age === null
                || companion.age === undefined
            ) {
                continue
            }

            const age =
                Number(companion.age)

            if (
                Number.isFinite(age)
                && age <= 6
            ) {
                children.push(
                    `${companion.name || 'Acompanhante'} (${age})`,
                )
            }
        }

        return children.join(' | ')
    }

    const guestExportColumns = [
        {
            key: 'name',
            label: 'Nome',
            xlsxWidth: 28,
            pdfWidth: 136,
        },
        {
            key: 'age',
            label: 'Idade',
            xlsxWidth: 10,
            pdfWidth: 44,
        },
        {
            key: 'status',
            label: 'Status',
            xlsxWidth: 16,
            pdfWidth: 72,
        },
        {
            key: 'whatsapp',
            label: 'WhatsApp',
            xlsxWidth: 20,
            pdfWidth: 96,
        },
        {
            key: 'companionsConfirmed',
            label: 'Acomp. confirmados',
            xlsxWidth: 18,
            pdfWidth: 54,
        },
        {
            key: 'companionsAllowed',
            label: 'Acomp. liberados',
            xlsxWidth: 18,
            pdfWidth: 54,
        },
        {
            key: 'buffet',
            label: 'Buffet',
            xlsxWidth: 11,
            pdfWidth: 46,
        },
        {
            key: 'childrenUpToSix',
            label: 'Crianças até 6 anos',
            xlsxWidth: 30,
            pdfWidth: 126,
            pdfLines: 3,
        },
        {
            key: 'declineReason',
            label: 'Motivo da ausência',
            xlsxWidth: 32,
        },
        {
            key: 'firstAccess',
            label: 'Primeiro acesso',
            xlsxWidth: 20,
        },
        {
            key: 'lastAccess',
            label: 'Último acesso',
            xlsxWidth: 20,
        },
        {
            key: 'accessCount',
            label: 'Quantidade de acessos',
            xlsxWidth: 20,
        },
        {
            key: 'confirmedAt',
            label: 'Primeira resposta',
            xlsxWidth: 20,
        },
        {
            key: 'companionDetails',
            label: 'Detalhes dos acompanhantes',
            xlsxWidth: 55,
            pdfWidth: 244,
            pdfLines: 5,
        },
        {
            key: 'inviteLink',
            label: 'Link do convite',
            xlsxWidth: 58,
        },
    ]

    const guestExportRows =
        filteredGuests.map(
            (guestItem) => {
                const answeredCompanions = (
                    guestItem.companions
                    || []
                )

                const companionDetails = (
                    answeredCompanions.length > 0
                        ? answeredCompanions
                            .map((item) => (
                                formatCompanionForExport(
                                    item,
                                    true,
                                )
                            ))
                        : (
                            guestItem.presetCompanions
                            || []
                        ).map((item) => (
                            formatCompanionForExport(
                                item,
                                false,
                            )
                        ))
                ).join(' | ')

                return {
                    name:
                        guestItem.name,
                    age:
                        guestItem.age,
                    status:
                        getGuestStatusLabel(
                            guestItem.status,
                        ),
                    declineReason:
                        guestItem.declineReason || '',
                    whatsapp:
                        formatWhatsapp(
                            guestItem.whatsapp,
                        ),
                    companionsConfirmed:
                        guestItem.companionsCount,
                    companionsAllowed:
                        guestItem.maxCompanions,
                    buffet:
                        guestItem.buffetCount,
                    childrenUpToSix:
                        getChildrenUpToSix(
                            guestItem,
                        ),
                    firstAccess:
                        formatAdminAccessDate(
                            guestItem.firstAccessAt,
                        ),
                    lastAccess:
                        formatAdminAccessDate(
                            guestItem.lastAccessAt,
                        ),
                    accessCount:
                        guestItem.accessCount || 0,
                    confirmedAt:
                        formatAdminAccessDate(
                            guestItem.confirmedAt,
                        ),
                    companionDetails,
                    inviteLink:
                        getGuestInviteUrl(
                            guestItem,
                        ),
                }
            },
        )

    function downloadAdminExport(
        content,
        type,
        filename,
    ) {
        const blob = new Blob(
            [content],
            { type },
        )

        const url =
            URL.createObjectURL(blob)

        const link =
            document.createElement('a')

        link.href = url
        link.download = filename

        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
    }

    function getGuestExportDescription() {
        const statusLabel =
            guestStatusFilter === 'todos'
                ? 'Todos os status'
                : getGuestStatusLabel(
                    guestStatusFilter,
                )

        const parts = [
            `Status: ${statusLabel}`,
            `Idade: ${getGuestAgeFilterLabel(guestAgeFilter)}`,
        ]

        if (guestSearch.trim()) {
            parts.push(
                `Busca: ${guestSearch.trim()}`,
            )
        }

        return parts.join(' · ')
    }

    function getGuestExportFilename(
        extension,
    ) {
        const date =
            new Date()
                .toISOString()
                .slice(0, 10)

        const statusPart =
            guestStatusFilter === 'todos'
                ? 'todos'
                : guestStatusFilter

        const agePart =
            guestAgeFilter === 'todos'
                ? 'todas-idades'
                : guestAgeFilter
                    .replace('_', '-')

        return (
            'convidados-duda'
            + `-${statusPart}`
            + `-${agePart}`
            + `-${date}.${extension}`
        )
    }

    async function confirmGuestExport(
        format,
    ) {
        if (filteredGuests.length === 0) {
            setStatus('error')

            setMessage(
                'Não existem convidados para exportar com o filtro atual.'
            )

            return
        }

        try {
            const {
                createGuestsPdf,
                createGuestsXlsx,
            } = await import(
                './admin-guest-export.js'
            )

            const filterDescription =
                getGuestExportDescription()

            if (format === 'pdf') {
                const pdfColumns =
                    guestExportColumns
                        .filter(
                            (column) => (
                                column.pdfWidth
                            ),
                        )

                const pdf =
                    createGuestsPdf({
                        title:
                            'Lista de convidados — 16 anos da Duda',
                        subtitle:
                            'Relatório gerado pelo painel administrativo',
                        filterDescription,
                        columns:
                            pdfColumns,
                        rows:
                            guestExportRows,
                    })

                downloadAdminExport(
                    pdf,
                    'application/pdf',
                    getGuestExportFilename(
                        'pdf',
                    ),
                )
            } else if (format === 'xlsx') {
                const xlsx =
                    createGuestsXlsx({
                        columns:
                            guestExportColumns,
                        rows:
                            guestExportRows,
                        sheetName:
                            'Convidados',
                    })

                downloadAdminExport(
                    xlsx,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    getGuestExportFilename(
                        'xlsx',
                    ),
                )
            }

            setStatus('success')

            setMessage(
                `${filteredGuests.length} convite${filteredGuests.length === 1 ? '' : 's'} exportado${filteredGuests.length === 1 ? '' : 's'} em ${format.toUpperCase()}.`
            )
        } catch (error) {
            setStatus('error')
            setMessage(
                error.message
                || 'Não foi possível gerar o arquivo.',
            )
        }
    }

    const pendingGuests =
        (data?.guests || [])
            .filter(
                (guestItem) => (
                    guestItem.status
                    === 'pendente'
                ),
            )

    const viewedGuests =
        (data?.guests || [])
            .filter(
                (guestItem) => (
                    guestItem.status
                    === 'visualizou'
                ),
            )

    const recentlyConfirmedGuests =
        (data?.guests || [])
            .filter(
                (guestItem) => (
                    guestItem.status === 'sim'
                    && guestItem.confirmedAt
                ),
            )
            .sort(
                (first, second) => (
                    new Date(second.confirmedAt)
                    - new Date(first.confirmedAt)
                ),
            )
            .slice(0, 8)

    const confirmedAttendees =
        (data?.guests || [])
            .filter(
                (guestItem) => (
                    guestItem.status
                    === 'sim'
                ),
            )
            .flatMap((guestItem) => {
                const checkinByKey =
                    new Map(
                        (guestItem.checkins || [])
                            .map((checkin) => [
                                checkin.attendeeKey,
                                checkin,
                            ]),
                    )

                return [
                    {
                        guestId: guestItem.id,
                        attendeeKey: 'guest',
                        attendeeName: guestItem.name,
                        invitationName: guestItem.name,
                        checkin:
                            checkinByKey.get('guest')
                            || null,
                    },
                    ...(guestItem.companions || [])
                        .filter(
                            (companion) => (
                                companion.attending
                                !== 'nao'
                            ),
                        )
                        .map((companion) => {
                            const attendeeKey =
                                `companion:${companion.slot}`

                            return {
                                guestId: guestItem.id,
                                attendeeKey,
                                attendeeName:
                                    companion.name,
                                invitationName:
                                    guestItem.name,
                                checkin:
                                    checkinByKey
                                        .get(attendeeKey)
                                    || null,
                            }
                        }),
                ]
            })

    async function handleGuestCheckin(
        attendee,
    ) {
        try {
            const checkedIn =
                !attendee.checkin

            const result =
                await callAdmin({
                    action:
                        'setGuestCheckin',
                    guestId:
                        attendee.guestId,
                    attendeeKey:
                        attendee.attendeeKey,
                    checkedIn,
                })

            setMessage(
                result.message
                || (
                    checkedIn
                        ? 'Entrada registrada.'
                        : 'Entrada removida.'
                ),
            )
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
        }
    }

    return (
        <main className="admin-shell">
            <section className="confirm-panel admin-login" aria-labelledby="admin-title">
                <p className="panel-kicker">Area reservada</p>
                <h2 id="admin-title">Lista da Duda</h2>
                <form className="lookup-form" onSubmit={handleLogin}>
                    {data ? (
                        <button
                            className="admin-logout-button"
                            type="button"
                            onClick={handleLogout}
                            disabled={status === 'loading'}
                        >
                            <span aria-hidden="true">↪</span>

                            {status === 'loading'
                                ? 'Saindo...'
                                : 'Sair do painel'}
                        </button>
                    ) : (
                        <>
                            <label>
                                <span>Senha</span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="Senha do painel"
                                    autoComplete="current-password"
                                    required
                                />
                            </label>

                            <button
                                type="submit"
                                disabled={status === 'loading'}
                            >
                                {status === 'loading'
                                    ? 'Abrindo...'
                                    : 'Entrar'}
                            </button>
                        </>
                    )}
                </form>
                {message ? <p className={`form-message form-message--${status === 'error' ? 'error' : 'success'}`}>{message}</p> : null}
            </section>

            {data ? (
                <>
                    <section
                        className="admin-sync-bar"
                        aria-label="Sincronização do painel"
                    >
                        <div className="admin-sync-status">
                            <span>
                                Painel sincronizado
                            </span>

                            <small>
                                {lastUpdatedAt
                                    ? `Última atualização: ${formatAdminAccessDate(lastUpdatedAt)}`
                                    : 'Aguardando atualização'}
                            </small>
                        </div>

                        <button
                            className="admin-refresh-button"
                            type="button"
                            onClick={() => (
                                handleRefreshAdmin()
                            )}
                            disabled={
                                refreshing
                                || status === 'loading'
                            }
                        >
                            <span aria-hidden="true">
                                ⟳
                            </span>

                            {refreshing
                                ? 'Atualizando...'
                                : 'Atualizar dados'}
                        </button>
                    </section>

                    <Suspense
                        fallback={(
                            <div className="admin-tools-loading">
                                Carregando menu do painel...
                            </div>
                        )}
                    >
                        <AdminInvitationTools
                            data={data}
                            activeSection={activeAdminSection}
                            onSectionChange={setActiveAdminSection}
                            onAdminAction={callAdmin}
                            onOpenCommunication={() => (
                                setCommunicationModalOpen(true)
                            )}
                            baseUrl={baseUrl}
                        />
                    </Suspense>

                    <section
                        className="admin-summary"
                        aria-label="Resumo das confirmacoes"
                        hidden={activeAdminSection !== 'resumo'}
                    >
                        <div><span>Convidados</span><strong>{data.totals.invited}</strong></div>
                        <div><span>Confirmados</span><strong>{data.totals.confirmed}</strong></div>
                        <div><span>Nao vao</span><strong>{data.totals.declined}</strong></div>
                        <div><span>Pendentes</span><strong>{data.totals.pending}</strong></div>
                        <div className="admin-summary__viewed">
                            <span>Acessaram sem responder</span>
                            <strong>{data.totals.viewed || 0}</strong>
                        </div>
                        <div><span>Buffet</span><strong>{data.totals.buffet}</strong></div>

                        <div className="admin-summary__sent">
                            <span>Convites enviados</span>
                            <strong>{data.totals.invitesSent || 0}</strong>
                        </div>

                        <div className="admin-summary__not-sent">
                            <span>Não enviados</span>
                            <strong>{data.totals.invitesNotSent || 0}</strong>
                        </div>

                        <div>
                            <span>Mensagens</span>
                            <strong>{data.messages?.length || 0}</strong>
                        </div>

                        <div className="admin-summary__checkin">
                            <span>Presentes na festa</span>
                            <strong>{data.totals.checkedIn || 0}</strong>
                        </div>
                    </section>

                    <section
                        className="admin-insight-grid"
                        aria-label="Acompanhamento das respostas"
                        hidden={activeAdminSection !== 'resumo'}
                    >
                        <article>
                            <header>
                                <span>Faltam responder</span>
                                <strong>{pendingGuests.length}</strong>
                            </header>

                            <ul>
                                {pendingGuests
                                    .slice(0, 8)
                                    .map((guestItem) => (
                                        <li key={guestItem.id}>
                                            {guestItem.name}
                                        </li>
                                    ))}
                            </ul>

                            {pendingGuests.length === 0 ? (
                                <p>Todos já responderam.</p>
                            ) : null}
                        </article>

                        <article>
                            <header>
                                <span>Visualizaram</span>
                                <strong>{viewedGuests.length}</strong>
                            </header>

                            <ul>
                                {viewedGuests
                                    .slice(0, 8)
                                    .map((guestItem) => (
                                        <li key={guestItem.id}>
                                            <span>{guestItem.name}</span>
                                            <small>
                                                {formatAdminAccessDate(
                                                    guestItem.lastAccessAt,
                                                )}
                                            </small>
                                        </li>
                                    ))}
                            </ul>

                            {viewedGuests.length === 0 ? (
                                <p>Ninguém está aguardando resposta após visualizar.</p>
                            ) : null}
                        </article>

                        <article>
                            <header>
                                <span>Confirmaram recentemente</span>
                                <strong>{recentlyConfirmedGuests.length}</strong>
                            </header>

                            <ul>
                                {recentlyConfirmedGuests
                                    .map((guestItem) => (
                                        <li key={guestItem.id}>
                                            <span>{guestItem.name}</span>
                                            <small>
                                                {formatAdminAccessDate(
                                                    guestItem.confirmedAt,
                                                )}
                                            </small>
                                        </li>
                                    ))}
                            </ul>

                            {recentlyConfirmedGuests.length === 0 ? (
                                <p>Ainda não há confirmações.</p>
                            ) : null}
                        </article>
                    </section>

                    <section
                        className="confirm-panel admin-checkin-panel"
                        aria-labelledby="admin-checkin-title"
                        hidden={activeAdminSection !== 'relatorios'}
                    >
                        <div className="admin-checkin-heading">
                            <div>
                                <p className="panel-kicker">
                                    Presença real
                                </p>

                                <h2 id="admin-checkin-title">
                                    Check-in da festa
                                </h2>

                                <p>
                                    A confirmação indica quem pretende ir; o check-in registra quem realmente chegou.
                                </p>
                            </div>

                            <strong>
                                {data.totals.checkedIn || 0}
                                {' / '}
                                {confirmedAttendees.length}
                            </strong>
                        </div>

                        <div className="admin-checkin-list">
                            {confirmedAttendees.map(
                                (attendee) => (
                                    <article
                                        className={
                                            attendee.checkin
                                                ? 'admin-checkin-card admin-checkin-card--present'
                                                : 'admin-checkin-card'
                                        }
                                        key={`${attendee.guestId}-${attendee.attendeeKey}`}
                                    >
                                        <div>
                                            <strong>
                                                {attendee.attendeeName}
                                            </strong>

                                            {attendee.attendeeKey !== 'guest' ? (
                                                <small>
                                                    Convite de {attendee.invitationName}
                                                </small>
                                            ) : null}

                                            {attendee.checkin ? (
                                                <small>
                                                    Entrada: {formatAdminAccessDate(
                                                        attendee.checkin.checkedInAt,
                                                    )}
                                                </small>
                                            ) : null}
                                        </div>

                                        <button
                                            type="button"
                                            aria-pressed={Boolean(attendee.checkin)}
                                            onClick={() => (
                                                handleGuestCheckin(attendee)
                                            )}
                                            disabled={status === 'loading'}
                                        >
                                            {attendee.checkin
                                                ? '✓ Presente'
                                                : 'Registrar entrada'}
                                        </button>
                                    </article>
                                ),
                            )}
                        </div>

                        {confirmedAttendees.length === 0 ? (
                            <p className="admin-checkin-empty">
                                As pessoas confirmadas aparecerão aqui.
                            </p>
                        ) : null}
                    </section>

                    <section
                        id="cadastro-convidado"
                        className="confirm-panel admin-form-panel"
                        aria-labelledby="guest-form-title"
                        hidden={activeAdminSection !== 'convidados'}
                    >
                        <p className="panel-kicker">Cadastro</p>
                        <h2 id="guest-form-title">Convidado</h2>
                        <form key={editing?.id || 'new-guest'} className="admin-guest-form" onSubmit={handleSaveGuest}>
                            <input name="id" type="hidden" value={editing?.id || ''} />
                            <label>
                                <span>Nome</span>
                                <input name="guestName" defaultValue={editing?.name || ''} placeholder="Nome do convidado" required />
                            </label>
                            <label>
                                <span>Identificador interno</span>
                                <input name="inviteCode" defaultValue={editing?.inviteCode || ''} placeholder="Opcional" />
                            </label>
                            <label>
                                <span>Idade</span>
                                <input name="age" defaultValue={editing?.age || ''} type="number" min="0" max="120" placeholder="Opcional" />
                            </label>
                            <label>
                                <span>WhatsApp</span>
                                <input name="whatsapp" defaultValue={formatWhatsapp(editing?.whatsapp || '')} placeholder="(11) 99999-9999" />
                            </label>
                            <label>
                                <span>Acompanhantes</span>
                                <input
                                    name="maxCompanions"
                                    defaultValue={editing?.maxCompanions ?? 0}
                                    type="number"
                                    min="0"
                                    max="20"
                                    onChange={(event) => setAdminCompanionCount(Math.max(Number.parseInt(event.target.value, 10) || 0, 0))}
                                    required
                                />
                            </label>
                            {adminCompanionCount > 0 ? (
                                <section className="admin-companions-field" aria-label="Acompanhantes pre-cadastrados">
                                    <div className="admin-companions-title">
                                        <span>Acompanhantes ja conhecidos</span>
                                        <small>Preencha uma linha para cada acompanhante que voce ja souber. Os campos vazios ficam liberados para o convidado preencher.</small>
                                    </div>
                                    <div className="admin-companion-lines">
                                        {Array.from({ length: adminCompanionCount }, (_, index) => {
                                            const slot = index + 1
                                            const preset = (editing?.presetCompanions || []).find((item) => Number(item.slot) === slot) || editing?.presetCompanions?.[index] || {}

                                            return (
                                                <div className="admin-companion-line" key={slot}>
                                                    <strong>{slot}</strong>
                                                    <label>
                                                        <span>Nome</span>
                                                        <input name={`companionName${slot}`} defaultValue={preset.name || ''} placeholder={`Acompanhante ${slot}`} />
                                                    </label>
                                                    <label>
                                                        <span>Idade</span>
                                                        <input name={`companionAge${slot}`} defaultValue={preset.age ?? ''} type="number" min="0" max="120" placeholder="Opcional" />
                                                    </label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </section>
                            ) : null}
                            <button type="submit" disabled={status === 'loading'}>{editing ? 'Salvar alteracao' : 'Cadastrar convidado'}</button>
                        </form>
                    </section>

                    <section
                        className="confirm-panel admin-table-panel admin-guests-panel"
                        aria-labelledby="guest-list-title"
                        hidden={activeAdminSection !== 'convidados'}
                    >
                        <div className="admin-guests-heading">
                            <div>
                                <p className="panel-kicker">
                                    Confirmações
                                </p>

                                <h2 id="guest-list-title">
                                    Lista geral
                                </h2>

                                <p className="admin-guests-subtitle">
                                    Gerencie convidados, acessos e links individuais.
                                </p>
                            </div>

                            <span className="admin-guests-count">
                                {filteredGuests.length}
                                {' / '}
                                {data.guests.length}
                            </span>
                        </div>

                        <div className="admin-guests-toolbar">
                            <label className="admin-guest-search">
                                <span>Buscar convidado</span>

                                <input
                                    type="search"
                                    value={guestSearch}
                                    onChange={(event) => (
                                        setGuestSearch(
                                            event.target.value
                                        )
                                    )}
                                    placeholder="Nome, WhatsApp ou acompanhante"
                                />
                            </label>

                            <label className="admin-guest-status-filter">
                                <span>Status</span>

                                <select
                                    value={guestStatusFilter}
                                    onChange={(event) => (
                                        setGuestStatusFilter(
                                            event.target.value
                                        )
                                    )}
                                >
                                    <option value="todos">
                                        Todos
                                    </option>

                                    <option value="sim">
                                        Confirmou
                                    </option>

                                    <option value="nao">
                                        Não vai
                                    </option>

                                    <option value="visualizou">
                                        Visualizou
                                    </option>

                                    <option value="pendente">
                                        Pendente
                                    </option>
                                </select>
                            </label>

                            <label className="admin-guest-age-filter">
                                <span>Faixa etária no convite</span>

                                <select
                                    value={guestAgeFilter}
                                    onChange={(event) => (
                                        setGuestAgeFilter(
                                            event.target.value
                                        )
                                    )}
                                >
                                    <option value="todos">
                                        Todas as idades
                                    </option>

                                    <option value="ate6">
                                        Crianças até 6 anos
                                    </option>

                                    <option value="acima6">
                                        Maiores de 6 anos
                                    </option>

                                    <option value="sem_idade">
                                        Sem idade informada
                                    </option>
                                </select>
                            </label>

                            <button
                                className="admin-communication-launch"
                                type="button"
                                onClick={() => (
                                    setCommunicationModalOpen(true)
                                )}
                            >
                                ◉ Disparar lembretes
                            </button>

                            <div
                                className="admin-export-group"
                                aria-label="Baixar lista filtrada"
                            >
                                <span>Baixar lista filtrada</span>

                                <div>
                                    <button
                                        className="admin-export-guests admin-export-guests--pdf"
                                        type="button"
                                        onClick={() => (
                                            confirmGuestExport(
                                                'pdf'
                                            )
                                        )}
                                        disabled={
                                            filteredGuests.length === 0
                                        }
                                    >
                                        PDF
                                    </button>

                                    <button
                                        className="admin-export-guests admin-export-guests--xlsx"
                                        type="button"
                                        onClick={() => (
                                            confirmGuestExport(
                                                'xlsx'
                                            )
                                        )}
                                        disabled={
                                            filteredGuests.length === 0
                                        }
                                    >
                                        XLSX
                                    </button>
                                </div>
                            </div>
                        </div>

                        <p className="admin-guests-filter-result">
                            Exibindo
                            {' '}
                            <strong>
                                {filteredGuests.length}
                            </strong>
                            {' '}
                            de
                            {' '}
                            <strong>
                                {data.guests.length}
                            </strong>
                            {' '}
                            convites
                            {' · '}
                            {getGuestAgeFilterLabel(
                                guestAgeFilter
                            )}
                        </p>

                        <div className="admin-mobile-guests">
                            {filteredGuests.length === 0 ? (
                                <div className="admin-mobile-empty">
                                    Nenhum convidado encontrado com os filtros atuais.
                                </div>
                            ) : (
                                filteredGuests.map((guestItem) => (
                                    <article
                                        className={`admin-mobile-guest-card admin-mobile-guest-card--${guestItem.status}`}
                                        key={`mobile-${guestItem.id}`}
                                    >
                                        <header className="admin-mobile-guest-header">
                                            <div>
                                                <strong className="admin-mobile-guest-name">
                                                    {guestItem.name}
                                                </strong>

                                                <small>
                                                    {guestItem.lastAccessAt
                                                        ? `Último acesso: ${formatAdminAccessDate(guestItem.lastAccessAt)}`
                                                        : 'Ainda não acessou'}
                                                </small>
                                            </div>

                                            <span
                                                className={`status-pill status-pill--${guestItem.status}`}
                                            >
                                                {getGuestStatusLabel(
                                                    guestItem.status
                                                )}
                                            </span>
                                        </header>

                                        <div className="admin-mobile-guest-metrics">
                                            <div>
                                                <span>Acomp.</span>
                                                <strong>
                                                    {guestItem.companionsCount}
                                                    /
                                                    {guestItem.maxCompanions}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Buffet</span>
                                                <strong>
                                                    {guestItem.buffetCount}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Convite</span>
                                                <strong>
                                                    {guestItem.communications?.convite_inicial
                                                        ? '✓ Enviado'
                                                        : 'Não enviado'}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>WhatsApp</span>
                                                <strong className="admin-mobile-phone">
                                                    {guestItem.whatsapp
                                                        ? formatWhatsapp(
                                                            guestItem.whatsapp
                                                        )
                                                        : 'Não informado'}
                                                </strong>
                                            </div>
                                        </div>

                                        {guestItem.declineReason ? (
                                            <div className="admin-mobile-decline">
                                                <span>Motivo da ausência</span>
                                                <strong>
                                                    {guestItem.declineReason}
                                                </strong>
                                            </div>
                                        ) : null}

                                        {guestItem.companions.length > 0
                                            || guestItem.presetCompanions?.length > 0 ? (
                                            <details className="admin-mobile-companions">
                                                <summary>
                                                    Ver acompanhantes
                                                </summary>

                                                <div>
                                                    {guestItem.companions.length > 0 ? (
                                                        <p>
                                                            {guestItem.companions
                                                                .map(
                                                                    (item) => (
                                                                        `${item.name} (${item.age})${item.attending === 'nao' ? ' - não vai' : ''}`
                                                                    )
                                                                )
                                                                .join(', ')}
                                                        </p>
                                                    ) : (
                                                        <p>
                                                            {(guestItem.presetCompanions || [])
                                                                .map(
                                                                    (item) => (
                                                                        `${item.name}${item.age !== '' ? ` (${item.age})` : ''}`
                                                                    )
                                                                )
                                                                .join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </details>
                                        ) : null}

                                        <button
                                            className="admin-mobile-whatsapp-primary"
                                            type="button"
                                            onClick={() => (
                                                handleOpenGuestWhatsapp(
                                                    guestItem
                                                )
                                            )}
                                            disabled={
                                                !guestItem.whatsapp
                                                || !guestItem.inviteToken
                                            }
                                        >
                                            <span aria-hidden="true">
                                                ↗
                                            </span>

                                            {guestItem.whatsapp
                                                ? (
                                                    guestItem.communications?.convite_inicial
                                                        ? 'Reenviar convite no WhatsApp'
                                                        : 'Enviar convite no WhatsApp'
                                                )
                                                : 'WhatsApp não cadastrado'}
                                        </button>

                                        <div className="admin-mobile-secondary-actions">
                                            <button
                                                className="admin-mobile-copy"
                                                type="button"
                                                onClick={() => (
                                                    handleCopyGuestLink(
                                                        guestItem
                                                    )
                                                )}
                                                disabled={
                                                    !guestItem.inviteToken
                                                }
                                            >
                                                <span aria-hidden="true">
                                                    ⧉
                                                </span>
                                                Copiar link
                                            </button>

                                            <button
                                                className="admin-mobile-edit"
                                                type="button"
                                                onClick={() => {
                                                    setEditing(
                                                        guestItem
                                                    )

                                                    setAdminCompanionCount(
                                                        Number(
                                                            guestItem.maxCompanions
                                                            || 0
                                                        )
                                                    )

                                                    window.requestAnimationFrame(
                                                        () => {
                                                            document
                                                                .getElementById(
                                                                    'cadastro-convidado'
                                                                )
                                                                ?.scrollIntoView({
                                                                    behavior: 'smooth',
                                                                    block: 'start',
                                                                })
                                                        }
                                                    )
                                                }}
                                            >
                                                <span aria-hidden="true">
                                                    ✎
                                                </span>
                                                Editar
                                            </button>

                                            <button
                                                className="admin-mobile-delete"
                                                type="button"
                                                onClick={() => (
                                                    handleDeleteGuest(
                                                        guestItem
                                                    )
                                                )}
                                            >
                                                <span aria-hidden="true">
                                                    ×
                                                </span>
                                                Excluir
                                            </button>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>

                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Status</th>
                                        <th>Acomp.</th>
                                        <th>Buffet</th>
                                        <th>WhatsApp</th>
                                        <th>Envio</th>
                                        <th>Convite</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredGuests.length === 0 ? (
                                        <tr>
                                            <td
                                                className="admin-guests-empty"
                                                colSpan="8"
                                            >
                                                Nenhum convidado encontrado com os filtros atuais.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredGuests.map((guestItem) => (
                                            <tr key={guestItem.id}>
                                                <td>
                                                    <strong>
                                                        {guestItem.name}
                                                    </strong>

                                                    {guestItem.companions.length > 0 ? (
                                                        <small>
                                                            {guestItem.companions
                                                                .map(
                                                                    (item) => (
                                                                        `${item.name} (${item.age})${item.attending === 'nao' ? ' - não vai' : ''}`
                                                                    )
                                                                )
                                                                .join(', ')}
                                                        </small>
                                                    ) : null}

                                                    {guestItem.companions.length === 0
                                                        && guestItem.presetCompanions?.length > 0 ? (
                                                        <small>
                                                            Pré-cadastrados:
                                                            {' '}
                                                            {guestItem.presetCompanions
                                                                .map(
                                                                    (item) => (
                                                                        `${item.name}${item.age !== '' ? ` (${item.age})` : ''}`
                                                                    )
                                                                )
                                                                .join(', ')}
                                                        </small>
                                                    ) : null}

                                                    {guestItem.declineReason ? (
                                                        <small>
                                                            Motivo:
                                                            {' '}
                                                            {guestItem.declineReason}
                                                        </small>
                                                    ) : null}
                                                </td>

                                                <td className="admin-status-cell">
                                                    <span
                                                        className={`status-pill status-pill--${guestItem.status}`}
                                                    >
                                                        {getGuestStatusLabel(
                                                            guestItem.status
                                                        )}
                                                    </span>

                                                    {guestItem.lastAccessAt ? (
                                                        <small>
                                                            Último acesso:
                                                            {' '}
                                                            {formatAdminAccessDate(
                                                                guestItem.lastAccessAt
                                                            )}
                                                        </small>
                                                    ) : (
                                                        <small>
                                                            Ainda não acessou
                                                        </small>
                                                    )}
                                                </td>

                                                <td>
                                                    {guestItem.companionsCount}
                                                    /
                                                    {guestItem.maxCompanions}
                                                </td>

                                                <td>
                                                    {guestItem.buffetCount}
                                                </td>

                                                <td className="admin-whatsapp-cell">
                                                    {guestItem.whatsapp ? (
                                                        <>
                                                            <strong>
                                                                {formatWhatsapp(
                                                                    guestItem.whatsapp
                                                                )}
                                                            </strong>

                                                            <small>
                                                                Cadastrado
                                                            </small>
                                                        </>
                                                    ) : (
                                                        <span className="admin-no-phone">
                                                            Não informado
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="admin-communication-status-cell">
                                                    {guestItem.communications?.convite_inicial ? (
                                                        <>
                                                            <strong className="communication-sent-badge">
                                                                ✓ Enviado
                                                            </strong>

                                                            <small>
                                                                {formatAdminAccessDate(
                                                                    guestItem.communications.convite_inicial
                                                                )}
                                                            </small>

                                                            <button
                                                                type="button"
                                                                className="communication-undo-mark"
                                                                onClick={() => (
                                                                    handleUnmarkCommunication(
                                                                        guestItem,
                                                                        'convite_inicial',
                                                                    )
                                                                )}
                                                            >
                                                                Desmarcar
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <strong className="communication-pending-badge">
                                                                Não enviado
                                                            </strong>

                                                            <button
                                                                type="button"
                                                                className="communication-quick-mark"
                                                                onClick={() => (
                                                                    handleMarkCommunication(
                                                                        guestItem,
                                                                        'convite_inicial',
                                                                    )
                                                                )}
                                                            >
                                                                ✓ Marcar enviado
                                                            </button>
                                                        </>
                                                    )}
                                                </td>

                                                <td>
                                                    <div className="admin-invite-actions">
                                                        <button
                                                            className="admin-invite-button admin-invite-button--copy"
                                                            type="button"
                                                            onClick={() => (
                                                                handleCopyGuestLink(
                                                                    guestItem
                                                                )
                                                            )}
                                                            disabled={
                                                                !guestItem.inviteToken
                                                            }
                                                        >
                                                            <span aria-hidden="true">
                                                                ⧉
                                                            </span>

                                                            Copiar link
                                                        </button>

                                                        <button
                                                            className="admin-invite-button admin-invite-button--whatsapp"
                                                            type="button"
                                                            onClick={() => (
                                                                handleOpenGuestWhatsapp(
                                                                    guestItem
                                                                )
                                                            )}
                                                            disabled={
                                                                !guestItem.whatsapp
                                                                || !guestItem.inviteToken
                                                            }
                                                        >
                                                            <span aria-hidden="true">
                                                                ◉
                                                            </span>

                                                            {guestItem.communications?.convite_inicial
                                                                ? 'Reenviar'
                                                                : 'WhatsApp'}
                                                        </button>
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="admin-row-actions">
                                                        <button
                                                            className="admin-action-button admin-action-button--edit"
                                                            type="button"
                                                            onClick={() => {
                                                                setEditing(
                                                                    guestItem
                                                                )

                                                                setAdminCompanionCount(
                                                                    Number(
                                                                        guestItem.maxCompanions
                                                                        || 0
                                                                    )
                                                                )

                                                                window.requestAnimationFrame(
                                                                    () => {
                                                                        document
                                                                            .getElementById(
                                                                                'cadastro-convidado'
                                                                            )
                                                                            ?.scrollIntoView({
                                                                                behavior: 'smooth',
                                                                                block: 'start',
                                                                            })
                                                                    }
                                                                )
                                                            }}
                                                        >
                                                            <span aria-hidden="true">
                                                                ✎
                                                            </span>

                                                            Editar
                                                        </button>

                                                        <button
                                                            className="admin-action-button admin-action-button--delete"
                                                            type="button"
                                                            onClick={() => (
                                                                handleDeleteGuest(
                                                                    guestItem
                                                                )
                                                            )}
                                                        >
                                                            <span aria-hidden="true">
                                                                ×
                                                            </span>

                                                            Excluir
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {communicationModalOpen ? (
                        <Suspense fallback={null}>
                            <AdminCommunicationModal
                                guests={data.guests || []}
                                baseUrl={baseUrl}
                                invitationConfig={
                                    data.invitationConfig
                                    || DEFAULT_INVITATION_CONFIG
                                }
                                onClose={() => (
                                    setCommunicationModalOpen(false)
                                )}
                                onMarkSent={handleMarkCommunication}
                            />
                        </Suspense>
                    ) : null}

                    <section
                        className="confirm-panel admin-messages-panel"
                        aria-labelledby="message-list-title"
                        hidden={activeAdminSection !== 'comunicacao'}
                    >
                        <div className="admin-messages-heading">
                            <div>
                                <p className="panel-kicker">
                                    Carinho para guardar
                                </p>

                                <h2 id="message-list-title">
                                    Mensagens para a Duda
                                </h2>

                                <p className="admin-messages-subtitle">
                                    {data.messages?.length || 0}
                                    {' '}
                                    {(data.messages?.length || 0) === 1
                                        ? 'mensagem recebida'
                                        : 'mensagens recebidas'}
                                </p>
                            </div>

                            <span
                                className="admin-message-count"
                                aria-label={`${data.messages?.length || 0} mensagens`}
                            >
                                💌
                                {' '}
                                {data.messages?.length || 0}
                            </span>
                        </div>

                        <div className="admin-messages-toolbar">
                            <label className="admin-message-search">
                                <span>Buscar mensagem</span>

                                <input
                                    type="search"
                                    value={messageSearch}
                                    onChange={(event) => (
                                        setMessageSearch(
                                            event.target.value
                                        )
                                    )}
                                    placeholder="Nome ou texto da mensagem"
                                />
                            </label>

                            <button
                                className="admin-export-messages"
                                type="button"
                                onClick={handleExportMessages}
                                disabled={
                                    filteredMessages.length === 0
                                }
                            >
                                Exportar CSV
                            </button>
                        </div>

                        {messageSearch ? (
                            <p className="admin-message-filter-result">
                                {filteredMessages.length}
                                {' '}
                                {filteredMessages.length === 1
                                    ? 'resultado encontrado'
                                    : 'resultados encontrados'}
                            </p>
                        ) : null}

                        <div className="admin-message-list">
                            {filteredMessages.length === 0 ? (
                                <div className="admin-message-empty">
                                    <span aria-hidden="true">
                                        💌
                                    </span>

                                    <strong>
                                        {data.messages?.length
                                            ? 'Nenhuma mensagem encontrada'
                                            : 'Nenhuma mensagem ainda'}
                                    </strong>

                                    <p>
                                        {data.messages?.length
                                            ? 'Tente buscar por outro nome ou trecho.'
                                            : 'As mensagens enviadas pelos convidados aparecerão aqui.'}
                                    </p>
                                </div>
                            ) : (
                                filteredMessages.map((item) => (
                                    <article
                                        className="admin-message-card"
                                        key={item.id}
                                    >
                                        <div className="admin-message-card__top">
                                            <div>
                                                <span className="admin-message-card__label">
                                                    Enviado por
                                                </span>

                                                <strong>
                                                    {item.name}
                                                </strong>
                                            </div>

                                            <time>
                                                {formatAdminAccessDate(
                                                    item.createdAt
                                                )}
                                            </time>
                                        </div>

                                        <p>
                                            {item.message}
                                        </p>

                                        <div className="admin-message-card__footer">
                                            {item.invitedGuestId ? (
                                                <small>
                                                    ✓ Vinculada ao convite
                                                </small>
                                            ) : (
                                                <small>
                                                    Mensagem antiga
                                                </small>
                                            )}

                                            <button
                                                type="button"
                                                className="admin-message-delete"
                                                onClick={() => (
                                                    handleDeleteMessage(
                                                        item
                                                    )
                                                )}
                                            >
                                                Excluir
                                            </button>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                </>
            ) : null}
        </main>
    )
}

function OpeningInvitationGate({
    onUnlocked,
    onMusicStart,
    invitationConfig =
        DEFAULT_INVITATION_CONFIG,
}) {
    const invitationCode = useMemo(() => getInvitationCode(), [])
    const inputRef = useRef(null)
    const openingTimerRef = useRef(null)
    const [stage, setStage] = useState('intro')
    const [whatsappValue, setWhatsappValue] = useState('')
    const [message, setMessage] = useState('')
    const [validatedData, setValidatedData] = useState(null)
    const [sealBroken, setSealBroken] = useState(false)

    useEffect(() => {
        return () => {
            if (openingTimerRef.current) {
                window.clearTimeout(
                    openingTimerRef.current,
                )
            }
        }
    }, [])

    function startOpening() {
        if (stage !== 'intro') return

        /*
         * A musica e iniciada exatamente no gesto que rompe o selo.
         */
        window.__dudaMusicPlay?.()
        onMusicStart?.()

        setStage('opening')

        /*
         * O PNG rompido passa a ser controlado pelo React.
         * Assim nao dependemos do navegador mobile executar
         * corretamente a troca de opacidade entre duas animacoes CSS.
         */
        window.setTimeout(
            () => setSealBroken(true),
            180,
        )

        /*
         * Mantemos tempo suficiente para a pessoa enxergar
         * o selo realmente rompido antes de abrir o envelope.
         *
         * Nao encurtamos mais para 120ms no celular.
         */
        openingTimerRef.current = window.setTimeout(
            () => {
                setStage('card-visible')

                window.setTimeout(
                    () => inputRef.current?.focus(),
                    120,
                )
            },
            4200,
        )
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setMessage('')

        try {
            if (digitsOnly(whatsappValue).length < 10) {
                throw new Error('Digite um WhatsApp válido com DDD.')
            }

            setStage('checking')
            const data = await fetchGuestInvitation({
                whatsapp: whatsappValue,
                invitationCode,
            })

            const openingData = {
                guest: data.guest,
                whatsapp: whatsappValue,
                alreadyConfirmed: Boolean(data.alreadyConfirmed),
                rsvp: data.rsvp || null,
            }

            saveOpeningSession(openingData)
            setValidatedData(openingData)
            setStage('unlocked')
        } catch (error) {
            setStage('error')
            setMessage(error.message)
        }
    }

    function enterInvitation() {
        if (!validatedData) return
        onMusicStart?.()
        setStage('completed')
        window.setTimeout(() => onUnlocked(validatedData), 650)
    }

    const isChecking = stage === 'checking'
    const isUnlocked = stage === 'unlocked'
    const isCompleted = stage === 'completed'
    const isAccessReady = (
        stage !== 'intro'
        && stage !== 'opening'
    )

    return (
        <main className={`opening-gate opening-gate--${stage}`} aria-label="Abertura do convite da Duda">
            <div className="opening-gate__sparkles" aria-hidden="true" />
            <img className="opening-gate__disco opening-gate__disco--left" src="/media/disco-ball.webp" alt="" aria-hidden="true" />
            <img className="opening-gate__disco opening-gate__disco--right" src="/media/disco-ball.webp" alt="" aria-hidden="true" />

            <section className="opening-gate__brand" aria-hidden="true">
                <p>Sweet birthday</p>
                <img className="opening-gate__balloon" src="/media/balloon-16.webp" alt="" />
                <span>
                    {
                        invitationConfig
                            .settings
                            .celebrantName
                    }
                </span>
                <small>
                    {
                        invitationConfig
                            .settings
                            .openingTagline
                    }
                </small>
            </section>

            <div className="envelope-stage">
                <div className="letter-sheet">
                    <div className="letter-sheet__folds" aria-hidden="true">
                        <span className="letter-sheet__panel letter-sheet__panel--top" />
                        <span className="letter-sheet__panel letter-sheet__panel--middle" />
                        <span className="letter-sheet__panel letter-sheet__panel--bottom" />
                    </div>

                    <form className="access-card" onSubmit={handleSubmit} aria-live="polite">
                    <p className="panel-kicker">{isRsvpClosed(
                        invitationConfig
                            .rsvp.deadline,
                    )
                        ? 'Prazo de confirmação encerrado'
                        : `Confirme sua presença até ${
                            invitationConfig
                                .rsvp
                                .deadlineDisplay
                        }`}</p>
                    <h1>Abra seu convite</h1>
                    <p>Digite o celular para localizar seu convite individual.</p>
                    <label>
                        <span>Celular</span>
                        <input
                            ref={inputRef}
                            name="openingWhatsapp"
                            type="tel"
                            inputMode="numeric"
                            placeholder="(11) _____-____"
                            value={whatsappValue}
                            onChange={(event) => setWhatsappValue(formatWhatsapp(event.target.value))}
                            autoComplete="tel"
                            maxLength="15"
                            disabled={!isAccessReady || isChecking || isUnlocked || isCompleted}
                            required
                        />
                    </label>
                    <button
                        type={isUnlocked ? 'button' : 'submit'}
                        onClick={isUnlocked ? enterInvitation : undefined}
                        disabled={!isAccessReady || isChecking || isCompleted}
                    >
                        {isChecking ? 'Consultando...' : isUnlocked ? 'Convite liberado' : 'Abrir meu convite'}
                    </button>
                    <small>{isUnlocked
                        ? 'Toque para entrar no convite completo.'
                        : 'Privacidade: o número será usado somente para localizar e confirmar este convite.'}</small>
                    {message ? <p className="form-message form-message--error">{message}</p> : null}
                    </form>
                </div>

                <div className="envelope">
                    <div className="envelope__back" />
                    <div className="envelope__letter-shadow" />
                    <div className="envelope__flap" />
                    <div className="envelope__pocket envelope__pocket--left" />
                    <div className="envelope__pocket envelope__pocket--right" />
                    <div className="envelope__front" />
                    <button
                        className="envelope__seal envelope__seal-trigger"
                        type="button"
                        onClick={startOpening}
                        disabled={stage !== 'intro'}
                        aria-label="Romper o selo e abrir o convite"
                    >
                        <img
                            className={`envelope__seal-img envelope__seal-img--intact${sealBroken ? ' envelope__seal-img--hidden-by-state' : ''}`}
                            src="/media/selo.webp"
                            alt=""
                        />

                        <img
                            className={`envelope__seal-img envelope__seal-img--broken${sealBroken ? ' envelope__seal-img--visible-by-state' : ''}`}
                            src="/media/selo-rompido.webp"
                            alt=""
                        />

                        <span
                            className="envelope__seal-hint"
                            aria-hidden="true"
                        >
                            <strong>TOQUE NO SELO</strong>
                            <small>para abrir seu convite</small>
                            <b>↓</b>
                        </span>
                    </button>
                    <span>Feito especialmente para voce</span>
                </div>
            </div>

            <p
                className="opening-gate__footer"
                aria-live="polite"
            >
                {stage === 'intro'
                    ? 'Toque no selo para abrir seu convite'
                    : stage === 'opening'
                        ? 'Abrindo seu convite...'
                        : 'O acesso ao convite está liberado'}
            </p>
        </main>
    )
}

function LandingPage() {
    const [openingData, setOpeningData] = useState(() => readOpeningSession())
    const [musicStarted, setMusicStarted] = useState(false)
    const [
        invitationConfig,
        setInvitationConfig,
    ] = useState(
        DEFAULT_INVITATION_CONFIG,
    )
    const activeGuest = openingData?.guest || null
    const activeEvent =
        invitationConfig.event

    const activeSettings =
        invitationConfig.settings

    const calendarPlatform = useMemo(
        () => getCalendarPlatform(),
        [],
    )

    useEffect(() => {
        let cancelled = false

        fetch('/api/invitation-config')
            .then(readApiJson)
            .then((config) => {
                if (!cancelled) {
                    setInvitationConfig(
                        buildInvitationConfig(
                            config,
                        ),
                    )
                }
            })
            .catch(() => {
                /*
                 * O convite mantém os padrões embarcados quando a
                 * configuração remota ainda não estiver disponível.
                 */
            })

        return () => {
            cancelled = true
        }
    }, [])

    function handleUnlocked(data) {
        setOpeningData(data)
    }

    function handleGuestResolved(guest) {
        setOpeningData((current) => {
            if (!current) return current

            const next = { ...current, guest }
            saveOpeningSession(next)
            return next
        })
    }

    function handleRsvpSaved(rsvp) {
        setOpeningData((current) => {
            if (!current) return current

            const next = {
                ...current,
                alreadyConfirmed: true,
                rsvp,
            }

            saveOpeningSession(next)

            return next
        })
    }

    if (!openingData) {
        return (
            <>
                <OpeningInvitationGate
                    onUnlocked={handleUnlocked}
                    onMusicStart={() => setMusicStarted(true)}
                    invitationConfig={invitationConfig}
                />

                <MusicPlayer
                    enabled={musicStarted}
                    videoId={
                        activeSettings
                            .youtubeVideoId
                    }
                />
            </>
        )
    }

    return (
        <>
            <main className="page-shell page-shell--revealed">
                <section className="invite-card" aria-labelledby="invite-title">
                    <header className="invitation-hero">
                        <InvitationPhotoCarousel
                            photos={
                                invitationConfig
                                    .photos
                            }
                        />

                        <div className="invitation-hero__veil" aria-hidden="true" />

                        <div className="invitation-hero__copy">
                            <p className="eyebrow">
                                Save the date
                            </p>
                            <h1 id="invite-title">
                                <span className="hero-age">
                                    {activeSettings.age}
                                </span>
                                <span className="name-script">
                                    {
                                        activeSettings
                                            .celebrantName
                                    }
                                </span>
                            </h1>
                            <p className="tagline">
                                {activeSettings.tagline}
                            </p>
                            <p className="hero-date">
                                <span>
                                    {
                                        activeEvent
                                            .dateCompactDisplay
                                    }
                                </span>
                                <span aria-hidden="true">—</span>
                                <span>
                                    {activeEvent.timeDisplay}
                                </span>
                            </p>
                        </div>
                    </header>

                    <div className="invitation-welcome">
                        <p className="invitation-welcome__kicker">
                            Este convite é para você
                        </p>
                        <p>
                            <strong>{activeGuest.name}</strong>, quero
                            você por perto para transformar esse dia
                            em uma lembrança linda.
                        </p>
                    </div>

                    <div className="invitation-countdown">
                        <p>Falta pouco para a festa</p>
                        <Countdown
                            startsAt={activeEvent.startsAt}
                        />
                    </div>

                    <InvitationQuickActions />

                    <section
                        id="local-evento"
                        className="invitation-section event-section"
                        aria-labelledby="event-title"
                        data-calendar-platform={calendarPlatform}
                    >
                        <div className="section-heading">
                            <span className="section-heading__icon">
                                <InviteIcon name="pin" />
                            </span>
                            <div>
                                <p className="panel-kicker">Onde e quando</p>
                                <h2 id="event-title">Nosso encontro</h2>
                            </div>
                        </div>

                        <div
                            className="event-details"
                            aria-label="Informações do aniversário"
                        >
                            <div>
                                <span>Data</span>
                                <strong>
                                    {activeEvent.dateDisplay}
                                </strong>
                            </div>
                            <div>
                                <span>Horário</span>
                                <strong>
                                    {activeEvent.timeDisplay}
                                </strong>
                            </div>
                        </div>

                        <div className="venue-card">
                            <img src="/quintal-ibiza-logo.jpg" alt="Logo oficial do Quintal do Ibiza" />
                            <div>
                                <span>Local da festa</span>
                                <strong>
                                    {activeSettings.venue}
                                </strong>
                                <a href={activeSettings.venueInstagramUrl} target="_blank" rel="noreferrer">
                                    {
                                        activeSettings
                                            .venueInstagramHandle
                                    }
                                </a>
                            </div>
                        </div>

                        <p className="address">
                            {activeSettings.address}
                        </p>

                        <div
                            className="event-action-grid"
                            aria-label="Como chegar e salvar o evento"
                        >
                            <a
                                className="event-action-button"
                                href={activeEvent.mapUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <InviteIcon name="map" />
                                <span>Google Maps</span>
                            </a>

                            <a
                                className="event-action-button"
                                href={activeEvent.wazeUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <InviteIcon name="navigation" />
                                <span>Waze</span>
                            </a>

                            <a
                                className={`event-action-button event-action-button--calendar event-action-button--calendar-${calendarPlatform}`}
                                href={calendarPlatform === 'ios'
                                    ? '/api/calendar?platform=ios'
                                    : activeEvent.googleCalendarUrl}
                                target={calendarPlatform === 'ios'
                                    ? undefined
                                    : '_blank'}
                                rel={calendarPlatform === 'ios'
                                    ? undefined
                                    : 'noreferrer'}
                            >
                                <InviteIcon name="calendar" />
                                <span className="event-action-button__copy">
                                    <strong>
                                        {calendarPlatform === 'ios'
                                            ? 'Agenda do iPhone'
                                            : 'Google Agenda'}
                                    </strong>
                                    <small>
                                        {calendarPlatform === 'ios'
                                            ? 'Continuar → Adicionar'
                                            : calendarPlatform === 'android'
                                                ? 'Abrir no Android'
                                                : 'Adicionar o evento'}
                                    </small>
                                </span>
                            </a>
                        </div>

                        {calendarPlatform === 'ios' ? (
                            <p className="event-calendar-ios-help">
                                No iPhone, toque em <strong>Continuar</strong> e
                                depois em <strong>Adicionar</strong>.
                            </p>
                        ) : null}
                    </section>

                    <section className="invitation-section style-section" aria-labelledby="style-title">
                        <div>
                            <p className="panel-kicker">Para entrar no clima</p>
                            <h2 id="style-title">Dress code</h2>
                            <p>Vista-se para uma tarde especial.</p>
                        </div>
                        <div className="dress-code">
                            <strong>Apenas um pedido</strong>
                            <span>
                                {activeSettings.dressCode}
                            </span>
                        </div>
                    </section>

                    <a
                        className="duda-instagram-card"
                        href={activeSettings.dudaInstagramUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <span>D</span>
                        <div>
                            <small>Acompanhe a Duda</small>
                            <strong>
                                {
                                    activeSettings
                                        .dudaInstagramHandle
                                }
                            </strong>
                        </div>
                        <span className="instagram-arrow" aria-hidden="true">↗</span>
                    </a>
                </section>

                <div className="side-stack">
                    <section
                        id="confirmar-presenca"
                        className="confirm-panel rsvp-panel"
                        aria-labelledby="confirm-title"
                    >
                        <div className="section-heading">
                            <span className="section-heading__icon">
                                <InviteIcon name="check" />
                            </span>
                            <div>
                                <p className="panel-kicker">{isRsvpClosed(
                                    invitationConfig
                                        .rsvp.deadline,
                                )
                                    ? 'Prazo de confirmação encerrado'
                                    : `Confirme até ${
                                        invitationConfig
                                            .rsvp
                                            .deadlineDisplay
                                    }`}</p>
                                <h2 id="confirm-title">Você vem, {activeGuest.name}?</h2>
                            </div>
                        </div>
                        <p className="panel-intro">
                            Confira os nomes deste convite e conte
                            para a Duda quem estará na festa.
                        </p>
                        <RsvpForm
                            initialGuest={activeGuest}
                            initialWhatsapp={openingData.whatsapp}
                            initialAlreadyConfirmed={openingData.alreadyConfirmed}
                            initialRsvp={openingData.rsvp}
                            onGuestResolved={handleGuestResolved}
                            onRsvpSaved={handleRsvpSaved}
                            rsvpDeadline={
                                invitationConfig
                                    .rsvp.deadline
                            }
                            rsvpDeadlineDisplay={
                                invitationConfig
                                    .rsvp
                                    .deadlineDisplay
                            }
                            event={activeEvent}
                        />
                    </section>

                    <GiftPanel
                        settings={activeSettings}
                    />

                    <section
                        id="mensagem-duda"
                        className="confirm-panel message-panel"
                        aria-labelledby="message-title"
                    >
                        <div className="section-heading">
                            <span className="section-heading__icon">
                                <InviteIcon name="heart" />
                            </span>
                            <div>
                                <p className="panel-kicker">Carinho para guardar</p>
                                <h2 id="message-title">Uma mensagem para a Duda</h2>
                            </div>
                        </div>
                        <p className="panel-intro">
                            Escreva algumas palavras para ela receber
                            junto com as confirmações.
                        </p>
                        <BirthdayMessageForm
                            guest={activeGuest}
                            invitationCode={getInvitationCode()}
                        />
                    </section>

                    <footer className="invitation-footer">
                        <span>D</span>
                        <p>Com carinho, Duda</p>
                        <small>
                            {
                                activeEvent
                                    .dateCompactDisplay
                            }
                        </small>
                    </footer>
                </div>
            </main>

            <MusicPlayer
                enabled={musicStarted}
                videoId={
                    activeSettings
                        .youtubeVideoId
                }
            />
        </>
    )
}

function App() {
    const pathname =
        typeof window === 'undefined'
            ? ''
            : window.location.pathname
                .replace(/\/$/, '')

    if (pathname === '/admin') {
        return <AdminPage />
    }

    if (pathname === '/despesas') {
        return (
            <Suspense
                fallback={(
                    <main className="route-loading" role="status">
                        Carregando painel financeiro...
                    </main>
                )}
            >
                <ExpensesPage />
            </Suspense>
        )
    }

    return <LandingPage />
}

export default App
