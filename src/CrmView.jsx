import { useState, useEffect, useRef } from "react";
import {
  MessageCircle, Search, Send, User, Users, BarChart3, Inbox as InboxIcon,
  ChevronRight, Circle, CheckCheck, Check, Clock, RefreshCw, X, Tag,
  ArrowLeft, Zap, TrendingUp,
} from "lucide-react";
import { RED, BLACK, GRAY, GRAY2, GRAY3, WHITE, S, useApp, sb, Spinner } from "./shared.jsx";

// ═══════════════════════════════════════════════════════════════
//  CRM — bandeja de WhatsApp, etapas de cliente, y equipo de
//  agentes. Vive como su propia sección grande del sitio (no una
//  pestaña dentro del admin), accesible desde el link "CRM" del
//  encabezado para admins y operadores.
// ═══════════════════════════════════════════════════════════════

const ESTILO_TAB_ACTIVO = { color: WHITE, background: BLACK };
const ESTILO_TAB = { color: GRAY3, background: "transparent" };

function formatoHora(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha);
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  if (esHoy) return d.toLocaleTimeString("es-PA", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("es-PA", { day: "numeric", month: "short" });
}

export default function CrmView() {
  const { user } = useApp();
  const [tab, setTab] = useState("inbox"); // inbox | etapas | agentes | analitica
  const [etapas, setEtapas] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargarTodo = async () => {
    try {
      const [etapasData, agentesData, conversacionesData] = await Promise.all([
        sb.get("crm_etapas", "?order=orden.asc"),
        sb.get("usuarios", "?rol=in.(operador,admin)&select=id,nombre,email,rol"),
        sb.get("crm_conversaciones", "?order=ultimo_mensaje_at.desc.nullslast,created_at.desc"),
      ]);
      setEtapas(etapasData || []);
      setAgentes(agentesData || []);
      setConversaciones(conversacionesData || []);
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
            <AnaliticaPanel conversaciones={conversaciones} etapas={etapas} agentes={agentes} />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BANDEJA: lista de conversaciones + hilo de mensajes + panel
//  de contacto (etapa, agente asignado).
// ─────────────────────────────────────────────────────────────
function InboxPanel({ conversaciones, setConversaciones, etapas, etapaPorId, agentes, agentePorId, user, recargar }) {
  const [seleccionada, setSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
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

  // NOTA: por ahora esto solo GUARDA el mensaje en la base de datos como
  // "saliente" -- falta conectar el envío real por WhatsApp (pendiente a que
  // termine la revisión de Meta). Una vez esté lista la API, este mismo botón
  // se conecta a la función que manda el mensaje de verdad.
  const enviarMensaje = async () => {
    if (!texto.trim() || !seleccionada) return;
    setEnviando(true);
    try {
      const creado = await sb.post("crm_mensajes", {
        conversacion_id: seleccionada.id, direccion: "saliente", tipo: "texto",
        contenido: texto.trim(), agente_id: user?.id || null, estado: "enviado",
      });
      if (Array.isArray(creado) && creado[0]) setMensajes(prev => [...prev, creado[0]]);
      await sb.patch("crm_conversaciones", seleccionada.id, {
        ultimo_mensaje_at: new Date().toISOString(), ultimo_mensaje_preview: texto.trim(),
      });
      setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? { ...c, ultimo_mensaje_at: new Date().toISOString(), ultimo_mensaje_preview: texto.trim() } : c));
      setTexto("");
    } catch (e) { alert("Error enviando: " + e.message); }
    setEnviando(false);
  };

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
                  <div style={{ maxWidth: "62%", padding: "9px 13px", borderRadius: 14, background: m.direccion === "saliente" ? BLACK : WHITE, color: m.direccion === "saliente" ? WHITE : BLACK, border: m.direccion === "entrante" ? `1px solid ${GRAY2}` : "none", fontSize: 13.5, lineHeight: 1.45 }}>
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
        <div style={{ width: 280, minWidth: 280, background: WHITE, borderLeft: `1px solid ${GRAY2}`, padding: 20, overflowY: "auto" }}>
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
          <select value={seleccionada.agente_id || ""} onChange={e => cambiarAgente(e.target.value)} style={{ ...S.input, marginBottom: 0, fontSize: 13 }}>
            <option value="">Sin asignar</option>
            {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
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
        Los agentes son las mismas cuentas de operador del panel de administrador. Para agregar uno nuevo, promuévelo desde Admin → Equipo.
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

// ─────────────────────────────────────────────────────────────
//  ANALÍTICA: métricas generales -- se va a llenar de verdad en
//  cuanto haya mensajes reales fluyendo.
// ─────────────────────────────────────────────────────────────
function AnaliticaPanel({ conversaciones, etapas, agentes }) {
  const total = conversaciones.length;
  const porEtapa = etapas.map(e => ({ ...e, total: conversaciones.filter(c => c.etapa_id === e.id).length }));
  const sinAsignar = conversaciones.filter(c => !c.agente_id).length;

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <TarjetaMetrica icono={InboxIcon} valor={total} etiqueta="Conversaciones totales" />
        <TarjetaMetrica icono={Users} valor={agentes.length} etiqueta="Agentes activos" />
        <TarjetaMetrica icono={Clock} valor={sinAsignar} etiqueta="Sin asignar" />
      </div>
      <div style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 14 }}>Clientes por etapa</div>
        {porEtapa.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 110, fontSize: 12.5, fontWeight: 700, color: GRAY3, flexShrink: 0 }}>{e.nombre}</div>
            <div style={{ flex: 1, height: 8, background: GRAY, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: total > 0 ? `${(e.total / total) * 100}%` : "0%", background: e.color, borderRadius: 4 }} />
            </div>
            <div style={{ width: 24, fontSize: 12.5, fontWeight: 800, textAlign: "right" }}>{e.total}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: GRAY3, textAlign: "center" }}>
        Tiempo de respuesta y ranking de agentes aparecen aquí en cuanto haya mensajes reales entrando.
      </div>
    </div>
  );
}

function TarjetaMetrica({ icono: Icono, valor, etiqueta }) {
  return (
    <div style={{ background: WHITE, borderRadius: 14, padding: 18, border: `1px solid ${GRAY2}` }}>
      <Icono size={18} color={RED} style={{ marginBottom: 8 }} />
      <div style={{ fontSize: 26, fontWeight: 900 }}>{valor}</div>
      <div style={{ fontSize: 12, color: GRAY3, fontWeight: 600 }}>{etiqueta}</div>
    </div>
  );
}
