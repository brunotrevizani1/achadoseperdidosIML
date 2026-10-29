require('dotenv').config();
const { Pool, types } = require('pg');

// NUMERIC vira número no JSON; DATE fica como texto 'AAAA-MM-DD' (sem fuso)
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(types.builtins.DATE, (v) => v);

const pool = new Pool();

// Conexão ociosa derrubada (banco reiniciado/recriado) não deve derrubar o servidor
pool.on('error', (err) => console.error('Conexão com o PostgreSQL perdida:', err.message));

const query = (text, params) => pool.query(text, params);

// Executa fn(client) numa transação, informando aos triggers quem é o usuário
// (app.id_usuario) e, opcionalmente, uma observação para o historico_status.
async function withUser(idUsuario, fn, observacao) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.id_usuario', $1, true)", [String(idUsuario ?? '')]);
    if (observacao) {
      await client.query("SELECT set_config('app.observacao', $1, true)", [observacao]);
    }
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withUser };
