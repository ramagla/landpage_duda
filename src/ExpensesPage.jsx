import {
    useEffect,
    useState,
} from 'react'


function money(cents) {
    return new Intl.NumberFormat(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL',
        },
    ).format(
        Number(cents || 0) / 100
    )
}


function dateBr(value) {
    if (!value) return 'Sem vencimento'

    const [
        year,
        month,
        day,
    ] = value.split('-')

    if (
        !year
        || !month
        || !day
    ) {
        return value
    }

    return `${day}/${month}/${year}`
}


const STATUS_LABELS = {
    pago: 'Pago',
    parcial: 'Parcial',
    pendente: 'Pendente',
    vencido: 'Vencido',
}


export default function ExpensesPage() {
    const [password, setPassword] =
        useState('')

    const [data, setData] =
        useState(null)

    const [status, setStatus] =
        useState('idle')

    const [message, setMessage] =
        useState('')

    const [editing, setEditing] =
        useState(null)

    const [paymentExpense, setPaymentExpense] =
        useState(null)


    async function readJson(response) {
        const body =
            await response.json()
                .catch(() => ({}))

        if (!response.ok) {
            throw new Error(
                body?.error
                || 'Erro na requisicao.'
            )
        }

        return body
    }


    async function loadExpenses(
        payload = {},
    ) {
        setStatus('loading')

        const response =
            await fetch(
                '/api/expenses',
                {
                    method: 'POST',
                    credentials:
                        'same-origin',

                    headers: {
                        'Content-Type':
                            'application/json',
                    },

                    body:
                        JSON.stringify(
                            payload
                        ),
                }
            )

        if (
            response.status === 401
        ) {
            setData(null)
            setStatus('idle')
            return null
        }

        try {
            const body =
                await readJson(response)

            setData(body)
            setStatus('success')

            if (body.message) {
                setMessage(
                    body.message
                )
            }

            return body
        } catch (error) {
            setStatus('error')
            setMessage(error.message)
            throw error
        }
    }


    useEffect(() => {
        let active = true

        async function checkSession() {
            try {
                const response =
                    await fetch(
                        '/api/expenses',
                        {
                            method: 'POST',
                            credentials:
                                'same-origin',

                            headers: {
                                'Content-Type':
                                    'application/json',
                            },

                            body:
                                JSON.stringify({}),
                        }
                    )

                if (!active) {
                    return
                }

                if (
                    response.status
                    === 401
                ) {
                    setData(null)
                    return
                }

                const body =
                    await readJson(
                        response
                    )

                if (!active) {
                    return
                }

                setData(body)
            } catch (error) {
                if (!active) {
                    return
                }

                setMessage(
                    error.message
                )
            }
        }

        checkSession()

        return () => {
            active = false
        }
    }, [])


    async function handleLogin(event) {
        event.preventDefault()

        setStatus('loading')
        setMessage('')

        try {
            const response =
                await fetch(
                    '/api/expenses-login',
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
                    }
                )

            await readJson(response)

            setPassword('')

            await loadExpenses()
        } catch (error) {
            setStatus('error')
            setMessage(
                error.message
            )
        }
    }


    async function handleLogout() {
        await fetch(
            '/api/expenses-logout',
            {
                method: 'POST',
                credentials:
                    'same-origin',
            }
        )

        setData(null)
        setStatus('idle')
        setMessage('')
    }


    async function handleSaveExpense(
        event,
    ) {
        event.preventDefault()

        const formElement =
            event.currentTarget

        const form =
            new FormData(
                formElement
            )

        try {
            await loadExpenses({
                action:
                    'saveExpense',

                id:
                    form.get('id'),

                description:
                    form.get(
                        'description'
                    ),

                category:
                    form.get(
                        'category'
                    ),

                supplier:
                    form.get(
                        'supplier'
                    ),

                totalAmount:
                    form.get(
                        'totalAmount'
                    ),

                dueDate:
                    form.get(
                        'dueDate'
                    ),

                notes:
                    form.get(
                        'notes'
                    ),
            })

            setEditing(null)
            formElement.reset()
        } catch {
            // mensagem ja tratada
        }
    }


    async function handlePayment(
        event,
    ) {
        event.preventDefault()

        const formElement =
            event.currentTarget

        const form =
            new FormData(
                formElement
            )

        try {
            await loadExpenses({
                action:
                    'addPayment',

                expenseId:
                    paymentExpense.id,

                amount:
                    form.get('amount'),

                paidAt:
                    form.get('paidAt'),

                paymentMethod:
                    form.get(
                        'paymentMethod'
                    ),

                notes:
                    form.get('notes'),
            })

            setPaymentExpense(null)
        } catch {
            // mensagem ja tratada
        }
    }


    async function deleteExpense(
        expense,
    ) {
        if (
            !window.confirm(
                `Excluir ${expense.description}?`
            )
        ) {
            return
        }

        await loadExpenses({
            action:
                'deleteExpense',

            id: expense.id,
        })
    }


    async function deletePayment(
        payment,
    ) {
        if (
            !window.confirm(
                'Remover este pagamento?'
            )
        ) {
            return
        }

        await loadExpenses({
            action:
                'deletePayment',

            id: payment.id,
        })
    }


    if (!data) {
        return (
            <main className="expenses-shell expenses-login-shell">
                <section className="expenses-login-card">
                    <p className="panel-kicker">
                        Área financeira
                    </p>

                    <h1>
                        Despesas da festa
                    </h1>

                    <p>
                        Controle reservado de contratos,
                        pagamentos e valores pendentes.
                    </p>

                    <form
                        onSubmit={
                            handleLogin
                        }
                    >
                        <label>
                            <span>
                                Senha
                            </span>

                            <input
                                type="password"
                                value={
                                    password
                                }
                                onChange={
                                    (event) => (
                                        setPassword(
                                            event
                                                .target
                                                .value
                                        )
                                    )
                                }
                                required
                            />
                        </label>

                        <button
                            type="submit"
                            disabled={
                                status
                                === 'loading'
                            }
                        >
                            {status
                                === 'loading'
                                ? 'Entrando...'
                                : 'Entrar'}
                        </button>
                    </form>

                    {message ? (
                        <p className="expenses-message">
                            {message}
                        </p>
                    ) : null}
                </section>
            </main>
        )
    }


    return (
        <main className="expenses-shell">
            <header className="expenses-header">
                <div>
                    <p className="panel-kicker">
                        16 anos da Duda
                    </p>

                    <h1>
                        Gestão de despesas
                    </h1>

                    <p>
                        Controle financeiro da festa.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={
                        handleLogout
                    }
                >
                    Sair
                </button>
            </header>


            <section className="expenses-summary">
                <article>
                    <span>
                        Total contratado
                    </span>

                    <strong>
                        {money(
                            data.totals.total
                        )}
                    </strong>
                </article>

                <article className="expenses-summary--paid">
                    <span>
                        Já pago
                    </span>

                    <strong>
                        {money(
                            data.totals.paid
                        )}
                    </strong>
                </article>

                <article className="expenses-summary--pending">
                    <span>
                        Falta pagar
                    </span>

                    <strong>
                        {money(
                            data.totals.remaining
                        )}
                    </strong>
                </article>

                <article className="expenses-summary--overdue">
                    <span>
                        Vencido
                    </span>

                    <strong>
                        {money(
                            data.totals.overdue
                        )}
                    </strong>
                </article>
            </section>


            <section className="expenses-panel">
                <p className="panel-kicker">
                    Cadastro
                </p>

                <h2>
                    {editing
                        ? 'Editar despesa'
                        : 'Nova despesa'}
                </h2>

                <form
                    key={
                        editing?.id
                        || 'new-expense'
                    }
                    className="expenses-form"
                    onSubmit={
                        handleSaveExpense
                    }
                >
                    <input
                        type="hidden"
                        name="id"
                        value={
                            editing?.id
                            || ''
                        }
                    />

                    <label>
                        <span>
                            Descrição
                        </span>

                        <input
                            name="description"
                            defaultValue={
                                editing
                                    ?.description
                                || ''
                            }
                            required
                        />
                    </label>

                    <label>
                        <span>
                            Categoria
                        </span>

                        <input
                            name="category"
                            defaultValue={
                                editing
                                    ?.category
                                || ''
                            }
                            placeholder="Buffet, DJ, decoração..."
                        />
                    </label>

                    <label>
                        <span>
                            Fornecedor
                        </span>

                        <input
                            name="supplier"
                            defaultValue={
                                editing
                                    ?.supplier
                                || ''
                            }
                        />
                    </label>

                    <label>
                        <span>
                            Valor total
                        </span>

                        <input
                            name="totalAmount"
                            inputMode="decimal"
                            defaultValue={
                                editing
                                    ? (
                                        editing
                                            .totalAmountCents
                                        / 100
                                    )
                                        .toFixed(2)
                                        .replace(
                                            '.',
                                            ','
                                        )
                                    : ''
                            }
                            placeholder="0,00"
                            required
                        />
                    </label>

                    <label>
                        <span>
                            Vencimento
                        </span>

                        <input
                            name="dueDate"
                            type="date"
                            defaultValue={
                                editing
                                    ?.dueDate
                                || ''
                            }
                        />
                    </label>

                    <label className="expenses-form__notes">
                        <span>
                            Observação
                        </span>

                        <textarea
                            name="notes"
                            rows="3"
                            defaultValue={
                                editing
                                    ?.notes
                                || ''
                            }
                        />
                    </label>

                    <div className="expenses-form__actions">
                        <button
                            type="submit"
                        >
                            {editing
                                ? 'Salvar alteração'
                                : 'Adicionar despesa'}
                        </button>

                        {editing ? (
                            <button
                                type="button"
                                className="expenses-secondary"
                                onClick={() => (
                                    setEditing(
                                        null
                                    )
                                )}
                            >
                                Cancelar
                            </button>
                        ) : null}
                    </div>
                </form>
            </section>


            <section className="expenses-panel">
                <div className="expenses-list-heading">
                    <div>
                        <p className="panel-kicker">
                            Controle
                        </p>

                        <h2>
                            Despesas cadastradas
                        </h2>
                    </div>

                    <strong>
                        {data.expenses.length}
                    </strong>
                </div>

                <div className="expenses-list">
                    {data.expenses.length === 0 ? (
                        <div className="expenses-empty">
                            Nenhuma despesa cadastrada.
                        </div>
                    ) : (
                        data.expenses.map(
                            (expense) => (
                                <article
                                    key={
                                        expense.id
                                    }
                                    className="expense-card"
                                >
                                    <header>
                                        <div>
                                            <strong>
                                                {expense.description}
                                            </strong>

                                            <small>
                                                {[
                                                    expense.category,
                                                    expense.supplier,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' • ')
                                                || 'Sem categoria'}
                                            </small>
                                        </div>

                                        <span className={`expense-status expense-status--${expense.status}`}>
                                            {STATUS_LABELS[
                                                expense.status
                                            ]}
                                        </span>
                                    </header>

                                    <div className="expense-values">
                                        <div>
                                            <span>
                                                Total
                                            </span>

                                            <strong>
                                                {money(
                                                    expense
                                                        .totalAmountCents
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Pago
                                            </span>

                                            <strong>
                                                {money(
                                                    expense
                                                        .paidAmountCents
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Falta
                                            </span>

                                            <strong>
                                                {money(
                                                    expense
                                                        .remainingAmountCents
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Vencimento
                                            </span>

                                            <strong>
                                                {dateBr(
                                                    expense
                                                        .dueDate
                                                )}
                                            </strong>
                                        </div>
                                    </div>

                                    {expense.notes ? (
                                        <p className="expense-notes">
                                            {expense.notes}
                                        </p>
                                    ) : null}

                                    {expense.payments.length > 0 ? (
                                        <details className="expense-payments">
                                            <summary>
                                                Histórico de pagamentos ({expense.payments.length})
                                            </summary>

                                            <div>
                                                {expense.payments.map(
                                                    (payment) => (
                                                        <div
                                                            key={
                                                                payment.id
                                                            }
                                                            className="expense-payment-row"
                                                        >
                                                            <span>
                                                                {dateBr(
                                                                    payment.paidAt
                                                                )}
                                                            </span>

                                                            <strong>
                                                                {money(
                                                                    payment
                                                                        .amountCents
                                                                )}
                                                            </strong>

                                                            <small>
                                                                {payment
                                                                    .paymentMethod
                                                                    || 'Não informado'}
                                                            </small>

                                                            <button
                                                                type="button"
                                                                onClick={() => (
                                                                    deletePayment(
                                                                        payment
                                                                    )
                                                                )}
                                                            >
                                                                Remover
                                                            </button>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </details>
                                    ) : null}

                                    <div className="expense-actions">
                                        {expense.remainingAmountCents > 0 ? (
                                            <button
                                                type="button"
                                                className="expense-pay-button"
                                                onClick={() => (
                                                    setPaymentExpense(
                                                        expense
                                                    )
                                                )}
                                            >
                                                Registrar pagamento
                                            </button>
                                        ) : null}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditing(
                                                    expense
                                                )

                                                window.scrollTo({
                                                    top: 0,
                                                    behavior:
                                                        'smooth',
                                                })
                                            }}
                                        >
                                            Editar
                                        </button>

                                        <button
                                            type="button"
                                            className="expense-delete-button"
                                            onClick={() => (
                                                deleteExpense(
                                                    expense
                                                )
                                            )}
                                        >
                                            Excluir
                                        </button>
                                    </div>
                                </article>
                            )
                        )
                    )}
                </div>
            </section>


            {paymentExpense ? (
                <div className="expense-modal-backdrop">
                    <section className="expense-modal">
                        <header>
                            <div>
                                <p className="panel-kicker">
                                    Pagamento
                                </p>

                                <h2>
                                    {paymentExpense.description}
                                </h2>

                                <p>
                                    Saldo:
                                    {' '}
                                    <strong>
                                        {money(
                                            paymentExpense
                                                .remainingAmountCents
                                        )}
                                    </strong>
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => (
                                    setPaymentExpense(
                                        null
                                    )
                                )}
                            >
                                ×
                            </button>
                        </header>

                        <form
                            onSubmit={
                                handlePayment
                            }
                        >
                            <label>
                                <span>
                                    Valor pago
                                </span>

                                <input
                                    name="amount"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    required
                                />
                            </label>

                            <label>
                                <span>
                                    Data
                                </span>

                                <input
                                    name="paidAt"
                                    type="date"
                                    defaultValue={
                                        new Date()
                                            .toISOString()
                                            .slice(0, 10)
                                    }
                                    required
                                />
                            </label>

                            <label>
                                <span>
                                    Forma de pagamento
                                </span>

                                <select
                                    name="paymentMethod"
                                >
                                    <option value="">
                                        Não informado
                                    </option>

                                    <option value="Pix">
                                        Pix
                                    </option>

                                    <option value="Dinheiro">
                                        Dinheiro
                                    </option>

                                    <option value="Cartão">
                                        Cartão
                                    </option>

                                    <option value="Transferência">
                                        Transferência
                                    </option>

                                    <option value="Boleto">
                                        Boleto
                                    </option>
                                </select>
                            </label>

                            <label>
                                <span>
                                    Observação
                                </span>

                                <textarea
                                    name="notes"
                                    rows="3"
                                />
                            </label>

                            <button
                                type="submit"
                            >
                                Confirmar pagamento
                            </button>
                        </form>
                    </section>
                </div>
            ) : null}

            {message ? (
                <div className="expenses-toast">
                    {message}
                </div>
            ) : null}
        </main>
    )
}
