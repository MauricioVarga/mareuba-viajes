-- =====================================================================
--  MAREUBA · Row Level Security para Supabase
--  Ejecutar DESPUÉS de mareuba_schema.sql (y opcionalmente mareuba_seed.sql)
--  en el SQL Editor de tu proyecto de Supabase.
-- =====================================================================
--
--  Reglas de negocio que implementan estas políticas:
--   - Un chofer (ROL_OP) solo ve y crea SUS PROPIOS viajes (y lo que
--     cuelga de ellos: cargas, combustible, peajes).
--   - Un administrativo (ROL_ADM) ve y edita todo, incluidos viajes ya
--     finalizados (para corregir errores).
--   - Un gerente (ROL_GEREN) ve todo, pero no puede editar ni crear nada
--     (panel de solo lectura).
--   - Los catálogos (vehículos, cargas, tipos, etc.) los puede LEER
--     cualquier usuario logueado; solo el administrativo los edita.
--   - Los lugares son la excepción: cualquier chofer puede crear uno
--     nuevo (lo pide el Word: "la app debe permitir registrar nuevos
--     lugares durante la carga o finalización del viaje").
-- =====================================================================

SET search_path TO mareuba, public;

-- ---------------------------------------------------------------------
-- Función auxiliar: rol del usuario logueado.
-- SECURITY DEFINER es clave acá: si no, cada policy que la use dispararía
-- de nuevo el chequeo de RLS sobre la tabla usuarios al consultarla,
-- generando una recursión. Con SECURITY DEFINER la consulta interna
-- corre saltando RLS, una sola vez.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mareuba.rol_actual()
RETURNS TEXT AS $$
    SELECT id_rol FROM mareuba.usuarios WHERE id_usuario = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = mareuba, public;

-- ---------------------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------------------
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuarios_select ON usuarios FOR SELECT TO authenticated
    USING (id_usuario = auth.uid() OR mareuba.rol_actual() IN ('ROL_ADM', 'ROL_GEREN'));

CREATE POLICY usuarios_update_admin ON usuarios FOR UPDATE TO authenticated
    USING (mareuba.rol_actual() = 'ROL_ADM')
    WITH CHECK (mareuba.rol_actual() = 'ROL_ADM');
-- No hace falta policy de INSERT: las filas se crean solas por el
-- trigger trg_provisionar_usuario (SECURITY DEFINER, salta RLS).

-- ---------------------------------------------------------------------
-- CATÁLOGOS: roles, estados_viaje, tipos_vehiculo, tipos_carga,
-- unidades, metodos_medicion, tipos_lugar
-- Lectura para cualquier usuario logueado; sin políticas de escritura
-- (se administran desde el SQL Editor / futuro panel admin con rol
-- de servicio, no desde la app).
-- ---------------------------------------------------------------------
ALTER TABLE roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_viaje      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_vehiculo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_carga        ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades           ENABLE ROW LEVEL SECURITY;
ALTER TABLE metodos_medicion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_lugar        ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogo_select ON roles            FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_select ON estados_viaje     FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_select ON tipos_vehiculo    FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_select ON tipos_carga       FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_select ON unidades          FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_select ON metodos_medicion  FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_select ON tipos_lugar       FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------
-- VEHÍCULOS y CARGAS: lectura para todos, escritura solo administrativo
-- ---------------------------------------------------------------------
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargas    ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehiculos_select ON vehiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY vehiculos_write  ON vehiculos FOR ALL TO authenticated
    USING (mareuba.rol_actual() = 'ROL_ADM')
    WITH CHECK (mareuba.rol_actual() = 'ROL_ADM');

CREATE POLICY cargas_select ON cargas FOR SELECT TO authenticated USING (true);
CREATE POLICY cargas_write  ON cargas FOR ALL TO authenticated
    USING (mareuba.rol_actual() = 'ROL_ADM')
    WITH CHECK (mareuba.rol_actual() = 'ROL_ADM');

-- ---------------------------------------------------------------------
-- LUGARES: lectura para todos; creación para cualquier usuario logueado
-- (un chofer puede dar de alta un lugar nuevo); edición solo admin.
-- ---------------------------------------------------------------------
ALTER TABLE lugares ENABLE ROW LEVEL SECURITY;

CREATE POLICY lugares_select ON lugares FOR SELECT TO authenticated USING (true);
CREATE POLICY lugares_insert ON lugares FOR INSERT TO authenticated
    WITH CHECK (true);
CREATE POLICY lugares_update ON lugares FOR UPDATE TO authenticated
    USING (mareuba.rol_actual() = 'ROL_ADM')
    WITH CHECK (mareuba.rol_actual() = 'ROL_ADM');

-- ---------------------------------------------------------------------
-- VIAJES: el corazón del sistema.
-- ---------------------------------------------------------------------
ALTER TABLE viajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY viajes_select ON viajes FOR SELECT TO authenticated
    USING (id_chofer = auth.uid() OR mareuba.rol_actual() IN ('ROL_ADM', 'ROL_GEREN'));

CREATE POLICY viajes_insert ON viajes FOR INSERT TO authenticated
    WITH CHECK (id_chofer = auth.uid());
    -- un chofer solo puede crear viajes a su propio nombre

CREATE POLICY viajes_update ON viajes FOR UPDATE TO authenticated
    USING (
        (id_chofer = auth.uid() AND id_estado = 'EST_CURSO')  -- chofer cierra su viaje en curso
        OR mareuba.rol_actual() = 'ROL_ADM'                    -- admin corrige cualquiera
    )
    WITH CHECK (
        id_chofer = auth.uid() OR mareuba.rol_actual() = 'ROL_ADM'
    );

-- ---------------------------------------------------------------------
-- CARGAMENTO_VIAJE, COMBUSTIBLE, PEAJES: dependen del viaje al que
-- pertenecen. Se resuelve el permiso mirando el viaje padre.
-- ---------------------------------------------------------------------
ALTER TABLE cargamento_viaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE combustible      ENABLE ROW LEVEL SECURITY;
ALTER TABLE peajes           ENABLE ROW LEVEL SECURITY;

CREATE POLICY cargamento_select ON cargamento_viaje FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM viajes v WHERE v.id_viaje = cargamento_viaje.id_viaje
        AND (v.id_chofer = auth.uid() OR mareuba.rol_actual() IN ('ROL_ADM', 'ROL_GEREN'))
    ));
