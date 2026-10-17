// Conexion "en vivo" con Supabase (Realtime). Vive en su propio archivo porque la libreria
// de Supabase es pesada: asi la tienda la descarga en segundo plano, despues de mostrar la
// pagina, y el panel de admin y el CRM la cargan con su propio codigo.
import { useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY, sb } from "./shared.jsx";

// Cliente OFICIAL de Supabase (a diferencia de "sb" de arriba, que es un
// envoltorio casero solo para pedidos normales) -- este SÍ soporta Realtime,
// necesario para que los mensajes del CRM entren solos a la pantalla sin
// tener que refrescar. Se usa solo para eso, "sb" sigue siendo el de siempre
// para todo lo demás.
// La opción "accessToken" es el patrón oficial de Supabase para "trae tu
// propia autenticación": con esto, supabase-js apaga su propio módulo de auth
// por completo (nunca intenta manejar una sesión ni renovar nada solo), y en
// cada conexión o reconexión de Realtime, le PREGUNTA a esta función cuál es
// el token vigente -- siempre agarra el más nuevo de "sb", sin que haya que
// estarle avisando a mano cada vez que se renueva.
export const supabaseRealtime = createClient(SUPABASE_URL, SUPABASE_KEY, {
  accessToken: async () => sb.session?.access_token ?? null,
});

// ─────────────────────────────────────────────────────────────
//  EN VIVO: avisos de la base de datos (Realtime) para que lo que hace un
//  agente aparezca solo en la pantalla de los demás, sin recargar la página.
// ─────────────────────────────────────────────────────────────

// Escucha cambios (INSERT / UPDATE / DELETE) en las tablas indicadas y llama a
// "alCambiar" con cada uno. También le pasa al canal el token de sesión
// renovado cada pocos minutos, para que no se corte al pasar la hora.
export function useCambiosEnVivo(tablas, alCambiar, activo = true) {
  const ref = useRef(alCambiar);
  ref.current = alCambiar;
  const clave = tablas.join(",");
  useEffect(() => {
    if (!activo || !clave) return;
    const nombre = `vivo_${clave.replace(/,/g, "_")}_${Math.random().toString(36).slice(2, 7)}`;
    let canal = supabaseRealtime.channel(nombre);
    clave.split(",").forEach(t => {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: t }, (payload) => {
        try { ref.current(payload); } catch (e) { console.warn("En vivo:", e); }
      });
    });
    canal.subscribe((estado, err) => {
      if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") console.warn("En vivo (" + clave + "):", estado, err?.message || "");
    });
    const renovarToken = async () => {
      try {
        await sb.ensureFreshToken();
        if (sb.session?.access_token) await supabaseRealtime.realtime.setAuth(sb.session.access_token);
      } catch (_) {}
    };
    const t = setInterval(renovarToken, 3 * 60 * 1000);
    return () => { clearInterval(t); supabaseRealtime.removeChannel(canal); };
  }, [clave, activo]);
}

