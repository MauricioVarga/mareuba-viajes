import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { card } from "./ui";
import { ViajeRow } from "./ChoferView";

function KpiCard({ label, value }) {
  return (
    <div className={card}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-800 mt-1 font-mono">{value}</div>
    </div>
  );
}

export default function GerenteView({ catalogos, viajes, cargamentos, kpiChofer, usuarios }) {
  const finalizados = viajes.filter((v) => v.id_estado === "EST_FIN");
  const kmTotales = finalizados.reduce((s, v) => s + (v.odometro_final - v.odometro_inicial), 0);

  const nombreChofer = (id) => {
    const u = usuarios.find((u) => u.id_usuario === id);
    return u ? `${u.nombre} ${u.apellido}` : "—";
  };

  const chartData = {};
  kpiChofer.forEach((row) => {
    const nombre = nombreChofer(row.id_usuario);
    chartData[nombre] = (chartData[nombre] || 0) + Number(row.km_totales || 0);
  });
  const datos = Object.entries(chartData).map(([chofer, km]) => ({ chofer, km }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Viajes finalizados" value={finalizados.length} />
        <KpiCard label="Viajes en curso" value={viajes.length - finalizados.length} />
        <KpiCard label="Km totales" value={kmTotales.toLocaleString()} />
      </div>

      <div className={card}>
        <div className="text-sm font-medium text-slate-700 mb-4">Kilómetros recorridos por chofer</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={datos}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="chofer" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="km" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="text-sm font-medium text-slate-600 mb-2">Todos los viajes</div>
        <div className="space-y-2">
          {viajes.map((v) => (
            <ViajeRow key={v.id_viaje} catalogos={catalogos} cargamentos={cargamentos} v={v} usuarios={usuarios} mostrarChofer />
          ))}
        </div>
      </div>
    </div>
  );
}
