CREATE TABLE IF NOT EXISTS invited_guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT,
  whatsapp_digits TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cadastre os convidados usando somente numeros, com DDD e sem +55.
-- Exemplo:
INSERT INTO invited_guests (guest_name, whatsapp_digits) VALUES
  ('Nome do Convidado 1', '11999999999'),
  ('Nome do Convidado 2', '11988888888');


CREATE UNIQUE INDEX IF NOT EXISTS rsvps_whatsapp_digits_unique
  ON rsvps (whatsapp_digits)
  WHERE whatsapp_digits IS NOT NULL;