CREATE POLICY cargamento_write ON cargamento_viaje FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM viajes v WHERE v.id_viaje = cargamento_viaje.id_viaje
        AND (v.id_chofer = auth.uid() OR mareuba.rol_actual() = 'ROL_ADM')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM viajes v WHERE v.id_viaje = cargamento_viaje.id_viaje
        AND (v.id_chofer = auth.uid() OR mareuba.rol_actual() = 'ROL_ADM')
    ));

CREATE POLICY combustible_select ON combustible FOR SELECT TO authenticated
    USING (
        usuario_registro_id = auth.uid() OR mareuba.rol_actual() IN ('ROL_ADM', 'ROL_GEREN')
    );
CREATE POLICY combustible_write ON combustible FOR INSERT TO authenticated
    WITH CHECK (usuario_registro_id = auth.uid());

CREATE POLICY peajes_select ON peajes FOR SELECT TO authenticated
    USING (
        usuario_registro_id = auth.uid() OR mareuba.rol_actual() IN ('ROL_ADM', 'ROL_GEREN')
    );
CREATE POLICY peajes_write ON peajes FOR INSERT TO authenticated
    WITH CHECK (usuario_registro_id = auth.uid());

-- ---------------------------------------------------------------------
-- AUDITORIA_VIAJES: solo lectura para admin y gerencia. Las filas se
-- generan solas desde el trigger de auditoría (SECURITY DEFINER).
-- ---------------------------------------------------------------------
ALTER TABLE auditoria_viajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY auditoria_select ON auditoria_viajes FOR SELECT TO authenticated
    USING (mareuba.rol_actual() IN ('ROL_ADM', 'ROL_GEREN'));

-- =====================================================================
-- FIN. Después de correr esto: Authentication → Users → Invite user
-- para crear las primeras cuentas reales (empezá por la tuya como
-- ROL_ADM, ver instrucciones en el README).
-- =====================================================================
