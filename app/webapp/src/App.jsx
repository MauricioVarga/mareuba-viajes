import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import ResetPassword from "./ResetPassword";
import ChoferView from "./ChoferView";
import AdminView from "./AdminView";
import GerenteView from "./GerenteView";
import { getUsuarioActual, getCatalogos, getViajes, getCargamentos, getUsuarios, getKpiChoferMensual, sincronizarCola, cantidadPendienteDeSync } from "./data";
import { estaOnline } from "./offline";
import { btnGhost, Spinner, ROLES } from "./ui";

// Esto se evalúa apenas se carga el archivo, ANTES de que React pinte
// nada — a propósito. Supabase empieza a procesar el enlace de
// recuperación (que viene en el hash de la URL, ej: #access_token=...&type=recovery)
// en el mismo instante en que se crea el cliente, sin esperar a que
// nadie esté escuchando. Si dependiéramos únicamente del evento
// PASSWORD_RECOVERY dentro de un useEffect, existe una ventana real
// donde el aviso se dispara y se pierde antes de que React llegue a
// suscribirse. Revisando la URL acá, de forma síncrona, no dependemos
// de llegar a tiempo.
function esEnlaceDeRecuperacion() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("type") === "recovery" || query.get("type") === "recovery";
}

function EstadoConexion({ online, pendientes, sincronizando }) {
  if (online && pendientes === 0 && !sincronizando) return null; // todo normal, no mostramos nada
  return (
    <div className={`text-sm px-4 py-2 rounded-md mb-4 ${online ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-slate-800 text-white"}`}>
      {!online && "Sin conexión — lo que registres se guarda en el celular y se sube solo cuando vuelva la señal."}
      {online && sincronizando && "Sincronizando cambios guardados…"}
      {online && !sincronizando && pendientes > 0 && `Hay ${pendientes} cambio(s) esperando conexión.`}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = todavía no se sabe
  const [usuario, setUsuario] = useState(null);
  const [catalogos, setCatalogos] = useState(null);
  const [viajes, setViajes] = useState([]);
  const [cargamentos, setCargamentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [kpiChofer, setKpiChofer] = useState([]);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(estaOnline());
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizandoRef = useRef(false);
  const [recuperandoPassword, setRecuperandoPassword] = useState(esEnlaceDeRecuperacion);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Supabase dispara este evento específico cuando alguien llega desde
      // el enlace de recuperación de contraseña del email.
      if (event === "PASSWORD_RECOVERY") setRecuperandoPassword(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const cargarDatos = useCallback(async () => {
    setError("");
    try {
      const u = await getUsuarioActual();
      setUsuario(u);
      if (!u) return;

      const [cat, v, c] = await Promise.all([getCatalogos(), getViajes(), getCargamentos()]);
      setCatalogos(cat);
      setViajes(v);
      setCargamentos(c);

      if (u.id_rol === "ROL_ADM" || u.id_rol === "ROL_GEREN") {
        const usrs = await getUsuarios();
        setUsuarios(usrs);
      }
      if (u.id_rol === "ROL_GEREN") {
        const kpi = await getKpiChoferMensual();
        setKpiChofer(kpi);
      }
    } catch (e) {
      setError(e.message || "No se pudieron cargar los datos.");
    }
    setPendientes(await cantidadPendienteDeSync());
  }, []);

  useEffect(() => {
    if (session) cargarDatos();
  }, [session, cargarDatos]);

  // Intenta sincronizar la cola (si hay algo pendiente) y vuelve a cargar
  // los datos. Se llama al abrir la app y cada vez que vuelve la señal.
  const intentarSincronizar = useCallback(async () => {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    setSincronizando(true);
    try {
      await sincronizarCola();
      await cargarDatos();
    } finally {
      setSincronizando(false);
      sincronizandoRef.current = false;
    }
  }, [cargarDatos]);

  useEffect(() => {
    const handleOnline = () => { setOnline(true); intentarSincronizar(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (session && estaOnline()) intentarSincronizar(); // al abrir la app, por si quedó algo pendiente de la última sesión
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (session === undefined) return <Spinner label="Verificando sesión…" />;
  if (recuperandoPassword) return <ResetPassword onListo={() => setRecuperandoPassword(false)} />;
  if (!session) return <Login />;
  if (!usuario) {
    if (error) {
      return (
        <div className="max-w-md mx-auto mt-20 p-5 bg-white border border-red-200 rounded-lg">
          <div className="text-red-600 text-sm font-medium mb-1">No se pudo cargar tu perfil</div>
          <div className="text-red-600 text-sm mb-3">{error}</div>
          <button className={btnGhost} onClick={() => supabase.auth.signOut()}>Cerrar sesión y volver a intentar</button>
        </div>
      );
    }
    return <Spinner label="Cargando tu perfil…" />;
  }
  if (!catalogos) return <Spinner label="Cargando datos…" />;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
          <div>
            <div className="text-slate-800 font-medium">{usuario.nombre} {usuario.apellido}</div>
            <div className="text-xs text-slate-500">{ROLES[usuario.id_rol]}</div>
          </div>
          <button className={btnGhost} onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>

        <EstadoConexion online={online} pendientes={pendientes} sincronizando={sincronizando} />

        {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

        {usuario.id_rol === "ROL_OP" && (
          <ChoferView catalogos={catalogos} viajes={viajes} cargamentos={cargamentos} usuario={usuario} reload={cargarDatos} />
        )}
        {usuario.id_rol === "ROL_ADM" && (
          <AdminView catalogos={catalogos} viajes={viajes} cargamentos={cargamentos} usuarios={usuarios} reload={cargarDatos} />
        )}
        {usuario.id_rol === "ROL_GEREN" && (
          <GerenteView catalogos={catalogos} viajes={viajes} cargamentos={cargamentos} kpiChofer={kpiChofer} usuarios={usuarios} />
        )}
      </div>
    </div>
  );
}
