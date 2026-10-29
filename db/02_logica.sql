-- =====================================================================
-- ACHADOS E PERDIDOS DO IML — Lógica no banco
-- Executar depois de 01_schema.sql.
-- =====================================================================

-- O backend executa set_config('app.id_usuario', ...) no início de cada
-- transação; assim os triggers sabem quem fez cada mudança.
CREATE OR REPLACE FUNCTION fn_usuario_atual() RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.id_usuario', true), '')::INTEGER;
$$;

-- ---------------------------------------------------------------------
-- Códigos: OBJ-2026-000012 e IML-2026-000123
-- ---------------------------------------------------------------------
CREATE SEQUENCE seq_codigo_objeto;
CREATE SEQUENCE seq_codigo_iml;

CREATE OR REPLACE FUNCTION fn_novo_codigo_objeto() RETURNS VARCHAR
LANGUAGE sql AS $$
    SELECT 'OBJ-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('seq_codigo_objeto')::TEXT, 6, '0');
$$;

CREATE OR REPLACE FUNCTION fn_novo_codigo_iml() RETURNS VARCHAR
LANGUAGE sql AS $$
    SELECT 'IML-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('seq_codigo_iml')::TEXT, 6, '0');
$$;

ALTER TABLE objeto ALTER COLUMN codigo     SET DEFAULT fn_novo_codigo_objeto();
ALTER TABLE corpo  ALTER COLUMN codigo_iml SET DEFAULT fn_novo_codigo_iml();

-- ---------------------------------------------------------------------
-- Histórico: toda mudança de status gera um registro
-- TG_ARGV[0] = entidade; TG_ARGV[1] = coluna da chave primária
-- ---------------------------------------------------------------------
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

CREATE TRIGGER trg_hist_objeto_ins AFTER INSERT ON objeto
    FOR EACH ROW EXECUTE FUNCTION fn_historico_status('OBJETO', 'id_objeto');
CREATE TRIGGER trg_hist_objeto_upd AFTER UPDATE OF status ON objeto
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_historico_status('OBJETO', 'id_objeto');

CREATE TRIGGER trg_hist_corpo_ins AFTER INSERT ON corpo
    FOR EACH ROW EXECUTE FUNCTION fn_historico_status('CORPO', 'id_corpo');
CREATE TRIGGER trg_hist_corpo_upd AFTER UPDATE OF status ON corpo
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_historico_status('CORPO', 'id_corpo');

CREATE TRIGGER trg_hist_manif_ins AFTER INSERT ON manifestacao
    FOR EACH ROW EXECUTE FUNCTION fn_historico_status('MANIFESTACAO', 'id_manifestacao');
CREATE TRIGGER trg_hist_manif_upd AFTER UPDATE OF status ON manifestacao
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_historico_status('MANIFESTACAO', 'id_manifestacao');

-- ---------------------------------------------------------------------
-- Manifestação: só se manifesta sobre item ainda aberto
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_manifestacao_valida() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id_objeto IS NOT NULL AND
       NOT EXISTS (SELECT 1 FROM objeto WHERE id_objeto = NEW.id_objeto AND status = 'EM_GUARDA') THEN
        RAISE EXCEPTION 'Este objeto já foi devolvido: não aceita novas manifestações.';
    END IF;
    IF NEW.id_corpo IS NOT NULL AND
       NOT EXISTS (SELECT 1 FROM corpo WHERE id_corpo = NEW.id_corpo AND status = 'NAO_IDENTIFICADO') THEN
        RAISE EXCEPTION 'Este corpo já foi identificado: não aceita novas manifestações.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_manifestacao_valida BEFORE INSERT ON manifestacao
    FOR EACH ROW EXECUTE FUNCTION fn_manifestacao_valida();

-- Ao sair de RECEBIDA, registra quem avaliou e quando
CREATE OR REPLACE FUNCTION fn_manifestacao_marca_analise() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status IN ('ACEITA','RECUSADA') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'Manifestação já decidida (%) não pode ser reaberta.', OLD.status;
    END IF;
    IF NEW.status <> 'RECEBIDA' THEN
        NEW.id_usuario_analise := COALESCE(fn_usuario_atual(), NEW.id_usuario_analise);
        NEW.data_analise := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_manifestacao_marca_analise BEFORE UPDATE OF status ON manifestacao
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_manifestacao_marca_analise();

-- Manifestação ACEITA encerra o item: objeto DEVOLVIDO / corpo IDENTIFICADO
CREATE OR REPLACE FUNCTION fn_manifestacao_desfecho() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id_objeto IS NOT NULL THEN
        UPDATE objeto SET status = 'DEVOLVIDO' WHERE id_objeto = NEW.id_objeto AND status <> 'DEVOLVIDO';
    ELSE
        UPDATE corpo SET status = 'IDENTIFICADO' WHERE id_corpo = NEW.id_corpo AND status <> 'IDENTIFICADO';
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_manifestacao_desfecho AFTER UPDATE OF status ON manifestacao
    FOR EACH ROW WHEN (NEW.status = 'ACEITA' AND OLD.status IS DISTINCT FROM 'ACEITA')
    EXECUTE FUNCTION fn_manifestacao_desfecho();

-- Item encerrado (por manifestação ou direto pelo admin): as demais
-- manifestações ainda abertas são recusadas automaticamente
CREATE OR REPLACE FUNCTION fn_item_encerrado() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'objeto' THEN
        UPDATE manifestacao SET status = 'RECUSADA', parecer = 'Objeto já devolvido a outra pessoa.'
         WHERE id_objeto = NEW.id_objeto AND status IN ('RECEBIDA','EM_ANALISE');
    ELSE
        UPDATE manifestacao SET status = 'RECUSADA', parecer = 'Corpo já identificado por outra manifestação.'
         WHERE id_corpo = NEW.id_corpo AND status IN ('RECEBIDA','EM_ANALISE');
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_objeto_encerrado AFTER UPDATE OF status ON objeto
    FOR EACH ROW WHEN (NEW.status = 'DEVOLVIDO' AND OLD.status IS DISTINCT FROM 'DEVOLVIDO')
    EXECUTE FUNCTION fn_item_encerrado();
CREATE TRIGGER trg_corpo_encerrado AFTER UPDATE OF status ON corpo
    FOR EACH ROW WHEN (NEW.status = 'IDENTIFICADO' AND OLD.status IS DISTINCT FROM 'IDENTIFICADO')
    EXECUTE FUNCTION fn_item_encerrado();
