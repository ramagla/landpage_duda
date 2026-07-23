# Landing page - 16 anos da Duda

Projeto separado da landing do Romeu.

## Evento

- Data: 14/11/2026
- Horario: 17h
- Local: Quintal do Ibiza
- Google Maps: https://www.google.com/maps/search/?api=1&query=Rua%20Corumbatai%20100%20Vila%20Virginia%20Itaquaquecetuba
- Instagram do espaco: https://www.instagram.com/quintaldoibizaoficial/
- Instagram da Duda: https://www.instagram.com/mariizsq_/
- Musica: YouTube `_zR6ROjoOX0`, iniciada no toque de abrir convite para funcionar no mobile
- Confirmacao ate: 14/10/2026
- Convite: validado por celular ou por link individual `?convite=nome`

## Rodar localmente com SQLite

```bash
npm install
npm run local
```

Abra:

```text
http://localhost:5174
http://localhost:5174/admin
```

Senha local do admin: `duda16`.

Esse modo usa SQLite local no arquivo `duda-local.db` e executa tambem as APIs `/api`. Use esse modo para testar RSVP, mensagens, admin e lista de convidados antes de integrar com a Vercel.

O `npm run dev` abre apenas o Vite na porta `5173`; ele serve para ver tela, mas nao executa as APIs.

## Banco e variaveis da Vercel

Configure no projeto da Vercel:

```bash
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
ADMIN_PASSWORD=sua-senha-do-painel
```

A API cria/migra automaticamente as tabelas `invited_guests`, `guest_companions`, `rsvps`, `rsvp_companions` e `birthday_messages` quando os endpoints forem usados.

## Fluxo do convite

- A pessoa abre a landing page e digita o celular.
- Se o celular ja estiver cadastrado, o convite dela abre direto.
- Se voce enviar um link individual, como `https://landpage-duda-ccpi.vercel.app/?convite=glaucia`, a pessoa digita o celular e esse numero fica vinculado ao convite da Glaucia ao confirmar.
- Se nao houver celular cadastrado nem link individual valido, aparece: `Sinto muito, mas voce nao esta na lista de convidados.`
- Cada convidado so pode confirmar uma vez.
- O limite de acompanhantes vem do cadastro.
- Criancas menores de 6 anos nao contam no buffet.

## Painel escondido

Acesse diretamente:

```text
/admin
```

Nao existe botao publico para essa tela. O painel permite:

- Entrar com senha.
- Ver total de convidados, confirmados, recusados, pendentes e pessoas para buffet.
- Ver a lista geral com status, acompanhantes, telefone e link individual.
- Cadastrar ou editar convidado, telefone, idade, codigo do link e limite de acompanhantes.
- Ver mensagens de parabens.

## Lista inicial

A lista enviada no chat esta seedada automaticamente pela API e tambem esta no arquivo `sql/invited-guests.sql`.

Para pre-cadastrar nomes de acompanhantes conhecidos, use a tabela `guest_companions`:

```sql
INSERT INTO guest_companions (invited_guest_id, slot_number, companion_name, age)
SELECT id, 1, 'Nome do acompanhante', 18
FROM invited_guests
WHERE invite_code = 'glaucia'
ON CONFLICT(invited_guest_id, slot_number) DO UPDATE SET
  companion_name = excluded.companion_name,
  age = excluded.age;
```

## Sugestao de presente

O site mostra uma area opcional de presente com sugestoes e Pix:

- Sugestoes: perfume, acessorios femininos, cremes e maquiagem
- Chave Pix: `56765986898`
- Nome para conferir antes do pagamento: `Maria Eduarda Almeida Araujo`
- QR Code: `public/pix-duda.svg`
- BR Code copia e cola: `public/pix-duda-brcode.txt`

O QR Code foi gerado sem valor fixo.
