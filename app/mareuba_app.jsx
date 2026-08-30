import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ---------------------------------------------------------------------
   MAREUBA · Prototipo de registro de viajes
   Los datos se guardan con window.storage (persistente, compartido entre
   quienes abran este artifact) para simular un backend real: un chofer
   registra un viaje y el administrador/gerente lo ve al instante.
--------------------------------------------------------------------- */

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
const now = () => new Date().toISOString();

const ROLES = { ROL_ADM: "Administrativo", ROL_OP: "Chofer", ROL_GEREN: "Gerencial" };

const SEED = () => {
  const admin = { id_usuario: uid(), email: "mvarga@ubp.edu.ar", nombre: "Mauricio", apellido: "Varga", id_rol: "ROL_ADM", activo: true };
  const chofer1 = { id_usuario: uid(), email: "jperez@mareuba.com", nombre: "Julián", apellido: "Pérez", id_rol: "ROL_OP", activo: true };
  const chofer2 = { id_usuario: uid(), email: "lgomez@mareuba.com", nombre: "Lucas", apellido: "Gómez", id_rol: "ROL_OP", activo: true };
  const gerente = { id_usuario: uid(), email: "sfernandez@mareuba.com", nombre: "Sofía", apellido: "Fernández", id_rol: "ROL_GEREN", activo: true };

  const veh1 = { id_vehiculo: uid(), patente: "AE517OT", nombre_vehiculo: "Scania P320 2020", id_tipo_vehiculo: "TV_CAM", activo: true };
  const veh2 = { id_vehiculo: uid(), patente: "AD209PL", nombre_vehiculo: "Scania P360 2022", id_tipo_vehiculo: "TV_CAM", activo: true };

  const c1 = { id_carga: uid(), codigo: "GR_MZ", nombre_carga: "Grano de Maíz", id_unidad: "UN_KG", activo: true };
  const c2 = { id_carga: uid(), codigo: "GR_SJ", nombre_carga: "Grano de Soja", id_unidad: "UN_KG", activo: true };
  const c3 = { id_carga: uid(), codigo: "MOL_MZ", nombre_carga: "Maíz Molido", id_unidad: "UN_KG", activo: true };

  const l1 = { id_lugar: uid(), codigo: "EL39", nombre_lugar: "Campo El 39", tipo_lugar: "Campo", ubicacion: "Buena Esperanza, San Luis", activo: true };
  const l2 = { id_lugar: uid(), codigo: "Cotagro_RC", nombre_lugar: "Cotagro", tipo_lugar: "Acopio", ubicacion: "Río Cuarto, Córdoba", activo: true };
  const l3 = { id_lugar: uid(), codigo: "1Tambo", nombre_lugar: "Tambo 1", tipo_lugar: "Tambo", ubicacion: "Las Ensenadas, Córdoba", activo: true };
  const l4 = { id_lugar: uid(), codigo: "SILOS_ENS", nombre_lugar: "Planta de silos", tipo_lugar: "Planta", ubicacion: "Las Ensenadas, Córdoba", activo: true };

  const v1 = {
    id_viaje: uid(), numero_viaje: 1, id_chofer: admin.id_usuario, id_vehiculo: veh1.id_vehiculo,
    id_origen: l4.id_lugar, id_destino: l3.id_lugar,
    fecha_hora_salida: "2026-08-23T17:22:07", fecha_hora_llegada: "2026-08-23T18:00:00",
    odometro_inicial: 2425, odometro_final: 2430, id_estado: "EST_FIN", observaciones: "1er preregistro",
  };
  const v2 = {
    id_viaje: uid(), numero_viaje: 2, id_chofer: admin.id_usuario, id_vehiculo: veh1.id_vehiculo,
    id_origen: l4.id_lugar, id_destino: l2.id_lugar,
    fecha_hora_salida: "2026-08-23T19:00:00", fecha_hora_llegada: "2026-08-23T20:26:06",
    odometro_inicial: 2440, odometro_final: 2490, id_estado: "EST_FIN", observaciones: "2do preregistro",
  };

  const cg1 = { id_cargamento: uid(), id_viaje: v1.id_viaje, id_carga: c3.id_carga, cantidad_inicial: 19000, cantidad_destino: 19000 };
  const cg2 = { id_cargamento: uid(), id_viaje: v2.id_viaje, id_carga: c2.id_carga, cantidad_inicial: 34500, cantidad_destino: 34500 };

  return {
    usuarios: [admin, chofer1, chofer2, gerente],
    vehiculos: [veh1, veh2],
    cargas: [c1, c2, c3],
    lugares: [l1, l2, l3, l4],
    viajes: [v1, v2],
    cargamentos: [cg1, cg2],
    combustible: [],
    peajes: [],
  };
};

