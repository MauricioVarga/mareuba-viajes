-- =====================================================================
--  MAREUBA · Datos de ejemplo (seed)
--  Carga los mismos registros que ya tenías en
--  Viajes_Mareuba_Base_Datos_V5.xlsx, adaptados a las nuevas PK UUID.
--  Ejecutar DESPUÉS de mareuba_schema.sql
-- =====================================================================

SET search_path TO mareuba, public;

BEGIN;

-- --- USUARIOS -----------------------------------------------------
INSERT INTO usuarios (email, nombre, apellido, id_rol, activo) VALUES
    ('mvarga@ubp.edu.ar', 'Mauricio', 'Varga', 'ROL_ADM', TRUE);

-- --- VEHÍCULOS ------------------------------------------------------
INSERT INTO vehiculos (patente, nombre_vehiculo, id_tipo_vehiculo, marca, modelo, anio, activo) VALUES
    ('AE517OT', 'Scania P320 2020', 'TV_CAM', 'Scania', 'P320 6X4', 2020, TRUE),
    ('AD209PL', 'Scania P360 2022', 'TV_CAM', 'Scania', 'P360 6X4', 2022, TRUE);

-- --- CARGAS -----------------------------------------------------------
INSERT INTO cargas (codigo, nombre_carga, id_tipo_carga, id_unidad, id_metodo_medicion, activo) VALUES
    ('GR_MZ',  'Grano de Maiz', 'TC_GRA', 'UN_KG', 'MM_PES', TRUE),
    ('GR_SJ',  'Grano de Soja', 'TC_GRA', 'UN_KG', 'MM_PES', TRUE),
    ('MOL_MZ', 'Maiz Molido',   'TC_ALI', 'UN_KG', 'MM_PES', TRUE);
    -- Nota: en la planilla original MOL_MZ figuraba como "Pesaje" en la
    -- hoja CARGA pero como "Bascula" en CARGAMENTO_VIAJE (inconsistencia
    -- marcada en la hoja "Planificacion"). Se normalizó a MM_PES.

-- --- LUGARES ------------------------------------------------------------
INSERT INTO lugares (codigo, nombre_lugar, id_tipo_lugar, ubicacion, provincia, pais, activo) VALUES
    ('EL39',       'Campo El 39',      'TL_CAMPO',  'Buena Esperanza', 'San Luis', 'Argentina', TRUE),
    ('Cotagro_RC', 'Cotagro',          'TL_ACOPIO', 'Rio Cuarto',      'Cordoba',  'Argentina', TRUE),
    ('1Tambo',     'Tambo 1',          'TL_TAMBO',  'Las Ensenadas',   'Cordoba',  'Argentina', TRUE),
    ('SILOS_ENS',  'Planta de silos',  'TL_PLANTA', 'Las Ensenadas',   'Cordoba',  'Argentina', TRUE);

-- --- VIAJES (usando subconsultas para resolver los UUID por código) ----
INSERT INTO viajes (
    id_chofer, id_vehiculo, id_origen, id_destino,
    fecha_hora_salida, fecha_hora_llegada,
    odometro_inicial, odometro_final,
    id_estado, usuario_cierre_id, observaciones
) VALUES (
    (SELECT id_usuario FROM usuarios WHERE email = 'mvarga@ubp.edu.ar'),
    (SELECT id_vehiculo FROM vehiculos WHERE patente = 'AE517OT'),
    (SELECT id_lugar FROM lugares WHERE codigo = 'SILOS_ENS'),
    (SELECT id_lugar FROM lugares WHERE codigo = '1Tambo'),
    TIMESTAMPTZ '2026-08-23 17:22:07',
    TIMESTAMPTZ '2026-08-23 18:00:00',
    2425, 2430,
    'EST_FIN',
    (SELECT id_usuario FROM usuarios WHERE email = 'mvarga@ubp.edu.ar'),
    '1er preregistro'
), (
    (SELECT id_usuario FROM usuarios WHERE email = 'mvarga@ubp.edu.ar'),
    (SELECT id_vehiculo FROM vehiculos WHERE patente = 'AE517OT'),
    (SELECT id_lugar FROM lugares WHERE codigo = 'SILOS_ENS'),
    (SELECT id_lugar FROM lugares WHERE codigo = 'Cotagro_RC'),
    TIMESTAMPTZ '2026-08-23 19:00:00',
    TIMESTAMPTZ '2026-08-23 20:26:06',
    2440, 2490,
    'EST_FIN',
    (SELECT id_usuario FROM usuarios WHERE email = 'mvarga@ubp.edu.ar'),
    '2do preregistro'
);

-- --- CARGAMENTO_VIAJE ------------------------------------------------
INSERT INTO cargamento_viaje (id_viaje, id_carga, cantidad_inicial, cantidad_destino)
VALUES
    (
        (SELECT id_viaje FROM viajes WHERE observaciones = '1er preregistro'),
        (SELECT id_carga FROM cargas WHERE codigo = 'MOL_MZ'),
        19000, 19000
    ), (
        (SELECT id_viaje FROM viajes WHERE observaciones = '2do preregistro'),
        (SELECT id_carga FROM cargas WHERE codigo = 'GR_SJ'),
        34500, 34500
    );

COMMIT;

-- Verificación rápida
-- SELECT * FROM vw_viajes_detalle;
