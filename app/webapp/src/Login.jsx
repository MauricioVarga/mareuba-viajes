import React, { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { supabase } from "./supabaseClient";
import { btnPrimary, ErrorBanner, CampoTexto, CampoPassword } from "./ui";

function Tarjeta({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F9FA] px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-[#CCCCCC]/40 overflow-hidden">
        <div className="bg-[#2E7D32] px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 w-16 h-16 bg-white rounded-full shadow-md overflow-hidden">
            <img src="/icon-192.png" alt="Mareuba" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">MAREUBA</h1>
          <p className="text-xs text-white/80 font-medium tracking-wide mt-1 uppercase">Registro de Viajes &amp; Logística Agro</p>
        </div>
        {children}
        <div className="bg-[#F8F9FA] px-6 py-4 border-t border-[#CCCCCC]/30 text-center">
          <p className="text-xs text-[#555555] font-medium">Sistema de Operaciones de Campo — Mareuba</p>
        </div>
      </div>
    </div>
  );
}

function FormularioLogin({ irARecuperar }) {
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
    <Tarjeta>
      <form onSubmit={submit} className="p-6 md:p-8 space-y-5">
        <ErrorBanner message={error} />

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Correo electrónico</label>
          <CampoTexto icono={Mail} type="email" required placeholder="tu@mareuba.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="password" className="block text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Contraseña</label>
            <button type="button" onClick={irARecuperar} className="text-xs font-semibold text-[#2E7D32] hover:underline">
              ¿Olvidaste tu clave?
            </button>
          </div>
          <CampoPassword icono={Lock} required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button type="submit" disabled={loading} className={btnPrimary + " w-full mt-2"}>
          {loading ? (
            <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          ) : (
            "INGRESAR AL SISTEMA"
          )}
        </button>
      </form>
    </Tarjeta>
  );
}

function FormularioRecuperar({ volverALogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) setError("No se pudo enviar el enlace. Revisá el email e intentá de nuevo.");
    else setEnviado(true);
  };

  if (enviado) {
    return (
      <Tarjeta>
        <div className="p-6 md:p-8 text-center">
          <div className="text-[#1A1A1A] font-semibold mb-1">Listo, te mandamos un enlace</div>
          <div className="text-[#555555] text-sm mb-5">Revisá {email} (y la carpeta de spam) y tocá el enlace para elegir una contraseña nueva.</div>
          <button onClick={volverALogin} className="text-sm font-semibold text-[#2E7D32] hover:underline">Volver al login</button>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <form onSubmit={submit} className="p-6 md:p-8 space-y-5">
        <p className="text-sm text-[#555555]">Ingresá tu email y te mandamos un enlace para elegir una contraseña nueva.</p>
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Correo electrónico</label>
          <CampoTexto icono={Mail} type="email" required placeholder="tu@mareuba.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <ErrorBanner message={error} />
        <button type="submit" disabled={loading} className={btnPrimary + " w-full"}>
          {loading ? "Enviando…" : "ENVIAR ENLACE"}
        </button>
        <button type="button" onClick={volverALogin} className="w-full text-center text-sm font-semibold text-[#555555] hover:text-[#1A1A1A]">
          Volver
        </button>
      </form>
    </Tarjeta>
  );
}

export default function Login() {
  const [modo, setModo] = useState("login"); // "login" | "recuperar"
  return modo === "login"
    ? <FormularioLogin irARecuperar={() => setModo("recuperar")} />
    : <FormularioRecuperar volverALogin={() => setModo("login")} />;
}
