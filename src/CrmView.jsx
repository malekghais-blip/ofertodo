import { useState, useEffect, useRef } from "react";
import {
  MessageCircle, Search, Send, User, Users, BarChart3, Inbox as InboxIcon,
  ChevronRight, Circle, CheckCheck, Check, Clock, RefreshCw, X, Tag,
  ArrowLeft, Zap, TrendingUp, Trophy, Target, DollarSign, ShoppingBag,
  Timer, AlertCircle, FileText, ExternalLink,
} from "lucide-react";
import { RED, BLACK, GRAY, GRAY2, GRAY3, WHITE, S, useApp, sb, Spinner } from "./shared.jsx";

// ═══════════════════════════════════════════════════════════════
//  CRM — bandeja de WhatsApp, etapas de cliente, equipo de agentes,
//  y analítica de desempeño. Vive como su propia sección grande del
//  sitio, accesible desde el link "CRM" del encabezado.
// ═══════════════════════════════════════════════════════════════

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

export default function CrmView() {
  const { user } = useApp();
  const [tab, setTab] = useState("inbox"); // inbox | etapas | agentes | analitica
  const [etapas, setEtapas] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [conversaciones, setConversaciones] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [mensajesTodos, setMensajesTodos] = useState([]);
  const [cargando, setCargando] = useState(true);

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

  const etapaPorId = Object.fromEntries(etapas.map(e => [e.id, e]));
  const agentePorId = Object.fromEntries(agentes.map(a => [a.id, a]));

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", background: GRAY, display: "flex", flexDirection: "column" }}>
      {/* ENCABEZADO DEL CRM */}
      <div style={{ background: WHITE, borderBottom: `1px solid ${GRAY2}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: BLACK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageCircle size={18} color={WHITE} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>CRM Ofertodo</div>
            <div style={{ fontSize: 11.5, color: GRAY3 }}>{user?.nombre || "Agente"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: GRAY, borderRadius: 10, padding: 4 }}>
          {[["inbox", "Bandeja", InboxIcon], ["etapas", "Etapas", Tag], ["agentes", "Agentes", Users], ["analitica", "Analítica", BarChart3]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className="oft-btn-press"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", ...(tab === id ? ESTILO_TAB_ACTIVO : ESTILO_TAB) }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {tab === "inbox" && (
            <InboxPanel
              conversaciones={conversaciones} setConversaciones={setConversaciones}
              etapas={etapas} etapaPorId={etapaPorId}
              agentes={agentes} agentePorId={agentePorId}
              pedidos={pedidos}
              user={user} recargar={cargarTodo}
            />
          )}
          {tab === "etapas" && (
            <EtapasPanel conversaciones={conversaciones} etapas={etapas} agentePorId={agentePorId} setConversaciones={setConversaciones} />
          )}
          {tab === "agentes" && (
            <AgentesPanel agentes={agentes} conversaciones={conversaciones} />
          )}
          {tab === "analitica" && (
            <AnaliticaPanel conversaciones={conversaciones} etapas={etapas} agentes={agentes} pedidos={pedidos} mensajes={mensajesTodos} />
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
function InboxPanel({ conversaciones, setConversaciones, etapas, etapaPorId, agentes, agentePorId, pedidos, user, recargar }) {
  const [seleccionada, setSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviandoPedidoId, setEnviandoPedidoId] = useState(null);
  const hiloRef = useRef(null);

  const conversacionesFiltradas = conversaciones.filter(c => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (c.nombre_contacto || "").toLowerCase().includes(q) || (c.telefono || "").includes(q);
  });

  const cargarMensajes = async (conv) => {
    setSeleccionada(conv);
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

  const registrarMensajeSaliente = async (contenido, actualizarPreview = true) => {
    const creado = await sb.post("crm_mensajes", {
      conversacion_id: seleccionada.id, direccion: "saliente", tipo: "texto",
      contenido, agente_id: user?.id || null, estado: "enviado",
    });
    if (Array.isArray(creado) && creado[0]) setMensajes(prev => [...prev, creado[0]]);
    if (actualizarPreview) {
      const preview = contenido.length > 60 ? contenido.slice(0, 60) + "…" : contenido;
      await sb.patch("crm_conversaciones", seleccionada.id, { ultimo_mensaje_at: new Date().toISOString(), ultimo_mensaje_preview: preview });
      setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? { ...c, ultimo_mensaje_at: new Date().toISOString(), ultimo_mensaje_preview: preview } : c));
    }
  };

  // NOTA: por ahora esto solo GUARDA el mensaje en la base de datos como
  // "saliente" -- falta conectar el envío real por WhatsApp (pendiente a que
  // termine la revisión de Meta). Una vez esté lista la API, esto mismo se
  // conecta a la función que manda el mensaje de verdad.
  const enviarMensaje = async () => {
    if (!texto.trim() || !seleccionada) return;
    setEnviando(true);
    try { await registrarMensajeSaliente(texto.trim()); setTexto(""); }
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
      await registrarMensajeSaliente(texto);
    } catch (e) { alert("Error preparando el envío: " + e.message); }
    setEnviandoPedidoId(null);
  };

  const pedidosDelContacto = seleccionada ? pedidos.filter(p => p.telefono === seleccionada.telefono) : [];

  return (
    <>
      {/* LISTA DE CONVERSACIONES */}
      <div style={{ width: 340, minWidth: 340, background: WHITE, borderRight: `1px solid ${GRAY2}`, display: "flex", flexDirection: "column" }}>
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
                    {c.no_leidos > 0 && <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: RED, color: WHITE }}>{c.no_leidos}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HILO DE MENSAJES */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!seleccionada ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: GRAY3 }}>
            <MessageCircle size={48} color={GRAY2} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>Elige una conversación para ver los mensajes</div>
          </div>
        ) : (
          <>
            <div style={{ padding: "13px 20px", background: WHITE, borderBottom: `1px solid ${GRAY2}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: GRAY2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: GRAY3 }}>
                {(seleccionada.nombre_contacto || seleccionada.telefono || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>{seleccionada.nombre_contacto || seleccionada.telefono}</div>
                <div style={{ fontSize: 11.5, color: GRAY3 }}>{seleccionada.telefono}</div>
              </div>
            </div>
            <div ref={hiloRef} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {mensajes.length === 0 ? (
                <div style={{ textAlign: "center", color: GRAY3, fontSize: 13, marginTop: 40 }}>Sin mensajes en esta conversación</div>
              ) : mensajes.map(m => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.direccion === "saliente" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "62%", padding: "9px 13px", borderRadius: 14, background: m.direccion === "saliente" ? BLACK : WHITE, color: m.direccion === "saliente" ? WHITE : BLACK, border: m.direccion === "entrante" ? `1px solid ${GRAY2}` : "none", fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                    {m.contenido}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4, opacity: 0.6, fontSize: 10 }}>
                      {formatoHora(m.created_at)}
                      {m.direccion === "saliente" && (m.estado === "leido" ? <CheckCheck size={12} /> : m.estado === "entregado" ? <CheckCheck size={12} /> : <Check size={12} />)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 14, background: WHITE, borderTop: `1px solid ${GRAY2}`, display: "flex", gap: 8 }}>
              <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe un mensaje..."
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensaje(); } }}
                style={{ ...S.input, marginBottom: 0, flex: 1 }} />
              <button onClick={enviarMensaje} disabled={enviando || !texto.trim()} className="oft-btn-press"
                style={{ background: BLACK, color: WHITE, border: "none", borderRadius: 10, width: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: enviando || !texto.trim() ? 0.5 : 1 }}>
                <Send size={17} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* PANEL DE CONTACTO */}
      {seleccionada && (
        <div style={{ width: 290, minWidth: 290, background: WHITE, borderLeft: `1px solid ${GRAY2}`, padding: 20, overflowY: "auto" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: GRAY2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22, color: GRAY3, margin: "0 auto 10px" }}>
              {(seleccionada.nombre_contacto || seleccionada.telefono || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{seleccionada.nombre_contacto || "Sin nombre"}</div>
            <div style={{ fontSize: 12.5, color: GRAY3 }}>{seleccionada.telefono}</div>
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
  const moverA = async (conv, etapaId) => {
    await sb.patch("crm_conversaciones", conv.id, { etapa_id: etapaId });
    setConversaciones(prev => prev.map(c => c.id === conv.id ? { ...c, etapa_id: etapaId } : c));
  };

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
  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
      <div style={{ fontSize: 13, color: GRAY3, marginBottom: 18, maxWidth: 560 }}>
        Los agentes son las mismas cuentas de operador del panel de administrador. Para agregar uno nuevo, promuévelo desde Admin → Equipo. El desempeño de cada uno está en la pestaña "Analítica".
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
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
    <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
      {/* KPIs GLOBALES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        <TarjetaMetrica icono={InboxIcon} valor={total} etiqueta="Conversaciones totales" />
        <TarjetaMetrica icono={Timer} valor={tiempoRespuestaGlobal !== null ? Math.round(tiempoRespuestaGlobal) : 0} sufijo=" min" etiqueta="Tiempo de respuesta promedio" mostrarGuion={tiempoRespuestaGlobal === null} />
        <TarjetaMetrica icono={Target} valor={Math.round(tasaConversionGlobal)} sufijo="%" etiqueta="Tasa de conversión" />
        <TarjetaMetrica icono={DollarSign} valor={ventasTotalGlobal} prefijo="$" decimales={2} etiqueta="Ventas generadas por leads" />
        <TarjetaMetrica icono={AlertCircle} valor={sinResponder} etiqueta="Leads esperando respuesta" alerta={sinResponder > 0} />
      </div>

      {/* LEADERBOARD */}
      <div style={{ background: WHITE, borderRadius: 16, padding: 22, border: `1px solid ${GRAY2}`, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Trophy size={18} color="#D4AF37" />
          <div style={{ fontWeight: 900, fontSize: 15.5 }}>Ranking de agentes</div>
        </div>
        <div style={{ fontSize: 12, color: GRAY3, marginBottom: 18 }}>Ordenado por ventas generadas, incluyendo admins con conversaciones asignadas.</div>

        {metricas.length === 0 ? (
          <div style={{ textAlign: "center", color: GRAY3, fontSize: 13, padding: "30px 0" }}>Sin agentes con conversaciones asignadas todavía.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {metricas.map((m, i) => (
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

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        {/* DISTRIBUCIÓN POR ETAPA */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 16 }}>Clientes por etapa</div>
          {porEtapa.map(e => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 110, fontSize: 12.5, fontWeight: 700, color: GRAY3, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nombre}</div>
              <BarraAnimada porcentaje={total > 0 ? (e.total / total) * 100 : 0} color={e.color} />
              <div style={{ width: 24, fontSize: 12.5, fontWeight: 800, textAlign: "right" }}>{e.total}</div>
            </div>
          ))}
        </div>

        {/* PRODUCTIVIDAD POR AGENTE */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 4 }}>Mensajes respondidos</div>
          <div style={{ fontSize: 11.5, color: GRAY3, marginBottom: 16 }}>Volumen de respuestas enviadas por cada agente</div>
          {metricas.filter(m => m.mensajesEnviados > 0).length === 0 ? (
            <div style={{ textAlign: "center", color: GRAY3, fontSize: 12.5, padding: "20px 0" }}>Sin mensajes enviados todavía.</div>
          ) : (
            [...metricas].sort((a, b) => b.mensajesEnviados - a.mensajesEnviados).map(m => {
              const maxMsj = Math.max(...metricas.map(x => x.mensajesEnviados), 1);
              return (
                <div key={m.agente.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 90, fontSize: 12.5, fontWeight: 700, color: GRAY3, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.agente.nombre}</div>
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

function TarjetaMetrica({ icono: Icono, valor, prefijo = "", sufijo = "", decimales = 0, etiqueta, alerta = false, mostrarGuion = false }) {
  return (
    <div className="oft-fade-in" style={{ background: WHITE, borderRadius: 14, padding: 18, border: `1px solid ${alerta ? "#FCA5A5" : GRAY2}` }}>
      <Icono size={18} color={alerta ? RED : RED} style={{ marginBottom: 8 }} />
      <div style={{ fontSize: 26, fontWeight: 900 }}>{mostrarGuion ? "—" : <NumeroAnimado valor={valor} prefijo={prefijo} sufijo={sufijo} decimales={decimales} />}</div>
      <div style={{ fontSize: 12, color: GRAY3, fontWeight: 600 }}>{etiqueta}</div>
    </div>
  );
}
