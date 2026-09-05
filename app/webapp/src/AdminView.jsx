import React, { useState, useMemo } from "react";
import { Field, Badge, card, inputCls, btnPrimary, btnGhost, ErrorBanner, ROLES } from "./ui";
import { corregirViaje, crearCatalogo, actualizarCatalogo, eliminarCatalogo, actualizarRolUsuario } from "./data";
import { ViajeRow, AnularViaje } from "./ChoferView";

export default function AdminView({ catalogos, viajes, cargamentos, usuarios, reload }) {
  const [tab, setTab] = useState("viajes");
  const tabs = [
    ["viajes", "Viajes"], ["vehiculos", "Vehículos"], ["cargas", "Cargas"], ["lugares", "Lugares"], ["maestros", "Maestros"], ["usuarios", "Usuarios"],
  ];
  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-[#CCCCCC]/50 overflow-x-auto">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === k ? "border-[#2E7D32] text-[#1A1A1A]" : "border-transparent text-[#555555] hover:text-[#1A1A1A]"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "viajes" && <AdminViajes catalogos={catalogos} viajes={viajes} cargamentos={cargamentos} usuarios={usuarios} reload={reload} />}
      {tab === "vehiculos" && (
        <AdminCatalogo tabla="vehiculos" pk="id_vehiculo" items={catalogos.vehiculos} reload={reload}
          campos={[
            { key: "patente", label: "Patente" },
            { key: "nombre_vehiculo", label: "Nombre" },
            { key: "id_tipo_vehiculo", label: "Tipo", type: "select", opciones: catalogos.tiposVehiculo, pk: "id_tipo_vehiculo", labelKey: "nombre_tipo_vehiculo" },
            { key: "marca", label: "Marca" },
            { key: "modelo", label: "Modelo" },
            { key: "anio", label: "Año", type: "number" },
          ]}
          nuevo={() => ({ patente: "", nombre_vehiculo: "", id_tipo_vehiculo: catalogos.tiposVehiculo[0]?.id_tipo_vehiculo || "", marca: "", modelo: "", anio: "" })} />
      )}
      {tab === "cargas" && (
        <AdminCatalogo tabla="cargas" pk="id_carga" items={catalogos.cargas} reload={reload}
          campos={[
            { key: "nombre_carga", label: "Nombre" },
            { key: "id_tipo_carga", label: "Tipo", type: "select", opciones: catalogos.tiposCarga, pk: "id_tipo_carga", labelKey: "nombre_tipo_carga" },
            { key: "id_unidad", label: "Unidad", type: "select", opciones: catalogos.unidades, pk: "id_unidad", labelKey: "nombre_unidad" },
            { key: "id_metodo_medicion", label: "Método de medición", type: "select", opciones: catalogos.metodosMedicion, pk: "id_metodo_medicion", labelKey: "nombre_metodo_medicion" },
          ]}
          nuevo={() => ({
            nombre_carga: "",
            id_tipo_carga: catalogos.tiposCarga[0]?.id_tipo_carga || "",
            id_unidad: catalogos.unidades[0]?.id_unidad || "",
            id_metodo_medicion: catalogos.metodosMedicion[0]?.id_metodo_medicion || "",
          })} />
      )}
      {tab === "lugares" && (
        <AdminCatalogo tabla="lugares" pk="id_lugar" items={catalogos.lugares} reload={reload}
          campos={[
            { key: "nombre_lugar", label: "Nombre" },
            { key: "id_tipo_lugar", label: "Tipo de lugar", type: "select", opciones: catalogos.tiposLugar, pk: "id_tipo_lugar", labelKey: "nombre_tipo_lugar" },
            { key: "ubicacion", label: "Ubicación" },
            { key: "provincia", label: "Provincia" },
          ]}
          nuevo={() => ({ nombre_lugar: "", id_tipo_lugar: catalogos.tiposLugar[0]?.id_tipo_lugar || "", ubicacion: "", provincia: "" })} />
      )}
      {tab === "maestros" && <AdminMaestros catalogos={catalogos} reload={reload} />}
      {tab === "usuarios" && <AdminUsuarios usuarios={usuarios} reload={reload} />}
    </div>
  );
}

