import {
    ensureSchema,
    getClient,
    parseBody,
} from './_db.js'

import {
    verifyExpensesRequest,
} from './_expenses-session.js'


function cleanText(value) {
    return String(
        value || ''
    ).trim()
}


function parseMoneyToCents(
    value,
    {
        allowEmpty = false,
    } = {},
) {
    let text = String(
        value ?? ''
    ).trim()

    if (!text) {
        return allowEmpty
            ? 0
            : null
    }

    text = text.replace(
        /[^\d,.-]/g,
        '',
    )

    if (text.includes(',')) {
        text = text
            .replace(/\./g, '')
            .replace(',', '.')
    }

    const number =
        Number(text)

    if (
        !Number.isFinite(number)
        || number < 0
    ) {
        return null
    }

    return Math.round(
        number * 100
    )
}


function parseInteger(
    value,
    fallback = 0,
) {
    const parsed =
        Number.parseInt(
            String(value ?? ''),
            10,
        )

    return Number.isInteger(parsed)
        ? parsed
        : fallback
}


function parseDecimal(
    value,
    fallback = 0,
) {
    const normalized =
        String(value ?? '')
            .trim()
            .replace(',', '.')

    const parsed =
        Number(normalized)

    return Number.isFinite(parsed)
        ? parsed
        : fallback
}


function isTruthy(value) {
    return [
        '1',
        'true',
        'sim',
        'on',
        'yes',
    ].includes(
        String(value ?? '')
            .trim()
            .toLowerCase()
    )
}


function normalizeSignalType(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === 'percent'
        ? 'percent'
        : 'fixed'
}


function normalizePaymentType(value) {
    const type =
        String(value || '')
            .trim()
            .toLowerCase()

    return [
        'sinal',
        'parcela',
        'pagamento_geral',
    ].includes(type)
        ? type
        : 'pagamento_geral'
}


function calculateSignalAmountCents({
    totalAmountCents,
    requiresSignal,
    signalType,
    signalAmountCents,
    signalPercent,
}) {
    if (!requiresSignal) {
        return 0
    }

    const total =
        Number(totalAmountCents || 0)

    if (signalType === 'percent') {
        return Math.min(
            Math.round(
                total
                * Number(signalPercent || 0)
                / 100
            ),
            total,
        )
    }

    return Math.min(
        Number(signalAmountCents || 0),
        total,
    )
}


