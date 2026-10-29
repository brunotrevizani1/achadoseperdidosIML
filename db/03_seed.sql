-- =====================================================================
-- ACHADOS E PERDIDOS DO IML — Dados fictícios para demonstração
-- Executar depois de 01_schema.sql e 02_logica.sql.
-- Todos os nomes, CPFs e casos são inventados.
--
-- Pares planejados (pontuação esperada da view):
--   Valdemar  x IML-2026-000101 = 90  (caso da seção 10 do PDF: 1 de 2 sinais)
--   Josué     x IML-2026-000101 = 34  (caso da seção 10 do PDF: não é gravado)
--   Rosimeire x IML-2026-000102 = 100 (match perfeito)
--   Tatiane   x IML-2026-000102 = 62
--   Ademir    x IML-2026-000103 = 76  (corpo de sexo indeterminado)
--   Josué     x IML-2026-000104 = 76
--   Cenira    x IML-2026-000105 = 55  (outro estado)
--   Cenira    x IML-2026-000102 = 53  (falso positivo: idade não bate)
--   Heitor    x IML-2026-000106 = 80  (caso já encerrado: identificado e liberado;
--                                      as outras sugestões dele são descartadas sozinhas)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt()/gen_salt() para o hash bcrypt das senhas

-- Helper só desta sessão para cadastrar sinais pelo nome do tipo/região
CREATE FUNCTION pg_temp.sinal(p_corpo INT, p_desap INT, p_tipo TEXT, p_regiao TEXT,
                              p_lado TEXT, p_descricao TEXT, p_cor TEXT DEFAULT NULL)
RETURNS INT LANGUAGE sql AS $$
    INSERT INTO sinal_particular (id_corpo, id_desaparecido, id_tipo_sinal, id_regiao,
                                  lado, descricao, cor)
    VALUES (p_corpo, p_desap,
            (SELECT id_tipo_sinal FROM tipo_sinal  WHERE descricao = p_tipo),
            (SELECT id_regiao     FROM regiao_corpo WHERE descricao = p_regiao),
            p_lado, p_descricao, p_cor)
    RETURNING id_sinal;
$$;

DO $$
DECLARE
    -- usuários
    u_admin INT; u_atend INT; u_perito INT; u_invest INT;
    -- locais
    l_arroio INT; l_rodoviaria INT; l_redencao INT; l_br116 INT;
    l_mercado INT; l_orla INT; l_canoas INT; l_lagoa INT;
    -- causas
    c_esclarecer INT; c_afogamento INT; c_transito INT; c_infarto INT;
    -- desaparecidos
    d_valdemar INT; d_josue INT; d_rose INT; d_tatiane INT;
    d_ademir INT; d_cenira INT; d_marcos INT; d_heitor INT;
    -- familiares
    f_id INT; f_heitor_irma INT; f_valdemar_filho INT;
    -- corpos
    k1 INT; k2 INT; k3 INT; k4 INT; k5 INT; k6 INT;
    -- investigação
    v_corresp INT; v_exame INT; v_ident INT;
