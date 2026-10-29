-- =====================================================================
-- ACHADOS E PERDIDOS DO IML
-- Sistema de Identificação de Corpos e Pessoas Desaparecidas
-- Modelo físico de dados — PostgreSQL 14+
-- =====================================================================
-- Módulos:
--   A. Segurança e apoio ........ usuario, local, causa_morte,
--                                 tipo_sinal, regiao_corpo
--   B. Desaparecidos ............ familiar, registro_desaparecimento,
--                                 familiar_desaparecido
--   C. Corpos (IML) ............. corpo, registro_entrada
--   D. Características .......... sinal_particular, foto_registro
--   E. Perícia .................. exame_pericial, amostra_dna
--   F. Investigação ............. correspondencia, correspondencia_sinal,
--                                 analise_investigacao
--   G. Desfecho ................. identificacao, liberacao_corpo
--   H. Auditoria ................ historico_status
--   + View de cruzamento automático: vw_candidatos_correspondencia
-- =====================================================================


-- =====================================================================
-- A. SEGURANÇA E TABELAS DE APOIO
-- =====================================================================

-- Usuários do sistema (quem cadastra, analisa e confirma)
CREATE TABLE usuario (
    id_usuario      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome            VARCHAR(120) NOT NULL,
    cpf             CHAR(11)     NOT NULL UNIQUE,
    matricula       VARCHAR(20)  UNIQUE,
    email           VARCHAR(120) NOT NULL UNIQUE,
    senha_hash      VARCHAR(255) NOT NULL,
    perfil          VARCHAR(20)  NOT NULL
                    CHECK (perfil IN ('ADMIN','ATENDENTE','PERITO','INVESTIGADOR')),
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Locais: onde o corpo foi encontrado / onde a pessoa foi vista pela última vez
CREATE TABLE local (
    id_local        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome            VARCHAR(120) NOT NULL,           -- ex.: "Arroio Luiz Rau", "Rodoviária"
    tipo_local      VARCHAR(30)
                    CHECK (tipo_local IN ('VIA_PUBLICA','RESIDENCIA','RIO_LAGO','MATA',
                                          'HOSPITAL','RODOVIA','ESTABELECIMENTO','OUTRO')),
    logradouro      VARCHAR(150),
    bairro          VARCHAR(80),
    cidade          VARCHAR(80)  NOT NULL,
    uf              CHAR(2)      NOT NULL,
    cep             CHAR(8),
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6)
);

-- Causas de morte (provisória na entrada, definitiva na necropsia)
CREATE TABLE causa_morte (
    id_causa        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_cid      VARCHAR(10),                     -- CID-10, ex.: X95, W74
    descricao       VARCHAR(150) NOT NULL,
    categoria       VARCHAR(20)  NOT NULL
                    CHECK (categoria IN ('NATURAL','ACIDENTAL','HOMICIDIO','SUICIDIO','INDETERMINADA'))
);

-- Tipos de sinal particular (padronizados para permitir o cruzamento)
CREATE TABLE tipo_sinal (
    id_tipo_sinal   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    descricao       VARCHAR(60)  NOT NULL UNIQUE
);

-- Regiões do corpo (padronizadas para permitir o cruzamento)
CREATE TABLE regiao_corpo (
    id_regiao       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    descricao       VARCHAR(60)  NOT NULL UNIQUE
);


-- =====================================================================
-- B. DESAPARECIDOS
-- =====================================================================

