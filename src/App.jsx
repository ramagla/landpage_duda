import { useEffect, useMemo, useRef, useState } from 'react'
import {
    RSVP_CLOSED_MESSAGE,
    RSVP_DEADLINE_DISPLAY,
    isRsvpClosedAt,
} from '../shared/rsvp-deadline.js'

const EVENT_DATE_ISO = '2026-11-14T17:00:00-03:00'
const EVENT_ADDRESS = 'Rua Corumbataí, 100 - Vila Virgínia, Itaquaquecetuba - SP'
const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EVENT_ADDRESS)}`
const WAZE_URL = `https://waze.com/ul?q=${encodeURIComponent(EVENT_ADDRESS)}&navigate=yes`
const INSTAGRAM_URL = 'https://www.instagram.com/quintaldoibizaoficial/'
const DUDA_INSTAGRAM_URL = 'https://www.instagram.com/mariizsq_/'
const YOUTUBE_VIDEO_ID = '_zR6ROjoOX0'
const PIX_KEY = '56765986898'
const PIX_NAME = 'Maria Eduarda Almeida Araujo'
const PIX_COPY_PASTE = '00020101021226330014br.gov.bcb.pix0111567659868985204000053039865802BR5921MARIA EDUARDA ALMEIDA6015ITAQUAQUECETUBA62100506DUDA166304E334'

const GOOGLE_CALENDAR_URL = (
    'https://calendar.google.com/calendar/render'
    + '?action=TEMPLATE'
    + `&text=${encodeURIComponent('16 anos da Duda')}`
    + '&dates=20261114T200000Z/20261115T020000Z'
    + `&details=${encodeURIComponent('Aniversário de 16 anos da Duda no Quintal do Ibiza.')}`
    + `&location=${encodeURIComponent(EVENT_ADDRESS)}`
    + '&ctz=America%2FSao_Paulo'
)

