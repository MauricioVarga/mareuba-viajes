import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { inputCls, btnPrimary, ErrorBanner } from "./ui";

const inputOscuro = "w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500";

export default function ResetPassword({ onListo }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== password2) return setError("Las dos contraseñas no coinciden.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else onListo();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-8">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-amber-500 text-2xl font-semibold tracking-tight">Mareuba</div>
          <div className="text-slate-400 text-sm mt-1">Elegí tu nueva contraseña</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-5 space-y-3">
          <input type="password" required placeholder="Contraseña nueva" value={password} onChange={(e) => setPassword(e.target.value)} className={inputOscuro} />
          <input type="password" required placeholder="Repetir contraseña nueva" value={password2} onChange={(e) => setPassword2(e.target.value)} className={inputOscuro} />
          <ErrorBanner message={error} />
          <button type="submit" disabled={loading} className={btnPrimary + " w-full"}>
            {loading ? "Guardando…" : "Guardar contraseña"}
          </button>
        </div>
      </form>
    </div>
  );
}
