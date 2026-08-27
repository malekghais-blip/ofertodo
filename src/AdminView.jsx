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
  ArrowUpRight, ArrowDownRight, MousePointerClick, Target
} from "lucide-react";
import {
  BLACK, CategoryIcon, ChipAdder, ClienteFormModal, CrearPedidoView, SelectorColores,
  DistribucionEditor, GRAY, GRAY2, GRAY3, Logo,
  RED, RED_D, S, SUPABASE_URL, ShippingLabelModal, NOTAS_FRAGANCIA,
  Spinner, StatusBadge, WHITE, comprimirImagen, estadosDe,
  imagenOptimizada, resolverAreaVenta, sb, useApp, useLockBodyScroll,
} from "./shared.jsx";

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
  const etiqueta = esCot ? "Cotización" : "Factura";
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
    if (!window.html2canvas) { alert("Cargando generador de imagen, intenta de nuevo en unos segundos."); return; }
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
    if (!window.html2canvas || !window.jspdf) { alert("Cargando generador de PDF, intenta de nuevo en unos segundos."); return; }
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297, margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
      heightLeft -= (pageH - margin * 2);
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgH - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
        heightLeft -= (pageH - margin * 2);
      }
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
                        <div style={{ fontWeight: 700 }}>{it.nombre_producto}</div>
                        {prod?.referencia && <div style={{ fontSize: 10, color: GRAY3 }}>Ref: {prod.referencia}</div>}
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
                  <div style={{ textAlign: "center", marginTop: 6, fontSize: 11, fontWeight: 800, color: "#155724" }}>✓ PAGADO</div>
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
function StockRankingModal({ tipo, items, onClose }) {
  useLockBodyScroll();
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const config = {
    reponer: { title: "Reponer pronto", accent: "#856404" },
    rotacion: { title: "Mejor rotación", accent: RED },
    ingreso: { title: "Más ingreso generado", accent: RED },
    zona: { title: "Ventas por zona", accent: RED },
  }[tipo];

  return createPortal(
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onClick={onClose}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 620, width: "92%", margin: "0 auto", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${GRAY2}`, background: GRAY }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: config.accent }}>{config.title} — Top {items.length}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}><X size={22} /></button>
        </div>
        <div style={{ padding: "6px 18px 18px", maxHeight: "75vh", overflowY: "auto" }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", color: GRAY3, padding: "30px 0", fontSize: 13 }}>No hay datos suficientes todavía.</div>
          ) : tipo === "zona" ? items.map((f, i) => (
            <div key={f.area} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${GRAY2}` : "none" }}>
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
          )) : items.map((f, i) => (
            <div key={f.producto_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${GRAY2}` : "none" }}>
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

// ═══════════════════════════════════════════════════════════════
//  EDITAR COTIZACIÓN
// ═══════════════════════════════════════════════════════════════
function EditCotizacionModal({ cotizacion, empresas, sucursales, onClose, onSaved, showToast }) {
  useLockBodyScroll();
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Líneas editables (a partir de los items guardados)
  const [lineas, setLineas] = useState(() => (cotizacion.items || []).map(it => ({
    id: it.id, producto_id: it.producto_id, nombre: it.nombre_producto,
    cantidad: Number(it.cantidad) || 1, precio: Number(it.precio_unitario) || 0,
  })));
  const [cliente, setCliente] = useState({ nombre: cotizacion.nombre_cliente || "", telefono: cotizacion.telefono || "", direccion: cotizacion.direccion || "" });
  const [notas, setNotas] = useState(cotizacion.notas || "");
  const [empresaId, setEmpresaId] = useState(cotizacion.empresa_envio_id || null);
  const [sucursalId, setSucursalId] = useState(cotizacion.sucursal_id || null);
  const [envio, setEnvio] = useState(cotizacion.costo_envio ? String(cotizacion.costo_envio) : "");
  const [redondeo, setRedondeo] = useState("no");
  const [guardando, setGuardando] = useState(false);

  const empresasActivas = empresas.filter(e => e.activa !== false);
  const sucursalesEmpresa = sucursales.filter(s => s.empresa_id === empresaId && s.activa !== false);
  const empresaSel = empresas.find(e => e.id === empresaId);
  const sucursalSel = sucursales.find(s => s.id === sucursalId);

  const setLinea = (idx, campo, val) => setLineas(prev => prev.map((l, i) => i === idx ? { ...l, [campo]: val } : l));
  const quitarLinea = (idx) => setLineas(prev => prev.filter((_, i) => i !== idx));

  const subtotal = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precio) || 0), 0);
  const costoEnvio = Number(envio) || 0;
  const totalReal = subtotal + costoEnvio;
  const totalArriba = Math.ceil(totalReal * 2) / 2;
  const totalAbajo = Math.floor(totalReal * 2) / 2;
  const total = redondeo === "arriba" ? totalArriba : redondeo === "abajo" ? totalAbajo : totalReal;

  const guardar = async () => {
    if (!cliente.nombre.trim()) { showToast("Escribe el nombre del cliente"); return; }
    if (lineas.length === 0) { showToast("La cotización debe tener al menos un producto"); return; }
    setGuardando(true);
    try {
      // 1) Actualiza los datos del pedido
      await sb.patch("pedidos", cotizacion.id, {
        nombre_cliente: cliente.nombre, telefono: cliente.telefono, direccion: cliente.direccion,
        notas, total, costo_envio: costoEnvio,
        empresa_envio_id: empresaId, empresa_envio_nombre: empresaSel?.nombre || "",
        sucursal_id: sucursalId, sucursal_nombre: sucursalSel?.nombre || "",
      });
      // 2) Borra los items viejos y crea los nuevos
      try {
        const viejos = await sb.get("pedido_items", `?pedido_id=eq.${cotizacion.id}`);
        for (const v of (viejos || [])) { if (v.id) await sb.delete("pedido_items", v.id); }
      } catch(e) {}
      const nuevosItems = [];
      for (const l of lineas) {
        const sub = (Number(l.cantidad) || 0) * (Number(l.precio) || 0);
        const creado = await sb.post("pedido_items", {
          pedido_id: cotizacion.id, producto_id: l.producto_id, nombre_producto: l.nombre,
          cantidad: Number(l.cantidad) || 0, precio_unitario: Number(l.precio) || 0, subtotal: sub,
        });
        if (Array.isArray(creado) && creado[0]) nuevosItems.push(creado[0]);
      }
      showToast("Cotización actualizada");
      onSaved({ ...cotizacion, nombre_cliente: cliente.nombre, telefono: cliente.telefono, direccion: cliente.direccion, notas, total, costo_envio: costoEnvio, empresa_envio_id: empresaId, empresa_envio_nombre: empresaSel?.nombre || "", sucursal_id: sucursalId, sucursal_nombre: sucursalSel?.nombre || "", items: nuevosItems });
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {lineas.map((l, idx) => (
              <div key={idx} style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{l.nombre}</div>
                  <button onClick={() => quitarLinea(idx)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: GRAY3, fontWeight: 700 }}>Cantidad</label>
                    <input type="number" min="0" value={l.cantidad} onChange={e => setLinea(idx, "cantidad", e.target.value)} style={{ ...S.input, marginBottom: 0 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: GRAY3, fontWeight: 700 }}>Precio c/u $</label>
                    <input type="number" min="0" step="0.01" value={l.precio} onChange={e => setLinea(idx, "precio", e.target.value)} style={{ ...S.input, marginBottom: 0 }} />
                  </div>
                  <div style={{ minWidth: 64, textAlign: "right" }}>
                    <label style={{ fontSize: 11, color: GRAY3, fontWeight: 700, display: "block" }}>Subtotal</label>
                    <span style={{ fontWeight: 800, color: RED }}>{money((Number(l.cantidad) || 0) * (Number(l.precio) || 0))}</span>
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

          {/* ENVÍO */}
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
  const hoyISO = new Date().toISOString().slice(0, 10);
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
    const hastaS = hoyD.toISOString().slice(0, 10);
    if (tipo === "dia") return [hastaS, hastaS];
    if (tipo === "semana") { const d = new Date(hoyD); d.setDate(d.getDate() - 6); return [d.toISOString().slice(0, 10), hastaS]; }
    if (tipo === "mes") { const d = new Date(hoyD.getFullYear(), hoyD.getMonth(), 1); return [d.toISOString().slice(0, 10), hastaS]; }
    if (tipo === "anio") { const d = new Date(hoyD.getFullYear(), 0, 1); return [d.toISOString().slice(0, 10), hastaS]; }
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
    return [desdeAntD.toISOString().slice(0, 10), hastaAntD.toISOString().slice(0, 10)];
  };
  const [desdeAnt, hastaAnt] = calcularRangoAnterior();

  const cargarDatos = async () => {
    setCargando(true);
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
        sb.get("eventos_analytics", `?created_at=gte.${desdeISO}&created_at=lte.${hastaISO}&order=created_at.desc&limit=8000`),
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
        // Mismo trío, pero del periodo anterior -- para calcular el % de cambio
        sb.get("eventos_analytics", `?created_at=gte.${desdeAntISO}&created_at=lte.${hastaAntISO}&limit=8000`),
        sb.get("usuarios", `?created_at=gte.${desdeAntISO}&created_at=lte.${hastaAntISO}&origen_cuenta=eq.web`),
        sb.get("usuarios", `?created_at=gte.${desdeAntISO}&created_at=lte.${hastaAntISO}&origen_cuenta=eq.admin_manual`),
      ]);
      setEventos(evts || []); setUsuariosNuevos(usrs || []); setClientesManuales(manuales || []); setPedidosPres(pedItems || []);
      setCotizaciones(cotizacionesData || []); setEquipoNombres(equipo || []);
      setEventosAnterior(evtsAnt || []); setUsuariosAnterior(usrsAnt || []); setManualesAnterior(manualesAnt || []);
    } catch(e) {
      console.warn("Error cargando analítica:", e.message);
      setEventos([]); setUsuariosNuevos([]); setClientesManuales([]); setPedidosPres([]); setCotizaciones([]); setEquipoNombres([]);
      setEventosAnterior([]); setUsuariosAnterior([]); setManualesAnterior([]);
    }
    setCargando(false);
  };

  useEffect(() => { cargarDatos(); }, [desde, hasta]);

  // Visitas en vivo: independiente del filtro de fecha, se refresca cada 30s por su cuenta
  useEffect(() => {
    const cargarEnVivo = async () => {
      try {
        const haceTresMin = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const recientes = await sb.get("eventos_analytics", `?created_at=gte.${haceTresMin}&tipo=in.(visita,heartbeat)&select=visitante_id`);
        setEnVivo(new Set((recientes || []).map(r => r.visitante_id)).size);
      } catch(e) { /* no es crítico, se reintenta solo en 30s */ }
    };
    cargarEnVivo();
    const t = setInterval(cargarEnVivo, 30000);
    return () => clearInterval(t);
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

  const topPor = (tipo, n = 8) => {
    const mapa = {};
    eventos.filter(e => e.tipo === tipo).forEach(e => {
      const clave = e.valor_nombre || "(sin nombre)";
      mapa[clave] = (mapa[clave] || 0) + 1;
    });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, n);
  };
  const topCategorias = topPor("click_categoria");
  const topProductos = topPor("click_producto");
  const topBusquedas = topPor("busqueda");
  const topCarrito = topPor("agregar_carrito");
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
  const topWhatsapp = topPor("consulta_whatsapp");
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
          <span className="oft-live-dot" /> <NumeroAnimado valor={enVivo} /> en vivo ahora
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

          {/* TOP 4 LISTAS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><LayoutGrid size={17} color={RED} /> Categorías más vistas</div>
              {topCategorias.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topCategorias.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxCat} color={RED} delay={i * 0.04} />)}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Tag size={17} color="#856404" /> Productos más vistos</div>
              {topProductos.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topProductos.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxProd} color="#856404" delay={i * 0.04} />)}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Search size={17} color="#0F6E56" /> Búsquedas más frecuentes</div>
              {topBusquedas.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topBusquedas.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxBusq} color="#0F6E56" delay={i * 0.04} />)}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><ShoppingCart size={17} color="#1D4ED8" /> Más agregados al carrito</div>
              {topCarrito.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topCarrito.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxCarr} color="#1D4ED8" delay={i * 0.04} />)}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Package size={17} color="#B45309" /> Cómo compran (pieza / media / docena / flexpack)</div>
              {topPresentacion.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topPresentacion.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxPres} color="#B45309" delay={i * 0.04} />)}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><MessageCircle size={17} color="#25D366" /> Consultas por WhatsApp — de dónde vienen</div>
              {topWhatsapp.length === 0 ? <p style={{ color: GRAY3, fontSize: 13 }}>Sin datos en este rango.</p> : topWhatsapp.map(([nombre, valor], i) => <BarraTop key={nombre} etiqueta={nombre} valor={valor} maximo={maxWhatsapp} color="#25D366" delay={i * 0.04} />)}
            </div>
          </div>

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
  const [diario, setDiario] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [ingresosPorProducto, setIngresosPorProducto] = useState({});
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const calcularRango = (tipo) => {
    const hoyD = new Date();
    const hastaS = hoyD.toISOString().slice(0, 10);
    if (tipo === "dia") return [hastaS, hastaS];
    if (tipo === "semana") { const d = new Date(hoyD); d.setDate(d.getDate() - 6); return [d.toISOString().slice(0, 10), hastaS]; }
    if (tipo === "mes") { const d = new Date(hoyD.getFullYear(), hoyD.getMonth(), 1); return [d.toISOString().slice(0, 10), hastaS]; }
    if (tipo === "anio") { const d = new Date(hoyD.getFullYear(), 0, 1); return [d.toISOString().slice(0, 10), hastaS]; }
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
        sb.get("meta_campanas_diario", "?order=fecha.asc&limit=5000"),
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
        const items = await sb.get("pedido_items", `?producto_id=in.(${idsProducto.join(",")})&select=producto_id,subtotal,pedidos(created_at,pagado)`);
        const mapa = {};
        (items || []).forEach(it => {
          if (!it.pedidos?.pagado) return;
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
    const desdeCampana = campana.fecha_inicio ? new Date(campana.fecha_inicio) : null;
    const hastaCampana = campana.fecha_fin ? new Date(campana.fecha_fin + "T23:59:59") : null;
    const desdeFiltro = new Date(desde + "T00:00:00");
    const hastaFiltro = new Date(hasta + "T23:59:59");
    let ingresos = 0;
    asignadosDeEsta.forEach(a => {
      (ingresosPorProducto[a.producto_id] || []).forEach(v => {
        const f = new Date(v.fecha);
        if (desdeCampana && f < desdeCampana) return;
        if (hastaCampana && f > hastaCampana) return;
        if (f < desdeFiltro || f > hastaFiltro) return; // también dentro del rango de fecha elegido
        ingresos += v.monto;
      });
    });
    return ingresos;
  };

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
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Campañas ({campanas.length})</div>
          {campanas.length === 0 ? (
            <p style={{ color: GRAY3, fontSize: 13 }}>Todavía no hay campañas sincronizadas — dale a "Sincronizar con Meta" (necesitas haber guardado META_ACCESS_TOKEN y META_AD_ACCOUNT_ID en Supabase primero).</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {campanas.map((camp, i) => (
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

function AdminView() {
  const { products, setProducts, categories, setCategories, gruposCategorias, setGruposCategorias, banners, setBanners, popups, setPopups, empresas, setEmpresas, sucursales, setSucursales, localesRetiro, setLocalesRetiro, retiroLocalHabilitado, setRetiroLocalHabilitado, showToast, setView, setUser, user } = useApp();
  // Rol del usuario actual: 'admin' = módulo completo, 'operador' = acceso limitado.
  // Los admins creados antes de este cambio pueden no tener "rol" guardado todavía — por
  // compatibilidad, si es_admin es true y no tiene rol, se trata como admin completo.
  const esAdminCompleto = user?.rol === "admin" || (user?.es_admin && !user?.rol);
  const esOperador = user?.rol === "operador";
  const [tab, setTab] = useState("dashboard");
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
  const emptyProd = { referencia: "", nombre: "", descripcion: "", categoria_id: categories[0]?.id || 1, precio_pieza: "", precio_media_docena: "", precio_docena: "", badge: "", activo: true, destacado: false, imagen_url: "", tiene_tallas: false, tiene_colores: false, tallas: "", colores: "", distribucion_docena: "", distribucion_eje: "", proveedor_id: null, venta_por_unidad: false, tiene_stock_fisico: false, notas_fragancia: "" };
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
  const emptyBulkEdit = { nombre: "", categoria_id: "", precio_pieza: "", precio_media_docena: "", precio_docena: "", badge: "", descripcion: "", activo: "", destacado: "", tiene_tallas: "", tallas: "", tiene_colores: "", colores: "", distribucion_docena: "", distribucion_eje: "", proveedor_id: "", tiene_stock_fisico: "" };
  const [bulkEdit, setBulkEdit] = useState(emptyBulkEdit);
  const [shippingLabel, setShippingLabel] = useState(null); // pedido para la guía de envío
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null); // pedido pendiente de eliminar (confirmación)
  const [cotizacionAEditar, setCotizacionAEditar] = useState(null); // cotización que se está editando
  const [cotizacionImagen, setCotizacionImagen] = useState(null); // cotización a la que se le está generando la imagen
  const [facturaImagen, setFacturaImagen] = useState(null); // pedido al que se le está generando la imagen de factura
  const [rankingModal, setRankingModal] = useState(null); // null | "reponer" | "rotacion" | "ingreso" | "zona" — para ver el top 50 en Análisis de Stock
  const [rankingModalProveedorId, setRankingModalProveedorId] = useState(null); // si se abrió desde el análisis de UN proveedor, filtra solo sus productos
  const [proveedorExpandidoId, setProveedorExpandidoId] = useState(null); // qué proveedor tiene su análisis de stock abierto
  const [clienteForm, setClienteForm] = useState(null); // null | {} (crear) | {id,...} (editar)
  const [equipoForm, setEquipoForm] = useState(false); // true = mostrar modal de agregar miembro
  const [promoverForm, setPromoverForm] = useState(false); // true = mostrar modal de promover cliente existente
  const [miembroAQuitar, setMiembroAQuitar] = useState(null); // usuario del equipo a quitar (confirmación)
  const [mfaModal, setMfaModal] = useState(false); // true = mostrar modal de verificación en dos pasos
  const [proveedorForm, setProveedorForm] = useState(null); // null | {} (crear) | {id,...} (editar)
  const [localForm, setLocalForm] = useState(null); // null | {} (crear) | {id,...} (editar) — local de retiro
  const [localAEliminar, setLocalAEliminar] = useState(null); // local de retiro a eliminar (confirmación)
  // Reporte de ventas por rango de fechas
  const [reporteDesde, setReporteDesde] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [reporteHasta, setReporteHasta] = useState(() => new Date().toISOString().slice(0, 10));
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
  // ── DESCUENTOS ──
  const [descuentos, setDescuentos] = useState([]); // lista de códigos de descuento
  const [descForm, setDescForm] = useState(null); // formulario crear/editar descuento o null
  const [guardandoDesc, setGuardandoDesc] = useState(false);
  const [descProductosOpen, setDescProductosOpen] = useState(false); // selector de productos en el form
  const [busquedaCotizacion, setBusquedaCotizacion] = useState(""); // buscar cotización por nombre de cliente
  // ── RETORNOS ──
  const [retornos, setRetornos] = useState([]);
  const [proveedores, setProveedores] = useState([]); // proveedores externos (productos que no son propios)
  const [retornoForm, setRetornoForm] = useState(null); // null | objeto del formulario
  const [guardandoRetorno, setGuardandoRetorno] = useState(false);
  const [busquedaRetorno, setBusquedaRetorno] = useState("");
  const [eliminando, setEliminando] = useState(false);
  // Filtro de ventas por periodo en el dashboard
  const [rangoVentas, setRangoVentas] = useState("todo"); // dia | semana | mes | anio | todo | personalizado | rango
  const [busquedaPedidos, setBusquedaPedidos] = useState(""); // busca por # de pedido o nombre de cliente, en la pestaña Pedidos
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
    const texto = busquedaPedidos.trim().toLowerCase();
    if (!texto) return true;
    return (o.codigo || "").toLowerCase().includes(texto) || (o.nombre_cliente || "").toLowerCase().includes(texto);
  });
  const fmtCorta = (d) => new Date(d).toLocaleDateString("es-PA", { day: "2-digit", month: "short" });
  const etiquetaRango = { dia: "Hoy", semana: "Última semana", mes: "Este mes", anio: "Este año", todo: "Todo el tiempo", personalizado: fechaPersonalizada ? new Date(fechaPersonalizada).toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" }) : "Fecha específica", rango: (rangoInicio && rangoFin) ? `${fmtCorta(rangoInicio)} → ${fmtCorta(rangoFin)}` : "Rango de fechas" }[rangoVentas];

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
  const analisisStock = (() => {
    const map = {}; // producto_id -> { cantidad, ingreso, primeraFecha, ultimaFecha }
    pedidosRealesTodos.forEach(o => {
      (o.items || []).forEach(it => {
        if (!it.producto_id) return;
        const key = it.producto_id;
        if (!map[key]) map[key] = { producto_id: key, cantidad: 0, ingreso: 0, primeraFecha: o.created_at, ultimaFecha: o.created_at };
        map[key].cantidad += Number(it.cantidad || 0);
        map[key].ingreso += Number(it.subtotal || 0);
        if (new Date(o.created_at) < new Date(map[key].primeraFecha)) map[key].primeraFecha = o.created_at;
        if (new Date(o.created_at) > new Date(map[key].ultimaFecha)) map[key].ultimaFecha = o.created_at;
      });
    });

    const hoy = new Date();
    const filas = Object.values(map).map(m => {
      const prod = products.find(p => p.id === m.producto_id);
      if (!prod) return null;
      const diasDesdeInicio = Math.max(1, Math.ceil((hoy - new Date(m.primeraFecha)) / 86400000));
      const velocidadDiaria = m.cantidad / diasDesdeInicio; // unidades vendidas por día
      const costoUnit = Number(prod.costo || 0);
      const margen = costoUnit > 0 ? m.ingreso - (costoUnit * m.cantidad) : null; // null = sin dato de costo
      // Stock actual (si está sincronizado con Odoo)
      const tieneStock = !!prod.stock_actualizado_at;
      const stockActual = tieneStock ? Number(prod.stock || 0) : null;
      // Días hasta agotar stock, según velocidad de venta actual
      const diasHastaAgotar = (tieneStock && velocidadDiaria > 0) ? Math.floor(stockActual / velocidadDiaria) : null;
      // Sugerencia de compra: cubrir ventas del lead time + un colchón de seguridad (otro lead time)
      const sugerenciaCompra = Math.ceil(velocidadDiaria * LEAD_TIME_DIAS * 2);
      // ¿Cuándo reponer? Si ya sabemos el stock, restamos lo que tardará en agotarse menos el lead time
      let diasParaReponer = null;
      if (diasHastaAgotar !== null) diasParaReponer = Math.max(0, diasHastaAgotar - LEAD_TIME_DIAS);
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
    } catch(e) { alert("Error al actualizar estado"); }
  };

  // ── CONVERTIR COTIZACIÓN EN PEDIDO ─────────────────────────────
  const convertirAPedido = async (cot) => {
    const ok = confirm(`¿Convertir la cotización ${cot.codigo} en un pedido real?\n\nSe registrará como venta de HOY y aparecerá en Pedidos.`);
    if (!ok) return;
    try {
      // Nuevo código de pedido (mantiene el número de factura)
      const nuevoCodigo = "OFT-" + (cot.num_factura || Date.now().toString().slice(-6));
      // La fecha pasa a HOY: la venta cuenta el día en que se confirma, no el día de la cotización
      const ahora = new Date().toISOString();
      await sb.patch("pedidos", cot.id, {
        tipo: "pedido", codigo: nuevoCodigo, estado: 0, created_at: ahora,
        es_cotizacion_convertida: true, fecha_cotizacion_original: cot.created_at,
      });
      setOrders(prev => prev.map(o => o.id === cot.id ? { ...o, tipo: "pedido", codigo: nuevoCodigo, estado: 0, created_at: ahora, es_cotizacion_convertida: true, fecha_cotizacion_original: cot.created_at } : o));
      showToast(`¡Cotización convertida en pedido ${nuevoCodigo}!`);

      // Crea la venta en Odoo. Esta conversión tampoco pasa por Yappy (igual que un pedido
      // manual nuevo), así que llamamos directo a la misma función que usa yappy-ipn.
      try {
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
        await fetch(`${SUPABASE_URL}/functions/v1/crear-venta-odoo`, {
          method: "POST",
          headers: sb.functionHeaders(),
          body: JSON.stringify({
            codigo: nuevoCodigo, nombre_cliente: cot.nombre_cliente, email_cliente: null,
            telefono: cot.telefono, direccion: cot.direccion,
            costo_envio: cot.costo_envio, empresa_envio: cot.empresa_envio_nombre,
            items: itemsOdoo,
          }),
        });
      } catch(e) {
        console.error("Error creando venta en Odoo:", e);
        showToast("Pedido creado, pero no se pudo sincronizar con Odoo. Avísale a soporte.");
      }
    } catch(e) { alert("Error al convertir: " + (e.message || e)); }
  };

  // ── ELIMINAR PEDIDO (con confirmación) ─────────────────────────
  const eliminarPedido = async () => {
    if (!pedidoAEliminar?.id) return;
    setEliminando(true);
    try {
      // Borra primero los items del pedido, luego el pedido
      try {
        const its = await sb.get("pedido_items", `?pedido_id=eq.${pedidoAEliminar.id}`);
        for (const it of (its || [])) { if (it.id) await sb.delete("pedido_items", it.id); }
      } catch(e) {}
      await sb.delete("pedidos", pedidoAEliminar.id);
      setOrders(prev => prev.filter(o => o.id !== pedidoAEliminar.id));
      showToast(`Pedido ${pedidoAEliminar.codigo} eliminado`);
      setPedidoAEliminar(null);
    } catch(e) { alert("Error al eliminar: " + (e.message || e)); }
    setEliminando(false);
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
    setProdForm({ referencia: p.referencia || "", nombre: p.nombre || "", descripcion: p.descripcion || "", categoria_id: p.categoria_id || categories[0]?.id || 1, precio_pieza: p.precio_pieza, precio_media_docena: p.precio_media_docena, precio_docena: p.precio_docena, badge: p.badge || "", activo: p.activo, destacado: p.destacado || false, imagen_url: p.imagen_url || "", tiene_tallas: p.tiene_tallas || false, tiene_colores: p.tiene_colores || false, tallas: p.tallas || "", colores: p.colores || "", distribucion_docena: p.distribucion_docena || "", distribucion_eje: p.distribucion_eje || "", proveedor_id: p.proveedor_id || null, venta_por_unidad: p.venta_por_unidad || false, tiene_stock_fisico: p.tiene_stock_fisico || false, notas_fragancia: p.notas_fragancia || "" });
    setEditingId(p.id);
    setShowProdForm(true);
    setShowBulk(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveProd = async () => {
    if (!prodForm.nombre || prodForm.precio_pieza === "") { alert("Nombre y precio por pieza son requeridos"); return; }
    const payload = { ...prodForm, precio_pieza: Number(prodForm.precio_pieza), precio_media_docena: Number(prodForm.precio_media_docena), precio_docena: Number(prodForm.precio_docena) };
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
    if (!window.html2canvas || !window.jspdf) { alert("Cargando generador de PDF, intenta de nuevo en unos segundos."); return; }
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
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297, margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
      heightLeft -= (pageH - margin * 2);
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgH - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
        heightLeft -= (pageH - margin * 2);
      }
      pdf.save(`reporte-ventas-${reporteDesde}-a-${reporteHasta}.pdf`);
    } catch(e) { alert("Error generando PDF: " + e.message); }
    setReporteBusy(false);
  };

  const reportePorOperadorRef = useRef(null);
  const descargarReporteOperadorPDF = async () => {
    if (!window.html2canvas || !window.jspdf) { alert("Cargando generador de PDF, intenta de nuevo en unos segundos."); return; }
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
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297, margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
      heightLeft -= (pageH - margin * 2);
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgH - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
        heightLeft -= (pageH - margin * 2);
      }
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

  const tabs = esOperador ? [
    ["dashboard", "Inicio", BarChart3],
    ["orders", "Pedidos", Package],
    ["crear", "Crear", FilePlus],
    ["retornos", "Retornos", RefreshCw],
    ["users", "Clientes", Users],
  ] : [
    ["dashboard", "Dashboard", BarChart3],
    ["analytics", "Analítica Web", Eye],
    ["orders", "Pedidos", Package],
    ["crear", "Crear", FilePlus],
    ["products", "Productos", Tag],
    ["categories", "Categorías", FolderOpen],
    ["banners", "Banners Inicio", ImageIcon],
    ["popups", "Pop-ups", Sparkles],
    ["descuentos", "Descuentos", Zap],
    ["retornos", "Retornos", RefreshCw],
    ["analisis", "Análisis Stock", TrendingUp],
    ["proveedores", "Proveedores", Building2],
    ["retirolocal", "Retiro en Local", Home],
    ["reporteventas", "Reporte de Ventas", FileText],
    ["shipping", "Envíos", Truck],
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
        {tab === "crear" && <CrearPedidoView />}

        {/* ═══════════ DASHBOARD ═══════════ */}
        {tab === "dashboard" && (
          <>
            {esAdminCompleto ? (
            <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><BarChart3 size={24} color={RED} /> Dashboard</div>
            {loadingData ? <Spinner /> : (
              <>
                {/* FILTRO POR PERIODO */}
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

                {/* TARJETAS DE MÉTRICAS */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 20 }}>
                  {[
                    ["Ingresos totales", money(ingresoTotal), DollarSign, RED],
                    ["Órdenes totales", ordenesTotal, ShoppingBag, "#004085"],
                    ["Clientes", clientesTotal, Users, "#155724"],
                    ["Clientes que regresan", returningRate.toFixed(0) + "%", RefreshCw, "#6f42c1"],
                    ["Mi balance", money(balance), Wallet, "#856404"],
                  ].map(([label, val, Icon, color], i) => (
                    <div key={label} className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}`, transition: "transform 0.2s, box-shadow 0.2s", animationDelay: `${i * 0.07}s` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 13, color: GRAY3, marginBottom: 6 }}>{label}</div>
                          <div style={{ fontSize: 26, fontWeight: 900, color }}>{val}</div>
                        </div>
                        <div style={{ background: color + "15", borderRadius: 10, padding: 10 }}>
                          <Icon size={22} color={color} strokeWidth={2} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* WIDGET: AOV OVER TIME + MINI-TABLA DE VENTAS */}
                <div className="oft-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 28 }}>
                  {/* AVERAGE ORDER VALUE OVER TIME */}
                  <div className="oft-widget" style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}`, transition: "transform 0.2s, box-shadow 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={18} color={RED} /> Valor promedio por orden</div>
                      <div style={{ textAlign: "right" }}>
                        <div className="oft-total-pop" style={{ fontSize: 24, fontWeight: 900, color: RED }}>{money(aovActual)}</div>
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
                              {esResta && val > 0 ? "−" : ""}{money(val)}
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
                          </div>
                          <div style={{ fontWeight: 800, color: "#856404" }}>{money(o.total)}</div>
                          <span style={{ background: "#FFF3CD", color: "#856404", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Cotización</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button onClick={() => setCotizacionAEditar(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: "none", color: BLACK, border: `1.5px solid ${BLACK}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <PencilIcon size={15} /> Editar
                          </button>
                          <button onClick={() => setCotizacionImagen(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: "none", color: "#856404", border: "1.5px solid #856404", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <ImageIcon size={15} /> Imagen
                          </button>
                          <button onClick={() => convertirAPedido(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: RED, color: WHITE, border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <CheckCircle2 size={15} /> A pedido
                          </button>
                        </div>
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
                        ["Ventas de hoy", money(ventasHoyTotal), DollarSign, RED],
                        ["Pedidos de hoy", pedidosHoy.length, ShoppingBag, "#004085"],
                        ["Cotizaciones activas", cotizaciones.length, FileText, "#856404"],
                      ].map(([label, val, Icon, color]) => (
                        <div key={label} style={S.statCard}><Icon size={20} color={color} strokeWidth={1.8} /><div style={{ fontSize: 28, fontWeight: 900, color }}>{val}</div><div style={{ fontSize: 13, color: GRAY3 }}>{label}</div></div>
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
                            </div>
                            <div style={{ fontWeight: 800, color: "#856404" }}>{money(o.total)}</div>
                            <span style={{ background: "#FFF3CD", color: "#856404", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Cotización</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button onClick={() => setCotizacionAEditar(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: "none", color: BLACK, border: `1.5px solid ${BLACK}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <PencilIcon size={15} /> Editar
                            </button>
                            <button onClick={() => setCotizacionImagen(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: "none", color: "#856404", border: "1.5px solid #856404", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <ImageIcon size={15} /> Imagen
                            </button>
                            <button onClick={() => convertirAPedido(o)} className="oft-btn-press" style={{ flex: 1, justifyContent: "center", background: RED, color: WHITE, border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <CheckCircle2 size={15} /> A pedido
                            </button>
                          </div>
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
            <div style={{ position: "relative", maxWidth: 360, marginBottom: 20 }}>
              <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={busquedaPedidos}
                onChange={e => setBusquedaPedidos(e.target.value)}
                placeholder="Buscar por # de pedido o cliente..."
                style={{ ...S.input, marginBottom: 0, paddingLeft: 36 }}
              />
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
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => notifyWhatsApp(o, o.estado)} title="Enviar notificación por WhatsApp" style={{ ...S.btnWA, padding: "6px 10px", fontSize: 12 }}>
                              <MessageCircle size={14} /> Avisar
                            </button>
                            <button onClick={() => setShippingLabel(o)} title="Generar guía de envío" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Truck size={14} /> Guía
                            </button>
                            <button onClick={() => setFacturaImagen(o)} title="Descargar imagen/PDF de la factura" style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <ImageIcon size={14} /> Factura
                            </button>
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
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>{money(o.total)}</div>
                        <div style={{ marginTop: 4 }}><StatusBadge index={o.estado} retiro={o.retiro_local} /></div>
                      </div>
                    </div>

                    {/* Envío o Retiro en el local */}
                    {o.retiro_local ? (
                      <div style={{ fontSize: 12, color: "#856404", background: "#FFF3CD", borderRadius: 8, padding: "8px 10px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                        <Home size={14} /> Retiro en el local
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
                      <button onClick={() => setShippingLabel(o)} style={{ background: BLACK, color: WHITE, border: "none", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Truck size={16} /> Guía
                      </button>
                      <button onClick={() => setFacturaImagen(o)} style={{ background: "none", color: RED, border: `1.5px solid ${RED}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <ImageIcon size={16} /> Factura
                      </button>
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
            {shippingLabel && <ShippingLabelModal order={shippingLabel} onClose={() => setShippingLabel(null)} />}
            {/* MODAL IMAGEN/PDF DE FACTURA */}
            {facturaImagen && <OrderImageModal order={facturaImagen} onClose={() => setFacturaImagen(null)} />}
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
                  {/* Campos de precio: solo números y punto decimal */}
                  {[["precio_pieza","Precio x pieza"],["precio_media_docena","Precio x media docena"],["precio_docena","Precio x docena"]].map(([k,l]) => (
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
                  <div><label style={S.label}>Categoría</label>
                    <select style={{ ...S.input }} value={prodForm.categoria_id} onChange={e => setProdForm({...prodForm,categoria_id:Number(e.target.value)})}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div><label style={S.label}>Proveedor</label>
                    <select style={{ ...S.input }} value={prodForm.proveedor_id || ""} onChange={e => setProdForm({...prodForm, proveedor_id: e.target.value ? Number(e.target.value) : null})}>
                      <option value="">Producto propio de Ofertodo</option>
                      {proveedores.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                    </select>
                  </div>
                  {prodForm.proveedor_id && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 10, padding: "10px 14px" }}>
                      <input type="checkbox" id="tiene_stock_fisico" checked={!!prodForm.tiene_stock_fisico} onChange={e => setProdForm({...prodForm, tiene_stock_fisico: e.target.checked})} style={{ width: 18, height: 18 }} />
                      <label htmlFor="tiene_stock_fisico" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        Tengo este producto en stock físico
                        <div style={{ fontSize: 11, color: GRAY3, fontWeight: 400 }}>Actívalo si ya le compraste esta mercancía al proveedor y la tienes en tu tienda — aplican los mismos bloqueos por stock que tus productos propios (agotado, límites de docena/media docena). Si sigues comprándolo bajo pedido, déjalo apagado.</div>
                      </label>
                    </div>
                  )}
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
                  <label style={S.label}>Proveedor</label>
                  <select style={S.input} value={bulkEdit.proveedor_id} onChange={e => setBulkEdit({...bulkEdit, proveedor_id: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="__ninguno__">Quitar proveedor (pasa a ser propio de Ofertodo)</option>
                    {proveedores.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                  </select>
                  <label style={S.label}>Tengo stock físico (para productos de proveedor)</label>
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
                    {urgentesReponer.length > 5 && (
                      <button onClick={() => setRankingModal("reponer")} className="oft-btn-press" style={{ marginTop: 12, background: "none", border: "none", color: "#856404", fontWeight: 800, fontSize: 13, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        Ver los {Math.min(urgentesReponer.length, 50)} productos →
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
              Productos de proveedores externos (comprados bajo pedido) — nunca se bloquean por falta de stock en la
              web, ya que la disponibilidad real se confirma yendo directo al proveedor cuando llega el pedido.
            </p>
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
                  <input type="date" style={S.input} value={reporteHasta} onChange={e => setReporteHasta(e.target.value)} min={reporteDesde} max={new Date().toISOString().slice(0, 10)} />
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

        {/* ═══════════ CLIENTES ═══════════ */}
        {tab === "users" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Users size={24} color={RED} /> Clientes Registrados</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => {
                  // Exportar clientes a CSV (abre en Excel)
                  const BOM = "\uFEFF"; // para que Excel reconozca UTF-8
                  const headers = ["Nombre", "Email", "WhatsApp", "Pedidos", "Admin", "Registrado"];
                  const filas = users.map(u => {
                    const pedidosUser = orders.filter(o => o.usuario_id === u.id).length;
                    return [
                      u.nombre || "",
                      (u.email || "").includes("@ofertodo.local") ? "" : (u.email || ""),
                      u.telefono || "",
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
              {[["Total clientes", users.length, Users, RED], ["Con pedidos", new Set(orders.map(o => o.usuario_id)).size, ShoppingBag, "#155724"]].map(([l,n,Icon,c]) => (
                <div key={l} style={S.statCard}><Icon size={20} color={c} strokeWidth={1.8} /><div style={{ fontSize: 28, fontWeight: 900, color: c }}>{n}</div><div style={{ fontSize: 13, color: GRAY3 }}>{l}</div></div>
              ))}
            </div>
            {loadingData ? <Spinner /> : (
              <>
              {/* TABLA (solo escritorio) */}
              <div className="oft-table-wrap oft-only-desktop" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
                <table style={S.table}>
                  <thead><tr>{["Nombre","Email","WhatsApp","Pedidos","Registrado",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: GRAY3, padding: 30 }}>Aún no hay clientes registrados</td></tr>
                    ) : users.map(u => {
                      const pedidosUser = orders.filter(o => o.usuario_id === u.id).length;
                      return (
                        <tr key={u.id}>
                          <td style={{ ...S.td, fontWeight: 700 }}>{u.nombre}{u.es_admin && <span style={{ marginLeft: 6, fontSize: 10, background: RED, color: WHITE, padding: "1px 6px", borderRadius: 10 }}>ADMIN</span>}</td>
                          <td style={S.td}>{u.email}</td>
                          <td style={S.td}>{u.telefono || "-"}</td>
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
                {users.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: GRAY3 }}>Aún no hay clientes registrados</div>
                ) : users.map(u => {
                  const pedidosUser = orders.filter(o => o.usuario_id === u.id).length;
                  return (
                    <div key={u.id} style={{ background: WHITE, borderRadius: 14, border: `1px solid ${GRAY2}`, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: `linear-gradient(135deg, ${RED}, ${RED_D})`, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                          {(u.nombre || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>{u.nombre}{u.es_admin && <span style={{ fontSize: 9, background: RED, color: WHITE, padding: "1px 6px", borderRadius: 10 }}>ADMIN</span>}</div>
                          <div style={{ fontSize: 12, color: GRAY3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
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
        )}

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
