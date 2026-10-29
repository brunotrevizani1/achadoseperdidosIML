-- =====================================================================
-- ACHADOS E PERDIDOS DO IML — Testes do modelo
-- Executar depois do seed:  npm run db:testar
-- Tudo roda numa transação desfeita no final: o banco não é alterado.
-- Cada teste imprime "OK" ou interrompe o script com "FALHOU".
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

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

-- 1. Estrutura
SELECT pg_temp.confere('Banco enxuto: 6 tabelas',
       count(*) = 6, '(obtido: ' || count(*) || ')')
  FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Códigos automáticos
SELECT pg_temp.confere('Códigos automáticos',
       (SELECT codigo FROM objeto ORDER BY id_objeto LIMIT 1) ~ '^OBJ-\d{4}-\d{6}$'
       AND (SELECT codigo_iml FROM corpo ORDER BY id_corpo LIMIT 1) ~ '^IML-\d{4}-\d{6}$');

-- 3. Regras bloqueadas pelo banco
SELECT pg_temp.deve_bloquear('Manifestação para objeto E corpo',
    $q$INSERT INTO manifestacao (id_objeto, id_corpo, nome, contato, parentesco, o_que_reconheceu)
       VALUES (1, 1, 'a', 'b', 'AMIGO', 'c')$q$);
SELECT pg_temp.deve_bloquear('Idade mínima maior que a máxima',
    $q$INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, id_local, data_encontrado)
       VALUES ('M', 50, 20, 1, CURRENT_DATE)$q$);
SELECT pg_temp.deve_bloquear('Aceitar manifestação sem parecer',
    $q$UPDATE manifestacao SET status = 'ACEITA' WHERE status = 'RECEBIDA'$q$);
SELECT pg_temp.deve_bloquear('Manifestação sobre objeto já devolvido',
    $q$INSERT INTO manifestacao (id_objeto, nome, contato, parentesco, o_que_reconheceu)
       SELECT id_objeto, 'a', 'b', 'AMIGO', 'c' FROM objeto WHERE status = 'DEVOLVIDO' LIMIT 1$q$);
SELECT pg_temp.deve_bloquear('Manifestação sobre corpo já identificado',
    $q$INSERT INTO manifestacao (id_corpo, nome, contato, parentesco, o_que_reconheceu)
       SELECT id_corpo, 'a', 'b', 'AMIGO', 'c' FROM corpo WHERE status = 'IDENTIFICADO' LIMIT 1$q$);

-- 4. Aceitar a manifestação da aliança devolve o objeto e recusa as concorrentes
INSERT INTO manifestacao (id_objeto, nome, contato, parentesco, o_que_reconheceu)
SELECT id_objeto, 'Concorrente', 'x@x.demo', 'OUTRO', 'Também acho que é meu'
  FROM objeto WHERE tipo = 'ALIANCA';

SELECT set_config('app.id_usuario', (SELECT id_usuario::TEXT FROM usuario ORDER BY id_usuario LIMIT 1), true);

UPDATE manifestacao SET status = 'ACEITA', parecer = 'Gravação confere com a certidão de casamento.'
 WHERE nome = 'Josiane Medeiros';

SELECT pg_temp.confere('Aceitar manifestação devolve o objeto',
       (SELECT status FROM objeto WHERE tipo = 'ALIANCA') = 'DEVOLVIDO');
SELECT pg_temp.confere('Manifestação concorrente é recusada sozinha',
       (SELECT status FROM manifestacao WHERE nome = 'Concorrente') = 'RECUSADA');
SELECT pg_temp.confere('Avaliador e data ficam registrados',
       (SELECT id_usuario_analise IS NOT NULL AND data_analise IS NOT NULL
          FROM manifestacao WHERE nome = 'Josiane Medeiros'));
SELECT pg_temp.deve_bloquear('Reabrir manifestação decidida',
    $q$UPDATE manifestacao SET status = 'EM_ANALISE' WHERE nome = 'Josiane Medeiros'$q$);

-- 5. Histórico de status
SELECT pg_temp.confere('Histórico do objeto registra o desfecho',
       EXISTS (SELECT 1 FROM historico_status h JOIN objeto o ON o.id_objeto = h.id_registro
                WHERE h.entidade = 'OBJETO' AND o.tipo = 'ALIANCA'
                  AND h.status_anterior = 'EM_GUARDA' AND h.status_novo = 'DEVOLVIDO'));

-- 6. Aceitar manifestação de corpo identifica o corpo
UPDATE manifestacao SET status = 'ACEITA', parecer = 'Tatuagem e cicatriz conferem.'
 WHERE nome = 'Rita de Cássia Lopes';
SELECT pg_temp.confere('Aceitar manifestação identifica o corpo',
       (SELECT c.status FROM corpo c JOIN manifestacao m USING (id_corpo)
         WHERE m.nome = 'Rita de Cássia Lopes') = 'IDENTIFICADO');

ROLLBACK;
