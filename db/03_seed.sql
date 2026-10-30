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

    -- Mais corpos não identificados, para o mural ficar cheio
    INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm, cor_pele, cor_cabelo, cor_olhos,
                       caracteristicas, observacoes, id_local, data_encontrado, data_entrada, gaveta_camara)
    SELECT v.sexo, v.imin, v.imax, v.altura, v.pele, v.cabelo, v.olhos, v.carac, v.obs,
           (SELECT id_local FROM local WHERE nome = v.local), CURRENT_DATE - v.dias, now() - (v.dias || ' days')::interval, v.gaveta
    FROM (VALUES
        ('M'::char, 25, 35, 175, 'Parda',   'Castanho, curto', 'Castanhos', 'Camiseta preta, bermuda de nylon, relógio digital no pulso esquerdo.', 'Encontrado por ciclista.', 'Orla do Guaíba', 33, 'A-03'),
        ('F'::char, 20, 28, 165, 'Branca',  'Loiro, longo',    'Azuis',     'Jaqueta jeans, calça preta, brinco de argola, tatuagem de borboleta no tornozelo.', 'Sem documentos.', 'Rodoviária', 27, 'A-04'),
        ('M'::char, 60, 75, 170, 'Branca',  'Grisalho',        'Castanhos', 'Camisa social bege, calça de tecido, cicatriz no abdômen.', 'Possível morador de rua.', 'Mercado Público', 24, 'A-05'),
        ('F'::char, 45, 55, 158, 'Negra',   'Preto, curto',    'Castanhos', 'Vestido azul, sandálias, aliança na mão direita.', NULL, 'Estação Mathias Velho', 19, 'A-06'),
        ('M'::char, 30, 40, 182, 'Parda',   'Preto, curto',    'Castanhos', 'Camiseta branca, calça jeans, tênis preto, tatuagem de âncora no braço direito.', 'Boletim 2026/1302.', 'BR-116 km 247', 15, 'B-01'),
        ('F'::char, 15, 20, 162, 'Branca',  'Ruivo, longo',    'Verdes',    'Moletom vermelho, calça legging, tênis com cadarço rosa.', 'Aguardando confronto de digitais.', 'Parque da Redenção', 12, 'B-02'),
        ('M'::char, 50, 60, 174, 'Negra',   'Grisalho',        'Castanhos', 'Camisa polo verde, calça de sarja, chinelo.', NULL, 'Arroio Luiz Rau', 7, 'B-05'),
        ('I'::char, 20, 40, NULL, NULL,     NULL,              NULL,        'Roupas rasgadas, sem características aparentes.', 'Estado avançado de decomposição.', 'Rodoviária', 5, 'B-06'),
        ('M'::char, 22, 30, 169, 'Amarela', 'Preto, curto',    'Pretos',    'Camiseta cinza, jaqueta corta-vento, cicatriz no queixo.', NULL, 'Orla do Guaíba', 2, 'C-01')
    ) AS v(sexo, imin, imax, altura, pele, cabelo, olhos, carac, obs, local, dias, gaveta);

    -- Onde há tatuagem (o boneco do mural mostra)
    UPDATE corpo SET tatuagens = 'BRACO_D:FLORAL' WHERE id_corpo = k2;
    UPDATE corpo SET tatuagens = 'BRACO_D:TRIBAL,PEITO:GEOMETRICO' WHERE caracteristicas LIKE '%âncora no braço direito%';
    UPDATE corpo SET tatuagens = 'PERNA_E:FLORAL' WHERE caracteristicas LIKE '%borboleta no tornozelo%';
    UPDATE corpo SET tatuagens = 'COSTAS:CHAMAS,BRACO_E:CHAMAS' WHERE caracteristicas LIKE '%cicatriz no queixo%';
    UPDATE corpo SET tatuagens = 'PESCOCO:ESTRELAS,PERNA_D:ESTRELAS' WHERE caracteristicas LIKE '%legging%';

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

    -- Mais objetos, de várias categorias
    INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado)
    SELECT v.tipo, v.titulo, v.descricao, (SELECT id_local FROM local WHERE nome = v.local), CURRENT_DATE - v.dias
    FROM (VALUES
        ('OCULOS',       'Óculos de grau armação preta', 'Armação preta retangular com lentes de grau, haste direita colada com fita adesiva.', 'Mercado Público', 12),
        ('RELOGIO',      'Relógio de pulso com pulseira de couro', 'Mostrador branco, pulseira de couro marrom, inscrição "Para Ana, 1998" na parte de trás.', 'Rodoviária', 17),
        ('CALCADO',      'Tênis branco tamanho 42', 'Tênis branco com detalhes azuis, só o pé esquerdo, solado gasto.', 'BR-116 km 247', 8),
        ('BONE',         'Boné vermelho', 'Boné vermelho de aba curva, com emblema bordado de time de futebol.', 'Estação Mathias Velho', 16),
        ('FONE',         'Fone de ouvido sem fio', 'Headphone preto bluetooth, almofada esquerda rasgada.', 'Parque da Redenção', 6),
        ('GUARDA_CHUVA', 'Guarda-chuva preto automático', 'Guarda-chuva azul-marinho quase preto, cabo de madeira curvo.', 'Rodoviária', 4),
        ('BOLSA',        'Bolsa de couro vinho', 'Bolsa feminina vinho com fecho dourado. Dentro: batom, lenços e um molho de chaves.', 'Mercado Público', 11),
        ('NOTEBOOK',     'Notebook cinza sem carregador', 'Notebook de 14 polegadas, tampa cinza com adesivo de linguagem de programação.', 'Estação Mathias Velho', 3),
        ('CELULAR',      'Celular Motorola azul', 'Moto G azul com capinha preta, bateria descarregada.', 'Parque da Redenção', 5),
        ('MOCHILA',      'Mochila preta esportiva', 'Mochila preta com detalhes laranja, contendo roupas de academia e uma toalha.', 'Orla do Guaíba', 9),
        ('ROUPA',        'Moletom cinza com capuz', 'Moletom cinza, tamanho M, com manchas escuras na manga.', 'BR-116 km 247', 10)
    ) AS v(tipo, titulo, descricao, local, dias);

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