function openCalendarEvent() {
    if (typeof window === 'undefined') return

    window.open(
        GOOGLE_CALENDAR_URL,
        '_blank',
        'noopener,noreferrer',
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

function isRsvpClosed() {
    return isRsvpClosedAt(getRsvpNow())
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
                ✓ Confirmar / alterar presença
            </button>

            <div className="hero-quick-actions__grid">
                <button
                    className="hero-quick-actions__secondary"
                    type="button"
                    onClick={() => scrollToSection('local-evento')}
                >
                    <span aria-hidden="true">⌖</span>
                    <span>Local</span>
                </button>

                <button
                    className="hero-quick-actions__secondary"
                    type="button"
                    onClick={() => scrollToSection('presentes')}
                >
                    <span aria-hidden="true">🎁</span>
                    <span>Presente</span>
                </button>

                <button
                    className="hero-quick-actions__secondary"
                    type="button"
                    onClick={() => scrollToSection('mensagem-duda')}
                >
                    <span aria-hidden="true">♡</span>
                    <span>Mensagem</span>
                </button>
            </div>

            <button
                className="hero-scroll-hint"
                type="button"
                onClick={() => scrollToSection('confirmar-presenca')}
            >
                <span>Explore o convite</span>
                <strong aria-hidden="true">⌄</strong>
            </button>
        </section>
    )
}

function Countdown() {
    const targetDate = useMemo(() => new Date(EVENT_DATE_ISO), [])
    const [time, setTime] = useState(() => formatCountdown(targetDate))

    useEffect(() => {
        const timer = window.setInterval(() => setTime(formatCountdown(targetDate)), 1000)
        return () => window.clearInterval(timer)
    }, [targetDate])

    return (
        <section className="countdown" aria-label="Contagem regressiva para o aniversario">
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


function MusicPlayer({ enabled }) {
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
        if (!enabled) return

        sendCommand('playVideo')
        setPlaying(true)
    }

    return (
        <div className="music-player">
            <iframe
                ref={iframeRef}
                className="music-player__frame"
                title="Música do convite da Duda"
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=${enabled ? 1 : 0}&loop=1&playlist=${YOUTUBE_VIDEO_ID}&controls=0&playsinline=1&enablejsapi=1&rel=0`}
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
    const rsvpClosed = isRsvpClosed()
    const formLocked = rsvpClosed

    function resetGuest() {
        setGuest(null)
        setCompanions([])
        setAlreadyConfirmed(false)
        setAttending('sim')
        setSubmitStatus('idle')
        onGuestCleared?.()
    }

    function handlePhoneChange(value) {
        setWhatsappValue(formatWhatsapp(value))
        resetGuest()
    }

    function updateCompanion(id, field, value) {
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
            setAttending(
                data.rsvp?.attending === 'nao'
                    ? 'nao'
                    : 'sim'
            )
            setLookupStatus('success')
            setMessage(
                data.alreadyConfirmed
                    ? 'Sua resposta foi encontrada. Você pode alterá-la até 14/10/2026.'
                    : `Convite encontrado para ${data.guest.name}.`
            )
        } catch (error) {
            setLookupStatus('error')
            setMessage(error.message)
        }
    }

    function handleAttendingChange(value) {
        setAttending(value)
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
            if (rsvpClosed) throw new Error(RSVP_CLOSED_MESSAGE)
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
                        <small>{guest.maxCompanions === 0 ? 'Sem acompanhantes.' : `Ate ${guest.maxCompanions} acompanhante${guest.maxCompanions === 1 ? '' : 's'} neste convite.`}</small>
                    </div>

                    {rsvpClosed ? (
                        <div className="deadline-closed" role="status">
                            <strong>Prazo de confirmação encerrado</strong>
                            <span>{RSVP_CLOSED_MESSAGE}</span>
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

            {message ? <p className={`form-message form-message--${lookupStatus === 'error' || submitStatus === 'error' ? 'error' : 'success'}`}>{message}</p> : null}
        </div>
    )
}


function GiftPanel() {
    const [copyStatus, setCopyStatus] = useState('')

    async function handleCopyPixKey() {
        try {
            await copyTextToClipboard(PIX_KEY)
            setCopyStatus('✓ Chave Pix copiada.')
        } catch (error) {
            setCopyStatus(error.message)
        }
    }

    async function handleCopyPixCode() {
        try {
            await copyTextToClipboard(
                PIX_COPY_PASTE
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
                Sugestões: perfume, acessórios femininos,
                cremes e maquiagem. Quem preferir também pode
                enviar um Pix para a Duda escolher algo especial.
            </p>

            <div className="pix-card">
                <img
                    src="/pix-duda.svg"
                    alt="QR Code Pix para presente da Duda"
                />

                <div>
                    <span>Chave Pix</span>

                    <strong>{PIX_KEY}</strong>

                    <small>
                        Antes de fazer o Pix, confirme se o nome
                        aparece como <b>{PIX_NAME}</b>.
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
    const [lastUpdatedAt, setLastUpdatedAt] = useState('')
    const [refreshing, setRefreshing] = useState(false)
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
        const form = new FormData(event.currentTarget)

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
            event.currentTarget.reset()
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

        if (!matchesStatus) {
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

    function handleExportGuests() {
        if (filteredGuests.length === 0) {
            setStatus('error')

            setMessage(
                'Não existem convidados para exportar com o filtro atual.'
            )

            return
        }

        const escapeCsv = (value) => (
            `"${String(value ?? '').replaceAll('"', '""')}"`
        )

        function formatCompanionForCsv(
            companion,
            answered,
        ) {
            const name = String(
                companion?.name || ''
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

        const rows = [
            [
                'Nome',
                'Idade',
                'Status',
                'Motivo da ausência',
                'WhatsApp',
                'Acompanhantes confirmados',
                'Acompanhantes liberados',
                'Buffet',
                'Primeiro acesso',
                'Último acesso',
                'Quantidade de acessos',
                'Primeira resposta',
                'Detalhes dos acompanhantes',
                'Link do convite',
            ],

            ...filteredGuests.map((guestItem) => {
                const answeredCompanions = (
                    guestItem.companions
                    || []
                )

                const companionDetails = (
                    answeredCompanions.length > 0
                        ? answeredCompanions
                            .map((item) => (
                                formatCompanionForCsv(
                                    item,
                                    true,
                                )
                            ))
                        : (
                            guestItem.presetCompanions
                            || []
                        ).map((item) => (
                            formatCompanionForCsv(
                                item,
                                false,
                            )
                        ))
                ).join(' | ')

                return [
                    guestItem.name,
                    guestItem.age,
                    getGuestStatusLabel(
                        guestItem.status,
                    ),
                    guestItem.declineReason || '',
                    formatWhatsapp(
                        guestItem.whatsapp,
                    ),
                    guestItem.companionsCount,
                    guestItem.maxCompanions,
                    guestItem.buffetCount,
                    formatAdminAccessDate(
                        guestItem.firstAccessAt,
                    ),
                    formatAdminAccessDate(
                        guestItem.lastAccessAt,
                    ),
                    guestItem.accessCount || 0,
                    formatAdminAccessDate(
                        guestItem.confirmedAt,
                    ),
                    companionDetails,
                    getGuestInviteUrl(
                        guestItem,
                    ),
                ]
            }),
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
        link.download = 'convidados-duda.csv'

        document.body.appendChild(
            link,
        )

        link.click()
        link.remove()

        URL.revokeObjectURL(
            url,
        )

        setStatus('success')

        setMessage(
            `${filteredGuests.length} convidado${filteredGuests.length === 1 ? '' : 's'} exportado${filteredGuests.length === 1 ? '' : 's'}.`
        )
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

                    <section className="admin-summary" aria-label="Resumo das confirmacoes">
                        <div><span>Convidados</span><strong>{data.totals.invited}</strong></div>
                        <div><span>Confirmados</span><strong>{data.totals.confirmed}</strong></div>
                        <div><span>Nao vao</span><strong>{data.totals.declined}</strong></div>
                        <div><span>Pendentes</span><strong>{data.totals.pending}</strong></div>
                        <div className="admin-summary__viewed">
                            <span>Acessaram sem responder</span>
                            <strong>{data.totals.viewed || 0}</strong>
                        </div>
                        <div><span>Buffet</span><strong>{data.totals.buffet}</strong></div>
                        <div>
                            <span>Mensagens</span>
                            <strong>{data.messages?.length || 0}</strong>
                        </div>
                    </section>

                    <section
                        id="cadastro-convidado"
                        className="confirm-panel admin-form-panel"
                        aria-labelledby="guest-form-title"
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
                                <input name="age" defaultValue={editing?.age || ''} type="number" min="0" max="120" placeholder="Idade" required />
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

                            <button
                                className="admin-export-guests"
                                type="button"
                                onClick={handleExportGuests}
                                disabled={
                                    filteredGuests.length === 0
                                }
                            >
                                Exportar CSV
                            </button>
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
                            convidados
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
                                                ? 'Enviar convite no WhatsApp'
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
                                        <th>Convite</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredGuests.length === 0 ? (
                                        <tr>
                                            <td
                                                className="admin-guests-empty"
                                                colSpan="7"
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

                                                            WhatsApp
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

                    <section
                        className="confirm-panel admin-messages-panel"
                        aria-labelledby="message-list-title"
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

function OpeningInvitationGate({ onUnlocked, onMusicStart }) {
    const invitationCode = useMemo(() => getInvitationCode(), [])
    const inputRef = useRef(null)
    const openingTimerRef = useRef(null)
    const [stage, setStage] = useState('intro')
    const [whatsappValue, setWhatsappValue] = useState('')
    const [message, setMessage] = useState('')
    const [validatedData, setValidatedData] = useState(null)

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
         * Inicia a musica no MESMO toque que rompe o selo.
         * Isso preserva a permissao de audio do navegador mobile.
         */
        window.__dudaMusicPlay?.()
        onMusicStart?.()

        setStage('opening')

        const reducedMotion = window
            .matchMedia?.('(prefers-reduced-motion: reduce)')
            .matches

        const revealDelay = reducedMotion
            ? 120
            : 4200

        openingTimerRef.current = window.setTimeout(
            () => {
                setStage('card-visible')

                window.setTimeout(
                    () => inputRef.current?.focus(),
                    reducedMotion ? 0 : 120,
                )
            },
            revealDelay,
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
            <img className="opening-gate__disco opening-gate__disco--left" src="/disco-ball.jpg" alt="" aria-hidden="true" />
            <img className="opening-gate__disco opening-gate__disco--right" src="/disco-ball.jpg" alt="" aria-hidden="true" />

            <section className="opening-gate__brand" aria-hidden="true">
                <p>Sweet birthday</p>
                <img className="opening-gate__balloon" src="/balloon-16-transparent.png" alt="" />
                <span>Duda</span>
                <small>Uma tarde para brilhar, dançar e guardar na memória.</small>
            </section>

            <div className="envelope-stage">
                <div className="letter-sheet">
                    <div className="letter-sheet__folds" aria-hidden="true">
                        <span className="letter-sheet__panel letter-sheet__panel--top" />
                        <span className="letter-sheet__panel letter-sheet__panel--middle" />
                        <span className="letter-sheet__panel letter-sheet__panel--bottom" />
                    </div>

                    <form className="access-card" onSubmit={handleSubmit} aria-live="polite">
                    <p className="panel-kicker">{isRsvpClosed()
                        ? 'Prazo de confirmação encerrado'
                        : `Confirme sua presença até ${RSVP_DEADLINE_DISPLAY}`}</p>
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
                    <small>{isUnlocked ? 'Toque para entrar no convite completo.' : 'O número será usado somente para localizar e confirmar este convite.'}</small>
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
                            className="envelope__seal-img envelope__seal-img--intact"
                            src="/selo.png"
                            alt=""
                        />
                        <img
                            className="envelope__seal-img envelope__seal-img--broken"
                            src="/selo-rompido.png"
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
    const activeGuest = openingData?.guest || null

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
                />

                <MusicPlayer enabled={musicStarted} />
            </>
        )
    }

    return (
        <>
            <main className="page-shell page-shell--revealed">
            <section className="invite-card" aria-labelledby="invite-title">
                <div className="disco-cluster" aria-hidden="true">
                    <img className="disco-image disco-image--small" src="/disco-ball.jpg" alt="" />
                    <img className="disco-image disco-image--medium" src="/disco-ball.jpg" alt="" />
                    <img className="disco-image disco-image--small" src="/disco-ball.jpg" alt="" />
                </div>
                <img className="disco-image disco-image--hero" src="/disco-ball.jpg" alt="" aria-hidden="true" />
                <div className="sparkle sparkle--one" aria-hidden="true" />
                <div className="sparkle sparkle--two" aria-hidden="true" />

                <div className="hero-copy">
                    <p className="eyebrow">Sweet birthday</p>
                    <h1 id="invite-title">
                        <img className="balloon-age" src="/balloon-16-transparent.png" alt="16 anos" />
                        <span className="name-script">Duda</span>
                    </h1>
                    <p className="tagline">Uma tarde para brilhar, dançar e guardar na memória.</p>
                </div>

                <Countdown />
                    <InvitationQuickActions />

                <div
                    id="local-evento"
                    className="event-details"
                    aria-label="Informações do aniversário"
                >
                    <p>14 de novembro de 2026</p>
                    <p>17h</p>

                    <a
                        href={MAP_URL}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Quintal do Ibiza
                    </a>
                </div>

                <p className="address">
                    {EVENT_ADDRESS}
                </p>

                <div
                    className="event-action-grid"
                    aria-label="Como chegar e salvar o evento"
                >
                    <a
                        className="event-action-button"
                        href={MAP_URL}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <span aria-hidden="true">⌖</span>
                        Google Maps
                    </a>

                    <a
                        className="event-action-button"
                        href={WAZE_URL}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <span aria-hidden="true">➤</span>
                        Waze
                    </a>

                    <button
                        className="event-action-button"
                        type="button"
                        onClick={openCalendarEvent}
                    >
                        <span aria-hidden="true">＋</span>
                        Adicionar à agenda
                    </button>
                </div>

                <div className="venue-card">
                    <img src="/quintal-ibiza-logo.svg" alt="Logo Quintal do Ibiza" />
                    <div>
                        <strong>Quintal do Ibiza</strong>
                        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@quintaldoibizaoficial</a>
                    </div>
                </div>

                <div className="photo-frame">
                    <img src="/duda-photo.png" alt="Foto da Duda" />
                </div>

                <p className="invite-text">{activeGuest.name}, a Duda quer você por perto para transformar esse dia em uma lembranca linda.</p>

                <div className="duda-instagram-card">
                    <span>D</span>
                    <div>
                        <strong>Duda no Instagram</strong>
                        <a href={DUDA_INSTAGRAM_URL} target="_blank" rel="noreferrer">@mariizsq_</a>
                    </div>
                </div>

                <div className="dress-code"><strong>Dress code</strong><span>Não vir de verde nem azul.</span></div>
            </section>

            <div className="side-stack">
                <section id="confirmar-presenca" className="confirm-panel" aria-labelledby="confirm-title">
                    <p className="panel-kicker">{isRsvpClosed()
                        ? 'Prazo de confirmação encerrado'
                        : `Confirme sua presença até ${RSVP_DEADLINE_DISPLAY}`}</p>
                    <h2 id="confirm-title">Oi, {activeGuest.name}</h2>
                    <p>Confira os nomes liberados e confirme a presença deste convite.</p>
                    <RsvpForm
                        initialGuest={activeGuest}
                        initialWhatsapp={openingData.whatsapp}
                        initialAlreadyConfirmed={openingData.alreadyConfirmed}
                        initialRsvp={openingData.rsvp}
                        onGuestResolved={handleGuestResolved}
                        onRsvpSaved={handleRsvpSaved}
                    />
                </section>

                <GiftPanel />

                <section id="mensagem-duda" className="confirm-panel message-panel" aria-labelledby="message-title">
                    <p className="panel-kicker">Carinho para guardar</p>
                    <h2 id="message-title">Deixe sua mensagem</h2>
                    <p>Escreva uma mensagem de parabéns para a Duda receber junto com as confirmações.</p>
                    <BirthdayMessageForm
                        guest={activeGuest}
                        invitationCode={getInvitationCode()}
                    />
                </section>
            </div>
            </main>

            <MusicPlayer enabled={musicStarted} />
        </>
    )
}

function App() {
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin'
    return isAdmin ? <AdminPage /> : <LandingPage />
}

export default App
