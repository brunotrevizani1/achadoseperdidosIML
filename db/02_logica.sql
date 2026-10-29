-- =====================================================================
-- ACHADOS E PERDIDOS DO IML — Lógica no banco
-- Funções e triggers que implementam as regras descritas na especificação
-- (seções 7 e 8) e que o script do modelo não trazia.
-- Executar depois de 01_schema.sql.
-- =====================================================================


-- =====================================================================
-- APOIO: usuário da sessão e geração de códigos
-- =====================================================================

-- O backend executa "SET LOCAL app.id_usuario = <id>" no início de cada
-- transação; assim os triggers sabem quem fez cada mudança.
CREATE OR REPLACE FUNCTION fn_usuario_atual() RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.id_usuario', true), '')::INTEGER;
$$;

CREATE SEQUENCE seq_protocolo_desaparecimento;
CREATE SEQUENCE seq_codigo_iml;

-- DES-2026-000045
CREATE OR REPLACE FUNCTION fn_novo_protocolo() RETURNS VARCHAR
LANGUAGE sql AS $$
    SELECT 'DES-' || to_char(CURRENT_DATE, 'YYYY') || '-'
           || lpad(nextval('seq_protocolo_desaparecimento')::TEXT, 6, '0');
$$;

-- IML-2026-000123
CREATE OR REPLACE FUNCTION fn_novo_codigo_iml() RETURNS VARCHAR
LANGUAGE sql AS $$
    SELECT 'IML-' || to_char(CURRENT_DATE, 'YYYY') || '-'
           || lpad(nextval('seq_codigo_iml')::TEXT, 6, '0');
$$;

ALTER TABLE registro_desaparecimento ALTER COLUMN protocolo  SET DEFAULT fn_novo_protocolo();
ALTER TABLE corpo                    ALTER COLUMN codigo_iml SET DEFAULT fn_novo_codigo_iml();


-- =====================================================================
-- H. AUDITORIA — toda mudança de status gera registro em historico_status
-- TG_ARGV[0] = entidade gravada no histórico; TG_ARGV[1] = coluna da PK
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_historico_status() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO historico_status (entidade, id_registro, status_anterior, status_novo,
                                  id_usuario, observacao)
    VALUES (
        TG_ARGV[0],
        (to_jsonb(NEW) ->> TG_ARGV[1])::INTEGER,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
        NEW.status,
        fn_usuario_atual(),
        COALESCE(NULLIF(current_setting('app.observacao', true), ''),
                 CASE WHEN TG_OP = 'INSERT' THEN 'Cadastro' END)
    );
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_hist_corpo_ins
    AFTER INSERT ON corpo
    FOR EACH ROW EXECUTE FUNCTION fn_historico_status('CORPO', 'id_corpo');
CREATE TRIGGER trg_hist_corpo_upd
    AFTER UPDATE OF status ON corpo
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_historico_status('CORPO', 'id_corpo');

CREATE TRIGGER trg_hist_desap_ins
    AFTER INSERT ON registro_desaparecimento
    FOR EACH ROW EXECUTE FUNCTION fn_historico_status('DESAPARECIMENTO', 'id_desaparecido');
CREATE TRIGGER trg_hist_desap_upd
    AFTER UPDATE OF status ON registro_desaparecimento
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_historico_status('DESAPARECIMENTO', 'id_desaparecido');

CREATE TRIGGER trg_hist_corresp_ins
    AFTER INSERT ON correspondencia
    FOR EACH ROW EXECUTE FUNCTION fn_historico_status('CORRESPONDENCIA', 'id_correspondencia');
CREATE TRIGGER trg_hist_corresp_upd
    AFTER UPDATE OF status ON correspondencia
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_historico_status('CORRESPONDENCIA', 'id_correspondencia');


