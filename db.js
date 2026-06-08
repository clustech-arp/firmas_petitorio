const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');

// Conexion a la base de datos:
// - En produccion con Turso: configurar TURSO_DATABASE_URL y TURSO_AUTH_TOKEN
//   (ver README para el paso a paso). Es gratis y los datos persisten en la nube.
// - En desarrollo local, si esas variables no estan, se usa un archivo SQLite local
//   (configurable con DB_PATH, o "firmas.db" en la carpeta del proyecto por defecto).
const archivoLocal = process.env.DB_PATH || path.join(__dirname, 'firmas.db');
const url = process.env.TURSO_DATABASE_URL || `file:${archivoLocal}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({ url, authToken });

async function inicializar() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS administradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'admin',
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS actas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL REFERENCES administradores(id),
      numero_acta TEXT NOT NULL,
      cantidad_firmantes INTEGER NOT NULL CHECK (cantidad_firmantes > 0),
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (admin_id, numero_acta)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `);

  const meta = await db.execute({
    sql: "SELECT valor FROM configuracion WHERE clave = 'meta_firmas'",
    args: []
  });
  if (meta.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO configuracion (clave, valor) VALUES ('meta_firmas', '1000000')",
      args: []
    });
  }

  const superadmin = await db.execute({
    sql: "SELECT id FROM administradores WHERE rol = 'superadmin'",
    args: []
  });
  if (superadmin.rows.length === 0) {
    const hash = bcrypt.hashSync('cambiar123', 10);
    await db.execute({
      sql: "INSERT INTO administradores (username, password_hash, rol) VALUES (?, ?, 'superadmin')",
      args: ['superadmin', hash]
    });
    console.log('Cuenta superadmin creada: usuario "superadmin", clave "cambiar123" (cambiarla luego de iniciar sesion)');
  }
}

module.exports = { db, inicializar };
