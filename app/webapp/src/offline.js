import { get, set } from "idb-keyval";

/* -----------------------------------------------------------------------
   Todo lo que necesita la app para funcionar SIN conexión vive acá:
   - una "caché" con la última foto conocida de los datos (catálogos,
     viajes, cargamentos), para poder mostrar algo aunque no haya red.
   - una "cola" de acciones que el chofer hizo sin conexión y todavía no
     llegaron a Supabase.
   Se guarda con IndexedDB (a través de idb-keyval), que a diferencia de
   la memoria de React sobrevive a que se cierre la app o el navegador.
----------------------------------------------------------------------- */

const CACHE_PREFIX = "mareuba:cache:";
const QUEUE_KEY = "mareuba:cola-pendientes";

export async function guardarCache(clave, valor) {
  await set(CACHE_PREFIX + clave, valor);
}

export async function leerCache(clave) {
  const v = await get(CACHE_PREFIX + clave);
  return v ?? null;
}

export async function leerCola() {
  const v = await get(QUEUE_KEY);
  return v ?? [];
}

export async function agregarACola(accion) {
  const cola = await leerCola();
  const nueva = [...cola, { ...accion, id: accion.id || crypto.randomUUID(), creado_en: new Date().toISOString() }];
  await set(QUEUE_KEY, nueva);
  return nueva;
}

export async function quitarDeCola(idAccion) {
  const cola = await leerCola();
  const nueva = cola.filter((a) => a.id !== idAccion);
  await set(QUEUE_KEY, nueva);
  return nueva;
}

export function estaOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// Heurística para distinguir "no hay internet" de un error real (por
// ejemplo, una validación que rechaza la base). fetch() del navegador
// tira TypeError cuando no hay red; Supabase deja ese mismo tipo de
// mensaje al propagar el error.
export function esErrorDeRed(error) {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed") || error.name === "TypeError";
}
