-- =====================================================================
-- ACHADOS E PERDIDOS DO IML — Testes do modelo (seção 10 da especificação)
-- Executar depois do seed:  psql -d iml -f db/04_testes.sql
-- Tudo roda numa transação desfeita no final: o banco não é alterado.
-- Cada teste imprime "OK" ou interrompe o script com "FALHOU".
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

-- Executa um comando que DEVE ser recusado pelo banco
CREATE FUNCTION pg_temp.deve_bloquear(p_teste TEXT, p_sql TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'FALHOU: % (o banco aceitou)', p_teste;
EXCEPTION
    WHEN raise_exception OR check_violation OR unique_violation
      OR not_null_violation OR foreign_key_violation THEN
        IF SQLERRM LIKE 'FALHOU:%' THEN RAISE; END IF;
        RAISE NOTICE 'OK  %  -> bloqueado: %', p_teste, SQLERRM;
END;
$$;

CREATE FUNCTION pg_temp.confere(p_teste TEXT, p_ok BOOLEAN, p_detalhe TEXT DEFAULT '') RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    IF p_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'FALHOU: % %', p_teste, p_detalhe;
    END IF;
    RAISE NOTICE 'OK  %  %', p_teste, p_detalhe;
END;
$$;

-- ---------------------------------------------------------------------
-- 1. Cruzamento: desaparecido compatível = 90 pontos
-- ---------------------------------------------------------------------
SELECT pg_temp.confere('Cruzamento compatível (Valdemar x IML-2026-000101) = 90',
       score_total = 90, '(obtido: ' || score_total || ')')
  FROM correspondencia co
  JOIN corpo c USING (id_corpo)
  JOIN registro_desaparecimento d USING (id_desaparecido)
 WHERE c.codigo_iml = 'IML-2026-000101' AND d.nome_desaparecido = 'Valdemar Pereira da Silva';

-- ---------------------------------------------------------------------
-- 2. Cruzamento: desaparecido incompatível = 34 pontos e não gravado
-- ---------------------------------------------------------------------
SELECT pg_temp.confere('Cruzamento incompatível (Josué x IML-2026-000101) = 34',
       v.score_total = 34
       AND NOT EXISTS (SELECT 1 FROM correspondencia co
                        WHERE co.id_corpo = v.id_corpo AND co.id_desaparecido = v.id_desaparecido),
       '(obtido: ' || v.score_total || ', não gravado)')
  FROM vw_candidatos_correspondencia v
 WHERE v.codigo_iml = 'IML-2026-000101' AND v.nome_desaparecido = 'Josué Antunes';

-- ---------------------------------------------------------------------
-- 3. Regras bloqueadas pelo banco
-- ---------------------------------------------------------------------
SELECT pg_temp.deve_bloquear('Sinal ligado a corpo E desaparecido ao mesmo tempo',
    $q$INSERT INTO sinal_particular (id_corpo, id_desaparecido, id_tipo_sinal, id_regiao, descricao)
       VALUES (1, 1, 1, 1, 'teste')$q$);

SELECT pg_temp.deve_bloquear('Descartar correspondência sem justificativa',
    $q$UPDATE correspondencia SET status = 'DESCARTADA', justificativa = NULL
        WHERE status = 'SUGERIDA'$q$);

SELECT pg_temp.deve_bloquear('Identificar o mesmo corpo duas vezes',
    $q$INSERT INTO identificacao (id_corpo, id_desaparecido, metodo, id_perito, data_identificacao)
       SELECT i.id_corpo, d.id_desaparecido, 'DNA', i.id_perito, CURRENT_DATE
         FROM identificacao i, registro_desaparecimento d
        WHERE d.nome_desaparecido = 'Josué Antunes' LIMIT 1$q$);

SELECT pg_temp.deve_bloquear('Desaparecido sem data de nascimento e sem idade',
    $q$INSERT INTO registro_desaparecimento (nome_desaparecido, sexo, data_desaparecimento)
       VALUES ('Fulano Sem Idade', 'M', CURRENT_DATE)$q$);

SELECT pg_temp.deve_bloquear('Idade mínima estimada maior que a máxima',
    $q$INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max) VALUES ('M', 50, 30)$q$);

SELECT pg_temp.deve_bloquear('Liberar corpo que ainda não foi identificado',
    $q$INSERT INTO liberacao_corpo (id_corpo, id_familiar, id_usuario)
       SELECT c.id_corpo, 1, 1 FROM corpo c WHERE c.codigo_iml = 'IML-2026-000105'$q$);

-- ---------------------------------------------------------------------
-- 4. Fluxo completo: Rosimeire x IML-2026-000102
--    correspondência -> análise -> identificação -> liberação
-- ---------------------------------------------------------------------
SELECT set_config('app.id_usuario',
       (SELECT id_usuario::TEXT FROM usuario WHERE perfil = 'INVESTIGADOR' LIMIT 1), true);

