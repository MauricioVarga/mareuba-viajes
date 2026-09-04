import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/* -----------------------------------------------------------------------
   Paleta de "Guía de Estilo Visual y UI para Desarrollo de App Agrícola"
   (ver database no aplica acá, es un documento de diseño). Los valores
   son los códigos HEX exactos de la guía — se usan como clases arbitrarias
   de Tailwind (bg-[#2E7D32]) en vez de aproximar con los verdes por
   defecto, para no perder precisión de marca.
----------------------------------------------------------------------- */
export const COLORES = {
  primario: "#2E7D32", // Agro Green Deep — acciones principales
  primarioHover: "#256829",
  primarioActivo: "#1b4d1e",
  exito: "#4CAF50", // Vibrant Green — estados "Completado"
  fondo: "#F8F9FA",
  superficie: "#FFFFFF",
  texto: "#1A1A1A",
  textoSecundario: "#555555",
  borde: "#CCCCCC",
  error: "#D32F2F",
  errorFondo: "#FBEAEA", // fondo SÓLIDO (no con opacidad — ver nota en ErrorBanner)
};

export const ROLES = { ROL_ADM: "Administrativo", ROL_OP: "Chofer", ROL_GEREN: "Gerencial" };

// Altura mínima de 56px en botones y campos: así lo pide la guía, para
// poder tocar sin error con guantes o el camión en movimiento.
export const inputCls =
  "w-full min-h-[56px] rounded-xl border-[1.5px] border-[#CCCCCC] bg-white px-3.5 py-3 text-sm text-[#1A1A1A] placeholder-[#555555]/60 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition-colors";
export const btnPrimary =
  "inline-flex items-center justify-center min-h-[56px] bg-[#2E7D32] hover:bg-[#256829] active:bg-[#1b4d1e] text-white font-bold text-sm px-5 rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
export const btnGhost =
  "inline-flex items-center justify-center min-h-[56px] bg-white hover:bg-[#F8F9FA] text-[#1A1A1A] border-[1.5px] border-[#CCCCCC] font-semibold text-sm px-5 rounded-xl transition-colors";
export const card = "bg-white border border-[#CCCCCC]/50 rounded-xl shadow-sm p-5";

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    // "amber" queda reservado para estados de progreso/pendiente (en
    // curso, sin sincronizar) — justamente porque el verde ahora
    // significa "completado" y el rojo "error", conviene un tercer
    // color para "todavía no terminó" y no perder esa distinción.
    amber: "bg-amber-100 text-amber-800",
    green: "bg-[#4CAF50]/15 text-[#2E7D32]",
    red: "bg-[#D32F2F]/10 text-[#D32F2F]",
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  // Fondo SÓLIDO (no bg-[#D32F2F]/10 con opacidad): con opacidad al 10%
  // el contraste medía 4.28:1, por debajo del mínimo de accesibilidad
  // (4.5:1). Con el fondo sólido ya calculado, da bien.
  return (
    <div className="flex items-center gap-2 p-3 bg-[#FBEAEA] border border-[#D32F2F]/40 text-[#D32F2F] rounded-lg text-sm font-medium mb-3">
      {message}
    </div>
  );
}

export function Spinner({ label = "Cargando…" }) {
  return <div className="p-10 text-center text-[#555555] text-sm">{label}</div>;
}

export function KpiCard({ label, value }) {
  return (
    <div className={card}>
      <div className="text-xs text-[#555555]">{label}</div>
      <div className="text-2xl font-semibold text-[#1A1A1A] mt-1 font-mono">{value}</div>
    </div>
  );
}

/* -----------------------------------------------------------------------
   Campos de auth (Login / ResetPassword): con ícono a la izquierda, en
   línea con el mockup del diseñador. `oscuro` es por si en algún
   momento se vuelve a usar un fondo oscuro; hoy el login es claro.
----------------------------------------------------------------------- */

function claseCampoIcono(oscuro) {
  return oscuro
    ? "w-full min-h-[56px] rounded-xl bg-slate-700 border border-slate-600 text-white pl-11 pr-4 py-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] transition-colors"
    : "w-full min-h-[56px] rounded-xl border-[1.5px] border-[#CCCCCC] bg-white pl-11 pr-4 py-3 text-sm text-[#1A1A1A] placeholder-[#555555]/60 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition-colors";
}

export function CampoTexto({ icono: Icono, value, onChange, placeholder, type = "text", oscuro = false, required = false }) {
  const colorIcono = oscuro ? "text-slate-400" : "text-[#555555]";
  return (
    <div className="relative">
      <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${colorIcono}`}>
        <Icono className="w-5 h-5" />
      </div>
      <input type={type} required={required} placeholder={placeholder} value={value} onChange={onChange} className={claseCampoIcono(oscuro)} />
    </div>
  );
}

// Campo de contraseña con ícono de candado a la izquierda y el "ojito"
// para mostrar/ocultar a la derecha.
export function CampoPassword({ icono: Icono, value, onChange, placeholder, oscuro = false, required = false }) {
  const [visible, setVisible] = useState(false);
  const colorIcono = oscuro ? "text-slate-400" : "text-[#555555]";
  const colorOjito = oscuro ? "text-slate-400 hover:text-slate-200" : "text-[#555555] hover:text-[#1A1A1A]";
  const clase = claseCampoIcono(oscuro).replace("pr-4", Icono ? "pr-12" : "pr-12");
  return (
    <div className="relative">
      {Icono && (
        <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${colorIcono}`}>
          <Icono className="w-5 h-5" />
        </div>
      )}
      <input
        type={visible ? "text" : "password"}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={Icono ? clase : clase.replace("pl-11", "pl-3.5")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${colorOjito}`}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    </div>
  );
}
