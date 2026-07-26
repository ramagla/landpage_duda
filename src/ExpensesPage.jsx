import {
    useEffect,
    useMemo,
    useState,
} from 'react'


const STATUS_LABELS = {
    pago: 'Pago',
    parcial: 'Parcial',
    pendente: 'Pendente',
    vencido: 'Vencido',
}


const CATEGORY_OPTIONS = [
    'Buffet',
    'Espaço / Salão',
    'DJ / Som',
    'Decoração',
    'Fotografia',
    'Bebidas',
    'Doces / Bolo',
    'Lembrancinhas',
    'Vestuário',
    'Beleza',
    'Segurança',
    'Transporte',
    'Convites',
    'Outros',
]


const PAYMENT_METHODS = [
    '',
    'Pix',
    'Dinheiro',
    'Cartão',
    'Transferência',
    'Boleto',
]


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


function moneyInput(cents) {
    if (
        cents === null
        || cents === undefined
    ) {
        return ''
    }

    return (
        Number(cents || 0)
        / 100
    )
        .toFixed(2)
        .replace('.', ',')
}


function dateBr(value) {
    if (!value) {
        return 'Sem vencimento'
    }

    const [
        year,
        month,
        day,
    ] = String(value)
        .split('-')

    if (
        !year
        || !month
        || !day
    ) {
        return value
    }

    return `${day}/${month}/${year}`
}


function percentage(
    value,
    total,
) {
    if (
        !total
        || total <= 0
    ) {
        return 0
    }

    return Math.min(
        Math.max(
            Math.round(
                (
                    Number(value || 0)
                    / Number(total)
                ) * 100
            ),
            0,
        ),
        100,
    )
}


function signedMoney(cents) {
    const value =
        Number(cents || 0)

    if (value === 0) {
        return money(0)
    }

    return money(value)
}


