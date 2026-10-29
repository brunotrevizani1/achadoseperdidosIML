const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.get('/painel', async (req, res) => {
  const [corpos, desaparecidos, correspondencias, gavetas, topMatches, eventos] = await Promise.all([
    query('SELECT status, count(*)::INT AS total FROM corpo GROUP BY status'),
    query('SELECT status, count(*)::INT AS total FROM registro_desaparecimento GROUP BY status'),
    query('SELECT status, count(*)::INT AS total FROM correspondencia GROUP BY status'),
    query(
      `SELECT c.id_corpo, c.codigo_iml, c.sexo, c.status, c.gaveta_camara,
              c.idade_estimada_min, c.idade_estimada_max, c.estado_conservacao,
              (CURRENT_DATE - c.data_entrada::DATE) AS dias_na_camara,
              (SELECT max(score_total) FROM correspondencia co
                WHERE co.id_corpo = c.id_corpo AND co.status IN ('SUGERIDA','EM_ANALISE')) AS melhor_score
         FROM corpo c
        WHERE c.gaveta_camara IS NOT NULL
          AND c.status IN ('AGUARDANDO_IDENTIFICACAO','EM_ANALISE','IDENTIFICADO')
        ORDER BY c.gaveta_camara`
    ),
    query(
      `SELECT co.id_correspondencia, co.score_total, co.status,
              c.codigo_iml, d.nome_desaparecido, d.apelido
         FROM correspondencia co
         JOIN corpo c USING (id_corpo)
         JOIN registro_desaparecimento d USING (id_desaparecido)
        WHERE co.status IN ('SUGERIDA','EM_ANALISE')
        ORDER BY co.score_total DESC, co.id_correspondencia
        LIMIT 5`
    ),
    query(
      `SELECT h.entidade, h.id_registro, h.status_anterior, h.status_novo, h.data_alteracao,
              h.observacao, u.nome AS usuario,
              CASE h.entidade
                WHEN 'CORPO' THEN (SELECT codigo_iml FROM corpo WHERE id_corpo = h.id_registro)
                WHEN 'DESAPARECIMENTO' THEN (SELECT nome_desaparecido FROM registro_desaparecimento
                                              WHERE id_desaparecido = h.id_registro)
                ELSE (SELECT c.codigo_iml || ' × ' || d.nome_desaparecido
                        FROM correspondencia co JOIN corpo c USING (id_corpo)
                        JOIN registro_desaparecimento d USING (id_desaparecido)
                       WHERE co.id_correspondencia = h.id_registro)
              END AS rotulo
         FROM historico_status h
         LEFT JOIN usuario u USING (id_usuario)
        ORDER BY h.data_alteracao DESC, h.id_historico DESC
        LIMIT 12`
    ),
  ]);

  const porStatus = (r) => Object.fromEntries(r.rows.map((x) => [x.status, x.total]));
  res.json({
    corpos: porStatus(corpos),
    desaparecidos: porStatus(desaparecidos),
    correspondencias: porStatus(correspondencias),
    gavetas: gavetas.rows,
    top_matches: topMatches.rows,
    eventos: eventos.rows,
  });
});

router.get('/historico/:entidade/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT h.id_historico, h.status_anterior, h.status_novo, h.data_alteracao, h.observacao,
            u.nome AS usuario, u.perfil
       FROM historico_status h
       LEFT JOIN usuario u USING (id_usuario)
      WHERE h.entidade = upper($1) AND h.id_registro = $2
      ORDER BY h.data_alteracao, h.id_historico`,
    [req.params.entidade, req.params.id]
  );
  res.json(rows);
});

module.exports = router;
