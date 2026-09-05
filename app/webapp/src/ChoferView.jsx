import React, { useState, useMemo } from "react";
import { Field, Badge, card, inputCls, btnPrimary, btnGhost, fmtFecha, ErrorBanner, KpiCard } from "./ui";
import { iniciarViaje, finalizarViaje, crearLugar, anularViaje } from "./data";

function lugarNombre(catalogos, id) { return catalogos.lugares.find((l) => l.id_lugar === id)?.nombre_lugar || "—"; }
function vehiculoNombre(catalogos, id) { return catalogos.vehiculos.find((v) => v.id_vehiculo === id)?.nombre_vehiculo || "—"; }

export function ViajeRow({ catalogos, cargamentos, v, onClick, usuarios, mostrarChofer, onAnular }) {
  const misCargamentos = cargamentos.filter((c) => c.id_viaje === v.id_viaje);
  const chofer = mostrarChofer && usuarios ? usuarios.find((u) => u.id_usuario === v.id_chofer) : null;
  const pendienteDeSync = v.numero_viaje == null;
  const anulado = v.id_estado === "EST_ANULADO";
  return (
    <div className={card + " flex items-center justify-between " + (onClick ? "cursor-pointer hover:border-[#2E7D32]/50" : "")} onClick={onClick}>
      <div>
        <div className="text-sm font-medium text-[#1A1A1A]">
          {pendienteDeSync ? "Viaje nuevo" : `#${v.numero_viaje}`} · {lugarNombre(catalogos, v.id_origen)} → {lugarNombre(catalogos, v.id_destino)}
        </div>
        <div className="text-xs text-[#555555] mt-0.5">
          {chofer && <span className="font-medium text-[#555555]">{chofer.nombre} {chofer.apellido} · </span>}
          {vehiculoNombre(catalogos, v.id_vehiculo)} · {fmtFecha(v.fecha_hora_salida)}
        </div>
        <div className="text-xs text-[#555555]">
          {misCargamentos.map((c) => catalogos.cargas.find((x) => x.id_carga === c.id_carga)?.nombre_carga).join(", ")}
        </div>
        {v.observaciones && <div className="text-xs text-[#555555] italic mt-0.5">"{v.observaciones}"</div>}
        {anulado && v.motivo_anulacion && <div className="text-xs text-[#D32F2F] mt-0.5">Anulado: {v.motivo_anulacion}</div>}
        {onAnular && !anulado && (
          <button onClick={(e) => { e.stopPropagation(); onAnular(v); }} className="text-xs text-[#D32F2F] hover:underline mt-1 font-medium">
            Anular viaje
          </button>
        )}
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-[#1A1A1A]">
          {v.odometro_final != null ? v.odometro_final - v.odometro_inicial : "—"} km
        </div>
        {pendienteDeSync ? (
          <Badge tone="amber">Sin sincronizar</Badge>
        ) : anulado ? (
          <Badge tone="slate">Anulado</Badge>
        ) : (
          <Badge tone={v.id_estado === "EST_FIN" ? "green" : "amber"}>{v.id_estado === "EST_FIN" ? "Finalizado" : "En curso"}</Badge>
        )}
      </div>
    </div>
  );
}

export default function ChoferView({ catalogos, viajes, cargamentos, usuario, reload }) {
  const [mode, setMode] = useState("home"); // "home" | "iniciar" | "finalizar" | { tipo: "anular", viaje }
  const [tab, setTab] = useState("viajes"); // "viajes" | "resumen"
  const viajeEnCurso = viajes.find((v) => v.id_chofer === usuario.id_usuario && v.id_estado === "EST_CURSO");
  // El historial incluye los anulados (siguen visibles, para que el
  // chofer no "pierda de vista" un viaje que canceló); el Resumen, más
  // abajo, sí los excluye de las cuentas.
  const misViajesHistorial = viajes
    .filter((v) => v.id_chofer === usuario.id_usuario && (v.id_estado === "EST_FIN" || v.id_estado === "EST_ANULADO"))
    .sort((a, b) => new Date(b.fecha_hora_salida) - new Date(a.fecha_hora_salida));
  const misViajesFinalizados = misViajesHistorial.filter((v) => v.id_estado === "EST_FIN");

  if (mode === "iniciar")
    return <IniciarViaje catalogos={catalogos} onDone={() => { setMode("home"); reload(); }} onCancel={() => setMode("home")} />;
  if (mode === "finalizar" && viajeEnCurso)
    return (
      <FinalizarViaje catalogos={catalogos} cargamentos={cargamentos} viaje={viajeEnCurso}
        onDone={() => { setMode("home"); reload(); }} onCancel={() => setMode("home")} />
    );
  if (mode?.tipo === "anular")
    return <AnularViaje viaje={mode.viaje} onDone={() => { setMode("home"); reload(); }} onCancel={() => setMode("home")} />;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-[#CCCCCC]/50">
        {[["viajes", "Mis viajes"], ["resumen", "Resumen"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? "border-[#2E7D32] text-[#1A1A1A]" : "border-transparent text-[#555555] hover:text-[#1A1A1A]"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "resumen" ? (
        <ResumenChofer catalogos={catalogos} misViajes={misViajesFinalizados} cargamentos={cargamentos} />
      ) : (
        <>
          {viajeEnCurso ? (
            <div className={card + " border-amber-300 bg-amber-50"}>
              <div className="flex items-center justify-between">
                <div>
                  <Badge tone="amber">Viaje en curso</Badge>
                  <div className="text-lg font-medium text-[#1A1A1A] mt-2">
                    {lugarNombre(catalogos, viajeEnCurso.id_origen)} → {lugarNombre(catalogos, viajeEnCurso.id_destino)}
                  </div>
                  <div className="text-sm text-[#555555] mt-1">
                    {vehiculoNombre(catalogos, viajeEnCurso.id_vehiculo)} · odómetro inicial {viajeEnCurso.odometro_inicial.toLocaleString()} km
                  </div>
                  <div className="text-sm text-[#555555]">Salida: {fmtFecha(viajeEnCurso.fecha_hora_salida)}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button className={btnPrimary} onClick={() => setMode("finalizar")}>Finalizar viaje</button>
                  <button className="text-xs text-[#D32F2F] hover:underline font-medium" onClick={() => setMode({ tipo: "anular", viaje: viajeEnCurso })}>
                    Anular viaje
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={card + " text-center py-10"}>
              <div className="text-[#555555] text-sm mb-4">No tenés ningún viaje en curso</div>
              <button className={btnPrimary} onClick={() => setMode("iniciar")}>Iniciar viaje</button>
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-[#555555] mb-2">Mis viajes</div>
            <div className="space-y-2">
              {misViajesHistorial.length === 0 && <div className="text-sm text-[#555555]/70">Todavía no registraste viajes.</div>}
              {misViajesHistorial.map((v) => (
                <ViajeRow key={v.id_viaje} catalogos={catalogos} cargamentos={cargamentos} v={v}
                  onAnular={(viaje) => setMode({ tipo: "anular", viaje })} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ResumenChofer({ catalogos, misViajes, cargamentos }) {
  const stats = useMemo(() => {
    const idsViajes = new Set(misViajes.map((v) => v.id_viaje));
    const kmTotales = misViajes.reduce((s, v) => s + (v.odometro_final - v.odometro_inicial), 0);

    // Agrupar por carga (lo que en el resto de la app ya llamamos "tipo
    // de carga" — es el mismo desplegable que usa el chofer al iniciar
    // el viaje). No se suman cantidades entre cargas de distinta unidad
    // (kg vs lts): cada grupo muestra su propia unidad, para no mezclar.
    const porCarga = {};
    cargamentos.forEach((c) => {
      if (!idsViajes.has(c.id_viaje)) return;
      const carga = catalogos.cargas.find((x) => x.id_carga === c.id_carga);
      const nombre = carga?.nombre_carga || "Sin especificar";
      const unidad = catalogos.unidades.find((u) => u.id_unidad === carga?.id_unidad)?.nombre_unidad || "";
      if (!porCarga[c.id_carga]) porCarga[c.id_carga] = { nombre, unidad, viajes: new Set(), cantidad: 0 };
      porCarga[c.id_carga].viajes.add(c.id_viaje);
      porCarga[c.id_carga].cantidad += Number(c.cantidad_destino ?? c.cantidad_inicial ?? 0);
    });

    const grupos = Object.values(porCarga)
      .map((g) => ({ ...g, viajes: g.viajes.size }))
      .sort((a, b) => b.viajes - a.viajes);

    return { kmTotales, grupos, cantViajes: misViajes.length };
  }, [misViajes, cargamentos, catalogos]);

  if (stats.cantViajes === 0) {
    return <div className={card + " text-center py-10 text-sm text-[#555555]"}>Todavía no hay viajes finalizados para mostrar un resumen.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Viajes finalizados" value={stats.cantViajes} />
        <KpiCard label="Km recorridos" value={stats.kmTotales.toLocaleString()} />
        <KpiCard label="Tipos de carga" value={stats.grupos.length} />
      </div>

      <div>
        <div className="text-sm font-medium text-[#555555] mb-2">Por tipo de carga</div>
        <div className="space-y-2">
          {stats.grupos.map((g) => (
            <div key={g.nombre} className={card + " flex items-center justify-between"}>
              <div>
                <div className="text-sm font-medium text-[#1A1A1A]">{g.nombre}</div>
                <div className="text-xs text-[#555555]">{g.viajes} viaje{g.viajes !== 1 ? "s" : ""}</div>
              </div>
              <div className="font-mono text-sm text-[#1A1A1A]">
                {g.cantidad.toLocaleString()} {g.unidad}
              </div>
            </div>
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
      <div className="text-base font-medium text-[#1A1A1A] mb-4">Iniciar viaje</div>

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
        <div className="text-xs text-[#555555]/70 mt-1 mb-1">¿No está en la lista?</div>
        <input className={inputCls} placeholder="Cargar un lugar nuevo" value={nuevoDestino}
          onChange={(e) => { setNuevoDestino(e.target.value); setIdDestino(""); }} />
      </Field>

      <Field label="Odómetro inicial (km)">
        <input type="number" className={inputCls} value={odometroInicial} onChange={(e) => setOdometroInicial(e.target.value)} placeholder="Ej: 2425" />
      </Field>

      <div className="mb-2 text-sm font-medium text-[#555555]">Carga transportada</div>
      {cargasSel.map((c, i) => (
        <div key={i} className="flex gap-2 mb-2 items-start">
          <select className={inputCls} value={c.id_carga} onChange={(e) => updCarga(i, "id_carga", e.target.value)}>
            <option value="">Tipo de carga…</option>
            {catalogos.cargas.filter((x) => x.activo).map((x) => (
              <option key={x.id_carga} value={x.id_carga}>{x.nombre_carga}</option>
            ))}
          </select>
          <input type="number" className={inputCls} placeholder="Cantidad (kg)" value={c.cantidad_inicial} onChange={(e) => updCarga(i, "cantidad_inicial", e.target.value)} />
          {cargasSel.length > 1 && <button className="text-[#555555]/70 hover:text-red-500 px-2" onClick={() => rmCarga(i)}>✕</button>}
        </div>
      ))}
      <button className="text-[#2E7D32] text-sm font-semibold mb-4" onClick={addCarga}>+ Agregar otra carga</button>

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

export function AnularViaje({ viaje, onDone, onCancel }) {
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const submit = async () => {
    setError("");
    if (motivo.trim().length < 5) return setError("Contá brevemente qué pasó (al menos unas palabras).");
    if (!confirmado) return setError("Marcá el casillero para confirmar que entendiste.");
    setEnviando(true);
    try {
      await anularViaje({ id_viaje: viaje.id_viaje, motivo_anulacion: motivo.trim() });
      onDone();
    } catch (e) {
      setError(e.message || "No se pudo anular el viaje.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={card + " max-w-lg"}>
      <div className="text-base font-medium text-[#1A1A1A] mb-1">
        Anular viaje {viaje.numero_viaje != null ? `#${viaje.numero_viaje}` : ""}
      </div>
      <div className="text-sm text-[#555555] mb-4">{fmtFecha(viaje.fecha_hora_salida)}</div>

      <div className="bg-[#FBEAEA] border border-[#D32F2F]/30 text-[#D32F2F] text-sm rounded-lg p-3 mb-4">
        Esta acción no se puede deshacer desde la app. El viaje no se borra —
        queda guardado como anulado, visible para vos y para administración,
        junto con el motivo que escribas abajo.
      </div>

      <Field label="¿Qué pasó?">
        <textarea className={inputCls} rows={3} placeholder="Ej: elegí el vehículo equivocado, viaje duplicado…"
          value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>

      <label className="flex items-start gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-1" />
        <span className="text-sm text-[#555555]">Entiendo que esto anula el viaje y no se puede deshacer.</span>
      </label>

      <ErrorBanner message={error} />

      <div className="flex gap-2">
        <button
          disabled={enviando}
          onClick={submit}
          className="inline-flex items-center justify-center min-h-[56px] bg-[#D32F2F] hover:bg-[#b52828] text-white font-bold text-sm px-5 rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        <button className={btnGhost} onClick={onCancel}>Volver</button>
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
      <div className="text-base font-medium text-[#1A1A1A] mb-1">Finalizar viaje {viaje.numero_viaje != null ? `#${viaje.numero_viaje}` : "(nuevo)"}</div>
      <div className="text-sm text-[#555555] mb-4">odómetro inicial {viaje.odometro_inicial.toLocaleString()} km</div>

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
        <div className="text-sm text-[#555555] mb-4">
          Kilómetros recorridos: <span className="font-mono font-medium text-[#1A1A1A]">{Number(odometroFinal) - viaje.odometro_inicial} km</span>
        </div>
      )}

      <div className="mb-2 text-sm font-medium text-[#555555]">Cantidad recibida en destino</div>
      {misCargamentos.map((c) => {
        const carga = catalogos.cargas.find((x) => x.id_carga === c.id_carga);
        return (
          <div key={c.id_cargamento} className="flex gap-2 mb-2 items-center">
            <div className="w-40 text-sm text-[#555555]">{carga?.nombre_carga}</div>
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