-- Familiares / comunicantes
CREATE TABLE familiar (
    id_familiar     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome            VARCHAR(120) NOT NULL,
    cpf             CHAR(11)     NOT NULL UNIQUE,
    rg              VARCHAR(20),
    data_nascimento DATE,
    telefone        VARCHAR(15)  NOT NULL,
    telefone_alt    VARCHAR(15),
    email           VARCHAR(120),
    logradouro      VARCHAR(150),
    cidade          VARCHAR(80),
    uf              CHAR(2),
    criado_em       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Registro de pessoa desaparecida
CREATE TABLE registro_desaparecimento (
    id_desaparecido         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    protocolo               VARCHAR(20)  NOT NULL UNIQUE,       -- ex.: DES-2026-000045
    nome_desaparecido       VARCHAR(120) NOT NULL,
    apelido                 VARCHAR(60),
    cpf_desaparecido        CHAR(11),
    data_nascimento         DATE,
    idade_desaparecimento   SMALLINT     CHECK (idade_desaparecimento BETWEEN 0 AND 120),
    sexo                    CHAR(1)      NOT NULL CHECK (sexo IN ('M','F')),
    altura_cm               SMALLINT     CHECK (altura_cm BETWEEN 30 AND 250),
    peso_kg                 NUMERIC(5,1),
    cor_pele                VARCHAR(20),
    cor_cabelo              VARCHAR(20),
    cor_olhos               VARCHAR(20),
    tipo_fisico             VARCHAR(20)  CHECK (tipo_fisico IN ('MAGRO','MEDIO','FORTE','OBESO')),
    vestimenta              TEXT,                               -- roupa que usava
    id_local                INTEGER      REFERENCES local(id_local),   -- último local visto
    data_desaparecimento    DATE         NOT NULL,
    numero_boletim          VARCHAR(30),                        -- BO policial
    circunstancias          TEXT,
    status                  VARCHAR(25)  NOT NULL DEFAULT 'ATIVO'
                            CHECK (status IN ('ATIVO','EM_ANALISE','LOCALIZADO_VIVO',
                                              'IDENTIFICADO_OBITO','ENCERRADO')),
    id_usuario_cadastro     INTEGER      REFERENCES usuario(id_usuario),
    data_registro           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (data_nascimento IS NOT NULL OR idade_desaparecimento IS NOT NULL)
);

-- Vínculo N:N familiar x desaparecido (parentesco pertence ao vínculo)
CREATE TABLE familiar_desaparecido (
    id_familiar     INTEGER     NOT NULL REFERENCES familiar(id_familiar),
    id_desaparecido INTEGER     NOT NULL REFERENCES registro_desaparecimento(id_desaparecido)
                                ON DELETE CASCADE,
    parentesco      VARCHAR(20) NOT NULL
                    CHECK (parentesco IN ('PAI','MAE','FILHO','FILHA','IRMAO','IRMA','CONJUGE',
                                          'AVO','NETO','TIO','SOBRINHO','PRIMO','OUTRO')),
    comunicante     BOOLEAN     NOT NULL DEFAULT FALSE,   -- quem registrou o desaparecimento
    doador_dna      BOOLEAN     NOT NULL DEFAULT FALSE,   -- aceita fornecer DNA de referência
    PRIMARY KEY (id_familiar, id_desaparecido)
);


-- =====================================================================
-- C. CORPOS (IML)
-- =====================================================================

-- Corpo não identificado recebido pelo IML
CREATE TABLE corpo (
    id_corpo            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_iml          VARCHAR(20)  NOT NULL UNIQUE,       -- ex.: IML-2026-000123
    sexo                CHAR(1)      NOT NULL CHECK (sexo IN ('M','F','I')),   -- I = indeterminado
    idade_estimada_min  SMALLINT     CHECK (idade_estimada_min BETWEEN 0 AND 120),
    idade_estimada_max  SMALLINT     CHECK (idade_estimada_max BETWEEN 0 AND 120),
    altura_estimada_cm  SMALLINT     CHECK (altura_estimada_cm BETWEEN 30 AND 250),
    peso_estimado_kg    NUMERIC(5,1),
    cor_pele            VARCHAR(20),
    cor_cabelo          VARCHAR(20),
    cor_olhos           VARCHAR(20),
    estado_conservacao  VARCHAR(25)
                        CHECK (estado_conservacao IN ('PRESERVADO','DECOMPOSICAO_INICIAL',
                               'DECOMPOSICAO_AVANCADA','ESQUELETIZADO','CARBONIZADO')),
    vestimenta          TEXT,
    pertences           TEXT,                               -- objetos encontrados junto
    data_entrada        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gaveta_camara       VARCHAR(10),                        -- posição na câmara fria
    status              VARCHAR(30)  NOT NULL DEFAULT 'AGUARDANDO_IDENTIFICACAO'
                        CHECK (status IN ('AGUARDANDO_IDENTIFICACAO','EM_ANALISE','IDENTIFICADO',
                                          'LIBERADO','SEPULTADO_NAO_IDENTIFICADO')),
    id_usuario_cadastro INTEGER      REFERENCES usuario(id_usuario),
    CHECK (idade_estimada_min <= idade_estimada_max)
);

-- Dados de chegada do corpo (onde/quando foi encontrado, quem removeu)
CREATE TABLE registro_entrada (
    id_entrada          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_corpo            INTEGER      NOT NULL UNIQUE REFERENCES corpo(id_corpo),
    id_local            INTEGER      NOT NULL REFERENCES local(id_local),
    id_causa_presumida  INTEGER      REFERENCES causa_morte(id_causa),
    data_encontrado     DATE         NOT NULL,
    data_obito_estimada DATE,
    orgao_remocao       VARCHAR(60),                        -- ex.: Brigada Militar, SAMU
    responsavel_remocao VARCHAR(120),
    numero_boletim      VARCHAR(30),
    circunstancias      TEXT
);


-- =====================================================================
-- D. CARACTERÍSTICAS (compartilhadas por corpo e desaparecido)
-- =====================================================================

-- Sinal particular: pertence a UM corpo OU a UM desaparecido
CREATE TABLE sinal_particular (
    id_sinal        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_corpo        INTEGER REFERENCES corpo(id_corpo) ON DELETE CASCADE,
    id_desaparecido INTEGER REFERENCES registro_desaparecimento(id_desaparecido) ON DELETE CASCADE,
    id_tipo_sinal   INTEGER     NOT NULL REFERENCES tipo_sinal(id_tipo_sinal),
    id_regiao       INTEGER     NOT NULL REFERENCES regiao_corpo(id_regiao),
    lado            VARCHAR(10) CHECK (lado IN ('ESQUERDO','DIREITO','CENTRAL','BILATERAL')),
    descricao       TEXT        NOT NULL,                   -- ex.: "rosa com nome 'Ana'"
    tamanho_cm      NUMERIC(5,1),
    cor             VARCHAR(30),
    CHECK (num_nonnulls(id_corpo, id_desaparecido) = 1)
);

-- Fotos: do corpo, do desaparecido ou de um sinal específico
CREATE TABLE foto_registro (
    id_foto         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_corpo        INTEGER REFERENCES corpo(id_corpo) ON DELETE CASCADE,
    id_desaparecido INTEGER REFERENCES registro_desaparecimento(id_desaparecido) ON DELETE CASCADE,
    id_sinal        INTEGER REFERENCES sinal_particular(id_sinal) ON DELETE SET NULL,
    tipo_foto       VARCHAR(20) NOT NULL
                    CHECK (tipo_foto IN ('ROSTO','CORPO_INTEIRO','SINAL_PARTICULAR','VESTIMENTA',
                                         'PERTENCE','ARCADA_DENTARIA','DOCUMENTO','OUTRO')),
    caminho_arquivo VARCHAR(255) NOT NULL,
    descricao       VARCHAR(255),
    restrita        BOOLEAN     NOT NULL DEFAULT TRUE,      -- não exibir à família sem perito
    data_registro   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario      INTEGER     REFERENCES usuario(id_usuario),
    CHECK (num_nonnulls(id_corpo, id_desaparecido) = 1)
);


-- =====================================================================
-- E. PERÍCIA
-- =====================================================================

-- Exames realizados no corpo (laudos)
CREATE TABLE exame_pericial (
    id_exame            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_corpo            INTEGER     NOT NULL REFERENCES corpo(id_corpo),
    tipo_exame          VARCHAR(20) NOT NULL
                        CHECK (tipo_exame IN ('NECROPSIA','PAPILOSCOPICO','ODONTOLEGAL','DNA',
                                              'ANTROPOLOGICO','TOXICOLOGICO','RADIOLOGICO')),
    id_perito           INTEGER     REFERENCES usuario(id_usuario),
    numero_laudo        VARCHAR(30) UNIQUE,
    data_solicitacao    DATE        NOT NULL DEFAULT CURRENT_DATE,
    data_realizacao     DATE,
    id_causa            INTEGER     REFERENCES causa_morte(id_causa),   -- causa definitiva (necropsia)
    resultado           TEXT,
    conclusao           TEXT,
    status              VARCHAR(15) NOT NULL DEFAULT 'SOLICITADO'
                        CHECK (status IN ('SOLICITADO','EM_ANDAMENTO','CONCLUIDO','CANCELADO')),
    CHECK (data_realizacao IS NULL OR data_realizacao >= data_solicitacao)
);

-- Amostras de DNA: questionada (do corpo) ou de referência (da família / objetos do desaparecido)
CREATE TABLE amostra_dna (
    id_amostra          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_amostra      VARCHAR(30) NOT NULL UNIQUE,
    id_corpo            INTEGER     REFERENCES corpo(id_corpo),
    id_desaparecido     INTEGER     REFERENCES registro_desaparecimento(id_desaparecido),
    id_familiar_doador  INTEGER     REFERENCES familiar(id_familiar),
    tipo_material       VARCHAR(20) NOT NULL
                        CHECK (tipo_material IN ('SANGUE','SALIVA','OSSO','DENTE','CABELO',
                                                 'TECIDO','OBJETO_PESSOAL')),
    data_coleta         DATE        NOT NULL,
    laboratorio         VARCHAR(100),
    ref_banco_genetico  VARCHAR(50),                        -- código no banco de perfis genéticos
    status              VARCHAR(15) NOT NULL DEFAULT 'COLETADA'
                        CHECK (status IN ('COLETADA','EM_ANALISE','PERFIL_GERADO','INSUFICIENTE')),
    CHECK (num_nonnulls(id_corpo, id_desaparecido) = 1),
    CHECK (id_familiar_doador IS NULL OR id_desaparecido IS NOT NULL)
);


-- =====================================================================
-- F. INVESTIGAÇÃO (cruzamento e apuração)
-- =====================================================================

-- Correspondência sugerida entre um corpo e um desaparecido, com pontuação
CREATE TABLE correspondencia (
    id_correspondencia  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_corpo            INTEGER      NOT NULL REFERENCES corpo(id_corpo),
    id_desaparecido     INTEGER      NOT NULL REFERENCES registro_desaparecimento(id_desaparecido),
    pts_sexo            NUMERIC(5,2) NOT NULL DEFAULT 0,    -- máx. 20
    pts_idade           NUMERIC(5,2) NOT NULL DEFAULT 0,    -- máx. 20
    pts_altura          NUMERIC(5,2) NOT NULL DEFAULT 0,    -- máx. 15
    pts_local           NUMERIC(5,2) NOT NULL DEFAULT 0,    -- máx. 15
    pts_data            NUMERIC(5,2) NOT NULL DEFAULT 0,    -- máx. 10
    pts_sinais          NUMERIC(5,2) NOT NULL DEFAULT 0,    -- máx. 20
    score_total         NUMERIC(5,2) GENERATED ALWAYS AS
                        (pts_sexo + pts_idade + pts_altura + pts_local + pts_data + pts_sinais) STORED,
    origem              VARCHAR(10)  NOT NULL DEFAULT 'AUTOMATICA'
                        CHECK (origem IN ('AUTOMATICA','MANUAL')),
    status              VARCHAR(15)  NOT NULL DEFAULT 'SUGERIDA'
                        CHECK (status IN ('SUGERIDA','EM_ANALISE','DESCARTADA','CONFIRMADA')),
    data_geracao        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_analise  INTEGER      REFERENCES usuario(id_usuario),
    data_analise        TIMESTAMP,
    justificativa       TEXT,                               -- obrigatória ao descartar/confirmar
    UNIQUE (id_corpo, id_desaparecido),
    CHECK (status IN ('SUGERIDA','EM_ANALISE') OR justificativa IS NOT NULL)
);

-- Quais sinais do corpo bateram com quais sinais do desaparecido
CREATE TABLE correspondencia_sinal (
    id_correspondencia    INTEGER NOT NULL REFERENCES correspondencia(id_correspondencia) ON DELETE CASCADE,
    id_sinal_corpo        INTEGER NOT NULL REFERENCES sinal_particular(id_sinal),
    id_sinal_desaparecido INTEGER NOT NULL REFERENCES sinal_particular(id_sinal),
    grau_similaridade     VARCHAR(10) NOT NULL DEFAULT 'PARCIAL'
                          CHECK (grau_similaridade IN ('PARCIAL','ALTA','EXATA')),
    observacao            VARCHAR(255),
    PRIMARY KEY (id_correspondencia, id_sinal_corpo, id_sinal_desaparecido)
);

-- Cada etapa de apuração de uma correspondência (confrontos, reconhecimentos)
CREATE TABLE analise_investigacao (
    id_analise          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_correspondencia  INTEGER     NOT NULL REFERENCES correspondencia(id_correspondencia),
    tipo_analise        VARCHAR(30) NOT NULL
                        CHECK (tipo_analise IN ('COMPARACAO_FOTOGRAFICA','CONFRONTO_DIGITAL','CONFRONTO_DNA',
                                                'CONFRONTO_ODONTOLOGICO','RECONHECIMENTO_FAMILIAR',
                                                'ANALISE_DOCUMENTAL','ENTREVISTA_FAMILIAR')),
    id_exame            INTEGER     REFERENCES exame_pericial(id_exame),   -- laudo que embasa
    id_usuario          INTEGER     NOT NULL REFERENCES usuario(id_usuario),
    data_analise        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resultado           VARCHAR(15) NOT NULL
                        CHECK (resultado IN ('COMPATIVEL','INCOMPATIVEL','INCONCLUSIVO','PENDENTE')),
    descricao           TEXT
);


-- =====================================================================
-- G. DESFECHO
-- =====================================================================

-- Identificação oficial (um corpo só pode ser identificado uma vez, e vice-versa)
CREATE TABLE identificacao (
    id_identificacao    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_corpo            INTEGER     NOT NULL UNIQUE REFERENCES corpo(id_corpo),
    id_desaparecido     INTEGER     NOT NULL UNIQUE REFERENCES registro_desaparecimento(id_desaparecido),
    id_correspondencia  INTEGER     REFERENCES correspondencia(id_correspondencia),
    metodo              VARCHAR(25) NOT NULL
                        CHECK (metodo IN ('DIGITAL','DNA','ARCADA_DENTARIA','RECONHECIMENTO_VISUAL',
                                          'DOCUMENTAL','ANTROPOLOGICO')),
    id_exame            INTEGER     REFERENCES exame_pericial(id_exame),
    id_perito           INTEGER     NOT NULL REFERENCES usuario(id_usuario),
    numero_laudo        VARCHAR(30),
    data_identificacao  DATE        NOT NULL,
    observacoes         TEXT
);

-- Entrega do corpo à família
CREATE TABLE liberacao_corpo (
    id_liberacao            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_corpo                INTEGER     NOT NULL UNIQUE REFERENCES corpo(id_corpo),
    id_familiar             INTEGER     NOT NULL REFERENCES familiar(id_familiar),   -- quem retirou
    data_liberacao          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    funeraria               VARCHAR(120),
    numero_certidao_obito   VARCHAR(40),
    destino                 VARCHAR(15) CHECK (destino IN ('SEPULTAMENTO','CREMACAO','TRASLADO')),
    id_usuario              INTEGER     NOT NULL REFERENCES usuario(id_usuario),
    observacoes             TEXT
);


-- =====================================================================
-- H. AUDITORIA
-- =====================================================================

-- Linha do tempo de mudanças de status (corpo, desaparecimento, correspondência)
CREATE TABLE historico_status (
    id_historico    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entidade        VARCHAR(20) NOT NULL
                    CHECK (entidade IN ('CORPO','DESAPARECIMENTO','CORRESPONDENCIA')),
    id_registro     INTEGER     NOT NULL,
    status_anterior VARCHAR(30),
    status_novo     VARCHAR(30) NOT NULL,
    data_alteracao  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario      INTEGER     REFERENCES usuario(id_usuario),
    observacao      TEXT
);


-- =====================================================================
-- ÍNDICES (chaves estrangeiras e campos usados no cruzamento)
-- =====================================================================
CREATE INDEX ix_desap_status       ON registro_desaparecimento (status, sexo);
CREATE INDEX ix_desap_local        ON registro_desaparecimento (id_local);
CREATE INDEX ix_desap_data         ON registro_desaparecimento (data_desaparecimento);
CREATE INDEX ix_corpo_status       ON corpo (status, sexo);
CREATE INDEX ix_entrada_local      ON registro_entrada (id_local);
CREATE INDEX ix_entrada_data       ON registro_entrada (data_encontrado);
CREATE INDEX ix_sinal_corpo        ON sinal_particular (id_corpo, id_tipo_sinal, id_regiao);
CREATE INDEX ix_sinal_desap        ON sinal_particular (id_desaparecido, id_tipo_sinal, id_regiao);
CREATE INDEX ix_foto_corpo         ON foto_registro (id_corpo);
CREATE INDEX ix_foto_desap         ON foto_registro (id_desaparecido);
CREATE INDEX ix_exame_corpo        ON exame_pericial (id_corpo, tipo_exame);
CREATE INDEX ix_corresp_score      ON correspondencia (status, score_total DESC);
CREATE INDEX ix_corresp_desap      ON correspondencia (id_desaparecido);
CREATE INDEX ix_analise_corresp    ON analise_investigacao (id_correspondencia);
CREATE INDEX ix_historico_registro ON historico_status (entidade, id_registro);
CREATE INDEX ix_local_cidade       ON local (uf, cidade);


-- =====================================================================
-- VIEW DE CRUZAMENTO AUTOMÁTICO
-- Compara cada corpo pendente com cada desaparecido ativo e pontua (0–100):
--   sexo 20 | idade 20 | altura 15 | local 15 | data 10 | sinais 20
-- Filtros eliminatórios: sexo incompatível e corpo encontrado ANTES do desaparecimento.
-- =====================================================================
CREATE OR REPLACE VIEW vw_candidatos_correspondencia AS
WITH pares AS (
    SELECT
        c.id_corpo,
        c.codigo_iml,
        d.id_desaparecido,
        d.nome_desaparecido,
        c.sexo                      AS sexo_corpo,
        d.sexo                      AS sexo_desap,
        c.idade_estimada_min,
        c.idade_estimada_max,
        COALESCE(
            EXTRACT(YEAR FROM age(e.data_encontrado, d.data_nascimento)),
            d.idade_desaparecimento
              + EXTRACT(YEAR FROM age(e.data_encontrado, d.data_desaparecimento))
        )::INT                      AS idade_desap_na_data,
        c.altura_estimada_cm,
        d.altura_cm                 AS altura_desap,
        lc.cidade                   AS cidade_corpo,
        lc.uf                       AS uf_corpo,
        ld.cidade                   AS cidade_desap,
        ld.uf                       AS uf_desap,
        (e.data_encontrado - d.data_desaparecimento) AS dias_entre
    FROM corpo c
    JOIN registro_entrada e  ON e.id_corpo = c.id_corpo
    JOIN local lc            ON lc.id_local = e.id_local
    JOIN registro_desaparecimento d
                             ON (c.sexo = 'I' OR c.sexo = d.sexo)
                            AND e.data_encontrado >= d.data_desaparecimento
    LEFT JOIN local ld       ON ld.id_local = d.id_local
    WHERE c.status IN ('AGUARDANDO_IDENTIFICACAO','EM_ANALISE')
      AND d.status IN ('ATIVO','EM_ANALISE')
),
notas AS (
    SELECT
        p.*,
        CASE WHEN p.sexo_corpo = p.sexo_desap THEN 20 ELSE 10 END AS pts_sexo,
        CASE
            WHEN p.idade_desap_na_data IS NULL OR p.idade_estimada_min IS NULL THEN 0
            WHEN p.idade_desap_na_data BETWEEN p.idade_estimada_min AND p.idade_estimada_max THEN 20
            WHEN p.idade_desap_na_data BETWEEN p.idade_estimada_min - 5
                                           AND p.idade_estimada_max + 5 THEN 10
            ELSE 0
        END AS pts_idade,
        CASE
            WHEN p.altura_desap IS NULL OR p.altura_estimada_cm IS NULL THEN 0
            WHEN abs(p.altura_desap - p.altura_estimada_cm) <= 5  THEN 15
            WHEN abs(p.altura_desap - p.altura_estimada_cm) <= 10 THEN 8
            ELSE 0
        END AS pts_altura,
        CASE
            WHEN p.uf_desap = p.uf_corpo AND lower(p.cidade_desap) = lower(p.cidade_corpo) THEN 15
            WHEN p.uf_desap = p.uf_corpo THEN 8
            ELSE 0
        END AS pts_local,
        CASE
            WHEN p.dias_entre <= 30   THEN 10
            WHEN p.dias_entre <= 365  THEN 6
            WHEN p.dias_entre <= 1825 THEN 3
            ELSE 0
        END AS pts_data,
        COALESCE(ROUND(20.0 * s.sinais_compativeis / NULLIF(s.sinais_desap, 0), 2), 0) AS pts_sinais,
        s.sinais_desap,
        s.sinais_compativeis
    FROM pares p
    CROSS JOIN LATERAL (
        SELECT
            COUNT(*) AS sinais_desap,
            COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1
                FROM sinal_particular sc
                WHERE sc.id_corpo      = p.id_corpo
                  AND sc.id_tipo_sinal = sd.id_tipo_sinal
                  AND sc.id_regiao     = sd.id_regiao
            )) AS sinais_compativeis
        FROM sinal_particular sd
        WHERE sd.id_desaparecido = p.id_desaparecido
    ) s
)
SELECT
    n.*,
    (n.pts_sexo + n.pts_idade + n.pts_altura + n.pts_local + n.pts_data + n.pts_sinais) AS score_total
