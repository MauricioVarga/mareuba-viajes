-- =====================================================================
--  MAREUBA · Registro de Viajes de Camiones
--  Esquema de base de datos (PostgreSQL 14+)
--  Generado a partir de: Viajes_Mareuba_Base_Datos_V5.xlsx
--                         Aplicación_de_registro_de_viajes_de_camiones.docx
-- =====================================================================
--
--  DECISIONES DE DISEÑO CLAVE
--  ---------------------------------------------------------------
--  1) Claves primarias UUID en tablas "operativas" (viajes, cargamentos,
--     combustible, peajes, lugares): un chofer sin señal puede generar
--     el UUID en el dispositivo antes de sincronizar, sin riesgo de
--     colisión con lo que se generó en otro camión al mismo tiempo.
--     Esto es lo que tu Excel resolvía con IDs tipo "260823_01"
--     (fecha + secuencia), que sí puede colisionar si dos choferes
--     cierran viajes offline el mismo día.
--
--  2) Un número de viaje legible (numero_viaje, BIGSERIAL) se asigna
--     recién cuando el registro llega al servidor. Sirve para mostrar
--     "Viaje #482" en pantalla sin exponer el UUID.
--
--  3) Catálogos (roles, estados, tipos, unidades, métodos de medición)
--     mantienen códigos cortos como PK, tal como en tu planilla: son
--     datos fijos que solo administra el rol Administrativo, nunca se
--     crean sin conexión, y los códigos ya son mnemónicos (EST_FIN,
--     ROL_ADM, etc.).
--
--  4) Se agregan COMBUSTIBLE y PEAJES (pedidos en el Word, ausentes
--     en el Excel), con vínculo opcional a un viaje puntual.
--
--  5) km_recorridos es una columna GENERADA (no se carga a mano):
--     el requisito dice que se calcula automáticamente = odómetro
--     final - odómetro inicial.
--
--  6) Reglas de negocio que un simple NOT NULL no puede expresar
--     (ej: "cantidad en destino obligatoria SOLO al finalizar el
--     viaje") se aplican con triggers, documentados en cada uno.
--
--  7) Todas las tablas "sincronizables" tienen client_uuid, device_id,
--     sync_status, creado_en y actualizado_en para soportar el
--     funcionamiento offline-first pedido en el Word.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;        -- email case-insensitive

CREATE SCHEMA IF NOT EXISTS mareuba;
SET search_path TO mareuba, public;

-- =====================================================================
-- 1. CATÁLOGOS (datos maestros fijos, administrados por el rol ADM)
-- =====================================================================

CREATE TABLE roles (
    id_rol          TEXT PRIMARY KEY,
    nombre_rol      TEXT NOT NULL UNIQUE
);
COMMENT ON TABLE roles IS 'Perfiles de usuario: Administrativo, Operativo (chofer), Gerencial';

CREATE TABLE estados_viaje (
    id_estado       TEXT PRIMARY KEY,
    nombre_estado   TEXT NOT NULL UNIQUE
);

CREATE TABLE tipos_vehiculo (
    id_tipo_vehiculo    TEXT PRIMARY KEY,
    nombre_tipo_vehiculo TEXT NOT NULL UNIQUE
);

CREATE TABLE tipos_carga (
    id_tipo_carga   TEXT PRIMARY KEY,
    nombre_tipo_carga TEXT NOT NULL UNIQUE
);

CREATE TABLE unidades (
    id_unidad       TEXT PRIMARY KEY,
    nombre_unidad   TEXT NOT NULL UNIQUE
);

CREATE TABLE metodos_medicion (
    id_metodo_medicion     TEXT PRIMARY KEY,
    nombre_metodo_medicion TEXT NOT NULL UNIQUE
);

CREATE TABLE tipos_lugar (
    id_tipo_lugar   TEXT PRIMARY KEY,
    nombre_tipo_lugar TEXT NOT NULL UNIQUE
);

INSERT INTO roles VALUES
    ('ROL_ADM',   'Administrativo'),
    ('ROL_OP',    'Operativo'),
    ('ROL_GEREN', 'Gerencial');

INSERT INTO estados_viaje VALUES
    ('EST_CURSO', 'En Curso'),
    ('EST_FIN',   'Finalizado');

INSERT INTO tipos_vehiculo VALUES
    ('TV_CAM',     'Camion'),
    ('TV_Pala',    'Pala'),
    ('TV_Tractor', 'Tractor');

