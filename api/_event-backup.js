import {
    ensureSchema,
    getClient,
} from './_db.js'

const BACKUP_TABLES = [
    'invited_guests',
    'guest_companions',
    'rsvps',
    'rsvp_companions',
    'guest_checkins',
    'birthday_messages',
    'guest_communications',
    'invitation_settings',
    'party_finance_settings',
    'party_suppliers',
    'party_expenses',
    'party_expense_installments',
    'party_expense_payments',
    'party_documents',
    'party_tasks',
    'party_timeline',
    'party_shopping_items',
]

function backupDateInSaoPaulo() {
    return new Intl.DateTimeFormat(
        'en-CA',
        {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone:
                'America/Sao_Paulo',
        },
    ).format(new Date())
}

export async function createEventBackup({
    source = 'automatic',
    force = false,
} = {}) {
    await ensureSchema()

    const backupDate =
        backupDateInSaoPaulo()

    if (!force) {
        const existing =
            await getClient().execute({
                sql: `
                    SELECT
                        id,
                        backup_date,
                        source,
                        table_counts_json,
                        created_at
                    FROM event_backups
                    WHERE backup_date = ?
                      AND source != 'manual'
                    LIMIT 1
                `,
                args: [backupDate],
            })

        if (existing.rows[0]) {
            return {
                created: false,
                backup:
                    mapBackupRow(
                        existing.rows[0],
                    ),
            }
        }
    }

    const tableSnapshots =
        await Promise.all(
            BACKUP_TABLES.map(
                async (table) => {
                    const result =
                        await getClient()
                            .execute(
                                `SELECT * FROM ${table}`,
                            )

                    const rows =
                        result.rows.map(
                            (row) => ({
                                ...row,
                            }),
                        )

                    return [
                        table,
                        rows,
                    ]
                },
            ),
        )

    const snapshot =
        Object.fromEntries(
            tableSnapshots,
        )

    const counts =
        Object.fromEntries(
            tableSnapshots.map(
                ([table, rows]) => [
                    table,
                    rows.length,
                ],
            ),
        )

    await getClient().execute({
        sql: force
            ? `
                INSERT INTO event_backups (
                    backup_date,
                    source,
                    snapshot_json,
                    table_counts_json,
                    created_at
                )
                VALUES (?, ?, ?, ?, datetime('now'))
            `
            : `
                INSERT OR IGNORE INTO event_backups (
                    backup_date,
                    source,
                    snapshot_json,
                    table_counts_json,
                    created_at
                )
                VALUES (?, ?, ?, ?, datetime('now'))
            `,
        args: [
            backupDate,
            source,
            JSON.stringify(snapshot),
            JSON.stringify(counts),
        ],
    })

    await getClient().execute(`
        DELETE FROM event_backups
        WHERE id NOT IN (
            SELECT id
            FROM event_backups
            ORDER BY backup_date DESC, id DESC
            LIMIT 30
        )
    `)

    const latest =
        await getClient().execute({
            sql: `
                SELECT
                    id,
                    backup_date,
                    source,
                    table_counts_json,
                    created_at
                FROM event_backups
                WHERE backup_date = ?
                  AND (
                    ? = 1
                    OR source != 'manual'
                  )
                ORDER BY id DESC
                LIMIT 1
            `,
            args: [
                backupDate,
                force ? 1 : 0,
            ],
        })

    return {
        created: true,
        backup:
            mapBackupRow(
                latest.rows[0],
            ),
    }
}

function mapBackupRow(row) {
    function parseCounts(value) {
    try {
            return JSON.parse(
                String(value || '{}'),
            )
    } catch {
            return {}
    }
    }

    return {
        id: Number(row?.id || 0),
        backupDate:
            row?.backup_date || '',
        source:
            row?.source || '',
        tableCounts:
            parseCounts(
                row?.table_counts_json,
            ),
        createdAt:
            row?.created_at || '',
    }
}

export async function listEventBackups(
    limit = 10,
) {
    await ensureSchema()

    const result =
        await getClient().execute({
            sql: `
                SELECT
                    id,
                    backup_date,
                    source,
                    table_counts_json,
                    created_at
                FROM event_backups
                ORDER BY backup_date DESC, id DESC
                LIMIT ?
            `,
            args: [
                Math.min(
                    Math.max(
                        Number(limit) || 10,
                        1,
                    ),
                    30,
                ),
            ],
        })

    return result.rows.map(
        mapBackupRow,
    )
}
