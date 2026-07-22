# Landing page - 16 anos da Duda

Projeto separado da landing do Romeu.

## Evento

- Data: 14/11/2026
- Horario: 17h
- Local: Quintal do Ibiza
- Google Maps: https://www.google.com/maps/search/?api=1&query=Rua%20Corumbatai%20100%20Vila%20Virginia%20Itaquaquecetuba
- Instagram do espaco: https://www.instagram.com/quintaldoibizaoficial/
- Instagram da Duda: https://www.instagram.com/mariizsq_/
- Logo do espaco: `public/quintal-ibiza-logo.svg`
- Globo espelhado do convite: `public/disco-ball.jpg`
- Balao 16 prateado: `public/balloon-16.jpg`
- Favicon: `public/favicon.svg`
- Musica: YouTube `_zR6ROjoOX0`, carregada automaticamente no convite
- Confirmacao ate: 14/10/2026
- Convite: validado pela lista de convidados, com limite de acompanhantes por convidado

## Rodar localmente

```bash
npm install
npm run dev
```

## Testar RSVP localmente

O comando `npm run dev` abre apenas o Vite. Ele mostra a tela, mas nao executa as funcoes `/api` da Vercel. Para testar confirmacao de presenca e mensagens usando as APIs, rode pelo Vercel CLI:

```bash
vercel dev
```

Se testar pelo Vite puro, o formulario vai mostrar uma mensagem avisando que o servidor de confirmacao esta indisponivel.

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

A API cria/migra automaticamente as tabelas `invited_guests`, `rsvps`, `rsvp_companions` e `birthday_messages` quando os endpoints forem usados.

## Cadastrar lista de convidados

Arquivo pronto: `sql/invited-guests.sql`

Formato novo da lista:

- `guest_name`: nome completo do convidado.
- `age`: idade do convidado. Menor de 6 anos nao conta no buffet.
- `whatsapp_digits`: somente numeros com DDD, sem `+55`. Para menor de idade sem celular, use `NULL`.
- `max_companions`: quantidade maxima de acompanhantes liberada para esse convidado.

```sql
INSERT OR IGNORE INTO invited_guests (guest_name, age, whatsapp_digits, max_companions) VALUES
  ('Nome do Convidado 1', 38, '11999999999', 1),
  ('Crianca Sem Celular', 5, NULL, 0);
```

Se a pessoa tentar confirmar sem estar em `invited_guests`, a API retorna:

```text
Sinto muito, mas voce nao esta na lista de convidados.
```

## Ver lista cadastrada

```sql
SELECT
  id,
  guest_name,
  age,
  whatsapp_digits,
  max_companions,
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
  companions_count,
  buffet_count,
  decline_reason,
  created_at
FROM rsvps
ORDER BY created_at DESC;
```

## Ver acompanhantes confirmados

```sql
SELECT
  r.full_name,
  c.companion_name,
  c.age,
  c.counts_buffet
FROM rsvp_companions c
JOIN rsvps r ON r.id = c.rsvp_id
ORDER BY r.created_at DESC, c.companion_name;
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