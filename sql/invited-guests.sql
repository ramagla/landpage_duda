CREATE TABLE IF NOT EXISTS invited_guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL,
  invite_code TEXT,
  age INTEGER,
  whatsapp_digits TEXT,
  max_companions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS invited_guests_whatsapp_unique
  ON invited_guests (whatsapp_digits)
  WHERE whatsapp_digits IS NOT NULL AND whatsapp_digits <> '';

CREATE UNIQUE INDEX IF NOT EXISTS invited_guests_invite_code_unique
  ON invited_guests (invite_code);

CREATE INDEX IF NOT EXISTS invited_guests_name_index
  ON invited_guests (guest_name);

CREATE TABLE IF NOT EXISTS guest_companions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invited_guest_id INTEGER NOT NULL,
  slot_number INTEGER NOT NULL,
  companion_name TEXT,
  age INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(invited_guest_id, slot_number)
);

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
  companion_slot INTEGER,
  companion_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  counts_buffet INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO invited_guests (guest_name, invite_code, max_companions) VALUES
  ('Maria Clodoalda', 'maria-clodoalda', 1),
  ('Wesley', 'wesley', 2),
  ('Giovana', 'giovana', 3),
  ('Glaucia', 'glaucia', 3),
  ('Bete', 'bete', 2),
  ('Conceicao', 'conceicao', 1),
  ('Gloriete', 'gloriete', 3),
  ('Luiz Felipe', 'luiz-felipe', 1),
  ('Maria Cristina', 'maria-cristina', 0),
  ('Claudinho', 'claudinho', 5),
  ('Talissa', 'talissa', 1),
  ('Maria Beatriz', 'maria-beatriz', 0),
  ('Tia fatima', 'tia-fatima', 0),
  ('Everton', 'everton', 0),
  ('Bruna', 'bruna', 3),
  ('Tia Cristina', 'tia-cristina', 2),
  ('Romeu', 'romeu', 1),
  ('Sonia', 'sonia', 1),
  ('Junior', 'junior', 1),
  ('Giulia', 'giulia', 3),
  ('Giovana', 'giovana-2', 1),
  ('Suely', 'suely', 2),
  ('Lena', 'lena', 1),
  ('Heloisa', 'heloisa', 1),
  ('Kimberly', 'kimberly', 1),
  ('Ana', 'ana', 0),
  ('Rafael Lena', 'rafael-lena', 3),
  ('Larissa', 'larissa', 1),
  ('Eloa', 'eloa', 2),
  ('Igor', 'igor', 0),
  ('Bernardo', 'bernardo', 0),
  ('Luane', 'luane', 0),
  ('Kaylane', 'kaylane', 0),
  ('Camila', 'camila', 0),
  ('Gustavo', 'gustavo', 0),
  ('Jessica', 'jessica', 0),
  ('Thaline', 'thaline', 1),
  ('Andreia', 'andreia', 2),
  ('Raquel', 'raquel', 2),
  ('Paloma', 'paloma', 5),
  ('Neia', 'neia', 2),
  ('Vilma', 'vilma', 3),
  ('Juliana', 'juliana', 2),
  ('Edna', 'edna', 1),
  ('Thalita', 'thalita', 1),
  ('Thalissa', 'thalissa', 0)
ON CONFLICT(invite_code) DO UPDATE SET
  guest_name = excluded.guest_name,
  max_companions = excluded.max_companions;

-- Exemplo para pre-cadastrar nome/idade de acompanhante:
-- INSERT INTO guest_companions (invited_guest_id, slot_number, companion_name, age)
-- SELECT id, 1, 'Nome do acompanhante', 18 FROM invited_guests WHERE invite_code = 'glaucia'
-- ON CONFLICT(invited_guest_id, slot_number) DO UPDATE SET companion_name = excluded.companion_name, age = excluded.age;
