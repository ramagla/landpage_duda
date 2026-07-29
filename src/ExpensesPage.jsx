import {
    useEffect,
    useMemo,
    useState,
} from 'react'

import FinanceChart from './FinanceChart.jsx'
import {
    useDialogA11y,
} from './use-dialog-a11y.js'


const STATUS_LABELS = {
    pago: 'Pago',
    parcial: 'Parcial',
    pendente: 'Pendente',
    vencido: 'Vencido',
    aguardando_sinal: 'Aguardando sinal',
    sinal_parcial: 'Sinal parcial',
    sinal_pago: 'Sinal pago',
    sinal_vencido: 'Sinal vencido',
    cancelado: 'Cancelado',
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


const PAYMENT_TYPES = [
    {
        value: 'pagamento_geral',
        label: 'Pagamento geral',
    },
    {
        value: 'sinal',
        label: 'Sinal / entrada',
    },
    {
        value: 'parcela',
        label: 'Parcela',
    },
]


const DOCUMENT_TYPES = [
    {
        value: 'contrato',
        label: 'Contrato',
    },
    {
        value: 'orcamento',
        label: 'Orçamento',
    },
    {
        value: 'comprovante',
        label: 'Comprovante',
    },
    {
        value: 'nota_fiscal',
        label: 'Nota fiscal',
    },
    {
        value: 'recibo',
        label: 'Recibo',
    },
    {
        value: 'cardapio',
        label: 'Cardápio',
    },
    {
        value: 'outros',
        label: 'Outros',
    },
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

    const [
        documentModal,
        setDocumentModal,
    ] = useState(null)

    const documentDialogRef =
        useDialogA11y(
            Boolean(documentModal),
            () => setDocumentModal(null),
        )

    const paymentDialogRef =
        useDialogA11y(
            Boolean(paymentExpense),
            () => setPaymentExpense(null),
        )

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

    const [
        editingTask,
        setEditingTask,
    ] = useState(null)

    const [
        editingTimeline,
        setEditingTimeline,
    ] = useState(null)

    const [
        editingShopping,
        setEditingShopping,
    ] = useState(null)

    const [
        taskFilter,
        setTaskFilter,
    ] = useState('pendentes')

    const [
        shoppingFilter,
        setShoppingFilter,
    ] = useState('pendentes')


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

    function handleFinanceBackup() {
        if (!data) {
            return
        }

        const exportedAt =
            new Date()
                .toISOString()

        const fileDate =
            exportedAt.slice(0, 10)

        const blob =
            new Blob(
                [
                    JSON.stringify(
                        {
                            format:
                                'duda-finance-backup-v1',
                            exportedAt,
                            data,
                        },
                        null,
                        2,
                    ),
                ],
                {
                    type:
                        'application/json;charset=utf-8',
                },
            )

        const url =
            URL.createObjectURL(blob)

        const anchor =
            document.createElement('a')

        anchor.href = url
        anchor.download =
            `backup-financeiro-duda-${fileDate}.json`

        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)

        setMessage(
            'Cópia de segurança financeira exportada.',
        )
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

                initialPaymentType:
                    editing
                        ? ''
                        : form.get(
                            'initialPaymentType'
                        ),

                initialPaymentNotes:
                    editing
                        ? ''
                        : form.get(
                            'initialPaymentNotes'
                        ),

                requiresSignal:
                    form.get(
                        'requiresSignal'
                    ),

                signalType:
                    form.get(
                        'signalType'
                    ),

                signalAmount:
                    form.get(
                        'signalAmount'
                    ),

                signalPercent:
                    form.get(
                        'signalPercent'
                    ),

                signalDueDate:
                    form.get(
                        'signalDueDate'
                    ),

                signalNotes:
                    form.get(
                        'signalNotes'
                    ),

                reservationConfirmed:
                    form.get(
                        'reservationConfirmed'
                    ),

                reservationConfirmedAt:
                    form.get(
                        'reservationConfirmedAt'
                    ),

                contractDocumentName:
                    form.get(
                        'contractDocumentName'
                    ),

                contractDocumentType:
                    form.get(
                        'contractDocumentType'
                    ),

                contractDocumentDate:
                    form.get(
                        'contractDocumentDate'
                    ),

                contractDocumentUrl:
                    form.get(
                        'contractDocumentUrl'
                    ),

                contractDocumentNotes:
                    form.get(
                        'contractDocumentNotes'
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


    async function updateContractStatus(
        expense,
        contractStatus,
    ) {
        const question =
            contractStatus === 'cancelled'
                ? 'Cancelar este contrato? Ele ficará no histórico e sairá dos totais ativos.'
                : 'Reativar este contrato nos totais ativos?'

        if (!window.confirm(question)) {
            return
        }

        try {
            await loadExpenses({
                action:
                    'updateContractStatus',

                expenseId:
                    expense.id,

                contractStatus,
            })
        } catch {
            // mensagem ja tratada
        }
    }


    async function handleSaveDocument(
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
                    'saveDocument',

                id:
                    form.get('id'),

                name:
                    form.get('name'),

                documentType:
                    form.get('documentType'),

                supplierId:
                    form.get('supplierId'),

                expenseId:
                    form.get('expenseId'),

                paymentId:
                    form.get('paymentId'),

                documentDate:
                    form.get('documentDate'),

                documentUrl:
                    form.get('documentUrl'),

                notes:
                    form.get('notes'),
            })

            setDocumentModal(null)
        } catch {
            // mensagem ja tratada
        }
    }


    async function deleteDocument(document) {
        if (
            !window.confirm(
                `Remover o documento "${document.name}"?`
            )
        ) {
            return
        }

        try {
            await loadExpenses({
                action:
                    'deleteDocument',

                id:
                    document.id,
            })
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

                paymentType:
                    form.get(
                        'paymentType'
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


    async function handleSaveTask(
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
                    'saveTask',

                id:
                    form.get('id'),

                title:
                    form.get('title'),

                category:
                    form.get(
                        'category'
                    ),

                responsible:
                    form.get(
                        'responsible'
                    ),

                priority:
                    form.get(
                        'priority'
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

            setEditingTask(null)

            formElement.reset()
        } catch {
            // mensagem ja tratada
        }
    }


    async function toggleTask(task) {
        try {
            await loadExpenses({
                action:
                    'toggleTask',

                id:
                    task.id,

                completed:
                    !task.completed,
            })
        } catch {
            // mensagem ja tratada
        }
    }


    async function deleteTask(task) {
        if (
            !window.confirm(
                `Excluir a tarefa "${task.title}"?`
            )
        ) {
            return
        }

        try {
            await loadExpenses({
                action:
                    'deleteTask',

                id:
                    task.id,
            })
        } catch {
            // mensagem ja tratada
        }
    }


    async function handleSaveTimeline(
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
                    'saveTimelineItem',

                id:
                    form.get('id'),

                eventTime:
                    form.get(
                        'eventTime'
                    ),

                title:
                    form.get('title'),

                responsible:
                    form.get(
                        'responsible'
                    ),

                location:
                    form.get(
                        'location'
                    ),

                sortOrder:
                    form.get(
                        'sortOrder'
                    ),

                notes:
                    form.get(
                        'notes'
                    ),
            })

            setEditingTimeline(null)

            formElement.reset()
        } catch {
            // mensagem ja tratada
        }
    }


    async function deleteTimelineItem(
        item,
    ) {
        if (
            !window.confirm(
                `Excluir "${item.title}" do cronograma?`
            )
        ) {
            return
        }

        try {
            await loadExpenses({
                action:
                    'deleteTimelineItem',

                id:
                    item.id,
            })
        } catch {
            // mensagem ja tratada
        }
    }


    async function handleSaveShopping(
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
                    'saveShoppingItem',

                id:
                    form.get('id'),

                itemName:
                    form.get(
                        'itemName'
                    ),

                category:
                    form.get(
                        'category'
                    ),

                quantity:
                    form.get(
                        'quantity'
                    ),

                unit:
                    form.get('unit'),

                unitPrice:
                    form.get(
                        'unitPrice'
                    ),

                store:
                    form.get('store'),

                responsible:
                    form.get(
                        'responsible'
                    ),

                notes:
                    form.get(
                        'notes'
                    ),
            })

            setEditingShopping(null)

            formElement.reset()
        } catch {
            // mensagem ja tratada
        }
    }


    async function toggleShoppingItem(
        item,
    ) {
        try {
            await loadExpenses({
                action:
                    'toggleShoppingItem',

                id:
                    item.id,

                purchased:
                    !item.purchased,
            })
        } catch {
            // mensagem ja tratada
        }
    }


    async function deleteShoppingItem(
        item,
    ) {
        if (
            !window.confirm(
                `Excluir "${item.itemName}" da lista de compras?`
            )
        ) {
            return
        }

        try {
            await loadExpenses({
                action:
                    'deleteShoppingItem',

                id:
                    item.id,
            })
        } catch {
            // mensagem ja tratada
        }
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

    const financeDonutOption = {
        tooltip: {
            trigger: 'item',
            valueFormatter: (value) => money(value),
        },
        color: [
            '#0f8f7d',
            '#f2b84b',
            '#d95f59',
        ],
        series: [
            {
                type: 'pie',
                radius: [
                    '54%',
                    '78%',
                ],
                avoidLabelOverlap: true,
                label: {
                    formatter: '{b}',
                    color: '#31524d',
                    fontWeight: 700,
                },
                data: [
                    {
                        name: 'Pago',
                        value: Number(totals.paid || 0),
                    },
                    {
                        name: 'A pagar',
                        value: Number(totals.remaining || 0),
                    },
                    {
                        name: 'Vencido',
                        value: Number(totals.overdue || 0),
                    },
                ].filter((item) => item.value > 0),
            },
        ],
    }

    const chartCategories =
        (data.categories || [])
            .slice(0, 7)

    const categoryBarOption = {
        tooltip: {
            trigger: 'axis',
            valueFormatter: (value) => money(value),
        },
        grid: {
            top: 16,
            right: 14,
            bottom: 34,
            left: 58,
        },
        xAxis: {
            type: 'category',
            data: chartCategories.map((item) => item.category),
            axisLabel: {
                interval: 0,
                rotate: 24,
            },
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                formatter: (value) => money(value).replace('R$', '').trim(),
            },
        },
        color: [
            '#0f8f7d',
            '#8bb7ff',
        ],
        series: [
            {
                name: 'Contratado',
                type: 'bar',
                data: chartCategories.map((item) => Number(item.contractedAmountCents || 0)),
                barMaxWidth: 28,
                itemStyle: {
                    borderRadius: [6, 6, 0, 0],
                },
            },
            {
                name: 'Pago',
                type: 'bar',
                data: chartCategories.map((item) => Number(item.paidAmountCents || 0)),
                barMaxWidth: 28,
                itemStyle: {
                    borderRadius: [6, 6, 0, 0],
                },
            },
        ],
    }

    const signalGaugeOption = {
        tooltip: {
            valueFormatter: (value) => `${value}%`,
        },
        series: [
            {
                type: 'gauge',
                min: 0,
                max: 100,
                radius: '94%',
                progress: {
                    show: true,
                    width: 12,
                    itemStyle: {
                        color: '#0f8f7d',
                    },
                },
                axisLine: {
                    lineStyle: {
                        width: 12,
                        color: [
                            [1, '#e5f0ed'],
                        ],
                    },
                },
                pointer: {
                    show: false,
                },
                axisTick: {
                    show: false,
                },
                splitLine: {
                    show: false,
                },
                axisLabel: {
                    show: false,
                },
                detail: {
                    valueAnimation: true,
                    formatter: '{value}%',
                    color: '#173f39',
                    fontSize: 24,
                    fontWeight: 900,
                },
                data: [
                    {
                        value: percentage(
                            totals.signalPaid,
                            totals.signalAmount,
                        ),
                    },
                ],
            },
        ],
    }

    const contractAlerts =
        (data.expenses || [])
            .filter(
                (expense) => (
                    expense.contractStatus !== 'cancelled'
                    && expense.requiresSignal
                    && (
                        expense.signalRemainingAmountCents > 0
                        || !expense.reservationConfirmed
                    )
                )
            )
            .slice(0, 5)


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

                <div className="finance-header-actions">
                    <button
                        type="button"
                        className="finance-backup"
                        onClick={handleFinanceBackup}
                    >
                        Exportar backup
                    </button>

                    <button
                        type="button"
                        className="finance-logout"
                        onClick={
                            handleLogout
                        }
                    >
                        Sair
                    </button>
                </div>
            </header>


            <nav
                className="finance-tabs"
                role="tablist"
                aria-label="Áreas da gestão da festa"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'dashboard'}
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
                    role="tab"
                    aria-selected={activeTab === 'expenses'}
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
                    role="tab"
                    aria-selected={activeTab === 'contracts'}
                    className={
                        activeTab === 'contracts'
                            ? 'finance-tab finance-tab--active'
                            : 'finance-tab'
                    }
                    onClick={() => (
                        setActiveTab(
                            'contracts'
                        )
                    )}
                >
                    Contratos
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'documents'}
                    className={
                        activeTab === 'documents'
                            ? 'finance-tab finance-tab--active'
                            : 'finance-tab'
                    }
                    onClick={() => (
                        setActiveTab(
                            'documents'
                        )
                    )}
                >
                    Documentos
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'suppliers'}
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

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'checklist'}
                    className={
                        activeTab === 'checklist'
                            ? 'finance-tab finance-tab--active'
                            : 'finance-tab'
                    }
                    onClick={() => (
                        setActiveTab(
                            'checklist'
                        )
                    )}
                >
                    Checklist
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'timeline'}
                    className={
                        activeTab === 'timeline'
                            ? 'finance-tab finance-tab--active'
                            : 'finance-tab'
                    }
                    onClick={() => (
                        setActiveTab(
                            'timeline'
                        )
                    )}
                >
                    Cronograma
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'shopping'}
                    className={
                        activeTab === 'shopping'
                            ? 'finance-tab finance-tab--active'
                            : 'finance-tab'
                    }
                    onClick={() => (
                        setActiveTab(
                            'shopping'
                        )
                    )}
                >
                    Compras
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
                                Contratos ativos
                            </span>

                            <strong>
                                {totals.contractsActive || 0}
                            </strong>
                        </article>

                        <article className="finance-summary-card--pending">
                            <span>
                                Sinais pendentes
                            </span>

                            <strong>
                                {money(totals.signalPending)}
                            </strong>
                        </article>

                        <article className="finance-summary-card--danger">
                            <span>
                                Reservas pendentes
                            </span>

                            <strong>
                                {totals.reservationsPending || 0}
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


                    <section className="finance-charts-grid">
                        <article className="finance-chart-card">
                            <div className="finance-section-heading">
                                <div>
                                    <p className="panel-kicker">Fluxo financeiro</p>
                                    <h2>Pago x pendente</h2>
                                </div>
                            </div>

                            {Number(totals.total || 0) > 0 ? (
                                <FinanceChart
                                    option={financeDonutOption}
                                    ariaLabel="Grafico de valores pagos, pendentes e vencidos"
                                />
                            ) : (
                                <div className="finance-empty finance-empty--compact">
                                    Cadastre contratos para gerar o grafico.
                                </div>
                            )}
                        </article>

                        <article className="finance-chart-card finance-chart-card--wide">
                            <div className="finance-section-heading">
                                <div>
                                    <p className="panel-kicker">Categorias</p>
                                    <h2>Contratado e pago</h2>
                                </div>
                            </div>

                            {(data.categories || []).length > 0 ? (
                                <FinanceChart
                                    option={categoryBarOption}
                                    className="finance-chart--bar"
                                    ariaLabel="Grafico de contratado e pago por categoria"
                                />
                            ) : (
                                <div className="finance-empty finance-empty--compact">
                                    Sem categorias cadastradas ainda.
                                </div>
                            )}
                        </article>

                        <article className="finance-chart-card">
                            <div className="finance-section-heading">
                                <div>
                                    <p className="panel-kicker">Sinais</p>
                                    <h2>Sinais pagos</h2>
                                </div>
                            </div>

                            {Number(totals.signalAmount || 0) > 0 ? (
                                <FinanceChart
                                    option={signalGaugeOption}
                                    ariaLabel="Grafico do percentual de sinais pagos"
                                />
                            ) : (
                                <div className="finance-empty finance-empty--compact">
                                    Nenhum contrato com sinal cadastrado.
                                </div>
                            )}
                        </article>
                    </section>

                    {contractAlerts.length > 0 ? (
                        <section className="finance-alert-strip">
                            <div>
                                <p className="panel-kicker">Atencao</p>
                                <h2>Sinais e reservas para acompanhar</h2>
                            </div>

                            <div className="finance-alert-list">
                                {contractAlerts.map((expense) => (
                                    <article key={expense.id}>
                                        <strong>{expense.description}</strong>
                                        <span>
                                            {expense.signalRemainingAmountCents > 0
                                                ? `Sinal pendente de ${money(expense.signalRemainingAmountCents)}`
                                                : 'Sinal quitado'}
                                            {expense.signalDueDate
                                                ? ` vence em ${dateBr(expense.signalDueDate)}`
                                                : ''}
                                            {!expense.reservationConfirmed
                                                ? ' • Reserva não confirmada'
                                                : ''}
                                        </span>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ) : null}

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


            {activeTab === 'contracts' ? (
                <>
                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">Contratos</p>
                                <h2>Controle de contratos e sinais</h2>
                                <p>Acompanhe sinal, reserva, parcelas e status de cada fornecedor.</p>
                            </div>

                            <button
                                type="button"
                                className="finance-primary-button"
                                onClick={() => setActiveTab('expenses')}
                            >
                                + Novo contrato
                            </button>
                        </div>

                        <section className="finance-contract-overview">
                            <article><span>Contratos ativos</span><strong>{totals.contractsActive || 0}</strong></article>
                            <article><span>Cancelados</span><strong>{totals.contractsCancelled || 0}</strong></article>
                            <article><span>Total em sinais</span><strong>{money(totals.signalAmount)}</strong></article>
                            <article><span>Sinais pagos</span><strong>{money(totals.signalPaid)}</strong></article>
                            <article><span>Sinais vencidos</span><strong>{money(totals.signalOverdue)}</strong></article>
                            <article><span>Reservas pendentes</span><strong>{totals.reservationsPending || 0}</strong></article>
                        </section>
                    </section>

                    <section className="finance-contract-list">
                        {(data.expenses || []).map((expense) => (
                            <article
                                key={expense.id}
                                className={expense.contractStatus === 'cancelled'
                                    ? 'finance-contract-card finance-contract-card--cancelled'
                                    : 'finance-contract-card'}
                            >
                                <header>
                                    <div>
                                        <div className="finance-expense-title-row">
                                            <strong>{expense.description}</strong>
                                            <span className={`finance-status finance-status--${expense.status}`}>
                                                {STATUS_LABELS[expense.status] || expense.status}
                                            </span>
                                        </div>

                                        <small>
                                            {[expense.supplier, expense.category].filter(Boolean).join(' • ') || 'Sem fornecedor'}
                                        </small>
                                    </div>

                                    <div className="finance-contract-actions">
                                        <button
                                            type="button"
                                            className="finance-secondary-button"
                                            onClick={() => setDocumentModal({
                                                expense,
                                                document: null,
                                            })}
                                        >
                                            Documento
                                        </button>

                                        <button
                                            type="button"
                                            className="finance-secondary-button"
                                            onClick={() => startEditExpense(expense)}
                                        >
                                            Editar
                                        </button>

                                        {expense.contractStatus === 'cancelled' ? (
                                            <button
                                                type="button"
                                                className="finance-primary-button"
                                                onClick={() => updateContractStatus(expense, 'active')}
                                            >
                                                Reativar
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="finance-danger-button"
                                                onClick={() => updateContractStatus(expense, 'cancelled')}
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                </header>

                                <div className="finance-contract-metrics">
                                    <div><span>Contrato</span><strong>{money(expense.totalAmountCents)}</strong></div>
                                    <div><span>Pago</span><strong>{money(expense.paidAmountCents)}</strong></div>
                                    <div><span>Pendente</span><strong>{money(expense.remainingAmountCents)}</strong></div>
                                    <div><span>Sinal esperado</span><strong>{money(expense.signalAmountCents)}</strong></div>
                                    <div><span>Sinal pago</span><strong>{money(expense.signalPaidAmountCents)}</strong></div>
                                    <div><span>Vencimento do sinal</span><strong>{dateBr(expense.signalDueDate)}</strong></div>
                                </div>

                                <div className="finance-contract-flags">
                                    <span>
                                        {expense.requiresSignal
                                            ? `Exige sinal (${expense.signalType === 'percent'
                                                ? `${expense.signalPercent}%`
                                                : money(expense.signalAmountCents)})`
                                            : 'Sem sinal obrigatorio'}
                                    </span>

                                    <span>
                                        {expense.reservationConfirmed
                                            ? `Reserva confirmada${expense.reservationConfirmedAt
                                                ? ` em ${dateBr(expense.reservationConfirmedAt)}`
                                                : ''}`
                                            : 'Reserva não confirmada'}
                                    </span>

                                    <span>Parcelas: {expense.installments.length || 0}</span>
                                    <span>Documentos: {expense.documents?.length || 0}</span>
                                </div>

                                {expense.signalNotes ? (
                                    <p className="finance-expense-notes">{expense.signalNotes}</p>
                                ) : null}
                            </article>
                        ))}

                        {(data.expenses || []).length === 0 ? (
                            <div className="finance-empty">Nenhum contrato cadastrado ainda.</div>
                        ) : null}
                    </section>
                </>
            ) : null}


            {activeTab === 'documents' ? (
                <>
                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">Arquivos e links</p>
                                <h2>Documentos da festa</h2>
                                <p>Cadastre links seguros para contratos, comprovantes, recibos e orçamentos.</p>
                            </div>

                            <button
                                type="button"
                                className="finance-primary-button"
                                onClick={() => setDocumentModal({
                                    expense: null,
                                    document: null,
                                })}
                            >
                                + Novo documento
                            </button>
                        </div>
                    </section>

                    <section className="finance-document-list">
                        {(data.documents || []).map((document) => (
                            <article
                                key={document.id}
                                className="finance-document-card"
                            >
                                <div>
                                    <p className="panel-kicker">
                                        {DOCUMENT_TYPES.find((type) => type.value === document.documentType)?.label || 'Documento'}
                                    </p>

                                    <h3>{document.name}</h3>

                                    <small>
                                        {[document.expenseDescription, document.supplierName, dateBr(document.documentDate)]
                                            .filter(Boolean)
                                            .join(' • ')}
                                    </small>

                                    {document.notes ? (
                                        <p>{document.notes}</p>
                                    ) : null}
                                </div>

                                <div className="finance-document-actions">
                                    <a
                                        className="finance-primary-button"
                                        href={document.documentUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Abrir
                                    </a>

                                    <button
                                        type="button"
                                        className="finance-secondary-button"
                                        onClick={() => setDocumentModal({
                                            expense: (data.expenses || []).find((expense) => expense.id === document.expenseId) || null,
                                            document,
                                        })}
                                    >
                                        Editar
                                    </button>

                                    <button
                                        type="button"
                                        className="finance-danger-button"
                                        onClick={() => deleteDocument(document)}
                                    >
                                        Remover
                                    </button>
                                </div>
                            </article>
                        ))}

                        {(data.documents || []).length === 0 ? (
                            <div className="finance-empty">
                                Nenhum documento cadastrado. Use o botao Documento em um contrato para anexar o link.
                            </div>
                        ) : null}
                    </section>
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

                            <div className="finance-form-divider finance-form-divider--signal">
                                Sinal e reserva do contrato
                            </div>

                            <label className="finance-field">
                                <span>
                                    Exige sinal?
                                </span>

                                <select
                                    name="requiresSignal"
                                    defaultValue={
                                        editing?.requiresSignal
                                            ? 'sim'
                                            : 'nao'
                                    }
                                >
                                    <option value="nao">
                                        Não
                                    </option>

                                    <option value="sim">
                                        Sim
                                    </option>
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>
                                    Tipo de sinal
                                </span>

                                <select
                                    name="signalType"
                                    defaultValue={
                                        editing?.signalType
                                        || 'fixed'
                                    }
                                >
                                    <option value="fixed">
                                        Valor fixo
                                    </option>

                                    <option value="percent">
                                        Percentual
                                    </option>
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>
                                    Valor do sinal
                                </span>

                                <input
                                    name="signalAmount"
                                    inputMode="decimal"
                                    defaultValue={
                                        editing
                                            ? moneyInput(
                                                editing.signalAmountCents
                                            )
                                            : ''
                                    }
                                    placeholder="0,00"
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Percentual do sinal
                                </span>

                                <input
                                    name="signalPercent"
                                    inputMode="decimal"
                                    defaultValue={
                                        editing?.signalPercent
                                        || ''
                                    }
                                    placeholder="30"
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Vencimento do sinal
                                </span>

                                <input
                                    name="signalDueDate"
                                    type="date"
                                    defaultValue={
                                        editing?.signalDueDate
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Reserva confirmada?
                                </span>

                                <select
                                    name="reservationConfirmed"
                                    defaultValue={
                                        editing?.reservationConfirmed
                                            ? 'sim'
                                            : 'nao'
                                    }
                                >
                                    <option value="nao">
                                        Não
                                    </option>

                                    <option value="sim">
                                        Sim
                                    </option>
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>
                                    Data da confirmacao
                                </span>

                                <input
                                    name="reservationConfirmedAt"
                                    type="date"
                                    defaultValue={
                                        editing?.reservationConfirmedAt
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field finance-field--wide">
                                <span>
                                    Observação do sinal
                                </span>

                                <input
                                    name="signalNotes"
                                    defaultValue={
                                        editing?.signalNotes
                                        || ''
                                    }
                                    placeholder="Ex.: entrada para reservar a data"
                                />
                            </label>

                            <div className="finance-form-divider finance-form-divider--document">
                                Contrato e anexos
                            </div>

                            <label className="finance-field">
                                <span>
                                    Nome do anexo
                                </span>

                                <input
                                    name="contractDocumentName"
                                    placeholder="Ex.: Contrato assinado"
                                />
                            </label>

                            <label className="finance-field">
                                <span>
                                    Tipo de anexo
                                </span>

                                <select
                                    name="contractDocumentType"
                                    defaultValue="contrato"
                                >
                                    {DOCUMENT_TYPES.map(
                                        (type) => (
                                            <option
                                                key={type.value}
                                                value={type.value}
                                            >
                                                {type.label}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>
                                    Data do anexo
                                </span>

                                <input
                                    name="contractDocumentDate"
                                    type="date"
                                    defaultValue={todayIso()}
                                />
                            </label>

                            <label className="finance-field finance-field--wide">
                                <span>
                                    Link do contrato/anexo
                                </span>

                                <input
                                    name="contractDocumentUrl"
                                    type="url"
                                    placeholder="https://drive.google.com/..."
                                />

                                <small>
                                    Cole aqui o link do contrato, comprovante ou recibo. O arquivo deve ficar no Drive/OneDrive/Dropbox com permissão controlada.
                                </small>
                            </label>

                            <label className="finance-field finance-field--wide">
                                <span>
                                    Observação do anexo
                                </span>

                                <input
                                    name="contractDocumentNotes"
                                    placeholder="Ex.: contrato assinado pelo fornecedor"
                                />
                            </label>

                            {!editing ? (
                                <>
                                    <div className="finance-form-divider finance-form-divider--payment">
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
                                            Tipo de pagamento
                                        </span>

                                        <select
                                            name="initialPaymentType"
                                            defaultValue="pagamento_geral"
                                        >
                                            {PAYMENT_TYPES.map(
                                                (type) => (
                                                    <option
                                                        key={type.value}
                                                        value={type.value}
                                                    >
                                                        {type.label}
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
                            ) : (
                                <>
                                    <div className="finance-form-divider finance-form-divider--payment">
                                        Pagamentos registrados
                                    </div>

                                    <label className="finance-field">
                                        <span>
                                            Valor já pago
                                        </span>

                                        <input
                                            value={
                                                moneyInput(
                                                    editing
                                                        .paidAmountCents
                                                )
                                            }
                                            readOnly
                                        />
                                    </label>

                                    <label className="finance-field">
                                        <span>
                                            Último pagamento
                                        </span>

                                        <input
                                            value={
                                                dateBr(
                                                    editing
                                                        .payments?.[0]
                                                        ?.paidAt
                                                )
                                            }
                                            readOnly
                                        />
                                    </label>

                                    <label className="finance-field">
                                        <span>
                                            Forma de pagamento
                                        </span>

                                        <input
                                            value={
                                                editing
                                                    .payments?.[0]
                                                    ?.paymentMethod
                                                || 'Não informado'
                                            }
                                            readOnly
                                        />
                                    </label>

                                    <label className="finance-field">
                                        <span>
                                            Observação do pagamento
                                        </span>

                                        <input
                                            value={
                                                editing
                                                    .payments?.[0]
                                                    ?.notes
                                                || ''
                                            }
                                            readOnly
                                            placeholder="Sem observação"
                                        />
                                    </label>

                                    <div className="finance-form-inline-actions">
                                        <button
                                            type="button"
                                            className="finance-secondary-button"
                                            onClick={() => (
                                                setPaymentExpense(
                                                    editing
                                                )
                                            )}
                                        >
                                            Registrar novo pagamento
                                        </button>
                                    </div>
                                </>
                            )}

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

                                    <option value="aguardando_sinal">
                                        Aguardando sinal
                                    </option>

                                    <option value="sinal_parcial">
                                        Sinal parcial
                                    </option>

                                    <option value="sinal_vencido">
                                        Sinal vencido
                                    </option>

                                    <option value="cancelado">
                                        Cancelados
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
                                                            Entrada / sinal
                                                        </span>

                                                        <strong>
                                                            {money(
                                                                expense
                                                                    .signalAmountCents
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Saldo após entrada
                                                        </span>

                                                        <strong>
                                                            {money(
                                                                Math.max(
                                                                    expense
                                                                        .totalAmountCents
                                                                    - expense
                                                                        .signalAmountCents,
                                                                    0,
                                                                )
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
                                                                            {payment.paymentType === 'sinal'
                                                                                ? 'Sinal'
                                                                                : payment.installmentId
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


            {activeTab === 'checklist' ? (
                <>
                    <section className="finance-management-summary">
                        <article>
                            <span>Total</span>
                            <strong>
                                {data.management?.tasksTotal || 0}
                            </strong>
                        </article>

                        <article className="finance-management-card--success">
                            <span>Concluídas</span>
                            <strong>
                                {data.management?.tasksCompleted || 0}
                            </strong>
                        </article>

                        <article className="finance-management-card--warning">
                            <span>Pendentes</span>
                            <strong>
                                {data.management?.tasksPending || 0}
                            </strong>
                        </article>

                        <article className="finance-management-card--danger">
                            <span>Vencidas</span>
                            <strong>
                                {data.management?.tasksOverdue || 0}
                            </strong>
                        </article>
                    </section>


                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Organização
                                </p>

                                <h2>
                                    {editingTask
                                        ? 'Editar tarefa'
                                        : 'Nova tarefa'}
                                </h2>

                                <p>
                                    Controle tudo que precisa ser resolvido
                                    antes da festa.
                                </p>
                            </div>

                            {editingTask ? (
                                <button
                                    type="button"
                                    className="finance-secondary-button"
                                    onClick={() => (
                                        setEditingTask(
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
                                editingTask?.id
                                || 'new-task'
                            }
                            className="party-management-form"
                            onSubmit={
                                handleSaveTask
                            }
                        >
                            <input
                                type="hidden"
                                name="id"
                                value={
                                    editingTask?.id
                                    || ''
                                }
                            />

                            <label className="finance-field party-field--wide">
                                <span>Tarefa</span>

                                <input
                                    name="title"
                                    defaultValue={
                                        editingTask?.title
                                        || ''
                                    }
                                    placeholder="Ex.: Confirmar quantidade final do buffet"
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>Categoria</span>

                                <input
                                    name="category"
                                    defaultValue={
                                        editingTask?.category
                                        || ''
                                    }
                                    placeholder="Buffet, decoração..."
                                />
                            </label>

                            <label className="finance-field">
                                <span>Responsável</span>

                                <input
                                    name="responsible"
                                    defaultValue={
                                        editingTask?.responsible
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field">
                                <span>Prioridade</span>

                                <select
                                    name="priority"
                                    defaultValue={
                                        editingTask?.priority
                                        || 'media'
                                    }
                                >
                                    <option value="baixa">
                                        Baixa
                                    </option>

                                    <option value="media">
                                        Média
                                    </option>

                                    <option value="alta">
                                        Alta
                                    </option>
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>Prazo</span>

                                <input
                                    name="dueDate"
                                    type="date"
                                    defaultValue={
                                        editingTask?.dueDate
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field party-field--full">
                                <span>Observações</span>

                                <textarea
                                    name="notes"
                                    rows="3"
                                    defaultValue={
                                        editingTask?.notes
                                        || ''
                                    }
                                />
                            </label>

                            <div className="finance-form-actions">
                                <button
                                    type="submit"
                                    className="finance-primary-button"
                                >
                                    {editingTask
                                        ? 'Salvar tarefa'
                                        : 'Adicionar tarefa'}
                                </button>
                            </div>
                        </form>
                    </section>


                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Checklist
                                </p>

                                <h2>
                                    Tarefas da festa
                                </h2>
                            </div>

                            <select
                                className="party-inline-filter"
                                value={
                                    taskFilter
                                }
                                onChange={
                                    (event) => (
                                        setTaskFilter(
                                            event.target.value
                                        )
                                    )
                                }
                            >
                                <option value="pendentes">
                                    Pendentes
                                </option>

                                <option value="concluidas">
                                    Concluídas
                                </option>

                                <option value="todas">
                                    Todas
                                </option>
                            </select>
                        </div>

                        <div className="party-task-list">
                            {(
                                data.tasks
                                || []
                            )
                                .filter(
                                    (task) => {
                                        if (
                                            taskFilter
                                            === 'pendentes'
                                        ) {
                                            return !task.completed
                                        }

                                        if (
                                            taskFilter
                                            === 'concluidas'
                                        ) {
                                            return task.completed
                                        }

                                        return true
                                    }
                                )
                                .map(
                                    (task) => (
                                        <article
                                            key={task.id}
                                            className={[
                                                'party-task-card',
                                                task.completed
                                                    ? 'party-task-card--completed'
                                                    : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                        >
                                            <button
                                                type="button"
                                                className={[
                                                    'party-check-button',
                                                    task.completed
                                                        ? 'party-check-button--done'
                                                        : '',
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                                onClick={() => (
                                                    toggleTask(
                                                        task
                                                    )
                                                )}
                                                aria-label={
                                                    task.completed
                                                        ? 'Reabrir tarefa'
                                                        : 'Concluir tarefa'
                                                }
                                            >
                                                {task.completed
                                                    ? '✓'
                                                    : ''}
                                            </button>

                                            <div className="party-task-content">
                                                <div className="party-task-title">
                                                    <strong>
                                                        {task.title}
                                                    </strong>

                                                    <span className={`party-priority party-priority--${task.priority}`}>
                                                        {task.priority}
                                                    </span>
                                                </div>

                                                <div className="party-task-meta">
                                                    {task.category ? (
                                                        <span>
                                                            {task.category}
                                                        </span>
                                                    ) : null}

                                                    {task.responsible ? (
                                                        <span>
                                                            Responsável: {task.responsible}
                                                        </span>
                                                    ) : null}

                                                    {task.dueDate ? (
                                                        <span>
                                                            Prazo: {dateBr(task.dueDate)}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {task.notes ? (
                                                    <p>
                                                        {task.notes}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="party-row-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => (
                                                        setEditingTask(
                                                            task
                                                        )
                                                    )}
                                                >
                                                    Editar
                                                </button>

                                                <button
                                                    type="button"
                                                    className="party-row-delete"
                                                    onClick={() => (
                                                        deleteTask(
                                                            task
                                                        )
                                                    )}
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </article>
                                    )
                                )}

                            {(
                                data.tasks
                                || []
                            ).length === 0 ? (
                                <div className="finance-empty">
                                    Nenhuma tarefa cadastrada.
                                </div>
                            ) : null}
                        </div>
                    </section>
                </>
            ) : null}


            {activeTab === 'timeline' ? (
                <>
                    <section className="finance-management-summary finance-management-summary--timeline">
                        <article>
                            <span>Atividades</span>
                            <strong>
                                {data.management?.timelineTotal || 0}
                            </strong>
                        </article>

                        <article>
                            <span>Data da festa</span>
                            <strong className="party-summary-text">
                                14/11/2026
                            </strong>
                        </article>

                        <article>
                            <span>Início</span>
                            <strong className="party-summary-text">
                                17h
                            </strong>
                        </article>

                        <article>
                            <span>Encerramento</span>
                            <strong className="party-summary-text">
                                23h
                            </strong>
                        </article>
                    </section>


                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    14 de novembro de 2026
                                </p>

                                <h2>
                                    {editingTimeline
                                        ? 'Editar atividade'
                                        : 'Adicionar ao cronograma'}
                                </h2>
                            </div>

                            {editingTimeline ? (
                                <button
                                    type="button"
                                    className="finance-secondary-button"
                                    onClick={() => (
                                        setEditingTimeline(
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
                                editingTimeline?.id
                                || 'new-timeline'
                            }
                            className="party-management-form party-timeline-form"
                            onSubmit={
                                handleSaveTimeline
                            }
                        >
                            <input
                                type="hidden"
                                name="id"
                                value={
                                    editingTimeline?.id
                                    || ''
                                }
                            />

                            <label className="finance-field">
                                <span>Horário</span>

                                <input
                                    name="eventTime"
                                    type="time"
                                    defaultValue={
                                        editingTimeline?.eventTime
                                        || ''
                                    }
                                    required
                                />
                            </label>

                            <label className="finance-field party-field--wide">
                                <span>Atividade</span>

                                <input
                                    name="title"
                                    defaultValue={
                                        editingTimeline?.title
                                        || ''
                                    }
                                    placeholder="Ex.: Entrada da decoração"
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>Responsável</span>

                                <input
                                    name="responsible"
                                    defaultValue={
                                        editingTimeline?.responsible
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field">
                                <span>Local</span>

                                <input
                                    name="location"
                                    defaultValue={
                                        editingTimeline?.location
                                        || ''
                                    }
                                    placeholder="Ex.: Salão principal"
                                />
                            </label>

                            <input
                                type="hidden"
                                name="sortOrder"
                                value={
                                    editingTimeline?.sortOrder
                                    || 0
                                }
                            />

                            <label className="finance-field party-field--full">
                                <span>Observações</span>

                                <textarea
                                    name="notes"
                                    rows="3"
                                    defaultValue={
                                        editingTimeline?.notes
                                        || ''
                                    }
                                />
                            </label>

                            <div className="finance-form-actions">
                                <button
                                    type="submit"
                                    className="finance-primary-button"
                                >
                                    {editingTimeline
                                        ? 'Salvar atividade'
                                        : 'Adicionar atividade'}
                                </button>
                            </div>
                        </form>
                    </section>


                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Roteiro
                                </p>

                                <h2>
                                    Cronograma do dia
                                </h2>
                            </div>
                        </div>

                        <div className="party-timeline-list">
                            {(
                                data.timeline
                                || []
                            ).map(
                                (item) => (
                                    <article
                                        key={
                                            item.id
                                        }
                                        className="party-timeline-item"
                                    >
                                        <div className="party-timeline-time">
                                            {item.eventTime}
                                        </div>

                                        <div className="party-timeline-marker">
                                            <span />
                                        </div>

                                        <div className="party-timeline-content">
                                            <strong>
                                                {item.title}
                                            </strong>

                                            <div>
                                                {item.responsible ? (
                                                    <span>
                                                        Responsável: {item.responsible}
                                                    </span>
                                                ) : null}

                                                {item.location ? (
                                                    <span>
                                                        Local: {item.location}
                                                    </span>
                                                ) : null}
                                            </div>

                                            {item.notes ? (
                                                <p>
                                                    {item.notes}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="party-row-actions">
                                            <button
                                                type="button"
                                                onClick={() => (
                                                    setEditingTimeline(
                                                        item
                                                    )
                                                )}
                                            >
                                                Editar
                                            </button>

                                            <button
                                                type="button"
                                                className="party-row-delete"
                                                onClick={() => (
                                                    deleteTimelineItem(
                                                        item
                                                    )
                                                )}
                                            >
                                                Excluir
                                            </button>
                                        </div>
                                    </article>
                                )
                            )}

                            {(
                                data.timeline
                                || []
                            ).length === 0 ? (
                                <div className="finance-empty">
                                    O cronograma ainda está vazio.
                                </div>
                            ) : null}
                        </div>
                    </section>
                </>
            ) : null}


            {activeTab === 'shopping' ? (
                <>
                    <section className="finance-management-summary">
                        <article>
                            <span>Itens</span>
                            <strong>
                                {data.management?.shoppingTotal || 0}
                            </strong>
                        </article>

                        <article className="finance-management-card--success">
                            <span>Comprados</span>
                            <strong>
                                {data.management?.shoppingPurchased || 0}
                            </strong>
                        </article>

                        <article className="finance-management-card--warning">
                            <span>Pendentes</span>
                            <strong>
                                {data.management?.shoppingPending || 0}
                            </strong>
                        </article>

                        <article>
                            <span>Estimativa total</span>
                            <strong className="party-summary-money">
                                {money(
                                    data.management
                                        ?.shoppingEstimatedCents
                                    || 0
                                )}
                            </strong>
                        </article>
                    </section>


                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Compras
                                </p>

                                <h2>
                                    {editingShopping
                                        ? 'Editar item'
                                        : 'Adicionar item'}
                                </h2>
                            </div>

                            {editingShopping ? (
                                <button
                                    type="button"
                                    className="finance-secondary-button"
                                    onClick={() => (
                                        setEditingShopping(
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
                                editingShopping?.id
                                || 'new-shopping'
                            }
                            className="party-management-form party-shopping-form"
                            onSubmit={
                                handleSaveShopping
                            }
                        >
                            <input
                                type="hidden"
                                name="id"
                                value={
                                    editingShopping?.id
                                    || ''
                                }
                            />

                            <label className="finance-field party-field--wide">
                                <span>Item</span>

                                <input
                                    name="itemName"
                                    defaultValue={
                                        editingShopping?.itemName
                                        || ''
                                    }
                                    placeholder="Ex.: Gelo"
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>Categoria</span>

                                <input
                                    name="category"
                                    defaultValue={
                                        editingShopping?.category
                                        || ''
                                    }
                                    placeholder="Bebidas, decoração..."
                                />
                            </label>

                            <label className="finance-field">
                                <span>Quantidade</span>

                                <input
                                    name="quantity"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue={
                                        editingShopping?.quantity
                                        || 1
                                    }
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>Unidade</span>

                                <input
                                    name="unit"
                                    defaultValue={
                                        editingShopping?.unit
                                        || ''
                                    }
                                    placeholder="un., kg, litros, caixas..."
                                />
                            </label>

                            <label className="finance-field">
                                <span>Preço unitário</span>

                                <input
                                    name="unitPrice"
                                    inputMode="decimal"
                                    defaultValue={
                                        editingShopping
                                            ? moneyInput(
                                                editingShopping
                                                    .unitPriceCents
                                            )
                                            : ''
                                    }
                                    placeholder="0,00"
                                />
                            </label>

                            <label className="finance-field">
                                <span>Onde comprar</span>

                                <input
                                    name="store"
                                    defaultValue={
                                        editingShopping?.store
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field">
                                <span>Responsável</span>

                                <input
                                    name="responsible"
                                    defaultValue={
                                        editingShopping?.responsible
                                        || ''
                                    }
                                />
                            </label>

                            <label className="finance-field party-field--full">
                                <span>Observações</span>

                                <textarea
                                    name="notes"
                                    rows="3"
                                    defaultValue={
                                        editingShopping?.notes
                                        || ''
                                    }
                                />
                            </label>

                            <div className="finance-form-actions">
                                <button
                                    type="submit"
                                    className="finance-primary-button"
                                >
                                    {editingShopping
                                        ? 'Salvar item'
                                        : 'Adicionar à lista'}
                                </button>
                            </div>
                        </form>
                    </section>


                    <section className="finance-panel">
                        <div className="finance-section-heading">
                            <div>
                                <p className="panel-kicker">
                                    Lista
                                </p>

                                <h2>
                                    Lista de compras
                                </h2>
                            </div>

                            <select
                                className="party-inline-filter"
                                value={
                                    shoppingFilter
                                }
                                onChange={
                                    (event) => (
                                        setShoppingFilter(
                                            event.target.value
                                        )
                                    )
                                }
                            >
                                <option value="pendentes">
                                    Pendentes
                                </option>

                                <option value="comprados">
                                    Comprados
                                </option>

                                <option value="todos">
                                    Todos
                                </option>
                            </select>
                        </div>

                        <div className="party-shopping-list">
                            {(
                                data.shoppingItems
                                || []
                            )
                                .filter(
                                    (item) => {
                                        if (
                                            shoppingFilter
                                            === 'pendentes'
                                        ) {
                                            return !item.purchased
                                        }

                                        if (
                                            shoppingFilter
                                            === 'comprados'
                                        ) {
                                            return item.purchased
                                        }

                                        return true
                                    }
                                )
                                .map(
                                    (item) => (
                                        <article
                                            key={
                                                item.id
                                            }
                                            className={[
                                                'party-shopping-card',
                                                item.purchased
                                                    ? 'party-shopping-card--purchased'
                                                    : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                        >
                                            <button
                                                type="button"
                                                className={[
                                                    'party-check-button',
                                                    item.purchased
                                                        ? 'party-check-button--done'
                                                        : '',
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                                onClick={() => (
                                                    toggleShoppingItem(
                                                        item
                                                    )
                                                )}
                                            >
                                                {item.purchased
                                                    ? '✓'
                                                    : ''}
                                            </button>

                                            <div className="party-shopping-main">
                                                <strong>
                                                    {item.itemName}
                                                </strong>

                                                <small>
                                                    {[
                                                        item.category,
                                                        item.store,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' • ')
                                                    || 'Sem categoria'}
                                                </small>
                                            </div>

                                            <div className="party-shopping-value">
                                                <span>
                                                    Quantidade
                                                </span>

                                                <strong>
                                                    {item.quantity}
                                                    {' '}
                                                    {item.unit}
                                                </strong>
                                            </div>

                                            <div className="party-shopping-value">
                                                <span>
                                                    Unitário
                                                </span>

                                                <strong>
                                                    {money(
                                                        item.unitPriceCents
                                                    )}
                                                </strong>
                                            </div>

                                            <div className="party-shopping-value">
                                                <span>
                                                    Total
                                                </span>

                                                <strong>
                                                    {money(
                                                        item.totalPriceCents
                                                    )}
                                                </strong>
                                            </div>

                                            <div className="party-row-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => (
                                                        setEditingShopping(
                                                            item
                                                        )
                                                    )}
                                                >
                                                    Editar
                                                </button>

                                                <button
                                                    type="button"
                                                    className="party-row-delete"
                                                    onClick={() => (
                                                        deleteShoppingItem(
                                                            item
                                                        )
                                                    )}
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </article>
                                    )
                                )}

                            {(
                                data.shoppingItems
                                || []
                            ).length === 0 ? (
                                <div className="finance-empty">
                                    Nenhum item na lista de compras.
                                </div>
                            ) : null}
                        </div>
                    </section>
                </>
            ) : null}


            {documentModal ? (
                <div className="finance-modal-backdrop">
                    <section
                        className="finance-modal"
                        ref={documentDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="finance-document-modal-title"
                    >
                        <header>
                            <div>
                                <p className="panel-kicker">Documento</p>
                                <h2 id="finance-document-modal-title">
                                    {documentModal.document
                                        ? 'Editar documento'
                                        : 'Anexar contrato/documento'}
                                </h2>
                                <p>
                                    Informe um link seguro para o arquivo. Upload direto ficará para quando houver storage configurado.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="finance-modal-close"
                                onClick={() => setDocumentModal(null)}
                                aria-label="Fechar"
                            >
                                ×
                            </button>
                        </header>

                        <form onSubmit={handleSaveDocument}>
                            <input
                                type="hidden"
                                name="id"
                                value={documentModal.document?.id || ''}
                            />

                            <input
                                type="hidden"
                                name="expenseId"
                                value={documentModal.document?.expenseId || documentModal.expense?.id || ''}
                            />

                            <input
                                type="hidden"
                                name="supplierId"
                                value={documentModal.document?.supplierId || documentModal.expense?.supplierId || ''}
                            />

                            <input
                                type="hidden"
                                name="paymentId"
                                value={documentModal.document?.paymentId || ''}
                            />

                            <label className="finance-field">
                                <span>Nome</span>
                                <input
                                    name="name"
                                    defaultValue={
                                        documentModal.document?.name
                                        || (documentModal.expense
                                            ? `Contrato - ${documentModal.expense.description}`
                                            : '')
                                    }
                                    placeholder="Ex.: Contrato do DJ"
                                    required
                                />
                            </label>

                            <label className="finance-field">
                                <span>Tipo</span>
                                <select
                                    name="documentType"
                                    defaultValue={documentModal.document?.documentType || 'contrato'}
                                >
                                    {DOCUMENT_TYPES.map((type) => (
                                        <option
                                            key={type.value}
                                            value={type.value}
                                        >
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="finance-field">
                                <span>Data</span>
                                <input
                                    name="documentDate"
                                    type="date"
                                    defaultValue={documentModal.document?.documentDate || todayIso()}
                                />
                            </label>

                            <label className="finance-field finance-field--full">
                                <span>URL do documento</span>
                                <input
                                    name="documentUrl"
                                    type="url"
                                    defaultValue={documentModal.document?.documentUrl || ''}
                                    placeholder="https://drive.google.com/..."
                                    required
                                />
                                <small>
                                    Use um link de Drive/OneDrive/Dropbox ou storage com permissão controlada.
                                </small>
                            </label>

                            {documentModal.expense ? (
                                <div className="finance-linked-document">
                                    Vinculado ao contrato: <strong>{documentModal.expense.description}</strong>
                                </div>
                            ) : null}

                            <label className="finance-field finance-field--full">
                                <span>Observação</span>
                                <textarea
                                    name="notes"
                                    rows="3"
                                    defaultValue={documentModal.document?.notes || ''}
                                    placeholder="Ex.: contrato assinado, comprovante do sinal, recibo final..."
                                />
                            </label>

                            <button
                                type="submit"
                                className="finance-primary-button"
                            >
                                Salvar documento
                            </button>
                        </form>
                    </section>
                </div>
            ) : null}


            {paymentExpense ? (
                <div className="finance-modal-backdrop">
                    <section
                        className="finance-modal"
                        ref={paymentDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="finance-payment-modal-title"
                    >
                        <header>
                            <div>
                                <p className="panel-kicker">
                                    Pagamento
                                </p>

                                <h2 id="finance-payment-modal-title">
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
                                <span>Tipo de pagamento</span>
                                <select
                                    name="paymentType"
                                    defaultValue={paymentExpense.requiresSignal && paymentExpense.signalRemainingAmountCents > 0 ? 'sinal' : 'pagamento_geral'}
                                >
                                    {PAYMENT_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
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