-- =====================================================================
-- F. INVESTIGAÇÃO — rotina de gravação das sugestões (seção 7)
-- Grava os pares com nota >= 50 e detalha os sinais que coincidiram.
-- Retorna quantas correspondências novas foram criadas.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_gerar_correspondencias(p_nota_minima NUMERIC DEFAULT 50)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_novas INTEGER;
BEGIN
    INSERT INTO correspondencia (id_corpo, id_desaparecido, pts_sexo, pts_idade,
                                 pts_altura, pts_local, pts_data, pts_sinais)
    SELECT id_corpo, id_desaparecido, pts_sexo, pts_idade,
           pts_altura, pts_local, pts_data, pts_sinais
    FROM vw_candidatos_correspondencia
    WHERE score_total >= p_nota_minima
    ON CONFLICT (id_corpo, id_desaparecido) DO NOTHING;

    GET DIAGNOSTICS v_novas = ROW_COUNT;

    -- Sinais do mesmo tipo e região; mesmo lado conta como similaridade ALTA
    INSERT INTO correspondencia_sinal (id_correspondencia, id_sinal_corpo,
                                       id_sinal_desaparecido, grau_similaridade)
    SELECT co.id_correspondencia, sc.id_sinal, sd.id_sinal,
           CASE WHEN sc.lado IS NOT DISTINCT FROM sd.lado THEN 'ALTA' ELSE 'PARCIAL' END
    FROM correspondencia co
    JOIN sinal_particular sc ON sc.id_corpo        = co.id_corpo
    JOIN sinal_particular sd ON sd.id_desaparecido = co.id_desaparecido
                            AND sd.id_tipo_sinal   = sc.id_tipo_sinal
                            AND sd.id_regiao       = sc.id_regiao
    WHERE co.status IN ('SUGERIDA','EM_ANALISE')
    ON CONFLICT DO NOTHING;

    RETURN v_novas;
END;
$$;


-- =====================================================================
-- F. INVESTIGAÇÃO — ciclo de status da correspondência (seção 8)
-- =====================================================================

-- Ao sair de SUGERIDA, registra quem analisou e quando
CREATE OR REPLACE FUNCTION fn_corresp_marca_analise() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status IN ('CONFIRMADA','DESCARTADA') THEN
        RAISE EXCEPTION 'A correspondência % já foi encerrada como %.',
                        OLD.id_correspondencia, OLD.status;
    END IF;
    NEW.id_usuario_analise := COALESCE(fn_usuario_atual(), NEW.id_usuario_analise);
    NEW.data_analise       := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_corresp_marca_analise
    BEFORE UPDATE OF status ON correspondencia
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_corresp_marca_analise();

-- EM_ANALISE leva corpo e desaparecido para EM_ANALISE;
-- DESCARTADA devolve os dois à fila se não houver outra apuração aberta.
CREATE OR REPLACE FUNCTION fn_corresp_propaga_status() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'EM_ANALISE' THEN
        UPDATE corpo SET status = 'EM_ANALISE'
         WHERE id_corpo = NEW.id_corpo AND status = 'AGUARDANDO_IDENTIFICACAO';
        UPDATE registro_desaparecimento SET status = 'EM_ANALISE'
         WHERE id_desaparecido = NEW.id_desaparecido AND status = 'ATIVO';

    ELSIF NEW.status = 'DESCARTADA' THEN
        UPDATE corpo SET status = 'AGUARDANDO_IDENTIFICACAO'
         WHERE id_corpo = NEW.id_corpo AND status = 'EM_ANALISE'
           AND NOT EXISTS (SELECT 1 FROM correspondencia o
                            WHERE o.id_corpo = NEW.id_corpo AND o.status = 'EM_ANALISE');
        UPDATE registro_desaparecimento SET status = 'ATIVO'
         WHERE id_desaparecido = NEW.id_desaparecido AND status = 'EM_ANALISE'
           AND NOT EXISTS (SELECT 1 FROM correspondencia o
                            WHERE o.id_desaparecido = NEW.id_desaparecido AND o.status = 'EM_ANALISE');
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_corresp_propaga_status
    AFTER UPDATE OF status ON correspondencia
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_corresp_propaga_status();


-- =====================================================================
-- G. DESFECHO — identificação oficial
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_identificacao_valida() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_status_corpo VARCHAR(30);
    v_status_desap VARCHAR(25);