FROM notas n;


-- =====================================================================
-- CARGA INICIAL DAS TABELAS DE APOIO
-- =====================================================================
INSERT INTO tipo_sinal (descricao) VALUES
  ('Tatuagem'), ('Cicatriz'), ('Prótese'), ('Piercing'), ('Marca de nascença'),
  ('Amputação'), ('Deformidade'), ('Pinta / Nevo'), ('Implante dentário'), ('Fratura consolidada');

INSERT INTO regiao_corpo (descricao) VALUES
  ('Cabeça'), ('Rosto'), ('Pescoço'), ('Ombro'), ('Tórax'), ('Abdômen'), ('Costas'),
  ('Braço'), ('Antebraço'), ('Punho'), ('Mão'), ('Quadril'), ('Glúteo'), ('Coxa'),
  ('Joelho'), ('Perna'), ('Tornozelo'), ('Pé'), ('Boca / Arcada dentária');

INSERT INTO causa_morte (codigo_cid, descricao, categoria) VALUES
  (NULL,  'Causa a esclarecer',                   'INDETERMINADA'),
  ('W74', 'Afogamento',                           'ACIDENTAL'),
  ('V89', 'Acidente de trânsito',                 'ACIDENTAL'),
  ('X95', 'Agressão por disparo de arma de fogo', 'HOMICIDIO'),
  ('X99', 'Agressão por objeto cortante',         'HOMICIDIO'),
  ('I21', 'Infarto agudo do miocárdio',           'NATURAL'),
  ('T40', 'Intoxicação por drogas',               'INDETERMINADA');


-- =====================================================================
-- ROTINA: gravar as sugestões da view na tabela correspondencia
-- (executar periodicamente ou após cada novo cadastro)
-- Implementada como função em 02_logica.sql: SELECT fn_gerar_correspondencias();
-- =====================================================================
-- INSERT INTO correspondencia (id_corpo, id_desaparecido, pts_sexo, pts_idade,
--                              pts_altura, pts_local, pts_data, pts_sinais)
-- SELECT id_corpo, id_desaparecido, pts_sexo, pts_idade,
--        pts_altura, pts_local, pts_data, pts_sinais
-- FROM vw_candidatos_correspondencia
-- WHERE score_total >= 50
-- ON CONFLICT (id_corpo, id_desaparecido) DO NOTHING;
