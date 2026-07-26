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


function parseMoneyToCents(value) {
    const normalized =
        String(value ?? '')
            .trim()
            .replace(/\./g, '')
            .replace(',', '.')

    const number =
        Number(normalized)

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


async function getSummary() {
    const db = getClient()

    const expensesResult =
        await db.execute(`
            SELECT
                e.id,
                e.description,
                e.category,
                e.supplier,
                e.total_amount_cents,
                e.due_date,
                e.notes,
                e.created_at,
                e.updated_at,
                COALESCE(
                    SUM(p.amount_cents),
                    0
                ) AS paid_amount_cents
            FROM party_expenses e
            LEFT JOIN party_expense_payments p
                ON p.expense_id = e.id
            GROUP BY e.id
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

    const paymentsResult =
        await db.execute(`
            SELECT
                id,
                expense_id,
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

    const paymentsByExpense =
        new Map()

    for (
        const row
        of paymentsResult.rows
    ) {
        const expenseId =
            Number(row.expense_id)

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

                amountCents:
                    Number(
                        row.amount_cents
                        || 0
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

    const today =
        new Intl.DateTimeFormat(
            'en-CA',
            {
                timeZone:
                    'America/Sao_Paulo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }
        ).format(
            new Date()
        )

    const expenses =
        expensesResult.rows.map(
            (row) => {
                const total =
                    Number(
                        row.total_amount_cents
                        || 0
                    )

                const paid =
                    Number(
                        row.paid_amount_cents
                        || 0
                    )

                const remaining =
                    Math.max(
                        total - paid,
                        0,
                    )

                let status =
                    'pendente'

                if (
                    total > 0
                    && paid >= total
                ) {
                    status = 'pago'
                } else if (paid > 0) {
                    status = 'parcial'
                }

                if (
                    remaining > 0
                    && row.due_date
                    && row.due_date < today
                ) {
                    status = 'vencido'
                }

                return {
                    id:
                        Number(row.id),

                    description:
                        row.description,

                    category:
                        row.category || '',

                    supplier:
                        row.supplier || '',

                    totalAmountCents:
                        total,

                    paidAmountCents:
                        paid,

                    remainingAmountCents:
                        remaining,

                    dueDate:
                        row.due_date || '',

                    notes:
                        row.notes || '',

                    status,

                    payments:
                        paymentsByExpense
                            .get(
                                Number(row.id)
                            )
                        || [],
                }
            }
        )

    const totals =
        expenses.reduce(
            (summary, expense) => {
                summary.total +=
                    expense
                        .totalAmountCents

                summary.paid +=
                    expense
                        .paidAmountCents

                summary.remaining +=
                    expense
                        .remainingAmountCents

                if (
                    expense.status
                    === 'vencido'
                ) {
                    summary.overdue +=
                        expense
                            .remainingAmountCents
                }

                return summary
            },
            {
                total: 0,
                paid: 0,
                remaining: 0,
                overdue: 0,
            },
        )

    return {
        totals,
        expenses,
    }
}


async function saveExpense(body) {
    const db = getClient()

    const id =
        Number.parseInt(
            String(body.id || ''),
            10,
        )

    const description =
        cleanText(
            body.description
        )

    const totalAmountCents =
        parseMoneyToCents(
            body.totalAmount
        )

    if (
        description.length < 2
    ) {
        return {
            error:
                'Informe a descricao da despesa.',
        }
    }

    if (
        totalAmountCents === null
        || totalAmountCents <= 0
    ) {
        return {
            error:
                'Informe um valor total valido.',
        }
    }

    const values = [
        description,
        cleanText(
            body.category
        ),
        cleanText(
            body.supplier
        ),
        totalAmountCents,
        cleanText(
            body.dueDate
        ),
        cleanText(
            body.notes
        ),
    ]

    if (
        Number.isInteger(id)
        && id > 0
    ) {
        await db.execute({
            sql: `
                UPDATE party_expenses
                SET
                    description = ?,
                    category = ?,
                    supplier = ?,
                    total_amount_cents = ?,
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
                'Despesa atualizada.',
        }
    }

    await db.execute({
        sql: `
            INSERT INTO party_expenses (
                description,
                category,
                supplier,
                total_amount_cents,
                due_date,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: values,
    })

    return {
        message:
            'Despesa cadastrada.',
    }
}


async function addPayment(body) {
    const db = getClient()

    const expenseId =
        Number.parseInt(
            String(
                body.expenseId || ''
            ),
            10,
        )

    const amountCents =
        parseMoneyToCents(
            body.amount
        )

    if (
        !Number.isInteger(
            expenseId
        )
        || expenseId <= 0
    ) {
        return {
            error:
                'Despesa invalida.',
        }
    }

    if (
        amountCents === null
        || amountCents <= 0
    ) {
        return {
            error:
                'Informe um valor de pagamento valido.',
        }
    }

    const expenseResult =
        await db.execute({
            sql: `
                SELECT
                    total_amount_cents
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
                'Despesa nao encontrada.',
        }
    }

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
                expenseId,
            ],
        })

    const total =
        Number(
            expense.total_amount_cents
            || 0
        )

    const alreadyPaid =
        Number(
            paidResult.rows[0]?.paid
            || 0
        )

    if (
        alreadyPaid
        + amountCents
        > total
    ) {
        return {
            error:
                'O pagamento ultrapassa o saldo da despesa.',
        }
    }

    await db.execute({
        sql: `
            INSERT INTO party_expense_payments (
                expense_id,
                amount_cents,
                paid_at,
                payment_method,
                notes
            )
            VALUES (?, ?, ?, ?, ?)
        `,
        args: [
            expenseId,
            amountCents,
            cleanText(
                body.paidAt
            ) || new Date()
                .toISOString()
                .slice(0, 10),

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
            'Pagamento registrado.',
    }
}


async function deleteExpense(body) {
    const id =
        Number.parseInt(
            String(body.id || ''),
            10,
        )

    if (
        !Number.isInteger(id)
        || id <= 0
    ) {
        return {
            error:
                'Despesa invalida.',
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
            DELETE FROM party_expenses
            WHERE id = ?
        `,
        args: [id],
    })

    return {
        message:
            'Despesa excluida.',
    }
}


async function deletePayment(body) {
    const id =
        Number.parseInt(
            String(body.id || ''),
            10,
        )

    if (
        !Number.isInteger(id)
        || id <= 0
    ) {
        return {
            error:
                'Pagamento invalido.',
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
                    'Metodo nao permitido.',
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
                    error: auth.error,
                })
        }

        await ensureSchema()

        const body =
            parseBody(
                request.body
            )

        let result = null

        if (
            body.action
            === 'saveExpense'
        ) {
            result =
                await saveExpense(
                    body
                )
        }

        if (
            body.action
            === 'addPayment'
        ) {
            result =
                await addPayment(
                    body
                )
        }

        if (
            body.action
            === 'deleteExpense'
        ) {
            result =
                await deleteExpense(
                    body
                )
        }

        if (
            body.action
            === 'deletePayment'
        ) {
            result =
                await deletePayment(
                    body
                )
        }

        if (
            result?.error
        ) {
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
                    || 'Erro na gestao de despesas.',
            })
    }
}