BEGIN
    SELECT status INTO v_status_corpo FROM corpo WHERE id_corpo = NEW.id_corpo;
    IF v_status_corpo NOT IN ('AGUARDANDO_IDENTIFICACAO','EM_ANALISE') THEN
        RAISE EXCEPTION 'O corpo % não pode ser identificado: situação atual é %.',
                        NEW.id_corpo, v_status_corpo;
    END IF;

    SELECT status INTO v_status_desap
      FROM registro_desaparecimento WHERE id_desaparecido = NEW.id_desaparecido;
    IF v_status_desap NOT IN ('ATIVO','EM_ANALISE') THEN
        RAISE EXCEPTION 'O desaparecido % não pode ser vinculado: situação atual é %.',
                        NEW.id_desaparecido, v_status_desap;
    END IF;

    -- Se não informada, usa a correspondência do próprio par (quando existir)
    IF NEW.id_correspondencia IS NULL THEN
        SELECT id_correspondencia INTO NEW.id_correspondencia
          FROM correspondencia
         WHERE id_corpo = NEW.id_corpo AND id_desaparecido = NEW.id_desaparecido;
    ELSIF NOT EXISTS (SELECT 1 FROM correspondencia
                       WHERE id_correspondencia = NEW.id_correspondencia
                         AND id_corpo = NEW.id_corpo
                         AND id_desaparecido = NEW.id_desaparecido) THEN
        RAISE EXCEPTION 'A correspondência % não é deste corpo com este desaparecido.',
                        NEW.id_correspondencia;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_identificacao_valida
    BEFORE INSERT ON identificacao
    FOR EACH ROW EXECUTE FUNCTION fn_identificacao_valida();

CREATE OR REPLACE FUNCTION fn_identificacao_desfecho() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE corpo SET status = 'IDENTIFICADO' WHERE id_corpo = NEW.id_corpo;
    UPDATE registro_desaparecimento SET status = 'IDENTIFICADO_OBITO'
     WHERE id_desaparecido = NEW.id_desaparecido;

    IF NEW.id_correspondencia IS NOT NULL THEN
        UPDATE correspondencia
           SET status = 'CONFIRMADA',
               justificativa = COALESCE(justificativa,
                                        'Identificação oficial por ' || NEW.metodo)
         WHERE id_correspondencia = NEW.id_correspondencia
           AND status <> 'CONFIRMADA';
    END IF;

    -- As demais sugestões envolvendo este corpo ou este desaparecido perdem o sentido
    UPDATE correspondencia
       SET status = 'DESCARTADA',
           justificativa = 'Descartada automaticamente: identificação oficial nº '
                           || NEW.id_identificacao
     WHERE status IN ('SUGERIDA','EM_ANALISE')
       AND (id_corpo = NEW.id_corpo OR id_desaparecido = NEW.id_desaparecido);
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_identificacao_desfecho
    AFTER INSERT ON identificacao
    FOR EACH ROW EXECUTE FUNCTION fn_identificacao_desfecho();


-- =====================================================================
-- G. DESFECHO — liberação do corpo à família
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_liberacao_valida() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(30);
BEGIN
    SELECT status INTO v_status FROM corpo WHERE id_corpo = NEW.id_corpo;
    IF v_status <> 'IDENTIFICADO' THEN
        RAISE EXCEPTION 'Só é possível liberar corpo IDENTIFICADO (situação atual: %).', v_status;
    END IF;

    IF NOT EXISTS (SELECT 1
                     FROM identificacao i
                     JOIN familiar_desaparecido fd ON fd.id_desaparecido = i.id_desaparecido
                    WHERE i.id_corpo = NEW.id_corpo
                      AND fd.id_familiar = NEW.id_familiar) THEN
        RAISE EXCEPTION 'O familiar % não está vinculado à pessoa identificada.', NEW.id_familiar;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_liberacao_valida
    BEFORE INSERT ON liberacao_corpo
    FOR EACH ROW EXECUTE FUNCTION fn_liberacao_valida();

CREATE OR REPLACE FUNCTION fn_liberacao_desfecho() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE corpo SET status = 'LIBERADO' WHERE id_corpo = NEW.id_corpo;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_liberacao_desfecho
    AFTER INSERT ON liberacao_corpo
    FOR EACH ROW EXECUTE FUNCTION fn_liberacao_desfecho();
