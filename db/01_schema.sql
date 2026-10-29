-- =====================================================================
-- ACHADOS E PERDIDOS DO IML
-- Mural de objetos e corpos não identificados
-- Modelo físico de dados — PostgreSQL 14+
-- =====================================================================
-- Tabelas (7):
--   usuario ........ equipe do IML (acesso à tela de administrador)
--   local .......... onde o objeto ou o corpo foi encontrado
--   objeto ......... pertences de falecidos (celular, documento, aliança…)
--   corpo .......... corpos não identificados
--   manifestacao ... "Eu conheço / é meu", enviada pelo público
--   historico_status  linha do tempo de objetos, corpos e manifestações
-- =====================================================================

CREATE TABLE usuario (
    id_usuario  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    email       VARCHAR(120) NOT NULL UNIQUE,
    senha_hash  VARCHAR(255) NOT NULL,
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE local (
    id_local    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,           -- ex.: "Arroio Luiz Rau", "Rodoviária"
    tipo_local  VARCHAR(30)
                CHECK (tipo_local IN ('VIA_PUBLICA','RESIDENCIA','RIO_LAGO','MATA',
                                      'HOSPITAL','RODOVIA','ESTABELECIMENTO','OUTRO')),
    bairro      VARCHAR(80),
    cidade      VARCHAR(80)  NOT NULL,
    uf          CHAR(2)      NOT NULL
);

-- Pertences de falecidos. Aparecem no mural enquanto estiverem EM_GUARDA.
CREATE TABLE objeto (
    id_objeto           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo              VARCHAR(20)  NOT NULL UNIQUE,       -- ex.: OBJ-2026-000012
    tipo                VARCHAR(20)  NOT NULL
                        CHECK (tipo IN ('CELULAR','DOCUMENTO','ALIANCA','MOCHILA','CARTEIRA',
                                        'JOIA','ROUPA','CHAVES','OUTRO')),
    titulo              VARCHAR(100) NOT NULL,              -- ex.: "Celular Samsung preto"
    descricao           TEXT         NOT NULL,
    id_local            INTEGER      NOT NULL REFERENCES local(id_local),
    data_encontrado     DATE         NOT NULL,
    status              VARCHAR(15)  NOT NULL DEFAULT 'EM_GUARDA'
                        CHECK (status IN ('EM_GUARDA','DEVOLVIDO')),
    id_corpo            INTEGER,                            -- corpo de origem (uso interno)
    id_usuario_cadastro INTEGER      REFERENCES usuario(id_usuario),
    criado_em           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Corpos não identificados. Entram no mural assim que cadastrados, e só com características gerais.
CREATE TABLE corpo (
    id_corpo            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_iml          VARCHAR(20)  NOT NULL UNIQUE,       -- ex.: IML-2026-000123
    sexo                CHAR(1)      NOT NULL CHECK (sexo IN ('M','F','I')),   -- I = indeterminado
    idade_estimada_min  SMALLINT     CHECK (idade_estimada_min BETWEEN 0 AND 120),
    idade_estimada_max  SMALLINT     CHECK (idade_estimada_max BETWEEN 0 AND 120),
    altura_estimada_cm  SMALLINT     CHECK (altura_estimada_cm BETWEEN 30 AND 250),
    cor_pele            VARCHAR(20),
    cor_cabelo          VARCHAR(20),
    cor_olhos           VARCHAR(20),
    caracteristicas     TEXT,                               -- PÚBLICO: só traços gerais (roupa, tatuagem, cicatriz)
    observacoes         TEXT,                               -- INTERNO: nunca vai para o mural
    id_local            INTEGER      NOT NULL REFERENCES local(id_local),
    data_encontrado     DATE         NOT NULL,
    data_entrada        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- quando foi cadastrado
    gaveta_camara       VARCHAR(10),                        -- posição na câmara fria (interno)
    status              VARCHAR(20)  NOT NULL DEFAULT 'NAO_IDENTIFICADO'
                        CHECK (status IN ('NAO_IDENTIFICADO','IDENTIFICADO')),
    id_usuario_cadastro INTEGER      REFERENCES usuario(id_usuario),
    CHECK (idade_estimada_min <= idade_estimada_max)
);

ALTER TABLE objeto ADD FOREIGN KEY (id_corpo) REFERENCES corpo(id_corpo) ON DELETE SET NULL;

-- "Eu conheço / é meu": enviada pelo público para um objeto OU um corpo
CREATE TABLE manifestacao (
    id_manifestacao     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_objeto           INTEGER REFERENCES objeto(id_objeto) ON DELETE CASCADE,
    id_corpo            INTEGER REFERENCES corpo(id_corpo)   ON DELETE CASCADE,
    nome                VARCHAR(120) NOT NULL,
    contato             VARCHAR(120) NOT NULL,              -- telefone ou e-mail
    parentesco          VARCHAR(20)  NOT NULL
                        CHECK (parentesco IN ('CONJUGE','PAI','MAE','FILHO','FILHA','IRMAO','IRMA',
                                              'AVO','NETO','TIO','SOBRINHO','PRIMO','AMIGO',
                                              'VIZINHO','OUTRO')),
    o_que_reconheceu    TEXT         NOT NULL,
    status              VARCHAR(15)  NOT NULL DEFAULT 'RECEBIDA'
                        CHECK (status IN ('RECEBIDA','EM_ANALISE','ACEITA','RECUSADA')),
    parecer             TEXT,                               -- obrigatório ao aceitar/recusar
    id_usuario_analise  INTEGER      REFERENCES usuario(id_usuario),
    data_analise        TIMESTAMP,
    criado_em           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (num_nonnulls(id_objeto, id_corpo) = 1),
    CHECK (status IN ('RECEBIDA','EM_ANALISE') OR parecer IS NOT NULL)
);

CREATE TABLE historico_status (
    id_historico    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entidade        VARCHAR(15) NOT NULL CHECK (entidade IN ('OBJETO','CORPO','MANIFESTACAO')),
    id_registro     INTEGER     NOT NULL,
    status_anterior VARCHAR(20),
    status_novo     VARCHAR(20) NOT NULL,
    data_alteracao  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario      INTEGER     REFERENCES usuario(id_usuario),
    observacao      TEXT
);

CREATE INDEX ix_objeto_status      ON objeto (status, tipo);
CREATE INDEX ix_objeto_local       ON objeto (id_local);
CREATE INDEX ix_corpo_status       ON corpo (status, data_entrada);
CREATE INDEX ix_corpo_local        ON corpo (id_local);
CREATE INDEX ix_manif_objeto       ON manifestacao (id_objeto, status);
CREATE INDEX ix_manif_corpo        ON manifestacao (id_corpo, status);
CREATE INDEX ix_historico_registro ON historico_status (entidade, id_registro);
CREATE INDEX ix_local_cidade       ON local (uf, cidade);
