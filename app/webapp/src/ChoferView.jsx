import React, { useState } from "react";
import { Field, Badge, card, inputCls, btnPrimary, btnGhost, fmtFecha, ErrorBanner } from "./ui";
import { iniciarViaje, finalizarViaje, crearLugar } from "./data";

function lugarNombre(catalogos, id) { return catalogos.lugares.find((l) => l.id_lugar === id)?.nombre_lugar || "—"; }
function vehiculoNombre(catalogos, id) { return catalogos.vehiculos.find((v) => v.id_vehiculo === id)?.nombre_vehiculo || "—"; }

export function ViajeRow({ catalogos, cargamentos, v, onClick, usuarios, mostrarChofer }) {
  const misCargamentos = cargamentos.filter((c) => c.id_viaje === v.id_viaje);
  const chofer = mostrarChofer && usuarios ? usuarios.find((u) => u.id_usuario === v.id_chofer) : null;
  const pendienteDeSync = v.numero_viaje == null;
  return (
    <div className={card + " flex items-center justify-between " + (onClick ? "cursor-pointer hover:border-amber-300" : "")} onClick={onClick}>
      <div>
        <div className="text-sm font-medium text-slate-800">
          {pendienteDeSync ? "Viaje nuevo" : `#${v.numero_viaje}`} · {lugarNombre(catalogos, v.id_origen)} → {lugarNombre(catalogos, v.id_destino)}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {chofer && <span className="font-medium text-slate-600">{chofer.nombre} {chofer.apellido} · </span>}
          {vehiculoNombre(catalogos, v.id_vehiculo)} · {fmtFecha(v.fecha_hora_salida)}
        </div>
        <div className="text-xs text-slate-500">
          {misCargamentos.map((c) => catalogos.cargas.find((x) => x.id_carga === c.id_carga)?.nombre_carga).join(", ")}
        </div>
        {v.observaciones && <div className="text-xs text-slate-500 italic mt-0.5">"{v.observaciones}"</div>}
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-slate-800">
          {v.odometro_final != null ? v.odometro_final - v.odometro_inicial : "—"} km
        </div>
        {pendienteDeSync ? (
          <Badge tone="amber">Sin sincronizar</Badge>
        ) : (
          <Badge tone={v.id_estado === "EST_FIN" ? "green" : "amber"}>{v.id_estado === "EST_FIN" ? "Finalizado" : "En curso"}</Badge>
        )}
      </div>
    </div>
  );
}

