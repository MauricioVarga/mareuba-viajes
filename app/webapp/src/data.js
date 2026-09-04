import { supabase } from "./supabaseClient";
import { guardarCache, leerCache, agregarACola, leerCola, quitarDeCola, estaOnline, esErrorDeRed } from "./offline";

/* -----------------------------------------------------------------------
   CÓMO FUNCIONA EL MODO OFFLINE
   ---------------------------------------------------------------------
   Cada acción de escritura del chofer (iniciar viaje, finalizar viaje,
   crear un lugar) sigue el mismo patrón:

   1. Se generan en el propio celular los IDs (UUID) que va a tener el
      registro nuevo — no se le piden a Supabase. Esto es clave: permite
      que el viaje "exista" del lado del chofer aunque el INSERT real
      todavía no haya viajado a la base.
   2. Si hay conexión, se intenta mandar a Supabase de una. Si funciona,
      listo.
   3. Si NO hay conexión (o el intento falla por un error de red), la
      acción se guarda en una cola local y se aplica "en optimista"
      sobre los datos en caché, para que la pantalla del chofer se
      actualice como si ya hubiera funcionado.
   4. Cuando vuelve la señal, se recorre la cola y se reintenta cada
      acción contra Supabase, en el mismo orden en que se crearon.

   Nota importante: NO filtramos manualmente "dónde id_chofer = usuario
   actual" en las lecturas — eso lo hace RLS en el backend. El frontend
   confía en la base, no reimplementa la regla de seguridad.
----------------------------------------------------------------------- */

const uid = () => crypto.randomUUID();

