import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { inputCls, btnPrimary, ErrorBanner } from "./ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Email o contraseña incorrectos.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-8">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-amber-500 text-2xl font-semibold tracking-tight">Mareuba</div>
          <div className="text-slate-400 text-sm mt-1">Registro de viajes de camiones</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-5 space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <input type="password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <ErrorBanner message={error} />
          <button type="submit" disabled={loading} className={btnPrimary + " w-full"}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </div>
        <p className="text-slate-500 text-xs text-center mt-4">
          ¿No tenés cuenta? Pedile al administrador que te invite desde el panel de Supabase.
        </p>
      </form>
    </div>
  );
}
