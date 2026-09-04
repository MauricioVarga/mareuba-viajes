import React, { useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "./supabaseClient";
import { btnPrimary, ErrorBanner, CampoPassword } from "./ui";

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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F9FA] px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-[#CCCCCC]/40 overflow-hidden">
        <div className="bg-[#2E7D32] px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 w-16 h-16 bg-white rounded-full shadow-md overflow-hidden">
            <img src="/icon-192.png" alt="Mareuba" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">MAREUBA</h1>
          <p className="text-xs text-white/80 font-medium tracking-wide mt-1 uppercase">Elegí tu nueva contraseña</p>
        </div>

        <form onSubmit={submit} className="p-6 md:p-8 space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Contraseña nueva</label>
            <CampoPassword icono={Lock} required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Repetir contraseña</label>
            <CampoPassword icono={Lock} required placeholder="••••••••" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </div>
          <ErrorBanner message={error} />
          <button type="submit" disabled={loading} className={btnPrimary + " w-full"}>
            {loading ? "Guardando…" : "GUARDAR CONTRASEÑA"}
          </button>
        </form>
      </div>
    </div>
  );
}
