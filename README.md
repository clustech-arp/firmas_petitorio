# Un Millon de Firmas por la Universidad Publica

Aplicacion web para que administradores carguen actas de firmas (numero de acta + cantidad de firmantes) y la ciudadania vea el conteo general en una pagina publica con barra de progreso hacia una meta ajustable.

## Como funciona

- **Pagina publica** (`/` o `/index.html`): muestra el total de firmas acumuladas y una barra de progreso hacia la meta (por defecto 1.000.000). Se actualiza sola cada 15 segundos.
- **Panel de administrador** (`/admin.html`):
  - Cada administrador inicia sesion con usuario y clave.
  - Carga actas indicando **numero de acta** y **cantidad de firmantes**.
  - El numero de acta es propio de cada cuenta: el mismo administrador no puede repetirlo, pero administradores distintos si pueden usar el mismo numero (por ejemplo, "001").
  - Ve la lista de sus propias actas cargadas y su subtotal.
- **Super-administrador**: ademas de lo anterior, puede ajustar la meta general de firmas y crear nuevas cuentas de administrador.

## Requisitos

- Node.js 18 o superior.

## Base de datos

La app usa **libSQL** (compatible con SQLite) a traves de `@libsql/client`. Funciona de dos maneras, sin cambiar nada de codigo:

- **Local / desarrollo**: si no configurás las variables `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`, se crea automaticamente un archivo `firmas.db` en la carpeta del proyecto.
- **Produccion con Turso (recomendado, gratis)**: configurando esas dos variables de entorno, los datos se guardan en una base en la nube que persiste sin importar donde despliegues la app ni cuantas veces la reinicies. Asi evitas depender de un disco persistente de pago en el hosting.

### Como crear la base en Turso (gratis, sin instalar nada)

1. Entrar a [turso.tech](https://turso.tech) y crear una cuenta (podes usar GitHub).
2. En el panel, elegir "Create Database" / "New Database", ponerle un nombre (por ejemplo `firmas-universidad`) y elegir una region cercana a tu publico.
3. Abrir la base creada y copiar su URL de conexion (algo como `libsql://firmas-universidad-tuusuario.turso.io`). Esa es tu `TURSO_DATABASE_URL`.
4. En la misma pantalla, generar un token de acceso ("Get Token" / "Generate Token") y copiarlo. Ese es tu `TURSO_AUTH_TOKEN` (guardalo bien, no se vuelve a mostrar completo).
5. Cargar esas dos variables como variables de entorno en tu hosting (ver seccion de despliegue).

El plan gratuito de Turso incluye varios GB de almacenamiento y cientos de millones de lecturas por mes — de sobra para esta campana.

## Instalacion y uso local

```bash
cd firmas-universidad
npm install
npm start
```

Abrir en el navegador: `http://localhost:3000`

Al iniciar por primera vez, se crea automaticamente la cuenta de **super-administrador**:

- Usuario: `superadmin`
- Clave: `cambiar123`

**Importante:** ingresar con esa cuenta y crear cuentas reales cuanto antes; la clave de ejemplo no debe usarse en produccion.

## Crear administradores

Solo el super-administrador puede dar de alta nuevas cuentas, desde la seccion "Crear nuevo administrador" en su panel (usuario, clave y rol).

## Ajustar la meta de firmas

Solo el super-administrador puede cambiarla, desde su panel ("Ajustar meta general"). La barra de progreso de la pagina publica refleja el cambio automaticamente.

## Despliegue en un hosting gratuito

Con la base de datos en Turso, ya no necesitas un disco persistente de pago: cualquier hosting gratuito de Node.js sirve. Por ejemplo, con **Render** (free tier):

1. Subir el proyecto a un repositorio de GitHub (sin la carpeta `node_modules`).
2. En Render: New -> Web Service -> conectar el repositorio.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free
3. Configurar las variables de entorno del servicio:
   - `TURSO_DATABASE_URL` = la URL de tu base en Turso
   - `TURSO_AUTH_TOKEN` = el token generado en Turso
   - `JWT_SECRET` = una clave secreta propia, larga e inventada por vos (no uses la de ejemplo del codigo)
4. Deploy. Render entrega una URL publica con HTTPS.

Nota: el free tier de Render "duerme" el servicio tras 15 minutos sin trafico y tarda unos segundos en reactivarse con la primera visita — no afecta los datos (que viven en Turso), solo el tiempo de respuesta de esa primera carga.

Otras variables de entorno opcionales:

- `PORT`: puerto del servidor (por defecto 3000).
- `DB_PATH`: si NO usas Turso, ruta del archivo SQLite local (por defecto `firmas.db`).

## Estructura del proyecto

```
firmas-universidad/
├── server.js       -> servidor Express y rutas de la API
├── db.js           -> esquema y conexion a la base de datos (libSQL / Turso)
├── package.json
└── public/
    ├── index.html  -> pagina publica (contador + barra de progreso)
    └── admin.html  -> login y panel de administracion
```