CREATE TEMP TABLE caso AS
SELECT co.id_correspondencia, co.id_corpo, co.id_desaparecido, co.score_total
  FROM correspondencia co
  JOIN corpo c USING (id_corpo)
  JOIN registro_desaparecimento d USING (id_desaparecido)
 WHERE c.codigo_iml = 'IML-2026-000102' AND d.nome_desaparecido = 'Rosimeire Fagundes';

SELECT pg_temp.confere('Match perfeito (Rosimeire x IML-2026-000102) = 100',
       score_total = 100, '(obtido: ' || score_total || ')') FROM caso;

SELECT pg_temp.confere('Sinais coincidentes detalhados em correspondencia_sinal',
       (SELECT count(*) FROM correspondencia_sinal cs JOIN caso USING (id_correspondencia)) = 2);

UPDATE correspondencia SET status = 'EM_ANALISE'
 WHERE id_correspondencia = (SELECT id_correspondencia FROM caso);

SELECT pg_temp.confere('Assumir a análise leva corpo e desaparecido para EM_ANALISE',
       c.status = 'EM_ANALISE' AND d.status = 'EM_ANALISE')
  FROM caso JOIN corpo c USING (id_corpo) JOIN registro_desaparecimento d USING (id_desaparecido);

INSERT INTO analise_investigacao (id_correspondencia, tipo_analise, id_usuario, resultado)
SELECT id_correspondencia, 'RECONHECIMENTO_FAMILIAR', fn_usuario_atual(), 'COMPATIVEL' FROM caso;

SELECT set_config('app.id_usuario',
       (SELECT id_usuario::TEXT FROM usuario WHERE perfil = 'PERITO' LIMIT 1), true);

INSERT INTO identificacao (id_corpo, id_desaparecido, metodo, id_perito, data_identificacao)
SELECT id_corpo, id_desaparecido, 'RECONHECIMENTO_VISUAL', fn_usuario_atual(), CURRENT_DATE FROM caso;

SELECT pg_temp.confere('Identificação: corpo IDENTIFICADO, desaparecido IDENTIFICADO_OBITO, match CONFIRMADA',
       c.status = 'IDENTIFICADO' AND d.status = 'IDENTIFICADO_OBITO' AND co.status = 'CONFIRMADA')
  FROM caso
  JOIN corpo c USING (id_corpo)
  JOIN registro_desaparecimento d USING (id_desaparecido)
  JOIN correspondencia co USING (id_correspondencia);

SELECT pg_temp.confere('Outras sugestões do mesmo corpo foram descartadas automaticamente',
       NOT EXISTS (SELECT 1 FROM correspondencia co JOIN caso ON co.id_corpo = caso.id_corpo
                    WHERE co.id_correspondencia <> caso.id_correspondencia
                      AND co.status IN ('SUGERIDA','EM_ANALISE')));

SELECT pg_temp.deve_bloquear('Liberar para familiar que não é da pessoa identificada',
    $q$INSERT INTO liberacao_corpo (id_corpo, id_familiar, id_usuario)
       SELECT caso.id_corpo, f.id_familiar, 1 FROM caso, familiar f
        WHERE f.nome = 'Sandra Antunes'$q$);

INSERT INTO liberacao_corpo (id_corpo, id_familiar, destino, id_usuario)
SELECT caso.id_corpo, fd.id_familiar, 'SEPULTAMENTO', fn_usuario_atual()
  FROM caso JOIN familiar_desaparecido fd USING (id_desaparecido)
 LIMIT 1;

SELECT pg_temp.confere('Liberação: corpo LIBERADO',
       c.status = 'LIBERADO') FROM caso JOIN corpo c USING (id_corpo);

-- ---------------------------------------------------------------------
-- 5. Auditoria: cada mudança gerou histórico com usuário
-- ---------------------------------------------------------------------
SELECT pg_temp.confere('historico_status registra a linha do tempo do corpo',
       array_agg(h.status_novo ORDER BY h.id_historico)
         = ARRAY['AGUARDANDO_IDENTIFICACAO','EM_ANALISE','IDENTIFICADO','LIBERADO']::VARCHAR[],
       '(' || array_to_string(array_agg(h.status_novo ORDER BY h.id_historico), ' -> ') || ')')
  FROM caso JOIN historico_status h ON h.entidade = 'CORPO' AND h.id_registro = caso.id_corpo;

SELECT pg_temp.confere('Toda mudança feita no fluxo tem usuário responsável',
       bool_and(h.id_usuario IS NOT NULL))
  FROM caso JOIN historico_status h
    ON (h.entidade = 'CORPO' AND h.id_registro = caso.id_corpo AND h.status_anterior IS NOT NULL)
    OR (h.entidade = 'CORRESPONDENCIA' AND h.id_registro = caso.id_correspondencia);

\echo
\echo 'Todos os testes passaram. Desfazendo as alterações...'
ROLLBACK;
