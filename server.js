const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { db, inicializar } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cambiar-esta-clave-en-produccion';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function generarToken(admin) {
  return jwt.sign({ id: admin.id, username: admin.username, rol: admin.rol }, JWT_SECRET, { expiresIn: '12h' });
}

function requiereAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta token de autenticacion' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch (e) { return res.status(401).json({ error: 'Token invalido o expirado' }); }
}

function requiereAdministrador(req, res, next) {
  if (req.admin?.rol !== 'administrador') return res.status(403).json({ error: 'Requiere permisos de administrador' });
  next();
}

function normalizarNumeroActa(s) {
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}

// ---------- Rutas publicas ----------

app.get('/api/total', async (req, res) => {
  try {
    const totalRes = await db.execute('SELECT COALESCE(SUM(cantidad_firmantes), 0) AS total FROM actas');
    const metaRes = await db.execute("SELECT valor FROM configuracion WHERE clave = 'meta_firmas'");
    res.json({ total: Number(totalRes.rows[0].total), meta: parseInt(metaRes.rows[0].valor, 10) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener el total' }); }
});

app.get('/api/desglose', async (req, res) => {
  try {
    const resultado = await db.execute(`
      SELECT a.nombre_institucion, a.username, COALESCE(SUM(ac.cantidad_firmantes), 0) AS total
      FROM administradores a
      LEFT JOIN actas ac ON ac.admin_id = a.id
      WHERE a.rol = 'usuario'
      GROUP BY a.id
      ORDER BY total DESC
    `);
    res.json({ instituciones: resultado.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener el desglose' }); }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y clave son obligatorios' });
  try {
    const resultado = await db.execute({ sql: 'SELECT * FROM administradores WHERE username = ?', args: [username] });
    const admin = resultado.rows[0];
    if (!admin || !bcrypt.compareSync(password, admin.password_hash))
      return res.status(401).json({ error: 'Usuario o clave incorrectos' });
    res.json({ token: generarToken(admin), username: admin.username, rol: admin.rol });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al iniciar sesion' }); }
});

// ---------- Rutas autenticadas ----------

app.put('/api/password', requiereAuth, async (req, res) => {
  const { password_actual, password_nueva } = req.body || {};
  if (!password_actual || !password_nueva) return res.status(400).json({ error: 'Completa todos los campos' });
  if (password_nueva.length < 6) return res.status(400).json({ error: 'La nueva clave debe tener al menos 6 caracteres' });
  try {
    const resultado = await db.execute({ sql: 'SELECT password_hash FROM administradores WHERE id = ?', args: [req.admin.id] });
    const admin = resultado.rows[0];
    if (!admin || !bcrypt.compareSync(password_actual, admin.password_hash))
      return res.status(401).json({ error: 'La clave actual es incorrecta' });
    const hash = bcrypt.hashSync(password_nueva, 10);
    await db.execute({ sql: 'UPDATE administradores SET password_hash = ?, password_visible = NULL WHERE id = ?', args: [hash, req.admin.id] });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al cambiar la clave' }); }
});

app.post('/api/actas', requiereAuth, async (req, res) => {
  const { numero_acta, cantidad_firmantes } = req.body || {};
  const numero = normalizarNumeroActa(String(numero_acta || '').trim());
  const cantidad = parseInt(cantidad_firmantes, 10);
  if (!numero) return res.status(400).json({ error: 'El numero de acta es obligatorio' });
  if (!Number.isInteger(cantidad) || cantidad <= 0)
    return res.status(400).json({ error: 'La cantidad debe ser un entero mayor a 0' });
  try {
    await db.execute({ sql: 'INSERT INTO actas (admin_id, numero_acta, cantidad_firmantes) VALUES (?, ?, ?)', args: [req.admin.id, numero, cantidad] });
    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message || e).includes('UNIQUE'))
      return res.status(409).json({ error: `Ya cargaste el acta N° ${numero}.` });
    console.error(e); res.status(500).json({ error: 'Error al guardar el acta' });
  }
});

app.get('/api/actas', requiereAuth, async (req, res) => {
  try {
    const resultado = await db.execute({
      sql: 'SELECT numero_acta, cantidad_firmantes, creado_en FROM actas WHERE admin_id = ? ORDER BY creado_en DESC',
      args: [req.admin.id]
    });
    const filas = resultado.rows;
    res.json({ actas: filas, subtotal: filas.reduce((acc, f) => acc + Number(f.cantidad_firmantes), 0) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener las actas' }); }
});

// ---------- Rutas de administrador ----------

app.post('/api/administradores', requiereAuth, requiereAdministrador, async (req, res) => {
  const { username, password, nombre_institucion } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y clave son obligatorios' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    await db.execute({
      sql: "INSERT INTO administradores (username, password_hash, password_visible, nombre_institucion, rol) VALUES (?, ?, ?, ?, 'usuario')",
      args: [username, hash, password, nombre_institucion || null]
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message || e).includes('UNIQUE')) return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    console.error(e); res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

app.get('/api/usuarios', requiereAuth, requiereAdministrador, async (req, res) => {
  try {
    const resultado = await db.execute(
      "SELECT username, nombre_institucion, password_visible, creado_en FROM administradores WHERE rol = 'usuario' ORDER BY creado_en ASC"
    );
    res.json({ usuarios: resultado.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener los usuarios' }); }
});

app.get('/api/admin/actas', requiereAuth, requiereAdministrador, async (req, res) => {
  try {
    const resultado = await db.execute(`
      SELECT a.username, a.nombre_institucion, ac.numero_acta, ac.cantidad_firmantes, ac.creado_en
      FROM actas ac
      JOIN administradores a ON a.id = ac.admin_id
      ORDER BY a.username ASC, ac.creado_en DESC
    `);
    res.json({ actas: resultado.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener las actas' }); }
});

app.put('/api/meta', requiereAuth, requiereAdministrador, async (req, res) => {
  const meta = parseInt(req.body?.meta, 10);
  if (!Number.isInteger(meta) || meta <= 0) return res.status(400).json({ error: 'La meta debe ser un entero mayor a 0' });
  try {
    await db.execute({ sql: "UPDATE configuracion SET valor = ? WHERE clave = 'meta_firmas'", args: [String(meta)] });
    res.json({ ok: true, meta });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar la meta' }); }
});

inicializar()
  .then(() => app.listen(PORT, () => console.log('Servidor corriendo en http://localhost:' + PORT)))
  .catch((e) => { console.error('No se pudo inicializar la base de datos:', e); process.exit(1); });