const TABLE_KEYS = ["usuarios", "vehiculos", "cargas", "lugares", "viajes", "cargamentos", "combustible", "peajes"];

async function loadAll() {
  const out = {};
  for (const k of TABLE_KEYS) {
    try {
      const r = await window.storage.get(k, true);
      out[k] = r ? JSON.parse(r.value) : null;
    } catch {
      out[k] = null;
    }
  }
  if (!out.usuarios) return SEED();
  return out;
}

async function saveTable(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
  } catch (e) {
    console.error("Error guardando", key, e);
  }
}

/* ------------------------------- UI bits ------------------------------ */

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500";
const btnPrimary = "bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnGhost = "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium px-4 py-2 rounded-md text-sm transition-colors";
const card = "bg-white border border-slate-200 rounded-lg p-5";

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/* ------------------------------ Login screen --------------------------- */

function Login({ usuarios, onLogin }) {
  return (
    <div className="min-h-[500px] flex items-center justify-center bg-slate-900 rounded-lg p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-amber-500 text-2xl font-semibold tracking-tight">Mareuba</div>
          <div className="text-slate-400 text-sm mt-1">Registro de viajes de camiones</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-xs uppercase tracking-wide mb-3 px-1">Elegí tu usuario</div>
          <div className="space-y-2">
            {usuarios.filter(u => u.activo).map(u => (
              <button
                key={u.id_usuario}
                onClick={() => onLogin(u.id_usuario)}
                className="w-full flex items-center justify-between bg-slate-700/60 hover:bg-slate-700 rounded-md px-4 py-3 text-left transition-colors"
              >
                <div>
                  <div className="text-white text-sm font-medium">{u.nombre} {u.apellido}</div>
                  <div className="text-slate-400 text-xs">{u.email}</div>
                </div>
                <span className="text-xs text-amber-400 font-medium">{ROLES[u.id_rol]}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-slate-500 text-xs text-center mt-4">Prototipo — sin contraseña, para probar el flujo</p>
      </div>
    </div>
  );
}

/* ------------------------------ Chofer view ---------------------------- */

function ChoferView({ data, usuario, mutate }) {
  const [mode, setMode] = useState("home"); // home | iniciar | finalizar
  const viajeEnCurso = data.viajes.find(v => v.id_chofer === usuario.id_usuario && v.id_estado === "EST_CURSO");
  const misViajes = data.viajes
    .filter(v => v.id_chofer === usuario.id_usuario && v.id_estado === "EST_FIN")
    .sort((a, b) => new Date(b.fecha_hora_salida) - new Date(a.fecha_hora_salida));

  if (mode === "iniciar") return <IniciarViaje data={data} usuario={usuario} mutate={mutate} onDone={() => setMode("home")} />;
  if (mode === "finalizar" && viajeEnCurso) return <FinalizarViaje data={data} viaje={viajeEnCurso} usuario={usuario} mutate={mutate} onDone={() => setMode("home")} />;

  return (
    <div className="space-y-5">
      {viajeEnCurso ? (
        <div className={card + " border-amber-300 bg-amber-50"}>
          <div className="flex items-center justify-between">
            <div>
              <Badge tone="amber">Viaje en curso</Badge>
              <div className="text-lg font-medium text-slate-800 mt-2">
                {lugarNombre(data, viajeEnCurso.id_origen)} → {lugarNombre(data, viajeEnCurso.id_destino)}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                {vehiculoNombre(data, viajeEnCurso.id_vehiculo)} · odómetro inicial {viajeEnCurso.odometro_inicial.toLocaleString()} km
              </div>
              <div className="text-sm text-slate-500">Salida: {fmtFecha(viajeEnCurso.fecha_hora_salida)}</div>
            </div>
            <button className={btnPrimary} onClick={() => setMode("finalizar")}>Finalizar viaje</button>
          </div>
        </div>
      ) : (
        <div className={card + " text-center py-10"}>
          <div className="text-slate-500 text-sm mb-4">No tenés ningún viaje en curso</div>
          <button className={btnPrimary} onClick={() => setMode("iniciar")}>Iniciar viaje</button>
        </div>
      )}

      <div>
        <div className="text-sm font-medium text-slate-600 mb-2">Mis viajes finalizados</div>
        <div className="space-y-2">
          {misViajes.length === 0 && <div className="text-sm text-slate-400">Todavía no registraste viajes.</div>}
          {misViajes.map(v => <ViajeRow key={v.id_viaje} data={data} v={v} />)}
        </div>
      </div>
    </div>
  );
}

function lugarNombre(data, id) { return data.lugares.find(l => l.id_lugar === id)?.nombre_lugar || "—"; }
function vehiculoNombre(data, id) { return data.vehiculos.find(v => v.id_vehiculo === id)?.nombre_vehiculo || "—"; }
function choferNombre(data, id) { const u = data.usuarios.find(u => u.id_usuario === id); return u ? `${u.nombre} ${u.apellido}` : "—"; }
function fmtFecha(iso) { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

function ViajeRow({ data, v, onClick }) {
  const cargamentos = data.cargamentos.filter(c => c.id_viaje === v.id_viaje);
  return (
    <div className={card + " flex items-center justify-between " + (onClick ? "cursor-pointer hover:border-amber-300" : "")} onClick={onClick}>
      <div>
        <div className="text-sm font-medium text-slate-800">
          #{v.numero_viaje} · {lugarNombre(data, v.id_origen)} → {lugarNombre(data, v.id_destino)}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {vehiculoNombre(data, v.id_vehiculo)} · {choferNombre(data, v.id_chofer)} · {fmtFecha(v.fecha_hora_salida)}
        </div>
        <div className="text-xs text-slate-500">
          {cargamentos.map(c => data.cargas.find(x => x.id_carga === c.id_carga)?.nombre_carga).join(", ")}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-slate-800">{v.km_recorridos ?? (v.odometro_final != null ? v.odometro_final - v.odometro_inicial : "—")} km</div>
        <Badge tone={v.id_estado === "EST_FIN" ? "green" : "amber"}>{v.id_estado === "EST_FIN" ? "Finalizado" : "En curso"}</Badge>
      </div>
    </div>
  );
}

function IniciarViaje({ data, usuario, mutate, onDone }) {
  const [idVehiculo, setIdVehiculo] = useState("");
  const [idOrigen, setIdOrigen] = useState("");
  const [idDestino, setIdDestino] = useState("");
  const [nuevoDestino, setNuevoDestino] = useState("");
  const [odometroInicial, setOdometroInicial] = useState("");
  const [cargasSel, setCargasSel] = useState([{ id_carga: "", cantidad_inicial: "" }]);
  const [error, setError] = useState("");

  const addCarga = () => setCargasSel([...cargasSel, { id_carga: "", cantidad_inicial: "" }]);
  const updCarga = (i, field, val) => setCargasSel(cargasSel.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const rmCarga = (i) => setCargasSel(cargasSel.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError("");
    if (!idVehiculo) return setError("Elegí un vehículo.");
    if (!idOrigen) return setError("Elegí el lugar de origen.");
    if (!idDestino && !nuevoDestino.trim()) return setError("Elegí el destino o cargá uno nuevo.");
    if (!odometroInicial || Number(odometroInicial) < 0) return setError("Ingresá el odómetro inicial.");
    const cargasValidas = cargasSel.filter(c => c.id_carga && Number(c.cantidad_inicial) > 0);
    if (cargasValidas.length === 0) return setError("Agregá al menos una carga con cantidad inicial.");

    let destinoId = idDestino;
    let nuevosLugares = data.lugares;
    if (!destinoId && nuevoDestino.trim()) {
      const nuevo = { id_lugar: uid(), codigo: null, nombre_lugar: nuevoDestino.trim(), tipo_lugar: "Otro", ubicacion: "", activo: true };
      nuevosLugares = [...data.lugares, nuevo];
      destinoId = nuevo.id_lugar;
    }

    const viaje = {
      id_viaje: uid(),
      numero_viaje: Math.max(0, ...data.viajes.map(v => v.numero_viaje || 0)) + 1,
      id_chofer: usuario.id_usuario,
      id_vehiculo: idVehiculo,
      id_origen: idOrigen,
      id_destino: destinoId,
      fecha_hora_salida: now(),
      fecha_hora_llegada: null,
      odometro_inicial: Number(odometroInicial),
      odometro_final: null,
      id_estado: "EST_CURSO",
      observaciones: "",
    };
    const nuevosCargamentos = cargasValidas.map(c => ({
      id_cargamento: uid(), id_viaje: viaje.id_viaje, id_carga: c.id_carga,
      cantidad_inicial: Number(c.cantidad_inicial), cantidad_destino: null,
    }));

    await mutate({
      lugares: nuevosLugares,
      viajes: [...data.viajes, viaje],
      cargamentos: [...data.cargamentos, ...nuevosCargamentos],
    });
    onDone();
  };

  return (
    <div className={card + " max-w-xl"}>
      <div className="text-base font-medium text-slate-800 mb-4">Iniciar viaje</div>

      <Field label="Vehículo">
        <select className={inputCls} value={idVehiculo} onChange={e => setIdVehiculo(e.target.value)}>
          <option value="">Seleccionar…</option>
          {data.vehiculos.filter(v => v.activo).map(v => <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.nombre_vehiculo} ({v.patente})</option>)}
        </select>
      </Field>

      <Field label="Origen">
        <select className={inputCls} value={idOrigen} onChange={e => setIdOrigen(e.target.value)}>
          <option value="">Seleccionar…</option>
          {data.lugares.filter(l => l.activo).map(l => <option key={l.id_lugar} value={l.id_lugar}>{l.nombre_lugar}</option>)}
        </select>
      </Field>

      <Field label="Destino">
        <select className={inputCls} value={idDestino} onChange={e => { setIdDestino(e.target.value); setNuevoDestino(""); }}>
          <option value="">Seleccionar…</option>
          {data.lugares.filter(l => l.activo).map(l => <option key={l.id_lugar} value={l.id_lugar}>{l.nombre_lugar}</option>)}
        </select>
        <div className="text-xs text-slate-400 mt-1 mb-1">¿No está en la lista?</div>
        <input className={inputCls} placeholder="Cargar un lugar nuevo" value={nuevoDestino}
          onChange={e => { setNuevoDestino(e.target.value); setIdDestino(""); }} />
      </Field>

      <Field label="Odómetro inicial (km)">
        <input type="number" className={inputCls} value={odometroInicial} onChange={e => setOdometroInicial(e.target.value)} placeholder="Ej: 2425" />
      </Field>

      <div className="mb-2 text-sm font-medium text-slate-600">Carga transportada</div>
      {cargasSel.map((c, i) => (
        <div key={i} className="flex gap-2 mb-2 items-start">
          <select className={inputCls} value={c.id_carga} onChange={e => updCarga(i, "id_carga", e.target.value)}>
            <option value="">Tipo de carga…</option>
            {data.cargas.filter(x => x.activo).map(x => <option key={x.id_carga} value={x.id_carga}>{x.nombre_carga}</option>)}
          </select>
          <input type="number" className={inputCls} placeholder="Cantidad (kg)" value={c.cantidad_inicial} onChange={e => updCarga(i, "cantidad_inicial", e.target.value)} />
          {cargasSel.length > 1 && <button className="text-slate-400 hover:text-red-500 px-2" onClick={() => rmCarga(i)}>✕</button>}
        </div>
      ))}
      <button className="text-amber-600 text-sm font-medium mb-4" onClick={addCarga}>+ Agregar otra carga</button>

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      <div className="flex gap-2 mt-2">
        <button className={btnPrimary} onClick={submit}>Iniciar viaje</button>
        <button className={btnGhost} onClick={onDone}>Cancelar</button>
      </div>
    </div>
  );
}

function FinalizarViaje({ data, viaje, usuario, mutate, onDone }) {
  const cargamentos = data.cargamentos.filter(c => c.id_viaje === viaje.id_viaje);
  const [idDestino, setIdDestino] = useState(viaje.id_destino);
  const [odometroFinal, setOdometroFinal] = useState("");
  const [cantidades, setCantidades] = useState(Object.fromEntries(cargamentos.map(c => [c.id_cargamento, ""])));
  const [litrosCombustible, setLitrosCombustible] = useState("");
  const [montoPeaje, setMontoPeaje] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!odometroFinal || Number(odometroFinal) < viaje.odometro_inicial) {
      return setError(`El odómetro final debe ser mayor o igual a ${viaje.odometro_inicial}.`);
    }
    const faltantes = cargamentos.filter(c => !cantidades[c.id_cargamento] || Number(cantidades[c.id_cargamento]) <= 0);
    if (faltantes.length > 0) return setError("Cargá la cantidad recibida en destino para cada carga.");

    const viajeActualizado = {
      ...viaje,
      id_destino: idDestino,
      odometro_final: Number(odometroFinal),
      km_recorridos: Number(odometroFinal) - viaje.odometro_inicial,
      fecha_hora_llegada: now(),
      id_estado: "EST_FIN",
      usuario_cierre_id: usuario.id_usuario,
    };
    const cargamentosActualizados = data.cargamentos.map(c =>
      c.id_viaje === viaje.id_viaje ? { ...c, cantidad_destino: Number(cantidades[c.id_cargamento]) } : c
    );
    const nuevoCombustible = litrosCombustible && Number(litrosCombustible) > 0
      ? [{ id_combustible: uid(), id_vehiculo: viaje.id_vehiculo, id_viaje: viaje.id_viaje, fecha: now(), litros: Number(litrosCombustible), usuario_registro_id: usuario.id_usuario }]
      : [];
    const nuevoPeaje = montoPeaje && Number(montoPeaje) > 0
      ? [{ id_peaje: uid(), id_viaje: viaje.id_viaje, fecha: now(), monto: Number(montoPeaje), usuario_registro_id: usuario.id_usuario }]
      : [];

    await mutate({
      viajes: data.viajes.map(v => v.id_viaje === viaje.id_viaje ? viajeActualizado : v),
      cargamentos: cargamentosActualizados,
      combustible: [...data.combustible, ...nuevoCombustible],
      peajes: [...data.peajes, ...nuevoPeaje],
    });
    onDone();
  };

  return (
    <div className={card + " max-w-xl"}>
      <div className="text-base font-medium text-slate-800 mb-1">Finalizar viaje #{viaje.numero_viaje}</div>
      <div className="text-sm text-slate-500 mb-4">{vehiculoNombre(data, viaje.id_vehiculo)} · odómetro inicial {viaje.odometro_inicial.toLocaleString()} km</div>

      <Field label="Destino">
        <select className={inputCls} value={idDestino} onChange={e => setIdDestino(e.target.value)}>
          {data.lugares.filter(l => l.activo).map(l => <option key={l.id_lugar} value={l.id_lugar}>{l.nombre_lugar}</option>)}
        </select>
      </Field>

      <Field label="Odómetro final (km)">
        <input type="number" className={inputCls} value={odometroFinal} onChange={e => setOdometroFinal(e.target.value)} placeholder={`Mayor o igual a ${viaje.odometro_inicial}`} />
      </Field>

      {odometroFinal && Number(odometroFinal) >= viaje.odometro_inicial && (
        <div className="text-sm text-slate-500 mb-4">Kilómetros recorridos: <span className="font-mono font-medium text-slate-700">{Number(odometroFinal) - viaje.odometro_inicial} km</span></div>
      )}

      <div className="mb-2 text-sm font-medium text-slate-600">Cantidad recibida en destino</div>
      {cargamentos.map(c => {
        const carga = data.cargas.find(x => x.id_carga === c.id_carga);
        return (
          <div key={c.id_cargamento} className="flex gap-2 mb-2 items-center">
            <div className="w-40 text-sm text-slate-600">{carga?.nombre_carga}</div>
            <input type="number" className={inputCls} placeholder={`Cargado: ${c.cantidad_inicial} kg`}
              value={cantidades[c.id_cargamento]} onChange={e => setCantidades({ ...cantidades, [c.id_cargamento]: e.target.value })} />
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label="Combustible cargado (lts, opcional)">
          <input type="number" className={inputCls} value={litrosCombustible} onChange={e => setLitrosCombustible(e.target.value)} />
        </Field>
        <Field label="Peajes pagados ($, opcional)">
          <input type="number" className={inputCls} value={montoPeaje} onChange={e => setMontoPeaje(e.target.value)} />
        </Field>
      </div>

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      <div className="flex gap-2 mt-2">
        <button className={btnPrimary} onClick={submit}>Finalizar viaje</button>
        <button className={btnGhost} onClick={onDone}>Cancelar</button>
      </div>
    </div>
  );
}

/* ------------------------------ Admin view ----------------------------- */

function AdminView({ data, usuario, mutate }) {
  const [tab, setTab] = useState("viajes");
  const tabs = [
    ["viajes", "Viajes"], ["vehiculos", "Vehículos"], ["cargas", "Cargas"], ["lugares", "Lugares"], ["usuarios", "Usuarios"],
  ];
  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? "border-amber-500 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "viajes" && <AdminViajes data={data} usuario={usuario} mutate={mutate} />}
      {tab === "vehiculos" && <AdminCatalogo data={data} mutate={mutate} tabla="vehiculos" pk="id_vehiculo"
        campos={[{ key: "patente", label: "Patente" }, { key: "nombre_vehiculo", label: "Nombre" }]} nuevo={() => ({ id_vehiculo: uid(), patente: "", nombre_vehiculo: "", id_tipo_vehiculo: "TV_CAM", activo: true })} />}
      {tab === "cargas" && <AdminCatalogo data={data} mutate={mutate} tabla="cargas" pk="id_carga"
        campos={[{ key: "nombre_carga", label: "Nombre" }]} nuevo={() => ({ id_carga: uid(), nombre_carga: "", id_unidad: "UN_KG", activo: true })} />}
      {tab === "lugares" && <AdminCatalogo data={data} mutate={mutate} tabla="lugares" pk="id_lugar"
        campos={[{ key: "nombre_lugar", label: "Nombre" }, { key: "ubicacion", label: "Ubicación" }]} nuevo={() => ({ id_lugar: uid(), nombre_lugar: "", ubicacion: "", activo: true })} />}
      {tab === "usuarios" && <AdminUsuarios data={data} mutate={mutate} />}
    </div>
  );
}

function AdminViajes({ data, usuario, mutate }) {
  const [editando, setEditando] = useState(null);
  const viajes = [...data.viajes].sort((a, b) => new Date(b.fecha_hora_salida) - new Date(a.fecha_hora_salida));

  if (editando) {
    const v = viajes.find(x => x.id_viaje === editando);
    return <EditarViajeAdmin data={data} viaje={v} usuario={usuario} mutate={mutate} onDone={() => setEditando(null)} />;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-slate-500 mb-2">Tocá un viaje finalizado para corregirlo.</div>
      {viajes.map(v => (
        <ViajeRow key={v.id_viaje} data={data} v={v} onClick={v.id_estado === "EST_FIN" ? () => setEditando(v.id_viaje) : undefined} />
      ))}
    </div>
  );
}

function EditarViajeAdmin({ data, viaje, usuario, mutate, onDone }) {
  const [idDestino, setIdDestino] = useState(viaje.id_destino);
  const [odometroFinal, setOdometroFinal] = useState(viaje.odometro_final);
  const [error, setError] = useState("");

  const submit = async () => {
    if (Number(odometroFinal) < viaje.odometro_inicial) return setError(`Debe ser mayor o igual a ${viaje.odometro_inicial}.`);
    const actualizado = {
      ...viaje, id_destino: idDestino, odometro_final: Number(odometroFinal),
      km_recorridos: Number(odometroFinal) - viaje.odometro_inicial,
      actualizado_por: usuario.id_usuario,
    };
    await mutate({ viajes: data.viajes.map(v => v.id_viaje === viaje.id_viaje ? actualizado : v) });
    onDone();
  };

  return (
    <div className={card + " max-w-lg"}>
      <div className="text-base font-medium text-slate-800 mb-1">Corregir viaje #{viaje.numero_viaje}</div>
      <div className="text-sm text-slate-500 mb-4">Chofer: {choferNombre(data, viaje.id_chofer)}</div>
      <Field label="Destino">
        <select className={inputCls} value={idDestino} onChange={e => setIdDestino(e.target.value)}>
          {data.lugares.map(l => <option key={l.id_lugar} value={l.id_lugar}>{l.nombre_lugar}</option>)}
        </select>
      </Field>
      <Field label="Odómetro final">
        <input type="number" className={inputCls} value={odometroFinal} onChange={e => setOdometroFinal(e.target.value)} />
      </Field>
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      <div className="flex gap-2">
        <button className={btnPrimary} onClick={submit}>Guardar corrección</button>
        <button className={btnGhost} onClick={onDone}>Cancelar</button>
      </div>
    </div>
  );
}

function AdminCatalogo({ data, mutate, tabla, pk, campos, nuevo }) {
  const [creando, setCreando] = useState(null);
  const items = data[tabla];

  const guardarNuevo = async () => {
    await mutate({ [tabla]: [...items, creando] });
    setCreando(null);
  };

  const toggleActivo = async (item) => {
    await mutate({ [tabla]: items.map(x => x[pk] === item[pk] ? { ...x, activo: !x.activo } : x) });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-slate-500">{items.length} registrados</div>
        {!creando && <button className={btnPrimary} onClick={() => setCreando(nuevo())}>+ Nuevo</button>}
      </div>

      {creando && (
        <div className={card + " mb-3"}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {campos.map(f => (
              <Field key={f.key} label={f.label}>
                <input className={inputCls} value={creando[f.key]} onChange={e => setCreando({ ...creando, [f.key]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={guardarNuevo}>Guardar</button>
            <button className={btnGhost} onClick={() => setCreando(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item[pk]} className={card + " flex justify-between items-center py-3"}>
            <div className="text-sm text-slate-800">
              {campos.map(f => item[f.key]).filter(Boolean).join(" · ")}
            </div>
            <button onClick={() => toggleActivo(item)} className="text-xs">
              <Badge tone={item.activo ? "green" : "slate"}>{item.activo ? "Activo" : "Inactivo"}</Badge>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminUsuarios({ data, mutate }) {
  const [creando, setCreando] = useState(null);

  const invitar = async () => {
    await mutate({ usuarios: [...data.usuarios, creando] });
    setCreando(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-slate-500">{data.usuarios.length} usuarios</div>
        {!creando && <button className={btnPrimary} onClick={() => setCreando({ id_usuario: uid(), email: "", nombre: "", apellido: "", id_rol: "ROL_OP", activo: true })}>+ Invitar usuario</button>}
      </div>
      {creando && (
        <div className={card + " mb-3"}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Nombre"><input className={inputCls} value={creando.nombre} onChange={e => setCreando({ ...creando, nombre: e.target.value })} /></Field>
            <Field label="Apellido"><input className={inputCls} value={creando.apellido} onChange={e => setCreando({ ...creando, apellido: e.target.value })} /></Field>
            <Field label="Email"><input className={inputCls} value={creando.email} onChange={e => setCreando({ ...creando, email: e.target.value })} /></Field>
            <Field label="Rol">
              <select className={inputCls} value={creando.id_rol} onChange={e => setCreando({ ...creando, id_rol: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={invitar}>Invitar</button>
            <button className={btnGhost} onClick={() => setCreando(null)}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {data.usuarios.map(u => (
          <div key={u.id_usuario} className={card + " flex justify-between items-center py-3"}>
            <div>
              <div className="text-sm text-slate-800">{u.nombre} {u.apellido}</div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
            <Badge>{ROLES[u.id_rol]}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Gerente view --------------------------- */

function GerenteView({ data }) {
  const finalizados = data.viajes.filter(v => v.id_estado === "EST_FIN");
  const kmTotales = finalizados.reduce((s, v) => s + (v.km_recorridos ?? (v.odometro_final - v.odometro_inicial)), 0);
  const litrosTotales = data.combustible.reduce((s, c) => s + c.litros, 0);
  const peajesTotales = data.peajes.reduce((s, p) => s + p.monto, 0);

  const porChofer = {};
  finalizados.forEach(v => {
    const nombre = choferNombre(data, v.id_chofer);
    porChofer[nombre] = (porChofer[nombre] || 0) + (v.km_recorridos ?? (v.odometro_final - v.odometro_inicial));
  });
  const chartData = Object.entries(porChofer).map(([chofer, km]) => ({ chofer, km }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Viajes finalizados" value={finalizados.length} />
        <KpiCard label="Viajes en curso" value={data.viajes.length - finalizados.length} />
        <KpiCard label="Km totales" value={kmTotales.toLocaleString()} />
        <KpiCard label="Combustible (lts)" value={litrosTotales.toLocaleString()} />
      </div>

      <div className={card}>
        <div className="text-sm font-medium text-slate-700 mb-4">Kilómetros recorridos por chofer</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="chofer" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="km" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="text-sm font-medium text-slate-600 mb-2">Todos los viajes</div>
        <div className="space-y-2">
          {[...data.viajes].sort((a, b) => new Date(b.fecha_hora_salida) - new Date(a.fecha_hora_salida)).map(v => <ViajeRow key={v.id_viaje} data={data} v={v} />)}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }) {
  return (
    <div className={card}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-800 mt-1 font-mono">{value}</div>
    </div>
  );
}

/* --------------------------------- App --------------------------------- */

export default function App() {
  const [data, setData] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll().then(d => { setData(d); setLoading(false); });
  }, []);

  const mutate = useCallback(async (partial) => {
    setData(prev => {
      const next = { ...prev, ...partial };
      Object.entries(partial).forEach(([k, v]) => saveTable(k, v));
      return next;
    });
  }, []);

  if (loading || !data) {
    return <div className="p-10 text-center text-slate-400 text-sm">Cargando…</div>;
  }

  const usuario = data.usuarios.find(u => u.id_usuario === userId);

  return (
    <div className="max-w-3xl mx-auto">
      {!usuario ? (
        <Login usuarios={data.usuarios} onLogin={setUserId} />
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
            <div>
              <div className="text-slate-800 font-medium">{usuario.nombre} {usuario.apellido}</div>
              <div className="text-xs text-slate-500">{ROLES[usuario.id_rol]}</div>
            </div>
            <button className={btnGhost} onClick={() => setUserId(null)}>Cambiar de usuario</button>
          </div>

          {usuario.id_rol === "ROL_OP" && <ChoferView data={data} usuario={usuario} mutate={mutate} />}
          {usuario.id_rol === "ROL_ADM" && <AdminView data={data} usuario={usuario} mutate={mutate} />}
          {usuario.id_rol === "ROL_GEREN" && <GerenteView data={data} />}
        </div>
      )}
    </div>
  );
}
