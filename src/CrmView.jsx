import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle, Search, Send, User, Users, BarChart3, Inbox as InboxIcon,
  ChevronRight, Circle, CheckCheck, Check, Clock, RefreshCw, X, Tag,
  ArrowLeft, Zap, TrendingUp, Trophy, Target, DollarSign, ShoppingBag,
  Timer, AlertCircle, FileText, ExternalLink, Workflow, GitBranch, Plus,
  Trash2, Play, UserCheck, ToggleLeft, ToggleRight, StickyNote,
  Megaphone, Image as ImageIcon, Instagram, Plug, CheckCircle2, Upload,
  ChevronDown, Power, KeyRound, ShieldCheck, Phone, RotateCcw, Hash,
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

// Instagram: la conversación guarda el @usuario en vez de un teléfono
const esInstagram = (c) => c?.canal === "instagram";
const nombreDe = (c) => c?.nombre_contacto || (esInstagram(c) ? (c.ig_username ? `@${c.ig_username}` : "Contacto de Instagram") : c?.telefono) || "";
const subtituloDe = (c) => esInstagram(c) ? (c.ig_username ? `@${c.ig_username}` : "Instagram") : (c?.telefono || "");
const ESTADO_IG = {
  CONNECTED: { texto: "Activa", bg: "#D1FAE5", color: "#065F46" },
  TOKEN_EXPIRADO: { texto: "Token vencido", bg: "#FEE2E2", color: "#991B1B" },
  SIN_TOKEN: { texto: "Sin token", bg: "#FEE2E2", color: "#991B1B" },
  ERROR: { texto: "Con error", bg: "#FEF3C7", color: "#92400E" },
};

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
  const [convParaAbrir, setConvParaAbrir] = useState(null);
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
          {[["inbox", "Bandeja", InboxIcon], ["etapas", "Etapas", Tag], ["workflows", "Workflows", Workflow], ["broadcasts", "Broadcasts", Megaphone], ["contactos", "Contactos", User], ["plantillas", "Plantillas", FileText], ["agentes", "Agentes", Users], ["analitica", "Analítica", BarChart3], ["integraciones", "Integraciones", Plug]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className="oft-btn-press"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: esMobil ? "8px 10px" : "8px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: esMobil ? 12 : 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background 0.25s ease, color 0.25s ease", ...(tab === id ? ESTILO_TAB_ACTIVO : ESTILO_TAB) }}>
              <Icon size={15} /> {label}
              {id === "inbox" && conversaciones.filter(sinResponder).length > 0 && (
                <span title="Chats sin responder" style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 9, background: RED, color: WHITE }}>{conversaciones.filter(sinResponder).length}</span>
              )}
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
              abrirConvId={convParaAbrir} onAbierto={() => setConvParaAbrir(null)}
            />
          )}
          {tab === "contactos" && (
            <ContactosPanel conversaciones={conversaciones} setConversaciones={setConversaciones} etapas={etapas} etapaPorId={etapaPorId}
              agentes={agentes} agentePorId={agentePorId} pedidos={pedidos} user={user}
              onAbrirChat={(id) => { setConvParaAbrir(id); setTab("inbox"); }} />
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
          {tab === "plantillas" && (
            <PlantillasPanel />
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
function InboxPanel({ conversaciones, setConversaciones, etapas, etapaPorId, agentes, agentePorId, pedidos, user, recargar, sesionLista, abrirConvId, onAbierto }) {
  const esMobil = useEsMobil();
  const { campos: camposPersonalizados } = useCampos();
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
  const [cuentasIg, setCuentasIg] = useState([]);
  useEffect(() => {
    if (!sesionLista) return;
    sb.get("crm_cuentas_instagram", "?order=created_at.asc").then(d => setCuentasIg(d || [])).catch(() => {});
  }, [sesionLista]);
  const cuentaIgPorId = Object.fromEntries(cuentasIg.map(c => [c.id, c]));
  useEffect(() => { const t = setInterval(() => setReloj(x => x + 1), 60000); return () => clearInterval(t); }, []);
  const [filtro, setFiltro] = useState("todos"); // todos | sin_responder | mios | sin_asignar | cerradas | anuncios | etapa:<id> | tag:<x> | linea:<id>
  const [notas, setNotas] = useState([]);
  const [modoComposer, setModoComposer] = useState("responder"); // responder | nota
  const [respuestas, setRespuestas] = useState([]);
  const [mostrarRapidas, setMostrarRapidas] = useState(false);
  const [modalPlantilla, setModalPlantilla] = useState(false);
  const [valorPlantilla, setValorPlantilla] = useState({ nombre: "", idioma: "", variables: [], cabecera_url: null });
  const [enviandoPlantilla, setEnviandoPlantilla] = useState(false);
  const [errorPlantilla, setErrorPlantilla] = useState("");
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const { plantillas: plantillasAprobadas } = usePlantillas(true);
  useEffect(() => {
    if (!sesionLista) return;
    sb.get("crm_respuestas_rapidas", "?order=atajo.asc").then(d => setRespuestas(d || [])).catch(() => {});
  }, [sesionLista]);
  // La conversación abierta se mantiene al día cuando cambia en vivo (cerrarla, etiquetas, quién habló último)
  useEffect(() => {
    if (!seleccionada) return;
    const f = conversaciones.find(c => c.id === seleccionada.id);
    if (f && f !== seleccionada) setSeleccionada(f);
  }, [conversaciones]);
  const numeroPorId = Object.fromEntries(numeros.map(n => [n.id, n]));
  const variasLineas = numeros.filter(n => n.activo).length > 1;
  const nombreLinea = (id) => { const n = numeroPorId[id]; return n ? (n.etiqueta || n.numero_visible || "Línea") : null; };

  // En móvil solo se ve UNA pantalla a la vez: la lista, el chat, o el panel
  // de contacto -- igual que WhatsApp. En escritorio las 3 conviven siempre.
  const listaVisible = !esMobil || !seleccionada;
  const hiloVisible = !esMobil || (!!seleccionada && vistaMobil !== "contacto");
  const contactoVisible = esMobil ? (!!seleccionada && vistaMobil === "contacto") : !!seleccionada;

  const coincideFiltro = (c) => {
    if (filtro === "cerradas") return !estaAbierta(c);
    if (!estaAbierta(c)) return false;
    if (filtro === "todos") return true;
    if (filtro === "sin_responder") return sinResponder(c);
    if (filtro === "mios") return !!c.agente_id && c.agente_id === user?.id;
    if (filtro === "sin_asignar") return !c.agente_id;
    if (filtro === "anuncios") return c.origen === "anuncio";
    if (filtro.startsWith("etapa:")) { const id = filtro.slice(6); return id === "ninguna" ? !c.etapa_id : c.etapa_id === id; }
    if (filtro.startsWith("tag:")) return (c.etiquetas || []).includes(filtro.slice(4));
    if (filtro.startsWith("linea:")) return c.numero_id === filtro.slice(6);
    if (filtro.startsWith("ig:")) return c.ig_cuenta_id === filtro.slice(3);
    return true;
  };
  const TITULOS_FILTRO = { todos: "Todas las conversaciones", sin_responder: "Sin responder", mios: "Asignadas a mí", sin_asignar: "Sin asignar", cerradas: "Cerradas", anuncios: "Vienen de anuncios" };
  const tituloFiltro = TITULOS_FILTRO[filtro]
    || (filtro.startsWith("etapa:") ? (etapaPorId[filtro.slice(6)]?.nombre || "Sin etapa")
    : filtro.startsWith("tag:") ? `#${filtro.slice(4)}`
    : filtro.startsWith("linea:") ? (numeroPorId[filtro.slice(6)]?.etiqueta || "Línea")
    : filtro.startsWith("ig:") ? (cuentaIgPorId[filtro.slice(3)]?.etiqueta || "Instagram") : "");
  const conversacionesFiltradas = conversaciones.filter(c => {
    if (!coincideFiltro(c)) return false;
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (c.nombre_contacto || "").toLowerCase().includes(q) || (c.telefono || "").includes(q) || (c.ig_username || "").toLowerCase().includes(q.replace(/^@/, ""));
  }).sort((x, y) => {
    const fx = new Date(x.ultimo_mensaje_at || x.created_at).getTime(), fy = new Date(y.ultimo_mensaje_at || y.created_at).getTime();
    return filtro === "sin_responder" ? fx - fy : fy - fx; // sin responder: los que más llevan esperando, primero
  });

  const cargarMensajes = async (conv) => {
    setSeleccionada(conv);
    setVistaMobil("hilo");
    try {
      const data = await sb.get("crm_mensajes", `?conversacion_id=eq.${conv.id}&order=created_at.asc`);
      setMensajes(data || []);
      sb.get("crm_notas", `?conversacion_id=eq.${conv.id}&order=created_at.asc`).then(n => setNotas(n || [])).catch(() => setNotas([]));
      setModoComposer("responder"); setMostrarRapidas(false);
      if (conv.no_leidos > 0) {
        await sb.patch("crm_conversaciones", conv.id, { no_leidos: 0 });
        setConversaciones(prev => prev.map(c => c.id === conv.id ? { ...c, no_leidos: 0 } : c));
      }
    } catch (e) { console.warn("Error cargando mensajes:", e.message); }
  };

  useEffect(() => {
    if (!abrirConvId) return;
    const c = conversaciones.find(x => x.id === abrirConvId);
    if (!c) return;
    setFiltro("todos"); setBusqueda("");
    cargarMensajes(c);
    onAbierto && onAbierto();
  }, [abrirConvId, conversaciones]);

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
        if (payload.new.direccion === "entrante") sb.patch("crm_conversaciones", seleccionada.id, { no_leidos: 0 }).catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_notas" }, (payload) => {
        if (payload.new.conversacion_id !== seleccionada.id) return;
        setNotas(prev => prev.some(n => n.id === payload.new.id) ? prev : [...prev, payload.new]);
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

  const actualizarConv = async (cambios) => {
    const id = seleccionada.id;
    setConversaciones(prev => prev.map(c => c.id === id ? { ...c, ...cambios } : c));
    setSeleccionada(prev => ({ ...prev, ...cambios }));
    try { await sb.patch("crm_conversaciones", id, cambios); } catch (e) { alert("No se pudo guardar el cambio: " + e.message); recargar?.(); }
  };
  const cerrarConversacion = () => actualizarConv({ estado_chat: "cerrada", cerrada_at: new Date().toISOString(), no_leidos: 0 });
  const reabrirConversacion = () => actualizarConv({ estado_chat: "abierta", cerrada_at: null });
  const asignarmeConversacion = () => actualizarConv({ agente_id: user?.id || null });
  const agregarEtiqueta = (texto) => {
    const t = String(texto || "").trim().replace(/^#/, "").slice(0, 30);
    if (!t) return;
    const actuales = seleccionada.etiquetas || [];
    if (actuales.some(x => x.toLowerCase() === t.toLowerCase())) { setNuevaEtiqueta(""); return; }
    actualizarConv({ etiquetas: [...actuales, t] });
    setNuevaEtiqueta("");
  };
  const quitarEtiqueta = (t) => actualizarConv({ etiquetas: (seleccionada.etiquetas || []).filter(x => x !== t) });
  const etiquetasExistentes = [...new Set(conversaciones.flatMap(c => c.etiquetas || []))];

  const enviarNota = async () => {
    if (!texto.trim() || !seleccionada) return;
    setEnviando(true);
    try {
      const creada = await sb.post("crm_notas", { conversacion_id: seleccionada.id, contenido: texto.trim(), autor_agente_id: user?.id || null });
      if (Array.isArray(creada) && creada[0]) setNotas(prev => prev.some(n => n.id === creada[0].id) ? prev : [...prev, creada[0]]);
      setTexto("");
    } catch (e) { alert("No se pudo guardar la nota: " + e.message); }
    setEnviando(false);
  };

  const aplicarRespuesta = (r) => { setTexto(conNombre(r.contenido, seleccionada)); setMostrarRapidas(false); };
  const rapidasVisibles = (() => {
    if (modoComposer !== "responder") return [];
    if (texto.startsWith("/")) { const q = texto.slice(1).toLowerCase(); return respuestas.filter(r => r.atajo.includes(q)); }
    return mostrarRapidas ? respuestas : [];
  })();

  const enviarPlantilla = async () => {
    const pl = plantillasAprobadas.find(p => p.nombre === valorPlantilla.nombre && p.idioma === valorPlantilla.idioma);
    if (!pl) { setErrorPlantilla("Elige una plantilla."); return; }
    const armado = armarMensajePlantilla(pl, valorPlantilla, seleccionada, user);
    if (armado.error) { setErrorPlantilla(armado.error); return; }
    setEnviandoPlantilla(true); setErrorPlantilla("");
    try {
      const creado = await sb.post("crm_mensajes", armado.fila);
      const fila = Array.isArray(creado) ? creado[0] : null;
      if (!fila) throw new Error("No se pudo guardar el mensaje");
      setMensajes(prev => prev.some(m => m.id === fila.id) ? prev : [...prev, fila]);
      const res = (await enviarPorWhatsApp([fila.id]))[fila.id];
      const actualizado = res?.mensaje || { estado: res?.ok ? "enviado" : "fallido", error_envio: res?.ok ? null : (res?.error || "No se pudo enviar") };
      setMensajes(prev => prev.map(m => m.id === fila.id ? { ...m, ...actualizado } : m));
      if (res?.ok) {
        const ahora = new Date().toISOString(); const preview = ("📋 " + fila.contenido).slice(0, 60);
        await sb.patch("crm_conversaciones", seleccionada.id, { ultimo_mensaje_at: ahora, ultimo_mensaje_preview: preview });
        setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? { ...c, ultimo_mensaje_at: ahora, ultimo_mensaje_preview: preview } : c));
        setModalPlantilla(false); setValorPlantilla({ nombre: "", idioma: "", variables: [], cabecera_url: null });
      } else setErrorPlantilla(res?.error || "No se pudo enviar.");
    } catch (e) { setErrorPlantilla(e.message); }
    setEnviandoPlantilla(false);
  };

  const [respondiendoA, setRespondiendoA] = useState(null); // mensaje al que se le está por responder, o null

  // Guarda el mensaje en el CRM y lo manda de verdad por WhatsApp. Si WhatsApp
  // lo rechaza (por ejemplo, pasaron más de 24 h), el mensaje queda marcado
  // "No enviado" en el chat con el motivo, y esta función devuelve ese motivo.
  const registrarMensajeSaliente = async (contenido, actualizarPreview = true, respondeAId = null) => {
    const creado = await sb.post("crm_mensajes", {
      conversacion_id: seleccionada.id, direccion: "saliente", tipo: "texto",
      contenido, agente_id: user?.id || null, estado: "enviado",
      responde_a_id: respondeAId, canal: seleccionada.canal || "whatsapp",
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

  const hilo = [...mensajes, ...notas.map(n => ({ ...n, _nota: true }))].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  useEffect(() => { if (hiloRef.current) hiloRef.current.scrollTop = hiloRef.current.scrollHeight; }, [notas]);
  const ventanaHoras = horasDeVentana(mensajes);
  const ventanaCerrada = !!seleccionada && mensajes.length > 0 && ventanaHoras <= 0;
  const pedidosDelContacto = seleccionada ? pedidos.filter(p => p.telefono === seleccionada.telefono) : [];

  return (
    <>
      {/* BARRA LATERAL: carpetas, etapas, etiquetas */}
      {!esMobil && (
        <BarraFiltros conversaciones={conversaciones} etapas={etapas} user={user} filtro={filtro} setFiltro={setFiltro} numeros={numeros} cuentasIg={cuentasIg} esMobil={false} />
      )}

      {/* LISTA DE CONVERSACIONES */}
      {listaVisible && (
      <div className={esMobil ? "oft-fade-in" : undefined} style={{ width: esMobil ? "100%" : 340, minWidth: esMobil ? "100%" : 340, background: WHITE, borderRight: esMobil ? "none" : `1px solid ${GRAY2}`, display: "flex", flexDirection: "column" }}>
        {esMobil && <BarraFiltros conversaciones={conversaciones} etapas={etapas} user={user} filtro={filtro} setFiltro={setFiltro} numeros={numeros} cuentasIg={cuentasIg} esMobil />}
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${GRAY2}` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tituloFiltro}</div>
            <div style={{ fontSize: 12, color: GRAY3, fontWeight: 700, flexShrink: 0 }}>{conversacionesFiltradas.length} chat{conversacionesFiltradas.length !== 1 ? "s" : ""}</div>
          </div>
          {filtro === "sin_responder" && conversacionesFiltradas.length > 0 && <div style={{ fontSize: 11.5, color: GRAY3, margin: "-4px 0 8px" }}>Primero los que llevan más tiempo esperando.</div>}
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
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{conversaciones.length === 0 ? "Sin conversaciones todavía" : filtro === "sin_responder" ? "¡Todo respondido!" : "No hay chats en esta vista"}</div>
              <div style={{ fontSize: 12.5, color: GRAY3, lineHeight: 1.5 }}>{conversaciones.length === 0 ? "Aquí van a aparecer los chats de WhatsApp en cuanto se conecte el número." : filtro === "sin_responder" ? "No hay clientes esperando respuesta." : "Prueba con otra carpeta o etapa de la izquierda."}</div>
            </div>
          ) : conversacionesFiltradas.map(c => {
            const etapa = etapaPorId[c.etapa_id];
            const agente = agentePorId[c.agente_id];
            return (
              <div key={c.id} onClick={() => cargarMensajes(c)}
                style={{ padding: "13px 14px", borderBottom: `1px solid ${GRAY}`, cursor: "pointer", background: seleccionada?.id === c.id ? GRAY : WHITE, display: "flex", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: GRAY2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: 14, color: GRAY3 }}>
                  {(nombreDe(c).replace(/^@/, "") || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                    <div style={{ fontWeight: c.no_leidos > 0 ? 800 : 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                      {esInstagram(c) && <Instagram size={12} color="#DD2A7B" style={{ flexShrink: 0 }} />}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{nombreDe(c)}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: GRAY3, flexShrink: 0 }}>{formatoHora(c.ultimo_mensaje_at || c.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: c.no_leidos > 0 ? BLACK : GRAY3, fontWeight: c.no_leidos > 0 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {c.ultimo_mensaje_preview || "Sin mensajes"}
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                    {etapa && <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: etapa.color + "22", color: etapa.color }}>{etapa.nombre}</span>}
                    {agente && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: GRAY2, color: GRAY3 }}>{agente.nombre}</span>}
                    {sinResponder(c) && <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: "#FEE2E2", color: "#991B1B" }}>Esperando {tiempoEspera(c.ultimo_mensaje_at)}</span>}
                    {(c.etiquetas || []).slice(0, 2).map(t => <span key={t} style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: GRAY, color: GRAY3 }}>#{t}</span>)}
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
                {(nombreDe(seleccionada).replace(/^@/, "") || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(seleccionada)}</div>
                <div style={{ fontSize: 11.5, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {esInstagram(seleccionada) ? <span style={{ color: "#BE185D", fontWeight: 700 }}>Instagram{seleccionada.ig_username ? ` · @${seleccionada.ig_username}` : ""}{cuentaIgPorId[seleccionada.ig_cuenta_id] && cuentasIg.length > 1 ? ` · por ${cuentaIgPorId[seleccionada.ig_cuenta_id].etiqueta}` : ""}</span> : seleccionada.telefono}
                  {seleccionada.origen === "anuncio" && <span style={{ color: "#1E40AF", fontWeight: 700 }}> · Vino de un anuncio{seleccionada.anuncio_titulo ? `: ${seleccionada.anuncio_titulo}` : ""}</span>}
                  {!esInstagram(seleccionada) && nombreLinea(seleccionada.numero_id) && variasLineas && <span> · por {nombreLinea(seleccionada.numero_id)}</span>}
                </div>
              </div>
              {estaAbierta(seleccionada) ? (
                <button onClick={cerrarConversacion} className="oft-btn-press" title="Marcar como resuelta" style={{ background: GRAY, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: BLACK, flexShrink: 0 }}>
                  <CheckCircle2 size={13} /> {esMobil ? "Cerrar" : "Cerrar chat"}
                </button>
              ) : (
                <button onClick={reabrirConversacion} className="oft-btn-press" style={{ background: BLACK, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: WHITE, flexShrink: 0 }}>
                  <RotateCcw size={13} /> Reabrir
                </button>
              )}
              {esMobil && (
                <button onClick={() => setVistaMobil("contacto")} className="oft-btn-press" style={{ background: GRAY, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: GRAY3, flexShrink: 0 }}>
                  <Tag size={13} /> Info
                </button>
              )}
            </div>
            <div ref={hiloRef} style={{ flex: 1, overflowY: "auto", padding: esMobil ? 14 : 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {hilo.length === 0 ? (
                <div style={{ textAlign: "center", color: GRAY3, fontSize: 13, marginTop: 40 }}>Sin mensajes en esta conversación</div>
              ) : hilo.map(m => {
                if (m._nota) {
                  const autor = m.autor_agente_id ? (agentePorId[m.autor_agente_id]?.nombre || "Agente") : "Workflow";
                  return (
                    <div key={"n" + m.id} style={{ alignSelf: "center", maxWidth: esMobil ? "92%" : "70%", background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, lineHeight: 1.45, color: "#713F12", whiteSpace: "pre-wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, marginBottom: 3, opacity: 0.8 }}><StickyNote size={11} /> Nota interna · {autor} · {formatoHora(m.created_at)}</div>
                      {m.contenido}
                    </div>
                  );
                }
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
                        {m.tipo === "plantilla" && m.plantilla && (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.6, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><FileText size={10} /> Plantilla · {m.plantilla.nombre}</div>
                            {m.plantilla.cabecera_url && <img src={m.plantilla.cabecera_url} onClick={() => setImagenAmpliada(m.plantilla.cabecera_url)} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 9, display: "block", marginBottom: 6, cursor: "zoom-in" }} />}
                            {m.plantilla.cabecera_tipo === "TEXT" && m.plantilla.cabecera_texto && <div style={{ fontWeight: 800, marginBottom: 3 }}>{m.plantilla.cabecera_texto}</div>}
                          </>
                        )}
                        {m.tipo !== "documento" && m.contenido}
                        {m.tipo === "plantilla" && m.plantilla?.pie && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>{m.plantilla.pie}</div>}
                        {m.tipo === "plantilla" && (m.plantilla?.botones || []).length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                            {m.plantilla.botones.map((b, i) => <div key={i} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, padding: "5px 8px", borderRadius: 7, background: m.direccion === "saliente" ? "rgba(255,255,255,0.12)" : GRAY }}>{b.texto}</div>)}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4, marginBottom: tieneMedia ? 4 : 0, opacity: 0.6, fontSize: 10 }}>
                          {formatoHora(m.created_at)}
                          {m.direccion === "saliente" && (m.estado === "fallido" ? <AlertCircle size={12} color="#FCA5A5" /> : m.estado === "leido" ? <CheckCheck size={12} color="#7DD3FC" /> : m.estado === "entregado" ? <CheckCheck size={12} /> : <Check size={12} />)}
                        </div>
                        {m.direccion === "saliente" && m.estado === "fallido" && (
                          <div style={{ marginTop: 6, padding: "7px 9px", borderRadius: 8, background: "rgba(220,38,38,0.18)", fontSize: 11.5, lineHeight: 1.4, color: "#FECACA", whiteSpace: "normal" }}>
                            <strong style={{ color: "#FCA5A5" }}>No enviado.</strong> {m.error_envio || `${m.canal === "instagram" ? "Instagram" : "WhatsApp"} no pudo entregar este mensaje.`}
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
            {modalPlantilla && createPortal(
              <div onClick={() => !enviandoPlantilla && setModalPlantilla(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                <div onClick={e => e.stopPropagation()} style={{ background: WHITE, borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>Enviar plantilla</div>
                    <button onClick={() => setModalPlantilla(false)} disabled={enviandoPlantilla} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={18} /></button>
                  </div>
                  <div style={{ fontSize: 12.5, color: GRAY3, lineHeight: 1.45, marginBottom: 14 }}>A {seleccionada.nombre_contacto || seleccionada.telefono}. Las plantillas se pueden mandar aunque hayan pasado más de 24 horas.</div>
                  <PlantillaSelector plantillas={plantillasAprobadas} valor={valorPlantilla} onChange={setValorPlantilla} conv={seleccionada} />
                  {errorPlantilla && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.4 }}>{errorPlantilla}</div>}
                  <button onClick={enviarPlantilla} disabled={enviandoPlantilla || !valorPlantilla.nombre} className="oft-btn-press"
                    style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 11, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: enviandoPlantilla || !valorPlantilla.nombre ? 0.6 : 1 }}>
                    <Send size={15} /> {enviandoPlantilla ? "Enviando..." : "Enviar plantilla"}
                  </button>
                </div>
              </div>,
              document.body
            )}
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
              {modoComposer === "responder" && mensajes.length > 0 && ventanaHoras <= 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "#FEF3C7", color: "#92400E", fontSize: 12, lineHeight: 1.4, flexWrap: "wrap" }}>
                  <Clock size={14} style={{ flexShrink: 0 }} />
                  <span style={{ flex: "1 1 220px" }}>{esInstagram(seleccionada) ? "Pasaron más de 24 horas desde el último mensaje de esta persona. Instagram solo deja responder dentro de las 24 horas: espera a que te escriba de nuevo." : "Pasaron más de 24 horas desde el último mensaje del cliente. Solo puedes escribirle con una plantilla aprobada."}</span>
                  {!esInstagram(seleccionada) && <button onClick={() => { setModalPlantilla(true); setErrorPlantilla(""); }} className="oft-btn-press" style={{ background: "#92400E", color: WHITE, border: "none", borderRadius: 8, padding: "6px 11px", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><FileText size={13} /> Enviar plantilla</button>}
                </div>
              )}
              {modoComposer === "responder" && mensajes.length > 0 && ventanaHoras > 0 && ventanaHoras < 3 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "#FEF3C7", color: "#92400E", fontSize: 12 }}>
                  <Clock size={13} style={{ flexShrink: 0 }} />
                  <span>Te {ventanaHoras < 1 ? "queda menos de 1 hora" : `quedan unas ${Math.ceil(ventanaHoras)} horas`} para responderle.</span>
                </div>
              )}
              {rapidasVisibles.length > 0 && (
                <div style={{ maxHeight: 190, overflowY: "auto", borderBottom: `1px solid ${GRAY2}`, background: WHITE }}>
                  {rapidasVisibles.map(r => (
                    <button key={r.id} onClick={() => aplicarRespuesta(r)} className="oft-btn-press" style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", border: "none", borderBottom: `1px solid ${GRAY}`, background: WHITE, cursor: "pointer" }}>
                      <span style={{ fontWeight: 800, fontSize: 12.5 }}>/{r.atajo}</span>
                      <span style={{ fontSize: 12, color: GRAY3, marginLeft: 8 }}>{r.contenido.length > 70 ? r.contenido.slice(0, 70) + "…" : r.contenido}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 4, padding: "8px 14px 0" }}>
                {[["responder", "Responder"], ["nota", "Nota interna"]].map(([id, label]) => (
                  <button key={id} onClick={() => { setModoComposer(id); setMostrarRapidas(false); }} className="oft-btn-press"
                    style={{ fontSize: 12, fontWeight: 800, padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer", background: modoComposer === id ? (id === "nota" ? "#FEF08A" : BLACK) : GRAY, color: modoComposer === id ? (id === "nota" ? "#713F12" : WHITE) : GRAY3 }}>{label}</button>
                ))}
              </div>
              <div style={{ padding: "8px 14px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                {modoComposer === "responder" && (
                  <>
                    <button onClick={() => setMostrarRapidas(v => !v)} className="oft-btn-press" title="Respuestas rápidas (o escribe /)" style={{ background: mostrarRapidas ? BLACK : GRAY, color: mostrarRapidas ? WHITE : GRAY3, border: "none", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><Zap size={16} /></button>
                    {!esInstagram(seleccionada) && <button onClick={() => { setModalPlantilla(true); setErrorPlantilla(""); }} className="oft-btn-press" title="Enviar una plantilla de WhatsApp" style={{ background: GRAY, color: GRAY3, border: "none", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><FileText size={16} /></button>}
                  </>
                )}
                <input value={texto} onChange={e => setTexto(e.target.value)}
                  placeholder={modoComposer === "nota" ? "Nota interna: solo la ve tu equipo..." : ventanaCerrada ? (esInstagram(seleccionada) ? "Pasaron 24 h: espera su próximo mensaje" : "Pasaron 24 h: usa una plantilla") : (esMobil ? "Escribe un mensaje..." : "Escribe un mensaje... (o / para respuestas rápidas)")}
                  disabled={modoComposer === "responder" && ventanaCerrada}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); modoComposer === "nota" ? enviarNota() : enviarMensaje(); } }}
                  style={{ ...S.input, marginBottom: 0, flex: 1, minWidth: 0, opacity: modoComposer === "responder" && ventanaCerrada ? 0.6 : 1, background: modoComposer === "nota" ? "#FEFCE8" : undefined, borderColor: modoComposer === "nota" ? "#FDE68A" : undefined }} />
                <button onClick={modoComposer === "nota" ? enviarNota : enviarMensaje} disabled={enviando || !texto.trim() || (modoComposer === "responder" && ventanaCerrada)} className="oft-btn-press"
                  style={{ background: modoComposer === "nota" ? "#CA8A04" : BLACK, color: WHITE, border: "none", borderRadius: 10, width: 44, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: enviando || !texto.trim() || (modoComposer === "responder" && ventanaCerrada) ? 0.5 : 1 }}>
                  {modoComposer === "nota" ? <StickyNote size={17} /> : <Send size={17} />}
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
              {(nombreDe(seleccionada).replace(/^@/, "") || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{nombreDe(seleccionada) || "Sin nombre"}</div>
            {esInstagram(seleccionada) ? (
              <div style={{ fontSize: 12.5, color: "#BE185D", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Instagram size={13} /> {seleccionada.ig_username ? <a href={`https://instagram.com/${seleccionada.ig_username}`} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>@{seleccionada.ig_username}</a> : "Instagram"}
              </div>
            ) : <div style={{ fontSize: 12.5, color: GRAY3 }}>{seleccionada.telefono}</div>}
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

          <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>ESTADO DEL CHAT</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 7, background: estaAbierta(seleccionada) ? "#D1FAE5" : GRAY2, color: estaAbierta(seleccionada) ? "#065F46" : GRAY3 }}>{estaAbierta(seleccionada) ? "Abierto" : "Cerrado"}</span>
            {sinResponder(seleccionada) && <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 7, background: "#FEE2E2", color: "#991B1B" }}>Sin responder</span>}
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>ETAPA</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {etapas.map(et => (
              <button key={et.id} onClick={() => cambiarEtapa(et.id)} className="oft-btn-press"
                style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 7, cursor: "pointer", border: `1.5px solid ${seleccionada.etapa_id === et.id ? et.color : GRAY2}`, background: seleccionada.etapa_id === et.id ? et.color + "1A" : WHITE, color: seleccionada.etapa_id === et.id ? et.color : GRAY3 }}>
                {et.nombre}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            AGENTE ASIGNADO
            {seleccionada.agente_id !== user?.id && <button onClick={asignarmeConversacion} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800, color: RED, padding: 0, letterSpacing: 0 }}>Asignarme</button>}
          </div>
          <select value={seleccionada.agente_id || ""} onChange={e => cambiarAgente(e.target.value)} style={{ ...S.input, marginBottom: 20, fontSize: 13 }}>
            <option value="">Sin asignar</option>
            {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>

          <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>ETIQUETAS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {(seleccionada.etiquetas || []).map(t => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 7, background: GRAY2, color: BLACK }}>
                #{t}
                <button onClick={() => quitarEtiqueta(t)} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={11} color={GRAY3} /></button>
              </span>
            ))}
          </div>
          <input value={nuevaEtiqueta} onChange={e => setNuevaEtiqueta(e.target.value)} list="oft-etiquetas" placeholder="Agregar etiqueta y Enter"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregarEtiqueta(nuevaEtiqueta); } }}
            style={{ ...S.input, marginBottom: 20, fontSize: 13 }} />
          <datalist id="oft-etiquetas">{etiquetasExistentes.map(t => <option key={t} value={t} />)}</datalist>

          <CamposContacto key={seleccionada.id} conv={seleccionada} campos={camposPersonalizados} onGuardar={actualizarConv} />

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
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>{nombreDe(c)}</div>
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
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>{nombreDe(c)}</div>
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
  if (paso.tipo === "enviar_mensaje" && c.modo === "plantilla") return c.plantilla_nombre ? `Plantilla: ${c.plantilla_nombre}` : "Sin plantilla todavía";
  if (paso.tipo === "enviar_mensaje") return c.texto ? `"${c.texto.slice(0, 40)}${c.texto.length > 40 ? "…" : ""}"` : "Sin texto todavía";
  if (paso.tipo === "esperar") return c.minutos ? `${c.minutos} minutos` : "Sin definir";
  if (paso.tipo === "cambiar_etapa") return c.etapa_id ? "Etapa elegida" : "Sin elegir etapa";
  if (paso.tipo === "asignar_agente") return c.modo === "menos_conversaciones" ? "Al que tenga menos chats" : c.agente_id ? "Agente elegido" : "Sin elegir agente";
  if (paso.tipo === "agregar_nota") return c.texto ? `"${c.texto.slice(0, 40)}${c.texto.length > 40 ? "…" : ""}"` : "Sin texto todavía";
  if (paso.tipo === "bifurcacion") return c.campo ? `Si ${c.campo.replace("campos.", "")} ${c.operador || "es"} ...` : "Sin condición todavía";
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
  const { campos: camposPers } = useCampos();
  const campoSel = c.campo?.startsWith("campos.") ? camposPers.find(x => "campos." + x.clave === c.campo) : null;
  const { plantillas: plantillasAprobadas } = usePlantillas(true);
  // En workflows solo sirven las que se pueden mandar sin elegir imagen cada vez
  const plantillasParaFlujo = plantillasAprobadas.filter(p => !["VIDEO", "DOCUMENT"].includes(p.cabecera_tipo) && (p.cabecera_tipo !== "IMAGE" || p.cabecera_media_url));

  return (
    <PanelLateral titulo={meta.label} icono={meta.icono} color={meta.color} esMobil={esMobil} onCerrar={onCerrar}>
      {paso.tipo === "enviar_mensaje" && (
        <>
          <EtiquetaCampo>¿Qué enviar?</EtiquetaCampo>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[["texto", "Mensaje libre"], ["plantilla", "Plantilla"]].map(([id, t]) => (
              <button key={id} onClick={() => set({ modo: id })} className="oft-btn-press"
                style={{ flex: 1, fontSize: 12.5, fontWeight: 700, padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${(c.modo || "texto") === id ? BLACK : GRAY2}`, background: (c.modo || "texto") === id ? BLACK : WHITE, color: (c.modo || "texto") === id ? WHITE : GRAY3, cursor: "pointer" }}>{t}</button>
            ))}
          </div>
          {c.modo === "plantilla" ? (
            <>
              <PlantillaSelector plantillas={plantillasParaFlujo}
                valor={{ nombre: c.plantilla_nombre || "", idioma: c.plantilla_idioma || "", variables: c.variables || [], cabecera_url: null }}
                onChange={v => set({ plantilla_nombre: v.nombre, plantilla_idioma: v.idioma, variables: v.variables })} />
              <div style={{ fontSize: 11.5, color: GRAY3, marginTop: 10, lineHeight: 1.45 }}>Las plantillas se mandan aunque hayan pasado más de 24 horas. Meta cobra cada una.</div>
            </>
          ) : (
            <>
              <EtiquetaCampo>Mensaje a enviar</EtiquetaCampo>
              <textarea value={c.texto || ""} onChange={e => set({ texto: e.target.value })} rows={5} placeholder="Escribe el mensaje... usa {nombre} para el nombre del cliente" style={{ ...S.input, resize: "vertical", fontSize: 13 }} />
              <div style={{ fontSize: 11.5, color: GRAY3, marginTop: -10 }}>Ejemplo: "Hola {"{nombre}"}, ¿todavía te interesa el pedido?" · Solo llega si el cliente escribió en las últimas 24 horas.</div>
            </>
          )}
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
            {camposPers.length > 0 && (
              <optgroup label="Campos del contacto">
                {camposPers.map(f => <option key={f.id} value={"campos." + f.clave}>{f.nombre}</option>)}
              </optgroup>
            )}
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
              {campoSel && !["seleccion", "si_no"].includes(campoSel.tipo) ? (
                <input value={c.valor || ""} onChange={e => set({ valor: e.target.value })} type={campoSel.tipo === "numero" ? "number" : campoSel.tipo === "fecha" ? "date" : "text"} placeholder="Valor a comparar" style={{ ...S.input, fontSize: 13 }} />
              ) : (
              <select value={c.valor || ""} onChange={e => set({ valor: e.target.value })} style={{ ...S.input, fontSize: 13 }}>
                <option value="">Selecciona...</option>
                {campoSel?.tipo === "seleccion" && (campoSel.opciones || []).map(o => <option key={o} value={o}>{o}</option>)}
                {campoSel?.tipo === "si_no" && <><option value="true">Sí</option><option value="false">No</option></>}
                {c.campo === "etapa_id" && etapas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
                {c.campo === "agente_id" && agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              )}
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
  const [modo, setModo] = useState("libre"); // libre (solo quienes escribieron en 24 h) | plantilla (a todos)
  const [valorPlantilla, setValorPlantilla] = useState({ nombre: "", idioma: "", variables: [], cabecera_url: null });
  const [etiquetasSel, setEtiquetasSel] = useState([]);
  const { plantillas: plantillasAprobadas } = usePlantillas(true);
  const todasEtiquetas = [...new Set(conversaciones.flatMap(c => c.etiquetas || []))];

  const destinatarios = conversaciones.filter(c =>
    !esInstagram(c) && // Instagram no admite envíos masivos ni plantillas
    (etapasSeleccionadas.length === 0 || etapasSeleccionadas.includes(c.etapa_id)) &&
    (etiquetasSel.length === 0 || (c.etiquetas || []).some(t => etiquetasSel.includes(t))));

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
    const esPlantilla = modo === "plantilla";
    if (!nombre.trim() || (!esPlantilla && !mensajeTexto.trim())) { alert("Ponle un nombre interno y escribe el mensaje"); return; }
    if (destinatarios.length === 0) { alert("No hay ningún cliente con ese filtro"); return; }
    const plantillaSel = esPlantilla ? plantillasAprobadas.find(p => p.nombre === valorPlantilla.nombre && p.idioma === valorPlantilla.idioma) : null;
    if (esPlantilla) {
      if (!plantillaSel) { alert("Elige una plantilla aprobada"); return; }
      const prueba = armarMensajePlantilla(plantillaSel, valorPlantilla, destinatarios[0], user);
      if (prueba.error) { alert(prueba.error); return; }
    }
    if (!confirm(esPlantilla
      ? `¿Enviar la plantilla "${plantillaSel.nombre}" a ${destinatarios.length} clientes? No se puede deshacer.\n\nMeta cobra cada plantilla enviada.`
      : `¿Enviar este broadcast a ${destinatarios.length} clientes? No se puede deshacer.\n\nWhatsApp solo entrega a quienes te escribieron en las últimas 24 horas.`)) return;
    setEnviando(true);
    try {
      let imagenUrl = null;
      if (imagenFile && !esPlantilla) {
        const comprimida = await comprimirImagen(imagenFile);
        const nombreArchivo = `broadcasts/${Date.now()}_${imagenFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        await sb.upload("crm", nombreArchivo, comprimida);
        imagenUrl = sb.publicUrl("crm", nombreArchivo);
      }
      const [broadcast] = await sb.post("crm_broadcasts", {
        nombre: nombre.trim(), canal: "whatsapp", mensaje_texto: esPlantilla ? `[Plantilla] ${plantillaSel.nombre}` : mensajeTexto.trim(), imagen_url: imagenUrl,
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
              ultimo_mensaje_preview: esPlantilla ? ("📋 " + x.resumen).slice(0, 55) : (imagenUrl ? "📷 " : "") + mensajeTexto.trim().slice(0, 55),
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
        const datos = esPlantilla
          ? armarMensajePlantilla(plantillaSel, valorPlantilla, conv, user, { broadcast_id: broadcast.id }).fila
          : {
            conversacion_id: conv.id, direccion: "saliente", tipo: imagenUrl ? "imagen" : "texto",
            contenido: mensajeTexto.trim(), media_url: imagenUrl, agente_id: user?.id || null,
            estado: "enviado", broadcast_id: broadcast.id, canal: "whatsapp",
          };
        const [fila] = await sb.post("crm_mensajes", datos);
        pendientes.push({ id: fila.id, convId: conv.id, resumen: datos.contenido });
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

        <EtiquetaCampo>Tipo de mensaje</EtiquetaCampo>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[["libre", "Mensaje libre", "Solo les llega a quienes te escribieron en las últimas 24 h"], ["plantilla", "Plantilla aprobada", "Llega a todos, aunque no te escriban hace meses"]].map(([id, t, d]) => (
            <button key={id} onClick={() => setModo(id)} disabled={enviando} className="oft-btn-press"
              style={{ flex: "1 1 200px", textAlign: "left", padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${modo === id ? BLACK : GRAY2}`, background: modo === id ? GRAY : WHITE, cursor: "pointer" }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: GRAY3, lineHeight: 1.35 }}>{d}</div>
            </button>
          ))}
        </div>

        {modo === "plantilla" ? (
          <div style={{ marginBottom: 14 }}>
            <PlantillaSelector plantillas={plantillasAprobadas} valor={valorPlantilla} onChange={setValorPlantilla} conv={destinatarios[0] || null} />
          </div>
        ) : (
        <>
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

        </>
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
        {todasEtiquetas.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: GRAY3, margin: "10px 0 6px" }}>Solo con estas etiquetas (opcional)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {todasEtiquetas.map(t => (
                <button key={t} onClick={() => setEtiquetasSel(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} disabled={enviando} className="oft-btn-press"
                  style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${etiquetasSel.includes(t) ? BLACK : GRAY2}`, background: etiquetasSel.includes(t) ? BLACK : WHITE, color: etiquetasSel.includes(t) ? WHITE : GRAY3, cursor: "pointer" }}>#{t}</button>
              ))}
            </div>
          </>
        )}
        <div style={{ fontSize: 12.5, color: GRAY3, marginBottom: 24 }}>
          Este broadcast va a llegarle a <strong style={{ color: BLACK }}>{destinatarios.length}</strong> cliente{destinatarios.length !== 1 ? "s" : ""}.
        </div>
        {modo === "libre" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FEF3C7", color: "#92400E", borderRadius: 10, padding: "9px 12px", fontSize: 12, lineHeight: 1.4, margin: "-12px 0 20px" }}>
            <Clock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>WhatsApp solo entrega mensajes libres a quienes te escribieron en las últimas 24 horas. A los demás les aparecerá "No enviado" en su chat. Para llegar a todos, usa una plantilla aprobada.</span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: GRAY, color: GRAY3, borderRadius: 10, padding: "9px 12px", fontSize: 12, lineHeight: 1.4, margin: "-12px 0 20px" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Meta cobra cada plantilla enviada y puede limitar cuántos mensajes de marketing recibe cada persona.</span>
          </div>
        )}

        <button onClick={enviar} disabled={enviando} className="oft-btn-press"
          style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 14.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: enviando ? 0.7 : 1 }}>
          <Send size={16} /> {enviando ? `Enviando... ${progreso}/${destinatarios.length}` : `Enviar a ${destinatarios.length} clientes`}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ESTADOS DE LA BANDEJA, PLANTILLAS Y RESPUESTAS RÁPIDAS
// ═══════════════════════════════════════════════════════════════
const estaAbierta = (c) => c.estado_chat !== "cerrada";
// "Sin responder" = el último mensaje (que no falló) lo mandó el cliente y la conversación sigue abierta
const sinResponder = (c) => estaAbierta(c) && c.ultimo_direccion === "entrante";

function tiempoEspera(fecha) {
  if (!fecha) return "";
  const min = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / 1440)} d`;
}

const primerNombre = (conv) => String(conv?.nombre_contacto || "").trim().split(/\s+/)[0] || "cliente";
const conNombre = (texto, conv) => String(texto || "").replace(/\{nombre\}/g, primerNombre(conv));
const contarVariables = (cuerpo) => Math.max(0, ...[...String(cuerpo || "").matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1])));
const rellenarVariables = (cuerpo, vars) => String(cuerpo || "").replace(/\{\{(\d+)\}\}/g, (_, n) => (vars?.[Number(n) - 1] ?? "") || `{{${n}}}`);

const ESTADO_PLANTILLA = {
  APPROVED: { texto: "Aprobada", bg: "#D1FAE5", color: "#065F46" },
  PENDING: { texto: "En revisión", bg: "#FEF3C7", color: "#92400E" },
  IN_APPEAL: { texto: "En apelación", bg: "#FEF3C7", color: "#92400E" },
  REJECTED: { texto: "Rechazada", bg: "#FEE2E2", color: "#991B1B" },
  PAUSED: { texto: "Pausada por Meta", bg: "#FEE2E2", color: "#991B1B" },
  DISABLED: { texto: "Desactivada", bg: "#FEE2E2", color: "#991B1B" },
};
const CATEGORIA_PLANTILLA = { MARKETING: "Marketing", UTILITY: "Utilidad", AUTHENTICATION: "Autenticación" };

// Arma la fila que se guarda (y luego se manda por WhatsApp) para una plantilla.
// Devuelve { fila } o { error }.
function armarMensajePlantilla(pl, valor, conv, user, extra = {}) {
  const n = contarVariables(pl.cuerpo);
  const vars = Array.from({ length: n }, (_, i) => conNombre(valor?.variables?.[i] || "", conv).trim());
  if (vars.some(v => !v)) return { error: "Llena todas las variables de la plantilla." };
  const urlImagen = pl.cabecera_tipo === "IMAGE" ? (pl.cabecera_media_url || valor?.cabecera_url || null) : null;
  if (pl.cabecera_tipo === "IMAGE" && !urlImagen) return { error: "Esta plantilla lleva imagen. Sube una." };
  if (["VIDEO", "DOCUMENT"].includes(pl.cabecera_tipo)) return { error: "Esta plantilla lleva video o documento y todavía no se puede enviar desde aquí." };
  return {
    fila: {
      conversacion_id: conv.id, direccion: "saliente", tipo: "plantilla", canal: "whatsapp", estado: "enviado",
      contenido: rellenarVariables(pl.cuerpo, vars), agente_id: user?.id || null,
      plantilla: { nombre: pl.nombre, idioma: pl.idioma, variables: vars, cabecera_tipo: pl.cabecera_tipo, cabecera_texto: pl.cabecera_texto, cabecera_url: urlImagen, pie: pl.pie, botones: pl.botones || [] },
      ...extra,
    },
  };
}

// Plantillas guardadas en el CRM (se mantienen al día con Meta al sincronizar).
function usePlantillas(soloAprobadas = false) {
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const recargar = async () => {
    try {
      const filtro = soloAprobadas ? "?estado=eq.APPROVED&order=nombre.asc" : "?order=created_at.desc";
      setPlantillas((await sb.get("crm_plantillas", filtro)) || []);
    } catch (e) { setPlantillas([]); }
    setCargando(false);
  };
  useEffect(() => { recargar(); }, []);
  return { plantillas, setPlantillas, cargando, recargar };
}

async function llamarFuncion(nombre, cuerpo) {
  await sb.ensureFreshToken?.();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${nombre}`, { method: "POST", headers: sb.functionHeaders(), body: JSON.stringify(cuerpo) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
  return data;
}

// Vista previa tipo WhatsApp de una plantilla
function PlantillaVista({ cabeceraTipo, cabeceraTexto, cabeceraUrl, cuerpo, pie, botones = [], compacta = false }) {
  const lista = (botones || []).filter(b => b.texto);
  return (
    <div style={{ background: "#ECE5DD", borderRadius: 12, padding: compacta ? 8 : 14 }}>
      <div style={{ background: WHITE, borderRadius: "4px 12px 12px 12px", padding: 6, maxWidth: 300, boxShadow: "0 1px 1px rgba(0,0,0,0.12)" }}>
        {cabeceraTipo === "IMAGE" && (
          cabeceraUrl
            ? <img src={cabeceraUrl} style={{ width: "100%", height: compacta ? 110 : 150, objectFit: "cover", borderRadius: 8, display: "block", marginBottom: 6 }} />
            : <div style={{ height: 90, borderRadius: 8, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", color: GRAY3, fontSize: 11.5, marginBottom: 6 }}><ImageIcon size={16} style={{ marginRight: 5 }} /> Imagen</div>
        )}
        {cabeceraTipo === "TEXT" && cabeceraTexto && <div style={{ fontWeight: 800, fontSize: 13.5, padding: "3px 6px 0" }}>{cabeceraTexto}</div>}
        <div style={{ fontSize: 13, lineHeight: 1.45, padding: "3px 6px", whiteSpace: "pre-wrap", wordBreak: "break-word", color: BLACK }}>{cuerpo || <span style={{ color: GRAY3 }}>Aquí se verá tu mensaje…</span>}</div>
        {pie && <div style={{ fontSize: 11, color: GRAY3, padding: "0 6px 3px" }}>{pie}</div>}
      </div>
      {lista.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 3, maxWidth: 300 }}>
          {lista.map((b, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: 8, padding: "7px 8px", textAlign: "center", color: "#1B7BC4", fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 1px 1px rgba(0,0,0,0.12)" }}>
              {b.tipo === "URL" && <ExternalLink size={12} />}
              {b.tipo === "PHONE_NUMBER" && <Phone size={12} />}
              {b.tipo === "QUICK_REPLY" && <ArrowLeft size={12} />}
              {b.texto}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Elegir una plantilla aprobada y llenar sus variables. Se usa en la Bandeja,
// los Broadcasts y los Workflows. "valor" = { nombre, idioma, variables, cabecera_url }.
function PlantillaSelector({ plantillas, valor, onChange, conv = null, permitirNombre = true }) {
  const [subiendo, setSubiendo] = useState(false);
  const actual = plantillas.find(p => p.nombre === valor?.nombre && p.idioma === valor?.idioma) || null;
  const n = actual ? contarVariables(actual.cuerpo) : 0;
  const vars = Array.from({ length: n }, (_, i) => valor?.variables?.[i] || "");
  const fijar = (cambios) => onChange({ ...valor, ...cambios });

  const elegir = (clave) => {
    const p = plantillas.find(x => `${x.nombre}|${x.idioma}` === clave);
    if (!p) { onChange({ nombre: "", idioma: "", variables: [], cabecera_url: null }); return; }
    // La primera variable casi siempre es el nombre del cliente: se deja lista
    const base = Array.from({ length: contarVariables(p.cuerpo) }, (_, i) => (i === 0 && permitirNombre ? "{nombre}" : ""));
    onChange({ nombre: p.nombre, idioma: p.idioma, variables: base, cabecera_url: null });
  };

  const subirImagen = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSubiendo(true);
    try {
      const comprimida = await comprimirImagen(file);
      const ruta = `plantillas-envio/${Date.now()}_${comprimida.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      await sb.upload("crm", ruta, comprimida);
      fijar({ cabecera_url: sb.publicUrl("crm", ruta) });
    } catch (err) { alert("No se pudo subir la imagen: " + err.message); }
    setSubiendo(false);
  };

  const textoVista = actual ? rellenarVariables(actual.cuerpo, vars.map(v => conv ? conNombre(v, conv) : v.replace(/\{nombre\}/g, "Cliente"))) : "";

  return (
    <div>
      <EtiquetaCampo>Plantilla aprobada</EtiquetaCampo>
      <select value={actual ? `${actual.nombre}|${actual.idioma}` : ""} onChange={e => elegir(e.target.value)} style={{ ...S.input, fontSize: 13 }}>
        <option value="">{plantillas.length === 0 ? "No hay plantillas aprobadas todavía" : "Elige una plantilla..."}</option>
        {plantillas.map(p => <option key={p.id} value={`${p.nombre}|${p.idioma}`}>{p.nombre} · {CATEGORIA_PLANTILLA[p.categoria] || p.categoria}</option>)}
      </select>
      {actual && (
        <>
          {n > 0 && (
            <>
              <EtiquetaCampo>Datos que cambian en cada mensaje</EtiquetaCampo>
              {vars.map((v, i) => (
                <input key={i} value={v} onChange={e => { const nuevas = [...vars]; nuevas[i] = e.target.value; fijar({ variables: nuevas }); }}
                  placeholder={`Variable {{${i + 1}}}${actual.cuerpo_ejemplos?.[i] ? ` (ej: ${actual.cuerpo_ejemplos[i]})` : ""}`}
                  style={{ ...S.input, fontSize: 13, marginBottom: 8 }} />
              ))}
              {permitirNombre && <div style={{ fontSize: 11.5, color: GRAY3, margin: "-2px 0 12px" }}>Escribe <strong>{"{nombre}"}</strong> y se cambia por el nombre de cada cliente.</div>}
            </>
          )}
          {actual.cabecera_tipo === "IMAGE" && !actual.cabecera_media_url && (
            <>
              <EtiquetaCampo>Imagen de la plantilla</EtiquetaCampo>
              {valor?.cabecera_url ? <img src={valor.cabecera_url} style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 10, marginBottom: 12 }} /> : (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: `1.5px dashed ${GRAY2}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: GRAY3, marginBottom: 12 }}>
                  <Upload size={14} /> {subiendo ? "Subiendo..." : "Subir imagen"}
                  <input type="file" accept="image/*" onChange={subirImagen} style={{ display: "none" }} disabled={subiendo} />
                </label>
              )}
            </>
          )}
          <PlantillaVista cabeceraTipo={actual.cabecera_tipo} cabeceraTexto={actual.cabecera_texto} cabeceraUrl={actual.cabecera_media_url || valor?.cabecera_url} cuerpo={textoVista} pie={actual.pie} botones={actual.botones} compacta />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  PESTAÑA "PLANTILLAS": plantillas de WhatsApp (se crean aquí y las
//  aprueba Meta) y respuestas rápidas del equipo.
// ─────────────────────────────────────────────────────────────
function PlantillasPanel() {
  const esMobil = useEsMobil();
  const { user } = useApp();
  const esAdmin = !!user?.es_admin;
  const [seccion, setSeccion] = useState("plantillas");
  const SECCIONES = [["plantillas", "Plantillas de WhatsApp", FileText], ["rapidas", "Respuestas rápidas", Zap]];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
      <div style={{ background: WHITE, borderBottom: `1px solid ${GRAY2}`, padding: esMobil ? "8px 12px" : "10px 24px", display: "flex", gap: 6, overflowX: "auto" }}>
        {SECCIONES.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setSeccion(id)} className="oft-btn-press"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", ...(seccion === id ? ESTILO_TAB_ACTIVO : { color: GRAY3, background: GRAY }) }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {seccion === "plantillas" ? <ListaPlantillas esAdmin={esAdmin} esMobil={esMobil} /> : <RespuestasRapidasPanel esMobil={esMobil} user={user} />}
    </div>
  );
}

function ListaPlantillas({ esAdmin, esMobil }) {
  const { plantillas, setPlantillas, cargando } = usePlantillas(false);
  const [filtro, setFiltro] = useState("TODAS");
  const [creando, setCreando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const sincronizar = async (silencioso = false) => {
    setSincronizando(true); if (!silencioso) setAviso(null);
    try {
      const data = await llamarFuncion("whatsapp-plantillas", { modo: "sincronizar" });
      setPlantillas(data.plantillas || []);
      if (!silencioso) setAviso({ tipo: "ok", texto: "Plantillas al día con Meta." });
    } catch (e) { if (!silencioso) setAviso({ tipo: "error", texto: e.message }); }
    setSincronizando(false);
  };
  // Al entrar se actualiza solo el estado (Meta aprueba o rechaza sin avisar al CRM)
  useEffect(() => { sincronizar(true); }, []);

  const eliminar = async (p) => {
    if (!confirm(`¿Borrar la plantilla "${p.nombre}"? También se borra en Meta y no se puede deshacer.`)) return;
    try {
      await llamarFuncion("whatsapp-plantillas", { modo: "eliminar", nombre: p.nombre });
      setPlantillas(prev => prev.filter(x => x.id !== p.id));
    } catch (e) { setAviso({ tipo: "error", texto: e.message }); }
  };

  if (creando) {
    return <EditorPlantilla esMobil={esMobil} onCerrar={() => setCreando(false)}
      onCreada={(p) => { setPlantillas(prev => [p, ...prev.filter(x => x.id !== p.id)]); setCreando(false); setAviso({ tipo: "ok", texto: "Plantilla enviada a revisión de Meta. Suele tardar de unos minutos a 24 horas; el estado se actualiza solo al entrar aquí o con el botón Sincronizar." }); }} />;
  }

  const conteo = (e) => plantillas.filter(p => p.estado === e).length;
  const FILTROS = [["TODAS", "Todas", plantillas.length], ["APPROVED", "Aprobadas", conteo("APPROVED")], ["PENDING", "En revisión", conteo("PENDING")], ["REJECTED", "Rechazadas", plantillas.filter(p => ["REJECTED", "PAUSED", "DISABLED"].includes(p.estado)).length]];
  const visibles = plantillas.filter(p => filtro === "TODAS" ? true : filtro === "REJECTED" ? ["REJECTED", "PAUSED", "DISABLED"].includes(p.estado) : p.estado === filtro);
  const colorAviso = aviso?.tipo === "ok" ? { bg: "#D1FAE5", color: "#065F46" } : { bg: "#FEE2E2", color: "#991B1B" };

  return (
    <div style={{ flex: 1, padding: esMobil ? 14 : 24, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>Plantillas de WhatsApp</div>
          <div style={{ fontSize: 12.5, color: GRAY3, maxWidth: 560, lineHeight: 1.45 }}>Son los únicos mensajes que puedes mandar a un cliente cuando pasaron más de 24 horas desde que te escribió. Meta revisa cada una antes de dejarla usar.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => sincronizar(false)} disabled={sincronizando} className="oft-btn-press"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: sincronizando ? 0.6 : 1 }}>
            <RefreshCw size={14} style={sincronizando ? { animation: "spin 1s linear infinite" } : undefined} /> Sincronizar
          </button>
          {esAdmin && (
            <button onClick={() => { setCreando(true); setAviso(null); }} className="oft-btn-press"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              <Plus size={15} /> Crear plantilla
            </button>
          )}
        </div>
      </div>

      {aviso && (
        <div style={{ background: colorAviso.bg, color: colorAviso.color, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.45, margin: "12px 0", display: "flex", gap: 7, alignItems: "flex-start" }}>
          {aviso.tipo === "ok" ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span>{aviso.texto}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, margin: "14px 0", flexWrap: "wrap" }}>
        {FILTROS.map(([id, label, n]) => (
          <button key={id} onClick={() => setFiltro(id)} className="oft-btn-press"
            style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${filtro === id ? BLACK : GRAY2}`, background: filtro === id ? BLACK : WHITE, color: filtro === id ? WHITE : GRAY3, cursor: "pointer" }}>
            {label} <span style={{ opacity: 0.7 }}>{n}</span>
          </button>
        ))}
      </div>

      {cargando ? <Spinner /> : visibles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: GRAY3 }}>
          <FileText size={36} color={GRAY2} style={{ margin: "0 auto 10px" }} />
          <div style={{ fontWeight: 800, fontSize: 14, color: BLACK, marginBottom: 4 }}>{plantillas.length === 0 ? "Todavía no hay plantillas" : "No hay plantillas con ese filtro"}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{plantillas.length === 0 ? (esAdmin ? "Crea la primera con el botón rojo. Si ya tienes plantillas en Meta, pulsa Sincronizar para traerlas." : "Pídele al administrador que cree una.") : "Prueba con otro filtro."}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: esMobil ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, alignItems: "start" }}>
          {visibles.map(p => {
            const est = ESTADO_PLANTILLA[p.estado] || { texto: p.estado, bg: GRAY, color: GRAY3 };
            return (
              <div key={p.id} style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, wordBreak: "break-all" }}>{p.nombre}</div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: est.bg, color: est.color }}>{est.texto}</span>
                </div>
                <div style={{ fontSize: 11.5, color: GRAY3, marginBottom: 10 }}>{CATEGORIA_PLANTILLA[p.categoria] || p.categoria} · {p.idioma}</div>
                {p.motivo_rechazo && <div style={{ fontSize: 12, color: "#991B1B", background: "#FEE2E2", borderRadius: 8, padding: "6px 9px", marginBottom: 10 }}>Motivo de Meta: {p.motivo_rechazo}</div>}
                <PlantillaVista cabeceraTipo={p.cabecera_tipo} cabeceraTexto={p.cabecera_texto} cabeceraUrl={p.cabecera_media_url}
                  cuerpo={rellenarVariables(p.cuerpo, p.cuerpo_ejemplos)} pie={p.pie} botones={p.botones} compacta />
                {esAdmin && (
                  <button onClick={() => eliminar(p)} className="oft-btn-press" style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: GRAY3, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    <Trash2 size={13} /> Borrar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const quitarTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function EditorPlantilla({ esMobil, onCerrar, onCreada }) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("MARKETING");
  const [idioma, setIdioma] = useState("es");
  const [cabTipo, setCabTipo] = useState("NONE");
  const [cabTexto, setCabTexto] = useState("");
  const [cabUrl, setCabUrl] = useState(null);
  const [cuerpo, setCuerpo] = useState("");
  const [ejemplos, setEjemplos] = useState([]);
  const [pie, setPie] = useState("");
  const [botones, setBotones] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const areaRef = useRef(null);

  const nVars = contarVariables(cuerpo);
  const ejemplosVista = Array.from({ length: nVars }, (_, i) => ejemplos[i] || "");

  const agregarVariable = () => {
    const sig = nVars + 1;
    const el = areaRef.current;
    const pos = el ? el.selectionStart : cuerpo.length;
    setCuerpo(cuerpo.slice(0, pos) + `{{${sig}}}` + cuerpo.slice(pos));
  };
  const subirImagen = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSubiendo(true); setError("");
    try {
      const comprimida = await comprimirImagen(file, 1200);
      if (!["image/jpeg", "image/png"].includes(comprimida.type)) throw new Error("Usa una imagen JPG o PNG.");
      const ruta = `plantillas/${Date.now()}_${comprimida.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      await sb.upload("crm", ruta, comprimida);
      setCabUrl(sb.publicUrl("crm", ruta));
    } catch (err) { setError(err.message); }
    setSubiendo(false);
  };
  const actualizarBoton = (i, cambios) => setBotones(prev => prev.map((b, j) => j === i ? { ...b, ...cambios } : b));

  const enviar = async () => {
    setError("");
    if (ejemplosVista.some(v => !v.trim())) { setError("Meta pide un ejemplo para cada variable. Llénalos todos."); return; }
    if (/^\s*\{\{\d+\}\}|\{\{\d+\}\}\s*$/.test(cuerpo)) { setError("El mensaje no puede empezar ni terminar con una variable. Agrega texto antes y después."); return; }
    setGuardando(true);
    try {
      const data = await llamarFuncion("whatsapp-plantillas", {
        modo: "crear", nombre, idioma, categoria, cuerpo, ejemplos: ejemplosVista, pie,
        cabecera: { tipo: cabTipo, texto: cabTexto, imagen_url: cabUrl }, botones,
      });
      onCreada(data.plantilla);
    } catch (e) { setError(e.message); }
    setGuardando(false);
  };

  const sinResponderBtn = botones.some(b => b.tipo === "QUICK_REPLY");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ background: WHITE, borderBottom: `1px solid ${GRAY2}`, padding: esMobil ? "10px 14px" : "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onCerrar} disabled={guardando} className="oft-btn-press" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex" }}><ArrowLeft size={20} /></button>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Nueva plantilla de WhatsApp</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: esMobil ? 16 : 24 }}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start", maxWidth: 940, margin: "0 auto" }}>
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <EtiquetaCampo>Nombre (solo para identificarla)</EtiquetaCampo>
            <input value={nombre} onChange={e => setNombre(quitarTildes(e.target.value).toLowerCase().replace(/[^a-z0-9_ ]/g, "").replace(/ +/g, "_").slice(0, 80))}
              placeholder="promo_docena_octubre" style={{ ...S.input, fontSize: 13.5 }} disabled={guardando} />
            <div style={{ fontSize: 11.5, color: GRAY3, margin: "-8px 0 14px" }}>Sin tildes ni espacios; no se puede cambiar después.</div>

            <EtiquetaCampo>¿Para qué es?</EtiquetaCampo>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {[["MARKETING", "Marketing", "Promos, ofertas, novedades"], ["UTILITY", "Utilidad", "Pedido listo, cotización, seguimiento"]].map(([id, t, d]) => (
                <button key={id} onClick={() => setCategoria(id)} disabled={guardando} className="oft-btn-press"
                  style={{ flex: "1 1 160px", textAlign: "left", padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${categoria === id ? BLACK : GRAY2}`, background: categoria === id ? GRAY : WHITE, cursor: "pointer" }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{t}</div>
                  <div style={{ fontSize: 11.5, color: GRAY3 }}>{d}</div>
                </button>
              ))}
            </div>

            <EtiquetaCampo>Idioma</EtiquetaCampo>
            <select value={idioma} onChange={e => setIdioma(e.target.value)} style={{ ...S.input, fontSize: 13 }} disabled={guardando}>
              <option value="es">Español</option><option value="en_US">Inglés</option>
            </select>

            <EtiquetaCampo>Encabezado (opcional)</EtiquetaCampo>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[["NONE", "Ninguno"], ["TEXT", "Título"], ["IMAGE", "Imagen"]].map(([id, t]) => (
                <button key={id} onClick={() => setCabTipo(id)} disabled={guardando} className="oft-btn-press"
                  style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${cabTipo === id ? BLACK : GRAY2}`, background: cabTipo === id ? BLACK : WHITE, color: cabTipo === id ? WHITE : GRAY3, cursor: "pointer" }}>{t}</button>
              ))}
            </div>
            {cabTipo === "TEXT" && <input value={cabTexto} onChange={e => setCabTexto(e.target.value.slice(0, 60))} placeholder="Ej: Oferta de la semana" style={{ ...S.input, fontSize: 13.5 }} disabled={guardando} />}
            {cabTipo === "IMAGE" && (
              cabUrl ? (
                <div style={{ position: "relative", width: 120, marginBottom: 14 }}>
                  <img src={cabUrl} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 10, border: `1px solid ${GRAY2}` }} />
                  <button onClick={() => setCabUrl(null)} className="oft-btn-press" style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: WHITE, border: `1.5px solid ${GRAY2}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
                </div>
              ) : (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 10, border: `1.5px dashed ${GRAY2}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: GRAY3, marginBottom: 14 }}>
                  <Upload size={14} /> {subiendo ? "Subiendo..." : "Subir imagen (JPG o PNG)"}
                  <input type="file" accept="image/jpeg,image/png" onChange={subirImagen} style={{ display: "none" }} disabled={subiendo || guardando} />
                </label>
              )
            )}

            <EtiquetaCampo>Mensaje</EtiquetaCampo>
            <textarea ref={areaRef} value={cuerpo} onChange={e => setCuerpo(e.target.value.slice(0, 1024))} rows={6} style={{ ...S.input, resize: "vertical", fontSize: 13.5 }} disabled={guardando}
              placeholder={"Hola {{1}}, esta semana tenemos docenas de gorras a precio especial. ¿Quieres que te mandemos el catálogo?"} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "-8px 0 14px", gap: 8, flexWrap: "wrap" }}>
              <button onClick={agregarVariable} disabled={guardando} className="oft-btn-press" style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: `1px solid ${GRAY2}`, background: WHITE, cursor: "pointer" }}>+ Agregar variable {`{{${nVars + 1}}}`}</button>
              <span style={{ fontSize: 11.5, color: GRAY3 }}>{cuerpo.length}/1024</span>
            </div>

            {nVars > 0 && (
              <>
                <EtiquetaCampo>Ejemplo para cada variable (Meta lo pide para revisarla)</EtiquetaCampo>
                {ejemplosVista.map((v, i) => (
                  <input key={i} value={v} onChange={e => { const nuevo = [...ejemplosVista]; nuevo[i] = e.target.value; setEjemplos(nuevo); }}
                    placeholder={`Ejemplo de {{${i + 1}}}${i === 0 ? " (ej: María)" : ""}`} style={{ ...S.input, fontSize: 13, marginBottom: 8 }} disabled={guardando} />
                ))}
              </>
            )}

            <EtiquetaCampo>Pie de página (opcional)</EtiquetaCampo>
            <input value={pie} onChange={e => setPie(e.target.value.slice(0, 60))} placeholder="Ej: Ofertodo · Colón, Panamá" style={{ ...S.input, fontSize: 13.5 }} disabled={guardando} />

            <EtiquetaCampo>Botones (opcional)</EtiquetaCampo>
            {botones.map((b, i) => (
              <div key={i} style={{ background: GRAY, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <select value={b.tipo} onChange={e => actualizarBoton(i, { tipo: e.target.value })} style={{ ...S.input, marginBottom: 0, fontSize: 12.5, flex: "0 0 150px" }} disabled={guardando}>
                    <option value="QUICK_REPLY">Respuesta rápida</option><option value="URL">Abrir enlace</option><option value="PHONE_NUMBER">Llamar</option>
                  </select>
                  <input value={b.texto || ""} onChange={e => actualizarBoton(i, { texto: e.target.value.slice(0, 25) })} placeholder="Texto del botón" style={{ ...S.input, marginBottom: 0, fontSize: 12.5, flex: 1, minWidth: 0 }} disabled={guardando} />
                  <button onClick={() => setBotones(prev => prev.filter((_, j) => j !== i))} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}><X size={16} color={GRAY3} /></button>
                </div>
                {b.tipo === "URL" && <input value={b.url || ""} onChange={e => actualizarBoton(i, { url: e.target.value })} placeholder="https://ofertodo.com.pa/ofertas" style={{ ...S.input, marginBottom: 0, fontSize: 12.5 }} disabled={guardando} />}
                {b.tipo === "PHONE_NUMBER" && <input value={b.telefono || ""} onChange={e => actualizarBoton(i, { telefono: e.target.value })} placeholder="+50767200474" style={{ ...S.input, marginBottom: 0, fontSize: 12.5 }} disabled={guardando} />}
              </div>
            ))}
            {botones.length < 3 && (
              <button onClick={() => setBotones(prev => [...prev, { tipo: "QUICK_REPLY", texto: "" }])} disabled={guardando} className="oft-btn-press"
                style={{ fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 8, border: `1.5px dashed ${GRAY2}`, background: WHITE, color: GRAY3, cursor: "pointer", marginBottom: 14 }}>+ Agregar botón</button>
            )}
            {sinResponderBtn && <div style={{ fontSize: 11.5, color: GRAY3, margin: "-4px 0 14px" }}>Cuando el cliente toca una respuesta rápida, abre la ventana de 24 horas para conversar.</div>}

            {error && (
              <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.45, marginBottom: 12, display: "flex", gap: 7 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span>
              </div>
            )}
            <button onClick={enviar} disabled={guardando || subiendo || !nombre || !cuerpo.trim()} className="oft-btn-press"
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 14.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: guardando || !nombre || !cuerpo.trim() ? 0.6 : 1 }}>
              <Send size={16} /> {guardando ? "Enviando a Meta..." : "Enviar a revisión de Meta"}
            </button>
            <div style={{ fontSize: 11.5, color: GRAY3, marginTop: 8, lineHeight: 1.45 }}>Meta la revisa en minutos (a veces hasta 24 h). No puedes editarla una vez enviada: si hay que cambiar algo, se borra y se crea otra.</div>
          </div>

          <div style={{ flex: "0 1 320px", minWidth: 260, position: esMobil ? "static" : "sticky", top: 0 }}>
            <EtiquetaCampo>Así se verá</EtiquetaCampo>
            <PlantillaVista cabeceraTipo={cabTipo} cabeceraTexto={cabTexto} cabeceraUrl={cabUrl} cuerpo={rellenarVariables(cuerpo, ejemplosVista)} pie={pie} botones={botones} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RespuestasRapidasPanel({ esMobil, user }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // id o "nueva"
  const [atajo, setAtajo] = useState("");
  const [contenido, setContenido] = useState("");
  const [error, setError] = useState("");

  const cargar = async () => {
    try { setLista((await sb.get("crm_respuestas_rapidas", "?order=atajo.asc")) || []); } catch (e) { setLista([]); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const abrir = (r) => { setEditando(r ? r.id : "nueva"); setAtajo(r?.atajo || ""); setContenido(r?.contenido || ""); setError(""); };
  const guardar = async () => {
    const a = quitarTildes(atajo).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    if (!a || !contenido.trim()) { setError("Pon un atajo y el texto de la respuesta."); return; }
    try {
      if (editando === "nueva") await sb.post("crm_respuestas_rapidas", { atajo: a, titulo: a, contenido: contenido.trim(), creada_por: user?.id || null });
      else await sb.patch("crm_respuestas_rapidas", editando, { atajo: a, titulo: a, contenido: contenido.trim() });
      setEditando(null); await cargar();
    } catch (e) { setError(/duplicate|unique/i.test(e.message) ? "Ya existe una respuesta con ese atajo." : e.message); }
  };
  const borrar = async (r) => {
    if (!confirm(`¿Borrar la respuesta /${r.atajo}?`)) return;
    try { await sb.delete("crm_respuestas_rapidas", r.id); setLista(prev => prev.filter(x => x.id !== r.id)); } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ flex: 1, padding: esMobil ? 14 : 24, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>Respuestas rápidas</div>
          <div style={{ fontSize: 12.5, color: GRAY3, maxWidth: 560, lineHeight: 1.45 }}>Textos que el equipo usa seguido. En la Bandeja escribe <strong>/</strong> y el atajo para insertarlos. Usa <strong>{"{nombre}"}</strong> para el nombre del cliente.</div>
        </div>
        <button onClick={() => abrir(null)} className="oft-btn-press" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 13, cursor: "pointer" }}><Plus size={15} /> Nueva respuesta</button>
      </div>

      {editando && (
        <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 14, marginBottom: 14, maxWidth: 560 }}>
          <EtiquetaCampo>Atajo (lo que escribes después de /)</EtiquetaCampo>
          <input value={atajo} onChange={e => setAtajo(e.target.value)} placeholder="precios" style={{ ...S.input, fontSize: 13.5 }} />
          <EtiquetaCampo>Respuesta</EtiquetaCampo>
          <textarea value={contenido} onChange={e => setContenido(e.target.value)} rows={4} placeholder="Hola {nombre}, nuestros precios por docena son..." style={{ ...S.input, resize: "vertical", fontSize: 13.5 }} />
          {error && <div style={{ color: "#991B1B", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={guardar} className="oft-btn-press" style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: BLACK, color: WHITE, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Guardar</button>
            <button onClick={() => setEditando(null)} className="oft-btn-press" style={{ padding: "9px 14px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {cargando ? <Spinner /> : lista.length === 0 && !editando ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: GRAY3 }}>
          <Zap size={36} color={GRAY2} style={{ margin: "0 auto 10px" }} />
          <div style={{ fontWeight: 800, fontSize: 14, color: BLACK, marginBottom: 4 }}>Todavía no hay respuestas rápidas</div>
          <div style={{ fontSize: 12.5 }}>Crea las que más uses: precios, horarios, formas de pago, envíos.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 700 }}>
          {lista.map(r => (
            <div key={r.id} style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 12, padding: "11px 13px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>/{r.atajo}</div>
                <div style={{ fontSize: 12.5, color: GRAY3, marginTop: 3, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{r.contenido}</div>
              </div>
              <button onClick={() => abrir(r)} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: GRAY3 }}>Editar</button>
              <button onClick={() => borrar(r)} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 }}><Trash2 size={14} color={GRAY3} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BARRA LATERAL DE LA BANDEJA (como en respond.io): carpetas, etapas,
//  etiquetas y líneas, cada una con su número de chats y, en rojo, cuántos
//  de esos todavía no se han respondido.
// ─────────────────────────────────────────────────────────────
function BarraFiltros({ conversaciones, etapas, user, filtro, setFiltro, numeros, cuentasIg = [], esMobil }) {
  const abiertas = conversaciones.filter(estaAbierta);
  const cuenta = (lista) => ({ total: lista.length, sin: lista.filter(sinResponder).length });
  const carpetas = [
    { id: "todos", label: "Todas las conversaciones", icono: InboxIcon, ...cuenta(abiertas) },
    { id: "sin_responder", label: "Sin responder", icono: Timer, soloSin: true, ...cuenta(abiertas.filter(sinResponder)) },
    { id: "mios", label: "Asignadas a mí", icono: User, ...cuenta(abiertas.filter(c => c.agente_id && c.agente_id === user?.id)) },
    { id: "sin_asignar", label: "Sin asignar", icono: Users, ...cuenta(abiertas.filter(c => !c.agente_id)) },
    { id: "cerradas", label: "Cerradas", icono: CheckCircle2, total: conversaciones.length - abiertas.length, sin: 0, sinBadge: true },
  ];
  const porEtapa = etapas.map(e => ({ id: "etapa:" + e.id, label: e.nombre, color: e.color, ...cuenta(abiertas.filter(c => c.etapa_id === e.id)) }));
  const sinEtapa = abiertas.filter(c => !c.etapa_id);
  if (sinEtapa.length > 0) porEtapa.push({ id: "etapa:ninguna", label: "Sin etapa", color: GRAY3, ...cuenta(sinEtapa) });
  const conteoTags = {};
  abiertas.forEach(c => (c.etiquetas || []).forEach(t => { conteoTags[t] = conteoTags[t] || []; conteoTags[t].push(c); }));
  const etiquetas = Object.entries(conteoTags).sort((a, b) => b[1].length - a[1].length).slice(0, 12).map(([t, l]) => ({ id: "tag:" + t, label: t, ...cuenta(l) }));
  const lineasActivas = numeros.filter(n => n.activo);
  const lineasTodas = [
    ...lineasActivas.map(n => ({ id: "linea:" + n.id, label: n.etiqueta || n.numero_visible || "Línea", ...cuenta(abiertas.filter(c => c.numero_id === n.id)) })),
    ...cuentasIg.filter(a => a.activo).map(a => ({ id: "ig:" + a.id, label: a.etiqueta || (a.username ? "@" + a.username : "Instagram"), icono: Instagram, ...cuenta(abiertas.filter(c => c.ig_cuenta_id === a.id)) })),
  ];
  const lineas = lineasTodas.length > 1 ? lineasTodas : [];
  const anuncios = abiertas.filter(c => c.origen === "anuncio");
  const origenes = anuncios.length > 0 ? [{ id: "anuncios", label: "Vienen de anuncios", ...cuenta(anuncios) }] : [];

  const Item = ({ it }) => {
    const activo = filtro === it.id;
    const Icono = it.icono;
    return (
      <button onClick={() => setFiltro(it.id)} className="oft-btn-press"
        style={{ display: "flex", alignItems: "center", gap: 8, width: esMobil ? "auto" : "100%", padding: esMobil ? "7px 11px" : "8px 10px", borderRadius: 8, border: "none", textAlign: "left", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", background: activo ? BLACK : (esMobil ? GRAY : "transparent"), color: activo ? WHITE : BLACK, fontWeight: activo ? 800 : 600, fontSize: 12.5 }}>
        {Icono ? <Icono size={14} style={{ flexShrink: 0, opacity: 0.8 }} /> : it.color ? <span style={{ width: 9, height: 9, borderRadius: "50%", background: it.color, flexShrink: 0 }} /> : <Hash size={13} style={{ flexShrink: 0, opacity: 0.6 }} />}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
        {!it.soloSin && !it.sinBadge && it.sin > 0 && <span title="Sin responder" style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 9, background: RED, color: WHITE }}>{it.sin}</span>}
        <span style={{ fontSize: 11.5, fontWeight: 700, opacity: activo ? 0.85 : 0.55, ...(it.soloSin && it.total > 0 && !activo ? { background: RED, color: WHITE, opacity: 1, padding: "1px 7px", borderRadius: 9 } : {}) }}>{it.total}</span>
      </button>
    );
  };
  const Titulo = ({ children }) => <div style={{ fontSize: 10.5, fontWeight: 800, color: GRAY3, letterSpacing: 0.6, textTransform: "uppercase", padding: "14px 10px 5px" }}>{children}</div>;

  if (esMobil) {
    const todos = [...carpetas.slice(0, 5), ...porEtapa, ...origenes, ...etiquetas, ...lineas];
    return <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 12px", borderBottom: `1px solid ${GRAY2}`, background: WHITE }}>{todos.map(it => <Item key={it.id} it={it} />)}</div>;
  }
  return (
    <div style={{ width: 218, minWidth: 218, background: WHITE, borderRight: `1px solid ${GRAY2}`, overflowY: "auto", padding: "6px 8px 16px" }}>
      <Titulo>Bandeja</Titulo>
      {carpetas.map(it => <Item key={it.id} it={it} />)}
      <Titulo>Etapas</Titulo>
      {porEtapa.map(it => <Item key={it.id} it={it} />)}
      {origenes.length > 0 && <><Titulo>Origen</Titulo>{origenes.map(it => <Item key={it.id} it={it} />)}</>}
      {etiquetas.length > 0 && <><Titulo>Etiquetas</Titulo>{etiquetas.map(it => <Item key={it.id} it={it} />)}</>}
      {lineas.length > 0 && <><Titulo>Líneas</Titulo>{lineas.map(it => <Item key={it.id} it={it} />)}</>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CONTACTOS Y CAMPOS PERSONALIZADOS
// ═══════════════════════════════════════════════════════════════
const TIPOS_CAMPO = { texto: "Texto", numero: "Número", fecha: "Fecha", seleccion: "Lista de opciones", si_no: "Sí / No" };

function useCampos() {
  const [campos, setCampos] = useState([]);
  const recargar = async () => {
    try { setCampos((await sb.get("crm_campos", "?order=orden.asc,created_at.asc")) || []); } catch (e) { setCampos([]); }
  };
  useEffect(() => { recargar(); }, []);
  return { campos, recargar };
}

function textoDeCampo(campo, valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (campo.tipo === "si_no") return valor === true ? "Sí" : "No";
  if (campo.tipo === "fecha") { const d = new Date(valor + "T12:00:00"); return isNaN(d) ? String(valor) : d.toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" }); }
  return String(valor);
}

// Normaliza un teléfono: solo dígitos; si trae 8 (número local de Panamá) le pone el 507.
function normalizarTelefono(t) {
  let d = String(t || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "507" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}
const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function CampoInput({ campo, valor, onCambio, onConfirmar }) {
  const base = { ...S.input, marginBottom: 0, fontSize: 13 };
  if (campo.tipo === "seleccion") return (
    <select value={valor ?? ""} onChange={e => onConfirmar(e.target.value)} style={base}>
      <option value="">—</option>
      {(campo.opciones || []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (campo.tipo === "si_no") return (
    <select value={valor === true ? "si" : valor === false ? "no" : ""} onChange={e => onConfirmar(e.target.value === "" ? null : e.target.value === "si")} style={base}>
      <option value="">—</option><option value="si">Sí</option><option value="no">No</option>
    </select>
  );
  return (
    <input type={campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"} value={valor ?? ""}
      onChange={e => onCambio(e.target.value)} onBlur={e => onConfirmar(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }} style={base} />
  );
}

// Nombre + campos personalizados de un contacto. Se guarda al salir de cada casilla.
// Usar con key={conv.id} para que no arrastre lo escrito de otro contacto.
function CamposContacto({ conv, campos, onGuardar }) {
  const [nombre, setNombre] = useState(conv.nombre_contacto || "");
  const [valores, setValores] = useState(conv.campos || {});
  useEffect(() => { setValores(conv.campos || {}); }, [conv.campos]);

  const confirmar = (campo, valor) => {
    const v = campo.tipo === "numero" && valor !== "" && valor !== null ? Number(valor) : valor;
    const actuales = conv.campos || {};
    const vacio = v === "" || v === null || v === undefined;
    if (vacio && !(campo.clave in actuales)) return;
    if (!vacio && actuales[campo.clave] === v) return;
    const nuevo = { ...actuales };
    if (vacio) delete nuevo[campo.clave]; else nuevo[campo.clave] = v;
    setValores(nuevo);
    onGuardar({ campos: nuevo });
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>DATOS DEL CONTACTO</div>
      <div style={{ fontSize: 11.5, color: GRAY3, marginBottom: 3 }}>Nombre</div>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Sin nombre"
        onBlur={() => { const n = nombre.trim(); if (n !== (conv.nombre_contacto || "")) onGuardar({ nombre_contacto: n || null }); }}
        onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }} style={{ ...S.input, marginBottom: 10, fontSize: 13 }} />
      {campos.map(campo => (
        <div key={campo.id} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, color: GRAY3, marginBottom: 3 }}>{campo.nombre}</div>
          <CampoInput campo={campo} valor={valores[campo.clave]}
            onCambio={v => setValores(prev => ({ ...prev, [campo.clave]: v }))} onConfirmar={v => confirmar(campo, v)} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  CSV (comillas y separador , o ; detectado solo)
// ─────────────────────────────────────────────────────────────
function leerCSV(texto) {
  const t = String(texto || "").replace(/^﻿/, "");
  const primera = t.split(/\r?\n/)[0] || "";
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ";" : ",";
  const filas = []; let fila = [], celda = "", comillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (ch === '"') comillas = false;
      else celda += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(celda); celda = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; fila.push(celda); celda = ""; if (fila.some(x => x.trim())) filas.push(fila); fila = []; }
    else celda += ch;
  }
  fila.push(celda); if (fila.some(x => x.trim())) filas.push(fila);
  return filas;
}
const celdaCSV = (v) => { const s = String(v ?? ""); return /[;"\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function descargarCSV(nombreArchivo, filas) {
  const contenido = "﻿" + filas.map(f => f.map(celdaCSV).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = nombreArchivo; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ModalBase({ titulo, onCerrar, children, ancho = 480 }) {
  return createPortal(
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 260, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: WHITE, borderRadius: 16, width: "100%", maxWidth: ancho, maxHeight: "92vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{titulo}</div>
          <button onClick={onCerrar} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>, document.body);
}

// ─────────────────────────────────────────────────────────────
//  GESTOR DE CAMPOS PERSONALIZADOS (solo administrador)
// ─────────────────────────────────────────────────────────────
function GestorCampos({ campos, onCambio, onCerrar }) {
  const [editando, setEditando] = useState(null); // id | "nuevo" | null
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("texto");
  const [opciones, setOpciones] = useState("");
  const [error, setError] = useState("");

  const abrir = (c) => { setEditando(c ? c.id : "nuevo"); setNombre(c?.nombre || ""); setTipo(c?.tipo || "texto"); setOpciones((c?.opciones || []).join(", ")); setError(""); };
  const guardar = async () => {
    const n = nombre.trim();
    if (!n) { setError("Ponle un nombre al campo."); return; }
    const lista = opciones.split(",").map(x => x.trim()).filter(Boolean);
    if (tipo === "seleccion" && lista.length < 2) { setError("Escribe al menos 2 opciones separadas por coma."); return; }
    try {
      if (editando === "nuevo") {
        let clave = sinTildes(n).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "campo";
        if (campos.some(c => c.clave === clave)) clave += "_" + Math.floor(Math.random() * 900 + 100);
        await sb.post("crm_campos", { clave, nombre: n, tipo, opciones: tipo === "seleccion" ? lista : [], orden: (campos.at(-1)?.orden || 0) + 1 });
      } else {
        await sb.patch("crm_campos", editando, { nombre: n, ...(tipo === "seleccion" ? { opciones: lista } : {}) });
      }
      setEditando(null); await onCambio();
    } catch (e) { setError(e.message); }
  };
  const borrar = async (c) => {
    if (!confirm(`¿Borrar el campo "${c.nombre}"? Deja de mostrarse en todos los contactos.`)) return;
    try { await sb.delete("crm_campos", c.id); await onCambio(); } catch (e) { alert(e.message); }
  };

  return (
    <ModalBase titulo="Campos personalizados" onCerrar={onCerrar} ancho={520}>
      <div style={{ fontSize: 12.5, color: GRAY3, lineHeight: 1.45, marginBottom: 14 }}>Datos extra que guardas de cada cliente (ciudad, tipo de negocio...). Aparecen en el chat, en la lista de contactos y sirven de condición en los workflows.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {campos.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${GRAY2}`, borderRadius: 10, padding: "8px 11px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{c.nombre}</div>
              <div style={{ fontSize: 11.5, color: GRAY3 }}>{TIPOS_CAMPO[c.tipo]}{c.tipo === "seleccion" && c.opciones?.length ? ` · ${c.opciones.join(", ")}` : ""}</div>
            </div>
            <button onClick={() => abrir(c)} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: GRAY3 }}>Editar</button>
            <button onClick={() => borrar(c)} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><Trash2 size={14} color={GRAY3} /></button>
          </div>
        ))}
        {campos.length === 0 && <div style={{ fontSize: 12.5, color: GRAY3, textAlign: "center", padding: 14 }}>Todavía no hay campos.</div>}
      </div>
      {editando ? (
        <div style={{ background: GRAY, borderRadius: 12, padding: 12 }}>
          <EtiquetaCampo>Nombre del campo</EtiquetaCampo>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Zona de entrega" style={{ ...S.input, fontSize: 13 }} />
          <EtiquetaCampo>Tipo</EtiquetaCampo>
          <select value={tipo} onChange={e => setTipo(e.target.value)} disabled={editando !== "nuevo"} style={{ ...S.input, fontSize: 13 }}>
            {Object.entries(TIPOS_CAMPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {tipo === "seleccion" && (<><EtiquetaCampo>Opciones (separadas por coma)</EtiquetaCampo><input value={opciones} onChange={e => setOpciones(e.target.value)} placeholder="Colón, Panamá, David" style={{ ...S.input, fontSize: 13 }} /></>)}
          {error && <div style={{ color: "#991B1B", fontSize: 12.5, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={guardar} className="oft-btn-press" style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: BLACK, color: WHITE, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Guardar</button>
            <button onClick={() => setEditando(null)} className="oft-btn-press" style={{ padding: "9px 14px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => abrir(null)} className="oft-btn-press" style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={15} /> Nuevo campo</button>
      )}
    </ModalBase>
  );
}

// ─────────────────────────────────────────────────────────────
//  NUEVO CONTACTO / IMPORTAR
// ─────────────────────────────────────────────────────────────
function etapaPorDefecto(etapas) { return etapas.find(e => e.es_default) || etapas[0] || null; }

function NuevoContacto({ etapas, conversaciones, onCreado, onCerrar }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const crear = async () => {
    const tel = normalizarTelefono(telefono);
    if (!tel) { setError("Escribe un teléfono válido con código de país (ej: 50767200474) o de 8 dígitos de Panamá."); return; }
    if (conversaciones.some(c => c.telefono === tel)) { setError("Ya existe un contacto con ese teléfono."); return; }
    setGuardando(true); setError("");
    try {
      const [fila] = await sb.post("crm_conversaciones", { telefono: tel, nombre_contacto: nombre.trim() || null, etapa_id: etapaPorDefecto(etapas)?.id || null, canal: "whatsapp", origen: "manual", ultimo_mensaje_at: null });
      onCreado(fila);
    } catch (e) { setError(/duplicate|unique/i.test(e.message) ? "Ya existe un contacto con ese teléfono." : e.message); }
    setGuardando(false);
  };
  return (
    <ModalBase titulo="Nuevo contacto" onCerrar={onCerrar}>
      <EtiquetaCampo>Nombre</EtiquetaCampo>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: María Pérez" style={{ ...S.input, fontSize: 13.5 }} />
      <EtiquetaCampo>Teléfono de WhatsApp</EtiquetaCampo>
      <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="6720-0474 o 507 6720 0474" inputMode="tel" style={{ ...S.input, fontSize: 13.5 }} />
      <div style={{ fontSize: 11.5, color: GRAY3, margin: "-8px 0 12px", lineHeight: 1.45 }}>Para escribirle por primera vez usa una plantilla: aún no ha iniciado conversación contigo.</div>
      {error && <div style={{ color: "#991B1B", fontSize: 12.5, marginBottom: 10, lineHeight: 1.4 }}>{error}</div>}
      <button onClick={crear} disabled={guardando} className="oft-btn-press" style={{ width: "100%", padding: 12, borderRadius: 11, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: guardando ? 0.6 : 1 }}>{guardando ? "Guardando..." : "Crear contacto"}</button>
    </ModalBase>
  );
}

function ImportarContactos({ etapas, campos, conversaciones, onImportado, onCerrar }) {
  const [analisis, setAnalisis] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");

  const leer = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setError(""); setResultado("");
    const filas = leerCSV(await file.text());
    if (filas.length < 2) { setError("El archivo está vacío o no tiene encabezados."); return; }
    const enc = filas[0].map(sinTildes);
    const col = (...nombres) => enc.findIndex(h => nombres.includes(h));
    const iNombre = col("nombre", "name", "cliente"), iTel = col("telefono", "celular", "whatsapp", "phone", "tel", "numero");
    if (iTel < 0) { setError("No encontré una columna de teléfono. Debe llamarse: telefono, celular o whatsapp."); return; }
    const iEtapa = col("etapa", "stage"), iTags = col("etiquetas", "tags");
    const iCampos = campos.map(c => ({ campo: c, i: enc.findIndex(h => h === sinTildes(c.nombre) || h === c.clave) })).filter(x => x.i >= 0);
    const existentes = new Set(conversaciones.map(c => c.telefono));
    const vistos = new Set(); const nuevos = []; let duplicados = 0, invalidos = 0;
    for (const f of filas.slice(1)) {
      const tel = normalizarTelefono(f[iTel]);
      if (!tel) { invalidos++; continue; }
      if (existentes.has(tel) || vistos.has(tel)) { duplicados++; continue; }
      vistos.add(tel);
      const vals = {};
      iCampos.forEach(({ campo, i }) => {
        const raw = String(f[i] ?? "").trim(); if (!raw) return;
        if (campo.tipo === "numero") { const n = Number(raw.replace(",", ".")); if (!isNaN(n)) vals[campo.clave] = n; }
        else if (campo.tipo === "si_no") vals[campo.clave] = ["si", "sí", "yes", "true", "1"].includes(sinTildes(raw));
        else if (campo.tipo === "seleccion") { const op = (campo.opciones || []).find(o => sinTildes(o) === sinTildes(raw)); if (op) vals[campo.clave] = op; }
        else vals[campo.clave] = raw;
      });
      const etapa = iEtapa >= 0 ? etapas.find(et => sinTildes(et.nombre) === sinTildes(f[iEtapa])) : null;
      nuevos.push({
        telefono: tel, nombre_contacto: iNombre >= 0 ? (String(f[iNombre] || "").trim() || null) : null,
        etapa_id: (etapa || etapaPorDefecto(etapas))?.id || null, canal: "whatsapp", origen: "importado", campos: vals,
        etiquetas: iTags >= 0 ? String(f[iTags] || "").split(/[|;]/).map(x => x.trim().replace(/^#/, "")).filter(Boolean) : [],
      });
    }
    setAnalisis({ nuevos, duplicados, invalidos, total: filas.length - 1, columnasCampos: iCampos.map(x => x.campo.nombre) });
  };

  const importar = async () => {
    setImportando(true); setError("");
    try {
      let creados = [];
      for (let i = 0; i < analisis.nuevos.length; i += 100) {
        const r = await sb.post("crm_conversaciones", analisis.nuevos.slice(i, i + 100));
        creados = creados.concat(r || []);
      }
      setResultado(`Se importaron ${creados.length} contactos.`);
      onImportado(creados); setAnalisis(null);
    } catch (e) { setError(e.message); }
    setImportando(false);
  };

  return (
    <ModalBase titulo="Importar contactos" onCerrar={onCerrar} ancho={520}>
      <div style={{ fontSize: 12.5, color: GRAY3, lineHeight: 1.5, marginBottom: 12 }}>
        Sube un archivo CSV (en Excel: Guardar como &gt; CSV). La primera fila son los encabezados. Obligatorio: <strong>telefono</strong>. Opcionales: <strong>nombre</strong>, <strong>etapa</strong>, <strong>etiquetas</strong> (separadas con |){campos.length > 0 && <> y una columna por cada campo personalizado ({campos.map(c => c.nombre).join(", ")})</>}.
        Los teléfonos de 8 dígitos se toman como de Panamá (507). Los que ya existen se omiten.
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: `1.5px dashed ${GRAY2}`, cursor: "pointer", fontSize: 13, fontWeight: 700, color: GRAY3, marginBottom: 12 }}>
        <Upload size={15} /> Elegir archivo CSV
        <input type="file" accept=".csv,text/csv" onChange={leer} style={{ display: "none" }} />
      </label>
      {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 10, lineHeight: 1.4 }}>{error}</div>}
      {resultado && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 10 }}>{resultado}</div>}
      {analisis && (
        <>
          <div style={{ background: GRAY, borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            <strong>{analisis.nuevos.length}</strong> contactos nuevos para importar<br />
            {analisis.duplicados > 0 && <span style={{ color: GRAY3 }}>{analisis.duplicados} ya existen (se omiten)<br /></span>}
            {analisis.invalidos > 0 && <span style={{ color: "#991B1B" }}>{analisis.invalidos} sin teléfono válido (se omiten)<br /></span>}
            {analisis.columnasCampos.length > 0 && <span style={{ color: GRAY3 }}>Campos detectados: {analisis.columnasCampos.join(", ")}</span>}
          </div>
          <button onClick={importar} disabled={importando || analisis.nuevos.length === 0} className="oft-btn-press" style={{ width: "100%", padding: 12, borderRadius: 11, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: importando || analisis.nuevos.length === 0 ? 0.6 : 1 }}>
            {importando ? "Importando..." : `Importar ${analisis.nuevos.length} contactos`}
          </button>
        </>
      )}
      <button onClick={() => descargarCSV("plantilla_contactos.csv", [["nombre", "telefono", "etapa", "etiquetas", ...campos.map(c => c.nombre)], ["María Pérez", "67200474", etapas[0]?.nombre || "", "mayorista|colon", ...campos.map(() => "")]])}
        className="oft-btn-press" style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: RED, padding: 0 }}>Descargar archivo de ejemplo</button>
    </ModalBase>
  );
}

// ─────────────────────────────────────────────────────────────
//  PESTAÑA "CONTACTOS": todos los clientes en una tabla
// ─────────────────────────────────────────────────────────────
function ContactosPanel({ conversaciones, setConversaciones, etapas, etapaPorId, agentes, agentePorId, pedidos, user, onAbrirChat }) {
  const esMobil = useEsMobil();
  const esAdmin = !!user?.es_admin;
  const { campos, recargar: recargarCampos } = useCampos();
  const [busqueda, setBusqueda] = useState("");
  const [fCanal, setFCanal] = useState("");
  const [fEtapa, setFEtapa] = useState(""); const [fAgente, setFAgente] = useState(""); const [fTag, setFTag] = useState(""); const [fOrigen, setFOrigen] = useState("");
  const [orden, setOrden] = useState({ col: "reciente", dir: "desc" });
  const [columnasExtra, setColumnasExtra] = useState([]); // claves de campos mostrados como columna
  const [verColumnas, setVerColumnas] = useState(false);
  const [limite, setLimite] = useState(100);
  const [detalleId, setDetalleId] = useState(null);
  const [modal, setModal] = useState(null); // nuevo | importar | campos
  const [nuevaTag, setNuevaTag] = useState("");

  const todasTags = [...new Set(conversaciones.flatMap(c => c.etiquetas || []))].sort();
  const textoBusqueda = (c) => [c.nombre_contacto, c.telefono, c.ig_username, ...(c.etiquetas || []), ...Object.values(c.campos || {}).map(String)].join(" ").toLowerCase();
  const filtradas = conversaciones.filter(c => {
    if (busqueda.trim() && !textoBusqueda(c).includes(busqueda.trim().toLowerCase())) return false;
    if (fCanal && (c.canal || "whatsapp") !== fCanal) return false;
    if (fEtapa && (fEtapa === "ninguna" ? c.etapa_id : c.etapa_id !== fEtapa)) return false;
    if (fAgente && (fAgente === "ninguno" ? c.agente_id : c.agente_id !== fAgente)) return false;
    if (fTag && !(c.etiquetas || []).includes(fTag)) return false;
    if (fOrigen === "anuncio" && c.origen !== "anuncio") return false;
    if (fOrigen === "manual" && !["manual", "importado"].includes(c.origen)) return false;
    if (fOrigen === "directo" && (c.origen === "anuncio" || ["manual", "importado"].includes(c.origen))) return false;
    return true;
  });
  const valorOrden = (c) => orden.col === "nombre" ? sinTildes(nombreDe(c))
    : orden.col === "telefono" ? subtituloDe(c)
    : orden.col === "creado" ? new Date(c.created_at).getTime()
    : orden.col.startsWith("campo:") ? String(c.campos?.[orden.col.slice(6)] ?? "").toLowerCase()
    : new Date(c.ultimo_mensaje_at || 0).getTime();
  const ordenadas = [...filtradas].sort((a, b) => { const x = valorOrden(a), y = valorOrden(b); const r = x < y ? -1 : x > y ? 1 : 0; return orden.dir === "asc" ? r : -r; });
  const cambiarOrden = (col) => setOrden(o => o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "nombre" || col === "telefono" ? "asc" : "desc" });
  const camposVisibles = campos.filter(c => columnasExtra.includes(c.clave));

  const guardarConv = async (id, cambios) => {
    setConversaciones(prev => prev.map(c => c.id === id ? { ...c, ...cambios } : c));
    try { await sb.patch("crm_conversaciones", id, cambios); } catch (e) { alert("No se pudo guardar: " + e.message); }
  };

  const exportar = () => {
    const filas = [["Nombre", "Teléfono", "Usuario Instagram", "Etapa", "Agente", "Etiquetas", "Origen", "Último mensaje", "Creado", ...campos.map(c => c.nombre)]];
    ordenadas.forEach(c => filas.push([
      c.nombre_contacto || "", esInstagram(c) ? "" : c.telefono, c.ig_username ? "@" + c.ig_username : "", etapaPorId[c.etapa_id]?.nombre || "", agentePorId[c.agente_id]?.nombre || "", (c.etiquetas || []).join("|"),
      c.origen === "anuncio" ? "Anuncio" : c.origen === "importado" ? "Importado" : c.origen === "manual" ? "Manual" : "Chat directo",
      c.ultimo_mensaje_at ? new Date(c.ultimo_mensaje_at).toLocaleString("es-PA") : "", new Date(c.created_at).toLocaleDateString("es-PA"),
      ...campos.map(campo => textoDeCampo(campo, c.campos?.[campo.clave])),
    ]));
    descargarCSV(`contactos_ofertodo_${new Date().toISOString().slice(0, 10)}.csv`, filas);
  };

  const detalle = conversaciones.find(c => c.id === detalleId);
  const pedidosDe = detalle ? pedidos.filter(p => p.telefono === detalle.telefono) : [];
  const Flecha = ({ col }) => orden.col === col ? <span style={{ marginLeft: 3 }}>{orden.dir === "asc" ? "↑" : "↓"}</span> : null;
  const th = { textAlign: "left", padding: "9px 12px", fontSize: 11.5, fontWeight: 800, color: GRAY3, cursor: "pointer", whiteSpace: "nowrap", background: GRAY, position: "sticky", top: 0 };
  const td = { padding: "9px 12px", fontSize: 13, borderBottom: `1px solid ${GRAY}`, whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" };
  const selectFiltro = { ...S.input, marginBottom: 0, fontSize: 12.5, padding: "7px 9px", width: "auto", minWidth: 120 };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
      <div style={{ background: WHITE, borderBottom: `1px solid ${GRAY2}`, padding: esMobil ? "12px 14px" : "14px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>Contactos</div>
            <div style={{ fontSize: 12.5, color: GRAY3 }}>{filtradas.length === conversaciones.length ? `${conversaciones.length} contactos` : `${filtradas.length} de ${conversaciones.length} contactos`}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {esAdmin && <button onClick={() => setModal("campos")} className="oft-btn-press" style={{ padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Campos</button>}
            <button onClick={exportar} className="oft-btn-press" style={{ padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Exportar</button>
            <button onClick={() => setModal("importar")} className="oft-btn-press" style={{ padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Importar</button>
            <button onClick={() => setModal("nuevo")} className="oft-btn-press" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 13px", borderRadius: 9, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}><Plus size={14} /> Nuevo contacto</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <Search size={15} color={GRAY3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, teléfono, etiqueta o dato..." style={{ ...S.input, marginBottom: 0, paddingLeft: 32, fontSize: 13 }} />
          </div>
          <select value={fEtapa} onChange={e => setFEtapa(e.target.value)} style={selectFiltro}><option value="">Todas las etapas</option>{etapas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}<option value="ninguna">Sin etapa</option></select>
          <select value={fAgente} onChange={e => setFAgente(e.target.value)} style={selectFiltro}><option value="">Todos los agentes</option>{agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}<option value="ninguno">Sin asignar</option></select>
          {todasTags.length > 0 && <select value={fTag} onChange={e => setFTag(e.target.value)} style={selectFiltro}><option value="">Todas las etiquetas</option>{todasTags.map(t => <option key={t} value={t}>#{t}</option>)}</select>}
          <select value={fCanal} onChange={e => setFCanal(e.target.value)} style={selectFiltro}><option value="">Todos los canales</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option></select>
          <select value={fOrigen} onChange={e => setFOrigen(e.target.value)} style={selectFiltro}><option value="">Cualquier origen</option><option value="anuncio">De anuncios</option><option value="directo">Chat directo</option><option value="manual">Agregados a mano</option></select>
          {!esMobil && campos.length > 0 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setVerColumnas(v => !v)} className="oft-btn-press" style={{ padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Columnas</button>
              {verColumnas && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 30, background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 12, padding: 10, minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                  {campos.map(c => (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={columnasExtra.includes(c.clave)} onChange={() => setColumnasExtra(prev => prev.includes(c.clave) ? prev.filter(x => x !== c.clave) : [...prev, c.clave])} /> {c.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", background: WHITE }}>
        {ordenadas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: GRAY3 }}>
            <Users size={36} color={GRAY2} style={{ margin: "0 auto 10px" }} />
            <div style={{ fontWeight: 800, fontSize: 14, color: BLACK, marginBottom: 4 }}>{conversaciones.length === 0 ? "Todavía no hay contactos" : "Ningún contacto coincide"}</div>
            <div style={{ fontSize: 12.5 }}>{conversaciones.length === 0 ? "Se crean solos cuando alguien te escribe, o los puedes agregar o importar." : "Prueba quitando algún filtro."}</div>
          </div>
        ) : esMobil ? (
          <div>
            {ordenadas.slice(0, limite).map(c => (
              <div key={c.id} onClick={() => setDetalleId(c.id)} style={{ padding: "12px 14px", borderBottom: `1px solid ${GRAY}`, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{nombreDe(c)}</div>
                  {etapaPorId[c.etapa_id] && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: etapaPorId[c.etapa_id].color + "22", color: etapaPorId[c.etapa_id].color, flexShrink: 0 }}>{etapaPorId[c.etapa_id].nombre}</span>}
                </div>
                <div style={{ fontSize: 12, color: GRAY3, marginTop: 2 }}>{subtituloDe(c)}{(c.etiquetas || []).length > 0 ? " · " + c.etiquetas.map(t => "#" + t).join(" ") : ""}</div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th} onClick={() => cambiarOrden("nombre")}>Nombre<Flecha col="nombre" /></th>
              <th style={th} onClick={() => cambiarOrden("telefono")}>Teléfono / usuario<Flecha col="telefono" /></th>
              <th style={{ ...th, cursor: "default" }}>Etapa</th>
              <th style={{ ...th, cursor: "default" }}>Agente</th>
              <th style={{ ...th, cursor: "default" }}>Etiquetas</th>
              {camposVisibles.map(c => <th key={c.id} style={th} onClick={() => cambiarOrden("campo:" + c.clave)}>{c.nombre}<Flecha col={"campo:" + c.clave} /></th>)}
              <th style={th} onClick={() => cambiarOrden("reciente")}>Último mensaje<Flecha col="reciente" /></th>
              <th style={th} onClick={() => cambiarOrden("creado")}>Creado<Flecha col="creado" /></th>
            </tr></thead>
            <tbody>
              {ordenadas.slice(0, limite).map(c => {
                const et = etapaPorId[c.etapa_id];
                return (
                  <tr key={c.id} onClick={() => setDetalleId(c.id)} style={{ cursor: "pointer", background: detalleId === c.id ? GRAY : WHITE }}>
                    <td style={{ ...td, fontWeight: 700 }}>{esInstagram(c) && <Instagram size={12} color="#DD2A7B" style={{ marginRight: 5, verticalAlign: "-1px" }} />}{c.nombre_contacto || (esInstagram(c) ? nombreDe(c) : <span style={{ color: GRAY3, fontWeight: 400 }}>Sin nombre</span>)}{c.origen === "anuncio" && <span title="Vino de un anuncio" style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 5, background: "#DBEAFE", color: "#1E40AF" }}>Anuncio</span>}</td>
                    <td style={td}>{subtituloDe(c)}</td>
                    <td style={td}>{et ? <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 5, background: et.color + "22", color: et.color }}>{et.nombre}</span> : <span style={{ color: GRAY3 }}>—</span>}</td>
                    <td style={td}>{agentePorId[c.agente_id]?.nombre || <span style={{ color: GRAY3 }}>—</span>}</td>
                    <td style={td}>{(c.etiquetas || []).map(t => <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: GRAY2, marginRight: 4 }}>#{t}</span>)}</td>
                    {camposVisibles.map(campo => <td key={campo.id} style={td}>{textoDeCampo(campo, c.campos?.[campo.clave]) || <span style={{ color: GRAY3 }}>—</span>}</td>)}
                    <td style={{ ...td, color: GRAY3 }}>{c.ultimo_mensaje_at ? formatoHora(c.ultimo_mensaje_at) : "—"}</td>
                    <td style={{ ...td, color: GRAY3 }}>{new Date(c.created_at).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "2-digit" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {ordenadas.length > limite && (
          <div style={{ textAlign: "center", padding: 16 }}>
            <button onClick={() => setLimite(l => l + 100)} className="oft-btn-press" style={{ padding: "9px 18px", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Mostrar más ({ordenadas.length - limite} restantes)</button>
          </div>
        )}
      </div>

      {detalle && createPortal(
        <div onClick={() => setDetalleId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 240, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} className="oft-fade-in" style={{ width: "100%", maxWidth: 400, background: WHITE, height: "100%", overflowY: "auto", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{nombreDe(detalle)}</div>
              <button onClick={() => setDetalleId(null)} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: GRAY3, marginBottom: 14 }}>{esInstagram(detalle) ? `Instagram · ${subtituloDe(detalle)}` : detalle.telefono}{detalle.origen === "anuncio" && detalle.anuncio_titulo ? ` · Anuncio: ${detalle.anuncio_titulo}` : ""}</div>
            <button onClick={() => { setDetalleId(null); onAbrirChat(detalle.id); }} className="oft-btn-press" style={{ width: "100%", padding: 11, borderRadius: 10, border: "none", background: BLACK, color: WHITE, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 18 }}>
              <MessageCircle size={15} /> {detalle.ultimo_mensaje_at ? "Abrir chat" : "Abrir chat y escribirle"}
            </button>
            <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>ETAPA</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {etapas.map(et => (
                <button key={et.id} onClick={() => guardarConv(detalle.id, { etapa_id: et.id })} className="oft-btn-press"
                  style={{ fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 8, border: `1.5px solid ${detalle.etapa_id === et.id ? et.color : GRAY2}`, background: detalle.etapa_id === et.id ? et.color + "1A" : WHITE, color: detalle.etapa_id === et.id ? et.color : GRAY3, cursor: "pointer" }}>{et.nombre}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>AGENTE ASIGNADO</div>
            <select value={detalle.agente_id || ""} onChange={e => guardarConv(detalle.id, { agente_id: e.target.value || null })} style={{ ...S.input, marginBottom: 18, fontSize: 13 }}>
              <option value="">Sin asignar</option>{agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>ETIQUETAS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {(detalle.etiquetas || []).map(t => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 7, background: GRAY2 }}>#{t}
                  <button onClick={() => guardarConv(detalle.id, { etiquetas: detalle.etiquetas.filter(x => x !== t) })} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={11} color={GRAY3} /></button>
                </span>
              ))}
            </div>
            <input value={nuevaTag} onChange={e => setNuevaTag(e.target.value)} list="oft-etiquetas-contactos" placeholder="Agregar etiqueta y Enter" style={{ ...S.input, marginBottom: 18, fontSize: 13 }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const t = nuevaTag.trim().replace(/^#/, "").slice(0, 30); if (t && !(detalle.etiquetas || []).some(x => x.toLowerCase() === t.toLowerCase())) guardarConv(detalle.id, { etiquetas: [...(detalle.etiquetas || []), t] }); setNuevaTag(""); } }} />
            <datalist id="oft-etiquetas-contactos">{todasTags.map(t => <option key={t} value={t} />)}</datalist>
            <CamposContacto key={detalle.id} conv={detalle} campos={campos} onGuardar={(cambios) => guardarConv(detalle.id, cambios)} />
            <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, letterSpacing: 0.5, marginBottom: 8 }}>PEDIDOS</div>
            <div style={{ fontSize: 13, color: GRAY3, marginBottom: 10 }}>{pedidosDe.length === 0 ? "Sin pedidos ni cotizaciones." : `${pedidosDe.length} pedido${pedidosDe.length !== 1 ? "s" : ""} o cotizacion${pedidosDe.length !== 1 ? "es" : ""} · $${pedidosDe.reduce((a, p) => a + Number(p.total || 0), 0).toFixed(2)} en total`}</div>
            <div style={{ fontSize: 11.5, color: GRAY3 }}>Contacto desde el {new Date(detalle.created_at).toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        </div>, document.body)}

      {modal === "nuevo" && <NuevoContacto etapas={etapas} conversaciones={conversaciones} onCerrar={() => setModal(null)}
        onCreado={(fila) => { setConversaciones(prev => [fila, ...prev]); setModal(null); setDetalleId(fila.id); }} />}
      {modal === "importar" && <ImportarContactos etapas={etapas} campos={campos} conversaciones={conversaciones} onCerrar={() => setModal(null)}
        onImportado={(filas) => setConversaciones(prev => [...filas, ...prev])} />}
      {modal === "campos" && <GestorCampos campos={campos} onCambio={recargarCampos} onCerrar={() => setModal(null)} />}
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════
//  INSTAGRAM — conectar cuentas (Instagram API con Instagram Login).
//  El token vive solo en el servidor; aquí nunca se vuelve a mostrar.
// ═══════════════════════════════════════════════════════════════
const URL_WEBHOOK_IG = `${SUPABASE_URL}/functions/v1/instagram-webhook`;
const VERIFY_TOKEN_IG = "ofertodo_ig_wh_2026_Qm4Zr8Tn2";

const PASOS_IG = [
  ["La cuenta debe ser profesional", "En la app de Instagram, la cuenta tiene que ser Empresa o Creador (Configuración > Tipo de cuenta y herramientas > Cambiar a cuenta profesional). Una cuenta personal no funciona."],
  ["Permite el acceso a los mensajes", "En la app de Instagram: Configuración y privacidad > Mensajes y respuestas a historias > Controles de mensajes > Herramientas conectadas, y activa Permitir acceso a los mensajes. Los nombres cambian un poco según la versión de la app."],
  ["Abre tu app en Meta", "developers.facebook.com > Mis apps > ofertodo crm web. En el menú de la izquierda agrega el producto Instagram y entra a Configuración de la API con inicio de sesión de Instagram (API setup with Instagram login)."],
  ["Genera el token de la cuenta", "En el paso Generate access tokens pulsa Add account, inicia sesión con la cuenta de Instagram (Ofertodo o Perfumería), acepta los permisos y pulsa Generate token. Copia el token largo."],
  ["Copia el App secret de Instagram", "En esa misma pantalla, arriba, están Instagram app ID e Instagram app secret (botón Show). Copia el secret: sirve para comprobar que los mensajes que llegan de verdad vienen de Meta."],
  ["Configura el webhook", "En el paso Configure webhooks pega la URL de devolución de llamada y el token de verificación de abajo, pulsa Verify and save, y deja el campo messages en Subscribed."],
  ["Pon la app en modo Live", "Arriba en el panel de Meta el interruptor debe decir Live (publicada). En modo Development los mensajes de clientes no llegan."],
  ["Conecta aquí", "Pulsa Conectar cuenta, pega el token y el App secret. Para la segunda cuenta repite desde el paso 4 (el App secret ya queda guardado). El CRM renueva los tokens solo cada 60 días."],
];

function InstagramCard({ esAdmin, esMobil }) {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const [token, setToken] = useState("");
  const [secreto, setSecreto] = useState("");
  const [secretoGuardado, setSecretoGuardado] = useState(null); // null = todavía no se sabe
  const [copiado, setCopiado] = useState("");

  const cargar = async () => {
    try { setCuentas((await sb.get("crm_cuentas_instagram", "?order=created_at.asc")) || []); }
    catch (e) { setCuentas([]); }
    setCargando(false);
  };
  const llamar = async (cuerpo) => {
    await sb.ensureFreshToken?.();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/instagram-cuentas`, { method: "POST", headers: sb.functionHeaders(), body: JSON.stringify(cuerpo) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
    return data;
  };
  const revisar = async () => {
    const d = await llamar({ modo: "estado" });
    setSecretoGuardado(!!d.secreto_guardado);
    await cargar();
  };
  useEffect(() => {
    cargar();
    if (esAdmin) revisar().catch(() => {});
  }, []);

  const ejecutar = async (cuerpo, textoOk) => {
    setOcupado(true); setAviso(null);
    try { await llamar(cuerpo); await cargar(); if (textoOk) setAviso({ tipo: "ok", texto: textoOk }); return true; }
    catch (e) { setAviso({ tipo: "error", texto: e.message }); return false; }
    finally { setOcupado(false); }
  };

  const conectar = async () => {
    if (token.trim().length < 30) { setAviso({ tipo: "error", texto: "Pega el token completo de Instagram (es una cadena larga, sin espacios)." }); return; }
    if (!secretoGuardado && !secreto.trim()) { setAviso({ tipo: "error", texto: "Falta el App secret de Instagram (paso 5 de la guía). Solo se pide la primera vez." }); return; }
    setOcupado(true); setAviso(null);
    try {
      const d = await llamar({ modo: "conectar", token: token.trim(), app_secret: secreto.trim() || undefined });
      setToken(""); setSecreto(""); setSecretoGuardado(true); setMostrarForm(false);
      await cargar();
      setAviso({ tipo: "ok", texto: `Conectada${d.username ? ` @${d.username}` : ""}. Ya recibe los mensajes directos en la Bandeja.` });
    } catch (e) { setAviso({ tipo: "error", texto: e.message }); }
    finally { setOcupado(false); }
  };
  const guardarSecreto = async () => {
    if (!secreto.trim()) return;
    const ok = await ejecutar({ modo: "guardar_secreto", secreto: secreto.trim() }, "App secret guardado.");
    if (ok) { setSecreto(""); setSecretoGuardado(true); }
  };
  const quitar = async (c) => {
    if (!confirm(`¿Desconectar ${c.etiqueta || "esta cuenta"}? Dejará de recibir mensajes. Los chats que ya tienes se conservan, pero no podrás responderlos hasta volver a conectarla.`)) return;
    await ejecutar({ modo: "quitar", cuenta_id: c.id }, "Cuenta desconectada.");
  };
  const copiar = async (clave, texto) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(""), 1500); } catch (e) { /* sin portapapeles */ }
  };

  const colorAviso = aviso?.tipo === "ok" ? { bg: "#D1FAE5", color: "#065F46" } : { bg: "#FEE2E2", color: "#991B1B" };
  const dias = (c) => c.token_expira_at ? Math.ceil((new Date(c.token_expira_at).getTime() - Date.now()) / 86400000) : null;
  const Chip = ({ bg, color, children }) => <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: bg, color }}>{children}</span>;
  const Copiable = ({ id, etiqueta, valor }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: GRAY3, marginBottom: 3 }}>{etiqueta}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input readOnly value={valor} onFocus={e => e.target.select()} style={{ ...S.input, marginBottom: 0, fontSize: 11.5, flex: 1, minWidth: 0, fontFamily: "monospace" }} />
        <button onClick={() => copiar(id, valor)} className="oft-btn-press" style={{ background: GRAY, border: "none", borderRadius: 8, padding: "0 12px", fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>{copiado === id ? "Copiado" : "Copiar"}</button>
      </div>
    </div>
  );

  return (
    <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Instagram size={22} color={WHITE} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Instagram</div>
          <div style={{ fontSize: 11.5, color: GRAY3 }}>Mensajes directos en la misma Bandeja</div>
        </div>
        {esAdmin && cuentas.length > 0 && (
          <button onClick={async () => { setOcupado(true); setAviso(null); try { await revisar(); setAviso({ tipo: "ok", texto: "Estado actualizado desde Instagram." }); } catch (e) { setAviso({ tipo: "error", texto: e.message }); } setOcupado(false); }}
            disabled={ocupado} title="Actualizar estado desde Instagram" className="oft-btn-press"
            style={{ background: GRAY, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: ocupado ? 0.5 : 1 }}>
            <RefreshCw size={15} />
          </button>
        )}
      </div>

      {aviso && <div style={{ background: colorAviso.bg, color: colorAviso.color, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.4, marginBottom: 12 }}>{aviso.texto}</div>}

      {cargando ? (
        <div style={{ fontSize: 12.5, color: GRAY3 }}>Revisando conexión...</div>
      ) : cuentas.length === 0 ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FEF3C7", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <AlertCircle size={17} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.45 }}>Todavía no hay ninguna cuenta de Instagram conectada. Puedes conectar más de una (por ejemplo Ofertodo y Perfumería).</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {cuentas.map(c => {
            const est = ESTADO_IG[c.estado] || { texto: c.estado || "Sin revisar", bg: GRAY, color: GRAY3 };
            const d = dias(c);
            return (
              <div key={c.id} style={{ border: `1px solid ${GRAY2}`, borderRadius: 12, padding: 12, opacity: c.activo ? 1 : 0.6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: GRAY2, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {c.foto_url ? <img src={c.foto_url} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <Instagram size={16} color={GRAY3} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.etiqueta || c.username || "Instagram"}</div>
                    <div style={{ fontSize: 11.5, color: GRAY3 }}>{c.username ? `@${c.username}` : "Sin usuario"}</div>
                  </div>
                  {esAdmin && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => ejecutar({ modo: "alternar", cuenta_id: c.id, activo: !c.activo }, c.activo ? "Cuenta apagada: no se podrá responder por ella." : "Cuenta encendida.")} disabled={ocupado} title={c.activo ? "Apagar en el CRM" : "Encender"} className="oft-btn-press"
                        style={{ background: GRAY, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Power size={14} color={c.activo ? "#065F46" : GRAY3} /></button>
                      <button onClick={() => quitar(c)} disabled={ocupado} title="Desconectar" className="oft-btn-press"
                        style={{ background: GRAY, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={14} color="#991B1B" /></button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                  <Chip bg={est.bg} color={est.color}>{est.texto}</Chip>
                  {c.estado === "CONNECTED" && (c.webhook_suscrito
                    ? <Chip bg="#D1FAE5" color="#065F46">Recibiendo mensajes</Chip>
                    : <Chip bg="#FEF3C7" color="#92400E">Mensajes sin activar</Chip>)}
                  {d !== null && c.estado === "CONNECTED" && <span style={{ fontSize: 11, color: d < 10 ? "#991B1B" : GRAY3 }}>Token: {d > 0 ? `${d} días` : "vence hoy"}</span>}
                  {esAdmin && c.estado === "CONNECTED" && d !== null && d < 30 && (
                    <button onClick={() => ejecutar({ modo: "renovar", cuenta_id: c.id }, "Token renovado por 60 días.")} disabled={ocupado} className="oft-btn-press"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 800, color: RED, padding: 0 }}>Renovar</button>
                  )}
                </div>
                {(c.estado === "TOKEN_EXPIRADO" || c.estado === "SIN_TOKEN") && (
                  <div style={{ fontSize: 11.5, color: "#991B1B", lineHeight: 1.45, marginTop: 8 }}>Genera un token nuevo en Meta (paso 4 de la guía) y vuelve a conectar la cuenta; los chats se conservan.</div>
                )}
                {c.estado === "CONNECTED" && !c.webhook_suscrito && (
                  <div style={{ fontSize: 11.5, color: "#92400E", lineHeight: 1.45, marginTop: 8 }}>Instagram todavía no manda los mensajes de esta cuenta. Revisa el paso 6 de la guía (webhook) y pulsa actualizar.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {esAdmin && secretoGuardado === false && cuentas.length > 0 && !mostrarForm && (
        <div style={{ background: "#FEF3C7", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.45, marginBottom: 8 }}>Falta el App secret de Instagram: sin él, los mensajes que llegan se rechazan por seguridad (paso 5).</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={secreto} onChange={e => setSecreto(e.target.value)} placeholder="App secret de Instagram" style={{ ...S.input, marginBottom: 0, fontSize: 12.5, flex: 1, minWidth: 0 }} />
            <button onClick={guardarSecreto} disabled={ocupado || !secreto.trim()} className="oft-btn-press" style={{ background: BLACK, color: WHITE, border: "none", borderRadius: 8, padding: "0 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", opacity: ocupado || !secreto.trim() ? 0.5 : 1 }}>Guardar</button>
          </div>
        </div>
      )}

      {esAdmin ? (
        mostrarForm ? (
          <div style={{ background: GRAY, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: GRAY3, marginBottom: 4 }}>Token de acceso de Instagram</div>
            <textarea value={token} onChange={e => setToken(e.target.value)} rows={3} placeholder="Pega aquí el token que generaste en Meta (empieza con IG...)" autoComplete="off" spellCheck={false}
              style={{ ...S.input, fontSize: 12, fontFamily: "monospace", resize: "vertical", marginBottom: 10 }} />
            {!secretoGuardado && (
              <>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: GRAY3, marginBottom: 4 }}>App secret de Instagram (solo la primera vez)</div>
                <input value={secreto} onChange={e => setSecreto(e.target.value)} placeholder="32 letras y números" autoComplete="off" spellCheck={false} style={{ ...S.input, fontSize: 12.5, fontFamily: "monospace", marginBottom: 10 }} />
              </>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={conectar} disabled={ocupado} className="oft-btn-press" style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: RED, color: WHITE, fontWeight: 800, fontSize: 13.5, cursor: "pointer", opacity: ocupado ? 0.6 : 1 }}>{ocupado ? "Conectando..." : "Conectar cuenta"}</button>
              <button onClick={() => { setMostrarForm(false); setToken(""); setSecreto(""); setAviso(null); }} disabled={ocupado} className="oft-btn-press" style={{ padding: "11px 16px", borderRadius: 10, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setMostrarForm(true); setAviso(null); }} className="oft-btn-press" style={{ width: "100%", padding: "10px 0", borderRadius: 9, border: "none", background: BLACK, color: WHITE, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            <Plus size={15} /> {cuentas.length === 0 ? "Conectar cuenta de Instagram" : "Conectar otra cuenta"}
          </button>
        )
      ) : (
        <div style={{ fontSize: 12, color: GRAY3, marginBottom: 12 }}>Solo un administrador puede conectar o desconectar cuentas.</div>
      )}

      <button onClick={() => setMostrarGuia(v => !v)} className="oft-btn-press" style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: `1.5px solid ${GRAY2}`, background: WHITE, fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <ChevronDown size={14} style={{ transform: mostrarGuia ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} /> {mostrarGuia ? "Ocultar guía" : "Guía paso a paso en Meta"}
      </button>

      {mostrarGuia && (
        <div style={{ marginTop: 14 }}>
          {PASOS_IG.map(([t, d], i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: BLACK, color: WHITE, fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{t}</div>
                <div style={{ fontSize: 12, color: GRAY3, lineHeight: 1.5, marginTop: 2 }}>{d}</div>
                {i === 5 && (
                  <div style={{ marginTop: 8 }}>
                    <Copiable id="url" etiqueta="URL de devolución de llamada (Callback URL)" valor={URL_WEBHOOK_IG} />
                    <Copiable id="vt" etiqueta="Token de verificación (Verify token)" valor={VERIFY_TOKEN_IG} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div style={{ background: GRAY, borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: GRAY3, lineHeight: 1.5 }}>
            Cómo funciona: la persona te escribe por Instagram y el chat aparece en la Bandeja. Tienes 24 horas para responder; pasado ese tiempo hay que esperar a que escriba otra vez.
            Instagram no tiene plantillas, así que no se puede iniciar un chat ni mandar broadcasts por aquí. Los menús de Meta cambian de nombre con frecuencia: si algo no coincide, busca la opción parecida.
          </div>
        </div>
      )}
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

        <InstagramCard esAdmin={esAdmin} esMobil={esMobil} />
      </div>
    </div>
  );
}
