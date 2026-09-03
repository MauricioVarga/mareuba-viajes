# Mareuba · Webapp

App real conectada a Supabase (reemplaza al prototipo `mareuba_app.jsx`,
que usaba almacenamiento simulado). Login real, datos persistentes,
seguridad por rol aplicada por la base de datos (Row Level Security).

## Configuración inicial

Necesitás tener ya cargado `database/schema.sql` y `database/supabase_rls.sql`
en tu proyecto de Supabase (ver instrucciones en el README raíz del repo).

```bash
npm install
cp .env.example .env
```

Completá `.env` con los datos de tu proyecto (Supabase → Project Settings → API):

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxx
```

## Correr en desarrollo

```bash
npm run dev
```

Abre en `http://localhost:5173`. Iniciá sesión con un usuario que hayas
creado desde Supabase → Authentication → Users.

## Desplegar

```bash
npm run build
```

Genera la carpeta `dist/`, lista para subir a Vercel, Netlify o cualquier
hosting estático. En el panel de esos servicios, configurá las mismas
variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) antes
de desplegar — son necesarias en tiempo de build.

## Modo offline

Los choferes pueden iniciar y finalizar viajes sin señal. Así funciona:

- Cada viaje/lugar nuevo genera su ID en el propio celular (no depende de
  que el servidor responda para "existir").
- Si no hay conexión, la acción se guarda en el dispositivo (IndexedDB) y
  se aplica de inmediato en pantalla, para que el chofer vea su viaje
  como si ya se hubiera guardado.
- Apenas vuelve la señal, la app sincroniza sola, en el mismo orden en
  que se crearon los viajes.
- Mientras hay cambios sin sincronizar, aparece un aviso arriba de la
  pantalla.

Esto cubre el flujo del chofer (iniciar/finalizar viaje, cargar un lugar
nuevo). Los paneles de administración y gerencia asumen conexión — tiene
sentido, porque se usan desde la oficina.

## Instalar en el celular (PWA)

La app es una "Progressive Web App": no hace falta subirla a Google Play
ni a la App Store. Se instala directo desde el navegador:

- **Android (Chrome)**: entrar a la URL → menú (⋮) → "Instalar aplicación"
  o "Agregar a pantalla de inicio".
- **iPhone (Safari)**: entrar a la URL → botón compartir (□↑) → "Agregar
  a pantalla de inicio".

Queda con ícono propio, abre en pantalla completa (sin la barra del
navegador), y el "cascarón" de la app carga aunque no haya señal — lo que
sí necesita red es guardar y traer datos reales, que es exactamente lo
que la cola offline de arriba resuelve.

## Estructura

```
src/
├── supabaseClient.js   # Conexión a Supabase (schema "mareuba")
├── data.js             # Todas las consultas a la base, en un solo lugar
├── ui.jsx              # Componentes visuales compartidos
├── Login.jsx           # Pantalla de login (email + contraseña)
├── ChoferView.jsx      # Iniciar / finalizar viaje
├── AdminView.jsx       # Viajes, catálogos, usuarios
├── GerenteView.jsx     # Panel de KPIs
└── App.jsx             # Sesión, carga de datos, ruteo por rol
```

## Cómo se manejan los permisos

La app casi no filtra datos "a mano": pide `SELECT * FROM viajes` sin
importar el rol, y es la base de datos (RLS) la que decide qué filas
devolver según quién esté logueado. Si en el futuro cambian las reglas de
negocio, lo correcto es tocar las políticas en `supabase_rls.sql`, no el
código de React.

## Usuarios nuevos

Por ahora, dar de alta un usuario se hace desde el dashboard de Supabase
(Authentication → Users → Invite user), no desde la app. Automatizar esto
requiere una función de servidor con la clave `secret` (nunca del lado del
cliente) — es un buen próximo paso una vez que el flujo básico esté
probado en la empresa.
