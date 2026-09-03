import React from "react";

export const ROLES = { ROL_ADM: "Administrativo", ROL_OP: "Chofer", ROL_GEREN: "Gerencial" };

export const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500";
export const btnPrimary =
  "bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
export const btnGhost =
  "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium px-4 py-2 rounded-md text-sm transition-colors";
export const card = "bg-white border border-slate-200 rounded-lg p-5";

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-700",
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
  return <div className="text-red-600 text-sm mb-3">{message}</div>;
}

export function Spinner({ label = "Cargando…" }) {
  return <div className="p-10 text-center text-slate-400 text-sm">{label}</div>;
}