INSERT INTO tipos_carga VALUES
    ('TC_GRA', 'Grano'),
    ('TC_ALI', 'Alimento'),
    ('TC_MAT', 'Materiales'),
    ('TC_MAQ', 'Maquinaria');

INSERT INTO unidades VALUES
    ('UN_KG', 'Kg'),
    ('UN_LT', 'Lts');

INSERT INTO metodos_medicion VALUES
    ('MM_PES', 'Pesaje en bascula'),
    ('MM_EST', 'Estimacion');

INSERT INTO tipos_lugar VALUES
    ('TL_CAMPO', 'Campo'),
    ('TL_ACOPIO', 'Acopio'),
    ('TL_TAMBO', 'Tambo'),
    ('TL_PLANTA', 'Planta');

-- =====================================================================
-- 2. USUARIOS
-- =====================================================================

CREATE TABLE usuarios (
    -- En Supabase, id_usuario = auth.users.id: el login lo maneja Supabase Auth,
    -- esta tabla solo guarda los datos de negocio (rol, nombre) de cada cuenta.
    -- En Postgres genérico (sin Supabase), quitar la referencia a auth.users
    -- y volver a DEFAULT gen_random_uuid().
    id_usuario      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           CITEXT NOT NULL UNIQUE,      -- requiere extensión citext (ver abajo)
    nombre          TEXT NOT NULL,
    apellido        TEXT NOT NULL,
    id_rol          TEXT NOT NULL REFERENCES roles(id_rol) DEFAULT 'ROL_OP',
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE usuarios IS 'El chofer se identifica automáticamente por el usuario logueado (requisito del Word)';

-- Al crear una cuenta en Supabase Auth (signup o invitación por email),
-- este trigger crea automáticamente la fila correspondiente en usuarios,
-- con rol Operativo (chofer) por defecto. Un administrador cambia el rol
-- después si corresponde (ver mareuba_supabase_rls.sql).
CREATE OR REPLACE FUNCTION mareuba.fn_provisionar_usuario()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO mareuba.usuarios (id_usuario, email, nombre, apellido, id_rol)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
        COALESCE(NEW.raw_user_meta_data->>'id_rol', 'ROL_OP')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mareuba, public;

CREATE TRIGGER trg_provisionar_usuario
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION mareuba.fn_provisionar_usuario();

-- =====================================================================
-- 3. VEHÍCULOS
-- =====================================================================

CREATE TABLE vehiculos (
    id_vehiculo         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patente             TEXT NOT NULL UNIQUE,     -- ej: "AE517OT"
    nombre_vehiculo     TEXT NOT NULL,
    id_tipo_vehiculo    TEXT NOT NULL REFERENCES tipos_vehiculo(id_tipo_vehiculo),
    marca               TEXT,
    modelo              TEXT,
    anio                SMALLINT CHECK (anio BETWEEN 1970 AND EXTRACT(YEAR FROM now())::INT + 1),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones       TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 4. CARGAS (tipos de mercadería que se transportan)
-- =====================================================================

CREATE TABLE cargas (
    id_carga            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              TEXT UNIQUE,               -- ej: "GR_MZ" (opcional, legible)
    nombre_carga        TEXT NOT NULL,
    id_tipo_carga       TEXT NOT NULL REFERENCES tipos_carga(id_tipo_carga),
    id_unidad           TEXT NOT NULL REFERENCES unidades(id_unidad),
    id_metodo_medicion  TEXT NOT NULL REFERENCES metodos_medicion(id_metodo_medicion),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones       TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 5. LUGARES (origen/destino) — el chofer puede crear uno nuevo offline
-- =====================================================================

CREATE TABLE lugares (
    id_lugar            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              TEXT UNIQUE,
    nombre_lugar        TEXT NOT NULL,
    id_tipo_lugar       TEXT REFERENCES tipos_lugar(id_tipo_lugar),
    ubicacion           TEXT,
    provincia           TEXT,
    pais                TEXT DEFAULT 'Argentina',
    latitud             NUMERIC(9,6),
    longitud            NUMERIC(9,6),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones       TEXT,
    creado_por          UUID REFERENCES usuarios(id_usuario),
    -- soporte offline: un chofer puede crear el lugar sin conexión
    client_uuid         UUID UNIQUE,
    device_id           TEXT,
    sync_status         TEXT NOT NULL DEFAULT 'sincronizado'
                            CHECK (sync_status IN ('pendiente','sincronizado','conflicto')),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 6. VIAJES
-- =====================================================================

CREATE TABLE viajes (
    id_viaje            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_viaje        BIGSERIAL UNIQUE,            -- correlativo legible, lo asigna el servidor

    id_chofer           UUID NOT NULL REFERENCES usuarios(id_usuario),
    id_vehiculo         UUID NOT NULL REFERENCES vehiculos(id_vehiculo),

    id_origen           UUID NOT NULL REFERENCES lugares(id_lugar),
    id_destino          UUID NOT NULL REFERENCES lugares(id_lugar),

    fecha_hora_salida   TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_hora_llegada  TIMESTAMPTZ,

    odometro_inicial    INTEGER NOT NULL CHECK (odometro_inicial >= 0),
    odometro_final      INTEGER CHECK (odometro_final IS NULL OR odometro_final >= odometro_inicial),
    -- calculado automáticamente, tal como pide el requisito
    km_recorridos       INTEGER GENERATED ALWAYS AS (odometro_final - odometro_inicial) STORED,

    id_estado           TEXT NOT NULL DEFAULT 'EST_CURSO' REFERENCES estados_viaje(id_estado),
    usuario_cierre_id   UUID REFERENCES usuarios(id_usuario),

    observaciones        TEXT,

    -- edición administrativa posterior (viajes finalizados se pueden corregir)
    actualizado_por      UUID REFERENCES usuarios(id_usuario),

    -- soporte offline
    client_uuid          UUID UNIQUE,
    device_id             TEXT,
    sync_status           TEXT NOT NULL DEFAULT 'sincronizado'
                              CHECK (sync_status IN ('pendiente','sincronizado','conflicto')),

    creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_llegada_posterior
        CHECK (fecha_hora_llegada IS NULL OR fecha_hora_llegada >= fecha_hora_salida),

    -- "no se registrarán kilómetros sin carga": un viaje finalizado
    -- siempre debe tener odómetro final y hora de llegada
    CONSTRAINT chk_cierre_completo
        CHECK (
            (id_estado = 'EST_CURSO') OR
            (id_estado = 'EST_FIN' AND odometro_final IS NOT NULL
                                    AND fecha_hora_llegada IS NOT NULL
                                    AND usuario_cierre_id IS NOT NULL)
        )
);

COMMENT ON TABLE viajes IS 'Cada fila = un tramo con carga realizado por UN chofer. Si el viaje lo comparten varios choferes, cada uno carga su propio tramo (su propia fila).';
COMMENT ON COLUMN viajes.km_recorridos IS 'Calculado automáticamente: odometro_final - odometro_inicial. No se carga a mano.';

CREATE INDEX idx_viajes_chofer   ON viajes(id_chofer);
CREATE INDEX idx_viajes_vehiculo ON viajes(id_vehiculo);
CREATE INDEX idx_viajes_estado   ON viajes(id_estado);
CREATE INDEX idx_viajes_fecha    ON viajes(fecha_hora_salida);

-- =====================================================================
-- 7. CARGAMENTO_VIAJE (un viaje puede llevar varias cargas)
-- =====================================================================

CREATE TABLE cargamento_viaje (
    id_cargamento       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_viaje             UUID NOT NULL REFERENCES viajes(id_viaje) ON DELETE CASCADE,
    id_carga             UUID NOT NULL REFERENCES cargas(id_carga),

    cantidad_inicial     NUMERIC(12,2) NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_destino     NUMERIC(12,2) CHECK (cantidad_destino IS NULL OR cantidad_destino > 0),

    observaciones         TEXT,
    creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (id_viaje, id_carga)
);
COMMENT ON COLUMN cargamento_viaje.cantidad_inicial IS 'Cantidad cargada en origen (obligatoria siempre)';
COMMENT ON COLUMN cargamento_viaje.cantidad_destino  IS 'Cantidad recibida en destino (obligatoria al finalizar el viaje)';

CREATE INDEX idx_cargamento_viaje ON cargamento_viaje(id_viaje);

-- =====================================================================
-- 8. COMBUSTIBLE  (no estaba en el Excel; pedido en el Word)
-- =====================================================================

CREATE TABLE combustible (
    id_combustible       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_vehiculo           UUID NOT NULL REFERENCES vehiculos(id_vehiculo),
    id_viaje               UUID REFERENCES viajes(id_viaje),   -- opcional: carga asociada a un viaje puntual
    id_lugar                UUID REFERENCES lugares(id_lugar), -- dónde se cargó combustible

    fecha                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    litros                   NUMERIC(10,2) NOT NULL CHECK (litros > 0),
    costo_total               NUMERIC(12,2) CHECK (costo_total IS NULL OR costo_total >= 0),
    odometro                   INTEGER CHECK (odometro IS NULL OR odometro >= 0),

    usuario_registro_id         UUID REFERENCES usuarios(id_usuario),
    observaciones                 TEXT,

    client_uuid                   UUID UNIQUE,
    device_id                       TEXT,
    sync_status                     TEXT NOT NULL DEFAULT 'sincronizado'
                                        CHECK (sync_status IN ('pendiente','sincronizado','conflicto')),

    creado_en                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_combustible_vehiculo ON combustible(id_vehiculo);
CREATE INDEX idx_combustible_viaje    ON combustible(id_viaje);

-- =====================================================================
-- 9. PEAJES  (no estaba en el Excel; pedido en el Word)
-- =====================================================================

CREATE TABLE peajes (
    id_peaje               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_viaje                 UUID NOT NULL REFERENCES viajes(id_viaje) ON DELETE CASCADE,
    id_lugar                   UUID REFERENCES lugares(id_lugar),

    fecha                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    monto                         NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    comprobante                     TEXT,   -- nro. de ticket / referencia de foto

    usuario_registro_id               UUID REFERENCES usuarios(id_usuario),
    observaciones                       TEXT,

    client_uuid                           UUID UNIQUE,
    device_id                               TEXT,
    sync_status                             TEXT NOT NULL DEFAULT 'sincronizado'
                                                CHECK (sync_status IN ('pendiente','sincronizado','conflicto')),

    creado_en                                TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en                             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_peajes_viaje ON peajes(id_viaje);

-- =====================================================================
-- 10. AUDITORÍA DE EDICIONES
--     "Un administrador podrá modificar viajes ya finalizados para
--      corregir errores de carga o de registro" — se deja rastro.
-- =====================================================================

CREATE TABLE auditoria_viajes (
    id_auditoria     BIGSERIAL PRIMARY KEY,
    id_viaje          UUID NOT NULL REFERENCES viajes(id_viaje) ON DELETE CASCADE,
    id_usuario         UUID REFERENCES usuarios(id_usuario),
    campo                TEXT NOT NULL,
    valor_anterior         TEXT,
    valor_nuevo              TEXT,
    fecha                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 11. TRIGGERS
-- =====================================================================

-- 11.1 actualizado_en automático en cada UPDATE
CREATE OR REPLACE FUNCTION mareuba.fn_touch_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = mareuba, public;

CREATE TRIGGER trg_touch_usuarios   BEFORE UPDATE ON usuarios   FOR EACH ROW EXECUTE FUNCTION fn_touch_actualizado_en();
CREATE TRIGGER trg_touch_vehiculos  BEFORE UPDATE ON vehiculos  FOR EACH ROW EXECUTE FUNCTION fn_touch_actualizado_en();
CREATE TRIGGER trg_touch_cargas     BEFORE UPDATE ON cargas     FOR EACH ROW EXECUTE FUNCTION fn_touch_actualizado_en();
CREATE TRIGGER trg_touch_lugares    BEFORE UPDATE ON lugares    FOR EACH ROW EXECUTE FUNCTION fn_touch_actualizado_en();
CREATE TRIGGER trg_touch_viajes     BEFORE UPDATE ON viajes     FOR EACH ROW EXECUTE FUNCTION fn_touch_actualizado_en();
CREATE TRIGGER trg_touch_cargamento BEFORE UPDATE ON cargamento_viaje FOR EACH ROW EXECUTE FUNCTION fn_touch_actualizado_en();
CREATE TRIGGER trg_touch_combustible BEFORE UPDATE ON combustible FOR EACH ROW EXECUTE FUNCTION fn_touch_actualizado_en();
CREATE TRIGGER trg_touch_peajes     BEFORE UPDATE ON peajes     FOR EACH ROW EXECUTE FUNCTION fn_touch_actualizado_en();

-- 11.2 Al finalizar un viaje (EST_CURSO -> EST_FIN), TODAS sus cargas
--      deben tener cantidad_destino cargada. Regla de negocio del Word:
--      "la cantidad inicial y la cantidad en destino deben ser datos
--      obligatorios en todos los viajes" (obligatoria recién al cierre).
CREATE OR REPLACE FUNCTION mareuba.fn_validar_cierre_viaje()
RETURNS TRIGGER AS $$
DECLARE
    pendientes INTEGER;
BEGIN
    IF NEW.id_estado = 'EST_FIN' AND (OLD.id_estado IS DISTINCT FROM 'EST_FIN') THEN
        SELECT count(*) INTO pendientes
        FROM cargamento_viaje
        WHERE id_viaje = NEW.id_viaje AND cantidad_destino IS NULL;

        IF pendientes > 0 THEN
            RAISE EXCEPTION 'No se puede finalizar el viaje %: hay % carga(s) sin cantidad en destino', NEW.numero_viaje, pendientes;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = mareuba, public;

CREATE TRIGGER trg_validar_cierre_viaje
    BEFORE UPDATE ON viajes
    FOR EACH ROW EXECUTE FUNCTION fn_validar_cierre_viaje();

-- 11.3 Registrar en auditoria_viajes cualquier cambio a un viaje que
--      ya estaba finalizado (edición administrativa posterior).
CREATE OR REPLACE FUNCTION mareuba.fn_auditar_edicion_viaje()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id_estado = 'EST_FIN' THEN
        IF NEW.id_destino IS DISTINCT FROM OLD.id_destino THEN
            INSERT INTO auditoria_viajes(id_viaje, id_usuario, campo, valor_anterior, valor_nuevo)
            VALUES (NEW.id_viaje, NEW.actualizado_por, 'id_destino', OLD.id_destino::TEXT, NEW.id_destino::TEXT);
        END IF;
        IF NEW.odometro_final IS DISTINCT FROM OLD.odometro_final THEN
            INSERT INTO auditoria_viajes(id_viaje, id_usuario, campo, valor_anterior, valor_nuevo)
            VALUES (NEW.id_viaje, NEW.actualizado_por, 'odometro_final', OLD.odometro_final::TEXT, NEW.odometro_final::TEXT);
        END IF;
        IF NEW.odometro_inicial IS DISTINCT FROM OLD.odometro_inicial THEN
            INSERT INTO auditoria_viajes(id_viaje, id_usuario, campo, valor_anterior, valor_nuevo)
            VALUES (NEW.id_viaje, NEW.actualizado_por, 'odometro_inicial', OLD.odometro_inicial::TEXT, NEW.odometro_inicial::TEXT);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = mareuba, public;

CREATE TRIGGER trg_auditar_edicion_viaje
    AFTER UPDATE ON viajes
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_edicion_viaje();

-- =====================================================================
-- 12. VISTAS PARA EL PANEL GERENCIAL (KPIs)
-- =====================================================================

CREATE OR REPLACE VIEW vw_viajes_detalle AS
SELECT
    v.id_viaje,
    v.numero_viaje,
    v.fecha_hora_salida,
    v.fecha_hora_llegada,
    u.nombre || ' ' || u.apellido AS chofer,
    veh.patente,
    veh.nombre_vehiculo,
    lo.nombre_lugar  AS origen,
    ld.nombre_lugar  AS destino,
    v.odometro_inicial,
    v.odometro_final,
    v.km_recorridos,
    e.nombre_estado  AS estado,
    v.observaciones
FROM viajes v
JOIN usuarios u   ON u.id_usuario  = v.id_chofer
JOIN vehiculos veh ON veh.id_vehiculo = v.id_vehiculo
JOIN lugares lo   ON lo.id_lugar   = v.id_origen
JOIN lugares ld   ON ld.id_lugar   = v.id_destino
JOIN estados_viaje e ON e.id_estado = v.id_estado;

CREATE OR REPLACE VIEW vw_kpi_chofer_mensual AS
SELECT
    u.id_usuario,
    u.nombre || ' ' || u.apellido AS chofer,
    date_trunc('month', v.fecha_hora_salida) AS mes,
    count(*)                     AS cantidad_viajes,
    sum(v.km_recorridos)         AS km_totales,
    sum(v.km_recorridos) FILTER (WHERE v.id_estado = 'EST_FIN') AS km_facturables
FROM viajes v
JOIN usuarios u ON u.id_usuario = v.id_chofer
GROUP BY u.id_usuario, chofer, mes;

CREATE OR REPLACE VIEW vw_kpi_combustible_vehiculo AS
SELECT
    veh.id_vehiculo,
    veh.patente,
    date_trunc('month', c.fecha) AS mes,
    sum(c.litros)      AS litros_totales,
    sum(c.costo_total) AS costo_total
FROM combustible c
JOIN vehiculos veh ON veh.id_vehiculo = c.id_vehiculo
GROUP BY veh.id_vehiculo, veh.patente, mes;

COMMIT;

-- =====================================================================
-- FIN DEL DDL. Los datos de ejemplo (seed) están en mareuba_seed.sql
-- =====================================================================
