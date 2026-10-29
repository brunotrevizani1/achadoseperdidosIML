# Achados e Perdidos do IML

Sistema acadêmico que cruza **corpos não identificados** recebidos pelo IML com **pessoas desaparecidas**
registradas pelas famílias. Ele dá uma nota de compatibilidade de 0 a 100 e acompanha o caso até a
identificação oficial e a entrega do corpo à família.

A interface tem humor de repartição pública: Câmara Fria "Hotel Zero Grau", "Match do IML",
carimbos, crachás. A piada é sempre com a burocracia, nunca com as vítimas. Todos os dados são fictícios.

- **Banco:** PostgreSQL 14+ (testado no 16): 20 tabelas, 1 view e 16 índices da especificação, mais triggers.
- **Backend:** Node.js + Express + `pg`.
- **Frontend:** HTML, CSS e JavaScript puro (sem build), servidos pelo próprio Express.

---

## Como rodar

### 1. Instalar o PostgreSQL 16

1. Baixe o instalador para Windows em <https://www.postgresql.org/download/windows/> (EDB).
2. Durante a instalação, **anote a senha** do usuário `postgres` e mantenha a porta **5432**.
   O pgAdmin vem junto e é opcional.

### 2. Configurar o projeto

```bash
npm install
copy .env.example .env      # no Git Bash: cp .env.example .env
```

Abra o `.env` e coloque em `PGPASSWORD` a senha que você definiu na instalação.

### 3. Criar o banco e carregar os dados

```bash
npm run db:criar    # cria o banco "iml" e roda db/01, 02 e 03
npm run db:testar   # roda os testes da seção 10 da especificação (não altera nada)
```

> ⚠️ `db:criar` **apaga e recria** o banco `iml`. Use também para "zerar" a demonstração.

Esses comandos não precisam do `psql`. Se preferir fazer manualmente (psql ou Query Tool do pgAdmin),
crie o banco `iml` e execute os arquivos de `db/` em ordem: `01_schema.sql`, `02_logica.sql`, `03_seed.sql` e,
se quiser, `04_testes.sql`.

### 4. Subir o sistema

```bash
npm start
```

Acesse <http://localhost:3000>. A tela de login lista os crachás de demonstração (senha **`iml123`** para todos):

| Crachá | Perfil | O que pode fazer |
|---|---|---|
| Kleber Balcão (`atendente@iml.demo`) | ATENDENTE | Registrar desaparecimentos, liberar corpos, marcar "encontrado vivo" |
| Dr. Ivo Lupa (`perito@iml.demo`) | PERITO | Check-in de corpos, exames, **identificação oficial**, liberação |
| Sherlaine Holmes (`investigador@iml.demo`) | INVESTIGADOR | Rodar o cruzamento, assumir, registrar confrontos, confirmar ou descartar |
| Neide Carimbo (`admin@iml.demo`) | ADMIN | Tudo |

---

## Roteiro de demonstração (uns 5 minutos)

1. **Investigadora** → *Match do IML*: o primeiro par é a Rosimeire com nota **100**. Clique em 🔍 para assumir.
2. Na ficha do caso, compare os critérios e os bonecos lado a lado (verde = sinal que bateu) e
   **registre um confronto** COMPATÍVEL.
3. Troque para o **perito** → abra o mesmo caso → **Identificar oficialmente**. O banco muda sozinho os status
   do corpo, do desaparecido e da correspondência, e descarta as outras sugestões dos dois.
4. Ainda como perito (ou atendente) → **Liberar para a família**. O resultado é o carimbo de *CASO ENCERRADO*
   e a linha do tempo completa.
5. **Atendente** → *Registrar sumiço*: preencha as 3 etapas e clique no boneco para anotar uma tatuagem.
   O cruzamento roda na hora e avisa se já existe um match.
6. Mostre as regras do banco em ação: tente descartar sem justificativa, ou cadastrar um desaparecido sem
   idade e sem data de nascimento. O banco recusa e a tela mostra o motivo.

Casos já prontos no seed:

| Par | Nota | Situação |
|---|---|---|
| Valdemar × IML-2026-000101 | 90 | Em análise (caso da seção 10 do PDF) |
| Josué × IML-2026-000101 | 34 | Abaixo de 50, não é gravado (seção 10 do PDF) |
| Rosimeire × IML-2026-000102 | 100 | Na fila: match perfeito |
| Heitor × IML-2026-000106 | 80 | Já identificado e liberado (linha do tempo completa) |
| Marcos Vinícius | — | Localizado vivo |

---

## Estrutura

```
db/
  01_schema.sql     script da especificação (fiel ao anexo do PDF)
  02_logica.sql     triggers e funções que o spec exige mas não implementava
  03_seed.sql       dados fictícios
  04_testes.sql     testes automáticos (rodam numa transação desfeita)
scripts/db.js       npm run db:criar / db:testar
src/
  server.js         Express, sessão e rotas
  db.js             pool do pg + transação que informa o usuário aos triggers
  erros.js          traduz erros de CHECK/UNIQUE/trigger em mensagens legíveis
  routes/           auth, painel, desaparecidos, corpos, investigação, domínios
public/             SPA: index.html, css/style.css, js/ (telas, boneco SVG, utilitários)
```

## O que o banco faz sozinho (`02_logica.sql`)

| Regra da especificação | Implementação |
|---|---|
| Toda mudança de status gera `historico_status` com usuário (seção 8) | `fn_historico_status()` + triggers em `corpo`, `registro_desaparecimento` e `correspondencia`. O usuário vem de `app.id_usuario`, definido pelo backend em cada transação |
| Rotina de gravação das sugestões com nota ≥ 50 (seção 7) | `fn_gerar_correspondencias()`, que também preenche `correspondencia_sinal` (mesmo lado = similaridade ALTA). Roda a cada cadastro e no botão "Rodar cruzamento" |
| Ciclo da correspondência | Assumir leva corpo e desaparecido para EM_ANALISE; descartar devolve os dois para a fila se não houver outra apuração aberta; correspondência encerrada não pode ser reaberta |
| Identificação oficial | Valida os status, marca corpo IDENTIFICADO, desaparecido IDENTIFICADO_OBITO e correspondência CONFIRMADA, e descarta as demais sugestões dos dois |
| Liberação do corpo | Só para corpo IDENTIFICADO e para um familiar vinculado à pessoa identificada; marca LIBERADO |
| Protocolo e código IML | Sequências com `fn_novo_protocolo()` (`DES-2026-000045`) e `fn_novo_codigo_iml()` (`IML-2026-000123`) |

As regras do próprio modelo (CHECKs, UNIQUEs, exige justificativa, sinal de um corpo **ou** de um
desaparecido etc.) continuam no `01_schema.sql`, exatamente como na especificação.

## API (resumo)

`POST /api/login` · `GET /api/painel` · `GET|POST /api/desaparecidos` · `GET /api/desaparecidos/:id` ·
`PATCH /api/desaparecidos/:id/status` · `GET|POST /api/corpos` · `GET /api/corpos/:id` ·
`POST /api/corpos/:id/exames` · `POST /api/cruzamento/rodar` · `GET /api/correspondencias` ·
`GET|PATCH /api/correspondencias/:id` · `POST /api/correspondencias/:id/analises` ·
`POST /api/identificacoes` · `POST /api/liberacoes` · `GET /api/dominios` · `POST /api/locais`
