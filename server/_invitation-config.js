// Modulo compartilhado; fora de /api para nao gerar funcao serverless.
import {
    DEFAULT_INVITATION_SETTINGS,
    buildInvitationConfig,
    normalizeInvitationSettings,
} from '../shared/invitation-config.js'

import {
    ensureSchema,
    getClient,
} from './_db.js'

function parseStoredSettings(value) {
    try {
        return JSON.parse(
            String(value || '{}'),
        )
    } catch {
        return {}
    }
}

export async function getInvitationConfig() {
    await ensureSchema()

    const [
        settingsResult,
        photosResult,
    ] = await Promise.all([
        getClient().execute(`
            SELECT settings_json
            FROM invitation_settings
            WHERE id = 1
            LIMIT 1
        `),
        getClient().execute(`
            SELECT
                id,
                image_data,
                alt_text,
                object_position,
                is_primary
            FROM invitation_photos
            ORDER BY is_primary DESC, sort_order, id
        `),
    ])

    const storedSettings =
        parseStoredSettings(
            settingsResult.rows[0]
                ?.settings_json,
        )

    const photos =
        photosResult.rows.map((row) => ({
            id: String(row.id),
            src: row.image_data,
            alt: row.alt_text || '',
            objectPosition:
                row.object_position
                || 'center',
            isPrimary:
                Boolean(row.is_primary),
        }))

    return buildInvitationConfig({
        settings: {
            ...DEFAULT_INVITATION_SETTINGS,
            ...storedSettings,
        },
        photos,
    })
}

export async function saveInvitationSettings(value) {
    const settings =
        normalizeInvitationSettings(value)

    await getClient().execute({
        sql: `
            INSERT INTO invitation_settings (
                id,
                settings_json,
                updated_at
            )
            VALUES (1, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                settings_json = excluded.settings_json,
                updated_at = datetime('now')
        `,
        args: [
            JSON.stringify(settings),
        ],
    })

    return settings
}
