import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env y completá los valores."
  );
}

// db.schema: "mareuba" porque todas las tablas viven en ese schema
// (no en "public"). Recordá haber agregado "mareuba" en Supabase ->
// Project Settings -> Data API -> Exposed schemas.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: "mareuba" },
});