function todayIso() {
    return new Date()
        .toISOString()
        .slice(0, 10)
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

    const [activeTab, setActiveTab] =
        useState('dashboard')

    const [editing, setEditing] =
        useState(null)

    const [
        editingSupplier,
        setEditingSupplier,
    ] = useState(null)

    const [
        paymentExpense,
        setPaymentExpense,
    ] = useState(null)

    const [search, setSearch] =
        useState('')

    const [
        statusFilter,
        setStatusFilter,
    ] = useState('todos')

    const [
        categoryFilter,
        setCategoryFilter,
    ] = useState('todos')

    const [
        supplierFilter,
        setSupplierFilter,
    ] = useState('todos')


    async function readJson(response) {
        const body =
            await response.json()
                .catch(() => ({}))

        if (!response.ok) {
            throw new Error(
                body?.error
                || 'Erro na requisição.'
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
                await readJson(
                    response
                )

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
            setMessage(
                error.message
            )

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


    const filteredExpenses =
        useMemo(
            () => {
                const normalizedSearch =
                    search
                        .trim()
                        .toLowerCase()

                return (
                    data?.expenses
                    || []
                ).filter(
                    (expense) => {
                        if (
                            statusFilter
                            !== 'todos'
                            && expense.status
                            !== statusFilter
                        ) {
                            return false
                        }

                        if (
                            categoryFilter
                            !== 'todos'
                            && (
                                expense.category
                                || 'Sem categoria'
                            ) !== categoryFilter
                        ) {
                            return false
                        }

                        if (
                            supplierFilter
                            !== 'todos'
                            && String(
                                expense.supplierId
                                || ''
                            ) !== supplierFilter
                        ) {
                            return false
                        }

                        if (
                            !normalizedSearch
                        ) {
                            return true
                        }

                        const haystack = [
                            expense.description,
                            expense.category,
                            expense.supplier,
                            expense.notes,
                        ]
                            .join(' ')
                            .toLowerCase()

                        return haystack
                            .includes(
                                normalizedSearch
                            )
                    }
                )
            },
            [
                data,
                search,
                statusFilter,
                categoryFilter,
                supplierFilter,
            ],
        )


    const availableCategories =
        useMemo(
            () => (
                [
                    ...new Set(
                        (
                            data?.expenses
                            || []
                        ).map(
                            (expense) => (
                                expense.category
                                || 'Sem categoria'
                            )
                        )
                    ),
                ].sort()
            ),
            [data],
        )


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


    async function handleBudget(
        event,
    ) {
        event.preventDefault()

        const form =
            new FormData(
                event.currentTarget
            )

        try {
            await loadExpenses({
                action:
                    'saveBudget',

                budgetLimit:
                    form.get(
                        'budgetLimit'
                    ),
            })
        } catch {
            // mensagem ja tratada
        }
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

                supplierId:
                    form.get(
                        'supplierId'
                    ),

                supplier:
                    form.get(
                        'supplier'
                    ),

                budgetAmount:
                    form.get(
                        'budgetAmount'
                    ),

                totalAmount:
                    form.get(
                        'totalAmount'
                    ),

                installmentCount:
                    form.get(
                        'installmentCount'
                    ),

                dueDate:
                    form.get(
                        'dueDate'
                    ),

                initialPaidAmount:
                    editing
                        ? ''
                        : form.get(
                            'initialPaidAmount'
                        ),

                initialPaymentDate:
                    editing
                        ? ''
                        : form.get(
                            'initialPaymentDate'
                        ),

                initialPaymentMethod:
                    editing
                        ? ''
                        : form.get(
                            'initialPaymentMethod'
                        ),

                initialPaymentNotes:
                    editing
                        ? ''
                        : form.get(
                            'initialPaymentNotes'
                        ),

                notes:
                    form.get(
                        'notes'
                    ),
            })

            setEditing(null)

            if (!editing) {
                formElement.reset()
            }
        } catch {
            // mensagem ja tratada
        }
    }


    async function handleSaveSupplier(
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
                    'saveSupplier',

                id:
                    form.get('id'),

                name:
                    form.get('name'),

                contactName:
                    form.get(
                        'contactName'
                    ),

                whatsapp:
                    form.get(
                        'whatsapp'
                    ),

                instagram:
                    form.get(
                        'instagram'
                    ),

                email:
                    form.get(
                        'email'
                    ),

                document:
                    form.get(
                        'document'
                    ),

                service:
                    form.get(
                        'service'
                    ),

                notes:
                    form.get(
                        'notes'
                    ),
            })

            setEditingSupplier(null)

            if (!editingSupplier) {
                formElement.reset()
            }
        } catch {
            // mensagem ja tratada
        }
    }


    async function handlePayment(
        event,
    ) {
        event.preventDefault()

        if (!paymentExpense) {
            return
        }

        const form =
            new FormData(
                event.currentTarget
            )

        try {
            await loadExpenses({
                action:
                    'addPayment',

                expenseId:
                    paymentExpense.id,

                installmentId:
                    form.get(
                        'installmentId'
                    ),

                amount:
                    form.get(
                        'amount'
                    ),

                paidAt:
                    form.get(
                        'paidAt'
                    ),

                paymentMethod:
                    form.get(
                        'paymentMethod'
                    ),

                notes:
                    form.get(
                        'notes'
                    ),
            })

            setPaymentExpense(null)
        } catch {
            // mensagem ja tratada
        }
    }


    async function handleRegenerate(
        expense,
    ) {
        const confirmed =
            window.confirm(
                `Recalcular as ${expense.installmentCount} parcelas de ${expense.description}?`
            )

        if (!confirmed) {
            return
        }

        try {
            await loadExpenses({
                action:
                    'regenerateInstallments',

                expenseId:
                    expense.id,

                installmentCount:
                    expense.installmentCount,

                dueDate:
                    expense.dueDate,
            })
        } catch {
            // mensagem ja tratada
        }
    }


    async function deleteExpense(
        expense,
    ) {
        if (
            !window.confirm(
                `Excluir ${expense.description} e todo o histórico financeiro dessa despesa?`
            )
        ) {
            return
        }

        try {
            await loadExpenses({
                action:
                    'deleteExpense',

                id:
                    expense.id,
            })
        } catch {
            // mensagem ja tratada
        }
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

        try {
            await loadExpenses({
                action:
                    'deletePayment',

                id:
                    payment.id,
            })
        } catch {
            // mensagem ja tratada
        }
    }


    async function deleteSupplier(
        supplier,
    ) {
        if (
            !window.confirm(
                `Excluir o fornecedor ${supplier.name}?`
            )
        ) {
            return
        }

        try {
            await loadExpenses({
                action:
                    'deleteSupplier',

                id:
                    supplier.id,
            })
        } catch {
            // mensagem ja tratada
        }
    }


    function startEditExpense(
        expense,
    ) {
        setEditing(expense)
        setActiveTab('expenses')

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        })
    }


    function startEditSupplier(
        supplier,
    ) {
        setEditingSupplier(
            supplier
        )

        setActiveTab(
            'suppliers'
        )

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        })
    }


    if (!data) {
        return (
            <main className="finance-shell finance-login-shell">
                <section className="finance-login-card">
                    <p className="panel-kicker">
                        Área reservada
                    </p>

                    <h1>
                        Gestão da festa
                    </h1>

                    <p>
                        Controle financeiro dos 16 anos da Duda.
                    </p>

                    <form
                        onSubmit={
                            handleLogin
                        }
                    >
                        <label>
                            <span>
                                Senha financeira
                            </span>

                            <input
                                type="password"
                                value={
                                    password
                                }
                                onChange={
                                    (event) => (
                                        setPassword(
                                            event.target.value
                                        )
                                    )
                                }
                                autoComplete="current-password"
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
                            {status === 'loading'
                                ? 'Entrando...'
                                : 'Entrar'}
                        </button>
                    </form>

                    {message ? (
                        <p className="finance-login-message">
                            {message}
                        </p>
                    ) : null}
                </section>
            </main>
        )
    }


    const totals =
        data.totals || {}

    const budgetUsage =
        percentage(
            totals.total,
            totals.budgetLimit,
        )

    const paymentProgress =
        percentage(
            totals.paid,
            totals.total,
        )

    const budgetAbove =
        Number(
            totals.budgetRemaining
            || 0
        ) < 0


    return (
        <main className="finance-shell">
            <header className="finance-header">
                <div>
                    <p className="panel-kicker">
                        16 anos da Duda
                    </p>

                    <h1>
                        Gestão da festa
                    </h1>

                    <p>
                        Orçamento, fornecedores, despesas,
                        parcelas e pagamentos em um só lugar.
                    </p>
                </div>

                <button
                    type="button"
                    className="finance-logout"
                    onClick={
                        handleLogout
                    }
                >
                    Sair
                </button>
            </header>


            <nav className="finance-tabs">
                <button
                    type="button"
                    className={
                        activeTab === 'dashboard'
                            ? 'finance-tab finance-tab--active'
                            : 'finance-tab'
                    }
                    onClick={() => (
                        setActiveTab(
                            'dashboard'
                        )
                    )}
                >
                    Visão geral
                </button>

                <button
                    type="button"
                    className={
                        activeTab === 'expenses'
                            ? 'finance-tab finance-tab--active'
                            : 'finance-tab'
                    }
                    onClick={() => (
                        setActiveTab(
                            'expenses'
                        )
                    )}
                >
                    Despesas
                </button>

                <button
                    type="button"
                    className={
                        activeTab === 'suppliers'
                            ? 'finance-tab finance-tab--active'
                            : 'finance-tab'
                    }
                    onClick={() => (
                        setActiveTab(
                            'suppliers'
                        )
                    )}
                >
                    Fornecedores
                </button>
            </nav>


            {activeTab === 'dashboard' ? (
                <>
                    <section className="finance-budget-panel">
                        <div>
                            <p className="panel-kicker">
                                Planejamento
                            </p>

                            <h2>
                                Orçamento da festa
                            </h2>

                            <p>
                                Defina o limite máximo que pretende
                                gastar com a festa da Duda.
                            </p>
                        </div>

                        <form
                            onSubmit={
                                handleBudget
                            }
                        >
                            <label>
                                <span>
                                    Orçamento máximo
                                </span>

                                <input
                                    name="budgetLimit"
                                    inputMode="decimal"
                                    defaultValue={
                                        moneyInput(
                                            totals
                                                .budgetLimit
                                        )
                                    }
                                    placeholder="0,00"
                                />
                            </label>

                            <button type="submit">
                                Salvar orçamento
                            </button>
                        </form>
                    </section>


                    <section className="finance-summary-grid">
                        <article>
                            <span>
                                Orçamento máximo
                            </span>

                            <strong>
                                {money(
                                    totals.budgetLimit
                                )}
                            </strong>
                        </article>

                        <article>
                            <span>
                                Total orçado
                            </span>

                            <strong>
                                {money(
                                    totals.budgeted
                                )}
                            </strong>
                        </article>

                        <article>
                            <span>
                                Contratado
                            </span>

                            <strong>
                                {money(
                                    totals.total
                                )}
                            </strong>
                        </article>

                        <article className="finance-summary-card--paid">
                            <span>
                                Já pago
                            </span>

                            <strong>
                                {money(
                                    totals.paid
                                )}
                            </strong>
                        </article>

                        <article className="finance-summary-card--pending">
                            <span>
                                Falta pagar
                            </span>

                            <strong>
                                {money(
                                    totals.remaining
                                )}
                            </strong>
                        </article>

                        <article className={
                            budgetAbove
                                ? 'finance-summary-card--danger'
                                : 'finance-summary-card--balance'
                        }>
                            <span>
                                {budgetAbove
                                    ? 'Acima do orçamento'
                                    : 'Saldo do orçamento'}
                            </span>

                            <strong>
                                {signedMoney(
                                    Math.abs(
                                        totals
                                            .budgetRemaining
                                        || 0
                                    )
                                )}
                            </strong>
                        </article>

                        <article className="finance-summary-card--danger">
                            <span>
                                Vencido
                            </span>

                            <strong>
                                {money(
                                    totals.overdue
                                )}
                            </strong>
                        </article>

                        <article>
                            <span>
                                Fornecedores
                            </span>

                            <strong>
                                {
                                    data.suppliers
                                        ?.length
                                    || 0
                                }
                            </strong>
                        </article>
                    </section>


                    <section className="finance-progress-grid">
                        <article>
                            <header>
                                <span>
                                    Orçamento utilizado
                                </span>

                                <strong>
                                    {budgetUsage}%
                                </strong>
                            </header>

                            <div className="finance-progress">
                                <span
                                    style={{
                                        width:
                                            `${budgetUsage}%`,
                                    }}
                                />
                            </div>

                            <small>
                                {money(
                                    totals.total
                                )}
                                {' de '}
                                {money(
                                    totals.budgetLimit
                                )}
                            </small>
                        </article>

                        <article>
                            <header>
                                <span>
                                    Contratos já pagos
                                </span>

                                <strong>
                                    {paymentProgress}%
                                </strong>
                            </header>

                            <div className="finance-progress">
                                <span
                                    style={{
                                        width:
                                            `${paymentProgress}%`,
                                    }}
                                />
                            </div>

                            <small>
                                {money(
                                    totals.paid
                                )}
                                {' de '}
                                {money(
                                    totals.total
                                )}
                            </small>
                        </article>
                    </section>


                    <div className="finance-dashboard-columns">
                        <section className="finance-panel">
                            <div className="finance-section-heading">
                                <div>
                                    <p className="panel-kicker">
                                        Agenda financeira
                                    </p>

                                    <h2>
                                        Próximos vencimentos
                                    </h2>
                                </div>
                            </div>

                            {(
                                data.upcoming
                                || []
                            ).length === 0 ? (
                                <div className="finance-empty">
                                    Nenhum pagamento futuro pendente.
                                </div>
                            ) : (
                                <div className="finance-upcoming-list">
                                    {data.upcoming.map(
                                        (
                                            item,
                                            index,
                                        ) => (
                                            <article
                                                key={
                                                    `${item.expenseId}-${item.installmentId || index}`
                                                }
                                            >
                                                <div className="finance-upcoming-date">
                                                    <strong>
                                                        {dateBr(
                                                            item.dueDate
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <strong>
                                                        {item.expenseDescription}
                                                    </strong>

                                                    <small>
                                                        {[
                                                            item.description,
                                                            item.supplier,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' • ')}
                                                    </small>
                                                </div>

                                                <strong>
                                                    {money(
                                                        item.amountCents
                                                    )}
                                                </strong>
                                            </article>
                                        )
                                    )}
                                </div>
                            )}
                        </section>


                        <section className="finance-panel">
                            <div className="finance-section-heading">
                                <div>
                                    <p className="panel-kicker">
                                        Distribuição
                                    </p>

                                    <h2>
                                        Por categoria
                                    </h2>
                                </div>
                            </div>

                            {(
                                data.categories
                                || []
                            ).length === 0 ? (
                                <div className="finance-empty">
                                    Cadastre despesas para visualizar as categorias.
                                </div>
                            ) : (
                                <div className="finance-category-list">
                                    {data.categories.map(
                                        (category) => {
                                            const contracted =
                                                Number(
                                                    category
                                                        .contractedAmountCents
                                                    || 0
                                                )

                                            const budgeted =
                                                Number(
                                                    category
                                                        .budgetedAmountCents
                                                    || 0
                                                )

                                            const difference =
                                                budgeted
                                                - contracted

                                            return (
                                                <article
                                                    key={
                                                        category.category
                                                    }
                                                >
                                                    <header>
                                                        <strong>
                                                            {category.category}
                                                        </strong>

                                                        <span>
                                                            {money(
                                                                contracted
                                                            )}
                                                        </span>
                                                    </header>

                                                    <div>
                                                        <span>
                                                            Orçado
                                                        </span>

                                                        <strong>
                                                            {money(
                                                                budgeted
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Pago
                                                        </span>

                                                        <strong>
                                                            {money(
                                                                category
                                                                    .paidAmountCents
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Diferença
                                                        </span>

                                                        <strong className={
                                                            difference < 0
                                                                ? 'finance-negative'
                                                                : 'finance-positive'
                                                        }>
                                                            {difference < 0
                                                                ? '- '
                                                                : '+ '}
                                                            {money(
                                                                Math.abs(
                                                                    difference
                                                                )
                                                            )}
                                                        </strong>
                                                    </div>
                                                </article>
                                            )
                                        }
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                </>
            ) : null}


            {activeTab === 'expenses' ? (
                <>
                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Cadastro
                                </p>

                                <h2>
                                    {editing
                                        ? 'Editar despesa'
                                        : 'Nova despesa'}
                                </h2>

                                <p>
                                    Informe o orçamento, valor contratado,
                                    parcelamento e o que já foi pago.
                                </p>
                            </div>

                            {editing ? (
                                <button
                                    type="button"
                                    className="finance-secondary-button"
                                    onClick={() => (
                                        setEditing(
                                            null
                                        )
                                    )}
                                >
                                    Cancelar edição
                                </button>
                            ) : null}
                        </div>


                        <form
                            key={
                                editing?.id
                                || 'new-expense'
                            }
                            className="finance-expense-form"
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

                            <label className="finance-field finance-field--wide">
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
                                    placeholder="Ex.: Buffet da festa"
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Categoria
                                </span>

                                <input
                                    name="category"
                                    list="finance-categories"
                                    defaultValue={
                                        editing
                                            ?.category
                                        || ''
                                    }
                                    placeholder="Selecione ou digite"
                                />

                                <datalist id="finance-categories">
                                    {CATEGORY_OPTIONS.map(
                                        (category) => (
                                            <option
                                                key={
                                                    category
                                                }
                                                value={
                                                    category
                                                }
                                            />
                                        )
                                    )}
                                </datalist>
                            </label>

                            <label className="finance-field">
                                <span>
                                    Fornecedor cadastrado
                                </span>

                                <select
                                    name="supplierId"
                                    defaultValue={
                                        editing
                                            ?.supplierId
                                        || ''
                                    }
                                >
                                    <option value="">
                                        Nenhum / informar abaixo
                                    </option>

                                    {(
                                        data.suppliers
                                        || []
                                    ).map(
                                        (supplier) => (
                                            <option
                                                key={
                                                    supplier.id
                                                }
                                                value={
                                                    supplier.id
                                                }
                                            >
                                                {supplier.name}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>
                                    Fornecedor livre
                                </span>

                                <input
                                    name="supplier"
                                    defaultValue={
                                        editing
                                            ?.supplier
                                        || ''
                                    }
                                    placeholder="Opcional"
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Valor orçado
                                </span>

                                <input
                                    name="budgetAmount"
                                    inputMode="decimal"
                                    defaultValue={
                                        editing
                                            ? moneyInput(
                                                editing
                                                    .budgetAmountCents
                                            )
                                            : ''
                                    }
                                    placeholder="0,00"
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Valor contratado
                                </span>

                                <input
                                    name="totalAmount"
                                    inputMode="decimal"
                                    defaultValue={
                                        editing
                                            ? moneyInput(
                                                editing
                                                    .totalAmountCents
                                            )
                                            : ''
                                    }
                                    placeholder="0,00"
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Quantidade de parcelas
                                </span>

                                <input
                                    name="installmentCount"
                                    type="number"
                                    min="1"
                                    max="36"
                                    defaultValue={
                                        editing
                                            ?.installmentCount
                                        || 1
                                    }
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Primeiro vencimento
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

                            {!editing ? (
                                <>
                                    <div className="finance-form-divider">
                                        Pagamento já realizado
                                    </div>

                                    <label className="finance-field">
                                        <span>
                                            Valor já pago
                                        </span>

                                        <input
                                            name="initialPaidAmount"
                                            inputMode="decimal"
                                            placeholder="0,00"
                                        />
                                    </label>

                                    <label className="finance-field">
                                        <span>
                                            Data do pagamento
                                        </span>

                                        <input
                                            name="initialPaymentDate"
                                            type="date"
                                            defaultValue={
                                                todayIso()
                                            }
                                        />
                                    </label>

                                    <label className="finance-field">
                                        <span>
                                            Forma de pagamento
                                        </span>

                                        <select
                                            name="initialPaymentMethod"
                                            defaultValue=""
                                        >
                                            {PAYMENT_METHODS.map(
                                                (method) => (
                                                    <option
                                                        key={
                                                            method
                                                            || 'empty'
                                                        }
                                                        value={
                                                            method
                                                        }
                                                    >
                                                        {method
                                                            || 'Não informado'}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </label>

                                    <label className="finance-field">
                                        <span>
                                            Observação do pagamento
                                        </span>

                                        <input
                                            name="initialPaymentNotes"
                                            placeholder="Ex.: Entrada do contrato"
                                        />
                                    </label>
                                </>
                            ) : null}

                            <label className="finance-field finance-field--full">
                                <span>
                                    Observações da despesa
                                </span>

                                <textarea
                                    name="notes"
                                    rows="3"
                                    defaultValue={
                                        editing
                                            ?.notes
                                        || ''
                                    }
                                    placeholder="Informações importantes do contrato ou negociação"
                                />
                            </label>

                            <div className="finance-form-actions">
                                <button
                                    type="submit"
                                    className="finance-primary-button"
                                >
                                    {editing
                                        ? 'Salvar alteração'
                                        : 'Cadastrar despesa'}
                                </button>

                                <button
                                    type="button"
                                    className="finance-secondary-button"
                                    onClick={() => (
                                        setActiveTab(
                                            'suppliers'
                                        )
                                    )}
                                >
                                    Gerenciar fornecedores
                                </button>
                            </div>
                        </form>
                    </section>


                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Controle
                                </p>

                                <h2>
                                    Despesas cadastradas
                                </h2>

                                <p>
                                    {filteredExpenses.length}
                                    {' de '}
                                    {data.expenses.length}
                                    {' despesas exibidas'}
                                </p>
                            </div>
                        </div>


                        <div className="finance-filters">
                            <label className="finance-field finance-field--wide">
                                <span>
                                    Buscar
                                </span>

                                <input
                                    value={
                                        search
                                    }
                                    onChange={
                                        (event) => (
                                            setSearch(
                                                event.target.value
                                            )
                                        )
                                    }
                                    placeholder="Descrição, fornecedor, categoria..."
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Status
                                </span>

                                <select
                                    value={
                                        statusFilter
                                    }
                                    onChange={
                                        (event) => (
                                            setStatusFilter(
                                                event.target.value
                                            )
                                        )
                                    }
                                >
                                    <option value="todos">
                                        Todos
                                    </option>

                                    <option value="pendente">
                                        Pendentes
                                    </option>

                                    <option value="parcial">
                                        Parciais
                                    </option>

                                    <option value="pago">
                                        Pagos
                                    </option>

                                    <option value="vencido">
                                        Vencidos
                                    </option>
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>
                                    Categoria
                                </span>

                                <select
                                    value={
                                        categoryFilter
                                    }
                                    onChange={
                                        (event) => (
                                            setCategoryFilter(
                                                event.target.value
                                            )
                                        )
                                    }
                                >
                                    <option value="todos">
                                        Todas
                                    </option>

                                    {availableCategories.map(
                                        (category) => (
                                            <option
                                                key={
                                                    category
                                                }
                                                value={
                                                    category
                                                }
                                            >
                                                {category}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>
                                    Fornecedor
                                </span>

                                <select
                                    value={
                                        supplierFilter
                                    }
                                    onChange={
                                        (event) => (
                                            setSupplierFilter(
                                                event.target.value
                                            )
                                        )
                                    }
                                >
                                    <option value="todos">
                                        Todos
                                    </option>

                                    {(
                                        data.suppliers
                                        || []
                                    ).map(
                                        (supplier) => (
                                            <option
                                                key={
                                                    supplier.id
                                                }
                                                value={
                                                    String(
                                                        supplier.id
                                                    )
                                                }
                                            >
                                                {supplier.name}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                        </div>


                        <div className="finance-expense-list">
                            {filteredExpenses.length === 0 ? (
                                <div className="finance-empty">
                                    Nenhuma despesa encontrada com os filtros atuais.
                                </div>
                            ) : (
                                filteredExpenses.map(
                                    (expense) => {
                                        const difference =
                                            Number(
                                                expense
                                                    .budgetAmountCents
                                                || 0
                                            )
                                            - Number(
                                                expense
                                                    .totalAmountCents
                                                || 0
                                            )

                                        return (
                                            <article
                                                key={
                                                    expense.id
                                                }
                                                className="finance-expense-card"
                                            >
                                                <header className="finance-expense-card__header">
                                                    <div>
                                                        <div className="finance-expense-title-row">
                                                            <strong>
                                                                {expense.description}
                                                            </strong>

                                                            <span className={`finance-status finance-status--${expense.status}`}>
                                                                {STATUS_LABELS[
                                                                    expense.status
                                                                ]}
                                                            </span>
                                                        </div>

                                                        <small>
                                                            {[
                                                                expense.category,
                                                                expense.supplier,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' • ')
                                                            || 'Sem categoria ou fornecedor'}
                                                        </small>
                                                    </div>
                                                </header>


                                                <div className="finance-expense-metrics">
                                                    <div>
                                                        <span>
                                                            Orçado
                                                        </span>

                                                        <strong>
                                                            {money(
                                                                expense
                                                                    .budgetAmountCents
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Contratado
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
                                                            Falta pagar
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
                                                            Próximo vencimento
                                                        </span>

                                                        <strong>
                                                            {dateBr(
                                                                expense
                                                                    .nextDueDate
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Orçado x contratado
                                                        </span>

                                                        <strong className={
                                                            difference < 0
                                                                ? 'finance-negative'
                                                                : 'finance-positive'
                                                        }>
                                                            {difference < 0
                                                                ? '- '
                                                                : '+ '}
                                                            {money(
                                                                Math.abs(
                                                                    difference
                                                                )
                                                            )}
                                                        </strong>
                                                    </div>
                                                </div>


                                                {expense.notes ? (
                                                    <p className="finance-expense-notes">
                                                        {expense.notes}
                                                    </p>
                                                ) : null}


                                                {expense.installments.length > 0 ? (
                                                    <details className="finance-details">
                                                        <summary>
                                                            Parcelas ({expense.installments.length})
                                                        </summary>

                                                        <div className="finance-installment-list">
                                                            {expense.installments.map(
                                                                (installment) => (
                                                                    <div
                                                                        key={
                                                                            installment.id
                                                                        }
                                                                        className="finance-installment-row"
                                                                    >
                                                                        <div>
                                                                            <strong>
                                                                                {installment.description}
                                                                            </strong>

                                                                            <small>
                                                                                {dateBr(
                                                                                    installment.dueDate
                                                                                )}
                                                                            </small>
                                                                        </div>

                                                                        <div>
                                                                            <span>
                                                                                Valor
                                                                            </span>

                                                                            <strong>
                                                                                {money(
                                                                                    installment.amountCents
                                                                                )}
                                                                            </strong>
                                                                        </div>

                                                                        <div>
                                                                            <span>
                                                                                Pago
                                                                            </span>

                                                                            <strong>
                                                                                {money(
                                                                                    installment.paidAmountCents
                                                                                )}
                                                                            </strong>
                                                                        </div>

                                                                        <div>
                                                                            <span>
                                                                                Saldo
                                                                            </span>

                                                                            <strong>
                                                                                {money(
                                                                                    installment.remainingAmountCents
                                                                                )}
                                                                            </strong>
                                                                        </div>

                                                                        <span className={`finance-status finance-status--${installment.status}`}>
                                                                            {STATUS_LABELS[
                                                                                installment.status
                                                                            ]}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </details>
                                                ) : null}


                                                {expense.payments.length > 0 ? (
                                                    <details className="finance-details">
                                                        <summary>
                                                            Histórico de pagamentos ({expense.payments.length})
                                                        </summary>

                                                        <div className="finance-payment-list">
                                                            {expense.payments.map(
                                                                (payment) => (
                                                                    <div
                                                                        key={
                                                                            payment.id
                                                                        }
                                                                        className="finance-payment-row"
                                                                    >
                                                                        <span>
                                                                            {dateBr(
                                                                                payment.paidAt
                                                                            )}
                                                                        </span>

                                                                        <strong>
                                                                            {money(
                                                                                payment.amountCents
                                                                            )}
                                                                        </strong>

                                                                        <small>
                                                                            {payment.paymentMethod
                                                                                || 'Forma não informada'}
                                                                        </small>

                                                                        <small>
                                                                            {payment.installmentId
                                                                                ? 'Vinculado a parcela'
                                                                                : 'Pagamento geral'}
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


                                                <div className="finance-card-actions">
                                                    {expense.remainingAmountCents > 0 ? (
                                                        <button
                                                            type="button"
                                                            className="finance-primary-button"
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
                                                        className="finance-secondary-button"
                                                        onClick={() => (
                                                            startEditExpense(
                                                                expense
                                                            )
                                                        )}
                                                    >
                                                        Editar
                                                    </button>

                                                    {expense.installmentCount > 1 ? (
                                                        <button
                                                            type="button"
                                                            className="finance-secondary-button"
                                                            onClick={() => (
                                                                handleRegenerate(
                                                                    expense
                                                                )
                                                            )}
                                                        >
                                                            Recalcular parcelas
                                                        </button>
                                                    ) : null}

                                                    <button
                                                        type="button"
                                                        className="finance-danger-button"
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
                                    }
                                )
                            )}
                        </div>
                    </section>
                </>
            ) : null}


            {activeTab === 'suppliers' ? (
                <>
                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Cadastro
                                </p>

                                <h2>
                                    {editingSupplier
                                        ? 'Editar fornecedor'
                                        : 'Novo fornecedor'}
                                </h2>
                            </div>

                            {editingSupplier ? (
                                <button
                                    type="button"
                                    className="finance-secondary-button"
                                    onClick={() => (
                                        setEditingSupplier(
                                            null
                                        )
                                    )}
                                >
                                    Cancelar edição
                                </button>
                            ) : null}
                        </div>


                        <form
                            key={
                                editingSupplier?.id
                                || 'new-supplier'
                            }
                            className="finance-supplier-form"
                            onSubmit={
                                handleSaveSupplier
                            }
                        >
                            <input
                                type="hidden"
                                name="id"
                                value={
                                    editingSupplier
                                        ?.id
                                    || ''
                                }
                            />

                            <label className="finance-field">
                                <span>
                                    Empresa / fornecedor
                                </span>

                                <input
                                    name="name"
                                    defaultValue={
                                        editingSupplier
                                            ?.name
                                        || ''
                                    }
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Serviço
                                </span>

                                <input
                                    name="service"
                                    defaultValue={
                                        editingSupplier
                                            ?.service
                                        || ''
                                    }
                                    placeholder="Buffet, salão, DJ..."
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Responsável
                                </span>

                                <input
                                    name="contactName"
                                    defaultValue={
                                        editingSupplier
                                            ?.contactName
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    WhatsApp
                                </span>

                                <input
                                    name="whatsapp"
                                    defaultValue={
                                        editingSupplier
                                            ?.whatsapp
                                        || ''
                                    }
                                    inputMode="tel"
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Instagram
                                </span>

                                <input
                                    name="instagram"
                                    defaultValue={
                                        editingSupplier
                                            ?.instagram
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    E-mail
                                </span>

                                <input
                                    name="email"
                                    type="email"
                                    defaultValue={
                                        editingSupplier
                                            ?.email
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    CPF / CNPJ
                                </span>

                                <input
                                    name="document"
                                    defaultValue={
                                        editingSupplier
                                            ?.document
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field finance-field--full">
                                <span>
                                    Observações
                                </span>

                                <textarea
                                    name="notes"
                                    rows="3"
                                    defaultValue={
                                        editingSupplier
                                            ?.notes
                                        || ''
                                    }
                                />
                            </label>

                            <div className="finance-form-actions">
                                <button
                                    type="submit"
                                    className="finance-primary-button"
                                >
                                    {editingSupplier
                                        ? 'Salvar fornecedor'
                                        : 'Cadastrar fornecedor'}
                                </button>
                            </div>
                        </form>
                    </section>


                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Parceiros
                                </p>

                                <h2>
                                    Fornecedores cadastrados
                                </h2>
                            </div>

                            <strong className="finance-count">
                                {data.suppliers.length}
                            </strong>
                        </div>

                        {data.suppliers.length === 0 ? (
                            <div className="finance-empty">
                                Nenhum fornecedor cadastrado.
                            </div>
                        ) : (
                            <div className="finance-supplier-list">
                                {data.suppliers.map(
                                    (supplier) => (
                                        <article
                                            key={
                                                supplier.id
                                            }
                                            className="finance-supplier-card"
                                        >
                                            <header>
                                                <div>
                                                    <strong>
                                                        {supplier.name}
                                                    </strong>

                                                    <small>
                                                        {supplier.service
                                                            || 'Serviço não informado'}
                                                    </small>
                                                </div>
                                            </header>

                                            <div className="finance-supplier-contact">
                                                {supplier.contactName ? (
                                                    <span>
                                                        Responsável: {supplier.contactName}
                                                    </span>
                                                ) : null}

                                                {supplier.whatsapp ? (
                                                    <span>
                                                        WhatsApp: {supplier.whatsapp}
                                                    </span>
                                                ) : null}

                                                {supplier.email ? (
                                                    <span>
                                                        E-mail: {supplier.email}
                                                    </span>
                                                ) : null}

                                                {supplier.instagram ? (
                                                    <span>
                                                        Instagram: {supplier.instagram}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="finance-supplier-values">
                                                <div>
                                                    <span>
                                                        Contratado
                                                    </span>

                                                    <strong>
                                                        {money(
                                                            supplier
                                                                .contractedAmountCents
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Pago
                                                    </span>

                                                    <strong>
                                                        {money(
                                                            supplier
                                                                .paidAmountCents
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Pendente
                                                    </span>

                                                    <strong>
                                                        {money(
                                                            supplier
                                                                .remainingAmountCents
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>

                                            {supplier.notes ? (
                                                <p>
                                                    {supplier.notes}
                                                </p>
                                            ) : null}

                                            <div className="finance-card-actions">
                                                <button
                                                    type="button"
                                                    className="finance-secondary-button"
                                                    onClick={() => (
                                                        startEditSupplier(
                                                            supplier
                                                        )
                                                    )}
                                                >
                                                    Editar
                                                </button>

                                                <button
                                                    type="button"
                                                    className="finance-danger-button"
                                                    onClick={() => (
                                                        deleteSupplier(
                                                            supplier
                                                        )
                                                    )}
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </article>
                                    )
                                )}
                            </div>
                        )}
                    </section>
                </>
            ) : null}


            {paymentExpense ? (
                <div className="finance-modal-backdrop">
                    <section className="finance-modal">
                        <header>
                            <div>
                                <p className="panel-kicker">
                                    Pagamento
                                </p>

                                <h2>
                                    {paymentExpense.description}
                                </h2>

                                <p>
                                    Saldo da despesa:
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
                                className="finance-modal-close"
                                onClick={() => (
                                    setPaymentExpense(
                                        null
                                    )
                                )}
                                aria-label="Fechar"
                            >
                                ×
                            </button>
                        </header>

                        <form
                            onSubmit={
                                handlePayment
                            }
                        >
                            {paymentExpense.installments.length > 0 ? (
                                <label className="finance-field">
                                    <span>
                                        Parcela
                                    </span>

                                    <select
                                        name="installmentId"
                                        defaultValue=""
                                    >
                                        <option value="">
                                            Pagamento geral
                                        </option>

                                        {paymentExpense
                                            .installments
                                            .filter(
                                                (installment) => (
                                                    installment
                                                        .remainingAmountCents
                                                    > 0
                                                )
                                            )
                                            .map(
                                                (installment) => (
                                                    <option
                                                        key={
                                                            installment.id
                                                        }
                                                        value={
                                                            installment.id
                                                        }
                                                    >
                                                        {installment.description}
                                                        {' - '}
                                                        {dateBr(
                                                            installment.dueDate
                                                        )}
                                                        {' - saldo '}
                                                        {money(
                                                            installment
                                                                .remainingAmountCents
                                                        )}
                                                    </option>
                                                )
                                            )}
                                    </select>

                                    <small>
                                        Pagamento geral abate automaticamente
                                        as parcelas mais antigas.
                                    </small>
                                </label>
                            ) : null}

                            <label className="finance-field">
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

                            <label className="finance-field">
                                <span>
                                    Data
                                </span>

                                <input
                                    name="paidAt"
                                    type="date"
                                    defaultValue={
                                        todayIso()
                                    }
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Forma de pagamento
                                </span>

                                <select
                                    name="paymentMethod"
                                    defaultValue=""
                                >
                                    {PAYMENT_METHODS.map(
                                        (method) => (
                                            <option
                                                key={
                                                    method
                                                    || 'empty'
                                                }
                                                value={
                                                    method
                                                }
                                            >
                                                {method
                                                    || 'Não informado'}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="finance-field">
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
                                className="finance-primary-button"
                            >
                                Confirmar pagamento
                            </button>
                        </form>
                    </section>
                </div>
            ) : null}


            {message ? (
                <div
                    className="finance-toast"
                    role="status"
                >
                    <span>
                        {message}
                    </span>

                    <button
                        type="button"
                        onClick={() => (
                            setMessage('')
                        )}
                    >
                        ×
                    </button>
                </div>
            ) : null}
        </main>
    )
}
