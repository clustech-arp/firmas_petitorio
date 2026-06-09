const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');

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
      password_visible TEXT,
      nombre_institucion TEXT,
      rol TEXT NOT NULL DEFAULT 'usuario',
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try { await db.execute("ALTER TABLE administradores ADD COLUMN password_visible TEXT"); } catch (e) {}
  try { await db.execute("ALTER TABLE administradores ADD COLUMN nombre_institucion TEXT"); } catch (e) {}

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

  await db.execute("UPDATE administradores SET rol = 'administrador' WHERE rol = 'superadmin'");
  await db.execute("UPDATE administradores SET rol = 'usuario' WHERE rol = 'admin'");

  const mapadres = await db.execute({
    sql: "SELECT id FROM administradores WHERE username = 'mapadres'",
    args: []
  });
  if (mapadres.rows.length === 0) {
    const hash = bcrypt.hashSync('quefestival!', 10);
    await db.execute({
      sql: "INSERT INTO administradores (username, password_hash, rol, nombre_institucion) VALUES (?, ?, 'administrador', ?)",
      args: ['mapadres', hash, 'Madres y Padres por la Educación Pública']
    });
    console.log('Cuenta mapadres creada');
  }

  const admins = await db.execute({
    sql: "SELECT id FROM administradores WHERE rol = 'administrador'",
    args: []
  });
  if (admins.rows.length === 0) {
    const hash = bcrypt.hashSync('cambiar123', 10);
    await db.execute({
      sql: "INSERT INTO administradores (username, password_hash, rol) VALUES (?, ?, 'administrador')",
      args: ['superadmin', hash]
    });
    console.log('Cuenta superadmin creada: clave "cambiar123"');
  }
}

module.exports = { db, inicializar };
