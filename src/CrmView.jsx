import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle, Search, Send, User, Users, BarChart3, Inbox as InboxIcon,
  ChevronRight, Circle, CheckCheck, Check, Clock, RefreshCw, X, Tag,
  ArrowLeft, Zap, TrendingUp, Trophy, Target, DollarSign, ShoppingBag,
  Timer, AlertCircle, FileText, ExternalLink, Workflow, GitBranch, Plus,
  Trash2, Play, UserCheck, ToggleLeft, ToggleRight, StickyNote,
  Megaphone, Image as ImageIcon, Instagram, Plug, CheckCircle2, Upload,
  ChevronDown, Power, KeyRound, ShieldCheck,
} from "lucide-react";
import { RED, BLACK, GRAY, GRAY2, GRAY3, WHITE, S, useApp, sb, Spinner, comprimirImagen, supabaseRealtime, SUPABASE_URL } from "./shared.jsx";

// ═══════════════════════════════════════════════════════════════
//  CRM — bandeja de WhatsApp, etapas de cliente, equipo de agentes,
//  y analítica de desempeño. Vive como su propia sección grande del
//  sitio, accesible desde el link "CRM" del encabezado.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  Envío real por WhatsApp: el mensaje ya está guardado en la base
//  como "saliente"; la función whatsapp-enviar lo manda por la Cloud
//  API y devuelve el mensaje actualizado (o el motivo si falló).
//  Devuelve siempre { [id]: { ok, error, mensaje } }, sin lanzar errores.
// ─────────────────────────────────────────────────────────────
async function enviarPorWhatsApp(ids) {
  const salida = {};
  for (let i = 0; i < ids.length; i += 30) {
    const lote = ids.slice(i, i + 30);
    try {
      await sb.ensureFreshToken?.();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-enviar`, {
        method: "POST", headers: sb.functionHeaders(), body: JSON.stringify({ mensaje_ids: lote }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(data.resultados)) throw new Error(data?.error || `Error ${r.status}`);
      data.resultados.forEach(x => { salida[x.id] = x; });
    } catch (e) {
      const texto = "No se pudo conectar con el servicio de WhatsApp. Intenta de nuevo.";
      for (const id of lote) {
        try { await sb.patch("crm_mensajes", id, { estado: "fallido", error_envio: texto }); } catch { /* sin conexión */ }
        salida[id] = { id, ok: false, error: texto, mensaje: null };
      }
    }
  }
  return salida;
}

const HORAS_VENTANA = 24;
// Horas que le quedan al equipo para escribirle texto libre a este cliente
// (WhatsApp lo permite solo 24 h después del último mensaje del cliente).
function horasDeVentana(mensajes) {
  let ultimo = 0;
  for (const m of mensajes) if (m.direccion === "entrante") ultimo = Math.max(ultimo, new Date(m.created_at).getTime());
  if (!ultimo) return 0;
  return Math.max(0, HORAS_VENTANA - (Date.now() - ultimo) / 3600000);
}

const ESTADO_NUMERO = {
  CONNECTED: { texto: "Activo", bg: "#D1FAE5", color: "#065F46" },
  PENDING: { texto: "Falta activarlo", bg: "#FEF3C7", color: "#92400E" },
  FLAGGED: { texto: "Con alerta de calidad", bg: "#FEE2E2", color: "#991B1B" },
  RESTRICTED: { texto: "Restringido por Meta", bg: "#FEE2E2", color: "#991B1B" },
  DISCONNECTED: { texto: "Desconectado", bg: "#FEE2E2", color: "#991B1B" },
};
const CALIDAD_NUMERO = { GREEN: "Calidad alta", YELLOW: "Calidad media", RED: "Calidad baja", UNKNOWN: "Calidad sin medir" };

const ESTILO_TAB_ACTIVO = { color: WHITE, background: BLACK };
const ESTILO_TAB = { color: GRAY3, background: "transparent" };
const COLORES_RANKING = ["#D4AF37", "#A8A8A8", "#B08D57"]; // oro, plata, bronce

function formatoHora(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha);
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  if (esHoy) return d.toLocaleTimeString("es-PA", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("es-PA", { day: "numeric", month: "short" });
}

function formatoDuracion(minutos) {
  if (minutos === null || minutos === undefined) return "—";
  if (minutos < 1) return "<1 min";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  if (minutos < 60 * 24) return `${(minutos / 60).toFixed(1)} h`;
  return `${(minutos / 60 / 24).toFixed(1)} d`;
}

// Cuenta de 0 hasta el valor final con una curva suave -- usado en todas las
// tarjetas de KPI para que los números "lleguen" en vez de aparecer de golpe.
function useNumeroAnimado(valorFinal, duracionMs = 900) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    let inicio = null;
    const destino = Number(valorFinal) || 0;
    let frame;
    const paso = (t) => {
      if (!inicio) inicio = t;
      const progreso = Math.min((t - inicio) / duracionMs, 1);
      const suavizado = 1 - Math.pow(1 - progreso, 3); // ease-out cúbico
      setValor(destino * suavizado);
      if (progreso < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valorFinal, duracionMs]);
  return valor;
}

function NumeroAnimado({ valor, prefijo = "", sufijo = "", decimales = 0 }) {
  const animado = useNumeroAnimado(valor);
  return <>{prefijo}{animado.toLocaleString("es-PA", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}{sufijo}</>;
}

// Barra horizontal que crece de 0% a su ancho real justo después de montarse
// (en vez de aparecer ya llena) -- se usa en la distribución por etapa y en
// las mini-barras del leaderboard.
function BarraAnimada({ porcentaje, color, alto = 8 }) {
  const [ancho, setAncho] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAncho(porcentaje), 80); return () => clearTimeout(t); }, [porcentaje]);
  return (
    <div style={{ flex: 1, height: alto, background: GRAY, borderRadius: alto / 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${ancho}%`, background: color, borderRadius: alto / 2, transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)" }} />
    </div>
  );
}

