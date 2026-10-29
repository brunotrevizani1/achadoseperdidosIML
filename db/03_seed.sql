-- =====================================================================
-- ACHADOS E PERDIDOS DO IML — Dados fictícios para demonstração
-- Executar depois de 01_schema.sql e 02_logica.sql.
-- Todos os nomes e casos são inventados.
--
-- Corpos não identificados vão ao mural assim que cadastrados.
--   IML-…101 a 104 estão no mural
--   IML-…105 já foi identificada -> fora do mural
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt()/gen_salt() para o hash bcrypt da senha

DO $$
DECLARE
    u_admin INT; u_adm2 INT;
    l_arroio INT; l_rodoviaria INT; l_redencao INT; l_br116 INT; l_mercado INT; l_orla INT; l_canoas INT;
    k1 INT; k2 INT; k3 INT; k4 INT; k5 INT;
    o_cel INT; o_alianca INT; o_doc INT; o_mochila INT; o_carteira INT; o_chaves INT; o_relogio INT;
    m1 INT; m2 INT;
BEGIN
    -- Usuários (senha de todos: iml123)
    INSERT INTO usuario (nome, email, senha_hash)
    VALUES ('Neide Carimbo', 'admin@iml.demo', crypt('iml123', gen_salt('bf', 10)))
    RETURNING id_usuario INTO u_admin;
    INSERT INTO usuario (nome, email, senha_hash)
    VALUES ('Jair Plantão', 'plantao@iml.demo', crypt('iml123', gen_salt('bf', 10)))
    RETURNING id_usuario INTO u_adm2;

    PERFORM set_config('app.id_usuario', u_admin::TEXT, true);

    -- Locais
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES ('Arroio Luiz Rau', 'RIO_LAGO', 'Centro', 'Novo Hamburgo', 'RS') RETURNING id_local INTO l_arroio;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES ('Rodoviária', 'ESTABELECIMENTO', 'Centro', 'Porto Alegre', 'RS') RETURNING id_local INTO l_rodoviaria;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES ('Parque da Redenção', 'VIA_PUBLICA', 'Farroupilha', 'Porto Alegre', 'RS') RETURNING id_local INTO l_redencao;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES ('BR-116 km 247', 'RODOVIA', NULL, 'Sapucaia do Sul', 'RS') RETURNING id_local INTO l_br116;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES ('Mercado Público', 'ESTABELECIMENTO', 'Centro Histórico', 'Porto Alegre', 'RS') RETURNING id_local INTO l_mercado;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES ('Orla do Guaíba', 'RIO_LAGO', 'Menino Deus', 'Porto Alegre', 'RS') RETURNING id_local INTO l_orla;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES ('Estação Mathias Velho', 'ESTABELECIMENTO', 'Mathias Velho', 'Canoas', 'RS') RETURNING id_local INTO l_canoas;

    -- Corpos
    INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm, cor_pele, cor_cabelo, cor_olhos,
                       caracteristicas, observacoes, id_local, data_encontrado, data_entrada, gaveta_camara)
    VALUES ('M', 55, 65, 172, 'Branca', 'Grisalho', 'Castanhos',
            'Calça jeans, camisa xadrez azul e botinas marrons. Usava aliança na mão esquerda.',
            'Boletim 2026/1187. Sem documentos junto ao corpo.',
            l_arroio, CURRENT_DATE - 52, now() - interval '52 days', 'A-01')
    RETURNING id_corpo INTO k1;
    INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm, cor_pele, cor_cabelo, cor_olhos,
                       caracteristicas, observacoes, id_local, data_encontrado, data_entrada, gaveta_camara)
    VALUES ('F', 30, 40, 160, 'Parda', 'Preto, longo', 'Castanhos',
            'Vestido florido, tatuagem de rosa no antebraço direito, cicatriz de cesariana.',
            'Encontrada por pescadores.',
            l_orla, CURRENT_DATE - 41, now() - interval '41 days', 'A-02')
    RETURNING id_corpo INTO k2;
    INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm, cor_pele, cor_cabelo, cor_olhos,
                       caracteristicas, observacoes, id_local, data_encontrado, data_entrada, gaveta_camara)
    VALUES ('M', 18, 25, 178, 'Negra', 'Preto, curto', 'Castanhos',
            'Moletom cinza com capuz, tênis branco, piercing na orelha esquerda.',
            'Sem ocorrência registrada.',
            l_br116, CURRENT_DATE - 9, now() - interval '9 days', 'B-03')
    RETURNING id_corpo INTO k3;
    INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm, cor_pele, cor_cabelo, cor_olhos,
                       caracteristicas, observacoes, id_local, data_encontrado, data_entrada, gaveta_camara)
    VALUES ('I', 35, 50, NULL, NULL, NULL, NULL,
            'Casaco de lã preto. Sem outras características aparentes.', 'Estado avançado de decomposição.',
            l_redencao, CURRENT_DATE - 3, now() - interval '3 days', 'B-04')
    RETURNING id_corpo INTO k4;
    INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm, cor_pele, cor_cabelo, cor_olhos,
                       caracteristicas, observacoes, id_local, data_encontrado, data_entrada, gaveta_camara)
    VALUES ('M', 40, 50, 168, 'Branca', 'Castanho', 'Verdes',
            'Camiseta de time de futebol, bermuda jeans.', 'Reconhecido pela irmã.',
            l_canoas, CURRENT_DATE - 60, now() - interval '60 days', NULL)
    RETURNING id_corpo INTO k5;

    -- Objetos
    INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado, id_corpo)
    VALUES ('CELULAR', 'Celular Samsung preto',
            'Samsung Galaxy A12, capinha transparente com adesivo de flor, tela trincada no canto superior direito.',
            l_arroio, CURRENT_DATE - 52, k1) RETURNING id_objeto INTO o_cel;
    INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado, id_corpo)
    VALUES ('ALIANCA', 'Aliança de ouro com gravação',
            'Aliança lisa de ouro amarelo, com gravação interna "M & J 12.05.1991".',
            l_arroio, CURRENT_DATE - 52, k1) RETURNING id_objeto INTO o_alianca;
    INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado, id_corpo)
    VALUES ('DOCUMENTO', 'Carteira de trabalho danificada',
            'CTPS em mau estado pela água. Foto e nome ilegíveis, número de série parcialmente visível.',
            l_orla, CURRENT_DATE - 41, k2) RETURNING id_objeto INTO o_doc;
    INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado, id_corpo)
    VALUES ('MOCHILA', 'Mochila azul com material escolar',
            'Mochila azul-marinho, marca Sestini, com dois cadernos, estojo e uma garrafa térmica.',
            l_rodoviaria, CURRENT_DATE - 20, NULL) RETURNING id_objeto INTO o_mochila;
    INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado, id_corpo)
    VALUES ('CARTEIRA', 'Carteira de couro marrom',
            'Carteira masculina de couro marrom, vazia, com cartão de ônibus de Porto Alegre.',
            l_mercado, CURRENT_DATE - 14, NULL) RETURNING id_objeto INTO o_carteira;
    INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado, id_corpo)
    VALUES ('CHAVES', 'Molho de chaves com chaveiro do Grêmio',
            'Cinco chaves e um chaveiro azul do Grêmio.',
            l_canoas, CURRENT_DATE - 60, k5) RETURNING id_objeto INTO o_chaves;
    INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado, id_corpo)
    VALUES ('JOIA', 'Relógio de pulso analógico',
            'Relógio Technos prateado, pulseira de metal, parado às 3h40.',
            l_br116, CURRENT_DATE - 9, k3) RETURNING id_objeto INTO o_relogio;

    -- Chaves já devolvidas (caso encerrado)
    PERFORM set_config('app.observacao', 'Entregue à irmã, com termo assinado', true);
    UPDATE objeto SET status = 'DEVOLVIDO' WHERE id_objeto = o_chaves;
    PERFORM set_config('app.observacao', 'Reconhecido pela irmã', true);
    UPDATE corpo SET status = 'IDENTIFICADO' WHERE id_corpo = k5;
    PERFORM set_config('app.observacao', '', true);

    -- Manifestações do público
    INSERT INTO manifestacao (id_objeto, nome, contato, parentesco, o_que_reconheceu)
    VALUES (o_alianca, 'Josiane Medeiros', '(51) 99999-0101', 'FILHA',
            'A gravação "M & J 12.05.1991" é a data de casamento dos meus pais. Meu pai sumiu há dois meses.')
    RETURNING id_manifestacao INTO m1;
    INSERT INTO manifestacao (id_corpo, nome, contato, parentesco, o_que_reconheceu)
    VALUES (k2, 'Rita de Cássia Lopes', 'rita.lopes@exemplo.demo', 'IRMA',
            'Minha irmã tem uma rosa tatuada no antebraço direito e fez cesariana em 2016. Está desaparecida desde o dia 3.')
    RETURNING id_manifestacao INTO m2;
    INSERT INTO manifestacao (id_objeto, nome, contato, parentesco, o_que_reconheceu)
    VALUES (o_cel, 'Anderson Pinheiro', '(51) 98888-0202', 'AMIGO',
            'A capinha com a florzinha é igual à do celular do meu colega Valdemar.');

    PERFORM set_config('app.id_usuario', u_adm2::TEXT, true);
    UPDATE manifestacao SET status = 'EM_ANALISE' WHERE id_manifestacao = m2;
END $$;