function getTodayIso() {
    const parts =
        new Intl.DateTimeFormat(
            'en-US',
            {
                timeZone:
                    'America/Sao_Paulo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            },
        )
            .formatToParts(
                new Date()
            )
            .filter(
                (part) => (
                    part.type
                    !== 'literal'
                )
            )

    const values =
        Object.fromEntries(
            parts.map(
                (part) => [
                    part.type,
                    part.value,
                ]
            )
        )

    return (
        `${values.year}`
        + `-${values.month}`
        + `-${values.day}`
    )
}


function addMonthsIso(
    isoDate,
    monthsToAdd,
) {
    const [
        year,
        month,
        day,
    ] = String(
        isoDate || ''
    )
        .split('-')
        .map(Number)

    if (
        !year
        || !month
        || !day
    ) {
        return ''
    }

    const base =
        new Date(
            Date.UTC(
                year,
                month - 1
                    + monthsToAdd,
                1,
            )
        )

    const targetYear =
        base.getUTCFullYear()

    const targetMonth =
        base.getUTCMonth()

    const lastDay =
        new Date(
            Date.UTC(
                targetYear,
                targetMonth + 1,
                0,
            )
        ).getUTCDate()

    const targetDay =
        Math.min(
            day,
            lastDay,
        )

    return [
        targetYear,
        String(
            targetMonth + 1
        ).padStart(2, '0'),
        String(
            targetDay
        ).padStart(2, '0'),
    ].join('-')
}


function splitAmount(
    totalCents,
    count,
) {
    const base =
        Math.floor(
            totalCents / count
        )

    let remainder =
        totalCents
        - (base * count)

    return Array.from(
        {
            length: count,
        },
        () => {
            const extra =
                remainder > 0
                    ? 1
                    : 0

            if (remainder > 0) {
                remainder -= 1
            }

            return base + extra
        },
    )
}


async function resolveSupplier({
    supplierId,
    supplierName,
}) {
    const db = getClient()

    const parsedId =
        parseInteger(
            supplierId,
            0,
        )

    if (parsedId > 0) {
        const result =
            await db.execute({
                sql: `
                    SELECT id, name
                    FROM party_suppliers
                    WHERE id = ?
                    LIMIT 1
                `,
                args: [
                    parsedId,
                ],
            })

        if (result.rows[0]) {
            return {
                id:
                    Number(
                        result.rows[0].id
                    ),

                name:
                    String(
                        result.rows[0].name
                    ),
            }
        }
    }

    const name =
        cleanText(
            supplierName
        )

    if (!name) {
        return {
            id: null,
            name: '',
        }
    }

    const result =
        await db.execute({
            sql: `
                SELECT id, name
                FROM party_suppliers
                WHERE lower(name) = lower(?)
                LIMIT 1
            `,
            args: [
                name,
            ],
        })

    if (result.rows[0]) {
        return {
            id:
                Number(
                    result.rows[0].id
                ),

            name:
                String(
                    result.rows[0].name
                ),
        }
    }

    return {
        id: null,
        name,
    }
}


async function generateInstallments({
    expenseId,
    totalAmountCents,
    installmentCount,
    firstDueDate,
}) {
    const db = getClient()

    await db.execute({
        sql: `
            DELETE FROM party_expense_installments
            WHERE expense_id = ?
        `,
        args: [
            expenseId,
        ],
    })

    if (!firstDueDate) {
        return
    }

    const count =
        Math.max(
            Math.min(
                installmentCount,
                36,
            ),
            1,
        )

    const amounts =
        splitAmount(
            totalAmountCents,
            count,
        )

    for (
        let index = 0;
        index < count;
        index += 1
    ) {
        await db.execute({
            sql: `
                INSERT INTO party_expense_installments (
                    expense_id,
                    installment_number,
                    description,
                    amount_cents,
                    due_date
                )
                VALUES (?, ?, ?, ?, ?)
            `,
            args: [
                expenseId,
                index + 1,
                `Parcela ${index + 1}/${count}`,
                amounts[index],
                addMonthsIso(
                    firstDueDate,
                    index,
                ),
            ],
        })
    }
}


async function getSummary() {
    const db = getClient()

    const settingsResult =
        await db.execute(`
            SELECT
                budget_limit_cents
            FROM party_finance_settings
            WHERE id = 1
            LIMIT 1
        `)

    const suppliersResult =
        await db.execute(`
            SELECT
                id,
                name,
                contact_name,
                whatsapp,
                instagram,
                email,
                document,
                service,
                notes
            FROM party_suppliers
            ORDER BY name
        `)

    const expensesResult =
        await db.execute(`
            SELECT
                e.id,
                e.description,
                e.category,
                e.supplier,
                e.supplier_id,
                e.budget_amount_cents,
                e.total_amount_cents,
                e.installment_count,
                e.due_date,
                e.requires_signal,
                e.signal_type,
                e.signal_amount_cents,
                e.signal_percent,
                e.signal_due_date,
                e.signal_notes,
                e.reservation_confirmed,
                e.reservation_confirmed_at,
                e.contract_status,
                e.notes,
                e.created_at,
                e.updated_at
            FROM party_expenses e
            ORDER BY
                CASE
                    WHEN e.due_date IS NULL
                      OR e.due_date = ''
                    THEN 1
                    ELSE 0
                END,
                e.due_date,
                e.id DESC
        `)

    const installmentsResult =
        await db.execute(`
            SELECT
                id,
                expense_id,
                installment_number,
                description,
                amount_cents,
                due_date
            FROM party_expense_installments
            ORDER BY
                expense_id,
                installment_number
        `)

    const paymentsResult =
        await db.execute(`
            SELECT
                id,
                expense_id,
                installment_id,
                payment_type,
                amount_cents,
                paid_at,
                payment_method,
                notes,
                created_at
            FROM party_expense_payments
            ORDER BY
                paid_at DESC,
                id DESC
        `)

    const today =
        getTodayIso()

    const paymentsByExpense =
        new Map()

    for (
        const row
        of paymentsResult.rows
    ) {
        const expenseId =
            Number(
                row.expense_id
            )

        if (
            !paymentsByExpense
                .has(expenseId)
        ) {
            paymentsByExpense.set(
                expenseId,
                [],
            )
        }

        paymentsByExpense
            .get(expenseId)
            .push({
                id:
                    Number(row.id),

                installmentId:
                    row.installment_id
                        ? Number(
                            row.installment_id
                        )
                        : null,

                amountCents:
                    Number(
                        row.amount_cents
                        || 0
                    ),

                paymentType:
                    normalizePaymentType(
                        row.payment_type
                    ),

                paidAt:
                    row.paid_at || '',

                paymentMethod:
                    row.payment_method
                    || '',

                notes:
                    row.notes || '',
            })
    }

    const installmentsByExpense =
        new Map()

    for (
        const row
        of installmentsResult.rows
    ) {
        const expenseId =
            Number(
                row.expense_id
            )

        if (
            !installmentsByExpense
                .has(expenseId)
        ) {
            installmentsByExpense
                .set(
                    expenseId,
                    [],
                )
        }

        installmentsByExpense
            .get(expenseId)
            .push({
                id:
                    Number(row.id),

                installmentNumber:
                    Number(
                        row.installment_number
                    ),

                description:
                    row.description
                    || '',

                amountCents:
                    Number(
                        row.amount_cents
                        || 0
                    ),

                dueDate:
                    row.due_date
                    || '',
            })
    }

    const supplierById =
        new Map(
            suppliersResult.rows.map(
                (row) => [
                    Number(row.id),
                    row,
                ]
            )
        )

    const expenses =
        expensesResult.rows.map(
            (row) => {
                const id =
                    Number(row.id)

                const total =
                    Number(
                        row.total_amount_cents
                        || 0
                    )

                const budgetAmount =
                    Number(
                        row.budget_amount_cents
                        || 0
                    )

                const payments =
                    paymentsByExpense
                        .get(id)
                    || []

                const paid =
                    payments.reduce(
                        (
                            sum,
                            payment,
                        ) => (
                            sum
                            + payment.amountCents
                        ),
                        0,
                    )

                const remaining =
                    Math.max(
                        total - paid,
                        0,
                    )

                const rawInstallments =
                    installmentsByExpense
                        .get(id)
                    || []

                const explicitPayments =
                    new Map()

                let generalPaymentPool = 0

                for (
                    const payment
                    of payments
                ) {
                    if (
                        payment.installmentId
                    ) {
                        explicitPayments.set(
                            payment.installmentId,
                            (
                                explicitPayments
                                    .get(
                                        payment.installmentId
                                    )
                                || 0
                            )
                            + payment.amountCents,
                        )
                    } else if (
                        payment.paymentType
                        !== 'sinal'
                    ) {
                        generalPaymentPool +=
                            payment.amountCents
                    }
                }

                const installments =
                    rawInstallments.map(
                        (installment) => {
                            const explicitPaid =
                                explicitPayments
                                    .get(
                                        installment.id
                                    )
                                || 0

                            const room =
                                Math.max(
                                    installment
                                        .amountCents
                                    - explicitPaid,
                                    0,
                                )

                            const allocated =
                                Math.min(
                                    room,
                                    generalPaymentPool,
                                )

                            generalPaymentPool -=
                                allocated

                            const installmentPaid =
                                explicitPaid
                                + allocated

                            const installmentRemaining =
                                Math.max(
                                    installment
                                        .amountCents
                                    - installmentPaid,
                                    0,
                                )

                            let installmentStatus =
                                'pendente'

                            if (
                                installmentRemaining
                                === 0
                            ) {
                                installmentStatus =
                                    'pago'
                            } else if (
                                installment.dueDate
                                && installment.dueDate
                                    < today
                            ) {
                                installmentStatus =
                                    'vencido'
                            } else if (
                                installmentPaid
                                > 0
                            ) {
                                installmentStatus =
                                    'parcial'
                            }

                            return {
                                ...installment,

                                paidAmountCents:
                                    installmentPaid,

                                remainingAmountCents:
                                    installmentRemaining,

                                status:
                                    installmentStatus,
                            }
                        }
                    )

                let overdueAmountCents = 0

                if (
                    installments.length > 0
                ) {
                    overdueAmountCents =
                        installments
                            .filter(
                                (installment) => (
                                    installment.status
                                    === 'vencido'
                                )
                            )
                            .reduce(
                                (
                                    sum,
                                    installment,
                                ) => (
                                    sum
                                    + installment
                                        .remainingAmountCents
                                ),
                                0,
                            )
                } else if (
                    remaining > 0
                    && row.due_date
                    && row.due_date
                        < today
                ) {
                    overdueAmountCents =
                        remaining
                }

                const requiresSignal =
                    Number(
                        row.requires_signal
                        || 0
                    ) === 1

                const signalType =
                    normalizeSignalType(
                        row.signal_type
                    )

                const signalAmountCents =
                    calculateSignalAmountCents({
                        totalAmountCents:
                            total,
                        requiresSignal,
                        signalType,
                        signalAmountCents:
                            Number(
                                row.signal_amount_cents
                                || 0
                            ),
                        signalPercent:
                            Number(
                                row.signal_percent
                                || 0
                            ),
                    })

                const signalPaidAmountCents =
                    payments
                        .filter(
                            (payment) => (
                                payment.paymentType
                                === 'sinal'
                            )
                        )
                        .reduce(
                            (sum, payment) => (
                                sum
                                + payment.amountCents
                            ),
                            0,
                        )

                const signalRemainingAmountCents =
                    Math.max(
                        signalAmountCents
                        - signalPaidAmountCents,
                        0,
                    )

                const signalDueDate =
                    row.signal_due_date
                    || ''

                let signalStatus =
                    requiresSignal
                        ? 'aguardando_sinal'
                        : 'sem_sinal'

                if (
                    requiresSignal
                    && signalAmountCents > 0
                    && signalRemainingAmountCents === 0
                ) {
                    signalStatus = 'sinal_pago'
                } else if (
                    requiresSignal
                    && signalPaidAmountCents > 0
                ) {
                    signalStatus = 'sinal_parcial'
                }

                const contractStatus =
                    String(
                        row.contract_status
                        || 'active'
                    ) === 'cancelled'
                        ? 'cancelled'
                        : 'active'

                let status =
                    contractStatus === 'cancelled'
                        ? 'cancelado'
                        : 'pendente'

                if (contractStatus !== 'cancelled') {
                    if (
                        total > 0
                        && remaining === 0
                    ) {
                        status = 'pago'
                    } else if (
                        requiresSignal
                        && signalRemainingAmountCents > 0
                        && signalDueDate
                        && signalDueDate < today
                    ) {
                        status = 'sinal_vencido'
                    } else if (
                        requiresSignal
                        && signalRemainingAmountCents > 0
                    ) {
                        status = signalPaidAmountCents > 0
                            ? 'sinal_parcial'
                            : 'aguardando_sinal'
                    } else if (
                        overdueAmountCents > 0
                    ) {
                        status = 'vencido'
                    } else if (
                        paid > 0
                    ) {
                        status = 'parcial'
                    }
                }

                const supplierId =
                    row.supplier_id
                        ? Number(
                            row.supplier_id
                        )
                        : null

                const supplierRow =
                    supplierId
                        ? supplierById
                            .get(
                                supplierId
                            )
                        : null

                const nextInstallment =
                    installments.find(
                        (installment) => (
                            installment
                                .remainingAmountCents
                            > 0
                        )
                    )

                return {
                    id,

                    description:
                        row.description,

                    category:
                        row.category || '',

                    supplierId,

                    supplier:
                        supplierRow?.name
                        || row.supplier
                        || '',

                    budgetAmountCents:
                        budgetAmount,

                    totalAmountCents:
                        total,

                    paidAmountCents:
                        paid,

                    remainingAmountCents:
                        remaining,

                    overdueAmountCents,

                    installmentCount:
                        Number(
                            row.installment_count
                            || 1
                        ),

                    dueDate:
                        row.due_date
                        || '',

                    requiresSignal,

                    signalType,

                    signalAmountCents,

                    signalPercent:
                        Number(
                            row.signal_percent
                            || 0
                        ),

                    signalDueDate,

                    signalNotes:
                        row.signal_notes
                        || '',

                    signalPaidAmountCents,

                    signalRemainingAmountCents,

                    signalStatus,

                    reservationConfirmed:
                        Number(
                            row.reservation_confirmed
                            || 0
                        ) === 1,

                    reservationConfirmedAt:
                        row.reservation_confirmed_at
                        || '',

                    contractStatus,

                    nextDueDate:
                        nextInstallment
                            ?.dueDate
                        || (
                            remaining > 0
                                ? (
                                    row.due_date
                                    || ''
                                )
                                : ''
                        ),

                    notes:
                        row.notes || '',

                    status,

                    payments,

                    installments,
                }
            }
        )

    const budgetLimit =
        Number(
            settingsResult
                .rows[0]
                ?.budget_limit_cents
            || 0
        )

    const activeExpenses =
        expenses.filter(
            (expense) => (
                expense.contractStatus
                !== 'cancelled'
            )
        )

    const totals =
        activeExpenses.reduce(
            (
                summary,
                expense,
            ) => {
                summary.budgeted +=
                    expense
                        .budgetAmountCents

                summary.total +=
                    expense
                        .totalAmountCents

                summary.paid +=
                    expense
                        .paidAmountCents

                summary.remaining +=
                    expense
                        .remainingAmountCents

                summary.overdue +=
                    expense
                        .overdueAmountCents

                return summary
            },
            {
                budgeted: 0,
                total: 0,
                paid: 0,
                remaining: 0,
                overdue: 0,
            },
        )

    totals.budgetLimit =
        budgetLimit

    totals.budgetRemaining =
        budgetLimit > 0
            ? (
                budgetLimit
                - totals.total
            )
            : 0

    totals.budgetDifference =
        totals.budgeted
        - totals.total

    totals.contractsActive =
        activeExpenses.length

    totals.contractsCancelled =
        expenses.length
        - activeExpenses.length

    totals.signalContracts =
        activeExpenses.filter(
            (expense) => (
                expense.requiresSignal
            )
        ).length

    totals.signalAmount =
        activeExpenses.reduce(
            (sum, expense) => (
                sum
                + expense.signalAmountCents
            ),
            0,
        )

    totals.signalPaid =
        activeExpenses.reduce(
            (sum, expense) => (
                sum
                + Math.min(
                    expense.signalPaidAmountCents,
                    expense.signalAmountCents,
                )
            ),
            0,
        )

    totals.signalPending =
        activeExpenses.reduce(
            (sum, expense) => (
                sum
                + expense.signalRemainingAmountCents
            ),
            0,
        )

    totals.signalOverdue =
        activeExpenses.reduce(
            (sum, expense) => (
                sum
                + (
                    expense.requiresSignal
                    && expense.signalRemainingAmountCents > 0
                    && expense.signalDueDate
                    && expense.signalDueDate < today
                        ? expense.signalRemainingAmountCents
                        : 0
                )
            ),
            0,
        )

    totals.reservationsPending =
        activeExpenses.filter(
            (expense) => (
                expense.requiresSignal
                && !expense.reservationConfirmed
            )
        ).length

    const upcoming = []

    for (const expense of activeExpenses) {
        if (
            expense.installments
                .length > 0
        ) {
            for (
                const installment
                of expense.installments
            ) {
                if (
                    installment
                        .remainingAmountCents
                    <= 0
                    || !installment.dueDate
                    || installment.dueDate
                        < today
                ) {
                    continue
                }

                upcoming.push({
                    expenseId:
                        expense.id,

                    expenseDescription:
                        expense.description,

                    supplier:
                        expense.supplier,

                    installmentId:
                        installment.id,

                    description:
                        installment.description,

                    dueDate:
                        installment.dueDate,

                    amountCents:
                        installment
                            .remainingAmountCents,
                })
            }

            continue
        }

        if (
            expense
                .remainingAmountCents
            > 0
            && expense.dueDate
            && expense.dueDate
                >= today
        ) {
            upcoming.push({
                expenseId:
                    expense.id,

                expenseDescription:
                    expense.description,

                supplier:
                    expense.supplier,

                installmentId:
                    null,

                description:
                    'Pagamento',

                dueDate:
                    expense.dueDate,

                amountCents:
                    expense
                        .remainingAmountCents,
            })
        }
    }

    upcoming.sort(
        (left, right) => (
            left.dueDate.localeCompare(
                right.dueDate
            )
        )
    )

    const categoryMap =
        new Map()

    for (const expense of activeExpenses) {
        const category =
            expense.category
            || 'Sem categoria'

        if (!categoryMap.has(category)) {
            categoryMap.set(
                category,
                {
                    category,
                    budgetedAmountCents:
                        0,
                    contractedAmountCents:
                        0,
                    paidAmountCents:
                        0,
                    remainingAmountCents:
                        0,
                }
            )
        }

        const item =
            categoryMap.get(
                category
            )

        item.budgetedAmountCents +=
            expense
                .budgetAmountCents

        item.contractedAmountCents +=
            expense
                .totalAmountCents

        item.paidAmountCents +=
            expense
                .paidAmountCents

        item.remainingAmountCents +=
            expense
                .remainingAmountCents
    }

    const supplierTotals =
        new Map()

    for (const expense of activeExpenses) {
        if (!expense.supplierId) {
            continue
        }

        if (
            !supplierTotals
                .has(
                    expense.supplierId
                )
        ) {
            supplierTotals.set(
                expense.supplierId,
                {
                    contractedAmountCents:
                        0,
                    paidAmountCents:
                        0,
                    remainingAmountCents:
                        0,
                },
            )
        }

        const supplierTotal =
            supplierTotals.get(
                expense.supplierId
            )

        supplierTotal
            .contractedAmountCents +=
            expense
                .totalAmountCents

        supplierTotal
            .paidAmountCents +=
            expense
                .paidAmountCents

        supplierTotal
            .remainingAmountCents +=
            expense
                .remainingAmountCents
    }

    const suppliers =
        suppliersResult.rows.map(
            (row) => {
                const id =
                    Number(row.id)

                const supplierTotal =
                    supplierTotals.get(id)
                    || {
                        contractedAmountCents:
                            0,
                        paidAmountCents:
                            0,
                        remainingAmountCents:
                            0,
                    }

                return {
                    id,

                    name:
                        row.name,

                    contactName:
                        row.contact_name
                        || '',

                    whatsapp:
                        row.whatsapp
                        || '',

                    instagram:
                        row.instagram
                        || '',

                    email:
                        row.email
                        || '',

                    document:
                        row.document
                        || '',

                    service:
                        row.service
                        || '',

                    notes:
                        row.notes
                        || '',

                    ...supplierTotal,
                }
            }
        )

    const tasksResult =
        await db.execute(`
            SELECT
                id,
                title,
                category,
                responsible,
                priority,
                due_date,
                completed,
                notes
            FROM party_tasks
            ORDER BY
                completed,
                CASE priority
                    WHEN 'alta' THEN 1
                    WHEN 'media' THEN 2
                    ELSE 3
                END,
                CASE
                    WHEN due_date IS NULL
                      OR due_date = ''
                    THEN 1
                    ELSE 0
                END,
                due_date,
                id DESC
        `)

    const timelineResult =
        await db.execute(`
            SELECT
                id,
                event_time,
                title,
                responsible,
                location,
                notes,
                sort_order
            FROM party_timeline
            ORDER BY
                event_time,
                sort_order,
                id
        `)

    const shoppingResult =
        await db.execute(`
            SELECT
                id,
                item_name,
                category,
                quantity,
                unit,
                unit_price_cents,
                store,
                responsible,
                purchased,
                notes
            FROM party_shopping_items
            ORDER BY
                purchased,
                category,
                item_name
        `)

    const tasks =
        tasksResult.rows.map(
            (row) => ({
                id:
                    Number(row.id),

                title:
                    row.title,

                category:
                    row.category || '',

                responsible:
                    row.responsible || '',

                priority:
                    row.priority || 'media',

                dueDate:
                    row.due_date || '',

                completed:
                    Number(
                        row.completed
                        || 0
                    ) === 1,

                notes:
                    row.notes || '',
            })
        )

    const timeline =
        timelineResult.rows.map(
            (row) => ({
                id:
                    Number(row.id),

                eventTime:
                    row.event_time
                    || '',

                title:
                    row.title,

                responsible:
                    row.responsible
                    || '',

                location:
                    row.location
                    || '',

                notes:
                    row.notes
                    || '',

                sortOrder:
                    Number(
                        row.sort_order
                        || 0
                    ),
            })
        )

    const shoppingItems =
        shoppingResult.rows.map(
            (row) => {
                const quantity =
                    Number(
                        row.quantity
                        || 0
                    )

                const unitPrice =
                    Number(
                        row.unit_price_cents
                        || 0
                    )

                return {
                    id:
                        Number(row.id),

                    itemName:
                        row.item_name,

                    category:
                        row.category
                        || '',

                    quantity,

                    unit:
                        row.unit || '',

                    unitPriceCents:
                        unitPrice,

                    totalPriceCents:
                        Math.round(
                            quantity
                            * unitPrice
                        ),

                    store:
                        row.store || '',

                    responsible:
                        row.responsible
                        || '',

                    purchased:
                        Number(
                            row.purchased
                            || 0
                        ) === 1,

                    notes:
                        row.notes || '',
                }
            }
        )

    const management = {
        tasksTotal:
            tasks.length,

        tasksCompleted:
            tasks.filter(
                (task) => (
                    task.completed
                )
            ).length,

        tasksPending:
            tasks.filter(
                (task) => (
                    !task.completed
                )
            ).length,

        tasksOverdue:
            tasks.filter(
                (task) => (
                    !task.completed
                    && task.dueDate
                    && task.dueDate
                        < today
                )
            ).length,

        timelineTotal:
            timeline.length,

        shoppingTotal:
            shoppingItems.length,

        shoppingPurchased:
            shoppingItems.filter(
                (item) => (
                    item.purchased
                )
            ).length,

        shoppingPending:
            shoppingItems.filter(
                (item) => (
                    !item.purchased
                )
            ).length,

        shoppingEstimatedCents:
            shoppingItems.reduce(
                (sum, item) => (
                    sum
                    + item.totalPriceCents
                ),
                0,
            ),

        shoppingPurchasedCents:
            shoppingItems
                .filter(
                    (item) => (
                        item.purchased
                    )
                )
                .reduce(
                    (sum, item) => (
                        sum
                        + item.totalPriceCents
                    ),
                    0,
                ),
    }

    return {
        totals,
        expenses,
        suppliers,
        tasks,
        timeline,
        shoppingItems,
        management,

        categories:
            [...categoryMap.values()]
                .sort(
                    (
                        left,
                        right,
                    ) => (
                        right
                            .contractedAmountCents
                        - left
                            .contractedAmountCents
                    )
                ),

        upcoming:
            upcoming.slice(0, 12),

        today,
    }
}


async function saveBudget(body) {
    const amountCents =
        parseMoneyToCents(
            body.budgetLimit,
            {
                allowEmpty: true,
            },
        )

    if (amountCents === null) {
        return {
            error:
                'Informe um orçamento válido.',
        }
    }

    await getClient().execute({
        sql: `
            INSERT INTO party_finance_settings (
                id,
                budget_limit_cents,
                updated_at
            )
            VALUES (
                1,
                ?,
                datetime('now')
            )
            ON CONFLICT(id)
            DO UPDATE SET
                budget_limit_cents =
                    excluded.budget_limit_cents,
                updated_at =
                    datetime('now')
        `,
        args: [
            amountCents,
        ],
    })

    return {
        message:
            'Orçamento da festa atualizado.',
    }
}


async function saveSupplier(body) {
    const db = getClient()

    const id =
        parseInteger(
            body.id,
            0,
        )

    const name =
        cleanText(
            body.name
        )

    if (name.length < 2) {
        return {
            error:
                'Informe o nome do fornecedor.',
        }
    }

    const fields = [
        name,
        cleanText(
            body.contactName
        ),
        cleanText(
            body.whatsapp
        ),
        cleanText(
            body.instagram
        ),
        cleanText(
            body.email
        ),
        cleanText(
            body.document
        ),
        cleanText(
            body.service
        ),
        cleanText(
            body.notes
        ),
    ]

    try {
        if (id > 0) {
            await db.execute({
                sql: `
                    UPDATE party_suppliers
                    SET
                        name = ?,
                        contact_name = ?,
                        whatsapp = ?,
                        instagram = ?,
                        email = ?,
                        document = ?,
                        service = ?,
                        notes = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `,
                args: [
                    ...fields,
                    id,
                ],
            })

            await db.execute({
                sql: `
                    UPDATE party_expenses
                    SET supplier = ?
                    WHERE supplier_id = ?
                `,
                args: [
                    name,
                    id,
                ],
            })

            return {
                message:
                    'Fornecedor atualizado.',
            }
        }

        await db.execute({
            sql: `
                INSERT INTO party_suppliers (
                    name,
                    contact_name,
                    whatsapp,
                    instagram,
                    email,
                    document,
                    service,
                    notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: fields,
        })

        return {
            message:
                'Fornecedor cadastrado.',
        }
    } catch (error) {
        if (
            String(
                error?.message || ''
            )
                .toLowerCase()
                .includes('unique')
        ) {
            return {
                error:
                    'Já existe um fornecedor com esse nome.',
            }
        }

        throw error
    }
}


async function deleteSupplier(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    if (id <= 0) {
        return {
            error:
                'Fornecedor inválido.',
        }
    }

    const db = getClient()

    const used =
        await db.execute({
            sql: `
                SELECT COUNT(*) AS total
                FROM party_expenses
                WHERE supplier_id = ?
            `,
            args: [
                id,
            ],
        })

    if (
        Number(
            used.rows[0]?.total
            || 0
        ) > 0
    ) {
        return {
            error:
                'Este fornecedor está vinculado a despesas. Remova ou altere os vínculos antes de excluir.',
        }
    }

    await db.execute({
        sql: `
            DELETE FROM party_suppliers
            WHERE id = ?
        `,
        args: [
            id,
        ],
    })

    return {
        message:
            'Fornecedor excluído.',
    }
}


async function saveExpense(body) {
    const db = getClient()

    const id =
        parseInteger(
            body.id,
            0,
        )

    const description =
        cleanText(
            body.description
        )

    const budgetAmountCents =
        parseMoneyToCents(
            body.budgetAmount,
            {
                allowEmpty: true,
            },
        )

    const totalAmountCents =
        parseMoneyToCents(
            body.totalAmount
        )

    const initialPaidAmountCents =
        parseMoneyToCents(
            body.initialPaidAmount,
            {
                allowEmpty: true,
            },
        )

    const installmentCount =
        Math.max(
            Math.min(
                parseInteger(
                    body.installmentCount,
                    1,
                ),
                36,
            ),
            1,
        )

    const dueDate =
        cleanText(
            body.dueDate
        )

    if (
        description.length < 2
    ) {
        return {
            error:
                'Informe a descrição da despesa.',
        }
    }

    if (
        budgetAmountCents === null
    ) {
        return {
            error:
                'Informe um valor orçado válido.',
        }
    }

    if (
        totalAmountCents === null
        || totalAmountCents <= 0
    ) {
        return {
            error:
                'Informe um valor contratado válido.',
        }
    }

    if (
        installmentCount > 1
        && !dueDate
    ) {
        return {
            error:
                'Informe o primeiro vencimento para gerar as parcelas.',
        }
    }

    if (
        initialPaidAmountCents === null
    ) {
        return {
            error:
                'Informe um valor já pago válido.',
        }
    }

    if (
        initialPaidAmountCents
        > totalAmountCents
    ) {
        return {
            error:
                'O valor já pago não pode ultrapassar o valor contratado.',
        }
    }

    const requiresSignal =
        isTruthy(
            body.requiresSignal
        )

    const signalType =
        normalizeSignalType(
            body.signalType
        )

    const signalAmountCents =
        parseMoneyToCents(
            body.signalAmount,
            {
                allowEmpty: true,
            },
        )

    const signalPercent =
        parseDecimal(
            body.signalPercent,
            0,
        )

    const signalDueDate =
        cleanText(
            body.signalDueDate
        )

    if (
        signalAmountCents === null
    ) {
        return {
            error:
                'Informe um valor de sinal valido.',
        }
    }

    if (
        requiresSignal
        && signalType === 'fixed'
        && (
            signalAmountCents <= 0
            || signalAmountCents > totalAmountCents
        )
    ) {
        return {
            error:
                'O sinal deve ser maior que zero e nao pode superar o contrato.',
        }
    }

    if (
        requiresSignal
        && signalType === 'percent'
        && (
            signalPercent <= 0
            || signalPercent > 100
        )
    ) {
        return {
            error:
                'O percentual do sinal deve ficar entre 0 e 100.',
        }
    }

    const expectedSignalAmountCents =
        calculateSignalAmountCents({
            totalAmountCents,
            requiresSignal,
            signalType,
            signalAmountCents,
            signalPercent,
        })

    const installmentBaseAmountCents =
        Math.max(
            totalAmountCents
            - expectedSignalAmountCents,
            0,
        )

    const reservationConfirmed =
        isTruthy(
            body.reservationConfirmed
        )

    const supplier =
        await resolveSupplier({
            supplierId:
                body.supplierId,

            supplierName:
                body.supplier,
        })

    if (id > 0) {
        const paidResult =
            await db.execute({
                sql: `
                    SELECT
                        COALESCE(
                            SUM(amount_cents),
                            0
                        ) AS paid
                    FROM party_expense_payments
                    WHERE expense_id = ?
                `,
                args: [
                    id,
                ],
            })

        const alreadyPaid =
            Number(
                paidResult
                    .rows[0]
                    ?.paid
                || 0
            )

        if (
            totalAmountCents
            < alreadyPaid
        ) {
            return {
                error:
                    'O valor contratado não pode ficar abaixo do total já pago.',
            }
        }

        await db.execute({
            sql: `
                UPDATE party_expenses
                SET
                    description = ?,
                    category = ?,
                    supplier = ?,
                    supplier_id = ?,
                    budget_amount_cents = ?,
                    total_amount_cents = ?,
                    installment_count = ?,
                    due_date = ?,
                    requires_signal = ?,
                    signal_type = ?,
                    signal_amount_cents = ?,
                    signal_percent = ?,
                    signal_due_date = ?,
                    signal_notes = ?,
                    reservation_confirmed = ?,
                    reservation_confirmed_at = ?,
                    notes = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `,
            args: [
                description,
                cleanText(
                    body.category
                ),
                supplier.name,
                supplier.id,
                budgetAmountCents,
                totalAmountCents,
                installmentCount,
                dueDate,
                requiresSignal ? 1 : 0,
                signalType,
                signalType === 'fixed'
                    ? expectedSignalAmountCents
                    : 0,
                signalType === 'percent'
                    ? signalPercent
                    : 0,
                signalDueDate,
                cleanText(
                    body.signalNotes
                ),
                reservationConfirmed ? 1 : 0,
                reservationConfirmed
                    ? cleanText(
                        body.reservationConfirmedAt
                    )
                    : '',
                cleanText(
                    body.notes
                ),
                id,
            ],
        })

        return {
            message:
                'Despesa atualizada.',
        }
    }

    const insertResult =
        await db.execute({
            sql: `
                INSERT INTO party_expenses (
                    description,
                    category,
                    supplier,
                    supplier_id,
                    budget_amount_cents,
                    total_amount_cents,
                    installment_count,
                    due_date,
                    requires_signal,
                    signal_type,
                    signal_amount_cents,
                    signal_percent,
                    signal_due_date,
                    signal_notes,
                    reservation_confirmed,
                    reservation_confirmed_at,
                    notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
            `,
            args: [
                description,
                cleanText(
                    body.category
                ),
                supplier.name,
                supplier.id,
                budgetAmountCents,
                totalAmountCents,
                installmentCount,
                dueDate,
                requiresSignal ? 1 : 0,
                signalType,
                signalType === 'fixed'
                    ? expectedSignalAmountCents
                    : 0,
                signalType === 'percent'
                    ? signalPercent
                    : 0,
                signalDueDate,
                cleanText(
                    body.signalNotes
                ),
                reservationConfirmed ? 1 : 0,
                reservationConfirmed
                    ? cleanText(
                        body.reservationConfirmedAt
                    )
                    : '',
                cleanText(
                    body.notes
                ),
            ],
        })

    const expenseId =
        Number(
            insertResult
                .rows[0]
                ?.id
            || 0
        )

    if (!expenseId) {
        throw new Error(
            'Não foi possível identificar a nova despesa.'
        )
    }

    await generateInstallments({
        expenseId,
        totalAmountCents:
            installmentBaseAmountCents,
        installmentCount,
        firstDueDate:
            dueDate,
    })

    if (
        initialPaidAmountCents > 0
    ) {
        await db.execute({
            sql: `
                INSERT INTO party_expense_payments (
                    expense_id,
                    installment_id,
                    payment_type,
                    amount_cents,
                    paid_at,
                    payment_method,
                    notes
                )
                VALUES (?, NULL, ?, ?, ?, ?, ?)
            `,
            args: [
                expenseId,
                normalizePaymentType(
                    body.initialPaymentType
                ),
                initialPaidAmountCents,

                cleanText(
                    body.initialPaymentDate
                ) || getTodayIso(),

                cleanText(
                    body.initialPaymentMethod
                ),

                cleanText(
                    body.initialPaymentNotes
                ),
            ],
        })
    }

    return {
        message:
            initialPaidAmountCents > 0
                ? 'Despesa e pagamento inicial cadastrados.'
                : 'Despesa cadastrada.',
    }
}


async function regenerateInstallments(
    body,
) {
    const db = getClient()

    const expenseId =
        parseInteger(
            body.expenseId,
            0,
        )

    if (expenseId <= 0) {
        return {
            error:
                'Despesa inválida.',
        }
    }

    const expenseResult =
        await db.execute({
            sql: `
                SELECT
                    id,
                    total_amount_cents,
                    installment_count,
                    due_date,
                    requires_signal,
                    signal_type,
                    signal_amount_cents,
                    signal_percent
                FROM party_expenses
                WHERE id = ?
                LIMIT 1
            `,
            args: [
                expenseId,
            ],
        })

    const expense =
        expenseResult.rows[0]

    if (!expense) {
        return {
            error:
                'Despesa não encontrada.',
        }
    }

    const linkedPayments =
        await db.execute({
            sql: `
                SELECT COUNT(*) AS total
                FROM party_expense_payments
                WHERE expense_id = ?
                  AND installment_id IS NOT NULL
            `,
            args: [
                expenseId,
            ],
        })

    if (
        Number(
            linkedPayments
                .rows[0]
                ?.total
            || 0
        ) > 0
    ) {
        return {
            error:
                'Existem pagamentos vinculados a parcelas. Remova esses pagamentos antes de refazer o parcelamento.',
        }
    }

    const installmentCount =
        Math.max(
            Math.min(
                parseInteger(
                    body.installmentCount,
                    Number(
                        expense
                            .installment_count
                        || 1
                    ),
                ),
                36,
            ),
            1,
        )

    const dueDate =
        cleanText(
            body.dueDate
        )
        || expense.due_date
        || ''

    if (
        installmentCount > 1
        && !dueDate
    ) {
        return {
            error:
                'Informe o primeiro vencimento.',
        }
    }

    await db.execute({
        sql: `
            UPDATE party_expenses
            SET
                installment_count = ?,
                due_date = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `,
        args: [
            installmentCount,
            dueDate,
            expenseId,
        ],
    })

    await generateInstallments({
        expenseId,

        totalAmountCents:
            Math.max(
                Number(
                    expense
                        .total_amount_cents
                    || 0
                )
                - calculateSignalAmountCents({
                    totalAmountCents:
                        Number(
                            expense
                                .total_amount_cents
                            || 0
                        ),
                    requiresSignal:
                        Number(
                            expense
                                .requires_signal
                            || 0
                        ) === 1,
                    signalType:
                        normalizeSignalType(
                            expense.signal_type
                        ),
                    signalAmountCents:
                        Number(
                            expense
                                .signal_amount_cents
                            || 0
                        ),
                    signalPercent:
                        Number(
                            expense
                                .signal_percent
                            || 0
                        ),
                }),
                0,
            ),

        installmentCount,

        firstDueDate:
            dueDate,
    })

    return {
        message:
            'Parcelas recalculadas.',
    }
}


async function addPayment(body) {
    const expenseId =
        parseInteger(
            body.expenseId,
            0,
        )

    const installmentId =
        parseInteger(
            body.installmentId,
            0,
        )

    const amountCents =
        parseMoneyToCents(
            body.amount
        )

    const paymentType =
        normalizePaymentType(
            body.paymentType
        )

    if (expenseId <= 0) {
        return {
            error:
                'Despesa inválida.',
        }
    }

    if (
        amountCents === null
        || amountCents <= 0
    ) {
        return {
            error:
                'Informe um valor de pagamento válido.',
        }
    }

    const current =
        await getSummary()

    const expense =
        current.expenses.find(
            (item) => (
                item.id
                === expenseId
            )
        )

    if (!expense) {
        return {
            error:
                'Despesa não encontrada.',
        }
    }

    if (
        amountCents
        > expense
            .remainingAmountCents
    ) {
        return {
            error:
                'O pagamento ultrapassa o saldo da despesa.',
        }
    }

    let selectedInstallment =
        null

    if (installmentId > 0) {
        selectedInstallment =
            expense.installments
                .find(
                    (installment) => (
                        installment.id
                        === installmentId
                    )
                )

        if (!selectedInstallment) {
            return {
                error:
                    'Parcela não encontrada.',
            }
        }

        if (
            amountCents
            > selectedInstallment
                .remainingAmountCents
        ) {
            return {
                error:
                    'O pagamento ultrapassa o saldo da parcela selecionada.',
            }
        }
    }

    await getClient().execute({
        sql: `
            INSERT INTO party_expense_payments (
                expense_id,
                installment_id,
                payment_type,
                amount_cents,
                paid_at,
                payment_method,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
            expenseId,

            selectedInstallment
                ?.id
            || null,

            selectedInstallment
                ? 'parcela'
                : paymentType,

            amountCents,

            cleanText(
                body.paidAt
            ) || getTodayIso(),

            cleanText(
                body.paymentMethod
            ),

            cleanText(
                body.notes
            ),
        ],
    })

    return {
        message:
            selectedInstallment
                ? `Pagamento registrado na ${selectedInstallment.description}.`
                : 'Pagamento registrado.',
    }
}


async function updateContractStatus(body) {
    const expenseId =
        parseInteger(
            body.expenseId,
            0,
        )

    const contractStatus =
        String(
            body.contractStatus
            || ''
        ) === 'cancelled'
            ? 'cancelled'
            : 'active'

    if (expenseId <= 0) {
        return {
            error:
                'Contrato inv?lido.',
        }
    }

    await getClient().execute({
        sql: `
            UPDATE party_expenses
            SET
                contract_status = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `,
        args: [
            contractStatus,
            expenseId,
        ],
    })

    return {
        message:
            contractStatus === 'cancelled'
                ? 'Contrato cancelado e mantido no hist?rico.'
                : 'Contrato reativado.',
    }
}


async function deleteExpense(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    if (id <= 0) {
        return {
            error:
                'Despesa inválida.',
        }
    }

    const db = getClient()

    await db.execute({
        sql: `
            DELETE FROM party_expense_payments
            WHERE expense_id = ?
        `,
        args: [id],
    })

    await db.execute({
        sql: `
            DELETE FROM party_expense_installments
            WHERE expense_id = ?
        `,
        args: [id],
    })

    await db.execute({
        sql: `
            DELETE FROM party_expenses
            WHERE id = ?
        `,
        args: [id],
    })

    return {
        message:
            'Despesa excluída.',
    }
}


async function deletePayment(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    if (id <= 0) {
        return {
            error:
                'Pagamento inválido.',
        }
    }

    await getClient().execute({
        sql: `
            DELETE FROM party_expense_payments
            WHERE id = ?
        `,
        args: [id],
    })

    return {
        message:
            'Pagamento removido.',
    }
}


async function saveTask(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    const title =
        cleanText(
            body.title
        )

    if (title.length < 2) {
        return {
            error:
                'Informe a tarefa.',
        }
    }

    const allowedPriorities =
        new Set([
            'baixa',
            'media',
            'alta',
        ])

    const priority =
        allowedPriorities.has(
            cleanText(
                body.priority
            )
        )
            ? cleanText(
                body.priority
            )
            : 'media'

    const values = [
        title,

        cleanText(
            body.category
        ),

        cleanText(
            body.responsible
        ),

        priority,

        cleanText(
            body.dueDate
        ),

        cleanText(
            body.notes
        ),
    ]

    const db = getClient()

    if (id > 0) {
        await db.execute({
            sql: `
                UPDATE party_tasks
                SET
                    title = ?,
                    category = ?,
                    responsible = ?,
                    priority = ?,
                    due_date = ?,
                    notes = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `,
            args: [
                ...values,
                id,
            ],
        })

        return {
            message:
                'Tarefa atualizada.',
        }
    }

    await db.execute({
        sql: `
            INSERT INTO party_tasks (
                title,
                category,
                responsible,
                priority,
                due_date,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: values,
    })

    return {
        message:
            'Tarefa cadastrada.',
    }
}


async function toggleTask(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    if (id <= 0) {
        return {
            error:
                'Tarefa inválida.',
        }
    }

    await getClient().execute({
        sql: `
            UPDATE party_tasks
            SET
                completed = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `,
        args: [
            body.completed
                ? 1
                : 0,
            id,
        ],
    })

    return {
        message:
            body.completed
                ? 'Tarefa concluída.'
                : 'Tarefa reaberta.',
    }
}


async function deleteTask(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    if (id <= 0) {
        return {
            error:
                'Tarefa inválida.',
        }
    }

    await getClient().execute({
        sql: `
            DELETE FROM party_tasks
            WHERE id = ?
        `,
        args: [id],
    })

    return {
        message:
            'Tarefa excluída.',
    }
}


async function saveTimelineItem(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    const eventTime =
        cleanText(
            body.eventTime
        )

    const title =
        cleanText(
            body.title
        )

    if (!eventTime) {
        return {
            error:
                'Informe o horário.',
        }
    }

    if (title.length < 2) {
        return {
            error:
                'Informe a atividade do cronograma.',
        }
    }

    const values = [
        eventTime,
        title,

        cleanText(
            body.responsible
        ),

        cleanText(
            body.location
        ),

        cleanText(
            body.notes
        ),

        parseInteger(
            body.sortOrder,
            0,
        ),
    ]

    const db = getClient()

    if (id > 0) {
        await db.execute({
            sql: `
                UPDATE party_timeline
                SET
                    event_time = ?,
                    title = ?,
                    responsible = ?,
                    location = ?,
                    notes = ?,
                    sort_order = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `,
            args: [
                ...values,
                id,
            ],
        })

        return {
            message:
                'Item do cronograma atualizado.',
        }
    }

    await db.execute({
        sql: `
            INSERT INTO party_timeline (
                event_time,
                title,
                responsible,
                location,
                notes,
                sort_order
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: values,
    })

    return {
        message:
            'Item adicionado ao cronograma.',
    }
}


async function deleteTimelineItem(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    if (id <= 0) {
        return {
            error:
                'Item do cronograma inválido.',
        }
    }

    await getClient().execute({
        sql: `
            DELETE FROM party_timeline
            WHERE id = ?
        `,
        args: [id],
    })

    return {
        message:
            'Item removido do cronograma.',
    }
}


async function saveShoppingItem(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    const itemName =
        cleanText(
            body.itemName
        )

    if (itemName.length < 2) {
        return {
            error:
                'Informe o item da compra.',
        }
    }

    const quantity =
        parseDecimal(
            body.quantity,
            1,
        )

    if (
        !Number.isFinite(quantity)
        || quantity <= 0
    ) {
        return {
            error:
                'Informe uma quantidade válida.',
        }
    }

    const unitPriceCents =
        parseMoneyToCents(
            body.unitPrice,
            {
                allowEmpty: true,
            },
        )

    if (unitPriceCents === null) {
        return {
            error:
                'Informe um preço unitário válido.',
        }
    }

    const values = [
        itemName,

        cleanText(
            body.category
        ),

        quantity,

        cleanText(
            body.unit
        ),

        unitPriceCents,

        cleanText(
            body.store
        ),

        cleanText(
            body.responsible
        ),

        cleanText(
            body.notes
        ),
    ]

    const db = getClient()

    if (id > 0) {
        await db.execute({
            sql: `
                UPDATE party_shopping_items
                SET
                    item_name = ?,
                    category = ?,
                    quantity = ?,
                    unit = ?,
                    unit_price_cents = ?,
                    store = ?,
                    responsible = ?,
                    notes = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `,
            args: [
                ...values,
                id,
            ],
        })

        return {
            message:
                'Item de compra atualizado.',
        }
    }

    await db.execute({
        sql: `
            INSERT INTO party_shopping_items (
                item_name,
                category,
                quantity,
                unit,
                unit_price_cents,
                store,
                responsible,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: values,
    })

    return {
        message:
            'Item adicionado à lista de compras.',
    }
}


async function toggleShoppingItem(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    if (id <= 0) {
        return {
            error:
                'Item de compra inválido.',
        }
    }

    await getClient().execute({
        sql: `
            UPDATE party_shopping_items
            SET
                purchased = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `,
        args: [
            body.purchased
                ? 1
                : 0,
            id,
        ],
    })

    return {
        message:
            body.purchased
                ? 'Item marcado como comprado.'
                : 'Item voltou para pendente.',
    }
}


async function deleteShoppingItem(body) {
    const id =
        parseInteger(
            body.id,
            0,
        )

    if (id <= 0) {
        return {
            error:
                'Item de compra inválido.',
        }
    }

    await getClient().execute({
        sql: `
            DELETE FROM party_shopping_items
            WHERE id = ?
        `,
        args: [id],
    })

    return {
        message:
            'Item removido da lista de compras.',
    }
}


export default async function handler(
    request,
    response,
) {
    response.setHeader(
        'Cache-Control',
        'no-store',
    )

    if (
        request.method !== 'POST'
    ) {
        response.setHeader(
            'Allow',
            'POST',
        )

        return response
            .status(405)
            .json({
                error:
                    'Método não permitido.',
            })
    }

    try {
        const auth =
            verifyExpensesRequest(
                request
            )

        if (!auth.ok) {
            return response
                .status(
                    auth.configError
                        ? 500
                        : 401
                )
                .json({
                    error:
                        auth.error,
                })
        }

        await ensureSchema()

        const body =
            parseBody(
                request.body
            )

        let result = null

        switch (body.action) {
            case 'saveBudget':
                result =
                    await saveBudget(
                        body
                    )
                break

            case 'saveSupplier':
                result =
                    await saveSupplier(
                        body
                    )
                break

            case 'deleteSupplier':
                result =
                    await deleteSupplier(
                        body
                    )
                break

            case 'saveExpense':
                result =
                    await saveExpense(
                        body
                    )
                break

            case 'regenerateInstallments':
                result =
                    await regenerateInstallments(
                        body
                    )
                break

            case 'addPayment':
                result =
                    await addPayment(
                        body
                    )
                break

            case 'updateContractStatus':
                result =
                    await updateContractStatus(
                        body
                    )
                break

            case 'deleteExpense':
                result =
                    await deleteExpense(
                        body
                    )
                break

            case 'deletePayment':
                result =
                    await deletePayment(
                        body
                    )
                break

            case 'saveTask':
                result =
                    await saveTask(
                        body
                    )
                break

            case 'toggleTask':
                result =
                    await toggleTask(
                        body
                    )
                break

            case 'deleteTask':
                result =
                    await deleteTask(
                        body
                    )
                break

            case 'saveTimelineItem':
                result =
                    await saveTimelineItem(
                        body
                    )
                break

            case 'deleteTimelineItem':
                result =
                    await deleteTimelineItem(
                        body
                    )
                break

            case 'saveShoppingItem':
                result =
                    await saveShoppingItem(
                        body
                    )
                break

            case 'toggleShoppingItem':
                result =
                    await toggleShoppingItem(
                        body
                    )
                break

            case 'deleteShoppingItem':
                result =
                    await deleteShoppingItem(
                        body
                    )
                break

            default:
                break
        }

        if (result?.error) {
            return response
                .status(400)
                .json({
                    error:
                        result.error,
                })
        }

        const summary =
            await getSummary()

        return response
            .status(200)
            .json({
                message:
                    result?.message
                    || '',
                ...summary,
            })
    } catch (error) {
        return response
            .status(500)
            .json({
                error:
                    error.message
                    || 'Erro na gestão de despesas.',
            })
    }
}