export default function ChoferView({ catalogos, viajes, cargamentos, usuario, reload }) {
  const [mode, setMode] = useState("home");
  const viajeEnCurso = viajes.find((v) => v.id_chofer === usuario.id_usuario && v.id_estado === "EST_CURSO");
  const misViajes = viajes.filter((v) => v.id_chofer === usuario.id_usuario && v.id_estado === "EST_FIN");

  if (mode === "iniciar")
    return <IniciarViaje catalogos={catalogos} onDone={() => { setMode("home"); reload(); }} onCancel={() => setMode("home")} />;
  if (mode === "finalizar" && viajeEnCurso)
    return (
      <FinalizarViaje catalogos={catalogos} cargamentos={cargamentos} viaje={viajeEnCurso}
        onDone={() => { setMode("home"); reload(); }} onCancel={() => setMode("home")} />
    );

  return (
    <div className="space-y-5">
      {viajeEnCurso ? (
        <div className={card + " border-amber-300 bg-amber-50"}>
          <div className="flex items-center justify-between">
            <div>
              <Badge tone="amber">Viaje en curso</Badge>
              <div className="text-lg font-medium text-slate-800 mt-2">
                {lugarNombre(catalogos, viajeEnCurso.id_origen)} → {lugarNombre(catalogos, viajeEnCurso.id_destino)}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                {vehiculoNombre(catalogos, viajeEnCurso.id_vehiculo)} · odómetro inicial {viajeEnCurso.odometro_inicial.toLocaleString()} km
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
          {misViajes.map((v) => (
            <ViajeRow key={v.id_viaje} catalogos={catalogos} cargamentos={cargamentos} v={v} />
          ))}
        </div>
      </div>
    </div>
  );
}

function IniciarViaje({ catalogos, onDone, onCancel }) {
  const [idVehiculo, setIdVehiculo] = useState("");
  const [idOrigen, setIdOrigen] = useState("");
  const [idDestino, setIdDestino] = useState("");
  const [nuevoDestino, setNuevoDestino] = useState("");
  const [odometroInicial, setOdometroInicial] = useState("");
  const [cargasSel, setCargasSel] = useState([{ id_carga: "", cantidad_inicial: "" }]);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const addCarga = () => setCargasSel([...cargasSel, { id_carga: "", cantidad_inicial: "" }]);
  const updCarga = (i, field, val) => setCargasSel(cargasSel.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)));
  const rmCarga = (i) => setCargasSel(cargasSel.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError("");
    if (!idVehiculo) return setError("Elegí un vehículo.");
    if (!idOrigen) return setError("Elegí el lugar de origen.");
    if (!idDestino && !nuevoDestino.trim()) return setError("Elegí el destino o cargá uno nuevo.");
    if (!odometroInicial || Number(odometroInicial) < 0) return setError("Ingresá el odómetro inicial.");
    const cargasValidas = cargasSel.filter((c) => c.id_carga && Number(c.cantidad_inicial) > 0);
    if (cargasValidas.length === 0) return setError("Agregá al menos una carga con cantidad inicial.");

    setEnviando(true);
    try {
      let destinoId = idDestino;
      if (!destinoId && nuevoDestino.trim()) {
        const nuevo = await crearLugar({ nombre_lugar: nuevoDestino.trim() });
        destinoId = nuevo.id_lugar;
      }
      await iniciarViaje({
        id_vehiculo: idVehiculo,
        id_origen: idOrigen,
        id_destino: destinoId,
        odometro_inicial: Number(odometroInicial),
        cargas: cargasValidas.map((c) => ({ id_carga: c.id_carga, cantidad_inicial: Number(c.cantidad_inicial) })),
        observaciones: observaciones.trim(),
      });
      onDone();
    } catch (e) {
      setError(e.message || "Ocurrió un error al iniciar el viaje.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={card + " max-w-xl"}>
      <div className="text-base font-medium text-slate-800 mb-4">Iniciar viaje</div>

      <Field label="Vehículo">
        <select className={inputCls} value={idVehiculo} onChange={(e) => setIdVehiculo(e.target.value)}>
          <option value="">Seleccionar…</option>
          {catalogos.vehiculos.filter((v) => v.activo).map((v) => (
            <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.nombre_vehiculo} ({v.patente})</option>
          ))}
        </select>
      </Field>

      <Field label="Origen">
        <select className={inputCls} value={idOrigen} onChange={(e) => setIdOrigen(e.target.value)}>
          <option value="">Seleccionar…</option>
          {catalogos.lugares.filter((l) => l.activo).map((l) => (
            <option key={l.id_lugar} value={l.id_lugar}>{l.nombre_lugar}</option>
          ))}
        </select>
      </Field>

      <Field label="Destino">
        <select className={inputCls} value={idDestino} onChange={(e) => { setIdDestino(e.target.value); setNuevoDestino(""); }}>
          <option value="">Seleccionar…</option>
          {catalogos.lugares.filter((l) => l.activo).map((l) => (
            <option key={l.id_lugar} value={l.id_lugar}>{l.nombre_lugar}</option>
          ))}
        </select>
        <div className="text-xs text-slate-400 mt-1 mb-1">¿No está en la lista?</div>
        <input className={inputCls} placeholder="Cargar un lugar nuevo" value={nuevoDestino}
          onChange={(e) => { setNuevoDestino(e.target.value); setIdDestino(""); }} />
      </Field>

      <Field label="Odómetro inicial (km)">
        <input type="number" className={inputCls} value={odometroInicial} onChange={(e) => setOdometroInicial(e.target.value)} placeholder="Ej: 2425" />
      </Field>

      <div className="mb-2 text-sm font-medium text-slate-600">Carga transportada</div>
      {cargasSel.map((c, i) => (
        <div key={i} className="flex gap-2 mb-2 items-start">
          <select className={inputCls} value={c.id_carga} onChange={(e) => updCarga(i, "id_carga", e.target.value)}>
            <option value="">Tipo de carga…</option>
            {catalogos.cargas.filter((x) => x.activo).map((x) => (
              <option key={x.id_carga} value={x.id_carga}>{x.nombre_carga}</option>
            ))}
          </select>
          <input type="number" className={inputCls} placeholder="Cantidad (kg)" value={c.cantidad_inicial} onChange={(e) => updCarga(i, "cantidad_inicial", e.target.value)} />
          {cargasSel.length > 1 && <button className="text-slate-400 hover:text-red-500 px-2" onClick={() => rmCarga(i)}>✕</button>}
        </div>
      ))}
      <button className="text-amber-600 text-sm font-medium mb-4" onClick={addCarga}>+ Agregar otra carga</button>

      <Field label="Observaciones (opcional)">
        <textarea className={inputCls} rows={3} placeholder="Cualquier detalle que no esté en los campos de arriba…"
          value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </Field>

      <ErrorBanner message={error} />

      <div className="flex gap-2 mt-2">
        <button className={btnPrimary} disabled={enviando} onClick={submit}>{enviando ? "Guardando…" : "Iniciar viaje"}</button>
        <button className={btnGhost} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function FinalizarViaje({ catalogos, cargamentos, viaje, onDone, onCancel }) {
  const misCargamentos = cargamentos.filter((c) => c.id_viaje === viaje.id_viaje);
  const [idDestino, setIdDestino] = useState(viaje.id_destino);
  const [odometroFinal, setOdometroFinal] = useState("");
  const [cantidades, setCantidades] = useState(Object.fromEntries(misCargamentos.map((c) => [c.id_cargamento, ""])));
  const [litrosCombustible, setLitrosCombustible] = useState("");
  const [montoPeaje, setMontoPeaje] = useState("");
  const [observaciones, setObservaciones] = useState(viaje.observaciones || "");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const submit = async () => {
    setError("");
    if (!odometroFinal || Number(odometroFinal) < viaje.odometro_inicial) {
      return setError(`El odómetro final debe ser mayor o igual a ${viaje.odometro_inicial}.`);
    }
    const faltantes = misCargamentos.filter((c) => !cantidades[c.id_cargamento] || Number(cantidades[c.id_cargamento]) <= 0);
    if (faltantes.length > 0) return setError("Cargá la cantidad recibida en destino para cada carga.");

    setEnviando(true);
    try {
      await finalizarViaje({
        id_viaje: viaje.id_viaje,
        id_vehiculo: viaje.id_vehiculo,
        id_destino: idDestino,
        odometro_final: odometroFinal,
        cantidadesPorCargamento: cantidades,
        litrosCombustible,
        montoPeaje,
        observaciones: observaciones.trim(),
      });
      onDone();
    } catch (e) {
      setError(e.message || "Ocurrió un error al finalizar el viaje.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={card + " max-w-xl"}>
      <div className="text-base font-medium text-slate-800 mb-1">Finalizar viaje {viaje.numero_viaje != null ? `#${viaje.numero_viaje}` : "(nuevo)"}</div>
      <div className="text-sm text-slate-500 mb-4">odómetro inicial {viaje.odometro_inicial.toLocaleString()} km</div>

      <Field label="Destino">
        <select className={inputCls} value={idDestino} onChange={(e) => setIdDestino(e.target.value)}>
          {catalogos.lugares.filter((l) => l.activo).map((l) => (
            <option key={l.id_lugar} value={l.id_lugar}>{l.nombre_lugar}</option>
          ))}
        </select>
      </Field>

      <Field label="Odómetro final (km)">
        <input type="number" className={inputCls} value={odometroFinal} onChange={(e) => setOdometroFinal(e.target.value)} placeholder={`Mayor o igual a ${viaje.odometro_inicial}`} />
      </Field>

      {odometroFinal && Number(odometroFinal) >= viaje.odometro_inicial && (
        <div className="text-sm text-slate-500 mb-4">
          Kilómetros recorridos: <span className="font-mono font-medium text-slate-700">{Number(odometroFinal) - viaje.odometro_inicial} km</span>
        </div>
      )}

      <div className="mb-2 text-sm font-medium text-slate-600">Cantidad recibida en destino</div>
      {misCargamentos.map((c) => {
        const carga = catalogos.cargas.find((x) => x.id_carga === c.id_carga);
        return (
          <div key={c.id_cargamento} className="flex gap-2 mb-2 items-center">
            <div className="w-40 text-sm text-slate-600">{carga?.nombre_carga}</div>
            <input type="number" className={inputCls} placeholder={`Cargado: ${c.cantidad_inicial} kg`}
              value={cantidades[c.id_cargamento]} onChange={(e) => setCantidades({ ...cantidades, [c.id_cargamento]: e.target.value })} />
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label="Combustible cargado (lts, opcional)">
          <input type="number" className={inputCls} value={litrosCombustible} onChange={(e) => setLitrosCombustible(e.target.value)} />
        </Field>
        <Field label="Peajes pagados ($, opcional)">
          <input type="number" className={inputCls} value={montoPeaje} onChange={(e) => setMontoPeaje(e.target.value)} />
        </Field>
      </div>

      <Field label="Observaciones (opcional)">
        <textarea className={inputCls} rows={3} placeholder="Cualquier detalle que no esté en los campos de arriba…"
          value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </Field>

      <ErrorBanner message={error} />

      <div className="flex gap-2 mt-2">
        <button className={btnPrimary} disabled={enviando} onClick={submit}>{enviando ? "Guardando…" : "Finalizar viaje"}</button>
        <button className={btnGhost} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
