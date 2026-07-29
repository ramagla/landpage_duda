// Modulo compartilhado; fora de /api para nao gerar funcao serverless.
import {
    ensureSchema,
    getClient,
} from './_db.js'

export async function recordAdminAudit({
    action,
    entityType,
    entityId = '',
    label = '',
    actor = 'admin',
    details = {},
}) {
    await ensureSchema()

    await getClient().execute({
        sql: `
            INSERT INTO admin_audit_log (
                action,
                entity_type,
                entity_id,
                label,
                actor,
                details_json
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
            String(action || 'update'),
            String(entityType || 'event'),
            String(entityId || ''),
            String(label || '').slice(0, 180),
            String(actor || 'admin'),
            JSON.stringify(details || {}),
        ],
    })

    await getClient().execute(`
        DELETE FROM admin_audit_log
        WHERE id NOT IN (
            SELECT id
            FROM admin_audit_log
            ORDER BY created_at DESC, id DESC
            LIMIT 2000
        )
    `)
}

export async function listAdminAudit(limit = 80) {
    await ensureSchema()

    const safeLimit =
        Math.min(
            Math.max(
                Number(limit) || 80,
                1,
            ),
            200,
        )

    const result =
        await getClient().execute({
            sql: `
                SELECT
                    id,
                    action,
                    entity_type,
                    entity_id,
                    label,
                    actor,
                    details_json,
                    created_at
                FROM admin_audit_log
                ORDER BY created_at DESC, id DESC
                LIMIT ?
            `,
            args: [safeLimit],
        })

    function parseDetails(value) {
        try {
            return JSON.parse(
                String(value || '{}'),
            )
        } catch {
            return {}
        }
    }

    return result.rows.map((row) => {
        return {
            id: Number(row.id),
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id || '',
            label: row.label || '',
            actor: row.actor,
            details:
                parseDetails(
                    row.details_json,
                ),
            createdAt: row.created_at,
        }
    })
}
