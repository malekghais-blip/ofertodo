import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Las librerias que casi nunca cambian (React, Supabase) van en archivos aparte:
// el navegador los guarda en cache y, cuando subes cambios a la tienda, los clientes
// solo descargan de nuevo el codigo de Ofertodo, no las librerias.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase") || id.includes("iceberg-js")) return "vendor-supabase";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
          return undefined;
        },
      },
    },
  },
});
