# Achados e Perdidos do IML

Mural público de **achados e perdidos** do IML: objetos de falecidos (celular, documento, aliança, mochila…)
e corpos não identificados. Qualquer pessoa pode buscar no mural e avisar o IML com o botão
**“Eu conheço / é meu”**. A equipe do IML cadastra os itens, avalia as manifestações e marca
o item como devolvido ou identificado.

Todos os dados são fictícios.

- **Banco:** PostgreSQL 14+: 6 tabelas, triggers e índices.
- **Backend:** Node.js + Express + `pg`.
- **Frontend:** HTML, CSS e JavaScript puro (sem build), servidos pelo próprio Express. A recepção usa three.js, instalado com `npm install` e servido localmente (sem CDN).

## O que o sistema faz

**Tela pública (sem login)**
- A tela inicial é a **recepção do IML em 3D** (three.js) em tela cheia: os objetos ficam no balcão e nas estantes de inox, e os corpos não identificados ficam na **câmara fria**, em gavetas abertas com o corpo coberto por um lençol, só com os pés à mostra e a etiqueta de identificação no dedo. Ao clicar, o item abre em tela grande, com o modelo 3D à esquerda (objeto ou manequim, que dá para girar arrastando) e as informações à direita.
- Página de cada item, com o botão **Eu conheço / é meu**: a pessoa informa nome,
  contato, parentesco e o que reconheceu. O contato nunca aparece no mural.

**Entrada do administrador:** não há barra de menu. Na recepção há uma **porta com teclado de senha** na ponta esquerda da parede; clicar nela abre um painel 3D de acesso (`admin@iml.demo` / `iml123`) e a câmera avança pela porta até a **sala do administrador**: o painel numa TV na parede, os objetos nas prateleiras (estoque), os corpos na câmara fria e as manifestações numa pasta sobre a mesa. A única saída é a **porta da sala**, que volta à recepção e encerra a sessão.

**Tela de administrador (IML, com login)**
- Cadastra objetos com descrição, local e data em que foram encontrados.
- Cadastra corpos. Todo corpo não identificado já aparece no mural, **só com características gerais**;
  gaveta e observações ficam internas.
- Recebe as manifestações e avalia: *em análise*, *aceita* (objeto → **devolvido**, corpo → **identificado**,
  e o item sai do mural) ou *recusada*. Todo parecer fica registrado.

## Como rodar

### 1. Instalar o PostgreSQL

Baixe em <https://www.postgresql.org/download/windows/>, anote a senha do usuário `postgres` e mantenha a porta 5432.

### 2. Configurar o projeto

```bash
npm install
copy .env.example .env      # no Git Bash: cp .env.example .env
```

Abra o `.env` e coloque em `PGPASSWORD` a senha do `postgres`.

### 3. Criar o banco e carregar os dados

```bash
npm run db:criar    # cria o banco "iml" e roda db/01, 02 e 03
npm run db:testar   # testes das regras do banco (não altera nada)
```

> ⚠️ `db:criar` **apaga e recria** o banco `iml`. Use também para “zerar” a demonstração.

### 4. Subir o sistema

```bash
npm start
```

Abra <http://localhost:3000>. O mural é público; a **Área do IML** pede login:
`admin@iml.demo` (ou `plantao@iml.demo`), senha `iml123`.

## Roteiro de demonstração

1. **Recepção** (sem login): passe o mouse nos itens e clique em um deles para vê-lo em 3D e em tela grande.
2. Abra um item e clique em **Eu conheço / é meu**; preencha e envie.
3. **Área do IML** → *Painel*: a fila de manifestações mostra o novo envio.
4. *Manifestações* → **Aceitar** a da aliança, com parecer: o objeto vira **devolvido**, sai do mural e as outras
   manifestações sobre ele são recusadas sozinhas.

## Banco de dados

| Tabela | Para quê |
|---|---|
| `usuario` | equipe do IML |
| `local` | onde o objeto ou o corpo foi encontrado |
| `objeto` | pertences de falecidos (`EM_GUARDA` / `DEVOLVIDO`) |
| `corpo` | corpos (`NAO_IDENTIFICADO` / `IDENTIFICADO`); `caracteristicas` é público, `observacoes` é interno |
| `manifestacao` | “Eu conheço / é meu” (`RECEBIDA`, `EM_ANALISE`, `ACEITA`, `RECUSADA`) |
| `historico_status` | linha do tempo de objetos, corpos e manifestações |

O que o banco faz sozinho (`db/02_logica.sql`):

- Códigos automáticos `OBJ-2026-000012` e `IML-2026-000123`.
- Toda mudança de status gera `historico_status`, com o usuário (`app.id_usuario`, definido pelo backend).
- Manifestação só é aceita para item ainda aberto; aceitar ou recusar exige parecer.
- Manifestação **aceita** encerra o item (objeto devolvido / corpo identificado) e as demais manifestações abertas dele são recusadas.
- Manifestação decidida não pode ser reaberta.

## Estrutura

```
db/            01_schema, 02_logica, 03_seed, 04_testes
scripts/db.js  npm run db:criar / db:testar
src/
  server.js    Express e sessão
  db.js        pool do pg + transação que informa o usuário aos triggers
  erros.js     traduz erros do banco em mensagens legíveis
  routes/      auth, publico (mural, manifestações), admin
public/        SPA: index.html, css/style.css, js/ (telas e utilitários)
```

## API (resumo)

Pública: `GET /api/mural` · `GET /api/mural/filtros` · `GET /api/mural/objetos/:id` ·
`GET /api/mural/corpos/:id` · `POST /api/manifestacoes` · `POST /api/login`

Administrador (exige login): `GET /api/admin/painel` · `GET|POST|PATCH /api/admin/objetos` ·
`POST /api/admin/objetos/:id/status` · `GET|POST|PATCH /api/admin/corpos` · `POST /api/admin/corpos/:id/status` ·
`GET /api/admin/manifestacoes` ·
`POST /api/admin/manifestacoes/:id/avaliar` · `GET|POST /api/admin/locais`
