import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart, Search, Trash2, MessageCircle, X, Package, CheckCircle2,
  MapPin, CreditCard, LayoutGrid, FolderOpen, Tag, Truck, Headphones,
  Plus, Pencil, Upload, RefreshCw, ChevronDown, ChevronUp, LogOut, User, Home,
  Shirt, Footprints, Watch, Sparkles, ClipboardList, Image as ImageIcon,
  FileSpreadsheet, FolderPlus, Zap, Lock, Users, BarChart3, DollarSign,
  TrendingUp, Wallet, ShoppingBag, Pencil as PencilIcon, Save,
  Building2, MapPin as MapPinIcon, Send, FilePlus, Download, FileText, Receipt,
  Calendar as CalendarIcon, Eye, EyeOff, Share2, AlertTriangle, ChevronRight,
  ArrowUpRight, ArrowDownRight, MousePointerClick, Target, Printer, Boxes, GitMerge, Droplets
} from "lucide-react";
import {
  BLACK, CategoryIcon, ChipAdder, ClienteFormModal, CrearPedidoView, SelectorColores,
  DistribucionEditor, GRAY, GRAY2, GRAY3, Logo,
  RED, RED_D, S, SUPABASE_URL, ShippingLabelModal, NOTAS_FRAGANCIA,
  Spinner, StatusBadge, WHITE, comprimirImagen, estadosDe,
  imagenOptimizada, resolverAreaVenta, sb, useApp, useLockBodyScroll, useRefrescoPeriodico,
  agregarCanvasComoPaginasPdf, ofertaInfo, precioNormalPiezas, piezasDePresentacion, presUnitPrice, idVisitante,
  normalizarEnvioPerfumes, METODOS_PAGO, BadgeMetodoPago, stockWeb, asegurarLibsPdf, ModalElegirPresentacion, EtiquetaReservadas, ofertasVigentesDeProducto,
} from "./shared.jsx";
import { useCambiosEnVivo } from "./clienteEnVivo.jsx";

// "YYYY-MM-DD" según la hora de PANAMÁ (America/Panama, UTC-5), sin importar la
// zona horaria del navegador o servidor. Se usa en vez de .toISOString().slice(0,10)
// -- ese método siempre da la fecha en UTC, así que cerca de la noche en Panamá
// (después de las 7pm aprox.) UTC ya cambió al día siguiente mientras aquí
// todavía es "hoy" -- eso hacía que el filtro de "Hoy" en Analítica y Reportes
// mostrara datos del día equivocado justo esas horas.
function fechaPanama(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Panama", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(fecha);
  const obj = {};
  partes.forEach(p => { obj[p.type] = p.value; });
  return `${obj.year}-${obj.month}-${obj.day}`;
}

// ═══════════════════════════════════════════════════════════════
//  PANEL DE ADMINISTRADOR — separado en su propio archivo para que
//  los clientes normales nunca tengan que descargar este código
//  (solo se carga cuando alguien entra de verdad a /admin).
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  IMAGEN DE FACTURA / COTIZACIÓN (descargar/compartir desde el dashboard)
//  Sirve tanto para pedidos (factura) como para cotizaciones — se adapta según order.tipo.
// ═══════════════════════════════════════════════════════════════

function OrderImageModal({ order, onClose }) {
  useLockBodyScroll();
  const { products } = useApp();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const esCot = order.tipo === "cotizacion";
  const acento = esCot ? "#856404" : RED;
  const etiqueta = order.reservada ? "Reserva" : esCot ? "Cotización" : "Factura";
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fecha = order.created_at ? new Date(order.created_at) : new Date();
  const items = order.items || [];
  const subtotal = items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const costoEnvio = Number(order.costo_envio) || 0;
  const total = Number(order.total) || (subtotal + costoEnvio);

  // Renderiza el documento a un ancho fijo (640px) fuera de pantalla,
  // así la imagen nunca sale cortada en celular.
  const renderCanvas = async () => {
    const source = ref.current;
    const clone = source.cloneNode(true);
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";
    holder.style.width = "640px";
    holder.style.background = "#ffffff";
    clone.style.width = "640px";
    clone.style.maxWidth = "640px";
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      return await window.html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", useCORS: true, width: 640, windowWidth: 640 });
    } finally {
      document.body.removeChild(holder);
    }
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  const downloadPNG = async () => {
    if (!(await asegurarLibsPdf({ soloImagen: true }))) return;
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      // En celular: intenta usar "Compartir" para guardar en la galería/fotos
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      const file = new File([blob], `${order.codigo}.png`, { type: "image/png" });
      if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: order.codigo });
          setBusy(false);
          return;
        } catch(shareErr) {
          if (shareErr.name === "AbortError") { setBusy(false); return; }
        }
      }
      const link = document.createElement("a");
      link.download = `${order.codigo}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch(e) { alert("Error generando imagen: " + e.message); }
    setBusy(false);
  };

  const downloadPDF = async () => {
    if (!(await asegurarLibsPdf())) return;
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      agregarCanvasComoPaginasPdf(pdf, canvas);
      pdf.save(`${order.codigo}.pdf`);
    } catch(e) { alert("Error generando PDF: " + e.message); }
    setBusy(false);
  };

  return createPortal(
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onClick={onClose}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 620, width: "92%", margin: "0 auto", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {/* Barra superior con acciones */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${GRAY2}`, background: GRAY, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><ImageIcon size={18} color={acento} /> Imagen de {etiqueta.toLowerCase()}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={downloadPNG} disabled={busy} className="oft-btn-press" style={{ ...S.btnRed, padding: "8px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.7 : 1 }}>
              <ImageIcon size={14} /> {busy ? "..." : "Descargar imagen"}
            </button>
            <button onClick={downloadPDF} disabled={busy} className="oft-btn-press" style={{ ...S.btnOutline, padding: "8px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.7 : 1 }}>
              <Download size={14} /> PDF
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}><X size={22} /></button>
          </div>
        </div>

        {/* DOCUMENTO (lo que se exporta) */}
        <div style={{ padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
          <div ref={ref} style={{ background: WHITE, padding: 28, fontFamily: "Helvetica, Arial, sans-serif", color: BLACK }}>
            {/* Encabezado con logo */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${RED}`, paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", fontWeight: 900, fontSize: 26, letterSpacing: -1 }}>
                  <span style={{ color: RED }}>Ofer</span>
                  <span style={{ background: RED, color: WHITE, padding: "0 8px", borderRadius: 4, marginLeft: 2 }}>todo</span>
                </div>
                <div style={{ fontSize: 11, color: GRAY3, marginTop: 6, lineHeight: 1.5 }}>
                  Distribuidora · Panamá<br />
                  WhatsApp: +507 6720-0474<br />
                  Colón, Panamá
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: 20, color: acento, textTransform: "uppercase" }}>{etiqueta}</div>
                {order.num_factura && <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>N° {order.num_factura}</div>}
                <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>{order.codigo}</div>
                <div style={{ fontSize: 11, color: GRAY3, marginTop: 4 }}>{fecha.toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" })}</div>
              </div>
            </div>

            {/* Datos del cliente */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 10, color: GRAY3, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Cliente</div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{order.nombre_cliente || "—"}</div>
                {order.telefono && <div style={{ fontSize: 12, color: GRAY3 }}>{order.telefono}</div>}
                {order.direccion && <div style={{ fontSize: 12, color: GRAY3 }}>{order.direccion}</div>}
              </div>
              {order.empresa_envio_nombre && (
                <div style={{ minWidth: 160, textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: GRAY3, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Envío</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{order.empresa_envio_nombre}</div>
                  {order.sucursal_nombre && <div style={{ fontSize: 12, color: GRAY3 }}>{order.sucursal_nombre}</div>}
                </div>
              )}
            </div>

            {/* Tabla de productos */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
              <thead>
                <tr style={{ background: GRAY }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: GRAY3 }}>Producto</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", fontSize: 11, fontWeight: 700, color: GRAY3 }}>Cant.</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontSize: 11, fontWeight: 700, color: GRAY3 }}>P. Unit</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: GRAY3 }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const prod = products.find(p => p.id === it.producto_id);
                  return (
                    <tr key={it.id || i} style={{ borderBottom: `1px solid ${GRAY2}` }}>
                      <td style={{ padding: "9px 10px", fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {/* Foto chica del producto al lado del nombre (cotización y factura) */}
                          <div style={{ width: 42, height: 42, borderRadius: 6, background: GRAY, overflow: "hidden", flexShrink: 0 }}>
                            {prod?.imagen_url && <img src={prod.imagen_url} alt="" crossOrigin="anonymous" style={{ width: 42, height: 42, objectFit: "cover", display: "block" }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700 }}>{it.nombre_producto}</div>
                            {prod?.referencia && <div style={{ fontSize: 10, color: GRAY3 }}>Ref: {prod.referencia}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", padding: "9px 6px", fontSize: 12 }}>{it.cantidad}</td>
                      <td style={{ textAlign: "right", padding: "9px 6px", fontSize: 12 }}>{money(it.precio_unitario)}</td>
                      <td style={{ textAlign: "right", padding: "9px 10px", fontSize: 12, fontWeight: 700 }}>{money(it.subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <div style={{ minWidth: 240 }}>
                {costoEnvio > 0 && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", fontSize: 13, color: GRAY3 }}>
                      <span>Subtotal</span><span>{money(subtotal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", fontSize: 13, color: GRAY3 }}>
                      <span>Envío</span><span>+{money(costoEnvio)}</span>
                    </div>
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: RED, color: WHITE, borderRadius: 8, fontWeight: 900, fontSize: 16, marginTop: 4 }}>
                  <span>TOTAL</span><span>{money(total)}</span>
                </div>
                {order.pagado === true && !esCot && (
                  <div style={{ textAlign: "center", marginTop: 6, fontSize: 11, fontWeight: 800, color: "#155724" }}>✓ PAGADO{METODOS_PAGO[order.metodo_pago] ? ` · ${METODOS_PAGO[order.metodo_pago].label}` : ""}</div>
                )}
              </div>
            </div>

            {/* Notas */}
            {order.notas && (
              <div style={{ background: GRAY, borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: GRAY3, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Notas</div>
                <div style={{ fontSize: 12 }}>{order.notas}</div>
              </div>
            )}

            {/* Pie */}
            <div style={{ textAlign: "center", fontSize: 10, color: GRAY3, borderTop: `1px solid ${GRAY2}`, paddingTop: 12 }}>
              {esCot
                ? "Esta cotización es válida por 7 días. Los precios pueden variar según disponibilidad."
                : "¡Gracias por tu compra! El pago se coordina por WhatsApp."}
              <br />Ofertodo · Distribuidora · Panamá
            </div>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}

// ═══════════════════════════════════════════════════════════════
//  CREAR / EDITAR CLIENTE (reutilizable — desde la sección Clientes
//  o directo desde el formulario de Nuevo Pedido/Cotización)
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  AGREGAR MIEMBRO DEL EQUIPO (admin / operador)
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  VERIFICACIÓN EN DOS PASOS (2FA / TOTP) — activar o desactivar
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  CREAR / EDITAR PROVEEDOR
// ═══════════════════════════════════════════════════════════════
function ProveedorFormModal({ proveedor, onClose, onSaved, showToast }) {
  useLockBodyScroll();
  const esEdicion = !!proveedor?.id;
  const [form, setForm] = useState({
    nombre: proveedor?.nombre || "", telefono: proveedor?.telefono || "",
    direccion: proveedor?.direccion || "", notas: proveedor?.notas || "",
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) { showToast("Escribe el nombre del proveedor"); return; }
    setGuardando(true);
    try {
      const datos = { nombre: form.nombre.trim(), telefono: form.telefono.trim(), direccion: form.direccion.trim(), notas: form.notas.trim() };
      if (esEdicion) {
        const fila = await sb.patch("proveedores", proveedor.id, datos);
        onSaved({ ...proveedor, ...(Array.isArray(fila) && fila[0] ? fila[0] : datos) });
        showToast("Proveedor actualizado");
      } else {
        const fila = await sb.post("proveedores", { ...datos, activo: true });
        onSaved(Array.isArray(fila) && fila[0] ? fila[0] : fila);
        showToast("Proveedor creado");
      }
      onClose();
    } catch(e) {
      showToast("Error: " + (e.message || "no se pudo guardar"));
    }
    setGuardando(false);
  };

  return createPortal(
    <div className="oft-overlay" style={S.overlay} onClick={() => !guardando && onClose()}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 420, width: "92%", padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{esEdicion ? "Editar proveedor" : "Nuevo proveedor"}</div>
          <button onClick={() => !guardando && onClose()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>
        <label style={S.label}>Nombre *</label>
        <input style={S.input} placeholder="Nombre del proveedor" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} autoFocus />
        <label style={S.label}>Teléfono / WhatsApp</label>
        <input style={S.input} placeholder="Ej: 6720-0474" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
        <label style={S.label}>Dirección</label>
        <input style={S.input} placeholder="Opcional" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
        <label style={S.label}>Notas</label>
        <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} placeholder="Ej: precio distribuidor, condiciones acordadas..." value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => !guardando && onClose()} disabled={guardando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear proveedor"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

// ═══════════════════════════════════════════════════════════════
//  CREAR / EDITAR GRUPO FLEX PACK
// ═══════════════════════════════════════════════════════════════
function FlexPackGrupoFormModal({ grupo, onClose, onSaved, showToast }) {
  useLockBodyScroll();
  const esEdicion = !!grupo?.id;
  const [form, setForm] = useState({
    nombre: grupo?.nombre || "", activo: grupo?.activo ?? true,
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) { showToast("Escribe el nombre del grupo"); return; }
    setGuardando(true);
    try {
      const datos = { nombre: form.nombre.trim(), activo: form.activo };
      if (esEdicion) {
        const fila = await sb.patch("flexpack_grupos", grupo.id, datos);
        onSaved({ ...grupo, ...(Array.isArray(fila) && fila[0] ? fila[0] : datos) });
        showToast("Grupo actualizado");
      } else {
        const fila = await sb.post("flexpack_grupos", datos);
        onSaved(Array.isArray(fila) && fila[0] ? fila[0] : fila);
        showToast("Grupo creado");
      }
      onClose();
    } catch(e) {
      showToast("Error: " + (e.message || "no se pudo guardar"));
    }
    setGuardando(false);
  };

  return createPortal(
    <div className="oft-overlay" style={S.overlay} onClick={() => !guardando && onClose()}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 420, width: "92%", padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{esEdicion ? "Editar grupo Flex Pack" : "Nuevo grupo Flex Pack"}</div>
          <button onClick={() => !guardando && onClose()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>
        <label style={S.label}>Nombre *</label>
        <input style={S.input} placeholder="Ej: Perfumes Premium" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} autoFocus />
        <p style={{ fontSize: 12, color: GRAY3, marginTop: 4, lineHeight: 1.4 }}>
          No hace falta poner precio aquí — cuando el cliente arme un Flex Pack, se usa automáticamente el precio de 3/6 piezas (o media docena/docena) que ya tiene cada producto que asignes a este grupo.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Grupo activo (visible para clientes)</span>
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={() => !guardando && onClose()} disabled={guardando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear grupo"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

// ═══════════════════════════════════════════════════════════════
//  CREAR / EDITAR LOCAL DE RETIRO
// ═══════════════════════════════════════════════════════════════
function LocalRetiroFormModal({ local, onClose, onSaved, showToast }) {
  useLockBodyScroll();
  const esEdicion = !!local?.id;
  const [form, setForm] = useState({
    nombre: local?.nombre || "", direccion: local?.direccion || "", telefono: local?.telefono || "",
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) { showToast("Escribe el nombre del local"); return; }
    setGuardando(true);
    try {
      const datos = { nombre: form.nombre.trim(), direccion: form.direccion.trim(), telefono: form.telefono.trim() };
      if (esEdicion) {
        const fila = await sb.patch("locales_retiro", local.id, datos);
        onSaved({ ...local, ...(Array.isArray(fila) && fila[0] ? fila[0] : datos) });
        showToast("Local actualizado");
      } else {
        const fila = await sb.post("locales_retiro", { ...datos, activo: true });
        onSaved(Array.isArray(fila) && fila[0] ? fila[0] : fila);
        showToast("Local creado");
      }
      onClose();
    } catch(e) {
      showToast("Error: " + (e.message || "no se pudo guardar"));
    }
    setGuardando(false);
  };

  return createPortal(
    <div className="oft-overlay" style={S.overlay} onClick={() => !guardando && onClose()}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 420, width: "92%", padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{esEdicion ? "Editar local" : "Nuevo local de retiro"}</div>
          <button onClick={() => !guardando && onClose()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>
        <label style={S.label}>Nombre *</label>
        <input style={S.input} placeholder="Ej: Local Colón Centro" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} autoFocus />
        <label style={S.label}>Dirección</label>
        <input style={S.input} placeholder="Dirección exacta del local" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
        <label style={S.label}>Teléfono</label>
        <input style={S.input} placeholder="Ej: 6720-0474" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => !guardando && onClose()} disabled={guardando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear local"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

function MfaSetupModal({ onClose }) {
  useLockBodyScroll();
  const { showToast, user, setUser } = useApp();
  const [cargando, setCargando] = useState(true);
  const [factor, setFactor] = useState(null); // factor verificado existente, o null
  const [enrolando, setEnrolando] = useState(null); // { factorId, qr, secret } mientras se activa
  const [codigo, setCodigo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const factores = await sb.mfaListFactors();
        const verificado = factores.find(f => f.status === "verified");
        setFactor(verificado || null);
      } catch(e) {}
      setCargando(false);
    })();
  }, []);

  const activar = async () => {
    setGuardando(true);
    try {
      const r = await sb.mfaEnroll();
      if (r.error || !r.id) { showToast("Error: " + (r.error?.message || r.message || "no se pudo iniciar la activación")); setGuardando(false); return; }
      setEnrolando({ factorId: r.id, qr: r.totp?.qr_code || "", secret: r.totp?.secret || "" });
    } catch(e) { showToast("Error de conexión"); }
    setGuardando(false);
  };

  const confirmarCodigo = async () => {
    if (codigo.trim().length < 6) { showToast("Escribe el código de 6 dígitos"); return; }
    setGuardando(true);
    try {
      const ch = await sb.mfaChallenge(enrolando.factorId);
      if (!ch.id) { showToast("Error: " + (ch.error?.message || "no se pudo generar el reto")); setGuardando(false); return; }
      const v = await sb.mfaVerify(enrolando.factorId, ch.id, codigo.trim());
      if (v.error || !v.access_token) {
        showToast("Código incorrecto, intenta de nuevo");
        setGuardando(false);
        return;
      }
      // La verificación devuelve una sesión nueva (ya con el 2do factor confirmado) — la activamos
      sb.setSession(v);
      const nuevoUser = { ...user, token: v.access_token, refresh_token: v.refresh_token, expires_at: sb.session?.expires_at };
      setUser(nuevoUser);
      setFactor({ id: enrolando.factorId, status: "verified" });
      setEnrolando(null);
      setCodigo("");
      showToast("¡Verificación en dos pasos activada!");
    } catch(e) { showToast("Error de conexión"); }
    setGuardando(false);
  };

  const quitar = async () => {
    setGuardando(true);
    try {
      await sb.mfaUnenroll(factor.id);
      setFactor(null);
      setConfirmarQuitar(false);
      showToast("Verificación en dos pasos desactivada");
    } catch(e) { showToast("Error al desactivar"); }
    setGuardando(false);
  };

  return createPortal(
    <div className="oft-overlay" style={S.overlay} onClick={() => !guardando && onClose()}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 420, width: "92%", padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><Lock size={18} color={RED} /> Verificación en dos pasos</div>
          <button onClick={() => !guardando && onClose()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>

        {cargando ? <Spinner /> : enrolando ? (
          <>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 14 }}>
              Escanea este código con Google Authenticator, Authy, o cualquier app similar en tu celular.
            </p>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 12, padding: 16, display: "flex", justifyContent: "center", marginBottom: 14 }}>
              {enrolando.qr && enrolando.qr.trim().startsWith("<svg")
                ? <div style={{ width: 180, height: 180 }} dangerouslySetInnerHTML={{ __html: enrolando.qr }} />
                : <img src={enrolando.qr} alt="Código QR" style={{ width: 180, height: 180 }} />
              }
            </div>
            {enrolando.secret && (
              <div style={{ fontSize: 11, color: GRAY3, textAlign: "center", marginBottom: 14 }}>
                ¿No puedes escanear? Ingresa este código manual:<br />
                <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: BLACK, letterSpacing: 1 }}>{enrolando.secret}</span>
              </div>
            )}
            <label style={S.label}>Código de 6 dígitos de la app</label>
            <input style={{ ...S.input, textAlign: "center", fontSize: 20, letterSpacing: 4, fontWeight: 800 }} maxLength={6} inputMode="numeric" placeholder="000000" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ""))} autoFocus />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={() => { setEnrolando(null); setCodigo(""); }} disabled={guardando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button onClick={confirmarCodigo} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
                {guardando ? "Verificando..." : "Confirmar"}
              </button>
            </div>
          </>
        ) : factor ? (
          <>
            <div style={{ background: "#EAF7EF", border: "1.5px solid #1FA64A", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <CheckCircle2 size={20} color="#1FA64A" />
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1FA64A" }}>Activada — tu cuenta pide un código extra al iniciar sesión</div>
            </div>
            {!confirmarQuitar ? (
              <button onClick={() => setConfirmarQuitar(true)} className="oft-btn-press" style={{ ...S.btnOutline, width: "100%", justifyContent: "center", color: RED, borderColor: RED }}>
                Desactivar verificación en dos pasos
              </button>
            ) : (
              <>
                <p style={{ fontSize: 13, color: GRAY3, marginBottom: 14 }}>¿Seguro? Tu cuenta quedará protegida solo con la contraseña.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setConfirmarQuitar(false)} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                  <button onClick={quitar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
                    {guardando ? "..." : "Sí, desactivar"}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>
              Agrega una capa extra de seguridad: además de tu contraseña, vas a necesitar un código de 6 dígitos generado por una app en tu celular (Google Authenticator, Authy, etc.) cada vez que inicies sesión.
            </p>
            <button onClick={activar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, width: "100%", justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
              {guardando ? "Iniciando..." : "Activar verificación en dos pasos"}
            </button>
          </>
        )}
      </div>
    </div>
  , document.body);
}

// ═══════════════════════════════════════════════════════════════
//  AGREGAR MIEMBRO DEL EQUIPO (admin / operador)
// ═══════════════════════════════════════════════════════════════
function EquipoFormModal({ onClose, onSaved, showToast }) {
  useLockBodyScroll();
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", password: "", rol: "operador" });
  const [guardando, setGuardando] = useState(false);
  const [verPass, setVerPass] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) { showToast("Escribe el nombre"); return; }
    if (!form.email.trim()) { showToast("Escribe el correo"); return; }
    if (form.password.length < 6) { showToast("La contraseña debe tener al menos 6 caracteres"); return; }
    setGuardando(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/crear-usuario-equipo`, {
        method: "POST",
        headers: sb.functionHeaders(),
        body: JSON.stringify({
          nombre: form.nombre.trim(), email: form.email.trim(), telefono: form.telefono.trim(),
          password: form.password, rol: form.rol,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        showToast("Error: " + (data.error || "no se pudo crear"));
      } else {
        onSaved(data.usuario);
        showToast(`${form.rol === "admin" ? "Administrador" : "Operador"} agregado al equipo`);
        onClose();
      }
    } catch(e) {
      showToast("Error de conexión al crear el usuario");
    }
    setGuardando(false);
  };

  return createPortal(
    <div className="oft-overlay" style={S.overlay} onClick={() => !guardando && onClose()}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 440, width: "92%", padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><Lock size={18} color={RED} /> Agregar al equipo</div>
          <button onClick={() => !guardando && onClose()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>

        <label style={S.label}>Nombre *</label>
        <input style={S.input} placeholder="Nombre completo" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} autoFocus />
        <label style={S.label}>Correo *</label>
        <input style={S.input} type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <label style={S.label}>WhatsApp / Teléfono</label>
        <input style={S.input} placeholder="Ej: 6720-0474" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
        <label style={S.label}>Contraseña temporal *</label>
        <div style={{ position: "relative" }}>
          <input style={{ ...S.input, paddingRight: 40 }} type={verPass ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <button type="button" onClick={() => setVerPass(v => !v)} style={{ position: "absolute", right: 10, top: 12, background: "none", border: "none", cursor: "pointer", display: "flex", color: GRAY3 }}>
            {verPass ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <label style={S.label}>Función</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["admin", "Administrador", "Módulo completo"], ["operador", "Operador", "Acceso limitado"]].map(([val, label, sub]) => (
            <button
              key={val} type="button" onClick={() => setForm({ ...form, rol: val })}
              className="oft-btn-press"
              style={{ flex: 1, textAlign: "left", padding: "10px 12px", borderRadius: 10, border: `2px solid ${form.rol === val ? RED : GRAY2}`, background: form.rol === val ? "#FFF5F5" : WHITE, cursor: "pointer" }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: form.rol === val ? RED : BLACK }}>{label}</div>
              <div style={{ fontSize: 11, color: GRAY3 }}>{sub}</div>
            </button>
          ))}
        </div>

        {form.rol === "operador" && (
          <div style={{ background: GRAY, borderRadius: 10, padding: 12, fontSize: 12, color: GRAY3, marginBottom: 16 }}>
            El operador podrá ver: Inicio (ventas del día, pedidos y cotizaciones recientes), Pedidos, Crear pedido/cotización, Retornos, y Clientes (solo crear, no editar). No verá Productos, Categorías, Descuentos, Análisis de Stock, Envíos ni Equipo.
          </div>
        )}

        <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, width: "100%", justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
          {guardando ? "Creando..." : "Crear cuenta"}
        </button>
      </div>
    </div>
  , document.body);
}

// Para cuando alguien YA tiene una cuenta de cliente y se le quiere dar acceso
// al panel de admin, sin intentar crear una cuenta nueva con el mismo correo
// (eso falla, porque el correo ya está en uso).
// Campo chico y opcional para anotar quién va a recoger un pedido de retiro en
// local -- útil cuando no es la misma persona que hizo la compra. Se guarda al
// salir del campo (onBlur), no hace falta un botón aparte.
function CampoQuienRecoge({ order, onGuardar }) {
  const [valor, setValor] = useState(order.retiro_nombre_autorizado || "");
  return (
    <div style={{ marginTop: 6 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: "#856404", display: "block", marginBottom: 3 }}>¿Quién lo recoge? (opcional)</label>
      <input
        value={valor}
        onChange={e => setValor(e.target.value)}
        onBlur={() => { if (valor.trim() !== (order.retiro_nombre_autorizado || "")) onGuardar(order.id, valor.trim()); }}
        placeholder="Nombre de la persona autorizada..."
        style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: "1.5px solid #F5D68E", fontSize: 12.5, fontFamily: "inherit", background: WHITE }}
      />
    </div>
  );
}


function PromoverClienteModal({ onClose, onSaved, showToast, users }) {
  useLockBodyScroll();
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const [rol, setRol] = useState("operador");
  const [guardando, setGuardando] = useState(false);

  const coincidencias = busqueda.trim().length >= 2
    ? users.filter(u => !u.es_admin && (
        (u.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(busqueda.toLowerCase())
      )).slice(0, 6)
    : [];

  const guardar = async () => {
    if (!seleccionado) { showToast("Busca y elige una cuenta primero"); return; }
    setGuardando(true);
    try {
      await sb.patch("usuarios", seleccionado.id, { es_admin: true, rol });
      onSaved({ ...seleccionado, es_admin: true, rol });
      showToast(`${seleccionado.nombre} ahora es ${rol === "admin" ? "Administrador" : "Operador"}`);
      onClose();
    } catch(e) {
      showToast("Error: " + (e.message || "no se pudo actualizar"));
    }
    setGuardando(false);
  };

  return createPortal(
    <div className="oft-overlay" style={S.overlay} onClick={() => !guardando && onClose()}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 440, width: "92%", padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><Users size={18} color={RED} /> Promover cliente existente</div>
          <button onClick={() => !guardando && onClose()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>
        <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>Para cuando alguien ya tiene cuenta de cliente y quieres darle acceso al panel, sin crear una cuenta nueva.</p>

        {!seleccionado ? (
          <>
            <label style={S.label}>Busca por nombre o correo</label>
            <input style={{ ...S.input, marginBottom: 0 }} placeholder="Escribe para buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus />
            {coincidencias.length > 0 && (
              <div style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, marginTop: 8, marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
                {coincidencias.map(u => (
                  <div key={u.id} onClick={() => setSeleccionado(u)} className="oft-btn-press"
                    style={{ padding: "10px 12px", cursor: "pointer", fontSize: 13, borderBottom: `1px solid ${GRAY}` }}>
                    <div style={{ fontWeight: 700 }}>{u.nombre}</div>
                    <div style={{ fontSize: 11, color: GRAY3 }}>{u.email}</div>
                  </div>
                ))}
              </div>
            )}
            {busqueda.trim().length >= 2 && coincidencias.length === 0 && (
              <p style={{ fontSize: 12, color: GRAY3, marginTop: 8, marginBottom: 16 }}>No se encontró ninguna cuenta de cliente con eso (recuerda: solo busca entre quienes ya tienen cuenta creada).</p>
            )}
          </>
        ) : (
          <>
            <div style={{ background: GRAY, borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seleccionado.nombre}</div>
                <div style={{ fontSize: 12, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seleccionado.email}</div>
              </div>
              <button onClick={() => setSeleccionado(null)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Cambiar</button>
            </div>
            <label style={S.label}>Función</label>
            <select style={S.input} value={rol} onChange={e => setRol(e.target.value)}>
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </>
        )}

        <button onClick={guardar} disabled={guardando || !seleccionado} className="oft-btn-press" style={{ ...S.btnRed, width: "100%", justifyContent: "center", marginTop: 8, opacity: (guardando || !seleccionado) ? 0.6 : 1 }}>
          {guardando ? "Guardando..." : "Agregar al equipo"}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════
//  CREAR / EDITAR CLIENTE (reutilizable — desde la sección Clientes
//  o directo desde el formulario de Nuevo Pedido/Cotización)
// ═══════════════════════════════════════════════════════════════
// Selector con b\xfasqueda: en vez de desplazarse por una lista larga (ej. muchos
// proveedores o categor\xedas), el admin escribe parte del nombre y la lista se
// filtra sola. Dale clic afuera para cerrarlo sin elegir nada.
function SelectBuscable({ opciones, valor, valorTodos, onChange, placeholder, etiquetaTodos }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const ref = useRef(null);

  const opcionActual = valor === valorTodos ? null : opciones.find(o => String(o.id) === String(valor));
  const textoAMostrar = abierto ? texto : (opcionActual ? opcionActual.nombre : etiquetaTodos);

  const filtradas = texto.trim()
    ? opciones.filter(o => o.nombre.toLowerCase().includes(texto.trim().toLowerCase()))
    : opciones;

  useEffect(() => {
    const cerrarAlClickFuera = (e) => { if (ref.current && !ref.current.contains(e.target)) { setAbierto(false); setTexto(""); } };
    document.addEventListener("mousedown", cerrarAlClickFuera);
    return () => document.removeEventListener("mousedown", cerrarAlClickFuera);
  }, []);

  const elegir = (id) => { onChange(id); setAbierto(false); setTexto(""); };

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 160 }}>
      <input
        value={textoAMostrar}
        onFocus={() => { setAbierto(true); setTexto(""); }}
        onChange={e => setTexto(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${GRAY2}`, fontSize: 12.5, fontWeight: 700, background: WHITE, boxSizing: "border-box" }}
      />
      {abierto && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: "auto", zIndex: 20, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
          <div onClick={() => elegir(valorTodos)} style={{ padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: GRAY3, borderBottom: `1px solid ${GRAY2}` }}>{etiquetaTodos}</div>
          {filtradas.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 12, color: GRAY3 }}>Sin resultados</div>
          ) : filtradas.map(o => (
            <div key={o.id} onClick={() => elegir(String(o.id))} className="oft-btn-press" style={{ padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{o.nombre}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function StockRankingModal({ tipo, items, itemsSinFiltroNiLimite, proveedores, proveedorIdInicial, categories, onClose }) {
  useLockBodyScroll();
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const config = {
    reponer: { title: "Reponer pronto", accent: "#856404" },
    rotacion: { title: "Mejor rotación", accent: RED },
    ingreso: { title: "Más ingreso generado", accent: RED },
    zona: { title: "Ventas por zona", accent: RED },
  }[tipo];

  // Solo para "reponer": selector de proveedor DENTRO del modal (independiente del
  // filtro con el que se haya abierto), para poder cambiar de proveedor sin cerrar
  // y volver a abrir, y descargar la lista completa (no solo los primeros 50).
  const esReponer = tipo === "reponer";
  const [proveedorFiltroModal, setProveedorFiltroModal] = useState(proveedorIdInicial || "todos");
  // Filtro por categoría -- útil, por ejemplo, para Perfumería, donde una misma
  // referencia a veces se compra de más de un proveedor: filtrando solo por
  // categoría se ve todo lo de esa línea junto, sin importar a quién se le compró.
  const [categoriaFiltroModal, setCategoriaFiltroModal] = useState("todas");
  const listaReponerFiltrada = esReponer
    ? itemsSinFiltroNiLimite.filter(f =>
        (proveedorFiltroModal === "todos" || f.prod?.proveedor_id === Number(proveedorFiltroModal)) &&
        (categoriaFiltroModal === "todas" || f.prod?.categoria_id === Number(categoriaFiltroModal))
      )
    : [];
  const itemsAMostrar = esReponer ? listaReponerFiltrada : items;

  const descargarCSV = () => {
    const filas = [
      ["Referencia", "Producto", "Categoría", "Proveedor", "Stock actual", "Días para reponer", "Cantidad sugerida a comprar"],
      ...listaReponerFiltrada.map(f => {
        const nombreProveedor = proveedores.find(p => p.id === f.prod?.proveedor_id)?.nombre || "Sin proveedor";
        const nombreCategoria = categories.find(c => c.id === f.prod?.categoria_id)?.nombre || "Sin categoría";
        return [f.prod?.referencia || "", f.prod?.nombre || "", nombreCategoria, nombreProveedor, f.stockActual ?? "", f.diasParaReponer, f.sugerenciaCompra];
      }),
    ];
    const csv = filas.map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const sufijoProveedor = proveedorFiltroModal === "todos" ? "todos_los_proveedores" : (proveedores.find(p => p.id === Number(proveedorFiltroModal))?.nombre || "proveedor").replace(/\s+/g, "_");
    const sufijoCategoria = categoriaFiltroModal === "todas" ? "" : `_${(categories.find(c => c.id === Number(categoriaFiltroModal))?.nombre || "categoria").replace(/\s+/g, "_")}`;
    a.href = url; a.download = `Reponer_${sufijoProveedor}${sufijoCategoria}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onClick={onClose}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 620, width: "92%", margin: "0 auto", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${GRAY2}`, background: GRAY }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: config.accent }}>{config.title} — {esReponer ? `${listaReponerFiltrada.length} en total` : `Top ${items.length}`}</div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}><X size={22} /></button>
          </div>
          {esReponer && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
              <SelectBuscable
                opciones={proveedores} valor={proveedorFiltroModal} valorTodos="todos"
                onChange={setProveedorFiltroModal} placeholder="Buscar proveedor..." etiquetaTodos="Todos los proveedores"
              />
              <SelectBuscable
                opciones={categories} valor={categoriaFiltroModal} valorTodos="todas"
                onChange={setCategoriaFiltroModal} placeholder="Buscar categoría..." etiquetaTodos="Todas las categorías"
              />
              <button onClick={descargarCSV} disabled={listaReponerFiltrada.length === 0} className="oft-btn-press" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#856404", color: WHITE, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: listaReponerFiltrada.length === 0 ? 0.5 : 1 }}>
                <Download size={14} /> Descargar Excel
              </button>
            </div>
          )}
        </div>
        <div style={{ padding: "6px 18px 18px", maxHeight: "75vh", overflowY: "auto" }}>
          {itemsAMostrar.length === 0 ? (
            <div style={{ textAlign: "center", color: GRAY3, padding: "30px 0", fontSize: 13 }}>
              {esReponer && (proveedorFiltroModal !== "todos" || categoriaFiltroModal !== "todas") ? "No hay productos pendientes de reponer con ese filtro." : "No hay datos suficientes todavía."}
            </div>
          ) : tipo === "zona" ? itemsAMostrar.map((f, i) => (
            <div key={f.area} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < itemsAMostrar.length - 1 ? `1px solid ${GRAY2}` : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: GRAY3, width: 22, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MapPin size={16} color={RED} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.area}</div>
                <div style={{ fontSize: 11, color: GRAY3 }}>{f.pedidos} pedido{f.pedidos === 1 ? "" : "s"}</div>
              </div>
              <div style={{ fontWeight: 900, fontSize: 13, color: RED, flexShrink: 0 }}>{money(f.total)}</div>
            </div>
          )) : itemsAMostrar.map((f, i) => (
            <div key={f.producto_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < itemsAMostrar.length - 1 ? `1px solid ${GRAY2}` : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: GRAY3, width: 22, flexShrink: 0 }}>{i + 1}</div>
              {f.prod.imagen_url ? <img src={f.prod.imagen_url} style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 34, height: 34, borderRadius: 6, background: GRAY, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.prod.nombre}</div>
                <div style={{ fontSize: 11, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tipo === "reponer" && `${f.prod.referencia || "—"} · Stock: ${f.stockActual} uds`}
                  {tipo === "rotacion" && `${f.cantidad} uds en ${f.diasDesdeInicio} días`}
                  {tipo === "ingreso" && (f.margen !== null ? `Margen: ${money(f.margen)}` : "Margen: sin costo cargado")}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {tipo === "reponer" && (
                  <>
                    <div style={{ fontWeight: 900, color: f.diasParaReponer === 0 ? RED : "#856404", fontSize: 13 }}>
                      {f.diasParaReponer === 0 ? "Reponer YA" : `${f.diasParaReponer} día${f.diasParaReponer === 1 ? "" : "s"}`}
                    </div>
                    <div style={{ fontSize: 10, color: GRAY3 }}>Comprar ~{f.sugerenciaCompra} uds</div>
                  </>
                )}
                {tipo === "rotacion" && <div style={{ fontWeight: 900, fontSize: 13, color: RED }}>{f.velocidadDiaria.toFixed(2)}/día</div>}
                {tipo === "ingreso" && <div style={{ fontWeight: 900, fontSize: 13, color: RED }}>{money(f.ingreso)}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  , document.body);
}

// Insignia de una cotización: "Cotización" normal o "Reserva" (con fecha y aviso si ya venció)
function InsigniaCotizacion({ o }) {
  if (!o.reservada) return <span style={{ background: "#FFF3CD", color: "#856404", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Cotización</span>;
  const fin = o.reserva_vence ? new Date(o.reserva_vence + "T23:59:59") : null;
  const vencida = fin && fin < new Date();
  return (
    <span style={{ background: vencida ? "#FEE2E2" : "#EDE9FE", color: vencida ? "#B91C1C" : "#5B21B6", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      <Lock size={11} /> Reserva{fin ? ` · hasta ${fin.toLocaleDateString()}` : ""}{vencida ? " · VENCIDA" : ""}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  EDITAR COTIZACIÓN
// ═══════════════════════════════════════════════════════════════
function EditCotizacionModal({ cotizacion, empresas, sucursales, onClose, onSaved, showToast }) {
  useLockBodyScroll();
  const { products, campanaActiva } = useApp();
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Líneas editables (a partir de los items guardados)
  const [lineas, setLineas] = useState(() => (cotizacion.items || []).map(it => ({
    id: it.id, producto_id: it.producto_id, nombre: it.nombre_producto,
    cantidad: Number(it.cantidad) || 1, precio: Number(it.precio_unitario) || 0,
    // Este modal no deja editar la presentación (pieza/docena/media) ni la distribución
    // de tallas personalizada -- se guardan tal cual venían, para no perderlas al
    // editar solo la cantidad o el precio de una línea ya existente.
    presentacion: it.presentacion || null, distribucion_tallas: it.distribucion_tallas || null,
    oferta_id: it.oferta_id || null, oferta_unidades: it.oferta_unidades || null,
  })));
  const [cliente, setCliente] = useState({ nombre: cotizacion.nombre_cliente || "", telefono: cotizacion.telefono || "", direccion: cotizacion.direccion || "" });
  const [notas, setNotas] = useState(cotizacion.notas || "");
  const [empresaId, setEmpresaId] = useState(cotizacion.empresa_envio_id || null);
  const [sucursalId, setSucursalId] = useState(cotizacion.sucursal_id || null);
  const [envio, setEnvio] = useState(cotizacion.costo_envio ? String(cotizacion.costo_envio) : "");
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[cotizacion.metodo_pago] ? cotizacion.metodo_pago : ""); // cómo va a pagar el cliente
  const [redondeo, setRedondeo] = useState("no");
  const [guardando, setGuardando] = useState(false);
  const [reservada, setReservada] = useState(!!cotizacion.reservada); // las piezas quedan apartadas (nadie más las puede vender)
  const [reservaVence, setReservaVence] = useState(cotizacion.reserva_vence || "");

  const empresasActivas = empresas.filter(e => e.activa !== false);
  const sucursalesEmpresa = sucursales.filter(s => s.empresa_id === empresaId && s.activa !== false);
  const empresaSel = empresas.find(e => e.id === empresaId);
  const sucursalSel = sucursales.find(s => s.id === sucursalId);

  const setLinea = (idx, campo, val) => setLineas(prev => prev.map((l, i) => i === idx ? { ...l, [campo]: val } : l));
  const quitarLinea = (idx) => setLineas(prev => prev.filter((_, i) => i !== idx));

  // ── Agregar un producto a la cotización ya hecha ──
  const [busqueda, setBusqueda] = useState("");
  const [productoParaElegir, setProductoParaElegir] = useState(null);
  const resultadosBusqueda = busqueda.trim()
    ? products.filter(p => p.activo !== false && (p.nombre + " " + (p.referencia || "")).toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 6)
    : [];
  const agregarProducto = (prod, pres, oferta = null) => {
    const unidades = piezasDePresentacion(prod, pres);
    setLineas(prev => {
      // Si ya está el mismo producto con la misma presentación (y el mismo precio: oferta o normal), suma una unidad más en vez de duplicar la línea
      const i = prev.findIndex(l => l.producto_id === prod.id && l.nueva && l.presentacion === pres && (l.oferta_id || null) === (oferta?.id || null));
      if (i >= 0) return prev.map((l, k) => k === i ? { ...l, cantidad: (Number(l.cantidad) || 0) + unidades } : l);
      return [...prev, { id: null, nueva: true, producto_id: prod.id, nombre: oferta ? `${prod.nombre} (Oferta)` : prod.nombre, cantidad: unidades, precio: oferta ? oferta.precio : presUnitPrice(prod, pres), presentacion: pres, distribucion_tallas: null, oferta_id: oferta?.id || null, oferta_unidades: oferta ? 1 : null }];
    });
    setBusqueda(""); setProductoParaElegir(null);
  };

  // "cantidad" siempre se guarda en PIEZAS (12 para una docena, 6 para media) pero
  // "precio" es el precio de la presentación COMPLETA (ej. $84 la docena), no por
  // pieza suelta -- por eso no se puede multiplicar cantidad × precio directo para
  // docena/media, o el total sale 12 veces más grande de lo que debería.
  // En perfumería la "docena" son 6 piezas y la "media" 3 (igual que al crear la cotización).
  const unidadesPresentacion = (pres, productoId) => {
    const prod = productoId ? products.find(p => p.id === productoId) : null;
    return prod ? piezasDePresentacion(prod, pres) : (pres === "docena" ? 12 : pres === "media" ? 6 : 1);
  };
  const subtotalLinea = (l) => {
    const unidades = unidadesPresentacion(l.presentacion, l.producto_id);
    return (Number(l.precio) || 0) * ((Number(l.cantidad) || 0) / unidades);
  };

  const subtotal = lineas.reduce((s, l) => s + subtotalLinea(l), 0);
  const costoEnvio = Number(envio) || 0;
  const totalReal = subtotal + costoEnvio;
  const totalArriba = Math.ceil(totalReal * 2) / 2;
  const totalAbajo = Math.floor(totalReal * 2) / 2;
  const total = redondeo === "arriba" ? totalArriba : redondeo === "abajo" ? totalAbajo : totalReal;

  const guardar = async () => {
    if (!cliente.nombre.trim()) { showToast("Escribe el nombre del cliente"); return; }
    if (lineas.length === 0) { showToast("La cotización debe tener al menos un producto"); return; }
    if (!metodoPago && !reservada) { showToast("Elige cómo va a pagar el cliente: Yappy, Tarjeta o Transferencia"); return; }
    // Si va a quedar reservada: las piezas no pueden estar ya reservadas por otro cliente
    if (reservada) {
      const antes = {}; // piezas que ESTA reserva ya tenía apartadas (si ya estaba reservada)
      if (cotizacion.reservada) (cotizacion.items || []).forEach(it => { if (it.producto_id) antes[it.producto_id] = (antes[it.producto_id] || 0) + (Number(it.cantidad) || 0); });
      const ahora = {};
      lineas.forEach(l => { if (l.producto_id) ahora[l.producto_id] = (ahora[l.producto_id] || 0) + (Number(l.cantidad) || 0); });
      const conflictos = [];
      for (const id of Object.keys(ahora)) {
        const p = products.find(x => String(x.id) === String(id));
        if (!p || !p.stock_actualizado_at) continue;
        const deOtros = Math.max(0, (Number(p.piezas_reservadas) || 0) - (antes[id] || 0));
        const libres = Math.max(0, Number(p.stock || 0) - deOtros);
        if (ahora[id] > libres) conflictos.push(`• ${p.nombre}: la reserva lleva ${ahora[id]} y solo hay ${libres} sin reservar por otros`);
      }
      if (conflictos.length) { alert("No se puede reservar -- no hay suficientes piezas libres:\n\n" + conflictos.join("\n")); return; }
    }
    setGuardando(true);
    try {
      // 1) Actualiza los datos del pedido
      await sb.patch("pedidos", cotizacion.id, {
        nombre_cliente: cliente.nombre, telefono: cliente.telefono, direccion: cliente.direccion,
        notas, total, costo_envio: costoEnvio, metodo_pago: metodoPago || null,
        reservada, reserva_vence: reservada && reservaVence ? reservaVence : null,
        empresa_envio_id: empresaId, empresa_envio_nombre: empresaSel?.nombre || "",
        sucursal_id: sucursalId, sucursal_nombre: sucursalSel?.nombre || "",
      });
      // 2) Crea los items nuevos y SOLO DESPUÉS borra los viejos: así, si algo falla a medias,
      //    la cotización queda como estaba, y una reserva nunca se "abre" por unos segundos.
      let viejos = [];
      try { viejos = (await sb.get("pedido_items", `?pedido_id=eq.${cotizacion.id}`)) || []; } catch(e) {}
      const nuevosItems = [];
      try {
        for (const l of lineas) {
          const sub = subtotalLinea(l);
          const creado = await sb.post("pedido_items", {
            pedido_id: cotizacion.id, producto_id: l.producto_id, nombre_producto: l.nombre,
            cantidad: Number(l.cantidad) || 0, precio_unitario: Number(l.precio) || 0, subtotal: sub,
            presentacion: l.presentacion || null, distribucion_tallas: l.distribucion_tallas || null,
            ...(l.oferta_id ? { oferta_id: l.oferta_id, oferta_unidades: l.nueva ? Math.max(1, Math.round((Number(l.cantidad) || 0) / unidadesPresentacion(l.presentacion, l.producto_id))) : (l.oferta_unidades || 1) } : {}),
          });
          if (Array.isArray(creado) && creado[0]) nuevosItems.push(creado[0]);
        }
      } catch(errItems) {
        for (const c of nuevosItems) { try { if (c.id) await sb.delete("pedido_items", c.id); } catch(e) {} }
        throw errItems;
      }
      for (const v of viejos) { try { if (v.id) await sb.delete("pedido_items", v.id); } catch(e) {} }
      showToast("Cotización actualizada");
      onSaved({ ...cotizacion, reservada, reserva_vence: reservada && reservaVence ? reservaVence : null, metodo_pago: metodoPago || null, nombre_cliente: cliente.nombre, telefono: cliente.telefono, direccion: cliente.direccion, notas, total, costo_envio: costoEnvio, empresa_envio_id: empresaId, empresa_envio_nombre: empresaSel?.nombre || "", sucursal_id: sucursalId, sucursal_nombre: sucursalSel?.nombre || "", items: nuevosItems });
    } catch(e) { showToast("Error al guardar: " + (e.message || "intenta de nuevo")); }
    setGuardando(false);
  };

  return createPortal(
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onClick={() => !guardando && onClose()}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 560, width: "92%", margin: "0 auto", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${GRAY2}`, background: GRAY }}>
          <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><PencilIcon size={17} color={RED} /> Editar cotización {cotizacion.codigo}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>

        <div style={{ padding: 18, maxHeight: "72vh", overflowY: "auto" }}>
          {/* PRODUCTOS */}
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Productos</div>
          {/* Buscador para agregar productos */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input style={{ ...S.input, paddingLeft: 36, marginBottom: 0 }} placeholder="Agregar producto: busca por nombre o referencia..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {resultadosBusqueda.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 10, marginTop: 4, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                {resultadosBusqueda.map(p => (
                  <div key={p.id} onClick={() => setProductoParaElegir(p)} className="oft-cat-chip" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: `1px solid ${GRAY}` }}>
                    {p.imagen_url ? <img src={imagenOptimizada(p.imagen_url, 150)} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: GRAY }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nombre}</div>
                      <div style={{ fontSize: 11, color: GRAY3 }}>{p.referencia || "—"} · Docena ${p.precio_docena}</div>
                    </div>
                    <Plus size={18} color={RED} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {lineas.map((l, idx) => (
              <div key={idx} style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{l.nombre}</div>
                  <button onClick={() => quitarLinea(idx)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: GRAY3, fontWeight: 700 }}>Cantidad (piezas)</label>
                    <input type="number" min="0" value={l.cantidad} onChange={e => setLinea(idx, "cantidad", e.target.value)} style={{ ...S.input, marginBottom: 0 }} />
                    {(l.presentacion === "docena" || l.presentacion === "media") && (
                      <div style={{ fontSize: 10, color: GRAY3, marginTop: 2 }}>
                        = {((Number(l.cantidad) || 0) / unidadesPresentacion(l.presentacion, l.producto_id)).toFixed(2)} {l.presentacion === "docena" ? "docena(s)" : "media(s) docena"}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: GRAY3, fontWeight: 700 }}>
                      Precio {(l.presentacion === "docena" || l.presentacion === "media") ? `x ${l.presentacion === "docena" ? "docena" : "media docena"} $` : "c/u $"}
                    </label>
                    <input type="number" min="0" step="0.01" value={l.precio} onChange={e => setLinea(idx, "precio", e.target.value)} style={{ ...S.input, marginBottom: 0 }} />
                  </div>
                  <div style={{ minWidth: 64, textAlign: "right" }}>
                    <label style={{ fontSize: 11, color: GRAY3, fontWeight: 700, display: "block" }}>Subtotal</label>
                    <span style={{ fontWeight: 800, color: RED }}>{money(subtotalLinea(l))}</span>
                  </div>
                </div>
              </div>
            ))}
            {lineas.length === 0 && <div style={{ textAlign: "center", color: GRAY3, fontSize: 13, padding: "16px 0" }}>Sin productos. Agrega al menos uno o cancela.</div>}
          </div>

          {/* DATOS DEL CLIENTE */}
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Datos del cliente</div>
          <label style={S.label}>Nombre</label>
          <input style={S.input} value={cliente.nombre} onChange={e => setCliente({ ...cliente, nombre: e.target.value })} />
          <label style={S.label}>Teléfono</label>
          <input style={S.input} value={cliente.telefono} onChange={e => setCliente({ ...cliente, telefono: e.target.value })} />
          <label style={S.label}>Dirección</label>
          <input style={S.input} value={cliente.direccion} onChange={e => setCliente({ ...cliente, direccion: e.target.value })} />

          {/* RESERVA */}
          <div style={{ background: reservada ? "#F5F3FF" : GRAY, border: `1.5px solid ${reservada ? "#7C3AED" : GRAY2}`, borderRadius: 12, padding: 12, margin: "4px 0 14px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 14, cursor: "pointer", color: reservada ? "#5B21B6" : BLACK }}>
              <input type="checkbox" checked={reservada} onChange={e => setReservada(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#7C3AED" }} />
              <Lock size={15} /> Reservar estas piezas
            </label>
            <div style={{ fontSize: 12, color: GRAY3, marginTop: 4, lineHeight: 1.45 }}>
              {reservada ? "Quedan apartadas: no se pueden vender ni en la web ni en pedidos manuales hasta que se libere o se convierta en pedido." : "Si lo activas, nadie más podrá vender estas piezas mientras tanto."}
            </div>
            {reservada && (
              <div style={{ marginTop: 8 }}>
                <label style={{ ...S.label, marginTop: 0 }}>Reservada hasta (opcional)</label>
                <input type="date" style={{ ...S.input, marginBottom: 0 }} value={reservaVence} onChange={e => setReservaVence(e.target.value)} />
              </div>
            )}
          </div>

          {/* ENVÍO */}
          <div style={{ fontWeight: 800, fontSize: 14, margin: "8px 0" }}>¿Cómo va a pagar el cliente?{reservada ? " (opcional)" : " *"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            {Object.entries(METODOS_PAGO).map(([k, m]) => (
              <button key={k} type="button" onClick={() => setMetodoPago(k)} className="oft-btn-press"
                style={{ padding: "10px 6px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 13, border: `2px solid ${metodoPago === k ? m.color : (metodoPago ? GRAY2 : RED)}`, background: metodoPago === k ? m.bg : WHITE, color: metodoPago === k ? m.color : BLACK }}>
                {m.label}
              </button>
            ))}
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, margin: "8px 0" }}>Envío</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={S.label}>Empresa</label>
              <select style={S.input} value={empresaId || ""} onChange={e => { setEmpresaId(e.target.value ? Number(e.target.value) : null); setSucursalId(null); }}>
                <option value="">— Ninguna —</option>
                {empresasActivas.map(em => <option key={em.id} value={em.id}>{em.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Sucursal</label>
              <select style={S.input} value={sucursalId || ""} onChange={e => setSucursalId(e.target.value ? Number(e.target.value) : null)} disabled={!empresaId}>
                <option value="">— Ninguna —</option>
                {sucursalesEmpresa.map(su => <option key={su.id} value={su.id}>{su.nombre}</option>)}
              </select>
            </div>
          </div>
          <label style={S.label}>Costo de envío ($)</label>
          <input type="number" min="0" step="0.01" style={S.input} value={envio} onChange={e => setEnvio(e.target.value)} placeholder="0.00" />

          {/* NOTAS */}
          <label style={S.label}>Notas</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={notas} onChange={e => setNotas(e.target.value)} />

          {/* REDONDEO */}
          <label style={S.label}>Redondeo del total</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[["arriba","Arriba ↑"],["abajo","Abajo ↓"],["no","Exacto"]].map(([k,l]) => (
              <button key={k} onClick={() => setRedondeo(k)} className="oft-btn-press"
                style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `2px solid ${redondeo === k ? RED : GRAY2}`, background: redondeo === k ? RED : WHITE, color: redondeo === k ? WHITE : BLACK, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {l}
              </button>
            ))}
          </div>

          {/* RESUMEN */}
          <div style={{ borderTop: `1px solid ${GRAY2}`, paddingTop: 10, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: GRAY3 }}><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {costoEnvio > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: GRAY3 }}><span>Envío</span><span>+{money(costoEnvio)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18, marginTop: 4 }}><span>Total</span><span style={{ color: RED }}>{money(total)}</span></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, padding: "14px 18px", borderTop: `1px solid ${GRAY2}` }}>
          <button onClick={onClose} disabled={guardando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
      {productoParaElegir && (
        <ModalElegirPresentacion producto={productoParaElegir} ofertas={ofertasVigentesDeProducto(campanaActiva, productoParaElegir)} onCerrar={() => setProductoParaElegir(null)} onElegir={(pres, oferta) => agregarProducto(productoParaElegir, pres, oferta || null)} />
      )}
    </div>
  , document.body);
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  ANALÍTICA WEB — visitas, clics en categorías/productos, búsquedas,
//  qué se agrega al carrito, usuarios nuevos, y visitas en vivo.
// ═══════════════════════════════════════════════════════════════

// Número que cuenta hacia arriba con una animación suave al aparecer/cambiar
function NumeroAnimado({ valor }) {
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    let inicio = null;
    let frameId;
    const destino = Number(valor) || 0;
    const paso = (ts) => {
      if (!inicio) inicio = ts;
      const progreso = Math.min((ts - inicio) / 800, 1);
      setMostrado(Math.round(progreso * destino));
      if (progreso < 1) frameId = requestAnimationFrame(paso);
    };
    frameId = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frameId);
  }, [valor]);
  return <>{mostrado.toLocaleString("en-US")}</>;
}

// Etiqueta con flecha (↗/↘) mostrando el cambio % contra el periodo anterior de
// igual duración -- ej. si el rango es "última semana", compara contra la semana previa.
function FlechaDelta({ actual, anterior, tamano = 12 }) {
  if (!anterior && !actual) return null;
  const tamanoIcono = Math.round(tamano * 0.9);
  if (!anterior) return <span className="oft-delta oft-delta-up" style={{ fontSize: tamano }}><ArrowUpRight size={tamanoIcono} strokeWidth={2.75} /> Nuevo</span>;
  const cambio = ((actual - anterior) / anterior) * 100;
  const esPositivo = cambio >= 0;
  const Flecha = esPositivo ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`oft-delta ${esPositivo ? "oft-delta-up" : "oft-delta-down"}`} style={{ fontSize: tamano }}>
      <Flecha size={tamanoIcono} strokeWidth={2.75} /> {Math.abs(Math.round(cambio))}%
    </span>
  );
}

// Tarjeta chica de una métrica (KPI), con ícono, número animado, y su cambio % vs el periodo anterior
function TarjetaKPI({ icono: Icono, valor, valorAnterior, etiqueta, color, delay = 0 }) {
  return (
    <div className="oft-kpi-card" style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 18, animationDelay: `${delay}s` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ background: color + "15", borderRadius: 10, padding: 8, display: "inline-flex" }}><Icono size={20} color={color} strokeWidth={2} /></div>
        <FlechaDelta actual={valor} anterior={valorAnterior} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: BLACK }}><NumeroAnimado valor={valor} /></div>
      <div style={{ fontSize: 12, color: GRAY3, fontWeight: 600 }}>{etiqueta}</div>
    </div>
  );
}

// Barra horizontal animada, para los "Top 8" (categorías, productos, búsquedas...)
function BarraTop({ etiqueta, valor, maximo, color, delay = 0 }) {
  const pct = maximo > 0 ? Math.max((valor / maximo) * 100, 4) : 0;
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etiqueta}</span>
        <span style={{ fontWeight: 800, color, flexShrink: 0 }}>{valor}</span>
      </div>
      <div style={{ height: 7, background: GRAY, borderRadius: 6, overflow: "hidden" }}>
        <div className="oft-analytics-bar" style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 6, animationDelay: `${delay}s` }} />
      </div>
    </div>
  );
}

// Modal para ver la lista completa (sin el límite de 8) de cualquiera de las
// listas de Analítica Web -- misma barra animada, solo que con scroll y todos
// los resultados, uno apareciendo tras otro.
function ListaCompletaModal({ titulo, Icono, color, datos, maximo, onClose }) {
  useLockBodyScroll();
  return createPortal(
    <div className="oft-overlay" style={S.overlay} onClick={onClose}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 480, width: "92%", maxHeight: "78vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: `1px solid ${GRAY2}`, flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><Icono size={18} color={color} /> {titulo}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {datos.map(([nombre, valor], i) => (
            <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maximo} color={color} delay={Math.min(i * 0.025, 0.6)} />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}


// Gráfico de línea con área rellena y tooltip interactivo al pasar el mouse/dedo
function GraficoLineal({ datos, color }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const anchoSvg = 600, altoSvg = 200, pad = 12;

  if (datos.length === 0) return <p style={{ color: GRAY3, fontSize: 13, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>Sin datos en este rango.</p>;

  const max = Math.max(1, ...datos.map(d => d.valor));
  const n = datos.length;
  const stepX = n > 1 ? (anchoSvg - pad * 2) / (n - 1) : 0;
  const puntos = datos.map((d, i) => ({
    x: pad + i * stepX,
    y: altoSvg - pad - (d.valor / max) * (altoSvg - pad * 2),
    ...d,
  }));
  const lineaPath = puntos.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  const areaPath = `${lineaPath} L${puntos[n - 1].x},${altoSvg - pad} L${puntos[0].x},${altoSvg - pad} Z`;
  const idGrad = "gradLinea" + color.replace("#", "");

  const alMoverMouse = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * anchoSvg;
    let idx = 0, distMin = Infinity;
    puntos.forEach((p, i) => { const d = Math.abs(p.x - xRel); if (d < distMin) { distMin = d; idx = i; } });
    setHoverIdx(idx);
  };
  const alTocar = (e) => {
    const t = e.touches?.[0]; if (!t) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = ((t.clientX - rect.left) / rect.width) * anchoSvg;
    let idx = 0, distMin = Infinity;
    puntos.forEach((p, i) => { const d = Math.abs(p.x - xRel); if (d < distMin) { distMin = d; idx = i; } });
    setHoverIdx(idx);
  };

  const activo = hoverIdx !== null ? puntos[hoverIdx] : null;
  const tooltipIzquierda = activo && activo.x > anchoSvg * 0.65;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${anchoSvg} ${altoSvg}`} style={{ width: "100%", height: 220, display: "block", touchAction: "none" }}
        onMouseMove={alMoverMouse} onMouseLeave={() => setHoverIdx(null)} onTouchMove={alTocar} onTouchEnd={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${idGrad})`} className="oft-linechart-area" />
        <path d={lineaPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="oft-linechart-line" />
        {activo && (
          <>
            <line x1={activo.x} y1={0} x2={activo.x} y2={altoSvg - pad} stroke={GRAY2} strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={activo.x} cy={activo.y} r="5" fill={color} stroke={WHITE} strokeWidth="2" />
          </>
        )}
      </svg>
      {activo && (
        <div style={{
          position: "absolute", top: 4, pointerEvents: "none", zIndex: 5,
          left: tooltipIzquierda ? "auto" : `${(activo.x / anchoSvg) * 100}%`,
          right: tooltipIzquierda ? `${100 - (activo.x / anchoSvg) * 100}%` : "auto",
          transform: tooltipIzquierda ? "translateX(-8px)" : "translateX(8px)",
          background: BLACK, color: WHITE, padding: "8px 12px", borderRadius: 8, fontSize: 12, whiteSpace: "nowrap",
        }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{activo.valor.toLocaleString("en-US")}</div>
          <div style={{ color: "rgba(255,255,255,0.7)" }}>{new Date(activo.dia + "T00:00:00").toLocaleDateString("es-PA", { day: "2-digit", month: "short" })}</div>
        </div>
      )}
    </div>
  );
}

// Widget grande: número animado + delta + su propio gráfico de línea
function WidgetGrande({ titulo, valor, valorAnterior, color, datos, icono: Icono }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 16, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><Icono size={15} color={color} /> {titulo}</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 34, fontWeight: 900 }}><NumeroAnimado valor={valor} /></div>
        <FlechaDelta actual={valor} anterior={valorAnterior} tamano={13} />
        <span style={{ fontSize: 12, color: GRAY3 }}>vs. periodo anterior</span>
      </div>
      <GraficoLineal datos={datos} color={color} />
    </div>
  );
}

// Selector de rango de fechas, mismo estilo visual del Dashboard (Día/Semana/Mes/Año/Todo + personalizado)
function SelectorRangoAnalytics({ rangoTipo, setRangoTipo, rangoInicioP, setRangoInicioP, rangoFinP, setRangoFinP }) {
  const [mostrarPersonalizado, setMostrarPersonalizado] = useState(false);
  const hoyISO = fechaPanama();
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[["dia", "Hoy"], ["semana", "Semana"], ["mes", "Mes"], ["anio", "Año"], ["todo", "Todo"]].map(([k, l]) => (
          <button key={k} onClick={() => { setRangoTipo(k); setMostrarPersonalizado(false); }} className="oft-btn-press"
            style={{ padding: "8px 16px", borderRadius: 20, border: `2px solid ${rangoTipo === k ? RED : GRAY2}`, background: rangoTipo === k ? RED : WHITE, color: rangoTipo === k ? WHITE : BLACK, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {l}
          </button>
        ))}
        <button onClick={() => setMostrarPersonalizado(v => !v)} className="oft-btn-press"
          style={{ padding: "8px 14px", borderRadius: 20, border: `2px solid ${rangoTipo === "personalizado" ? RED : GRAY2}`, background: rangoTipo === "personalizado" ? RED : WHITE, color: rangoTipo === "personalizado" ? WHITE : BLACK, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <CalendarIcon size={15} /> Personalizado
        </button>
      </div>
      {mostrarPersonalizado && (
        <div className="oft-cal-pop" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <input type="date" value={rangoInicioP} max={rangoFinP || hoyISO} onChange={e => { setRangoInicioP(e.target.value); setRangoTipo("personalizado"); }} style={{ ...S.input, marginBottom: 0, width: 150, fontSize: 13 }} />
          <span style={{ color: GRAY3, fontSize: 13 }}>a</span>
          <input type="date" value={rangoFinP} min={rangoInicioP} max={hoyISO} onChange={e => { setRangoFinP(e.target.value); setRangoTipo("personalizado"); }} style={{ ...S.input, marginBottom: 0, width: 150, fontSize: 13 }} />
        </div>
      )}
    </div>
  );
}

// Campo chico para ajustar el % de comisión de los operadores, directo desde
// la tabla de Analítica -- se guarda en la misma tabla de configuración general.
// Correo donde llegan las alertas automáticas de "hay que reponer" (una vez al día,
// solo si hay algo urgente), y un botón para probarlo al momento sin esperar al cron.
// Panel para generar una guía/etiqueta suelta, SIN necesitar un pedido real de por
// medio -- para cuando hay que enviarle algo a un cliente que no es una venta (una
// devolución, un cambio, un regalo, etc.). Reutiliza el mismo ShippingLabelModal de
// siempre, así la guía y la etiqueta de rollo salen idénticas a las de un pedido real.
function CrearEtiquetaPanel({ empresas, sucursales, showToast }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState("sucursal"); // sucursal | puerta
  const [empresaId, setEmpresaId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contenido, setContenido] = useState("");
  const [pagado, setPagado] = useState(false);
  const [etiquetaGenerada, setEtiquetaGenerada] = useState(null);

  const sucursalesDeEmpresa = sucursales.filter(s => s.empresa_id === Number(empresaId));

  const limpiar = () => {
    setNombre(""); setTelefono(""); setTipoEntrega("sucursal"); setEmpresaId(""); setSucursalId("");
    setDireccion(""); setContenido(""); setPagado(false);
  };

  const generar = () => {
    if (!nombre.trim()) { showToast("Escribe el nombre del destinatario"); return; }
    if (tipoEntrega === "puerta" && !direccion.trim()) { showToast("Escribe la dirección de entrega"); return; }
    if (tipoEntrega === "sucursal" && !sucursalId) { showToast("Elige la sucursal"); return; }
    const empresa = empresas.find(e => e.id === Number(empresaId));
    const sucursal = sucursalesDeEmpresa.find(s => s.id === Number(sucursalId));
    // Cada línea del texto se vuelve un renglón del checklist, igual que los
    // productos de un pedido real -- así se ve qué va en el paquete sin necesitar
    // que sea inventario de verdad.
    const items = contenido.split("\n").map(l => l.trim()).filter(Boolean).map((linea, i) => ({
      id: `local-${i}`, nombre_producto: linea, cantidad: 1, producto_id: null,
    }));
    setEtiquetaGenerada({
      id: null, codigo: `ETQ-${Date.now().toString().slice(-6)}`,
      nombre_cliente: nombre.trim(), telefono: telefono.trim(),
      direccion: tipoEntrega === "puerta" ? direccion.trim() : "",
      sucursal_nombre: tipoEntrega === "sucursal" ? (sucursal?.nombre || "") : "",
      empresa_envio_nombre: empresa?.nombre || "",
      retiro_local: false, costo_envio: pagado ? 1 : 0,
      created_at: new Date().toISOString(), items,
    });
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 640 }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}><Printer size={24} color={RED} /> Crear Etiqueta</div>
      <p style={{ fontSize: 13, color: GRAY3, marginBottom: 24 }}>
        Para cuando hay que enviarle algo a un cliente que no es un pedido real del sistema
        (una devolución, un cambio, un regalo, etc.) — genera la misma guía y etiqueta de
        rollo de siempre, sin necesitar un pedido de por medio.
      </p>

      <label style={S.label}>Nombre del destinatario *</label>
      <input style={S.input} placeholder="Nombre completo..." value={nombre} onChange={e => setNombre(e.target.value)} />

      <label style={S.label}>Teléfono (opcional)</label>
      <input style={S.input} placeholder="6000-0000" value={telefono} onChange={e => setTelefono(e.target.value)} />

      <label style={S.label}>¿Cómo se entrega?</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={() => setTipoEntrega("sucursal")} className="oft-btn-press"
          style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${tipoEntrega === "sucursal" ? RED : GRAY2}`, background: tipoEntrega === "sucursal" ? "#FFF5F5" : WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer", color: tipoEntrega === "sucursal" ? RED : BLACK }}>
          Sucursal de envío
        </button>
        <button type="button" onClick={() => setTipoEntrega("puerta")} className="oft-btn-press"
          style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${tipoEntrega === "puerta" ? RED : GRAY2}`, background: tipoEntrega === "puerta" ? "#FFF5F5" : WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer", color: tipoEntrega === "puerta" ? RED : BLACK }}>
          Puerta a puerta
        </button>
      </div>

      <label style={S.label}>Empresa de envío</label>
      <select style={S.input} value={empresaId} onChange={e => { setEmpresaId(e.target.value); setSucursalId(""); }}>
        <option value="">Selecciona...</option>
        {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>

      {tipoEntrega === "sucursal" ? (
        <>
          <label style={S.label}>Sucursal</label>
          <select style={S.input} value={sucursalId} onChange={e => setSucursalId(e.target.value)} disabled={!empresaId}>
            <option value="">{empresaId ? "Selecciona..." : "Primero elige la empresa"}</option>
            {sucursalesDeEmpresa.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </>
      ) : (
        <>
          <label style={S.label}>Dirección de entrega</label>
          <textarea style={{ ...S.input, resize: "vertical" }} rows={2} placeholder="Dirección completa..." value={direccion} onChange={e => setDireccion(e.target.value)} />
        </>
      )}

      <label style={S.label}>¿Qué se envía? (opcional, una línea por artículo)</label>
      <textarea style={{ ...S.input, resize: "vertical" }} rows={3} placeholder={"Ej: Camisa talla M (cambio)\n1 par de zapatos talla 38"} value={contenido} onChange={e => setContenido(e.target.value)} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: GRAY, borderRadius: 10, padding: "10px 14px", marginBottom: 18 }}>
        <input type="checkbox" id="etiqueta_pagada" checked={pagado} onChange={e => setPagado(e.target.checked)} style={{ width: 18, height: 18 }} />
        <label htmlFor="etiqueta_pagada" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>El envío ya está pagado</label>
      </div>

      <button onClick={generar} className="oft-btn-press" style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 14, fontSize: 15 }}>
        <Printer size={17} /> Generar guía / etiqueta
      </button>

      {etiquetaGenerada && (
        <ShippingLabelModal order={etiquetaGenerada} onClose={() => { setEtiquetaGenerada(null); limpiar(); }} />
      )}
    </div>
  );
}


function EditorEmailAlertasReposicion({ showToast }) {
  const [valor, setValor] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    sb.get("configuracion", "?clave=eq.email_alertas_reposicion&limit=1")
      .then(data => { if (data?.[0]?.valor != null) setValor(String(data[0].valor)); })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    if (valor.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())) { showToast("Ese correo no se ve válido"); return; }
    setGuardando(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?clave=eq.email_alertas_reposicion`, {
        method: "PATCH", headers: sb.dataHeaders(), body: JSON.stringify({ valor: valor.trim() }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      showToast("Correo de alertas guardado");
    } catch (e) { showToast("Error al guardar: " + e.message); }
    setGuardando(false);
  };

  const probar = async () => {
    if (!valor.trim()) { showToast("Guarda un correo primero"); return; }
    setProbando(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/enviar-alerta-reposicion`, {
        method: "POST", headers: sb.functionHeaders(), body: JSON.stringify({ prueba: true }),
      });
      const data = await resp.json();
      showToast(data.ok ? `Correo de prueba enviado a ${valor.trim()}` : `No se pudo enviar: ${data.motivo || data.error || "error desconocido"}`);
    } catch (e) { showToast("Error al enviar la prueba: " + e.message); }
    setProbando(false);
  };

  if (cargando) return null;
  return (
    <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><MessageCircle size={16} color="#856404" /> Alertas de reposición por correo</div>
      <p style={{ fontSize: 12, color: GRAY3, marginBottom: 12 }}>Todos los días se revisa "Reponer pronto" — si hay algo urgente, se manda un correo agrupado por proveedor. Si no hay nada, no se envía nada.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="email" value={valor} onChange={e => setValor(e.target.value)} placeholder="tucorreo@gmail.com"
          style={{ flex: 1, minWidth: 200, padding: "8px 10px", borderRadius: 8, border: `1px solid ${GRAY2}`, fontSize: 13 }} />
        <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, padding: "8px 16px", opacity: guardando ? 0.6 : 1 }}>
          {guardando ? "..." : "Guardar"}
        </button>
        <button onClick={probar} disabled={probando} className="oft-btn-press" style={{ ...S.btnOutline, padding: "8px 16px", opacity: probando ? 0.6 : 1 }}>
          {probando ? "Enviando..." : "Enviar prueba ahora"}
        </button>
      </div>
    </div>
  );
}

function EditorComision({ valorActual, onGuardado, showToast }) {
  const [valor, setValor] = useState(valorActual);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setValor(valorActual); }, [valorActual]);

  const guardar = async () => {
    const num = Number(valor);
    if (isNaN(num) || num < 0) { showToast("Pon un número válido (0 o más)"); return; }
    setGuardando(true);
    try {
      const respPatch = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?clave=eq.comision_operador_porcentaje`, {
        method: "PATCH", headers: sb.dataHeaders(), body: JSON.stringify({ valor: num }),
      });
      if (!respPatch.ok) throw new Error(await respPatch.text());
      onGuardado(num);
      showToast("Porcentaje de comisión actualizado");
    } catch (e) { showToast("Error al guardar: " + e.message); }
    setGuardando(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: GRAY3, fontWeight: 700 }}>% comisión por venta:</span>
      <input type="number" step="0.1" min="0" value={valor} onChange={e => setValor(e.target.value)}
        style={{ width: 64, padding: "5px 8px", borderRadius: 8, border: `1px solid ${GRAY2}`, fontSize: 13, textAlign: "center" }} />
      <button onClick={guardar} disabled={guardando} className="oft-btn-press"
        style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: RED, color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.6 : 1 }}>
        {guardando ? "..." : "Guardar"}
      </button>
    </div>
  );
}

function AnalyticsPanel() {
  const { showToast } = useApp();
  const [rangoTipo, setRangoTipo] = useState("semana"); // dia | semana | mes | anio | todo | personalizado
  const [rangoInicioP, setRangoInicioP] = useState("");
  const [rangoFinP, setRangoFinP] = useState("");
  const [eventos, setEventos] = useState([]);
  const [usuariosNuevos, setUsuariosNuevos] = useState([]);
  const [clientesManuales, setClientesManuales] = useState([]);
  const [pedidosPres, setPedidosPres] = useState([]); // pedidos con sus items (para "cómo compran": pieza/media/docena/flexpack)
  const [cotizaciones, setCotizaciones] = useState([]); // cotizaciones creadas en el rango (creadas y/o ya convertidas)
  const [equipoNombres, setEquipoNombres] = useState([]); // cuentas del equipo (admin/operadores), para mostrar nombres
  const [eventosAnterior, setEventosAnterior] = useState([]);
  const [usuariosAnterior, setUsuariosAnterior] = useState([]);
  const [manualesAnterior, setManualesAnterior] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enVivo, setEnVivo] = useState(0);
  const [listaCompletaModal, setListaCompletaModal] = useState(null); // null | { titulo, Icono, color, datos, maximo }
  const [comisionPorcentaje, setComisionPorcentaje] = useState(1); // % que se le paga a cada operador por venta

  // Se carga aparte -- es una configuración general, no depende del rango de fechas elegido
  useEffect(() => {
    sb.get("configuracion", "?clave=eq.comision_operador_porcentaje&limit=1")
      .then(data => { if (data?.[0]?.valor != null) setComisionPorcentaje(Number(data[0].valor)); })
      .catch(() => {});
  }, []);

  // Convierte el tipo de rango elegido (o las fechas personalizadas) en fechas concretas
  const calcularRango = (tipo) => {
    const hoyD = new Date();
    const hastaS = fechaPanama(hoyD);
    if (tipo === "dia") return [hastaS, hastaS];
    if (tipo === "semana") { const d = new Date(hoyD); d.setDate(d.getDate() - 6); return [fechaPanama(d), hastaS]; }
    if (tipo === "mes") { const d = new Date(hoyD.getFullYear(), hoyD.getMonth(), 1); return [fechaPanama(d), hastaS]; }
    if (tipo === "anio") { const d = new Date(hoyD.getFullYear(), 0, 1); return [fechaPanama(d), hastaS]; }
    if (tipo === "todo") return ["2020-01-01", hastaS];
    if (tipo === "personalizado") return [rangoInicioP || hastaS, rangoFinP || hastaS];
    return [hastaS, hastaS];
  };
  const [desde, hasta] = calcularRango(rangoTipo);

  // Calcula el periodo anterior, de la MISMA duración, justo antes de que empiece el actual
  // (ej. si el rango es "última semana", esto da la semana previa a esa)
  const calcularRangoAnterior = () => {
    const diaMs = 24 * 60 * 60 * 1000;
    const desdeD = new Date(desde + "T00:00:00");
    const hastaD = new Date(hasta + "T23:59:59");
    const duracionMs = hastaD - desdeD;
    const hastaAntD = new Date(desdeD.getTime() - diaMs);
    const desdeAntD = new Date(hastaAntD.getTime() - duracionMs);
    return [fechaPanama(desdeAntD), fechaPanama(hastaAntD)];
  };
  const [desdeAnt, hastaAnt] = calcularRangoAnterior();

  // Protege contra respuestas que llegan "fuera de orden" -- si el usuario cambia
  // de filtro rápido (ej. Hoy -> Semana -> Mes), varias peticiones quedan en el
  // aire a la vez. Como "Hoy" trae mucho menos datos, puede responder MÁS RÁPIDO
  // que "Semana" o "Mes" aunque se haya pedido antes -- y sin este control, esa
  // respuesta vieja pero más rápida terminaba pisando a la más nueva pero más
  // lenta, dejando pegados los números de "Hoy" sin importar qué se eligiera.
  // Los eventos vienen ya agrupados desde la base de datos (por dia, visitante, tipo y valor, con
  // el numero de veces "n"), en una sola peticion. Antes se bajaban uno por uno, de 1000 en 1000,
  // y se cortaban en 20.000: en una semana o un mes con mas visitas, los numeros salian incompletos.
  // Aqui cada grupo se vuelve a repetir "n" veces para que el resto de la pantalla cuente igual que siempre.
  const cargarEventosCompactos = async (desdeISO, hastaISO) => {
    // Con "Todo" esta consulta es la más pesada; si la base de datos tarda de más, se reintenta sola.
    const filas = await rpcConReintento("analitica_eventos", { p_desde: desdeISO, p_hasta: hastaISO });
    const out = [];
    for (const f of filas || []) { const n = Number(f.n) || 1; for (let i = 0; i < n; i++) out.push(f); }
    return out;
  };
  const idPeticionRef = useRef(0);
  const cargarDatos = async (silencioso = false) => {
    const miId = ++idPeticionRef.current;
    if (silencioso !== true) setCargando(true);
    try {
      const desdeISO = `${desde}T00:00:00`, hastaISO = `${hasta}T23:59:59`;
      const desdeAntISO = `${desdeAnt}T00:00:00`, hastaAntISO = `${hastaAnt}T23:59:59`;
      // El seguimiento de "cotización → convertida" (es_cotizacion_convertida /
      // fecha_cotizacion_original) empezó a existir el 15 de agosto de 2026 -- las
      // cotizaciones de antes de esa fecha no tienen ese dato guardado, y contarlas
      // infla el número de "creadas" sin poder saber si en verdad se convirtieron,
      // dando una tasa de conversión falsamente baja. Por eso, para ESTA métrica
      // puntual, nunca se busca antes de esa fecha, sin importar el rango elegido.
      const FECHA_INICIO_SEGUIMIENTO_COTIZACIONES = "2026-08-15T17:50:01";
      const desdeCotizacionesISO = desdeISO > FECHA_INICIO_SEGUIMIENTO_COTIZACIONES ? desdeISO : FECHA_INICIO_SEGUIMIENTO_COTIZACIONES;
      const [evts, usrs, manuales, pedItems, cotizacionesData, equipo, evtsAnt, usrsAnt, manualesAnt] = await Promise.all([
        cargarEventosCompactos(desdeISO, hastaISO),
        // Solo cuentas con origen_cuenta='web' -- el cliente se registró solo en la
        // página (o con Google). Excluye las que TÚ creas al hacer un pedido manual,
        // y las que se generan solas al pagar como invitado.
        sb.get("usuarios", `?created_at=gte.${desdeISO}&created_at=lte.${hastaISO}&origen_cuenta=eq.web`),
        sb.get("usuarios", `?created_at=gte.${desdeISO}&created_at=lte.${hastaISO}&origen_cuenta=eq.admin_manual`),
        // Pedidos pagados del rango (excluyendo cotizaciones -- una cotización no es una
        // venta comprometida, mismo criterio que ya usa el Dashboard), con sus items --
        // para "cómo compran", web vs. manuales, y también por operador (creado_por_usuario_id)
        sb.get("pedidos", `?created_at=gte.${desdeISO}&created_at=lte.${hastaISO}&pagado=eq.true&tipo=neq.cotizacion&select=id,total,creado_por_admin,creado_por_usuario_id,pedido_items(cantidad,presentacion)`),
        // Cotizaciones CREADAS en este rango -- incluye tanto las que siguen pendientes
        // (tipo='cotizacion', usa su propio created_at) como las que ya se convirtieron
        // en venta (usa fecha_cotizacion_original, porque su created_at ya se sobreescribió
        // con la fecha en que se confirmó como venta, no la de cuando se creó la cotización).
        // Usa desdeCotizacionesISO (nunca antes del inicio del seguimiento), no desdeISO.
        sb.get("pedidos", `?or=(and(tipo.eq.cotizacion,created_at.gte.${desdeCotizacionesISO},created_at.lte.${hastaISO}),and(es_cotizacion_convertida.eq.true,fecha_cotizacion_original.gte.${desdeCotizacionesISO},fecha_cotizacion_original.lte.${hastaISO}))&select=id,es_cotizacion_convertida,creado_por_usuario_id`),
        // Cuentas del equipo (admin/operadores), para poder mostrar el nombre de cada uno
        sb.get("usuarios", `?or=(rol.not.is.null,es_admin.eq.true)&select=id,nombre`),
        // Mismo trío, pero del periodo anterior -- para calcular el % de cambio.
        // Con "Todo" no existe periodo anterior (empezaría antes de que existiera el negocio): se
        // omite para no hacer tres consultas pesadas que siempre devuelven vacío.
        rangoTipo === "todo" ? Promise.resolve([]) : cargarEventosCompactos(desdeAntISO, hastaAntISO),
        rangoTipo === "todo" ? Promise.resolve([]) : sb.get("usuarios", `?created_at=gte.${desdeAntISO}&created_at=lte.${hastaAntISO}&origen_cuenta=eq.web`),
        rangoTipo === "todo" ? Promise.resolve([]) : sb.get("usuarios", `?created_at=gte.${desdeAntISO}&created_at=lte.${hastaAntISO}&origen_cuenta=eq.admin_manual`),
      ]);
      // Si mientras esperábamos ya se disparó una petición más nueva (otro clic de
      // filtro), esta respuesta quedó vieja -- se descarta en silencio, sin tocar
      // el estado, para no pisar los datos correctos que ya está por mostrar la otra.
      if (miId !== idPeticionRef.current) return;
      setEventos(evts || []); setUsuariosNuevos(usrs || []); setClientesManuales(manuales || []); setPedidosPres(pedItems || []);
      setCotizaciones(cotizacionesData || []); setEquipoNombres(equipo || []);
      setEventosAnterior(evtsAnt || []); setUsuariosAnterior(usrsAnt || []); setManualesAnterior(manualesAnt || []);
    } catch(e) {
      if (miId !== idPeticionRef.current) return;
      console.warn("Error cargando analítica:", e.message);
      // En un refresco automático (silencioso) que falla, se conservan los números que ya se veían
      if (silencioso === true) { if (miId === idPeticionRef.current) setCargando(false); return; }
      setEventos([]); setUsuariosNuevos([]); setClientesManuales([]); setPedidosPres([]); setCotizaciones([]); setEquipoNombres([]);
      setEventosAnterior([]); setUsuariosAnterior([]); setManualesAnterior([]);
    }
    if (miId === idPeticionRef.current) setCargando(false);
  };

  useEffect(() => { cargarDatos(); }, [desde, hasta]);

  // En vivo: cuando entra un pedido, una cotización o un cliente nuevo, los
  // números se actualizan solos (sin el "cargando"), con un respiro de 4
  // segundos para no recargar mil veces si llegan varios seguidos.
  const timerVivoRef = useRef(null);
  useCambiosEnVivo(["pedidos", "usuarios"], () => {
    clearTimeout(timerVivoRef.current);
    timerVivoRef.current = setTimeout(() => cargarDatos(true), 4000);
  });
  // Con "Todo" el cálculo es más pesado: se refresca cada 5 min en vez de cada minuto
  useRefrescoPeriodico(() => cargarDatos(true), rangoTipo === "todo" ? 300000 : 60000);
  useEffect(() => () => clearTimeout(timerVivoRef.current), []);

  // Visitas en vivo: independiente del filtro de fecha. Se refresca cada 5 segundos y
  // también al instante cuando vuelves a esta pestaña del navegador (los navegadores
  // frenan los temporizadores de las pestañas de fondo).
  // Cuenta a cada persona UNA vez según lo último que hizo en los últimos 3 minutos:
  //  · si lo último fue "salida" (cerró o se fue de la página), ya no cuenta -- sale al momento
  //  · tu propio navegador y las pantallas de admin/CRM no cuentan como visitantes
  useEffect(() => {
    let vivo = true;
    const cargarEnVivo = async () => {
      try {
        const haceTresMin = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const recientes = await sb.get("eventos_analytics", `?created_at=gte.${haceTresMin}&tipo=in.(visita,heartbeat,activo,salida)&select=visitante_id,tipo,valor,created_at&order=created_at.asc&limit=1000`);
        const ultimo = {};
        (recientes || []).forEach(r => { ultimo[r.visitante_id] = r; });
        const yo = idVisitante();
        const n = Object.values(ultimo).filter(r => r.visitante_id !== yo && r.tipo !== "salida" && !["admin", "crm"].includes(r.valor)).length;
        if (vivo) setEnVivo(n);
      } catch(e) { /* no es crítico, se reintenta solo */ }
    };
    cargarEnVivo();
    const t = setInterval(cargarEnVivo, 5000);
    const alVolverVisible = () => { if (document.visibilityState === "visible") cargarEnVivo(); };
    document.addEventListener("visibilitychange", alVolverVisible);
    window.addEventListener("focus", alVolverVisible);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolverVisible);
      window.removeEventListener("focus", alVolverVisible);
    };
  }, []);

  // ── Cálculos derivados del periodo ACTUAL ──
  const visitas = eventos.filter(e => e.tipo === "visita");
  const visitantesUnicos = new Set(eventos.map(e => e.visitante_id)).size;
  const visitantesConUsuario = new Set(eventos.filter(e => e.usuario_id).map(e => e.visitante_id));
  const visitantesSinCuenta = [...new Set(eventos.map(e => e.visitante_id))].filter(v => !visitantesConUsuario.has(v)).length;
  const clientesQueAgregaron = new Set(eventos.filter(e => e.tipo === "agregar_carrito").map(e => e.visitante_id)).size;

  // ── Mismos cálculos, pero del periodo ANTERIOR (solo para comparar el %) ──
  const visitasAnt = eventosAnterior.filter(e => e.tipo === "visita").length;
  const visitantesUnicosAnt = new Set(eventosAnterior.map(e => e.visitante_id)).size;
  const visitantesConUsuarioAnt = new Set(eventosAnterior.filter(e => e.usuario_id).map(e => e.visitante_id));
  const visitantesSinCuentaAnt = [...new Set(eventosAnterior.map(e => e.visitante_id))].filter(v => !visitantesConUsuarioAnt.has(v)).length;
  const clientesQueAgregaronAnt = new Set(eventosAnterior.filter(e => e.tipo === "agregar_carrito").map(e => e.visitante_id)).size;

  const topPor = (tipo) => {
    const mapa = {};
    eventos.filter(e => e.tipo === tipo).forEach(e => {
      const clave = e.valor_nombre || "(sin nombre)";
      mapa[clave] = (mapa[clave] || 0) + 1;
    });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]); // sin límite -- se recorta donde se muestra
  };
  // ── ¿Dónde navegan los clientes? (Inicio vs Catálogo vs Ofertas) ──
  // "Vistas" = cuántas veces entraron a esa sección; "visitantes" = cuántas personas distintas;
  // "minutos" = tiempo aproximado (un latido cada 60 s, con la sección donde estaba el cliente).
  const SECCIONES_NAV = [
    { key: "home", nombre: "Inicio", color: "#1D4ED8" },
    { key: "catalogo", nombre: "Catálogo", color: RED },
    { key: "ofertas", nombre: "Ofertas", color: "#B45309" },
  ];
  const latidosConSeccion = eventos.filter(e => e.tipo === "heartbeat" && e.valor && !["admin", "crm"].includes(e.valor));
  const navSecciones = SECCIONES_NAV.map(sec => {
    const vistasSec = eventos.filter(e => e.tipo === "ver_seccion" && e.valor === sec.key);
    return {
      ...sec,
      vistas: vistasSec.length,
      visitantes: new Set(vistasSec.map(e => e.visitante_id)).size,
      minutos: latidosConSeccion.filter(e => e.valor === sec.key).length,
    };
  });
  const minutosOtras = latidosConSeccion.filter(e => !SECCIONES_NAV.some(sec => sec.key === e.valor)).length;
  const navTotalMin = navSecciones.reduce((t, x) => t + x.minutos, 0) + minutosOtras;
  const navTotalVistas = navSecciones.reduce((t, x) => t + x.vistas, 0);
  const navGanadora = navTotalMin > 0
    ? [...navSecciones].sort((a, b) => b.minutos - a.minutos)[0]
    : (navTotalVistas > 0 ? [...navSecciones].sort((a, b) => b.vistas - a.vistas)[0] : null);
  const fmtMin = (m) => m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;

  const topCategoriasFull = topPor("click_categoria");
  const topProductosFull = topPor("click_producto");
  // Distancia de edición (Levenshtein) -- cuántos cambios (agregar, quitar o cambiar
  // una letra) hacen falta para convertir un texto en otro. Sirve para detectar
  // errores de dedo y variantes de singular/plural sin tener que enumerarlas a mano.
  const distanciaEdicion = (a, b) => {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  };

  // Junta búsquedas parecidas (errores de dedo, singular/plural) bajo una sola
  // entrada -- ej. "ropa de muje" y "ropa de mujer" cuentan como la misma. Se
  // queda con el nombre de la variante MÁS buscada como el que se muestra, y
  // suma los conteos de todas las variantes que se le parezcan.
  const unificarSimilares = (lista) => {
    const ordenada = [...lista].sort((a, b) => b[1] - a[1]); // la más buscada primero, para que "gane" el nombre
    const grupos = [];
    for (const [nombre, valor] of ordenada) {
      const grupo = grupos.find(g => {
        const umbral = Math.max(1, Math.floor(Math.max(nombre.length, g.nombre.length) * 0.22));
        return distanciaEdicion(nombre, g.nombre) <= umbral;
      });
      if (grupo) grupo.valor += valor;
      else grupos.push({ nombre, valor });
    }
    return grupos.map(g => [g.nombre, g.valor]).sort((a, b) => b[1] - a[1]);
  };

  // Solo texto -- se descartan las búsquedas que son referencias/SKU con números
  // (ej. "60650", "TH-1049"), porque no aportan nada útil para saber qué palabras
  // busca la gente; esas quedan igual registradas, solo no se muestran aquí.
  const topBusquedasFull = unificarSimilares(topPor("busqueda").filter(([nombre]) => !/\d/.test(nombre)));
  const topCarritoFull = topPor("agregar_carrito");
  const topCategorias = topCategoriasFull.slice(0, 8);
  const topProductos = topProductosFull.slice(0, 8);
  const topBusquedas = topBusquedasFull.slice(0, 8);
  const topCarrito = topCarritoFull.slice(0, 8);
  const maxCat = Math.max(1, ...topCategorias.map(([, v]) => v));
  const maxProd = Math.max(1, ...topProductos.map(([, v]) => v));
  const maxBusq = Math.max(1, ...topBusquedas.map(([, v]) => v));
  const maxCarr = Math.max(1, ...topCarrito.map(([, v]) => v));

  // "Cómo compran": cuenta cuántos PEDIDOS incluyeron cada presentación (pieza /
  // media docena / docena / flexpack), no cuántas líneas de producto -- un mismo
  // FlexPack puede mezclar varios productos en un solo pedido (ej. 10 piezas de un
  // jean + 2 de otro, en la misma docena), y eso debe contar como "1 flexpack", no
  // "2", aunque haya generado 2 líneas de artículo distintas.
  // Los artículos de pedidos de ANTES de este cambio no tienen este dato guardado
  // (presentacion = null) -- esos se excluyen del conteo en vez de adivinar que
  // fueron "pieza", para no inflar esa barra con datos que en realidad no se saben.
  const desglosePresentacion = (() => {
    const mapa = { pieza: 0, media: 0, docena: 0, flexpack: 0 };
    pedidosPres.forEach(pedido => {
      const tiposEnEstePedido = new Set();
      (pedido.pedido_items || []).forEach(item => {
        const key = item.presentacion;
        if (!key) return; // se desconoce -- no se cuenta
        tiposEnEstePedido.add(key.startsWith("flexpack") ? "flexpack" : key);
      });
      tiposEnEstePedido.forEach(tipo => { if (mapa[tipo] !== undefined) mapa[tipo] += 1; });
    });
    return mapa;
  })();
  const topPresentacion = [
    ["Por pieza", desglosePresentacion.pieza],
    ["Media docena", desglosePresentacion.media],
    ["Docena", desglosePresentacion.docena],
    ["FlexPack", desglosePresentacion.flexpack],
  ].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxPres = Math.max(1, ...topPresentacion.map(([, v]) => v));

  // Ventas web (el cliente compró solo) vs. manuales (tú armaste el pedido) --
  // tanto en cantidad de pedidos como en monto total vendido
  const ventasWeb = pedidosPres.filter(p => !p.creado_por_admin);
  const ventasManual = pedidosPres.filter(p => p.creado_por_admin);
  const montoVentasWeb = ventasWeb.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const montoVentasManual = ventasManual.reduce((s, p) => s + (Number(p.total) || 0), 0);

  // "Consultas por WhatsApp" -- de dónde vienen (producto, carrito, inicio, etc.)
  const topWhatsappFull = topPor("consulta_whatsapp");
  const topWhatsapp = topWhatsappFull.slice(0, 8);
  const maxWhatsapp = Math.max(1, ...topWhatsapp.map(([, v]) => v));
  const totalWhatsapp = eventos.filter(e => e.tipo === "consulta_whatsapp").length;
  const totalWhatsappAnt = eventosAnterior.filter(e => e.tipo === "consulta_whatsapp").length;

  // Cotizaciones: cuántas se crearon en el rango, cuántas de esas ya se convirtieron
  // en venta real (sin importar cuándo se convirtieron), y el % de conversión
  const cotizacionesCreadas = cotizaciones.length;
  const cotizacionesConvertidas = cotizaciones.filter(c => c.es_cotizacion_convertida).length;
  const tasaConversion = cotizacionesCreadas > 0 ? (cotizacionesConvertidas / cotizacionesCreadas) * 100 : 0;

  // Análisis por operador/vendedor: cuántas cotizaciones crea cada quien, cuántas
  // ventas genera, y su propia tasa de conversión. Solo cuenta lo que quedó
  // etiquetado con creado_por_usuario_id -- los pedidos de antes de este cambio (o
  // hechos por el cliente solo desde la web) no tienen a quién atribuírselos.
  const numDiasRango = Math.max(1, Math.round((new Date(hasta) - new Date(desde)) / (24 * 60 * 60 * 1000)) + 1);
  const analisisPorOperador = equipoNombres.map(op => {
    const susVentas = pedidosPres.filter(p => p.creado_por_usuario_id === op.id);
    const susCotizaciones = cotizaciones.filter(c => c.creado_por_usuario_id === op.id);
    const susConvertidas = susCotizaciones.filter(c => c.es_cotizacion_convertida).length;
    const montoVentas = susVentas.reduce((s, p) => s + (Number(p.total) || 0), 0);
    return {
      id: op.id, nombre: op.nombre,
      cotizaciones: susCotizaciones.length,
      cotizacionesPorDia: susCotizaciones.length / numDiasRango,
      ventas: susVentas.length, monto: montoVentas,
      comision: montoVentas * (comisionPorcentaje / 100),
      tasaConversion: susCotizaciones.length > 0 ? (susConvertidas / susCotizaciones.length) * 100 : 0,
    };
  }).filter(op => op.cotizaciones > 0 || op.ventas > 0) // solo muestra a quien tuvo actividad en el rango
    .sort((a, b) => b.monto - a.monto);

  // Series diarias para los 2 widgets grandes (visitas, y visitantes únicos)
  const serieDiaria = (tipoDatos) => {
    const mapa = {};
    if (tipoDatos === "visitas") {
      visitas.forEach(v => { const dia = v.created_at.slice(0, 10); mapa[dia] = (mapa[dia] || 0) + 1; });
    } else {
      eventos.forEach(e => {
        const dia = e.created_at.slice(0, 10);
        if (!mapa[dia]) mapa[dia] = new Set();
        mapa[dia].add(e.visitante_id);
      });
      Object.keys(mapa).forEach(dia => { mapa[dia] = mapa[dia].size; });
    }
    return Object.entries(mapa).sort((a, b) => a[0].localeCompare(b[0])).map(([dia, valor]) => ({ dia, valor }));
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Eye size={24} color={RED} /> Analítica Web</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFF0EF", padding: "7px 14px", borderRadius: 100, fontSize: 13, fontWeight: 700, color: "#B01519" }}>
          <span className="oft-live-dot" /> {enVivo} en vivo ahora
        </div>
      </div>

      <SelectorRangoAnalytics rangoTipo={rangoTipo} setRangoTipo={setRangoTipo} rangoInicioP={rangoInicioP} setRangoInicioP={setRangoInicioP} rangoFinP={rangoFinP} setRangoFinP={setRangoFinP} />

      {cargando ? <Spinner /> : (
        <>
          {/* 2 WIDGETS GRANDES CON GRÁFICO DE LÍNEA + COMPARACIÓN WEB VS MANUAL */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginBottom: 24 }}>
            <WidgetGrande titulo="Visitas por día" valor={visitas.length} valorAnterior={visitasAnt} color={RED} icono={Eye} datos={serieDiaria("visitas")} />
            <WidgetGrande titulo="Visitantes únicos por día" valor={visitantesUnicos} valorAnterior={visitantesUnicosAnt} color="#1D4ED8" icono={Users} datos={serieDiaria("visitantes")} />
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 16, padding: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: GRAY3, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
                <ShoppingBag size={15} color={RED} /> Ventas: Web vs. Manuales
              </div>
              {(() => {
                const maxMonto = Math.max(1, montoVentasWeb, montoVentasManual);
                return (
                  <>
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><ShoppingBag size={14} color="#1D4ED8" /> Web</span>
                        <span style={{ fontWeight: 900, fontSize: 15 }}>{ventasWeb.length} <span style={{ fontWeight: 600, fontSize: 12, color: GRAY3 }}>pedidos</span></span>
                      </div>
                      <div style={{ height: 8, background: GRAY, borderRadius: 6, overflow: "hidden", marginBottom: 4 }}>
                        <div className="oft-analytics-bar" style={{ height: "100%", width: `${Math.max((montoVentasWeb / maxMonto) * 100, montoVentasWeb > 0 ? 4 : 0)}%`, background: "#1D4ED8", borderRadius: 6 }} />
                      </div>
                      <div style={{ fontSize: 12, color: GRAY3, fontWeight: 700 }}>${montoVentasWeb.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><FilePlus size={14} color="#5B21B6" /> Manuales</span>
                        <span style={{ fontWeight: 900, fontSize: 15 }}>{ventasManual.length} <span style={{ fontWeight: 600, fontSize: 12, color: GRAY3 }}>pedidos</span></span>
                      </div>
                      <div style={{ height: 8, background: GRAY, borderRadius: 6, overflow: "hidden", marginBottom: 4 }}>
                        <div className="oft-analytics-bar" style={{ height: "100%", width: `${Math.max((montoVentasManual / maxMonto) * 100, montoVentasManual > 0 ? 4 : 0)}%`, background: "#5B21B6", borderRadius: 6 }} />
                      </div>
                      <div style={{ fontSize: 12, color: GRAY3, fontWeight: 700 }}>${montoVentasManual.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 16, padding: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: GRAY3, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={15} color={RED} /> Cotizaciones: creadas y convertidas
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 34, fontWeight: 900 }}><NumeroAnimado valor={Math.round(tasaConversion)} />%</div>
                <span style={{ fontSize: 12, color: GRAY3 }}>tasa de conversión</span>
              </div>
              <div style={{ height: 8, background: GRAY, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
                <div className="oft-analytics-bar" style={{ height: "100%", width: `${Math.max(tasaConversion, cotizacionesConvertidas > 0 ? 4 : 0)}%`, background: "#0F6E56", borderRadius: 6 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{cotizacionesCreadas} <span style={{ color: GRAY3, fontWeight: 600 }}>creadas</span></span>
                <span style={{ fontWeight: 700 }}>{cotizacionesConvertidas} <span style={{ color: GRAY3, fontWeight: 600 }}>convertidas</span></span>
              </div>
              {desde < "2026-08-15" && (
                <p style={{ fontSize: 10.5, color: GRAY3, marginTop: 10, lineHeight: 1.4 }}>
                  Solo cuenta cotizaciones desde el 15 de agosto de 2026, cuando empezó a guardarse si se convirtieron o no — antes de esa fecha no hay ese dato.
                </p>
              )}
            </div>
          </div>

          {/* KPIs chicos, cada uno con su % vs el periodo anterior */}
          <div className="oft-prod-anim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 28 }}>
            <TarjetaKPI icono={User} valor={usuariosNuevos.length} valorAnterior={usuariosAnterior.length} etiqueta="Usuarios nuevos (web)" color="#155724" delay={0} />
            <TarjetaKPI icono={FilePlus} valor={clientesManuales.length} valorAnterior={manualesAnterior.length} etiqueta="Clientes agregados por ti" color="#5B21B6" delay={0.04} />
            <TarjetaKPI icono={EyeOff} valor={visitantesSinCuenta} valorAnterior={visitantesSinCuentaAnt} etiqueta="Visitaron sin cuenta" color={GRAY3} delay={0.08} />
            <TarjetaKPI icono={ShoppingCart} valor={clientesQueAgregaron} valorAnterior={clientesQueAgregaronAnt} etiqueta="Agregaron al carrito" color="#0F6E56" delay={0.12} />
            <TarjetaKPI icono={MessageCircle} valor={totalWhatsapp} valorAnterior={totalWhatsappAnt} etiqueta="Consultas por WhatsApp" color="#25D366" delay={0.16} />
          </div>

          {/* ¿DÓNDE NAVEGAN LOS CLIENTES? */}
          <div className="oft-prod-anim" style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20, marginBottom: 28 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Eye size={17} color={RED} /> ¿Dónde navegan tus clientes?</div>
            {navGanadora ? (
              <p style={{ fontSize: 13, color: GRAY3, margin: "0 0 16px" }}>
                En este rango navegan más en <b style={{ color: navGanadora.color }}>{navGanadora.nombre}</b>
                {navTotalMin > 0 ? <> — {navTotalMin > 0 ? Math.round((navGanadora.minutos / navTotalMin) * 100) : 0}% del tiempo en el sitio.</> : <> — {navGanadora.vistas} visitas a esa sección.</>}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: GRAY3, margin: "0 0 16px" }}>Todavía no hay datos en este rango. Esta medición empezó a guardarse el 10 de octubre de 2026, así que los rangos anteriores no tienen este dato.</p>
            )}
            {navTotalMin > 0 && (
              <div style={{ display: "flex", height: 12, borderRadius: 8, overflow: "hidden", background: GRAY, marginBottom: 6 }}>
                {navSecciones.map(sec => sec.minutos > 0 && <div key={sec.key} title={`${sec.nombre}: ${fmtMin(sec.minutos)}`} style={{ width: `${(sec.minutos / navTotalMin) * 100}%`, background: sec.color }} />)}
                {minutosOtras > 0 && <div title={`Otras páginas: ${fmtMin(minutosOtras)}`} style={{ width: `${(minutosOtras / navTotalMin) * 100}%`, background: GRAY3 }} />}
              </div>
            )}
            {navTotalMin > 0 && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: GRAY3, fontWeight: 700, marginBottom: 16 }}>
                {navSecciones.map(sec => <span key={sec.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: sec.color }} />{sec.nombre} {Math.round((sec.minutos / navTotalMin) * 100)}%</span>)}
                {minutosOtras > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: GRAY3 }} />Pedido, cuenta y otras {Math.round((minutosOtras / navTotalMin) * 100)}%</span>}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
              {navSecciones.map(sec => {
                const esGanadora = navGanadora && navGanadora.key === sec.key;
                return (
                  <div key={sec.key} style={{ border: `2px solid ${esGanadora ? sec.color : GRAY2}`, borderRadius: 12, padding: 14, background: esGanadora ? `${sec.color}0D` : WHITE }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 900, fontSize: 15, color: sec.color }}>{sec.nombre}</span>
                      {esGanadora && <span style={{ fontSize: 10, fontWeight: 800, background: sec.color, color: WHITE, borderRadius: 10, padding: "2px 8px" }}>Más navegada</span>}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}><NumeroAnimado valor={sec.vistas} /></div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 10 }}>visitas a la sección</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, borderTop: `1px solid ${GRAY2}`, paddingTop: 8 }}>
                      <span style={{ color: GRAY3 }}>Personas distintas</span><b>{sec.visitantes}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, paddingTop: 4 }}>
                      <span style={{ color: GRAY3 }}>Tiempo aprox.</span><b>{fmtMin(sec.minutos)}</b>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 10.5, color: GRAY3, marginTop: 12, lineHeight: 1.4 }}>
              El tiempo es aproximado: se mide cada minuto que el cliente sigue con la página abierta en esa sección (una visita de menos de un minuto cuenta como visita, pero no suma tiempo).
            </p>
          </div>

          {/* TOP 4 LISTAS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><LayoutGrid size={17} color={RED} /> Categorías más vistas</div>
              {topCategorias.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topCategorias.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxCat} color={RED} delay={i * 0.04} />)}
              {topCategoriasFull.length > 8 && (
                <button onClick={() => setListaCompletaModal({ titulo: "Categorías más vistas", Icono: LayoutGrid, color: RED, datos: topCategoriasFull, maximo: maxCat })} className="oft-btn-press" style={{ marginTop: 4, background: "none", border: "none", color: RED, fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  Ver todas ({topCategoriasFull.length}) →
                </button>
              )}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Tag size={17} color="#856404" /> Productos más vistos</div>
              {topProductos.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topProductos.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxProd} color="#856404" delay={i * 0.04} />)}
              {topProductosFull.length > 8 && (
                <button onClick={() => setListaCompletaModal({ titulo: "Productos más vistos", Icono: Tag, color: "#856404", datos: topProductosFull, maximo: maxProd })} className="oft-btn-press" style={{ marginTop: 4, background: "none", border: "none", color: "#856404", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  Ver todos ({topProductosFull.length}) →
                </button>
              )}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Search size={17} color="#0F6E56" /> Búsquedas más frecuentes</div>
              {topBusquedas.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topBusquedas.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxBusq} color="#0F6E56" delay={i * 0.04} />)}
              {topBusquedasFull.length > 8 && (
                <button onClick={() => setListaCompletaModal({ titulo: "Búsquedas más frecuentes", Icono: Search, color: "#0F6E56", datos: topBusquedasFull, maximo: maxBusq })} className="oft-btn-press" style={{ marginTop: 4, background: "none", border: "none", color: "#0F6E56", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  Ver todas ({topBusquedasFull.length}) →
                </button>
              )}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><ShoppingCart size={17} color="#1D4ED8" /> Más agregados al carrito</div>
              {topCarrito.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topCarrito.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxCarr} color="#1D4ED8" delay={i * 0.04} />)}
              {topCarritoFull.length > 8 && (
                <button onClick={() => setListaCompletaModal({ titulo: "Más agregados al carrito", Icono: ShoppingCart, color: "#1D4ED8", datos: topCarritoFull, maximo: maxCarr })} className="oft-btn-press" style={{ marginTop: 4, background: "none", border: "none", color: "#1D4ED8", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  Ver todos ({topCarritoFull.length}) →
                </button>
              )}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Package size={17} color="#B45309" /> Cómo compran (pieza / media / docena / flexpack)</div>
              {topPresentacion.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topPresentacion.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxPres} color="#B45309" delay={i * 0.04} />)}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><MessageCircle size={17} color="#25D366" /> Consultas por WhatsApp — de dónde vienen</div>
              {topWhatsapp.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topWhatsapp.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxWhatsapp} color="#25D366" delay={i * 0.04} />)}
              {topWhatsappFull.length > 8 && (
                <button onClick={() => setListaCompletaModal({ titulo: "Consultas por WhatsApp", Icono: MessageCircle, color: "#25D366", datos: topWhatsappFull, maximo: maxWhatsapp })} className="oft-btn-press" style={{ marginTop: 4, background: "none", border: "none", color: "#25D366", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  Ver todas ({topWhatsappFull.length}) →
                </button>
              )}
            </div>
          </div>

          {listaCompletaModal && (
            <ListaCompletaModal
              titulo={listaCompletaModal.titulo}
              Icono={listaCompletaModal.Icono}
              color={listaCompletaModal.color}
              datos={listaCompletaModal.datos}
              maximo={listaCompletaModal.maximo}
              onClose={() => setListaCompletaModal(null)}
            />
          )}

          {/* ANÁLISIS POR OPERADOR / VENDEDOR */}
          <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20, marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Users size={17} color={RED} /> Por operador / vendedor</div>
              <EditorComision valorActual={comisionPorcentaje} onGuardado={setComisionPorcentaje} showToast={showToast} />
            </div>
            <p style={{ fontSize: 12, color: GRAY3, marginBottom: 16 }}>Solo cuenta lo creado desde "Crear Pedido" en este panel, a partir de que se activó este seguimiento.</p>
            {analisisPorOperador.length === 0 ? (
              <p style={{ color: GRAY3, fontSize: 13 }}>Sin actividad registrada por operador en este rango.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${GRAY2}` }}>
                      <th style={{ textAlign: "left", padding: "8px 10px", color: GRAY3, fontWeight: 700 }}>Operador</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", color: GRAY3, fontWeight: 700 }}>Cotizaciones</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", color: GRAY3, fontWeight: 700 }}>Por día</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", color: GRAY3, fontWeight: 700 }}>Ventas</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", color: GRAY3, fontWeight: 700 }}>Monto</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", color: GRAY3, fontWeight: 700 }}>Comisión</th>
                      <th style={{ textAlign: "right", padding: "8px 10px", color: GRAY3, fontWeight: 700 }}>Conversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analisisPorOperador.map(op => (
                      <tr key={op.id} style={{ borderBottom: `1px solid ${GRAY}` }}>
                        <td style={{ padding: "10px", fontWeight: 700 }}>{op.nombre}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>{op.cotizaciones}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: GRAY3 }}>{op.cotizacionesPorDia.toFixed(1)}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>{op.ventas}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>${op.monto.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#0F6E56" }}>${op.comision.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>
                          <span style={{ fontWeight: 800, color: op.tasaConversion >= 50 ? "#0F6E56" : op.tasaConversion > 0 ? "#856404" : GRAY3 }}>
                            {Math.round(op.tasaConversion)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PÍXELES DE MARKETING (Meta / Google) — el admin solo pega el ID
//  y automáticamente empiezan a medirse: ver producto, agregar al
//  carrito, iniciar checkout, y compra completada.
// ═══════════════════════════════════════════════════════════════
function CampoPixel({ etiqueta, claveConfig, descripcion, placeholder, valor, colorAcento, ayudaUrl }) {
  const { showToast } = useApp();
  const [texto, setTexto] = useState(valor || "");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setTexto(valor || ""); }, [valor]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const respPatch = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?clave=eq.${claveConfig}`, {
        method: "PATCH", headers: sb.dataHeaders(), body: JSON.stringify({ valor: texto.trim() || null }),
      });
      if (!respPatch.ok) throw new Error(await respPatch.text());
      const actualizado = await respPatch.json();
      if (!Array.isArray(actualizado) || actualizado.length === 0) {
        // No existía la fila todavía -- la crea
        const respPost = await fetch(`${SUPABASE_URL}/rest/v1/configuracion`, {
          method: "POST", headers: sb.dataHeaders(), body: JSON.stringify({ clave: claveConfig, valor: texto.trim() || null }),
        });
        if (!respPost.ok) throw new Error(await respPost.text());
      }
      showToast("Guardado — se activa la próxima vez que alguien cargue la página");
    } catch (e) {
      showToast("Error al guardar: " + (e.message || ""));
    }
    setGuardando(false);
  };

  return (
    <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{etiqueta}</div>
      <p style={{ fontSize: 13, color: GRAY3, marginBottom: 14 }}>{descripcion} {ayudaUrl && <a href={ayudaUrl} target="_blank" rel="noopener noreferrer" style={{ color: colorAcento }}>¿Dónde lo encuentro?</a>}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder={placeholder} style={{ ...S.input, marginBottom: 0, flex: 1, minWidth: 220 }} />
        <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, background: colorAcento, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MÓDULO DE PRECIOS — consulta rápida para vendedores: precio normal,
//  el mejor precio (docena/6 piezas), precio mínimo y precio especial.
//  Los primeros 3 los define el propio catálogo; mínimo/especial los pone
//  el admin en el formulario del producto.
// ═══════════════════════════════════════════════════════════════
function PrecioMini({ etiqueta, valor, colorTexto }) {
  const money = (n) => (n === null || n === undefined) ? "—" : "$" + Number(n).toFixed(2);
  return (
    <div style={{ textAlign: "center", minWidth: 68 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: colorTexto || BLACK }}>{money(valor)}</div>
      <div style={{ fontSize: 9.5, color: GRAY3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 1 }}>{etiqueta}</div>
    </div>
  );
}

function PreciosPanel({ products, categories, esAdminCompleto }) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState(null); // null = todas
  const q = busqueda.trim().toLowerCase();
  const filtrados = products.filter(p => p.activo
    && (!q || p.nombre.toLowerCase().includes(q) || (p.referencia || "").toLowerCase().includes(q))
    && (categoriaId === null || p.categoria_id === categoriaId));

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}><DollarSign size={24} color={RED} /> Módulo de Precios</div>
      <p style={{ fontSize: 13, color: GRAY3, marginBottom: 18, maxWidth: 640 }}>
        Consulta rápida para saber qué ofrecer en una venta: el precio normal, el mejor precio con descuento
        (docena o 6 piezas), hasta dónde puedes bajar (mínimo), y el precio especial para cerrar la venta.
      </p>
      <div style={{ position: "relative", marginBottom: 12, maxWidth: 420 }}>
        <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o referencia..." style={{ ...S.input, paddingLeft: 36, marginBottom: 0 }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
        <button onClick={() => setCategoriaId(null)} className="oft-btn-press"
          style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${categoriaId === null ? RED : GRAY2}`, background: categoriaId === null ? "#FDECEC" : WHITE, color: categoriaId === null ? RED : GRAY3, cursor: "pointer" }}>
          Todas
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setCategoriaId(c.id)} className="oft-btn-press"
            style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${categoriaId === c.id ? RED : GRAY2}`, background: categoriaId === c.id ? "#FDECEC" : WHITE, color: categoriaId === c.id ? RED : GRAY3, cursor: "pointer" }}>
            {c.nombre}
          </button>
        ))}
      </div>
      {filtrados.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: GRAY3, fontSize: 13 }}>No hay productos que coincidan.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map(p => {
            const esPerfumeria = p.modalidad_presentacion === "perfumeria";
            return (
              <div key={p.id} style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                {p.imagen_url ? <img src={p.imagen_url} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: GRAY, flexShrink: 0 }} />}
                <div style={{ minWidth: 130, flex: "1 1 150px" }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11.5, color: GRAY3 }}>{p.referencia || "sin referencia"}</div>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: !p.stock_actualizado_at ? GRAY3 : Number(p.stock) <= 0 ? RED : Number(p.stock) < (esPerfumeria ? 6 : 12) ? "#92400E" : "#0A9D4F" }}>
                      {p.stock_actualizado_at ? Number(p.stock) : "—"}
                    </div>
                    <div style={{ fontSize: 9.5, color: GRAY3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 1 }}>Stock</div>
                  </div>
                  <PrecioMini etiqueta="Pieza" valor={p.precio_pieza} />
                  <PrecioMini etiqueta={esPerfumeria ? "3 Piezas" : "Media Doc."} valor={p.precio_media_docena} />
                  <PrecioMini etiqueta={esPerfumeria ? "6 Piezas · mejor" : "Docena · mejor"} valor={p.precio_docena} colorTexto="#0A9D4F" />
                  {esAdminCompleto && <PrecioMini etiqueta="Mínimo" valor={p.precio_minimo} colorTexto="#92400E" />}
                  <PrecioMini etiqueta="Especial" valor={p.precio_especial} colorTexto={RED} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function PixelesPanel() {
  const [valores, setValores] = useState({ meta_pixel_id: "", google_pixel_id: "" });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    sb.get("configuracion", "?clave=in.(meta_pixel_id,google_pixel_id)")
      .then(data => {
        const mapa = {};
        (data || []).forEach(c => { mapa[c.clave] = c.valor || ""; });
        setValores({ meta_pixel_id: mapa.meta_pixel_id || "", google_pixel_id: mapa.google_pixel_id || "" });
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}><Zap size={24} color={RED} /> Píxeles de Marketing</div>
      <p style={{ fontSize: 13, color: GRAY3, marginBottom: 24, maxWidth: 640 }}>
        Pega el ID de cada uno y listo — no hace falta tocar nada más. Automáticamente se conectan estos 4 momentos de la compra, para que puedas optimizar tus campañas:
        <b> ver un producto</b>, <b>agregar al carrito</b>, <b>iniciar el pago</b>, y <b>compra completada</b> (el más importante para medir resultados reales).
      </p>
      {cargando ? <Spinner /> : (
        <>
          <CampoPixel
            etiqueta="Meta" claveConfig="meta_pixel_id" colorAcento="#0866FF"
            descripcion="El ID de tu Píxel de Meta (Facebook/Instagram Ads) — un número, ej. 1234567890123456."
            placeholder="1234567890123456"
            valor={valores.meta_pixel_id}
            ayudaUrl="https://www.facebook.com/business/help/952192354843755"
          />
          <CampoPixel
            etiqueta="Google" claveConfig="google_pixel_id" colorAcento="#4285F4"
            descripcion="El ID de medición de Google Ads o Google Analytics (GA4) — empieza con G- o AW-."
            placeholder="G-XXXXXXXXXX"
            valor={valores.google_pixel_id}
            ayudaUrl="https://support.google.com/analytics/answer/9539598"
          />
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CAMPAÑAS DE META ADS — trae el gasto real de cada campaña desde
//  Meta, y deja asignarle un producto para ver si es rentable
//  (comparando lo gastado contra las ventas de ese producto desde
//  que arrancó la campaña).
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  MÓDULO DE ANÁLISIS DE ADS — métricas de campañas de Meta, con
//  gráfica de evolución diaria, y selector de varios productos por
//  campaña (buscando por nombre o referencia) para ver rentabilidad.
// ═══════════════════════════════════════════════════════════════

// Chip con una "x" para quitar un producto ya asignado a la campaña
function ChipProducto({ nombre, referencia, onQuitar }) {
  return (
    <span className="oft-chip-prod" style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
      border: "1px solid #C7D2FE", color: "#3730A3", borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 12.5, fontWeight: 700,
    }}>
      {referencia ? `${referencia} — ` : ""}{nombre}
      <button onClick={onQuitar} style={{ background: "rgba(55,48,163,0.12)", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#3730A3" }}>
        <X size={11} strokeWidth={3} />
      </button>
    </span>
  );
}

// Buscador de productos (por nombre o referencia) para asignarle varios a una campaña
function SelectorProductosCampana({ campanaId, productos, asignados, onCambio, showToast }) {
  const [busqueda, setBusqueda] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [coords, setCoords] = useState(null); // posición calculada para el menú (portal)
  const inputRef = useRef(null);
  const idsYaAsignados = new Set(asignados.map(a => a.producto_id));

  const coincidencias = busqueda.trim().length >= 2
    ? productos.filter(p => !idsYaAsignados.has(p.id) && (
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.referencia || "").toLowerCase().includes(busqueda.toLowerCase())
      )).slice(0, 6)
    : [];

  // Las tarjetas de campaña tienen una animación de entrada, y eso "atrapa" cualquier
  // menú desplegable dentro de su propia capa visual (las tarjetas de abajo terminan
  // tapándolo). Por eso el menú se dibuja aparte, con un portal directo a <body>, en
  // la posición exacta del buscador -- así siempre queda por encima de todo.
  useEffect(() => {
    if (coincidencias.length === 0) { setCoords(null); return; }
    const actualizarPosicion = () => {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    actualizarPosicion();
    window.addEventListener("scroll", actualizarPosicion, true);
    window.addEventListener("resize", actualizarPosicion);
    return () => { window.removeEventListener("scroll", actualizarPosicion, true); window.removeEventListener("resize", actualizarPosicion); };
  }, [busqueda, coincidencias.length]);

  const agregar = async (producto) => {
    setBusqueda(""); setAgregando(true);
    try { await sb.post("meta_campana_productos", { campana_id: campanaId, producto_id: producto.id }); onCambio(); }
    catch (e) { showToast("No se pudo agregar: " + e.message); }
    setAgregando(false);
  };
  const quitar = async (asignacion) => {
    try { await sb.delete("meta_campana_productos", asignacion.id); onCambio(); }
    catch (e) { showToast("No se pudo quitar: " + e.message); }
  };

  return (
    <div>
      {asignados.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {asignados.map(a => (
            <ChipProducto key={a.id} nombre={a.productos?.nombre || "…"} referencia={a.productos?.referencia} onQuitar={() => quitar(a)} />
          ))}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <Search size={14} color={GRAY3} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
        <input
          ref={inputRef}
          value={busqueda} onChange={e => setBusqueda(e.target.value)} disabled={agregando}
          placeholder="Busca por nombre o referencia para agregar..."
          style={{ ...S.input, marginBottom: 0, fontSize: 13, paddingLeft: 32 }}
        />
      </div>
      {coincidencias.length > 0 && coords && createPortal(
        <div style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width, background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", zIndex: 9999, maxHeight: 220, overflowY: "auto" }}>
          {coincidencias.map(p => (
            <div key={p.id} onClick={() => agregar(p)} className="oft-btn-press"
              style={{ padding: "10px 12px", cursor: "pointer", fontSize: 13, borderBottom: `1px solid ${GRAY}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span><b>{p.referencia ? `${p.referencia} — ` : ""}</b>{p.nombre}</span>
              <Plus size={14} color={RED} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// Tarjeta individual de campaña -- métricas, selector de productos, rentabilidad
function TarjetaCampanaAds({ campana, productos, asignaciones, gastoEnRango, impresionesEnRango, clicsEnRango, ingresosEnRango, onCambio, showToast, delay }) {
  const asignadosDeEsta = asignaciones.filter(a => a.campana_id === campana.id);
  const ctr = impresionesEnRango > 0 ? (clicsEnRango / impresionesEnRango) * 100 : 0;
  const cpc = clicsEnRango > 0 ? gastoEnRango / clicsEnRango : 0;

  const gasto = Number(gastoEnRango) || 0;
  const ingresos = Number(ingresosEnRango) || 0;
  const ganancia = ingresos - gasto;
  const roas = gasto > 0 ? ingresos / gasto : 0;

  return (
    <div className="oft-prod-anim" style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 16, padding: 20, animationDelay: `${delay}s` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{campana.nombre}</div>
          <div style={{ fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: campana.estado === "ACTIVE" ? "#0F6E56" : GRAY3, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: campana.estado === "ACTIVE" ? "#0F6E56" : GRAY3, display: "inline-block", animation: campana.estado === "ACTIVE" ? "livePulse 1.8s infinite" : "none" }} />
              {campana.estado === "ACTIVE" ? "Activa" : campana.estado || "—"}
            </span>
            <span style={{ color: GRAY3 }}>·</span>
            <span style={{ color: GRAY3 }}>{Number(impresionesEnRango).toLocaleString("en-US")} impr.</span>
            <span style={{ color: GRAY3 }}>·</span>
            <span style={{ color: GRAY3 }}>{Number(clicsEnRango).toLocaleString("en-US")} clics</span>
            <span style={{ color: GRAY3 }}>·</span>
            <span style={{ color: GRAY3 }}>CTR {ctr.toFixed(2)}%</span>
            <span style={{ color: GRAY3 }}>·</span>
            <span style={{ color: GRAY3 }}>CPC ${cpc.toFixed(2)}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: GRAY3, fontWeight: 600 }}>Gastado (en este rango)</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>$<NumeroAnimado valor={Math.round(gasto)} />{gasto % 1 !== 0 ? `.${gasto.toFixed(2).split(".")[1]}` : ""}</div>
        </div>
      </div>

      <SelectorProductosCampana campanaId={campana.id} productos={productos} asignados={asignadosDeEsta} onCambio={onCambio} showToast={showToast} />

      {asignadosDeEsta.length > 0 && (
        <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${GRAY}`, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 11, color: GRAY3, fontWeight: 600 }}>Ventas generadas</div><div style={{ fontWeight: 800, fontSize: 15 }}>${ingresos.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div></div>
          <div><div style={{ fontSize: 11, color: GRAY3, fontWeight: 600 }}>ROAS</div><div style={{ fontWeight: 800, fontSize: 15 }}>{roas.toFixed(2)}x</div></div>
          <div>
            <div style={{ fontSize: 11, color: GRAY3, fontWeight: 600 }}>Resultado</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: ganancia >= 0 ? "#0F6E56" : "#B01519", display: "flex", alignItems: "center", gap: 4 }}>
              {ganancia >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {ganancia >= 0 ? "+" : ""}{ganancia.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 2, padding: "2px 8px", borderRadius: 10, background: ganancia >= 0 ? "#DCFCE7" : "#FEE2E2", color: ganancia >= 0 ? "#0F6E56" : "#B01519" }}>
                {ganancia >= 0 ? "Rentable" : "No rentable"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tarjeta chica de KPI para el módulo de ads, con degradado -- se ve más "futurista" que las KPI normales
function TarjetaKPIAds({ icono: Icono, valor, prefijo = "", sufijo = "", decimales = 0, colorDesde, colorHasta, etiqueta, delay = 0 }) {
  // NumeroAnimado redondea a entero por dentro (está pensado para conteos como
  // "23 visitas") -- para no perder los decimales en cosas como "1.35x" o "$12.50",
  // se anima solo la parte entera, y la parte decimal se muestra aparte, exacta.
  const valorFijo = (Number(valor) || 0).toFixed(decimales);
  const [parteEntera, parteDecimal] = valorFijo.split(".");
  return (
    <div className="oft-prod-anim" style={{
      background: `linear-gradient(135deg, ${colorDesde}, ${colorHasta})`, borderRadius: 16, padding: "18px 20px",
      color: WHITE, animationDelay: `${delay}s`, boxShadow: `0 8px 24px ${colorDesde}33`, position: "relative", overflow: "hidden",
    }}>
      <Icono size={68} style={{ position: "absolute", right: -14, bottom: -14, opacity: 0.15 }} />
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Icono size={14} /> {etiqueta}</div>
      <div style={{ fontSize: 26, fontWeight: 900 }}>
        {prefijo}<NumeroAnimado valor={Number(parteEntera)} />{parteDecimal ? `.${parteDecimal}` : ""}{sufijo}
      </div>
    </div>
  );
}

function AnalisisAdsPanel() {
  const { products, showToast } = useApp();
  const [rangoTipo, setRangoTipo] = useState("mes"); // dia | semana | mes | anio | todo | personalizado
  const [rangoInicioP, setRangoInicioP] = useState("");
  const [rangoFinP, setRangoFinP] = useState("");
  const [criterioRanking, setCriterioRanking] = useState("roas"); // roas | ganancia | ventas | ctr
  const [campanas, setCampanas] = useState([]);
  const [filtroCampanas, setFiltroCampanas] = useState("todas"); // todas | activas | generaron
  const [diario, setDiario] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [ingresosPorProducto, setIngresosPorProducto] = useState({});
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const calcularRango = (tipo) => {
    const hoyD = new Date();
    const hastaS = fechaPanama(hoyD);
    if (tipo === "dia") return [hastaS, hastaS];
    if (tipo === "semana") { const d = new Date(hoyD); d.setDate(d.getDate() - 6); return [fechaPanama(d), hastaS]; }
    if (tipo === "mes") { const d = new Date(hoyD.getFullYear(), hoyD.getMonth(), 1); return [fechaPanama(d), hastaS]; }
    if (tipo === "anio") { const d = new Date(hoyD.getFullYear(), 0, 1); return [fechaPanama(d), hastaS]; }
    if (tipo === "todo") return ["2020-01-01", hastaS];
    if (tipo === "personalizado") return [rangoInicioP || hastaS, rangoFinP || hastaS];
    return [hastaS, hastaS];
  };
  const [desde, hasta] = calcularRango(rangoTipo);

  const cargarTodo = async () => {
    setCargando(true);
    try {
      const [camps, diarios, asigs] = await Promise.all([
        sb.get("meta_campanas", "?order=gasto_total.desc"),
        sb.getTodo("meta_campanas_diario", "?order=fecha.asc"),
        sb.get("meta_campana_productos", "?select=id,campana_id,producto_id,productos(id,nombre,referencia,precio_pieza)"),
      ]);
      setCampanas(camps || []);
      setDiario(diarios || []);
      setAsignaciones(asigs || []);
    } catch (e) { showToast("Error cargando análisis de ads: " + e.message); }
    setCargando(false);
  };

  useEffect(() => { cargarTodo(); }, []);

  useEffect(() => {
    const idsProducto = [...new Set(asignaciones.map(a => a.producto_id))];
    if (idsProducto.length === 0) { setIngresosPorProducto({}); return; }
    (async () => {
      try {
        // Se trae "tipo" también -- las cotizaciones se guardan con pagado=true
        // desde que se crean (es una decisión de diseño para otra parte del sistema,
        // no porque sean ventas reales), así que sin excluirlas explícitamente aquí,
        // cada cotización que incluya un producto con campaña inflaba las "ventas
        // atribuidas" como si fuera una venta ya cerrada.
        const items = await sb.get("pedido_items", `?producto_id=in.(${idsProducto.join(",")})&select=producto_id,subtotal,pedidos(created_at,pagado,tipo)`);
        const mapa = {};
        (items || []).forEach(it => {
          if (!it.pedidos?.pagado) return;
          if (it.pedidos?.tipo === "cotizacion") return; // no es una venta real todavía
          if (!mapa[it.producto_id]) mapa[it.producto_id] = [];
          mapa[it.producto_id].push({ fecha: it.pedidos.created_at, monto: Number(it.subtotal) || 0 });
        });
        setIngresosPorProducto(mapa);
      } catch (e) { console.warn("Error trayendo ingresos:", e.message); }
    })();
  }, [asignaciones]);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/sincronizar-meta-ads`, { method: "POST", headers: sb.functionHeaders() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Error desconocido");
      showToast(`Sincronizado: ${data.sincronizadas} campaña(s), ${data.dias_guardados || 0} días de historial`);
      await cargarTodo();
    } catch (e) {
      showToast("Error al sincronizar con Meta: " + e.message);
    }
    setSincronizando(false);
  };

  // El detalle día por día solo llega hasta donde Meta nos lo dio (últimos ~90 días).
  // Para "Todo" usamos el total real de cada campaña (más exacto); para cualquier
  // otro rango, sumamos el detalle diario dentro de esas fechas específicas.
  const diarioEnRango = diario.filter(d => d.fecha >= desde && d.fecha <= hasta);

  const gastoPorCampanaEnRango = (campanaId) => {
    if (rangoTipo === "todo") { const c = campanas.find(x => x.id === campanaId); return c ? Number(c.gasto_total) || 0 : 0; }
    return diarioEnRango.filter(d => d.campana_id === campanaId).reduce((s, d) => s + (Number(d.gasto) || 0), 0);
  };
  const impresionesPorCampanaEnRango = (campanaId) => {
    if (rangoTipo === "todo") { const c = campanas.find(x => x.id === campanaId); return c ? Number(c.impresiones) || 0 : 0; }
    return diarioEnRango.filter(d => d.campana_id === campanaId).reduce((s, d) => s + (Number(d.impresiones) || 0), 0);
  };
  const clicsPorCampanaEnRango = (campanaId) => {
    if (rangoTipo === "todo") { const c = campanas.find(x => x.id === campanaId); return c ? Number(c.clics) || 0 : 0; }
    return diarioEnRango.filter(d => d.campana_id === campanaId).reduce((s, d) => s + (Number(d.clics) || 0), 0);
  };

  const calcularIngresosCampana = (campana) => {
    const asignadosDeEsta = asignaciones.filter(a => a.campana_id === campana.id);
    // Panamá es UTC-5 todo el año (no tiene horario de verano) -- se especifica la
    // zona explícitamente, para que este límite represente el mismo instante sin
    // importar en qué zona horaria esté el navegador de quien lo esté viendo.
    const desdeCampana = campana.fecha_inicio ? new Date(campana.fecha_inicio + "T00:00:00-05:00") : null;
    const hastaCampana = campana.fecha_fin ? new Date(campana.fecha_fin + "T23:59:59-05:00") : null;
    const desdeFiltro = new Date(desde + "T00:00:00-05:00");
    const hastaFiltro = new Date(hasta + "T23:59:59-05:00");
    let ingresos = 0;
    asignadosDeEsta.forEach(a => {
      (ingresosPorProducto[a.producto_id] || []).forEach(v => {
        // "created_at" se guarda en la base de datos como UTC, pero sin la "Z" al
        // final -- sin decirle esto a JavaScript, lo interpreta con la hora local
        // del navegador en vez de UTC, y una venta de la noche (hora Panamá) puede
        // terminar contada en el día equivocado. Se le agrega "Z" si no la trae.
        const fechaUTC = /[Z]|[+-]\d\d:\d\d$/.test(v.fecha) ? v.fecha : v.fecha + "Z";
        const f = new Date(fechaUTC);
        if (desdeCampana && f < desdeCampana) return;
        if (hastaCampana && f > hastaCampana) return;
        if (f < desdeFiltro || f > hastaFiltro) return; // también dentro del rango de fecha elegido
        ingresos += v.monto;
      });
    });
    return ingresos;
  };

  // Lista de campañas según el filtro elegido: todas, solo activas, o todas
  // ordenadas por lo que más generaron en el rango de fecha actual.
  const campanasFiltradas = (() => {
    if (filtroCampanas === "activas") return campanas.filter(c => c.estado === "ACTIVE");
    if (filtroCampanas === "generaron") return [...campanas].sort((a, b) => calcularIngresosCampana(b) - calcularIngresosCampana(a));
    return campanas;
  })();

  // ── Métricas generales, ya filtradas por el rango elegido ────────────────
  const gastoTotal = campanas.reduce((s, c) => s + gastoPorCampanaEnRango(c.id), 0);
  const impresionesTotal = campanas.reduce((s, c) => s + impresionesPorCampanaEnRango(c.id), 0);
  const clicsTotal = campanas.reduce((s, c) => s + clicsPorCampanaEnRango(c.id), 0);
  const ctrGeneral = impresionesTotal > 0 ? (clicsTotal / impresionesTotal) * 100 : 0;
  const campanasActivas = campanas.filter(c => c.estado === "ACTIVE").length;
  const ingresosTotalAtribuido = campanas.reduce((s, c) => s + calcularIngresosCampana(c), 0);
  const roasGeneral = gastoTotal > 0 ? ingresosTotalAtribuido / gastoTotal : 0;

  // Serie diaria agregada, ya filtrada por el rango elegido
  const serieDiariaGasto = (() => {
    const mapa = {};
    diarioEnRango.forEach(d => { mapa[d.fecha] = (mapa[d.fecha] || 0) + (Number(d.gasto) || 0); });
    return Object.entries(mapa).sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, valor]) => ({ dia: fecha, valor: Math.round(valor * 100) / 100 }));
  })();

  const productosActivos = products.filter(p => p.activo);
  const hayDatosDiariosLimitados = rangoTipo !== "todo" && rangoTipo !== "dia" && diario.length > 0 && desde < diario[0]?.fecha;

  // Métricas completas por campaña (para el ranking de "mejor rendimiento" y para
  // evitar recalcular lo mismo varias veces)
  const campanasConMetricas = campanas.map(c => {
    const gasto = gastoPorCampanaEnRango(c.id);
    const impresiones = impresionesPorCampanaEnRango(c.id);
    const clics = clicsPorCampanaEnRango(c.id);
    const ingresos = calcularIngresosCampana(c);
    const tieneProducto = asignaciones.some(a => a.campana_id === c.id);
    return {
      ...c, gasto, impresiones, clics, ingresos, tieneProducto,
      ctr: impresiones > 0 ? (clics / impresiones) * 100 : 0,
      ganancia: ingresos - gasto,
      roas: gasto > 0 ? ingresos / gasto : 0,
    };
  });

  const CRITERIOS_RANKING = {
    roas: { etiqueta: "ROAS", requiereProducto: true, valor: c => c.roas, formato: v => `${v.toFixed(2)}x`, color: "#7C3AED" },
    ganancia: { etiqueta: "Ganancia", requiereProducto: true, valor: c => c.ganancia, formato: v => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#0F6E56" },
    ventas: { etiqueta: "Ventas generadas", requiereProducto: true, valor: c => c.ingresos, formato: v => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#0EA5E9" },
    ctr: { etiqueta: "CTR", requiereProducto: false, valor: c => c.ctr, formato: v => `${v.toFixed(2)}%`, color: "#EA580C" },
  };
  const criterioActivo = CRITERIOS_RANKING[criterioRanking];
  const topCampanas = campanasConMetricas
    .filter(c => criterioActivo.requiereProducto ? c.tieneProducto : c.impresiones > 0)
    .filter(c => criterioActivo.valor(c) !== 0 || !criterioActivo.requiereProducto)
    .sort((a, b) => criterioActivo.valor(b) - criterioActivo.valor(a))
    .slice(0, 5);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Target size={24} color="#0866FF" /> Análisis de Ads</div>
        <button onClick={sincronizar} disabled={sincronizando} className="oft-btn-press" style={{ ...S.btnRed, background: "linear-gradient(135deg, #0866FF, #0047B3)" }}>
          <RefreshCw size={15} className={sincronizando ? "spin" : ""} /> {sincronizando ? "Sincronizando..." : "Sincronizar con Meta"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16, maxWidth: 680 }}>
        Métricas reales de tus campañas de Meta Ads. Asígnale uno o varios productos a cada campaña (buscando por nombre o referencia) para ver si es rentable.
      </p>

      <SelectorRangoAnalytics rangoTipo={rangoTipo} setRangoTipo={setRangoTipo} rangoInicioP={rangoInicioP} setRangoInicioP={setRangoInicioP} rangoFinP={rangoFinP} setRangoFinP={setRangoFinP} />

      {cargando ? <Spinner /> : (
        <>
          {hayDatosDiariosLimitados && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#92400E", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} /> El detalle día por día de Meta solo llega hasta el {new Date(diario[0].fecha + "T00:00:00").toLocaleDateString("es-PA", { day: "2-digit", month: "short" })} — este rango puede verse incompleto en la gráfica. Usa "Todo" para ver el gasto total real de cada campaña.
            </div>
          )}
          {/* KPIs generales, con degradado */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 22 }}>
            <TarjetaKPIAds icono={DollarSign} valor={gastoTotal} prefijo="$" decimales={2} colorDesde="#0866FF" colorHasta="#0047B3" etiqueta="Gasto total" delay={0} />
            <TarjetaKPIAds icono={TrendingUp} valor={ingresosTotalAtribuido} prefijo="$" decimales={2} colorDesde="#0F6E56" colorHasta="#065F46" etiqueta="Ventas atribuidas" delay={0.05} />
            <TarjetaKPIAds icono={Target} valor={roasGeneral} sufijo="x" decimales={2} colorDesde="#7C3AED" colorHasta="#5B21B6" etiqueta="ROAS general" delay={0.1} />
            <TarjetaKPIAds icono={MousePointerClick} valor={ctrGeneral} sufijo="%" decimales={2} colorDesde="#EA580C" colorHasta="#C2410C" etiqueta="CTR general" delay={0.15} />
            <TarjetaKPIAds icono={Zap} valor={campanasActivas} colorDesde="#0EA5E9" colorHasta="#0369A1" etiqueta="Campañas activas" delay={0.2} />
          </div>

          {/* Gráfica de línea -- gasto diario, del rango elegido */}
          <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 16, padding: 22, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: GRAY3, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={15} color="#0866FF" /> Gasto diario, en el rango elegido
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 10 }}>${gastoTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span style={{ fontSize: 12, color: GRAY3, fontWeight: 600 }}>en este rango</span></div>
            <GraficoLineal datos={serieDiariaGasto} color="#0866FF" />
          </div>

          {/* Mejor rendimiento -- ranking de campañas según el criterio elegido */}
          <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 16, padding: 22, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}><Target size={16} color="#7C3AED" /> Mejor rendimiento</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(CRITERIOS_RANKING).map(([k, c]) => (
                  <button key={k} onClick={() => setCriterioRanking(k)} className="oft-btn-press"
                    style={{ padding: "6px 13px", borderRadius: 18, border: `2px solid ${criterioRanking === k ? c.color : GRAY2}`, background: criterioRanking === k ? c.color : WHITE, color: criterioRanking === k ? WHITE : BLACK, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    {c.etiqueta}
                  </button>
                ))}
              </div>
            </div>
            {topCampanas.length === 0 ? (
              <p style={{ color: GRAY3, fontSize: 13 }}>
                {criterioActivo.requiereProducto ? "Todavía ninguna campaña tiene un producto asignado para calcular esto." : "Sin datos suficientes en este rango."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {topCampanas.map((c, i) => (
                  <div key={c.id} className="oft-prod-anim" style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 8px", borderRadius: 10, animationDelay: `${i * 0.05}s` }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: i === 0 ? "#FEF3C7" : i === 1 ? "#F1F5F9" : i === 2 ? "#FEE2E2" : GRAY, color: i === 0 ? "#92400E" : i === 1 ? "#475569" : i === 2 ? "#991B1B" : GRAY3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</div>
                      <div style={{ fontSize: 11, color: GRAY3 }}>${c.gasto.toLocaleString("en-US", { minimumFractionDigits: 2 })} gastado · {Number(c.clics).toLocaleString("en-US")} clics</div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: criterioActivo.color, flexShrink: 0 }}>{criterioActivo.formato(criterioActivo.valor(c))}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista de campañas */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Campañas ({campanasFiltradas.length})</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { k: "todas", etiqueta: "Todas" },
                { k: "activas", etiqueta: "Activas" },
                { k: "generaron", etiqueta: "Más generaron" },
              ].map(op => (
                <button key={op.k} onClick={() => setFiltroCampanas(op.k)} className="oft-btn-press"
                  style={{ padding: "6px 13px", borderRadius: 18, border: `2px solid ${filtroCampanas === op.k ? RED : GRAY2}`, background: filtroCampanas === op.k ? RED : WHITE, color: filtroCampanas === op.k ? WHITE : BLACK, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {op.etiqueta}
                </button>
              ))}
            </div>
          </div>
          {campanas.length === 0 ? (
            <p style={{ color: GRAY3, fontSize: 13 }}>Todavía no hay campañas sincronizadas — dale a "Sincronizar con Meta" (necesitas haber guardado META_ACCESS_TOKEN y META_AD_ACCOUNT_ID en Supabase primero).</p>
          ) : campanasFiltradas.length === 0 ? (
            <p style={{ color: GRAY3, fontSize: 13 }}>Ninguna campaña activa en este momento.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {campanasFiltradas.map((camp, i) => (
                <TarjetaCampanaAds key={camp.id} campana={camp} productos={productosActivos} asignaciones={asignaciones}
                  gastoEnRango={gastoPorCampanaEnRango(camp.id)} impresionesEnRango={impresionesPorCampanaEnRango(camp.id)} clicsEnRango={clicsPorCampanaEnRango(camp.id)}
                  ingresosEnRango={calcularIngresosCampana(camp)}
                  onCambio={cargarTodo} showToast={showToast} delay={Math.min(i * 0.03, 0.6)} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

// Campo para el costo FIJO de "puerta a puerta" -- es un solo valor general,
// no depende de sucursal ni ubicación del cliente.
function EditorCostoPuertaAPuerta({ showToast }) {
  const [valor, setValor] = useState("0");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    sb.get("configuracion", "?clave=eq.costo_envio_puerta_a_puerta&limit=1")
      .then(data => { if (data?.[0]?.valor != null) setValor(String(data[0].valor)); })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    const num = Number(valor);
    if (isNaN(num) || num < 0) { showToast("Pon un número válido (0 o más)"); return; }
    setGuardando(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?clave=eq.costo_envio_puerta_a_puerta`, {
        method: "PATCH", headers: sb.dataHeaders(), body: JSON.stringify({ valor: num }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      showToast("Costo de puerta a puerta actualizado");
    } catch (e) { showToast("Error al guardar: " + e.message); }
    setGuardando(false);
  };

  if (cargando) return null;
  return (
    <div style={{ background: WHITE, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${GRAY2}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <MapPin size={22} color={RED} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Costo de envío puerta a puerta</div>
        <div style={{ fontSize: 12, color: GRAY3 }}>Un solo precio fijo, sin importar la dirección del cliente</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>$</span>
        <input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)}
          style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: `1px solid ${GRAY2}`, fontSize: 14, textAlign: "center" }} />
        <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, padding: "8px 16px", opacity: guardando ? 0.6 : 1 }}>
          {guardando ? "..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// Desplegable chico para elegir/cambiar cómo se pagó un pedido o cotización
function SelectorMetodoPago({ value, onChange, style }) {
  const valido = !!METODOS_PAGO[value];
  return (
    <select value={valido ? value : ""} onChange={e => onChange(e.target.value)} title="Cambiar método de pago"
      style={{ fontSize: 11, padding: "2px 4px", borderRadius: 6, border: `1px solid ${GRAY2}`, background: WHITE, color: GRAY3, maxWidth: 110, ...style }}>
      <option value="" disabled={valido}>{valido ? "Cambiar pago…" : "Elegir pago…"}</option>
      {Object.entries(METODOS_PAGO).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
    </select>
  );
}

// ═══ NÚMEROS ANIMADOS DEL DASHBOARD ═══
// Cuando un número cambia (por ejemplo, entra una venta nueva), "rueda" hasta el valor
// nuevo, brilla en verde y, si subió, aparece un "+$X" que flota y se desvanece.
// Si el cambio viene de que el usuario cambió el filtro (día/semana/mes...), el número
// solo rueda suave, sin brillo ni "+X" (para no confundir con una venta nueva).
let _estiloNumAnimado = false;
function asegurarEstiloNumAnimado() {
  if (_estiloNumAnimado || typeof document === "undefined") return;
  _estiloNumAnimado = true;
  const st = document.createElement("style");
  st.textContent = `
    @keyframes oftNumUp { 0% { transform: scale(1); } 28% { transform: scale(1.16); color: #0FA85A; text-shadow: 0 0 16px rgba(15,168,90,.5); } 100% { transform: scale(1); } }
    @keyframes oftNumDown { 0% { transform: scale(1); } 28% { transform: scale(0.93); color: #B01519; } 100% { transform: scale(1); } }
    @keyframes oftNumDelta { 0% { opacity: 0; transform: translateY(-6px) scale(.85); } 14% { opacity: 1; transform: translateY(2px) scale(1); } 78% { opacity: 1; transform: translateY(2px); } 100% { opacity: 0; transform: translateY(8px); } }
    .oft-numa { position: relative; display: inline-block; font-variant-numeric: tabular-nums; }
    .oft-numa-val { display: inline-block; transform-origin: left center; }
    .oft-numa-up { animation: oftNumUp 1.1s ease-out; }
    .oft-numa-down { animation: oftNumDown 1.1s ease-out; }
    .oft-numa-delta { position: absolute; left: 0; top: 100%; margin-top: 2px; font-size: 12px; font-weight: 800; line-height: 1; color: #0F6E56; background: #E3F6EC; border: 1px solid #A8E0C3; padding: 3px 8px; border-radius: 12px; white-space: nowrap; pointer-events: none; animation: oftNumDelta 2.4s ease-out forwards; }
    @media (prefers-reduced-motion: reduce) { .oft-numa-up, .oft-numa-down, .oft-numa-delta { animation: none; }
    .oft-numa-delta.lado { left: 100%; top: 50%; margin: -9px 0 0 8px; } .oft-numa-delta { display: none; } }
  `;
  document.head.appendChild(st);
}

function CifraViva({ valor, formato, decimales = 0, contexto = "", mostrarDelta = true, deltaLado = false, duracion = 900 }) {
  const num = Number(valor) || 0;
  const fmt = formato || ((n) => String(n));
  const [mostrado, setMostrado] = useState(num);
  const [destello, setDestello] = useState({ id: 0, sube: true });
  const [delta, setDelta] = useState(null);
  const previo = useRef(num);
  const ctxPrev = useRef(contexto);
  const actual = useRef(num);
  const raf = useRef(0);
  const tDelta = useRef(0);
  useEffect(() => { asegurarEstiloNumAnimado(); }, []);
  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(tDelta.current); }, []);
  useEffect(() => {
    const ctxCambio = ctxPrev.current !== contexto;
    ctxPrev.current = contexto;
    const anterior = previo.current;
    if (anterior === num) return;
    previo.current = num;
    const desde = actual.current;
    const sube = num > anterior;
    const reducir = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ctxCambio) {
      setDestello(d => ({ id: d.id + 1, sube }));
      if (sube && mostrarDelta && !reducir) {
        setDelta({ id: Date.now(), n: num - anterior });
        clearTimeout(tDelta.current);
        tDelta.current = setTimeout(() => setDelta(null), 2500);
      }
    }
    cancelAnimationFrame(raf.current);
    if (reducir) { actual.current = num; setMostrado(num); return; }
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / duracion);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = p >= 1 ? num : desde + (num - desde) * e;
      actual.current = v;
      setMostrado(v);
      if (p < 1) raf.current = requestAnimationFrame(paso);
    };
    raf.current = requestAnimationFrame(paso);
  }, [num, contexto]);

  const redondeado = Number(mostrado.toFixed(decimales));
  return (
    <span className="oft-numa">
      <span key={destello.id} className={"oft-numa-val" + (destello.id > 0 ? (destello.sube ? " oft-numa-up" : " oft-numa-down") : "")}>{fmt(redondeado)}</span>
      {delta && <span key={delta.id} className={"oft-numa-delta" + (deltaLado ? " lado" : "")}>+{fmt(Number(delta.n.toFixed(decimales)))}</span>}
    </span>
  );
}

// Precio de envío especial para PERFUMES (envío a sucursal): si el pedido es solo de
// perfumes y la cantidad está entre el mínimo y el máximo, se cobra este precio.
function EditorEnvioPerfumes({ showToast }) {
  const [cfg, setCfg] = useState({ activo: false, precio: "5", min: "1", max: "3" });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    sb.get("configuracion", "?clave=eq.envio_perfumes&limit=1")
      .then(data => {
        const v = normalizarEnvioPerfumes(data?.[0]?.valor);
        setCfg({ activo: v.activo, precio: String(v.precio), min: String(v.min), max: String(v.max) });
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    const precio = Number(cfg.precio), min = Math.floor(Number(cfg.min)), max = Math.floor(Number(cfg.max));
    if (isNaN(precio) || precio < 0) { showToast("Pon un precio válido (0 o más)"); return; }
    if (!min || min < 1 || !max || max < 1) { showToast("La cantidad mínima y máxima deben ser 1 o más"); return; }
    if (min > max) { showToast("La cantidad mínima no puede ser mayor que la máxima"); return; }
    setGuardando(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?on_conflict=clave`, {
        method: "POST",
        headers: { ...sb.dataHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ clave: "envio_perfumes", valor: { activo: cfg.activo, precio, min, max }, updated_at: new Date().toISOString() }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      showToast(cfg.activo ? "Envío de perfumes guardado y activo" : "Envío de perfumes guardado (desactivado)");
    } catch (e) { showToast("Error al guardar: " + e.message); }
    setGuardando(false);
  };

  if (cargando) return null;
  const campo = { width: 70, padding: "8px 10px", borderRadius: 8, border: `1px solid ${GRAY2}`, fontSize: 14, textAlign: "center" };
  return (
    <div style={{ background: WHITE, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${cfg.activo ? "#0F6E56" : GRAY2}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Truck size={22} color={RED} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Envío especial para perfumes (a sucursal)</div>
          <div style={{ fontSize: 12, color: GRAY3 }}>Si el cliente pide solo perfumes y la cantidad está dentro del rango, el envío a sucursal cuesta este precio en vez del de la sucursal.</div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          <input type="checkbox" checked={cfg.activo} onChange={e => setCfg(c => ({ ...c, activo: e.target.checked }))} style={{ width: 18, height: 18 }} />
          {cfg.activo ? "Activo" : "Desactivado"}
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14, fontSize: 13 }}>
        <span>Cuando pidan de</span>
        <input type="number" min="1" step="1" value={cfg.min} onChange={e => setCfg(c => ({ ...c, min: e.target.value }))} style={campo} />
        <span>a</span>
        <input type="number" min="1" step="1" value={cfg.max} onChange={e => setCfg(c => ({ ...c, max: e.target.value }))} style={campo} />
        <span>perfumes, el envío cuesta $</span>
        <input type="number" min="0" step="0.01" value={cfg.precio} onChange={e => setCfg(c => ({ ...c, precio: e.target.value }))} style={{ ...campo, width: 80 }} />
        <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, padding: "8px 16px", opacity: guardando ? 0.6 : 1, marginLeft: "auto" }}>
          {guardando ? "..." : "Guardar"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: GRAY3, marginTop: 10 }}>
        Cuenta como perfume cualquier producto de presentación "perfumería" (1 unidad = 1 perfume; ½ docena = 3; docena = 6). Si el pedido lleva algo que no es perfume, o más perfumes del máximo, se cobra el precio normal de la sucursal. No afecta puerta a puerta ni retiro en local.
      </div>
    </div>
  );
}

// ═══ CLIENTES: ID interno, cuenta web y duplicados ═══
const esCorreoReal = (email) => !!email && !String(email).includes("@ofertodo.local");

// Estado de cuenta de un cliente para mostrar en la lista
function estadoCuentaCliente(u) {
  if (u.es_admin) return { texto: "Equipo", color: "#4a2c82", bg: "#ece4fa" };
  if (u.cuenta_web) return { texto: "Con cuenta", color: "#155724", bg: "#d4edda" };
  if (u.origen_cuenta === "web_invitado") return { texto: "Invitado (sin cuenta)", color: "#856404", bg: "#fff3cd" };
  if (u.origen_cuenta === "admin_manual") return { texto: "Sin cuenta · interno", color: "#555", bg: "#eee" };
  return { texto: "Sin confirmar", color: "#555", bg: "#eee" };
}

function ChipIdInterno({ id }) {
  if (!id) return null;
  return <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, fontWeight: 700, background: "#f1f1f1", color: "#333", padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>{id}</span>;
}
function ChipCuenta({ u }) {
  const e = estadoCuentaCliente(u);
  return <span style={{ fontSize: 11, fontWeight: 700, background: e.bg, color: e.color, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{e.texto}</span>;
}

// Búsqueda + filtro de la lista
function filtrarClientes(users, busqueda, filtro) {
  const q = (busqueda || "").trim().toLowerCase();
  const qDigitos = q.replace(/\D/g, "");
  return users.filter(u => {
    if (filtro === "con_cuenta" && !u.cuenta_web) return false;
    if (filtro === "sin_cuenta" && (u.cuenta_web || u.es_admin)) return false;
    if (!q) return true;
    if ((u.nombre || "").toLowerCase().includes(q)) return true;
    if ((u.email || "").toLowerCase().includes(q)) return true;
    if ((u.id_interno || "").toLowerCase().includes(q)) return true;
    if (qDigitos.length >= 4 && (u.telefono || "").replace(/\D/g, "").includes(qDigitos)) return true;
    return false;
  });
}

// Agrupa fichas que parecen ser la misma persona (mismo teléfono). NUNCA se fusionan solas:
// el admin revisa y confirma cada grupo.
function agruparDuplicados(users, orders) {
  const pedidosPor = {};
  orders.forEach(o => { if (o.usuario_id) pedidosPor[o.usuario_id] = (pedidosPor[o.usuario_id] || 0) + 1; });
  const grupos = {};
  users.forEach(u => {
    if (u.es_admin) return;
    if (!u.telefono_norm || u.telefono_norm.length !== 8) return;
    (grupos[u.telefono_norm] = grupos[u.telefono_norm] || []).push(u);
  });
  const puntaje = (u) => (u.cuenta_web ? 1000 : 0) + (esCorreoReal(u.email) ? 100 : 0) + Math.min(pedidosPor[u.id] || 0, 99);
  return Object.entries(grupos).filter(([, l]) => l.length > 1).map(([tel, lista]) => {
    const ordenada = [...lista].sort((a, b) => puntaje(b) - puntaje(a) || (a.numero_cliente || 0) - (b.numero_cliente || 0));
    const bloqueado = lista.filter(u => u.cuenta_web).length >= 2;
    return { tel, principal: ordenada[0], duplicados: ordenada.slice(1), bloqueado, pedidosPor };
  });
}

function ClientesDuplicadosPanel({ users, orders, abierto, setAbierto, onFusionado, showToast }) {
  const grupos = agruparDuplicados(users, orders);
  const [trabajando, setTrabajando] = useState(null);
  if (grupos.length === 0) return null;

  const fusionar = async (g, dup) => {
    const p = g.principal;
    const correoPerdido = esCorreoReal(dup.email) && dup.email.toLowerCase() !== (p.email || "").toLowerCase() && (p.cuenta_web || esCorreoReal(p.email));
    const msg =
      `¿Unir estos dos clientes?\n\n` +
      `SE QUEDA: ${p.nombre} (${p.id_interno})${esCorreoReal(p.email) ? " · " + p.email : ""}\n` +
      `SE ELIMINA: ${dup.nombre} (${dup.id_interno})${esCorreoReal(dup.email) ? " · " + dup.email : ""}\n\n` +
      `Sus pedidos pasan a la ficha que se queda.` +
      (correoPerdido ? `\n\n⚠ El correo ${dup.email} dejará de estar registrado.` : "") +
      `\n\nEsto no se puede deshacer (queda un registro de auditoría).`;
    if (!window.confirm(msg)) return;
    setTrabajando(dup.id);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fusionar_clientes`, {
        method: "POST", headers: sb.dataHeaders(),
        body: JSON.stringify({ p_principal: p.id, p_duplicado: dup.id }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.message || "No se pudo unir");
      showToast(`Unidos: ${data?.pedidos_movidos ?? 0} pedido(s) pasaron a ${data?.id_interno || p.id_interno}`);
      await onFusionado();
    } catch (e) {
      showToast("Error: " + (e.message || "no se pudo unir"));
    }
    setTrabajando(null);
  };

  return (
    <div style={{ background: "#fff8e1", border: "1.5px solid #f0c36d", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
      <button onClick={() => setAbierto(!abierto)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
        <GitMerge size={20} color="#856404" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#5c4400" }}>Posibles clientes duplicados ({grupos.length})</div>
          <div style={{ fontSize: 12, color: "#856404" }}>Mismo WhatsApp en más de una ficha. Revisa y únelos si son la misma persona.</div>
        </div>
        {abierto ? <ChevronUp size={18} color="#856404" /> : <ChevronDown size={18} color="#856404" />}
      </button>
      {abierto && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {grupos.map(g => (
            <div key={g.tel} style={{ background: WHITE, borderRadius: 10, border: `1px solid ${GRAY2}`, padding: 12 }}>
              <div style={{ fontSize: 11, color: GRAY3, marginBottom: 8 }}>WhatsApp terminado en <strong>{g.tel}</strong></div>
              {g.bloqueado && <div style={{ fontSize: 12, color: "#721c24", background: "#f8d7da", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>Las dos tienen cuenta web propia: no se pueden unir (son cuentas distintas).</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[g.principal, ...g.duplicados].map((u, i) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, paddingBottom: 8, borderBottom: i < g.duplicados.length ? `1px dashed ${GRAY2}` : "none" }}>
                    <ChipIdInterno id={u.id_interno} />
                    <strong>{u.nombre}</strong>
                    <span style={{ color: GRAY3, fontSize: 12 }}>{esCorreoReal(u.email) ? u.email : "sin correo"}</span>
                    <ChipCuenta u={u} />
                    <span style={{ color: RED, fontWeight: 700, fontSize: 12 }}>{g.pedidosPor[u.id] || 0} pedido(s)</span>
                    {i === 0 ? (
                      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#155724" }}>SE QUEDA</span>
                    ) : (
                      <button disabled={g.bloqueado || trabajando === u.id} onClick={() => fusionar(g, u)} className="oft-btn-press"
                        style={{ marginLeft: "auto", background: g.bloqueado ? GRAY2 : BLACK, color: WHITE, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: g.bloqueado ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 5, opacity: trabajando === u.id ? 0.6 : 1 }}>
                        <GitMerge size={13} /> {trabajando === u.id ? "Uniendo..." : "Unir a esta ficha"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  OFERTAS — campañas ("Ofertas de Black Weekend"), ofertas de un producto
//  y combos fijos, separados en sección Detal y sección Mayor.
//  Solo UNA campaña puede estar activa a la vez (la base de datos lo exige).
// ═══════════════════════════════════════════════════════════════

// Fecha de un <input type="datetime-local"> <-> timestamp, siempre en hora de Panamá (UTC-5)
function aInputPanama(iso) {
  if (!iso) return "";
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Panama", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const o = {}; partes.forEach(p => { o[p.type] = p.value; });
  return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`;
}
function desdeInputPanama(valor) {
  if (!valor) return null;
  return new Date(valor + ":00-05:00").toISOString();
}
function fechaCortaPanama(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-PA", { timeZone: "America/Panama", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function OfertasAdmin() {
  const { products, showToast } = useApp();
  const [campanas, setCampanas] = useState([]);
  const [items, setItems] = useState([]);       // ofertas de TODAS las campañas
  const [comboRows, setComboRows] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [selId, setSelId] = useState(null);
  const [campForm, setCampForm] = useState(null);
  const [ofForm, setOfForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoImg, setSubiendoImg] = useState(false);
  const [busquedaProd, setBusquedaProd] = useState("");
  const [busquedaOferta, setBusquedaOferta] = useState(""); // buscador de la lista de ofertas de la campaña
  const imgRef = useRef(null);

  const productosPorId = {};
  products.forEach(p => { productosPorId[p.id] = p; });

  const cargar = async () => {
    try {
      const [c, i, r] = await Promise.all([
        sb.get("campanas_ofertas", "?select=*&order=created_at.desc"),
        sb.get("ofertas_items", "?select=*&order=orden.asc,id.asc"),
        sb.get("ofertas_combo_productos", "?select=*&order=id.asc"),
      ]);
      setCampanas(c); setItems(i); setComboRows(r);
      setSelId(prev => (prev && c.some(x => x.id === prev)) ? prev : (c.find(x => x.activa)?.id || c[0]?.id || null));
    } catch (e) { alert("No se pudieron cargar las ofertas: " + e.message); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const sel = campanas.find(c => c.id === selId) || null;
  const itemsSel = items.filter(i => i.campana_id === selId);
  const estadoCampana = (c) => {
    const ahora = Date.now();
    if (c.fecha_fin && new Date(c.fecha_fin).getTime() < ahora) return { txt: c.activa ? "ACTIVA · VENCIDA" : "VENCIDA", bg: "#FDE2E2", color: "#9B1C1C" };
    if (c.activa && c.fecha_inicio && new Date(c.fecha_inicio).getTime() > ahora) return { txt: "PROGRAMADA", bg: "#FFF3CD", color: "#856404" };
    if (c.activa) return { txt: "ACTIVA", bg: "#D4EDDA", color: "#155724" };
    return { txt: "BORRADOR", bg: GRAY2, color: GRAY3 };
  };

  // ── Campañas ──
  const nuevaCampana = () => setCampForm({ prefijo: "Ofertas de", nombre: "", subtitulo: "", color_principal: "#E31E24", color_secundario: "#111111", fecha_inicio: "", fecha_fin: "" });
  const editarCampana = (c) => setCampForm({ id: c.id, prefijo: c.prefijo || "", nombre: c.nombre || "", subtitulo: c.subtitulo || "", color_principal: c.color_principal || "#E31E24", color_secundario: c.color_secundario || "#111111", fecha_inicio: aInputPanama(c.fecha_inicio), fecha_fin: aInputPanama(c.fecha_fin) });
  const guardarCampana = async () => {
    if (!campForm.nombre.trim()) { alert("Escribe el nombre de la campaña (ej. Black Weekend)."); return; }
    const ini = desdeInputPanama(campForm.fecha_inicio), fin = desdeInputPanama(campForm.fecha_fin);
    if (ini && fin && new Date(fin) <= new Date(ini)) { alert("La fecha de fin debe ser después de la de inicio."); return; }
    setGuardando(true);
    try {
      const body = { prefijo: campForm.prefijo.trim(), nombre: campForm.nombre.trim(), subtitulo: campForm.subtitulo.trim() || null, color_principal: campForm.color_principal, color_secundario: campForm.color_secundario, fecha_inicio: ini, fecha_fin: fin };
      if (campForm.id) await sb.patch("campanas_ofertas", campForm.id, body);
      else { const r = await sb.post("campanas_ofertas", body); setSelId(r[0].id); }
      setCampForm(null); showToast("Campaña guardada"); await cargar();
    } catch (e) { alert("Error guardando la campaña: " + e.message); }
    setGuardando(false);
  };
  const rpc = async (fn, args) => {
    await sb.ensureFreshToken();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: sb.dataHeaders(), body: JSON.stringify(args) });
    if (!r.ok) throw new Error(await r.text());
    const txt = await r.text();
    try { return txt ? JSON.parse(txt) : null; } catch (e) { return null; } // activar_campana no devuelve nada
  };
  const activarCampana = async (c) => {
    const hayOtra = campanas.find(x => x.activa && x.id !== c.id);
    const nItems = items.filter(i => i.campana_id === c.id && i.activo).length;
    if (nItems === 0 && !confirm("Esta campaña no tiene ofertas activas todavía. ¿Activarla de todas formas?")) return;
    if (hayOtra && !confirm(`Solo puede haber una campaña activa. Se desactivará "${hayOtra.prefijo} ${hayOtra.nombre}". ¿Continuar?`)) return;
    try { await rpc("activar_campana", { p_id: c.id }); showToast("Campaña activada: ya se ve en la tienda"); await cargar(); }
    catch (e) { alert("No se pudo activar: " + e.message); }
  };
  const desactivarCampana = async (c) => {
    if (!confirm("¿Quitar esta campaña de la tienda? La página de ofertas dejará de mostrarse.")) return;
    try { await sb.patch("campanas_ofertas", c.id, { activa: false }); showToast("Campaña desactivada"); await cargar(); }
    catch (e) { alert("Error: " + e.message); }
  };
  const duplicarCampana = async (c) => {
    try { const nuevo = await rpc("duplicar_campana", { p_id: c.id }); setSelId(Number(nuevo)); showToast("Campaña duplicada (queda inactiva)"); await cargar(); }
    catch (e) { alert("No se pudo duplicar: " + e.message); }
  };
  const eliminarCampana = async (c) => {
    if (c.activa) { alert("Primero desactiva la campaña para poder eliminarla."); return; }
    if (!confirm(`¿Eliminar "${c.prefijo} ${c.nombre}" y todas sus ofertas? No se puede deshacer.`)) return;
    try { await sb.delete("campanas_ofertas", c.id); showToast("Campaña eliminada"); await cargar(); }
    catch (e) { alert("No se pudo eliminar: " + e.message); }
  };

  // ── Ofertas ──
  const nuevaOferta = (seccion) => { setBusquedaProd(""); setOfForm({ tipo: "producto", seccion, producto_id: null, presentacion: seccion === "detal" ? "pieza" : "docena", titulo: "", descripcion: "", imagen_url: "", precio_oferta: "", precio_normal_manual: "", limite_por_pedido: "", etiqueta: "", orden: String(itemsSel.filter(i => i.seccion === seccion).length), activo: true, combo: [] }); };
  const editarOferta = (o) => {
    setBusquedaProd("");
    setOfForm({
      id: o.id, tipo: o.tipo, seccion: o.seccion, producto_id: o.producto_id, presentacion: o.presentacion || "docena",
      titulo: o.titulo || "", descripcion: o.descripcion || "", imagen_url: o.imagen_url || "",
      precio_oferta: String(o.precio_oferta ?? ""), precio_normal_manual: o.precio_normal_manual != null ? String(o.precio_normal_manual) : "",
      limite_por_pedido: o.limite_por_pedido != null ? String(o.limite_por_pedido) : "", etiqueta: o.etiqueta || "", orden: String(o.orden ?? 0), activo: o.activo,
      combo: comboRows.filter(r => r.oferta_id === o.id).map(r => ({ rowId: r.id, producto_id: r.producto_id, cantidad: String(r.cantidad) })),
    });
  };
  // Resumen en vivo del formulario (normal, ahorro, costo, margen)
  const resumenForm = (f) => {
    if (!f) return null;
    const tmp = { id: -1, tipo: f.tipo, producto_id: f.producto_id, presentacion: f.presentacion, titulo: f.titulo, precio_oferta: Number(f.precio_oferta) || 0, precio_normal_manual: f.precio_normal_manual ? Number(f.precio_normal_manual) : null, imagen_url: f.imagen_url };
    const filas = f.combo.map(c => ({ oferta_id: -1, producto_id: c.producto_id, cantidad: Number(c.cantidad) || 0 }));
    if (f.tipo === "combo" && (filas.length === 0 || filas.some(r => r.cantidad <= 0))) return null;
    const info = ofertaInfo(tmp, productosPorId, filas);
    if (!info) return null;
    const costo = info.lineas.reduce((s, l) => s + costoProducto(l.product) * l.piezas, 0);
    const sinCosto = info.lineas.some(l => !(costoProducto(l.product) > 0));
    return { info, costo, sinCosto };
  };
  const guardarOferta = async () => {
    const f = ofForm;
    const precio = Number(f.precio_oferta);
    if (!(precio > 0)) { alert("Escribe el precio de la oferta."); return; }
    if (f.tipo === "producto" && !f.producto_id) { alert("Elige el producto de la oferta."); return; }
    if (f.tipo === "combo") {
      if (!f.titulo.trim()) { alert("Ponle un nombre al combo (ej. Combo Hogar)."); return; }
      if (f.combo.length < 2) { alert("Un combo necesita al menos 2 productos."); return; }
      if (f.combo.some(c => !(Number(c.cantidad) > 0))) { alert("Revisa las cantidades del combo."); return; }
    }
    const res = resumenForm(f);
    if (res && res.info.precioNormal > 0 && precio >= res.info.precioNormal && !confirm("El precio de oferta es igual o mayor al precio normal. ¿Guardar de todas formas?")) return;
    if (res && !res.sinCosto && precio < res.costo && !confirm(`El precio de oferta ($${precio.toFixed(2)}) está por DEBAJO del costo ($${res.costo.toFixed(2)}). Venderías con pérdida. ¿Guardar de todas formas?`)) return;
    setGuardando(true);
    try {
      const body = {
        campana_id: selId, tipo: f.tipo, seccion: f.seccion,
        producto_id: f.tipo === "producto" ? f.producto_id : null, presentacion: f.tipo === "producto" ? f.presentacion : null,
        titulo: f.titulo.trim() || null, descripcion: f.descripcion.trim() || null, imagen_url: f.imagen_url || null,
        precio_oferta: precio, precio_normal_manual: f.precio_normal_manual ? Number(f.precio_normal_manual) : null,
        limite_por_pedido: f.limite_por_pedido ? parseInt(f.limite_por_pedido, 10) : null, etiqueta: f.etiqueta.trim() || null,
        orden: parseInt(f.orden, 10) || 0, activo: f.activo,
      };
      let ofertaId = f.id;
      if (f.id) { delete body.campana_id; await sb.patch("ofertas_items", f.id, body); }
      else { const r = await sb.post("ofertas_items", body); ofertaId = r[0].id; }
      if (f.tipo === "combo") {
        const viejas = comboRows.filter(r => r.oferta_id === ofertaId);
        for (const v of viejas) if (!f.combo.some(c => c.rowId === v.id)) await sb.delete("ofertas_combo_productos", v.id);
        for (const c of f.combo) {
          if (c.rowId) await sb.patch("ofertas_combo_productos", c.rowId, { cantidad: parseInt(c.cantidad, 10) });
          else await sb.post("ofertas_combo_productos", { oferta_id: ofertaId, producto_id: c.producto_id, cantidad: parseInt(c.cantidad, 10) });
        }
      }
      setOfForm(null); showToast("Oferta guardada"); await cargar();
    } catch (e) { alert("Error guardando la oferta: " + e.message); }
    setGuardando(false);
  };
  const alternarOferta = async (o) => {
    try { await sb.patch("ofertas_items", o.id, { activo: !o.activo }); setItems(prev => prev.map(x => x.id === o.id ? { ...x, activo: !o.activo } : x)); }
    catch (e) { alert("Error: " + e.message); }
  };
  const eliminarOferta = async (o) => {
    if (!confirm("¿Eliminar esta oferta? No se puede deshacer.")) return;
    try { await sb.delete("ofertas_items", o.id); showToast("Oferta eliminada"); await cargar(); }
    catch (e) { alert("No se pudo eliminar: " + e.message); }
  };
  const subirImagen = async (e) => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    setSubiendoImg(true);
    try {
      const limpio = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `ofertas/${Date.now()}_${limpio}`;
      await sb.upload("banners", path, file);
      setOfForm(prev => ({ ...prev, imagen_url: `${sb.publicUrl("banners", path)}?t=${Date.now()}` }));
    } catch (err) { alert("Error subiendo la imagen: " + err.message); }
    setSubiendoImg(false);
  };

  const money = (n) => "$" + Number(n).toFixed(2);
  const inputChico = { ...S.input, marginBottom: 0, padding: "8px 10px" };

  if (cargando) return <Spinner />;

  // Buscador: ignora mayúsculas y acentos; busca en el título de la oferta, el nombre y la
  // referencia de cada producto (también los de un combo), la etiqueta y la descripción.
  const sinAcentos = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const palabrasBusqueda = sinAcentos(busquedaOferta).split(/\s+/).filter(Boolean);
  const ofertaCoincide = (o) => {
    if (palabrasBusqueda.length === 0) return true;
    const info = ofertaInfo(o, productosPorId, comboRows);
    const partes = [o.titulo, o.etiqueta, o.descripcion, info?.titulo];
    (info?.lineas || []).forEach(l => { partes.push(l.product?.nombre, l.product?.referencia); });
    const texto = sinAcentos(partes.filter(Boolean).join(" "));
    return palabrasBusqueda.every(w => texto.includes(w));
  };

  const renderSeccion = (seccion, titulo, ayuda) => {
    const todasSeccion = itemsSel.filter(i => i.seccion === seccion);
    const lista = todasSeccion.filter(ofertaCoincide);
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{titulo} <span style={{ fontSize: 12, color: GRAY3, fontWeight: 700 }}>({palabrasBusqueda.length ? `${lista.length} de ${todasSeccion.length}` : lista.length})</span></div>
          <button onClick={() => nuevaOferta(seccion)} className="oft-btn-press" style={{ ...S.btnRed, padding: "8px 14px", fontSize: 13 }}><Plus size={15} /> Agregar oferta o combo</button>
        </div>
        <div style={{ fontSize: 12, color: GRAY3, marginBottom: 12 }}>{ayuda}</div>
        {lista.length === 0 ? (
          <div style={{ border: `1px dashed ${GRAY2}`, borderRadius: 12, padding: 22, textAlign: "center", color: GRAY3, fontSize: 13 }}>{palabrasBusqueda.length ? `Ninguna oferta de esta sección coincide con "${busquedaOferta.trim()}".` : "Aún no hay ofertas en esta sección."}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {lista.map(o => {
              const info = ofertaInfo(o, productosPorId, comboRows);
              const costo = info ? info.lineas.reduce((s, l) => s + costoProducto(l.product) * l.piezas, 0) : 0;
              const bajoCosto = info && costo > 0 && Number(o.precio_oferta) < costo;
              return (
                <div key={o.id} style={{ display: "flex", gap: 12, alignItems: "center", background: WHITE, border: `1px solid ${info ? GRAY2 : RED}`, borderRadius: 12, padding: 12, opacity: o.activo ? 1 : 0.55, flexWrap: "wrap" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 10, background: GRAY, overflow: "hidden", flexShrink: 0 }}>
                    {info?.imagen && <img src={imagenOptimizada ? imagenOptimizada(info.imagen, 160) : info.imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {info ? info.titulo : "⚠ Producto no disponible"}
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: o.tipo === "combo" ? "#EDE7FF" : "#E3F2FD", color: o.tipo === "combo" ? "#4B2BB5" : "#0D47A1" }}>{o.tipo === "combo" ? "COMBO" : "PRODUCTO"}</span>
                      {o.etiqueta && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: "#FFF3CD", color: "#856404" }}>{o.etiqueta}</span>}
                    </div>
                    {info && (
                      <div style={{ fontSize: 12, color: GRAY3, marginTop: 3 }}>
                        {o.tipo === "combo" ? info.lineas.map(l => `${l.piezas}× ${l.product.nombre}`).join(" + ") : `${info.totalPiezas} pieza${info.totalPiezas > 1 ? "s" : ""} (${{ pieza: "pieza", media: "media docena", docena: "docena" }[o.presentacion]})`}
                      </div>
                    )}
                    {info && (
                      <div style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <span style={{ textDecoration: "line-through", color: GRAY3, fontSize: 13 }}>{money(info.precioNormal)}</span>
                        <span style={{ fontWeight: 900, color: RED, fontSize: 17 }}>{money(info.precioOferta)}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, background: info.pct > 0 ? "#D4EDDA" : "#FDE2E2", color: info.pct > 0 ? "#155724" : "#9B1C1C", padding: "2px 7px", borderRadius: 6 }}>{info.pct > 0 ? `-${info.pct}%` : "sin ahorro"}</span>
                        {bajoCosto && <span style={{ fontSize: 11, fontWeight: 800, color: "#9B1C1C", display: "inline-flex", alignItems: "center", gap: 3 }}><AlertTriangle size={12} /> bajo el costo ({money(costo)})</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => alternarOferta(o)} title={o.activo ? "Ocultar" : "Mostrar"} className="oft-btn-press" style={{ background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex" }}>{o.activo ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                    <button onClick={() => editarOferta(o)} className="oft-btn-press" style={{ background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex" }}><PencilIcon size={15} /></button>
                    <button onClick={() => eliminarOferta(o)} className="oft-btn-press" style={{ background: WHITE, border: `1.5px solid ${RED}`, color: RED, borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const productosFiltrados = (() => {
    const q = busquedaProd.trim().toLowerCase();
    const base = products.filter(p => p.activo !== false);
    if (!q) return base.slice(0, 40);
    return base.filter(p => `${p.nombre} ${p.referencia || ""}`.toLowerCase().includes(q)).slice(0, 40);
  })();
  const res = ofForm ? resumenForm(ofForm) : null;
  // Precios "de antes" que se pueden mostrar tachados: los de la web del producto
  const opcionesAntes = (() => {
    if (!ofForm) return [];
    const perf = (p) => p?.modalidad_presentacion === "perfumeria";
    if (ofForm.tipo === "producto") {
      const p = productosPorId[ofForm.producto_id];
      if (!p) return [];
      const nPiezas = piezasDePresentacion(p, ofForm.presentacion);
      const autoValor = presUnitPrice(p, ofForm.presentacion);
      const ops = [
        { key: "pieza", label: "Pieza (web)", valor: Number(p.precio_pieza), pres: "pieza" },
        { key: "media", label: perf(p) ? "3 piezas (web)" : "Media docena (web)", valor: Number(p.precio_media_docena), pres: "media" },
        { key: "docena", label: perf(p) ? "6 piezas (web)" : "Docena (web)", valor: Number(p.precio_docena), pres: "docena" },
      ].map(o => ({ ...o, auto: o.pres === ofForm.presentacion }));
      if (nPiezas > 1) ops.push({ key: "sueltas", label: `${nPiezas} piezas sueltas`, valor: Number(p.precio_pieza) * nPiezas, auto: false });
      return ops.filter(o => o.valor > 0 || o.auto);
    }
    const filas = ofForm.combo.map(c => ({ p: productosPorId[c.producto_id], q: Number(c.cantidad) || 0 })).filter(x => x.p && x.q > 0);
    if (filas.length === 0) return [];
    return [
      { key: "auto", label: "Suma de precios de la web", valor: filas.reduce((sm, x) => sm + precioNormalPiezas(x.p, x.q), 0), auto: true },
      { key: "sueltas", label: "Todo por pieza suelta", valor: filas.reduce((sm, x) => sm + Number(x.p.precio_pieza) * x.q, 0), auto: false },
    ];
  })();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Tag size={24} color={RED} /> Ofertas y combos</div>
        <button onClick={nuevaCampana} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 18px", fontSize: 14 }}><Plus size={16} /> Nueva campaña</button>
      </div>
      <p style={{ fontSize: 13, color: GRAY3, marginBottom: 20, maxWidth: 640 }}>
        Crea una campaña (Black Weekend, Día de la Madre…), agrégale ofertas y combos en <strong>Detal</strong> o <strong>Mayor</strong>, y actívala. Solo <strong>una campaña</strong> se muestra a la vez en la página <strong>/ofertas</strong>. Los códigos de descuento no se acumulan con las ofertas.
      </p>

      {campanas.length === 0 ? (
        <div style={{ background: WHITE, border: `1px dashed ${GRAY2}`, borderRadius: 14, padding: 40, textAlign: "center", color: GRAY3 }}>
          <Tag size={36} color={GRAY3} strokeWidth={1.4} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Aún no tienes campañas</div>
          <div style={{ fontSize: 13 }}>Crea la primera con el botón de arriba.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 24 }}>
            {campanas.map(c => {
              const est = estadoCampana(c); const n = items.filter(i => i.campana_id === c.id).length;
              return (
                <div key={c.id} onClick={() => setSelId(c.id)} style={{ cursor: "pointer", background: WHITE, borderRadius: 14, border: `2px solid ${selId === c.id ? RED : GRAY2}`, padding: 14, borderTop: `5px solid ${c.color_principal}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>{c.prefijo} {c.nombre}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 8, background: est.bg, color: est.color, whiteSpace: "nowrap" }}>{est.txt}</span>
                  </div>
                  <div style={{ fontSize: 12, color: GRAY3, marginTop: 6 }}>{n} oferta{n !== 1 ? "s" : ""}</div>
                  {(c.fecha_inicio || c.fecha_fin) && <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>{c.fecha_inicio ? fechaCortaPanama(c.fecha_inicio) : "ya"} → {c.fecha_fin ? fechaCortaPanama(c.fecha_fin) : "sin fin"}</div>}
                </div>
              );
            })}
          </div>

          {sel && (
            <div style={{ background: GRAY, borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                <div style={{ fontSize: 19, fontWeight: 900 }}>{sel.prefijo} <span style={{ color: sel.color_principal }}>{sel.nombre}</span></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {sel.activa
                    ? <button onClick={() => desactivarCampana(sel)} className="oft-btn-press" style={{ background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Desactivar</button>
                    : <button onClick={() => activarCampana(sel)} className="oft-btn-press" style={{ ...S.btnRed, padding: "8px 14px", fontSize: 13 }}><Zap size={14} /> Activar campaña</button>}
                  {sel.activa && <a href="/ofertas" target="_blank" rel="noreferrer" style={{ background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, color: BLACK, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}><ArrowUpRight size={14} /> Ver página</a>}
                  <button onClick={() => editarCampana(sel)} className="oft-btn-press" style={{ background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13 }}><PencilIcon size={14} /> Editar</button>
                  <button onClick={() => duplicarCampana(sel)} className="oft-btn-press" style={{ background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Duplicar</button>
                  <button onClick={() => eliminarCampana(sel)} className="oft-btn-press" style={{ background: WHITE, border: `1.5px solid ${RED}`, color: RED, borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
                </div>
              </div>
              <div style={{ position: "relative", marginBottom: 18, maxWidth: 460 }}>
                <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input value={busquedaOferta} onChange={e => setBusquedaOferta(e.target.value)} placeholder="Buscar oferta por producto, referencia o título…"
                  style={{ ...S.input, paddingLeft: 36, paddingRight: busquedaOferta ? 34 : 12, marginBottom: 0, background: WHITE }} />
                {busquedaOferta && (
                  <button onClick={() => setBusquedaOferta("")} title="Borrar búsqueda" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}><X size={16} color={GRAY3} /></button>
                )}
              </div>
              {renderSeccion("detal", "Ofertas al detal", "Para clientes que compran pocas piezas o por unidad.")}
              {renderSeccion("mayor", "Ofertas al mayor", "Para docenas, medias docenas y combos de volumen.")}
            </div>
          )}
        </>
      )}

      {/* MODAL CAMPAÑA */}
      {campForm && (
        <div className="oft-overlay" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto" }} onClick={() => !guardando && setCampForm(null)}>
          <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 480, width: "100%", margin: "20px auto", padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{campForm.id ? "Editar" : "Nueva"} campaña</div>
              <button onClick={() => setCampForm(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10 }}>
              <div><label style={S.label}>Texto inicial</label><input style={S.input} value={campForm.prefijo} onChange={e => setCampForm({ ...campForm, prefijo: e.target.value })} placeholder="Ofertas de" /></div>
              <div><label style={S.label}>Nombre *</label><input style={S.input} value={campForm.nombre} onChange={e => setCampForm({ ...campForm, nombre: e.target.value })} placeholder="Black Weekend" /></div>
            </div>
            <div style={{ background: campForm.color_secundario, color: WHITE, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontWeight: 900, fontSize: 18 }}>{campForm.prefijo} <span style={{ color: campForm.color_principal }}>{campForm.nombre || "…"}</span></div>
            <label style={S.label}>Frase corta (opcional)</label>
            <input style={S.input} value={campForm.subtitulo} onChange={e => setCampForm({ ...campForm, subtitulo: e.target.value })} placeholder="Precios que no vuelven. Hasta agotar existencias." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={S.label}>Color principal</label><input type="color" value={campForm.color_principal} onChange={e => setCampForm({ ...campForm, color_principal: e.target.value })} style={{ width: "100%", height: 40, border: `1.5px solid ${GRAY2}`, borderRadius: 8, marginBottom: 14, padding: 2 }} /></div>
              <div><label style={S.label}>Color de fondo</label><input type="color" value={campForm.color_secundario} onChange={e => setCampForm({ ...campForm, color_secundario: e.target.value })} style={{ width: "100%", height: 40, border: `1.5px solid ${GRAY2}`, borderRadius: 8, marginBottom: 14, padding: 2 }} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={S.label}>Empieza (hora de Panamá)</label><input type="datetime-local" style={S.input} value={campForm.fecha_inicio} onChange={e => setCampForm({ ...campForm, fecha_inicio: e.target.value })} /></div>
              <div><label style={S.label}>Termina</label><input type="datetime-local" style={S.input} value={campForm.fecha_fin} onChange={e => setCampForm({ ...campForm, fecha_fin: e.target.value })} /></div>
            </div>
            <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14 }}>Si pones fecha de fin, la tienda muestra un contador regresivo y la campaña se oculta sola al terminar. Déjalas vacías para que dure hasta que la desactives.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCampForm(null)} disabled={guardando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button onClick={guardarCampana} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>{guardando ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OFERTA */}
      {ofForm && (
        <div className="oft-overlay" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto" }} onClick={() => !guardando && setOfForm(null)}>
          <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 620, width: "100%", margin: "20px auto", padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{ofForm.id ? "Editar" : "Nueva"} oferta · {ofForm.seccion === "detal" ? "Detal" : "Mayor"}</div>
              <button onClick={() => setOfForm(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[["producto", "Un producto", "Un producto con precio rebajado"], ["combo", "Combo", "Varios productos fijos a un precio"]].map(([k, t, d]) => (
                <div key={k} onClick={() => !ofForm.id && setOfForm({ ...ofForm, tipo: k })} style={{ border: `2px solid ${ofForm.tipo === k ? RED : GRAY2}`, background: ofForm.tipo === k ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 12, cursor: ofForm.id ? "default" : "pointer", opacity: ofForm.id && ofForm.tipo !== k ? 0.4 : 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t}</div><div style={{ fontSize: 11, color: GRAY3 }}>{d}</div>
                </div>
              ))}
            </div>

            <label style={S.label}>Sección</label>
            <select style={S.input} value={ofForm.seccion} onChange={e => setOfForm({ ...ofForm, seccion: e.target.value })}>
              <option value="detal">Ofertas al detal</option><option value="mayor">Ofertas al mayor</option>
            </select>

            {ofForm.tipo === "producto" ? (
              <>
                <label style={S.label}>Producto *</label>
                {ofForm.producto_id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: 8, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: GRAY, overflow: "hidden" }}>{productosPorId[ofForm.producto_id]?.imagen_url && <img src={productosPorId[ofForm.producto_id].imagen_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{productosPorId[ofForm.producto_id]?.nombre || "Producto"}</div>
                    <button onClick={() => setOfForm({ ...ofForm, producto_id: null })} style={{ background: "none", border: "none", cursor: "pointer", color: RED, fontWeight: 700, fontSize: 12 }}>Cambiar</button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 14 }}>
                    <input style={{ ...S.input, marginBottom: 6 }} placeholder="Buscar por nombre o referencia…" value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)} />
                    <div style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, maxHeight: 200, overflowY: "auto" }}>
                      {productosFiltrados.map(p => (
                        <div key={p.id} onClick={() => setOfForm({ ...ofForm, producto_id: p.id })} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${GRAY}`, fontSize: 13 }}>{p.nombre} <span style={{ color: GRAY3, fontSize: 11 }}>{p.referencia}</span></div>
                      ))}
                    </div>
                  </div>
                )}
                <label style={S.label}>Presentación en oferta</label>
                <select style={S.input} value={ofForm.presentacion} onChange={e => setOfForm({ ...ofForm, presentacion: e.target.value })}>
                  <option value="pieza">Pieza</option><option value="media">Media docena{productosPorId[ofForm.producto_id]?.modalidad_presentacion === "perfumeria" ? " (3 piezas)" : " (6 piezas)"}</option><option value="docena">Docena{productosPorId[ofForm.producto_id]?.modalidad_presentacion === "perfumeria" ? " (6 piezas)" : " (12 piezas)"}</option>
                </select>
                <label style={S.label}>Nombre de la oferta (opcional)</label>
                <input style={S.input} value={ofForm.titulo} onChange={e => setOfForm({ ...ofForm, titulo: e.target.value })} placeholder="Si lo dejas vacío usa el nombre del producto" />
              </>
            ) : (
              <>
                <label style={S.label}>Nombre del combo *</label>
                <input style={S.input} value={ofForm.titulo} onChange={e => setOfForm({ ...ofForm, titulo: e.target.value })} placeholder="Combo Hogar, Pack Regreso a Clases…" />
                <label style={S.label}>Productos del combo ({ofForm.combo.length})</label>
                {ofForm.combo.map((c, idx) => (
                  <div key={c.producto_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{productosPorId[c.producto_id]?.nombre || "Producto"}</div>
                    <input type="number" min="1" style={{ ...inputChico, width: 70 }} value={c.cantidad} onChange={e => setOfForm({ ...ofForm, combo: ofForm.combo.map((x, i) => i === idx ? { ...x, cantidad: e.target.value } : x) })} />
                    <span style={{ fontSize: 12, color: GRAY3 }}>pzs</span>
                    <button onClick={() => setOfForm({ ...ofForm, combo: ofForm.combo.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", cursor: "pointer", color: RED, display: "flex" }}><X size={16} /></button>
                  </div>
                ))}
                <input style={{ ...S.input, marginBottom: 6 }} placeholder="Buscar producto para agregar al combo…" value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)} />
                <div style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, maxHeight: 160, overflowY: "auto", marginBottom: 14 }}>
                  {productosFiltrados.filter(p => !ofForm.combo.some(c => c.producto_id === p.id)).map(p => (
                    <div key={p.id} onClick={() => setOfForm({ ...ofForm, combo: [...ofForm.combo, { producto_id: p.id, cantidad: "1" }] })} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${GRAY}`, fontSize: 13 }}>+ {p.nombre} <span style={{ color: GRAY3, fontSize: 11 }}>{p.referencia}</span></div>
                  ))}
                </div>
                <label style={S.label}>Descripción corta (opcional)</label>
                <input style={S.input} value={ofForm.descripcion} onChange={e => setOfForm({ ...ofForm, descripcion: e.target.value })} placeholder="Todo lo que necesitas en un solo paquete" />
              </>
            )}

            <label style={S.label}>Precio de oferta *</label>
            <input type="number" step="0.01" min="0" style={S.input} value={ofForm.precio_oferta} onChange={e => setOfForm({ ...ofForm, precio_oferta: e.target.value })} placeholder="0.00" />

            {opcionesAntes.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Precio de antes (el que se verá tachado) — elige uno</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {opcionesAntes.map(op => {
                    const activo = op.auto ? !ofForm.precio_normal_manual : (ofForm.precio_normal_manual !== "" && Math.abs(Number(ofForm.precio_normal_manual) - op.valor) < 0.005);
                    return (
                      <div key={op.key} onClick={() => setOfForm({ ...ofForm, precio_normal_manual: op.auto ? "" : op.valor.toFixed(2) })}
                        style={{ cursor: "pointer", border: `2px solid ${activo ? RED : GRAY2}`, background: activo ? "#FFF5F5" : WHITE, borderRadius: 10, padding: "8px 12px", minWidth: 110 }}>
                        <div style={{ fontSize: 11, color: GRAY3, fontWeight: 700 }}>{op.label}{op.auto ? " · automático" : ""}</div>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>{money(op.valor)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: GRAY3 }}>¿Otro valor?</span>
                  <input type="number" step="0.01" min="0" style={{ ...inputChico, width: 110 }} value={ofForm.precio_normal_manual} onChange={e => setOfForm({ ...ofForm, precio_normal_manual: e.target.value })} placeholder="Escríbelo" />
                </div>
              </div>
            )}

            {res && (
              <div style={{ background: GRAY, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>{res.info.totalPiezas} pieza{res.info.totalPiezas > 1 ? "s" : ""} · precio normal</span><strong>{money(res.info.precioNormal)}</strong></div>
                {Number(ofForm.precio_oferta) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: res.info.pct > 0 ? "#155724" : "#9B1C1C" }}><span>El cliente ahorra</span><strong>{money(res.info.ahorro)} ({res.info.pct}%)</strong></div>}
                {!res.sinCosto && res.costo > 0 && Number(ofForm.precio_oferta) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: Number(ofForm.precio_oferta) < res.costo ? "#9B1C1C" : GRAY3 }}><span>Costo · margen</span><strong>{money(res.costo)} · {money(Number(ofForm.precio_oferta) - res.costo)}</strong></div>
                )}
                {res.sinCosto && <div style={{ fontSize: 11, color: GRAY3, marginTop: 4 }}>Algún producto no tiene costo cargado: no se puede calcular el margen.</div>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={S.label}>Máximo por pedido (opcional)</label><input type="number" min="1" style={S.input} value={ofForm.limite_por_pedido} onChange={e => setOfForm({ ...ofForm, limite_por_pedido: e.target.value })} placeholder="Sin límite" /></div>
              <div><label style={S.label}>Etiqueta (opcional)</label><input style={S.input} value={ofForm.etiqueta} onChange={e => setOfForm({ ...ofForm, etiqueta: e.target.value })} placeholder="Más vendido, Últimas…" /></div>
            </div>

            <label style={S.label}>Imagen {ofForm.tipo === "combo" ? "del combo" : "(opcional, si no usa la del producto)"}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 64, height: 64, borderRadius: 10, background: GRAY, overflow: "hidden", flexShrink: 0 }}>{(ofForm.imagen_url || res?.info.imagen) && <img src={ofForm.imagen_url || res.info.imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
              <input ref={imgRef} type="file" accept="image/*" onChange={subirImagen} style={{ display: "none" }} />
              <button onClick={() => imgRef.current?.click()} disabled={subiendoImg} className="oft-btn-press" style={{ ...S.btnOutline, padding: "8px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}><Upload size={14} /> {subiendoImg ? "Subiendo…" : "Subir imagen"}</button>
              {ofForm.imagen_url && <button onClick={() => setOfForm({ ...ofForm, imagen_url: "" })} style={{ background: "none", border: "none", cursor: "pointer", color: GRAY3, fontSize: 12 }}>Quitar</button>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={S.label}>Orden (menor = primero)</label><input type="number" style={S.input} value={ofForm.orden} onChange={e => setOfForm({ ...ofForm, orden: e.target.value })} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, marginTop: 24, cursor: "pointer" }}><input type="checkbox" checked={ofForm.activo} onChange={e => setOfForm({ ...ofForm, activo: e.target.checked })} /> Visible en la tienda</label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setOfForm(null)} disabled={guardando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button onClick={guardarOferta} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>{guardando ? "Guardando..." : "Guardar oferta"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════ PROTECCIÓN ANTI-FRAUDE (pestaña "Fraude") ═══════════
// Insignia chica para mostrar el riesgo de un pedido con tarjeta en las listas de Pedidos.
function InsigniaRiesgo({ r, style }) {
  if (!r) return null;
  let txt = null, fondo = "#E8F5E9", color = "#1B5E20";
  if (r.contracargo) { txt = "CONTRACARGO"; fondo = "#FDE8E8"; color = "#B71C1C"; }
  else if (r.revision_estado === "pendiente") { txt = "Retenido: verificar antes de enviar"; fondo = "#FDE8E8"; color = "#B71C1C"; }
  else if (r.revision_estado === "rechazado") { txt = "Rechazado por riesgo"; fondo = "#EEE"; color = "#555"; }
  else if (r.revision_estado === "aprobado") { txt = "Riesgo revisado y aprobado"; fondo = "#E8F5E9"; color = "#1B5E20"; }
  else if (r.nivel === "medio") { txt = "Riesgo medio"; fondo = "#FFF4D6"; color = "#8A5A00"; }
  if (!txt) return null;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: fondo, color, ...style }}><AlertTriangle size={11} />{txt}</span>;
}

function telWhatsApp(t) {
  let p = String(t || "").replace(/\D/g, "");
  if (p.length === 8) p = "507" + p;
  return p;
}

const TIPOS_BLOQUEO = [
  ["email", "Correo"], ["telefono", "Teléfono"], ["usuario", "Cuenta (id)"],
  ["visitante", "Dispositivo (id)"], ["pan_token", "Tarjeta (token)"], ["ip", "IP"],
];

function FraudePanel({ onCambio }) {
  const { showToast } = useApp();
  const [cargando, setCargando] = useState(true);
  const [riesgos, setRiesgos] = useState([]);
  const [pedidosMap, setPedidosMap] = useState({});
  const [itemsMap, setItemsMap] = useState({});
  const [tarjetas, setTarjetas] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [config, setConfig] = useState(null);
  const [cfgForm, setCfgForm] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [busca, setBusca] = useState("");
  const [nuevo, setNuevo] = useState({ tipo: "email", valor: "", motivo: "" });
  const [verOtros, setVerOtros] = useState(false);

  const cargar = async () => {
    try {
      const [rs, bl, ev, cf, tj] = await Promise.all([
        sb.get("pedidos_riesgo", "?order=created_at.desc&limit=300").catch(() => []),
        sb.get("fraude_bloqueos", "?order=created_at.desc&limit=500").catch(() => []),
        sb.get("antifraude_eventos", "?order=created_at.desc&limit=40").catch(() => []),
        sb.get("antifraude_config", "?id=eq.1").catch(() => []),
        sb.get("pedidos", "?metodo_pago=eq.tarjeta&pagado=eq.true&order=created_at.desc&limit=120").catch(() => []),
      ]);
      setRiesgos(rs || []); setBloqueos(bl || []); setEventos(ev || []); setTarjetas(tj || []);
      if (cf && cf[0]) { setConfig(cf[0]); setCfgForm(f => f || { activo: cf[0].activo, monto_alto: String(cf[0].monto_alto), monto_muy_alto: String(cf[0].monto_muy_alto), retener_desde: String(cf[0].retener_desde), avisar_desde: String(cf[0].avisar_desde) }); }
      const ids = [...new Set((rs || []).map(r => r.pedido_id))];
      if (ids.length) {
        const [ps, its] = await Promise.all([
          sb.get("pedidos", `?id=in.(${ids.join(",")})`).catch(() => []),
          sb.get("pedido_items", `?pedido_id=in.(${ids.join(",")})`).catch(() => []),
        ]);
        const pm = {}; (ps || []).forEach(p => { pm[p.id] = p; });
        const im = {}; (its || []).forEach(i => { (im[i.pedido_id] = im[i.pedido_id] || []).push(i); });
        setPedidosMap(pm); setItemsMap(im);
      } else { setPedidosMap({}); setItemsMap({}); }
    } catch (e) { console.error(e); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);
  useRefrescoPeriodico(cargar, 60000);

  const rpc = async (fn, args) => {
    await sb.ensureFreshToken();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: sb.dataHeaders(), body: JSON.stringify(args) });
    if (!r.ok) throw new Error(await r.text());
    const t = await r.text();
    try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
  };

  const aprobar = async (pid) => {
    if (!confirm("¿Aprobar este pedido?\n\nSe creará la venta en Odoo y se enviará la confirmación al cliente. Hazlo solo después de verificar la compra con el cliente.")) return;
    setOcupado(pid);
    try {
      await sb.ensureFreshToken();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/revisar-pedido-riesgo`, { method: "POST", headers: sb.functionHeaders(), body: JSON.stringify({ pedido_id: pid }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo aprobar");
      if (d.odoo_ok === false) alert("Pedido aprobado, pero Odoo NO descontó el inventario:\n\n" + (d.odoo_detalle || "error desconocido") + "\n\nPuedes volver a pulsar «Aprobar» para reintentar, o revisar en Odoo.");
      else showToast("Pedido aprobado y enviado a Odoo");
      await cargar(); onCambio && onCambio();
    } catch (e) { alert("No se pudo aprobar: " + e.message); }
    setOcupado(null);
  };
  const rechazar = async (pid, codigo) => {
    const nota = prompt(`Rechazar el pedido ${codigo}.\n\nEscribe el motivo (queda guardado):`, "No se pudo verificar la compra");
    if (nota === null) return;
    const bloquear = confirm("¿Bloquear también al cliente (cuenta, correo, teléfono y dispositivo) para que no pueda volver a pagar con tarjeta?\n\nAceptar = bloquear\nCancelar = solo rechazar");
    setOcupado(pid);
    try {
      await rpc("antifraude_rechazar", { p_pedido_id: pid, p_nota: nota || null, p_bloquear: bloquear });
      alert("Pedido rechazado.\n\nIMPORTANTE: el cobro ya se hizo. Devuelve el dinero al cliente desde el portal de BAC / Powertranz (reembolso o anulación) y avísale por WhatsApp.");
      await cargar(); onCambio && onCambio();
    } catch (e) { alert("No se pudo rechazar: " + e.message); }
    setOcupado(null);
  };
  const contracargo = async (p) => {
    const nota = prompt(`Marcar contracargo en el pedido ${p.codigo} ($${Number(p.total).toFixed(2)}).\n\nEsto bloqueará la cuenta, correo, teléfono y dispositivo del cliente.\nNota (opcional):`, "");
    if (nota === null) return;
    setOcupado(p.id);
    try {
      const d = await rpc("antifraude_contracargo", { p_pedido_id: p.id, p_nota: nota || null });
      showToast(`Contracargo marcado. Bloqueos nuevos: ${d?.bloqueos_nuevos ?? 0}`);
      await cargar(); onCambio && onCambio();
    } catch (e) { alert("No se pudo marcar: " + e.message); }
    setOcupado(null);
  };
  const agregarBloqueo = async () => {
    const valor = nuevo.valor.trim();
    if (!valor) { showToast("Escribe el valor a bloquear"); return; }
    try {
      await sb.post("fraude_bloqueos", { tipo: nuevo.tipo, valor: nuevo.tipo === "email" ? valor.toLowerCase() : valor, motivo: nuevo.motivo.trim() || "Bloqueo manual" });
      setNuevo({ tipo: nuevo.tipo, valor: "", motivo: "" });
      showToast("Bloqueo agregado"); await cargar(); onCambio && onCambio();
    } catch (e) { alert("No se pudo bloquear (¿ya existe?): " + (e.message || "")); }
  };
  const quitarBloqueo = async (b) => {
    if (!confirm(`¿Quitar el bloqueo de ${b.valor}?\nEsa persona podrá volver a pagar con tarjeta.`)) return;
    try { await sb.delete("fraude_bloqueos", b.id); showToast("Bloqueo quitado"); await cargar(); } catch (e) { alert("No se pudo quitar: " + (e.message || "")); }
  };
  const guardarConfig = async () => {
    const n = (x) => Number(String(x).replace(",", "."));
    const f = cfgForm;
    if (![f.monto_alto, f.monto_muy_alto, f.retener_desde, f.avisar_desde].every(x => Number.isFinite(n(x)) && n(x) >= 0)) { alert("Revisa que los números sean válidos."); return; }
    if (n(f.monto_muy_alto) < n(f.monto_alto) || n(f.retener_desde) < n(f.avisar_desde)) { alert("El «muy alto» debe ser mayor que el «alto», y retener mayor o igual que avisar."); return; }
    try {
      await sb.patch("antifraude_config", 1, { activo: !!f.activo, monto_alto: n(f.monto_alto), monto_muy_alto: n(f.monto_muy_alto), retener_desde: Math.round(n(f.retener_desde)), avisar_desde: Math.round(n(f.avisar_desde)), updated_at: new Date().toISOString() });
      showToast("Reglas guardadas"); await cargar();
    } catch (e) { alert("No se pudo guardar: " + (e.message || "")); }
  };

  const pendientes = riesgos.filter(r => r.revision_estado === "pendiente");
  const revisados = riesgos.filter(r => r.revision_estado && r.revision_estado !== "pendiente");
  const contracargos = riesgos.filter(r => r.contracargo);
  const riesgoDe = {}; riesgos.forEach(r => { riesgoDe[r.pedido_id] = r; });
  const q = busca.trim().toLowerCase();
  const tarjetasFiltradas = tarjetas.filter(p => !q || String(p.codigo || "").toLowerCase().includes(q) || String(p.nombre_cliente || "").toLowerCase().includes(q)).slice(0, 25);
  const fmtF = (iso) => { try { return new Date(iso).toLocaleString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const caja = { background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 18, marginBottom: 20 };
  const titulo = { fontSize: 16, fontWeight: 900, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 };
  const btn = (bg, col = WHITE) => ({ background: bg, color: col, border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" });
  const inp = { padding: "9px 12px", border: `1px solid ${GRAY2}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit" };

  if (cargando) return <div style={{ padding: 40, textAlign: "center" }}><Spinner /></div>;

  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}><Lock size={24} color={RED} /> Protección contra fraude</div>
      <div style={{ fontSize: 13, color: GRAY3, marginBottom: 20, maxWidth: 760 }}>
        Los pagos con tarjeta que se ven riesgosos quedan <b>retenidos</b>: no se descuenta inventario ni se confirma al cliente hasta que tú los apruebes. Verifica por WhatsApp antes de enviar.
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        {[["Por revisar", pendientes.length, pendientes.length ? "#B71C1C" : "#155724"], ["Contracargos", contracargos.length, "#856404"], ["Bloqueos activos", bloqueos.length, GRAY3]].map(([l, n, c]) => (
          <div key={l} style={S.statCard}><div style={{ fontSize: 28, fontWeight: 900, color: c }}>{n}</div><div style={{ fontSize: 13, color: GRAY3 }}>{l}</div></div>
        ))}
      </div>

      {/* ── Pedidos retenidos ── */}
      <div style={caja}>
        <div style={titulo}><AlertTriangle size={18} color="#B71C1C" /> Pedidos retenidos por revisar</div>
        {pendientes.length === 0 && <div style={{ color: GRAY3, fontSize: 14 }}>No hay pedidos retenidos. Todo en orden.</div>}
        {pendientes.map(r => {
          const p = pedidosMap[r.pedido_id]; if (!p) return null;
          const its = itemsMap[p.id] || [];
          const wa = telWhatsApp(p.telefono);
          const msg = `Hola ${p.nombre_cliente || ""}, te escribimos de Ofertodo. Para proteger tu compra con tarjeta (pedido ${p.codigo}, $${Number(p.total).toFixed(2)}) necesitamos confirmar que fuiste tú. ¿Nos confirmas tu nombre completo y los últimos 4 dígitos de la tarjeta?`;
          return (
            <div key={p.id} style={{ border: "2px solid #F5B5B5", background: "#FFF8F8", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{p.codigo} · ${Number(p.total).toFixed(2)}</div>
                  <div style={{ fontSize: 13, color: GRAY3 }}>{p.nombre_cliente} · {p.telefono || "sin teléfono"} · {fmtF(p.created_at)}</div>
                  <div style={{ fontSize: 12, color: GRAY3 }}>{p.retiro_local ? "Retiro en el local" : (p.direccion || "Sin dirección")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900, color: "#B71C1C" }}>Riesgo {r.puntaje} pts</div>
                  <div style={{ fontSize: 12, color: GRAY3 }}>{r.tds_estado ? `3D-Secure: ${r.tds_estado}${r.tds_eci ? " · ECI " + r.tds_eci : ""}` : "3D-Secure: sin dato"}{r.tarjeta_marca ? " · " + r.tarjeta_marca : ""}{r.pais_ip ? " · " + r.pais_ip : ""}</div>
                </div>
              </div>
              <ul style={{ margin: "10px 0", paddingLeft: 18, fontSize: 13 }}>
                {(Array.isArray(r.motivos) ? r.motivos : []).map((m, i) => <li key={i}>{m.texto} <span style={{ color: GRAY3 }}>({m.puntos > 0 ? "+" : ""}{m.puntos})</span></li>)}
              </ul>
              <div style={{ fontSize: 12, color: GRAY3, marginBottom: 10 }}>{its.map(i => `${i.cantidad}× ${i.nombre_producto}`).join(" · ")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" style={{ ...btn("#25D366"), textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}><MessageCircle size={14} /> Verificar por WhatsApp</a>}
                <button disabled={ocupado === p.id} onClick={() => aprobar(p.id)} style={{ ...btn("#155724"), opacity: ocupado === p.id ? 0.6 : 1 }}>Aprobar</button>
                <button disabled={ocupado === p.id} onClick={() => rechazar(p.id, p.codigo)} style={{ ...btn("#B71C1C"), opacity: ocupado === p.id ? 0.6 : 1 }}>Rechazar y devolver dinero</button>
              </div>
            </div>
          );
        })}
        {revisados.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <button onClick={() => setVerOtros(v => !v)} style={{ background: "none", border: "none", color: RED, fontWeight: 800, cursor: "pointer", fontSize: 13, padding: 0 }}>{verOtros ? "Ocultar" : "Ver"} revisados ({revisados.length})</button>
            {verOtros && revisados.map(r => {
              const p = pedidosMap[r.pedido_id]; if (!p) return null;
              const reintentar = r.revision_estado === "aprobado" && r.odoo_ok === false;
              return (
                <div key={r.pedido_id} style={{ borderTop: `1px solid ${GRAY2}`, padding: "8px 0", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div><b>{p.codigo}</b> · ${Number(p.total).toFixed(2)} · {p.nombre_cliente} — <b>{r.revision_estado}</b>{r.revision_nota ? ` («${r.revision_nota}»)` : ""}{reintentar ? <span style={{ color: "#B71C1C", fontWeight: 800 }}> · Odoo pendiente: {r.odoo_detalle}</span> : null}</div>
                  {reintentar && <button onClick={() => aprobar(p.id)} style={btn("#856404")}>Reintentar Odoo</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Contracargos ── */}
      <div style={caja}>
        <div style={titulo}><CreditCard size={18} color={RED} /> Marcar un contracargo</div>
        <div style={{ fontSize: 13, color: GRAY3, marginBottom: 10 }}>Si el banco te avisa que un pago con tarjeta fue desconocido o devuelto, búscalo aquí y márcalo: se bloquea al cliente para siempre y cualquier nuevo intento suyo queda frenado.</div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por código o nombre…" style={{ ...inp, width: "100%", maxWidth: 360, marginBottom: 10 }} />
        {tarjetasFiltradas.length === 0 && <div style={{ fontSize: 13, color: GRAY3 }}>Sin resultados.</div>}
        {tarjetasFiltradas.map(p => {
          const r = riesgoDe[p.id];
          return (
            <div key={p.id} style={{ borderTop: `1px solid ${GRAY2}`, padding: "8px 0", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
              <div><b>{p.codigo}</b> · ${Number(p.total).toFixed(2)} · {p.nombre_cliente} · {fmtF(p.created_at)} <InsigniaRiesgo r={r} style={{ marginLeft: 6 }} /></div>
              {r?.contracargo ? <span style={{ color: "#B71C1C", fontWeight: 800 }}>Contracargo marcado</span> : <button disabled={ocupado === p.id} onClick={() => contracargo(p)} style={btn("#856404")}>Marcar contracargo</button>}
            </div>
          );
        })}
      </div>

      {/* ── Bloqueos ── */}
      <div style={caja}>
        <div style={titulo}><Lock size={18} color={RED} /> Lista de bloqueo</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })} style={inp}>{TIPOS_BLOQUEO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input value={nuevo.valor} onChange={e => setNuevo({ ...nuevo, valor: e.target.value })} placeholder="Valor a bloquear" style={{ ...inp, flex: "1 1 200px" }} />
          <input value={nuevo.motivo} onChange={e => setNuevo({ ...nuevo, motivo: e.target.value })} placeholder="Motivo (opcional)" style={{ ...inp, flex: "1 1 200px" }} />
          <button onClick={agregarBloqueo} style={btn(RED)}>Bloquear</button>
        </div>
        {bloqueos.length === 0 && <div style={{ fontSize: 13, color: GRAY3 }}>Todavía no hay nada bloqueado.</div>}
        {bloqueos.slice(0, 80).map(b => (
          <div key={b.id} style={{ borderTop: `1px solid ${GRAY2}`, padding: "7px 0", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
            <div><b>{(TIPOS_BLOQUEO.find(t => t[0] === b.tipo) || [0, b.tipo])[1]}</b>: <span style={{ wordBreak: "break-all" }}>{b.valor}</span> <span style={{ color: GRAY3 }}>· {b.motivo || ""}{b.pedido_codigo ? ` · ${b.pedido_codigo}` : ""} · {fmtF(b.created_at)}</span></div>
            <button onClick={() => quitarBloqueo(b)} style={{ ...btn("transparent", "#B71C1C"), border: "1px solid #F5B5B5", padding: "5px 10px" }}>Quitar</button>
          </div>
        ))}
      </div>

      {/* ── Reglas ── */}
      {cfgForm && (
        <div style={caja}>
          <div style={titulo}><Zap size={18} color={RED} /> Reglas de revisión</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            <input type="checkbox" checked={!!cfgForm.activo} onChange={e => setCfgForm({ ...cfgForm, activo: e.target.checked })} /> Retener pedidos riesgosos (si lo apagas, solo se registra el riesgo, no se frena nada)
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, maxWidth: 760 }}>
            {[["monto_alto", "Monto alto ($)", "suma 15 puntos"], ["monto_muy_alto", "Monto muy alto ($)", "suma 30 puntos"], ["avisar_desde", "Riesgo medio desde (puntos)", "solo se marca"], ["retener_desde", "Retener desde (puntos)", "queda retenido"]].map(([k, l, h]) => (
              <label key={k} style={{ fontSize: 13, fontWeight: 700 }}>{l}<input value={cfgForm[k]} onChange={e => setCfgForm({ ...cfgForm, [k]: e.target.value })} inputMode="decimal" style={{ ...inp, width: "100%", marginTop: 4, boxSizing: "border-box" }} /><span style={{ fontWeight: 400, color: GRAY3, fontSize: 11 }}>{h}</span></label>
            ))}
          </div>
          <button onClick={guardarConfig} style={{ ...btn(RED), marginTop: 14 }}>Guardar reglas</button>
        </div>
      )}

      {/* ── Historial ── */}
      <div style={caja}>
        <div style={titulo}><ClipboardList size={18} color={RED} /> Actividad reciente</div>
        {eventos.length === 0 && <div style={{ fontSize: 13, color: GRAY3 }}>Sin actividad todavía.</div>}
        {eventos.map(e => (
          <div key={e.id} style={{ borderTop: `1px solid ${GRAY2}`, padding: "6px 0", fontSize: 12, color: GRAY3, wordBreak: "break-word" }}>
            <b style={{ color: BLACK }}>{e.tipo}</b> · {fmtF(e.created_at)} · {JSON.stringify(e.detalle || {}).slice(0, 220)}
          </div>
        ))}
      </div>
    </>
  );
}

// ═══════════ MÉTRICAS DEL NEGOCIO (pestaña "Métricas") — panel oscuro con gráficas ═══════════
// Colores validados para daltonismo sobre la superficie oscura (blue / orange / aqua del set de referencia).
const MT = {
  fondo: "#F7F7F8", tarjeta: "#FFFFFF", borde: "rgba(17,17,17,0.09)", rejilla: "rgba(17,17,17,0.07)", eje: "rgba(17,17,17,0.24)",
  texto: "#111111", texto2: "#52525B", suave: "#767680",
  rojo: "#E31E24", rojoOsc: "#B01519", tinta: "#2B2B2E",
  bueno: "#0B7A2B", malo: "#C2410C", marca: "#E31E24",
};
const usdM = (n, d = 2) => (n === null || n === undefined || Number.isNaN(Number(n))) ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pctM = (n, d = 1) => (n === null || n === undefined || Number.isNaN(Number(n))) ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
const numM = (n) => (n === null || n === undefined) ? "—" : Number(n).toLocaleString("en-US");
const usdCorto = (v) => { const n = Number(v); if (!Number.isFinite(n)) return "—"; if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K"; return "$" + Math.round(n); };
const MESES_C = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const fechaCortaM = (iso) => { const [, m, d] = String(iso).split("-").map(Number); return `${d} ${MESES_C[(m || 1) - 1]}`; };
const mesCortoM = (ym) => MESES_C[(Number(String(ym).split("-")[1]) || 1) - 1];

function sumarDiasISO(iso, dias) {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function rangoPresetMetricas(preset) {
  const hoy = fechaPanama();
  const [a, m] = hoy.split("-").map(Number);
  const primeroMes = `${a}-${String(m).padStart(2, "0")}-01`;
  if (preset === "30") return [sumarDiasISO(hoy, -29), hoy];
  if (preset === "60") return [sumarDiasISO(hoy, -59), hoy];
  if (preset === "90") return [sumarDiasISO(hoy, -89), hoy];
  if (preset === "mes") return [primeroMes, hoy];
  if (preset === "mespasado") { const fin = sumarDiasISO(primeroMes, -1); return [fin.slice(0, 8) + "01", fin]; }
  return ["2026-06-01", hoy];
}
function escalaBonita(max) {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / paso) * paso, ticks = [];
  for (let v = 0; v <= top + 1e-9; v += paso) ticks.push(v);
  return { top, ticks };
}
const sinMovimiento = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Cifra que "cuenta" hasta su valor
function useContar(objetivo, dur = 900) {
  const [v, setV] = useState(objetivo === null || objetivo === undefined ? null : (sinMovimiento() ? objetivo : 0));
  const ant = useRef(0);
  useEffect(() => {
    if (objetivo === null || objetivo === undefined || Number.isNaN(Number(objetivo))) { setV(null); return; }
    if (sinMovimiento()) { setV(objetivo); ant.current = objetivo; return; }
    const ini = ant.current || 0, t0 = performance.now(); let raf;
    const paso = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); setV(ini + (objetivo - ini) * e); if (k < 1) raf = requestAnimationFrame(paso); else ant.current = objetivo; };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo]);
  return v;
}
function Cifra({ valor, f }) { const v = useContar(valor); return <>{f(v)}</>; }
function useMontado() { const [m, setM] = useState(false); useEffect(() => { const t = requestAnimationFrame(() => requestAnimationFrame(() => setM(true))); return () => cancelAnimationFrame(t); }, []); return m; }
function useAncho(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const medir = () => { const x = Math.floor(el.getBoundingClientRect().width); if (x > 0) setW(x); };
    medir();
    let ro; if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(medir); ro.observe(el); }
    window.addEventListener("resize", medir);
    return () => { ro && ro.disconnect(); window.removeEventListener("resize", medir); };
  }, []);
  return w;
}

function Delta({ actual, previo, menorEsMejor = false }) {
  if (actual === null || actual === undefined || !(Number(previo) > 0)) return <span style={{ fontSize: 12, color: MT.suave }}>sin periodo anterior para comparar</span>;
  const pct = ((Number(actual) - Number(previo)) / Number(previo)) * 100;
  if (!Number.isFinite(pct)) return null;
  const sube = pct >= 0, bueno = menorEsMejor ? !sube : sube;
  return <span style={{ fontSize: 12, fontWeight: 700, color: Math.abs(pct) < 0.5 ? MT.texto2 : bueno ? MT.bueno : MT.malo }}>{sube ? "▲" : "▼"} {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}% <span style={{ fontWeight: 500, color: MT.suave }}>vs. periodo anterior</span></span>;
}

function Chispa({ valores, color }) {
  const pts = valores.map(v => (v === null || v === undefined ? null : Number(v)));
  const ok = pts.filter(v => v !== null);
  if (ok.length < 2) return null;
  const W = 96, H = 30, mn = Math.min(...ok), mx = Math.max(...ok), rg = mx - mn || 1;
  const xy = pts.map((v, i) => v === null ? null : [4 + (i * (W - 8)) / (pts.length - 1), H - 4 - ((v - mn) / rg) * (H - 8)]).filter(Boolean);
  const d = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const u = xy[xy.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ display: "block" }}>
      <path d={d} fill="none" stroke={MT.suave} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={u[0]} cy={u[1]} r="3" fill={color} stroke={MT.tarjeta} strokeWidth="2" />
    </svg>
  );
}

// Tarjeta con título, cifra animada, comparación y "cómo se calcula"
function Kpi({ etiqueta, children, pie, formula, grande, acento, retraso = 0 }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="met-card met-in" style={{ "--d": retraso + "ms", position: "relative", overflow: "hidden" }}>
      {acento && <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${MT.marca}, rgba(227,30,36,0) 85%)` }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div className="met-lbl">{etiqueta}</div>
        {formula && <button className="met-info" onClick={() => setVer(v => !v)} aria-expanded={ver} aria-label={`Cómo se calcula: ${etiqueta}`}>{ver ? "×" : "?"}</button>}
      </div>
      <div className={grande ? "met-big" : "met-num"}>{children}</div>
      {pie}
      {ver && formula && <div className="met-formula">{formula}</div>}
    </div>
  );
}

function Tooltip({ x, y, ancho, titulo, filas }) {
  if (x === null) return null;
  const izq = x > ancho * 0.6;
  return (
    <div className="met-tip" style={{ left: izq ? undefined : x + 14, right: izq ? ancho - x + 14 : undefined, top: Math.max(4, y) }}>
      <div className="met-tip-t">{titulo}</div>
      {filas.map((r, i) => (
        <div key={i} className="met-tip-r">
          <span style={{ width: 12, height: 3, borderRadius: 2, background: r.color || MT.suave, display: "inline-block" }} />
          <b>{r.valor}</b><span style={{ color: MT.texto2 }}>{r.nombre}</span>
        </div>
      ))}
    </div>
  );
}

function Leyenda({ series }) {
  if (series.length < 2) return null;
  return <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>{series.map(s => <span key={s.nombre} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: MT.texto2 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />{s.nombre}</span>)}</div>;
}

// Líneas / áreas con cruz de lectura y tooltip. series: [{nombre,color,valores,formato,area}]; extra: filas solo para el tooltip
function GraficaLineas({ etiquetas, series, extra = [], alto = 220, descripcion, etiquetaX }) {
  const caja = useRef(null); const ancho = useAncho(caja);
  const uid = useRef("g" + Math.random().toString(36).slice(2, 8));
  const [hov, setHov] = useState(null);
  const W = ancho || 600, H = alto, M = { l: 46, r: 18, t: 12, b: 26 };
  const n = etiquetas.length;
  const max = Math.max(0, ...series.flatMap(s => s.valores.filter(v => v !== null && v !== undefined).map(Number)));
  const { top, ticks } = escalaBonita(max);
  const px = (i) => M.l + (n <= 1 ? (W - M.l - M.r) / 2 : (i * (W - M.l - M.r)) / (n - 1));
  const py = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  const trazos = (vals) => { let d = "", abre = false; vals.forEach((v, i) => { if (v === null || v === undefined) { abre = false; return; } d += (abre ? "L" : "M") + px(i).toFixed(1) + " " + py(Number(v)).toFixed(1) + " "; abre = true; }); return d.trim(); };
  const paso = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - M.l - M.r) / 70))));
  const mover = (e) => {
    const r = caja.current.getBoundingClientRect(); const x = e.clientX - r.left;
    let mejor = 0, dm = 1e9; for (let i = 0; i < n; i++) { const dd = Math.abs(px(i) - x); if (dd < dm) { dm = dd; mejor = i; } }
    setHov(mejor);
  };
  const sig = series.map(s => s.valores.join(",")).join("|");
  return (
    <div>
      <Leyenda series={series} />
      <div ref={caja} style={{ position: "relative", width: "100%", height: H }} onPointerMove={mover} onPointerLeave={() => setHov(null)}>
        {ancho > 0 && (
          <svg key={sig} width={W} height={H} role="img" aria-label={descripcion} style={{ display: "block", overflow: "visible" }}>
            <defs>{series.map((s, k) => <linearGradient key={k} id={`${uid.current}${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.22" /><stop offset="100%" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
            {ticks.map(t => <g key={t}><line x1={M.l} x2={W - M.r} y1={py(t)} y2={py(t)} stroke={t === 0 ? MT.eje : MT.rejilla} strokeWidth="1" /><text x={M.l - 8} y={py(t) + 4} textAnchor="end" fontSize="11" fill={MT.suave}>{usdCorto(t)}</text></g>)}
            {etiquetas.map((e, i) => (i % paso === 0 || i === n - 1) && <text key={i} x={px(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11" fill={MT.suave}>{etiquetaX ? etiquetaX(e) : e}</text>)}
            {series.map((s, k) => s.area && s.valores.some(v => v !== null) && <path key={"a" + k} className="met-fade" d={`${trazos(s.valores)} L${px(n - 1).toFixed(1)} ${py(0)} L${px(0).toFixed(1)} ${py(0)} Z`} fill={`url(#${uid.current}${k})`} stroke="none" />)}
            {series.map((s, k) => <path key={"l" + k} className="met-draw" pathLength="1" d={trazos(s.valores)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${s.color}55)` }} />)}
            {series.map((s, k) => { let u = -1; s.valores.forEach((v, i) => { if (v !== null && v !== undefined) u = i; }); return u >= 0 && hov === null ? <circle key={"d" + k} className="met-fade" cx={px(u)} cy={py(Number(s.valores[u]))} r="4.5" fill={s.color} stroke={MT.tarjeta} strokeWidth="2" /> : null; })}
            {hov !== null && <g><line x1={px(hov)} x2={px(hov)} y1={M.t} y2={H - M.b} stroke={MT.eje} strokeWidth="1" />{series.map((s, k) => s.valores[hov] !== null && s.valores[hov] !== undefined && <circle key={k} cx={px(hov)} cy={py(Number(s.valores[hov]))} r="5" fill={s.color} stroke={MT.tarjeta} strokeWidth="2" />)}</g>}
          </svg>
        )}
        {hov !== null && <Tooltip x={px(hov)} y={M.t + 6} ancho={W} titulo={etiquetaX ? etiquetaX(etiquetas[hov]) : etiquetas[hov]}
          filas={[...series.map(s => ({ color: s.color, nombre: s.nombre, valor: s.valores[hov] === null || s.valores[hov] === undefined ? "—" : s.formato(s.valores[hov]) })), ...extra.map(x => ({ color: x.color, nombre: x.nombre, valor: x.formato(x.valores[hov]) }))]} />}
      </div>
    </div>
  );
}

// Columnas agrupadas (misma unidad). 2px de separación, hasta 24px de grosor, 4px redondeado arriba
function GraficaBarras({ etiquetas, series, alto = 220, descripcion, etiquetaX, valorSobreBarra, formatoEje = usdCorto }) {
  const caja = useRef(null); const ancho = useAncho(caja);
  const [hov, setHov] = useState(null);
  const W = ancho || 600, H = alto, M = { l: 46, r: 12, t: 16, b: 26 };
  const n = etiquetas.length, k = series.length;
  const max = Math.max(0, ...series.flatMap(s => s.valores.map(v => Number(v) || 0)));
  const { top, ticks } = escalaBonita(max);
  const banda = (W - M.l - M.r) / Math.max(1, n);
  const grosor = Math.max(6, Math.min(24, (banda * 0.7 - (k - 1) * 2) / k));
  const py = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
  const base = H - M.b;
  const barra = (x, v, color, i, j) => {
    const h = Math.max(0, base - py(v)); if (h <= 0) return null;
    const r = Math.min(4, h, grosor / 2), y = base - h;
    const d = `M${x} ${base} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + grosor - r} Q${x + grosor} ${y} ${x + grosor} ${y + r} V${base} Z`;
    return <path key={i + "-" + j} className="met-grow" d={d} fill={color} opacity={hov === null || hov === i ? 1 : 0.45} style={{ animationDelay: (i * 40 + j * 70) + "ms" }} />;
  };
  const mover = (e) => { const r = caja.current.getBoundingClientRect(); const x = e.clientX - r.left - M.l; const i = Math.floor(x / banda); setHov(i >= 0 && i < n ? i : null); };
  const ancGrupo = k * grosor + (k - 1) * 2;
  return (
    <div>
      <Leyenda series={series} />
      <div ref={caja} style={{ position: "relative", width: "100%", height: H }} onPointerMove={mover} onPointerLeave={() => setHov(null)}>
        {ancho > 0 && (
          <svg key={series.map(s => s.valores.join(",")).join("|")} width={W} height={H} role="img" aria-label={descripcion} style={{ display: "block", overflow: "visible" }}>
            {ticks.map(t => <g key={t}><line x1={M.l} x2={W - M.r} y1={py(t)} y2={py(t)} stroke={t === 0 ? MT.eje : MT.rejilla} strokeWidth="1" /><text x={M.l - 8} y={py(t) + 4} textAnchor="end" fontSize="11" fill={MT.suave}>{formatoEje(t)}</text></g>)}
            {etiquetas.map((e, i) => {
              const x0 = M.l + i * banda + (banda - ancGrupo) / 2;
              return <g key={i}>
                {series.map((s, j) => barra(x0 + j * (grosor + 2), Number(s.valores[i]) || 0, s.color, i, j))}
                {valorSobreBarra && series.map((s, j) => (Number(s.valores[i]) || 0) > 0 && <text key={"t" + j} x={x0 + j * (grosor + 2) + grosor / 2} y={py(Number(s.valores[i])) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill={MT.texto}>{s.formato(s.valores[i])}</text>)}
                <text x={M.l + i * banda + banda / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={hov === i ? MT.texto : MT.suave}>{etiquetaX ? etiquetaX(e) : e}</text>
              </g>;
            })}
          </svg>
        )}
        {hov !== null && <Tooltip x={M.l + hov * banda + banda / 2} y={M.t} ancho={W} titulo={etiquetaX ? etiquetaX(etiquetas[hov]) : etiquetas[hov]} filas={series.map(s => ({ color: s.color, nombre: s.nombre, valor: s.formato(s.valores[hov]) }))} />}
      </div>
    </div>
  );
}

// Barra horizontal que crece al entrar
function BarraH({ etiqueta, valor, maximo, color, texto, sub, retraso = 0 }) {
  const mont = useMontado();
  const pct = maximo > 0 ? Math.max(valor > 0 ? 1.2 : 0, (valor / maximo) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: MT.texto2 }}>{etiqueta}</span>
        <span style={{ color: MT.texto, fontWeight: 800 }}>{texto}{sub && <span style={{ color: MT.suave, fontWeight: 500 }}> · {sub}</span>}</span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: "rgba(17,17,17,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: mont ? pct + "%" : "0%", borderRadius: 6, background: color, transition: `width 900ms cubic-bezier(.2,.7,.2,1) ${retraso}ms`, boxShadow: `0 0 10px ${color}40` }} />
      </div>
    </div>
  );
}

function Medidor({ etiqueta, valor, texto, nota }) {
  const mont = useMontado();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}><span style={{ color: MT.texto2 }}>{etiqueta}</span><b style={{ color: MT.texto }}>{texto}</b></div>
      <div style={{ height: 8, borderRadius: 6, background: "rgba(227,30,36,0.12)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: mont ? Math.min(100, Math.max(valor > 0 ? 1 : 0, valor || 0)) + "%" : "0%", borderRadius: 6, background: MT.rojo, transition: "width 1000ms cubic-bezier(.2,.7,.2,1)" }} />
      </div>
      {nota && <div style={{ fontSize: 11, color: MT.suave, marginTop: 4 }}>{nota}</div>}
    </div>
  );
}

const ESTILO_MET = `
.met{position:relative;color:${MT.texto};border-radius:22px;padding:26px;overflow:hidden;
  background:radial-gradient(900px 380px at 10% -10%,rgba(227,30,36,.10),transparent 62%),radial-gradient(700px 300px at 100% 0%,rgba(17,17,17,.05),transparent 60%),${MT.fondo};
  border:1px solid ${MT.borde};font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.met:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(17,17,17,.07) 1px,transparent 1px);background-size:22px 22px;mask-image:linear-gradient(180deg,#000,transparent 55%);-webkit-mask-image:linear-gradient(180deg,#000,transparent 55%)}
.met>*{position:relative}
.met-h1{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:0;display:flex;align-items:center;gap:10px}
.met-h1:before{content:"";width:6px;height:26px;border-radius:3px;background:linear-gradient(180deg,${MT.rojo},${MT.rojoOsc})}
.met-sub{font-size:13px;color:${MT.texto2};max-width:720px;line-height:1.5}
.met-sec{font-size:13px;font-weight:800;color:${MT.texto};letter-spacing:.01em;margin:30px 0 12px;display:flex;align-items:center;gap:10px}
.met-sec:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(17,17,17,.14),transparent)}
.met-grid{display:grid;gap:14px}
.met-card{background:${MT.tarjeta};border:1px solid ${MT.borde};border-radius:16px;padding:18px;box-shadow:0 1px 2px rgba(17,17,17,.04),0 12px 28px -18px rgba(17,17,17,.22);transition:border-color .2s,box-shadow .2s}
.met-card:hover{border-color:rgba(227,30,36,.40);box-shadow:0 1px 2px rgba(17,17,17,.05),0 16px 32px -16px rgba(227,30,36,.28)}
.met-lbl{font-size:12.5px;color:${MT.texto2};font-weight:600}
.met-num{font-size:30px;font-weight:800;letter-spacing:-.02em;margin:8px 0 6px;line-height:1.05}
.met-big{font-size:42px;font-weight:800;letter-spacing:-.03em;margin:8px 0 6px;line-height:1.02;color:${MT.rojo}}
.met-info{width:22px;height:22px;border-radius:50%;border:1px solid ${MT.borde};background:#fff;color:${MT.texto2};font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;line-height:1}
.met-info:hover{color:${MT.rojo};border-color:${MT.rojo}}
.met-formula{margin-top:10px;padding-top:10px;border-top:1px solid ${MT.rejilla};font-size:12px;line-height:1.5;color:${MT.texto2}}
.met-chip{padding:7px 14px;border-radius:999px;border:1px solid ${MT.borde};background:#fff;color:${MT.texto2};font-weight:600;font-size:13px;cursor:pointer;transition:all .18s}
.met-chip:hover{color:${MT.texto};border-color:rgba(227,30,36,.5)}
.met-chip.on{background:${MT.rojo};border-color:${MT.rojo};color:#fff;box-shadow:0 6px 18px -6px rgba(227,30,36,.55)}
.met input[type=date]{color-scheme:light;background:#fff;color:${MT.texto};border:1px solid ${MT.borde};border-radius:10px;padding:7px 10px;font-size:13px}
.met-tip{position:absolute;z-index:5;pointer-events:none;min-width:150px;background:rgba(17,17,17,.94);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:9px 11px;box-shadow:0 12px 30px rgba(17,17,17,.30)}
.met-tip-t{font-size:12px;color:#C9C9D0;margin-bottom:6px;font-weight:600}
.met-tip-r{display:flex;align-items:center;gap:7px;font-size:12px;margin-top:3px;color:#C9C9D0}
.met-tip-r b{color:#fff;font-size:13px}
.met-tip-r span:last-child{color:#C9C9D0!important}
.met-scan{position:absolute;left:0;right:0;top:0;height:3px;overflow:hidden;z-index:6}
.met-scan:after{content:"";position:absolute;top:0;height:3px;width:30%;background:linear-gradient(90deg,transparent,${MT.rojo},${MT.tinta},transparent);animation:metScan 1.1s linear infinite}
.met-live{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:${MT.texto2};padding:5px 11px;border:1px solid ${MT.borde};border-radius:999px;background:#fff}
.met-live i{width:7px;height:7px;border-radius:50%;background:#16A34A;box-shadow:0 0 0 0 rgba(22,163,74,.55);animation:metPulse 2s infinite}
.met-in{animation:metIn .65s cubic-bezier(.2,.7,.2,1) both;animation-delay:var(--d,0ms)}
.met-draw{stroke-dasharray:1;stroke-dashoffset:1;animation:metDraw 1.3s cubic-bezier(.3,.6,.2,1) .15s forwards}
.met-fade{opacity:0;animation:metFade .9s ease .5s forwards}
.met-grow{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:metGrow .8s cubic-bezier(.2,.7,.2,1) forwards}
.met-tabla{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}
.met-tabla th{padding:10px 12px;text-align:right;font-weight:700;color:${MT.texto2};border-bottom:1px solid ${MT.rejilla}}
.met-tabla td{padding:9px 12px;text-align:right;border-bottom:1px solid ${MT.rejilla};font-variant-numeric:tabular-nums}
.met-tabla th:first-child,.met-tabla td:first-child{text-align:left}
.met-aviso{background:#FFF4D6;border:1px solid #F3D58A;color:#8A5A00;padding:9px 12px;border-radius:10px;font-size:12px;margin:10px 0}
@keyframes metIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes metDraw{to{stroke-dashoffset:0}}
@keyframes metFade{to{opacity:1}}
@keyframes metGrow{to{transform:scaleY(1)}}
@keyframes metScan{from{left:-30%}to{left:100%}}
@keyframes metPulse{70%{box-shadow:0 0 0 8px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
@media (prefers-reduced-motion:reduce){.met-in,.met-draw,.met-fade,.met-grow,.met-scan:after,.met-live i{animation:none!important}.met-draw{stroke-dashoffset:0}.met-fade{opacity:1}.met-grow{transform:none}}
@media (max-width:640px){.met{padding:16px;border-radius:16px}.met-big{font-size:34px}}
`;

function MetricasPanel({ desde, hasta, filtro }) {
  const { showToast } = useApp();
  const [m, setM] = useState(null);
  const [previo, setPrevio] = useState(null);
  const [extra, setExtra] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [actualizado, setActualizado] = useState(null);
  const [margenTxt, setMargenTxt] = useState("");
  const [guardando, setGuardando] = useState(false);
  const peticion = useRef(0);

  // Reintenta solo si la base de datos tarda de más justo al abrir (ver rpcConReintento)
  const llamar = (fn, args) => rpcConReintento(fn, args);
  const cargar = async (silencioso = false) => {
    const id = ++peticion.current;
    if (silencioso !== true) { setCargando(true); setError(""); setPrevio(null); }
    try {
      const dias = Math.round((new Date(hasta + "T12:00:00Z") - new Date(desde + "T12:00:00Z")) / 86400000) + 1;
      const pDesde = sumarDiasISO(desde, -dias), pHasta = sumarDiasISO(desde, -1);
      // Primero lo principal (con un solo cálculo pesado a la vez la base responde rápido)...
      const [d, ex] = await Promise.all([
        llamar("metricas_negocio", { p_desde: desde, p_hasta: hasta }),
        llamar("metricas_extra", { p_desde: desde, p_hasta: hasta }).catch(() => null),
      ]);
      if (id !== peticion.current) return;
      setM(d); setExtra(ex); setActualizado(new Date()); setError("");
      setMargenTxt(t => (t === "" && d.margen_manual !== null && d.margen_manual !== undefined) ? String(d.margen_manual) : t);
      setCargando(false);
      // ...y después, sin bloquear la pantalla, el periodo anterior (solo sirve para las flechas de % de cambio).
      llamar("metricas_negocio", { p_desde: pDesde, p_hasta: pHasta })
        .then(ant => { if (id === peticion.current) setPrevio(ant); })
        .catch(() => { if (id === peticion.current) setPrevio(null); });
      return;
    } catch (e) {
      // Un refresco automático que falla no borra lo que ya se ve; solo una carga normal muestra el error
      if (id === peticion.current && silencioso !== true) setError(String(e.message || e).slice(0, 200));
    }
    if (id === peticion.current) setCargando(false);
  };
  useEffect(() => { if (desde && hasta) cargar(); }, [desde, hasta]);
  useRefrescoPeriodico(() => cargar(true), 120000);

  const guardarMargen = async () => {
    const txt = margenTxt.trim().replace(",", ".");
    const n = txt === "" ? null : Number(txt);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) { alert("Escribe un porcentaje entre 0 y 100."); return; }
    setGuardando(true);
    try { await sb.patch("metricas_config", 1, { margen_bruto: n, updated_at: new Date().toISOString() }); showToast("Margen guardado"); await cargar(); }
    catch (e) { alert("No se pudo guardar el margen: " + (e.message || "")); }
    setGuardando(false);
  };

  const serie = (m && m.serie) || [];
  const diaria = (extra && extra.diaria) || [];
  const dist = extra && extra.distribucion;
  const hora = actualizado ? actualizado.toLocaleTimeString("es-PA", { timeZone: "America/Panama", hour: "2-digit", minute: "2-digit" }) : "";
  const totalVentasRec = m ? Number(m.ventas_recurrentes || 0) : 0;
  const pctRec = m && m.ventas > 0 ? Math.min(100, (totalVentasRec / m.ventas) * 100) : 0;

  return (
    <div className="met" style={{ opacity: cargando && m ? 0.72 : 1, transition: "opacity .25s" }}>
      <style>{ESTILO_MET}</style>
      {cargando && <div className="met-scan" />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 className="met-h1">Métricas del negocio</h2>
          <div className="met-sub" style={{ marginTop: 6 }}>Cuánto vendes, cuánto cuesta conseguir un cliente y cuánto vale. Toca la <b>?</b> de cada tarjeta para ver cómo se calcula con tus datos.</div>
        </div>
        <div className="met-live"><i /> En vivo{hora ? ` · ${hora}` : ""}</div>
      </div>

      <div style={{ margin: "18px 0 8px" }}>{filtro}</div>

      {error && <div className="met-aviso" style={{ background: "#FDE8E8", borderColor: "#F5B5B5", color: "#B71C1C" }}>No se pudieron calcular las métricas: {error}</div>}
      {!m && !error && <div style={{ padding: "60px 0", textAlign: "center", color: MT.texto2 }}>Calculando tus métricas…</div>}

      {m && (
        <>
          {(m.ventas_desde && desde < m.ventas_desde) && <div className="met-aviso">Tus ventas registradas empiezan el {m.ventas_desde}; antes de esa fecha no hay datos.</div>}
          {(m.analitica_desde && desde < m.analitica_desde) && <div className="met-aviso">Las visitas a la web se registran desde el {m.analitica_desde}; la conversión solo es confiable desde esa fecha.</div>}

          {/* ── Tarjetas principales ── */}
          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))", marginTop: 18 }}>
            <Kpi acento grande retraso={0} etiqueta="Ventas del periodo"
              formula={`Suma de ${numM(m.pedidos)} pedidos pagados (sin cotizaciones) en ${m.dias} días.`}
              pie={<div><Delta actual={m.ventas} previo={previo && previo.ventas} /><div style={{ marginTop: 8 }}><Chispa valores={serie.map(s => s.ventas)} color={MT.rojo} /></div></div>}>
              <Cifra valor={Number(m.ventas)} f={(v) => usdM(v, 0)} />
            </Kpi>
            <Kpi retraso={70} etiqueta="Ticket promedio"
              formula={`${usdM(m.ventas)} ÷ ${numM(m.pedidos)} pedidos. La mitad de los pedidos es menor a ${usdM(m.mediana, 0)} (mediana).`}
              pie={<div><Delta actual={m.ticket} previo={previo && previo.ticket} /><div style={{ marginTop: 8 }}><Chispa valores={serie.map(s => s.ticket)} color={MT.rojo} /></div></div>}>
              <Cifra valor={m.ticket === null ? null : Number(m.ticket)} f={(v) => usdM(v)} />
            </Kpi>
            <Kpi retraso={140} etiqueta="Clientes nuevos"
              formula={`Clientes cuya primera compra pagada cae dentro del periodo. Compraron en total ${numM(m.compradores)} clientes; ${numM(m.recurrentes)} ya habían comprado antes.`}
              pie={<div><Delta actual={m.nuevos} previo={previo && previo.nuevos} /><div style={{ marginTop: 8 }}><Chispa valores={serie.map(s => s.nuevos)} color={MT.rojo} /></div></div>}>
              <Cifra valor={Number(m.nuevos)} f={(v) => numM(Math.round(v))} />
            </Kpi>
            <Kpi retraso={210} etiqueta="CAC · costo por cliente nuevo"
              formula={`${usdM(m.gasto_ads)} gastados en Meta Ads ÷ ${numM(m.nuevos)} clientes nuevos. Es un CAC combinado: no distingue si el cliente llegó por un anuncio o por otro medio.`}
              pie={<div><Delta actual={m.cac} previo={previo && previo.cac} menorEsMejor /><div style={{ marginTop: 8 }}><Chispa valores={serie.map(s => s.cac)} color={MT.tinta} /></div></div>}>
              <Cifra valor={m.cac === null ? null : Number(m.cac)} f={(v) => usdM(v)} />
            </Kpi>
            <Kpi retraso={280} etiqueta="ROAS · venta por cada $1 en anuncios"
              formula={`${usdM(m.ventas)} vendidos ÷ ${usdM(m.gasto_ads)} gastados en anuncios.`}
              pie={<Delta actual={m.roas} previo={previo && previo.roas} />}>
              <Cifra valor={m.roas === null ? null : Number(m.roas)} f={(v) => v === null ? "—" : "$" + Number(v).toFixed(2)} />
            </Kpi>
          </div>

          {/* ── Día a día ── */}
          <div className="met-sec">Ventas y anuncios día a día</div>
          <div className="met-card met-in" style={{ "--d": "300ms" }}>
            {diaria.length > 1 ? (
              <GraficaLineas
                etiquetas={diaria.map(d => d.f)} etiquetaX={fechaCortaM}
                descripcion={`Ventas y gasto en anuncios por día entre ${desde} y ${hasta}`}
                series={[
                  { nombre: "Ventas", color: MT.rojo, valores: diaria.map(d => Number(d.ventas)), formato: (v) => usdM(v, 0), area: true },
                  { nombre: "Gasto en anuncios", color: MT.tinta, valores: diaria.map(d => Number(d.gasto)), formato: (v) => usdM(v, 0) },
                ]}
                extra={[{ nombre: "pedidos", valores: diaria.map(d => d.pedidos), formato: numM }, { nombre: "clientes nuevos", color: MT.suave, valores: diaria.map(d => d.nuevos), formato: numM }]}
                alto={250} />
            ) : <div style={{ color: MT.texto2, fontSize: 13, padding: 20 }}>Elige un periodo de 2 días o más para ver la evolución diaria.</div>}
          </div>

          {/* ── Mes a mes ── */}
          <div className="met-sec">Mes a mes</div>
          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,430px),1fr))" }}>
            <div className="met-card met-in" style={{ "--d": "360ms" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>Ventas vs. gasto en anuncios</div>
              <GraficaBarras etiquetas={serie.map(s => s.mes)} etiquetaX={mesCortoM} descripcion="Ventas y gasto en anuncios por mes" alto={230}
                series={[{ nombre: "Ventas", color: MT.rojo, valores: serie.map(s => Number(s.ventas)), formato: (v) => usdM(v, 0) }, { nombre: "Gasto en anuncios", color: MT.tinta, valores: serie.map(s => Number(s.gasto)), formato: (v) => usdM(v, 0) }]} />
            </div>
            <div className="met-card met-in" style={{ "--d": "420ms" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>CAC por mes (costo por cliente nuevo)</div>
              <GraficaLineas etiquetas={serie.map(s => s.mes)} etiquetaX={mesCortoM} descripcion="CAC por mes" alto={230}
                series={[{ nombre: "CAC", color: MT.tinta, valores: serie.map(s => s.cac === null ? null : Number(s.cac)), formato: (v) => usdM(v), area: true }]}
                extra={[{ nombre: "clientes nuevos", color: MT.suave, valores: serie.map(s => s.nuevos), formato: numM }, { nombre: "gasto en anuncios", color: MT.tinta, valores: serie.map(s => s.gasto), formato: (v) => usdM(v, 0) }]} />
              <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 6, lineHeight: 1.45 }}>Junio y julio salen altos porque tus ventas registradas empiezan el 16 de junio; el CAC reciente es el más confiable.</div>
            </div>
            <div className="met-card met-in" style={{ "--d": "480ms" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>Ticket promedio por mes</div>
              <GraficaLineas etiquetas={serie.map(s => s.mes)} etiquetaX={mesCortoM} descripcion="Ticket promedio por mes" alto={200}
                series={[{ nombre: "Ticket promedio", color: MT.rojo, valores: serie.map(s => s.ticket === null ? null : Number(s.ticket)), formato: (v) => usdM(v), area: true }]}
                extra={[{ nombre: "pedidos", valores: serie.map(s => s.pedidos), formato: numM }]} />
            </div>
            <div className="met-card met-in" style={{ "--d": "540ms" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>Clientes nuevos por mes</div>
              <GraficaBarras etiquetas={serie.map(s => s.mes)} etiquetaX={mesCortoM} descripcion="Clientes nuevos por mes" alto={200} formatoEje={(v) => String(Math.round(v))} valorSobreBarra
                series={[{ nombre: "Clientes nuevos", color: MT.rojo, valores: serie.map(s => Number(s.nuevos)), formato: numM }]} />
            </div>
          </div>

          {/* ── Conversión ── */}
          <div className="met-sec">Conversión: de visitante a cliente</div>
          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))" }}>
            <div className="met-card met-in" style={{ "--d": "100ms" }}>
              <div className="met-lbl" style={{ marginBottom: 14 }}>Embudo de la tienda web</div>
              <BarraH etiqueta="Visitantes" valor={m.visitantes} maximo={m.visitantes} color={MT.rojo} texto={numM(m.visitantes)} />
              <BarraH etiqueta="Agregaron al carrito" valor={m.con_carrito} maximo={m.visitantes} color={MT.rojo} texto={numM(m.con_carrito)} sub={pctM(m.conv_carrito_pct, 1) + " de visitantes"} retraso={120} />
              <BarraH etiqueta="Iniciaron un pedido en la web" valor={m.web_iniciados} maximo={m.visitantes} color={MT.rojo} texto={numM(m.web_iniciados)} retraso={240} />
              <BarraH etiqueta="Pagaron en la web" valor={m.web_pagados} maximo={m.visitantes} color={MT.rojo} texto={numM(m.web_pagados)} sub={pctM(m.conv_checkout_pct, 0) + " de los iniciados"} retraso={360} />
              <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 4, lineHeight: 1.45 }}>Además, {numM(m.whatsapp)} visitantes tocaron un botón de WhatsApp: ahí se cierran muchas ventas que no pasan por el pago web.</div>
            </div>
            <div className="met-card met-in" style={{ "--d": "160ms" }}>
              <div className="met-lbl" style={{ marginBottom: 14 }}>Qué tan bien convierte</div>
              <Medidor etiqueta="Conversión global (visitante → cliente nuevo)" valor={Number(m.conv_global_pct) * 10} texto={pctM(m.conv_global_pct, 2)} nota={`${numM(m.nuevos)} clientes nuevos ÷ ${numM(m.visitantes)} visitantes, por web y WhatsApp. (Medidor a escala: 10% = barra llena.)`} />
              <Medidor etiqueta="Compra directa en la web" valor={Number(m.conv_web_pct) * 10} texto={pctM(m.conv_web_pct, 2)} nota={`${numM(m.web_pagados)} pedidos pagados en la web ÷ ${numM(m.visitantes)} visitantes.`} />
              <Medidor etiqueta="Pago completado (checkout)" valor={Number(m.conv_checkout_pct)} texto={pctM(m.conv_checkout_pct, 0)} nota={`${numM(m.web_pagados)} pagados ÷ ${numM(m.web_iniciados)} pedidos iniciados.`} />
            </div>
          </div>

          {/* ── Valor del cliente ── */}
          <div className="met-sec">Valor del cliente (LTV)</div>
          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))" }}>
            <div className="met-card met-in" style={{ "--d": "100ms" }}>
              <div className="met-lbl" style={{ marginBottom: 14 }}>Lo que deja un cliente nuevo vs. lo que cuesta conseguirlo</div>
              {(() => {
                const mx = Math.max(Number(m.cohorte.ltv) || 0, Number(m.cac) || 0, 1);
                return <>
                  <BarraH etiqueta={`Ingresos por cliente nuevo (LTV, ${numM(m.cohorte.clientes)} clientes)`} valor={Number(m.cohorte.ltv) || 0} maximo={mx} color={MT.rojo} texto={usdM(m.cohorte.ltv)} />
                  {m.ltv_ganancia !== null && m.ltv_ganancia !== undefined && <BarraH etiqueta={`Ganancia bruta con ${pctM(m.margen_bruto, 0)} de margen${m.margen_origen === "real" ? " real" : ""}`} valor={Number(m.ltv_ganancia)} maximo={mx} color={MT.rojo} texto={usdM(m.ltv_ganancia)} retraso={120} />}
                  <BarraH etiqueta="Lo que costó conseguirlo (CAC)" valor={Number(m.cac) || 0} maximo={mx} color={MT.tinta} texto={usdM(m.cac)} retraso={240} />
                </>;
              })()}
              <div style={{ fontSize: 13, color: MT.texto2, lineHeight: 1.55, marginTop: 6 }}>
                LTV ÷ CAC = <b style={{ color: MT.texto }}>{m.ltv_cac === null ? "—" : Number(m.ltv_cac).toFixed(2) + " veces"}</b> en ingresos. Para recuperar el CAC con la primera compra necesitas un margen bruto de al menos <b style={{ color: MT.texto }}>{pctM(m.margen_minimo_pct)}</b>.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
                <label style={{ fontSize: 12.5, color: MT.texto2, fontWeight: 600 }}>{m.margen_origen === "real" ? "Margen de respaldo (%)" : "Tu margen bruto (%)"}</label>
                <input value={margenTxt} onChange={e => setMargenTxt(e.target.value)} inputMode="decimal" placeholder="ej. 30" style={{ width: 80, background: "#fff", color: MT.texto, border: `1px solid ${MT.borde}`, borderRadius: 10, padding: "7px 10px", fontSize: 13 }} />
                <button className="met-chip on" onClick={guardarMargen} disabled={guardando}>Guardar</button>
              </div>
              {m.margen_origen === "real" ? (
                <div data-testid="margen-real" style={{ marginTop: 8, fontSize: 12, color: MT.suave, lineHeight: 1.5 }}>
                  Usando tu <b style={{ color: MT.texto2 }}>margen real de {pctM(m.margen_bruto, 1)}</b>, calculado con los costos de Odoo de lo que compraron estos clientes
                  {m.margen_cobertura_pct !== null && m.margen_cobertura_pct !== undefined ? ` (hay costo en el ${pctM(m.margen_cobertura_pct, 0)} de sus compras)` : ""}. El campo de arriba solo se usa si algún día no hay costos cargados.
                </div>
              ) : m.margen_origen === "manual" ? (
                <div style={{ marginTop: 8, fontSize: 12, color: MT.suave, lineHeight: 1.5 }}>Usando el margen que escribiste, porque todavía no hay costos de Odoo para estas compras.</div>
              ) : null}
              {m.ltv_cac_ganancia !== null && m.ltv_cac_ganancia !== undefined && (
                <div style={{ marginTop: 10, fontSize: 13, color: MT.texto2 }}>Ganancia ÷ CAC = <b style={{ color: Number(m.ltv_cac_ganancia) >= 1 ? MT.bueno : MT.malo }}>{Number(m.ltv_cac_ganancia).toFixed(2)} veces</b> {Number(m.ltv_cac_ganancia) >= 1 ? "· recuperas lo gastado" : "· aún no recuperas lo gastado con la primera compra; depende de que vuelvan"}.</div>
              )}
            </div>
            <div className="met-card met-in" style={{ "--d": "160ms" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>Cuántas veces compra cada cliente</div>
              {dist ? (
                <GraficaBarras etiquetas={["1 pedido", "2 pedidos", "3 pedidos", "4 o más"]} descripcion="Clientes según cuántos pedidos han hecho" alto={210} valorSobreBarra formatoEje={(v) => String(Math.round(v))}
                  series={[{ nombre: "Clientes", color: MT.rojo, valores: [dist.un_pedido, dist.dos_pedidos, dist.tres_pedidos, dist.cuatro_mas], formato: numM }]} />
              ) : <div style={{ color: MT.texto2, fontSize: 13 }}>No se pudo cargar esta gráfica.</div>}
              <div style={{ marginTop: 10 }}>
                <Medidor etiqueta="Recompra de los clientes nuevos del periodo" valor={Number(m.cohorte.recompra_pct) || 0} texto={pctM(m.cohorte.recompra_pct)} nota={`${numM(m.cohorte.recompraron)} de ${numM(m.cohorte.clientes)} ya volvieron a comprar.`} />
                <Medidor etiqueta="Recompra histórica (todos los clientes)" valor={Number(m.global.recompra_pct) || 0} texto={pctM(m.global.recompra_pct)} nota={`Con 3 o más pedidos: ${pctM(m.global.recompra3_pct)}. LTV de todos los clientes: ${usdM(m.global.ltv)}.`} />
              </div>
            </div>
          </div>

          {/* ── Ritmo ── */}
          <div className="met-sec">Ritmo de ventas (equivalente a MRR / ARR)</div>
          <div className="met-sub" style={{ marginBottom: 12 }}>Ofertodo no vende por suscripción, así que no hay un MRR/ARR formal. Esto es lo que venderías al mes y al año si mantuvieras el ritmo del periodo elegido. No es ingreso asegurado.</div>
          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
            <Kpi retraso={0} etiqueta="Ventas por mes (ritmo)" formula={`${usdM(m.ventas)} ÷ ${m.dias} días × 30.4 días.`}><Cifra valor={Number(m.ritmo_mensual)} f={(v) => usdM(v, 0)} /></Kpi>
            <Kpi acento retraso={70} etiqueta="Ventas por año (ritmo)" formula={`${usdM(m.ventas)} ÷ ${m.dias} días × 365.`}><Cifra valor={Number(m.ritmo_anual)} f={(v) => usdM(v, 0)} /></Kpi>
            <Kpi retraso={140} etiqueta="Parte recurrente por mes" formula={`Ventas de clientes que ya habían comprado antes del periodo (${usdM(m.ventas_recurrentes)}) llevadas a un mes. Es lo más parecido a un MRR.`}><Cifra valor={Number(m.ritmo_mensual_recurrente)} f={(v) => usdM(v, 0)} /></Kpi>
            <Kpi retraso={210} etiqueta="Parte recurrente por año" formula="La parte recurrente llevada a 12 meses."><Cifra valor={Number(m.ritmo_anual_recurrente)} f={(v) => usdM(v, 0)} /></Kpi>
          </div>
          <div className="met-card met-in" style={{ marginTop: 14, "--d": "250ms" }}>
            <div className="met-lbl" style={{ marginBottom: 10 }}>De dónde vienen las ventas del periodo</div>
            <div style={{ display: "flex", height: 8, borderRadius: 8, overflow: "hidden", gap: 2 }} role="img" aria-label={`Ventas de clientes recurrentes ${pctM(pctRec)} y de clientes nuevos u otros ${pctM(100 - pctRec)}`}>
              <div style={{ width: pctRec + "%", background: MT.tinta, borderRadius: 8, transition: "width 900ms cubic-bezier(.2,.7,.2,1)" }} />
              <div style={{ flex: 1, background: MT.rojo, borderRadius: 8 }} />
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 12.5, color: MT.texto2 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: MT.tinta }} />Clientes que ya habían comprado: <b style={{ color: MT.texto }}>{usdM(m.ventas_recurrentes, 0)} ({pctM(pctRec, 0)})</b></span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: MT.rojo }} />Clientes nuevos y otros: <b style={{ color: MT.texto }}>{usdM(Number(m.ventas) - totalVentasRec, 0)} ({pctM(100 - pctRec, 0)})</b></span>
            </div>
          </div>

          {/* ── Tabla (la misma información, sin depender de color ni de pasar el cursor) ── */}
          <details style={{ marginTop: 26 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: MT.texto2 }}>Ver los datos mes a mes en tabla</summary>
            <div className="met-card" style={{ marginTop: 10, overflowX: "auto", padding: 0 }}>
              <table className="met-tabla">
                <thead><tr>{["Mes", "Ventas", "Pedidos", "Ticket", "Clientes nuevos", "Gasto anuncios", "CAC"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{serie.map(s => <tr key={s.mes}><td>{s.mes}</td><td>{usdM(s.ventas, 0)}</td><td>{numM(s.pedidos)}</td><td>{usdM(s.ticket)}</td><td>{numM(s.nuevos)}</td><td>{usdM(s.gasto, 0)}</td><td><b>{usdM(s.cac)}</b></td></tr>)}</tbody>
              </table>
            </div>
          </details>

          <div style={{ marginTop: 8 }}><TiendaFisicaPanel desde={desde} hasta={hasta} /></div>

          <div style={{ marginTop: 22, fontSize: 12, color: MT.suave, lineHeight: 1.6, maxWidth: 780 }}>
            <b style={{ color: MT.texto2 }}>Cómo leer estas métricas.</b> Se cuentan pedidos pagados (web y los que crean tus vendedores); no se cuentan cotizaciones, pedidos sin pagar ni compras del equipo. “Cliente nuevo” es quien hace su primera compra pagada dentro del periodo, según tu historial desde el 16 de junio de 2026. Los pedidos sin cliente asignado suman a las ventas pero no al CAC ni al LTV. Las ventas del punto de venta de Odoo (tienda física) no entran en estas cifras: se muestran aparte, en la sección “Ventas de tienda física”. Fechas con hora de Panamá.
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════ FINANZAS (pestaña "Finanzas") — SOLO PARA EL DUEÑO ═══════════
// Todos los datos viven en tablas privadas de Supabase (sin acceso público). La página solo habla con
// funciones del servidor que vuelven a comprobar que quien pregunta es el dueño. Un operador o un visitante
// recibe "No autorizado" aunque conozca la dirección.
const COSTOS_FIN = new Map(); // producto_id -> costo por pieza (solo se llena si eres el dueño)
const COSTOS_ORIGEN = new Map(); // producto_id -> "manual" | "odoo"
const costoProducto = (p) => { const c = p ? COSTOS_FIN.get(p.id) : undefined; return c === undefined ? 0 : Number(c); };
// Llama a una función de lectura del servidor y, si la base de datos se pone lenta justo en ese
// momento (tiempo de espera agotado, error 5xx o corte de red), vuelve a intentarlo sola hasta 2 veces
// con una pausa corta. Los errores "de verdad" (sin permiso, datos inválidos) NO se reintentan.
// soloTimeout: para funciones que ESCRIBEN datos, solo se reintenta cuando el servidor canceló la
// operación por tiempo (así queda deshecha y es seguro repetirla), nunca ante un corte de red dudoso.
const ES_TIMEOUT_DB = /57014|statement timeout|canceling statement/i;
async function rpcConReintento(fn, args = {}, { soloTimeout = false, intentos = 2, pausaMs = 1500 } = {}) {
  let ultimoError = null;
  for (let i = 0; i <= intentos; i++) {
    let reintentable = false;
    try {
      await sb.ensureFreshToken();
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: sb.dataHeaders(), body: JSON.stringify(args) });
      if (r.ok) return await r.json();
      let t = await r.text();
      try { t = JSON.parse(t).message || t; } catch (_e) { /* texto plano */ }
      ultimoError = new Error(t);
      const esTimeout = ES_TIMEOUT_DB.test(t);
      reintentable = esTimeout || (!soloTimeout && (r.status >= 500 || r.status === 408 || r.status === 429));
    } catch (e) {
      ultimoError = e;
      reintentable = !soloTimeout && e instanceof TypeError; // corte de red / "Failed to fetch"
    }
    if (!reintentable || i === intentos) break;
    await new Promise(res => setTimeout(res, pausaMs * (i + 1)));
  }
  throw ultimoError;
}
async function finRpc(fn, args = {}) {
  // Solo se reintenta ante tiempo de espera agotado (la operación queda cancelada, es seguro repetirla)
  return rpcConReintento(fn, args, { soloTimeout: true });
}
async function finCargarCostos() {
  const lista = await finRpc("fin_costos_listar");
  COSTOS_FIN.clear(); COSTOS_ORIGEN.clear();
  (lista || []).forEach(x => { COSTOS_FIN.set(Number(x.producto_id), Number(x.costo)); COSTOS_ORIGEN.set(Number(x.producto_id), x.origen || "manual"); });
  return COSTOS_FIN;
}
const MODOS_ODOO = [["solo_vacios", "Odoo llena y actualiza los suyos; respeta los que escribo a mano (recomendado mientras configuras Odoo)"], ["siempre", "Odoo manda: actualizar siempre con el costo de Odoo"], ["apagado", "Apagado: no traer nada de Odoo"]];
const METODOS_FIN = [["efectivo", "Efectivo"], ["transferencia", "Transferencia"], ["tarjeta", "Tarjeta"], ["yappy", "Yappy"], ["credito", "A crédito (aún sin pagar)"], ["otro", "Otro"]];
const CANALES_GASTO = [["compartido", "Compartido (web y tienda)"], ["web", "Solo web"], ["tienda", "Solo tienda física"]];
const METODOS_ABONO = METODOS_FIN.filter(([k]) => k !== "credito");
const GRUPOS_FIN = { operativo: "Operativo", personal: "Personal", logistica: "Logística", marketing: "Marketing", impuestos: "Impuestos", financiero: "Financiero", inventario: "Compra de mercancía", otro: "Otros" };
const inpF = { background: "#fff", color: MT.texto, border: `1px solid ${MT.borde}`, borderRadius: 10, padding: "8px 10px", fontSize: 13, minWidth: 0, fontFamily: "inherit" };
const lblF = { fontSize: 11.5, color: MT.texto2, fontWeight: 600, display: "block", marginBottom: 4 };
const ESTADO_DOC = { pendiente: ["Pendiente", MT.texto2], parcial: ["Pago parcial", "#8A5A00"], vencido: ["Vencido", MT.malo], pagado: ["Pagado", MT.bueno], anulado: ["Anulado", MT.suave] };

function useFinDatos(fn, args, deps) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const id = useRef(0);
  const recargar = async () => {
    const n = ++id.current;
    setCargando(true); setError("");
    try { const d = await finRpc(fn, args); if (n === id.current) setDatos(d); }
    catch (e) { if (n === id.current) setError(String(e.message || e).slice(0, 220)); }
    if (n === id.current) setCargando(false);
  };
  useEffect(() => { recargar(); }, deps);
  return { datos, error, cargando, recargar };
}
const AvisoFin = ({ children, malo }) => <div className="met-aviso" style={malo ? { background: "#FDE8E8", borderColor: "#F5B5B5", color: "#B71C1C" } : undefined}>{children}</div>;

// ── Resumen: estado de resultados (con análisis vertical), flujos de caja y equilibrio ──
const CANAL_TXT = { total: "Todo el negocio", web: "Solo web", tienda: "Solo tienda física" };
const nF = (x) => Number(x) || 0;
const pctDe = (v, base) => (v === null || v === undefined || !(Math.abs(base) > 0)) ? null : (Number(v) / base) * 100;
const signoUsd = (v, d = 0) => v === null || v === undefined ? "—" : (Number(v) < 0 ? "−" : "") + usdM(Math.abs(Number(v)), d);
const signoPct = (v, d = 1) => v === null || v === undefined ? "—" : (Number(v) < 0 ? "−" : "") + pctM(Math.abs(Number(v)), d);

// Arma el estado de resultados de la web, de la tienda física y del total con los datos del servidor.
function armarEstadoResultados(r, pos, fl, cfg) {
  const ct = cfg && cfg.comision_tarjeta_pct !== null && cfg.comision_tarjeta_pct !== undefined ? Number(cfg.comision_tarjeta_pct) : 0;
  const cy = cfg && cfg.comision_yappy_pct !== null && cfg.comision_yappy_pct !== undefined ? Number(cfg.comision_yappy_pct) : 0;
  const metPos = (m) => { const x = ((pos && pos.pagos) || []).find(p => String(p.metodo).toLowerCase().includes(m)); return x ? Math.max(0, nF(x.monto)) : 0; };
  const gb = r.ganancia_bruta_est === null || r.ganancia_bruta_est === undefined ? null : Number(r.ganancia_bruta_est);
  const ventasProdWeb = nF(r.ventas_productos);
  const web = { ventasProd: ventasProdWeb, envio: nF(r.envio_cobrado), reembolsos: nF(r.reembolsos), costo: gb === null ? null : ventasProdWeb - gb,
    ads: nF(r.gasto_ads), comisiones: nF(r.comisiones), gastos: fl ? nF(fl.op_web) : nF(r.gastos_operativos) };
  let tienda = { ventasProd: 0, envio: 0, reembolsos: 0, costo: 0, ads: 0, comisiones: 0, gastos: 0 };
  if (pos && nF(pos.tickets) > 0) {
    const neto = nF(pos.ventas_sin_itbms), reemb = Math.abs(nF(pos.reembolsos));
    const ge = pos.ganancia_est === null || pos.ganancia_est === undefined ? null : Number(pos.ganancia_est);
    tienda = { ventasProd: neto + reemb, envio: 0, reembolsos: reemb, costo: ge === null ? null : neto - ge, ads: 0,
      comisiones: metPos("tarjeta") * ct / 100 + metPos("yappy") * cy / 100, gastos: fl ? nF(fl.op_tienda) : 0 };
  }
  const compartido = fl ? nF(fl.op_compartido) : 0;
  const cierra = (c, gastosExtra = 0) => {
    const ventasTotales = c.ventasProd + c.envio;
    const ventasNetas = ventasTotales - c.reembolsos;
    const utilidadBruta = c.costo === null ? null : ventasNetas - c.costo;
    const gastosTot = c.gastos + gastosExtra;
    const neta = utilidadBruta === null ? null : utilidadBruta - c.ads - c.comisiones - gastosTot;
    const margen = c.costo !== null && c.ventasProd > 0 ? 1 - c.costo / c.ventasProd : null;
    const pe = margen !== null && margen > 0 ? Math.max(0, (gastosTot + c.ads + c.comisiones + c.reembolsos - c.envio) / margen) : null;
    return { ...c, gastosCanal: c.gastos, gastos: gastosTot, ventasTotales, ventasNetas, utilidadBruta, neta, margen, pe, gastosCostoExtra: gastosExtra };
  };
  const W = cierra(web), T = cierra(tienda);
  const suma = (k) => W[k] + T[k];
  const costoTot = (W.costo === null && W.ventasProd > 0) || (T.costo === null && T.ventasProd > 0) ? null : (W.costo || 0) + (T.costo || 0);
  const TOT = cierra({ ventasProd: suma("ventasProd"), envio: suma("envio"), reembolsos: suma("reembolsos"), costo: costoTot, ads: suma("ads"), comisiones: suma("comisiones"), gastos: suma("gastosCanal") }, compartido);
  return { web: W, tienda: T, total: TOT, compartido };
}

function FilaFlujo({ et, v, signo, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${MT.rejilla}` }}>
      <span style={{ color: sub ? MT.suave : MT.texto2, paddingLeft: sub ? 14 : 0 }}>{et}</span>
      <b style={{ color: signo < 0 ? MT.malo : MT.texto, fontWeight: sub ? 500 : 700 }}>{signo < 0 ? "−" : "+"}{usdM(Math.abs(nF(v)), 0)}</b>
    </div>
  );
}

function FlujoCaja({ fl, irA }) {
  const [vista, setVista] = useState("unificado");
  const metodos = Object.entries(fl.tienda_metodos || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const webEnt = [["Ventas web cobradas", fl.web_ventas]];
  const webSal = [["Publicidad en Meta (automático)", fl.web_ads], ["Reembolsos a clientes", fl.web_reembolsos], ["Gastos asignados a la web", fl.caja_gastos_web]];
  const tiEnt = [["Ventas de la tienda (caja)", fl.tienda_ventas]];
  const tiSal = [["Gastos asignados a la tienda", fl.caja_gastos_tienda]];
  const sum = (l) => l.reduce((a, x) => a + nF(x[1]), 0);
  const netoWeb = sum(webEnt) - sum(webSal), netoTienda = sum(tiEnt) - sum(tiSal);
  const uniEnt = [["Ventas web cobradas", fl.web_ventas], ["Ventas de la tienda física", fl.tienda_ventas], ["Cobros de cuentas por cobrar", fl.cobros]];
  const uniSal = [[`Compras de mercancía en Odoo (${nF(fl.n_compras_odoo)} órdenes)`, fl.compras_odoo], ["Publicidad en Meta (automático)", fl.web_ads], ["Reembolsos a clientes", fl.web_reembolsos],
    ["Gastos asignados a la web", fl.caja_gastos_web], ["Gastos asignados a la tienda", fl.caja_gastos_tienda], ["Gastos compartidos (web y tienda)", fl.caja_gastos_compartido], ["Pagos a proveedores (cuentas por pagar)", fl.pagos_proveedores]];
  const netoUni = sum(uniEnt) - sum(uniSal);
  const netoComp = netoUni - netoWeb - netoTienda;
  const Tarjeta = ({ titulo, ent, sal, neto, extraEnt, notaPie }) => (
    <div className="met-card met-in" style={{ "--d": "100ms" }}>
      <div className="met-lbl" style={{ marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: MT.bueno, margin: "8px 0 2px" }}>Entra dinero</div>
      {ent.map(([et, v]) => <FilaFlujo key={et} et={et} v={v} signo={1} />)}
      {extraEnt}
      <div style={{ fontSize: 11.5, fontWeight: 800, color: MT.malo, margin: "12px 0 2px" }}>Sale dinero</div>
      {sal.map(([et, v]) => <FilaFlujo key={et} et={et} v={v} signo={-1} />)}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, paddingTop: 10 }}><span>Movimiento neto de caja</span><span style={{ color: neto >= 0 ? MT.bueno : MT.malo }}>{signoUsd(neto)}</span></div>
      {notaPie && <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 8, lineHeight: 1.5 }}>{notaPie}</div>}
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="met-sec" style={{ flex: 1, minWidth: 200 }}>Flujo de caja del periodo</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["unificado", "Unificado (principal)"], ["web", "Web"], ["tienda", "Tienda física"]].map(([k, l]) => <button key={k} className={"met-chip" + (vista === k ? " on" : "")} onClick={() => setVista(k)}>{l}</button>)}
        </div>
      </div>
      {vista === "unificado" && (
        <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
          <Tarjeta titulo="Flujo de caja unificado: web + tienda física + compras" ent={uniEnt} sal={uniSal} neto={netoUni}
            notaPie="Las compras de Odoo se cuentan como salida de caja el día de la orden de compra confirmada (es un estimado: Odoo aún no tiene los pagos a proveedores)." />
          <div className="met-card met-in" style={{ "--d": "160ms" }}>
            <div className="met-lbl">Qué aporta cada parte al flujo</div>
            <div style={{ marginTop: 10 }}>
              {[["Web", netoWeb, "Ventas web − publicidad − reembolsos − gastos de la web"], ["Tienda física", netoTienda, "Ventas de la caja − gastos de la tienda"], ["Compras y gastos compartidos", netoComp, "Cobros − compras de Odoo − gastos compartidos − pagos a proveedores"]].map(([et, v, nota]) => (
                <div key={et} style={{ padding: "8px 0", borderBottom: `1px solid ${MT.rejilla}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 700 }}>{et}</span><b style={{ color: v >= 0 ? MT.bueno : MT.malo }}>{signoUsd(v)}</b></div>
                  <div style={{ fontSize: 11.5, color: MT.suave }}>{nota}</div>
                </div>
              ))}
            </div>
            <div className="met-lbl" style={{ marginTop: 16 }}>Saldo de caja estimado hoy</div>
            {fl.saldo_estimado === null || fl.saldo_estimado === undefined
              ? <div style={{ fontSize: 13, color: MT.texto2, lineHeight: 1.55, marginTop: 8 }}>Para ver cuánto dinero deberías tener, escribe tu saldo inicial y la fecha en <button className="met-chip" style={{ padding: "2px 10px" }} onClick={() => irA("control")}>Ajustes</button>.</div>
              : <>
                <div className="met-num" style={{ color: Number(fl.saldo_estimado) >= 0 ? MT.texto : MT.malo }}>{usdM(fl.saldo_estimado, 0)}</div>
                <div style={{ fontSize: 12, color: MT.suave, lineHeight: 1.5 }}>Saldo inicial {usdM(fl.saldo_inicial, 0)} al {fl.fecha_saldo} + todo lo que entró (web, tienda y cobros) − todo lo que salió (compras, publicidad, gastos, reembolsos y pagos). Es una estimación: no se concilia con el banco.</div>
              </>}
          </div>
        </div>
      )}
      {vista === "web" && (
        <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
          <Tarjeta titulo="Flujo de caja de la web" ent={webEnt} sal={webSal} neto={netoWeb} notaPie="No incluye las compras de mercancía ni los gastos compartidos: esos se ven en el flujo unificado." />
        </div>
      )}
      {vista === "tienda" && (
        <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
          <Tarjeta titulo="Flujo de caja de la tienda física" ent={[]} sal={tiSal} neto={netoTienda}
            extraEnt={<>{metodos.length === 0 && <FilaFlujo et="Ventas de la tienda (caja)" v={fl.tienda_ventas} signo={1} />}{metodos.map(([m, v]) => <FilaFlujo key={m} et={`Ventas cobradas en ${String(m).toLowerCase()}`} v={v} signo={nF(v) < 0 ? -1 : 1} />)}</>}
            notaPie="Son las ventas del punto de venta de Odoo, ya restados los reembolsos. No incluye las compras de mercancía ni los gastos compartidos." />
        </div>
      )}
    </>
  );
}

function FinResumen({ desde, hasta, irA }) {
  const { datos: r, error, cargando } = useFinDatos("fin_resumen", { p_desde: desde, p_hasta: hasta }, [desde, hasta]);
  const { datos: pos, error: errPos } = useFinDatos("pos_resumen", { p_desde: desde, p_hasta: hasta }, [desde, hasta]);
  const { datos: fl, error: errFl } = useFinDatos("fin_flujo", { p_desde: desde, p_hasta: hasta }, [desde, hasta]);
  const { datos: cfg, error: errCfg } = useFinDatos("fin_config_leer", {}, []);
  const [canal, setCanal] = useState("total");
  const [verVertical, setVerVertical] = useState(false);
  if (error) return <AvisoFin malo>No se pudo calcular: {error}</AvisoFin>;
  if (!r || (!pos && !errPos) || (!fl && !errFl) || (!cfg && !errCfg)) return <div style={{ padding: "50px 0", textAlign: "center", color: MT.texto2 }}>Calculando tus finanzas…</div>;
  const serie = r.serie || [];
  const EST = armarEstadoResultados(r, errPos ? null : pos, errFl ? null : fl, errCfg ? null : cfg);
  const E = EST[canal];
  const base = E.ventasTotales;
  const gastosTot = E.gastos + E.ads + E.comisiones;
  const cobWeb = r.cobertura_pct === null || r.cobertura_pct === undefined ? 0 : Number(r.cobertura_pct);
  const cobTienda = pos && pos.cobertura_costo_pct !== null && pos.cobertura_costo_pct !== undefined ? Number(pos.cobertura_costo_pct) : 100;
  const avisoCobWeb = cobWeb < 100 && canal !== "tienda";
  const avisoCobTienda = cobTienda < 97 && canal !== "web" && pos && nF(pos.tickets) > 0;
  const pasos = [
    ["Ventas de productos", E.ventasProd, MT.tinta, "+"],
    [`Costo de la mercancía vendida (estimado)${canal !== "tienda" && nF(r.costo_devuelto) > 0 ? " · sin lo devuelto al inventario" : ""}`, E.costo, MT.suave, "−"],
    ["Envíos cobrados a clientes", E.envio, MT.tinta, "+"],
    ["Reembolsos a clientes", E.reembolsos, MT.malo, "−"],
    ["Publicidad en Meta (automático)", E.ads, MT.malo, "−"],
    ["Comisiones de tarjeta y Yappy (estimadas)", E.comisiones, MT.malo, "−"],
    ["Gastos operativos que registraste", E.gastos, MT.malo, "−"],
  ];
  const maxPaso = Math.max(E.ventasProd, 1);
  const cat = (r.gastos_por_categoria || []);
  const maxCat = Math.max(1, ...cat.map(c => Number(c.total)));
  // Filas del análisis vertical: [etiqueta, valorWeb, valorTienda, valorTotal, tipo]
  const filasV = [
    ["Ventas de productos", EST.web.ventasProd, EST.tienda.ventasProd, EST.total.ventasProd, "ing"],
    ["Envíos cobrados a clientes", EST.web.envio, EST.tienda.envio, EST.total.envio, "ing"],
    ["Ventas totales", EST.web.ventasTotales, EST.tienda.ventasTotales, EST.total.ventasTotales, "sub"],
    ["(−) Reembolsos a clientes", EST.web.reembolsos, EST.tienda.reembolsos, EST.total.reembolsos, "egr"],
    ["Ventas netas", EST.web.ventasNetas, EST.tienda.ventasNetas, EST.total.ventasNetas, "sub"],
    ["(−) Costo de la mercancía vendida (estimado)", EST.web.costo, EST.tienda.costo, EST.total.costo, "egr"],
    ["Utilidad bruta", EST.web.utilidadBruta, EST.tienda.utilidadBruta, EST.total.utilidadBruta, "sub"],
    ["(−) Publicidad en Meta", EST.web.ads, EST.tienda.ads, EST.total.ads, "egr"],
    ["(−) Comisiones de tarjeta y Yappy", EST.web.comisiones, EST.tienda.comisiones, EST.total.comisiones, "egr"],
    ["(−) Gastos operativos del canal", EST.web.gastosCanal, EST.tienda.gastosCanal, EST.total.gastosCanal, "egr"],
    ["(−) Gastos compartidos (sin canal)", null, null, EST.compartido, "egr"],
    ["Ganancia neta estimada", EST.web.neta, EST.tienda.neta, EST.total.neta, "tot"],
  ];
  const baseW = EST.web.ventasTotales, baseT = EST.tienda.ventasTotales, baseTot = EST.total.ventasTotales;
  const celdaUsd = (v, tipo) => v === null || v === undefined ? "—" : (tipo === "egr" && Number(v) > 0 ? "−" : (Number(v) < 0 ? "−" : "")) + usdM(Math.abs(Number(v)), 0);
  const celdaPct = (v, b) => { const p = pctDe(v, b); return p === null ? "—" : pctM(Math.abs(p), 1); };
  const T = EST.total;
  const por100 = (x) => x === null || !(baseTot > 0) ? null : (x / baseTot) * 100;
  return (
    <div style={{ opacity: cargando ? 0.7 : 1, transition: "opacity .25s" }}>
      {avisoCobWeb && <AvisoFin>Solo el <b>{pctM(cobWeb, 0)}</b> de las ventas web tiene costo cargado, por eso la ganancia es una <b>estimación</b> (se extiende el margen de los productos con costo al resto). Carga los costos en <button className="met-chip" style={{ padding: "2px 10px" }} onClick={() => irA("costos")}>Costos de productos</button> para tener la cifra real.</AvisoFin>}
      {avisoCobTienda && <AvisoFin>Solo el <b>{pctM(cobTienda, 0)}</b> de las ventas de la tienda tiene costo en Odoo; la ganancia de la tienda es una estimación. Completa el costo de esos productos en Odoo y se corrige sola.</AvisoFin>}
      {Number(r.gastos_operativos) === 0 && <AvisoFin>Aún no hay gastos operativos registrados en este periodo (alquiler, planilla, servicios…). Hasta que los registres, la ganancia neta se verá mejor de lo que realmente es. <button className="met-chip" style={{ padding: "2px 10px" }} onClick={() => irA("gastos")}>Registrar gastos</button></AvisoFin>}
      {!r.comisiones_configuradas && <AvisoFin>Las comisiones de tarjeta y Yappy no están configuradas, así que no se descuentan. Ponlas en <button className="met-chip" style={{ padding: "2px 10px" }} onClick={() => irA("control")}>Ajustes</button>.</AvisoFin>}
      {(errPos || errFl) && <AvisoFin malo>No se pudo cargar {errPos ? "la tienda física" : "el flujo de caja"}: {errPos || errFl}. Se muestra solo lo demás.</AvisoFin>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "14px 0 0" }}>
        <span style={{ fontSize: 12.5, color: MT.texto2, fontWeight: 600 }}>Ver:</span>
        {Object.entries(CANAL_TXT).map(([k, l]) => <button key={k} className={"met-chip" + (canal === k ? " on" : "")} onClick={() => setCanal(k)}>{l}</button>)}
      </div>
      {canal !== "total" && EST.compartido > 0 && <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 6 }}>No incluye {usdM(EST.compartido, 0)} de gastos compartidos (los que marcaste para web y tienda a la vez); esos se descuentan solo en “Todo el negocio”.</div>}

      <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", marginTop: 14 }}>
        <Kpi retraso={0} etiqueta="Ventas del periodo" formula={`Ventas de productos ${usdM(E.ventasProd)} + envíos cobrados ${usdM(E.envio)}. ${canal === "tienda" ? "Son las ventas del punto de venta de Odoo (sin restar reembolsos)." : canal === "web" ? `Suma de ${numM(r.pedidos)} pedidos pagados.` : "Web + tienda física."}`}>
          <Cifra valor={E.ventasTotales} f={(v) => usdM(v, 0)} />
        </Kpi>
        <Kpi retraso={60} etiqueta="Utilidad bruta (estimada)" formula={`Ventas netas (después de reembolsos) − costo de la mercancía vendida. Margen de los productos con costo: ${E.margen === null ? "—" : pctM(E.margen * 100)}.`}
          pie={<div style={{ fontSize: 12, color: MT.suave }}>Margen {E.margen === null ? "—" : pctM(E.margen * 100)}{canal !== "tienda" ? ` · costo cargado en ${pctM(cobWeb, 0)} de las ventas web` : ""}</div>}>
          {E.utilidadBruta === null ? <span style={{ fontSize: 15, color: MT.suave }}>Carga costos para verla</span> : <Cifra valor={E.utilidadBruta} f={(v) => usdM(v, 0)} />}
        </Kpi>
        <Kpi retraso={120} etiqueta="Gastos, anuncios y comisiones" formula={`Gastos operativos ${usdM(E.gastos)} + anuncios Meta ${usdM(E.ads)} + comisiones ${usdM(E.comisiones)}. No incluye compras de mercancía (esas ya están en el costo de lo vendido).`}>
          <Cifra valor={gastosTot} f={(v) => usdM(v, 0)} />
        </Kpi>
        <Kpi acento grande retraso={180} etiqueta="Ganancia neta (estimada)" formula="Utilidad bruta − anuncios − comisiones − gastos operativos."
          pie={<div style={{ fontSize: 12, color: MT.suave }}>{E.neta === null || !(base > 0) ? "" : `${pctM((E.neta / base) * 100)} de las ventas`}</div>}>
          {E.neta === null ? <span style={{ fontSize: 15, color: MT.suave }}>Carga costos para verla</span> : <span style={{ color: E.neta >= 0 ? MT.bueno : MT.malo }}><Cifra valor={E.neta} f={(v) => (v < 0 ? "−" : "") + usdM(Math.abs(v), 0)} /></span>}
        </Kpi>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="met-sec" style={{ flex: 1, minWidth: 220 }}>Cómo se llega a la ganancia (estado de resultados)</div>
        <button className={"met-chip" + (verVertical ? " on" : "")} onClick={() => setVerVertical(v => !v)} aria-expanded={verVertical}>{verVertical ? "Ocultar análisis vertical" : "Ver análisis vertical"}</button>
      </div>
      <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
        <div className="met-card met-in" style={{ "--d": "80ms" }}>
          <div style={{ fontSize: 11.5, color: MT.suave, marginBottom: 10 }}>Cada cifra con su % sobre las ventas totales ({CANAL_TXT[canal].toLowerCase()}).</div>
          {pasos.map(([et, val, color, signo], i) => val === null ? null : <BarraH key={et} etiqueta={et} valor={Math.abs(val)} maximo={maxPaso} color={color} texto={`${signo === "−" ? "−" : "+"}${usdM(Math.abs(val), 0)}`} sub={base > 0 ? pctM((Math.abs(val) / base) * 100, 1) + " de las ventas" : undefined} retraso={i * 80} />)}
          <div style={{ borderTop: `1px solid ${MT.rejilla}`, marginTop: 6, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
            <span>Ganancia neta estimada</span>
            <span style={{ color: E.neta === null ? MT.suave : E.neta >= 0 ? MT.bueno : MT.malo }}>{E.neta === null ? "—" : signoUsd(E.neta)}{E.neta !== null && base > 0 ? <span style={{ fontSize: 12, fontWeight: 600, color: MT.suave }}> · {signoPct((E.neta / base) * 100)}</span> : null}</span>
          </div>
        </div>
        <div className="met-card met-in" style={{ "--d": "140ms" }}>
          <div className="met-lbl" style={{ marginBottom: 12 }}>Punto de equilibrio</div>
          {E.pe === null
            ? <div style={{ fontSize: 13, color: MT.texto2 }}>Se calcula cuando tienes costos cargados.</div>
            : <>
              <div style={{ fontSize: 13, color: MT.texto2, lineHeight: 1.55, marginBottom: 12 }}>Para cubrir tus gastos de este periodo necesitas vender unos <b style={{ color: MT.texto }}>{usdM(E.pe, 0)}</b> en productos. Llevas <b style={{ color: MT.texto }}>{usdM(E.ventasProd, 0)}</b>.</div>
              <Medidor etiqueta="Avance hacia el equilibrio" valor={E.pe > 0 ? (E.ventasProd / E.pe) * 100 : 100} texto={E.pe > 0 ? pctM((E.ventasProd / E.pe) * 100, 0) : "—"} nota="100% = ya cubriste todos los gastos del periodo." />
            </>}
          <div className="met-lbl" style={{ margin: "16px 0 8px" }}>Por cobrar y por pagar (hoy)</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="met-card" style={{ flex: 1, minWidth: 140, textAlign: "left", cursor: "pointer", padding: 12 }} onClick={() => irA("cuentas")}>
              <div className="met-lbl">Te deben</div><div style={{ fontSize: 22, fontWeight: 800 }}>{usdM(r.por_cobrar.total, 0)}</div>
              <div style={{ fontSize: 11.5, color: Number(r.por_cobrar.vencido) > 0 ? MT.malo : MT.suave }}>{Number(r.por_cobrar.vencido) > 0 ? `${usdM(r.por_cobrar.vencido, 0)} vencido` : `${r.por_cobrar.documentos} documento(s)`}</div>
            </button>
            <button className="met-card" style={{ flex: 1, minWidth: 140, textAlign: "left", cursor: "pointer", padding: 12 }} onClick={() => irA("cuentas")}>
              <div className="met-lbl">Debes</div><div style={{ fontSize: 22, fontWeight: 800 }}>{usdM(r.por_pagar.total, 0)}</div>
              <div style={{ fontSize: 11.5, color: Number(r.por_pagar.vencido) > 0 ? MT.malo : MT.suave }}>{Number(r.por_pagar.vencido) > 0 ? `${usdM(r.por_pagar.vencido, 0)} vencido` : `${r.por_pagar.documentos} documento(s)`}</div>
            </button>
          </div>
        </div>
      </div>

      {verVertical && (
        <div className="met-card met-in" style={{ marginTop: 14, padding: 0, overflowX: "auto" }} data-testid="analisis-vertical">
          <div style={{ padding: "16px 18px 6px" }}>
            <div className="met-lbl" style={{ fontSize: 14, color: MT.texto }}>Análisis vertical del estado de resultados</div>
            <div style={{ fontSize: 12, color: MT.suave, marginTop: 4, lineHeight: 1.5 }}>Cada línea se expresa como porcentaje de las <b>ventas totales</b> de su columna (que es el 100%). Así ves cuánto de cada dólar vendido se va en costo, publicidad y gastos, y cuánto te queda.</div>
          </div>
          <table className="met-tabla" style={{ minWidth: 720 }}>
            <thead><tr><th>Concepto</th><th>Total $</th><th>Total %</th><th>Web $</th><th>Web %</th><th>Tienda $</th><th>Tienda %</th></tr></thead>
            <tbody>
              {filasV.map(([et, w, t, tot, tipo]) => {
                const fuerte = tipo === "sub" || tipo === "tot";
                const estilo = { fontWeight: fuerte ? 800 : 500, background: tipo === "tot" ? "rgba(227,30,36,0.06)" : fuerte ? "rgba(17,17,17,0.03)" : "transparent" };
                const color = tipo === "tot" ? (tot !== null && tot < 0 ? MT.malo : MT.bueno) : tipo === "egr" ? MT.texto2 : MT.texto;
                const pTot = pctDe(tot, baseTot);
                return (
                  <tr key={et} style={estilo}>
                    <td style={{ color: tipo === "egr" ? MT.texto2 : MT.texto, paddingLeft: tipo === "egr" || tipo === "ing" ? 22 : 12 }}>{et}{et.includes("compartidos") ? <div style={{ fontSize: 11, color: MT.suave, fontWeight: 400 }}>solo se descuentan en el total</div> : null}</td>
                    <td style={{ color }}>{celdaUsd(tot, tipo)}</td>
                    <td style={{ color, minWidth: 96 }}>{celdaPct(tot, baseTot)}{pTot !== null && Math.abs(pTot) <= 100 && tipo !== "tot" && <div style={{ height: 4, borderRadius: 3, background: "rgba(17,17,17,0.07)", marginTop: 3 }}><div style={{ height: "100%", width: Math.min(100, Math.abs(pTot)) + "%", borderRadius: 3, background: tipo === "egr" ? MT.suave : MT.tinta }} /></div>}</td>
                    <td style={{ color }}>{celdaUsd(w, tipo)}</td><td style={{ color }}>{celdaPct(w, baseW)}</td>
                    <td style={{ color }}>{celdaUsd(t, tipo)}</td><td style={{ color }}>{celdaPct(t, baseT)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "12px 18px 16px", fontSize: 12.5, color: MT.texto2, lineHeight: 1.6 }}>
            {T.neta === null || !(baseTot > 0)
              ? "Carga los costos de tus productos para ver cuánto te queda de cada dólar."
              : <>Por cada <b style={{ color: MT.texto }}>$100</b> que vende el negocio: <b>{usdM(por100(T.costo), 2)}</b> se van en costo de la mercancía, <b>{usdM(por100(T.reembolsos), 2)}</b> en reembolsos, <b>{usdM(por100(T.ads), 2)}</b> en publicidad, <b>{usdM(por100(T.comisiones), 2)}</b> en comisiones y <b>{usdM(por100(T.gastos), 2)}</b> en gastos. Te {T.neta >= 0 ? "quedan" : "faltan"} <b style={{ color: T.neta >= 0 ? MT.bueno : MT.malo }}>{usdM(Math.abs(por100(T.neta)), 2)}</b>.</>}
            <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 6 }}>Las columnas Web y Tienda no incluyen los gastos compartidos, por eso su ganancia neta es “antes de gastos compartidos”. Para repartirlos, marca el canal de cada gasto en Gastos.</div>
          </div>
        </div>
      )}

      {fl && !errFl && <FlujoCaja fl={fl} irA={irA} />}

      <div className="met-sec">Mes a mes (web)</div>
      <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,430px),1fr))" }}>
        <div className="met-card met-in" style={{ "--d": "100ms" }}>
          <div className="met-lbl" style={{ marginBottom: 8 }}>Ventas web vs. gastos (anuncios + operativos)</div>
          <GraficaBarras etiquetas={serie.map(s => s.mes)} etiquetaX={mesCortoM} descripcion="Ventas y gastos por mes" alto={230}
            series={[{ nombre: "Ventas", color: MT.rojo, valores: serie.map(s => Number(s.ventas)), formato: (v) => usdM(v, 0) }, { nombre: "Gastos", color: MT.tinta, valores: serie.map(s => Number(s.gasto_ads) + Number(s.gastos_operativos)), formato: (v) => usdM(v, 0) }]} />
        </div>
        <div className="met-card met-in" style={{ "--d": "160ms" }}>
          <div className="met-lbl" style={{ marginBottom: 8 }}>Ganancia neta estimada por mes (web)</div>
          <GraficaLineas etiquetas={serie.map(s => s.mes)} etiquetaX={mesCortoM} descripcion="Ganancia neta estimada por mes" alto={230}
            series={[{ nombre: "Ganancia neta", color: MT.rojo, valores: serie.map(s => s.ganancia_neta_est === null || s.ganancia_neta_est === undefined || Number(s.ganancia_neta_est) < 0 ? (s.ganancia_neta_est === null || s.ganancia_neta_est === undefined ? null : 0) : Number(s.ganancia_neta_est)), formato: (v) => usdM(v, 0), area: true }]}
            extra={[{ nombre: "ganancia real del mes", valores: serie.map(s => s.ganancia_neta_est), formato: (v) => v === null || v === undefined ? "—" : (Number(v) < 0 ? "−" : "") + usdM(Math.abs(v), 0) }]} />
          <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 6, lineHeight: 1.45 }}>Los meses con pérdida se dibujan en $0; el tooltip muestra la cifra real. Antes de cargar tus gastos de cada mes, la ganancia sale más alta de lo real.</div>
        </div>
      </div>

      <div className="met-sec">Gastos por categoría</div>
      <div className="met-card met-in" style={{ "--d": "100ms" }}>
        {cat.length === 0 ? <div className="met-sub" style={{ fontSize: 13, color: MT.texto2 }}>No hay gastos registrados en este periodo. El gasto de Meta Ads ({usdM(r.gasto_ads, 0)}) se suma solo.</div>
          : cat.map((c, i) => <BarraH key={c.categoria} etiqueta={c.categoria} valor={Number(c.total)} maximo={maxCat} color={c.grupo === "inventario" ? MT.suave : MT.rojo} texto={usdM(c.total, 0)} sub={GRUPOS_FIN[c.grupo] || c.grupo} retraso={i * 60} />)}
        {cat.some(c => c.grupo === "inventario") && <div style={{ fontSize: 11.5, color: MT.suave, lineHeight: 1.45 }}>Las compras de mercancía (gris) salen de tu caja pero no se restan de la ganancia: ya están dentro del costo de lo vendido.</div>}
      </div>

      <details style={{ marginTop: 22 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: MT.texto2 }}>Ver los datos mes a mes en tabla</summary>
        <div className="met-card" style={{ marginTop: 10, overflowX: "auto", padding: 0 }}>
          <table className="met-tabla">
            <thead><tr>{["Mes", "Ventas web", "Anuncios", "Gastos operativos", "Ganancia neta est. (web)"].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{serie.map(s => <tr key={s.mes}><td>{s.mes}</td><td>{usdM(s.ventas, 0)}</td><td>{usdM(s.gasto_ads, 0)}</td><td>{usdM(s.gastos_operativos, 0)}</td><td><b>{s.ganancia_neta_est === null || s.ganancia_neta_est === undefined ? "—" : usdM(s.ganancia_neta_est, 0)}</b></td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ── Gastos ──
function FinGastos({ desde, hasta }) {
  const { showToast } = useApp();
  const { datos: lista, error, cargando, recargar } = useFinDatos("fin_gastos_listar", { p_desde: desde, p_hasta: hasta }, [desde, hasta]);
  const [cats, setCats] = useState([]);
  const [provs, setProvs] = useState([]);
  const vacio = { fecha: fechaPanama(), categoria_id: "", monto: "", metodo: "efectivo", proveedor_id: "", descripcion: "", comprobante: "", canal: "compartido" };
  const [f, setF] = useState(vacio);
  const [editId, setEditId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    finRpc("fin_categorias_listar").then(c => setCats((c || []).filter(x => x.activo))).catch(() => {});
    sb.get("proveedores", "?select=id,nombre&order=nombre").then(p => setProvs(p || [])).catch(() => {});
  }, []);
  const guardar = async () => {
    setGuardando(true);
    try {
      await finRpc("fin_gasto_guardar", { p: { ...f, id: editId || undefined } });
      showToast(editId ? "Gasto actualizado" : "Gasto registrado");
      setF({ ...vacio, fecha: f.fecha, categoria_id: f.categoria_id }); setEditId(null); recargar();
    } catch (e) { showToast("No se pudo guardar: " + String(e.message || e).slice(0, 140)); }
    setGuardando(false);
  };
  const anular = async (g) => {
    const motivo = prompt(`¿Anular el gasto de ${usdM(g.monto)} (${g.categoria || "sin categoría"})? Escribe el motivo:`);
    if (motivo === null) return;
    try { await finRpc("fin_gasto_anular", { p_id: g.id, p_motivo: motivo }); showToast("Gasto anulado"); recargar(); }
    catch (e) { showToast("No se pudo anular: " + String(e.message || e).slice(0, 140)); }
  };
  const editar = (g) => { setEditId(g.id); setF({ fecha: g.fecha, categoria_id: g.categoria_id || "", monto: String(g.monto), metodo: g.metodo, proveedor_id: g.proveedor_id || "", descripcion: g.descripcion || "", comprobante: g.comprobante || "", canal: g.canal || "compartido" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const vivos = (lista || []).filter(g => !g.anulado);
  const total = vivos.reduce((s, g) => s + Number(g.monto), 0);
  return (
    <div>
      <div className="met-card" style={{ marginTop: 14 }}>
        <div className="met-lbl" style={{ marginBottom: 10 }}>{editId ? "Editar gasto" : "Registrar un gasto"} <span style={{ color: MT.suave, fontWeight: 500 }}>· la publicidad de Meta no se registra aquí: entra sola</span></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><label style={lblF}>Fecha</label><input type="date" style={inpF} value={f.fecha} max={fechaPanama()} onChange={e => setF({ ...f, fecha: e.target.value })} /></div>
          <div><label style={lblF}>Categoría</label>
            <select style={{ ...inpF, minWidth: 190 }} value={f.categoria_id} onChange={e => setF({ ...f, categoria_id: e.target.value })}>
              <option value="">Elegir…</option>{cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label style={lblF}>Monto ($)</label><input style={{ ...inpF, width: 100 }} inputMode="decimal" placeholder="0.00" value={f.monto} onChange={e => setF({ ...f, monto: e.target.value.replace(",", ".") })} /></div>
          <div><label style={lblF}>Cómo se pagó</label>
            <select style={inpF} value={f.metodo} onChange={e => setF({ ...f, metodo: e.target.value })}>{METODOS_FIN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label style={lblF}>¿De qué canal es?</label>
            <select style={inpF} value={f.canal} onChange={e => setF({ ...f, canal: e.target.value })}>{CANALES_GASTO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label style={lblF}>Proveedor (opcional)</label>
            <select style={{ ...inpF, minWidth: 150 }} value={f.proveedor_id} onChange={e => setF({ ...f, proveedor_id: e.target.value })}><option value="">—</option>{provs.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
          <div style={{ flex: 1, minWidth: 180 }}><label style={lblF}>Detalle</label><input style={{ ...inpF, width: "100%", boxSizing: "border-box" }} placeholder="ej. Alquiler de bodega, noviembre" value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></div>
          <div><label style={lblF}>N.º de factura / recibo</label><input style={{ ...inpF, width: 130 }} value={f.comprobante} onChange={e => setF({ ...f, comprobante: e.target.value })} /></div>
          <button className="met-chip on" disabled={guardando || !f.categoria_id || !(Number(f.monto) > 0)} onClick={guardar} style={{ opacity: guardando || !f.categoria_id || !(Number(f.monto) > 0) ? 0.5 : 1 }}>{editId ? "Guardar cambios" : "Registrar gasto"}</button>
          {editId && <button className="met-chip" onClick={() => { setEditId(null); setF(vacio); }}>Cancelar</button>}
        </div>
        <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 8, lineHeight: 1.5 }}>{(cats.find(c => String(c.id) === String(f.categoria_id)) || {}).grupo === "inventario" && <b style={{ color: "#8A5A00" }}>Las compras que haces en Odoo (módulo Compras) ya entran solas: registra aquí solo las compras que NO estén en Odoo, para no contarlas dos veces. </b>}El canal sirve para armar el flujo de caja y el estado de resultados de la web y de la tienda por separado; si el gasto sirve a los dos (alquiler, planilla), déjalo en “Compartido”. “A crédito” significa que lo debes y aún no sale dinero: se cuenta como gasto pero no baja la caja hasta que lo pagues desde Por cobrar y pagar. Los meses cerrados no se pueden modificar.</div>
      </div>
      {error && <AvisoFin malo>{error}</AvisoFin>}
      <div className="met-sec">Gastos del periodo · {usdM(total)} en {vivos.length} registro(s)</div>
      <div className="met-card" style={{ padding: 0, overflowX: "auto", opacity: cargando ? 0.7 : 1 }}>
        <table className="met-tabla">
          <thead><tr>{["Fecha", "Categoría", "Detalle", "Canal", "Pago", "Monto", ""].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {(lista || []).length === 0 && <tr><td colSpan={7} style={{ color: MT.texto2, padding: 18 }}>Aún no hay gastos en este periodo. Cambia las fechas de arriba o registra el primero.</td></tr>}
            {(lista || []).map(g => (
              <tr key={g.id} style={{ opacity: g.anulado ? 0.45 : 1, textDecoration: g.anulado ? "line-through" : "none" }}>
                <td>{g.fecha}</td><td>{g.categoria || "—"}</td>
                <td>{g.descripcion || ""}{g.proveedor ? <span style={{ color: MT.suave }}> · {g.proveedor}</span> : null}{g.comprobante ? <span style={{ color: MT.suave }}> · #{g.comprobante}</span> : null}</td>
                <td>{(CANALES_GASTO.find(c => c[0] === g.canal) || [0, "Compartido"])[1].replace(/ \(.*\)/, "")}</td>
                <td>{(METODOS_FIN.find(m => m[0] === g.metodo) || [0, g.metodo])[1]}</td>
                <td><b>{usdM(g.monto)}</b></td>
                <td style={{ whiteSpace: "nowrap" }}>{!g.anulado && <><button className="met-chip" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => editar(g)}>Editar</button> <button className="met-chip" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => anular(g)}>Anular</button></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Margen por producto y categoría ──
function FinMargen({ desde, hasta, irA }) {
  const { datos: d, error, cargando } = useFinDatos("fin_productos_margen", { p_desde: desde, p_hasta: hasta }, [desde, hasta]);
  const [orden, setOrden] = useState("ingreso");
  const [solo, setSolo] = useState("todos");
  if (error) return <AvisoFin malo>{error}</AvisoFin>;
  if (!d) return <div style={{ padding: "50px 0", textAlign: "center", color: MT.texto2 }}>Calculando márgenes…</div>;
  const cats = d.categorias || [];
  const maxC = Math.max(1, ...cats.map(c => Number(c.ingreso)));
  let filas = [...(d.productos || [])];
  if (solo === "sin") filas = filas.filter(p => p.costo_unit === null || p.costo_unit === undefined);
  if (solo === "bajo") filas = filas.filter(p => p.margen_pct !== null && p.margen_pct !== undefined && Number(p.margen_pct) < 20);
  filas.sort((a, b) => orden === "margen_pct" ? (Number(a.margen_pct ?? 1e9) - Number(b.margen_pct ?? 1e9)) : orden === "margen" ? (Number(b.margen ?? -1e9) - Number(a.margen ?? -1e9)) : Number(b.ingreso) - Number(a.ingreso));
  return (
    <div style={{ opacity: cargando ? 0.7 : 1 }}>
      {Number(d.vendidos_sin_costo) > 0 && <AvisoFin>{d.vendidos_sin_costo} de los {d.vendidos_total} productos vendidos en este periodo no tienen costo cargado; no aparecen con margen. Quedan {d.activos_sin_costo} de {d.activos_total} productos activos sin costo. <button className="met-chip" style={{ padding: "2px 10px" }} onClick={() => irA("costos")}>Cargar costos</button></AvisoFin>}
      <div className="met-sec">Margen por categoría</div>
      <div className="met-card">
        {cats.length === 0 ? <div style={{ fontSize: 13, color: MT.texto2 }}>No hay ventas en este periodo.</div> : cats.map((c, i) => (
          <BarraH key={c.categoria} etiqueta={c.categoria} valor={Number(c.ingreso)} maximo={maxC} color={c.margen_pct === null || c.margen_pct === undefined ? MT.suave : MT.rojo}
            texto={usdM(c.ingreso, 0)} sub={c.margen_pct === null || c.margen_pct === undefined ? "sin costos cargados" : `margen ${pctM(c.margen_pct, 0)} · ${usdM(c.margen, 0)} de ganancia`} retraso={i * 50} />
        ))}
      </div>
      <div className="met-sec">Productos</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {[["ingreso", "Más vendidos"], ["margen", "Más ganancia"], ["margen_pct", "Menor margen %"]].map(([k, l]) => <button key={k} className={"met-chip" + (orden === k ? " on" : "")} onClick={() => setOrden(k)}>{l}</button>)}
        <span style={{ width: 10 }} />
        {[["todos", "Todos"], ["bajo", "Margen menor a 20%"], ["sin", "Sin costo"]].map(([k, l]) => <button key={k} className={"met-chip" + (solo === k ? " on" : "")} onClick={() => setSolo(k)}>{l}</button>)}
      </div>
      <div className="met-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="met-tabla">
          <thead><tr>{["Producto", "Categoría", "Piezas", "Ventas", "Costo", "Ganancia", "Margen"].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={7} style={{ padding: 18, color: MT.texto2 }}>Nada para mostrar con este filtro.</td></tr>}
            {filas.slice(0, 150).map(p => (
              <tr key={p.producto_id}>
                <td><b>{p.nombre}</b>{p.referencia ? <span style={{ color: MT.suave }}> · {p.referencia}</span> : null}</td>
                <td>{p.categoria}</td><td>{numM(p.piezas)}</td><td>{usdM(p.ingreso, 0)}</td>
                <td>{p.costo_unit === null || p.costo_unit === undefined ? <span style={{ color: MT.suave }}>sin costo</span> : usdM(p.costo_total, 0)}</td>
                <td>{p.margen === null || p.margen === undefined ? "—" : usdM(p.margen, 0)}</td>
                <td><b style={{ color: p.margen_pct === null || p.margen_pct === undefined ? MT.suave : Number(p.margen_pct) < 20 ? MT.malo : MT.bueno }}>{p.margen_pct === null || p.margen_pct === undefined ? "—" : pctM(p.margen_pct, 0)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filas.length > 150 && <div style={{ fontSize: 12, color: MT.suave, marginTop: 8 }}>Se muestran los primeros 150 de {filas.length}.</div>}
    </div>
  );
}

// ── Costos de productos (privados) ──
function FinCostos({ productos, onGuardado }) {
  const { showToast } = useApp();
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState({}); // id -> texto
  const [buscar, setBuscar] = useState("");
  const [solo, setSolo] = useState("sin");
  const [limite, setLimite] = useState(80);
  const [pegar, setPegar] = useState("");
  const [verPegar, setVerPegar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [, setVer] = useState(0);
  const [cfg, setCfg] = useState(null);
  const [sincro, setSincro] = useState(false);
  useEffect(() => { finCargarCostos().then(() => setListo(true)).catch(e => setError(String(e.message || e).slice(0, 200))); finRpc("fin_config_leer").then(setCfg).catch(() => {}); }, []);
  const traerOdoo = async () => {
    setSincro(true);
    try {
      await sb.ensureFreshToken();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-odoo-costos`, { method: "POST", headers: sb.functionHeaders(), body: "{}" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detalle || j.error || "Error");
      await finCargarCostos(); setVer(v => v + 1); onGuardado && onGuardado(); setCfg(await finRpc("fin_config_leer"));
      const rs = j.resumen || {}; showToast(rs.nota || `Odoo: ${rs.nuevos || 0} nuevos, ${rs.actualizados || 0} actualizados`);
    } catch (e) { showToast("No se pudo traer de Odoo: " + String(e.message || e).slice(0, 140)); }
    setSincro(false);
  };
  const actuales = (id) => COSTOS_FIN.get(id);
  const valor = (p) => edits[p.id] !== undefined ? edits[p.id] : (actuales(p.id) !== undefined ? String(actuales(p.id)) : "");
  const activos = (productos || []).filter(p => p.activo !== false);
  const sinCosto = activos.filter(p => actuales(p.id) === undefined).length;
  const t = buscar.trim().toLowerCase();
  let filas = activos.filter(p => (!t || (p.referencia || "").toLowerCase().includes(t) || (p.nombre || "").toLowerCase().includes(t)));
  if (solo === "sin") filas = filas.filter(p => actuales(p.id) === undefined || edits[p.id] !== undefined);
  const cambios = Object.keys(edits).length;
  const aplicarPegado = () => {
    const mapa = new Map(); (productos || []).forEach(p => { if (p.referencia) mapa.set(String(p.referencia).trim().toLowerCase(), p.id); });
    const nuevo = { ...edits }; let ok = 0, fallo = 0;
    pegar.split(/\r?\n/).forEach(l => {
      const partes = l.split(/[\t;,]/).map(x => x.trim()); if (partes.length < 2 || !partes[0]) return;
      const id = mapa.get(partes[0].toLowerCase()); const c = Number(partes[1].replace("$", "").replace(",", "."));
      if (id !== undefined && Number.isFinite(c) && c >= 0) { nuevo[id] = String(c); ok++; } else fallo++;
    });
    setEdits(nuevo); setPegar(""); setVerPegar(false);
    showToast(`${ok} costo(s) listos para guardar${fallo ? ` · ${fallo} línea(s) no se reconocieron` : ""}`);
  };
  const guardar = async () => {
    setGuardando(true);
    try {
      const items = Object.entries(edits).map(([id, v]) => ({ producto_id: Number(id), costo: String(v).trim() === "" ? null : Number(String(v).replace(",", ".")) }));
      if (items.some(i => i.costo !== null && !(i.costo >= 0))) throw new Error("Hay un costo que no es un número válido");
      await finRpc("fin_costos_guardar", { p_items: items });
      await finCargarCostos(); setEdits({}); setVer(v => v + 1); onGuardado && onGuardado();
      showToast("Costos guardados");
    } catch (e) { showToast("No se pudo guardar: " + String(e.message || e).slice(0, 140)); }
    setGuardando(false);
  };
  if (error) return <AvisoFin malo>No se pudieron cargar los costos: {error}</AvisoFin>;
  if (!listo) return <div style={{ padding: "50px 0", textAlign: "center", color: MT.texto2 }}>Cargando costos…</div>;
  return (
    <div>
      <div className="met-aviso" style={{ background: "#EEF6FF", borderColor: "#BBD7F5", color: "#1D4F86" }}>
        Costo de <b>cada pieza</b> (lo que te cuesta a ti, por unidad). Son <b>privados</b>: se guardan en una tabla cerrada que ni los clientes ni tus operadores pueden leer. Se traen <b>solos desde Odoo cada hora</b> (solo lectura: la web nunca cambia nada en Odoo); si escribes uno a mano, ese manda y Odoo no lo pisa (salvo que cambies el modo a “Odoo manda”). Los que vienen de Odoo se mantienen al día solos.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10, fontSize: 12.5, color: MT.texto2 }}>
        <button className="met-chip on" onClick={traerOdoo} disabled={sincro} style={{ opacity: sincro ? 0.6 : 1 }}>{sincro ? "Trayendo de Odoo…" : "Traer costos de Odoo ahora"}</button>
        {cfg && cfg.costos_odoo_ultima
          ? <span>Última vez: {new Date(cfg.costos_odoo_ultima).toLocaleString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{cfg.costos_odoo_resumen ? ` · ${cfg.costos_odoo_resumen.nuevos} nuevos, ${cfg.costos_odoo_resumen.actualizados} actualizados, ${cfg.costos_odoo_resumen.sin_costo_en_odoo} sin costo en Odoo` : ""}</span>
          : <span>Aún no se ha traído ninguno.</span>}
        {cfg && cfg.costos_odoo_modo !== "solo_vacios" && <span style={{ color: MT.malo }}>Modo: {cfg.costos_odoo_modo === "siempre" ? "Odoo manda" : "apagado"} (se cambia en Ajustes y control)</span>}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        <input style={{ ...inpF, minWidth: 230 }} placeholder="Buscar por referencia o nombre…" value={buscar} onChange={e => { setBuscar(e.target.value); setLimite(80); }} />
        {[["sin", `Sin costo (${sinCosto})`], ["todos", "Todos"]].map(([k, l]) => <button key={k} className={"met-chip" + (solo === k ? " on" : "")} onClick={() => { setSolo(k); setLimite(80); }}>{l}</button>)}
        <button className="met-chip" onClick={() => setVerPegar(v => !v)}>Pegar desde Excel</button>
        <span style={{ flex: 1 }} />
        <button className="met-chip on" disabled={!cambios || guardando} style={{ opacity: !cambios || guardando ? 0.5 : 1 }} onClick={guardar}>{guardando ? "Guardando…" : `Guardar ${cambios || ""} cambio(s)`}</button>
        {cambios > 0 && <button className="met-chip" onClick={() => setEdits({})}>Descartar</button>}
      </div>
      {verPegar && (
        <div className="met-card" style={{ marginBottom: 12 }}>
          <div className="met-lbl" style={{ marginBottom: 6 }}>Una línea por producto: referencia, un espacio de tabulación (o coma) y el costo por pieza</div>
          <textarea style={{ ...inpF, width: "100%", boxSizing: "border-box", minHeight: 110, fontFamily: "ui-monospace,monospace" }} placeholder={"99140\t2.15\n99141,3.40"} value={pegar} onChange={e => setPegar(e.target.value)} />
          <div style={{ marginTop: 8 }}><button className="met-chip on" onClick={aplicarPegado} disabled={!pegar.trim()}>Cargar a la lista</button> <span style={{ fontSize: 12, color: MT.suave }}>Revisa la lista y toca “Guardar” para confirmar.</span></div>
        </div>
      )}
      <div className="met-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="met-tabla">
          <thead><tr>{["Referencia", "Producto", "Precio pieza", "Costo por pieza", "Margen"].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={5} style={{ padding: 18, color: MT.texto2 }}>{solo === "sin" ? "¡Todos los productos activos tienen costo!" : "Nada que mostrar."}</td></tr>}
            {filas.slice(0, limite).map(p => {
              const v = valor(p); const c = Number(String(v).replace(",", ".")); const pr = Number(p.precio_pieza) || 0;
              const mg = v !== "" && Number.isFinite(c) && pr > 0 ? ((pr - c) / pr) * 100 : null;
              return (
                <tr key={p.id} style={edits[p.id] !== undefined ? { background: "#FFF8E5" } : undefined}>
                  <td>{p.referencia || "—"}</td><td>{p.nombre}</td><td>{pr > 0 ? usdM(pr) : "—"}</td>
                  <td><input style={{ ...inpF, width: 96 }} inputMode="decimal" placeholder="0.00" value={v} onChange={e => setEdits({ ...edits, [p.id]: e.target.value.replace(",", ".") })} />{edits[p.id] === undefined && COSTOS_ORIGEN.get(p.id) === "odoo" && <span style={{ marginLeft: 6, fontSize: 11, color: MT.suave }}>de Odoo</span>}</td>
                  <td><b style={{ color: mg === null ? MT.suave : mg < 0 ? MT.malo : mg < 20 ? "#8A5A00" : MT.bueno }}>{mg === null ? "—" : pctM(mg, 0)}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filas.length > limite && <div style={{ marginTop: 10 }}><button className="met-chip" onClick={() => setLimite(l => l + 120)}>Mostrar más ({filas.length - limite} restantes)</button></div>}
    </div>
  );
}

// ── Por cobrar y por pagar ──
function FinCuentas() {
  const { showToast } = useApp();
  const [tipo, setTipo] = useState("cobrar");
  const { datos: docs, error, cargando, recargar } = useFinDatos("fin_docs_listar", { p_tipo: tipo }, [tipo]);
  const [provs, setProvs] = useState([]);
  const vacio = { contraparte: "", monto: "", fecha: fechaPanama(), vence: "", descripcion: "", proveedor_id: "" };
  const [f, setF] = useState(vacio);
  const [abonando, setAbonando] = useState(null); // id del documento
  const [ab, setAb] = useState({ monto: "", metodo: "efectivo", fecha: fechaPanama(), nota: "" });
  useEffect(() => { sb.get("proveedores", "?select=id,nombre&order=nombre").then(p => setProvs(p || [])).catch(() => {}); }, []);
  const crear = async () => {
    try { await finRpc("fin_doc_guardar", { p: { ...f, tipo } }); showToast("Registrado"); setF(vacio); recargar(); }
    catch (e) { showToast("No se pudo guardar: " + String(e.message || e).slice(0, 140)); }
  };
  const abonar = async (d) => {
    try { await finRpc("fin_abono_registrar", { p_documento: d.id, p_fecha: ab.fecha, p_monto: Number(ab.monto), p_metodo: ab.metodo, p_nota: ab.nota }); showToast(tipo === "cobrar" ? "Cobro registrado" : "Pago registrado"); setAbonando(null); setAb({ monto: "", metodo: "efectivo", fecha: fechaPanama(), nota: "" }); recargar(); }
    catch (e) { showToast("No se pudo registrar: " + String(e.message || e).slice(0, 140)); }
  };
  const anular = async (d) => {
    if (!confirm(`¿Anular el registro de ${d.contraparte} por ${usdM(d.monto)}?`)) return;
    try { await finRpc("fin_doc_anular", { p_id: d.id }); showToast("Anulado"); recargar(); }
    catch (e) { showToast("No se pudo anular: " + String(e.message || e).slice(0, 140)); }
  };
  const vivos = (docs || []).filter(d => !d.anulado);
  const pendiente = vivos.reduce((s, d) => s + Math.max(0, Number(d.saldo)), 0);
  const venc = vivos.filter(d => d.estado === "vencido").reduce((s, d) => s + Number(d.saldo), 0);
  const esCobrar = tipo === "cobrar";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
        <button className={"met-chip" + (esCobrar ? " on" : "")} onClick={() => setTipo("cobrar")}>Por cobrar (te deben)</button>
        <button className={"met-chip" + (!esCobrar ? " on" : "")} onClick={() => setTipo("pagar")}>Por pagar (debes)</button>
      </div>
      <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        <Kpi etiqueta={esCobrar ? "Total que te deben" : "Total que debes"} grande acento><Cifra valor={pendiente} f={(v) => usdM(v, 0)} /></Kpi>
        <Kpi etiqueta="De eso, ya vencido"><span style={{ color: venc > 0 ? MT.malo : MT.texto }}><Cifra valor={venc} f={(v) => usdM(v, 0)} /></span></Kpi>
      </div>
      <div className="met-card" style={{ marginTop: 14 }}>
        <div className="met-lbl" style={{ marginBottom: 10 }}>{esCobrar ? "Anotar una venta a crédito" : "Anotar una deuda con un proveedor"}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          {esCobrar
            ? <div><label style={lblF}>Cliente</label><input style={{ ...inpF, minWidth: 170 }} value={f.contraparte} onChange={e => setF({ ...f, contraparte: e.target.value })} placeholder="Nombre del cliente" /></div>
            : <div><label style={lblF}>Proveedor</label>
              <select style={{ ...inpF, minWidth: 170 }} value={f.proveedor_id} onChange={e => { const p = provs.find(x => String(x.id) === e.target.value); setF({ ...f, proveedor_id: e.target.value, contraparte: p ? p.nombre : f.contraparte }); }}><option value="">Otro / escribir abajo…</option>{provs.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
              {!f.proveedor_id && <input style={{ ...inpF, marginTop: 6, width: "100%", boxSizing: "border-box" }} value={f.contraparte} onChange={e => setF({ ...f, contraparte: e.target.value })} placeholder="Nombre" />}</div>}
          <div><label style={lblF}>Monto ($)</label><input style={{ ...inpF, width: 100 }} inputMode="decimal" value={f.monto} onChange={e => setF({ ...f, monto: e.target.value.replace(",", ".") })} placeholder="0.00" /></div>
          <div><label style={lblF}>Fecha</label><input type="date" style={inpF} value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></div>
          <div><label style={lblF}>Vence</label><input type="date" style={inpF} value={f.vence} min={f.fecha} onChange={e => setF({ ...f, vence: e.target.value })} /></div>
          <div style={{ flex: 1, minWidth: 160 }}><label style={lblF}>Detalle</label><input style={{ ...inpF, width: "100%", boxSizing: "border-box" }} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} placeholder="ej. Factura 1234" /></div>
          <button className="met-chip on" disabled={!f.contraparte.trim() || !(Number(f.monto) > 0)} style={{ opacity: !f.contraparte.trim() || !(Number(f.monto) > 0) ? 0.5 : 1 }} onClick={crear}>Registrar</button>
        </div>
      </div>
      {error && <AvisoFin malo>{error}</AvisoFin>}
      <div className="met-sec">{esCobrar ? "Cuentas por cobrar" : "Cuentas por pagar"}</div>
      <div style={{ display: "grid", gap: 10, opacity: cargando ? 0.7 : 1 }}>
        {vivos.length === 0 && <div className="met-card" style={{ color: MT.texto2, fontSize: 13 }}>{esCobrar ? "Nadie te debe nada registrado." : "No tienes deudas registradas con proveedores."}</div>}
        {vivos.map(d => {
          const [lab, col] = ESTADO_DOC[d.estado] || ESTADO_DOC.pendiente;
          return (
            <div key={d.id} className="met-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div><b>{d.contraparte}</b> <span style={{ color: MT.suave, fontSize: 12.5 }}>· {d.fecha}{d.vence ? ` · vence ${d.vence}` : ""}{d.descripcion ? ` · ${d.descripcion}` : ""}</span></div>
                <div style={{ textAlign: "right" }}><b style={{ fontSize: 16 }}>{usdM(d.saldo)}</b> <span style={{ fontSize: 12, color: MT.suave }}>de {usdM(d.monto)}</span> <span style={{ fontSize: 12, fontWeight: 700, color: col, marginLeft: 6 }}>{lab}</span></div>
              </div>
              {d.abonos.length > 0 && <div style={{ fontSize: 12, color: MT.texto2, marginTop: 6 }}>{d.abonos.map(a => <span key={a.id} style={{ marginRight: 12 }}>{a.fecha}: {usdM(a.monto)}{a.nota ? ` (${a.nota})` : ""}</span>)}</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "flex-end" }}>
                {Number(d.saldo) > 0 && abonando !== d.id && <button className="met-chip" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => { setAbonando(d.id); setAb({ ...ab, monto: String(d.saldo) }); }}>{esCobrar ? "Registrar cobro" : "Registrar pago"}</button>}
                <button className="met-chip" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => anular(d)}>Anular</button>
              </div>
              {abonando === d.id && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${MT.rejilla}` }}>
                  <div><label style={lblF}>Monto ($)</label><input style={{ ...inpF, width: 100 }} inputMode="decimal" value={ab.monto} onChange={e => setAb({ ...ab, monto: e.target.value.replace(",", ".") })} /></div>
                  <div><label style={lblF}>Fecha</label><input type="date" style={inpF} value={ab.fecha} onChange={e => setAb({ ...ab, fecha: e.target.value })} /></div>
                  <div><label style={lblF}>Método</label><select style={inpF} value={ab.metodo} onChange={e => setAb({ ...ab, metodo: e.target.value })}>{METODOS_ABONO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                  <div><label style={lblF}>Nota</label><input style={{ ...inpF, width: 150 }} value={ab.nota} onChange={e => setAb({ ...ab, nota: e.target.value })} /></div>
                  <button className="met-chip on" disabled={!(Number(ab.monto) > 0)} onClick={() => abonar(d)}>Confirmar</button>
                  <button className="met-chip" onClick={() => setAbonando(null)}>Cancelar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Ajustes, cierre de meses y bitácora ──
const TABLA_BIT = { fin_gastos: "Gasto", fin_costos_producto: "Costo de producto", fin_documentos: "Cuenta por cobrar/pagar", fin_abonos: "Cobro o pago", fin_config: "Ajustes", fin_periodos_cerrados: "Cierre de mes", fin_categorias_gasto: "Categoría de gasto" };
const ACCION_BIT = { INSERT: "Creó", UPDATE: "Cambió", DELETE: "Borró" };
function resumenBit(b) {
  const d = b.despues || b.antes || {}; const p = [];
  if (d.monto !== undefined) p.push(usdM(d.monto));
  if (d.costo !== undefined) p.push("costo " + usdM(d.costo, 2));
  if (d.producto_id !== undefined) p.push("producto " + d.producto_id);
  if (d.contraparte) p.push(d.contraparte);
  if (d.descripcion) p.push(String(d.descripcion).slice(0, 40));
  if (d.mes) p.push(String(d.mes).slice(0, 7));
  if (d.anulado === true && b.accion === "UPDATE") p.push("anulado");
  return p.join(" · ");
}
function FinControl() {
  const { showToast } = useApp();
  const cfg = useFinDatos("fin_config_leer", {}, []);
  const per = useFinDatos("fin_periodos_listar", {}, []);
  const bit = useFinDatos("fin_bitacora_listar", { p_limite: 120 }, []);
  const [c, setC] = useState(null);
  useEffect(() => { if (cfg.datos && !c) setC({ saldo_inicial: String(cfg.datos.saldo_inicial ?? 0), fecha_saldo: cfg.datos.fecha_saldo || "", comision_tarjeta_pct: cfg.datos.comision_tarjeta_pct ?? "", comision_yappy_pct: cfg.datos.comision_yappy_pct ?? "", costos_odoo_modo: cfg.datos.costos_odoo_modo || "solo_vacios" }); }, [cfg.datos]);
  const guardar = async () => {
    try { await finRpc("fin_config_guardar", { p: c }); showToast("Ajustes guardados"); cfg.recargar(); bit.recargar(); }
    catch (e) { showToast("No se pudo guardar: " + String(e.message || e).slice(0, 140)); }
  };
  const mesAnterior = (() => { const [a, m] = fechaPanama().split("-").map(Number); const d = new Date(Date.UTC(a, m - 2, 1)); return d.toISOString().slice(0, 10); })();
  const cerrados = per.datos || [];
  const accion = async (fn, mes, ok) => {
    try { await finRpc(fn, { p_mes: mes }); showToast(ok); per.recargar(); bit.recargar(); }
    catch (e) { showToast("No se pudo: " + String(e.message || e).slice(0, 140)); }
  };
  return (
    <div>
      <div className="met-sec">Ajustes</div>
      <div className="met-card">
        {!c ? <div style={{ color: MT.texto2, fontSize: 13 }}>{cfg.error || "Cargando…"}</div> : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><label style={lblF}>Dinero en caja y bancos ($)</label><input style={{ ...inpF, width: 130 }} inputMode="decimal" value={c.saldo_inicial} onChange={e => setC({ ...c, saldo_inicial: e.target.value.replace(",", ".") })} /></div>
            <div><label style={lblF}>… al día</label><input type="date" style={inpF} value={c.fecha_saldo} max={fechaPanama()} onChange={e => setC({ ...c, fecha_saldo: e.target.value })} /></div>
            <div><label style={lblF}>Comisión de tarjeta (%)</label><input style={{ ...inpF, width: 90 }} inputMode="decimal" placeholder="ej. 3.5" value={c.comision_tarjeta_pct} onChange={e => setC({ ...c, comision_tarjeta_pct: e.target.value.replace(",", ".") })} /></div>
            <div><label style={lblF}>Comisión de Yappy (%)</label><input style={{ ...inpF, width: 90 }} inputMode="decimal" placeholder="ej. 1" value={c.comision_yappy_pct} onChange={e => setC({ ...c, comision_yappy_pct: e.target.value.replace(",", ".") })} /></div>
            <div style={{ flexBasis: "100%" }}><label style={lblF}>Costos de productos desde Odoo (cada hora)</label>
              <select style={{ ...inpF, width: "100%", maxWidth: 520 }} value={c.costos_odoo_modo} onChange={e => setC({ ...c, costos_odoo_modo: e.target.value })}>{MODOS_ODOO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <button className="met-chip on" onClick={guardar}>Guardar ajustes</button>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 8, lineHeight: 1.5 }}>El saldo y su fecha sirven para estimar cuánto dinero deberías tener hoy. Las comisiones se descuentan de la ganancia según lo cobrado por tarjeta y Yappy. Pregunta a tu banco el % exacto.</div>
      </div>

      <div className="met-sec">Cierre de meses</div>
      <div className="met-card">
        <div style={{ fontSize: 13, color: MT.texto2, lineHeight: 1.55, marginBottom: 10 }}>Cuando un mes ya está revisado, ciérralo: nadie podrá agregar, editar ni anular gastos o pagos de ese mes (tampoco tú) hasta que lo vuelvas a abrir. Así los números de meses pasados no cambian por accidente.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!cerrados.some(x => x.mes === mesAnterior.slice(0, 7)) && <button className="met-chip on" onClick={() => accion("fin_periodo_cerrar", mesAnterior, "Mes cerrado")}>Cerrar {mesAnterior.slice(0, 7)}</button>}
          {cerrados.map(x => <span key={x.mes} className="met-chip" style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "default" }}>{x.mes} cerrado <button className="met-info" title="Abrir de nuevo" aria-label={`Abrir ${x.mes}`} onClick={() => accion("fin_periodo_abrir", x.mes + "-01", "Mes abierto")}>↺</button></span>)}
          {cerrados.length === 0 && mesAnterior && <span style={{ fontSize: 12.5, color: MT.suave }}>Aún no has cerrado ningún mes.</span>}
        </div>
      </div>

      <div className="met-sec">Bitácora: quién cambió qué y cuándo</div>
      <div className="met-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="met-tabla">
          <thead><tr>{["Cuándo", "Quién", "Qué", "Detalle"].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {(bit.datos || []).length === 0 && <tr><td colSpan={4} style={{ padding: 18, color: MT.texto2 }}>{bit.error || "Aún no hay movimientos."}</td></tr>}
            {(bit.datos || []).map(b => <tr key={b.id}><td style={{ whiteSpace: "nowrap" }}>{new Date(b.at).toLocaleString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td><td>{b.usuario || "sistema"}</td><td>{ACCION_BIT[b.accion] || b.accion} · {TABLA_BIT[b.tabla] || b.tabla}</td><td>{resumenBit(b)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="met-card" style={{ marginTop: 18 }}>
        <div className="met-lbl" style={{ marginBottom: 6 }}>Conexión con Odoo</div>
        <div style={{ fontSize: 13, color: MT.texto2, lineHeight: 1.6 }}>Los costos de tus productos ya se traen solos desde Odoo (solo lectura). Mientras tu contabilidad en Odoo no esté lista, los gastos y deudas se llevan aquí; cuando Odoo sea tu libro oficial se pueden conectar o importar para no duplicar el trabajo (cada gasto y cuenta ya trae un campo reservado para enlazarse con Odoo). Cuando tengas Odoo listo, cambia el modo a “Odoo manda”.</div>
      </div>
    </div>
  );
}

function FinanzasPanel({ desde, hasta, filtro, productos, onCostosCambio }) {
  const [vista, setVista] = useState("resumen");
  const VISTAS = [["resumen", "Resumen"], ["gastos", "Gastos"], ["margen", "Márgenes"], ["compras", "Compras (Odoo)"], ["costos", "Costos de productos"], ["cuentas", "Por cobrar y pagar"], ["control", "Ajustes y control"]];
  return (
    <div className="met">
      <style>{ESTILO_MET}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 className="met-h1">Finanzas</h2>
          <div className="met-sub" style={{ marginTop: 6 }}>Cuánto ganas de verdad después de costos, anuncios y gastos; qué productos dejan más; y cuánto dinero te deben y debes. Visible solo para ti.</div>
        </div>
        <div className="met-live"><Lock size={12} /> Privado · solo dueño</div>
      </div>
      <div style={{ margin: "18px 0 8px" }}>{filtro}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 4px" }}>
        {VISTAS.map(([k, l]) => <button key={k} className={"met-chip" + (vista === k ? " on" : "")} onClick={() => setVista(k)}>{l}</button>)}
      </div>
      {vista === "resumen" && <FinResumen desde={desde} hasta={hasta} irA={setVista} />}
      {vista === "gastos" && <FinGastos desde={desde} hasta={hasta} />}
      {vista === "margen" && <FinMargen desde={desde} hasta={hasta} irA={setVista} />}
      {vista === "compras" && <FinCompras desde={desde} hasta={hasta} />}
      {vista === "costos" && <FinCostos productos={productos} onGuardado={onCostosCambio} />}
      {vista === "cuentas" && <FinCuentas />}
      {vista === "control" && <FinControl />}
    </div>
  );
}

// ═══════════ VENTAS DE TIENDA FÍSICA (punto de venta de Odoo) — SOLO DUEÑO ═══════════
// Las ventas del POS de Odoo se copian (solo lectura) a tablas privadas cada 10 minutos. Esta vista solo habla con
// la función pos_resumen, que vuelve a comprobar que quien pregunta es el dueño.
function haceCuanto(iso) {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
}
function TiendaFisicaPanel({ desde, hasta, ventasWeb = null, envolver = false, titulo = "Ventas de tienda física" }) {
  const { showToast } = useApp();
  const { datos: r, error, cargando, recargar } = useFinDatos("pos_resumen", { p_desde: desde, p_hasta: hasta }, [desde, hasta]);
  // Los productos que más vende la web en el mismo periodo (para ponerlos al lado de los de la tienda)
  const { datos: prodWeb, error: errProdWeb } = useFinDatos("fin_productos_margen", { p_desde: desde, p_hasta: hasta }, [desde, hasta]);
  const [sincro, setSincro] = useState(false);
  const sincronizar = async () => {
    setSincro(true);
    try {
      await sb.ensureFreshToken();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/sync-odoo-pos`, { method: "POST", headers: sb.functionHeaders(), body: "{}" });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j.detalle || j.error || "Error");
      await recargar();
      showToast(j.nuevas > 0 ? `Tienda física: ${j.nuevas} venta(s) nueva(s) de Odoo` : "Tienda física al día");
    } catch (e) { showToast("No se pudo actualizar desde Odoo: " + String(e.message || e).slice(0, 140)); }
    setSincro(false);
  };

  let cuerpo;
  if (error) cuerpo = <AvisoFin malo>No se pudieron cargar las ventas de la tienda física: {error}</AvisoFin>;
  else if (!r) cuerpo = <div style={{ padding: "40px 0", textAlign: "center", color: MT.texto2 }}>Cargando ventas de la tienda…</div>;
  else {
    const ventas = Number(r.ventas) || 0;
    const tickets = Number(r.tickets) || 0;
    const ganancia = r.ganancia_est === null || r.ganancia_est === undefined ? null : Number(r.ganancia_est);
    const cob = r.cobertura_costo_pct === null || r.cobertura_costo_pct === undefined ? null : Number(r.cobertura_costo_pct);
    const hayVentas = tickets > 0 || ventas !== 0;
    // Serie: por día (periodos cortos) o por mes (periodos largos)
    const mapaDia = new Map((r.serie || []).map(s => [String(s.dia).slice(0, 10), Number(s.ventas) || 0]));
    const dias = []; for (let d = desde; d <= hasta && dias.length < 800; d = sumarDiasISO(d, 1)) dias.push(d);
    const porMes = dias.length > 62;
    let etiquetas, valores;
    if (porMes) {
      const m = new Map(); (r.serie || []).forEach(s => { const k = String(s.dia).slice(0, 7); m.set(k, (m.get(k) || 0) + (Number(s.ventas) || 0)); });
      etiquetas = [...m.keys()].sort(); valores = etiquetas.map(k => Math.round(m.get(k) * 100) / 100);
    } else { etiquetas = dias; valores = dias.map(d => mapaDia.get(d) || 0); }
    // Horas
    const mh = new Map((r.por_hora || []).map(h => [Number(h.hora), Number(h.ventas) || 0]));
    const hs = [...mh.keys()]; const h0 = hs.length ? Math.min(...hs) : 8, h1 = hs.length ? Math.max(...hs) : 18;
    const horas = []; for (let h = h0; h <= h1; h++) horas.push(h);
    const pagos = r.pagos || []; const totalPagos = pagos.reduce((a, p) => a + Math.max(0, Number(p.monto) || 0), 0) || 1;
    const maxCaj = Math.max(1, ...(r.cajeros || []).map(c => Number(c.ventas) || 0));
    const web = ventasWeb === null ? null : Number(ventasWeb) || 0;
    const totalNeg = web === null ? null : web + ventas;
    cuerpo = (
      <div style={{ opacity: cargando ? 0.7 : 1, transition: "opacity .25s" }}>
        {!hayVentas ? <div className="met-card" style={{ textAlign: "center", color: MT.texto2, padding: 28 }}>No hubo ventas en la tienda física en este periodo.</div> : <>
          {cob !== null && cob < 97 && <AvisoFin>Solo el <b>{pctM(cob, 0)}</b> de las ventas de la tienda tiene costo en Odoo, por eso la ganancia es una <b>estimación</b>: se aplica el margen de los productos con costo al resto. Completa el costo de esos productos en Odoo y se corrige sola.</AvisoFin>}
          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", marginTop: 12 }}>
            <Kpi acento retraso={0} etiqueta="Ventas de la tienda" formula={`Todo lo cobrado en caja en el periodo (${numM(tickets)} ventas), ya restados los reembolsos (${usdM(Math.abs(Number(r.reembolsos) || 0))}). Fechas con hora de Panamá.`}
              pie={<div style={{ fontSize: 12, color: MT.suave }}>{numM(tickets)} venta{tickets === 1 ? "" : "s"}{Number(r.n_reembolsos) > 0 ? ` · ${numM(r.n_reembolsos)} reembolso${Number(r.n_reembolsos) === 1 ? "" : "s"}` : ""}</div>}>
              <Cifra valor={ventas} f={(v) => usdM(v, 0)} />
            </Kpi>
            <Kpi retraso={60} etiqueta="Ticket promedio" formula="Ventas de la tienda ÷ número de ventas (sin contar reembolsos como venta).">
              <Cifra valor={Number(r.ticket_promedio) || 0} f={(v) => usdM(v)} />
            </Kpi>
            <Kpi retraso={120} etiqueta="Ganancia estimada" formula={`Ventas sin impuesto × margen de los productos que tienen costo en Odoo (${pctM(r.margen_pct)}). Costo de lo vendido: ${usdM(r.costo, 0)}. No descuenta gastos operativos.`}
              pie={<div style={{ fontSize: 12, color: MT.suave }}>{r.margen_pct === null || r.margen_pct === undefined ? "Sin costos en Odoo" : `Margen ${pctM(r.margen_pct)}`}{cob !== null ? ` · costo en ${pctM(cob, 0)} de las ventas` : ""}</div>}>
              {ganancia === null ? <span style={{ fontSize: 15, color: MT.suave }}>Faltan costos</span> : <Cifra valor={ganancia} f={(v) => usdM(v, 0)} />}
            </Kpi>
            <Kpi retraso={180} etiqueta="Unidades vendidas" formula="Suma de piezas de todas las líneas vendidas (los reembolsos restan).">
              <Cifra valor={Number(r.unidades) || 0} f={(v) => numM(Math.round(v))} />
            </Kpi>
          </div>

          {web !== null && (
            <div className="met-card met-in" style={{ marginTop: 14, "--d": "120ms" }}>
              <div className="met-lbl" style={{ marginBottom: 10 }}>Web vs. tienda física en el periodo</div>
              <div style={{ display: "flex", height: 8, borderRadius: 8, overflow: "hidden", gap: 2 }} role="img" aria-label={`Web ${usdM(web, 0)} y tienda física ${usdM(ventas, 0)}`}>
                <div style={{ width: (totalNeg > 0 ? (Math.max(0, web) / totalNeg) * 100 : 50) + "%", background: MT.tinta, borderRadius: 8, transition: "width 900ms cubic-bezier(.2,.7,.2,1)" }} />
                <div style={{ flex: 1, background: MT.rojo, borderRadius: 8 }} />
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 12.5, color: MT.texto2 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: MT.tinta }} />Web y pedidos de vendedores: <b style={{ color: MT.texto }}>{usdM(web, 0)}{totalNeg > 0 ? ` (${pctM((web / totalNeg) * 100, 0)})` : ""}</b></span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: MT.rojo }} />Tienda física: <b style={{ color: MT.texto }}>{usdM(ventas, 0)}{totalNeg > 0 ? ` (${pctM((ventas / totalNeg) * 100, 0)})` : ""}</b></span>
                <span>Total del negocio: <b style={{ color: MT.texto }}>{usdM(totalNeg, 0)}</b></span>
              </div>
            </div>
          )}

          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,430px),1fr))", marginTop: 14 }}>
            <div className="met-card met-in" style={{ "--d": "100ms" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>Ventas de la tienda {porMes ? "por mes" : "por día"}</div>
              {porMes
                ? <GraficaBarras etiquetas={etiquetas} etiquetaX={mesCortoM} descripcion="Ventas de la tienda física por mes" alto={230} series={[{ nombre: "Tienda física", color: MT.rojo, valores, formato: (v) => usdM(v, 0) }]} />
                : <GraficaLineas etiquetas={etiquetas} etiquetaX={fechaCortaM} descripcion="Ventas de la tienda física por día" alto={230} series={[{ nombre: "Tienda física", color: MT.rojo, valores, formato: (v) => usdM(v, 0), area: true }]} />}
            </div>
            <div className="met-card met-in" style={{ "--d": "160ms" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>A qué horas se vende (hora de Panamá)</div>
              <GraficaBarras etiquetas={horas.map(String)} etiquetaX={(h) => h + "h"} descripcion="Ventas de la tienda por hora del día" alto={230} series={[{ nombre: "Ventas", color: MT.tinta, valores: horas.map(h => mh.get(h) || 0), formato: (v) => usdM(v, 0) }]} />
            </div>
          </div>

          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,430px),1fr))", marginTop: 14 }}>
            <div className="met-card met-in" style={{ "--d": "100ms" }}>
              <div className="met-lbl" style={{ marginBottom: 12 }}>Cómo pagan en la tienda</div>
              {pagos.length === 0 ? <div style={{ fontSize: 13, color: MT.texto2 }}>Sin pagos registrados.</div>
                : pagos.map((p, i) => <BarraH key={p.metodo} etiqueta={p.metodo} valor={Math.max(0, Number(p.monto) || 0)} maximo={totalPagos} color={i === 0 ? MT.rojo : MT.tinta} texto={usdM(p.monto, 0)} sub={pctM((Math.max(0, Number(p.monto) || 0) / totalPagos) * 100, 0)} retraso={i * 70} />)}
            </div>
            <div className="met-card met-in" style={{ "--d": "160ms" }}>
              <div className="met-lbl" style={{ marginBottom: 12 }}>Ventas por cajero</div>
              {(r.cajeros || []).map((c, i) => <BarraH key={c.cajero} etiqueta={c.cajero} valor={Math.max(0, Number(c.ventas) || 0)} maximo={maxCaj} color={MT.tinta} texto={usdM(c.ventas, 0)} sub={`${numM(c.tickets)} ventas`} retraso={i * 70} />)}
            </div>
          </div>

          <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,430px),1fr))", marginTop: 14 }}>
            <div className="met-card met-in" style={{ "--d": "100ms", overflowX: "auto" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>Los 15 productos que más venden en la tienda</div>
              <table className="met-tabla" style={{ minWidth: 380 }}>
                <thead><tr><th>Producto</th><th>Unid.</th><th>Ventas</th><th>Margen</th></tr></thead>
                <tbody>{(r.top_productos || []).map((p, i) => {
                  const vs = Number(p.ventas_sin_itbms) || 0, co = Number(p.costo) || 0;
                  const mg = co > 0 && vs > 0 ? (1 - co / vs) * 100 : null;
                  return <tr key={i}><td style={{ textAlign: "left", maxWidth: 230, whiteSpace: "normal", lineHeight: 1.3 }}>{p.nombre || p.ref || "—"}{p.ref && p.nombre ? <div style={{ fontSize: 11, color: MT.suave }}>{p.ref}</div> : null}</td><td>{numM(Math.round(Number(p.unidades) || 0))}</td><td>{usdM(p.ventas, 0)}</td><td style={{ color: mg === null ? MT.suave : mg < 25 ? MT.malo : MT.texto }}>{mg === null ? "sin costo" : pctM(mg, 0)}</td></tr>;
                })}</tbody>
              </table>
            </div>
            <div className="met-card met-in" data-testid="top-web" style={{ "--d": "160ms", overflowX: "auto" }}>
              <div className="met-lbl" style={{ marginBottom: 8 }}>Los 15 productos que más venden en la web</div>
              {errProdWeb ? <div style={{ fontSize: 13, color: MT.texto2 }}>No se pudieron cargar los productos de la web: {errProdWeb}</div>
                : !prodWeb ? <div style={{ fontSize: 13, color: MT.texto2, padding: "24px 0" }}>Cargando productos de la web…</div>
                : (prodWeb.productos || []).length === 0 ? <div style={{ fontSize: 13, color: MT.texto2 }}>Sin ventas de la web en este periodo.</div>
                : <>
                  <table className="met-tabla" style={{ minWidth: 380 }}>
                    <thead><tr><th>Producto</th><th>Unid.</th><th>Ventas</th><th>Margen</th></tr></thead>
                    <tbody>{(prodWeb.productos || []).slice(0, 15).map((p, i) => {
                      const mg = p.margen_pct === null || p.margen_pct === undefined ? null : Number(p.margen_pct);
                      return <tr key={p.producto_id || i}><td style={{ textAlign: "left", maxWidth: 230, whiteSpace: "normal", lineHeight: 1.3 }}>{p.nombre || p.referencia || "—"}{p.referencia && p.nombre ? <div style={{ fontSize: 11, color: MT.suave }}>{p.referencia}</div> : null}</td><td>{numM(Math.round(Number(p.piezas) || 0))}</td><td>{usdM(p.ingreso, 0)}</td><td style={{ color: mg === null ? MT.suave : mg < 25 ? MT.malo : MT.texto }}>{mg === null ? "sin costo" : pctM(mg, 0)}</td></tr>;
                    })}</tbody>
                  </table>
                  <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 8, lineHeight: 1.45 }}>Pedidos pagados de la web y de tus vendedores, ordenados por ventas (sin cotizaciones). Ya sin lo que se devolvió.</div>
                </>}
            </div>
          </div>
        </>}
        <div style={{ marginTop: 16, fontSize: 12, color: MT.suave, lineHeight: 1.6, maxWidth: 780 }}>
          <b style={{ color: MT.texto2 }}>De dónde salen estos datos.</b> Son las ventas del punto de venta de Odoo, copiadas en modo solo lectura (esta página nunca cambia nada en Odoo). Los costos son los que tengas cargados en Odoo. Los clientes de la tienda casi siempre son anónimos, por eso no entran en CAC ni LTV. No se duplican con los pedidos de la web: son canales distintos.
        </div>
      </div>
    );
  }

  const encabezado = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div>
        {envolver ? <h2 className="met-h1">{titulo}</h2> : <div className="met-sec" style={{ margin: "0 0 4px" }}>{titulo}</div>}
        <div className="met-sub" style={{ marginTop: envolver ? 6 : 0 }}>Lo que se vende en el local, tomado del punto de venta de Odoo, separado de la web.</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {r && r.ultima_venta && <div className="met-live"><i /> Última venta: {new Date(r.ultima_venta).toLocaleString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{r.ultima_sync ? ` · revisado ${haceCuanto(r.ultima_sync)}` : ""}</div>}
        <button className="met-chip" onClick={sincronizar} disabled={sincro}>{sincro ? "Actualizando…" : "Actualizar ahora"}</button>
      </div>
    </div>
  );
  const interior = <>{encabezado}<div style={{ marginTop: 10 }}>{cuerpo}</div></>;
  return envolver ? <div className="met" style={{ padding: 22, marginBottom: 28 }}><style>{ESTILO_MET}</style>{interior}</div> : <div style={{ marginTop: 6 }}>{interior}</div>;
}

// ═══════════ COMPRAS DE ODOO (módulo Purchase) — SOLO DUEÑO ═══════════
// Las órdenes de compra de Odoo se copian (solo lectura) cada 15 minutos a tablas privadas.
const ESTADO_RECEP = { full: ["Recibida", "bueno"], partial: ["Recibida a medias", "medio"], pending: ["Por recibir", "medio"] };
const ESTADO_FACT = { invoiced: "Facturada", "to invoice": "Por facturar", no: "Sin factura" };
function FinCompras({ desde, hasta }) {
  const { showToast } = useApp();
  const { datos: r, error, cargando, recargar } = useFinDatos("compras_resumen", { p_desde: desde, p_hasta: hasta }, [desde, hasta]);
  const [sincro, setSincro] = useState(false);
  const sincronizar = async () => {
    setSincro(true);
    try {
      await sb.ensureFreshToken();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/sync-odoo-compras`, { method: "POST", headers: sb.functionHeaders(), body: "{}" });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j.detalle || j.error || "Error");
      await recargar();
      showToast("Compras actualizadas desde Odoo");
    } catch (e) { showToast("No se pudo actualizar: " + String(e.message || e).slice(0, 120)); }
    setSincro(false);
  };
  if (error) return <AvisoFin malo>No se pudieron cargar las compras: {error}</AvisoFin>;
  if (!r) return <div style={{ padding: "50px 0", textAlign: "center", color: MT.texto2 }}>Cargando compras de Odoo…</div>;
  const serie = r.serie || [], provs = r.proveedores || [], lista = r.lista || [];
  const maxProv = Math.max(1, ...provs.map(p => Number(p.total)));
  return (
    <div style={{ opacity: cargando ? 0.7 : 1, transition: "opacity .25s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
        <div className="met-live"><i /> Compras confirmadas en Odoo · solo lectura{r.ultima_sync ? ` · revisado ${haceCuanto(r.ultima_sync)}` : ""}</div>
        <button className="met-chip" onClick={sincronizar} disabled={sincro}>{sincro ? "Actualizando…" : "Actualizar ahora"}</button>
      </div>
      {Number(r.n) === 0 && <AvisoFin>No hay órdenes de compra confirmadas en este periodo. Prueba con “Todo” en el selector de fechas.</AvisoFin>}
      <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", marginTop: 14 }}>
        <Kpi retraso={0} etiqueta="Comprado en el periodo" formula="Suma del total de las órdenes de compra confirmadas en Odoo (módulo Purchase) con fecha dentro del periodo."><Cifra valor={Number(r.total)} f={(v) => usdM(v, 0)} /></Kpi>
        <Kpi retraso={60} etiqueta="Órdenes de compra" formula="Cantidad de órdenes confirmadas en el periodo."><Cifra valor={Number(r.n)} f={(v) => numM(v)} /></Kpi>
        <Kpi retraso={120} etiqueta="Piezas compradas" formula="Suma de las cantidades de todas las líneas de esas órdenes."><Cifra valor={Number(r.piezas)} f={(v) => numM(v)} /></Kpi>
        <Kpi retraso={180} etiqueta="Por recibir" formula="Total de órdenes confirmadas cuya mercancía aún no está recibida por completo en el almacén."><Cifra valor={Number(r.sin_recibir)} f={(v) => usdM(v, 0)} /></Kpi>
        <Kpi retraso={240} etiqueta="Por facturar" formula="Total de órdenes que ya recibiste pero el proveedor aún no te factura (o no lo has registrado en Odoo)."><Cifra valor={Number(r.por_facturar)} f={(v) => usdM(v, 0)} /></Kpi>
      </div>
      {Number(r.borradores) > 0 && <div style={{ fontSize: 12, color: MT.suave, marginTop: 8 }}>Hay {r.borradores} cotización(es) en borrador en Odoo; no se cuentan hasta que las confirmes.</div>}

      <div className="met-sec">Compras mes a mes</div>
      <div className="met-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,430px),1fr))" }}>
        <div className="met-card met-in" style={{ "--d": "100ms" }}>
          <div className="met-lbl" style={{ marginBottom: 8 }}>Total comprado por mes</div>
          <GraficaBarras etiquetas={serie.map(s => s.mes)} etiquetaX={mesCortoM} descripcion="Compras por mes" alto={230}
            series={[{ nombre: "Compras", color: MT.tinta, valores: serie.map(s => Number(s.total)), formato: (v) => usdM(v, 0) }]} />
        </div>
        <div className="met-card met-in" style={{ "--d": "160ms" }}>
          <div className="met-lbl" style={{ marginBottom: 12 }}>A quién le compras más</div>
          {provs.length === 0 ? <div style={{ fontSize: 13, color: MT.texto2 }}>Sin compras en el periodo.</div>
            : provs.map((p, i) => <BarraH key={p.nombre} etiqueta={p.nombre} valor={Number(p.total)} maximo={maxProv} color={MT.rojo} texto={usdM(p.total, 0)} sub={`${p.n} orden(es)`} retraso={i * 50} />)}
        </div>
      </div>

      <div className="met-sec">Órdenes de compra</div>
      <div className="met-card" style={{ overflowX: "auto", padding: 0 }}>
        <table className="met-tabla">
          <thead><tr>{["Orden", "Fecha", "Proveedor", "Total", "Recepción", "Factura"].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {lista.map(c => {
              const rec = ESTADO_RECEP[c.estado_recepcion] || [c.estado_recepcion || "—", "medio"];
              return <tr key={c.odoo_id}><td><b>{c.nombre}</b></td><td>{c.dia}</td><td>{c.proveedor || "—"}</td><td>{usdM(c.total, 2)}</td>
                <td style={{ color: rec[1] === "bueno" ? MT.bueno : MT.texto2 }}>{rec[0]}</td><td>{ESTADO_FACT[c.estado_factura] || c.estado_factura || "—"}</td></tr>;
            })}
            {lista.length === 0 && <tr><td colSpan={6} style={{ color: MT.suave }}>Sin órdenes en el periodo.</td></tr>}
          </tbody>
        </table>
      </div>
      {Number(r.n) > lista.length && <div style={{ fontSize: 11.5, color: MT.suave, marginTop: 6 }}>Se muestran las {lista.length} más recientes de {r.n}.</div>}
      <div style={{ fontSize: 12, color: MT.suave, lineHeight: 1.55, marginTop: 14 }}>Las compras se leen de Odoo sin modificar nada. Cuentan en el flujo de caja el día de la orden confirmada. Para evitar contarlas dos veces, no registres también esa misma compra como gasto de “Compra de mercancía”.</div>
    </div>
  );
}

// ═══════════ PROVEEDORES DE ODOO ↔ WEB — SOLO DUEÑO ═══════════
// Une cada proveedor que existe en Odoo con uno de la web (o crea uno nuevo en la web). Odoo nunca se modifica.
function ProveedoresOdoo({ proveedoresWeb, onCambio }) {
  const { showToast } = useApp();
  const { datos, error, cargando, recargar } = useFinDatos("prov_odoo_listar", {}, []);
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(null);
  const [elegido, setElegido] = useState({});
  if (error) return null; // si falla, el resto de la pestaña sigue funcionando igual
  if (!datos) return null;
  const lista = Array.isArray(datos) ? datos : [];
  if (lista.length === 0) return null;
  const sinVincular = lista.filter(o => !o.proveedor_web_id);
  const actuar = async (odooId, fn, args, msg) => {
    setTrabajando(odooId);
    try { await finRpc(fn, args); showToast(msg); await recargar(); if (onCambio) await onCambio(); }
    catch (e) { showToast("No se pudo: " + String(e.message || e).slice(0, 120)); }
    setTrabajando(null);
  };
  const btn = { background: "none", border: `1.5px solid ${MT.tinta}`, color: MT.tinta, borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
  return (
    <div className="met" style={{ marginBottom: 22 }}>
      <style>{ESTILO_MET}</style>
      <div className="met-card" style={{ padding: 18 }} data-testid="prov-odoo">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Proveedores de Odoo</div>
            <div style={{ fontSize: 12.5, color: MT.texto2, marginTop: 3 }}>{lista.length} en Odoo · {lista.length - sinVincular.length} unidos con la web · <b style={{ color: sinVincular.length ? MT.malo : MT.bueno }}>{sinVincular.length} por unir</b></div>
          </div>
          <button className={"met-chip" + (abierto ? " on" : "")} onClick={() => setAbierto(a => !a)} aria-expanded={abierto}>{abierto ? "Ocultar" : "Unir con proveedores de la web"}</button>
        </div>
        {abierto && (
          <div style={{ marginTop: 14, overflowX: "auto", opacity: cargando ? 0.7 : 1 }}>
            <div style={{ fontSize: 12, color: MT.suave, marginBottom: 8, lineHeight: 1.5 }}>Al unir un proveedor, sus compras de Odoo se suman a él en la web. No se cambia nada en Odoo ni en la tienda.</div>
            <table className="met-tabla" style={{ minWidth: 640 }}>
              <thead><tr><th>Proveedor en Odoo</th><th>Compras</th><th>Proveedor en la web</th><th></th></tr></thead>
              <tbody>
                {lista.map(o => {
                  const sel = elegido[o.odoo_id] !== undefined ? elegido[o.odoo_id] : (o.sugerido_web_id ? String(o.sugerido_web_id) : "");
                  const ocupado = trabajando === o.odoo_id;
                  return (
                    <tr key={o.odoo_id}>
                      <td><b>{o.nombre}</b>{o.ruc ? <div style={{ fontSize: 11, color: MT.suave }}>RUC {o.ruc}</div> : null}</td>
                      <td>{o.n_compras > 0 ? <>{usdM(o.total_compras, 0)}<div style={{ fontSize: 11, color: MT.suave }}>{o.n_compras} orden(es)</div></> : <span style={{ color: MT.suave }}>—</span>}</td>
                      <td>
                        {o.proveedor_web_id
                          ? <span style={{ color: MT.bueno, fontWeight: 700 }}>✓ {o.web_nombre}</span>
                          : <select value={sel} onChange={e => setElegido({ ...elegido, [o.odoo_id]: e.target.value })} style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${MT.rejilla}`, fontSize: 12.5, maxWidth: 220 }}>
                            <option value="">Elegir proveedor de la web…</option>
                            {proveedoresWeb.map(p => <option key={p.id} value={p.id}>{p.nombre}{o.sugerido_web_id === p.id ? " (sugerido)" : ""}</option>)}
                          </select>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {o.proveedor_web_id
                          ? <button style={btn} disabled={ocupado} onClick={() => actuar(o.odoo_id, "prov_odoo_vincular", { p_odoo_id: o.odoo_id, p_web_id: null }, "Proveedor desvinculado")}>Desunir</button>
                          : <>
                            <button style={{ ...btn, marginRight: 6, opacity: sel ? 1 : 0.45 }} disabled={ocupado || !sel} onClick={() => actuar(o.odoo_id, "prov_odoo_vincular", { p_odoo_id: o.odoo_id, p_web_id: Number(sel) }, "Proveedor unido")}>Unir</button>
                            <button style={btn} disabled={ocupado} onClick={() => actuar(o.odoo_id, "prov_odoo_crear_web", { p_odoo_id: o.odoo_id }, "Proveedor creado en la web")}>Crear nuevo en la web</button>
                          </>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════ RETORNAR UN PEDIDO (desde Pedidos) → devuelve la mercancía al inventario de Odoo ═══════════
// Total  : usa cancelar-venta-odoo (devolución de la entrega + nota de crédito con confirmación + venta cancelada).
// Parcial: usa devolver-items-odoo (solo devuelve al inventario las piezas indicadas).
// Siempre deja registrado el retorno (tabla retornos, estado "aprobado") para que el reembolso se descuente en Finanzas.
const MOTIVOS_RETORNO = ["Talla o modelo incorrecto", "Producto dañado o defectuoso", "El cliente se arrepintió", "Error en el pedido", "Pedido cancelado antes de entregar", "Otro"];
const retornosDePedido = (retornos, o) => (retornos || []).filter(r => r.estado !== "rechazado" && ((r.pedido_id && r.pedido_id === o.id) || (r.codigo_pedido && r.codigo_pedido === o.codigo)));

function InsigniaRetorno({ retornos, o }) {
  const rs = retornosDePedido(retornos, o);
  if (rs.length === 0) return null;
  const total = rs.some(r => r.tipo_retorno === "total");
  const pendienteOdoo = rs.some(r => r.odoo_estado === "pendiente");
  return (
    <div style={{ marginTop: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
      <span style={{ background: "#F8D7DA", color: "#721C24", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>{total ? "RETORNADO" : rs.some(r => r.tipo_retorno === "parcial") ? "RETORNO PARCIAL" : "CON RETORNO"}</span>
      {pendienteOdoo && <span title="El retorno se registró en la web pero el inventario no se devolvió en Odoo" style={{ background: "#FFF3CD", color: "#856404", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>ODOO PENDIENTE</span>}
    </div>
  );
}

function RetornarPedidoModal({ pedido, productos, retornos, onClose, onHecho }) {
  const idRetorno = useRef(null);
  if (!idRetorno.current) idRetorno.current = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
  const enCurso = useRef(false);
  const previos = retornosDePedido(retornos, pedido).filter(r => r.tipo_retorno);
  const devueltoAntes = (pid) => previos.reduce((s, r) => s + (r.items_retornados || []).filter(i => i.product_id === pid).reduce((a, i) => a + (Number(i.cantidad) || 0), 0), 0);
  const filas = (pedido.items || []).map(it => {
    const prod = (productos || []).find(p => p.id === it.producto_id);
    const vendido = Number(it.cantidad) || 0, ya = devueltoAntes(it.producto_id), maximo = Math.max(0, vendido - ya);
    return { producto_id: it.producto_id, referencia: prod?.referencia || "", nombre: it.nombre_producto, vendido, ya, maximo, subtotal: Number(it.subtotal) || 0 };
  });
  const [cant, setCant] = useState(() => Object.fromEntries(filas.map((f, i) => [i, f.maximo])));
  const [motivo, setMotivo] = useState(MOTIVOS_RETORNO[0]);
  const [otro, setOtro] = useState("");
  const [nota, setNota] = useState("");
  const [montoTxt, setMontoTxt] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [fallaDb, setFallaDb] = useState(null);
  useLockBodyScroll(true);

  const elegidas = filas.map((f, i) => ({ ...f, cantidad: Math.min(f.maximo, Math.max(0, Math.floor(Number(cant[i]) || 0))) })).filter(f => f.cantidad > 0);
  const hayAntes = previos.length > 0;
  const esTotal = !hayAntes && filas.length > 0 && filas.every((f, i) => Math.min(f.maximo, Math.max(0, Math.floor(Number(cant[i]) || 0))) === f.vendido);
  const montoSugerido = esTotal ? Number(pedido.total) || 0 : elegidas.reduce((s, f) => s + (f.vendido > 0 ? f.subtotal * f.cantidad / f.vendido : 0), 0);
  const monto = montoTxt === null ? montoSugerido : (Number(montoTxt) || 0);
  const sinRef = elegidas.filter(f => !f.referencia);
  const piezas = elegidas.reduce((s, f) => s + f.cantidad, 0);
  const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const motivoFinal = motivo === "Otro" ? otro.trim() : motivo;

  const llamar = async (fn, cuerpo) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: "POST", headers: sb.functionHeaders(), body: JSON.stringify(cuerpo) });
    return await r.json().catch(() => ({}));
  };

  const guardar = async (odoo) => {
    const fila = {
      id: idRetorno.current, pedido_id: pedido.id, codigo_pedido: pedido.codigo, nombre_cliente: pedido.nombre_cliente, motivo: motivoFinal,
      productos_retornados: elegidas.map(i => `${i.cantidad}x ${i.nombre} (${i.referencia})`).join(", "),
      items_retornados: elegidas.map(i => ({ product_id: i.producto_id, referencia: i.referencia, nombre: i.nombre, cantidad: i.cantidad })),
      monto_reembolso: Math.round(monto * 100) / 100, estado: "aprobado", notas: nota.trim(), tipo_retorno: esTotal ? "total" : "parcial",
      odoo_estado: odoo.estado, odoo_detalle: odoo.detalle || "", odoo_at: odoo.estado === "devuelto" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const creada = await sb.post("retornos", fila);
    onHecho((Array.isArray(creada) && creada[0]) || fila, odoo);
  };

  const confirmar = async () => {
    if (enCurso.current) return;
    setError("");
    if (!motivoFinal) { setError("Escribe el motivo del retorno."); return; }
    if (elegidas.length === 0) { setError("Elige al menos una pieza para retornar."); return; }
    if (sinRef.length > 0) { setError(`Estos productos no tienen referencia, así que no se pueden devolver en Odoo: ${sinRef.map(f => f.nombre).join(", ")}. Agrégales la referencia o registra el retorno desde la pestaña Retornos.`); return; }
    enCurso.current = true; setTrabajando(true);
    try {
      // Si Odoo ya se hizo en un intento anterior y solo falló guardar en la web, se reintenta SOLO guardar.
      if (fallaDb) { await guardar(fallaDb); return; }
      let odoo = { estado: "devuelto", detalle: "" };
      let data = null, falloConexion = null;
      try {
        if (esTotal) {
          data = await llamar("cancelar-venta-odoo", { codigo: pedido.codigo, acepta_nota_credito: false });
          if (data?.requiere_confirmacion) {
            const est = (e) => e === "not_paid" ? "sin pagar" : e === "partial" ? "pago parcial" : "ya pagada";
            const lineas = (data.facturas || []).map(f => `  • ${f.factura} — $${Number(f.total).toFixed(2)} (${est(f.estado_pago)})`).join("\n");
            const hayPagadas = (data.facturas || []).some(f => f.estado_pago !== "not_paid");
            const ok = confirm(`Este pedido ya está facturado en Odoo:\n\n${lineas}\n\nSi continúas, en Odoo se va a:\n  1. Devolver la mercancía al inventario\n  2. Emitir la nota de crédito de la factura\n  3. Cancelar la venta\n` + (hayPagadas ? `\nComo la factura ya está pagada, la nota de crédito deja un saldo a favor del cliente. El reembolso del dinero (Yappy/tarjeta) lo registras tú a mano.\n` : "") + `\n¿Continuar?`);
            if (!ok) return;
            data = await llamar("cancelar-venta-odoo", { codigo: pedido.codigo, acepta_nota_credito: true });
          }
        } else {
          data = await llamar("devolver-items-odoo", { codigo: pedido.codigo, retorno_id: idRetorno.current, items: elegidas.map(f => ({ referencia: f.referencia, cantidad: f.cantidad })) });
        }
      } catch (e) { falloConexion = e.message || String(e); }

      if (falloConexion || !data?.ok) {
        const motivoFallo = falloConexion ? `No se pudo conectar con Odoo (${falloConexion}).` : (data?.mensaje || data?.error || "Odoo respondió con un error.");
        const seguir = confirm(`No se pudo devolver la mercancía en Odoo:\n\n${motivoFallo}\n\nEl retorno todavía NO se ha registrado.\n\n¿Registrarlo SOLO en la web de todas formas? (Tendrás que devolver el inventario tú a mano en Odoo.)`);
        if (!seguir) { setError(motivoFallo); return; }
        odoo = { estado: "pendiente", detalle: String(motivoFallo).slice(0, 400) };
      } else if (data.encontrada === false) {
        odoo = { estado: "sin_odoo", detalle: "El pedido no estaba en Odoo" };
      } else {
        const nNotas = (data.ordenes || []).reduce((s, o) => s + (o.notas_credito?.length || 0), 0);
        odoo = { estado: "devuelto", detalle: esTotal ? `Venta cancelada y mercancía devuelta${nNotas ? ` · ${nNotas} nota(s) de crédito` : ""}` : `${data.unidades || piezas} pieza(s) devueltas${data.devoluciones?.length ? ` (${data.devoluciones.join(", ")})` : ""}`, aviso: data.aviso_factura || null };
      }
      try { await guardar(odoo); }
      catch (e) { setFallaDb(odoo); setError("En Odoo ya quedó hecho, pero no se pudo guardar el retorno en la web: " + (e.message || e) + ". Pulsa «Guardar retorno» otra vez (no se repite nada en Odoo)."); }
    } finally { enCurso.current = false; setTrabajando(false); }
  };

  const inpN = { width: 64, padding: "6px 8px", borderRadius: 8, border: `1.5px solid ${GRAY2}`, fontSize: 14, textAlign: "center", fontFamily: "inherit" };
  return createPortal(
    <div className="oft-overlay" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 12px" }} onClick={() => !trabajando && onClose()}>
      <div className="oft-qv-pop" role="dialog" aria-label="Retornar pedido" style={{ background: WHITE, borderRadius: 16, maxWidth: 560, width: "100%", margin: "0 auto", padding: 22 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><RefreshCw size={18} color={RED} /> Retornar pedido {pedido.codigo}</div>
          <button onClick={() => !trabajando && onClose()} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>
        <div style={{ fontSize: 13, color: GRAY3, marginBottom: 14 }}>{pedido.nombre_cliente} · total {usd(pedido.total)}</div>

        {hayAntes && <div style={{ fontSize: 12.5, background: "#FFF3CD", color: "#856404", borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>Este pedido ya tiene {previos.length} retorno(s). Solo se pueden retornar las piezas que faltan.</div>}

        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>¿Qué piezas regresan?</div>
        <div style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
          {filas.length === 0 && <div style={{ padding: 14, fontSize: 13, color: GRAY3 }}>Este pedido no tiene productos cargados.</div>}
          {filas.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: i < filas.length - 1 ? `1px solid ${GRAY}` : "none", opacity: f.maximo === 0 ? 0.5 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{f.nombre}</div>
                <div style={{ fontSize: 11, color: f.referencia ? GRAY3 : RED }}>{f.referencia || "Sin referencia"} · compró {f.vendido}{f.ya ? ` · ya retornó ${f.ya}` : ""}</div>
              </div>
              <input type="number" min={0} max={f.maximo} disabled={f.maximo === 0 || trabajando} value={cant[i] ?? 0} onChange={e => setCant({ ...cant, [i]: e.target.value })} style={inpN} aria-label={`Cantidad a retornar de ${f.nombre}`} />
            </div>
          ))}
        </div>

        <label style={S.label}>Motivo *</label>
        <select style={S.input} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={trabajando}>{MOTIVOS_RETORNO.map(m => <option key={m}>{m}</option>)}</select>
        {motivo === "Otro" && <input style={S.input} placeholder="Escribe el motivo" value={otro} onChange={e => setOtro(e.target.value)} disabled={trabajando} />}

        <label style={S.label}>Monto a reembolsar al cliente ($)</label>
        <input style={S.input} type="number" min={0} step="0.01" value={montoTxt === null ? montoSugerido.toFixed(2) : montoTxt} onChange={e => setMontoTxt(e.target.value)} disabled={trabajando} />
        <label style={S.label}>Nota (opcional)</label>
        <input style={S.input} value={nota} onChange={e => setNota(e.target.value)} disabled={trabajando} />

        <div style={{ fontSize: 12.5, color: GRAY3, background: GRAY, borderRadius: 10, padding: "10px 12px", margin: "14px 0", lineHeight: 1.55 }}>
          <b style={{ color: BLACK }}>Qué va a pasar:</b>
          <div>• <b>Web:</b> queda registrado como retorno aprobado por {usd(monto)} (se descuenta en Dashboard y Finanzas).</div>
          {esTotal
            ? <div>• <b>Odoo:</b> es un retorno <b>total</b>: se devuelve toda la mercancía al inventario, se emite la nota de crédito si ya está facturado (te pedirá confirmar) y se cancela la venta.</div>
            : <div>• <b>Odoo:</b> se devuelven <b>{piezas} pieza(s)</b> al inventario. No se emite nota de crédito ni se cancela la venta: si el pedido está facturado, esa nota la haces a mano en Odoo.</div>}
          <div>• <b>Dinero:</b> el reembolso al cliente (Yappy/tarjeta/efectivo) lo haces tú; el sistema no mueve dinero.</div>
        </div>

        {error && <div role="alert" style={{ fontSize: 13, color: "#B71C1C", background: "#FDE8E8", borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={trabajando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
          <button onClick={confirmar} disabled={trabajando || filas.length === 0} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: trabajando ? 0.7 : 1 }}>
            {trabajando ? "Procesando…" : fallaDb ? "Guardar retorno" : "Retornar y devolver al inventario"}
          </button>
        </div>
      </div>
    </div>, document.body);
}

function AdminView() {
  const { products, setProducts, categories, setCategories, gruposCategorias, setGruposCategorias, banners, setBanners, popups, setPopups, empresas, setEmpresas, sucursales, setSucursales, localesRetiro, setLocalesRetiro, retiroLocalHabilitado, setRetiroLocalHabilitado, showToast, setView, setUser, user } = useApp();
  // Rol del usuario actual: 'admin' = módulo completo, 'operador' = acceso limitado.
  // Los admins creados antes de este cambio pueden no tener "rol" guardado todavía — por
  // compatibilidad, si es_admin es true y no tiene rol, se trata como admin completo.
  const esAdminCompleto = user?.rol === "admin" || (user?.es_admin && !user?.rol);
  const esOperador = user?.rol === "operador";
  const [tab, setTab] = useState("dashboard");
  const [, setCostosVer] = useState(0); // fuerza redibujar cuando cambian los costos privados (Finanzas)
  useEffect(() => { if (esAdminCompleto) finCargarCostos().then(() => setCostosVer(v => v + 1)).catch(() => {}); }, [esAdminCompleto]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showProdForm, setShowProdForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = nuevo, id = editando
  const [showBulk, setShowBulk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catUploading, setCatUploading] = useState(null); // id de categoría subiendo icono
  const emptyProd = { referencia: "", nombre: "", descripcion: "", categoria_id: categories[0]?.id || 1, precio_pieza: "", precio_media_docena: "", precio_docena: "", precio_minimo: "", precio_especial: "", badge: "", activo: true, destacado: false, imagen_url: "", tiene_tallas: false, tiene_colores: false, tallas: "", colores: "", distribucion_docena: "", distribucion_eje: "", proveedor_id: null, venta_por_unidad: false, tiene_stock_fisico: false, piezas_muestra: 0, notas_fragancia: "", modalidad_presentacion: "estandar", flexpack_grupo_id: null };
  const [prodForm, setProdForm] = useState(emptyProd);
  const fileInputRef = useRef(null);
  const catFileRef = useRef(null);
  // Carga masiva CON imágenes (crea borradores)
  const [showBulkImg, setShowBulkImg] = useState(false);
  const [bulkImgCat, setBulkImgCat] = useState(categories[0]?.id || 1);
  const [bulkImgProveedorId, setBulkImgProveedorId] = useState(null); // proveedor para estos borradores (null = propio)
  const [bulkImgTieneStockFisico, setBulkImgTieneStockFisico] = useState(false); // true = ya tengo esta mercancía en stock físico
  const [bulkImgLoading, setBulkImgLoading] = useState(false);
  const [bulkImgProgress, setBulkImgProgress] = useState({ done: 0, total: 0 });
  const bulkImgRef = useRef(null);
  // Filtro por categoría en la página de productos
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [busquedaProducto, setBusquedaProducto] = useState(""); // búsqueda por referencia (o nombre) en Productos
  const [sincronizando, setSincronizando] = useState(false); // sincronización de stock con Odoo
  // Edición masiva (selección por checkboxes)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const emptyBulkEdit = { nombre: "", categoria_id: "", precio_pieza: "", precio_media_docena: "", precio_docena: "", badge: "", descripcion: "", activo: "", destacado: "", tiene_tallas: "", tallas: "", tiene_colores: "", colores: "", distribucion_docena: "", distribucion_eje: "", proveedor_id: "", tiene_stock_fisico: "", flexpack_grupo_id: "" };
  const [bulkEdit, setBulkEdit] = useState(emptyBulkEdit);
  const [shippingLabel, setShippingLabel] = useState(null); // pedido para la guía de envío
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null); // pedido pendiente de eliminar (confirmación)
  const [pedidoARetornar, setPedidoARetornar] = useState(null); // pedido que se va a retornar (devuelve mercancía a Odoo)
  const eliminandoRef = useRef(false); // candado sincrónico contra doble clic al eliminar
  const [cotizacionAEditar, setCotizacionAEditar] = useState(null); // cotización que se está editando
  const [cotizacionImagen, setCotizacionImagen] = useState(null); // cotización a la que se le está generando la imagen
  const [facturaImagen, setFacturaImagen] = useState(null); // pedido al que se le está generando la imagen de factura
  const [rankingModal, setRankingModal] = useState(null); // null | "reponer" | "rotacion" | "ingreso" | "zona" — para ver el top 50 en Análisis de Stock
  const [rankingModalProveedorId, setRankingModalProveedorId] = useState(null); // si se abrió desde el análisis de UN proveedor, filtra solo sus productos
  const [proveedorExpandidoId, setProveedorExpandidoId] = useState(null); // qué proveedor tiene su análisis de stock abierto
  const [clienteForm, setClienteForm] = useState(null); // null | {} (crear) | {id,...} (editar)
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("todos"); // todos | con_cuenta | sin_cuenta
  const [verDuplicados, setVerDuplicados] = useState(false);
  const [equipoForm, setEquipoForm] = useState(false); // true = mostrar modal de agregar miembro
  const [promoverForm, setPromoverForm] = useState(false); // true = mostrar modal de promover cliente existente
  const [miembroAQuitar, setMiembroAQuitar] = useState(null); // usuario del equipo a quitar (confirmación)
  const [mfaModal, setMfaModal] = useState(false); // true = mostrar modal de verificación en dos pasos
  const [proveedorForm, setProveedorForm] = useState(null); // null | {} (crear) | {id,...} (editar)
  const [localForm, setLocalForm] = useState(null); // null | {} (crear) | {id,...} (editar) — local de retiro
  const [localAEliminar, setLocalAEliminar] = useState(null); // local de retiro a eliminar (confirmación)
  // Reporte de ventas por rango de fechas
  const [reporteDesde, setReporteDesde] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return fechaPanama(d); });
  const [reporteHasta, setReporteHasta] = useState(() => fechaPanama());
  const [reporteFilas, setReporteFilas] = useState(null); // null = todavía no generado
  const [reporteBusy, setReporteBusy] = useState(false);
  const [reportePorOperador, setReportePorOperador] = useState(null); // null = todavía no generado
  const [reporteOperadorBusy, setReporteOperadorBusy] = useState(false);
  const [comisionPctReporte, setComisionPctReporte] = useState(1);

  // Se carga aparte -- es una configuración general (la misma que se ajusta en Analítica)
  useEffect(() => {
    sb.get("configuracion", "?clave=eq.comision_operador_porcentaje&limit=1")
      .then(data => { if (data?.[0]?.valor != null) setComisionPctReporte(Number(data[0].valor)); })
      .catch(() => {});
  }, []);
  const [guardandoToggleRetiro, setGuardandoToggleRetiro] = useState(false);
  const [proveedorAEliminar, setProveedorAEliminar] = useState(null); // proveedor a eliminar (confirmación)
  const [convirtiendoId, setConvirtiendoId] = useState(null); // id de la cotización que se está convirtiendo ahora mismo (para desactivar su botón)
  const convirtiendoRef = useRef(new Set()); // candado sincrónico -- evita que un doble clic/doble toque alcance a disparar 2 conversiones en paralelo antes de que el estado de React se actualice
  // ── DESCUENTOS ──
  const [descuentos, setDescuentos] = useState([]); // lista de códigos de descuento
  const [descForm, setDescForm] = useState(null); // formulario crear/editar descuento o null
  const [guardandoDesc, setGuardandoDesc] = useState(false);
  const [descProductosOpen, setDescProductosOpen] = useState(false); // selector de productos en el form
  const [busquedaCotizacion, setBusquedaCotizacion] = useState(""); // buscar cotización por nombre de cliente
  // ── RETORNOS ──
  const [retornos, setRetornos] = useState([]);
  const [proveedores, setProveedores] = useState([]); // proveedores externos (productos que no son propios)
  // Reparto de compras de Odoo por proveedor/producto (solo dueño). Si falla, la pestaña funciona igual que antes.
  const [repartoProv, setRepartoProv] = useState(null);
  const cargarRepartoProv = async () => { try { setRepartoProv(await finRpc("prov_reparto", {})); } catch (_e) { setRepartoProv(null); } };
  useEffect(() => { if (tab === "proveedores" && esAdminCompleto) cargarRepartoProv(); }, [tab]);
  const [flexpackGrupos, setFlexpackGrupos] = useState([]); // grupos de Flex Pack (precio compartido x3/x6)
  const [grupoFlexpackForm, setGrupoFlexpackForm] = useState(null); // null | {} (crear) | {id,...} (editar)
  const [grupoFlexpackAEliminar, setGrupoFlexpackAEliminar] = useState(null); // grupo a eliminar (confirmación)
  const [retornoForm, setRetornoForm] = useState(null); // null | objeto del formulario
  const [guardandoRetorno, setGuardandoRetorno] = useState(false);
  const [busquedaRetorno, setBusquedaRetorno] = useState("");
  const [eliminando, setEliminando] = useState(false);
  // Filtro de ventas por periodo en el dashboard
  const [rangoVentas, setRangoVentas] = useState("mes"); // dia | semana | mes | anio | todo | personalizado | rango
  const [filtroMetodo, setFiltroMetodo] = useState("todos"); // "todos" | "yappy" | "tarjeta" | "transferencia" | "sin" -- filtra la pestaña Pedidos por cómo se pagó
  const [busquedaPedidos, setBusquedaPedidos] = useState(""); // busca por # de pedido o nombre de cliente, en la pestaña Pedidos
  const [riesgosPedidos, setRiesgosPedidos] = useState({}); // riesgo antifraude por pedido (pedido_id -> fila)
  const cargarRiesgos = async () => {
    try {
      const rs = await sb.get("pedidos_riesgo", "?select=pedido_id,nivel,puntaje,revision_estado,contracargo&order=created_at.desc&limit=500");
      const m = {}; (rs || []).forEach(r => { m[r.pedido_id] = r; });
      setRiesgosPedidos(m);
    } catch (e) { /* si falla, simplemente no se muestran las insignias */ }
  };
  useEffect(() => { cargarRiesgos(); }, []);
  useRefrescoPeriodico(cargarRiesgos, 60000);
  const fraudePend = Object.values(riesgosPedidos).filter(r => r.revision_estado === "pendiente").length;
  const [soloSinImprimir, setSoloSinImprimir] = useState(false); // filtro rápido: solo pedidos con la guía pendiente de imprimir
  const [fechaPersonalizada, setFechaPersonalizada] = useState(null); // Date seleccionada en el calendario
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(new Date()); // mes que muestra el calendario
  const [rangoInicio, setRangoInicio] = useState(null); // inicio del rango (día X)
  const [rangoFin, setRangoFin] = useState(null); // fin del rango (día Y)
  const [modoCalendario, setModoCalendario] = useState("dia"); // "dia" = un día | "rango" = del X al Y

  // Carga pedidos y usuarios al entrar
  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      try {
        const [ordersData, usersData] = await Promise.all([
          sb.get("pedidos", "?order=created_at.desc"),
          sb.get("usuarios", "?order=created_at.desc").catch(() => []),
        ]);
        // Cargar descuentos (si la tabla existe)
        sb.get("descuentos", "?order=created_at.desc").then(d => setDescuentos(d || [])).catch(() => {});
        // Cargar retornos
        sb.get("retornos", "?order=created_at.desc").then(d => setRetornos(d || [])).catch(() => {});
        // Cargar proveedores
        sb.get("proveedores", "?order=nombre.asc").then(d => setProveedores(d || [])).catch(() => {});
        // Cargar grupos de Flex Pack
        sb.get("flexpack_grupos", "?order=nombre.asc").then(d => setFlexpackGrupos(d || [])).catch(() => {});
        // Cargar items de cada pedido para estadísticas de mejores productos
        const ordersWithItems = await Promise.all(ordersData.map(async o => {
          const items = await sb.get("pedido_items", `?pedido_id=eq.${o.id}`).catch(() => []);
          return { ...o, items };
        }));
        setOrders(ordersWithItems);
        setUsers(usersData);
      } catch(e) { console.error(e); }
      setLoadingData(false);
    };
    load();
  }, []);

  // ── EN VIVO: pedidos, cotizaciones, clientes y listas del panel ──────────
  // Lo que hace otro agente (crear un pedido o una cotización, registrar un
  // cliente, cambiar un estado, pagar) aparece solo aquí, sin recargar la
  // página. Dos mecanismos a la vez: los avisos de la base de datos (llegan al
  // instante) y una revisión de respaldo cada 15 segundos por si algún aviso
  // se pierde (el internet se cortó, la pestaña estuvo dormida, etc.).
  const ordersRef = useRef([]);
  ordersRef.current = orders;
  const usersRef = useRef([]);
  usersRef.current = users;
  const vivoActivo = !loadingData;

  // Si el mismo pedido llega por dos caminos (el aviso en vivo y el formulario
  // que lo creó), se queda una sola copia -- la que trae más productos.
  useEffect(() => {
    const vistos = new Set();
    if (!orders.some(o => (vistos.has(o.id) ? true : (vistos.add(o.id), false)))) return;
    setOrders(prev => {
      const mejor = new Map();
      prev.forEach(o => { const x = mejor.get(o.id); if (!x || (o.items?.length || 0) > (x.items?.length || 0)) mejor.set(o.id, x ? { ...x, ...o } : o); });
      const usados = new Set();
      return prev.filter(o => (usados.has(o.id) ? false : (usados.add(o.id), true))).map(o => mejor.get(o.id));
    });
  }, [orders]);

  const itemsPendientesRef = useRef(new Set());
  const timerItemsRef = useRef(null);
  const refrescarItemsDe = (pedidoId) => {
    itemsPendientesRef.current.add(pedidoId);
    clearTimeout(timerItemsRef.current);
    timerItemsRef.current = setTimeout(async () => {
      const ids = [...itemsPendientesRef.current];
      itemsPendientesRef.current.clear();
      for (const id of ids) {
        try {
          const items = await sb.get("pedido_items", `?pedido_id=eq.${id}`);
          setOrders(prev => prev.map(o => o.id === id ? { ...o, items: items || [] } : o));
        } catch (_) {}
      }
    }, 500);
  };
  useEffect(() => () => { clearTimeout(timerItemsRef.current); }, []);

  const traerPedidoConItems = async (fila) => {
    const items = await sb.get("pedido_items", `?pedido_id=eq.${fila.id}`).catch(() => []);
    return { ...fila, items: items || [] };
  };

  const alCambiarPedido = async (ev) => {
    const nuevo = ev.new, viejo = ev.old;
    if (ev.eventType === "DELETE") { setOrders(prev => prev.filter(o => o.id !== viejo?.id)); return; }
    if (!nuevo?.id) return;
    const yaEsta = ordersRef.current.some(o => o.id === nuevo.id);
    if (yaEsta) { setOrders(prev => prev.map(o => o.id === nuevo.id ? { ...o, ...nuevo } : o)); return; }
    const completo = await traerPedidoConItems(nuevo);
    setOrders(prev => prev.some(o => o.id === nuevo.id) ? prev : [completo, ...prev]);
    if (ev.eventType === "INSERT" && nuevo.creado_por_usuario_id !== user?.id) {
      const quien = nuevo.nombre_cliente ? ` de ${nuevo.nombre_cliente}` : "";
      showToast(nuevo.tipo === "cotizacion" ? `Nueva cotización ${nuevo.codigo || ""}${quien}` : `Nuevo pedido ${nuevo.codigo || ""}${quien}`);
    }
  };
  const alCambiarItem = (ev) => {
    const fila = ev.new && ev.new.pedido_id ? ev.new : ev.old;
    let pedidoId = fila?.pedido_id;
    if (!pedidoId && ev.eventType === "DELETE" && ev.old?.id) {
      // Al borrarse un producto de un pedido, la base solo avisa el id del producto:
      // se busca a qué pedido pertenecía.
      const duenoPedido = ordersRef.current.find(o => (o.items || []).some(it => it.id === ev.old.id));
      pedidoId = duenoPedido?.id;
    }
    if (pedidoId) refrescarItemsDe(pedidoId);
  };
  const alCambiarUsuario = (ev) => {
    const nuevo = ev.new, viejo = ev.old;
    if (ev.eventType === "DELETE") { setUsers(prev => prev.filter(u => u.id !== viejo?.id)); return; }
    if (!nuevo?.id) return;
    const yaEsta = usersRef.current.some(u => u.id === nuevo.id);
    setUsers(prev => prev.some(u => u.id === nuevo.id) ? prev.map(u => u.id === nuevo.id ? { ...u, ...nuevo } : u) : [nuevo, ...prev]);
    if (!yaEsta && ev.eventType === "INSERT" && nuevo.origen_cuenta === "web") showToast(`Nuevo cliente registrado: ${nuevo.nombre || nuevo.email || ""}`);
  };
  const timerListasRef = useRef({});
  const refrescarLista = (clave, tabla, query, setter) => {
    clearTimeout(timerListasRef.current[clave]);
    timerListasRef.current[clave] = setTimeout(() => { sb.get(tabla, query).then(d => setter(d || [])).catch(() => {}); }, 400);
  };
  useEffect(() => () => { Object.values(timerListasRef.current).forEach(clearTimeout); }, []);

  useCambiosEnVivo(["pedidos"], alCambiarPedido, vivoActivo);
  useCambiosEnVivo(["pedido_items"], alCambiarItem, vivoActivo);
  useCambiosEnVivo(["usuarios"], alCambiarUsuario, vivoActivo);
  useCambiosEnVivo(["descuentos"], () => refrescarLista("descuentos", "descuentos", "?order=created_at.desc", setDescuentos), vivoActivo);
  useCambiosEnVivo(["retornos"], () => refrescarLista("retornos", "retornos", "?order=created_at.desc", setRetornos), vivoActivo);
  useCambiosEnVivo(["proveedores"], () => refrescarLista("proveedores", "proveedores", "?order=nombre.asc", setProveedores), vivoActivo);
  useCambiosEnVivo(["flexpack_grupos"], () => refrescarLista("flexpack", "flexpack_grupos", "?order=nombre.asc", setFlexpackGrupos), vivoActivo);

  // Respaldo: compara con lo que hay en la base cada 15 segundos y corrige
  // lo que falte, haya cambiado o ya no exista.
  const difiere = (a, b) => Object.keys(b).some(k => {
    const x = a[k], y = b[k];
    if (x === y) return false;
    if (x && y && typeof x === "object" && typeof y === "object") return JSON.stringify(x) !== JSON.stringify(y);
    return true;
  });
  const reconciliandoRef = useRef(false);
  const reconciliar = async () => {
    if (reconciliandoRef.current) return;
    reconciliandoRef.current = true;
    try {
      await sb.ensureFreshToken();
      const [peds, usrs] = await Promise.all([
        sb.get("pedidos", "?order=created_at.desc"),
        sb.get("usuarios", "?order=created_at.desc").catch(() => null),
      ]);
      if (Array.isArray(peds)) {
        const conocidos = new Set(ordersRef.current.map(o => o.id));
        const faltan = peds.filter(r => !conocidos.has(r.id)).slice(0, 30);
        const completos = await Promise.all(faltan.map(traerPedidoConItems));
        const idsServidor = new Set(peds.map(r => r.id));
        const lista_completa = peds.length < 1000; // si llegó al tope, no se borra nada por seguridad
        setOrders(prev => {
          const porId = new Map(prev.map(o => [o.id, o]));
          const agregados = completos.filter(o => !porId.has(o.id));
          let cambio = agregados.length > 0;
          let resultado = prev.map(o => {
            const r = peds.find(x => x.id === o.id);
            if (!r) return o;
            if (difiere(o, r)) { cambio = true; return { ...o, ...r }; }
            return o;
          });
          if (lista_completa) {
            const antes = resultado.length;
            // (lo creado hace menos de un minuto no se borra: puede que la lista de la base se pidió justo antes)
            resultado = resultado.filter(o => idsServidor.has(o.id) || (Date.now() - new Date(o.created_at).getTime() < 60000));
            if (resultado.length !== antes) cambio = true;
          }
          if (!cambio) return prev;
          return [...agregados, ...resultado].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
        });
      }
      if (Array.isArray(usrs)) {
        setUsers(prev => {
          const porId = new Map(prev.map(u => [u.id, u]));
          const idsServidor = new Set(usrs.map(u => u.id));
          let cambio = false;
          let resultado = prev.map(u => {
            const r = usrs.find(x => x.id === u.id);
            if (!r) return u;
            if (difiere(u, r)) { cambio = true; return { ...u, ...r }; }
            return u;
          });
          const agregados = usrs.filter(r => !porId.has(r.id));
          if (agregados.length) cambio = true;
          if (usrs.length < 1000) { const antes = resultado.length; resultado = resultado.filter(u => idsServidor.has(u.id) || (Date.now() - new Date(u.created_at).getTime() < 60000)); if (resultado.length !== antes) cambio = true; }
          if (!cambio) return prev;
          return [...agregados, ...resultado].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
        });
      }
    } catch (_) { /* no es crítico, se reintenta solo */ }
    reconciliandoRef.current = false;
  };
  useRefrescoPeriodico(reconciliar, 15000, vivoActivo);

  // ── SEPARAR PEDIDOS REALES DE COTIZACIONES ─────────────────────
  // Las cotizaciones NO cuentan como ventas ni en métricas.
  // Los pedidos SIN PAGAR (pagado === false) tampoco cuentan como ventas (esperan el pago de Yappy).
  const cotizaciones = orders.filter(o => o.tipo === "cotizacion");
  const pedidosRealesTodos = orders.filter(o => o.tipo !== "cotizacion" && o.pagado !== false);

  // ── FILTRO POR PERIODO ─────────────────────────────────────────
  const enRango = (fecha) => {
    const f = new Date(fecha);
    const hoy = new Date();
    if (rangoVentas === "todo") return true;
    if (rangoVentas === "dia") return f.toDateString() === hoy.toDateString();
    if (rangoVentas === "semana") {
      const hace7 = new Date(); hace7.setDate(hoy.getDate() - 7);
      return f >= hace7;
    }
    if (rangoVentas === "mes") return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
    if (rangoVentas === "anio") return f.getFullYear() === hoy.getFullYear();
    if (rangoVentas === "personalizado" && fechaPersonalizada) return f.toDateString() === new Date(fechaPersonalizada).toDateString();
    if (rangoVentas === "rango" && rangoInicio && rangoFin) {
      const ini = new Date(rangoInicio); ini.setHours(0,0,0,0);
      const fin = new Date(rangoFin); fin.setHours(23,59,59,999);
      return f >= ini && f <= fin;
    }
    return true;
  };
  const pedidosReales = pedidosRealesTodos.filter(o => enRango(o.created_at));
  // Filtra por # de pedido o nombre de cliente -- solo afecta la lista de la pestaña
  // "Pedidos", no los números del Dashboard ni del Reporte de Ventas
  const pedidosFiltrados = pedidosReales.filter(o => {
    if (soloSinImprimir && o.guia_impresa) return false;
    if (filtroMetodo === "sin" ? !!METODOS_PAGO[o.metodo_pago] : (filtroMetodo !== "todos" && o.metodo_pago !== filtroMetodo)) return false;
    const texto = busquedaPedidos.trim().toLowerCase();
    if (!texto) return true;
    return (o.codigo || "").toLowerCase().includes(texto) || (o.nombre_cliente || "").toLowerCase().includes(texto);
  });
  const fmtCorta = (d) => new Date(d).toLocaleDateString("es-PA", { day: "2-digit", month: "short" });
  const etiquetaRango = { dia: "Hoy", semana: "Última semana", mes: "Este mes", anio: "Este año", todo: "Todo el tiempo", personalizado: fechaPersonalizada ? new Date(fechaPersonalizada).toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" }) : "Fecha específica", rango: (rangoInicio && rangoFin) ? `${fmtCorta(rangoInicio)} → ${fmtCorta(rangoFin)}` : "Rango de fechas" }[rangoVentas];

  // Selector de periodo UNICO: se usa en el Dashboard y en Métricas, comparten el mismo estado
  const renderFiltroPeriodo = () => (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[["dia","Día"],["semana","Semana"],["mes","Mes"],["anio","Año"],["todo","Todo"]].map(([k,l]) => (
          <button key={k} onClick={() => { setRangoVentas(k); setMostrarCalendario(false); }} className="oft-btn-press"
            style={{ padding: "8px 16px", borderRadius: 20, border: `2px solid ${rangoVentas === k ? RED : GRAY2}`, background: rangoVentas === k ? RED : WHITE, color: rangoVentas === k ? WHITE : BLACK, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {l}
          </button>
        ))}
        <button onClick={() => setMostrarCalendario(v => !v)} className="oft-btn-press"
          style={{ padding: "8px 14px", borderRadius: 20, border: `2px solid ${(rangoVentas === "personalizado" || rangoVentas === "rango") ? RED : GRAY2}`, background: (rangoVentas === "personalizado" || rangoVentas === "rango") ? RED : WHITE, color: (rangoVentas === "personalizado" || rangoVentas === "rango") ? WHITE : BLACK, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <CalendarIcon size={15} /> {rangoVentas === "personalizado" && fechaPersonalizada ? new Date(fechaPersonalizada).toLocaleDateString("es-PA", { day: "2-digit", month: "short" }) : rangoVentas === "rango" && rangoInicio && rangoFin ? `${fmtCorta(rangoInicio)}–${fmtCorta(rangoFin)}` : "Fecha"}
        </button>
        <span style={{ fontSize: 13, color: GRAY3, marginLeft: 4 }}>· Mostrando: <strong style={{ color: BLACK }}>{etiquetaRango}</strong></span>
      </div>

      {/* CALENDARIO ANIMADO */}
      {mostrarCalendario && (
        <div className="oft-cal-pop" style={{ marginTop: 12, background: WHITE, border: `2px solid ${GRAY2}`, borderRadius: 16, padding: 16, maxWidth: 320, boxShadow: "0 12px 32px rgba(0,0,0,0.12)" }}>
          {/* Modo: un día o rango */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[["dia","Un día"],["rango","Rango (X → Y)"]].map(([k,l]) => (
              <button key={k} onClick={() => { setModoCalendario(k); setRangoInicio(null); setRangoFin(null); }} className="oft-btn-press"
                style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `2px solid ${modoCalendario === k ? RED : GRAY2}`, background: modoCalendario === k ? RED : WHITE, color: modoCalendario === k ? WHITE : BLACK, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {l}
              </button>
            ))}
          </div>
          {modoCalendario === "rango" && (
            <div style={{ fontSize: 12, color: GRAY3, marginBottom: 10, textAlign: "center" }}>
              {!rangoInicio ? "Toca el día de inicio" : !rangoFin ? "Ahora toca el día final" : `${fmtCorta(rangoInicio)} → ${fmtCorta(rangoFin)}`}
            </div>
          )}
          {/* Cabecera del mes */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1))} className="oft-btn-press" style={{ background: GRAY, border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 800, color: RED }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 15, textTransform: "capitalize" }}>{mesCalendario.toLocaleDateString("es-PA", { month: "long", year: "numeric" })}</div>
            <button onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1))} className="oft-btn-press" style={{ background: GRAY, border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 800, color: RED }}>›</button>
          </div>
          {/* Días de la semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["D","L","M","M","J","V","S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: GRAY3, padding: "4px 0" }}>{d}</div>)}
          </div>
          {/* Días del mes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {(() => {
              const y = mesCalendario.getFullYear(), m = mesCalendario.getMonth();
              const primerDia = new Date(y, m, 1).getDay();
              const diasMes = new Date(y, m + 1, 0).getDate();
              const celdas = [];
              for (let i = 0; i < primerDia; i++) celdas.push(<div key={"e"+i} />);
              for (let d = 1; d <= diasMes; d++) {
                const fecha = new Date(y, m, d);
                const esHoy = fecha.toDateString() === new Date().toDateString();
                const selDia = fechaPersonalizada && new Date(fechaPersonalizada).toDateString() === fecha.toDateString();
                // Resaltado para modo rango
                const esInicio = rangoInicio && new Date(rangoInicio).toDateString() === fecha.toDateString();
                const esFin = rangoFin && new Date(rangoFin).toDateString() === fecha.toDateString();
                const dentroRango = rangoInicio && rangoFin && fecha >= new Date(new Date(rangoInicio).setHours(0,0,0,0)) && fecha <= new Date(new Date(rangoFin).setHours(23,59,59,999));
                const sel = modoCalendario === "dia" ? selDia : (esInicio || esFin);
                const tienePedidos = pedidosRealesTodos.some(o => new Date(o.created_at).toDateString() === fecha.toDateString());
                const clickDia = () => {
                  if (modoCalendario === "dia") {
                    setFechaPersonalizada(fecha); setRangoVentas("personalizado"); setMostrarCalendario(false);
                  } else {
                    // Modo rango: primer clic = inicio, segundo = fin
                    if (!rangoInicio || (rangoInicio && rangoFin)) {
                      setRangoInicio(fecha); setRangoFin(null);
                    } else {
                      // segundo clic: ordena por si elige al revés
                      if (fecha < new Date(rangoInicio)) { setRangoFin(new Date(rangoInicio)); setRangoInicio(fecha); }
                      else { setRangoFin(fecha); }
                      setRangoVentas("rango");
                    }
                  }
                };
                celdas.push(
                  <button key={d} onClick={clickDia} className="oft-cal-day oft-btn-press"
                    style={{ aspectRatio: "1", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: sel || esHoy ? 800 : 600, background: sel ? RED : dentroRango ? "#FFD9DB" : esHoy ? "#FFE5E6" : "transparent", color: sel ? WHITE : BLACK, position: "relative" }}>
                    {d}
                    {tienePedidos && !sel && <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: RED }} />}
                  </button>
                );
              }
              return celdas;
            })()}
          </div>
          {/* Botón aplicar rango */}
          {modoCalendario === "rango" && rangoInicio && rangoFin && (
            <button onClick={() => setMostrarCalendario(false)} className="oft-btn-press" style={{ ...S.btnRed, width: "100%", justifyContent: "center", marginTop: 12, padding: 10, fontSize: 13 }}>
              Aplicar {fmtCorta(rangoInicio)} → {fmtCorta(rangoFin)}
            </button>
          )}
        </div>
      )}
    </div>
  );
  const isoLocal = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const rangoMetricasISO = (() => {
    const hoyP = fechaPanama();
    const [aa, mm] = hoyP.split("-");
    if (rangoVentas === "dia") return [hoyP, hoyP];
    if (rangoVentas === "semana") return [sumarDiasISO(hoyP, -7), hoyP];
    if (rangoVentas === "mes") return [`${aa}-${mm}-01`, hoyP];
    if (rangoVentas === "anio") return [`${aa}-01-01`, hoyP];
    if (rangoVentas === "personalizado" && fechaPersonalizada) { const d = isoLocal(fechaPersonalizada); return [d, d]; }
    if (rangoVentas === "rango" && rangoInicio && rangoFin) return [isoLocal(rangoInicio), isoLocal(rangoFin)];
    return ["2026-06-01", hoyP];
  })();

  // La tienda física tiene historial desde nov-2025 (antes que la web): "todo el tiempo" arranca allí
  const rangoTiendaISO = rangoVentas === "todo" ? ["2025-11-01", fechaPanama()] : rangoMetricasISO;

  // ── MÉTRICAS (solo pedidos reales) ─────────────────────────────
  const ingresoTotal = pedidosReales.reduce((s, o) => s + Number(o.total || 0), 0);
  const ordenesTotal = pedidosReales.length;
  const clientesTotal = users.length;
  const balance = pedidosReales.filter(o => o.estado === 3).reduce((s, o) => s + Number(o.total || 0), 0); // entregados = cobrado

  // Ingresos por día (últimos 7 registros con pedidos)
  const ingresosPorFecha = (() => {
    const map = {};
    pedidosReales.forEach(o => {
      const d = new Date(o.created_at).toLocaleDateString("es-PA", { day: "2-digit", month: "2-digit" });
      if (!map[d]) map[d] = { fecha: d, ingreso: 0, ordenes: 0 };
      map[d].ingreso += Number(o.total || 0);
      map[d].ordenes += 1;
    });
    return Object.values(map).slice(-7);
  })();
  const maxIngreso = Math.max(...ingresosPorFecha.map(d => d.ingreso), 1);

  // ── RETURNING CUSTOMER RATE ────────────────────────────────────
  // % de clientes (con usuario_id) que han hecho más de un pedido real
  const returningRate = (() => {
    const conteo = {};
    pedidosRealesTodos.forEach(o => { if (o.usuario_id) conteo[o.usuario_id] = (conteo[o.usuario_id] || 0) + 1; });
    const compradores = Object.keys(conteo).length;
    if (compradores === 0) return 0;
    const recurrentes = Object.values(conteo).filter(n => n > 1).length;
    return (recurrentes / compradores) * 100;
  })();

  // ── AVERAGE ORDER VALUE OVER TIME (valor + serie para gráfica) ──
  const aovActual = ordenesTotal > 0 ? ingresoTotal / ordenesTotal : 0;
  const aovPorFecha = (() => {
    const map = {};
    pedidosReales.forEach(o => {
      const d = new Date(o.created_at).toLocaleDateString("es-PA", { day: "2-digit", month: "2-digit" });
      if (!map[d]) map[d] = { fecha: d, total: 0, ordenes: 0 };
      map[d].total += Number(o.total || 0);
      map[d].ordenes += 1;
    });
    return Object.values(map).map(d => ({ fecha: d.fecha, aov: d.ordenes > 0 ? d.total / d.ordenes : 0 })).slice(-7);
  })();
  const maxAov = Math.max(...aovPorFecha.map(d => d.aov), 1);

  // ── DESGLOSE DE VENTAS (mini-tabla) ────────────────────────────
  // Desglose de ventas — ahora incluye retornos reales desde la tabla de retornos
  const desglose = (() => {
    let descuentos = 0, envios = 0, totales = 0;
    pedidosReales.forEach(o => {
      totales += Number(o.total || 0);
      envios += Number(o.costo_envio || 0);
      descuentos += Number(o.descuento_monto || 0);
    });
    // Retornos reembolsados en el período seleccionado
    const retornosEnRango = retornos.filter(r =>
      (r.estado === "reembolsado" || r.estado === "aprobado") && enRango(r.created_at)
    );
    const montoRetornos = retornosEnRango.reduce((s, r) => s + Number(r.monto_reembolso || 0), 0);
    const fleteRetorno = 0; // próximamente
    const bruta = totales - envios + descuentos;
    const netas = bruta - descuentos - montoRetornos;
    return { bruta, descuentos, retornos: montoRetornos, netas, envios, fleteRetorno, totales };
  })();

  // ── ANÁLISIS DE STOCK (rotación, ingreso, sugerencia de compra) ──
  // Usa SOLO ventas reales de la web (pedidosRealesTodos), sin importar el filtro de fecha del dashboard.
  const LEAD_TIME_DIAS = 7; // tiempo que tarda en llegar la mercancía de tu proveedor
  const VENTANA_VELOCIDAD_DIAS = 30; // solo se usan las ventas de los últimos 30 días para calcular qué tan rápido se está vendiendo
  const analisisStock = (() => {
    const hoy = new Date();
    const map = {}; // producto_id -> { cantidad, cantidadReciente, ingreso, primeraFecha, ultimaFecha }
    pedidosRealesTodos.forEach(o => {
      const fechaPedido = new Date(o.created_at);
      const diasDesdeVenta = (hoy - fechaPedido) / 86400000;
      (o.items || []).forEach(it => {
        if (!it.producto_id) return;
        const key = it.producto_id;
        if (!map[key]) map[key] = { producto_id: key, cantidad: 0, cantidadReciente: 0, ingreso: 0, primeraFecha: o.created_at, ultimaFecha: o.created_at };
        map[key].cantidad += Number(it.cantidad || 0);
        // Solo cuenta para la VELOCIDAD si la venta fue dentro de la ventana reciente --
        // esto es lo que hace que "reponer pronto" reaccione a lo que se vende AHORA,
        // no a un promedio diluido desde que el producto se creó.
        if (diasDesdeVenta <= VENTANA_VELOCIDAD_DIAS) map[key].cantidadReciente += Number(it.cantidad || 0);
        map[key].ingreso += Number(it.subtotal || 0);
        if (fechaPedido < new Date(map[key].primeraFecha)) map[key].primeraFecha = o.created_at;
        if (fechaPedido > new Date(map[key].ultimaFecha)) map[key].ultimaFecha = o.created_at;
      });
    });

    const filas = Object.values(map).map(m => {
      const prod = products.find(p => p.id === m.producto_id);
      if (!prod) return null;
      const diasDesdeInicio = Math.max(1, Math.ceil((hoy - new Date(m.primeraFecha)) / 86400000));
      // Ventana real a usar: 30 días, o menos si el producto es más nuevo que eso
      // (para no diluir la velocidad de algo que apenas lleva unos días a la venta).
      const diasVentana = Math.min(VENTANA_VELOCIDAD_DIAS, diasDesdeInicio);
      const velocidadDiaria = m.cantidadReciente / diasVentana; // unidades vendidas por día, RECIENTE
      const costoUnit = costoProducto(prod);
      const margen = costoUnit > 0 ? m.ingreso - (costoUnit * m.cantidad) : null; // null = sin dato de costo
      // Stock actual (si está sincronizado con Odoo)
      const tieneStock = !!prod.stock_actualizado_at;
      const stockActual = tieneStock ? Number(prod.stock || 0) : null;
      // Días hasta agotar stock, según velocidad de venta reciente
      const diasHastaAgotar = (tieneStock && velocidadDiaria > 0) ? Math.floor(stockActual / velocidadDiaria) : null;
      // Sugerencia de compra: cubrir ventas del lead time + un colchón de seguridad (otro lead time)
      const sugerenciaCompra = Math.ceil(velocidadDiaria * LEAD_TIME_DIAS * 2);
      // ¿Cuándo reponer? Si ya sabemos el stock, restamos lo que tardará en agotarse menos el lead time
      let diasParaReponer = null;
      if (diasHastaAgotar !== null) diasParaReponer = Math.max(0, diasHastaAgotar - LEAD_TIME_DIAS);
      // Si el stock YA está en 0 (o casi) y todavía se está vendiendo, es urgente sin
      // importar el promedio -- no depende solo de la velocidad calculada.
      if (tieneStock && stockActual <= 0 && m.cantidadReciente > 0) diasParaReponer = 0;
      return {
        ...m, prod, diasDesdeInicio, velocidadDiaria, margen, stockActual, diasHastaAgotar,
        sugerenciaCompra, diasParaReponer, tieneStock,
      };
    }).filter(Boolean);

    return filas;
  })();

  const rotacionOrdenado = [...analisisStock].sort((a, b) => b.velocidadDiaria - a.velocidadDiaria);
  const ingresoOrdenado = [...analisisStock].sort((a, b) => b.ingreso - a.ingreso);
  const urgentesReponer = analisisStock.filter(f => f.diasParaReponer !== null && f.diasParaReponer <= 3).sort((a, b) => a.diasParaReponer - b.diasParaReponer);

  // ── INGRESOS POR CATEGORÍA ──────────────────────────────────────
  // Agrupa el mismo ingreso ya calculado por producto, pero sumado por
  // categoría -- para ver de un vistazo cuál línea (ej. Perfumería vs. Jeans)
  // genera más dinero en total, sin tener que sumarlo a mano producto por producto.
  const ingresoPorCategoria = (() => {
    const map = {};
    analisisStock.forEach(f => {
      const catId = f.prod?.categoria_id ?? "sin_categoria";
      if (!map[catId]) map[catId] = { categoria_id: catId, ingreso: 0, cantidad: 0, productos: 0 };
      map[catId].ingreso += f.ingreso;
      map[catId].cantidad += f.cantidad;
      map[catId].productos += 1;
    });
    return Object.values(map)
      .map(m => ({ ...m, categoria: categories.find(c => c.id === m.categoria_id)?.nombre || "Sin categoría" }))
      .sort((a, b) => b.ingreso - a.ingreso);
  })();

  // ── VENTAS POR ÁREA/UBICACIÓN ──────────────────────────────────
  // Prioridad: 1) sucursal de destino (ya es un valor limpio, elegido de una lista)
  //            2) si no hay sucursal, busca una provincia/ciudad conocida dentro de la dirección de texto libre
  const ventasPorArea = (() => {
    const mapa = {};
    orders.filter(o => o.tipo !== "cotizacion" && o.pagado !== false).forEach(o => {
      const area = resolverAreaVenta(o);
      if (!mapa[area]) mapa[area] = { area, total: 0, pedidos: 0 };
      mapa[area].total += Number(o.total) || 0;
      mapa[area].pedidos += 1;
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  })();

  // Mejores productos (por cantidad vendida, solo pedidos reales)
  const mejoresProductos = (() => {
    const map = {};
    pedidosReales.forEach(o => (o.items || []).forEach(it => {
      const key = it.nombre_producto;
      if (!map[key]) map[key] = { nombre: key, cantidad: 0, ingreso: 0, producto_id: it.producto_id };
      map[key].cantidad += Number(it.cantidad || 0);
      map[key].ingreso += Number(it.subtotal || 0);
    }));
    return Object.values(map).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
  })();

  // ── MENSAJES DE WHATSAPP POR ESTADO ────────────────────────────
  const buildStatusMessage = (order, status) => {
    const nombre = order.nombre_cliente || "Cliente";
    const codigo = order.codigo;
    const envio = order.empresa_envio_nombre ? `\n🚚 Envío: ${order.empresa_envio_nombre}${order.sucursal_nombre ? ` - ${order.sucursal_nombre}` : ""}` : "";
    const direccionLocal = "\n📍 Puedes pasar a recogerlo a nuestro local en Colón.";
    const mensajesEnvio = [
      `¡Hola ${nombre}! 👋\n\nTu pedido *${codigo}* en Ofertodo ha sido *recibido* ✅\n\nEstamos procesándolo y pronto comenzaremos a empacarlo.${envio}\n\n¡Gracias por tu compra! 🛍️`,
      `¡Hola ${nombre}! 📦\n\nTu pedido *${codigo}* ya está siendo *empacado* con cuidado.\n\nTe avisaremos cuando esté listo para envío.${envio}\n\n¡Gracias por tu paciencia! 🙌`,
      `¡Hola ${nombre}! ✅\n\n¡Buenas noticias! Tu pedido *${codigo}* está *listo para envío* 🎉\n\nPronto será despachado.${envio}\n\n¡Ya casi lo tienes! 🚀`,
      `¡Hola ${nombre}! 🚚\n\nTu pedido *${codigo}* ha sido *enviado* 📨\n\nYa va en camino hacia ti.${envio}\n\n¡Gracias por comprar en Ofertodo! ❤️`,
    ];
    const mensajesRetiro = [
      `¡Hola ${nombre}! 👋\n\nTu pedido *${codigo}* en Ofertodo ha sido *recibido* ✅\n\nEstamos procesándolo y pronto comenzaremos a empacarlo.\n\n¡Gracias por tu compra! 🛍️`,
      `¡Hola ${nombre}! 📦\n\nTu pedido *${codigo}* ya está siendo *empacado* con cuidado.\n\nTe avisaremos apenas esté listo para que pases a recogerlo.\n\n¡Gracias por tu paciencia! 🙌`,
      `¡Hola ${nombre}! ✅\n\n¡Buenas noticias! Tu pedido *${codigo}* está *listo para retiro* 🎉${direccionLocal}\n\n¡Te esperamos! 🚀`,
      `¡Hola ${nombre}! 🎉\n\nConfirmamos que tu pedido *${codigo}* fue *retirado* correctamente.\n\n¡Gracias por comprar en Ofertodo! ❤️`,
    ];
    const mensajes = order.retiro_local ? mensajesRetiro : mensajesEnvio;
    return mensajes[status] || "";
  };

  const notifyWhatsApp = (order, status) => {
    if (!order.telefono) {
      alert("Este pedido no tiene número de WhatsApp del cliente, no se puede notificar.");
      return;
    }
    // Limpia el número: solo dígitos
    let phone = String(order.telefono).replace(/\D/g, "");
    // Si no tiene código de país (Panamá = 507) y parece local, lo agrega
    if (phone.length === 8) phone = "507" + phone;
    const msg = buildStatusMessage(order, status);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleStatusChange = async (orderId, newStatus) => {
    const order = orders.find(o => o.id === orderId);
    try {
      await sb.patch("pedidos", orderId, { estado: newStatus });
      setOrders(orders.map(o => o.id === orderId ? { ...o, estado: newStatus } : o));
      showToast("Estado actualizado");
      // Notificación semi-automática por WhatsApp
      if (order) {
        const ok = confirm(`Estado actualizado a "${estadosDe(order)[newStatus]}".\n\n¿Notificar al cliente por WhatsApp?`);
        if (ok) notifyWhatsApp({ ...order, estado: newStatus }, newStatus);
      }
    } catch(e) {
      const m = String((e && e.message) || "");
      if (/revisi(ó|\\u00f3|o)n de riesgo|pesta(ñ|n)a Fraude/i.test(m)) alert("Este pedido está retenido por riesgo de fraude con tarjeta.\n\nVerifícalo con el cliente y apruébalo en la pestaña «Fraude» antes de avanzarlo.");
      else alert("Error al actualizar estado");
    }
  };

  // Guarda (opcionalmente) quién está autorizado a recoger un pedido de retiro en local
  // Cambia el método de pago de un pedido (manual: Yappy / Tarjeta / Transferencia)
  const cambiarMetodoPago = async (orderId, metodo) => {
    try {
      await sb.patch("pedidos", orderId, { metodo_pago: metodo || null });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, metodo_pago: metodo || null } : o));
      showToast("Método de pago guardado");
    } catch(e) { showToast("No se pudo guardar: " + e.message); }
  };

  const handleGuardarQuienRecoge = async (orderId, nombre) => {
    try {
      await sb.patch("pedidos", orderId, { retiro_nombre_autorizado: nombre || null });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, retiro_nombre_autorizado: nombre || null } : o));
      showToast("Guardado");
    } catch(e) { showToast("No se pudo guardar: " + e.message); }
  };

  // ── RESERVAR / LIBERAR las piezas de una cotización ─────────────
  // Reservada = esas piezas dejan de estar a la venta (web y pedidos manuales) hasta liberarla o convertirla en pedido.
  const alternarReserva = async (cot) => {
    try {
      if (cot.reservada) {
        if (!confirm(`¿Liberar la reserva ${cot.codigo}?\n\nLas piezas vuelven a estar disponibles para vender (web y pedidos manuales).`)) return;
        await sb.patch("pedidos", cot.id, { reservada: false, reserva_vence: null });
        setOrders(prev => prev.map(o => o.id === cot.id ? { ...o, reservada: false, reserva_vence: null } : o));
        showToast("Reserva liberada: las piezas vuelven a estar a la venta");
        return;
      }
      // Antes de reservar: que las piezas no estén ya reservadas por otro cliente
      const porProducto = {};
      (cot.items || []).forEach(it => { if (it.producto_id) porProducto[it.producto_id] = (porProducto[it.producto_id] || 0) + (Number(it.cantidad) || 0); });
      const conflictos = [];
      for (const id of Object.keys(porProducto)) {
        const p = products.find(x => String(x.id) === String(id));
        if (!p || !p.stock_actualizado_at) continue;
        const libres = Math.max(0, Number(p.stock || 0) - (Number(p.piezas_reservadas) || 0));
        if (porProducto[id] > libres) conflictos.push(`• ${p.nombre}: la cotización lleva ${porProducto[id]} y solo hay ${libres} sin reservar`);
      }
      if (conflictos.length) { alert("No se puede reservar -- no hay suficientes piezas libres:\n\n" + conflictos.join("\n")); return; }
      if (!confirm(`¿Reservar las piezas de ${cot.codigo}?\n\nNadie más podrá venderlas (ni en la web ni en pedidos manuales) hasta que la liberes o la conviertas en pedido.`)) return;
      await sb.patch("pedidos", cot.id, { reservada: true });
      setOrders(prev => prev.map(o => o.id === cot.id ? { ...o, reservada: true } : o));
      showToast("Piezas reservadas");
    } catch(e) { showToast("No se pudo guardar: " + (e.message || e)); }
  };

  // ── CONVERTIR COTIZACIÓN EN PEDIDO ─────────────────────────────
  const convertirAPedido = async (cot) => {
    // Candado sincrónico: si ya hay una conversión en curso para ESTA misma
    // cotización (ej. por un doble clic o doble toque en celular), la segunda
    // llamada se ignora de inmediato -- ni siquiera llega a mostrar el "¿Confirmar?".
    // Esto es lo que evita que se cree la venta 2 veces en Odoo.
    if (convirtiendoRef.current.has(cot.id)) return;
    convirtiendoRef.current.add(cot.id);
    try {
      const ok = confirm(`¿Convertir la cotización ${cot.codigo} en un pedido real?\n\nSe registrará como venta de HOY y aparecerá en Pedidos.`);
      if (!ok) return;
      setConvirtiendoId(cot.id);
      // La lista que se ve en pantalla puede estar desactualizada (otro celular, otra pestaña u
      // otra persona del equipo pudo convertir esta cotización hace segundos). Antes de tocar
      // Odoo se revisa en la base de datos el estado REAL; si ya es pedido, no se hace nada.
      // (Así pasó con OFT-1350: convertido desde una Mac y un iPhone con 11 s de diferencia.)
      try {
        const frescos = await sb.get("pedidos", `?id=eq.${cot.id}&select=id,tipo,codigo,estado,created_at`);
        const fresco = Array.isArray(frescos) ? frescos[0] : null;
        if (fresco && fresco.tipo !== "cotizacion") {
          setOrders(prev => prev.map(o => o.id === cot.id ? { ...o, tipo: fresco.tipo, codigo: fresco.codigo, estado: fresco.estado, created_at: fresco.created_at, es_cotizacion_convertida: true } : o));
          alert(`Esta cotización ya fue convertida en el pedido ${fresco.codigo} (desde otro dispositivo o por otra persona). No se hizo nada más.`);
          return;
        }
      } catch(e) { /* si no se pudo revisar, sigue: el servidor igual evita duplicar la venta en Odoo */ }
      // Nuevo código de pedido (mantiene el número de factura)
      const nuevoCodigo = "OFT-" + (cot.num_factura || Date.now().toString().slice(-6));

      // Antes de convertir nada, se le pregunta a Odoo (que tiene el inventario real) si
      // alcanza el stock -- la cotización pudo haberse hecho ayer, y el stock de hoy puede
      // ser distinto. Si algo no alcanza, se DETIENE aquí: la cotización se queda tal cual,
      // sin convertir, y se avisa exactamente qué producto(s) no tienen suficiente stock.
      const itemsOdoo = (cot.items || []).map(it => {
        const prod = products.find(p => p.id === it.producto_id);
        const cantidad = Number(it.cantidad) || 0;
        // El "precio_unitario" guardado a veces es el precio de la docena/media docena
        // completa, no el de 1 pieza (aunque "cantidad" sí está en piezas) — para Odoo
        // necesitamos el precio real POR PIEZA, así que lo derivamos del subtotal (que
        // siempre es correcto) en vez de usar precio_unitario tal cual.
        const precioPorPieza = cantidad > 0 ? Number(it.subtotal) / cantidad : Number(it.precio_unitario) || 0;
        return {
          referencia: prod?.referencia || null,
          nombre_producto: it.nombre_producto,
          cantidad: it.cantidad,
          precio_unitario: precioPorPieza,
        };
      });

      let dataOdoo;
      try {
        const respOdoo = await fetch(`${SUPABASE_URL}/functions/v1/crear-venta-odoo`, {
          method: "POST",
          headers: sb.functionHeaders(),
          body: JSON.stringify({
            codigo: nuevoCodigo, nombre_cliente: cot.nombre_cliente, email_cliente: null,
            telefono: cot.telefono, direccion: cot.direccion,
            costo_envio: cot.costo_envio, empresa_envio: cot.empresa_envio_nombre,
            items: itemsOdoo, reserva_pedido_id: cot.reservada ? cot.id : null,
          }),
        });
        dataOdoo = await respOdoo.json().catch(() => ({}));
      } catch(e) {
        alert("No se pudo conectar con Odoo para verificar el stock. La cotización NO se convirtió -- intenta de nuevo.\n\n" + e.message);
        return;
      }
      if (!dataOdoo.ok) {
        if (dataOdoo.sin_stock) {
          const detalle = (dataOdoo.problemas || []).map(p => `• ${p.nombre}: pidió ${p.solicitado}, hay ${p.disponible} disponibles${p.reservadas_otros ? ` (${p.reservadas_otros} están reservadas para otros clientes)` : ""}${p.comprometidas_odoo ? ` (${p.comprometidas_odoo} ya comprometidas en otras entregas pendientes de Odoo)` : ""}`).join("\n");
          alert(`No se pudo convertir -- no hay suficiente stock en Odoo:\n\n${detalle}\n\nLa cotización se quedó tal cual. Ajusta las cantidades o repón stock antes de intentar de nuevo.`);
        } else {
          alert("No se pudo convertir: " + (dataOdoo.mensaje || dataOdoo.error || "error desconocido al sincronizar con Odoo") + "\n\nLa cotización se quedó tal cual -- intenta de nuevo.");
        }
        return;
      }

      // La fecha pasa a HOY: la venta cuenta el día en que se confirma, no el día de la cotización
      const ahora = new Date().toISOString();
      await sb.patch("pedidos", cot.id, {
        tipo: "pedido", codigo: nuevoCodigo, estado: 0, created_at: ahora,
        es_cotizacion_convertida: true, fecha_cotizacion_original: cot.created_at,
        reservada: false,
      });
      setOrders(prev => prev.map(o => o.id === cot.id ? { ...o, tipo: "pedido", codigo: nuevoCodigo, estado: 0, created_at: ahora, es_cotizacion_convertida: true, fecha_cotizacion_original: cot.created_at, reservada: false } : o));
      showToast(`¡Cotización convertida en pedido ${nuevoCodigo}!`);
      if (dataOdoo.entrega_error) {
        // La venta y el stock SÍ quedaron reservados en Odoo (eso ya pasó al confirmar la
        // orden) -- solo el paso final de "Validar" la entrega no se pudo hacer solo.
        alert("⚠️ ATENCIÓN: el pedido " + nuevoCodigo + " se creó en Odoo, pero el inventario NO se descontó porque la entrega no se pudo validar.\n\nQué hacer: en Odoo entra a Inventario → Entregas, busca la entrega de este pedido y pulsa «Validar».\n\nDetalle: " + String(dataOdoo.entrega_error).slice(0, 300));
      }
    } catch(e) {
      alert("Error al convertir: " + (e.message || e));
    } finally {
      // Se libera el candado pase lo que pase -- éxito, cancelado, o cualquier error --
      // así una cotización SOLO queda bloqueada mientras su propia conversión está en curso.
      convirtiendoRef.current.delete(cot.id);
      setConvirtiendoId(prev => prev === cot.id ? null : prev);
    }
  };

  // ── ELIMINAR PEDIDO (con confirmación) ─────────────────────────
  const eliminarPedido = async () => {
    if (!pedidoAEliminar?.id) return;
    // Candado sincrónico: un doble clic no puede disparar 2 cancelaciones/devoluciones
    // en Odoo a la vez (el estado de React no se actualiza lo bastante rápido para evitarlo).
    if (eliminandoRef.current) return;
    eliminandoRef.current = true;
    setEliminando(true);
    try {
      let notaOdoo = "";
      // 1) Primero Odoo: se cancela la venta y se devuelve la mercancía al inventario.
      //    Las cotizaciones nunca se mandaron a Odoo, así que se saltan.
      //    Si Odoo no encuentra ninguna venta con este código (pedidos viejos, o que
      //    nunca se pagaron), simplemente responde ok sin hacer nada.
      let hayReembolsoPendiente = false;
      let facturaEstabaCobrada = false; // Odoo la mostraba como cobrada/en pago al momento de confirmar
      if (pedidoAEliminar.tipo !== "cotizacion") {
        let dataOdoo = null, falloConexion = null;
        const llamarOdoo = async (aceptaNotaCredito) => {
          const respOdoo = await fetch(`${SUPABASE_URL}/functions/v1/cancelar-venta-odoo`, {
            method: "POST", headers: sb.functionHeaders(),
            body: JSON.stringify({ codigo: pedidoAEliminar.codigo, acepta_nota_credito: aceptaNotaCredito }),
          });
          return await respOdoo.json().catch(() => ({}));
        };
        try {
          dataOdoo = await llamarOdoo(false);
          // Si el pedido ya está facturado en Odoo, hace falta una nota de crédito (contabilidad):
          // Odoo NO ha tocado nada todavía -- primero se le explica al usuario y se le pide confirmar.
          if (dataOdoo?.requiere_confirmacion) {
            const estadoPago = (e) => e === "not_paid" ? "sin pagar" : e === "partial" ? "pago parcial" : "ya pagada";
            const lineas = (dataOdoo.facturas || []).map(f => `  • ${f.factura} — $${Number(f.total).toFixed(2)} (${estadoPago(f.estado_pago)})`).join("\n");
            const hayPagadas = (dataOdoo.facturas || []).some(f => f.estado_pago !== "not_paid");
            facturaEstabaCobrada = hayPagadas;
            const aceptar = confirm(
              `Este pedido ya está facturado en Odoo:\n\n${lineas}\n\n` +
              `Si continúas, en Odoo se va a:\n  1. Devolver la mercancía al inventario\n  2. Emitir la nota de crédito de la factura\n  3. Cancelar la venta\n` +
              (hayPagadas ? `\nComo la factura ya está pagada, la nota de crédito deja un saldo a favor del cliente. El reembolso del dinero (Yappy/tarjeta) lo registras tú a mano.\n` : "") +
              `\n¿Continuar?`
            );
            if (!aceptar) return; // no se elimina nada, ni en Odoo ni en la web
            dataOdoo = await llamarOdoo(true);
          }
        } catch(e) { falloConexion = e.message || String(e); }

        if (falloConexion || !dataOdoo?.ok) {
          const motivo = falloConexion
            ? `No se pudo conectar con Odoo (${falloConexion}).`
            : (dataOdoo?.mensaje || dataOdoo?.error || "Odoo respondió con un error.");
          // Por defecto NO se elimina (para que la web y Odoo no queden desfasados),
          // pero se deja la decisión en manos de quien lo está haciendo.
          const seguir = confirm(
            `No se pudo cancelar este pedido en Odoo:\n\n${motivo}\n\nEl pedido todavía NO se ha eliminado.\n\n` +
            `¿Eliminarlo SOLO de la web de todas formas? (Tendrás que arreglarlo tú a mano en Odoo.)`
          );
          if (!seguir) return;
          notaOdoo = " (Odoo: pendiente de arreglar a mano)";
        } else if (dataOdoo.encontrada) {
          const ordenesOdoo = dataOdoo.ordenes || [];
          const nNotas = ordenesOdoo.reduce((s, o) => s + (o.notas_credito?.length || 0), 0);
          // El recordatorio sale si la nota quedo abierta (saldo a favor) O si la factura estaba cobrada:
          // aunque la nota se cruce sola con la factura, el COBRO original no se devuelve ni se anula solo.
          hayReembolsoPendiente = nNotas > 0 && (facturaEstabaCobrada || ordenesOdoo.some(o => (o.notas_credito || []).some(n => n.saldo_a_favor)));
          notaOdoo = " · Odoo: venta cancelada y mercancía devuelta" + (nNotas ? ` · ${nNotas} nota(s) de crédito emitida(s)` : "");
        }
      }

      // 2) Después la web: borra primero los items del pedido, luego el pedido
      try {
        const its = await sb.get("pedido_items", `?pedido_id=eq.${pedidoAEliminar.id}`);
        for (const it of (its || [])) { if (it.id) await sb.delete("pedido_items", it.id); }
      } catch(e) {}
      await sb.delete("pedidos", pedidoAEliminar.id);
      setOrders(prev => prev.filter(o => o.id !== pedidoAEliminar.id));
      showToast(`Pedido ${pedidoAEliminar.codigo} eliminado${notaOdoo}`);
      const codigoEliminado = pedidoAEliminar.codigo;
      setPedidoAEliminar(null);
      // Recordatorio importante: la nota de crédito dejó un saldo a favor del cliente, y el
      // dinero NO se devuelve solo -- hay que registrarlo a mano, así que no se deja pasar.
      if (hayReembolsoPendiente) {
        alert(`Pedido ${codigoEliminado} eliminado.\n\nRecuerda: este pedido ya estaba cobrado. En Odoo se emitió la nota de crédito, pero el sistema NO devuelve el dinero ni anula el cobro original. Falta reembolsarle al cliente y registrar ese reembolso (o anular el pago) a mano en Odoo.`);
      }
    } catch(e) {
      alert("Error al eliminar: " + (e.message || e));
    } finally {
      eliminandoRef.current = false;
      setEliminando(false);
    }
  };

  // ── DESCUENTOS: crear / editar / eliminar / activar ────────────
  const abrirNuevoDescuento = () => setDescForm({
    id: null, codigo: "", tipo_aplicacion: "tienda", porcentaje: "10",
    productos_ids: [], activo: true,
  });
  const guardarDescuento = async () => {
    const f = descForm;
    if (!f.codigo.trim()) { showToast("Escribe un código (ej: VERANO10)"); return; }
    const pct = Number(f.porcentaje);
    if (!pct || pct <= 0 || pct > 100) { showToast("El porcentaje debe ser entre 1 y 100"); return; }
    if (f.tipo_aplicacion === "productos" && (!f.productos_ids || f.productos_ids.length === 0)) { showToast("Elige al menos un producto"); return; }
    setGuardandoDesc(true);
    try {
      const datos = {
        codigo: f.codigo.trim().toUpperCase(),
        tipo_aplicacion: f.tipo_aplicacion, // "tienda" | "productos"
        porcentaje: pct,
        productos_ids: f.tipo_aplicacion === "productos" ? f.productos_ids : [],
        activo: f.activo,
      };
      if (f.id) {
        await sb.patch("descuentos", f.id, datos);
        setDescuentos(prev => prev.map(d => d.id === f.id ? { ...d, ...datos } : d));
      } else {
        const fila = await sb.post("descuentos", datos);
        if (Array.isArray(fila) && fila[0]) setDescuentos(prev => [fila[0], ...prev]);
      }
      showToast("Descuento guardado");
      setDescForm(null);
    } catch(e) {
      const msg = (e.message || "").includes("duplicate") ? "Ya existe un descuento con ese código" : "Error: " + (e.message || "no se pudo guardar");
      showToast(msg);
    }
    setGuardandoDesc(false);
  };
  const eliminarDescuento = async (d) => {
    if (!confirm(`¿Eliminar el código ${d.codigo}?`)) return;
    try {
      await sb.delete("descuentos", d.id);
      setDescuentos(prev => prev.filter(x => x.id !== d.id));
      showToast("Descuento eliminado");
    } catch(e) { showToast("Error al eliminar"); }
  };
  const toggleDescuento = async (d) => {
    try {
      await sb.patch("descuentos", d.id, { activo: !d.activo });
      setDescuentos(prev => prev.map(x => x.id === d.id ? { ...x, activo: !x.activo } : x));
    } catch(e) { showToast("Error al cambiar estado"); }
  };

  // ── RETORNOS: crear / editar / eliminar ────────────────────────
  const abrirNuevoRetorno = () => setRetornoForm({
    id: null,
    pedido_id: "",
    codigo_pedido: "",
    nombre_cliente: "",
    motivo: "",
    items_retornados: [], // [{ product_id, referencia, nombre, cantidad }]
    productos_retornados: "", // texto libre como respaldo
    monto_reembolso: "",
    estado: "pendiente",
    notas: "",
  });

  const abrirEditarRetorno = (r) => setRetornoForm({
    ...r,
    items_retornados: r.items_retornados || [],
  });

  const guardarRetorno = async () => {
    const f = retornoForm;
    if (!f.nombre_cliente?.trim()) { showToast("Escribe el nombre del cliente"); return; }
    if (!f.motivo?.trim()) { showToast("Escribe el motivo del retorno"); return; }
    setGuardandoRetorno(true);
    try {
      const datos = {
        pedido_id: f.pedido_id || null,
        codigo_pedido: f.codigo_pedido?.trim() || "",
        nombre_cliente: f.nombre_cliente.trim(),
        motivo: f.motivo.trim(),
        // Genera el texto de productos desde los items seleccionados
        productos_retornados: f.items_retornados?.length > 0
          ? f.items_retornados.map(i => `${i.cantidad}x ${i.nombre} (${i.referencia})`).join(", ")
          : f.productos_retornados?.trim() || "",
        items_retornados: f.items_retornados || [],
        monto_reembolso: Number(f.monto_reembolso) || 0,
        estado: f.estado || "pendiente",
        notas: f.notas?.trim() || "",
        updated_at: new Date().toISOString(),
      };
      if (f.id) {
        await sb.patch("retornos", f.id, datos);
        setRetornos(prev => prev.map(r => r.id === f.id ? { ...r, ...datos } : r));
        showToast("Retorno actualizado");
      } else {
        const fila = await sb.post("retornos", datos);
        if (Array.isArray(fila) && fila[0]) setRetornos(prev => [fila[0], ...prev]);
        showToast("Retorno registrado");
      }
      setRetornoForm(null);
    } catch(e) { showToast("Error: " + (e.message || "no se pudo guardar")); }
    setGuardandoRetorno(false);
  };

  const eliminarRetorno = async (r) => {
    if (!confirm(`¿Eliminar el retorno de ${r.nombre_cliente}?`)) return;
    try {
      await sb.delete("retornos", r.id);
      setRetornos(prev => prev.filter(x => x.id !== r.id));
      showToast("Retorno eliminado");
    } catch(e) { showToast("Error al eliminar"); }
  };

  const cambiarEstadoRetorno = async (r, nuevoEstado) => {
    try {
      await sb.patch("retornos", r.id, { estado: nuevoEstado, updated_at: new Date().toISOString() });
      setRetornos(prev => prev.map(x => x.id === r.id ? { ...x, estado: nuevoEstado } : x));
      showToast("Estado actualizado");
    } catch(e) { showToast("Error al cambiar estado"); }
  };

  // ── SUBIDA DE IMAGEN DE PRODUCTO ───────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileComprimido = await comprimirImagen(file);
      const cleanName = fileComprimido.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}_${cleanName}`;
      await sb.upload("productos", path, fileComprimido);
      const url = `${sb.publicUrl("productos", path)}?t=${Date.now()}`;
      setProdForm(p => ({ ...p, imagen_url: url }));
      showToast("Imagen subida");
    } catch(err) {
      alert("Error subiendo imagen: " + err.message + "\n\nVerifica que el bucket 'productos' exista y sea público.");
    }
    setUploading(false);
  };

  // ── SUBIDA DE ICONO DE CATEGORÍA ───────────────────────────────
  const handleCatIconUpload = async (e, cat) => {
    const file = e.target.files[0];
    if (!file) return;
    setCatUploading(cat.id);
    try {
      const fileComprimido = await comprimirImagen(file, 400, 0.85); // los íconos son chicos, no hace falta tanto tamaño
      const cleanName = fileComprimido.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}_${cleanName}`;
      await sb.upload("categorias", path, fileComprimido);
      const url = `${sb.publicUrl("categorias", path)}?t=${Date.now()}`;
      await sb.patch("categorias", cat.id, { icono_url: url });
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, icono_url: url } : c));
      showToast("Icono actualizado");
    } catch(err) {
      alert("Error subiendo icono: " + err.message + "\n\nVerifica que el bucket 'categorias' exista y sea público.");
    }
    setCatUploading(null);
  };

  // ── GUARDAR / EDITAR PRODUCTO ──────────────────────────────────
  const openNewProduct = () => { setProdForm(emptyProd); setEditingId(null); setShowProdForm(true); setShowBulk(false); };
  const openEditProduct = (p) => {
    setProdForm({ referencia: p.referencia || "", nombre: p.nombre || "", descripcion: p.descripcion || "", categoria_id: p.categoria_id || categories[0]?.id || 1, precio_pieza: p.precio_pieza, precio_media_docena: p.precio_media_docena, precio_docena: p.precio_docena, precio_minimo: p.precio_minimo ?? "", precio_especial: p.precio_especial ?? "", badge: p.badge || "", activo: p.activo, destacado: p.destacado || false, imagen_url: p.imagen_url || "", tiene_tallas: p.tiene_tallas || false, tiene_colores: p.tiene_colores || false, tallas: p.tallas || "", colores: p.colores || "", distribucion_docena: p.distribucion_docena || "", distribucion_eje: p.distribucion_eje || "", proveedor_id: p.proveedor_id || null, venta_por_unidad: p.venta_por_unidad || false, tiene_stock_fisico: p.tiene_stock_fisico || false, piezas_muestra: Number(p.piezas_muestra) || 0, notas_fragancia: p.notas_fragancia || "", modalidad_presentacion: p.modalidad_presentacion || "estandar", flexpack_grupo_id: p.flexpack_grupo_id || null });
    setEditingId(p.id);
    setShowProdForm(true);
    setShowBulk(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveProd = async () => {
    if (!prodForm.nombre || prodForm.precio_pieza === "") { alert("Nombre y precio por pieza son requeridos"); return; }
    const payload = { ...prodForm, precio_pieza: Number(prodForm.precio_pieza), precio_media_docena: Number(prodForm.precio_media_docena), precio_docena: Number(prodForm.precio_docena), precio_minimo: prodForm.precio_minimo === "" ? null : Number(prodForm.precio_minimo), precio_especial: prodForm.precio_especial === "" ? null : Number(prodForm.precio_especial) };
    try {
      if (editingId) {
        const updated = await sb.patch("productos", editingId, payload);
        setProducts(prev => prev.map(p => p.id === editingId ? updated[0] : p));
        showToast("Producto actualizado");
      } else {
        const saved = await sb.post("productos", payload);
        setProducts(prev => [...prev, saved[0]]);
        showToast("Producto creado");
      }
      setShowProdForm(false);
      setEditingId(null);
      setProdForm(emptyProd);
    } catch(e) { alert("Error guardando producto: " + e.message); }
  };

  const handleToggleWeb = async (product) => {
    const visibleActualmente = product.visible_web !== false; // true si estaba visible (o nunca se había tocado este campo)
    const nuevoVisibleWeb = !visibleActualmente;
    try {
      await sb.patch("productos", product.id, { visible_web: nuevoVisibleWeb });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, visible_web: nuevoVisibleWeb } : p));
      showToast(nuevoVisibleWeb ? "Producto visible en la web" : "Producto oculto de la web");
    } catch(e) { alert("Error al cambiar visibilidad"); }
  };

  // Marca/desmarca que este producto tiene una pieza abierta de muestra (no vendible):
  // la web la resta de la disponibilidad, sin tocar el stock que viene de Odoo.
  const guardarMuestra = async (product, piezas) => {
    const nuevas = Math.max(0, Math.floor(Number(piezas) || 0));
    try {
      await sb.patch("productos", product.id, { piezas_muestra: nuevas });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, piezas_muestra: nuevas } : p));
      showToast(nuevas > 0 ? `Muestra marcada: la web ahora muestra ${stockWeb({ ...product, piezas_muestra: nuevas })} disponibles` : "Muestra quitada: vuelve a contar como disponible");
    } catch(e) { alert("No se pudo guardar la muestra: " + (e.message || e)); }
  };

  // Sincronizar stock con Odoo (botón manual en Productos)
  const sincronizarOdoo = async () => {
    setSincronizando(true);
    try {
      const resp = await fetch(SUPABASE_URL + "/functions/v1/sync-odoo-stock", {
        method: "POST",
        headers: sb.functionHeaders(),
      });
      const data = await resp.json();
      if (data.ok) {
        showToast(`Stock actualizado: ${data.actualizados} producto(s)`);
        // Recargar productos para ver el stock nuevo
        const productosActualizados = await sb.get("productos", "?order=created_at.desc");
        setProducts(productosActualizados || []);
      } else {
        showToast("Error al sincronizar: " + (data.error || "desconocido"));
      }
    } catch(e) {
      showToast("Error al conectar con Odoo");
    }
    setSincronizando(false);
  };

  const handleDelete = async (product) => {
    if (!confirm(`¿Eliminar "${product.nombre}"?`)) return;
    try {
      await sb.delete("productos", product.id);
      setProducts(prev => prev.filter(p => p.id !== product.id));
      showToast("Producto eliminado");
    } catch(e) {
      const msg = String(e.message || e);
      if (msg.includes("foreign key") || msg.includes("violates") || msg.includes("23503")) {
        alert("No se puede eliminar: este producto está en uno o más pedidos. Mejor ocúltalo con 'Mostrar/Ocultar'.");
      } else {
        alert("Error eliminando producto: " + msg);
      }
    }
  };

  // ── CARGA MASIVA CSV ───────────────────────────────────────────
  const handleBulkUpload = async () => {
    const lines = bulkText.trim().split("\n").filter(l => l.trim());
    if (lines.length === 0) { alert("Pega al menos una línea."); return; }
    setBulkLoading(true);
    let ok = 0, err = 0;
    const newItems = [];
    for (let line of lines) {
      if (line.toLowerCase().startsWith("referencia")) continue;
      const cols = line.split(",").map(c => c.trim());
      const [referencia, nombre, descripcion, categoria_id, precio_pieza, precio_media_docena, precio_docena, badge, tallasCol, distCol, proveedorCol, ventaUnidadCol] = cols;
      if (!nombre || !precio_pieza) { err++; continue; }

      // Proveedor (opcional): se escribe el NOMBRE del proveedor tal cual está creado en la
      // pestaña Proveedores — si coincide, el producto queda vinculado a él automáticamente.
      let proveedor_id = null;
      if (proveedorCol) {
        const encontrado = proveedores.find(pv => pv.nombre.trim().toLowerCase() === proveedorCol.trim().toLowerCase());
        if (encontrado) proveedor_id = encontrado.id;
      }

      // Venta por unidad (opcional): S/SI/1 para activarlo — la tarjeta abre en "Pieza" por defecto
      const venta_por_unidad = ["s", "si", "sí", "1", "true"].includes((ventaUnidadCol || "").trim().toLowerCase());

      // Tallas + distribución por docena (opcionales) — dentro de la columna se separan con "|"
      // Ej: tallas="30|32|34|36|38"  distribucion="2|4|3|2|1"  →  1 docena trae 2 de la 30, 4 de la 32, etc.
      const tallasArr = (tallasCol || "").split("|").map(s => s.trim()).filter(Boolean);
      const cantidadesArr = (distCol || "").split("|").map(s => s.trim()).filter(Boolean);
      let tiene_tallas = false, tallas = "", distribucion_docena = "", distribucion_eje = "";
      if (tallasArr.length > 0) {
        tiene_tallas = true;
        tallas = tallasArr.join(", ");
        if (cantidadesArr.length === tallasArr.length) {
          const distObj = {};
          tallasArr.forEach((t, i) => { const q = Number(cantidadesArr[i]); if (q > 0) distObj[t] = q; });
          if (Object.keys(distObj).length > 0) { distribucion_docena = JSON.stringify(distObj); distribucion_eje = "talla"; }
        }
      }

      try {
        const saved = await sb.post("productos", {
          referencia: referencia || "", nombre, descripcion: descripcion || "",
          categoria_id: Number(categoria_id) || categories[0]?.id || 1,
          precio_pieza: Number(precio_pieza) || 0, precio_media_docena: Number(precio_media_docena) || 0,
          precio_docena: Number(precio_docena) || 0, badge: badge || "", activo: true, imagen_url: "",
          tiene_tallas, tallas, distribucion_docena, distribucion_eje, proveedor_id, venta_por_unidad,
        });
        newItems.push(saved[0]); ok++;
      } catch(e) { err++; }
    }
    setProducts(prev => [...prev, ...newItems]);
    setBulkLoading(false); setBulkText(""); setShowBulk(false);
    showToast(`${ok} producto(s) agregados${err > 0 ? `, ${err} con error` : ""}`);
  };

  // ── CARGA MASIVA CON IMÁGENES (crea borradores) ────────────────
  const handleBulkImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBulkImgLoading(true);
    setBulkImgProgress({ done: 0, total: files.length });
    const newItems = [];
    let ok = 0, err = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileComprimido = await comprimirImagen(file);
        const cleanName = fileComprimido.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${Date.now()}_${i}_${cleanName}`;
        await sb.upload("productos", path, fileComprimido);
        const url = `${sb.publicUrl("productos", path)}?t=${Date.now()}`;
        // Nombre por defecto desde el nombre del archivo ORIGINAL (sin extensión) — se usa
        // el nombre de antes de comprimir, para que la referencia (ej. "25004") no cambie
        const nombreArchivoSinExt = file.name.replace(/\.[^.]+$/, "");
        const baseName = nombreArchivoSinExt.replace(/[_\-]+/g, " ").trim();
        // Si subes fotos ya nombradas por Item No./SKU (ej. "25004.jpg"), lo usamos también
        // como referencia de una vez, para no tener que escribirla a mano después.
        const saved = await sb.post("productos", {
          referencia: nombreArchivoSinExt || "", nombre: baseName || "Producto sin nombre", descripcion: "",
          categoria_id: Number(bulkImgCat) || categories[0]?.id || 1,
          proveedor_id: bulkImgProveedorId, tiene_stock_fisico: bulkImgProveedorId ? bulkImgTieneStockFisico : false,
          precio_pieza: 0, precio_media_docena: 0, precio_docena: 0,
          badge: "", activo: false, imagen_url: url, // borrador (inactivo)
        });
        newItems.push(saved[0]); ok++;
      } catch(e2) { err++; console.error(e2); }
      setBulkImgProgress({ done: i + 1, total: files.length });
    }
    setProducts(prev => [...prev, ...newItems]);
    setBulkImgLoading(false);
    setShowBulkImg(false);
    e.target.value = "";
    showToast(`${ok} borrador(es) creados con imagen. Ahora edita sus datos.`);
    // Activa modo selección y filtra a los recién creados para editar
    setTab("products");
  };

  // ── EDICIÓN MASIVA ─────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAll = () => {
    // Respeta el filtro de categoría/búsqueda activo — "Seleccionar todos" selecciona
    // los productos que se están viendo ahora mismo, no el catálogo completo.
    const idsVisibles = productosFiltrados.map(p => p.id);
    const todosVisiblesSeleccionados = idsVisibles.length > 0 && idsVisibles.every(id => selectedIds.includes(id));
    if (todosVisiblesSeleccionados) setSelectedIds(prev => prev.filter(id => !idsVisibles.includes(id)));
    else setSelectedIds(prev => [...new Set([...prev, ...idsVisibles])]);
  };
  const handleBulkEdit = async () => {
    if (selectedIds.length === 0) { alert("Selecciona al menos un producto."); return; }
    // Solo aplica los campos que tienen valor (los vacíos no se tocan)
    const patch = {};
    if (bulkEdit.nombre !== "") patch.nombre = bulkEdit.nombre;
    if (bulkEdit.categoria_id !== "") patch.categoria_id = Number(bulkEdit.categoria_id);
    if (bulkEdit.precio_pieza !== "") patch.precio_pieza = Number(bulkEdit.precio_pieza);
    if (bulkEdit.precio_media_docena !== "") patch.precio_media_docena = Number(bulkEdit.precio_media_docena);
    if (bulkEdit.precio_docena !== "") patch.precio_docena = Number(bulkEdit.precio_docena);
    if (bulkEdit.badge !== "") patch.badge = bulkEdit.badge;
    if (bulkEdit.descripcion !== "") patch.descripcion = bulkEdit.descripcion;
    if (bulkEdit.activo !== "") patch.activo = bulkEdit.activo === "1";
    if (bulkEdit.destacado !== "") patch.destacado = bulkEdit.destacado === "1";
    // Tallas: si activa "Sí", guarda la lista; si activa "No", apaga y limpia
    if (bulkEdit.tiene_tallas === "1") { patch.tiene_tallas = true; if (bulkEdit.tallas.trim() !== "") patch.tallas = bulkEdit.tallas.trim(); }
    if (bulkEdit.tiene_tallas === "0") { patch.tiene_tallas = false; }
    // Colores: igual
    if (bulkEdit.tiene_colores === "1") { patch.tiene_colores = true; if (bulkEdit.colores.trim() !== "") patch.colores = bulkEdit.colores.trim(); }
    if (bulkEdit.tiene_colores === "0") { patch.tiene_colores = false; }
    // Distribución por docena: se aplica LA MISMA distribución a todos los seleccionados
    // (útil cuando son variantes del mismo modelo — ej. mismo tenis en distintos colores, misma corrida de tallas)
    if (bulkEdit.distribucion_docena && bulkEdit.distribucion_docena.trim() !== "") {
      patch.distribucion_docena = bulkEdit.distribucion_docena;
      patch.distribucion_eje = bulkEdit.distribucion_eje || "talla";
    }
    // Proveedor: "" = no tocar; "__ninguno__" = quitarlo (pasa a ser producto propio); si no, el id elegido
    if (bulkEdit.proveedor_id === "__ninguno__") { patch.proveedor_id = null; }
    else if (bulkEdit.proveedor_id !== "") { patch.proveedor_id = Number(bulkEdit.proveedor_id); }
    // Grupo Flex Pack: "" = no tocar; "__ninguno__" = quitarlo del Flex Pack; si no, el id elegido
    if (bulkEdit.flexpack_grupo_id === "__ninguno__") { patch.flexpack_grupo_id = null; }
    else if (bulkEdit.flexpack_grupo_id !== "") { patch.flexpack_grupo_id = Number(bulkEdit.flexpack_grupo_id); }
    // Tengo stock físico (solo aplica de verdad a productos con proveedor, pero no hace daño si se aplica a todos)
    if (bulkEdit.tiene_stock_fisico !== "") patch.tiene_stock_fisico = bulkEdit.tiene_stock_fisico === "1";
    if (Object.keys(patch).length === 0) { alert("Llena al menos un campo para aplicar."); return; }
    setBulkEditLoading(true);
    let ok = 0, err = 0;
    // SEGURIDAD: solo ids válidos y únicos de la selección
    const idsValidos = [...new Set(selectedIds.filter(id => id !== undefined && id !== null && id !== ""))];
    for (const id of idsValidos) {
      try {
        const updated = await sb.patch("productos", id, patch);
        // Verifica que solo se actualizó 1 fila y que es la correcta
        if (Array.isArray(updated) && updated.length === 1 && updated[0].id === id) {
          setProducts(prev => prev.map(p => p.id === id ? updated[0] : p));
          ok++;
        } else {
          err++;
        }
      } catch(e) { err++; }
    }
    setBulkEditLoading(false);
    setShowBulkEdit(false);
    setBulkEdit(emptyBulkEdit);
    setSelectedIds([]);
    setSelectMode(false);
    showToast(`${ok} producto(s) editados${err > 0 ? `, ${err} con error` : ""}`);
  };

  // ── ELIMINACIÓN MASIVA (con confirmación) ──────────────────────
  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    let ok = 0, err = 0;
    const deletedIds = [];
    for (const id of selectedIds) {
      try {
        await sb.delete("productos", id);
        deletedIds.push(id);
        ok++;
      } catch(e) { err++; }
    }
    setProducts(prev => prev.filter(p => !deletedIds.includes(p.id)));
    setBulkDeleteLoading(false);
    setShowBulkDelete(false);
    setSelectedIds([]);
    setSelectMode(false);
    if (err > 0) {
      showToast(`${ok} eliminados. ${err} no se pudieron borrar (están en pedidos).`);
    } else {
      showToast(`${ok} producto(s) eliminados`);
    }
  };

  // ── CATEGORÍAS ─────────────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const saved = await sb.post("categorias", { nombre: newCatName.trim(), activa: true });
      setCategories(prev => [...prev, saved[0]]);
      setNewCatName("");
      showToast("Categoría agregada");
    } catch(e) { alert("Error agregando categoría: " + e.message); }
  };

  const handleDeleteCategory = async (cat) => {
    const inUse = products.filter(p => p.categoria_id === cat.id).length;
    if (inUse > 0) { alert(`No puedes eliminar "${cat.nombre}" porque tiene ${inUse} producto(s).`); return; }
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return;
    try {
      await sb.delete("categorias", cat.id);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      showToast("Categoría eliminada");
    } catch(e) { alert("Error: " + e.message); }
  };

  // Asigna (o quita) el grupo general de una categoría — ej. pone "Ropa de Dama" como
  // grupo de las categorías Jeans Dama / Polo Dama / Enterizo Dama, para que en la web
  // se muestren agrupadas y el cliente las vea en dos pasos (grupo → categoría exacta).
  // Si el nombre de grupo no existe todavía, lo crea de una vez.
  const handleUpdateCategoriaGrupo = async (cat, nombreGrupoNuevo) => {
    const nombre = nombreGrupoNuevo.trim();
    try {
      let grupoId = null;
      if (nombre) {
        const existente = gruposCategorias.find(g => g.nombre.toLowerCase() === nombre.toLowerCase());
        if (existente) {
          grupoId = existente.id;
        } else {
          const maxOrden = gruposCategorias.reduce((max, g) => Math.max(max, g.orden || 0), -1);
          const creado = await sb.post("grupos_categorias", { nombre, orden: maxOrden + 1 });
          const nuevoGrupo = creado[0];
          setGruposCategorias(prev => [...prev, nuevoGrupo]);
          grupoId = nuevoGrupo.id;
        }
      }
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, grupo_id: grupoId } : c));
      await sb.patch("categorias", cat.id, { grupo_id: grupoId });
    } catch(e) {
      showToast("No se pudo guardar el grupo: " + e.message);
    }
  };

  // Cambia el ícono propio de un grupo (independiente del ícono de sus categorías)
  const [grupoUploading, setGrupoUploading] = useState(null);
  const grupoFileRef = useRef(null);
  const handleGrupoIconUpload = async (e, grupo) => {
    const file = e.target.files[0];
    if (!file) return;
    setGrupoUploading(grupo.id);
    try {
      const fileComprimido = await comprimirImagen(file, 400, 0.85);
      const cleanName = fileComprimido.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `grupo_${Date.now()}_${cleanName}`;
      await sb.upload("categorias", path, fileComprimido);
      const url = `${sb.publicUrl("categorias", path)}?t=${Date.now()}`;
      await sb.patch("grupos_categorias", grupo.id, { icono_url: url });
      setGruposCategorias(prev => prev.map(g => g.id === grupo.id ? { ...g, icono_url: url } : g));
      showToast("Ícono del grupo actualizado");
    } catch(err) {
      alert("Error subiendo ícono: " + err.message);
    }
    setGrupoUploading(null);
  };

  // Mueve un grupo un puesto arriba o abajo en el orden que ve el cliente — intercambia
  // su "orden" con el del grupo vecino (así el número que reciba nunca se repite con nadie).
  const handleMoveGrupo = async (grupo, direccion) => {
    const ordenados = [...gruposCategorias].sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre));
    const idx = ordenados.findIndex(g => g.id === grupo.id);
    const idxVecino = direccion === "arriba" ? idx - 1 : idx + 1;
    if (idxVecino < 0 || idxVecino >= ordenados.length) return; // ya está en la punta, no hace nada
    const vecino = ordenados[idxVecino];

    // Intercambia los valores de orden entre los dos, y refleja el cambio de inmediato en pantalla
    setGruposCategorias(prev => prev.map(g => {
      if (g.id === grupo.id) return { ...g, orden: vecino.orden };
      if (g.id === vecino.id) return { ...g, orden: grupo.orden };
      return g;
    }));
    try {
      await Promise.all([
        sb.patch("grupos_categorias", grupo.id, { orden: vecino.orden }),
        sb.patch("grupos_categorias", vecino.id, { orden: grupo.orden }),
      ]);
    } catch(e) {
      showToast("No se pudo guardar el nuevo orden: " + e.message);
    }
  };

  // Mismo patrón que handleMoveGrupo, pero para CATEGORÍAS individuales -- este
  // orden es el que usa "Destacados" en la web para decidir qué categoría se ve
  // primero (ej. Jeans Hombre, luego Perfumería, etc).
  const handleMoveCategoria = async (cat, direccion) => {
    const ordenadas = [...categories].sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre));
    const idx = ordenadas.findIndex(c => c.id === cat.id);
    const idxVecina = direccion === "arriba" ? idx - 1 : idx + 1;
    if (idxVecina < 0 || idxVecina >= ordenadas.length) return;

    // En vez de solo intercambiar el valor de "orden" entre las dos (lo cual no
    // cambia nada si ambas empezaron con el mismo valor, ej. 0 -- que es
    // justo lo que pasaba la primera vez que se usa esto), se reordena la
    // lista completa y se le asigna un número único y consecutivo a cada una.
    const reordenadas = [...ordenadas];
    const [movida] = reordenadas.splice(idx, 1);
    reordenadas.splice(idxVecina, 0, movida);
    const actualizaciones = reordenadas.map((c, i) => ({ id: c.id, orden: i }));

    setCategories(prev => prev.map(c => {
      const act = actualizaciones.find(a => a.id === c.id);
      return act ? { ...c, orden: act.orden } : c;
    }));
    try {
      await Promise.all(actualizaciones.map(a => sb.patch("categorias", a.id, { orden: a.orden })));
    } catch(e) {
      showToast("No se pudo guardar el nuevo orden: " + e.message);
    }
  };

  // ── BANNERS PROMOCIONALES (carrusel del inicio) ─────────────────
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerNuevoFileRef = useRef(null);
  const bannerReemplazoFileRef = useRef(null);

  const handleBannerNuevo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const fileComprimido = file; // se sube tal cual, sin comprimir -- así se mantiene la calidad original que subiste
      const cleanName = fileComprimido.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}_${cleanName}`;
      await sb.upload("banners", path, fileComprimido);
      const url = `${sb.publicUrl("banners", path)}?t=${Date.now()}`;
      const maxOrden = banners.reduce((max, b) => Math.max(max, b.orden || 0), -1);
      const creado = await sb.post("banners_promocionales", {
        imagen_url: url, destino_tipo: "catalogo", activo: true, orden: maxOrden + 1,
      });
      setBanners(prev => [...prev, creado[0]]);
      showToast("Banner agregado");
    } catch(err) {
      alert("Error subiendo el banner: " + err.message);
    }
    setBannerUploading(false);
  };

  const handleBannerReemplazarImagen = async (e, banner) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const fileComprimido = file; // se sube tal cual, sin comprimir -- así se mantiene la calidad original que subiste
      const cleanName = fileComprimido.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}_${cleanName}`;
      await sb.upload("banners", path, fileComprimido);
      const url = `${sb.publicUrl("banners", path)}?t=${Date.now()}`;
      await sb.patch("banners_promocionales", banner.id, { imagen_url: url });
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, imagen_url: url } : b));
      showToast("Imagen actualizada");
    } catch(err) {
      alert("Error subiendo la imagen: " + err.message);
    }
    setBannerUploading(false);
  };

  const handleUpdateBanner = async (banner, cambios) => {
    setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, ...cambios } : b));
    try {
      await sb.patch("banners_promocionales", banner.id, cambios);
    } catch(e) {
      showToast("No se pudo guardar: " + e.message);
    }
  };

  const handleDeleteBanner = async (banner) => {
    if (!confirm("¿Eliminar este banner del carrusel?")) return;
    try {
      await sb.delete("banners_promocionales", banner.id);
      setBanners(prev => prev.filter(b => b.id !== banner.id));
      showToast("Banner eliminado");
    } catch(e) { alert("Error: " + e.message); }
  };

  const handleMoveBanner = async (banner, direccion) => {
    const ordenados = [...banners].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const idx = ordenados.findIndex(b => b.id === banner.id);
    const idxVecino = direccion === "arriba" ? idx - 1 : idx + 1;
    if (idxVecino < 0 || idxVecino >= ordenados.length) return;
    const vecino = ordenados[idxVecino];
    setBanners(prev => prev.map(b => {
      if (b.id === banner.id) return { ...b, orden: vecino.orden };
      if (b.id === vecino.id) return { ...b, orden: banner.orden };
      return b;
    }));
    try {
      await Promise.all([
        sb.patch("banners_promocionales", banner.id, { orden: vecino.orden }),
        sb.patch("banners_promocionales", vecino.id, { orden: banner.orden }),
      ]);
    } catch(e) {
      showToast("No se pudo guardar el nuevo orden: " + e.message);
    }
  };

  // ── POP-UPS PROMOCIONALES (descuentos, eventos, anuncios) ───────
  const [popupUploading, setPopupUploading] = useState(false);
  const popupNuevoFileRef = useRef(null);
  const popupReemplazoFileRef = useRef(null);

  const handlePopupNuevo = async () => {
    try {
      const maxOrden = popups.reduce((max, p) => Math.max(max, p.orden || 0), -1);
      const creado = await sb.post("popups_promocionales", {
        titulo: "Nuevo anuncio", destino_tipo: null, activo: false, orden: maxOrden + 1, texto_boton: "Ver más",
      });
      setPopups(prev => [...prev, creado[0]]);
      showToast("Pop-up creado — complétalo y actívalo cuando esté listo");
    } catch(err) {
      alert("Error creando el pop-up: " + err.message);
    }
  };

  const handlePopupImagen = async (e, popup) => {
    const file = e.target.files[0];
    if (!file) return;
    setPopupUploading(true);
    try {
      const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `popup_${Date.now()}_${cleanName}`;
      await sb.upload("banners", path, file); // reutiliza el mismo bucket que los banners
      const url = `${sb.publicUrl("banners", path)}?t=${Date.now()}`;
      await sb.patch("popups_promocionales", popup.id, { imagen_url: url });
      setPopups(prev => prev.map(p => p.id === popup.id ? { ...p, imagen_url: url } : p));
      showToast("Imagen actualizada");
    } catch(err) {
      alert("Error subiendo la imagen: " + err.message);
    }
    setPopupUploading(false);
  };

  const handleQuitarImagenPopup = async (popup) => {
    setPopups(prev => prev.map(p => p.id === popup.id ? { ...p, imagen_url: null } : p));
    try { await sb.patch("popups_promocionales", popup.id, { imagen_url: null }); } catch(e) { showToast("No se pudo quitar: " + e.message); }
  };

  const handleUpdatePopup = async (popup, cambios) => {
    setPopups(prev => prev.map(p => p.id === popup.id ? { ...p, ...cambios } : p));
    try {
      await sb.patch("popups_promocionales", popup.id, cambios);
    } catch(e) {
      showToast("No se pudo guardar: " + e.message);
    }
  };

  const handleDeletePopup = async (popup) => {
    if (!confirm(`¿Eliminar el pop-up "${popup.titulo}"?`)) return;
    try {
      await sb.delete("popups_promocionales", popup.id);
      setPopups(prev => prev.filter(p => p.id !== popup.id));
      showToast("Pop-up eliminado");
    } catch(e) { alert("Error: " + e.message); }
  };

  const handleMovePopup = async (popup, direccion) => {
    const ordenados = [...popups].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const idx = ordenados.findIndex(p => p.id === popup.id);
    const idxVecino = direccion === "arriba" ? idx - 1 : idx + 1;
    if (idxVecino < 0 || idxVecino >= ordenados.length) return;
    const vecino = ordenados[idxVecino];
    setPopups(prev => prev.map(p => {
      if (p.id === popup.id) return { ...p, orden: vecino.orden };
      if (p.id === vecino.id) return { ...p, orden: popup.orden };
      return p;
    }));
    try {
      await Promise.all([
        sb.patch("popups_promocionales", popup.id, { orden: vecino.orden }),
        sb.patch("popups_promocionales", vecino.id, { orden: popup.orden }),
      ]);
    } catch(e) {
      showToast("No se pudo guardar el nuevo orden: " + e.message);
    }
  };

  // ── EMPRESAS DE ENVÍO ──────────────────────────────────────────
  const [newEmpresa, setNewEmpresa] = useState("");
  const [empUploading, setEmpUploading] = useState(null);
  const [sucForm, setSucForm] = useState({}); // { [empresaId]: { nombre, direccion, telefono } }
  const empLogoRef = useRef(null);

  const handleAddEmpresa = async () => {
    if (!newEmpresa.trim()) return;
    try {
      const saved = await sb.post("empresas_envio", { nombre: newEmpresa.trim(), activa: true });
      setEmpresas(prev => [...prev, saved[0]]);
      setNewEmpresa("");
      showToast("Empresa agregada");
    } catch(e) { alert("Error: " + e.message); }
  };

  const handleDeleteEmpresa = async (emp) => {
    if (!confirm(`¿Eliminar "${emp.nombre}" y todas sus sucursales?`)) return;
    try {
      await sb.delete("empresas_envio", emp.id);
      setEmpresas(prev => prev.filter(e => e.id !== emp.id));
      setSucursales(prev => prev.filter(s => s.empresa_id !== emp.id));
      showToast("Empresa eliminada");
    } catch(e) { alert("Error: " + e.message); }
  };

  const handleEmpLogoUpload = async (e, emp) => {
    const file = e.target.files[0];
    if (!file) return;
    setEmpUploading(emp.id);
    try {
      const fileComprimido = await comprimirImagen(file, 400, 0.85);
      const cleanName = fileComprimido.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}_${cleanName}`;
      await sb.upload("empresas", path, fileComprimido);
      const url = `${sb.publicUrl("empresas", path)}?t=${Date.now()}`;
      await sb.patch("empresas_envio", emp.id, { logo_url: url });
      setEmpresas(prev => prev.map(x => x.id === emp.id ? { ...x, logo_url: url } : x));
      showToast("Logo actualizado");
    } catch(err) {
      alert("Error subiendo logo: " + err.message + "\n\nVerifica que el bucket 'empresas' exista y sea público.");
    }
    setEmpUploading(null);
  };

  const handleAddSucursal = async (empId) => {
    const form = sucForm[empId] || {};
    if (!form.nombre?.trim()) { alert("Escribe el nombre de la sucursal."); return; }
    try {
      const saved = await sb.post("sucursales", { empresa_id: empId, nombre: form.nombre.trim(), direccion: form.direccion || "", telefono: form.telefono || "", costo_envio: Number(form.costo_envio) || 0, activa: true });
      setSucursales(prev => [...prev, saved[0]]);
      setSucForm(prev => ({ ...prev, [empId]: { nombre: "", direccion: "", telefono: "", costo_envio: "" } }));
      showToast("Sucursal agregada");
    } catch(e) { alert("Error: " + e.message); }
  };

  // Cambia el costo de envío de una sucursal YA existente (se guarda apenas se sale del campo)
  const handleCambiarCostoSucursal = async (suc, nuevoCosto) => {
    const valor = Number(nuevoCosto) || 0;
    setSucursales(prev => prev.map(s => s.id === suc.id ? { ...s, costo_envio: valor } : s));
    try { await sb.patch("sucursales", suc.id, { costo_envio: valor }); }
    catch(e) { showToast("No se pudo guardar el costo: " + e.message); }
  };

  const handleDeleteSucursal = async (suc) => {
    if (!confirm(`¿Eliminar la sucursal "${suc.nombre}"?`)) return;
    try {
      await sb.delete("sucursales", suc.id);
      setSucursales(prev => prev.filter(s => s.id !== suc.id));
      showToast("Sucursal eliminada");
    } catch(e) { alert("Error: " + e.message); }
  };

  // Lista de productos según la categoría elegida y, si hay texto escrito, filtrada
  // además por referencia (o nombre, por si acaso) — usada en la sección Productos.
  const productosPorCategoria = filtroCategoria === "todas" ? products : products.filter(p => p.categoria_id === filtroCategoria);
  const busquedaProductoQ = busquedaProducto.trim().toLowerCase();
  const productosFiltrados = busquedaProductoQ
    ? productosPorCategoria.filter(p => (p.referencia || "").toLowerCase().includes(busquedaProductoQ) || (p.nombre || "").toLowerCase().includes(busquedaProductoQ))
    : productosPorCategoria;

  // Ventas e ingresos generados por cada proveedor externo (todo el historial, no solo el rango
  // de fechas del dashboard) — recorre todos los pedidos reales y agrupa por proveedor del producto.
  // Genera el reporte de ventas del rango de fechas elegido: agrupa por producto,
  // sumando cantidad vendida e ingreso, ordenado de mayor a menor ingreso.
  const generarReporteVentas = () => {
    const desde = new Date(reporteDesde + "T00:00:00");
    const hasta = new Date(reporteHasta + "T23:59:59");
    if (desde > hasta) { alert("La fecha 'Desde' no puede ser después de 'Hasta'."); return; }

    const pedidosEnRango = pedidosRealesTodos.filter(o => {
      const f = new Date(o.created_at);
      return f >= desde && f <= hasta;
    });

    const mapa = {};
    pedidosEnRango.forEach(o => {
      (o.items || []).forEach(it => {
        const prod = products.find(p => p.id === it.producto_id);
        const clave = it.producto_id || `sin-id-${it.nombre_producto}`;
        if (!mapa[clave]) {
          mapa[clave] = { referencia: prod?.referencia || "—", nombre: it.nombre_producto || prod?.nombre || "Producto", cantidad: 0, ingreso: 0 };
        }
        mapa[clave].cantidad += Number(it.cantidad) || 0;
        mapa[clave].ingreso += Number(it.subtotal) || 0;
      });
    });

    const filas = Object.values(mapa).sort((a, b) => b.ingreso - a.ingreso);
    setReporteFilas({
      filas,
      pedidos: pedidosEnRango.length,
      totalUnidades: filas.reduce((s, f) => s + f.cantidad, 0),
      totalIngreso: filas.reduce((s, f) => s + f.ingreso, 0),
    });

    // Desglose por vendedor/administrador -- para pagar comisiones. Solo cuenta
    // pedidos con creado_por_usuario_id guardado (desde que se activó ese
    // seguimiento); lo que hizo el cliente solo desde la web no se le atribuye a nadie.
    const mapaOperador = {};
    pedidosEnRango.forEach(o => {
      if (!o.creado_por_usuario_id) return;
      if (!mapaOperador[o.creado_por_usuario_id]) {
        const persona = users.find(u => u.id === o.creado_por_usuario_id);
        mapaOperador[o.creado_por_usuario_id] = { id: o.creado_por_usuario_id, nombre: persona?.nombre || "—", ventas: 0, monto: 0 };
      }
      mapaOperador[o.creado_por_usuario_id].ventas += 1;
      mapaOperador[o.creado_por_usuario_id].monto += Number(o.total) || 0;
    });
    const filasOperador = Object.values(mapaOperador)
      .map(f => ({ ...f, comision: f.monto * (comisionPctReporte / 100) }))
      .sort((a, b) => b.monto - a.monto);
    setReportePorOperador({ filas: filasOperador, totalMonto: filasOperador.reduce((s, f) => s + f.monto, 0), totalComision: filasOperador.reduce((s, f) => s + f.comision, 0) });
  };

  // Arma y descarga un CSV con el desglose por vendedor/administrador -- fácil de
  // abrir en Excel para pagar comisiones.
  const descargarReporteOperadorCSV = () => {
    if (!reportePorOperador || reportePorOperador.filas.length === 0) return;
    const filasCSV = [
      ["Vendedor/Administrador", "Ventas", "Monto vendido", `Comisión (${comisionPctReporte}%)`],
      ...reportePorOperador.filas.map(f => [f.nombre, f.ventas, f.monto.toFixed(2), f.comision.toFixed(2)]),
      ["TOTAL", reportePorOperador.filas.reduce((s, f) => s + f.ventas, 0), reportePorOperador.totalMonto.toFixed(2), reportePorOperador.totalComision.toFixed(2)],
    ];
    const csv = filasCSV.map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Ventas_por_vendedor_${reporteDesde}_a_${reporteHasta}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reporteVentasRef = useRef(null);
  const descargarReporteVentasPDF = async () => {
    if (!(await asegurarLibsPdf())) return;
    setReporteBusy(true);
    try {
      const source = reporteVentasRef.current;
      const clone = source.cloneNode(true);
      const holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      holder.style.top = "0";
      holder.style.width = "700px";
      holder.style.background = "#ffffff";
      clone.style.width = "700px";
      clone.style.maxWidth = "700px";
      holder.appendChild(clone);
      document.body.appendChild(holder);
      let canvas;
      try {
        canvas = await window.html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", useCORS: true, width: 700, windowWidth: 700 });
      } finally {
        document.body.removeChild(holder);
      }
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      agregarCanvasComoPaginasPdf(pdf, canvas);
      pdf.save(`reporte-ventas-${reporteDesde}-a-${reporteHasta}.pdf`);
    } catch(e) { alert("Error generando PDF: " + e.message); }
    setReporteBusy(false);
  };

  const reportePorOperadorRef = useRef(null);
  const descargarReporteOperadorPDF = async () => {
    if (!(await asegurarLibsPdf())) return;
    setReporteOperadorBusy(true);
    try {
      const source = reportePorOperadorRef.current;
      const clone = source.cloneNode(true);
      const holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      holder.style.top = "0";
      holder.style.width = "700px";
      holder.style.background = "#ffffff";
      clone.style.width = "700px";
      clone.style.maxWidth = "700px";
      holder.appendChild(clone);
      document.body.appendChild(holder);
      let canvas;
      try {
        canvas = await window.html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", useCORS: true, width: 700, windowWidth: 700 });
      } finally {
        document.body.removeChild(holder);
      }
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      agregarCanvasComoPaginasPdf(pdf, canvas);
      pdf.save(`ventas-por-vendedor-${reporteDesde}-a-${reporteHasta}.pdf`);
    } catch(e) { alert("Error generando PDF: " + e.message); }
    setReporteOperadorBusy(false);
  };

  const ventasPorProveedor = (() => {
    const mapa = {};
    proveedores.forEach(pv => { mapa[pv.id] = { proveedor: pv, ingreso: 0, unidades: 0, pedidos: new Set() }; });
    pedidosRealesTodos.forEach(o => {
      (o.items || []).forEach(it => {
        const prod = products.find(p => p.id === it.producto_id);
        if (prod?.proveedor_id && mapa[prod.proveedor_id]) {
          mapa[prod.proveedor_id].ingreso += Number(it.subtotal) || 0;
          mapa[prod.proveedor_id].unidades += Number(it.cantidad) || 0;
          mapa[prod.proveedor_id].pedidos.add(o.id);
        }
      });
    });
    return Object.values(mapa)
      .map(v => ({ ...v, pedidos: v.pedidos.size }))
      .sort((a, b) => b.ingreso - a.ingreso);
  })();

  // Estimado por compras en Odoo: si un mismo producto se compra a varios proveedores, sus ventas se reparten
  // según las piezas compradas a cada uno (ej. 600 piezas a A y 400 a B → 60% / 40%).
  const estimadoPorCompras = (() => {
    if (!repartoProv || !Array.isArray(repartoProv.reparto)) return null;
    const porProd = {};
    repartoProv.reparto.forEach(x => { (porProd[x.producto_id] = porProd[x.producto_id] || []).push(x); });
    const mapa = {};
    const get = (id) => (mapa[id] = mapa[id] || { ingreso: 0, unidades: 0, productos: new Set(), compartidos: new Set() });
    pedidosRealesTodos.forEach(o => {
      (o.items || []).forEach(it => {
        const filas = porProd[it.producto_id];
        if (!filas) return;
        filas.forEach(f => {
          const m = get(f.proveedor_id), pct = Number(f.pct) || 0;
          m.ingreso += (Number(it.subtotal) || 0) * pct;
          m.unidades += (Number(it.cantidad) || 0) * pct;
          m.productos.add(it.producto_id);
          if (filas.length > 1) m.compartidos.add(it.producto_id);
        });
      });
    });
    const comp = {};
    (repartoProv.por_proveedor || []).forEach(x => { comp[x.proveedor_id] = x; });
    return { mapa, comp };
  })();

  const tabs = esOperador ? [
    ["dashboard", "Inicio", BarChart3],
    ["orders", "Pedidos", Package],
    ["crear", "Crear", FilePlus],
    ["precios", "Precios", DollarSign],
    ["retornos", "Retornos", RefreshCw],
    ["users", "Clientes", Users],
  ] : [
    ["dashboard", "Dashboard", BarChart3],
    ["analytics", "Analítica Web", Eye],
    ["metricas", "Métricas", Wallet],
    ["finanzas", "Finanzas", Receipt],
    ["orders", "Pedidos", Package],
    ["crear", "Crear", FilePlus],
    ["fraude", "Fraude", Lock],
    ["products", "Productos", Tag],
    ["precios", "Precios", DollarSign],
    ["categories", "Categorías", FolderOpen],
    ["banners", "Banners Inicio", ImageIcon],
    ["popups", "Pop-ups", Sparkles],
    ["descuentos", "Descuentos", Zap],
    ["ofertas", "Ofertas y Combos", Tag],
    ["retornos", "Retornos", RefreshCw],
    ["analisis", "Análisis Stock", TrendingUp],
    ["proveedores", "Proveedores", Building2],
    ["flexpack", "Flex Pack", Boxes],
    ["retirolocal", "Retiro en Local", Home],
    ["reporteventas", "Reporte de Ventas", FileText],
    ["shipping", "Envíos", Truck],
    ["etiquetas", "Crear Etiqueta", Printer],
    ["users", "Clientes", Users],
    ["equipo", "Equipo", Lock],
    ["pixeles", "Píxeles", Zap],
    ["analisisads", "Análisis Ads", Target],
  ];

  const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="oft-admin-sidebar" style={{ background: WHITE, color: BLACK, width: 230, height: "100vh", padding: "24px 0 0", position: "fixed", top: 0, left: 0, zIndex: 90, borderRight: `1px solid ${GRAY2}`, display: "flex", flexDirection: "column" }}>
        <div className="oft-admin-brand" style={{ padding: "0 22px 22px", borderBottom: `1px solid ${GRAY2}`, flexShrink: 0 }}><Logo height={28} /><div style={{ fontSize: 11, color: GRAY3, marginTop: 6, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}><Zap size={11} /> Panel Administrador</div></div>
        <div className="oft-admin-tabs" style={{ padding: "16px 12px 24px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {tabs.map(([k,l,Icon]) => (
            <div key={k} className={"oft-admin-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)} style={{ padding: "11px 16px", marginBottom: 4, cursor: "pointer", fontWeight: tab === k ? 800 : 600, fontSize: 14, color: tab === k ? WHITE : GRAY3, background: tab === k ? RED : "transparent", borderRadius: 10, display: "flex", alignItems: "center", gap: 11, transition: "all 0.18s ease" }}>
              <Icon size={18} strokeWidth={tab === k ? 2.4 : 2} /> {l}
              {k === "fraude" && fraudePend > 0 && <span style={{ marginLeft: "auto", background: tab === k ? WHITE : RED, color: tab === k ? RED : WHITE, borderRadius: 20, fontSize: 11, fontWeight: 900, padding: "1px 8px" }}>{fraudePend}</span>}
            </div>
          ))}
          {/* Separador solo visible en escritorio */}
          <div className="oft-admin-divider" style={{ borderTop: `1px solid ${GRAY2}`, margin: "8px 4px" }} />
          {/* Ver tienda — dentro de tabs para que salga en móvil también */}
          <div onClick={() => setView("home")} className="oft-admin-tab" style={{ padding: "11px 16px", marginBottom: 4, cursor: "pointer", fontWeight: 600, fontSize: 14, color: GRAY3, background: "transparent", borderRadius: 10, display: "flex", alignItems: "center", gap: 11, transition: "all 0.18s ease" }}>
            <Home size={18} strokeWidth={2} /> <span className="oft-admin-tab-label">Ver tienda</span>
          </div>
          {/* Seguridad (2FA) — cualquier miembro del equipo gestiona la suya, sin importar el rol */}
          <div onClick={() => setMfaModal(true)} className="oft-admin-tab" style={{ padding: "11px 16px", marginBottom: 4, cursor: "pointer", fontWeight: 600, fontSize: 14, color: GRAY3, background: "transparent", borderRadius: 10, display: "flex", alignItems: "center", gap: 11, transition: "all 0.18s ease" }}>
            <Lock size={18} strokeWidth={2} /> <span className="oft-admin-tab-label">Seguridad</span>
          </div>
          {/* Cerrar sesión — dentro de tabs para que salga en móvil también */}
          <div onClick={() => { setUser(null); setView("home"); }} className="oft-admin-tab" style={{ padding: "11px 16px", marginBottom: 4, cursor: "pointer", fontWeight: 700, fontSize: 14, color: RED, background: "transparent", borderRadius: 10, display: "flex", alignItems: "center", gap: 11, transition: "all 0.18s ease" }}>
            <LogOut size={18} strokeWidth={2} /> <span className="oft-admin-tab-label">Salir</span>
          </div>
        </div>
      </div>

      <div className="oft-admin-main" style={{ marginLeft: 230, padding: "32px", minHeight: "100vh", background: GRAY, boxSizing: "border-box", overflowX: "hidden" }}>
       <div key={tab} className="oft-tab-anim" style={{ minWidth: 0 }}>

        {/* ═══════════ CREAR PEDIDO ═══════════ */}
        {tab === "crear" && (
          <CrearPedidoView onCreado={(nuevo) => setOrders(prev => [{ ...nuevo, items: nuevo.items || [] }, ...prev])} />
        )}

        {/* ═══════════ DASHBOARD ═══════════ */}
        {tab === "dashboard" && (
          <>
            {esAdminCompleto ? (
            <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><BarChart3 size={24} color={RED} /> Dashboard</div>
            {loadingData ? <Spinner /> : (
              <>
                {/* FILTRO POR PERIODO (compartido con Métricas) */}
                {renderFiltroPeriodo()}

                {/* TARJETAS DE MÉTRICAS */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 20 }}>
                  {[
                    ["Ingresos totales", ingresoTotal, money, 2, true, DollarSign, RED],
                    ["Órdenes totales", ordenesTotal, null, 0, true, ShoppingBag, "#004085"],
                    ["Clientes", clientesTotal, null, 0, true, Users, "#155724"],
                    ["Clientes que regresan", Math.round(returningRate), (n) => n + "%", 0, false, RefreshCw, "#6f42c1"],
                    ["Mi balance", balance, money, 2, true, Wallet, "#856404"],
                  ].map(([label, val, fmtNum, dec, conDelta, Icon, color], i) => (
                    <div key={label} className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}`, transition: "transform 0.2s, box-shadow 0.2s", animationDelay: `${i * 0.07}s` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 13, color: GRAY3, marginBottom: 6 }}>{label}</div>
                          <div style={{ fontSize: 26, fontWeight: 900, color }}><CifraViva valor={val} formato={fmtNum} decimales={dec} mostrarDelta={conDelta} contexto={`${rangoVentas}|${fechaPersonalizada}|${rangoInicio}|${rangoFin}`} /></div>
                        </div>
                        <div style={{ background: color + "15", borderRadius: 10, padding: 10 }}>
                          <Icon size={22} color={color} strokeWidth={2} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* VENTAS POR MÉTODO DE PAGO */}
                {(() => {
                  const ctx = `${rangoVentas}|${fechaPersonalizada}|${rangoInicio}|${rangoFin}`;
                  const filas = [...Object.entries(METODOS_PAGO).map(([k, m]) => ({ k, label: m.label, color: m.color, bg: m.bg, lista: pedidosReales.filter(o => o.metodo_pago === k) })),
                    { k: "sin", label: "Sin registrar", color: "#777", bg: "#F1F1F1", lista: pedidosReales.filter(o => !METODOS_PAGO[o.metodo_pago]) }]
                    .filter(f => f.k !== "sin" || f.lista.length > 0)
                    .map(f => ({ ...f, total: f.lista.reduce((a, o) => a + Number(o.total || 0), 0) }));
                  const suma = filas.reduce((a, f) => a + f.total, 0) || 1;
                  return (
                    <div className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}`, marginBottom: 20 }}>
                      <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}><CreditCard size={18} color={RED} /> Ventas por método de pago</div>
                      <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14 }}>Cuánto se cobró por cada medio en el periodo</div>
                      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: GRAY, marginBottom: 14 }}>
                        {filas.map(f => f.total > 0 && <div key={f.k} title={`${f.label}: ${money(f.total)}`} style={{ width: `${(f.total / suma) * 100}%`, background: f.color, transition: "width 0.6s ease" }} />)}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                        {filas.map(f => (
                          <div key={f.k} onClick={() => { setFiltroMetodo(f.k); setTab("orders"); }} title="Ver estos pedidos" style={{ cursor: "pointer", background: f.bg, borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: f.color }}>{f.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: f.color, marginTop: 2 }}><CifraViva valor={f.total} formato={money} decimales={2} contexto={ctx} /></div>
                            <div style={{ fontSize: 12, color: GRAY3 }}><CifraViva valor={f.lista.length} decimales={0} mostrarDelta={false} contexto={ctx} /> pedido{f.lista.length === 1 ? "" : "s"} · {Math.round((f.total / suma) * 100)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* VENTAS DE TIENDA FÍSICA (punto de venta de Odoo) */}
                <TiendaFisicaPanel envolver desde={rangoTiendaISO[0]} hasta={rangoTiendaISO[1]} ventasWeb={ingresoTotal} />

                {/* WIDGET: AOV OVER TIME + MINI-TABLA DE VENTAS */}
                <div className="oft-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 28 }}>
                  {/* AVERAGE ORDER VALUE OVER TIME */}
                  <div className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}`, transition: "transform 0.2s, box-shadow 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={18} color={RED} /> Valor promedio por orden</div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: RED }}><CifraViva valor={aovActual} formato={money} decimales={2} mostrarDelta={false} contexto={`${rangoVentas}|${fechaPersonalizada}|${rangoInicio}|${rangoFin}`} /></div>
                        <div style={{ fontSize: 11, color: GRAY3 }}>promedio actual</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14 }}>Evolución del ticket promedio</div>
                    {aovPorFecha.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>Aún no hay datos</div>
                    ) : (
                      <svg viewBox="0 0 320 120" style={{ width: "100%", height: 120, overflow: "visible" }}>
                        {(() => {
                          const w = 320, h = 100, pad = 6;
                          const pts = aovPorFecha.map((d, i) => {
                            const x = pad + (i * (w - 2 * pad)) / Math.max(aovPorFecha.length - 1, 1);
                            const y = h - (d.aov / maxAov) * (h - 20) - 6;
                            return [x, y];
                          });
                          const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
                          const area = path + ` L ${pts[pts.length-1][0].toFixed(1)} ${h} L ${pts[0][0].toFixed(1)} ${h} Z`;
                          return (
                            <>
                              <defs>
                                <linearGradient id="aovGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={RED} stopOpacity="0.28" />
                                  <stop offset="100%" stopColor={RED} stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path d={area} fill="url(#aovGrad)" />
                              <path className="oft-line-draw" d={path} fill="none" stroke={RED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              {pts.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p[0]} cy={p[1]} r="3.5" fill={WHITE} stroke={RED} strokeWidth="2" />
                                  <text x={p[0]} y={h + 14} textAnchor="middle" fontSize="9" fill={GRAY3}>{aovPorFecha[i].fecha}</text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    )}
                  </div>

                  {/* MINI-TABLA DE VENTAS */}
                  <div className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}`, transition: "transform 0.2s, box-shadow 0.2s" }}>
                    <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><BarChart3 size={18} color={RED} /> Resumen de ventas</div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14 }}>Desglose del periodo</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {[
                        ["Venta bruta", desglose.bruta, false, false],
                        ["Descuentos", desglose.descuentos, true, false],
                        ["Retornos", desglose.retornos, true, false],
                        ["Ventas netas", desglose.netas, false, false],
                        ["Costos de envío", desglose.envios, false, false],
                        ["Flete de retorno", desglose.fleteRetorno, false, true],
                        ["Ventas totales", desglose.totales, false, false],
                      ].map(([label, val, esResta, proximamente], i) => {
                        const esTotal = label === "Ventas totales";
                        const esNeta = label === "Ventas netas";
                        return (
                          <div key={label} className="oft-row-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: i === 0 ? "none" : `1px solid ${GRAY}`, animationDelay: `${i * 0.06}s` }}>
                            <span style={{ fontSize: 13, fontWeight: (esTotal || esNeta) ? 800 : 500, color: (esTotal || esNeta) ? BLACK : GRAY3, display: "flex", alignItems: "center", gap: 6 }}>
                              {label}
                              {proximamente && <span style={{ fontSize: 9, background: "#FFF3CD", color: "#856404", padding: "1px 5px", borderRadius: 6, fontWeight: 700 }}>próximamente</span>}
                            </span>
                            <span style={{ fontSize: esTotal ? 16 : 13, fontWeight: (esTotal || esNeta) ? 900 : 600, color: esTotal ? RED : esResta && val > 0 ? "#B01519" : BLACK }}>
                              {esResta && val > 0 ? "−" : ""}<CifraViva valor={val} formato={money} decimales={2} mostrarDelta={false} contexto={`${rangoVentas}|${fechaPersonalizada}|${rangoInicio}|${rangoFin}`} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* GRÁFICO DE INGRESOS + MEJORES PRODUCTOS */}
                <div className="oft-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 28 }}>
                  {/* GRÁFICO INGRESOS */}
                  <div className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}`, transition: "transform 0.2s, box-shadow 0.2s" }}>
                    <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={18} color={RED} /> Estadística de Ingresos</div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 20 }}>Ingresos y órdenes por día</div>
                    {ingresosPorFecha.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 40, color: GRAY3 }}>Aún no hay datos de ventas</div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, paddingTop: 10 }}>
                        {ingresosPorFecha.map((d, i) => (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: RED }}>{money(d.ingreso)}</div>
                            <div className="oft-bar-grow" style={{ width: "100%", maxWidth: 48, background: `linear-gradient(180deg, ${RED} 0%, ${RED_D} 100%)`, borderRadius: "6px 6px 0 0", height: `${Math.max((d.ingreso / maxIngreso) * 150, 4)}px`, transition: "height 0.3s", animationDelay: `${i * 0.08}s` }} />
                            <div style={{ fontSize: 11, color: GRAY3 }}>{d.fecha}</div>
                            <div style={{ fontSize: 10, color: GRAY3, background: GRAY, borderRadius: 10, padding: "1px 7px" }}>{d.ordenes} ord</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* MEJORES PRODUCTOS */}
                  <div className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}`, transition: "transform 0.2s, box-shadow 0.2s", animationDelay: "0.1s" }}>
                    <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={18} color={RED} /> Mejores Productos</div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 16 }}>Más vendidos por cantidad</div>
                    {mejoresProductos.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>Aún no hay ventas</div>
                    ) : mejoresProductos.map((p, i) => {
                      const prod = products.find(pr => pr.id === p.producto_id);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < mejoresProductos.length - 1 ? `1px solid ${GRAY2}` : "none" }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: GRAY3, width: 20 }}>{i + 1}</div>
                          {prod?.imagen_url
                            ? <img src={prod.imagen_url} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                            : <div style={{ width: 36, height: 36, borderRadius: 8, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={16} color={GRAY3} /></div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
                            <div style={{ fontSize: 11, color: GRAY3 }}>{p.cantidad} uds · {money(p.ingreso)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ÓRDENES RECIENTES */}
                <div style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}` }}>
                  <div style={{ fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={18} color={RED} /> Órdenes Recientes</div>
                  {pedidosReales.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>Aún no hay órdenes</div>
                  ) : pedidosReales.slice(0, 5).map(o => {
                    const firstItem = (o.items || [])[0];
                    const prod = firstItem ? products.find(p => p.id === firstItem.producto_id) : null;
                    return (
                      <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${GRAY2}` }}>
                        {prod?.imagen_url
                          ? <img src={prod.imagen_url} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                          : <div style={{ width: 44, height: 44, borderRadius: 8, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={20} color={GRAY3} /></div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{o.codigo} · {o.nombre_cliente}</div>
                          <div style={{ fontSize: 12, color: GRAY3 }}>{(o.items || []).length} producto(s) · {new Date(o.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style={{ fontWeight: 800, color: RED }}>{money(o.total)}</div>
                        <StatusBadge index={o.estado} retiro={o.retiro_local} />
                      </div>
                    );
                  })}
                </div>

                {/* COTIZACIONES RECIENTES */}
                <div style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}`, marginTop: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
                    <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><FileText size={18} color="#856404" /> Cotizaciones Recientes</div>
                    {cotizaciones.length > 0 && (
                      <div style={{ position: "relative", width: 220, maxWidth: "100%" }}>
                        <Search size={14} color={GRAY3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                        <input
                          style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 20, border: `1.5px solid ${GRAY2}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                          placeholder="Buscar por cliente..."
                          value={busquedaCotizacion}
                          onChange={e => setBusquedaCotizacion(e.target.value)}
                        />
                        {busquedaCotizacion && (
                          <button onClick={() => setBusquedaCotizacion("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", color: GRAY3 }}><X size={15} /></button>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: GRAY3, marginBottom: 16 }}>Las cotizaciones no cuentan como ventas</div>
                  {(() => {
                    const q = busquedaCotizacion.trim().toLowerCase();
                    const cotizacionesFiltradas = q
                      ? cotizaciones.filter(o => (o.nombre_cliente || "").toLowerCase().includes(q) || (o.codigo || "").toLowerCase().includes(q))
                      : cotizaciones;
                    if (cotizaciones.length === 0) return <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>Aún no hay cotizaciones</div>;
                    if (cotizacionesFiltradas.length === 0) return <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>No se encontró ninguna cotización de "{busquedaCotizacion}"</div>;
                    return (q ? cotizacionesFiltradas : cotizacionesFiltradas.slice(0, 5)).map(o => {
                    const firstItem = (o.items || [])[0];
                    const prod = firstItem ? products.find(p => p.id === firstItem.producto_id) : null;
                    return (
                      <div key={o.id} style={{ padding: "12px 0", borderBottom: `1px solid ${GRAY2}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          {prod?.imagen_url
                            ? <img src={prod.imagen_url} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                            : <div style={{ width: 44, height: 44, borderRadius: 8, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={20} color={GRAY3} /></div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{o.codigo} · {o.nombre_cliente}</div>
                            <div style={{ fontSize: 12, color: GRAY3 }}>{(o.items || []).length} producto(s) · {new Date(o.created_at).toLocaleDateString()}</div>
                              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><BadgeMetodoPago metodo={o.metodo_pago} sinRegistrar /><SelectorMetodoPago value={o.metodo_pago} onChange={v => cambiarMetodoPago(o.id, v)} /><InsigniaRiesgo r={riesgosPedidos[o.id]} /></div>
                          </div>
                          <div style={{ fontWeight: 800, color: "#856404" }}>{money(o.total)}</div>
                          <InsigniaCotizacion o={o} />
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button onClick={() => setCotizacionAEditar(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: "none", color: BLACK, border: `1.5px solid ${BLACK}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <PencilIcon size={15} /> Editar
                          </button>
                          <button onClick={() => setCotizacionImagen(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: "none", color: "#856404", border: "1.5px solid #856404", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <ImageIcon size={15} /> Imagen
                          </button>
                          <button onClick={() => convertirAPedido(o)} disabled={convirtiendoId === o.id} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: convirtiendoId === o.id ? GRAY2 : RED, color: convirtiendoId === o.id ? GRAY3 : WHITE, border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: convirtiendoId === o.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            {convirtiendoId === o.id ? <>Convirtiendo...</> : <><CheckCircle2 size={15} /> A pedido</>}
                          </button>
                        </div>
                        <button onClick={() => alternarReserva(o)} className="oft-btn-press" style={{ width: "100%", justifyContent: "center", marginTop: 8, background: o.reservada ? "#EDE9FE" : "none", color: "#5B21B6", border: "1.5px solid #7C3AED", borderRadius: 8, padding: "8px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                          <Lock size={14} /> {o.reservada ? "Liberar reserva (las piezas vuelven a estar a la venta)" : "Reservar estas piezas"}
                        </button>
                      </div>
                    );
                  });
                  })()}
                </div>
              </>
            )}
            </>
            ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><BarChart3 size={24} color={RED} /> Inicio</div>
              {loadingData ? <Spinner /> : (
                <>
                  {/* VENTAS DE HOY */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 28 }}>
                    {(() => {
                      const hoyStr = new Date().toDateString();
                      const pedidosHoy = pedidosReales.filter(o => new Date(o.created_at).toDateString() === hoyStr);
                      const ventasHoyTotal = pedidosHoy.reduce((s, o) => s + (Number(o.total) || 0), 0);
                      return [
                        ["Ventas de hoy", ventasHoyTotal, money, 2, DollarSign, RED],
                        ["Pedidos de hoy", pedidosHoy.length, null, 0, ShoppingBag, "#004085"],
                        ["Cotizaciones activas", cotizaciones.length, null, 0, FileText, "#856404"],
                      ].map(([label, val, fmtNum, dec, Icon, color]) => (
                        <div key={label} style={S.statCard}><Icon size={20} color={color} strokeWidth={1.8} /><div style={{ fontSize: 28, fontWeight: 900, color }}><CifraViva valor={val} formato={fmtNum} decimales={dec} deltaLado /></div><div style={{ fontSize: 13, color: GRAY3 }}>{label}</div></div>
                      ));
                    })()}
                  </div>

                  {/* ÓRDENES RECIENTES */}
                  <div style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}` }}>
                    <div style={{ fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={18} color={RED} /> Órdenes Recientes</div>
                    {pedidosReales.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>Aún no hay órdenes</div>
                    ) : pedidosReales.slice(0, 5).map(o => {
                      const firstItem = (o.items || [])[0];
                      const prod = firstItem ? products.find(p => p.id === firstItem.producto_id) : null;
                      return (
                        <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${GRAY2}` }}>
                          {prod?.imagen_url
                            ? <img src={prod.imagen_url} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                            : <div style={{ width: 44, height: 44, borderRadius: 8, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={20} color={GRAY3} /></div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{o.codigo} · {o.nombre_cliente}</div>
                            <div style={{ fontSize: 12, color: GRAY3 }}>{(o.items || []).length} producto(s) · {new Date(o.created_at).toLocaleDateString()}</div>
                          </div>
                          <div style={{ fontWeight: 800, color: RED }}>{money(o.total)}</div>
                          <StatusBadge index={o.estado} retiro={o.retiro_local} />
                        </div>
                      );
                    })}
                  </div>

                  {/* COTIZACIONES RECIENTES */}
                  <div style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}`, marginTop: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
                      <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><FileText size={18} color="#856404" /> Cotizaciones Recientes</div>
                      {cotizaciones.length > 0 && (
                        <div style={{ position: "relative", width: 220, maxWidth: "100%" }}>
                          <Search size={14} color={GRAY3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                          <input
                            style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 20, border: `1.5px solid ${GRAY2}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                            placeholder="Buscar por cliente..."
                            value={busquedaCotizacion}
                            onChange={e => setBusquedaCotizacion(e.target.value)}
                          />
                          {busquedaCotizacion && (
                            <button onClick={() => setBusquedaCotizacion("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", color: GRAY3 }}><X size={15} /></button>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 16 }}>Las cotizaciones no cuentan como ventas</div>
                    {(() => {
                      const q = busquedaCotizacion.trim().toLowerCase();
                      const cotizacionesFiltradas = q
                        ? cotizaciones.filter(o => (o.nombre_cliente || "").toLowerCase().includes(q) || (o.codigo || "").toLowerCase().includes(q))
                        : cotizaciones;
                      if (cotizaciones.length === 0) return <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>Aún no hay cotizaciones</div>;
                      if (cotizacionesFiltradas.length === 0) return <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>No se encontró ninguna cotización de "{busquedaCotizacion}"</div>;
                      return (q ? cotizacionesFiltradas : cotizacionesFiltradas.slice(0, 5)).map(o => {
                      const firstItem = (o.items || [])[0];
                      const prod = firstItem ? products.find(p => p.id === firstItem.producto_id) : null;
                      return (
                        <div key={o.id} style={{ padding: "12px 0", borderBottom: `1px solid ${GRAY2}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            {prod?.imagen_url
                              ? <img src={prod.imagen_url} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                              : <div style={{ width: 44, height: 44, borderRadius: 8, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={20} color={GRAY3} /></div>
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{o.codigo} · {o.nombre_cliente}</div>
                              <div style={{ fontSize: 12, color: GRAY3 }}>{(o.items || []).length} producto(s) · {new Date(o.created_at).toLocaleDateString()}</div>
                              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><BadgeMetodoPago metodo={o.metodo_pago} sinRegistrar /><SelectorMetodoPago value={o.metodo_pago} onChange={v => cambiarMetodoPago(o.id, v)} /><InsigniaRiesgo r={riesgosPedidos[o.id]} /></div>
                            </div>
                            <div style={{ fontWeight: 800, color: "#856404" }}>{money(o.total)}</div>
                            <InsigniaCotizacion o={o} />
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button onClick={() => setCotizacionAEditar(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: "none", color: BLACK, border: `1.5px solid ${BLACK}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <PencilIcon size={15} /> Editar
                            </button>
                            <button onClick={() => setCotizacionImagen(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: "none", color: "#856404", border: "1.5px solid #856404", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <ImageIcon size={15} /> Imagen
                            </button>
                            <button onClick={() => convertirAPedido(o)} disabled={convirtiendoId === o.id} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: convirtiendoId === o.id ? GRAY2 : RED, color: convirtiendoId === o.id ? GRAY3 : WHITE, border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: convirtiendoId === o.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              {convirtiendoId === o.id ? <>Convirtiendo...</> : <><CheckCircle2 size={15} /> A pedido</>}
                            </button>
                          </div>
                          <button onClick={() => alternarReserva(o)} className="oft-btn-press" style={{ width: "100%", justifyContent: "center", marginTop: 8, background: o.reservada ? "#EDE9FE" : "none", color: "#5B21B6", border: "1.5px solid #7C3AED", borderRadius: 8, padding: "8px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <Lock size={14} /> {o.reservada ? "Liberar reserva (las piezas vuelven a estar a la venta)" : "Reservar estas piezas"}
                          </button>
                        </div>
                      );
                    });
                    })()}
                  </div>
                </>
              )}
            </>
            )}
          </>
        )}

        {/* ═══════════ PEDIDOS ═══════════ */}
        {tab === "orders" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><Package size={24} color={RED} /> Pedidos Recibidos</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
              {[["Total",pedidosReales.length,RED,ClipboardList],["En proceso",pedidosReales.filter(o=>o.estado<3).length,"#856404",RefreshCw],["Entregados",pedidosReales.filter(o=>o.estado===3).length,"#155724",CheckCircle2]].map(([l,n,c,Icon]) => (
                <div key={l} style={S.statCard}><Icon size={20} color={c} strokeWidth={1.8} /><div style={{ fontSize: 28, fontWeight: 900, color: c }}>{n}</div><div style={{ fontSize: 13, color: GRAY3 }}>{l}</div></div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
              <div style={{ position: "relative", maxWidth: 360, flex: 1, minWidth: 220 }}>
                <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={busquedaPedidos}
                  onChange={e => setBusquedaPedidos(e.target.value)}
                  placeholder="Buscar por # de pedido o cliente..."
                  style={{ ...S.input, marginBottom: 0, paddingLeft: 36 }}
                />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {[["todos", "Todos", null], ...Object.entries(METODOS_PAGO).map(([k, m]) => [k, m.label, m]), ["sin", "Sin registrar", null]].map(([k, label, m]) => {
                  const n = k === "todos" ? pedidosReales.length : k === "sin" ? pedidosReales.filter(o => !METODOS_PAGO[o.metodo_pago]).length : pedidosReales.filter(o => o.metodo_pago === k).length;
                  if (k === "sin" && n === 0 && filtroMetodo !== "sin") return null;
                  const act = filtroMetodo === k;
                  return (
                    <button key={k} onClick={() => setFiltroMetodo(k)} className="oft-btn-press"
                      style={{ padding: "8px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${act ? (m ? m.color : BLACK) : GRAY2}`, background: act ? (m ? m.bg : BLACK) : WHITE, color: act ? (m ? m.color : WHITE) : BLACK }}>
                      {label} <span style={{ opacity: 0.7, fontWeight: 700 }}>{n}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setSoloSinImprimir(v => !v)} className="oft-btn-press"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${soloSinImprimir ? "#856404" : GRAY2}`, background: soloSinImprimir ? "#FFF8E1" : WHITE, color: soloSinImprimir ? "#856404" : GRAY3, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                <AlertTriangle size={15} /> Solo guías sin imprimir {soloSinImprimir ? `(${pedidosReales.filter(o => !o.guia_impresa).length})` : ""}
              </button>
            </div>
            {loadingData ? <Spinner /> : (
              <>
              {/* TABLA (solo escritorio) */}
              <div className="oft-table-wrap oft-only-desktop" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
                <table style={S.table}>
                  <thead><tr>{["#Pedido","Cliente","Teléfono","Envío","Total","Estado","Cambiar","Avisar"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {pedidosFiltrados.length === 0 && (
                      <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", padding: 30, color: GRAY3 }}>{busquedaPedidos ? "No se encontró ningún pedido" : "No hay pedidos aún"}</td></tr>
                    )}
                    {pedidosFiltrados.map(o => (
                      <tr key={o.id}>
                        <td style={{ ...S.td, fontWeight: 700, color: RED }}>
                          {o.codigo}
                          {o.pagado === false && <div style={{ marginTop: 3, display: "inline-block", background: "#FFF3CD", color: "#856404", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>SIN PAGAR</div>}
                          {o.pagado === true && <div style={{ marginTop: 3, display: "inline-block", background: "#D4EDDA", color: "#155724", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>PAGADO</div>}
                          <div style={{ marginTop: 3 }}><BadgeMetodoPago metodo={o.metodo_pago} sinRegistrar={o.pagado !== false} /><SelectorMetodoPago value={o.metodo_pago} onChange={v => cambiarMetodoPago(o.id, v)} style={{ marginLeft: 5 }} /><InsigniaRiesgo r={riesgosPedidos[o.id]} style={{ marginLeft: 5 }} /></div>
                          <div style={{ marginTop: 3 }}>
                            {o.creado_por_admin
                              ? <span style={{ display: "inline-block", background: GRAY, color: GRAY3, fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>MANUAL</span>
                              : <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#DBEAFE", color: "#1D4ED8", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}><Zap size={10} /> WEB</span>}
                          </div>
                          <InsigniaRetorno retornos={retornos} o={o} />
                        </td>
                        <td style={S.td}>{o.nombre_cliente}</td>
                        <td style={S.td}>{o.telefono}</td>
                        <td style={S.td}>
                          {o.retiro_local
                            ? <span style={{ fontSize: 12, fontWeight: 700, color: "#856404", display: "inline-flex", alignItems: "center", gap: 4 }}><Home size={13} /> Retiro local</span>
                            : o.empresa_envio_nombre
                            ? <span style={{ fontSize: 12 }}>{o.empresa_envio_nombre}{o.sucursal_nombre ? <><br /><span style={{ color: GRAY3 }}>{o.sucursal_nombre}</span></> : ""}</span>
                            : <span style={{ color: GRAY3 }}>—</span>}
                        </td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{money(o.total)}</td>
                        <td style={S.td}><StatusBadge index={o.estado} retiro={o.retiro_local} /></td>
                        <td style={S.td}>
                          <select value={o.estado} onChange={e => handleStatusChange(o.id, Number(e.target.value))} style={{ border: `1.5px solid ${GRAY2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: "inherit" }}>
                            {estadosDe(o).map((s,i) => <option key={i} value={i}>{s}</option>)}
                          </select>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={() => notifyWhatsApp(o, o.estado)} title="Enviar notificación por WhatsApp" style={{ ...S.btnWA, padding: "6px 10px", fontSize: 12 }}>
                              <MessageCircle size={14} /> Avisar
                            </button>
                            <button onClick={() => setShippingLabel(o)} title={o.guia_impresa ? "Guía ya impresa — clic para ver de nuevo" : "Guía sin imprimir todavía"}
                              style={{ background: o.guia_impresa ? "#E6F4EA" : "#FFF8E1", border: `1.5px solid ${o.guia_impresa ? "#155724" : "#856404"}`, color: o.guia_impresa ? "#155724" : "#856404", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              {o.guia_impresa ? <CheckCircle2 size={14} /> : <Truck size={14} />} Guía
                            </button>
                            <button onClick={() => setFacturaImagen(o)} title="Descargar imagen/PDF de la factura" style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <ImageIcon size={14} /> Factura
                            </button>
                            {o.tipo !== "cotizacion" && !retornosDePedido(retornos, o).some(r => r.tipo_retorno === "total") && (
                              <button onClick={() => setPedidoARetornar(o)} title="Retornar pedido (devuelve la mercancía al inventario de Odoo)" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <RefreshCw size={14} /> Retornar
                              </button>
                            )}
                            <button onClick={() => setPedidoAEliminar(o)} title="Eliminar pedido" style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 6, padding: "6px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TARJETAS (solo celular) */}
              <div className="oft-only-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pedidosFiltrados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: GRAY3 }}>{busquedaPedidos ? "No se encontró ningún pedido" : "No hay pedidos aún"}</div>
                ) : pedidosFiltrados.map(o => (
                  <div key={o.id} style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 16 }}>
                    {/* Cabecera */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16, color: RED }}>{o.codigo}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{o.nombre_cliente}</div>
                        <div style={{ fontSize: 12, color: GRAY3 }}>{o.telefono}</div>
                        {o.pagado === false && <span style={{ display: "inline-block", marginTop: 4, background: "#FFF3CD", color: "#856404", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6 }}>SIN PAGAR</span>}
                        {o.pagado === true && <span style={{ display: "inline-block", marginTop: 4, background: "#D4EDDA", color: "#155724", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6 }}>PAGADO</span>}
                        {" "}
                        <BadgeMetodoPago metodo={o.metodo_pago} sinRegistrar={o.pagado !== false} style={{ marginTop: 4 }} />{" "}<InsigniaRiesgo r={riesgosPedidos[o.id]} />{" "}
                        <SelectorMetodoPago value={o.metodo_pago} onChange={v => cambiarMetodoPago(o.id, v)} style={{ marginTop: 4 }} />
                        {" "}
                        {o.creado_por_admin
                          ? <span style={{ display: "inline-block", marginTop: 4, background: GRAY, color: GRAY3, fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6 }}>MANUAL</span>
                          : <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4, background: "#DBEAFE", color: "#1D4ED8", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6 }}><Zap size={10} /> WEB</span>}
                        <InsigniaRetorno retornos={retornos} o={o} />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>{money(o.total)}</div>
                        <div style={{ marginTop: 4 }}><StatusBadge index={o.estado} retiro={o.retiro_local} /></div>
                      </div>
                    </div>

                    {/* Envío o Retiro en el local */}
                    {o.retiro_local ? (
                      <div style={{ fontSize: 12, color: "#856404", background: "#FFF3CD", borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                          <Home size={14} /> Retiro en el local
                        </div>
                        <CampoQuienRecoge order={o} onGuardar={handleGuardarQuienRecoge} />
                      </div>
                    ) : o.empresa_envio_nombre && (
                      <div style={{ fontSize: 12, color: GRAY3, background: GRAY, borderRadius: 8, padding: "8px 10px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <Truck size={14} color={RED} /> {o.empresa_envio_nombre}{o.sucursal_nombre ? ` · ${o.sucursal_nombre}` : ""}
                      </div>
                    )}

                    {/* Cambiar estado */}
                    <label style={{ fontSize: 12, fontWeight: 700, color: GRAY3, display: "block", marginBottom: 4 }}>Cambiar estado:</label>
                    <select value={o.estado} onChange={e => handleStatusChange(o.id, Number(e.target.value))} style={{ width: "100%", border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", marginBottom: 10 }}>
                      {estadosDe(o).map((s,i) => <option key={i} value={i}>{s}</option>)}
                    </select>

                    {/* Avisar + Guía + Factura + Eliminar */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => notifyWhatsApp(o, o.estado)} style={{ ...S.btnWA, flex: 1, justifyContent: "center", padding: 12 }}>
                        <MessageCircle size={16} /> Avisar
                      </button>
                      <button onClick={() => setShippingLabel(o)} style={{ background: o.guia_impresa ? "#155724" : "#856404", color: WHITE, border: "none", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {o.guia_impresa ? <CheckCircle2 size={16} /> : <Truck size={16} />} Guía
                      </button>
                      <button onClick={() => setFacturaImagen(o)} style={{ background: "none", color: RED, border: `1.5px solid ${RED}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <ImageIcon size={16} /> Factura
                      </button>
                      {o.tipo !== "cotizacion" && !retornosDePedido(retornos, o).some(r => r.tipo_retorno === "total") && (
                        <button onClick={() => setPedidoARetornar(o)} style={{ background: "none", color: BLACK, border: `1.5px solid ${BLACK}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <RefreshCw size={16} /> Retornar
                        </button>
                      )}
                      <button onClick={() => setPedidoAEliminar(o)} title="Eliminar" style={{ background: "none", color: RED, border: `1.5px solid ${RED}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
            {/* MODAL GUÍA DE ENVÍO */}
            {shippingLabel && (
              <ShippingLabelModal
                order={shippingLabel}
                onClose={() => setShippingLabel(null)}
                onGuiaImpresa={(id, valor) => setOrders(prev => prev.map(o => o.id === id ? { ...o, guia_impresa: valor } : o))}
              />
            )}
            {/* MODAL IMAGEN/PDF DE FACTURA */}
            {facturaImagen && <OrderImageModal order={facturaImagen} onClose={() => setFacturaImagen(null)} />}
            {/* MODAL RETORNAR PEDIDO */}
            {pedidoARetornar && (
              <RetornarPedidoModal
                pedido={pedidoARetornar}
                productos={products}
                retornos={retornos}
                onClose={() => setPedidoARetornar(null)}
                onHecho={(fila, odoo) => {
                  setRetornos(prev => [fila, ...prev.filter(r => r.id !== fila.id)]);
                  const cod = pedidoARetornar.codigo;
                  setPedidoARetornar(null);
                  if (odoo.estado === "devuelto") showToast(`Retorno de ${cod} registrado · Odoo: ${odoo.detalle}`);
                  else if (odoo.estado === "sin_odoo") showToast(`Retorno de ${cod} registrado (el pedido no estaba en Odoo)`);
                  else showToast(`Retorno de ${cod} registrado SOLO en la web: falta devolver el inventario en Odoo`);
                  if (odoo.aviso) alert(odoo.aviso);
                }}
              />
            )}
            {/* MODAL CONFIRMAR ELIMINACIÓN */}
            {pedidoAEliminar && createPortal(
              <div className="oft-overlay" style={S.overlay} onClick={() => !eliminando && setPedidoAEliminar(null)}>
                <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 400, width: "90%", padding: 24, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FBE0E0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Trash2 size={26} color={RED} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>¿Eliminar este pedido?</div>
                  <p style={{ fontSize: 14, color: GRAY3, marginBottom: 6 }}>
                    Vas a eliminar <strong style={{ color: BLACK }}>{pedidoAEliminar.codigo}</strong> de {pedidoAEliminar.nombre_cliente}.
                  </p>
                  {pedidoAEliminar.tipo !== "cotizacion" && (
                    <p style={{ fontSize: 12.5, color: GRAY3, marginBottom: 10, background: GRAY, borderRadius: 8, padding: "8px 10px" }}>
                      Si este pedido ya está en Odoo, también se <strong>devuelve la mercancía</strong> al inventario, se <strong>cancela la venta</strong> y, si ya estaba facturado, se emite la <strong>nota de crédito</strong> (te pedirá confirmar antes).
                    </p>
                  )}
                  <p style={{ fontSize: 13, color: RED, marginBottom: 22, fontWeight: 700 }}>Esta acción no se puede deshacer y se restará del dashboard.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setPedidoAEliminar(null)} disabled={eliminando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                    <button onClick={eliminarPedido} disabled={eliminando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: eliminando ? 0.7 : 1 }}>
                      {eliminando ? "Eliminando..." : "Sí, eliminar"}
                    </button>
                  </div>
                </div>
              </div>
            , document.body)}
          </>
        )}

        {/* MODAL EDITAR COTIZACIÓN (disponible desde el dashboard) */}
        {cotizacionAEditar && (
          <EditCotizacionModal
            cotizacion={cotizacionAEditar}
            empresas={empresas}
            sucursales={sucursales}
            showToast={showToast}
            onClose={() => setCotizacionAEditar(null)}
            onSaved={(actualizada) => { setOrders(prev => prev.map(o => o.id === actualizada.id ? actualizada : o)); setCotizacionAEditar(null); }}
          />
        )}

        {/* MODAL IMAGEN DE COTIZACIÓN (disponible desde el dashboard) */}
        {cotizacionImagen && (
          <OrderImageModal
            order={cotizacionImagen}
            onClose={() => setCotizacionImagen(null)}
          />
        )}

        {/* MODAL TOP 50 — ANÁLISIS DE STOCK */}
        {rankingModal && (
          <StockRankingModal
            tipo={rankingModal}
            items={(() => {
              const base = rankingModal === "reponer" ? urgentesReponer :
                rankingModal === "rotacion" ? rotacionOrdenado :
                rankingModal === "ingreso" ? ingresoOrdenado :
                ventasPorArea;
              const filtrado = rankingModalProveedorId
                ? base.filter(f => f.prod?.proveedor_id === rankingModalProveedorId)
                : base;
              return filtrado.slice(0, 50);
            })()}
            itemsSinFiltroNiLimite={rankingModal === "reponer" ? urgentesReponer : null}
            proveedores={proveedores}
            proveedorIdInicial={rankingModalProveedorId}
            categories={categories}
            onClose={() => { setRankingModal(null); setRankingModalProveedorId(null); }}
          />
        )}

        {/* MODAL CREAR/EDITAR CLIENTE */}
        {clienteForm && (
          <ClienteFormModal
            cliente={clienteForm}
            showToast={showToast}
            onClose={() => setClienteForm(null)}
            onSaved={(saved) => {
              setUsers(prev => clienteForm.id ? prev.map(u => u.id === saved.id ? saved : u) : [saved, ...prev]);
            }}
          />
        )}

        {/* MODAL VERIFICACIÓN EN DOS PASOS */}
        {mfaModal && <MfaSetupModal onClose={() => setMfaModal(false)} />}

        {/* MODAL CREAR/EDITAR PROVEEDOR */}
        {proveedorForm && (
          <ProveedorFormModal
            proveedor={proveedorForm}
            showToast={showToast}
            onClose={() => setProveedorForm(null)}
            onSaved={(saved) => setProveedores(prev => proveedorForm.id ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev])}
          />
        )}

        {/* CONFIRMAR ELIMINAR PROVEEDOR */}
        {proveedorAEliminar && createPortal(
          <div className="oft-overlay" style={S.overlay} onClick={() => setProveedorAEliminar(null)}>
            <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 380, width: "92%", padding: 24, textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>¿Eliminar a "{proveedorAEliminar.nombre}"?</div>
              <p style={{ fontSize: 13, color: GRAY3, marginBottom: 20 }}>
                Los productos que ya tenías vinculados a este proveedor NO se borran, solo quedan sin proveedor asignado (pasan a tratarse como productos propios).
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setProveedorAEliminar(null)} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                <button
                  onClick={async () => {
                    try {
                      await sb.delete("proveedores", proveedorAEliminar.id);
                      setProveedores(prev => prev.filter(p => p.id !== proveedorAEliminar.id));
                      setProducts(prev => prev.map(p => p.proveedor_id === proveedorAEliminar.id ? { ...p, proveedor_id: null } : p));
                      showToast("Proveedor eliminado");
                    } catch(e) {
                      showToast("Error: " + (e.message || "no se pudo eliminar"));
                    }
                    setProveedorAEliminar(null);
                  }}
                  className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center" }}
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* MODAL CREAR/EDITAR LOCAL DE RETIRO */}
        {localForm && (
          <LocalRetiroFormModal
            local={localForm}
            showToast={showToast}
            onClose={() => setLocalForm(null)}
            onSaved={(saved) => setLocalesRetiro(prev => localForm.id ? prev.map(l => l.id === saved.id ? saved : l) : [saved, ...prev])}
          />
        )}

        {/* CONFIRMAR ELIMINAR LOCAL DE RETIRO */}
        {localAEliminar && createPortal(
          <div className="oft-overlay" style={S.overlay} onClick={() => setLocalAEliminar(null)}>
            <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 380, width: "92%", padding: 24, textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>¿Eliminar "{localAEliminar.nombre}"?</div>
              <p style={{ fontSize: 13, color: GRAY3, marginBottom: 20 }}>
                Los pedidos que ya se registraron con este local mantienen su información, solo dejará de aparecer como opción para pedidos nuevos.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setLocalAEliminar(null)} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                <button
                  onClick={async () => {
                    try {
                      await sb.delete("locales_retiro", localAEliminar.id);
                      setLocalesRetiro(prev => prev.filter(l => l.id !== localAEliminar.id));
                      showToast("Local eliminado");
                    } catch(e) {
                      showToast("Error: " + (e.message || "no se pudo eliminar"));
                    }
                    setLocalAEliminar(null);
                  }}
                  className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center" }}
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* MODAL AGREGAR AL EQUIPO */}
        {equipoForm && (
          <EquipoFormModal
            showToast={showToast}
            onClose={() => setEquipoForm(false)}
            onSaved={(nuevo) => setUsers(prev => [nuevo, ...prev])}
          />
        )}

        {promoverForm && (
          <PromoverClienteModal
            showToast={showToast}
            users={users}
            onClose={() => setPromoverForm(false)}
            onSaved={(actualizado) => setUsers(prev => prev.map(u => u.id === actualizado.id ? actualizado : u))}
          />
        )}

        {/* CONFIRMAR QUITAR DEL EQUIPO */}
        {miembroAQuitar && createPortal(
          <div className="oft-overlay" style={S.overlay} onClick={() => setMiembroAQuitar(null)}>
            <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 380, width: "92%", padding: 24, textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>¿Quitar a {miembroAQuitar.nombre} del equipo?</div>
              <p style={{ fontSize: 13, color: GRAY3, marginBottom: 20 }}>Perderá acceso al panel de administrador. Su cuenta y su historial no se eliminan, solo se le quita el acceso.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setMiembroAQuitar(null)} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                <button
                  onClick={async () => {
                    try {
                      await sb.patch("usuarios", miembroAQuitar.id, { es_admin: false, rol: null });
                      setUsers(prev => prev.map(u => u.id === miembroAQuitar.id ? { ...u, es_admin: false, rol: null } : u));
                      showToast("Se quitó del equipo");
                    } catch(e) {
                      showToast("Error: " + (e.message || "no se pudo quitar"));
                    }
                    setMiembroAQuitar(null);
                  }}
                  className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center" }}
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* ═══════════ PRODUCTOS ═══════════ */}
        {tab === "products" && esAdminCompleto && (
          <>
            <div className="oft-admin-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Tag size={24} color={RED} /> Productos</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={{ ...S.btnOutline, display: "inline-flex", alignItems: "center", gap: 6, opacity: sincronizando ? 0.6 : 1 }} onClick={sincronizarOdoo} disabled={sincronizando}>
                  <RefreshCw size={16} className={sincronizando ? "spin" : ""} /> {sincronizando ? "Sincronizando..." : "Sync con Odoo"}
                </button>
                <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => { setShowBulkImg(!showBulkImg); setShowBulk(false); setShowProdForm(false); }}>
                  <ImageIcon size={16} /> Cargar fotos
                </button>
                <button style={{ ...S.btnOutline, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => { setShowBulk(!showBulk); setShowBulkImg(false); setShowProdForm(false); }}>
                  <FileSpreadsheet size={16} /> Texto (CSV)
                </button>
                <button style={{ ...S.btnOutline, display: "inline-flex", alignItems: "center", gap: 6, borderColor: selectMode ? RED : GRAY2, color: selectMode ? RED : BLACK }} onClick={() => { setSelectMode(!selectMode); setSelectedIds([]); }}>
                  <CheckCircle2 size={16} /> {selectMode ? "Cancelar selección" : "Seleccionar"}
                </button>
                <button style={{ ...S.btnBlack, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={openNewProduct}>
                  <Plus size={16} strokeWidth={2.5} /> Nuevo
                </button>
              </div>
            </div>

            {/* FILTRO POR CATEGORÍA */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
              <button onClick={() => setFiltroCategoria("todas")} className="oft-btn-press"
                style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 20, border: `2px solid ${filtroCategoria === "todas" ? RED : GRAY2}`, background: filtroCategoria === "todas" ? RED : WHITE, color: filtroCategoria === "todas" ? WHITE : BLACK, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                Todas ({products.length})
              </button>
              {categories.map(c => {
                const count = products.filter(p => p.categoria_id === c.id).length;
                const active = filtroCategoria === c.id;
                return (
                  <button key={c.id} onClick={() => setFiltroCategoria(c.id)} className="oft-btn-press"
                    style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 20, border: `2px solid ${active ? RED : GRAY2}`, background: active ? RED : WHITE, color: active ? WHITE : (count === 0 ? GRAY3 : BLACK), fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {c.nombre} ({count})
                  </button>
                );
              })}
            </div>

            {/* BÚSQUEDA POR REFERENCIA */}
            <div style={{ position: "relative", maxWidth: 340, marginBottom: 16 }}>
              <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: `1.5px solid ${GRAY2}`, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                placeholder="Buscar por referencia..."
                value={busquedaProducto}
                onChange={e => setBusquedaProducto(e.target.value)}
              />
              {busquedaProducto && (
                <button onClick={() => setBusquedaProducto("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", color: GRAY3 }}><X size={16} /></button>
              )}
            </div>

            {selectMode && (
              <div style={{ background: "#FFF5F5", border: `2px solid ${RED}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedIds.length} seleccionado(s)</span>
                <button style={{ ...S.btnOutline, padding: "6px 12px", fontSize: 13 }} onClick={selectAll}>
                  {productosFiltrados.length > 0 && productosFiltrados.every(p => selectedIds.includes(p.id)) ? "Quitar todos" : "Seleccionar todos"}
                </button>
                <button style={{ ...S.btnRed, padding: "6px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, opacity: selectedIds.length === 0 ? 0.5 : 1 }} disabled={selectedIds.length === 0} onClick={() => setShowBulkEdit(true)}>
                  <PencilIcon size={14} /> Editar seleccionados
                </button>
                <button style={{ background: selectedIds.length === 0 ? GRAY3 : RED, color: WHITE, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: selectedIds.length === 0 ? 0.5 : 1 }} disabled={selectedIds.length === 0} onClick={() => setShowBulkDelete(true)}>
                  <Trash2 size={14} /> Eliminar seleccionados
                </button>
              </div>
            )}

            {/* CARGA MASIVA CON IMÁGENES */}
            {showBulkImg && (
              <div style={{ background: WHITE, borderRadius: 16, padding: 24, marginBottom: 24, border: `2px solid ${RED}` }}>
                <div style={{ fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><ImageIcon size={18} color={RED} /> Cargar productos desde fotos</div>
                <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>
                  Selecciona varias fotos desde tu celular. Se creará un <strong>producto borrador</strong> por cada foto. Luego editas sus datos (nombre, precios, etc.).
                </p>
                <label style={S.label}>Categoría para estos productos</label>
                <select style={{ ...S.input }} value={bulkImgCat} onChange={e => setBulkImgCat(Number(e.target.value))}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <label style={S.label}>Proveedor</label>
                <select style={{ ...S.input }} value={bulkImgProveedorId || ""} onChange={e => setBulkImgProveedorId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Producto propio de Ofertodo</option>
                  {proveedores.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                </select>
                {bulkImgProveedorId && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                    <input type="checkbox" id="bulkImgStockFisico" checked={bulkImgTieneStockFisico} onChange={e => setBulkImgTieneStockFisico(e.target.checked)} style={{ width: 18, height: 18 }} />
                    <label htmlFor="bulkImgStockFisico" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Ya tengo esta mercancía en stock físico
                      <div style={{ fontSize: 11, color: GRAY3, fontWeight: 400 }}>Actívalo si acabas de recibir/comprar estos productos — aplican los bloqueos por stock. Si sigues comprándolos bajo pedido, déjalo apagado.</div>
                    </label>
                  </div>
                )}
                <p style={{ fontSize: 11, color: GRAY3, marginTop: -8, marginBottom: 14 }}>
                  Si tus fotos ya están nombradas por su Item No./SKU (ej. "25004.jpg"), ese número se usa automáticamente como referencia del producto.
                </p>

                {bulkImgLoading ? (
                  <div style={{ textAlign: "center", padding: 24 }}>
                    <RefreshCw size={28} className="spin" color={RED} style={{ marginBottom: 10 }} />
                    <div style={{ fontWeight: 700 }}>Subiendo {bulkImgProgress.done} de {bulkImgProgress.total}...</div>
                    <div style={{ background: GRAY2, borderRadius: 10, height: 8, marginTop: 12, overflow: "hidden" }}>
                      <div style={{ background: RED, height: "100%", width: `${(bulkImgProgress.done / Math.max(bulkImgProgress.total,1)) * 100}%`, transition: "width 0.3s" }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div onClick={() => bulkImgRef.current?.click()} style={{ border: `2px dashed ${RED}`, borderRadius: 12, padding: 30, textAlign: "center", cursor: "pointer", marginBottom: 14, background: "#FFF5F5" }}>
                      <input ref={bulkImgRef} type="file" accept="image/*" multiple onChange={handleBulkImageUpload} style={{ display: "none" }} />
                      <ImageIcon size={40} color={RED} strokeWidth={1.4} style={{ marginBottom: 8 }} />
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Toca para seleccionar fotos</div>
                      <div style={{ fontSize: 12, color: GRAY3, marginTop: 4 }}>Puedes elegir varias a la vez</div>
                    </div>
                    <button style={S.btnOutline} onClick={() => setShowBulkImg(false)}>Cancelar</button>
                  </>
                )}
              </div>
            )}

            {showBulk && (
              <div style={{ background: WHITE, borderRadius: 16, padding: 24, marginBottom: 24, border: `1px solid ${GRAY2}` }}>
                <div style={{ fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><FileSpreadsheet size={18} color={RED} /> Carga masiva de productos</div>
                <p style={{ fontSize: 13, color: GRAY3, marginBottom: 12 }}>Una línea por producto, valores separados por comas en este orden:</p>
                <div style={{ background: GRAY, borderRadius: 8, padding: 12, fontSize: 12, fontFamily: "monospace", marginBottom: 12, overflowX: "auto" }}>
                  referencia,nombre,descripcion,categoria_id,precio_pieza,precio_media_docena,precio_docena,badge,tallas,distribucion_docena,proveedor,venta_unidad
                </div>
                <div style={{ fontSize: 12, color: GRAY3, marginBottom: 4 }}>
                  <strong>Tallas y distribución (opcional):</strong> las últimas 2 columnas antes de proveedor. Las tallas van separadas por "|" y las cantidades de cada una <em>en 1 docena completa</em> van en el mismo orden, también separadas por "|". La media docena se calcula sola.
                </div>
                <div style={{ fontSize: 12, color: GRAY3, marginBottom: 4 }}>
                  <strong>Proveedor (opcional):</strong> escribe el nombre exacto de un proveedor ya creado en la pestaña "Proveedores" — si coincide, el producto queda vinculado a él (no se bloquea por falta de stock). Si lo dejas vacío, el producto es propio de Ofertodo.
                </div>
                <div style={{ fontSize: 12, color: GRAY3, marginBottom: 12 }}>
                  <strong>Venta por unidad (opcional):</strong> escribe "SI" para que el cliente pueda comprar directo "Por Pieza" sin pasar por WhatsApp — ideal para artículos que no son de ropa (perfumes, desechables, etc.). La tarjeta sigue mostrando el precio por Docena primero, igual que siempre. Déjalo vacío para el comportamiento normal.
                </div>
                <div style={{ background: GRAY, borderRadius: 8, padding: 12, fontSize: 12, fontFamily: "monospace", marginBottom: 12, overflowX: "auto" }}>
                  001,Zapatilla HPC,Descripción,1,3.50,19,36,NUEVO,30|32|34|36|38,2|4|3|2|1,,<br />
                  002,Perfume XYZ,Descripción,2,8,45,85,,,,Distribuidora El Puerto,SI
                </div>
                {proveedores.length > 0 && (
                  <div style={{ fontSize: 12, color: GRAY3, marginBottom: 12 }}>
                    <strong>Proveedores ya creados:</strong> {proveedores.map(pv => pv.nombre).join(" · ")}
                  </div>
                )}
                <div style={{ fontSize: 12, color: GRAY3, marginBottom: 12 }}>
                  <strong>IDs de categoría:</strong> {categories.map(c => `${c.nombre}=${c.id}`).join(" · ")}
                </div>
                <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="Pega aquí tus productos, uno por línea..." rows={8} style={{ ...S.input, fontFamily: "monospace", fontSize: 12, resize: "vertical" }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btnRed, opacity: bulkLoading ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={handleBulkUpload} disabled={bulkLoading}><Upload size={16} /> {bulkLoading ? "Subiendo..." : "Subir productos"}</button>
                  <button style={S.btnOutline} onClick={() => setShowBulk(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {showProdForm && (
              <div style={{ background: WHITE, borderRadius: 16, padding: 24, marginBottom: 24, border: `2px solid ${RED}` }}>
                <div style={{ fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  {editingId ? <><PencilIcon size={18} color={RED} /> Editar producto</> : <><Plus size={18} color={RED} /> Nuevo producto</>}
                </div>
                <div className="oft-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[["referencia","Referencia"],["nombre","Nombre del producto"],["badge","Badge (NUEVO, OFERTA, etc)"]].map(([k,l]) => (
                    <div key={k}><label style={S.label}>{l}</label><input style={S.input} value={prodForm[k]} onChange={e => setProdForm({...prodForm,[k]:e.target.value})} /></div>
                  ))}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>Modalidad de venta</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => setProdForm({ ...prodForm, modalidad_presentacion: "estandar" })} className="oft-btn-press"
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${prodForm.modalidad_presentacion !== "perfumeria" ? RED : GRAY2}`, background: prodForm.modalidad_presentacion !== "perfumeria" ? "#FDECEC" : WHITE, color: prodForm.modalidad_presentacion !== "perfumeria" ? RED : GRAY3, fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                        Estándar<div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>Pieza / Media Docena / Docena</div>
                      </button>
                      <button type="button" onClick={() => setProdForm({ ...prodForm, modalidad_presentacion: "perfumeria" })} className="oft-btn-press"
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${prodForm.modalidad_presentacion === "perfumeria" ? RED : GRAY2}`, background: prodForm.modalidad_presentacion === "perfumeria" ? "#FDECEC" : WHITE, color: prodForm.modalidad_presentacion === "perfumeria" ? RED : GRAY3, fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                        Perfumería<div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>Pieza / 3 Piezas / 6 Piezas</div>
                      </button>
                    </div>
                  </div>
                  {/* Campos de precio: solo números y punto decimal */}
                  {[["precio_pieza","Precio x pieza"],["precio_media_docena", prodForm.modalidad_presentacion === "perfumeria" ? "Precio x 3 piezas" : "Precio x media docena"],["precio_docena", prodForm.modalidad_presentacion === "perfumeria" ? "Precio x 6 piezas" : "Precio x docena"]].map(([k,l]) => (
                    <div key={k}>
                      <label style={S.label}>{l}</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: GRAY3, fontWeight: 700, fontSize: 15, pointerEvents: "none" }}>$</span>
                        <input
                          style={{ ...S.input, paddingLeft: 22 }}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={prodForm[k]}
                          onChange={e => {
                            // Solo permite números y punto — elimina cualquier $, letras, etc.
                            const val = e.target.value.replace(/[^0-9.]/g, "");
                            setProdForm({...prodForm,[k]:val});
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label style={S.label}>Precio mínimo <span style={{ fontWeight: 400, color: GRAY3 }}>(el piso hasta donde el vendedor puede bajar)</span></label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: GRAY3, fontWeight: 700, fontSize: 15, pointerEvents: "none" }}>$</span>
                      <input style={{ ...S.input, paddingLeft: 22 }} type="number" inputMode="decimal" min="0" step="0.01" placeholder="Opcional"
                        value={prodForm.precio_minimo ?? ""} onChange={e => setProdForm({...prodForm, precio_minimo: e.target.value.replace(/[^0-9.]/g, "")})} />
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Precio especial <span style={{ fontWeight: 400, color: GRAY3 }}>(el que puede ofrecer para cerrar una venta)</span></label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: GRAY3, fontWeight: 700, fontSize: 15, pointerEvents: "none" }}>$</span>
                      <input style={{ ...S.input, paddingLeft: 22 }} type="number" inputMode="decimal" min="0" step="0.01" placeholder="Opcional"
                        value={prodForm.precio_especial ?? ""} onChange={e => setProdForm({...prodForm, precio_especial: e.target.value.replace(/[^0-9.]/g, "")})} />
                    </div>
                  </div>
                  <div><label style={S.label}>Categoría</label>
                    <select style={{ ...S.input }} value={prodForm.categoria_id} onChange={e => setProdForm({...prodForm,categoria_id:Number(e.target.value)})}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div><label style={S.label}>¿A qué proveedor le compraste esta mercancía? (opcional, para tu análisis)</label>
                    <select style={{ ...S.input }} value={prodForm.proveedor_id || ""} onChange={e => setProdForm({...prodForm, proveedor_id: e.target.value ? Number(e.target.value) : null})}>
                      <option value="">Sin proveedor asignado</option>
                      {proveedores.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                    </select>
                  </div>
                  <div><label style={S.label}>Grupo Flex Pack (opcional — deja mezclar este producto con otros del mismo grupo)</label>
                    <select style={{ ...S.input }} value={prodForm.flexpack_grupo_id || ""} onChange={e => setProdForm({...prodForm, flexpack_grupo_id: e.target.value ? Number(e.target.value) : null})}>
                      <option value="">No participa en Flex Pack</option>
                      {flexpackGrupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 10, padding: "10px 14px" }}>
                    <input type="checkbox" id="tiene_stock_fisico" checked={!!prodForm.tiene_stock_fisico} onChange={e => setProdForm({...prodForm, tiene_stock_fisico: e.target.checked})} style={{ width: 18, height: 18 }} />
                    <label htmlFor="tiene_stock_fisico" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Tengo este producto en stock físico
                      <div style={{ fontSize: 11, color: GRAY3, fontWeight: 400 }}>Actívalo si ya tienes esta mercancía contigo, la hayas comprado a un proveedor o no — aplican los mismos bloqueos por stock que el resto del catálogo (agotado, límites de docena/media docena). Si todavía la compras bajo pedido, déjalo apagado.</div>
                    </label>
                  </div>
                  <div style={{ background: WHITE, border: `1.5px solid ${Number(prodForm.piezas_muestra) > 0 ? "#D97706" : GRAY2}`, borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" id="tiene_muestra" checked={Number(prodForm.piezas_muestra) > 0} onChange={e => setProdForm({...prodForm, piezas_muestra: e.target.checked ? 1 : 0})} style={{ width: 18, height: 18 }} />
                      <label htmlFor="tiene_muestra" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        Tiene una pieza abierta de muestra
                        <div style={{ fontSize: 11, color: GRAY3, fontWeight: 400 }}>Actívalo si abriste un perfume para que los clientes lo huelan. Esa pieza no se puede vender: la web la resta de la disponibilidad (el stock de Odoo no cambia).</div>
                      </label>
                    </div>
                    {Number(prodForm.piezas_muestra) > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginLeft: 28, fontSize: 13 }}>
                        <span>Piezas abiertas:</span>
                        <input type="number" min="1" step="1" value={prodForm.piezas_muestra} onChange={e => setProdForm({...prodForm, piezas_muestra: Math.max(1, Math.floor(Number(e.target.value) || 1))})} style={{ ...S.input, width: 80, marginBottom: 0, padding: "6px 8px" }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 10, padding: "10px 14px" }}>
                    <input type="checkbox" id="venta_por_unidad" checked={!!prodForm.venta_por_unidad} onChange={e => setProdForm({...prodForm, venta_por_unidad: e.target.checked})} style={{ width: 18, height: 18 }} />
                    <label htmlFor="venta_por_unidad" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Venta por unidad
                      <div style={{ fontSize: 11, color: GRAY3, fontWeight: 400 }}>La tarjeta sigue mostrando el precio por Docena primero (igual que siempre) — pero si el cliente elige "Pieza", puede comprar directo sin pasar por WhatsApp (ideal para no-ropa: perfumes, desechables, etc.)</div>
                    </label>
                  </div>
                  <div><label style={S.label}>Estado</label>
                    <select style={{ ...S.input }} value={prodForm.activo ? "1" : "0"} onChange={e => setProdForm({...prodForm,activo:e.target.value === "1"})}>
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </div>
                  <div><label style={S.label}>¿Producto destacado?</label>
                    <select style={{ ...S.input }} value={prodForm.destacado ? "1" : "0"} onChange={e => setProdForm({...prodForm,destacado:e.target.value === "1"})}>
                      <option value="0">No</option>
                      <option value="1">Sí — mostrar en inicio</option>
                    </select>
                  </div>
                </div>
                <label style={S.label}>Descripción</label>
                <input style={S.input} value={prodForm.descripcion} onChange={e => setProdForm({...prodForm,descripcion:e.target.value})} />
                <label style={S.label}>Imagen del producto</label>
                <div onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${GRAY2}`, borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer", marginBottom: 14, background: GRAY }}>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                  {prodForm.imagen_url
                    ? <img src={prodForm.imagen_url} alt="preview" style={{ width: 100, height: 100, objectFit: "contain", borderRadius: 8, margin: "0 auto" }} />
                    : <div style={{ color: GRAY3, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}><ImageIcon size={32} strokeWidth={1.5} /><span style={{ fontSize: 13 }}>{uploading ? "Subiendo imagen..." : "Click para subir una foto"}</span></div>
                  }
                </div>

                {/* VARIANTES: TALLAS Y COLORES */}
                <div style={{ background: GRAY, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 14 }}>Variantes (opcional)</div>

                  {/* TALLAS */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>¿Tiene tallas?</span>
                    <label style={{ position: "relative", display: "inline-block", width: 46, height: 26, cursor: "pointer" }}>
                      <input type="checkbox" checked={prodForm.tiene_tallas} onChange={e => setProdForm({...prodForm, tiene_tallas: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: "absolute", inset: 0, background: prodForm.tiene_tallas ? RED : GRAY3, borderRadius: 26, transition: "0.2s" }}>
                        <span style={{ position: "absolute", height: 20, width: 20, left: prodForm.tiene_tallas ? 23 : 3, top: 3, background: WHITE, borderRadius: "50%", transition: "0.2s" }} />
                      </span>
                    </label>
                  </div>
                  {prodForm.tiene_tallas && (
                    <ChipAdder valor={prodForm.tallas} onChange={v => setProdForm({...prodForm, tallas: v})} placeholder="Ej: S, M, L, XL..." color={RED} />
                  )}

                  {/* COLORES */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 8px" }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>¿Tiene colores?</span>
                    <label style={{ position: "relative", display: "inline-block", width: 46, height: 26, cursor: "pointer" }}>
                      <input type="checkbox" checked={prodForm.tiene_colores} onChange={e => setProdForm({...prodForm, tiene_colores: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: "absolute", inset: 0, background: prodForm.tiene_colores ? RED : GRAY3, borderRadius: 26, transition: "0.2s" }}>
                        <span style={{ position: "absolute", height: 20, width: 20, left: prodForm.tiene_colores ? 23 : 3, top: 3, background: WHITE, borderRadius: "50%", transition: "0.2s" }} />
                      </span>
                    </label>
                  </div>
                  {prodForm.tiene_colores && (
                    <SelectorColores valor={prodForm.colores} onChange={v => setProdForm({...prodForm, colores: v})} />
                  )}

                  {/* NOTAS DE FRAGANCIA (para perfumes) */}
                  <div style={{ margin: "18px 0 8px" }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Notas de fragancia <span style={{ fontWeight: 400, color: GRAY3 }}>(opcional, para perfumes)</span></span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    {NOTAS_FRAGANCIA.map(n => {
                      const seleccionadas = (prodForm.notas_fragancia || "").split(",").map(s => s.trim()).filter(Boolean);
                      const activa = seleccionadas.includes(n.nombre);
                      const Icono = n.icono;
                      return (
                        <button key={n.nombre} type="button" onClick={() => {
                          const nuevo = activa ? seleccionadas.filter(x => x !== n.nombre) : [...seleccionadas, n.nombre];
                          setProdForm({ ...prodForm, notas_fragancia: nuevo.join(",") });
                        }} className="oft-btn-press" style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 20,
                          border: `1.5px solid ${activa ? n.color : GRAY2}`, background: activa ? `${n.color}18` : WHITE,
                          color: activa ? n.color : GRAY3, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                        }}>
                          <Icono size={14} /> {n.nombre}
                        </button>
                      );
                    })}
                  </div>

                  {/* DISTRIBUCIÓN POR DOCENA (calcula la media docena automáticamente) */}
                  <DistribucionEditor prodForm={prodForm} setProdForm={setProdForm} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={handleSaveProd}><Save size={16} /> {editingId ? "Guardar cambios" : "Crear producto"}</button>
                  <button style={S.btnOutline} onClick={() => { setShowProdForm(false); setEditingId(null); }}>Cancelar</button>
                </div>
              </div>
            )}

            {/* ESTADO VACÍO: categoría sin productos, o búsqueda sin resultados */}
            {(() => {
              const lista = productosFiltrados;
              if (lista.length === 0) {
                const catNombre = filtroCategoria === "todas" ? "" : (categories.find(c => c.id === filtroCategoria)?.nombre || "");
                if (busquedaProductoQ) {
                  return (
                    <div style={{ background: WHITE, borderRadius: 16, padding: "40px 24px", border: `2px dashed ${GRAY2}`, textAlign: "center" }}>
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <Search size={28} color={GRAY3} strokeWidth={1.5} />
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Sin resultados para "{busquedaProducto}"</div>
                      <p style={{ fontSize: 14, color: GRAY3 }}>Revisa que la referencia esté bien escrita, o borra la búsqueda para ver todos.</p>
                    </div>
                  );
                }
                return (
                  <div style={{ background: WHITE, borderRadius: 16, padding: "40px 24px", border: `2px dashed ${GRAY2}`, textAlign: "center" }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <Package size={30} color={GRAY3} strokeWidth={1.5} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>
                      {filtroCategoria === "todas" ? "Aún no hay productos" : `No hay productos en "${catNombre}"`}
                    </div>
                    <p style={{ fontSize: 14, color: GRAY3, marginBottom: 20 }}>Sube productos a esta categoría ahora mismo.</p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      <button className="oft-btn-press" style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={() => { if (filtroCategoria !== "todas") setBulkImgCat(filtroCategoria); setShowBulkImg(true); setShowBulk(false); setShowProdForm(false); }}>
                        <ImageIcon size={16} /> Cargar fotos aquí
                      </button>
                      <button className="oft-btn-press" style={{ ...S.btnBlack, display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={() => { openNewProduct(); if (filtroCategoria !== "todas") setTimeout(() => setProdForm(f => ({ ...f, categoria_id: filtroCategoria })), 0); }}>
                        <Plus size={16} strokeWidth={2.5} /> Nuevo producto
                      </button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* TABLA (solo escritorio) */}
            {productosFiltrados.length > 0 && (
            <div className="oft-table-wrap oft-only-desktop" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
              <table style={S.table}>
                <thead><tr>{[...(selectMode ? ["✓"] : []), "Foto","Ref","Producto","Categoría","x1","x6","x12","Stock","Estado","Web","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {productosFiltrados.map(p => {
                    const isSel = selectedIds.includes(p.id);
                    return (
                    <tr key={p.id} style={{ background: isSel ? "#FFF5F5" : "transparent" }}>
                      {selectMode && (
                        <td style={S.td}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} style={{ width: 18, height: 18, accentColor: RED, cursor: "pointer" }} />
                        </td>
                      )}
                      <td style={S.td}>
                        {p.imagen_url ? <img src={imagenOptimizada(p.imagen_url, 150)} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={16} color={GRAY3} /></div>}
                      </td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{p.referencia || "—"}</td>
                      <td style={S.td}>
                        {p.nombre}
                        {p.proveedor_id && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: "#E7F1FF", color: "#004085", padding: "2px 7px", borderRadius: 10 }}>
                            {proveedores.find(pv => pv.id === p.proveedor_id)?.nombre || "Proveedor"}
                          </span>
                        )}
                      </td>
                      <td style={S.td}>{categories.find(c=>c.id===p.categoria_id)?.nombre || "-"}</td>
                      <td style={S.td}>${p.precio_pieza}</td>
                      <td style={S.td}>${p.precio_media_docena}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: RED }}>${p.precio_docena}</td>
                      <td style={S.td}>
                        {p.proveedor_id && !p.tiene_stock_fisico ? (
                          <span style={{ color: GRAY3, fontSize: 12 }}>Bajo pedido</span>
                        ) : p.stock_actualizado_at ? (
                          <span style={{ fontWeight: 700, color: Number(p.stock) > 5 ? "#155724" : Number(p.stock) > 0 ? "#856404" : RED }}>
                            {Number(p.stock) > 0 ? Number(p.stock) : "Agotado"}
                          </span>
                        ) : <span style={{ color: GRAY3, fontSize: 12 }}>Sin Odoo</span>}
                        {Number(p.piezas_reservadas) > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: "#7C3AED" }}>{Number(p.piezas_reservadas)} reservadas</div>}
                        {p.stock_actualizado_at && !(p.proveedor_id && !p.tiene_stock_fisico) && (
                          <div style={{ marginTop: 4 }}>
                            {Number(p.piezas_muestra) > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 2 }}>Web: {stockWeb(p) > 0 ? stockWeb(p) : "Agotado"} · {p.piezas_muestra} de muestra</div>}
                            <button onClick={() => guardarMuestra(p, Number(p.piezas_muestra) > 0 ? 0 : 1)} title={Number(p.piezas_muestra) > 0 ? "Quitar la muestra: vuelve a contar como disponible" : "Marcar que hay una pieza abierta de muestra"} style={{ background: Number(p.piezas_muestra) > 0 ? "#FEF3C7" : "none", border: `1px solid ${Number(p.piezas_muestra) > 0 ? "#D97706" : GRAY2}`, color: Number(p.piezas_muestra) > 0 ? "#92400E" : GRAY3, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Droplets size={11} /> {Number(p.piezas_muestra) > 0 ? "Quitar muestra" : "Muestra"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={S.td}><span style={{ background: p.activo ? "#D4EDDA" : GRAY2, color: p.activo ? "#155724" : BLACK, padding: "3px 8px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{p.activo ? "Activo" : "Borrador"}</span></td>
                      <td style={S.td}>
                        <button onClick={() => handleToggleWeb(p)} title={p.visible_web !== false ? "Visible en la web — clic para ocultar" : "Oculto de la web — clic para mostrar"}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: p.visible_web !== false ? "#155724" : GRAY3 }}>
                          {p.visible_web !== false ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEditProduct(p)} style={{ background: "none", border: `1px solid ${BLACK}`, color: BLACK, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><PencilIcon size={13} /> Editar</button>
                          <button style={{ ...S.btnOutline, padding: "4px 10px", fontSize: 12 }} onClick={() => handleToggleWeb(p)}>{p.visible_web !== false ? "Ocultar" : "Mostrar"}</button>
                          <button onClick={() => handleDelete(p)} style={{ background: "none", border: `1px solid ${RED}`, color: RED, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center" }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}

            {/* TARJETAS (solo celular) */}
            <div className="oft-only-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {productosFiltrados.map(p => {
                const isSel = selectedIds.includes(p.id);
                return (
                  <div key={p.id} style={{ background: WHITE, borderRadius: 14, border: `2px solid ${isSel ? RED : GRAY2}`, padding: 14 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {selectMode && (
                        <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} style={{ width: 22, height: 22, accentColor: RED, cursor: "pointer", flexShrink: 0, marginTop: 2 }} />
                      )}
                      {p.imagen_url
                        ? <img src={imagenOptimizada(p.imagen_url, 150)} style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                        : <div style={{ width: 60, height: 60, borderRadius: 10, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Package size={24} color={GRAY3} /></div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2, marginBottom: 2 }}>{p.nombre}</div>
                        <div style={{ fontSize: 12, color: GRAY3 }}>REF: {p.referencia || "—"} · {categories.find(c=>c.id===p.categoria_id)?.nombre || "-"}</div>
                        <span style={{ display: "inline-block", marginTop: 6, background: p.activo ? "#D4EDDA" : GRAY2, color: p.activo ? "#155724" : BLACK, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{p.activo ? "Activo" : "Borrador"}</span>
                      </div>
                    </div>

                    {/* Precios */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "12px 0", background: GRAY, borderRadius: 10, padding: 10 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: GRAY3, fontWeight: 600 }}>Pieza</div>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>${p.precio_pieza}</div>
                      </div>
                      <div style={{ textAlign: "center", borderLeft: `1px solid ${GRAY2}`, borderRight: `1px solid ${GRAY2}` }}>
                        <div style={{ fontSize: 10, color: GRAY3, fontWeight: 600 }}>½ Doc</div>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>${p.precio_media_docena}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: GRAY3, fontWeight: 600 }}>Docena</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: RED }}>${p.precio_docena}</div>
                      </div>
                    </div>

                    {/* Stock + Visibilidad web */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, fontSize: 12 }}>
                      <span style={{ color: GRAY3 }}>
                        Stock: {p.stock_actualizado_at
                          ? <strong style={{ color: Number(p.stock) > 5 ? "#155724" : Number(p.stock) > 0 ? "#856404" : RED }}>{Number(p.stock) > 0 ? Number(p.stock) : "Agotado"}</strong>
                          : <span style={{ color: GRAY3 }}>Sin Odoo</span>}
                        <EtiquetaReservadas p={p} />
                        {p.stock_actualizado_at && Number(p.piezas_muestra) > 0 && <span style={{ color: "#92400E", fontWeight: 700 }}> · Web: {stockWeb(p) > 0 ? stockWeb(p) : "Agotado"} ({p.piezas_muestra} de muestra)</span>}
                        {p.stock_actualizado_at && !(p.proveedor_id && !p.tiene_stock_fisico) && (
                          <button onClick={() => guardarMuestra(p, Number(p.piezas_muestra) > 0 ? 0 : 1)} style={{ marginLeft: 8, background: Number(p.piezas_muestra) > 0 ? "#FEF3C7" : "none", border: `1px solid ${Number(p.piezas_muestra) > 0 ? "#D97706" : GRAY2}`, color: Number(p.piezas_muestra) > 0 ? "#92400E" : GRAY3, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Droplets size={11} /> {Number(p.piezas_muestra) > 0 ? "Quitar muestra" : "Muestra"}
                          </button>
                        )}
                      </span>
                      <button onClick={() => handleToggleWeb(p)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: p.visible_web !== false ? "#155724" : GRAY3, fontSize: 12, fontWeight: 700 }}>
                        {p.visible_web !== false ? <Eye size={15} /> : <EyeOff size={15} />} {p.visible_web !== false ? "Visible en web" : "Oculto de web"}
                      </button>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEditProduct(p)} style={{ flex: 1, background: BLACK, color: WHITE, border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><PencilIcon size={15} /> Editar</button>
                      <button onClick={() => handleToggleWeb(p)} style={{ ...S.btnOutline, padding: "10px 14px", fontSize: 13 }}>{p.visible_web !== false ? "Ocultar" : "Mostrar"}</button>
                      <button onClick={() => handleDelete(p)} style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 8, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN MASIVA */}
            {showBulkDelete && createPortal(
              <div className="oft-overlay" style={S.overlay} onClick={() => setShowBulkDelete(false)}>
                <div className="oft-modal-sheet oft-qv-pop" style={{ ...S.modal, maxWidth: 420, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Trash2 size={30} color={RED} />
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 8 }}>¿Eliminar {selectedIds.length} producto(s)?</div>
                  <p style={{ fontSize: 14, color: GRAY3, marginBottom: 22, lineHeight: 1.5 }}>
                    Esta acción <strong>no se puede deshacer</strong>. Los productos seleccionados se borrarán permanentemente del catálogo.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={{ ...S.btnOutline, flex: 1, justifyContent: "center", padding: 14 }} onClick={() => setShowBulkDelete(false)}>Cancelar</button>
                    <button style={{ flex: 1, background: RED, color: WHITE, border: "none", borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: bulkDeleteLoading ? 0.7 : 1 }} onClick={handleBulkDelete} disabled={bulkDeleteLoading}>
                      <Trash2 size={16} /> {bulkDeleteLoading ? "Eliminando..." : "Sí, eliminar"}
                    </button>
                  </div>
                </div>
              </div>
            , document.body)}

            {/* MODAL DE EDICIÓN MASIVA */}
            {showBulkEdit && createPortal(
              <div className="oft-overlay" style={S.overlay} onClick={() => setShowBulkEdit(false)}>
                <div className="oft-modal-sheet oft-qv-pop" style={{ ...S.modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><PencilIcon size={18} color={RED} /> Editar {selectedIds.length} producto(s)</div>
                    <button onClick={() => setShowBulkEdit(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
                  </div>
                  <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>Solo se cambian los campos que llenes. Los vacíos se quedan igual.</p>
                  <label style={S.label}>Nombre del producto</label>
                  <input style={S.input} placeholder="(dejar vacío para no cambiar)" value={bulkEdit.nombre} onChange={e => setBulkEdit({...bulkEdit, nombre: e.target.value})} />
                  <label style={S.label}>Categoría</label>
                  <select style={S.input} value={bulkEdit.categoria_id} onChange={e => setBulkEdit({...bulkEdit, categoria_id: e.target.value})}>
                    <option value="">No cambiar</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <div className="oft-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div><label style={S.label}>Precio pieza</label><input style={S.input} placeholder="—" value={bulkEdit.precio_pieza} onChange={e => setBulkEdit({...bulkEdit, precio_pieza: e.target.value})} /></div>
                    <div><label style={S.label}>Media docena</label><input style={S.input} placeholder="—" value={bulkEdit.precio_media_docena} onChange={e => setBulkEdit({...bulkEdit, precio_media_docena: e.target.value})} /></div>
                    <div><label style={S.label}>Docena</label><input style={S.input} placeholder="—" value={bulkEdit.precio_docena} onChange={e => setBulkEdit({...bulkEdit, precio_docena: e.target.value})} /></div>
                  </div>
                  <label style={S.label}>Badge</label>
                  <input style={S.input} placeholder="NUEVO, OFERTA... (vacío = no cambiar)" value={bulkEdit.badge} onChange={e => setBulkEdit({...bulkEdit, badge: e.target.value})} />
                  <label style={S.label}>Descripción</label>
                  <input style={S.input} placeholder="(dejar vacío para no cambiar)" value={bulkEdit.descripcion} onChange={e => setBulkEdit({...bulkEdit, descripcion: e.target.value})} />
                  <label style={S.label}>Estado</label>
                  <select style={S.input} value={bulkEdit.activo} onChange={e => setBulkEdit({...bulkEdit, activo: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="1">Activo (visible)</option>
                    <option value="0">Borrador (oculto)</option>
                  </select>
                  <label style={S.label}>Producto destacado</label>
                  <select style={S.input} value={bulkEdit.destacado} onChange={e => setBulkEdit({...bulkEdit, destacado: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="1">Sí — mostrar en inicio</option>
                    <option value="0">No destacado</option>
                  </select>
                  <label style={S.label}>¿A qué proveedor se lo compraste?</label>
                  <select style={S.input} value={bulkEdit.proveedor_id} onChange={e => setBulkEdit({...bulkEdit, proveedor_id: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="__ninguno__">Quitar proveedor asignado</option>
                    {proveedores.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                  </select>
                  <label style={S.label}>Grupo Flex Pack</label>
                  <select style={S.input} value={bulkEdit.flexpack_grupo_id} onChange={e => setBulkEdit({...bulkEdit, flexpack_grupo_id: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="__ninguno__">Quitar de Flex Pack</option>
                    {flexpackGrupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                  <label style={S.label}>Tengo stock físico</label>
                  <select style={S.input} value={bulkEdit.tiene_stock_fisico} onChange={e => setBulkEdit({...bulkEdit, tiene_stock_fisico: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="1">Sí, ya lo tengo en stock — aplicar bloqueos por stock</option>
                    <option value="0">No, sigue siendo bajo pedido</option>
                  </select>

                  {/* TALLAS */}
                  <label style={S.label}>Tallas</label>
                  <select style={S.input} value={bulkEdit.tiene_tallas} onChange={e => setBulkEdit({...bulkEdit, tiene_tallas: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="1">Activar tallas</option>
                    <option value="0">Desactivar tallas</option>
                  </select>
                  {bulkEdit.tiene_tallas === "1" && (
                    <ChipAdder valor={bulkEdit.tallas} onChange={v => setBulkEdit({...bulkEdit, tallas: v})} placeholder="Ej: S, M, L, XL..." color={RED} />
                  )}

                  {/* COLORES */}
                  <label style={{ ...S.label, marginTop: 12 }}>Colores</label>
                  <select style={S.input} value={bulkEdit.tiene_colores} onChange={e => setBulkEdit({...bulkEdit, tiene_colores: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="1">Activar colores</option>
                    <option value="0">Desactivar colores</option>
                  </select>
                  {bulkEdit.tiene_colores === "1" && (
                    <SelectorColores valor={bulkEdit.colores} onChange={v => setBulkEdit({...bulkEdit, colores: v})} />
                  )}

                  {/* DISTRIBUCIÓN POR DOCENA — se aplica igual a todos los seleccionados */}
                  {(bulkEdit.tiene_tallas === "1" || bulkEdit.tiene_colores === "1") ? (
                    <>
                      <p style={{ fontSize: 12, color: GRAY3, margin: "10px 0 0" }}>
                        Esta misma distribución se aplicará a los <strong>{selectedIds.length}</strong> productos seleccionados (útil si son el mismo modelo en distintos colores, con la misma corrida de tallas).
                      </p>
                      <DistribucionEditor
                        prodForm={bulkEdit}
                        setProdForm={setBulkEdit}
                        activaTallas={bulkEdit.tiene_tallas === "1"}
                        activaColores={bulkEdit.tiene_colores === "1"}
                      />
                    </>
                  ) : null}

                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: bulkEditLoading ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={handleBulkEdit} disabled={bulkEditLoading}>
                      <Save size={16} /> {bulkEditLoading ? "Guardando..." : "Aplicar cambios"}
                    </button>
                    <button style={S.btnOutline} onClick={() => setShowBulkEdit(false)}>Cancelar</button>
                  </div>
                </div>
              </div>
            , document.body)}
          </>
        )}

        {/* ═══════════ CATEGORÍAS ═══════════ */}
        {tab === "categories" && esAdminCompleto && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><FolderOpen size={24} color={RED} /> Categorías</div>
            <div style={{ background: WHITE, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${GRAY2}`, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={S.label}>Nueva categoría</label>
                <input style={{ ...S.input, marginBottom: 0 }} placeholder="Ej: Gorras, Ropa Deportiva..." value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCategory()} />
              </div>
              <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6, height: 42 }} onClick={handleAddCategory}><FolderPlus size={16} /> Agregar categoría</button>
            </div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>Haz click en el icono de cada categoría para subir tu propia imagen. Asígnale un "Grupo" a varias categorías relacionadas (ej. "Ropa de Dama") para que en la web el cliente las vea agrupadas, en vez de una lista larga suelta.</p>

            {/* ORDEN DE LAS CATEGORÍAS */}
            <div style={{ fontSize: 18, fontWeight: 900, margin: "8px 0 6px", display: "flex", alignItems: "center", gap: 8 }}><ChevronUp size={20} color={RED} /> Orden de las categorías</div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>Este orden es el que usa "Destacados" en la página de inicio para decidir qué categoría aparece primero (ej. Jeans Hombre, luego Perfumería, y así sucesivamente).</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480, marginBottom: 36 }}>
              {[...categories].sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre)).map((c, idx, arr) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, background: WHITE, borderRadius: 12, padding: 10, border: `1px solid ${GRAY2}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CategoryIcon cat={c} size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                    <button onClick={() => handleMoveCategoria(c, "arriba")} disabled={idx === 0} title="Subir" style={{ background: GRAY, border: "none", borderRadius: 6, width: 26, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.35 : 1 }}><ChevronUp size={14} /></button>
                    <button onClick={() => handleMoveCategoria(c, "abajo")} disabled={idx === arr.length - 1} title="Bajar" style={{ background: GRAY, border: "none", borderRadius: 6, width: 26, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: idx === arr.length - 1 ? "default" : "pointer", opacity: idx === arr.length - 1 ? 0.35 : 1 }}><ChevronDown size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <datalist id="grupos-existentes">
              {gruposCategorias.map(g => <option key={g.id} value={g.nombre} />)}
            </datalist>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16 }}>
              {categories.map(c => {
                const grupoDeEsta = gruposCategorias.find(g => g.id === c.grupo_id);
                return (
                <div key={c.id} style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${GRAY2}`, position: "relative" }}>
                  <button onClick={() => handleDeleteCategory(c)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: GRAY3, cursor: "pointer", display: "flex" }} title="Eliminar"><Trash2 size={15} /></button>
                  <div
                    onClick={() => { setCatUploading(null); catFileRef.current.dataset.catId = c.id; catFileRef.current?.click(); }}
                    style={{ marginBottom: 8, cursor: "pointer", width: 56, height: 56, borderRadius: 10, border: `2px dashed ${GRAY2}`, display: "flex", alignItems: "center", justifyContent: "center", background: GRAY }}
                    title="Cambiar icono"
                  >
                    {catUploading === c.id ? <RefreshCw size={20} className="spin" color={GRAY3} /> : <CategoryIcon cat={c} size={32} />}
                  </div>
                  <div style={{ fontWeight: 800 }}>{c.nombre}</div>
                  <div style={{ fontSize: 12, color: GRAY3, marginBottom: 10 }}>{products.filter(p=>p.categoria_id===c.id).length} productos</div>
                  <label style={{ fontSize: 11, color: GRAY3, fontWeight: 700, display: "block", marginBottom: 3 }}>Grupo (opcional)</label>
                  <input
                    list="grupos-existentes"
                    defaultValue={grupoDeEsta?.nombre || ""}
                    placeholder="Ej: Ropa de Dama"
                    onBlur={e => { if (e.target.value.trim() !== (grupoDeEsta?.nombre || "")) handleUpdateCategoriaGrupo(c, e.target.value); }}
                    style={{ ...S.input, marginBottom: 0, fontSize: 12, padding: "6px 10px" }}
                  />
                </div>
                );
              })}
            </div>

            {/* ÍCONOS DE LOS GRUPOS */}
            {gruposCategorias.length > 0 && (
              <>
                <div style={{ fontSize: 18, fontWeight: 900, margin: "36px 0 6px", display: "flex", alignItems: "center", gap: 8 }}><LayoutGrid size={20} color={RED} /> Grupos: orden e íconos</div>
                <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>Usa las flechas para elegir en qué orden aparecen los grupos en la web. Por defecto, cada grupo usa el ícono de su primera categoría — súbele una imagen propia si quieres que se vea distinto.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
                  {[...gruposCategorias].sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre)).map((g, idx, arr) => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 14, background: WHITE, borderRadius: 12, padding: 12, border: `1px solid ${GRAY2}` }}>
                      <div
                        onClick={() => { setGrupoUploading(null); grupoFileRef.current.dataset.grupoId = g.id; grupoFileRef.current?.click(); }}
                        style={{ cursor: "pointer", width: 46, height: 46, borderRadius: 9, border: `2px dashed ${GRAY2}`, display: "flex", alignItems: "center", justifyContent: "center", background: GRAY, flexShrink: 0 }}
                        title="Cambiar icono del grupo"
                      >
                        {grupoUploading === g.id ? <RefreshCw size={18} className="spin" color={GRAY3} /> : (
                          g.icono_url ? <img src={g.icono_url} style={{ width: 26, height: 26, objectFit: "contain", borderRadius: 5 }} /> : <LayoutGrid size={22} color={GRAY3} strokeWidth={1.5} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.nombre}</div>
                        <div style={{ fontSize: 12, color: GRAY3 }}>{categories.filter(c => c.grupo_id === g.id).length} categorías</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                        <button onClick={() => handleMoveGrupo(g, "arriba")} disabled={idx === 0} title="Subir" style={{ background: GRAY, border: "none", borderRadius: 6, width: 26, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.35 : 1 }}><ChevronUp size={14} /></button>
                        <button onClick={() => handleMoveGrupo(g, "abajo")} disabled={idx === arr.length - 1} title="Bajar" style={{ background: GRAY, border: "none", borderRadius: 6, width: 26, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: idx === arr.length - 1 ? "default" : "pointer", opacity: idx === arr.length - 1 ? 0.35 : 1 }}><ChevronDown size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <input ref={grupoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                  const grupoId = Number(e.target.dataset.grupoId);
                  const grupo = gruposCategorias.find(g => g.id === grupoId);
                  if (grupo) handleGrupoIconUpload(e, grupo);
                  e.target.value = "";
                }} />
              </>
            )}
            {/* input oculto compartido para subir icono */}
            <input ref={catFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
              const catId = Number(e.target.dataset.catId);
              const cat = categories.find(c => c.id === catId);
              if (cat) handleCatIconUpload(e, cat);
              e.target.value = "";
            }} />
          </>
        )}

        {/* ═══════════ BANNERS PROMOCIONALES (CARRUSEL DEL INICIO) ═══════════ */}
        {/* ═══════════ ANALÍTICA WEB ═══════════ */}
        {tab === "analytics" && esAdminCompleto && <AnalyticsPanel />}

        {tab === "banners" && esAdminCompleto && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Banners del inicio</div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 20 }}>
              El carrusel que ven los clientes al entrar a tu web. Cada banner puede llevar a un producto específico, una categoría, el catálogo completo, o un link externo. Usa las flechas para elegir el orden.
            </p>

            <button
              onClick={() => bannerNuevoFileRef.current?.click()}
              disabled={bannerUploading}
              style={{ ...S.btnRed, marginBottom: 24, opacity: bannerUploading ? 0.6 : 1 }}
            >
              {bannerUploading ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />} Agregar banner
            </button>
            <input ref={bannerNuevoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { handleBannerNuevo(e); e.target.value = ""; }} />
            <input ref={bannerReemplazoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
              const bannerId = Number(e.target.dataset.bannerId);
              const banner = banners.find(b => b.id === bannerId);
              if (banner) handleBannerReemplazarImagen(e, banner);
              e.target.value = "";
            }} />

            {banners.length === 0 ? (
              <p style={{ color: GRAY3, fontSize: 14 }}>Todavía no has agregado ningún banner.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 780 }}>
                {[...banners].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((b, idx, arr) => (
                  <div key={b.id} style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 12, padding: 16, display: "flex", gap: 16, opacity: b.activo ? 1 : 0.55 }}>
                    <div
                      onClick={() => { bannerReemplazoFileRef.current.dataset.bannerId = b.id; bannerReemplazoFileRef.current?.click(); }}
                      title="Cambiar imagen"
                      className="oft-banner-thumb"
                      style={{ width: 140, height: 80, borderRadius: 8, overflow: "hidden", cursor: "pointer", flexShrink: 0, background: GRAY, position: "relative" }}
                    >
                      <img src={imagenOptimizada(b.imagen_url, 300)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", opacity: 0, transition: "opacity 0.15s" }} className="oft-banner-hover-overlay">
                        <PencilIcon size={16} color={WHITE} />
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input defaultValue={b.titulo || ""} placeholder="Título (opcional)" onBlur={e => { if (e.target.value !== (b.titulo || "")) handleUpdateBanner(b, { titulo: e.target.value.trim() || null }); }} style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1 }} />
                        <input defaultValue={b.subtitulo || ""} placeholder="Subtítulo (opcional)" onBlur={e => { if (e.target.value !== (b.subtitulo || "")) handleUpdateBanner(b, { subtitulo: e.target.value.trim() || null }); }} style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select value={b.destino_tipo} onChange={e => handleUpdateBanner(b, { destino_tipo: e.target.value, destino_valor: null })} style={{ ...S.input, marginBottom: 0, fontSize: 13, width: 160 }}>
                          <option value="catalogo">→ Catálogo completo</option>
                          <option value="ofertas">→ Página de ofertas</option>
                          <option value="categoria">→ Una categoría</option>
                          <option value="producto">→ Un producto</option>
                          <option value="url">→ Link externo</option>
                        </select>
                        {b.destino_tipo === "categoria" && (
                          <select value={b.destino_valor || ""} onChange={e => handleUpdateBanner(b, { destino_valor: e.target.value })} style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1, minWidth: 160 }}>
                            <option value="">Elige una categoría...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        )}
                        {b.destino_tipo === "producto" && (() => {
                          const etiquetaDe = (p) => `${p.referencia ? p.referencia + " — " : ""}${p.nombre}`;
                          const productoActual = products.find(p => String(p.id) === String(b.destino_valor));
                          return (
                            <>
                              <datalist id={`productos-banner-${b.id}`}>
                                {products.filter(p => p.activo).map(p => <option key={p.id} value={etiquetaDe(p)} />)}
                              </datalist>
                              <input
                                list={`productos-banner-${b.id}`}
                                defaultValue={productoActual ? etiquetaDe(productoActual) : ""}
                                placeholder="Escribe el nombre o la referencia..."
                                onBlur={e => {
                                  const texto = e.target.value.trim();
                                  if (texto === "") { handleUpdateBanner(b, { destino_valor: null }); return; }
                                  const encontrado = products.find(p => etiquetaDe(p) === texto);
                                  if (encontrado) handleUpdateBanner(b, { destino_valor: encontrado.id });
                                  else e.target.value = productoActual ? etiquetaDe(productoActual) : ""; // no coincide con nada -- regresa al último válido
                                }}
                                style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1, minWidth: 160 }}
                              />
                            </>
                          );
                        })()}
                        {b.destino_tipo === "url" && (
                          <input defaultValue={b.destino_valor || ""} placeholder="https://..." onBlur={e => { if (e.target.value !== (b.destino_valor || "")) handleUpdateBanner(b, { destino_valor: e.target.value.trim() }); }} style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1, minWidth: 160 }} />
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: b.activo ? "#0F6E56" : GRAY3, cursor: "pointer" }}>
                        <input type="checkbox" checked={b.activo} onChange={e => handleUpdateBanner(b, { activo: e.target.checked })} />
                        {b.activo ? "Activo" : "Apagado"}
                      </label>
                      <div style={{ display: "flex", gap: 3 }}>
                        <button onClick={() => handleMoveBanner(b, "arriba")} disabled={idx === 0} title="Subir" style={{ background: GRAY, border: "none", borderRadius: 6, width: 26, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.35 : 1 }}><ChevronUp size={14} /></button>
                        <button onClick={() => handleMoveBanner(b, "abajo")} disabled={idx === arr.length - 1} title="Bajar" style={{ background: GRAY, border: "none", borderRadius: 6, width: 26, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: idx === arr.length - 1 ? "default" : "pointer", opacity: idx === arr.length - 1 ? 0.35 : 1 }}><ChevronDown size={14} /></button>
                      </div>
                      <button onClick={() => handleDeleteBanner(b)} title="Eliminar" style={{ background: "none", border: "none", color: GRAY3, cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════ POP-UPS PROMOCIONALES ═══════════ */}
        {tab === "popups" && esAdminCompleto && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Pop-ups</div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 20 }}>
              Ventanas que aparecen solas al entrar a tu web — para descuentos, eventos o anuncios. Se muestran solo una vez por visita (no se repiten a cada rato). Si tienes varios activos, solo aparece el primero según el orden.
            </p>

            <button onClick={handlePopupNuevo} className="oft-btn-press" style={{ ...S.btnRed, marginBottom: 24 }}>
              <Plus size={16} /> Crear pop-up
            </button>
            <input ref={popupReemplazoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
              const popupId = Number(e.target.dataset.popupId);
              const popup = popups.find(p => p.id === popupId);
              if (popup) handlePopupImagen(e, popup);
              e.target.value = "";
            }} />

            {popups.length === 0 ? (
              <p style={{ color: GRAY3, fontSize: 14 }}>Todavía no has creado ningún pop-up.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 780 }}>
                {[...popups].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((p, idx, arr) => {
                  const etiquetaDe = (prod) => `${prod.referencia ? prod.referencia + " — " : ""}${prod.nombre}`;
                  const productoActual = products.find(pr => String(pr.id) === String(p.destino_valor));
                  return (
                  <div key={p.id} style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 12, padding: 16, opacity: p.activo ? 1 : 0.55 }}>
                    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                      <div
                        onClick={() => { popupReemplazoFileRef.current.dataset.popupId = p.id; popupReemplazoFileRef.current?.click(); }}
                        title="Agregar/cambiar imagen"
                        className="oft-banner-thumb"
                        style={{ width: 100, height: 100, borderRadius: 8, overflow: "hidden", cursor: "pointer", flexShrink: 0, background: GRAY, position: "relative", border: `1px dashed ${GRAY2}`, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        {popupUploading ? <RefreshCw size={18} className="spin" color={GRAY3} /> : (
                          p.imagen_url
                            ? <img src={imagenOptimizada(p.imagen_url, 200)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <ImageIcon size={22} color={GRAY3} strokeWidth={1.5} />
                        )}
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", opacity: 0, transition: "opacity 0.15s" }} className="oft-banner-hover-overlay">
                          <PencilIcon size={16} color={WHITE} />
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                        <input defaultValue={p.titulo || ""} placeholder="Título" onBlur={e => { if (e.target.value.trim() !== (p.titulo || "")) handleUpdatePopup(p, { titulo: e.target.value.trim() }); }} style={{ ...S.input, marginBottom: 0, fontSize: 14, fontWeight: 700 }} />
                        <textarea defaultValue={p.mensaje || ""} placeholder="Mensaje (opcional)" rows={2} onBlur={e => { if (e.target.value.trim() !== (p.mensaje || "")) handleUpdatePopup(p, { mensaje: e.target.value.trim() || null }); }} style={{ ...S.input, marginBottom: 0, fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
                        {p.imagen_url && (
                          <button onClick={() => handleQuitarImagenPopup(p)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: GRAY3, fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Quitar imagen</button>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: p.activo ? "#0F6E56" : GRAY3, cursor: "pointer" }}>
                          <input type="checkbox" checked={p.activo} onChange={e => handleUpdatePopup(p, { activo: e.target.checked })} />
                          {p.activo ? "Activo" : "Apagado"}
                        </label>
                        <div style={{ display: "flex", gap: 3 }}>
                          <button onClick={() => handleMovePopup(p, "arriba")} disabled={idx === 0} title="Subir" style={{ background: GRAY, border: "none", borderRadius: 6, width: 26, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.35 : 1 }}><ChevronUp size={14} /></button>
                          <button onClick={() => handleMovePopup(p, "abajo")} disabled={idx === arr.length - 1} title="Bajar" style={{ background: GRAY, border: "none", borderRadius: 6, width: 26, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: idx === arr.length - 1 ? "default" : "pointer", opacity: idx === arr.length - 1 ? 0.35 : 1 }}><ChevronDown size={14} /></button>
                        </div>
                        <button onClick={() => handleDeletePopup(p)} title="Eliminar" style={{ background: "none", border: "none", color: GRAY3, cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${GRAY}`, paddingTop: 12 }}>
                      <select value={p.destino_tipo || ""} onChange={e => handleUpdatePopup(p, { destino_tipo: e.target.value || null, destino_valor: null })} style={{ ...S.input, marginBottom: 0, fontSize: 13, width: 180 }}>
                        <option value="">Sin botón (solo aviso)</option>
                        <option value="catalogo">Botón → Catálogo completo</option>
                        <option value="ofertas">Botón → Página de ofertas</option>
                        <option value="categoria">Botón → Una categoría</option>
                        <option value="producto">Botón → Un producto</option>
                        <option value="url">Botón → Link externo</option>
                      </select>
                      {p.destino_tipo === "categoria" && (
                        <select value={p.destino_valor || ""} onChange={e => handleUpdatePopup(p, { destino_valor: e.target.value })} style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1, minWidth: 160 }}>
                          <option value="">Elige una categoría...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      )}
                      {p.destino_tipo === "producto" && (
                        <>
                          <datalist id={`productos-popup-${p.id}`}>
                            {products.filter(pr => pr.activo).map(pr => <option key={pr.id} value={etiquetaDe(pr)} />)}
                          </datalist>
                          <input
                            list={`productos-popup-${p.id}`}
                            defaultValue={productoActual ? etiquetaDe(productoActual) : ""}
                            placeholder="Escribe el nombre o la referencia..."
                            onBlur={e => {
                              const texto = e.target.value.trim();
                              if (texto === "") { handleUpdatePopup(p, { destino_valor: null }); return; }
                              const encontrado = products.find(pr => etiquetaDe(pr) === texto);
                              if (encontrado) handleUpdatePopup(p, { destino_valor: encontrado.id });
                              else e.target.value = productoActual ? etiquetaDe(productoActual) : "";
                            }}
                            style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1, minWidth: 160 }}
                          />
                        </>
                      )}
                      {p.destino_tipo === "url" && (
                        <input defaultValue={p.destino_valor || ""} placeholder="https://..." onBlur={e => { if (e.target.value.trim() !== (p.destino_valor || "")) handleUpdatePopup(p, { destino_valor: e.target.value.trim() }); }} style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1, minWidth: 160 }} />
                      )}
                      {p.destino_tipo && (
                        <input defaultValue={p.texto_boton || ""} placeholder="Texto del botón" onBlur={e => { if (e.target.value.trim() !== (p.texto_boton || "")) handleUpdatePopup(p, { texto_boton: e.target.value.trim() || "Ver más" }); }} style={{ ...S.input, marginBottom: 0, fontSize: 13, width: 160 }} />
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════ DESCUENTOS ═══════════ */}
        {tab === "ofertas" && esAdminCompleto && <OfertasAdmin />}
        {tab === "fraude" && esAdminCompleto && <FraudePanel onCambio={cargarRiesgos} />}
        {tab === "metricas" && esAdminCompleto && <MetricasPanel desde={rangoMetricasISO[0]} hasta={rangoMetricasISO[1]} filtro={renderFiltroPeriodo()} />}
        {tab === "finanzas" && esAdminCompleto && <FinanzasPanel desde={rangoMetricasISO[0]} hasta={rangoMetricasISO[1]} filtro={renderFiltroPeriodo()} productos={products} onCostosCambio={() => setCostosVer(v => v + 1)} />}

        {tab === "descuentos" && esAdminCompleto && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Zap size={24} color={RED} /> Descuentos</div>
              <button onClick={abrirNuevoDescuento} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 18px", fontSize: 14 }}>
                <Plus size={16} /> Crear descuento
              </button>
            </div>

            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 20, maxWidth: 560 }}>
              Crea códigos de descuento que tus clientes pueden usar al pagar. Pueden aplicar a <strong>toda la tienda</strong> o a <strong>productos seleccionados</strong>.
            </p>

            {/* LISTA DE DESCUENTOS */}
            {descuentos.length === 0 ? (
              <div style={{ background: WHITE, border: `1px dashed ${GRAY2}`, borderRadius: 14, padding: 40, textAlign: "center", color: GRAY3 }}>
                <Zap size={36} color={GRAY3} strokeWidth={1.4} style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Aún no tienes descuentos</div>
                <div style={{ fontSize: 13 }}>Crea tu primer código de descuento con el botón de arriba.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {descuentos.map((d, i) => (
                  <div key={d.id} className="oft-widget" style={{ background: WHITE, borderRadius: 14, border: `1px solid ${d.activo ? RED : GRAY2}`, padding: 18, transition: "transform 0.2s, box-shadow 0.2s", animationDelay: `${i * 0.05}s`, opacity: d.activo ? 1 : 0.65 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: RED, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
                          {d.codigo}
                          <button onClick={() => { navigator.clipboard?.writeText(d.codigo); showToast("Código copiado"); }} title="Copiar" style={{ background: "none", border: "none", cursor: "pointer", color: GRAY3, display: "flex" }}><FileText size={14} /></button>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{d.porcentaje}% OFF</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 8, background: d.activo ? "#D4EDDA" : GRAY2, color: d.activo ? "#155724" : GRAY3 }}>
                        {d.activo ? "ACTIVO" : "PAUSADO"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>
                      {d.tipo_aplicacion === "tienda"
                        ? <><ShoppingBag size={13} /> Toda la tienda</>
                        : <><Tag size={13} /> {(d.productos_ids || []).length} producto(s) seleccionado(s)</>
                      }
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => toggleDescuento(d)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: WHITE, color: BLACK, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {d.activo ? "Pausar" : "Activar"}
                      </button>
                      <button onClick={() => setDescForm({ id: d.id, codigo: d.codigo, tipo_aplicacion: d.tipo_aplicacion, porcentaje: String(d.porcentaje), productos_ids: d.productos_ids || [], activo: d.activo })} className="oft-btn-press" style={{ justifyContent: "center", background: "none", color: BLACK, border: `1.5px solid ${BLACK}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <PencilIcon size={13} />
                      </button>
                      <button onClick={() => eliminarDescuento(d)} className="oft-btn-press" style={{ justifyContent: "center", background: "none", color: RED, border: `1.5px solid ${RED}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MODAL CREAR / EDITAR DESCUENTO */}
            {descForm && (
              <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 16px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onClick={() => !guardandoDesc && setDescForm(null)}>
                <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 460, width: "92%", margin: "0 auto", padding: 24 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><Zap size={18} color={RED} /> {descForm.id ? "Editar" : "Nuevo"} descuento</div>
                    <button onClick={() => setDescForm(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
                  </div>

                  <label style={S.label}>Código del descuento *</label>
                  <input style={{ ...S.input, textTransform: "uppercase", fontWeight: 800, letterSpacing: 1 }} placeholder="Ej: VERANO10" value={descForm.codigo} onChange={e => setDescForm({ ...descForm, codigo: e.target.value.toUpperCase() })} />

                  <label style={S.label}>Porcentaje de descuento (%) *</label>
                  <input type="number" min="1" max="100" style={S.input} placeholder="Ej: 10" value={descForm.porcentaje} onChange={e => setDescForm({ ...descForm, porcentaje: e.target.value })} />

                  <label style={S.label}>¿A qué aplica?</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div onClick={() => setDescForm({ ...descForm, tipo_aplicacion: "tienda" })}
                      style={{ border: `2px solid ${descForm.tipo_aplicacion === "tienda" ? RED : GRAY2}`, background: descForm.tipo_aplicacion === "tienda" ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "center" }}>
                      <ShoppingBag size={24} color={descForm.tipo_aplicacion === "tienda" ? RED : GRAY3} strokeWidth={1.6} />
                      <div style={{ fontWeight: 800, fontSize: 13, marginTop: 6 }}>Toda la tienda</div>
                    </div>
                    <div onClick={() => setDescForm({ ...descForm, tipo_aplicacion: "productos" })}
                      style={{ border: `2px solid ${descForm.tipo_aplicacion === "productos" ? RED : GRAY2}`, background: descForm.tipo_aplicacion === "productos" ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "center" }}>
                      <Tag size={24} color={descForm.tipo_aplicacion === "productos" ? RED : GRAY3} strokeWidth={1.6} />
                      <div style={{ fontWeight: 800, fontSize: 13, marginTop: 6 }}>Productos elegidos</div>
                    </div>
                  </div>

                  {/* SELECTOR DE PRODUCTOS */}
                  {descForm.tipo_aplicacion === "productos" && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={S.label}>Elige los productos ({descForm.productos_ids.length} seleccionados)</label>
                      <div style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, maxHeight: 220, overflowY: "auto" }}>
                        {products.map(p => {
                          const sel = descForm.productos_ids.includes(p.id);
                          return (
                            <div key={p.id} onClick={() => {
                              const ids = sel ? descForm.productos_ids.filter(x => x !== p.id) : [...descForm.productos_ids, p.id];
                              setDescForm({ ...descForm, productos_ids: ids });
                            }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${GRAY}`, background: sel ? "#FFF5F5" : WHITE }}>
                              <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel ? RED : GRAY2}`, background: sel ? RED : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {sel && <CheckCircle2 size={13} color={WHITE} />}
                              </div>
                              {p.imagen_url ? <img src={imagenOptimizada(p.imagen_url, 150)} style={{ width: 30, height: 30, borderRadius: 5, objectFit: "cover" }} /> : <div style={{ width: 30, height: 30, borderRadius: 5, background: GRAY }} />}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                                <div style={{ fontSize: 11, color: GRAY3 }}>{p.referencia}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button onClick={() => setDescForm(null)} disabled={guardandoDesc} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                    <button onClick={guardarDescuento} disabled={guardandoDesc} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardandoDesc ? 0.7 : 1 }}>
                      {guardandoDesc ? "Guardando..." : "Guardar descuento"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════ RETORNOS ═══════════ */}
        {tab === "retornos" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><RefreshCw size={24} color={RED} /> Retornos</div>
              <button onClick={abrirNuevoRetorno} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 18px", fontSize: 14 }}>
                <Plus size={16} /> Registrar retorno
              </button>
            </div>

            {/* BUSCADOR */}
            <div style={{ position: "relative", marginBottom: 20, maxWidth: 340 }}>
              <Search size={15} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input style={{ width: "100%", padding: "10px 10px 10px 36px", borderRadius: 10, border: `1.5px solid ${GRAY2}`, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                placeholder="Buscar por cliente o pedido..."
                value={busquedaRetorno}
                onChange={e => setBusquedaRetorno(e.target.value)}
              />
              {busquedaRetorno && <button onClick={() => setBusquedaRetorno("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: GRAY3, display: "flex" }}><X size={15} /></button>}
            </div>

            {/* ESTADO BADGES HELPER */}
            {(() => {
              const ESTADOS = {
                pendiente:   { bg: "#FFF3CD", color: "#856404", label: "Pendiente" },
                aprobado:    { bg: "#D4EDDA", color: "#155724", label: "Aprobado" },
                reembolsado: { bg: "#CCE5FF", color: "#004085", label: "Reembolsado" },
                rechazado:   { bg: "#F8D7DA", color: "#721C24", label: "Rechazado" },
              };
              const money = (n) => "$" + Number(n || 0).toFixed(2);
              const q = busquedaRetorno.trim().toLowerCase();
              const retornosFiltrados = q
                ? retornos.filter(r => (r.nombre_cliente || "").toLowerCase().includes(q) || (r.codigo_pedido || "").toLowerCase().includes(q))
                : retornos;

              if (retornos.length === 0) return (
                <div style={{ background: WHITE, border: `1px dashed ${GRAY2}`, borderRadius: 14, padding: 40, textAlign: "center", color: GRAY3 }}>
                  <RefreshCw size={36} color={GRAY3} strokeWidth={1.4} style={{ marginBottom: 10 }} />
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Sin retornos registrados</div>
                  <div style={{ fontSize: 13 }}>Registra tu primer retorno con el botón de arriba.</div>
                </div>
              );

              if (retornosFiltrados.length === 0) return (
                <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 14 }}>No se encontraron retornos para "{busquedaRetorno}"</div>
              );

              return (
                <>
                  {/* RESUMEN RÁPIDO */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
                    {Object.entries(ESTADOS).map(([k, v]) => {
                      const count = retornos.filter(r => r.estado === k).length;
                      const total = retornos.filter(r => r.estado === k).reduce((s, r) => s + Number(r.monto_reembolso || 0), 0);
                      return (
                        <div key={k} style={{ background: v.bg, borderRadius: 12, padding: "14px 16px" }}>
                          <div style={{ fontWeight: 800, color: v.color, fontSize: 22 }}>{count}</div>
                          <div style={{ fontSize: 12, color: v.color, fontWeight: 700 }}>{v.label}</div>
                          <div style={{ fontSize: 11, color: v.color, opacity: 0.8, marginTop: 2 }}>{money(total)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* LISTA */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {retornosFiltrados.map((r, i) => {
                      const est = ESTADOS[r.estado] || ESTADOS.pendiente;
                      return (
                        <div key={r.id} className="oft-widget" style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 20, animationDelay: `${i * 0.04}s`, transition: "transform 0.2s, box-shadow 0.2s" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                <div style={{ fontWeight: 900, fontSize: 16 }}>{r.nombre_cliente}</div>
                                {r.codigo_pedido && <div style={{ fontSize: 12, color: RED, fontWeight: 700 }}>{r.codigo_pedido}</div>}
                                <span style={{ background: est.bg, color: est.color, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{est.label}</span>
                              </div>
                              <div style={{ fontSize: 13, color: GRAY3, marginBottom: 4 }}><strong>Motivo:</strong> {r.motivo}</div>
                              {r.productos_retornados && <div style={{ fontSize: 13, color: GRAY3, marginBottom: 4 }}><strong>Productos:</strong> {r.productos_retornados}</div>}
                              {r.notas && <div style={{ fontSize: 12, color: GRAY3, fontStyle: "italic" }}>📝 {r.notas}</div>}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 24, fontWeight: 900, color: RED }}>{money(r.monto_reembolso)}</div>
                              <div style={{ fontSize: 11, color: GRAY3 }}>{new Date(r.created_at).toLocaleDateString("es-PA")}</div>
                            </div>
                          </div>

                          {/* ACCIONES */}
                          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                            {/* Cambiar estado */}
                            <select value={r.estado} onChange={e => cambiarEstadoRetorno(r, e.target.value)}
                              style={{ flex: 1, minWidth: 130, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${GRAY2}`, fontSize: 13, fontWeight: 700, cursor: "pointer", background: WHITE }}>
                              <option value="pendiente">Pendiente</option>
                              <option value="aprobado">Aprobado</option>
                              <option value="reembolsado">Reembolsado</option>
                              <option value="rechazado">Rechazado</option>
                            </select>
                            <button onClick={() => abrirEditarRetorno(r)} className="oft-btn-press" style={{ background: "none", color: BLACK, border: `1.5px solid ${BLACK}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <PencilIcon size={14} /> Editar
                            </button>
                            <button onClick={() => eliminarRetorno(r)} className="oft-btn-press" style={{ background: "none", color: RED, border: `1.5px solid ${RED}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* MODAL CREAR / EDITAR RETORNO */}
            {retornoForm && (
              <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 16px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onClick={() => !guardandoRetorno && setRetornoForm(null)}>
                <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 480, width: "92%", margin: "0 auto", padding: 24 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><RefreshCw size={18} color={RED} /> {retornoForm.id ? "Editar" : "Nuevo"} retorno</div>
                    <button onClick={() => setRetornoForm(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
                  </div>

                  <label style={S.label}>Nombre del cliente *</label>
                  <input style={S.input} placeholder="Nombre completo" value={retornoForm.nombre_cliente} onChange={e => setRetornoForm({ ...retornoForm, nombre_cliente: e.target.value })} autoFocus />

                  <label style={S.label}>Código del pedido (opcional)</label>
                  <input style={S.input} placeholder="Ej: OFT-123456" value={retornoForm.codigo_pedido} onChange={e => setRetornoForm({ ...retornoForm, codigo_pedido: e.target.value.toUpperCase() })} />

                  <label style={S.label}>Motivo del retorno *</label>
                  <input style={S.input} placeholder="Ej: Talla incorrecta, producto dañado..." value={retornoForm.motivo} onChange={e => setRetornoForm({ ...retornoForm, motivo: e.target.value })} />

                  <label style={S.label}>Productos retornados</label>
                  {/* Selector de productos del catálogo */}
                  <div style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                    {/* Lista de productos ya seleccionados */}
                    {(retornoForm.items_retornados || []).length > 0 && (
                      <div style={{ background: GRAY, padding: "8px 12px", borderBottom: `1px solid ${GRAY2}` }}>
                        {retornoForm.items_retornados.map((item, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ flex: 1, fontSize: 13 }}>
                              <span style={{ fontWeight: 700 }}>{item.nombre}</span>
                              <span style={{ color: GRAY3, fontSize: 11 }}> · {item.referencia}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button onClick={() => {
                                const updated = [...retornoForm.items_retornados];
                                if (updated[idx].cantidad > 1) { updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad - 1 }; }
                                setRetornoForm({ ...retornoForm, items_retornados: updated });
                              }} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${GRAY2}`, background: WHITE, cursor: "pointer", fontWeight: 900, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.cantidad}</span>
                              <button onClick={() => {
                                const updated = [...retornoForm.items_retornados];
                                updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
                                setRetornoForm({ ...retornoForm, items_retornados: updated });
                              }} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${GRAY2}`, background: WHITE, cursor: "pointer", fontWeight: 900, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                              <button onClick={() => {
                                setRetornoForm({ ...retornoForm, items_retornados: retornoForm.items_retornados.filter((_, i) => i !== idx) });
                              }} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${RED}`, background: WHITE, cursor: "pointer", color: RED, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Buscador de productos */}
                    <div style={{ padding: "8px 8px 0" }}>
                      <div style={{ position: "relative", marginBottom: 6 }}>
                        <Search size={13} color={GRAY3} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
                        <input
                          style={{ width: "100%", padding: "7px 8px 7px 28px", borderRadius: 7, border: `1px solid ${GRAY2}`, fontSize: 13, outline: "none", boxSizing: "border-box", background: GRAY }}
                          placeholder="Buscar por nombre o referencia..."
                          value={retornoForm._busquedaProducto || ""}
                          onChange={e => setRetornoForm({ ...retornoForm, _busquedaProducto: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ padding: "0 8px 8px", maxHeight: 200, overflowY: "auto" }}>
                      {(() => {
                        const q = (retornoForm._busquedaProducto || "").toLowerCase();
                        const filtrados = products.filter(p =>
                          !(retornoForm.items_retornados || []).some(i => i.product_id === p.id) &&
                          (q === "" || (p.nombre || "").toLowerCase().includes(q) || (p.referencia || "").toLowerCase().includes(q))
                        );
                        if (filtrados.length === 0) return <div style={{ padding: "8px 4px", fontSize: 12, color: GRAY3 }}>No se encontraron productos</div>;
                        return filtrados.map(p => (
                          <div key={p.id} onClick={() => {
                            setRetornoForm({ ...retornoForm, items_retornados: [...(retornoForm.items_retornados || []), { product_id: p.id, referencia: p.referencia, nombre: p.nombre, cantidad: 1 }] });
                          }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", cursor: "pointer", borderRadius: 6, marginBottom: 2, background: WHITE }}
                          onMouseEnter={e => e.currentTarget.style.background = GRAY}
                          onMouseLeave={e => e.currentTarget.style.background = WHITE}>
                            {p.imagen_url
                              ? <img src={imagenOptimizada(p.imagen_url, 150)} style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }} />
                              : <div style={{ width: 28, height: 28, borderRadius: 4, background: GRAY2 }} />
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                              <div style={{ fontSize: 10, color: GRAY3 }}>{p.referencia}</div>
                            </div>
                            <Plus size={14} color={RED} />
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  <label style={S.label}>Monto a reembolsar ($)</label>
                  <input type="number" min="0" step="0.01" style={S.input} placeholder="0.00" value={retornoForm.monto_reembolso} onChange={e => setRetornoForm({ ...retornoForm, monto_reembolso: e.target.value })} />

                  <label style={S.label}>Estado</label>
                  <select value={retornoForm.estado} onChange={e => setRetornoForm({ ...retornoForm, estado: e.target.value })}
                    style={{ ...S.input, cursor: "pointer" }}>
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="reembolsado">Reembolsado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>

                  <label style={S.label}>Notas internas (opcional)</label>
                  <input style={S.input} placeholder="Notas para tu equipo..." value={retornoForm.notas} onChange={e => setRetornoForm({ ...retornoForm, notas: e.target.value })} />

                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button onClick={() => setRetornoForm(null)} disabled={guardandoRetorno} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                    <button onClick={guardarRetorno} disabled={guardandoRetorno} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardandoRetorno ? 0.7 : 1 }}>
                      {guardandoRetorno ? "Guardando..." : "Guardar retorno"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════ ANÁLISIS DE STOCK ═══════════ */}
        {tab === "analisis" && esAdminCompleto && (() => {
          const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}><TrendingUp size={24} color={RED} /> Análisis de Stock</div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 24, maxWidth: 600 }}>
              Basado solo en ventas reales de tu web. Tiempo de reposición de proveedor: <strong>{LEAD_TIME_DIAS} días</strong>.
            </p>

            {analisisStock.length === 0 ? (
              <div style={{ background: WHITE, border: `1px dashed ${GRAY2}`, borderRadius: 14, padding: 40, textAlign: "center", color: GRAY3 }}>
                <TrendingUp size={36} color={GRAY3} strokeWidth={1.4} style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Aún no hay suficientes ventas</div>
                <div style={{ fontSize: 13 }}>El análisis aparecerá cuando tengas pedidos pagados con productos vinculados.</div>
              </div>
            ) : (
              <>
                <EditorEmailAlertasReposicion showToast={showToast} />
                {/* ALERTA: REPONER URGENTE */}
                {urgentesReponer.length > 0 && (
                  <div style={{ background: "#FFF3CD", border: "2px solid #856404", borderRadius: 14, padding: 18, marginBottom: 24 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#856404", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      ⚠️ Reponer pronto ({urgentesReponer.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {urgentesReponer.slice(0, 5).map(f => (
                        <div key={f.producto_id} style={{ display: "flex", alignItems: "center", gap: 10, background: WHITE, borderRadius: 8, padding: "8px 12px" }}>
                          {f.prod.imagen_url ? <img src={f.prod.imagen_url} style={{ width: 30, height: 30, borderRadius: 5, objectFit: "cover" }} /> : <div style={{ width: 30, height: 30, borderRadius: 5, background: GRAY }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{f.prod.nombre}</div>
                            <div style={{ fontSize: 11, color: GRAY3 }}>{f.prod.referencia || "—"} · Stock: {f.stockActual} uds</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 900, color: f.diasParaReponer === 0 ? RED : "#856404", fontSize: 14 }}>
                              {f.diasParaReponer === 0 ? "Reponer YA" : `Reponer en ${f.diasParaReponer} día${f.diasParaReponer === 1 ? "" : "s"}`}
                            </div>
                            <div style={{ fontSize: 11, color: GRAY3 }}>Comprar ~{f.sugerenciaCompra} uds</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {urgentesReponer.length > 0 && (
                      <button onClick={() => setRankingModal("reponer")} className="oft-btn-press" style={{ marginTop: 12, background: "none", border: "none", color: "#856404", fontWeight: 800, fontSize: 13, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        Ver todos y filtrar por proveedor →
                      </button>
                    )}
                  </div>
                )}

                {/* GRID: ROTACIÓN + INGRESO */}
                <div className="oft-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                  {/* MEJOR ROTACIÓN */}
                  <div className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}` }}>
                    <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><RefreshCw size={17} color={RED} /> Mejor rotación</div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14 }}>Unidades vendidas por día (promedio)</div>
                    {rotacionOrdenado.slice(0, 5).map((f, i) => (
                      <div key={f.producto_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 4 ? `1px solid ${GRAY2}` : "none" }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: GRAY3, width: 18 }}>{i + 1}</div>
                        {f.prod.imagen_url ? <img src={f.prod.imagen_url} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 32, height: 32, borderRadius: 6, background: GRAY }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.prod.nombre}</div>
                          <div style={{ fontSize: 10, color: GRAY3 }}>{f.cantidad} uds en {f.diasDesdeInicio} días</div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 13, color: RED }}>{f.velocidadDiaria.toFixed(2)}/día</div>
                      </div>
                    ))}
                    {rotacionOrdenado.length > 5 && (
                      <button onClick={() => setRankingModal("rotacion")} className="oft-btn-press" style={{ marginTop: 10, background: "none", border: "none", color: RED, fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        Ver los {Math.min(rotacionOrdenado.length, 50)} productos →
                      </button>
                    )}
                  </div>

                  {/* MÁS CASH */}
                  <div className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}` }}>
                    <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><DollarSign size={17} color={RED} /> Más ingreso generado</div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14 }}>Ingreso total por producto</div>
                    {ingresoOrdenado.slice(0, 5).map((f, i) => (
                      <div key={f.producto_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 4 ? `1px solid ${GRAY2}` : "none" }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: GRAY3, width: 18 }}>{i + 1}</div>
                        {f.prod.imagen_url ? <img src={f.prod.imagen_url} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 32, height: 32, borderRadius: 6, background: GRAY }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.prod.nombre}</div>
                          <div style={{ fontSize: 10, color: GRAY3 }}>{f.margen !== null ? `Margen: ${money(f.margen)}` : "Margen: sin costo cargado"}</div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 13, color: RED }}>{money(f.ingreso)}</div>
                      </div>
                    ))}
                    {ingresoOrdenado.length > 5 && (
                      <button onClick={() => setRankingModal("ingreso")} className="oft-btn-press" style={{ marginTop: 10, background: "none", border: "none", color: RED, fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        Ver los {Math.min(ingresoOrdenado.length, 50)} productos →
                      </button>
                    )}
                  </div>
                </div>

                {/* INGRESOS POR CATEGORÍA */}
                {ingresoPorCategoria.length > 0 && (
                  <div style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}`, marginBottom: 24 }}>
                    <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><DollarSign size={17} color={RED} /> Ingresos por categoría</div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14 }}>Qué línea de productos genera más dinero en total (todos los proveedores juntos)</div>
                    {(() => {
                      const maxIngreso = ingresoPorCategoria[0]?.ingreso || 1;
                      return ingresoPorCategoria.map((c, i) => (
                        <div key={c.categoria_id} style={{ padding: "9px 0", borderBottom: i < ingresoPorCategoria.length - 1 ? `1px solid ${GRAY2}` : "none" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{i + 1}. {c.categoria}</span>
                            <span style={{ fontWeight: 900, fontSize: 13.5, color: RED }}>{money(c.ingreso)}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 4, background: GRAY, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.max(2, (c.ingreso / maxIngreso) * 100)}%`, background: RED, borderRadius: 4 }} />
                          </div>
                          <div style={{ fontSize: 10.5, color: GRAY3, marginTop: 3 }}>{c.productos} producto{c.productos !== 1 ? "s" : ""} · {c.cantidad} unidades vendidas</div>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* VENTAS POR ZONA/UBICACIÓN */}
                <div style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}`, marginBottom: 24 }}>
                  <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><MapPin size={17} color={RED} /> Ventas por zona</div>
                  <div style={{ fontSize: 12, color: GRAY3, marginBottom: 14 }}>Según sucursal de destino, o la dirección del cliente cuando no hay sucursal</div>
                  {ventasPorArea.length === 0 ? (
                    <div style={{ fontSize: 13, color: GRAY3, padding: "10px 0" }}>Todavía no hay pedidos suficientes para mostrar zonas.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
                      {ventasPorArea.slice(0, 10).map((f, i) => (
                        <div key={f.area} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${GRAY2}` }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: GRAY3, width: 18 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.area}</div>
                            <div style={{ fontSize: 10, color: GRAY3 }}>{f.pedidos} pedido{f.pedidos === 1 ? "" : "s"}</div>
                          </div>
                          <div style={{ fontWeight: 900, fontSize: 13, color: RED }}>{money(f.total)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {ventasPorArea.length > 10 && (
                    <button onClick={() => setRankingModal("zona")} className="oft-btn-press" style={{ marginTop: 12, background: "none", border: "none", color: RED, fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                      Ver las {Math.min(ventasPorArea.length, 50)} zonas →
                    </button>
                  )}
                </div>

                {/* TABLA COMPLETA */}
                <div style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${GRAY2}`, fontWeight: 800 }}>Detalle completo por producto</div>
                  <div className="oft-table-wrap" style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead><tr>{["Producto","Vendidos","Vel./día","Ingreso","Margen","Stock","Días p/ agotar","Comprar","Reponer en"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {analisisStock.sort((a,b) => b.ingreso - a.ingreso).map(f => (
                          <tr key={f.producto_id}>
                            <td style={{ ...S.td, fontWeight: 700 }}>{f.prod.nombre}<div style={{ fontSize: 11, color: GRAY3, fontWeight: 400 }}>{f.prod.referencia || "—"}</div></td>
                            <td style={S.td}>{f.cantidad}</td>
                            <td style={S.td}>{f.velocidadDiaria.toFixed(2)}</td>
                            <td style={{ ...S.td, fontWeight: 700 }}>{money(f.ingreso)}</td>
                            <td style={S.td}>{f.margen !== null ? money(f.margen) : <span style={{ color: GRAY3 }}>—</span>}</td>
                            <td style={S.td}>{f.tieneStock ? f.stockActual : <span style={{ color: GRAY3, fontSize: 11 }}>Sin Odoo</span>}</td>
                            <td style={S.td}>{f.diasHastaAgotar !== null ? `${f.diasHastaAgotar} días` : <span style={{ color: GRAY3 }}>—</span>}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: RED }}>{f.sugerenciaCompra} uds</td>
                            <td style={S.td}>
                              {f.diasParaReponer !== null ? (
                                <span style={{ fontWeight: 800, color: f.diasParaReponer <= 3 ? RED : "#856404" }}>
                                  {f.diasParaReponer === 0 ? "Ya" : `${f.diasParaReponer}d`}
                                </span>
                              ) : <span style={{ color: GRAY3 }}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
          );
        })()}

        {/* ═══════════ PROVEEDORES ═══════════ */}
        {tab === "proveedores" && esAdminCompleto && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Building2 size={24} color={RED} /> Proveedores</div>
              <button onClick={() => setProveedorForm({})} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 18px", fontSize: 14 }}>
                <Plus size={16} /> Nuevo proveedor
              </button>
            </div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 24, maxWidth: 640 }}>
              Asigna cada producto a su proveedor (desde el formulario del producto) para ver aquí cuánto ingreso
              genera cada uno. Para saber qué reponer y descargar la lista por proveedor, ve a{" "}
              <strong>Análisis de Stock → Reponer pronto</strong>.
            </p>
            <ProveedoresOdoo proveedoresWeb={proveedores} onCambio={async () => { try { setProveedores((await sb.get("proveedores", "?order=nombre.asc")) || []); } catch (_e) {} await cargarRepartoProv(); }} />
            {proveedores.length === 0 ? (
              <div style={{ background: WHITE, borderRadius: 16, padding: "40px 24px", border: `2px dashed ${GRAY2}`, textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Building2 size={30} color={GRAY3} strokeWidth={1.5} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Aún no tienes proveedores registrados</div>
                <p style={{ fontSize: 14, color: GRAY3 }}>Agrégalos aquí para poder diferenciar sus productos y ver sus ventas por separado.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {ventasPorProveedor.map(v => {
                  const pv = v.proveedor;
                  const numProductos = products.filter(p => p.proveedor_id === pv.id).length;
                  const rotacionProveedor = rotacionOrdenado.filter(f => f.prod?.proveedor_id === pv.id);
                  const ingresoProveedor = ingresoOrdenado.filter(f => f.prod?.proveedor_id === pv.id);
                  const expandido = proveedorExpandidoId === pv.id;
                  return (
                    <div key={pv.id} style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
                            {pv.nombre}
                            {!pv.activo && <span style={{ fontSize: 10, fontWeight: 800, background: GRAY, color: GRAY3, padding: "2px 8px", borderRadius: 10 }}>INACTIVO</span>}
                          </div>
                          {pv.telefono && <div style={{ fontSize: 13, color: GRAY3, marginTop: 2 }}>{pv.telefono}</div>}
                          {pv.direccion && <div style={{ fontSize: 13, color: GRAY3 }}>{pv.direccion}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setProveedorForm(pv)} className="oft-btn-press" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <PencilIcon size={13} /> Editar
                          </button>
                          <button onClick={() => setProveedorAEliminar(pv)} className="oft-btn-press" style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {pv.notas && <div style={{ fontSize: 12, color: GRAY3, marginTop: 8, background: GRAY, borderRadius: 8, padding: "8px 10px" }}>{pv.notas}</div>}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${GRAY2}` }}>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: RED }}>{money(v.ingreso)}</div>
                          <div style={{ fontSize: 11, color: GRAY3 }}>Ingreso generado</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>{v.unidades}</div>
                          <div style={{ fontSize: 11, color: GRAY3 }}>Unidades vendidas</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>{v.pedidos}</div>
                          <div style={{ fontSize: 11, color: GRAY3 }}>Pedidos</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>{numProductos}</div>
                          <div style={{ fontSize: 11, color: GRAY3 }}>Productos en catálogo</div>
                        </div>
                      </div>

                      {estimadoPorCompras && estimadoPorCompras.comp[pv.id] && (() => {
                        const cp = estimadoPorCompras.comp[pv.id], es = estimadoPorCompras.mapa[pv.id] || { ingreso: 0, unidades: 0, productos: new Set(), compartidos: new Set() };
                        return (
                          <div style={{ marginTop: 14, padding: 12, background: GRAY, borderRadius: 10 }} data-testid={`prov-compras-${pv.id}`}>
                            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Según tus compras en Odoo</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                              <div><div style={{ fontSize: 18, fontWeight: 900 }}>{money(cp.total)}</div><div style={{ fontSize: 11, color: GRAY3 }}>Comprado ({cp.compras} orden{cp.compras === 1 ? "" : "es"})</div></div>
                              <div><div style={{ fontSize: 18, fontWeight: 900 }}>{Math.round(Number(cp.piezas) || 0).toLocaleString("en-US")}</div><div style={{ fontSize: 11, color: GRAY3 }}>Piezas de {cp.productos} producto(s) de la web</div></div>
                              <div><div style={{ fontSize: 18, fontWeight: 900, color: RED }}>{money(es.ingreso)}</div><div style={{ fontSize: 11, color: GRAY3 }}>Ingreso web estimado</div></div>
                              <div><div style={{ fontSize: 18, fontWeight: 900 }}>{Math.round(es.unidades).toLocaleString("en-US")}</div><div style={{ fontSize: 11, color: GRAY3 }}>Unidades vendidas estimadas</div></div>
                            </div>
                            <div style={{ fontSize: 11, color: GRAY3, marginTop: 8, lineHeight: 1.5 }}>
                              {es.compartidos.size > 0 ? `${es.compartidos.size} producto(s) se compran también a otros proveedores: sus ventas se reparten según las piezas compradas a cada uno. ` : ""}
                              Última compra: {cp.ultima || "—"}. Es un estimado; no cambia el proveedor del producto en la tienda.
                            </div>
                          </div>
                        );
                      })()}

                      {numProductos > 0 && (
                        <>
                          <button
                            onClick={() => setProveedorExpandidoId(expandido ? null : pv.id)}
                            className="oft-btn-press"
                            style={{ marginTop: 14, background: "none", border: "none", color: RED, fontWeight: 800, fontSize: 13, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <TrendingUp size={15} />
                            {expandido ? "Ocultar análisis de stock" : "Ver análisis de stock"}
                            {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>

                          {expandido && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${GRAY2}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                              {/* MEJOR ROTACIÓN */}
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Zap size={14} color={RED} /> Mejor rotación</div>
                                {rotacionProveedor.length === 0 || rotacionProveedor[0].velocidadDiaria === 0 ? (
                                  <p style={{ fontSize: 12, color: GRAY3 }}>Aún no hay ventas registradas de sus productos.</p>
                                ) : (
                                  <>
                                    {rotacionProveedor.slice(0, 5).map(f => (
                                      <div key={f.producto_id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${GRAY}` }}>
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.prod?.nombre}</span>
                                        <strong style={{ flexShrink: 0 }}>{f.velocidadDiaria.toFixed(2)}/día</strong>
                                      </div>
                                    ))}
                                    {rotacionProveedor.length > 5 && (
                                      <button onClick={() => { setRankingModal("rotacion"); setRankingModalProveedorId(pv.id); }} className="oft-btn-press" style={{ marginTop: 8, background: "none", border: "none", color: RED, fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                                        Ver los {Math.min(rotacionProveedor.length, 50)} productos →
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>

                              {/* MÁS INGRESO GENERADO */}
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><DollarSign size={14} color={RED} /> Más ingreso generado</div>
                                {ingresoProveedor.length === 0 || ingresoProveedor[0].ingreso === 0 ? (
                                  <p style={{ fontSize: 12, color: GRAY3 }}>Aún no hay ventas registradas de sus productos.</p>
                                ) : (
                                  <>
                                    {ingresoProveedor.slice(0, 5).map(f => (
                                      <div key={f.producto_id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${GRAY}` }}>
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.prod?.nombre}</span>
                                        <strong style={{ flexShrink: 0 }}>{money(f.ingreso)}</strong>
                                      </div>
                                    ))}
                                    {ingresoProveedor.length > 5 && (
                                      <button onClick={() => { setRankingModal("ingreso"); setRankingModalProveedorId(pv.id); }} className="oft-btn-press" style={{ marginTop: 8, background: "none", border: "none", color: RED, fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                                        Ver los {Math.min(ingresoProveedor.length, 50)} productos →
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════ RETIRO EN LOCAL ═══════════ */}
        {/* ═══════════ GRUPOS FLEX PACK ═══════════ */}
        {tab === "flexpack" && esAdminCompleto && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Boxes size={24} color={RED} /> Grupos Flex Pack</div>
              <button onClick={() => setGrupoFlexpackForm({})} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 18px", fontSize: 14 }}>
                <Plus size={16} /> Nuevo grupo
              </button>
            </div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 24, maxWidth: 640 }}>
              Un grupo dice qué productos se pueden mezclar entre sí — el cliente arma su combinación, y el
              precio se calcula solo, usando el precio de 3/6 piezas (o media docena/docena) que ya tiene cada
              producto. No hay que poner un precio aparte para el grupo. Asigna cada producto a su grupo desde
              el formulario del producto, en "Grupo Flex Pack" (o desde "Editar varios" para asignar varios a la vez).
            </p>
            {flexpackGrupos.length === 0 ? (
              <div style={{ background: WHITE, borderRadius: 16, padding: "40px 24px", border: `2px dashed ${GRAY2}`, textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Boxes size={30} color={GRAY3} strokeWidth={1.5} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Aún no tienes grupos Flex Pack</div>
                <p style={{ fontSize: 14, color: GRAY3 }}>Créalos aquí, y luego asigna tus perfumes (u otros productos) a cada uno.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {flexpackGrupos.map(g => {
                  const numProductos = products.filter(p => p.flexpack_grupo_id === g.id).length;
                  const productosDelGrupo = products.filter(p => p.flexpack_grupo_id === g.id);
                  return (
                    <div key={g.id} style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
                            {g.nombre}
                            {!g.activo && <span style={{ fontSize: 10, fontWeight: 800, background: GRAY, color: GRAY3, padding: "2px 8px", borderRadius: 10 }}>INACTIVO</span>}
                          </div>
                          <div style={{ fontSize: 13, color: GRAY3, marginTop: 2 }}>{numProductos} producto{numProductos !== 1 ? "s" : ""} en este grupo</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setGrupoFlexpackForm(g)} className="oft-btn-press" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <PencilIcon size={13} /> Editar
                          </button>
                          <button onClick={() => setGrupoFlexpackAEliminar(g)} className="oft-btn-press" style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {numProductos > 0 && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${GRAY2}`, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {productosDelGrupo.map(p => (
                            <span key={p.id} style={{ fontSize: 11.5, fontWeight: 600, background: GRAY, borderRadius: 8, padding: "4px 10px" }}>{p.nombre}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {grupoFlexpackForm && (
          <FlexPackGrupoFormModal
            grupo={grupoFlexpackForm}
            showToast={showToast}
            onClose={() => setGrupoFlexpackForm(null)}
            onSaved={(saved) => setFlexpackGrupos(prev => grupoFlexpackForm.id ? prev.map(g => g.id === saved.id ? saved : g) : [saved, ...prev])}
          />
        )}

        {grupoFlexpackAEliminar && createPortal(
          <div className="oft-overlay" style={S.overlay} onClick={() => setGrupoFlexpackAEliminar(null)}>
            <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 380, width: "92%", padding: 24, textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>¿Eliminar el grupo "{grupoFlexpackAEliminar.nombre}"?</div>
              <p style={{ fontSize: 13, color: GRAY3, marginBottom: 20 }}>
                Los productos que ya tenías asignados a este grupo NO se borran, solo quedan sin grupo Flex Pack (dejan de participar en Flex Pack hasta que los asignes a otro).
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setGrupoFlexpackAEliminar(null)} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                <button
                  onClick={async () => {
                    try {
                      await sb.delete("flexpack_grupos", grupoFlexpackAEliminar.id);
                      setFlexpackGrupos(prev => prev.filter(g => g.id !== grupoFlexpackAEliminar.id));
                      setProducts(prev => prev.map(p => p.flexpack_grupo_id === grupoFlexpackAEliminar.id ? { ...p, flexpack_grupo_id: null } : p));
                      showToast("Grupo eliminado");
                    } catch(e) {
                      showToast("Error: " + (e.message || "no se pudo eliminar"));
                    }
                    setGrupoFlexpackAEliminar(null);
                  }}
                  className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center" }}
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* ═══════════ MÓDULO DE PRECIOS (para vendedores) ═══════════ */}
        {tab === "precios" && <PreciosPanel products={products} categories={categories} esAdminCompleto={esAdminCompleto} />}

        {/* ═══════════ PÍXELES DE MARKETING ═══════════ */}
        {tab === "pixeles" && esAdminCompleto && <PixelesPanel />}

        {tab === "analisisads" && esAdminCompleto && <AnalisisAdsPanel />}

        {tab === "retirolocal" && esAdminCompleto && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><Home size={24} color={RED} /> Retiro en Local</div>

            {/* INTERRUPTOR: habilitar/deshabilitar para clientes */}
            <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${GRAY2}`, padding: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Mostrar "Retiro en el local" a los clientes</div>
                  <div style={{ fontSize: 13, color: GRAY3, marginTop: 4, maxWidth: 480 }}>
                    Si lo apagas, esta opción desaparece del checkout de tu web — pero tú desde el admin siempre
                    vas a poder seguir creando pedidos manuales con retiro en el local, sin importar este ajuste.
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setGuardandoToggleRetiro(true);
                    const nuevoValor = !retiroLocalHabilitado;
                    try {
                      const resp = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?clave=eq.retiro_local_habilitado`, {
                        method: "PATCH",
                        headers: sb.dataHeaders(),
                        body: JSON.stringify({ valor: nuevoValor }),
                      });
                      if (!resp.ok) throw new Error(await resp.text());
                      setRetiroLocalHabilitado(nuevoValor);
                      showToast(nuevoValor ? "Retiro en el local activado para clientes" : "Retiro en el local desactivado para clientes");
                    } catch(e) {
                      showToast("Error: " + (e.message || "no se pudo cambiar"));
                    }
                    setGuardandoToggleRetiro(false);
                  }}
                  disabled={guardandoToggleRetiro}
                  className="oft-btn-press"
                  style={{ flexShrink: 0, width: 56, height: 32, borderRadius: 20, border: "none", cursor: "pointer", background: retiroLocalHabilitado ? RED : GRAY2, position: "relative", transition: "background 0.2s", opacity: guardandoToggleRetiro ? 0.6 : 1 }}
                >
                  <span style={{ position: "absolute", top: 3, left: retiroLocalHabilitado ? 27 : 3, width: 26, height: 26, borderRadius: "50%", background: WHITE, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                </button>
              </div>
            </div>

            {/* LOCALES DE RETIRO */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Locales disponibles</div>
              <button onClick={() => setLocalForm({})} className="oft-btn-press" style={{ ...S.btnRed, padding: "9px 16px", fontSize: 13 }}>
                <Plus size={15} /> Nuevo local
              </button>
            </div>
            {localesRetiro.length === 0 ? (
              <div style={{ background: WHITE, borderRadius: 16, padding: "40px 24px", border: `2px dashed ${GRAY2}`, textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Home size={30} color={GRAY3} strokeWidth={1.5} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Aún no tienes locales registrados</div>
                <p style={{ fontSize: 14, color: GRAY3 }}>Con un solo local no hace falta que el cliente elija — se usa automáticamente. Agrega más cuando abras nuevas sucursales propias.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {localesRetiro.map(loc => (
                  <div key={loc.id} style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Home size={20} color={RED} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{loc.nombre}</div>
                        {loc.direccion && <div style={{ fontSize: 13, color: GRAY3 }}>{loc.direccion}</div>}
                        {loc.telefono && <div style={{ fontSize: 13, color: GRAY3 }}>{loc.telefono}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setLocalForm(loc)} className="oft-btn-press" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <PencilIcon size={13} /> Editar
                      </button>
                      <button onClick={() => setLocalAEliminar(loc)} className="oft-btn-press" style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════ REPORTE DE VENTAS ═══════════ */}
        {tab === "reporteventas" && esAdminCompleto && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><FileText size={24} color={RED} /> Reporte de Ventas</div>

            <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${GRAY2}`, padding: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={S.label}>Desde</label>
                  <input type="date" style={S.input} value={reporteDesde} onChange={e => setReporteDesde(e.target.value)} max={reporteHasta} />
                </div>
                <div>
                  <label style={S.label}>Hasta</label>
                  <input type="date" style={S.input} value={reporteHasta} onChange={e => setReporteHasta(e.target.value)} min={reporteDesde} max={fechaPanama()} />
                </div>
                <button onClick={generarReporteVentas} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 20px", height: 44 }}>
                  <FileSpreadsheet size={16} /> Generar reporte
                </button>
                {reporteFilas && (
                  <button onClick={descargarReporteVentasPDF} disabled={reporteBusy} className="oft-btn-press" style={{ ...S.btnOutline, padding: "10px 20px", height: 44, opacity: reporteBusy ? 0.7 : 1 }}>
                    <Download size={16} /> {reporteBusy ? "Generando..." : "Descargar PDF"}
                  </button>
                )}
              </div>
            </div>

            {!reporteFilas ? (
              <div style={{ background: WHITE, borderRadius: 16, padding: "40px 24px", border: `2px dashed ${GRAY2}`, textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <FileText size={30} color={GRAY3} strokeWidth={1.5} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Elige un rango de fechas y genera el reporte</div>
                <p style={{ fontSize: 14, color: GRAY3 }}>Vas a ver, por cada referencia vendida, cuántas unidades y cuánto ingreso generó en ese periodo.</p>
              </div>
            ) : reporteFilas.filas.length === 0 ? (
              <div style={{ background: WHITE, borderRadius: 16, padding: "40px 24px", border: `2px dashed ${GRAY2}`, textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 17 }}>No hubo ventas en ese rango de fechas</div>
              </div>
            ) : (
              <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${GRAY2}`, padding: 24, overflowX: "auto" }}>
                {/* ── Este bloque es exactamente lo que se convierte en el PDF ── */}
                <div ref={reporteVentasRef} style={{ padding: 24, fontFamily: "Helvetica, Arial, sans-serif" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, borderBottom: `3px solid ${RED}`, paddingBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>OFERTODO</div>
                      <div style={{ fontSize: 12, color: GRAY3 }}>Reporte de Ventas</div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12, color: GRAY3 }}>
                      <div><strong style={{ color: BLACK }}>Periodo:</strong> {reporteDesde} a {reporteHasta}</div>
                      <div>Generado: {new Date().toLocaleDateString("es-PA")}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "20px 0" }}>
                    <div style={{ background: GRAY, borderRadius: 10, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{reporteFilas.pedidos}</div>
                      <div style={{ fontSize: 11, color: GRAY3 }}>Pedidos</div>
                    </div>
                    <div style={{ background: GRAY, borderRadius: 10, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{reporteFilas.totalUnidades}</div>
                      <div style={{ fontSize: 11, color: GRAY3 }}>Unidades vendidas</div>
                    </div>
                    <div style={{ background: "#FFF5F5", borderRadius: 10, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: RED }}>{money(reporteFilas.totalIngreso)}</div>
                      <div style={{ fontSize: 11, color: GRAY3 }}>Ingreso total</div>
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: BLACK, color: WHITE }}>
                        <th style={{ textAlign: "left", padding: "10px 8px" }}>Referencia</th>
                        <th style={{ textAlign: "left", padding: "10px 8px" }}>Producto</th>
                        <th style={{ textAlign: "center", padding: "10px 8px" }}>Cant.</th>
                        <th style={{ textAlign: "right", padding: "10px 8px" }}>Ingreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporteFilas.filas.map((f, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${GRAY2}`, background: i % 2 === 0 ? WHITE : GRAY }}>
                          <td style={{ padding: "8px", fontWeight: 700 }}>{f.referencia}</td>
                          <td style={{ padding: "8px" }}>{f.nombre}</td>
                          <td style={{ padding: "8px", textAlign: "center", fontWeight: 700 }}>{f.cantidad}</td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{money(f.ingreso)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${BLACK}` }}>
                        <td colSpan={2} style={{ padding: "10px 8px", fontWeight: 900 }}>TOTAL</td>
                        <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 900 }}>{reporteFilas.totalUnidades}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 900, color: RED }}>{money(reporteFilas.totalIngreso)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ REPORTE POR VENDEDOR / ADMINISTRADOR ═══ */}
            {reportePorOperador && (
              <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${GRAY2}`, padding: 24, marginTop: 24, overflowX: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}><Users size={19} color={RED} /> Ventas por vendedor / administrador</div>
                  {reportePorOperador.filas.length > 0 && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={descargarReporteOperadorCSV} className="oft-btn-press" style={{ ...S.btnOutline, padding: "8px 16px", height: 38 }}>
                        <Download size={15} /> Descargar CSV
                      </button>
                      <button onClick={descargarReporteOperadorPDF} disabled={reporteOperadorBusy} className="oft-btn-press" style={{ ...S.btnOutline, padding: "8px 16px", height: 38, opacity: reporteOperadorBusy ? 0.7 : 1 }}>
                        <Download size={15} /> {reporteOperadorBusy ? "Generando..." : "Descargar PDF"}
                      </button>
                    </div>
                  )}
                </div>
                {/* ── Este bloque es exactamente lo que se convierte en el PDF ── */}
                <div ref={reportePorOperadorRef} style={{ padding: reportePorOperador.filas.length > 0 ? 24 : 0, fontFamily: "Helvetica, Arial, sans-serif" }}>
                  {reportePorOperador.filas.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: `3px solid ${RED}`, paddingBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>OFERTODO</div>
                        <div style={{ fontSize: 12, color: GRAY3 }}>Ventas por Vendedor / Administrador</div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12, color: GRAY3 }}>
                        <div><strong style={{ color: BLACK }}>Periodo:</strong> {reporteDesde} a {reporteHasta}</div>
                        <div>Generado: {new Date().toLocaleDateString("es-PA")}</div>
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: GRAY3, marginBottom: 16 }}>
                    Comisión calculada al {comisionPctReporte}% (ajustable en Analítica Web). Solo incluye pedidos creados desde "Crear Pedido" con vendedor asignado — lo que compra el cliente solo desde la web no se le atribuye a nadie.
                  </p>
                  {reportePorOperador.filas.length === 0 ? (
                    <p style={{ color: GRAY3, fontSize: 13 }}>Ningún pedido en este rango tiene un vendedor/administrador asignado.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${BLACK}` }}>
                          <th style={{ textAlign: "left", padding: "8px" }}>Vendedor / Administrador</th>
                          <th style={{ textAlign: "center", padding: "8px" }}>Ventas</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Monto vendido</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Comisión ({comisionPctReporte}%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportePorOperador.filas.map(f => (
                          <tr key={f.id} style={{ borderBottom: `1px solid ${GRAY}` }}>
                            <td style={{ padding: "8px", fontWeight: 700 }}>{f.nombre}</td>
                            <td style={{ padding: "8px", textAlign: "center" }}>{f.ventas}</td>
                            <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{money(f.monto)}</td>
                            <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: "#0F6E56" }}>{money(f.comision)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${BLACK}` }}>
                          <td style={{ padding: "10px 8px", fontWeight: 900 }}>TOTAL</td>
                          <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 900 }}>{reportePorOperador.filas.reduce((s, f) => s + f.ventas, 0)}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 900 }}>{money(reportePorOperador.totalMonto)}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 900, color: "#0F6E56" }}>{money(reportePorOperador.totalComision)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════ ENVÍOS ═══════════ */}
        {tab === "shipping" && esAdminCompleto && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><Truck size={24} color={RED} /> Empresas de Envío</div>

            <EditorCostoPuertaAPuerta showToast={showToast} />
            <EditorEnvioPerfumes showToast={showToast} />

            {/* AGREGAR EMPRESA */}
            <div style={{ background: WHITE, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${GRAY2}`, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={S.label}>Nueva empresa de envío</label>
                <input style={{ ...S.input, marginBottom: 0 }} placeholder="Ej: Servientrega, Transportes Ferguson..." value={newEmpresa} onChange={e => setNewEmpresa(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddEmpresa()} />
              </div>
              <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6, height: 42 }} onClick={handleAddEmpresa}><Plus size={16} /> Agregar empresa</button>
            </div>

            {empresas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: GRAY3 }}><Truck size={48} strokeWidth={1.3} style={{ margin: "0 auto 12px" }} /><p>Aún no hay empresas de envío</p></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {empresas.map(emp => {
                  const sucs = sucursales.filter(s => s.empresa_id === emp.id);
                  const form = sucForm[emp.id] || { nombre: "", direccion: "", telefono: "" };
                  return (
                    <div key={emp.id} style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}` }}>
                      {/* CABECERA EMPRESA */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                        <div
                          onClick={() => { empLogoRef.current.dataset.empId = emp.id; empLogoRef.current?.click(); }}
                          style={{ width: 64, height: 64, borderRadius: 10, border: `2px dashed ${GRAY2}`, display: "flex", alignItems: "center", justifyContent: "center", background: GRAY, cursor: "pointer", flexShrink: 0 }}
                          title="Subir logo"
                        >
                          {empUploading === emp.id ? <RefreshCw size={22} className="spin" color={GRAY3} />
                            : emp.logo_url ? <img src={emp.logo_url} alt={emp.nombre} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 8 }} />
                            : <Building2 size={28} color={GRAY3} strokeWidth={1.6} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{emp.nombre}</div>
                          <div style={{ fontSize: 12, color: GRAY3 }}>{sucs.length} sucursal(es) · Click en el logo para cambiarlo</div>
                        </div>
                        <button onClick={() => handleDeleteEmpresa(emp)} style={{ background: "none", border: `1px solid ${RED}`, color: RED, borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Trash2 size={14} /> Eliminar</button>
                      </div>

                      {/* SUCURSALES */}
                      <div style={{ background: GRAY, borderRadius: 10, padding: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><MapPinIcon size={15} /> Sucursales</div>
                        {sucs.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                            {sucs.map(suc => (
                              <div key={suc.id} style={{ background: WHITE, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                                <MapPinIcon size={16} color={RED} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>{suc.nombre}</div>
                                  {(suc.direccion || suc.telefono) && <div style={{ fontSize: 11, color: GRAY3 }}>{suc.direccion}{suc.direccion && suc.telefono ? " · " : ""}{suc.telefono ? `Tel: ${suc.telefono}` : ""}</div>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 11, color: GRAY3 }}>Envío $</span>
                                  <input type="number" step="0.01" min="0" defaultValue={suc.costo_envio || 0}
                                    onBlur={e => handleCambiarCostoSucursal(suc, e.target.value)}
                                    style={{ width: 64, padding: "5px 7px", borderRadius: 6, border: `1px solid ${GRAY2}`, fontSize: 12, textAlign: "center" }} />
                                </div>
                                <button onClick={() => handleDeleteSucursal(suc)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* FORM NUEVA SUCURSAL */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.7fr auto", gap: 8, alignItems: "end" }} className="oft-dash-grid-2">
                          <div>
                            <label style={{ ...S.label, fontSize: 11 }}>Nombre sucursal *</label>
                            <input style={{ ...S.input, marginBottom: 0 }} placeholder="Ej: Sucursal Centro" value={form.nombre} onChange={e => setSucForm(prev => ({ ...prev, [emp.id]: { ...form, nombre: e.target.value } }))} />
                          </div>
                          <div>
                            <label style={{ ...S.label, fontSize: 11 }}>Dirección</label>
                            <input style={{ ...S.input, marginBottom: 0 }} placeholder="Dirección" value={form.direccion} onChange={e => setSucForm(prev => ({ ...prev, [emp.id]: { ...form, direccion: e.target.value } }))} />
                          </div>
                          <div>
                            <label style={{ ...S.label, fontSize: 11 }}>Teléfono</label>
                            <input style={{ ...S.input, marginBottom: 0 }} placeholder="Teléfono" value={form.telefono} onChange={e => setSucForm(prev => ({ ...prev, [emp.id]: { ...form, telefono: e.target.value } }))} />
                          </div>
                          <div>
                            <label style={{ ...S.label, fontSize: 11 }}>Envío $</label>
                            <input type="number" step="0.01" min="0" style={{ ...S.input, marginBottom: 0 }} placeholder="0.00" value={form.costo_envio || ""} onChange={e => setSucForm(prev => ({ ...prev, [emp.id]: { ...form, costo_envio: e.target.value } }))} />
                          </div>
                          <button style={{ ...S.btnRed, height: 42, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }} onClick={() => handleAddSucursal(emp.id)}><Plus size={15} /> Sucursal</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* input oculto para logo de empresa */}
            <input ref={empLogoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
              const empId = Number(e.target.dataset.empId);
              const emp = empresas.find(x => x.id === empId);
              if (emp) handleEmpLogoUpload(e, emp);
              e.target.value = "";
            }} />
          </>
        )}

        {/* ═══════════ CREAR ETIQUETA (guía suelta, sin pedido) ═══════════ */}
        {tab === "etiquetas" && esAdminCompleto && (
          <CrearEtiquetaPanel empresas={empresas} sucursales={sucursales} showToast={showToast} />
        )}

        {/* ═══════════ CLIENTES ═══════════ */}
        {tab === "users" && (() => {
          const clientesFiltrados = filtrarClientes(users, busquedaCliente, filtroCuenta);
          const recargarClientes = async () => {
            try {
              const [us, peds] = await Promise.all([
                sb.get("usuarios", "?order=created_at.desc"),
                sb.get("pedidos", "?select=id,usuario_id"),
              ]);
              setUsers(us || []);
              const mapa = {}; (peds || []).forEach(p => { mapa[p.id] = p.usuario_id; });
              setOrders(prev => prev.map(o => (o.id in mapa ? { ...o, usuario_id: mapa[o.id] } : o)));
            } catch (e) { showToast("No se pudo recargar la lista de clientes"); }
          };
          return (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Users size={24} color={RED} /> Clientes Registrados</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => {
                  // Exportar clientes a CSV (abre en Excel)
                  const BOM = "\uFEFF"; // para que Excel reconozca UTF-8
                  const headers = ["ID interno", "Nombre", "Email", "WhatsApp", "Cuenta web", "Pedidos", "Admin", "Registrado"];
                  const filas = clientesFiltrados.map(u => {
                    const pedidosUser = orders.filter(o => o.usuario_id === u.id).length;
                    return [
                      u.id_interno || "",
                      u.nombre || "",
                      (u.email || "").includes("@ofertodo.local") ? "" : (u.email || ""),
                      u.telefono || "",
                      u.cuenta_web ? "Sí" : "No",
                      pedidosUser,
                      u.es_admin ? "Sí" : "No",
                      u.created_at ? new Date(u.created_at).toLocaleDateString("es-PA") : "",
                    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
                  });
                  const csv = BOM + [headers.join(","), ...filas].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `clientes_ofertodo_${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast("Descargando Excel...");
                }} className="oft-btn-press" style={{ ...S.btnOutline, padding: "10px 18px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FileSpreadsheet size={16} /> Exportar Excel
                </button>
                <button onClick={() => setClienteForm({})} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 18px", fontSize: 14 }}>
                  <Plus size={16} /> Crear cliente
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
              {[
                ["Total clientes", users.length, Users, RED],
                ["Con pedidos", new Set(orders.map(o => o.usuario_id).filter(Boolean)).size, ShoppingBag, "#155724"],
                ["Con cuenta web", users.filter(u => u.cuenta_web && !u.es_admin).length, CheckCircle2, "#155724"],
                ["Sin cuenta", users.filter(u => !u.cuenta_web && !u.es_admin).length, User, "#856404"],
              ].map(([l,n,Icon,c]) => (
                <div key={l} style={S.statCard}><Icon size={20} color={c} strokeWidth={1.8} /><div style={{ fontSize: 28, fontWeight: 900, color: c }}>{n}</div><div style={{ fontSize: 13, color: GRAY3 }}>{l}</div></div>
              ))}
            </div>
            {esAdminCompleto && !loadingData && (
              <ClientesDuplicadosPanel users={users} orders={orders} abierto={verDuplicados} setAbierto={setVerDuplicados} onFusionado={recargarClientes} showToast={showToast} />
            )}
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 380 }}>
                <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input value={busquedaCliente} onChange={e => setBusquedaCliente(e.target.value)} placeholder="Buscar por nombre, correo, WhatsApp o ID (CLI-00012)"
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 36px", border: `1.5px solid ${GRAY2}`, borderRadius: 10, fontSize: 14, outline: "none" }} />
              </div>
              {[["todos", "Todos"], ["con_cuenta", "Con cuenta"], ["sin_cuenta", "Sin cuenta"]].map(([k, l]) => (
                <button key={k} onClick={() => setFiltroCuenta(k)} style={{ padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${filtroCuenta === k ? BLACK : GRAY2}`, background: filtroCuenta === k ? BLACK : WHITE, color: filtroCuenta === k ? WHITE : BLACK }}>{l}</button>
              ))}
              {(busquedaCliente || filtroCuenta !== "todos") && <span style={{ fontSize: 12, color: GRAY3 }}>{clientesFiltrados.length} de {users.length}</span>}
            </div>
            {loadingData ? <Spinner /> : (
              <>
              {/* TABLA (solo escritorio) */}
              <div className="oft-table-wrap oft-only-desktop" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
                <table style={S.table}>
                  <thead><tr>{["ID","Nombre","Email","WhatsApp","Cuenta","Pedidos","Registrado",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {clientesFiltrados.length === 0 ? (
                      <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: GRAY3, padding: 30 }}>{users.length === 0 ? "Aún no hay clientes registrados" : "Ningún cliente coincide con la búsqueda"}</td></tr>
                    ) : clientesFiltrados.map(u => {
                      const pedidosUser = orders.filter(o => o.usuario_id === u.id).length;
                      return (
                        <tr key={u.id}>
                          <td style={S.td}><ChipIdInterno id={u.id_interno} /></td>
                          <td style={{ ...S.td, fontWeight: 700 }}>{u.nombre}{u.es_admin && <span style={{ marginLeft: 6, fontSize: 10, background: RED, color: WHITE, padding: "1px 6px", borderRadius: 10 }}>ADMIN</span>}</td>
                          <td style={S.td}>{esCorreoReal(u.email) ? u.email : <span style={{ color: GRAY3 }}>sin correo</span>}</td>
                          <td style={S.td}>{u.telefono || "-"}</td>
                          <td style={S.td}><ChipCuenta u={u} /></td>
                          <td style={{ ...S.td, fontWeight: 700, color: RED }}>{pedidosUser}</td>
                          <td style={S.td}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}</td>
                          <td style={S.td}>
                            {esAdminCompleto && (
                              <button onClick={() => setClienteForm(u)} title="Editar cliente" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <PencilIcon size={13} /> Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* TARJETAS (solo celular) */}
              <div className="oft-only-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {clientesFiltrados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: GRAY3 }}>{users.length === 0 ? "Aún no hay clientes registrados" : "Ningún cliente coincide con la búsqueda"}</div>
                ) : clientesFiltrados.map(u => {
                  const pedidosUser = orders.filter(o => o.usuario_id === u.id).length;
                  return (
                    <div key={u.id} style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: `linear-gradient(135deg, ${RED}, ${RED_D})`, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                          {(u.nombre || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>{u.nombre}{u.es_admin && <span style={{ fontSize: 9, background: RED, color: WHITE, padding: "1px 6px", borderRadius: 10 }}>ADMIN</span>}</div>
                          <div style={{ fontSize: 12, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{esCorreoReal(u.email) ? u.email : "sin correo"}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}><ChipIdInterno id={u.id_interno} /><ChipCuenta u={u} /></div>
                        </div>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: RED }}>{pedidosUser}</div>
                          <div style={{ fontSize: 10, color: GRAY3 }}>pedidos</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${GRAY2}`, fontSize: 12, color: GRAY3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}><MessageCircle size={13} /> {u.telefono || "Sin WhatsApp"}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}><ClipboardList size={13} /> {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}</div>
                      </div>
                      {esAdminCompleto && (
                        <button onClick={() => setClienteForm(u)} className="oft-btn-press" style={{ width: "100%", marginTop: 12, justifyContent: "center", background: "none", color: BLACK, border: `1.5px solid ${BLACK}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                          <PencilIcon size={15} /> Editar cliente
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </>
          );
        })()}

        {/* ═══════════ EQUIPO (solo admin completo) ═══════════ */}
        {tab === "equipo" && esAdminCompleto && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Lock size={24} color={RED} /> Equipo</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setPromoverForm(true)} className="oft-btn-press" style={{ ...S.btnOutline, padding: "10px 18px", fontSize: 14 }}>
                  <Users size={16} /> Promover cliente existente
                </button>
                <button onClick={() => setEquipoForm(true)} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 18px", fontSize: 14 }}>
                  <Plus size={16} /> Agregar al equipo
                </button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 24, maxWidth: 560 }}>
              Los <strong>administradores</strong> tienen acceso al módulo completo. Los <strong>operadores</strong> solo ven Inicio, Pedidos, Crear pedido/cotización, Retornos, y Clientes (pueden crear clientes nuevos, pero no editarlos).
              {" "}Si la persona ya tiene una cuenta de cliente, usa "Promover cliente existente" — "Agregar al equipo" es solo para crear una cuenta desde cero.
            </p>
            {loadingData ? <Spinner /> : (() => {
              const miembros = users.filter(u => u.es_admin);
              return miembros.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: GRAY3 }}>Aún no hay miembros en el equipo</div>
              ) : (
                <>
                {/* TABLA (solo escritorio) */}
                <div className="oft-table-wrap oft-only-desktop" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
                  <table style={S.table}>
                    <thead><tr>{["Nombre","Email","WhatsApp","Función",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {miembros.map(m => (
                        <tr key={m.id}>
                          <td style={{ ...S.td, fontWeight: 700 }}>{m.nombre}</td>
                          <td style={S.td}>{m.email}</td>
                          <td style={S.td}>{m.telefono || "-"}</td>
                          <td style={S.td}>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 12, background: m.rol === "admin" ? "#FFD9DB" : "#FFF3CD", color: m.rol === "admin" ? RED : "#856404" }}>
                              {m.rol === "admin" ? "Administrador" : m.rol === "operador" ? "Operador" : "Admin (antiguo)"}
                            </span>
                          </td>
                          <td style={S.td}>
                            {m.email !== user?.email && (
                              <button onClick={() => setMiembroAQuitar(m)} title="Quitar del equipo" style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Trash2 size={13} /> Quitar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* TARJETAS (solo celular) */}
                <div className="oft-only-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {miembros.map(m => (
                    <div key={m.id} style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: `linear-gradient(135deg, ${RED}, ${RED_D})`, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                          {(m.nombre || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 15 }}>{m.nombre}</div>
                          <div style={{ fontSize: 12, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 12, background: m.rol === "admin" ? "#FFD9DB" : "#FFF3CD", color: m.rol === "admin" ? RED : "#856404", flexShrink: 0 }}>
                          {m.rol === "admin" ? "Admin" : m.rol === "operador" ? "Operador" : "Admin"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${GRAY2}`, fontSize: 12, color: GRAY3 }}>
                        <MessageCircle size={13} /> {m.telefono || "Sin WhatsApp"}
                      </div>
                      {m.email !== user?.email && (
                        <button onClick={() => setMiembroAQuitar(m)} className="oft-btn-press" style={{ width: "100%", marginTop: 12, justifyContent: "center", background: "none", color: RED, border: `1.5px solid ${RED}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                          <Trash2 size={15} /> Quitar del equipo
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                </>
              );
            })()}
          </>
        )}
       </div>
      </div>
    </div>
  );
}

export default AdminView;
