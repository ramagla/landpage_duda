import { useEffect, useMemo, useRef, useState } from 'react'

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

function getInvitationCode() {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('convite') || ''
}


const OPENING_SESSION_KEY = 'dudaInvitationUnlocked'

function readOpeningSession() {
    if (typeof window === 'undefined') return null

    try {
        const stored = JSON.parse(window.sessionStorage.getItem(OPENING_SESSION_KEY) || 'null')
        if (!stored?.guest?.name || digitsOnly(stored.whatsapp).length < 10) return null
        return stored
    } catch {
        return null
    }
}

function saveOpeningSession(data) {
    if (typeof window === 'undefined') return

    window.sessionStorage.setItem(OPENING_SESSION_KEY, JSON.stringify({
        guest: data.guest,
        whatsapp: data.whatsapp,
        alreadyConfirmed: Boolean(data.alreadyConfirmed),
        rsvp: data.rsvp || null,
    }))
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
    if (!enabled) return null

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

function createCompanion(slot) {
    return {
        id: String(slot.slot),
        slot: slot.slot,
        name: slot.name || '',
        age: slot.age === '' ? '' : String(slot.age),
        attending: slot.attending === 'nao' ? 'nao' : 'sim',
    }
}

function RsvpForm({ initialGuest = null, initialWhatsapp = '', initialAlreadyConfirmed = false, onGuestResolved, onGuestCleared }) {
    const invitationCode = useMemo(() => getInvitationCode(), [])
    const [lookupStatus, setLookupStatus] = useState(initialGuest ? 'success' : 'idle')
    const [submitStatus, setSubmitStatus] = useState('idle')
    const [message, setMessage] = useState('')
    const [attending, setAttending] = useState('sim')
    const [whatsappValue, setWhatsappValue] = useState(() => formatWhatsapp(initialWhatsapp))
    const [guest, setGuest] = useState(initialGuest)
    const [companions, setCompanions] = useState(() => (initialGuest?.companions || []).map(createCompanion))
    const [alreadyConfirmed, setAlreadyConfirmed] = useState(Boolean(initialAlreadyConfirmed))


    function resetGuest() {
        setGuest(null)
        setCompanions([])
        setAlreadyConfirmed(false)
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
                throw new Error('Digite um WhatsApp valido com DDD.')
            }

            const params = new URLSearchParams({ whatsapp: whatsappValue })
            if (invitationCode) params.set('code', invitationCode)

            const response = await fetch(`/api/guest?${params.toString()}`)
            const data = await readApiJson(response)

            if (!response.ok) throw new Error(data?.error || 'Nao foi possivel consultar seu convite.')

            setGuest(data.guest)
            onGuestResolved?.(data.guest)
            setCompanions((data.guest.companions || []).map(createCompanion))
            setAlreadyConfirmed(Boolean(data.alreadyConfirmed))
            setLookupStatus('success')
            setMessage(data.alreadyConfirmed
                ? 'Este convite ja foi respondido. Para alterar, fale com o Rafael.'
                : `Convite encontrado para ${data.guest.name}.`)
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
            if (!guest) throw new Error('Consulte seu celular antes de confirmar.')

            const response = await fetch('/api/rsvp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await readApiJson(response)

            if (!response.ok) throw new Error(data?.error || 'Nao foi possivel confirmar agora.')

            setSubmitStatus('success')
            if (data.guest) onGuestResolved?.(data.guest)
            setAlreadyConfirmed(true)
            setMessage(data.message || 'Confirmacao salva com carinho.')
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

                    <fieldset className="choice-group" disabled={alreadyConfirmed}>
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
                            <textarea name="declineReason" placeholder="Uma justificativa curtinha e carinhosa" disabled={alreadyConfirmed} required />
                        </label>
                    ) : null}

                    {attending === 'sim' && guest.maxCompanions > 0 ? (
                        <section className="companions-box" aria-label="Acompanhantes">
                            <div className="companions-box__header">
                                <div>
                                    <span>Acompanhantes liberados</span>
                                    <p>Marque se cada acompanhante vai ou nao. Ate 6 anos nao conta no buffet.</p>
                                </div>
                            </div>

                            <div className="companions-list">
                                {companions.map((companion, index) => (
                                    <div className="companion-row companion-row--fixed" key={companion.id}>
                                        <fieldset className="companion-attendance" disabled={alreadyConfirmed}>
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
                                                <span>Nao vai</span>
                                            </label>
                                        </fieldset>
                                        <label>
                                            <span>Nome</span>
                                            <input
                                                type="text"
                                                placeholder="Nome do acompanhante"
                                                value={companion.name}
                                                onChange={(event) => updateCompanion(companion.id, 'name', event.target.value)}
                                                disabled={alreadyConfirmed || companion.attending === 'nao'}
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
                                                disabled={alreadyConfirmed || companion.attending === 'nao'}
                                                required={companion.attending !== 'nao'}
                                            />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <p className="guest-check-note">Este convite e individual. Use o celular informado para abrir e confirmar somente os nomes deste convite.</p>

                    <button disabled={submitStatus === 'loading' || alreadyConfirmed} type="submit">
                        {submitStatus === 'loading' ? 'Salvando...' : alreadyConfirmed ? 'Convite respondido' : 'Confirmar presenca'}
                    </button>
                </form>
            ) : null}

            {message ? <p className={`form-message form-message--${lookupStatus === 'error' || submitStatus === 'error' ? 'error' : 'success'}`}>{message}</p> : null}
        </div>
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

            if (!response.ok) throw new Error(data?.error || 'Nao foi possivel salvar a mensagem agora.')

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

function AdminPage() {
    const [password, setPassword] = useState(() => window.localStorage.getItem('dudaAdminPassword') || '')
    const [status, setStatus] = useState('idle')
    const [message, setMessage] = useState('')
    const [data, setData] = useState(null)
    const [editing, setEditing] = useState(null)
    const [adminCompanionCount, setAdminCompanionCount] = useState(0)

    async function callAdmin(payload = {}) {
        setStatus('loading')
        setMessage('')

        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, ...payload }),
        })
        const body = await readApiJson(response)

        if (!response.ok) throw new Error(body?.error || 'Nao foi possivel abrir o painel.')

        window.localStorage.setItem('dudaAdminPassword', password)
        setData(body)
        setStatus('success')
        return body
    }

    async function handleLogin(event) {
        event.preventDefault()

        try {
            await callAdmin()
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

    const baseUrl = typeof window === 'undefined' ? '' : window.location.origin

    return (
        <main className="admin-shell">
            <section className="confirm-panel admin-login" aria-labelledby="admin-title">
                <p className="panel-kicker">Area reservada</p>
                <h2 id="admin-title">Lista da Duda</h2>
                <form className="lookup-form" onSubmit={handleLogin}>
                    <label>
                        <span>Senha</span>
                        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha do painel" required />
                    </label>
                    <button type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Abrindo...' : 'Entrar'}</button>
                </form>
                {message ? <p className={`form-message form-message--${status === 'error' ? 'error' : 'success'}`}>{message}</p> : null}
            </section>

            {data ? (
                <>
                    <section className="admin-summary" aria-label="Resumo das confirmacoes">
                        <div><span>Convidados</span><strong>{data.totals.invited}</strong></div>
                        <div><span>Confirmados</span><strong>{data.totals.confirmed}</strong></div>
                        <div><span>Nao vao</span><strong>{data.totals.declined}</strong></div>
                        <div><span>Pendentes</span><strong>{data.totals.pending}</strong></div>
                        <div><span>Buffet</span><strong>{data.totals.buffet}</strong></div>
                    </section>

                    <section className="confirm-panel admin-form-panel" aria-labelledby="guest-form-title">
                        <p className="panel-kicker">Cadastro</p>
                        <h2 id="guest-form-title">Convidado</h2>
                        <form key={editing?.id || 'new-guest'} className="admin-guest-form" onSubmit={handleSaveGuest}>
                            <input name="id" type="hidden" value={editing?.id || ''} />
                            <label>
                                <span>Nome</span>
                                <input name="guestName" defaultValue={editing?.name || ''} placeholder="Nome do convidado" required />
                            </label>
                            <label>
                                <span>Codigo do link</span>
                                <input name="inviteCode" defaultValue={editing?.inviteCode || ''} placeholder="ex: glaucia" />
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

                    <section className="confirm-panel admin-table-panel" aria-labelledby="guest-list-title">
                        <p className="panel-kicker">Confirmacoes</p>
                        <h2 id="guest-list-title">Lista geral</h2>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Status</th>
                                        <th>Acomp.</th>
                                        <th>Buffet</th>
                                        <th>WhatsApp</th>
                                        <th>Link</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.guests.map((guestItem) => (
                                        <tr key={guestItem.id}>
                                            <td>
                                                <strong>{guestItem.name}</strong>
                                                {guestItem.companions.length > 0 ? <small>{guestItem.companions.map((item) => `${item.name} (${item.age})${item.attending === 'nao' ? ' - nao vai' : ''}`).join(', ')}</small> : null}
                                                {guestItem.companions.length === 0 && guestItem.presetCompanions?.length > 0 ? <small>Pre-cadastrados: {guestItem.presetCompanions.map((item) => `${item.name}${item.age !== '' ? ' (' + item.age + ')' : ''}`).join(', ')}</small> : null}
                                                {guestItem.declineReason ? <small>Motivo: {guestItem.declineReason}</small> : null}
                                            </td>
                                            <td><span className={`status-pill status-pill--${guestItem.status}`}>{guestItem.status === 'sim' ? 'Confirmou' : guestItem.status === 'nao' ? 'Nao vai' : 'Pendente'}</span></td>
                                            <td>{guestItem.companionsCount}/{guestItem.maxCompanions}</td>
                                            <td>{guestItem.buffetCount}</td>
                                            <td>{formatWhatsapp(guestItem.whatsapp)}</td>
                                            <td><code>{guestItem.inviteCode ? `${baseUrl}/?convite=${guestItem.inviteCode}` : '-'}</code></td>
                                            <td><button className="secondary-button" type="button" onClick={() => { setEditing(guestItem); setAdminCompanionCount(Number(guestItem.maxCompanions || 0)) }}>Editar</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="confirm-panel admin-table-panel" aria-labelledby="message-list-title">
                        <p className="panel-kicker">Mensagens</p>
                        <h2 id="message-list-title">Parabens enviados</h2>
                        <div className="message-list">
                            {data.messages.length === 0 ? <p>Nenhuma mensagem ainda.</p> : data.messages.map((item) => (
                                <article key={item.id}>
                                    <strong>{item.name}</strong>
                                    <p>{item.message}</p>
                                    <small>{item.createdAt}</small>
                                </article>
                            ))}
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
    const [stage, setStage] = useState('intro')
    const [whatsappValue, setWhatsappValue] = useState('')
    const [message, setMessage] = useState('')
    const [validatedData, setValidatedData] = useState(null)

    useEffect(() => {
        const cardTimer = window.setTimeout(() => setStage('card-visible'), 4300)
        const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 4300)

        return () => {
            window.clearTimeout(cardTimer)
            window.clearTimeout(focusTimer)
        }
    }, [])

    async function handleSubmit(event) {
        event.preventDefault()
        setMessage('')

        try {
            if (digitsOnly(whatsappValue).length < 10) {
                throw new Error('Digite um WhatsApp valido com DDD.')
            }

            setStage('checking')
            const params = new URLSearchParams({ whatsapp: whatsappValue })
            if (invitationCode) params.set('code', invitationCode)

            const response = await fetch(`/api/guest?${params.toString()}`)
            const data = await readApiJson(response)

            if (!response.ok) throw new Error(data?.error || 'Nao foi possivel consultar seu convite.')

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

    return (
        <main className={`opening-gate opening-gate--${stage}`} aria-label="Abertura do convite da Duda">
            <div className="opening-gate__sparkles" aria-hidden="true" />
            <img className="opening-gate__disco opening-gate__disco--left" src="/disco-ball.jpg" alt="" aria-hidden="true" />
            <img className="opening-gate__disco opening-gate__disco--right" src="/disco-ball.jpg" alt="" aria-hidden="true" />

            <section className="opening-gate__brand" aria-hidden="true">
                <p>Sweet birthday</p>
                <img className="opening-gate__balloon" src="/balloon-16-transparent.png" alt="" />
                <span>Duda</span>
                <small>Uma tarde para brilhar, dancar e guardar na memoria.</small>
            </section>

            <div className="envelope-stage">
                <form className="access-card" onSubmit={handleSubmit} aria-live="polite">
                    <p className="panel-kicker">RSVP ate {RSVP_DEADLINE}</p>
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
                            disabled={isChecking || isUnlocked || isCompleted}
                            required
                        />
                    </label>
                    <button
                        type={isUnlocked ? 'button' : 'submit'}
                        onClick={isUnlocked ? enterInvitation : undefined}
                        disabled={isChecking || isCompleted}
                    >
                        {isChecking ? 'Consultando...' : isUnlocked ? 'Convite liberado' : 'Abrir meu convite'}
                    </button>
                    <small>{isUnlocked ? 'Toque para entrar no convite completo.' : 'O numero sera usado somente para localizar e confirmar este convite.'}</small>
                    {message ? <p className="form-message form-message--error">{message}</p> : null}
                </form>

                <div className="envelope" aria-hidden="true">
                    <div className="envelope__back" />
                    <div className="envelope__letter-shadow" />
                    <div className="envelope__flap" />
                    <div className="envelope__pocket envelope__pocket--left" />
                    <div className="envelope__pocket envelope__pocket--right" />
                    <div className="envelope__front" />
                    <div className="envelope__seal">D</div>
                    <span>Feito especialmente para voce</span>
                </div>
            </div>

            <p className="opening-gate__footer">O envelope abre e revela o acesso ao convite</p>
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

    if (!openingData) {
        return <OpeningInvitationGate onUnlocked={handleUnlocked} onMusicStart={() => setMusicStarted(true)} />
    }

    return (
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
                    <p className="tagline">Uma tarde para brilhar, dancar e guardar na memoria.</p>
                </div>

                <Countdown />
                <MusicPlayer enabled={musicStarted} />

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
                    <img src="/duda-photo.png" alt="Foto da Duda" />
                </div>

                <p className="invite-text">{activeGuest.name}, a Duda quer voce por perto para transformar esse dia em uma lembranca linda.</p>

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
                    <h2 id="confirm-title">Oi, {activeGuest.name}</h2>
                    <p>Confira os nomes liberados e confirme a presenca deste convite.</p>
                    <RsvpForm
                        initialGuest={activeGuest}
                        initialWhatsapp={openingData.whatsapp}
                        initialAlreadyConfirmed={openingData.alreadyConfirmed}
                        onGuestResolved={handleGuestResolved}
                    />
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
function App() {
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin'
    return isAdmin ? <AdminPage /> : <LandingPage />
}

export default App
