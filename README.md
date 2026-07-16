# Landing page - 16 anos da Duda

Projeto separado da landing do Romeu.

## Evento

- Data: 14/11/2026
- Horario: 17h
- Local: Quintal do Ibiza
- Google Maps: https://www.google.com/maps/search/?api=1&query=Rua%20Corumbatai%20100%20Vila%20Virginia%20Itaquaquecetuba
- Instagram do espaco: https://www.instagram.com/quintaldoibizaoficial/
- Instagram da Duda: https://www.instagram.com/mariizsq_/
- Logo do espaco: `public/quintal-ibiza-logo.jpg`
- Globo espelhado do convite: `public/disco-ball.jpg`
- Balao 16 prateado: `public/balloon-16.jpg`
- Favicon: `public/favicon.svg`
- Musica: YouTube `_zR6ROjoOX0`, carregada automaticamente no convite
- Confirmacao ate: 14/10/2026
- Convite: individual, validado pelo WhatsApp cadastrado na lista de convidados

## Rodar localmente

```bash
npm install
npm run dev
```

## Banco Turso/libSQL na Vercel

Crie/instale o Turso pela Vercel Marketplace ou CLI:

```bash
vercel integration add turso
```

Configure estas variaveis no projeto da Vercel:

```bash
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

A API cria automaticamente as tabelas `invited_guests`, `rsvps` e `birthday_messages` quando os endpoints forem usados.

## Cadastrar lista de convidados

Arquivo pronto: `sql/invited-guests.sql`

Cadastre o WhatsApp apenas com numeros, de preferencia com DDD e sem o codigo do Brasil. Exemplo: `11999999999`.

```sql
INSERT INTO invited_guests (guest_name, whatsapp_digits) VALUES
  ('Nome do Convidado 1', '11999999999'),
  ('Nome do Convidado 2', '11988888888');
```

Se a pessoa tentar confirmar com um celular que nao esta em `invited_guests`, a API retorna:

```text
Sinto muito, mas voce nao esta na lista de convidados.
```

## Ver lista cadastrada

```sql
SELECT
  id,
  guest_name,
  whatsapp_digits,
  created_at
FROM invited_guests
ORDER BY guest_name;
```

## Ver confirmados no SQL

```sql
SELECT
  id,
  full_name,
  whatsapp,
  whatsapp_digits,
  attending,
  decline_reason,
  created_at
FROM rsvps
ORDER BY created_at DESC;
```

## Ver mensagens de parabens no SQL

```sql
SELECT
  id,
  name,
  message,
  created_at
FROM birthday_messages
ORDER BY created_at DESC;
```

## Trocar a foto

Substitua a URL da imagem em `src/App.jsx` no bloco `.photo-frame` pela foto final da Duda.