BEGIN
    -- -----------------------------------------------------------------
    -- Usuários (senha de todos: iml123)
    -- -----------------------------------------------------------------
    INSERT INTO usuario (nome, cpf, matricula, email, senha_hash, perfil)
    VALUES ('Neide Carimbo', '90000000001', 'ADM-0001', 'admin@iml.demo',
            crypt('iml123', gen_salt('bf', 10)), 'ADMIN')
    RETURNING id_usuario INTO u_admin;

    INSERT INTO usuario (nome, cpf, matricula, email, senha_hash, perfil)
    VALUES ('Kleber Balcão', '90000000002', 'ATD-0042', 'atendente@iml.demo',
            crypt('iml123', gen_salt('bf', 10)), 'ATENDENTE')
    RETURNING id_usuario INTO u_atend;

    INSERT INTO usuario (nome, cpf, matricula, email, senha_hash, perfil)
    VALUES ('Dr. Ivo Lupa', '90000000003', 'PER-0007', 'perito@iml.demo',
            crypt('iml123', gen_salt('bf', 10)), 'PERITO')
    RETURNING id_usuario INTO u_perito;

    INSERT INTO usuario (nome, cpf, matricula, email, senha_hash, perfil)
    VALUES ('Sherlaine Holmes', '90000000004', 'INV-0221', 'investigador@iml.demo',
            crypt('iml123', gen_salt('bf', 10)), 'INVESTIGADOR')
    RETURNING id_usuario INTO u_invest;

    -- -----------------------------------------------------------------
    -- Locais
    -- -----------------------------------------------------------------
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES
        ('Arroio Luiz Rau', 'RIO_LAGO', 'Centro', 'Novo Hamburgo', 'RS') RETURNING id_local INTO l_arroio;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES
        ('Rodoviária', 'ESTABELECIMENTO', 'Centro Histórico', 'Porto Alegre', 'RS') RETURNING id_local INTO l_rodoviaria;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES
        ('Parque da Redenção', 'OUTRO', 'Farroupilha', 'Porto Alegre', 'RS') RETURNING id_local INTO l_redencao;
    INSERT INTO local (nome, tipo_local, logradouro, cidade, uf) VALUES
        ('BR-116, km 240', 'RODOVIA', 'BR-116', 'São Leopoldo', 'RS') RETURNING id_local INTO l_br116;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES
        ('Mercado Público', 'ESTABELECIMENTO', 'Centro Histórico', 'Porto Alegre', 'RS') RETURNING id_local INTO l_mercado;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES
        ('Orla do Guaíba', 'RIO_LAGO', 'Cidade Baixa', 'Porto Alegre', 'RS') RETURNING id_local INTO l_orla;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES
        ('Praça da Bandeira', 'VIA_PUBLICA', 'Centro', 'Canoas', 'RS') RETURNING id_local INTO l_canoas;
    INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES
        ('Lagoa da Conceição', 'RIO_LAGO', 'Lagoa', 'Florianópolis', 'SC') RETURNING id_local INTO l_lagoa;

    SELECT id_causa INTO c_esclarecer FROM causa_morte WHERE descricao = 'Causa a esclarecer';
    SELECT id_causa INTO c_afogamento FROM causa_morte WHERE codigo_cid = 'W74';
    SELECT id_causa INTO c_transito   FROM causa_morte WHERE codigo_cid = 'V89';
    SELECT id_causa INTO c_infarto    FROM causa_morte WHERE codigo_cid = 'I21';

    -- -----------------------------------------------------------------
    -- Desaparecidos (registrados pelo atendente)
    -- -----------------------------------------------------------------
    PERFORM set_config('app.id_usuario', u_atend::TEXT, true);

    INSERT INTO registro_desaparecimento (protocolo, nome_desaparecido, apelido, data_nascimento, sexo,
        altura_cm, peso_kg, cor_pele, cor_cabelo, cor_olhos, tipo_fisico, vestimenta, id_local,
        data_desaparecimento, numero_boletim, circunstancias, id_usuario_cadastro, data_registro)
    VALUES ('DES-2026-000001', 'Valdemar Pereira da Silva', 'Seu Val', '1981-03-14', 'M',
        172, 78, 'Branca', 'Grisalho', 'Castanhos', 'MEDIO', 'Camisa xadrez e boné azul', l_arroio,
        '2026-09-20', 'BO 4471/2026', 'Saiu para pescar no arroio e não retornou.', u_atend, '2026-09-21 09:10')
    RETURNING id_desaparecido INTO d_valdemar;

    INSERT INTO registro_desaparecimento (protocolo, nome_desaparecido, idade_desaparecimento, sexo,
        altura_cm, cor_pele, cor_cabelo, tipo_fisico, id_local, data_desaparecimento, circunstancias,
        id_usuario_cadastro, data_registro)
    VALUES ('DES-2026-000002', 'Josué Antunes', 22, 'M',
        185, 'Parda', 'Preto', 'MAGRO', l_rodoviaria, '2026-06-01',
        'Visto pela última vez embarcando na rodoviária. Família não sabe a data de nascimento exata.',
        u_atend, '2026-06-03 14:30')
    RETURNING id_desaparecido INTO d_josue;

    INSERT INTO registro_desaparecimento (protocolo, nome_desaparecido, apelido, data_nascimento, sexo,
        altura_cm, cor_pele, cor_cabelo, cor_olhos, tipo_fisico, vestimenta, id_local,
        data_desaparecimento, numero_boletim, circunstancias, id_usuario_cadastro, data_registro)
    VALUES ('DES-2026-000003', 'Rosimeire Fagundes', 'Rose', '1995-07-02', 'F',
        162, 'Branca', 'Ruivo', 'Verdes', 'MAGRO', 'Vestido amarelo', l_redencao,
        '2026-10-12', 'BO 5120/2026', 'Saiu para correr no parque no fim da tarde.', u_atend, '2026-10-13 08:00')
    RETURNING id_desaparecido INTO d_rose;

    INSERT INTO registro_desaparecimento (protocolo, nome_desaparecido, data_nascimento, sexo,
        altura_cm, cor_pele, cor_cabelo, tipo_fisico, id_local, data_desaparecimento,
        circunstancias, id_usuario_cadastro, data_registro)
    VALUES ('DES-2026-000004', 'Tatiane Bortolotto', '2001-01-15', 'F',
        168, 'Branca', 'Loiro', 'MEDIO', l_canoas, '2026-08-03',
        'Não compareceu ao trabalho e não atende o telefone.', u_atend, '2026-08-05 11:45')
    RETURNING id_desaparecido INTO d_tatiane;

    INSERT INTO registro_desaparecimento (protocolo, nome_desaparecido, apelido, data_nascimento, sexo,
        altura_cm, cor_pele, cor_cabelo, tipo_fisico, id_local, data_desaparecimento,
        circunstancias, id_usuario_cadastro, data_registro)
    VALUES ('DES-2026-000005', 'Ademir Kunzler', 'Alemão', '1968-11-30', 'M',
        178, 'Branca', 'Loiro', 'FORTE', l_br116, '2025-12-10',
        'Caminhoneiro; o caminhão foi encontrado no acostamento.', u_atend, '2025-12-12 16:20')
    RETURNING id_desaparecido INTO d_ademir;

    INSERT INTO registro_desaparecimento (protocolo, nome_desaparecido, apelido, data_nascimento, sexo,
        altura_cm, cor_pele, cor_cabelo, tipo_fisico, id_local, data_desaparecimento,
        circunstancias, id_usuario_cadastro, data_registro)
    VALUES ('DES-2026-000006', 'Cenira Machado', 'Dona Cenira', '1950-04-22', 'F',
        150, 'Parda', 'Branco', 'MAGRO', l_rodoviaria, '2026-09-30',
        'Comprou passagem para o litoral e não chegou ao destino.', u_atend, '2026-10-01 10:05')
    RETURNING id_desaparecido INTO d_cenira;

    INSERT INTO registro_desaparecimento (protocolo, nome_desaparecido, data_nascimento, sexo,
        altura_cm, id_local, data_desaparecimento, circunstancias, id_usuario_cadastro, data_registro)
    VALUES ('DES-2026-000007', 'Marcos Vinícius Lopes', '1999-09-09', 'M',
        175, l_mercado, '2026-07-10', 'Saiu de casa após uma discussão familiar.', u_atend, '2026-07-11 09:00')
    RETURNING id_desaparecido INTO d_marcos;

    INSERT INTO registro_desaparecimento (protocolo, nome_desaparecido, data_nascimento, sexo,
        altura_cm, cor_pele, cor_cabelo, tipo_fisico, id_local, data_desaparecimento,
        circunstancias, id_usuario_cadastro, data_registro)
    VALUES ('DES-2026-000008', 'Heitor Brandão', '1990-05-05', 'M',
        180, 'Negra', 'Preto', 'FORTE', l_rodoviaria, '2026-03-01',
        'Saiu do trabalho à noite e não chegou em casa.', u_atend, '2026-03-02 13:15')
    RETURNING id_desaparecido INTO d_heitor;

    -- Sinais dos desaparecidos
    PERFORM pg_temp.sinal(NULL, d_valdemar, 'Tatuagem', 'Antebraço', 'DIREITO', 'Âncora com a palavra "Mãe"', 'Azul');
    PERFORM pg_temp.sinal(NULL, d_valdemar, 'Cicatriz', 'Abdômen',   'CENTRAL', 'Cirurgia de apendicite');
    PERFORM pg_temp.sinal(NULL, d_rose,     'Tatuagem', 'Tornozelo', 'ESQUERDO', 'Borboleta', 'Azul');
    PERFORM pg_temp.sinal(NULL, d_rose,     'Piercing', 'Rosto',     'DIREITO', 'Argola na narina');
    PERFORM pg_temp.sinal(NULL, d_tatiane,  'Tatuagem', 'Costas',    'CENTRAL', 'Mandala grande', 'Preta');
    PERFORM pg_temp.sinal(NULL, d_ademir,   'Fratura consolidada', 'Perna', 'DIREITO', 'Queda de um telhado em 2009');
    PERFORM pg_temp.sinal(NULL, d_ademir,   'Prótese', 'Quadril',    'ESQUERDO', 'Prótese de quadril');
    PERFORM pg_temp.sinal(NULL, d_cenira,   'Marca de nascença', 'Pescoço', 'ESQUERDO', 'Mancha café com leite');

    -- Familiares e vínculos
    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Lucas Pereira da Silva', '80000000001', '51999990001', 'Novo Hamburgo', 'RS') RETURNING id_familiar INTO f_valdemar_filho;
    INSERT INTO familiar_desaparecido VALUES (f_valdemar_filho, d_valdemar, 'FILHO', TRUE, TRUE);
    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Marlene Pereira', '80000000002', '51999990002', 'Novo Hamburgo', 'RS') RETURNING id_familiar INTO f_id;
    INSERT INTO familiar_desaparecido VALUES (f_id, d_valdemar, 'CONJUGE', FALSE, FALSE);

    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Sandra Antunes', '80000000003', '51999990003', 'Porto Alegre', 'RS') RETURNING id_familiar INTO f_id;
    INSERT INTO familiar_desaparecido VALUES (f_id, d_josue, 'MAE', TRUE, TRUE);

    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Paulo Fagundes', '80000000004', '51999990004', 'Porto Alegre', 'RS') RETURNING id_familiar INTO f_id;
    INSERT INTO familiar_desaparecido VALUES (f_id, d_rose, 'PAI', TRUE, TRUE);

    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Bruna Bortolotto', '80000000005', '51999990005', 'Canoas', 'RS') RETURNING id_familiar INTO f_id;
    INSERT INTO familiar_desaparecido VALUES (f_id, d_tatiane, 'IRMA', TRUE, FALSE);

    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Ingrid Kunzler', '80000000006', '51999990006', 'São Leopoldo', 'RS') RETURNING id_familiar INTO f_id;
    INSERT INTO familiar_desaparecido VALUES (f_id, d_ademir, 'FILHA', TRUE, TRUE);

    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Rogério Machado', '80000000007', '51999990007', 'Porto Alegre', 'RS') RETURNING id_familiar INTO f_id;
    INSERT INTO familiar_desaparecido VALUES (f_id, d_cenira, 'NETO', TRUE, FALSE);

    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Vera Lopes', '80000000008', '51999990008', 'Porto Alegre', 'RS') RETURNING id_familiar INTO f_id;
    INSERT INTO familiar_desaparecido VALUES (f_id, d_marcos, 'MAE', TRUE, FALSE);

    INSERT INTO familiar (nome, cpf, telefone, cidade, uf) VALUES
        ('Juliana Brandão', '80000000009', '51999990009', 'Porto Alegre', 'RS') RETURNING id_familiar INTO f_heitor_irma;
    INSERT INTO familiar_desaparecido VALUES (f_heitor_irma, d_heitor, 'IRMA', TRUE, TRUE);

    -- Marcos foi encontrado vivo (mostra outro desfecho do ciclo)
    PERFORM set_config('app.observacao', 'Voltou para casa por conta própria', true);
    UPDATE registro_desaparecimento SET status = 'LOCALIZADO_VIVO' WHERE id_desaparecido = d_marcos;
    PERFORM set_config('app.observacao', '', true);

    -- -----------------------------------------------------------------
    -- Corpos (cadastrados pelo perito)
    -- -----------------------------------------------------------------
    PERFORM set_config('app.id_usuario', u_perito::TEXT, true);

    INSERT INTO corpo (codigo_iml, sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm,
        peso_estimado_kg, cor_pele, cor_cabelo, estado_conservacao, vestimenta, pertences,
        data_entrada, gaveta_camara, id_usuario_cadastro)
    VALUES ('IML-2026-000101', 'M', 40, 50, 170, 80, 'Branca', 'Grisalho', 'DECOMPOSICAO_INICIAL',
        'Camisa xadrez', 'Molinete de pesca e chave de casa', '2026-10-05 15:40', 'A-03', u_perito)
    RETURNING id_corpo INTO k1;
    INSERT INTO registro_entrada (id_corpo, id_local, id_causa_presumida, data_encontrado,
        orgao_remocao, responsavel_remocao, circunstancias)
    VALUES (k1, l_arroio, c_afogamento, '2026-10-05', 'Corpo de Bombeiros', 'Sgt. Moraes',
        'Encontrado às margens do arroio por moradores.');
    PERFORM pg_temp.sinal(k1, NULL, 'Tatuagem',     'Antebraço', 'DIREITO', 'Âncora; texto parcialmente ilegível', 'Azul');
    PERFORM pg_temp.sinal(k1, NULL, 'Pinta / Nevo', 'Costas',    'ESQUERDO', 'Nevo de 1 cm na escápula');

    INSERT INTO corpo (codigo_iml, sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm,
        cor_pele, cor_cabelo, cor_olhos, estado_conservacao, vestimenta, data_entrada, gaveta_camara,
        id_usuario_cadastro)
    VALUES ('IML-2026-000102', 'F', 25, 35, 160, 'Branca', 'Ruivo', 'Verdes', 'PRESERVADO',
        'Vestido amarelo', '2026-10-20 07:15', 'A-07', u_perito)
    RETURNING id_corpo INTO k2;
    INSERT INTO registro_entrada (id_corpo, id_local, id_causa_presumida, data_encontrado,
        orgao_remocao, circunstancias)
    VALUES (k2, l_orla, c_esclarecer, '2026-10-20', 'Brigada Militar', 'Avistado por pescadores na orla.');
    PERFORM pg_temp.sinal(k2, NULL, 'Tatuagem', 'Tornozelo', 'ESQUERDO', 'Borboleta', 'Azul');
    PERFORM pg_temp.sinal(k2, NULL, 'Piercing', 'Rosto',     'DIREITO', 'Argola na narina');

    INSERT INTO corpo (codigo_iml, sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm,
        estado_conservacao, pertences, data_entrada, gaveta_camara, id_usuario_cadastro)
    VALUES ('IML-2026-000103', 'I', 30, 60, 175, 'ESQUELETIZADO', 'Fivela de cinto metálica',
        '2026-07-15 18:00', 'B-01', u_perito)
    RETURNING id_corpo INTO k3;
    INSERT INTO registro_entrada (id_corpo, id_local, id_causa_presumida, data_encontrado,
        orgao_remocao, circunstancias)
    VALUES (k3, l_br116, c_esclarecer, '2026-07-15', 'Polícia Rodoviária Federal',
        'Ossada encontrada em área de mata às margens da rodovia.');
    PERFORM pg_temp.sinal(k3, NULL, 'Fratura consolidada', 'Perna', 'DIREITO', 'Calo ósseo na tíbia');
    PERFORM pg_temp.sinal(k3, NULL, 'Implante dentário', 'Boca / Arcada dentária', 'CENTRAL', 'Dois implantes superiores');

    INSERT INTO corpo (codigo_iml, sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm,
        cor_pele, cor_cabelo, estado_conservacao, vestimenta, data_entrada, gaveta_camara,
        id_usuario_cadastro)
    VALUES ('IML-2026-000104', 'M', 18, 25, 183, 'Parda', 'Preto', 'PRESERVADO',
        'Moletom cinza e tênis branco', '2026-10-25 06:30', 'B-04', u_perito)
    RETURNING id_corpo INTO k4;
    INSERT INTO registro_entrada (id_corpo, id_local, id_causa_presumida, data_encontrado,
        orgao_remocao, circunstancias)
    VALUES (k4, l_mercado, c_esclarecer, '2026-10-25', 'SAMU', 'Encontrado na madrugada próximo ao mercado.');
    PERFORM pg_temp.sinal(k4, NULL, 'Tatuagem', 'Braço', 'ESQUERDO', 'Escudo de time de futebol', 'Colorida');

    INSERT INTO corpo (codigo_iml, sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm,
        cor_cabelo, estado_conservacao, data_entrada, gaveta_camara, id_usuario_cadastro)
    VALUES ('IML-2026-000105', 'F', 60, 75, 155, 'Branco', 'DECOMPOSICAO_INICIAL',
        '2026-10-10 12:00', 'C-02', u_perito)
    RETURNING id_corpo INTO k5;
    INSERT INTO registro_entrada (id_corpo, id_local, id_causa_presumida, data_encontrado,
        orgao_remocao, circunstancias)
    VALUES (k5, l_lagoa, c_afogamento, '2026-10-10', 'Corpo de Bombeiros', 'Recolhido na lagoa (transferido de SC).');

    INSERT INTO corpo (codigo_iml, sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm,
        cor_pele, cor_cabelo, estado_conservacao, data_entrada, gaveta_camara, id_usuario_cadastro)
    VALUES ('IML-2026-000106', 'M', 30, 40, 181, 'Negra', 'Preto', 'PRESERVADO',
        '2026-03-09 22:10', NULL, u_perito)
    RETURNING id_corpo INTO k6;
    INSERT INTO registro_entrada (id_corpo, id_local, id_causa_presumida, data_encontrado,
        orgao_remocao, circunstancias)
    VALUES (k6, l_redencao, c_infarto, '2026-03-09', 'SAMU', 'Encontrado em banco do parque.');

    -- Perícia
    INSERT INTO exame_pericial (id_corpo, tipo_exame, id_perito, numero_laudo, data_solicitacao, status)
    VALUES (k1, 'DNA', u_perito, 'LAU-2026-0311', '2026-10-06', 'EM_ANDAMENTO');
    INSERT INTO exame_pericial (id_corpo, tipo_exame, id_perito, numero_laudo, data_solicitacao,
        data_realizacao, resultado, conclusao, status)
    VALUES (k3, 'ANTROPOLOGICO', u_perito, 'LAU-2026-0198', '2026-07-16', '2026-07-30',
        'Ossada de indivíduo adulto, sexo inconclusivo pela pelve fragmentada.',
        'Idade estimada entre 30 e 60 anos; estatura aproximada de 175 cm.', 'CONCLUIDO');
    INSERT INTO amostra_dna (codigo_amostra, id_corpo, tipo_material, data_coleta, laboratorio, status)
    VALUES ('AM-2026-0501', k1, 'SANGUE', '2026-10-06', 'Laboratório de Genética Forense', 'EM_ANALISE');
    INSERT INTO amostra_dna (codigo_amostra, id_desaparecido, id_familiar_doador, tipo_material,
        data_coleta, laboratorio, status)
    VALUES ('AM-2026-0502', d_valdemar, f_valdemar_filho, 'SALIVA', '2026-10-07',
        'Laboratório de Genética Forense', 'EM_ANALISE');

    -- -----------------------------------------------------------------
    -- Cruzamento automático
    -- -----------------------------------------------------------------
    PERFORM fn_gerar_correspondencias();

    -- Caso em apuração: Valdemar x IML-2026-000101
    PERFORM set_config('app.id_usuario', u_invest::TEXT, true);
    SELECT id_correspondencia INTO v_corresp FROM correspondencia
     WHERE id_corpo = k1 AND id_desaparecido = d_valdemar;
    UPDATE correspondencia SET status = 'EM_ANALISE' WHERE id_correspondencia = v_corresp;
    INSERT INTO analise_investigacao (id_correspondencia, tipo_analise, id_usuario, resultado, descricao)
    VALUES (v_corresp, 'COMPARACAO_FOTOGRAFICA', u_invest, 'COMPATIVEL',
            'Tatuagem de âncora no antebraço direito confere com a foto enviada pela família.');
    INSERT INTO analise_investigacao (id_correspondencia, tipo_analise, id_exame, id_usuario, resultado, descricao)
    VALUES (v_corresp, 'CONFRONTO_DNA',
            (SELECT id_exame FROM exame_pericial WHERE numero_laudo = 'LAU-2026-0311'),
            u_invest, 'PENDENTE', 'Aguardando confronto com a amostra de referência do filho.');

    -- Caso encerrado: Heitor x IML-2026-000106 (identificado e liberado)
    SELECT id_correspondencia INTO v_corresp FROM correspondencia
     WHERE id_corpo = k6 AND id_desaparecido = d_heitor;
    UPDATE correspondencia SET status = 'EM_ANALISE' WHERE id_correspondencia = v_corresp;

    PERFORM set_config('app.id_usuario', u_perito::TEXT, true);
    INSERT INTO exame_pericial (id_corpo, tipo_exame, id_perito, numero_laudo, data_solicitacao,
        data_realizacao, resultado, conclusao, status, id_causa)
    VALUES (k6, 'PAPILOSCOPICO', u_perito, 'LAU-2026-0077', '2026-03-10', '2026-03-12',
        'Impressões digitais coletadas e confrontadas com a base civil.',
        'Digitais coincidem com o prontuário civil de Heitor Brandão.', 'CONCLUIDO', c_infarto)
    RETURNING id_exame INTO v_exame;

    PERFORM set_config('app.id_usuario', u_invest::TEXT, true);
    INSERT INTO analise_investigacao (id_correspondencia, tipo_analise, id_exame, id_usuario, resultado, descricao)
    VALUES (v_corresp, 'CONFRONTO_DIGITAL', v_exame, u_invest, 'COMPATIVEL', 'Confronto papiloscópico positivo.');

    PERFORM set_config('app.id_usuario', u_perito::TEXT, true);
    INSERT INTO identificacao (id_corpo, id_desaparecido, id_correspondencia, metodo, id_exame,
        id_perito, numero_laudo, data_identificacao, observacoes)
    VALUES (k6, d_heitor, v_corresp, 'DIGITAL', v_exame, u_perito, 'LAU-2026-0077', '2026-03-12',
        'Família comunicada no mesmo dia.')
    RETURNING id_identificacao INTO v_ident;

    PERFORM set_config('app.id_usuario', u_atend::TEXT, true);
    INSERT INTO liberacao_corpo (id_corpo, id_familiar, data_liberacao, funeraria,
        numero_certidao_obito, destino, id_usuario)
    VALUES (k6, f_heitor_irma, '2026-03-13 10:00', 'Funerária Bom Descanso', 'CO-2026-11873',
        'SEPULTAMENTO', u_atend);

    -- -----------------------------------------------------------------
    -- Ajuste estético: datas do histórico iguais às datas de cadastro
    -- (os triggers gravam o horário em que o seed rodou)
    -- -----------------------------------------------------------------
    UPDATE historico_status h SET data_alteracao = c.data_entrada
      FROM corpo c
     WHERE h.entidade = 'CORPO' AND h.status_anterior IS NULL AND h.id_registro = c.id_corpo;
    UPDATE historico_status h SET data_alteracao = d.data_registro
      FROM registro_desaparecimento d
     WHERE h.entidade = 'DESAPARECIMENTO' AND h.status_anterior IS NULL AND h.id_registro = d.id_desaparecido;
    UPDATE historico_status h SET data_alteracao = TIMESTAMP '2026-03-10 09:00'
     WHERE h.status_novo = 'EM_ANALISE'
       AND ((h.entidade = 'CORPO'           AND h.id_registro = k6)
         OR (h.entidade = 'DESAPARECIMENTO' AND h.id_registro = d_heitor)
         OR (h.entidade = 'CORRESPONDENCIA' AND h.id_registro = v_corresp));
    UPDATE historico_status h SET data_alteracao = TIMESTAMP '2026-03-12 17:30'
     WHERE h.status_novo IN ('IDENTIFICADO','IDENTIFICADO_OBITO','CONFIRMADA')
        OR (h.entidade = 'CORRESPONDENCIA' AND h.status_novo = 'DESCARTADA'
            AND h.id_registro IN (SELECT id_correspondencia FROM correspondencia
                                   WHERE justificativa LIKE '%identificação oficial nº ' || v_ident));
    UPDATE historico_status h SET data_alteracao = TIMESTAMP '2026-03-13 10:00'
     WHERE h.status_novo = 'LIBERADO';
END;
$$;

-- Mantém as sequências à frente dos códigos usados acima
SELECT setval('seq_protocolo_desaparecimento',
              (SELECT max(substring(protocolo FROM '\d+$')::INT) FROM registro_desaparecimento));
SELECT setval('seq_codigo_iml',
              (SELECT max(substring(codigo_iml FROM '\d+$')::INT) FROM corpo));
