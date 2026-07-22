CREATE TABLE IF NOT EXISTS invited_guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL,
  age INTEGER,
  whatsapp_digits TEXT,
  max_companions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS invited_guests_whatsapp_unique
  ON invited_guests (whatsapp_digits)
  WHERE whatsapp_digits IS NOT NULL AND whatsapp_digits <> '';

CREATE INDEX IF NOT EXISTS invited_guests_name_index
  ON invited_guests (guest_name);

CREATE TABLE IF NOT EXISTS rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invited_guest_id INTEGER,
  full_name TEXT NOT NULL,
  whatsapp TEXT,
  whatsapp_digits TEXT,
  attending TEXT NOT NULL CHECK (attending IN ('sim', 'nao')),
  decline_reason TEXT,
  companions_count INTEGER NOT NULL DEFAULT 0,
  buffet_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS rsvps_invited_guest_unique
  ON rsvps (invited_guest_id)
  WHERE invited_guest_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rsvps_whatsapp_digits_unique
  ON rsvps (whatsapp_digits)
  WHERE whatsapp_digits IS NOT NULL AND whatsapp_digits <> '';

CREATE TABLE IF NOT EXISTS rsvp_companions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rsvp_id INTEGER NOT NULL,
  companion_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  counts_buffet INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Formato da lista:
-- guest_name: nome completo do convidado.
-- age: idade do convidado. Menor de 6 anos nao conta no buffet.
-- whatsapp_digits: somente numeros com DDD, sem +55. Para menor de idade sem celular, use NULL.
-- max_companions: quantidade maxima de acompanhantes liberada para esse convidado.

INSERT OR IGNORE INTO invited_guests (guest_name, age, whatsapp_digits, max_companions) VALUES
  ('Rafael Almeida', 38, '11920850975', 1),
  ('Crianca Sem Celular', 5, NULL, 0);