async function usuarioIdActual() {
  // getSession() lee la sesión guardada en el dispositivo, sin red.
  // (auth.getUser() sí golpea la red para revalidar el token, y eso
  // rompería todo el modo offline si lo usáramos acá.)
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/* ------------------------------- LECTURAS ------------------------------ */

export async function getUsuarioActual() {
  const userId = await usuarioIdActual();
  if (!userId) return null;

  if (!estaOnline()) {
    const cache = await leerCache("usuario_actual");
    if (cache) return cache;
  }
  try {
    const { data, error } = await supabase.from("usuarios").select("*").eq("id_usuario", userId).single();
    if (error) throw error;
    await guardarCache("usuario_actual", data);
    return data;
  } catch (e) {
    if (esErrorDeRed(e)) {
      const cache = await leerCache("usuario_actual");
      if (cache) return cache;
    }
    throw e;
  }
}

export async function getCatalogos() {
  if (!estaOnline()) {
    const cache = await leerCache("catalogos");
    if (cache) return cache;
    throw new Error("Sin conexión y todavía no hay datos guardados en este dispositivo. Conectate una vez para descargarlos.");
  }
  try {
    const [vehiculos, cargas, lugares, tiposVehiculo, tiposCarga, unidades, metodosMedicion, tiposLugar] = await Promise.all([
      supabase.from("vehiculos").select("*").order("nombre_vehiculo"),
      supabase.from("cargas").select("*").order("nombre_carga"),
      supabase.from("lugares").select("*").order("nombre_lugar"),
      supabase.from("tipos_vehiculo").select("*"),
      supabase.from("tipos_carga").select("*"),
      supabase.from("unidades").select("*"),
      supabase.from("metodos_medicion").select("*"),
      supabase.from("tipos_lugar").select("*"),
    ]);
    for (const r of [vehiculos, cargas, lugares, tiposVehiculo, tiposCarga, unidades, metodosMedicion, tiposLugar]) {
      if (r.error) throw r.error;
    }
    const resultado = {
      vehiculos: vehiculos.data,
      cargas: cargas.data,
      lugares: lugares.data,
      tiposVehiculo: tiposVehiculo.data,
      tiposCarga: tiposCarga.data,
      unidades: unidades.data,
      metodosMedicion: metodosMedicion.data,
      tiposLugar: tiposLugar.data,
    };
    await guardarCache("catalogos", resultado);
    return resultado;
  } catch (e) {
    if (esErrorDeRed(e)) {
      const cache = await leerCache("catalogos");
      if (cache) return cache;
    }
    throw e;
  }
}

export async function getUsuarios() {
  const { data, error } = await supabase.from("usuarios").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function getViajes() {
  if (!estaOnline()) {
    const cache = await leerCache("viajes");
    if (cache) return cache;
    return [];
  }
  try {
    const { data, error } = await supabase.from("viajes").select("*").order("fecha_hora_salida", { ascending: false });
    if (error) throw error;
    await guardarCache("viajes", data);
    return data;
  } catch (e) {
    if (esErrorDeRed(e)) {
      const cache = await leerCache("viajes");
      if (cache) return cache;
    }
    throw e;
  }
}

export async function getCargamentos() {
  if (!estaOnline()) {
    const cache = await leerCache("cargamentos");
    if (cache) return cache;
    return [];
  }
  try {
    const { data, error } = await supabase.from("cargamento_viaje").select("*");
    if (error) throw error;
    await guardarCache("cargamentos", data);
    return data;
  } catch (e) {
    if (esErrorDeRed(e)) {
      const cache = await leerCache("cargamentos");
      if (cache) return cache;
    }
    throw e;
  }
}

export async function getKpiChoferMensual() {
  const { data, error } = await supabase.from("vw_kpi_chofer_mensual").select("*");
  if (error) throw error;
  return data;
}

/* ------------------------- ESCRITURAS (con cola offline) --------------- */

// --- crear lugar ---------------------------------------------------------

async function ejecutarCrearLugar({ id_lugar, nombre_lugar, id_tipo_lugar, ubicacion }) {
  const { error } = await supabase.from("lugares").insert({ id_lugar, nombre_lugar, id_tipo_lugar, ubicacion });
  if (error) throw error;
}

export async function crearLugar({ nombre_lugar, id_tipo_lugar = null, ubicacion = "" }) {
  const payload = { id_lugar: uid(), nombre_lugar, id_tipo_lugar, ubicacion };

  if (estaOnline()) {
    try {
      await ejecutarCrearLugar(payload);
      return { id_lugar: payload.id_lugar };
    } catch (e) {
      if (!esErrorDeRed(e)) throw e;
    }
  }
  await agregarACola({ tipo: "CREAR_LUGAR", payload });
  await aplicarLugarEnCache(payload);
  return { id_lugar: payload.id_lugar, pendienteDeSync: true };
}

async function aplicarLugarEnCache(payload) {
  const catalogos = await leerCache("catalogos");
  if (!catalogos) return;
  const nuevo = { id_lugar: payload.id_lugar, nombre_lugar: payload.nombre_lugar, id_tipo_lugar: payload.id_tipo_lugar, ubicacion: payload.ubicacion, activo: true };
  await guardarCache("catalogos", { ...catalogos, lugares: [...catalogos.lugares, nuevo] });
}

// --- iniciar viaje ---------------------------------------------------------

async function ejecutarIniciarViaje({ id_viaje, id_chofer, id_vehiculo, id_origen, id_destino, odometro_inicial, fecha_hora_salida, cargas, observaciones }) {
  const { error: errViaje } = await supabase
    .from("viajes")
    .insert({ id_viaje, id_chofer, id_vehiculo, id_origen, id_destino, odometro_inicial, fecha_hora_salida, observaciones });
  if (errViaje) throw errViaje;

  const filas = cargas.map((c) => ({ id_cargamento: c.id_cargamento, id_viaje, id_carga: c.id_carga, cantidad_inicial: c.cantidad_inicial }));
  const { error: errCargas } = await supabase.from("cargamento_viaje").insert(filas);
  if (errCargas) throw errCargas;
}

export async function iniciarViaje({ id_vehiculo, id_origen, id_destino, odometro_inicial, cargas, observaciones = "" }) {
  const id_chofer = await usuarioIdActual();
  const payload = {
    id_viaje: uid(),
    id_chofer,
    id_vehiculo,
    id_origen,
    id_destino,
    odometro_inicial,
    fecha_hora_salida: new Date().toISOString(),
    observaciones,
    cargas: cargas.map((c) => ({ id_cargamento: uid(), id_carga: c.id_carga, cantidad_inicial: c.cantidad_inicial })),
  };

  if (estaOnline()) {
    try {
      await ejecutarIniciarViaje(payload);
      return { id_viaje: payload.id_viaje };
    } catch (e) {
      if (!esErrorDeRed(e)) throw e;
    }
  }
  await agregarACola({ tipo: "INICIAR_VIAJE", payload });
  await aplicarViajeEnCache(payload);
  return { id_viaje: payload.id_viaje, pendienteDeSync: true };
}

async function aplicarViajeEnCache({ id_viaje, id_chofer, id_vehiculo, id_origen, id_destino, odometro_inicial, fecha_hora_salida, cargas, observaciones }) {
  const viajes = (await leerCache("viajes")) || [];
  const nuevoViaje = {
    id_viaje, numero_viaje: null, id_chofer, id_vehiculo, id_origen, id_destino,
    fecha_hora_salida, fecha_hora_llegada: null, odometro_inicial, odometro_final: null,
    id_estado: "EST_CURSO", observaciones,
  };
  await guardarCache("viajes", [nuevoViaje, ...viajes]);

  const cargamentos = (await leerCache("cargamentos")) || [];
  const nuevosCargamentos = cargas.map((c) => ({
    id_cargamento: c.id_cargamento, id_viaje, id_carga: c.id_carga, cantidad_inicial: c.cantidad_inicial, cantidad_destino: null,
  }));
  await guardarCache("cargamentos", [...cargamentos, ...nuevosCargamentos]);
}

// --- finalizar viaje ---------------------------------------------------------

async function ejecutarFinalizarViaje({ id_viaje, id_destino, odometro_final, cantidadesPorCargamento, litrosCombustible, montoPeaje, id_vehiculo, usuario_cierre_id, id_combustible, id_peaje, observaciones }) {
  for (const [id_cargamento, cantidad_destino] of Object.entries(cantidadesPorCargamento)) {
    const { error } = await supabase.from("cargamento_viaje").update({ cantidad_destino: Number(cantidad_destino) }).eq("id_cargamento", id_cargamento);
    if (error) throw error;
  }

  const { error: errViaje } = await supabase
    .from("viajes")
    .update({
      id_destino,
      odometro_final: Number(odometro_final),
      fecha_hora_llegada: new Date().toISOString(),
      id_estado: "EST_FIN",
      usuario_cierre_id,
      observaciones,
    })
    .eq("id_viaje", id_viaje);
  if (errViaje) throw errViaje;

  if (litrosCombustible && Number(litrosCombustible) > 0) {
    const { error } = await supabase
      .from("combustible")
      .insert({ id_combustible, id_vehiculo, id_viaje, litros: Number(litrosCombustible), usuario_registro_id: usuario_cierre_id });
    if (error) throw error;
  }
  if (montoPeaje && Number(montoPeaje) > 0) {
    const { error } = await supabase.from("peajes").insert({ id_peaje, id_viaje, monto: Number(montoPeaje), usuario_registro_id: usuario_cierre_id });
    if (error) throw error;
  }
}

export async function finalizarViaje({ id_viaje, id_destino, odometro_final, cantidadesPorCargamento, litrosCombustible, montoPeaje, id_vehiculo, observaciones = "" }) {
  const usuario_cierre_id = await usuarioIdActual();
  const payload = {
    id_viaje, id_destino, odometro_final, cantidadesPorCargamento, litrosCombustible, montoPeaje, id_vehiculo, observaciones,
    usuario_cierre_id, id_combustible: uid(), id_peaje: uid(),
  };

  if (estaOnline()) {
    try {
      await ejecutarFinalizarViaje(payload);
      return;
    } catch (e) {
      if (!esErrorDeRed(e)) throw e;
    }
  }
  await agregarACola({ tipo: "FINALIZAR_VIAJE", payload });
  await aplicarFinalizacionEnCache(payload);
}

async function aplicarFinalizacionEnCache({ id_viaje, id_destino, odometro_final, cantidadesPorCargamento, usuario_cierre_id, observaciones }) {
  const viajes = (await leerCache("viajes")) || [];
  const nuevos = viajes.map((v) =>
    v.id_viaje === id_viaje
      ? { ...v, id_destino, odometro_final: Number(odometro_final), fecha_hora_llegada: new Date().toISOString(), id_estado: "EST_FIN", usuario_cierre_id, observaciones }
      : v
  );
  await guardarCache("viajes", nuevos);

  const cargamentos = (await leerCache("cargamentos")) || [];
  const nuevosCargamentos = cargamentos.map((c) =>
    c.id_viaje === id_viaje && cantidadesPorCargamento[c.id_cargamento] != null
      ? { ...c, cantidad_destino: Number(cantidadesPorCargamento[c.id_cargamento]) }
      : c
  );
  await guardarCache("cargamentos", nuevosCargamentos);
}

/* ------------------------- ESCRITURAS de administración -----------------
   Estas asumen que el administrativo trabaja con conexión (oficina), así
   que no pasan por la cola offline — si falla la red, se les avisa y
   listo, no queda un cambio "fantasma" en un panel que nadie chequea
   seguido.
--------------------------------------------------------------------------- */

export async function corregirViaje({ id_viaje, id_destino, odometro_final, observaciones }) {
  const userId = await usuarioIdActual();
  const { error } = await supabase
    .from("viajes")
    .update({ id_destino, odometro_final: Number(odometro_final), actualizado_por: userId, observaciones })
    .eq("id_viaje", id_viaje);
  if (error) throw error;
}

export async function crearCatalogo(tabla, valores) {
  const { data, error } = await supabase.from(tabla).insert(valores).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarCatalogo(tabla, pk, id, valores) {
  const { error } = await supabase.from(tabla).update(valores).eq(pk, id);
  if (error) throw error;
}

export async function eliminarCatalogo(tabla, pk, id) {
  const { error } = await supabase.from(tabla).delete().eq(pk, id);
  if (error) throw error;
}

export async function actualizarRolUsuario(id_usuario, id_rol) {
  const { error } = await supabase.from("usuarios").update({ id_rol }).eq("id_usuario", id_usuario);
  if (error) throw error;
}

/* ------------------------------ SINCRONIZACIÓN --------------------------- */

async function ejecutarAccion(accion) {
  switch (accion.tipo) {
    case "CREAR_LUGAR": return ejecutarCrearLugar(accion.payload);
    case "INICIAR_VIAJE": return ejecutarIniciarViaje(accion.payload);
    case "FINALIZAR_VIAJE": return ejecutarFinalizarViaje(accion.payload);
    default: throw new Error("Acción de sincronización desconocida: " + accion.tipo);
  }
}

export async function cantidadPendienteDeSync() {
  const cola = await leerCola();
  return cola.length;
}

// Recorre la cola en orden y reintenta cada acción. Si una falla (por
// ejemplo, todavía sin señal), se corta ahí: no tiene sentido intentar
// "finalizar viaje" antes de que su "iniciar viaje" haya llegado.
export async function sincronizarCola() {
  const cola = await leerCola();
  let sincronizados = 0;
  for (const accion of cola) {
    try {
      await ejecutarAccion(accion);
      await quitarDeCola(accion.id);
      sincronizados++;
    } catch (e) {
      if (esErrorDeRed(e)) break; // seguimos sin señal, reintentar más tarde
      // Error real (ej: datos inválidos): no la sacamos de la cola para
      // no perderla, pero tampoco insistimos con las siguientes ahora.
      break;
    }
  }
  return { sincronizados, pendientes: (await leerCola()).length };
}
