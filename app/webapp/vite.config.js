import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "icon-512-maskable.png"],
      manifest: {
        name: "Mareuba · Registro de viajes",
        short_name: "Mareuba",
        description: "Registro de viajes de camiones",
        theme_color: "#2E7D32",
        background_color: "#F8F9FA",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cachea el "cascarón" de la app (HTML/JS/CSS/íconos) para que
        // abra aunque no haya señal. Los datos en sí (viajes, catálogos)
        // los maneja aparte la cola offline de src/offline.js — esto acá
        // es solo para que la app misma cargue sin conexión.
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        runtimeCaching: [
          {
            // Nunca cachear las llamadas a Supabase: siempre tienen que
            // ir a la red (o fallar limpio, para que nuestra cola offline
            // se haga cargo).
            urlPattern: ({ url }) => url.hostname.endsWith("supabase.co"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});
