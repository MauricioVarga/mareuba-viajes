# Mareuba · Registro de viajes de camiones

Aplicación para registrar y administrar los viajes de una flota de camiones:
carga de viajes por parte de los choferes (incluso sin conexión), supervisión
administrativa y panel de KPIs gerencial.

## Estructura del repositorio

```
mareuba-viajes/
├── database/
│   ├── schema.sql      # Esquema completo (PostgreSQL): tablas, constraints, triggers, vistas
│   └── seed.sql        # Datos de ejemplo para probar el esquema
├── app/
│   └── mareuba_app.jsx # Prototipo funcional (React) del flujo de viajes
└── docs/
    └── originales/     # Documento de requisitos y planilla original de la base de datos
```

## Base de datos

El esquema está pensado para Postgres 14+ y soporta:

- Roles de usuario (chofer, administrativo, gerencial)
- Viajes con múltiples cargas, cálculo automático de kilómetros recorridos
- Registro de combustible y peajes
- Trabajo sin conexión: IDs UUID generables en el dispositivo sin riesgo de colisión
- Auditoría de ediciones sobre viajes ya finalizados

### Cómo cargarlo

```bash
createdb mareuba
psql -d mareuba -f database/schema.sql
psql -d mareuba -f database/seed.sql   # opcional, datos de ejemplo
```

## Prototipo de app

`app/mareuba_app.jsx` es un prototipo de la app en React (pensado para correr
como artifact de Claude, con `window.storage` como almacenamiento). Sirve para
validar el flujo antes de conectarlo a un backend real sobre el esquema de
`database/schema.sql`.

## Próximos pasos sugeridos

- Backend real (por ejemplo Supabase, que es Postgres y da sincronización
  offline) conectado al esquema de `database/schema.sql`.
- App móvil para los choferes con guardado local y sincronización.
