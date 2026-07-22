import { useEffect, useMemo, useState } from 'react'

const EVENT_DATE_ISO = '2026-11-14T17:00:00-03:00'
const RSVP_DEADLINE = '14/10/2026'
const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=Rua%20Corumbatai%20100%20Vila%20Virginia%20Itaquaquecetuba'
const INSTAGRAM_URL = 'https://www.instagram.com/quintaldoibizaoficial/'
const DUDA_INSTAGRAM_URL = 'https://www.instagram.com/mariizsq_/'
const YOUTUBE_VIDEO_ID = '_zR6ROjoOX0'
const PIX_KEY = '56765986898'
const PIX_NAME = 'Maria Eduarda Almeida Araujo'

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


function hasFirstAndLastName(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length >= 2
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

function MusicPlayer() {
    const embedUrl = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`

    return (
        <iframe
            className="youtube-audio-frame"
            src={embedUrl}
            title="Musica do convite da Duda"
            allow="autoplay; encrypted-media"
            tabIndex="-1"
            aria-hidden="true"
        />
    )
}

function RsvpForm() {
    const [status, setStatus] = useState('idle')
    const [message, setMessage] = useState('')
    const [attending, setAttending] = useState('sim')
    const [whatsappValue, setWhatsappValue] = useState('')
    const [companions, setCompanions] = useState([])

    function createCompanion() {
        return {
            id: window.crypto?.randomUUID?.() || String(Date.now()),
            name: '',
            age: '',
        }
    }

    function handleAttendingChange(value) {
        setAttending(value)
        if (value === 'nao') setCompanions([])
    }

    function addCompanion() {
        setCompanions((current) => current.length >= 10 ? current : [...current, createCompanion()])
    }

    function removeCompanion(id) {
        setCompanions((current) => current.filter((companion) => companion.id !== id))
    }

    function updateCompanion(id, field, value) {
        setCompanions((current) => current.map((companion) => (
            companion.id === id ? { ...companion, [field]: value } : companion
        )))
    }

    async function handleSubmit(event) {
        event.preventDefault()
        const formElement = event.currentTarget
        setStatus('loading')
        setMessage('')

        const form = new FormData(formElement)
        const payload = {
            fullName: String(form.get('fullName') || '').trim(),
            whatsapp: whatsappValue.trim(),
            attending: String(form.get('attending') || 'sim'),
            declineReason: String(form.get('declineReason') || '').trim(),
            companions: attending === 'sim'
                ? companions.map((companion) => ({ name: companion.name.trim(), age: companion.age }))
                : [],
        }

        try {
            if (!hasFirstAndLastName(payload.fullName)) {
                throw new Error('Informe nome e sobrenome.')
            }

            if (payload.whatsapp && payload.whatsapp.replace(/\D/g, '').length < 10) {
                throw new Error('Informe um WhatsApp valido com DDD ou deixe em branco se for menor de idade.')
            }

            const response = await fetch('/api/rsvp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await readApiJson(response)

            if (!response.ok) {
                throw new Error(data?.error || 'Nao foi possivel confirmar agora.')
            }

            setStatus('success')
            setMessage(data.message || 'Confirmacao salva com carinho.')
            formElement.reset()
            setWhatsappValue('')
            setAttending('sim')
            setCompanions([])
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
        }
    }

    return (
        <form className="rsvp" onSubmit={handleSubmit}>
            <div className="form-grid">
                <label>
                    <span>Nome e sobrenome</span>
                    <input name="fullName" type="text" placeholder="Seu nome completo" autoComplete="name" required />
                </label>
                <label>
                    <span>WhatsApp cadastrado</span>
                    <input
                        name="whatsapp"
                        type="tel"
                        inputMode="numeric"
                        placeholder="(11) 99999-9999"
                        value={whatsappValue}
                        onChange={(event) => setWhatsappValue(formatWhatsapp(event.target.value))}
                        autoComplete="tel"
                        maxLength="15"
                    />
                </label>
            </div>

            <fieldset className="choice-group">
                <legend>Voce vai?</legend>
                <label className="choice">
                    <input defaultChecked name="attending" type="radio" value="sim" onChange={() => handleAttendingChange('sim')} />
                    <span>Sim, vou comemorar</span>
                </label>
                <label className="choice">
                    <input name="attending" type="radio" value="nao" onChange={() => handleAttendingChange('nao')} />
                    <span>Nao vou</span>
                </label>
            </fieldset>

            {attending === 'nao' ? (
                <label>
                    <span>Conta pra Duda o motivo</span>
                    <textarea name="declineReason" placeholder="Uma justificativa curtinha e carinhosa" required />
                </label>
            ) : null}

            {attending === 'sim' ? (
                <section className="companions-box" aria-label="Acompanhantes">
                    <div className="companions-box__header">
                        <div>
                            <span>Acompanhantes</span>
                            <p>Adicione somente quem esta liberado na lista. Menor de 6 anos nao conta no buffet.</p>
                        </div>
                        <button className="secondary-button" disabled={companions.length >= 10} type="button" onClick={addCompanion}>
                            Adicionar
                        </button>
                    </div>

                    {companions.length > 0 ? (
                        <div className="companions-list">
                            {companions.map((companion, index) => (
                                <div className="companion-row" key={companion.id}>
                                    <label>
                                        <span>Acompanhante {index + 1}</span>
                                        <input
                                            type="text"
                                            placeholder="Nome completo"
                                            value={companion.name}
                                            onChange={(event) => updateCompanion(companion.id, 'name', event.target.value)}
                                            required
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
                                            required
                                        />
                                    </label>
                                    <button className="icon-button" type="button" onClick={() => removeCompanion(companion.id)} aria-label={`Remover acompanhante ${index + 1}`}>
                                        x
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </section>
            ) : null}

            <p className="guest-check-note">A confirmacao usa a lista de convidados. Adultos devem informar WhatsApp; menores podem confirmar pelo nome cadastrado.</p>

            <button disabled={status === 'loading'} type="submit">
                {status === 'loading' ? 'Consultando lista...' : 'Confirmar presenca'}
            </button>

            {message ? <p className={`form-message form-message--${status}`}>{message}</p> : null}
        </form>
    )
}
function GiftPanel() {
    return (
        <section className="confirm-panel gift-panel" aria-labelledby="gift-title">
            <p className="panel-kicker">Sugestao de presente</p>
            <h2 id="gift-title">Um carinho para a Duda</h2>
            <p>Sugestoes: perfume, acessorios femininos, cremes e maquiagem. Quem preferir, tambem pode enviar um Pix para a Duda escolher algo especial.</p>

            <div className="pix-card">
                <img src="/pix-duda.svg" alt="QR Code Pix para presente da Duda" />
                <div>
                    <span>Chave Pix</span>
                    <strong>{PIX_KEY}</strong>
                    <small>Antes de fazer o Pix, confirme se o nome aparece como <b>{PIX_NAME}</b>.</small>
                </div>
            </div>
        </section>
    )
}
function BirthdayMessageForm() {
    const [status, setStatus] = useState('idle')
    const [feedback, setFeedback] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        const formElement = event.currentTarget
        setStatus('loading')
        setFeedback('')

        const form = new FormData(formElement)
        const payload = {
            name: String(form.get('name') || '').trim(),
            message: String(form.get('message') || '').trim(),
        }

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await readApiJson(response)

            if (!response.ok) {
                throw new Error(data?.error || 'Nao foi possivel salvar a mensagem agora.')
            }

            setStatus('success')
            setFeedback(data.message || 'Mensagem guardada para a Duda.')
            formElement.reset()
        } catch (error) {
            setStatus('error')
            setFeedback(error.message)
        }
    }

    return (
        <form className="message-form" onSubmit={handleSubmit}>
            <label>
                <span>Seu nome</span>
                <input name="name" type="text" placeholder="Quem esta mandando carinho?" required />
            </label>
            <label>
                <span>Mensagem de parabens</span>
                <textarea name="message" placeholder="Escreva uma mensagem para a Duda" maxLength="500" required />
            </label>
            <button disabled={status === 'loading'} type="submit">
                {status === 'loading' ? 'Salvando...' : 'Enviar mensagem'}
            </button>
            {feedback ? <p className={`form-message form-message--${status}`}>{feedback}</p> : null}
        </form>
    )
}

function App() {
    return (
        <main className="page-shell">
            <section className="invite-card" aria-labelledby="invite-title">
                <div className="disco-cluster" aria-hidden="true">
                    <img className="disco-image disco-image--small" src="/disco-ball.jpg" alt="" />
                    <img className="disco-image disco-image--medium" src="/disco-ball.jpg" alt="" />
                    <img className="disco-image disco-image--small" src="/disco-ball.jpg" alt="" />
                </div>
                <img className="disco-image disco-image--hero" src="/disco-ball.jpg" alt="" aria-hidden="true" />
                <div className="sparkle sparkle--one" aria-hidden="true" />
                <div className="sparkle sparkle--two" aria-hidden="true" />
                <div className="sparkle sparkle--three" aria-hidden="true" />
                <div className="star star--mint" aria-hidden="true">?</div>
                <div className="star star--silver" aria-hidden="true">?</div>

                <div className="hero-copy">
                    <p className="eyebrow">Sweet birthday</p>
                    <h1 id="invite-title"><img className="balloon-age" src="/balloon-16-transparent.png" alt="16 anos" />Duda</h1>
                    <p className="tagline">Uma tarde para brilhar, dancar e guardar na memoria.</p>
                </div>

                <Countdown />
                <MusicPlayer />

                <div className="event-details" aria-label="Informacoes do aniversario">
                    <p>14 Novembro 2026</p>
                    <p>17h</p>
                    <a href={MAP_URL} target="_blank" rel="noreferrer">Quintal do Ibiza</a>
                </div>

                <p className="address">Rua Corumbatai, 100 - Vila Virginia, Itaquaquecetuba</p>
                <a className="map-link" href={MAP_URL} target="_blank" rel="noreferrer">Abrir no Google Maps</a>

                <div className="venue-card">
                    <img src="/quintal-ibiza-logo.svg" alt="Logo Quintal do Ibiza" />
                    <div>
                        <strong>Quintal do Ibiza</strong>
                        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@quintaldoibizaoficial</a>
                    </div>
                </div>

                <div className="photo-frame">
                    <img
                        src="/duda-photo.png"
                        alt="Foto da Duda"
                    />
                </div>

                <p className="invite-text">
                    A Duda esta fazendo 16 e quer voce por perto para transformar esse dia em uma lembranca linda.
                </p>

                <div className="duda-instagram-card">
                    <span>D</span>
                    <div>
                        <strong>Duda no Instagram</strong>
                        <a href={DUDA_INSTAGRAM_URL} target="_blank" rel="noreferrer">@mariizsq_</a>
                    </div>
                </div>

                <div className="dress-code"><strong>Dress code</strong><span>Nao vir de verde nem azul.</span></div>
            </section>

            <div className="side-stack">
                <section className="confirm-panel" aria-labelledby="confirm-title">
                    <p className="panel-kicker">RSVP ate {RSVP_DEADLINE}</p>
                    <h2 id="confirm-title">Confirme sua presenca</h2>
                    <p>A confirmacao segue a lista de convidados. Cada pessoa pode levar apenas a quantidade de acompanhantes liberada no cadastro.</p>
                    <RsvpForm />
                </section>

                <GiftPanel />

                <section className="confirm-panel message-panel" aria-labelledby="message-title">
                    <p className="panel-kicker">Carinho para guardar</p>
                    <h2 id="message-title">Deixe sua mensagem</h2>
                    <p>Escreva uma mensagem de parabens para a Duda receber junto com as confirmacoes.</p>
                    <BirthdayMessageForm />
                </section>
            </div>
        </main>
    )
}

export default App







