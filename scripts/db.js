// Cria o banco e roda os scripts SQL sem precisar do psql no PATH.
//   npm run db:criar   -> recria o banco PGDATABASE e roda 01, 02 e 03
//   npm run db:testar  -> roda 04_testes.sql (desfeito no final)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PASTA_DB = path.join(__dirname, '..', 'db');
const banco = process.env.PGDATABASE || 'iml';

// Remove os meta-comandos do psql (\set, \echo), que o driver não entende
const lerSql = (arquivo) =>
  fs
    .readFileSync(path.join(PASTA_DB, arquivo), 'utf8')
    .split(/\r?\n/)
    .filter((linha) => !linha.trimStart().startsWith('\\'))
    .join('\n');

async function conectar(database) {
  const client = new Client({ database });
  client.on('notice', (n) => console.log('   ' + n.message));
  await client.connect();
  return client;
}

async function criar() {
  if (!/^[a-z_][a-z0-9_]*$/.test(banco)) throw new Error(`Nome de banco inválido: ${banco}`);

  const admin = await conectar('postgres');
  console.log(`Recriando o banco "${banco}"...`);
  await admin.query(`DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${banco} ENCODING 'UTF8' TEMPLATE template0`);
  await admin.end();

  const client = await conectar(banco);
  for (const arquivo of ['01_schema.sql', '02_logica.sql', '03_seed.sql']) {
    console.log(`Executando ${arquivo}...`);
    await client.query(lerSql(arquivo));
  }
  const { rows } = await client.query(
    `SELECT (SELECT count(*) FROM information_schema.tables
              WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tabelas,
            (SELECT count(*) FROM objeto) AS objetos,
            (SELECT count(*) FROM corpo) AS corpos`
  );
  console.log(`Pronto: ${rows[0].tabelas} tabelas, ${rows[0].objetos} objetos, ${rows[0].corpos} corpos.`);
  await client.end();
}

async function testar() {
  const client = await conectar(banco);
  try {
    await client.query(lerSql('04_testes.sql'));
    console.log('\nTodos os testes passaram (alterações desfeitas).');
  } finally {
    await client.end();
  }
}

const comando = process.argv[2];
const acoes = { criar, testar };
if (!acoes[comando]) {
  console.error('Uso: node scripts/db.js criar|testar');
  process.exit(1);
}
acoes[comando]().catch((err) => {
  console.error('\nERRO:', err.message);
  if (err.where) console.error('Onde:', err.where);
  process.exit(1);
});