function AdminViajes({ catalogos, viajes, cargamentos, usuarios, reload }) {
  const [editando, setEditando] = useState(null);
  const [anulando, setAnulando] = useState(null);
  const [filtroChofer, setFiltroChofer] = useState("TODOS");

  const choferesConViajes = useMemo(() => {
    const ids = [...new Set(viajes.map((v) => v.id_chofer))];
    return ids
      .map((id) => usuarios.find((u) => u.id_usuario === id))
      .filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [viajes, usuarios]);

  const viajesFiltrados = filtroChofer === "TODOS" ? viajes : viajes.filter((v) => v.id_chofer === filtroChofer);

  if (editando) {
    const v = viajes.find((x) => x.id_viaje === editando);
    return <EditarViajeAdmin catalogos={catalogos} viaje={v} onDone={() => { setEditando(null); reload(); }} onCancel={() => setEditando(null)} />;
  }
  if (anulando) {
    return <AnularViaje viaje={anulando} onDone={() => { setAnulando(null); reload(); }} onCancel={() => setAnulando(null)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[#555555]">Tocá un viaje finalizado para corregirlo.</div>
        <select className={inputCls + " w-auto"} value={filtroChofer} onChange={(e) => setFiltroChofer(e.target.value)}>
          <option value="TODOS">Todos los choferes</option>
          {choferesConViajes.map((u) => (
            <option key={u.id_usuario} value={u.id_usuario}>{u.nombre} {u.apellido}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        {viajesFiltrados.length === 0 && <div className="text-sm text-[#555555]/70">No hay viajes para mostrar.</div>}
        {viajesFiltrados.map((v) => (
          <ViajeRow key={v.id_viaje} catalogos={catalogos} cargamentos={cargamentos} v={v} usuarios={usuarios} mostrarChofer
            onClick={v.id_estado === "EST_FIN" ? () => setEditando(v.id_viaje) : undefined}
            onAnular={(viaje) => setAnulando(viaje)} />
        ))}
      </div>
    </div>
  );
}

function EditarViajeAdmin({ catalogos, viaje, onDone, onCancel }) {
  const [idDestino, setIdDestino] = useState(viaje.id_destino);
  const [odometroFinal, setOdometroFinal] = useState(viaje.odometro_final);
  const [observaciones, setObservaciones] = useState(viaje.observaciones || "");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const submit = async () => {
    setError("");
    if (Number(odometroFinal) < viaje.odometro_inicial) return setError(`Debe ser mayor o igual a ${viaje.odometro_inicial}.`);
    setEnviando(true);
    try {
      await corregirViaje({ id_viaje: viaje.id_viaje, id_destino: idDestino, odometro_final: odometroFinal, observaciones: observaciones.trim() });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={card + " max-w-lg"}>
      <div className="text-base font-medium text-[#1A1A1A] mb-4">Corregir viaje #{viaje.numero_viaje}</div>
      <Field label="Destino">
        <select className={inputCls} value={idDestino} onChange={(e) => setIdDestino(e.target.value)}>
          {catalogos.lugares.map((l) => <option key={l.id_lugar} value={l.id_lugar}>{l.nombre_lugar}</option>)}
        </select>
      </Field>
      <Field label="Odómetro final">
        <input type="number" className={inputCls} value={odometroFinal} onChange={(e) => setOdometroFinal(e.target.value)} />
      </Field>
      <Field label="Observaciones">
        <textarea className={inputCls} rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </Field>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={enviando} onClick={submit}>Guardar corrección</button>
        <button className={btnGhost} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function AdminCatalogo({ tabla, pk, items, campos, nuevo, reload }) {
  // formulario === null -> nada abierto
  // formulario === { modo: "crear", valores } | { modo: "editar", id, valores }
  const [formulario, setFormulario] = useState(null);
  const [error, setError] = useState("");

  const abrirCrear = () => { setError(""); setFormulario({ modo: "crear", valores: nuevo() }); };
  const abrirEditar = (item) => { setError(""); setFormulario({ modo: "editar", id: item[pk], valores: { ...item } }); };
  const cerrar = () => { setFormulario(null); setError(""); };

  const setValor = (key, val) => setFormulario((f) => ({ ...f, valores: { ...f.valores, [key]: val } }));

  const guardar = async () => {
    setError("");
    try {
      if (formulario.modo === "crear") {
        await crearCatalogo(tabla, formulario.valores);
      } else {
        // No se reenvían pk/activo/timestamps: solo los campos editables del formulario
        const cambios = Object.fromEntries(campos.map((f) => [f.key, formulario.valores[f.key]]));
        await actualizarCatalogo(tabla, pk, formulario.id, cambios);
      }
      setFormulario(null);
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleActivo = async (item) => {
    await actualizarCatalogo(tabla, pk, item[pk], { activo: !item.activo });
    reload();
  };

  // Para mostrar el nombre legible (no el código) de los campos tipo select en el listado
  const valorMostrable = (item, f) => {
    if (f.type === "select") {
      const opcion = (f.opciones || []).find((o) => o[f.pk] === item[f.key]);
      return opcion ? opcion[f.labelKey] : item[f.key];
    }
    return item[f.key];
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-[#555555]">{items.length} registrados</div>
        {!formulario && <button className={btnPrimary} onClick={abrirCrear}>+ Nuevo</button>}
      </div>

      {formulario && (
        <div className={card + " mb-3"}>
          <div className="text-sm font-medium text-[#1A1A1A] mb-3">{formulario.modo === "crear" ? "Nuevo registro" : "Editar registro"}</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {campos.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === "select" ? (
                  <select className={inputCls} value={formulario.valores[f.key]} onChange={(e) => setValor(f.key, e.target.value)}>
                    {(f.opciones || []).map((o) => (
                      <option key={o[f.pk]} value={o[f.pk]}>{o[f.labelKey]}</option>
                    ))}
                  </select>
                ) : (
                  <input type={f.type === "number" ? "number" : "text"} className={inputCls} value={formulario.valores[f.key] ?? ""}
                    onChange={(e) => setValor(f.key, e.target.value)} />
                )}
              </Field>
            ))}
          </div>
          <ErrorBanner message={error} />
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={guardar}>Guardar</button>
            <button className={btnGhost} onClick={cerrar}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item[pk]} className={card + " flex justify-between items-center py-3"}>
            <div className="text-sm text-[#1A1A1A]">{campos.map((f) => valorMostrable(item, f)).filter(Boolean).join(" · ")}</div>
            <div className="flex items-center gap-3">
              <button onClick={() => abrirEditar(item)} className="text-xs text-[#555555] hover:text-[#2E7D32] font-medium">Editar</button>
              <button onClick={() => toggleActivo(item)} className="text-xs">
                <Badge tone={item.activo ? "green" : "slate"}>{item.activo ? "Activo" : "Inactivo"}</Badge>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminMaestros({ catalogos, reload }) {
  const [sub, setSub] = useState("tipos_carga");
  const grupos = [
    { key: "tipos_carga", label: "Tipos de carga", tabla: "tipos_carga", pk: "id_tipo_carga", labelField: "nombre_tipo_carga", items: catalogos.tiposCarga },
    { key: "unidades", label: "Unidades de medida", tabla: "unidades", pk: "id_unidad", labelField: "nombre_unidad", items: catalogos.unidades },
    { key: "tipos_vehiculo", label: "Tipos de vehículo", tabla: "tipos_vehiculo", pk: "id_tipo_vehiculo", labelField: "nombre_tipo_vehiculo", items: catalogos.tiposVehiculo },
    { key: "metodos_medicion", label: "Métodos de medición", tabla: "metodos_medicion", pk: "id_metodo_medicion", labelField: "nombre_metodo_medicion", items: catalogos.metodosMedicion },
    { key: "tipos_lugar", label: "Tipos de lugar", tabla: "tipos_lugar", pk: "id_tipo_lugar", labelField: "nombre_tipo_lugar", items: catalogos.tiposLugar },
  ];
  const activo = grupos.find((g) => g.key === sub);

  return (
    <div>
      <div className="text-sm text-[#555555] mb-3">
        Estos son los catálogos base que alimentan los desplegables del resto de la app.
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {grupos.map((g) => (
          <button key={g.key} onClick={() => setSub(g.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sub === g.key ? "bg-[#2E7D32] text-white" : "bg-[#F8F9FA] text-[#555555] hover:bg-[#CCCCCC]/40"}`}>
            {g.label} ({g.items.length})
          </button>
        ))}
      </div>
      <AdminCatalogoSimple key={activo.key} tabla={activo.tabla} pk={activo.pk} labelField={activo.labelField} items={activo.items} reload={reload} />
    </div>
  );
}

// Catálogos "código + nombre" (tipos de carga, unidades, etc.): a diferencia
// de vehículos/cargas/lugares, la clave acá es un código de texto que
// elige el propio administrador (ej: "TC_LIQ"), no se genera solo. Y en
// vez de desactivar, se elimina — pero la base rechaza el borrado si el
// código ya está siendo usado por alguna carga/vehículo/lugar, así que no
// hay riesgo de dejar referencias rotas.
function AdminCatalogoSimple({ tabla, pk, labelField, items, reload }) {
  const [formulario, setFormulario] = useState(null); // { modo: "crear"|"editar", id, codigo, nombre }
  const [error, setError] = useState("");

  const abrirCrear = () => { setError(""); setFormulario({ modo: "crear", codigo: "", nombre: "" }); };
  const abrirEditar = (item) => { setError(""); setFormulario({ modo: "editar", id: item[pk], codigo: item[pk], nombre: item[labelField] }); };
  const cerrar = () => { setFormulario(null); setError(""); };

  const guardar = async () => {
    setError("");
    if (!formulario.codigo.trim() || !formulario.nombre.trim()) return setError("Completá código y nombre.");
    try {
      if (formulario.modo === "crear") {
        await crearCatalogo(tabla, { [pk]: formulario.codigo.trim().toUpperCase().replace(/\s+/g, "_"), [labelField]: formulario.nombre.trim() });
      } else {
        await actualizarCatalogo(tabla, pk, formulario.id, { [labelField]: formulario.nombre.trim() });
      }
      setFormulario(null);
      reload();
    } catch (e) {
      setError(e.message.includes("duplicate") ? "Ese código ya existe." : e.message);
    }
  };

  const eliminar = async (item) => {
    setError("");
    try {
      await eliminarCatalogo(tabla, pk, item[pk]);
      reload();
    } catch (e) {
      setError(`No se pudo eliminar "${item[labelField]}": ya está en uso en algún registro existente.`);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-[#555555]">{items.length} registrados</div>
        {!formulario && <button className={btnPrimary} onClick={abrirCrear}>+ Nuevo</button>}
      </div>

      {formulario && (
        <div className={card + " mb-3"}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Código (sin espacios, ej: TC_LIQ)">
              <input className={inputCls} value={formulario.codigo} disabled={formulario.modo === "editar"}
                onChange={(e) => setFormulario({ ...formulario, codigo: e.target.value })} />
            </Field>
            <Field label="Nombre">
              <input className={inputCls} value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} />
            </Field>
          </div>
          <ErrorBanner message={error} />
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={guardar}>Guardar</button>
            <button className={btnGhost} onClick={cerrar}>Cancelar</button>
          </div>
        </div>
      )}

      {!formulario && <ErrorBanner message={error} />}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item[pk]} className={card + " flex justify-between items-center py-3"}>
            <div>
              <div className="text-sm text-[#1A1A1A]">{item[labelField]}</div>
              <div className="text-xs text-[#555555]/70 font-mono">{item[pk]}</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => abrirEditar(item)} className="text-xs text-[#555555] hover:text-[#2E7D32] font-medium">Editar</button>
              <button onClick={() => eliminar(item)} className="text-xs text-[#555555] hover:text-red-600 font-medium">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminUsuarios({ usuarios, reload }) {
  const cambiarRol = async (id_usuario, id_rol) => {
    await actualizarRolUsuario(id_usuario, id_rol);
    reload();
  };
  return (
    <div>
      <div className="text-sm text-[#555555] mb-3">
        {usuarios.length} usuarios. Para dar de alta uno nuevo: Supabase → Authentication → Users → Invite user.
      </div>
      <div className="space-y-2">
        {usuarios.map((u) => (
          <div key={u.id_usuario} className={card + " flex justify-between items-center py-3"}>
            <div>
              <div className="text-sm text-[#1A1A1A]">{u.nombre} {u.apellido}</div>
              <div className="text-xs text-[#555555]">{u.email}</div>
            </div>
            <select className={inputCls + " w-auto"} value={u.id_rol} onChange={(e) => cambiarRol(u.id_usuario, e.target.value)}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
