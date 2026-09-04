import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { inputCls, btnPrimary, btnGhost, ErrorBanner } from "./ui";

const inputOscuro = "w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500";

function Marca() {
  return (
    <div className="mb-8 text-center">
      <div className="text-amber-500 text-2xl font-semibold tracking-tight">Mareuba</div>
      <div className="text-slate-400 text-sm mt-1">Registro de viajes de camiones</div>
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
    <form onSubmit={submit} className="w-full max-w-sm">
      <Marca />
      <div className="bg-slate-800 rounded-lg p-5 space-y-3">
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputOscuro} />
        <input type="password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className={inputOscuro} />
        <ErrorBanner message={error} />
        <button type="submit" disabled={loading} className={btnPrimary + " w-full"}>
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
        <button type="button" onClick={irARecuperar} className="w-full text-center text-slate-400 hover:text-amber-400 text-sm">
          ¿Olvidaste tu contraseña?
        </button>
      </div>
      <p className="text-slate-500 text-xs text-center mt-4">
        ¿No tenés cuenta? Pedile al administrador que te invite desde el panel de Supabase.
      </p>
    </form>
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
    // redirectTo: adonde vuelve el chofer al tocar el enlace del email.
    // Tiene que estar dado de alta en Supabase → Authentication →
    // URL Configuration → Redirect URLs, si no el enlace no funciona.
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) setError("No se pudo enviar el enlace. Revisá el email e intentá de nuevo.");
    else setEnviado(true);
  };

  if (enviado) {
    return (
      <div className="w-full max-w-sm text-center">
        <Marca />
        <div className="bg-slate-800 rounded-lg p-5">
          <div className="text-white text-sm mb-1">Listo, te mandamos un enlace</div>
          <div className="text-slate-400 text-sm mb-4">Revisá {email} (y la carpeta de spam) y tocá el enlace para elegir una contraseña nueva.</div>
          <button onClick={volverALogin} className={btnGhost + " w-full"}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <Marca />
      <div className="bg-slate-800 rounded-lg p-5 space-y-3">
        <div className="text-slate-300 text-sm mb-1">Ingresá tu email y te mandamos un enlace para elegir una contraseña nueva.</div>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputOscuro} />
        <ErrorBanner message={error} />
        <button type="submit" disabled={loading} className={btnPrimary + " w-full"}>
          {loading ? "Enviando…" : "Enviar enlace"}
        </button>
        <button type="button" onClick={volverALogin} className="w-full text-center text-slate-400 hover:text-amber-400 text-sm">
          Volver
        </button>
      </div>
    </form>
  );
}

export default function Login() {
  const [modo, setModo] = useState("login"); // "login" | "recuperar"
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-8">
      {modo === "login"
        ? <FormularioLogin irARecuperar={() => setModo("recuperar")} />
        : <FormularioRecuperar volverALogin={() => setModo("login")} />}
    </div>
  );
}
