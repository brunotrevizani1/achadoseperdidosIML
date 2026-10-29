// Consultas e gravações reaproveitadas por mais de uma rota

const SQL_SINAIS = `
  SELECT s.id_sinal, s.id_tipo_sinal, t.descricao AS tipo, s.id_regiao, r.descricao AS regiao,
         s.lado, s.descricao, s.tamanho_cm, s.cor
    FROM sinal_particular s
    JOIN tipo_sinal t USING (id_tipo_sinal)
    JOIN regiao_corpo r USING (id_regiao)`;

async function sinaisDoCorpo(db, idCorpo) {
  const { rows } = await db.query(`${SQL_SINAIS} WHERE s.id_corpo = $1 ORDER BY s.id_sinal`, [idCorpo]);
  return rows;
}

async function sinaisDoDesaparecido(db, idDesaparecido) {
  const { rows } = await db.query(`${SQL_SINAIS} WHERE s.id_desaparecido = $1 ORDER BY s.id_sinal`, [
    idDesaparecido,
  ]);
  return rows;
}

async function historico(db, entidade, idRegistro) {
  const { rows } = await db.query(
    `SELECT h.id_historico, h.status_anterior, h.status_novo, h.data_alteracao, h.observacao,
            u.nome AS usuario, u.perfil
       FROM historico_status h
       LEFT JOIN usuario u USING (id_usuario)
      WHERE h.entidade = $1 AND h.id_registro = $2
      ORDER BY h.data_alteracao, h.id_historico`,
    [entidade, idRegistro]
  );
  return rows;
}

// Correspondências de um corpo ou de um desaparecido (coluna = 'id_corpo' | 'id_desaparecido')
async function correspondenciasDe(db, coluna, id) {
  const { rows } = await db.query(
    `SELECT co.id_correspondencia, co.score_total, co.status, co.justificativa,
            c.id_corpo, c.codigo_iml, d.id_desaparecido, d.nome_desaparecido, d.apelido
       FROM correspondencia co
       JOIN corpo c USING (id_corpo)
       JOIN registro_desaparecimento d USING (id_desaparecido)
      WHERE co.${coluna} = $1
      ORDER BY co.score_total DESC`,
    [id]
  );
  return rows;
}

async function inserirSinais(db, sinais, { idCorpo = null, idDesaparecido = null }) {
  for (const s of sinais || []) {
    await db.query(
      `INSERT INTO sinal_particular (id_corpo, id_desaparecido, id_tipo_sinal, id_regiao,
                                     lado, descricao, tamanho_cm, cor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [idCorpo, idDesaparecido, s.id_tipo_sinal, s.id_regiao, s.lado || null, s.descricao,
       s.tamanho_cm || null, s.cor || null]
    );
  }
}

// Campos vazios do formulário viram NULL no banco
const vazioParaNulo = (v) => (v === '' || v === undefined ? null : v);

module.exports = {
  sinaisDoCorpo,
  sinaisDoDesaparecido,
  historico,
  correspondenciasDe,
  inserirSinais,
  vazioParaNulo,
};