// Mismo punto de quiebre (768px) que usa el resto del sitio en App.jsx/AdminView.jsx.
function useEsMobil() {
  const [esMobil, setEsMobil] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const onResize = () => setEsMobil(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return esMobil;
}

export default function CrmView() {
  const { user } = useApp();
  const esMobil = useEsMobil();
  const [tab, setTab] = useState("inbox"); // inbox | etapas | agentes | analitica
  const [etapas, setEtapas] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [conversaciones, setConversaciones] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [mensajesTodos, setMensajesTodos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // "supabaseRealtime" (el cliente oficial, necesario para Realtime) está
  // configurado en shared.jsx con la opción "accessToken", que jala el token
  // vigente de "sb" cada vez que Realtime lo necesita (al conectar, y en cada
  // reconexión) -- no hace falta empujarle el token a mano ni escuchar cuándo
  // se renueva. Solo hace falta esperar a que exista una sesión antes de armar
  // los canales.
  const sesionLista = !!sb.session;

  const cargarTodo = async () => {
    try {
      const [etapasData, agentesData, conversacionesData, pedidosData, mensajesData] = await Promise.all([
        sb.get("crm_etapas", "?order=orden.asc"),
        sb.get("usuarios", "?rol=in.(operador,admin)&select=id,nombre,email,rol"),
        sb.get("crm_conversaciones", "?order=ultimo_mensaje_at.desc.nullslast,created_at.desc"),
        sb.get("pedidos", "?select=id,codigo,nombre_cliente,telefono,total,tipo,pagado,created_at,creado_por_usuario_id&order=created_at.desc"),
        sb.get("crm_mensajes", "?select=id,conversacion_id,direccion,agente_id,created_at&order=created_at.asc"),
      ]);
      setEtapas(etapasData || []);
      setAgentes(agentesData || []);
      setConversaciones(conversacionesData || []);
      setPedidos(pedidosData || []);
      setMensajesTodos(mensajesData || []);
    } catch (e) { console.warn("Error cargando CRM:", e.message); }
    setCargando(false);
  };

  useEffect(() => { cargarTodo(); }, []);

  // En vivo: cuando llega una conversación nueva o cambia una existente
  // (nuevo mensaje, cambio de etapa, etc.), se actualiza la lista sola, sin
  // que nadie tenga que refrescar la página.
  useEffect(() => {
    if (!sesionLista) return;
    const canal = supabaseRealtime
      .channel("crm_conversaciones_en_vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_conversaciones" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setConversaciones(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setConversaciones(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        } else if (payload.eventType === "DELETE") {
          setConversaciones(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabaseRealtime.removeChannel(canal); };
  }, [sesionLista]);

  const etapaPorId = Object.fromEntries(etapas.map(e => [e.id, e]));
  const agentePorId = Object.fromEntries(agentes.map(a => [a.id, a]));

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", background: GRAY, display: "flex", flexDirection: "column" }}>
      {/* ENCABEZADO DEL CRM */}
      <div style={{ background: WHITE, borderBottom: `1px solid ${GRAY2}`, padding: esMobil ? "10px 12px" : "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: RED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageCircle size={18} color={WHITE} />
          </div>
          {!esMobil && (
            <div>
              <div style={{ fontWeight: 900, fontSize: 17 }}>CRM Ofertodo</div>
              <div style={{ fontSize: 11.5, color: GRAY3 }}>{user?.nombre || "Agente"}</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, background: GRAY, borderRadius: 10, padding: 4, overflowX: "auto", maxWidth: esMobil ? "calc(100% - 44px)" : "none" }}>
          {[["inbox", "Bandeja", InboxIcon], ["etapas", "Etapas", Tag], ["workflows", "Workflows", Workflow], ["broadcasts", "Broadcasts", Megaphone], ["agentes", "Agentes", Users], ["analitica", "Analítica", BarChart3], ["integraciones", "Integraciones", Plug]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className="oft-btn-press"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: esMobil ? "8px 10px" : "8px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: esMobil ? 12 : 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background 0.25s ease, color 0.25s ease", ...(tab === id ? ESTILO_TAB_ACTIVO : ESTILO_TAB) }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}><Spinner /></div>
      ) : (
        <div key={tab} className="oft-fade-in" style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {tab === "inbox" && (
            <InboxPanel
              conversaciones={conversaciones} setConversaciones={setConversaciones}
              etapas={etapas} etapaPorId={etapaPorId}
              agentes={agentes} agentePorId={agentePorId}
              pedidos={pedidos}
              user={user} recargar={cargarTodo}
              sesionLista={sesionLista}
            />
          )}
          {tab === "etapas" && (
            <EtapasPanel conversaciones={conversaciones} etapas={etapas} agentePorId={agentePorId} setConversaciones={setConversaciones} />
          )}
          {tab === "workflows" && (
            <WorkflowsPanel etapas={etapas} agentes={agentes} />
          )}
          {tab === "broadcasts" && (
            <BroadcastsPanel etapas={etapas} conversaciones={conversaciones} user={user} />
          )}
          {tab === "agentes" && (
            <AgentesPanel agentes={agentes} conversaciones={conversaciones} />
          )}
          {tab === "analitica" && (
            <AnaliticaPanel conversaciones={conversaciones} etapas={etapas} agentes={agentes} pedidos={pedidos} mensajes={mensajesTodos} />
          )}
          {tab === "integraciones" && (
            <IntegracionesPanel />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BANDEJA: lista de conversaciones + hilo de mensajes + panel de
//  contacto (etapa, agente asignado, pedidos/cotizaciones de ese
//  cliente con un botón para reenviárselos por WhatsApp).
// ─────────────────────────────────────────────────────────────
function InboxPanel({ conversaciones, setConversaciones, etapas, etapaPorId, agentes, agentePorId, pedidos, user, recargar, sesionLista }) {
  const esMobil = useEsMobil();
  const [seleccionada, setSeleccionada] = useState(null);
  const [vistaMobil, setVistaMobil] = useState("hilo"); // hilo | contacto -- solo aplica en móvil cuando hay una conversación abierta
  const [busqueda, setBusqueda] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviandoPedidoId, setEnviandoPedidoId] = useState(null);
  const hiloRef = useRef(null);
  const [numeros, setNumeros] = useState([]);
  const [, setReloj] = useState(0); // refresca el aviso de las 24 h sin tocar nada
  useEffect(() => {
    if (!sesionLista) return;
    sb.get("crm_numeros_whatsapp", "?order=created_at.asc").then(d => setNumeros(d || [])).catch(() => {});
  }, [sesionLista]);
  useEffect(() => { const t = setInterval(() => setReloj(x => x + 1), 60000); return () => clearInterval(t); }, []);
  const numeroPorId = Object.fromEntries(numeros.map(n => [n.id, n]));
  const variasLineas = numeros.filter(n => n.activo).length > 1;
  const nombreLinea = (id) => { const n = numeroPorId[id]; return n ? (n.etiqueta || n.numero_visible || "Línea") : null; };

  // En móvil solo se ve UNA pantalla a la vez: la lista, el chat, o el panel
  // de contacto -- igual que WhatsApp. En escritorio las 3 conviven siempre.
  const listaVisible = !esMobil || !seleccionada;
  const hiloVisible = !esMobil || (!!seleccionada && vistaMobil !== "contacto");
  const contactoVisible = esMobil ? (!!seleccionada && vistaMobil === "contacto") : !!seleccionada;

  const conversacionesFiltradas = conversaciones.filter(c => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (c.nombre_contacto || "").toLowerCase().includes(q) || (c.telefono || "").includes(q);
  });

  const cargarMensajes = async (conv) => {
    setSeleccionada(conv);
    setVistaMobil("hilo");
    try {
      const data = await sb.get("crm_mensajes", `?conversacion_id=eq.${conv.id}&order=created_at.asc`);
      setMensajes(data || []);
      if (conv.no_leidos > 0) {
        await sb.patch("crm_conversaciones", conv.id, { no_leidos: 0 });
        setConversaciones(prev => prev.map(c => c.id === conv.id ? { ...c, no_leidos: 0 } : c));
      }
    } catch (e) { console.warn("Error cargando mensajes:", e.message); }
  };

  useEffect(() => { if (hiloRef.current) hiloRef.current.scrollTop = hiloRef.current.scrollHeight; }, [mensajes]);

  // URLs firmadas para los archivos del bucket privado "crm-media" -- guardadas
  // en memoria por ruta, para no volver a pedirlas cada vez que se re-dibuja el
  // chat. Cuando llega un mensaje nuevo (por Realtime), este mismo efecto lo
  // agarra solo, porque "mensajes" cambia y se vuelve a correr.
  const [urlsFirmadas, setUrlsFirmadas] = useState({}); // ruta -> url firmada
  const [imagenAmpliada, setImagenAmpliada] = useState(null);

  useEffect(() => {
    const rutasPorFirmar = [...new Set(
      mensajes
        .map(m => m.media_url)
        .filter(u => u && !u.startsWith("http") && !u.startsWith("wa-media:") && !urlsFirmadas[u])
    )];
    if (rutasPorFirmar.length === 0) return;
    (async () => {
      try {
        const { data, error } = await supabaseRealtime.storage.from("crm-media").createSignedUrls(rutasPorFirmar, 3600);
        if (error) { console.warn("Error generando enlaces de archivos:", error.message); return; }
        const nuevas = {};
        (data || []).forEach(d => { if (d?.signedUrl && d?.path) nuevas[d.path] = d.signedUrl; });
        if (Object.keys(nuevas).length > 0) setUrlsFirmadas(prev => ({ ...prev, ...nuevas }));
      } catch (e) { console.warn("Error generando enlaces de archivos:", e.message); }
    })();
  }, [mensajes]);

  // A partir de lo guardado en el mensaje, dice qué mostrar: la URL usable ya
  // sea directa (fotos viejas de broadcasts, guardadas como URL pública) o
  // recién firmada, "cargando" mientras se pide la firma, o que el archivo
  // todavía no se pudo bajar de WhatsApp ("wa-media:" sin resolver).
  const resolverMedia = (mediaUrl) => {
    if (!mediaUrl) return { estado: "sin_media" };
    if (mediaUrl.startsWith("wa-media:")) return { estado: "no_disponible" };
    if (mediaUrl.startsWith("http")) return { estado: "lista", url: mediaUrl };
    const firmada = urlsFirmadas[mediaUrl];
    return firmada ? { estado: "lista", url: firmada } : { estado: "cargando" };
  };

  // Para poder mostrar la cita de "a qué mensaje responde" sin tener que
  // buscarlo uno por uno cada vez que se dibuja el hilo.
  const mensajesPorId = Object.fromEntries(mensajes.map(m => [m.id, m]));
  const previsualizarCita = (m) => {
    if (!m) return "Mensaje";
    if (m.contenido) return m.contenido.length > 60 ? m.contenido.slice(0, 60) + "…" : m.contenido;
    if (m.tipo === "imagen") return "📷 Foto";
    if (m.tipo === "video") return "🎥 Video";
    if (m.tipo === "audio") return "🎤 Audio";
    if (m.tipo === "documento") return "📄 Documento";
    return "Mensaje";
  };

  // En vivo: mientras una conversación está abierta, los mensajes nuevos
  // (del cliente, o de un workflow/broadcast) entran solos al hilo.
  useEffect(() => {
    if (!seleccionada || !sesionLista) return;
    const canal = supabaseRealtime
      .channel(`crm_mensajes_de_${seleccionada.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_mensajes" }, (payload) => {
        // Filtrando aquí en vez de con "filter" en la suscripción, ya que el
        // filtro del lado del servidor puede fallar en silencio con algunos
        // tipos de columna -- filtrar en el navegador es más confiable.
        if (payload.new.conversacion_id !== seleccionada.id) return;
        setMensajes(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
      })
      // Cambios de estado que manda WhatsApp (entregado, leído) o el envío (fallido).
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crm_mensajes" }, (payload) => {
        if (payload.new.conversacion_id !== seleccionada.id) return;
        setMensajes(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .subscribe();
    return () => { supabaseRealtime.removeChannel(canal); };
  }, [seleccionada?.id, sesionLista]);

  const cambiarEtapa = async (etapaId) => {
    await sb.patch("crm_conversaciones", seleccionada.id, { etapa_id: etapaId });
    setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? { ...c, etapa_id: etapaId } : c));
    setSeleccionada(prev => ({ ...prev, etapa_id: etapaId }));
  };
  const cambiarAgente = async (agenteId) => {
    await sb.patch("crm_conversaciones", seleccionada.id, { agente_id: agenteId || null });
    setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? { ...c, agente_id: agenteId || null } : c));
    setSeleccionada(prev => ({ ...prev, agente_id: agenteId || null }));
  };

  const [respondiendoA, setRespondiendoA] = useState(null); // mensaje al que se le está por responder, o null

  // Guarda el mensaje en el CRM y lo manda de verdad por WhatsApp. Si WhatsApp
  // lo rechaza (por ejemplo, pasaron más de 24 h), el mensaje queda marcado
  // "No enviado" en el chat con el motivo, y esta función devuelve ese motivo.
  const registrarMensajeSaliente = async (contenido, actualizarPreview = true, respondeAId = null) => {
    const creado = await sb.post("crm_mensajes", {
      conversacion_id: seleccionada.id, direccion: "saliente", tipo: "texto",
      contenido, agente_id: user?.id || null, estado: "enviado",
      responde_a_id: respondeAId, canal: "whatsapp",
    });
    const fila = Array.isArray(creado) ? creado[0] : null;
    if (!fila) throw new Error("No se pudo guardar el mensaje");
    setMensajes(prev => prev.some(m => m.id === fila.id) ? prev : [...prev, fila]);
    const res = (await enviarPorWhatsApp([fila.id]))[fila.id];
    const actualizado = res?.mensaje || { ...fila, estado: res?.ok ? "enviado" : "fallido", error_envio: res?.ok ? null : (res?.error || "No se pudo enviar") };
    setMensajes(prev => prev.map(m => m.id === fila.id ? { ...m, ...actualizado } : m));
    if (actualizarPreview && res?.ok) {
      const preview = contenido.length > 60 ? contenido.slice(0, 60) + "…" : contenido;
      const ahora = new Date().toISOString();
      await sb.patch("crm_conversaciones", seleccionada.id, { ultimo_mensaje_at: ahora, ultimo_mensaje_preview: preview });
      setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? { ...c, ultimo_mensaje_at: ahora, ultimo_mensaje_preview: preview } : c));
    }
    return { ok: !!res?.ok, error: res?.error || null };
  };

  const reintentarMensaje = async (m) => {
    setMensajes(prev => prev.map(x => x.id === m.id ? { ...x, estado: "enviado", error_envio: null } : x));
    const res = (await enviarPorWhatsApp([m.id]))[m.id];
    const actualizado = res?.mensaje || { estado: res?.ok ? "enviado" : "fallido", error_envio: res?.ok ? null : (res?.error || "No se pudo enviar") };
    setMensajes(prev => prev.map(x => x.id === m.id ? { ...x, ...actualizado } : x));
  };

  // Se escribe en el chat y sale por WhatsApp por la misma línea por la que
  // el cliente nos escribió. El "context" (citar el mensaje original) lo arma
  // la función de envío a partir de responde_a_id.
  const enviarMensaje = async () => {
    if (!texto.trim() || !seleccionada) return;
    setEnviando(true);
    try {
      await registrarMensajeSaliente(texto.trim(), true, respondiendoA?.id || null);
      setTexto("");
      setRespondiendoA(null);
    }
    catch (e) { alert("Error enviando: " + e.message); }
    setEnviando(false);
  };

  const enviarPedidoPorWhatsApp = async (pedido) => {
    setEnviandoPedidoId(pedido.id);
    try {
      const items = await sb.get("pedido_items", `?pedido_id=eq.${pedido.id}&select=nombre_producto,cantidad,precio_unitario,subtotal`);
      const lineas = (items || []).map((it, i) => `${i + 1}. ${it.nombre_producto} — $${Number(it.subtotal).toFixed(2)}`);
      const esCot = pedido.tipo === "cotizacion";
      const texto = `${esCot ? "Aquí tienes tu cotización" : "Aquí tienes el resumen de tu pedido"} *${pedido.codigo}*:\n\n${lineas.join("\n")}\n\nTotal: $${Number(pedido.total).toFixed(2)}${esCot ? "\n\n¿Confirmamos el pedido?" : ""}`;
      const r = await registrarMensajeSaliente(texto);
      if (!r.ok) alert("No se pudo enviar por WhatsApp:\n" + r.error);
    } catch (e) { alert("Error preparando el envío: " + e.message); }
    setEnviandoPedidoId(null);
  };

  const ventanaHoras = horasDeVentana(mensajes);
  const ventanaCerrada = !!seleccionada && mensajes.length > 0 && ventanaHoras <= 0;
  const pedidosDelContacto = seleccionada ? pedidos.filter(p => p.telefono === seleccionada.telefono) : [];

  return (
    <>
      {/* LISTA DE CONVERSACIONES */}
      {listaVisible && (
      <div className={esMobil ? "oft-fade-in" : undefined} style={{ width: esMobil ? "100%" : 340, minWidth: esMobil ? "100%" : 340, background: WHITE, borderRight: esMobil ? "none" : `1px solid ${GRAY2}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${GRAY2}` }}>
          <div style={{ position: "relative" }}>
            <Search size={15} color={GRAY3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente o número..."
              style={{ ...S.input, marginBottom: 0, paddingLeft: 32, fontSize: 13 }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversacionesFiltradas.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <InboxIcon size={36} color={GRAY2} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Sin conversaciones todavía</div>
              <div style={{ fontSize: 12.5, color: GRAY3, lineHeight: 1.5 }}>Aquí van a aparecer los chats de WhatsApp en cuanto se conecte el número.</div>
            </div>
          ) : conversacionesFiltradas.map(c => {
            const etapa = etapaPorId[c.etapa_id];
            const agente = agentePorId[c.agente_id];
            return (
              <div key={c.id} onClick={() => cargarMensajes(c)}
                style={{ padding: "13px 14px", borderBottom: `1px solid ${GRAY}`, cursor: "pointer", background: seleccionada?.id === c.id ? GRAY : WHITE, display: "flex", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: GRAY2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: 14, color: GRAY3 }}>
                  {(c.nombre_contacto || c.telefono || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                    <div style={{ fontWeight: c.no_leidos > 0 ? 800 : 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.nombre_contacto || c.telefono}
                    </div>
                    <div style={{ fontSize: 10.5, color: GRAY3, flexShrink: 0 }}>{formatoHora(c.ultimo_mensaje_at || c.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: c.no_leidos > 0 ? BLACK : GRAY3, fontWeight: c.no_leidos > 0 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {c.ultimo_mensaje_preview || "Sin mensajes"}
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                    {etapa && <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: etapa.color + "22", color: etapa.color }}>{etapa.nombre}</span>}
                    {agente && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: GRAY2, color: GRAY3 }}>{agente.nombre}</span>}
                    {c.origen === "anuncio" && <span title={c.anuncio_titulo || "Vino de un anuncio"} style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: "#DBEAFE", color: "#1E40AF", display: "inline-flex", alignItems: "center", gap: 3 }}><Megaphone size={9} /> Anuncio</span>}
                    {variasLineas && nombreLinea(c.numero_id) && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, border: `1px solid ${GRAY2}`, color: GRAY3 }}>{nombreLinea(c.numero_id)}</span>}
                    {c.no_leidos > 0 && <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: RED, color: WHITE }}>{c.no_leidos}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* HILO DE MENSAJES */}
      {hiloVisible && (
      <div key={esMobil ? (seleccionada?.id || "vacio") : "hilo"} className={esMobil ? "oft-fade-in" : undefined} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, width: esMobil ? "100%" : "auto" }}>
        {!seleccionada ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: GRAY3 }}>
            <MessageCircle size={48} color={GRAY2} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>Elige una conversación para ver los mensajes</div>
          </div>
        ) : (
          <>
            <div style={{ padding: esMobil ? "10px 12px" : "13px 20px", background: WHITE, borderBottom: `1px solid ${GRAY2}`, display: "flex", alignItems: "center", gap: 10 }}>
              {esMobil && (
                <button onClick={() => setSeleccionada(null)} className="oft-btn-press" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex", flexShrink: 0 }}>
                  <ArrowLeft size={20} />
                </button>
              )}
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: GRAY2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: GRAY3, flexShrink: 0 }}>
                {(seleccionada.nombre_contacto || seleccionada.telefono || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seleccionada.nombre_contacto || seleccionada.telefono}</div>
                <div style={{ fontSize: 11.5, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {seleccionada.telefono}
                  {seleccionada.origen === "anuncio" && <span style={{ color: "#1E40AF", fontWeight: 700 }}> · Vino de un anuncio{seleccionada.anuncio_titulo ? `: ${seleccionada.anuncio_titulo}` : ""}</span>}
                  {nombreLinea(seleccionada.numero_id) && variasLineas && <span> · por {nombreLinea(seleccionada.numero_id)}</span>}
                </div>
              </div>
              {esMobil && (
                <button onClick={() => setVistaMobil("contacto")} className="oft-btn-press" style={{ background: GRAY, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: GRAY3, flexShrink: 0 }}>
                  <Tag size={13} /> Info
                </button>
              )}
            </div>
            <div ref={hiloRef} style={{ flex: 1, overflowY: "auto", padding: esMobil ? 14 : 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {mensajes.length === 0 ? (
                <div style={{ textAlign: "center", color: GRAY3, fontSize: 13, marginTop: 40 }}>Sin mensajes en esta conversación</div>
              ) : mensajes.map(m => {
                const media = resolverMedia(m.media_url);
                const tieneMedia = m.tipo === "imagen" || m.tipo === "video" || m.tipo === "audio" || m.tipo === "documento";
                const colorSecundario = m.direccion === "saliente" ? "rgba(255,255,255,0.65)" : GRAY3;
                const mensajeCitado = m.responde_a_id ? mensajesPorId[m.responde_a_id] : null;
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "flex-end", gap: 4, justifyContent: m.direccion === "saliente" ? "flex-end" : "flex-start" }}>
                    {m.direccion === "saliente" && (
                      <button onClick={() => setRespondiendoA(m)} className="oft-btn-press" title="Responder"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: GRAY3, flexShrink: 0 }}>
                        <ArrowLeft size={13} style={{ transform: "scaleX(-1)" }} />
                      </button>
                    )}
                    <div style={{ maxWidth: esMobil ? "80%" : "62%", padding: tieneMedia ? 6 : "9px 13px", borderRadius: 14, background: m.direccion === "saliente" ? BLACK : WHITE, color: m.direccion === "saliente" ? WHITE : BLACK, border: m.direccion === "entrante" ? `1px solid ${GRAY2}` : "none", fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>

                      {mensajeCitado && (
                        <div style={{ borderLeft: `3px solid ${m.direccion === "saliente" ? "rgba(255,255,255,0.4)" : RED}`, background: m.direccion === "saliente" ? "rgba(255,255,255,0.08)" : GRAY, borderRadius: 6, padding: "5px 8px", marginBottom: 6, fontSize: 12, color: colorSecundario, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {previsualizarCita(mensajeCitado)}
                        </div>
                      )}

                      {m.tipo === "imagen" && (
                        media.estado === "lista" ? (
                          <img src={media.url} onClick={() => setImagenAmpliada(media.url)}
                            style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 9, display: "block", marginBottom: m.contenido ? 6 : 0, cursor: "zoom-in" }} />
                        ) : (
                          <div style={{ width: 220, height: 150, borderRadius: 9, background: m.direccion === "saliente" ? "rgba(255,255,255,0.08)" : GRAY, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: m.contenido ? 6 : 0 }}>
                            {media.estado === "cargando" ? <Spinner /> : <span style={{ fontSize: 12, color: colorSecundario, fontStyle: "italic" }}>Archivo no disponible</span>}
                          </div>
                        )
                      )}

                      {m.tipo === "video" && (
                        media.estado === "lista" ? (
                          <video controls src={media.url} style={{ width: "100%", maxHeight: 260, borderRadius: 9, display: "block", marginBottom: m.contenido ? 6 : 0 }} />
                        ) : (
                          <div style={{ width: 220, height: 150, borderRadius: 9, background: m.direccion === "saliente" ? "rgba(255,255,255,0.08)" : GRAY, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: m.contenido ? 6 : 0 }}>
                            {media.estado === "cargando" ? <Spinner /> : <span style={{ fontSize: 12, color: colorSecundario, fontStyle: "italic" }}>Archivo no disponible</span>}
                          </div>
                        )
                      )}

                      {m.tipo === "audio" && (
                        media.estado === "lista" ? (
                          <audio controls src={media.url} style={{ width: 230, display: "block", marginBottom: m.contenido ? 6 : 2 }} />
                        ) : (
                          <div style={{ fontSize: 12, color: colorSecundario, fontStyle: "italic", padding: "4px 2px" }}>
                            {media.estado === "cargando" ? "Cargando audio..." : "Archivo no disponible"}
                          </div>
                        )
                      )}

                      {m.tipo === "documento" && (
                        media.estado === "lista" ? (
                          <a href={media.url} download={m.contenido || "documento"} target="_blank" rel="noreferrer"
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9, background: m.direccion === "saliente" ? "rgba(255,255,255,0.1)" : GRAY, color: "inherit", textDecoration: "none" }}>
                            <FileText size={18} style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.contenido || "Documento"}</span>
                          </a>
                        ) : (
                          <div style={{ fontSize: 12, color: colorSecundario, fontStyle: "italic", padding: "4px 2px" }}>
                            {media.estado === "cargando" ? "Cargando documento..." : "Archivo no disponible"}
                          </div>
                        )
                      )}

                      <div style={{ padding: tieneMedia ? "0 7px" : 0 }}>
                        {/* Para documentos, "contenido" ya se usó arriba como nombre del archivo -- no se repite */}
                        {m.tipo !== "documento" && m.contenido}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4, marginBottom: tieneMedia ? 4 : 0, opacity: 0.6, fontSize: 10 }}>
                          {formatoHora(m.created_at)}
                          {m.direccion === "saliente" && (m.estado === "fallido" ? <AlertCircle size={12} color="#FCA5A5" /> : m.estado === "leido" ? <CheckCheck size={12} color="#7DD3FC" /> : m.estado === "entregado" ? <CheckCheck size={12} /> : <Check size={12} />)}
                        </div>
                        {m.direccion === "saliente" && m.estado === "fallido" && (
                          <div style={{ marginTop: 6, padding: "7px 9px", borderRadius: 8, background: "rgba(220,38,38,0.18)", fontSize: 11.5, lineHeight: 1.4, color: "#FECACA", whiteSpace: "normal" }}>
                            <strong style={{ color: "#FCA5A5" }}>No enviado.</strong> {m.error_envio || "WhatsApp no pudo entregar este mensaje."}
                            {!/24 horas/.test(m.error_envio || "") && (
                              <button onClick={() => reintentarMensaje(m)} className="oft-btn-press" style={{ display: "block", marginTop: 5, background: "rgba(255,255,255,0.14)", border: "none", color: WHITE, borderRadius: 6, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reintentar</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {m.direccion === "entrante" && (
                      <button onClick={() => setRespondiendoA(m)} className="oft-btn-press" title="Responder"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: GRAY3, flexShrink: 0 }}>
                        <ArrowLeft size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {imagenAmpliada && createPortal(
              <div onClick={() => setImagenAmpliada(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}>
                <img src={imagenAmpliada} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} onClick={e => e.stopPropagation()} />
              </div>,
              document.body
            )}
            <div style={{ background: WHITE, borderTop: `1px solid ${GRAY2}` }}>
              {respondiendoA && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${GRAY2}`, background: GRAY }}>
                  <div style={{ width: 3, alignSelf: "stretch", background: RED, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: RED }}>Respondiendo a {respondiendoA.direccion === "saliente" ? "tu mensaje" : (seleccionada.nombre_contacto || "cliente")}</div>
                    <div style={{ fontSize: 12, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previsualizarCita(respondiendoA)}</div>
                  </div>
                  <button onClick={() => setRespondiendoA(null)} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
                    <X size={16} color={GRAY3} />
                  </button>
                </div>
              )}
              {mensajes.length > 0 && ventanaHoras <= 0 && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 14px", background: "#FEF3C7", color: "#92400E", fontSize: 12, lineHeight: 1.4 }}>
                  <Clock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp solo deja escribirle de nuevo cuando él te escriba otra vez.</span>
                </div>
              )}
              {mensajes.length > 0 && ventanaHoras > 0 && ventanaHoras < 3 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "#FEF3C7", color: "#92400E", fontSize: 12 }}>
                  <Clock size={13} style={{ flexShrink: 0 }} />
                  <span>Te {ventanaHoras < 1 ? "queda menos de 1 hora" : `quedan unas ${Math.ceil(ventanaHoras)} horas`} para responderle.</span>
                </div>
              )}
              <div style={{ padding: 14, display: "flex", gap: 8 }}>
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder={ventanaCerrada ? "Esperando que el cliente escriba..." : "Escribe un mensaje..."} disabled={ventanaCerrada}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensaje(); } }}
                  style={{ ...S.input, marginBottom: 0, flex: 1, opacity: ventanaCerrada ? 0.6 : 1 }} />
                <button onClick={enviarMensaje} disabled={enviando || !texto.trim() || ventanaCerrada} className="oft-btn-press"
                  style={{ background: BLACK, color: WHITE, border: "none", borderRadius: 10, width: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: enviando || !texto.trim() || ventanaCerrada ? 0.5 : 1 }}>
                  <Send size={17} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* PANEL DE CONTACTO */}
      {contactoVisible && (
        <div className={esMobil ? "oft-fade-in" : undefined} style={{ width: esMobil ? "100%" : 290, minWidth: esMobil ? "100%" : 290, background: WHITE, borderLeft: esMobil ? "none" : `1px solid ${GRAY2}`, padding: 20, overflowY: "auto" }}>
          {esMobil && (
            <button onClick={() => setVistaMobil("hilo")} className="oft-btn-press" style={{ background: "none", border: "none", padding: 4, marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: GRAY3 }}>
              <ArrowLeft size={18} /> Volver al chat
            </button>
          )}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: GRAY2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22, color: GRAY3, margin: "0 auto 10px" }}>
              {(seleccionada.nombre_contacto || seleccionada.telefono || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{seleccionada.nombre_contacto || "Sin nombre"}</div>
            <div style={{ fontSize: 12.5, color: GRAY3 }}>{seleccionada.telefono}</div>
          </div>

          {seleccionada.origen === "anuncio" && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "10px 12px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#1E40AF" }}><Megaphone size={13} /> Llegó desde un anuncio</div>
              {seleccionada.anuncio_titulo && <div style={{ fontSize: 12.5, color: BLACK, marginTop: 5, lineHeight: 1.4 }}>{seleccionada.anuncio_titulo}</div>}
              {seleccionada.anuncio_url && (
                <a href={seleccionada.anuncio_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11.5, fontWeight: 700, color: "#1E40AF", textDecoration: "none" }}>
                  Ver el anuncio <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>ETAPA</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {etapas.map(et => (
              <button key={et.id} onClick={() => cambiarEtapa(et.id)} className="oft-btn-press"
                style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 7, cursor: "pointer", border: `1.5px solid ${seleccionada.etapa_id === et.id ? et.color : GRAY2}`, background: seleccionada.etapa_id === et.id ? et.color + "1A" : WHITE, color: seleccionada.etapa_id === et.id ? et.color : GRAY3 }}>
                {et.nombre}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>AGENTE ASIGNADO</div>
          <select value={seleccionada.agente_id || ""} onChange={e => cambiarAgente(e.target.value)} style={{ ...S.input, marginBottom: 20, fontSize: 13 }}>
            <option value="">Sin asignar</option>
            {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>

          <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>PEDIDOS Y COTIZACIONES</div>
          {pedidosDelContacto.length === 0 ? (
            <div style={{ fontSize: 12, color: GRAY3, background: GRAY, borderRadius: 10, padding: 12, textAlign: "center" }}>
              Sin pedidos ni cotizaciones para este número todavía.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pedidosDelContacto.map(p => (
                <div key={p.id} style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div style={{ fontWeight: 800, fontSize: 12.5 }}>{p.codigo}</div>
                    <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 5, background: p.tipo === "cotizacion" ? "#FEF3C7" : p.pagado ? "#D1FAE5" : "#FEE2E2", color: p.tipo === "cotizacion" ? "#92400E" : p.pagado ? "#065F46" : "#991B1B" }}>
                      {p.tipo === "cotizacion" ? "Cotización" : p.pagado ? "Pagado" : "Sin pagar"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 8 }}>${Number(p.total).toFixed(2)}</div>
                  <button onClick={() => enviarPedidoPorWhatsApp(p)} disabled={enviandoPedidoId === p.id} className="oft-btn-press"
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 0", borderRadius: 7, border: "none", background: BLACK, color: WHITE, fontWeight: 700, fontSize: 11.5, cursor: "pointer", opacity: enviandoPedidoId === p.id ? 0.6 : 1 }}>
                    <Send size={12} /> {enviandoPedidoId === p.id ? "Enviando..." : "Enviar por WhatsApp"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  ETAPAS: tablero tipo kanban -- una columna por etapa, con las
//  conversaciones que están ahí. Mover de etapa es con un clic.
// ─────────────────────────────────────────────────────────────
function EtapasPanel({ conversaciones, etapas, agentePorId, setConversaciones }) {
  const esMobil = useEsMobil();
  const [etapaMobil, setEtapaMobil] = useState(null); // etapa elegida en el selector de píldoras, en móvil

  useEffect(() => { if (esMobil && etapas.length > 0 && !etapaMobil) setEtapaMobil(etapas[0].id); }, [esMobil, etapas]);

  const moverA = async (conv, etapaId) => {
    await sb.patch("crm_conversaciones", conv.id, { etapa_id: etapaId });
    setConversaciones(prev => prev.map(c => c.id === conv.id ? { ...c, etapa_id: etapaId } : c));
  };

  // En móvil, el tablero horizontal de columnas obligaba a deslizar de lado
  // para ver las etapas siguientes. Aquí se elige UNA etapa a la vez con
  // píldoras arriba, y abajo su lista completa a lo ancho de la pantalla.
  if (esMobil) {
    const items = conversaciones.filter(c => c.etapa_id === etapaMobil);
    return (
      <div key="etapas-mobil" className="oft-fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 8, padding: "12px", overflowX: "auto", WebkitOverflowScrolling: "touch", flexShrink: 0 }}>
          {etapas.map(etapa => {
            const cantidad = conversaciones.filter(c => c.etapa_id === etapa.id).length;
            const activa = etapaMobil === etapa.id;
            return (
              <button key={etapa.id} onClick={() => setEtapaMobil(etapa.id)} className="oft-btn-press"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 20, border: `1.5px solid ${activa ? etapa.color : GRAY2}`, background: activa ? etapa.color : WHITE, color: activa ? WHITE : GRAY3, fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background 0.2s, border-color 0.2s, color 0.2s" }}>
                {etapa.nombre}
                <span style={{ background: activa ? "rgba(255,255,255,0.3)" : GRAY, color: activa ? WHITE : GRAY3, borderRadius: 10, padding: "1px 6px", fontSize: 10.5, fontWeight: 800 }}>{cantidad}</span>
              </button>
            );
          })}
        </div>
        <div key={etapaMobil} className="oft-fade-in" style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", color: GRAY3, fontSize: 12.5, padding: "40px 12px" }}>Sin clientes en esta etapa</div>
          ) : items.map(c => (
            <div key={c.id} style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 12, padding: 13 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>{c.nombre_contacto || c.telefono}</div>
              <div style={{ fontSize: 12, color: GRAY3, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultimo_mensaje_preview || "Sin mensajes"}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {etapas.filter(e => e.id !== etapaMobil).map(e => (
                  <button key={e.id} onClick={() => moverA(c, e.id)} className="oft-btn-press"
                    style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 9px", borderRadius: 6, border: `1px solid ${e.color}55`, background: `${e.color}14`, color: e.color, cursor: "pointer" }}>
                    → {e.nombre}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowX: "auto", padding: 20, display: "flex", gap: 16 }}>
      {etapas.map(etapa => {
        const items = conversaciones.filter(c => c.etapa_id === etapa.id);
        return (
          <div key={etapa.id} style={{ minWidth: 270, width: 270, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px" }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: etapa.color }} />
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{etapa.nombre}</div>
              <div style={{ fontSize: 11.5, color: GRAY3, fontWeight: 700 }}>{items.length}</div>
            </div>
            <div style={{ background: WHITE, borderRadius: 12, padding: 8, flex: 1, minHeight: 200, display: "flex", flexDirection: "column", gap: 8 }}>
              {items.length === 0 ? (
                <div style={{ textAlign: "center", color: GRAY3, fontSize: 11.5, padding: "20px 8px" }}>Sin clientes en esta etapa</div>
              ) : items.map(c => (
                <div key={c.id} style={{ border: `1px solid ${GRAY2}`, borderRadius: 9, padding: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>{c.nombre_contacto || c.telefono}</div>
                  <div style={{ fontSize: 11, color: GRAY3, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultimo_mensaje_preview || "Sin mensajes"}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {etapas.filter(e => e.id !== etapa.id).map(e => (
                      <button key={e.id} onClick={() => moverA(c, e.id)} className="oft-btn-press"
                        style={{ fontSize: 9.5, fontWeight: 700, padding: "3px 7px", borderRadius: 5, border: "none", background: GRAY, color: GRAY3, cursor: "pointer" }}>
                        → {e.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  AGENTES: lista del equipo con cuántas conversaciones lleva
//  cada uno ahora mismo.
// ─────────────────────────────────────────────────────────────
function AgentesPanel({ agentes, conversaciones }) {
  const esMobil = useEsMobil();
  return (
    <div style={{ flex: 1, padding: esMobil ? 14 : 24, overflowY: "auto" }}>
      <div style={{ fontSize: 13, color: GRAY3, marginBottom: 18, maxWidth: 560 }}>
        Los agentes son las mismas cuentas de operador del panel de administrador. Para agregar uno nuevo, promuévelo desde Admin → Equipo. El desempeño de cada uno está en la pestaña "Analítica".
      </div>
      <div style={{ display: "grid", gridTemplateColumns: esMobil ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {agentes.map(a => {
          const asignadas = conversaciones.filter(c => c.agente_id === a.id).length;
          return (
            <div key={a.id} style={{ background: WHITE, borderRadius: 14, padding: 18, border: `1px solid ${GRAY2}` }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: BLACK, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17, marginBottom: 10 }}>
                {(a.nombre || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>{a.nombre}</div>
              <div style={{ fontSize: 11.5, color: GRAY3, marginBottom: 10 }}>{a.email}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: RED }}>{asignadas} conversación{asignadas !== 1 ? "es" : ""} asignada{asignadas !== 1 ? "s" : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Calcula, para cada agente, tiempo de respuesta promedio, tasa de
// conversión, ventas generadas y volumen de mensajes -- todo derivado de
// las conversaciones, los mensajes, y los pedidos reales (cruzados por
// número de teléfono).
function calcularMetricasAgentes(agentes, conversaciones, mensajes, pedidos) {
  const porAgente = {};
  agentes.forEach(a => { porAgente[a.id] = { agente: a, asignadas: 0, tiemposRespuesta: [], mensajesEnviados: 0, convertidas: 0, ventasTotal: 0 }; });

  conversaciones.forEach(c => { if (c.agente_id && porAgente[c.agente_id]) porAgente[c.agente_id].asignadas++; });

  const mensajesPorConv = {};
  mensajes.forEach(m => { (mensajesPorConv[m.conversacion_id] ||= []).push(m); });

  Object.values(mensajesPorConv).forEach(lista => {
    let esperandoDesde = null;
    for (const m of lista) {
      if (m.direccion === "entrante") {
        if (esperandoDesde === null) esperandoDesde = m.created_at;
      } else if (m.direccion === "saliente" && m.agente_id && porAgente[m.agente_id]) {
        porAgente[m.agente_id].mensajesEnviados++;
        if (esperandoDesde) {
          porAgente[m.agente_id].tiemposRespuesta.push((new Date(m.created_at) - new Date(esperandoDesde)) / 60000);
          esperandoDesde = null;
        }
      }
    }
  });

  const ventasPorTelefono = {};
  pedidos.forEach(p => {
    if (p.pagado && p.tipo !== "cotizacion") ventasPorTelefono[p.telefono] = (ventasPorTelefono[p.telefono] || 0) + Number(p.total || 0);
  });

  conversaciones.forEach(c => {
    if (c.agente_id && porAgente[c.agente_id] && ventasPorTelefono[c.telefono]) {
      porAgente[c.agente_id].convertidas++;
      porAgente[c.agente_id].ventasTotal += ventasPorTelefono[c.telefono];
    }
  });

  return Object.values(porAgente).map(p => ({
    ...p,
    tiempoRespuestaPromedio: p.tiemposRespuesta.length ? p.tiemposRespuesta.reduce((a, b) => a + b, 0) / p.tiemposRespuesta.length : null,
    tasaConversion: p.asignadas > 0 ? (p.convertidas / p.asignadas) * 100 : 0,
  })).sort((a, b) => b.ventasTotal - a.ventasTotal || b.tasaConversion - a.tasaConversion);
}

// ─────────────────────────────────────────────────────────────
//  ANALÍTICA: KPIs generales, leaderboard de agentes (tiempo de
//  respuesta, tasa de conversión, ventas generadas), y distribución
//  de clientes por etapa.
// ─────────────────────────────────────────────────────────────
function AnaliticaPanel({ conversaciones, etapas, agentes, pedidos, mensajes }) {
  const esMobil = useEsMobil();
  const metricas = calcularMetricasAgentes(agentes, conversaciones, mensajes, pedidos);
  const total = conversaciones.length;
  const porEtapa = etapas.map(e => ({ ...e, total: conversaciones.filter(c => c.etapa_id === e.id).length }));
  const sinResponder = conversaciones.filter(c => c.no_leidos > 0).length;

  const tiempoRespuestaGlobal = (() => {
    const todos = metricas.flatMap(m => m.tiemposRespuesta);
    return todos.length ? todos.reduce((a, b) => a + b, 0) / todos.length : null;
  })();
  const ventasTotalGlobal = metricas.reduce((s, m) => s + m.ventasTotal, 0);
  const asignadasTotal = metricas.reduce((s, m) => s + m.asignadas, 0);
  const convertidasTotal = metricas.reduce((s, m) => s + m.convertidas, 0);
  const tasaConversionGlobal = asignadasTotal > 0 ? (convertidasTotal / asignadasTotal) * 100 : 0;

  const maxVentas = Math.max(...metricas.map(m => m.ventasTotal), 1);

  return (
    <div style={{ flex: 1, padding: esMobil ? 14 : 24, overflowY: "auto" }}>
      {/* KPIs GLOBALES */}
      <div style={{ display: "grid", gridTemplateColumns: esMobil ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(200px, 1fr))", gap: esMobil ? 10 : 14, marginBottom: esMobil ? 20 : 28 }}>
        <TarjetaMetrica icono={InboxIcon} valor={total} etiqueta="Conversaciones totales" esMobil={esMobil} />
        <TarjetaMetrica icono={Timer} valor={tiempoRespuestaGlobal !== null ? Math.round(tiempoRespuestaGlobal) : 0} sufijo=" min" etiqueta="Tiempo de respuesta promedio" mostrarGuion={tiempoRespuestaGlobal === null} esMobil={esMobil} />
        <TarjetaMetrica icono={Target} valor={Math.round(tasaConversionGlobal)} sufijo="%" etiqueta="Tasa de conversión" esMobil={esMobil} />
        <TarjetaMetrica icono={DollarSign} valor={ventasTotalGlobal} prefijo="$" decimales={2} etiqueta="Ventas generadas por leads" esMobil={esMobil} />
        <TarjetaMetrica icono={AlertCircle} valor={sinResponder} etiqueta="Leads esperando respuesta" alerta={sinResponder > 0} esMobil={esMobil} />
      </div>

      {/* LEADERBOARD */}
      <div style={{ background: WHITE, borderRadius: 16, padding: esMobil ? 16 : 22, border: `1px solid ${GRAY2}`, marginBottom: esMobil ? 16 : 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Trophy size={18} color="#D4AF37" />
          <div style={{ fontWeight: 900, fontSize: 15.5 }}>Ranking de agentes</div>
        </div>
        <div style={{ fontSize: 12, color: GRAY3, marginBottom: 18 }}>Ordenado por ventas generadas, incluyendo admins con conversaciones asignadas.</div>

        {metricas.length === 0 ? (
          <div style={{ textAlign: "center", color: GRAY3, fontSize: 13, padding: "30px 0" }}>Sin agentes con conversaciones asignadas todavía.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {metricas.map((m, i) => esMobil ? (
              // Fila apilada para móvil: nombre + ventas arriba, barra en medio,
              // conversión y tiempo de respuesta abajo -- nada se corta.
              <div key={m.agente.id} className="oft-fade-in" style={{ animationDelay: `${i * 60}ms`, padding: "12px 14px", borderRadius: 12, background: i < 3 ? `${COLORES_RANKING[i]}0D` : GRAY, border: i < 3 ? `1px solid ${COLORES_RANKING[i]}44` : `1px solid transparent` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0, background: i < 3 ? COLORES_RANKING[i] : GRAY2, color: i < 3 ? WHITE : GRAY3 }}>
                    {i + 1}
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: BLACK, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    {(m.agente.nombre || "?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.agente.nombre}</div>
                    <div style={{ fontSize: 10, color: GRAY3 }}>{m.asignadas} conversación{m.asignadas !== 1 ? "es" : ""}</div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 15, color: RED, flexShrink: 0 }}>${m.ventasTotal.toFixed(0)}</div>
                </div>
                <BarraAnimada porcentaje={(m.ventasTotal / maxVentas) * 100} color={i < 3 ? COLORES_RANKING[i] : BLACK} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10.5, color: GRAY3, fontWeight: 700 }}>
                  <span>{m.tasaConversion.toFixed(0)}% conversión</span>
                  <span>{formatoDuracion(m.tiempoRespuestaPromedio)} respuesta</span>
                </div>
              </div>
            ) : (
              <div key={m.agente.id} className="oft-fade-in" style={{ animationDelay: `${i * 60}ms`, display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: i < 3 ? `${COLORES_RANKING[i]}0D` : GRAY, border: i < 3 ? `1px solid ${COLORES_RANKING[i]}44` : `1px solid transparent` }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0, background: i < 3 ? COLORES_RANKING[i] : GRAY2, color: i < 3 ? WHITE : GRAY3 }}>
                  {i + 1}
                </div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: BLACK, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {(m.agente.nombre || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.agente.nombre}</div>
                  <div style={{ fontSize: 10.5, color: GRAY3 }}>{m.asignadas} conversación{m.asignadas !== 1 ? "es" : ""}</div>
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <BarraAnimada porcentaje={(m.ventasTotal / maxVentas) * 100} color={i < 3 ? COLORES_RANKING[i] : BLACK} />
                </div>
                <div style={{ width: 84, textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: RED }}>${m.ventasTotal.toFixed(0)}</div>
                  <div style={{ fontSize: 10, color: GRAY3 }}>{m.tasaConversion.toFixed(0)}% conversión</div>
                </div>
                <div style={{ width: 74, textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{formatoDuracion(m.tiempoRespuestaPromedio)}</div>
                  <div style={{ fontSize: 10, color: GRAY3 }}>respuesta</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: esMobil ? "1fr" : "1.2fr 1fr", gap: esMobil ? 12 : 16 }}>
        {/* DISTRIBUCIÓN POR ETAPA */}
        <div style={{ background: WHITE, borderRadius: 16, padding: esMobil ? 16 : 20, border: `1px solid ${GRAY2}` }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 16 }}>Clientes por etapa</div>
          {porEtapa.map(e => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: esMobil ? 90 : 110, fontSize: 12.5, fontWeight: 700, color: GRAY3, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nombre}</div>
              <BarraAnimada porcentaje={total > 0 ? (e.total / total) * 100 : 0} color={e.color} />
              <div style={{ width: 24, fontSize: 12.5, fontWeight: 800, textAlign: "right" }}>{e.total}</div>
            </div>
          ))}
        </div>

        {/* PRODUCTIVIDAD POR AGENTE */}
        <div style={{ background: WHITE, borderRadius: 16, padding: esMobil ? 16 : 20, border: `1px solid ${GRAY2}` }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 4 }}>Mensajes respondidos</div>
          <div style={{ fontSize: 11.5, color: GRAY3, marginBottom: 16 }}>Volumen de respuestas enviadas por cada agente</div>
          {metricas.filter(m => m.mensajesEnviados > 0).length === 0 ? (
            <div style={{ textAlign: "center", color: GRAY3, fontSize: 12.5, padding: "20px 0" }}>Sin mensajes enviados todavía.</div>
          ) : (
            [...metricas].sort((a, b) => b.mensajesEnviados - a.mensajesEnviados).map(m => {
              const maxMsj = Math.max(...metricas.map(x => x.mensajesEnviados), 1);
              return (
                <div key={m.agente.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: esMobil ? 80 : 90, fontSize: 12.5, fontWeight: 700, color: GRAY3, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.agente.nombre}</div>
                  <BarraAnimada porcentaje={(m.mensajesEnviados / maxMsj) * 100} color={BLACK} />
                  <div style={{ width: 24, fontSize: 12.5, fontWeight: 800, textAlign: "right" }}>{m.mensajesEnviados}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 11.5, color: GRAY3, textAlign: "center" }}>
        Tiempo de respuesta: promedio entre que un cliente escribe y un agente responde. Conversión: % de conversaciones asignadas con al menos una venta pagada.
      </div>
    </div>
  );
}

function TarjetaMetrica({ icono: Icono, valor, prefijo = "", sufijo = "", decimales = 0, etiqueta, alerta = false, mostrarGuion = false, esMobil = false }) {
  return (
    <div className="oft-fade-in" style={{ background: WHITE, borderRadius: 14, padding: esMobil ? 12 : 18, border: `1px solid ${alerta ? "#FCA5A5" : GRAY2}` }}>
      <Icono size={esMobil ? 15 : 18} color={alerta ? RED : RED} style={{ marginBottom: esMobil ? 5 : 8 }} />
      <div style={{ fontSize: esMobil ? 19 : 26, fontWeight: 900 }}>{mostrarGuion ? "—" : <NumeroAnimado valor={valor} prefijo={prefijo} sufijo={sufijo} decimales={decimales} />}</div>
      <div style={{ fontSize: esMobil ? 10.5 : 12, color: GRAY3, fontWeight: 600, lineHeight: 1.3 }}>{etiqueta}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  WORKFLOWS — automatizaciones con un disparador y una cadena de
//  pasos (que se puede ramificar), inspirado en cómo lo arma
//  respond.io, pero enfocado a lo que Ofertodo necesita.
// ═══════════════════════════════════════════════════════════════

const TIPOS_TRIGGER = {
  conversacion_nueva: { icono: Play, label: "Conversación nueva", descripcion: "Cuando un cliente escribe por primera vez" },
  etapa_cambiada: { icono: Tag, label: "Etapa cambiada", descripcion: "Cuando un cliente entra a una etapa específica" },
  sin_responder: { icono: Timer, label: "Sin responder", descripcion: "Cuando un cliente lleva tiempo esperando respuesta" },
  agente_asignado: { icono: UserCheck, label: "Agente asignado", descripcion: "Cuando se le asigna un agente a la conversación" },
};

const TIPOS_PASO = {
  enviar_mensaje: { icono: Send, label: "Enviar mensaje", color: "#3B82F6" },
  esperar: { icono: Clock, label: "Esperar", color: "#F59E0B" },
  cambiar_etapa: { icono: Tag, label: "Cambiar etapa", color: RED },
  asignar_agente: { icono: Users, label: "Asignar agente", color: "#8B5CF6" },
  agregar_nota: { icono: StickyNote, label: "Agregar nota interna", color: "#6B7280" },
  bifurcacion: { icono: GitBranch, label: "Condición (Sí / No)", color: BLACK },
};

function generarIdPaso() { return `p${Date.now()}${Math.floor(Math.random() * 10000)}`; }

// ─────────────────────────────────────────────────────────────
//  LISTA: todos los workflows, con su estado y cu\u00e1ntas veces se
//  han activado. Desde aqu\u00ed se crea uno nuevo o se abre a editar.
// ─────────────────────────────────────────────────────────────
function WorkflowsPanel({ etapas, agentes }) {
  const esMobil = useEsMobil();
  const [workflows, setWorkflows] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // null | "nuevo" | objeto workflow

  const cargar = async () => {
    setCargando(true);
    try { setWorkflows(await sb.get("crm_workflows", "?order=created_at.desc") || []); }
    catch (e) { console.warn("Error cargando workflows:", e.message); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const alternarActivo = async (wf) => {
    await sb.patch("crm_workflows", wf.id, { activo: !wf.activo });
    setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, activo: !w.activo } : w));
  };

  const eliminar = async (wf) => {
    if (!confirm(`¿Eliminar el workflow "${wf.nombre}"? Esto no se puede deshacer.`)) return;
    await sb.delete("crm_workflows", wf.id);
    setWorkflows(prev => prev.filter(w => w.id !== wf.id));
  };

  if (editando) {
    return (
      <WorkflowEditor
        workflow={editando === "nuevo" ? null : editando}
        etapas={etapas} agentes={agentes}
        onCerrar={() => setEditando(null)}
        onGuardado={() => { setEditando(null); cargar(); }}
      />
    );
  }

  return (
    <div style={{ flex: 1, padding: esMobil ? 14 : 24, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>Workflows</div>
          <div style={{ fontSize: 12.5, color: GRAY3 }}>Automatiza mensajes, cambios de etapa, y asignaciones sin tener que hacerlo a mano.</div>
        </div>
        <button onClick={() => setEditando("nuevo")} className="oft-btn-press"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", background: RED, color: WHITE, fontWeight: 700, fontSize: 13.5, cursor: "pointer", flexShrink: 0 }}>
          <Plus size={16} /> Crear workflow
        </button>
      </div>

      {cargando ? (
        <div style={{ padding: 40, textAlign: "center" }}><Spinner /></div>
      ) : workflows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: GRAY3 }}>
          <Workflow size={40} color={GRAY2} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4, color: BLACK }}>Todavía no tienes workflows</div>
          <div style={{ fontSize: 13 }}>Crea el primero para automatizar tu bandeja.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: esMobil ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginTop: 18 }}>
          {workflows.map((wf, i) => {
            const trig = TIPOS_TRIGGER[wf.trigger_tipo];
            return (
              <div key={wf.id} className="oft-fade-in" style={{ animationDelay: `${i * 50}ms`, background: WHITE, borderRadius: 14, padding: 16, border: `1px solid ${GRAY2}`, cursor: "pointer" }} onClick={() => setEditando(wf)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wf.nombre}</div>
                  <button onClick={e => { e.stopPropagation(); alternarActivo(wf); }} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0, marginLeft: 8 }}>
                    {wf.activo ? <ToggleRight size={26} color="#10B981" /> : <ToggleLeft size={26} color={GRAY3} />}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: GRAY3, marginBottom: 12 }}>
                  {trig && <trig.icono size={13} />} {trig?.label}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: wf.activo ? "#D1FAE5" : GRAY, color: wf.activo ? "#065F46" : GRAY3 }}>
                    {wf.activo ? "Publicado" : "Borrador"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: GRAY3, fontWeight: 700 }}>{wf.veces_activado || 0} activaciones</span>
                    <button onClick={e => { e.stopPropagation(); eliminar(wf); }} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                      <Trash2 size={14} color={GRAY3} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  EDITOR: arma el disparador y la cadena de pasos de un workflow.
//  Los pasos se guardan como una lista plana con punteros
//  ("siguiente", o "siguiente_si"/"siguiente_no" en una bifurcación)
//  -- así se pueden insertar, ramificar, y borrar sin reacomodar
//  todo un árbol.
// ─────────────────────────────────────────────────────────────
function WorkflowEditor({ workflow, etapas, agentes, onCerrar, onGuardado }) {
  const esMobil = useEsMobil();
  const [nombre, setNombre] = useState(workflow?.nombre || "");
  const [triggerTipo, setTriggerTipo] = useState(workflow?.trigger_tipo || "conversacion_nueva");
  const [triggerConfig, setTriggerConfig] = useState(workflow?.trigger_config || {});
  const [pasos, setPasos] = useState(workflow?.pasos || []);
  const [primerPasoId, setPrimerPasoId] = useState(workflow?.primer_paso_id || null);
  const [insertandoEn, setInsertandoEn] = useState(null); // punto {pasoId, rama} | null (null = va a ser el primer paso)
  const [editandoPasoId, setEditandoPasoId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const pasosDict = Object.fromEntries(pasos.map(p => [p.id, p]));
  const pasoEditando = editandoPasoId ? pasosDict[editandoPasoId] : null;

  const insertarPaso = (punto, tipo) => {
    const nuevoId = generarIdPaso();
    const nuevoPaso = { id: nuevoId, tipo, config: {}, siguiente: null, ...(tipo === "bifurcacion" ? { siguiente_si: null, siguiente_no: null } : {}) };
    // "punto" siempre es un objeto (incluso para el primerísimo paso, donde
    // llega como {pasoId: null, rama: null}) -- lo que hay que revisar es si
    // pasoId viene vacío, no si "punto" en sí es verdadero (eso SIEMPRE lo es).
    const esElPrimerPaso = !punto?.pasoId;
    setPasos(prev => {
      const copia = prev.map(p => ({ ...p }));
      if (esElPrimerPaso) {
        nuevoPaso.siguiente = primerPasoId;
      } else {
        const anterior = copia.find(p => p.id === punto.pasoId);
        if (anterior) { nuevoPaso.siguiente = anterior[punto.rama] || null; anterior[punto.rama] = nuevoId; }
      }
      return [...copia, nuevoPaso];
    });
    if (esElPrimerPaso) setPrimerPasoId(nuevoId);
    setInsertandoEn(null);
    setEditandoPasoId(nuevoId);
  };

  const eliminarPaso = (pasoId) => {
    const paso = pasosDict[pasoId];
    if (!paso) return;
    if (paso.tipo === "bifurcacion" && (paso.siguiente_si || paso.siguiente_no) && !confirm("Esta condición tiene pasos después de ella (en Sí y/o No). Al borrarla se pierden también. ¿Continuar?")) return;
    setPasos(prev => {
      const restantes = prev.filter(p => p.id !== pasoId).map(p => ({ ...p }));
      restantes.forEach(p => {
        if (p.siguiente === pasoId) p.siguiente = paso.siguiente || null;
        if (p.siguiente_si === pasoId) p.siguiente_si = paso.siguiente || null;
        if (p.siguiente_no === pasoId) p.siguiente_no = paso.siguiente || null;
      });
      return restantes;
    });
    if (primerPasoId === pasoId) setPrimerPasoId(paso.siguiente || null);
    if (editandoPasoId === pasoId) setEditandoPasoId(null);
  };

  const actualizarConfig = (pasoId, config) => {
    setPasos(prev => prev.map(p => p.id === pasoId ? { ...p, config } : p));
  };

  const guardar = async (publicar) => {
    if (!nombre.trim()) { alert("Ponle un nombre al workflow"); return; }
    setGuardando(true);
    const datos = { nombre: nombre.trim(), activo: publicar, trigger_tipo: triggerTipo, trigger_config: triggerConfig, pasos, primer_paso_id: primerPasoId };
    try {
      if (workflow?.id) await sb.patch("crm_workflows", workflow.id, datos);
      else await sb.post("crm_workflows", datos);
      onGuardado();
    } catch (e) { alert("Error guardando: " + e.message); setGuardando(false); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* ENCABEZADO DEL EDITOR */}
      <div style={{ background: WHITE, borderBottom: `1px solid ${GRAY2}`, padding: esMobil ? "10px 14px" : "14px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onCerrar} className="oft-btn-press" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex" }}><ArrowLeft size={20} /></button>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del workflow..."
          style={{ ...S.input, marginBottom: 0, flex: 1, minWidth: 160, fontWeight: 700, fontSize: 14.5, border: "none", background: GRAY, borderRadius: 8 }} />
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => guardar(false)} disabled={guardando} className="oft-btn-press"
            style={{ padding: "9px 14px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, color: GRAY3, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Guardar borrador
          </button>
          <button onClick={() => guardar(true)} disabled={guardando} className="oft-btn-press"
            style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: BLACK, color: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: guardando ? 0.6 : 1 }}>
            {guardando ? "Guardando..." : "Publicar"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LIENZO DE LA CADENA */}
        <div style={{ flex: 1, overflow: "auto", padding: esMobil ? "24px 14px" : "32px 24px", display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: esMobil ? "100%" : 320 }}>
            {/* BLOQUE DE DISPARADOR */}
            <div onClick={() => setEditandoPasoId("__trigger__")} className="oft-btn-press"
              style={{ width: esMobil ? "100%" : 300, background: BLACK, color: WHITE, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 3 }}>
                {(() => { const T = TIPOS_TRIGGER[triggerTipo]?.icono; return T ? <T size={16} /> : null; })()}
                <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>DISPARADOR</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>{TIPOS_TRIGGER[triggerTipo]?.label}</div>
            </div>
            <LineaConector />
            <CadenaPasos desdeId={primerPasoId} pasosDict={pasosDict} esMobil={esMobil}
              onInsertar={setInsertandoEn} onEditar={setEditandoPasoId} onEliminar={eliminarPaso}
              punto={{ pasoId: null, rama: null }} />
          </div>
        </div>

        {/* PANEL DE CONFIGURACIÓN (disparador o paso seleccionado) */}
        {editandoPasoId === "__trigger__" && (
          <PanelConfigTrigger triggerTipo={triggerTipo} setTriggerTipo={setTriggerTipo} triggerConfig={triggerConfig} setTriggerConfig={setTriggerConfig} etapas={etapas} agentes={agentes} esMobil={esMobil} onCerrar={() => setEditandoPasoId(null)} />
        )}
        {pasoEditando && (
          <PanelConfigPaso paso={pasoEditando} onActualizar={config => actualizarConfig(pasoEditando.id, config)} etapas={etapas} agentes={agentes} esMobil={esMobil} onCerrar={() => setEditandoPasoId(null)} />
        )}
      </div>

      {/* MODAL: elegir tipo de paso a insertar */}
      {insertandoEn !== null && insertandoEn !== undefined && (
        <ModalElegirPaso onElegir={tipo => insertarPaso(insertandoEn, tipo)} onCerrar={() => setInsertandoEn(null)} />
      )}
    </div>
  );
}

function LineaConector() {
  return <div style={{ width: 2, height: 22, background: GRAY2 }} />;
}

function BotonInsertar({ onClick }) {
  return (
    <button onClick={onClick} className="oft-btn-press"
      style={{ width: 30, height: 30, borderRadius: "50%", border: `1.5px dashed ${GRAY2}`, background: WHITE, color: GRAY3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
      <Plus size={15} />
    </button>
  );
}

// Dibuja la cadena de pasos empezando en "desdeId", siguiendo los punteros. Si
// se topa con una bifurcación, se dibuja a sí misma dos veces en paralelo
// (rama Sí / rama No) -- así se arman árboles de cualquier profundidad sin
// necesitar una estructura de árbol de verdad guardada.
function CadenaPasos({ desdeId, pasosDict, esMobil, onInsertar, onEditar, onEliminar, punto }) {
  const paso = desdeId ? pasosDict[desdeId] : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <BotonInsertar onClick={() => onInsertar(punto)} />
      {paso && (
        <>
          <LineaConector />
          <BloquePaso paso={paso} esMobil={esMobil} onClick={() => onEditar(paso.id)} onEliminar={() => onEliminar(paso.id)} />
          {paso.tipo === "bifurcacion" ? (
            <div style={{ display: "flex", gap: esMobil ? 14 : 28, marginTop: 4, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <EtiquetaRama color="#10B981">SÍ</EtiquetaRama>
                <CadenaPasos desdeId={paso.siguiente_si} pasosDict={pasosDict} esMobil={esMobil} onInsertar={onInsertar} onEditar={onEditar} onEliminar={onEliminar} punto={{ pasoId: paso.id, rama: "siguiente_si" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <EtiquetaRama color={GRAY3}>NO</EtiquetaRama>
                <CadenaPasos desdeId={paso.siguiente_no} pasosDict={pasosDict} esMobil={esMobil} onInsertar={onInsertar} onEditar={onEditar} onEliminar={onEliminar} punto={{ pasoId: paso.id, rama: "siguiente_no" }} />
              </div>
            </div>
          ) : (
            <CadenaPasos desdeId={paso.siguiente} pasosDict={pasosDict} esMobil={esMobil} onInsertar={onInsertar} onEditar={onEditar} onEliminar={onEliminar} punto={{ pasoId: paso.id, rama: "siguiente" }} />
          )}
        </>
      )}
    </div>
  );
}

function EtiquetaRama({ children, color }) {
  return <div style={{ fontSize: 10.5, fontWeight: 800, color, marginBottom: 4, letterSpacing: 0.5 }}>{children}</div>;
}

function BloquePaso({ paso, esMobil, onClick, onEliminar }) {
  const meta = TIPOS_PASO[paso.tipo];
  const resumen = resumenPaso(paso);
  return (
    <div className="oft-fade-in" style={{ position: "relative", width: esMobil ? 220 : 260 }}>
      <div onClick={onClick} className="oft-btn-press"
        style={{ background: WHITE, border: `1.5px solid ${GRAY2}`, borderLeft: `4px solid ${meta.color}`, borderRadius: 12, padding: "11px 14px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: resumen ? 4 : 0 }}>
          <meta.icono size={15} color={meta.color} />
          <div style={{ fontWeight: 800, fontSize: 12.5 }}>{meta.label}</div>
        </div>
        {resumen && <div style={{ fontSize: 11, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resumen}</div>}
      </div>
      <button onClick={e => { e.stopPropagation(); onEliminar(); }} className="oft-btn-press"
        style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: WHITE, border: `1.5px solid ${GRAY2}`, color: GRAY3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={12} />
      </button>
    </div>
  );
}

function resumenPaso(paso) {
  const c = paso.config || {};
  if (paso.tipo === "enviar_mensaje") return c.texto ? `"${c.texto.slice(0, 40)}${c.texto.length > 40 ? "…" : ""}"` : "Sin texto todavía";
  if (paso.tipo === "esperar") return c.minutos ? `${c.minutos} minutos` : "Sin definir";
  if (paso.tipo === "cambiar_etapa") return c.etapa_id ? "Etapa elegida" : "Sin elegir etapa";
  if (paso.tipo === "asignar_agente") return c.modo === "menos_conversaciones" ? "Al que tenga menos chats" : c.agente_id ? "Agente elegido" : "Sin elegir agente";
  if (paso.tipo === "agregar_nota") return c.texto ? `"${c.texto.slice(0, 40)}${c.texto.length > 40 ? "…" : ""}"` : "Sin texto todavía";
  if (paso.tipo === "bifurcacion") return c.campo ? `Si ${c.campo} ${c.operador || "es"} ...` : "Sin condición todavía";
  return "";
}

// ─────────────────────────────────────────────────────────────
//  PANEL: configuración del disparador (el único, va al inicio).
// ─────────────────────────────────────────────────────────────
function PanelConfigTrigger({ triggerTipo, setTriggerTipo, triggerConfig, setTriggerConfig, etapas, agentes, esMobil, onCerrar }) {
  return (
    <PanelLateral titulo="Disparador" esMobil={esMobil} onCerrar={onCerrar}>
      <EtiquetaCampo>¿Cuándo arranca este workflow?</EtiquetaCampo>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {Object.entries(TIPOS_TRIGGER).map(([tipo, meta]) => (
          <button key={tipo} onClick={() => { setTriggerTipo(tipo); setTriggerConfig({}); }} className="oft-btn-press"
            style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, border: `1.5px solid ${triggerTipo === tipo ? RED : GRAY2}`, background: triggerTipo === tipo ? "#FFF5F5" : WHITE, cursor: "pointer", textAlign: "left" }}>
            <meta.icono size={17} color={triggerTipo === tipo ? RED : GRAY3} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: triggerTipo === tipo ? RED : BLACK }}>{meta.label}</div>
              <div style={{ fontSize: 11.5, color: GRAY3 }}>{meta.descripcion}</div>
            </div>
          </button>
        ))}
      </div>

      {triggerTipo === "etapa_cambiada" && (
        <>
          <EtiquetaCampo>¿A cuál etapa? (opcional)</EtiquetaCampo>
          <select value={triggerConfig.etapa_id || ""} onChange={e => setTriggerConfig({ ...triggerConfig, etapa_id: e.target.value || null })} style={{ ...S.input, fontSize: 13 }}>
            <option value="">Cualquier etapa</option>
            {etapas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
          </select>
        </>
      )}
      {triggerTipo === "sin_responder" && (
        <>
          <EtiquetaCampo>¿Después de cuántos minutos sin responder?</EtiquetaCampo>
          <input type="number" min="1" value={triggerConfig.minutos || ""} onChange={e => setTriggerConfig({ ...triggerConfig, minutos: Number(e.target.value) })} placeholder="Ej: 30" style={{ ...S.input, fontSize: 13 }} />
          <div style={{ fontSize: 11.5, color: GRAY3, marginTop: -10 }}>Se revisa cada 5 minutos, así que puede tardar un poco más en dispararse.</div>
        </>
      )}
      {triggerTipo === "agente_asignado" && (
        <>
          <EtiquetaCampo>¿A cuál agente? (opcional)</EtiquetaCampo>
          <select value={triggerConfig.agente_id || ""} onChange={e => setTriggerConfig({ ...triggerConfig, agente_id: e.target.value || null })} style={{ ...S.input, fontSize: 13 }}>
            <option value="">Cualquier agente</option>
            {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </>
      )}
    </PanelLateral>
  );
}

// ─────────────────────────────────────────────────────────────
//  PANEL: configuración de un paso, cambia según su tipo.
// ─────────────────────────────────────────────────────────────
function PanelConfigPaso({ paso, onActualizar, etapas, agentes, esMobil, onCerrar }) {
  const c = paso.config || {};
  const set = (cambios) => onActualizar({ ...c, ...cambios });
  const meta = TIPOS_PASO[paso.tipo];

  return (
    <PanelLateral titulo={meta.label} icono={meta.icono} color={meta.color} esMobil={esMobil} onCerrar={onCerrar}>
      {paso.tipo === "enviar_mensaje" && (
        <>
          <EtiquetaCampo>Mensaje a enviar</EtiquetaCampo>
          <textarea value={c.texto || ""} onChange={e => set({ texto: e.target.value })} rows={5} placeholder="Escribe el mensaje... usa {nombre} para el nombre del cliente" style={{ ...S.input, resize: "vertical", fontSize: 13 }} />
          <div style={{ fontSize: 11.5, color: GRAY3, marginTop: -10 }}>Ejemplo: "Hola {"{nombre}"}, ¿todavía te interesa el pedido?"</div>
        </>
      )}
      {paso.tipo === "esperar" && (
        <>
          <EtiquetaCampo>¿Cuánto tiempo esperar?</EtiquetaCampo>
          <input type="number" min="1" value={c.minutos || ""} onChange={e => set({ minutos: Number(e.target.value) })} placeholder="Minutos" style={{ ...S.input, fontSize: 13, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["15 min", 15], ["1 hora", 60], ["1 día", 1440], ["3 días", 4320]].map(([label, min]) => (
              <button key={min} onClick={() => set({ minutos: min })} className="oft-btn-press" style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: `1px solid ${GRAY2}`, background: c.minutos === min ? GRAY : WHITE, color: GRAY3, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </>
      )}
      {paso.tipo === "cambiar_etapa" && (
        <>
          <EtiquetaCampo>Nueva etapa</EtiquetaCampo>
          <select value={c.etapa_id || ""} onChange={e => set({ etapa_id: e.target.value })} style={{ ...S.input, fontSize: 13 }}>
            <option value="">Selecciona...</option>
            {etapas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
          </select>
        </>
      )}
      {paso.tipo === "asignar_agente" && (
        <>
          <EtiquetaCampo>¿A quién asignar?</EtiquetaCampo>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <input type="radio" checked={c.modo !== "menos_conversaciones"} onChange={() => set({ modo: "especifico" })} /> Un agente específico
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <input type="radio" checked={c.modo === "menos_conversaciones"} onChange={() => set({ modo: "menos_conversaciones" })} /> Al que tenga menos conversaciones
            </label>
          </div>
          {c.modo !== "menos_conversaciones" && (
            <select value={c.agente_id || ""} onChange={e => set({ agente_id: e.target.value })} style={{ ...S.input, fontSize: 13 }}>
              <option value="">Selecciona...</option>
              {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          )}
        </>
      )}
      {paso.tipo === "agregar_nota" && (
        <>
          <EtiquetaCampo>Nota interna (no la ve el cliente)</EtiquetaCampo>
          <textarea value={c.texto || ""} onChange={e => set({ texto: e.target.value })} rows={4} placeholder="Ej: Cliente frío, revisar en una semana" style={{ ...S.input, resize: "vertical", fontSize: 13 }} />
        </>
      )}
      {paso.tipo === "bifurcacion" && (
        <>
          <EtiquetaCampo>Si...</EtiquetaCampo>
          <select value={c.campo || ""} onChange={e => set({ campo: e.target.value })} style={{ ...S.input, fontSize: 13 }}>
            <option value="">Elige un campo...</option>
            <option value="etapa_id">La etapa del cliente</option>
            <option value="agente_id">El agente asignado</option>
          </select>
          {c.campo && (
            <>
              <EtiquetaCampo>Condición</EtiquetaCampo>
              <select value={c.operador || "es"} onChange={e => set({ operador: e.target.value })} style={{ ...S.input, fontSize: 13 }}>
                <option value="es">Es igual a</option>
                <option value="no_es">Es distinto de</option>
                <option value="existe">Tiene un valor</option>
                <option value="no_existe">No tiene valor (vacío)</option>
              </select>
            </>
          )}
          {c.campo && (c.operador === "es" || c.operador === "no_es" || !c.operador) && (
            <>
              <EtiquetaCampo>Valor</EtiquetaCampo>
              <select value={c.valor || ""} onChange={e => set({ valor: e.target.value })} style={{ ...S.input, fontSize: 13 }}>
                <option value="">Selecciona...</option>
                {c.campo === "etapa_id" && etapas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
                {c.campo === "agente_id" && agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </>
          )}
        </>
      )}
    </PanelLateral>
  );
}

function PanelLateral({ titulo, icono: Icono, color, esMobil, onCerrar, children }) {
  return (
    <div className={esMobil ? "oft-fade-in" : undefined} style={{ width: esMobil ? "100%" : 300, minWidth: esMobil ? "100%" : 300, position: esMobil ? "fixed" : "static", inset: esMobil ? 0 : "auto", top: esMobil ? 0 : "auto", zIndex: esMobil ? 50 : "auto", background: WHITE, borderLeft: esMobil ? "none" : `1px solid ${GRAY2}`, padding: 20, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        {esMobil && <button onClick={onCerrar} className="oft-btn-press" style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex" }}><ArrowLeft size={18} /></button>}
        {Icono && <Icono size={17} color={color || BLACK} />}
        <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>{titulo}</div>
        {!esMobil && <button onClick={onCerrar} className="oft-btn-press" style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex" }}><X size={17} color={GRAY3} /></button>}
      </div>
      {children}
    </div>
  );
}

function EtiquetaCampo({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 7, marginTop: 14 }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────
//  MODAL: elegir qué tipo de paso agregar en un punto de la cadena.
// ─────────────────────────────────────────────────────────────
function ModalElegirPaso({ onElegir, onCerrar }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onCerrar}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 380, width: "100%", padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Agregar paso</div>
        <div style={{ fontSize: 12, color: GRAY3, marginBottom: 16 }}>¿Qué debe pasar en este punto del workflow?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(TIPOS_PASO).map(([tipo, meta]) => (
            <button key={tipo} onClick={() => onElegir(tipo)} className="oft-btn-press"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, border: `1.5px solid ${GRAY2}`, background: WHITE, cursor: "pointer", textAlign: "left" }}>
              <meta.icono size={17} color={meta.color} />
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{meta.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BROADCASTS — mensajes masivos (con imagen opcional) a un grupo
//  de clientes filtrado por etapa.
// ═══════════════════════════════════════════════════════════════
function BroadcastsPanel({ etapas, conversaciones, user }) {
  const esMobil = useEsMobil();
  const [broadcasts, setBroadcasts] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const etapaPorId = Object.fromEntries(etapas.map(e => [e.id, e]));

  const cargar = async () => {
    setCargando(true);
    try { setBroadcasts(await sb.get("crm_broadcasts", "?order=created_at.desc") || []); }
    catch (e) { console.warn("Error cargando broadcasts:", e.message); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  if (creando) {
    return <ComposerBroadcast etapas={etapas} conversaciones={conversaciones} user={user} esMobil={esMobil}
      onCerrar={() => setCreando(false)} onEnviado={() => { setCreando(false); cargar(); }} />;
  }

  return (
    <div style={{ flex: 1, padding: esMobil ? 14 : 24, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>Broadcasts</div>
          <div style={{ fontSize: 12.5, color: GRAY3 }}>Mensajes masivos (con imagen si quieres) a un grupo de clientes por etapa.</div>
        </div>
        <button onClick={() => setCreando(true)} className="oft-btn-press"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", background: RED, color: WHITE, fontWeight: 700, fontSize: 13.5, cursor: "pointer", flexShrink: 0 }}>
          <Plus size={16} /> Crear broadcast
        </button>
      </div>

      {cargando ? (
        <div style={{ padding: 40, textAlign: "center" }}><Spinner /></div>
      ) : broadcasts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: GRAY3 }}>
          <Megaphone size={40} color={GRAY2} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4, color: BLACK }}>Todavía no has enviado ningún broadcast</div>
          <div style={{ fontSize: 13 }}>Créalo para promocionar algo a un grupo de clientes de una vez.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
          {broadcasts.map((b, i) => (
            <div key={b.id} className="oft-fade-in" style={{ animationDelay: `${i * 50}ms`, display: "flex", gap: 12, background: WHITE, borderRadius: 14, padding: 14, border: `1px solid ${GRAY2}` }}>
              {b.imagen_url ? (
                <img src={b.imagen_url} style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 10, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Megaphone size={20} color={GRAY3} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.nombre}</div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: b.estado === "enviado" ? "#D1FAE5" : "#FEF3C7", color: b.estado === "enviado" ? "#065F46" : "#92400E", flexShrink: 0 }}>
                    {b.estado === "enviado" ? "Enviado" : b.estado === "enviando" ? "Enviando..." : "Borrador"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: GRAY3, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.mensaje_texto}</div>
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: GRAY3, flexWrap: "wrap" }}>
                  <span>{b.total_enviados}/{b.total_destinatarios} enviados</span>
                  {b.etapas_objetivo?.length > 0 ? (
                    <span>{b.etapas_objetivo.map(id => etapaPorId[id]?.nombre).filter(Boolean).join(", ")}</span>
                  ) : <span>Todas las etapas</span>}
                  {b.enviado_at && <span>{new Date(b.enviado_at).toLocaleDateString("es-PA")}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComposerBroadcast({ etapas, conversaciones, user, esMobil, onCerrar, onEnviado }) {
  const [nombre, setNombre] = useState("");
  const [mensajeTexto, setMensajeTexto] = useState("");
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);
  const [etapasSeleccionadas, setEtapasSeleccionadas] = useState([]); // [] = todas
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState(0);

  const destinatarios = conversaciones.filter(c => etapasSeleccionadas.length === 0 || etapasSeleccionadas.includes(c.etapa_id));

  const elegirImagen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImagenFile(file);
    setImagenPreview(URL.createObjectURL(file));
  };

  const alternarEtapa = (etapaId) => {
    setEtapasSeleccionadas(prev => prev.includes(etapaId) ? prev.filter(id => id !== etapaId) : [...prev, etapaId]);
  };

  const enviar = async () => {
    if (!nombre.trim() || !mensajeTexto.trim()) { alert("Ponle un nombre interno y escribe el mensaje"); return; }
    if (destinatarios.length === 0) { alert("No hay ningún cliente con ese filtro de etapa"); return; }
    if (!confirm(`¿Enviar este broadcast a ${destinatarios.length} clientes? No se puede deshacer.\n\nWhatsApp solo entrega a quienes te escribieron en las últimas 24 horas.`)) return;
    setEnviando(true);
    try {
      let imagenUrl = null;
      if (imagenFile) {
        const comprimida = await comprimirImagen(imagenFile);
        const nombreArchivo = `broadcasts/${Date.now()}_${imagenFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        await sb.upload("crm", nombreArchivo, comprimida);
        imagenUrl = sb.publicUrl("crm", nombreArchivo);
      }
      const [broadcast] = await sb.post("crm_broadcasts", {
        nombre: nombre.trim(), canal: "whatsapp", mensaje_texto: mensajeTexto.trim(), imagen_url: imagenUrl,
        etapas_objetivo: etapasSeleccionadas, estado: "enviando", total_destinatarios: destinatarios.length,
        enviado_por: user?.id || null,
      });
      let enviados = 0, rechazados = 0, fueraDeVentana = 0, primerError = "";
      // Cada cliente: se guarda el mensaje y se manda por WhatsApp en tandas de 10.
      // WhatsApp solo deja escribir texto libre a quien escribió en las últimas 24 h;
      // al resto el mensaje queda marcado "No enviado" en su chat con el motivo.
      let pendientes = [];
      const vaciar = async () => {
        if (pendientes.length === 0) return;
        const lote = pendientes; pendientes = [];
        const res = await enviarPorWhatsApp(lote.map(x => x.id));
        for (const x of lote) {
          const r = res[x.id];
          if (r?.ok) {
            enviados++;
            await sb.patch("crm_conversaciones", x.convId, {
              ultimo_mensaje_at: new Date().toISOString(),
              ultimo_mensaje_preview: (imagenUrl ? "📷 " : "") + mensajeTexto.trim().slice(0, 55),
            });
          } else {
            rechazados++;
            if (r?.codigo === "ventana") fueraDeVentana++;
            else if (!primerError) primerError = r?.error || "Error desconocido";
          }
        }
        setProgreso(enviados + rechazados);
      };
      for (const conv of destinatarios) {
        const [fila] = await sb.post("crm_mensajes", {
          conversacion_id: conv.id, direccion: "saliente", tipo: imagenUrl ? "imagen" : "texto",
          contenido: mensajeTexto.trim(), media_url: imagenUrl, agente_id: user?.id || null,
          estado: "enviado", broadcast_id: broadcast.id, canal: "whatsapp",
        });
        pendientes.push({ id: fila.id, convId: conv.id });
        if (pendientes.length >= 10) await vaciar();
      }
      await vaciar();
      await sb.patch("crm_broadcasts", broadcast.id, { estado: "enviado", total_enviados: enviados, enviado_at: new Date().toISOString() });
      if (rechazados > 0) {
        alert(`Broadcast terminado.\n\nLlegó a ${enviados} cliente${enviados !== 1 ? "s" : ""}.` +
          (fueraDeVentana ? `\n${fueraDeVentana} no lo recibieron porque pasaron más de 24 horas desde que te escribieron (regla de WhatsApp).` : "") +
          (rechazados - fueraDeVentana > 0 ? `\n${rechazados - fueraDeVentana} fallaron por otro motivo: ${primerError}` : ""));
      }
      onEnviado();
    } catch (e) { alert("Error enviando el broadcast: " + e.message); }
    setEnviando(false);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ background: WHITE, borderBottom: `1px solid ${GRAY2}`, padding: esMobil ? "10px 14px" : "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onCerrar} disabled={enviando} className="oft-btn-press" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex" }}><ArrowLeft size={20} /></button>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Nuevo broadcast</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: esMobil ? 16 : 24, maxWidth: 560, width: "100%", margin: "0 auto" }}>
        <EtiquetaCampo>Nombre interno (solo para identificarlo tú)</EtiquetaCampo>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Promo de fin de mes" style={{ ...S.input, fontSize: 13.5 }} disabled={enviando} />

        <EtiquetaCampo>Mensaje</EtiquetaCampo>
        <textarea value={mensajeTexto} onChange={e => setMensajeTexto(e.target.value)} rows={5} placeholder="Escribe el mensaje que van a recibir..." style={{ ...S.input, resize: "vertical", fontSize: 13.5 }} disabled={enviando} />

        <EtiquetaCampo>Imagen (opcional)</EtiquetaCampo>
        {imagenPreview ? (
          <div style={{ position: "relative", width: 140, marginBottom: 14 }}>
            <img src={imagenPreview} style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 12, border: `1px solid ${GRAY2}` }} />
            <button onClick={() => { setImagenFile(null); setImagenPreview(null); }} disabled={enviando} className="oft-btn-press"
              style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: WHITE, border: `1.5px solid ${GRAY2}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, width: 140, height: 100, borderRadius: 12, border: `1.5px dashed ${GRAY2}`, cursor: "pointer", marginBottom: 14, color: GRAY3 }}>
            <Upload size={18} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Subir imagen</span>
            <input type="file" accept="image/*" onChange={elegirImagen} style={{ display: "none" }} disabled={enviando} />
          </label>
        )}

        <EtiquetaCampo>¿A quién? (por etapa)</EtiquetaCampo>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          <button onClick={() => setEtapasSeleccionadas([])} disabled={enviando} className="oft-btn-press"
            style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${etapasSeleccionadas.length === 0 ? BLACK : GRAY2}`, background: etapasSeleccionadas.length === 0 ? BLACK : WHITE, color: etapasSeleccionadas.length === 0 ? WHITE : GRAY3, cursor: "pointer" }}>
            Todas las etapas
          </button>
          {etapas.map(et => (
            <button key={et.id} onClick={() => alternarEtapa(et.id)} disabled={enviando} className="oft-btn-press"
              style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${etapasSeleccionadas.includes(et.id) ? et.color : GRAY2}`, background: etapasSeleccionadas.includes(et.id) ? et.color + "1A" : WHITE, color: etapasSeleccionadas.includes(et.id) ? et.color : GRAY3, cursor: "pointer" }}>
              {et.nombre}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: GRAY3, marginBottom: 24 }}>
          Este broadcast va a llegarle a <strong style={{ color: BLACK }}>{destinatarios.length}</strong> cliente{destinatarios.length !== 1 ? "s" : ""}.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FEF3C7", color: "#92400E", borderRadius: 10, padding: "9px 12px", fontSize: 12, lineHeight: 1.4, margin: "-12px 0 20px" }}>
          <Clock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>WhatsApp solo entrega mensajes libres a quienes te escribieron en las últimas 24 horas. A los demás les aparecerá "No enviado" en su chat.</span>
        </div>

        <button onClick={enviar} disabled={enviando} className="oft-btn-press"
          style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 14.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: enviando ? 0.7 : 1 }}>
          <Send size={16} /> {enviando ? `Enviando... ${progreso}/${destinatarios.length}` : `Enviar a ${destinatarios.length} clientes`}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INTEGRACIONES — estado de conexión de WhatsApp e Instagram, en
//  un solo lugar fácil de revisar.
// ═══════════════════════════════════════════════════════════════
function IntegracionesPanel() {
  const esMobil = useEsMobil();
  const { user } = useApp();
  const esAdmin = !!user?.es_admin;
  const [numeros, setNumeros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const [phoneId, setPhoneId] = useState("");
  const [etiqueta, setEtiqueta] = useState("Anuncios");
  const [pinPara, setPinPara] = useState(null); // phone_number_id al que se le pide PIN
  const [pin, setPin] = useState("");

  const cargar = async () => {
    try { setNumeros((await sb.get("crm_numeros_whatsapp", "?order=created_at.asc")) || []); }
    catch (e) { setNumeros([]); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  // Llama a la función que habla con Meta (solo administradores).
  const llamar = async (cuerpo) => {
    await sb.ensureFreshToken?.();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-numeros`, { method: "POST", headers: sb.functionHeaders(), body: JSON.stringify(cuerpo) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
    return data;
  };
  const ejecutar = async (cuerpo, textoOk) => {
    setOcupado(true); setAviso(null);
    try {
      const data = await llamar(cuerpo);
      if (data.numeros) setNumeros(data.numeros); else await cargar();
      const errs = data.errores ? Object.values(data.errores) : [];
      setAviso(errs.length ? { tipo: "error", texto: errs[0] } : { tipo: "ok", texto: textoOk });
      return true;
    } catch (e) { setAviso({ tipo: "error", texto: e.message }); return false; }
    finally { setOcupado(false); }
  };

  const conectar = async () => {
    if (!/^\d{8,25}$/.test(phoneId.trim())) { setAviso({ tipo: "error", texto: "El ID del número son solo dígitos (15 o 16 en general). Lo ves en WhatsApp Manager > Teléfonos." }); return; }
    const ok = await ejecutar({ modo: "conectar", phone_number_id: phoneId.trim(), etiqueta: etiqueta.trim() || "Anuncios" }, "Número conectado. Ya recibe y responde chats desde la Bandeja.");
    if (ok) { setPhoneId(""); setMostrarForm(false); }
  };
  const activar = async () => {
    const ok = await ejecutar({ modo: "activar", phone_number_id: pinPara, pin }, "Número activado en WhatsApp Cloud API.");
    if (ok) { setPinPara(null); setPin(""); }
  };

  const pasos = [
    ["Compra o consigue el chip nuevo", "Un número que NO tenga WhatsApp ni WhatsApp Business instalado (si lo tiene, bórrale la cuenta primero). Tiene que poder recibir un SMS o una llamada. Puede ser una línea prepago."],
    ["Entra a WhatsApp Manager", "business.facebook.com > menú > Administrador de WhatsApp (WhatsApp Manager) > elige la cuenta de Ofertodo > pestaña Herramientas de la cuenta > Números de teléfono."],
    ["Agrega el número", "Botón Agregar número de teléfono. Escribe el nombre que verán los clientes (Ofertodo) y la categoría. Meta revisa el nombre; suele tardar de minutos a un par de días."],
    ["Verifica el código", "Meta te manda un SMS o llamada con un código de 6 dígitos al número nuevo. Escríbelo. Al terminar, el número aparece en tu lista con estado Conectado o Pendiente."],
    ["Copia el ID del número", "En esa misma lista, toca el número: abajo del nombre verás Identificador del número de teléfono (15 o 16 dígitos). Ese es el ID que pegas aquí abajo en Conectar número API. No es el número de teléfono."],
    ["Conéctalo aquí", "Pulsa Conectar número API, pega el ID y ponle una etiqueta (Anuncios). Si queda en Falta activarlo, aparece el botón Activar y le pones un PIN de 6 dígitos que inventes (guárdalo)."],
    ["Apunta tus anuncios a ese número", "En Ads Manager, al crear o editar el anuncio de tipo Mensajes (clic a WhatsApp), elige este número como destino. Los chats que lleguen aparecerán en la Bandeja marcados como Anuncio."],
  ];

  const colorAviso = aviso?.tipo === "ok" ? { bg: "#D1FAE5", color: "#065F46" } : { bg: "#FEE2E2", color: "#991B1B" };

  return (
    <div style={{ flex: 1, padding: esMobil ? 14 : 24, overflowY: "auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 900, fontSize: 17 }}>Integraciones</div>
        <div style={{ fontSize: 12.5, color: GRAY3 }}>Los canales conectados a tu Bandeja, Workflows, y Broadcasts.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: esMobil ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
        {/* WHATSAPP */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MessageCircle size={22} color={WHITE} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>WhatsApp</div>
              <div style={{ fontSize: 11.5, color: GRAY3 }}>Números conectados a la Bandeja, Workflows y Broadcasts</div>
            </div>
            {esAdmin && numeros.length > 0 && (
              <button onClick={() => ejecutar({ modo: "estado" }, "Estado actualizado desde Meta.")} disabled={ocupado} title="Actualizar estado desde Meta" className="oft-btn-press"
                style={{ background: GRAY, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: ocupado ? 0.5 : 1 }}>
                <RefreshCw size={15} />
              </button>
            )}
          </div>

          {cargando ? (
            <div style={{ fontSize: 12.5, color: GRAY3 }}>Revisando conexión...</div>
          ) : numeros.length === 0 ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FEF3C7", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <AlertCircle size={17} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.4 }}>Todavía no hay ningún número conectado. Sigue la guía de abajo y conecta el número API.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              {numeros.map(n => {
                const est = ESTADO_NUMERO[n.estado] || { texto: n.estado || "Sin revisar", bg: GRAY, color: GRAY3 };
                const pendiente = n.estado && n.estado !== "CONNECTED";
                return (
                  <div key={n.id} style={{ border: `1px solid ${GRAY2}`, borderRadius: 12, padding: "11px 12px", opacity: n.activo ? 1 : 0.6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5 }}>{n.etiqueta || "Línea"}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: est.bg, color: est.color }}>{est.texto}</span>
                      {n.rol === "anuncios" && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: "#DBEAFE", color: "#1E40AF" }}>Anuncios</span>}
                    </div>
                    <div style={{ fontSize: 12, color: GRAY3, marginTop: 4 }}>
                      {n.numero_visible || "Número sin leer"}{n.nombre_verificado ? ` · ${n.nombre_verificado}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>
                      {CALIDAD_NUMERO[n.calidad] || CALIDAD_NUMERO.UNKNOWN}
                      {n.plataforma === "CLOUD_API" ? " · Solo API" : ""}
                    </div>
                    {esAdmin && (
                      <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                        <button onClick={() => ejecutar({ modo: "alternar", phone_number_id: n.phone_number_id, activo: !n.activo }, n.activo ? "Número apagado en el CRM." : "Número encendido en el CRM.")} disabled={ocupado} className="oft-btn-press"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${GRAY2}`, background: WHITE, color: BLACK, cursor: "pointer" }}>
                          <Power size={12} /> {n.activo ? "Apagar" : "Encender"}
                        </button>
                        {pendiente && (
                          <button onClick={() => { setPinPara(pinPara === n.phone_number_id ? null : n.phone_number_id); setPin(""); }} disabled={ocupado} className="oft-btn-press"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 8, border: "none", background: BLACK, color: WHITE, cursor: "pointer" }}>
                            <KeyRound size={12} /> Activar
                          </button>
                        )}
                      </div>
                    )}
                    {pinPara === n.phone_number_id && (
                      <div style={{ marginTop: 9, background: GRAY, borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 11.5, color: GRAY3, lineHeight: 1.4, marginBottom: 6 }}>Inventa un PIN de 6 dígitos y guárdalo. Meta lo pide si algún día hay que volver a registrar el número.</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6 dígitos" style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1 }} />
                          <button onClick={activar} disabled={ocupado || pin.length !== 6} className="oft-btn-press"
                            style={{ background: RED, color: WHITE, border: "none", borderRadius: 9, padding: "0 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", opacity: ocupado || pin.length !== 6 ? 0.5 : 1 }}>
                            {ocupado ? "..." : "Activar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {aviso && (
            <div style={{ background: colorAviso.bg, color: colorAviso.color, borderRadius: 10, padding: "9px 12px", fontSize: 12, lineHeight: 1.4, marginBottom: 12, display: "flex", gap: 7, alignItems: "flex-start" }}>
              {aviso.tipo === "ok" ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
              <span>{aviso.texto}</span>
            </div>
          )}

          {esAdmin ? (
            mostrarForm ? (
              <div style={{ background: GRAY, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <EtiquetaCampo>ID del número de teléfono (de Meta)</EtiquetaCampo>
                <input value={phoneId} onChange={e => setPhoneId(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ej: 1234567890123456" style={{ ...S.input, fontSize: 13 }} disabled={ocupado} />
                <EtiquetaCampo>Etiqueta (cómo lo ves en el CRM)</EtiquetaCampo>
                <input value={etiqueta} onChange={e => setEtiqueta(e.target.value)} placeholder="Anuncios" style={{ ...S.input, fontSize: 13 }} disabled={ocupado} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={conectar} disabled={ocupado || !phoneId.trim()} className="oft-btn-press"
                    style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: ocupado || !phoneId.trim() ? 0.5 : 1 }}>
                    {ocupado ? "Conectando..." : "Conectar"}
                  </button>
                  <button onClick={() => { setMostrarForm(false); setAviso(null); }} disabled={ocupado} className="oft-btn-press"
                    style={{ padding: "10px 14px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setMostrarForm(true); setAviso(null); }} className="oft-btn-press"
                style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: BLACK, color: WHITE, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 12 }}>
                <Plus size={15} /> Conectar número API
              </button>
            )
          ) : (
            <div style={{ fontSize: 12, color: GRAY3, marginBottom: 12 }}>Solo el administrador puede conectar o apagar números.</div>
          )}

          <button onClick={() => setMostrarGuia(v => !v)} className="oft-btn-press"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer", color: BLACK }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><ShieldCheck size={15} /> Cómo agregar el número nuevo en Meta</span>
            <ChevronDown size={16} style={{ transform: mostrarGuia ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
          </button>
          {mostrarGuia && (
            <div className="oft-fade-in" style={{ marginTop: 12 }}>
              {pasos.map(([t, d], i) => (
                <div key={t} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: BLACK, color: WHITE, fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{t}</div>
                    <div style={{ fontSize: 12, color: GRAY3, lineHeight: 1.5, marginTop: 2 }}>{d}</div>
                  </div>
                </div>
              ))}
              <div style={{ background: GRAY, borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: GRAY3, lineHeight: 1.5 }}>
                Tu línea actual (+507 6720-0474) sigue funcionando igual en la app de WhatsApp Business. Este número nuevo es aparte: solo vive en el CRM, sin celular.
                Un número nuevo empieza con un límite de conversaciones nuevas por día que Meta sube solo según uses y la calidad de tus chats.
              </div>
            </div>
          )}
        </div>

        {/* INSTAGRAM */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Instagram size={22} color={WHITE} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Instagram</div>
              <div style={{ fontSize: 11.5, color: GRAY3 }}>Mensajes directos en la misma Bandeja</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: GRAY, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <AlertCircle size={17} color={GRAY3} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: GRAY3, lineHeight: 1.4 }}>
              Todavía no conectado. Usa el mismo tipo de aprobación de Meta que WhatsApp -- una vez esa termine, conectar Instagram es más rápido porque ya tienes la App y el negocio verificados.
            </div>
          </div>
          <button disabled className="oft-btn-press" style={{ width: "100%", padding: "10px 0", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, color: GRAY3, fontWeight: 700, fontSize: 13, cursor: "not-allowed" }}>
            Conectar Instagram (avísame cuando quieras empezar)
          </button>
        </div>
      </div>
    </div>
  );
}
