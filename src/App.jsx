import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart, Search, Trash2, MessageCircle, X, Package, CheckCircle2,
  MapPin, CreditCard, LayoutGrid, FolderOpen, Tag, Truck, Headphones,
  Plus, Pencil, Upload, RefreshCw, ChevronDown, ChevronUp, LogOut, User, Home,
  Shirt, Footprints, Watch, Sparkles, ClipboardList, Image as ImageIcon,
  FileSpreadsheet, FolderPlus, Zap, Lock, Users, BarChart3, DollarSign,
  TrendingUp, Wallet, ShoppingBag, Pencil as PencilIcon, Save,
  Building2, MapPin as MapPinIcon, Send, FilePlus, Download, FileText, Receipt,
  Calendar as CalendarIcon, Eye, EyeOff, Share2, AlertTriangle, ChevronRight
} from "lucide-react";

import {
  AppCtx, BLACK, CategoryIcon, GRAY, GRAY2,
  GRAY3, Logo, ORDER_STATUS_ENVIO, ORDER_STATUS_RETIRO, RED,
  RED_D, S, STATUS_ICONS_ENVIO, STATUS_ICONS_RETIRO, SUPABASE_KEY,
  SUPABASE_URL, Spinner, StatusBadge, WHITE, colorToHex,
  imagenOptimizada, mediaDocenaDesdeDistribucion, parseDistribucion, presLabelPlural, presToPiezas,
  presUnitPrice, sb, useApp, useLockBodyScroll,
} from "./shared.jsx";

// El panel de administrador vive en su propio archivo y solo se descarga cuando
// alguien entra de verdad a /admin — así un cliente normal nunca tiene que bajar
// ese código de más (es casi el 40% de todo el sitio).
const AdminView = lazy(() => import("./AdminView.jsx"));

// ════════════════════════════════════════════════════════════════
//  🔧 CONFIGURACIÓN SUPABASE — Pega tus datos aquí
//  1. Ve a supabase.com → tu proyecto → Settings → API
//  2. Copia "Project URL" y "anon public key"
// ════════════════════════════════════════════════════════════════
const WA_NUMBER   = "50767200474";                        // ← Tu número WhatsApp
const YAPPY_DIRECTORIO = "@ofertodopanama";               // ← Tu usuario en el Directorio de Yappy, para que el cliente te pague
const YAPPY_FN_CREAR = SUPABASE_URL + "/functions/v1/crear-orden-yappy"; // Edge Function que crea la orden de pago en Yappy

// ─── Supabase client minimalista (sin instalar paquetes) ────────

// ─── BRAND TOKENS ───────────────────────────────────────────────

// ─── CONTEXT ────────────────────────────────────────────────────

// Bloquea el scroll del fondo mientras un modal está abierto (versión simple y segura:
// solo pausa el scroll, sin tocar position/top/left del body, para no interferir con
// barras fijas ni con el layout del resto de la app).

// ─── HOOK RESPONSIVE ────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

// ─── ORDEN ESTADOS ──────────────────────────────────────────────
// Dos flujos distintos según cómo se entrega el pedido: envío a domicilio, o retiro en el local.
// Se mantiene ORDER_STATUS como alias del flujo de envío, por compatibilidad con lo que ya existía.
const ORDER_STATUS = ORDER_STATUS_ENVIO;
const STATUS_ICONS = STATUS_ICONS_ENVIO;

// ─── ICONOS DE CATEGORÍA (imagen subida o icono futurista) ──────

// ═══════════════════════════════════════════════════════════════
//  SELECTOR DE CATEGORÍA — un solo botón que abre un panel limpio
//  con todas las categorías, en vez de mostrarlas todas de golpe.
// ═══════════════════════════════════════════════════════════════
function CategoriaTrigger({ categorias, gruposCategorias, seleccionadaId, onClick }) {
  const cat = categorias.find(c => c.id === seleccionadaId);
  const grupo = cat?.grupo_id ? gruposCategorias.find(g => g.id === cat.grupo_id) : null;
  return (
    <button onClick={onClick} className="oft-btn-press oft-cat-trigger" style={{
      display: "inline-flex", alignItems: "center", gap: 10, background: WHITE, border: `1.5px solid ${GRAY2}`,
      borderRadius: 14, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", width: "100%", maxWidth: 320,
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: cat ? "#FFF5F5" : GRAY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {cat ? <CategoryIcon cat={cat} size={17} color={RED} /> : <LayoutGrid size={17} color={GRAY3} strokeWidth={1.8} />}
      </div>
      <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: GRAY3, fontWeight: 700, letterSpacing: 0.3 }}>CATEGORÍA</div>
        <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cat ? (grupo ? `${grupo.nombre} › ${cat.nombre}` : cat.nombre) : "Todas las categorías"}
        </div>
      </div>
      <ChevronDown size={18} color={GRAY3} strokeWidth={2.2} />
    </button>
  );
}

function CategoriaSheet({ onClose, categorias, gruposCategorias, seleccionadaId, resaltadaId, onSeleccionar, grupoInicial }) {
  useLockBodyScroll();
  const isMobile = useIsMobile();
  // Nivel de navegación dentro del panel: null = vista inicial (grupos), o el grupo
  // activo (viendo sus categorías específicas, ej. dentro de "Ropa de Dama").
  // Si se abre desde una tarjeta de grupo en el inicio, entra directo a ese nivel.
  const [grupoActivo, setGrupoActivo] = useState(grupoInicial || null);

  const gruposConCategorias = gruposCategorias.filter(g => categorias.some(c => c.grupo_id === g.id));
  const sinGrupo = categorias.filter(c => !c.grupo_id);
  const categoriasDelGrupo = grupoActivo ? categorias.filter(c => c.grupo_id === grupoActivo.id) : [];

  const elegirCategoria = (id) => { onSeleccionar(id); setGrupoActivo(null); };

  return createPortal(
    <div className="oft-overlay" style={{ ...S.overlay, alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20 }} onClick={onClose}>
      <div
        className={isMobile ? "oft-sheet-slide" : "oft-qv-pop"}
        style={{
          background: WHITE, borderRadius: isMobile ? "22px 22px 0 0" : 22, width: "100%",
          maxWidth: isMobile ? 480 : (grupoActivo ? 720 : 620), maxHeight: isMobile ? "80vh" : "min(680px, 85vh)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px", flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 4, background: GRAY2 }} />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "10px 20px 14px" : "22px 26px 16px", flexShrink: 0 }}>
          {grupoActivo ? (
            <button onClick={() => setGrupoActivo(null)} className="oft-btn-press" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0, fontWeight: 900, fontSize: isMobile ? 18 : 21 }}>
              <ChevronDown size={isMobile ? 20 : 22} style={{ transform: "rotate(90deg)" }} /> {grupoActivo.nombre}
            </button>
          ) : (
            <div style={{ fontWeight: 900, fontSize: isMobile ? 18 : 21 }}>Elige una categoría</div>
          )}
          <button onClick={onClose} className="oft-btn-press" style={{ background: GRAY, border: "none", borderRadius: "50%", width: isMobile ? 30 : 34, height: isMobile ? 30 : 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><X size={isMobile ? 15 : 17} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: isMobile ? "0 20px 28px" : "0 26px 30px" }}>
          {!grupoActivo ? (
            // ── NIVEL 1: grupos generales + categorías sueltas (sin grupo) ──
            <div key="nivel-grupos" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 90 : 130}px, 1fr))`, gap: isMobile ? 10 : 14 }}>
              <div onClick={() => elegirCategoria(0)} className="oft-btn-press oft-cat-sheet-chip" style={{ animationDelay: "0s", border: `2px solid ${(seleccionadaId === 0) ? RED : GRAY2}`, borderRadius: 12, padding: isMobile ? "14px 6px" : "18px 8px", textAlign: "center", cursor: "pointer", background: (seleccionadaId === 0) ? "#FFF5F5" : WHITE }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}><LayoutGrid size={isMobile ? 22 : 26} color={(seleccionadaId === 0) ? RED : BLACK} strokeWidth={1.8} /></div>
                <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700 }}>Todo</div>
              </div>

              {gruposConCategorias.map((g, i) => {
                const primeraCatDelGrupo = categorias.find(c => c.grupo_id === g.id);
                const iconoParaMostrar = g.icono_url ? { icono_url: g.icono_url, nombre: g.nombre } : primeraCatDelGrupo;
                const tieneActivaAdentro = categorias.some(c => c.grupo_id === g.id && (c.id === seleccionadaId || c.id === resaltadaId));
                return (
                  <div key={"grupo-" + g.id} onClick={() => setGrupoActivo(g)} className="oft-btn-press oft-cat-sheet-chip" style={{ animationDelay: `${Math.min((i + 1) * 0.025, 0.3)}s`, border: `2px solid ${tieneActivaAdentro ? RED : GRAY2}`, borderRadius: 12, padding: isMobile ? "14px 6px" : "18px 8px", textAlign: "center", cursor: "pointer", background: tieneActivaAdentro ? "#FFF5F5" : WHITE, position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}><CategoryIcon cat={iconoParaMostrar} size={isMobile ? 22 : 26} color={tieneActivaAdentro ? RED : BLACK} /></div>
                    <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700 }}>{g.nombre}</div>
                    <ChevronRight size={13} color={GRAY3} style={{ position: "absolute", top: 6, right: 6 }} />
                  </div>
                );
              })}

              {sinGrupo.map((c, i) => {
                const activa = seleccionadaId === c.id || resaltadaId === c.id;
                return (
                  <div key={c.id} onClick={() => elegirCategoria(c.id)} className="oft-btn-press oft-cat-sheet-chip" style={{ animationDelay: `${Math.min((i + 1 + gruposConCategorias.length) * 0.025, 0.3)}s`, border: `2px solid ${activa ? RED : GRAY2}`, borderRadius: 12, padding: isMobile ? "14px 6px" : "18px 8px", textAlign: "center", cursor: "pointer", background: activa ? "#FFF5F5" : WHITE }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}><CategoryIcon cat={c} size={isMobile ? 22 : 26} color={activa ? RED : BLACK} /></div>
                    <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700 }}>{c.nombre}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            // ── NIVEL 2: categorías específicas dentro del grupo elegido (más grandes) ──
            <div key={"nivel-" + grupoActivo.id} style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 130 : 160}px, 1fr))`, gap: isMobile ? 14 : 16 }}>
              {categoriasDelGrupo.map((c, i) => {
                const activa = seleccionadaId === c.id || resaltadaId === c.id;
                return (
                  <div key={c.id} onClick={() => elegirCategoria(c.id)} className="oft-btn-press oft-cat-sheet-chip" style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s`, border: `2px solid ${activa ? RED : GRAY2}`, borderRadius: 14, padding: isMobile ? "22px 10px" : "26px 12px", textAlign: "center", cursor: "pointer", background: activa ? "#FFF5F5" : WHITE }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><CategoryIcon cat={c} size={isMobile ? 34 : 38} color={activa ? RED : BLACK} /></div>
                    <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800 }}>{c.nombre}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  , document.body);
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════


function Toast({ msg }) {
  if (!msg) return null;
  return <div className="oft-toast-in" style={{ ...S.toast, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} style={{ flexShrink: 0 }} /> {msg}</div>;
}



function calcPrice(product, qty) {
  const p1  = Number(product.precio_pieza);
  const p6  = Number(product.precio_media_docena); // precio fijo del paquete de 6
  const p12 = Number(product.precio_docena);       // precio fijo del paquete de 12

  if (qty <= 0) return 0;

  if (qty < 6) {
    // 1–5: precio por pieza × cantidad
    return p1 * qty;
  }

  if (qty === 6) {
    // exactamente media docena: precio fijo del paquete
    return p6;
  }

  if (qty < 12) {
    // 7–11: una media docena + excedente a precio por pieza
    // precio pieza unitario de la media docena = p6 / 6
    const excedente = qty - 6;
    return p6 + (p1 * excedente);
  }

  // 12 o más: docenas completas + excedente
  const docenas   = Math.floor(qty / 12);
  const resto     = qty % 12;
  let total       = docenas * p12;

  if (resto === 0) return total;
  if (resto === 6) return total + p6;                 // media docena exacta de sobra
  if (resto < 6)  return total + (p1 * resto);        // 1–5 piezas de sobra
  // 7–11 piezas de sobra: media docena + excedente
  return total + p6 + (p1 * (resto - 6));
}

// Helper: devuelve el desglose en texto para mostrar al usuario
function priceBreakdown(product, qty) {
  const p1  = Number(product.precio_pieza);
  const p6  = Number(product.precio_media_docena);
  const p12 = Number(product.precio_docena);

  if (qty < 6)   return `${qty} × $${p1.toFixed(2)}`;
  if (qty === 6) return `1 media docena`;
  if (qty < 12)  return `1 media docena + ${qty - 6} × $${p1.toFixed(2)}`;

  const docenas = Math.floor(qty / 12);
  const resto   = qty % 12;
  let desc = `${docenas} docena${docenas > 1 ? "s" : ""}`;
  if (resto === 6)       desc += ` + 1 media docena`;
  else if (resto > 6)    desc += ` + 1 media docena + ${resto - 6} × $${p1.toFixed(2)}`;
  else if (resto > 0)    desc += ` + ${resto} × $${p1.toFixed(2)}`;
  return desc;
}

// ═══════════════════════════════════════════════════════════════
//  PRESENTACIONES (pieza / media docena / docena)
// ═══════════════════════════════════════════════════════════════
// pres: "pieza" | "media" | "docena"  ·  count: cuántos de esa presentación

function presLabel(pres) {
  return pres === "pieza" ? "pieza" : pres === "media" ? "½ docena" : "docena";
}
// Precio unitario de cada presentación
// Total de piezas según presentación y cantidad de paquetes
// Comparte el link directo de un producto (usa el share nativo del celular si existe,
// o copia el link al portapapeles como respaldo en computadora).
// Comprime/redimensiona una foto ANTES de subirla — así las fotos de celular (que suelen
// pesar 2-3 MB) quedan livianas para la web (normalmente 80-200 KB), sin que se note
// diferencia de calidad a simple vista. Si algo falla, sube la foto original tal cual,
// para nunca bloquear al usuario por esto.
// Pide una versión más chica y liviana de una foto YA guardada en Supabase Storage,
// usando la transformación de imágenes que Supabase hace al vuelo (sin tocar ni
// modificar el archivo original para nada). Esto beneficia también a las fotos que se
// subieron antes de que empezáramos a comprimir al subir. Si la URL no es de Supabase
// Storage (o viene vacía), la deja tal cual.
// IMPORTANTE: hay que pedir ancho Y alto juntos con resize=contain -- si se pide solo
// uno de los dos, Supabase recorta la foto en vez de solo achicarla completa.


async function compartirProducto(product, showToast) {
  const url = `${window.location.origin}/producto/${product.id}`;
  const textoCompartir = `Mira este producto en Ofertodo: ${product.nombre}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: product.nombre, text: textoCompartir, url });
      return;
    } catch (e) {
      // El usuario cerró la ventana de compartir sin elegir nada — no es un error real, no hacemos nada más
      if (e?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copiado — ¡ya lo puedes compartir!");
  } catch (e) {
    showToast("No se pudo copiar el link, intenta de nuevo");
  }
}

// Precio total = precio unitario de la presentación × cantidad de paquetes
function presTotal(product, pres, count) {
  return presUnitPrice(product, pres) * count;
}
// Texto descriptivo del desglose (incluye precio por pieza)
function presBreakdown(pres, count, product) {
  const piezas = presToPiezas(pres, count);
  let porPieza = "";
  if (product) {
    const unit = pres === "pieza" ? Number(product.precio_pieza)
      : pres === "media" ? Number(product.precio_media_docena) / 6
      : Number(product.precio_docena) / 12;
    porPieza = ` · $${unit.toFixed(2)} por pieza`;
  }
  return `${count} ${presLabelPlural(pres, count)} = ${piezas} pieza${piezas > 1 ? "s" : ""}${porPieza}`;
}

// Precio total de un item del carrito (soporta presentación o cantidad libre)
function cartItemTotal(item) {
  if (item.pres) return presTotal(item.product, item.pres, item.count || 1);
  return calcPrice(item.product, item.qty); // compatibilidad con items viejos
}
function cartItemLabel(item) {
  if (item.pres) return `${item.count} ${presLabelPlural(item.pres, item.count)} · ${item.qty} pzs`;
  return `${item.qty} pzs`;
}

// ═══════════════════════════════════════════════════════════════
//  DISTRIBUCIÓN DE TALLA/COLOR POR DOCENA
// ═══════════════════════════════════════════════════════════════
// El admin define cuántas piezas de cada talla (o color) trae 1 docena completa (12 pzs),
// por ejemplo: { "30": 2, "32": 4, "34": 3, "36": 2, "38": 1 }.
// La distribución de la MEDIA DOCENA se calcula siempre en automático a partir de esta:
//  1) cada variante presente recibe la mitad (redondeado hacia abajo) de su cantidad en la docena,
//     con un mínimo de 1 para que la media docena incluya todas las tallas/colores;
//  2) las piezas que sobren para llegar a 6 se reparten empezando por la variante con
//     más unidades en la docena (la que más se repite).
function totalDistribucion(dist) {
  return Object.values(dist || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

// ═══════════════════════════════════════════════════════════════
//  ÁREA/UBICACIÓN DE UNA VENTA
// ═══════════════════════════════════════════════════════════════
// Lista de provincias y ciudades/distritos principales de Panamá, usada para
// reconocer la zona dentro de una dirección de texto libre cuando el pedido
// no tiene una sucursal de destino asignada. El orden importa: los nombres
// más específicos van primero para no confundirlos con la provincia genérica
// (ej. "La Chorrera" antes que "Panamá Oeste", "Panamá Oeste" antes que "Panamá").


function NavBar() {
  const { view, setView, cart, cartPulse, user, setUser, setShowLogin, setShowCart } = useApp();
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    if (cartPulse > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 500);
      return () => clearTimeout(t);
    }
  }, [cartPulse]);

  return (
    <nav className="oft-nav" style={S.nav}>
      <Logo onClick={() => setView("home")} height={28} />
      <div className="oft-nav-links" style={{ display: "flex", gap: 24, alignItems: "center" }}>
        {["home","catalogo"].map(v => (
          <span key={v} onClick={() => setView(v)} style={{ fontWeight: 600, fontSize: 14, cursor: "pointer", color: view === v ? RED : BLACK, borderBottom: view === v ? `2px solid ${RED}` : "2px solid transparent", paddingBottom: 2, whiteSpace: "nowrap" }}>
            {v === "home" ? "Inicio" : "Catálogo"}
          </span>
        ))}
        {user && <span onClick={() => setView("dashboard")} style={{ fontWeight: 600, fontSize: 14, cursor: "pointer", color: view === "dashboard" ? RED : BLACK, whiteSpace: "nowrap" }}>Mi Cuenta</span>}
        {user?.es_admin && <span onClick={() => setView("admin")} style={{ fontWeight: 600, fontSize: 14, cursor: "pointer", color: view === "admin" ? RED : BLACK }}>Admin</span>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className={bounce ? "oft-cart-bounce oft-btn-press" : "oft-btn-press"} style={{ ...S.btnOutline, position: "relative", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px" }} onClick={() => setShowCart(true)}>
          <ShoppingCart size={16} strokeWidth={2.2} /> <span className="oft-btn-text-hide">Pedido</span> {cartCount > 0 && <span style={{ background: RED, color: WHITE, borderRadius: "50%", fontSize: 10, fontWeight: 800, width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>}
        </button>
        {user
          ? <button style={{ ...S.btnBlack, display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 12px" }} onClick={() => { setUser(null); setView("home"); }}><LogOut size={15} strokeWidth={2.2} /> <span className="oft-btn-text-hide">Salir</span></button>
          : <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 12px" }} onClick={() => setShowLogin(true)}><User size={15} strokeWidth={2.2} /> <span className="oft-btn-text-hide">Entrar</span></button>
        }
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HOME
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  PÁGINAS LEGALES: Términos, Devoluciones, Privacidad
// ═══════════════════════════════════════════════════════════════
function LegalPageView() {
  const { view, setView } = useApp();

  const Seccion = ({ titulo, children }) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>{titulo}</div>
      <div style={{ fontSize: 14, color: "#333", lineHeight: 1.7 }}>{children}</div>
    </div>
  );

  const contenidos = {
    terminos: {
      titulo: "Términos y Condiciones",
      body: (
        <>
          <Seccion titulo="1. Sobre Ofertodo">
            Ofertodo (ofertodo.com.pa) es una distribuidora de ropa, calzado y accesorios con sede en Colón, Panamá,
            dedicada a la venta al por mayor a comerciantes y revendedores en todo el país. Al usar este sitio, aceptas
            los presentes términos y condiciones en su totalidad.
          </Seccion>
          <Seccion titulo="2. Modalidades de venta">
            Los productos se ofrecen por pieza, media docena y docena, con precios distintos según la cantidad
            comprada. Los precios mostrados en el sitio están sujetos a cambio sin previo aviso y no incluyen costos
            de envío, los cuales se calculan aparte según la empresa transportista y el destino elegido.
          </Seccion>
          <Seccion titulo="3. Cuentas de usuario">
            Para realizar una compra es necesario crear una cuenta con datos de contacto válidos (nombre, teléfono,
            correo). Eres responsable de mantener la confidencialidad de tu acceso y de la exactitud de la
            información que proporciones.
          </Seccion>
          <Seccion titulo="4. Pedidos y confirmación">
            Un pedido se considera confirmado una vez que el pago haya sido procesado exitosamente. Ofertodo se
            reserva el derecho de cancelar o ajustar un pedido en caso de error en el precio, falta de disponibilidad
            de inventario, o sospecha de fraude, notificando al cliente por WhatsApp o correo.
          </Seccion>
          <Seccion titulo="5. Métodos de pago">
            Actualmente aceptamos pagos a través de Yappy. Próximamente estará disponible el pago con tarjeta de
            crédito/débito a través de una pasarela de pago autorizada. Toda la información de pago se procesa
            directamente por el proveedor de pagos correspondiente; Ofertodo no almacena datos de tarjetas.
          </Seccion>
          <Seccion titulo="6. Envíos">
            Los envíos se realizan a través de empresas transportistas independientes (Servientrega, Transportes
            Ferguson, Uno Express, entre otras). Los tiempos de entrega dependen de la empresa transportista y el
            destino, y no son garantizados por Ofertodo.
          </Seccion>
          <Seccion titulo="7. Propiedad intelectual">
            El contenido de este sitio (marca "Ofertodo", el concepto FlexPack, imágenes, textos y diseño) es
            propiedad de Ofertodo y no puede reproducirse sin autorización.
          </Seccion>
          <Seccion titulo="8. Limitación de responsabilidad">
            Ofertodo no se hace responsable por retrasos, daños o pérdidas ocasionados por terceros (empresas de
            envío, pasarelas de pago) fuera de su control directo.
          </Seccion>
          <Seccion titulo="9. Cambios a estos términos">
            Estos términos pueden actualizarse en cualquier momento. La versión vigente siempre estará disponible en
            esta misma página.
          </Seccion>
          <Seccion titulo="10. Ley aplicable">
            Estos términos se rigen por las leyes de la República de Panamá.
          </Seccion>
        </>
      ),
    },
    devoluciones: {
      titulo: "Política de Devoluciones y Cancelaciones",
      body: (
        <>
          <Seccion titulo="1. Plazo para reportar un problema">
            Si tu pedido llega incompleto, dañado, o con un producto distinto al solicitado, debes reportarlo dentro
            de las 48 horas siguientes a la recepción, escribiendo a nuestro WhatsApp o correo con tu número de
            pedido y fotos del producto/empaque.
          </Seccion>
          <Seccion titulo="2. Condiciones para una devolución">
            El producto debe estar sin usar, en su empaque original, y con las etiquetas puestas. No se aceptan
            devoluciones de productos usados, lavados, o dañados por mal uso del cliente.
          </Seccion>
          <Seccion titulo="3. Productos no elegibles para devolución">
            Por tratarse de venta al por mayor, los pedidos ya despachados no pueden cancelarse una vez el paquete
            salió de nuestras instalaciones, salvo en los casos de error de nuestra parte (producto equivocado o
            defectuoso) descritos en el punto 1.
          </Seccion>
          <Seccion titulo="4. Proceso">
            Una vez recibido tu reporte con evidencia fotográfica, evaluamos el caso en un plazo de 1 a 3 días
            hábiles. Si procede, coordinamos según el caso: reposición del producto, nota de crédito para tu próxima
            compra, o reembolso por el mismo medio de pago utilizado.
          </Seccion>
          <Seccion titulo="5. Costos de envío en devoluciones">
            Si el error fue nuestro (producto equivocado, defecto de fábrica), Ofertodo cubre el costo de envío de la
            devolución/reposición. Si la devolución es por cambio de opinión del cliente (no aplica a pedidos ya
            despachados, ver punto 3), el costo de envío corre por cuenta del cliente.
          </Seccion>
          <Seccion titulo="6. Daños ocurridos durante el transporte">
            Si el paquete llega visiblemente dañado, te recomendamos documentarlo con fotos antes de abrirlo. Estos
            casos se gestionan junto con la empresa transportista correspondiente.
          </Seccion>
          <Seccion titulo="7. Contacto">
            Para iniciar cualquier reclamo, escríbenos por WhatsApp al +507 6720-0474 o al correo soporte@ofertodo.com.pa,
            indicando tu código de pedido.
          </Seccion>
        </>
      ),
    },
    privacidad: {
      titulo: "Política de Privacidad",
      body: (
        <>
          <Seccion titulo="1. Datos que recopilamos">
            Cuando creas una cuenta o realizas un pedido, recopilamos: nombre, número de teléfono, dirección de envío
            y correo electrónico. Si compras por Yappy, el procesamiento del pago lo realiza Yappy directamente;
            Ofertodo no almacena datos de tarjetas ni claves de acceso a billeteras digitales.
          </Seccion>
          <Seccion titulo="2. Para qué usamos tus datos">
            Usamos tu información para: procesar y despachar tus pedidos, contactarte por WhatsApp o correo sobre el
            estado de tu compra, coordinar el envío con la empresa transportista elegida, y brindarte soporte al
            cliente.
          </Seccion>
          <Seccion titulo="3. Con quién se comparte tu información">
            Compartimos únicamente los datos necesarios para completar tu pedido con: la empresa transportista que
            elegiste (nombre, teléfono, dirección), y el procesador de pagos correspondiente (Yappy, y
            próximamente una pasarela de tarjetas autorizada). No vendemos ni alquilamos tu información a terceros
            con fines publicitarios.
          </Seccion>
          <Seccion titulo="4. Dónde se almacenan tus datos">
            Tu información se almacena en servidores de Supabase con medidas de seguridad técnicas (acceso
            restringido y cifrado en tránsito).
          </Seccion>
          <Seccion titulo="5. Tus derechos">
            De acuerdo con la Ley 81 de 2019 sobre Protección de Datos Personales de Panamá, puedes solicitar en
            cualquier momento acceder, corregir, o solicitar la eliminación de tus datos personales, escribiéndonos a
            soporte@ofertodo.com.pa.
          </Seccion>
          <Seccion titulo="6. Retención de datos">
            Conservamos tu información mientras mantengas una cuenta activa con nosotros, o según lo requiera la ley
            para fines contables/fiscales.
          </Seccion>
          <Seccion titulo="7. Cambios a esta política">
            Podemos actualizar esta política ocasionalmente. Cualquier cambio se reflejará en esta misma página con
            su fecha de actualización.
          </Seccion>
          <Seccion titulo="8. Contacto">
            Para cualquier consulta sobre el uso de tus datos, escríbenos a soporte@ofertodo.com.pa o al WhatsApp
            +507 6720-0474.
          </Seccion>
        </>
      ),
    },
  };

  const data = contenidos[view] || contenidos.terminos;

  return (
    <div style={{ ...S.section, maxWidth: 760 }}>
      <div onClick={() => setView("home")} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: GRAY3, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 20 }}>
        <ChevronDown size={14} style={{ transform: "rotate(90deg)" }} /> Volver al inicio
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>{data.titulo}</div>
      <div style={{ fontSize: 12, color: GRAY3, marginBottom: 32 }}>Última actualización: julio 2026</div>
      {data.body}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  RESULTADO DEL PAGO CON TARJETA (al volver de Powertranz)
// ═══════════════════════════════════════════════════════════════
function PagoResultadoView() {
  const { pagoResultado, setView } = useApp();
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!pagoResultado) {
    return (
      <div style={{ ...S.section, maxWidth: 500, textAlign: "center" }}>
        <p style={{ color: GRAY3 }}>No encontramos información de ese pago.</p>
        <button style={{ ...S.btnRed, justifyContent: "center", margin: "20px auto 0" }} onClick={() => setView("home")}>Ir al inicio</button>
      </div>
    );
  }

  const { tipo, codigo, pedido } = pagoResultado;

  if (tipo === "exito") {
    return (
      <div className="oft-section" style={{ ...S.section, textAlign: "center", maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><CheckCircle2 size={64} color="#22c55e" strokeWidth={1.5} /></div>
        <h2 style={{ fontSize: 24, fontWeight: 900 }}>¡Pago exitoso!</h2>
        <p style={{ color: GRAY3 }}>Tu pedido está confirmado. Sigue su estado desde "Mi Cuenta".</p>
        <div style={{ background: GRAY, borderRadius: 12, padding: 20, margin: "20px 0", textAlign: "left" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Número: <span style={{ color: RED }}>{codigo}</span></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#D4EDDA", color: "#155724", padding: "4px 12px", borderRadius: 20, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
            <CreditCard size={14} /> Pagado con tarjeta
          </div>
          {pedido && (
            <>
              <div style={{ marginTop: 10, fontWeight: 700, fontSize: 15 }}>Total: {money(pedido.total)}</div>
              {pedido.retiro_local
                ? <div style={{ marginTop: 6, fontSize: 13, color: "#856404", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}><Home size={14} /> Retiro en el local{pedido.local_retiro_nombre ? `: ${pedido.local_retiro_nombre}` : ""}</div>
                : pedido.empresa_envio_nombre && <div style={{ marginTop: 6, fontSize: 13, color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><Truck size={14} /> {pedido.empresa_envio_nombre}{pedido.sucursal_nombre ? ` · ${pedido.sucursal_nombre}` : ""}</div>}
              {pedido.items?.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${GRAY2}` }}>
                  {pedido.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                      <span>{it.nombre_producto} <span style={{ color: GRAY3 }}>x{it.cantidad}</span></span>
                      <span style={{ fontWeight: 700 }}>{money(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <button style={{ ...S.btnRed, justifyContent: "center", margin: "0 auto" }} onClick={() => setView("dashboard")}>Ver estado de mi pedido</button>
      </div>
    );
  }

  if (tipo === "rechazado") {
    return (
      <div className="oft-section" style={{ ...S.section, textAlign: "center", maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><X size={64} color={RED} strokeWidth={1.5} /></div>
        <h2 style={{ fontSize: 24, fontWeight: 900 }}>El banco rechazó el pago</h2>
        <p style={{ color: GRAY3, marginBottom: 20 }}>
          No se realizó ningún cargo a tu tarjeta{codigo ? <> — el pedido <strong>{codigo}</strong> quedó sin pagar</> : ""}. Puedes intentar de nuevo con la misma tarjeta u otra distinta.
        </p>
        <button style={{ ...S.btnRed, justifyContent: "center", margin: "0 auto" }} onClick={() => setView("catalogo")}>Volver a intentar</button>
      </div>
    );
  }

  return (
    <div className="oft-section" style={{ ...S.section, textAlign: "center", maxWidth: 500 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Headphones size={64} color="#856404" strokeWidth={1.5} /></div>
      <h2 style={{ fontSize: 24, fontWeight: 900 }}>Hubo un problema confirmando tu pago</h2>
      <p style={{ color: GRAY3, marginBottom: 20 }}>
        Si el cargo sí aparece en tu banco, escríbenos por WhatsApp{codigo ? <> con tu número de pedido <strong>{codigo}</strong></> : ""} y lo confirmamos manualmente.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button style={{ ...S.btnWA, justifyContent: "center" }} onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola, tuve un problema confirmando el pago de mi pedido ${codigo || ""}`)}`, "_blank")}>
          <MessageCircle size={16} /> Escribir por WhatsApp
        </button>
        <button style={{ ...S.btnOutline, justifyContent: "center" }} onClick={() => setView("home")}>Ir al inicio</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CARRUSEL DE BANNERS PROMOCIONALES — avanza solo, se puede deslizar
//  con el dedo, y cada uno lleva a donde el admin configuró (producto,
//  categoría, catálogo completo, o un link externo).
// ═══════════════════════════════════════════════════════════════
function PromoCarousel({ banners }) {
  const { setView, setCatalogCat, setQuickView, products } = useApp();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const touchStartX = useRef(null);

  const activos = [...banners].filter(b => b.activo).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const total = activos.length;

  useEffect(() => {
    if (indice >= total) setIndice(0);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || pausado) return;
    const t = setInterval(() => setIndice(i => (i + 1) % total), 5000);
    return () => clearInterval(t);
  }, [total, pausado]);

  if (total === 0) return null;

  const irAlDestino = (b) => {
    if (b.destino_tipo === "producto") {
      const p = products.find(pr => String(pr.id) === String(b.destino_valor));
      if (p) setQuickView(p); else { setCatalogCat(0); setView("catalogo"); }
    } else if (b.destino_tipo === "categoria") {
      setCatalogCat(Number(b.destino_valor) || 0);
      setView("catalogo");
    } else if (b.destino_tipo === "url" && b.destino_valor) {
      window.open(b.destino_valor, "_blank");
    } else {
      setCatalogCat(0);
      setView("catalogo");
    }
  };

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 40) {
      setIndice(i => diff > 0 ? (i - 1 + total) % total : (i + 1) % total);
    }
    touchStartX.current = null;
  };

  return (
    <div className="oft-carousel" onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}>
      <div className="oft-carousel-track" style={{ transform: `translateX(-${indice * 100}%)` }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {activos.map(b => (
          <div key={b.id} className="oft-carousel-slide" onClick={() => irAlDestino(b)} role="button" tabIndex={0}>
            <img src={imagenOptimizada(b.imagen_url, 1400)} alt={b.titulo || "Promoción"} loading="eager" decoding="async" />
            {(b.titulo || b.subtitulo) && (
              <div className="oft-carousel-caption">
                {b.titulo && <div className="oft-carousel-title">{b.titulo}</div>}
                {b.subtitulo && <div className="oft-carousel-subtitle">{b.subtitulo}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      {total > 1 && (
        <div className="oft-carousel-dots">
          {activos.map((b, i) => (
            <button key={b.id} className={"oft-carousel-dot" + (i === indice ? " active" : "")} onClick={() => setIndice(i)} aria-label={`Ver promoción ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function HomeView() {
  const { setView, setCatalogCat, categories, gruposCategorias, products, addToCart, banners } = useApp();
  const featured = products.filter(p => p.activo && p.visible_web !== false && p.destacado);
  const [catSheetAbierto, setCatSheetAbierto] = useState(false);
  const [grupoInicialSheet, setGrupoInicialSheet] = useState(null);

  // Solo muestra grupos que de verdad tengan categorías adentro
  const gruposConCategorias = gruposCategorias.filter(g => categories.some(c => c.grupo_id === g.id));
  const sinGrupo = categories.filter(c => !c.grupo_id);

  const abrirGrupo = (grupo) => { setGrupoInicialSheet(grupo); setCatSheetAbierto(true); };
  const abrirCategoriaSuelta = (id) => { setCatalogCat(id); setView("catalogo"); };

  return (
    <>
      {/* CARRUSEL DE PROMOCIONES */}
      <PromoCarousel banners={banners} />

      {/* BARRA DE MARCA + ACCIONES — complementa el carrusel, minimalista y oscura */}
      <div className="oft-cta-bar">
        <div className="oft-cta-tag"><Zap size={11} strokeWidth={2.5} /> Distribuidora · Panamá</div>
        <h1 className="oft-cta-title">Compra más <span>·</span> Crece más</h1>
        <div className="oft-cta-actions">
          <button className="oft-cta-btn-primary" onClick={() => { setCatalogCat(0); setView("catalogo"); }}>Ver catálogo</button>
          <button className="oft-cta-btn-ghost" onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=Hola%20Ofertodo%2C%20quiero%20hacer%20un%20pedido`, "_blank")}>
            <MessageCircle size={16} strokeWidth={2.2} /> Consultar por WhatsApp
          </button>
        </div>
      </div>
      <div className="oft-infobar" style={{ background: RED, color: WHITE, padding: "10px 24px", display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap", fontSize: 13, fontWeight: 600 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Package size={15} strokeWidth={2.2} /> Pieza · Media docena · Docena</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Truck size={15} strokeWidth={2.2} /> Envíos a todo Panamá</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MessageCircle size={15} strokeWidth={2.2} /> WhatsApp disponible</span>
      </div>

      {/* CATEGORÍAS */}
      <div className="oft-section" style={{ ...S.section, paddingBottom: 0 }}>
        <div style={S.sectionTitle}><span style={{ color: RED }}>▮</span> Categorías</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
          {gruposConCategorias.map((g, i) => {
            const primeraCatDelGrupo = categories.find(c => c.grupo_id === g.id);
            const cantidad = categories.filter(c => c.grupo_id === g.id).length;
            // Usa el ícono propio del grupo si lo subiste; si no, toma prestado el de su primera categoría
            const iconoParaMostrar = g.icono_url ? { icono_url: g.icono_url, nombre: g.nombre } : primeraCatDelGrupo;
            return (
              <div key={"grupo-" + g.id} onClick={() => abrirGrupo(g)} className="oft-btn-press oft-group-card" style={{ animationDelay: `${Math.min(i * 0.06, 0.4)}s` }}>
                <div className="oft-group-card-icon"><CategoryIcon cat={iconoParaMostrar} size={24} color={RED} /></div>
                <div style={{ fontWeight: 800, fontSize: 14, marginTop: 10 }}>{g.nombre}</div>
                <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>{cantidad} categorías</div>
                <ChevronRight size={14} color={GRAY3} className="oft-group-card-chevron" />
              </div>
            );
          })}
          {sinGrupo.map((c, i) => (
            <div key={c.id} onClick={() => abrirCategoriaSuelta(c.id)} className="oft-btn-press oft-group-card" style={{ animationDelay: `${Math.min((i + gruposConCategorias.length) * 0.06, 0.4)}s` }}>
              <div className="oft-group-card-icon"><CategoryIcon cat={c} size={24} color={RED} /></div>
              <div style={{ fontWeight: 800, fontSize: 14, marginTop: 10 }}>{c.nombre}</div>
            </div>
          ))}
        </div>
      </div>
      {catSheetAbierto && (
        <CategoriaSheet
          categorias={categories}
          gruposCategorias={gruposCategorias}
          seleccionadaId={0}
          grupoInicial={grupoInicialSheet}
          onSeleccionar={(id) => { setCatalogCat(id); setView("catalogo"); setCatSheetAbierto(false); }}
          onClose={() => setCatSheetAbierto(false)}
        />
      )}

      {/* DESTACADOS */}
      {featured.length > 0 && (
        <div className="oft-section" style={S.section}>
          <div style={S.sectionTitle}><span style={{ color: RED }}>▮</span> Productos <span style={{ color: RED }}>Destacados</span></div>
          <div className="oft-prod-grid" style={S.prodGrid}>
            {featured.map((p, i) => (
              <div key={p.id} className="oft-prod-anim" style={{ animationDelay: `${Math.min(i * 0.08, 0.5)}s`, height: "100%" }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA FOOTER */}
      <div style={{ background: BLACK, color: WHITE, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>¿Listo para hacer tu pedido?</div>
        <p style={{ color: "#aaa", marginBottom: 24 }}>Explora todo nuestro catálogo o escríbenos directamente</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{ ...S.btnRed, padding: "14px 28px" }} onClick={() => { setCatalogCat(0); setView("catalogo"); }}>Ver Catálogo</button>
          <button style={{ ...S.btnWA, padding: "14px 24px" }} onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, "_blank")}><MessageCircle size={16} strokeWidth={2.2} /> WhatsApp</button>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: "#0a0a0a", color: WHITE, padding: "32px 24px" }}>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "space-between", maxWidth: 900, margin: "0 auto" }}>
          <div><Logo height={26} /><p style={{ color: "#aaa", fontSize: 13, marginTop: 10, maxWidth: 220 }}>Distribuidora · Panamá. Compra más, crece más.</p></div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Contacto</div>
            <div style={{ fontSize: 13, color: "#aaa", lineHeight: 2.2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><MessageCircle size={14} /> WhatsApp: +507 6720-0474</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><User size={14} /> soporte@ofertodo.com.pa</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><MapPin size={14} /> Colón, Panamá</div>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Envíos</div>
            <div style={{ fontSize: 13, color: "#aaa", lineHeight: 2.2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Truck size={14} /> A todo Panamá</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Package size={14} /> Mínimo: 1 docena</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Zap size={14} /> Despacho rápido</div>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Legal</div>
            <div style={{ fontSize: 13, color: "#aaa", lineHeight: 2.2, display: "flex", flexDirection: "column", gap: 2 }}>
              <span onClick={() => setView("terminos")} style={{ cursor: "pointer" }}>Términos y Condiciones</span>
              <span onClick={() => setView("devoluciones")} style={{ cursor: "pointer" }}>Devoluciones</span>
              <span onClick={() => setView("privacidad")} style={{ cursor: "pointer" }}>Privacidad</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#444", borderTop: "1px solid #222", paddingTop: 16 }}>© 2026 Ofertodo · Panamá</div>
      </footer>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SELECTOR DE PRESENTACIÓN + CANTIDAD ANIMADO
// ═══════════════════════════════════════════════════════════════
function QtySelector({ product, pres, setPres, count, setCount, size = "normal" }) {
  const [bump, setBump] = useState(false);
  const triggerBump = () => { setBump(true); setTimeout(() => setBump(false), 280); };
  const change = (delta) => { setCount(prev => Math.max(1, prev + delta)); triggerBump(); };

  const big = size === "big";
  const btnSize = big ? 42 : 36;
  const numFont = big ? 24 : 20;

  // El stock por docena/media docena solo aplica a productos PROPIOS con stock sincronizado
  // de Odoo — los de proveedor (bajo pedido) nunca se restringen por este motivo.
  // Aplica reglas de stock si es producto propio, O si es de proveedor pero ya lo tenemos en stock físico
  const respetaStockQty = (!product.proveedor_id || product.tiene_stock_fisico) && product.stock_actualizado_at;
  const stockConocido = respetaStockQty ? Number(product.stock) : null;
  const docenaDeshabilitada = stockConocido !== null && stockConocido < 12;
  const mediaDeshabilitada = stockConocido !== null && stockConocido < 6;

  const presentaciones = [
    { key: "pieza", label: "Pieza", precio: Number(product.precio_pieza), porPieza: Number(product.precio_pieza), disabled: false },
    { key: "media", label: "½ Doc", precio: Number(product.precio_media_docena), porPieza: Number(product.precio_media_docena) / 6, disabled: mediaDeshabilitada },
    { key: "docena", label: "Docena", precio: Number(product.precio_docena), porPieza: Number(product.precio_docena) / 12, disabled: docenaDeshabilitada },
  ];

  // Si la opción seleccionada deja de estar disponible (por stock bajo), cambia sola a
  // la siguiente mejor opción disponible — nunca deja al cliente "atascado" en una opción
  // que ya no se puede comprar.
  useEffect(() => {
    const actual = presentaciones.find(p => p.key === pres);
    if (actual?.disabled) {
      if (pres === "docena" && !mediaDeshabilitada) setPres("media");
      else setPres("pieza");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pres, docenaDeshabilitada, mediaDeshabilitada]);

  return (
    <div>
      {/* SELECTOR DE PRESENTACIÓN */}
      <div className="oft-pres-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12, alignItems: "stretch" }}>
        {presentaciones.map(p => {
          const active = pres === p.key && !p.disabled;
          return (
            <button key={p.key}
              onClick={() => { if (p.disabled) return; setPres(p.key); setCount(1); triggerBump(); }}
              disabled={p.disabled}
              className={"oft-pres-chip oft-btn-press" + (big ? " oft-pres-big" : "")}
              style={{
                padding: big ? "12px 4px" : "10px 2px", borderRadius: 10,
                border: `2px solid ${p.disabled ? GRAY2 : (active ? RED : GRAY2)}`,
                background: p.disabled ? GRAY : (active ? "#FFF5F5" : WHITE),
                cursor: p.disabled ? "not-allowed" : "pointer", transition: "all 0.18s",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                minWidth: 0, width: "100%", boxSizing: "border-box",
                opacity: p.disabled ? 0.6 : 1,
              }}
            >
              <div className="oft-pres-label" style={{ fontWeight: 800, color: p.disabled ? GRAY3 : (active ? RED : BLACK), textAlign: "center", width: "100%", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden" }}>{p.label}</div>
              {p.disabled
                ? <div style={{ fontSize: 10, fontWeight: 700, color: GRAY3, textAlign: "center", width: "100%", lineHeight: 1.2 }}>No disponible</div>
                : <div className="oft-pres-price" style={{ fontWeight: 900, color: active ? RED : BLACK, textAlign: "center", width: "100%", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden" }}>${p.precio.toFixed(2)}</div>
              }
            </button>
          );
        })}
      </div>

      {/* CONTADOR DE CANTIDAD */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 12, padding: big ? 8 : 6 }}>
        <button
          onClick={() => change(-1)}
          className="oft-qty-btn oft-btn-press"
          style={{ width: btnSize, height: btnSize, borderRadius: 10, border: `2px solid ${GRAY2}`, background: WHITE, color: count <= 1 ? GRAY3 : BLACK, fontSize: 20, fontWeight: 700, cursor: count <= 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1 }}
          disabled={count <= 1}
          aria-label="Quitar uno"
        >−</button>

        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <div className={bump ? "oft-qty-bump" : ""} style={{ fontSize: numFont, fontWeight: 900, color: BLACK, lineHeight: 1 }}>{count}</div>
          <div style={{ fontSize: 10, color: GRAY3, fontWeight: 600, marginTop: 2 }}>{presLabelPlural(pres, count)}</div>
        </div>

        <button
          onClick={() => change(1)}
          className="oft-qty-btn oft-btn-press"
          style={{ width: btnSize, height: btnSize, borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${RED}, ${RED_D})`, color: WHITE, fontSize: 20, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1, boxShadow: "0 2px 8px rgba(227,30,36,0.3)" }}
          aria-label="Agregar uno"
        >+</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SELECTOR DE TALLA Y COLOR (animado) — solo "Por pieza"
// ═══════════════════════════════════════════════════════════════
// Mapa de colores comunes en español → hex (para el puntito de color)

function VariantPicker({ product, talla, setTalla, color, setColor }) {
  const tallas = (product.tallas || "").split(",").map(s => s.trim()).filter(Boolean);
  const colores = (product.colores || "").split(",").map(s => s.trim()).filter(Boolean);
  const showTallas = product.tiene_tallas && tallas.length > 0;
  const showColores = product.tiene_colores && colores.length > 0;
  if (!showTallas && !showColores) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {showTallas && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: GRAY3, marginBottom: 5 }}>Talla</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {tallas.map(t => {
              const active = talla === t;
              return (
                <button key={t} onClick={() => setTalla(active ? "" : t)} className="oft-btn-press"
                  style={{ minWidth: 34, padding: "5px 9px", borderRadius: 8, border: `2px solid ${active ? RED : GRAY2}`, background: active ? RED : WHITE, color: active ? WHITE : BLACK, fontWeight: 800, fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showColores && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: GRAY3, marginBottom: 5 }}>Color</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {colores.map(c => {
              const active = color === c;
              return (
                <button key={c} onClick={() => setColor(active ? "" : c)} className="oft-btn-press oft-color-chip"
                  title={c}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px 4px 5px", borderRadius: 20, border: `2px solid ${active ? RED : GRAY2}`, background: active ? "#FFF5F5" : WHITE, cursor: "pointer", transition: "all 0.15s", transform: active ? "scale(1.05)" : "scale(1)" }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: colorToHex(c), border: `1px solid ${GRAY2}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: active ? RED : BLACK }}>{c}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DISTRIBUCIÓN DE TALLA/COLOR (info al cliente en media docena/docena)
//  Colapsada por defecto: el cliente hace click para verla.
//  Usa el mismo patrón de animación liviano que el resto de la app
//  (montar/desmontar + .oft-detail-open) en vez de animar grid-template-rows,
//  que en celular se sentía lento por el reflow continuo.
// ═══════════════════════════════════════════════════════════════
function DistribucionInfo({ product, pres, count }) {
  const [open, setOpen] = useState(false);
  if (pres === "pieza") return null;
  const distDocena = parseDistribucion(product.distribucion_docena);
  if (totalDistribucion(distDocena) === 0) return null;

  const eje = product.distribucion_eje === "color" ? "color" : "talla";
  const dist = pres === "docena" ? distDocena : mediaDocenaDesdeDistribucion(distDocena);
  const entradas = Object.entries(dist).filter(([, qty]) => Number(qty) > 0);
  if (entradas.length === 0) return null;

  return (
    <div style={{ marginTop: 8, border: `1px solid ${GRAY2}`, borderRadius: 8, overflow: "hidden", background: WHITE }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="oft-btn-press"
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", padding: "8px 10px", cursor: "pointer", fontSize: 11, fontWeight: 800, color: BLACK, WebkitTapHighlightColor: "transparent" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Tag size={13} color={RED} /> Ver distribución por {presLabel(pres)} ({eje === "color" ? "colores" : "tallas"})
        </span>
        <ChevronDown size={15} color={GRAY3} style={{ transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }} />
      </button>
      {open && (
        <div className="oft-detail-open" style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "0 10px 10px" }}>
          {entradas.map(([v, qty]) => (
            <span key={v} className="oft-chip-pop" style={{ background: GRAY, border: `1px solid ${GRAY2}`, borderRadius: 6, padding: "2px 7px", fontWeight: 700, fontSize: 11, color: BLACK }}>
              {Number(qty) * count}× {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PRODUCT CARD
// ═══════════════════════════════════════════════════════════════
function ProductCard({ product }) {
  const { addToCart, showToast, setQuickView } = useApp();
  const [pres, setPres] = useState("docena"); // siempre abre en Docena por defecto, incluso si "venta_por_unidad" está activo
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState(false);
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");
  const total = presTotal(product, pres, count);
  const imgUrl = product.imagen_url ? imagenOptimizada(product.imagen_url, 400) : null;
  const btnRef = useRef(null);
  // Solo bloqueamos la compra cuando se agota un producto PROPIO (sin proveedor).
  // Los productos de proveedor externo siempre se pueden comprar — el stock ahí
  // se maneja yendo a comprarle al proveedor cuando llega el pedido.
  const respetaStock = (!product.proveedor_id || product.tiene_stock_fisico);
  const agotadoBloqueado = respetaStock && product.stock_actualizado_at && Number(product.stock) <= 0;

  // ¿Este producto tiene variantes y el cliente eligió "Por pieza"?
  const tieneVariantes = (product.tiene_tallas && (product.tallas || "").trim()) || (product.tiene_colores && (product.colores || "").trim());
  const modoConsulta = pres === "pieza" && tieneVariantes && !product.venta_por_unidad;

  // Consultar por WhatsApp con la talla y el color elegidos
  const consultarWhatsApp = () => {
    if (product.tiene_tallas && (product.tallas || "").trim() && !talla) { showToast("Elige una talla primero"); return; }
    if (product.tiene_colores && (product.colores || "").trim() && !color) { showToast("Elige un color primero"); return; }
    let msg = `Hola Ofertodo, quiero consultar disponibilidad de:\n\n*${product.nombre}*`;
    if (product.referencia) msg += `\nRef: ${product.referencia}`;
    if (talla) msg += `\nTalla: ${talla}`;
    if (color) msg += `\nColor: ${color}`;
    msg += `\nPresentación: Por pieza`;
    if (product.imagen_url) {
      msg += `\n\n📷 Foto del producto:\n${product.imagen_url}`;
    } else {
      msg += `\n\n(Este producto no tiene foto cargada)`;
    }
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleAdd = (e) => {
    const piezas = presToPiezas(pres, count);
    addToCart(product, piezas, pres, count);
    showToast(`${product.nombre} agregado al pedido`);
    // feedback visual en el botón
    setAdded(true);
    setTimeout(() => setAdded(false), 1100);
    // animación "volar al carrito": clona la imagen y la lanza
    try {
      const card = e.currentTarget.closest("[data-prod-card]");
      const img = card?.querySelector("[data-prod-img]");
      const cartBtn = document.querySelector(".oft-nav button");
      if (img && cartBtn) {
        const r1 = img.getBoundingClientRect();
        const r2 = cartBtn.getBoundingClientRect();
        const fly = img.cloneNode(true);
        fly.className = "oft-fly";
        fly.style.left = r1.left + "px";
        fly.style.top = r1.top + "px";
        fly.style.width = r1.width + "px";
        fly.style.height = r1.height + "px";
        fly.style.borderRadius = "12px";
        fly.style.setProperty("--fly-x", (r2.left - r1.left) + "px");
        fly.style.setProperty("--fly-y", (r2.top - r1.top) + "px");
        document.body.appendChild(fly);
        setTimeout(() => fly.remove(), 750);
      }
    } catch(err) {}
  };

  return (
    <div data-prod-card className="oft-card-hover" style={S.prodCard}>
      <div data-prod-img onClick={() => setQuickView(product)} title="Ver detalle" style={{ background: GRAY, aspectRatio: "1 / 1", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", cursor: "pointer" }}>
        {imgUrl
          ? <img src={imgUrl} alt={product.nombre} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <Package size={56} color={GRAY3} strokeWidth={1.3} />
        }
        {product.badge && <span style={{ position: "absolute", top: 10, left: 10, background: RED, color: WHITE, fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}><Sparkles size={11} /> {product.badge}</span>}
        {/* Indicador de stock — solo se muestra si el producto está sincronizado con Odoo */}
        {product.stock_actualizado_at && (
          Number(product.stock) <= 0
            ? <span style={{ position: "absolute", top: 10, right: 10, background: "#721C24", color: WHITE, fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 4 }}>Agotado</span>
            : Number(product.stock) <= 5
              ? <span style={{ position: "absolute", top: 10, right: 10, background: "#856404", color: WHITE, fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 4 }}>Pocas unidades</span>
              : null
        )}
        <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.55)", color: WHITE, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 4 }}><Search size={11} /> Ver</span>
      </div>
      <div className="oft-prod-body" style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 11, color: GRAY3, fontWeight: 600, marginBottom: 4 }}>REF: {product.referencia || "—"}</div>
        <div onClick={() => setQuickView(product)} style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, cursor: "pointer", lineHeight: 1.3, height: 39, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{product.nombre}</div>
        <div style={{ fontSize: 13, color: GRAY3, marginBottom: 12, lineHeight: 1.4, height: 36, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{product.descripcion}</div>
        {/* SELECTOR DE PRESENTACIÓN + CANTIDAD + TOTAL */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Elige como comprar</span>
            <span style={{ fontSize: 18, color: RED, fontWeight: 900 }}>${Number(total).toFixed(2)}</span>
          </div>
          <QtySelector product={product} pres={pres} setPres={setPres} count={count} setCount={setCount} />
          {/* DESGLOSE o VARIANTES (si eligió Por pieza y tiene tallas/colores) */}
          {modoConsulta ? (
            <div style={{ background: GRAY, borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
              <VariantPicker product={product} talla={talla} setTalla={setTalla} color={color} setColor={setColor} />
            </div>
          ) : (
            <div style={{ fontSize: 11, color: GRAY3, background: GRAY, borderRadius: 6, padding: "6px 10px", display: "flex", alignItems: "center", gap: 5, marginTop: 8, minHeight: 30 }}>
              <Sparkles size={12} style={{ flexShrink: 0 }} /> <span>{presBreakdown(pres, count, product)}</span>
            </div>
          )}
          <DistribucionInfo product={product} pres={pres} count={count} />
        </div>
        {/* Empuja los botones al fondo para alinear todas las tarjetas */}
        <div style={{ marginTop: "auto" }} />
        {modoConsulta ? (
          <button className="oft-btn-press" style={{ ...S.btnWA, width: "100%", justifyContent: "center", padding: 12 }} onClick={consultarWhatsApp}>
            <MessageCircle size={16} /> Consultar disponibilidad
          </button>
        ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button ref={btnRef} className="oft-btn-press" disabled={agotadoBloqueado} style={{ ...S.btnRed, flex: 1, justifyContent: "center", background: agotadoBloqueado ? GRAY3 : (added ? "#25D366" : RED), transition: "background 0.3s", cursor: agotadoBloqueado ? "not-allowed" : "pointer", opacity: agotadoBloqueado ? 0.7 : 1 }} onClick={agotadoBloqueado ? undefined : handleAdd}>
            {agotadoBloqueado ? "Agotado" : added ? <><CheckCircle2 size={16} className="oft-check-pop" /> ¡Agregado!</> : <><Plus size={15} strokeWidth={2.5} /> Agregar al pedido</>}
          </button>
          <button className="oft-btn-press" style={S.btnWA} onClick={() => { let m = `Hola Ofertodo, me interesa: ${product.nombre}`; if (product.referencia) m += ` (Ref: ${product.referencia})`; if (product.imagen_url) m += `\n\n📷 Foto:\n${product.imagen_url}`; window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(m)}`, "_blank"); }}><MessageCircle size={16} /></button>
          <button className="oft-btn-press" style={{ ...S.btnWA, background: GRAY2, color: BLACK }} title="Compartir producto" onClick={() => compartirProducto(product, showToast)}><Share2 size={16} /></button>
        </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CATÁLOGO
// ═══════════════════════════════════════════════════════════════
function CatalogoView() {
  const { products, categories, gruposCategorias, loading, catalogCat } = useApp();
  const [catFilter, setCatFilter] = useState(catalogCat || 0);
  const [search, setSearch] = useState("");
  const [catSheetAbierto, setCatSheetAbierto] = useState(false);

  // Si el usuario eligió una categoría desde el inicio, ábrela
  useEffect(() => { setCatFilter(catalogCat || 0); }, [catalogCat]);

  // Cambia el título de la pestaña del navegador según la categoría que se esté viendo
  useEffect(() => {
    const cat = categories.find(c => c.id === catFilter);
    document.title = cat ? `${cat.nombre} | Ofertodo - Distribuidora en Panamá` : "Catálogo | Ofertodo - Distribuidora en Panamá";
    return () => { document.title = "Ofertodo - Distribuidora al por Mayor en Panamá | Ropa, Calzado y Accesorios"; };
  }, [catFilter, categories]);

  // Quita tildes y pasa a minúsculas, para que la búsqueda encuentre resultados
  // sin importar si el cliente escribe con o sin acentos (ej. "nino" encuentra "Niño")
  const normalizar = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const searchNorm = normalizar(search);

  // Palabras de enlace que se ignoran al comparar (para que "jeans DE hombre" y
  // "jeans hombre" se traten como lo mismo)
  const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "para", "y", "en", "con", "un", "una"]);
  // Forma singular aproximada de una palabra (quita la "s" final), para que "jeans"
  // encuentre "jean" y viceversa, sin importar si el cliente escribe en plural o no.
  const singularizar = (palabra) => (palabra.length > 3 && palabra.endsWith("s")) ? palabra.slice(0, -1) : palabra;
  const palabrasClave = (texto) => normalizar(texto).split(/\s+/).filter(w => w && !PALABRAS_VACIAS.has(w)).map(singularizar);

  // Compara dos textos por palabras clave en vez de frase exacta: no importa el orden
  // ("hombre jeans" = "jeans hombre"), ni el plural/singular, ni palabras de enlace.
  const coincideCategoria = (nombreCategoria, textoBusqueda) => {
    const palabrasBusqueda = palabrasClave(textoBusqueda);
    if (palabrasBusqueda.length === 0) return false;
    const palabrasCategoria = palabrasClave(nombreCategoria);
    return palabrasBusqueda.every(pb => palabrasCategoria.some(pc => pc.includes(pb) || pb.includes(pc)));
  };

  const filtered = products.filter(p => {
    if (!p.activo || p.visible_web === false) return false;
    if (searchNorm === "") return catFilter === 0 || p.categoria_id === catFilter;
    // Con texto de búsqueda: coincide por nombre, referencia, O por el nombre de la
    // categoría del producto (así "jeans de hombre" encuentra "Jeans Hombre", sin
    // importar el orden, el plural, o si le sobra/falta una palabra de enlace).
    const categoriaProducto = categories.find(c => c.id === p.categoria_id);
    const coincide =
      normalizar(p.nombre).includes(searchNorm) ||
      normalizar(p.referencia).includes(searchNorm) ||
      (categoriaProducto && coincideCategoria(categoriaProducto.nombre, search));
    if (!coincide) return false;
    // Si además hay una categoría específica seleccionada con los chips, respétala también
    return catFilter === 0 || p.categoria_id === catFilter;
  });

  // Si lo que escribió coincide con el nombre de una categoría, la resalta visualmente
  // (aunque no la haya seleccionado con clic) para que quede claro qué está viendo.
  const categoriaSugerida = searchNorm !== "" ? categories.find(c => coincideCategoria(c.nombre, search)) : null;

  if (loading) return <Spinner />;

  return (
    <div className="oft-section" style={S.section}>
      <div style={S.sectionTitle}><span style={{ color: RED }}>▮</span> Catálogo <span style={{ color: RED }}>de Productos</span></div>
      <div style={{ position: "relative", maxWidth: 400, marginBottom: 14 }}>
        <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input style={{ ...S.input, paddingLeft: 36, marginBottom: 0 }} placeholder="Buscar producto, referencia o categoría..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ marginBottom: 28 }}>
        <CategoriaTrigger categorias={categories} gruposCategorias={gruposCategorias} seleccionadaId={catFilter} onClick={() => setCatSheetAbierto(true)} />
      </div>
      {catSheetAbierto && (
        <CategoriaSheet
          categorias={categories}
          gruposCategorias={gruposCategorias}
          seleccionadaId={catFilter}
          resaltadaId={categoriaSugerida?.id}
          onSeleccionar={(id) => { setCatFilter(id); setCatSheetAbierto(false); }}
          onClose={() => setCatSheetAbierto(false)}
        />
      )}
      {filtered.length === 0
        ? <div style={{ textAlign: "center", padding: "60px 0", color: GRAY3 }}><Search size={48} strokeWidth={1.3} style={{ margin: "0 auto 12px" }} /><p>No se encontraron productos</p></div>
        : <div key={catFilter + "-" + search} className="oft-prod-grid" style={S.prodGrid}>
            {filtered.map((p, i) => (
              <div key={p.id} className="oft-prod-anim" style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s`, height: "100%" }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MODAL DE DETALLE DEL PRODUCTO (Quick View)
// ═══════════════════════════════════════════════════════════════
function ProductModal() {
  const { quickView: product, setQuickView, addToCart, showToast } = useApp();
  const [pres, setPres] = useState("docena"); // siempre abre en Docena por defecto, incluso si "venta_por_unidad" está activo
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState(false);
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => { setPres("docena"); setCount(1); setAdded(false); setTalla(""); setColor(""); }, [product]);

  // Cambia el título de la pestaña al nombre del producto mientras está abierto
  useEffect(() => {
    if (!product) return;
    const anterior = document.title;
    document.title = `${product.nombre} | Ofertodo`;
    return () => { document.title = anterior; };
  }, [product]);

  if (!product) return null;
  const total = presTotal(product, pres, count);
  const imgUrl = product.imagen_url ? imagenOptimizada(product.imagen_url, 700) : null;
  const respetaStock = (!product.proveedor_id || product.tiene_stock_fisico);
  const agotadoBloqueado = respetaStock && product.stock_actualizado_at && Number(product.stock) <= 0;

  const tieneVariantes = (product.tiene_tallas && (product.tallas || "").trim()) || (product.tiene_colores && (product.colores || "").trim());
  const modoConsulta = pres === "pieza" && tieneVariantes && !product.venta_por_unidad;

  const consultarWhatsApp = () => {
    if (product.tiene_tallas && (product.tallas || "").trim() && !talla) { showToast("Elige una talla primero"); return; }
    if (product.tiene_colores && (product.colores || "").trim() && !color) { showToast("Elige un color primero"); return; }
    let msg = `Hola Ofertodo, quiero consultar disponibilidad de:\n\n*${product.nombre}*`;
    if (product.referencia) msg += `\nRef: ${product.referencia}`;
    if (talla) msg += `\nTalla: ${talla}`;
    if (color) msg += `\nColor: ${color}`;
    msg += `\nPresentación: Por pieza`;
    if (product.imagen_url) {
      msg += `\n\n📷 Foto del producto:\n${product.imagen_url}`;
    } else {
      msg += `\n\n(Este producto no tiene foto cargada)`;
    }
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleAdd = () => {
    addToCart(product, presToPiezas(pres, count), pres, count);
    showToast(`${product.nombre} agregado al pedido`);
    setAdded(true);
    setTimeout(() => setAdded(false), 1100);
  };

  return (
    <div className="oft-overlay" style={S.overlay} onClick={() => setQuickView(null)}>
      <div className="oft-modal-sheet oft-qv-pop" style={{ ...S.modal, maxWidth: 560, padding: 0, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {/* BOTÓN CERRAR */}
        <button onClick={() => setQuickView(null)} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
          <X size={20} />
        </button>

        {/* IMAGEN GRANDE */}
        <div style={{ background: GRAY, aspectRatio: "1 / 1", width: "100%", maxHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
          {imgUrl
            ? <img src={imgUrl} alt={product.nombre} decoding="async" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <Package size={80} color={GRAY3} strokeWidth={1.2} />
          }
          {product.badge && <span style={{ position: "absolute", top: 14, left: 14, background: RED, color: WHITE, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}><Sparkles size={12} /> {product.badge}</span>}
        </div>

        {/* CONTENIDO */}
        <div style={{ padding: 24, maxHeight: "50vh", overflowY: "auto" }}>
          <div style={{ fontSize: 12, color: GRAY3, fontWeight: 600, marginBottom: 4 }}>REF: {product.referencia}</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{product.nombre}</div>
          {product.descripcion && <div style={{ fontSize: 14, color: GRAY3, marginBottom: 16, lineHeight: 1.5 }}>{product.descripcion}</div>}

          {/* SELECTOR DE PRESENTACIÓN + CANTIDAD + TOTAL */}
          <div style={{ background: GRAY, borderRadius: 12, padding: 16, margin: "8px 0 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Elige como comprar</span>
              <span style={{ fontSize: 24, color: RED, fontWeight: 900 }}>${Number(total).toFixed(2)}</span>
            </div>
            <QtySelector product={product} pres={pres} setPres={setPres} count={count} setCount={setCount} size="big" />
            {modoConsulta ? (
              <div style={{ background: WHITE, borderRadius: 8, padding: "12px", marginTop: 12 }}>
                <VariantPicker product={product} talla={talla} setTalla={setTalla} color={color} setColor={setColor} />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: GRAY3, background: WHITE, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                <Sparkles size={13} /> {presBreakdown(pres, count, product)}
              </div>
            )}
            <DistribucionInfo key={product?.id} product={product} pres={pres} count={count} />
          </div>

          {/* BOTONES */}
          {modoConsulta ? (
            <button className="oft-btn-press" style={{ ...S.btnWA, width: "100%", justifyContent: "center", padding: 14, fontSize: 15 }} onClick={consultarWhatsApp}>
              <MessageCircle size={18} /> Consultar disponibilidad
            </button>
          ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="oft-btn-press" disabled={agotadoBloqueado} style={{ ...S.btnRed, flex: 1, justifyContent: "center", padding: 14, fontSize: 15, background: agotadoBloqueado ? GRAY3 : (added ? "#25D366" : RED), transition: "background 0.3s", cursor: agotadoBloqueado ? "not-allowed" : "pointer", opacity: agotadoBloqueado ? 0.7 : 1 }} onClick={agotadoBloqueado ? undefined : handleAdd}>
              {agotadoBloqueado ? "Agotado" : added ? <><CheckCircle2 size={17} className="oft-check-pop" /> ¡Agregado!</> : <><Plus size={16} strokeWidth={2.5} /> Agregar al pedido</>}
            </button>
            <button className="oft-btn-press" style={{ ...S.btnWA, padding: "14px 16px" }} onClick={() => { let m = `Hola Ofertodo, me interesa: ${product.nombre}`; if (product.referencia) m += ` (Ref: ${product.referencia})`; if (product.imagen_url) m += `\n\n📷 Foto:\n${product.imagen_url}`; window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(m)}`, "_blank"); }}><MessageCircle size={18} /></button>
            <button className="oft-btn-press" style={{ ...S.btnWA, padding: "14px 16px", background: GRAY2, color: BLACK }} title="Compartir producto" onClick={() => compartirProducto(product, showToast)}><Share2 size={18} /></button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CARRITO FLOTANTE (FAB)
// ═══════════════════════════════════════════════════════════════
function FloatingCart() {
  const { cart, cartPulse, setShowCart, view } = useApp();
  const [bounce, setBounce] = useState(false);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + cartItemTotal(i), 0);

  useEffect(() => {
    if (cartPulse > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 500);
      return () => clearTimeout(t);
    }
  }, [cartPulse]);

  // Solo se muestra navegando catálogo/inicio y con productos
  if (cartCount === 0 || !["home", "catalogo"].includes(view)) return null;

  return (
    <div
      onClick={() => setShowCart(true)}
      className={bounce ? "oft-cart-bounce" : ""}
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 150,
        background: RED, color: WHITE, borderRadius: 50,
        padding: "14px 20px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 8px 24px rgba(227,30,36,0.4)",
        fontWeight: 800,
      }}
    >
      <div style={{ position: "relative", display: "flex" }}>
        <ShoppingCart size={24} strokeWidth={2.2} />
        <span style={{ position: "absolute", top: -8, right: -10, background: WHITE, color: RED, borderRadius: "50%", fontSize: 11, fontWeight: 900, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: `2px solid ${RED}` }}>
          {cartCount}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>Ver pedido</span>
        <span style={{ fontSize: 16 }}>${total.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CART MODAL
// ═══════════════════════════════════════════════════════════════
function CartModal() {
  const { cart, setCart, setShowCart, user, setShowLogin, setView, setPendingCheckout } = useApp();
  const total = cart.reduce((s, i) => s + cartItemTotal(i), 0);

  return (
    <div className="oft-overlay" style={S.overlay} onClick={() => setShowCart(false)}>
      <div className="oft-modal-sheet" style={{ ...S.modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><ShoppingCart size={20} /> Tu Pedido</div>
          <button onClick={() => setShowCart(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>
        {cart.length === 0
          ? <div style={{ textAlign: "center", padding: "40px 0", color: GRAY3 }}><ShoppingCart size={48} strokeWidth={1.3} style={{ margin: "0 auto 12px" }} /><p>Tu pedido está vacío</p></div>
          : <>
            {cart.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${GRAY2}` }}>
                {item.product.imagen_url
                  ? <img src={item.product.imagen_url} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                  : <div style={{ width: 36, height: 36, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={18} color={GRAY3} /></div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.product.nombre}</div>
                  <div style={{ fontSize: 12, color: GRAY3 }}>{cartItemLabel(item)} · ${cartItemTotal(item).toFixed(2)}</div>
                </div>
                <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: RED, cursor: "pointer", display: "flex" }}><Trash2 size={18} /></button>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", fontWeight: 900, fontSize: 18 }}>
              <span>Total</span><span style={{ color: RED }}>${total.toFixed(2)}</span>
            </div>
            <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 14, fontSize: 15 }}
              onClick={() => { setShowCart(false); if (user) { setView("checkout"); } else { setPendingCheckout(true); setShowLogin(true); } }}>
              Finalizar Pedido →
            </button>
            <button style={{ ...S.btnWA, width: "100%", justifyContent: "center", padding: 12, marginTop: 10 }}
              onClick={() => { const msg = cart.map(i => `${i.product.nombre} x${i.qty}`).join(", "); window.open(`https://wa.me/${WA_NUMBER}?text=Hola%20Ofertodo%2C%20quiero%20pedir:%20${encodeURIComponent(msg)}`, "_blank"); }}>
              <MessageCircle size={16} /> Pedir por WhatsApp
            </button>
          </>
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AUTH MODALS
// ═══════════════════════════════════════════════════════════════
function LoginModal() {
  const { setShowLogin, setShowRegister, setUser, showToast } = useApp();
  const [email, setEmail] = useState(""), [pass, setPass] = useState(""), [loading, setLoading] = useState(false), [err, setErr] = useState("");
  // Paso de verificación en dos pasos (solo aparece si la cuenta lo tiene activado)
  const [mfaPaso, setMfaPaso] = useState(null); // null | { factorId, res, users }
  const [mfaCodigo, setMfaCodigo] = useState("");

  const handle = async () => {
    setLoading(true); setErr("");
    try {
      const res = await sb.signIn(email, pass);
      // IMPORTANTE: nos fijamos en si realmente llegó un access_token, no en si "hay un campo error"
      // (Supabase puede devolver el error en formatos distintos según la versión — confiar solo en
      // detectar el error es justo lo que dejaba entrar a cualquiera con credenciales inválidas).
      if (!res.access_token || !res.user) {
        const msg = res.error_description || res.msg || (typeof res.error === "string" ? res.error : res.error?.message) || "Correo o contraseña incorrectos";
        setErr(msg === "invalid_grant" ? "Correo o contraseña incorrectos" : msg);
      } else {
        // Activa la sesión (aunque sea parcial) para poder consultar el perfil y, si aplica, el 2do factor
        sb.setSession(res);
        const users = await sb.get("usuarios", `?email=eq.${encodeURIComponent(email)}&limit=1`);
        let factorVerificado = null;
        try {
          const factores = await sb.mfaListFactors();
          factorVerificado = factores.find(f => f.status === "verified") || null;
        } catch(e) {}
        if (factorVerificado) {
          // Esta cuenta tiene 2FA activado: pide el código antes de terminar de entrar
          setMfaPaso({ factorId: factorVerificado.id, res, users });
        } else {
          setUser({ ...res.user, ...(users[0] || {}), token: res.access_token, refresh_token: res.refresh_token, expires_at: sb.session?.expires_at });
          showToast("¡Bienvenido de vuelta!");
          setShowLogin(false);
        }
      }
    } catch(e) { setErr("Error de conexión. Verifica tu configuración de Supabase."); }
    setLoading(false);
  };

  const confirmarMfa = async () => {
    if (mfaCodigo.trim().length < 6) { setErr("Escribe el código de 6 dígitos"); return; }
    setLoading(true); setErr("");
    try {
      const ch = await sb.mfaChallenge(mfaPaso.factorId);
      if (!ch.id) { setErr("No se pudo verificar, intenta de nuevo"); setLoading(false); return; }
      const v = await sb.mfaVerify(mfaPaso.factorId, ch.id, mfaCodigo.trim());
      if (v.error || !v.access_token) {
        setErr("Código incorrecto");
        setLoading(false);
        return;
      }
      sb.setSession(v);
      setUser({ ...mfaPaso.res.user, ...(mfaPaso.users[0] || {}), token: v.access_token, refresh_token: v.refresh_token, expires_at: sb.session?.expires_at });
      showToast("¡Bienvenido de vuelta!");
      setShowLogin(false);
    } catch(e) { setErr("Error de conexión"); }
    setLoading(false);
  };

  if (mfaPaso) {
    return (
      <div className="oft-overlay" style={S.overlay} onClick={() => setShowLogin(false)}>
        <div className="oft-modal-sheet oft-modal oft-auth-pop" style={S.modal} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><Logo height={28} /><button onClick={() => setShowLogin(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button></div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><Lock size={19} color={RED} /> Verificación en dos pasos</div>
          <p style={{ fontSize: 13, color: GRAY3, marginBottom: 18 }}>Abre tu app de autenticación (Google Authenticator, Authy, etc.) y escribe el código de 6 dígitos.</p>
          <input style={{ ...S.input, textAlign: "center", fontSize: 20, letterSpacing: 4, fontWeight: 800 }} maxLength={6} inputMode="numeric" placeholder="000000" value={mfaCodigo} onChange={e => setMfaCodigo(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && confirmarMfa()} autoFocus />
          {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 14, fontSize: 15, opacity: loading ? 0.7 : 1, marginTop: 8 }} onClick={confirmarMfa} disabled={loading}>
            {loading ? "Verificando..." : "Confirmar"}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: GRAY3, cursor: "pointer" }} onClick={() => { setMfaPaso(null); setMfaCodigo(""); setErr(""); }}>
            ← Volver
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="oft-overlay" style={S.overlay} onClick={() => setShowLogin(false)}>
      <div className="oft-modal-sheet oft-modal oft-auth-pop" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><Logo height={28} /><button onClick={() => setShowLogin(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button></div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Iniciar sesión</div>
        {/* BOTÓN DE GOOGLE */}
        <button onClick={() => sb.signInWithGoogle()} className="oft-btn-press" style={{ width: "100%", justifyContent: "center", padding: 13, fontSize: 15, fontWeight: 700, border: `1.5px solid ${GRAY2}`, borderRadius: 10, background: WHITE, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 010-3.44V4.95H.96a9 9 0 000 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
          Continuar con Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: GRAY2 }} /><span style={{ fontSize: 12, color: GRAY3 }}>o con tu correo</span><div style={{ flex: 1, height: 1, background: GRAY2 }} />
        </div>
        <label style={S.label}>Correo electrónico</label>
        <input style={S.input} type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <label style={S.label}>Contraseña</label>
        <input style={S.input} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
        {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 14, fontSize: 15, opacity: loading ? 0.7 : 1 }} onClick={handle} disabled={loading}>
          {loading ? "Verificando..." : "Iniciar sesión"}
        </button>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: GRAY3 }}>
          ¿No tienes cuenta? <span style={{ color: RED, fontWeight: 700, cursor: "pointer" }} onClick={() => { setShowLogin(false); setShowRegister(true); }}>Regístrate</span>
        </div>
      </div>
    </div>
  );
}

function RegisterModal() {
  const { setShowRegister, setShowLogin, setUser, showToast } = useApp();
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "", pass: "", pass2: "" });
  const [loading, setLoading] = useState(false), [err, setErr] = useState("");

  const handle = async () => {
    if (!form.nombre || !form.email || !form.pass) { setErr("Por favor completa todos los campos."); return; }
    if (form.pass.length < 6) { setErr("La contraseña debe tener al menos 6 caracteres."); return; }
    if (form.pass !== form.pass2) { setErr("Las contraseñas no coinciden. Verifica que sean iguales."); return; }
    setLoading(true); setErr("");
    try {
      const auth = await sb.signUp(form.email, form.pass, { nombre: form.nombre });
      if (auth.error || auth.error_description || auth.msg) {
        setErr(auth.error?.message || auth.error_description || auth.msg || "No se pudo crear la cuenta.");
      } else {
        await sb.post("usuarios", { nombre: form.nombre, email: form.email, telefono: form.telefono, es_admin: false });
        // Enviar email de bienvenida (sin bloquear el flujo si falla)
        try {
          fetch(SUPABASE_URL + "/functions/v1/bienvenida-cliente", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_KEY },
            body: JSON.stringify({ nombre: form.nombre, email: form.email }),
          });
        } catch(e) {}
        showToast("¡Cuenta creada! Revisa tu correo para confirmar y luego inicia sesión.");
        setShowRegister(false);
      }
    } catch(e) { setErr("Error de conexión."); }
    setLoading(false);
  };

  return (
    <div className="oft-overlay" style={S.overlay} onClick={() => setShowRegister(false)}>
      <div className="oft-modal-sheet oft-modal oft-auth-pop" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><Logo height={28} /><button onClick={() => setShowRegister(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button></div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Crear cuenta</div>

        {/* BOTÓN DE GOOGLE */}
        <button onClick={() => sb.signInWithGoogle()} className="oft-btn-press" style={{ width: "100%", justifyContent: "center", padding: 13, fontSize: 15, fontWeight: 700, border: `1.5px solid ${GRAY2}`, borderRadius: 10, background: WHITE, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 010-3.44V4.95H.96a9 9 0 000 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
          Continuar con Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: GRAY2 }} /><span style={{ fontSize: 12, color: GRAY3 }}>o con tu correo</span><div style={{ flex: 1, height: 1, background: GRAY2 }} />
        </div>

        {[["nombre","Nombre completo","Tu nombre completo","text"],["telefono","WhatsApp / Celular","+507 0000-0000","text"],["email","Correo electrónico","tu@email.com","email"],["pass","Contraseña","Mínimo 6 caracteres","password"],["pass2","Repite la contraseña","Escríbela de nuevo","password"]].map(([k,l,ph,tp]) => (
          <div key={k}><label style={S.label}>{l}</label><input style={S.input} type={tp} placeholder={ph} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} /></div>
        ))}
        {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 14, fontSize: 15, opacity: loading ? 0.7 : 1 }} onClick={handle} disabled={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: GRAY3 }}>
          ¿Ya tienes cuenta? <span style={{ color: RED, fontWeight: 700, cursor: "pointer" }} onClick={() => { setShowRegister(false); setShowLogin(true); }}>Inicia sesión</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  COMPLETAR PERFIL (después de registrarse con Google)
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  2FA AL INICIAR SESIÓN CON GOOGLE (cuenta con verificación en dos pasos activada)
// ═══════════════════════════════════════════════════════════════
function GoogleMfaModal() {
  const { googleMfaPaso, setGoogleMfaPaso, setUser, showToast } = useApp();
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const confirmar = async () => {
    if (codigo.trim().length < 6) { setErr("Escribe el código de 6 dígitos"); return; }
    setLoading(true); setErr("");
    try {
      const ch = await sb.mfaChallenge(googleMfaPaso.factorId);
      if (!ch.id) { setErr("No se pudo verificar, intenta de nuevo"); setLoading(false); return; }
      const v = await sb.mfaVerify(googleMfaPaso.factorId, ch.id, codigo.trim());
      if (v.error || !v.access_token) { setErr("Código incorrecto"); setLoading(false); return; }
      sb.setSession(v);
      const { gUser, perfil } = googleMfaPaso;
      setUser({ ...gUser, ...(perfil[0] || {}), token: v.access_token, refresh_token: v.refresh_token, expires_at: sb.session?.expires_at });
      showToast(`¡Bienvenido de vuelta, ${perfil[0]?.nombre?.split(" ")[0] || ""}!`);
      setGoogleMfaPaso(null);
    } catch(e) { setErr("Error de conexión"); }
    setLoading(false);
  };

  return (
    <div className="oft-overlay" style={S.overlay} onClick={() => setGoogleMfaPaso(null)}>
      <div className="oft-modal-sheet oft-modal oft-auth-pop" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><Logo height={28} /><button onClick={() => setGoogleMfaPaso(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button></div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><Lock size={19} color={RED} /> Verificación en dos pasos</div>
        <p style={{ fontSize: 13, color: GRAY3, marginBottom: 18 }}>Esta cuenta tiene 2FA activado. Abre tu app de autenticación y escribe el código de 6 dígitos.</p>
        <input style={{ ...S.input, textAlign: "center", fontSize: 20, letterSpacing: 4, fontWeight: 800 }} maxLength={6} inputMode="numeric" placeholder="000000" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && confirmar()} autoFocus />
        {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 14, fontSize: 15, opacity: loading ? 0.7 : 1, marginTop: 8 }} onClick={confirmar} disabled={loading}>
          {loading ? "Verificando..." : "Confirmar"}
        </button>
      </div>
    </div>
  );
}

function CompleteProfileModal() {
  const { completeProfile, setCompleteProfile, setUser, showToast } = useApp();
  const [nombre, setNombre] = useState(completeProfile?.nombre || "");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false), [err, setErr] = useState("");

  const handle = async () => {
    if (!nombre.trim()) { setErr("Escribe tu nombre."); return; }
    if (!telefono.trim()) { setErr("Escribe tu WhatsApp / celular."); return; }
    setLoading(true); setErr("");
    try {
      await sb.post("usuarios", { nombre: nombre.trim(), email: completeProfile.email, telefono: telefono.trim(), es_admin: false });
      const perfil = await sb.get("usuarios", `?email=eq.${encodeURIComponent(completeProfile.email)}&limit=1`);
      setUser({ ...completeProfile.gUser, ...(perfil[0] || {}), token: completeProfile.token, refresh_token: completeProfile.refresh_token, expires_at: completeProfile.expires_at });
      // Enviar email de bienvenida (sin bloquear si falla)
      try {
        fetch(SUPABASE_URL + "/functions/v1/bienvenida-cliente", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_KEY },
          body: JSON.stringify({ nombre: nombre.trim(), email: completeProfile.email }),
        });
      } catch(e) {}
      showToast(`¡Cuenta creada! Bienvenido, ${nombre.split(" ")[0]}`);
      setCompleteProfile(null);
    } catch(e) { setErr("Error al guardar. Intenta de nuevo."); }
    setLoading(false);
  };

  return (
    <div className="oft-overlay" style={S.overlay}>
      <div className="oft-modal-sheet oft-modal oft-auth-pop" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><Logo height={28} /></div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, textAlign: "center" }}>¡Casi listo! 🎉</div>
        <p style={{ fontSize: 14, color: GRAY3, textAlign: "center", marginBottom: 22 }}>
          Entraste con Google como <strong>{completeProfile.email}</strong>. Completa estos datos para terminar tu registro.
        </p>
        <label style={S.label}>Nombre completo</label>
        <input style={S.input} placeholder="Tu nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} />
        <label style={S.label}>WhatsApp / Celular</label>
        <input style={S.input} placeholder="+507 0000-0000" value={telefono} onChange={e => setTelefono(e.target.value)} />
        {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 14, fontSize: 15, opacity: loading ? 0.7 : 1 }} onClick={handle} disabled={loading}>
          {loading ? "Guardando..." : "Completar registro"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BOTÓN DE PAGO YAPPY (oficial, vía CDN)
// ═══════════════════════════════════════════════════════════════
function YappyButton({ pedido, onExito, onCancelar }) {
  const ref = useRef(null);
  const esperandoRef = useRef(false); // evita el cierre obsoleto en handleError
  const [estado, setEstado] = useState("listo"); // listo | enviando | esperando | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;

    // Cuando el cliente toca el botón de Yappy: creamos la orden en el backend
    const handleClick = async () => {
      setEstado("enviando");
      setErrorMsg("");
      try {
        btn.isButtonLoading = true;
        const resp = await fetch(YAPPY_FN_CREAR, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_KEY },
          body: JSON.stringify({ total: pedido.total, orderId: pedido.yappyOrderId, telefono: pedido.telefono }),
        });
        const result = await resp.json();
        // La función devuelve { paso, enviado, respuestaYappy }
        // Los datos del pago están en respuestaYappy.body
        const body = result?.respuestaYappy?.body || result?.body;
        if (body && body.transactionId && body.token && body.documentName) {
          // Marcamos ANTES de llamar eventPayment para que handleError lo vea
          esperandoRef.current = true;
          setEstado("esperando");
          btn.eventPayment({
            transactionId: body.transactionId,
            documentName: body.documentName,
            token: body.token,
          });
        } else {
          const desc = result?.respuestaYappy?.status?.description || result?.status?.description || "No se pudo crear el pago. Intenta de nuevo.";
          setEstado("error");
          setErrorMsg(desc);
          btn.isButtonLoading = false;
        }
      } catch (e) {
        setEstado("error");
        setErrorMsg("Error de conexión. Intenta de nuevo.");
        btn.isButtonLoading = false;
      }
    };

    const handleSuccess = () => { esperandoRef.current = false; onExito(); };

    // NO conectamos eventError de Yappy — lo manejamos todo nosotros
    // Yappy dispara eventError cuando envía la solicitud al teléfono del cliente,
    // pero eso NO es un error real — el cliente debe confirmar en su app.
    btn.addEventListener("eventClick", handleClick);
    btn.addEventListener("eventSuccess", handleSuccess);
    return () => {
      btn.removeEventListener("eventClick", handleClick);
      btn.removeEventListener("eventSuccess", handleSuccess);
    };
  }, [pedido]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        {/* @ts-ignore */}
        <btn-yappy ref={ref} theme="sky"></btn-yappy>
      </div>
      {/* Mensaje cuando la solicitud ya fue enviada al Yappy del cliente */}
      {estado === "esperando" && (
        <div style={{ background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, color: "#2E7D32", fontSize: 14, marginBottom: 4 }}>
            ✅ ¡Solicitud enviada a tu Yappy!
          </div>
          <div style={{ fontSize: 13, color: "#2E7D32", lineHeight: 1.5 }}>
            Abre tu app de <strong>Yappy</strong> y confirma el pago pendiente de <strong>{pedido?.total ? `$${Number(pedido.total).toFixed(2)}` : ""}</strong>.<br />
            Tu pedido se confirmará automáticamente.
          </div>
        </div>
      )}
      {estado === "error" && (
        <div style={{ color: RED, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{errorMsg}</div>
      )}
      <button onClick={onCancelar} style={{ background: "none", border: "none", color: GRAY3, fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>
        Cancelar y volver
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CHECKOUT
// ═══════════════════════════════════════════════════════════════
function CheckoutView() {
  const { cart, setCart, user, setView, showToast, empresas, sucursales, localesRetiro, retiroLocalHabilitado } = useApp();
  const [localRetiroId, setLocalRetiroId] = useState(null);
  const [address, setAddress] = useState(""), [notes, setNotes] = useState(""), [loading, setLoading] = useState(false), [placed, setPlaced] = useState(null);
  const [avisoValidacion, setAvisoValidacion] = useState(null); // mensaje del pop-up de validación (reemplaza alert() nativo)
  const [nombre, setNombre] = useState(user?.nombre || "");
  const [telefono, setTelefono] = useState(user?.telefono || "");
  const [telefonoYappy, setTelefonoYappy] = useState(user?.telefono || ""); // número específico para pagar con Yappy
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursalId, setSucursalId] = useState(null);
  const [modoEntrega, setModoEntrega] = useState("sucursal"); // "sucursal" | "puerta"
  const [metodoPago, setMetodoPago] = useState("yappy"); // "yappy" | "tarjeta"
  const [tarjetaPagoData, setTarjetaPagoData] = useState(null); // { RedirectData, codigo } — cuando se muestra el iframe de la tarjeta
  const tarjetaContainerRef = useRef(null);
  const [tarjetaProcesando, setTarjetaProcesando] = useState(false);

  // Scroll al inicio al abrir el checkout — importante en celular
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  const subtotalBruto = cart.reduce((s, i) => s + cartItemTotal(i), 0);
  // ── DESCUENTO ──
  const [codigoInput, setCodigoInput] = useState("");        // lo que el cliente escribe
  const [descuentoAplicado, setDescuentoAplicado] = useState(null); // {codigo, porcentaje, tipo_aplicacion, productos_ids}
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");

  // Calcula cuánto se descuenta según el tipo (tienda o productos seleccionados)
  const montoDescuento = (() => {
    if (!descuentoAplicado) return 0;
    const pct = Number(descuentoAplicado.porcentaje) / 100;
    if (descuentoAplicado.tipo_aplicacion === "tienda") {
      return subtotalBruto * pct;
    }
    // Solo sobre los productos incluidos en el descuento
    const ids = descuentoAplicado.productos_ids || [];
    const baseAplicable = cart.reduce((s, i) => ids.includes(i.product.id) ? s + cartItemTotal(i) : s, 0);
    return baseAplicable * pct;
  })();
  const total = Math.max(subtotalBruto - montoDescuento, 0);
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Valida el código contra la tabla de descuentos
  const aplicarCodigo = async () => {
    const code = codigoInput.trim().toUpperCase();
    if (!code) { setErrorCodigo("Escribe un código"); return; }
    setValidandoCodigo(true);
    setErrorCodigo("");
    try {
      const res = await sb.get("descuentos", `?codigo=eq.${encodeURIComponent(code)}&activo=eq.true`);
      if (!res || res.length === 0) {
        setErrorCodigo("Código no válido o inactivo");
        setDescuentoAplicado(null);
      } else {
        const d = res[0];
        // Si es por productos, verifica que el carrito tenga al menos uno incluido
        if (d.tipo_aplicacion === "productos") {
          const ids = d.productos_ids || [];
          const hayAlguno = cart.some(i => ids.includes(i.product.id));
          if (!hayAlguno) {
            setErrorCodigo("Este código aplica a productos que no están en tu carrito");
            setDescuentoAplicado(null);
            setValidandoCodigo(false);
            return;
          }
        }
        setDescuentoAplicado(d);
        showToast(`¡Código ${code} aplicado! ${d.porcentaje}% de descuento`);
      }
    } catch(e) {
      setErrorCodigo("No se pudo validar el código");
    }
    setValidandoCodigo(false);
  };
  const quitarCodigo = () => { setDescuentoAplicado(null); setCodigoInput(""); setErrorCodigo(""); };

  const empresasActivas = empresas.filter(e => e.activa !== false);
  const sucursalesEmpresa = sucursales.filter(s => s.empresa_id === empresaId && s.activa !== false);
  const empresaSel = empresas.find(e => e.id === empresaId);
  const sucursalSel = sucursales.find(s => s.id === sucursalId);
  // Para puerta a puerta: busca la empresa Servientrega en la lista (por nombre)
  const servientrega = empresas.find(e => (e.nombre || "").toLowerCase().includes("servientrega"));

  const [pedidoPendiente, setPedidoPendiente] = useState(null); // pedido guardado, esperando pago Yappy

  const handlePlace = async () => {
    if (!nombre.trim()) { setAvisoValidacion("Por favor escribe tu nombre."); return; }
    if (metodoPago === "yappy") {
      const aliasLimpio = telefonoYappy.replace(/\D/g, "");
      if (aliasLimpio.length < 7) { setAvisoValidacion("Por favor escribe tu número de Yappy para poder cobrar el pago."); return; }
    }

    // Definir empresa, sucursal y dirección según el modo de entrega
    let empresaFinalId, empresaFinalNombre, sucursalFinalId, sucursalFinalNombre;

    if (modoEntrega === "local") {
      // Retiro en el local: no hay empresa de envío ni sucursal, ni costo de envío
      if (localesRetiro.length > 1 && !localRetiroId) { setAvisoValidacion("Por favor elige en cuál local vas a retirar tu pedido."); return; }
      empresaFinalId = null;
      empresaFinalNombre = "";
      sucursalFinalId = null;
      sucursalFinalNombre = "";
    } else if (modoEntrega === "puerta") {
      // Puerta a puerta: Servientrega automático + dirección obligatoria + sin sucursal
      if (!servientrega) { setAvisoValidacion("El envío puerta a puerta no está disponible por ahora. Por favor elige una sucursal."); return; }
      if (!address.trim()) { setAvisoValidacion("Para envío puerta a puerta, la dirección es obligatoria."); return; }
      empresaFinalId = servientrega.id;
      empresaFinalNombre = servientrega.nombre;
      sucursalFinalId = null;
      sucursalFinalNombre = "Puerta a puerta";
    } else {
      // Recoger en sucursal
      if (!empresaId) { setAvisoValidacion("Por favor elige una empresa de envío."); return; }
      if (sucursalesEmpresa.length > 0 && !sucursalId) { setAvisoValidacion("Por favor elige una sucursal."); return; }
      empresaFinalId = empresaId;
      empresaFinalNombre = empresaSel?.nombre || "";
      sucursalFinalId = sucursalId;
      sucursalFinalNombre = sucursalSel?.nombre || "";
    }

    const localElegido = modoEntrega === "local" ? (localesRetiro.find(l => l.id === localRetiroId) || localesRetiro[0] || null) : null;

    setLoading(true);
    try {
      if (metodoPago === "tarjeta") {
        // El pedido se crea DENTRO de la función (junto con el inicio del pago en Powertranz)
        const itemsPayload = cart.map(item => ({
          producto_id: item.product.id, nombre_producto: item.product.nombre,
          cantidad: item.qty, precio_unitario: item.product.precio_pieza, subtotal: cartItemTotal(item),
        }));
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/crear-pago-tarjeta`, {
          method: "POST", headers: sb.functionHeaders(),
          body: JSON.stringify({
            usuario_id: user.id, nombre_cliente: nombre, telefono, direccion: address, notas: notes, total,
            items: itemsPayload,
            empresa_envio_id: empresaFinalId, empresa_envio_nombre: empresaFinalNombre,
            sucursal_id: sucursalFinalId, sucursal_nombre: sucursalFinalNombre,
            retiro_local: modoEntrega === "local", local_retiro_id: localElegido?.id || null, local_retiro_nombre: localElegido?.nombre || null,
            costo_envio: 0,
            descuento_codigo: descuentoAplicado?.codigo || null,
            descuento_monto: montoDescuento > 0 ? Number(montoDescuento.toFixed(2)) : 0,
          }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) { setAvisoValidacion("Error al iniciar el pago: " + (data.error || "intenta de nuevo")); setLoading(false); return; }
        setTarjetaPagoData({ RedirectData: data.RedirectData, codigo: data.codigo, modoPrueba: data.modo_prueba });
      } else {
        // orderId corto para Yappy (máx 15 caracteres alfanuméricos)
        const yappyOrderId = "OFT" + Date.now().toString().slice(-10);
        const codigo = `OFT-${Date.now().toString().slice(-6)}`;
        const pedido = await sb.post("pedidos", {
          codigo, usuario_id: user.id, nombre_cliente: nombre, telefono: telefono,
          direccion: address, notas: notes, total, estado: 0,
          empresa_envio_id: empresaFinalId, empresa_envio_nombre: empresaFinalNombre,
          sucursal_id: sucursalFinalId, sucursal_nombre: sucursalFinalNombre,
          retiro_local: modoEntrega === "local",
          local_retiro_id: localElegido?.id || null, local_retiro_nombre: localElegido?.nombre || null,
          pagado: false, yappy_order_id: yappyOrderId, metodo_pago: "yappy",
          descuento_codigo: descuentoAplicado?.codigo || null,
          descuento_monto: montoDescuento > 0 ? Number(montoDescuento.toFixed(2)) : 0,
        });
        const pedidoId = pedido[0].id;
        for (const item of cart) {
          await sb.post("pedido_items", { pedido_id: pedidoId, producto_id: item.product.id, nombre_producto: item.product.nombre, cantidad: item.qty, precio_unitario: item.product.precio_pieza, subtotal: cartItemTotal(item) });
        }
        // Guarda el pedido pendiente y muestra el botón de Yappy (el pago va primero)
        setPedidoPendiente({ id: pedidoId, codigo, yappyOrderId, total, telefono: telefonoYappy });
      }
    } catch(e) { setAvisoValidacion("Error al guardar el pedido: " + e.message); }
    setLoading(false);
  };

  // Cuando aparece el formulario de tarjeta, desplaza la página hasta ahí automáticamente
  // (para que el cliente no tenga que buscarlo manualmente hacia abajo)
  useEffect(() => {
    if (tarjetaPagoData && tarjetaContainerRef.current) {
      setTimeout(() => tarjetaContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [tarjetaPagoData]);

  // Escucha el mensaje de "pago simulado" mientras Powertranz no esté conectado (modo de prueba)
  useEffect(() => {
    const onMessage = (ev) => {
      if (ev.data?.tipo === "pago_prueba_ok" && tarjetaPagoData) {
        setTarjetaProcesando(true);
        showToast("✅ Pago de prueba simulado (modo de prueba, sin cargo real)");
        setTimeout(() => {
          setTarjetaProcesando(false);
          setPlaced(tarjetaPagoData.codigo);
          setCart([]);
          setTarjetaPagoData(null);
        }, 1200);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tarjetaPagoData]);

  // Cuando el pago de Yappy se confirma con éxito
  const onPagoExitoso = async () => {
    // Respaldo: marcamos el pedido como pagado también desde el front (la confirmación
    // oficial viene del IPN de Yappy, pero así el cliente lo ve de inmediato).
    try { if (pedidoPendiente?.id) await sb.patch("pedidos", pedidoPendiente.id, { pagado: true }); } catch(e) {}
    setPlaced(pedidoPendiente.codigo);
    setCart([]);
    setPedidoPendiente(null);
    showToast("¡Pago recibido! Tu pedido está confirmado.");
  };

  if (placed) return (
    <div className="oft-section" style={{ ...S.section, textAlign: "center", maxWidth: 500 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><CheckCircle2 size={64} color="#22c55e" strokeWidth={1.5} /></div>
      <h2 style={{ fontSize: 24, fontWeight: 900 }}>¡Pago recibido!</h2>
      <p style={{ color: GRAY3 }}>Tu pedido está confirmado. Sigue su estado desde "Mi Cuenta".</p>
      <div style={{ background: GRAY, borderRadius: 12, padding: 20, margin: "20px 0", textAlign: "left" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Número: <span style={{ color: RED }}>{placed}</span></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#D4EDDA", color: "#155724", padding: "4px 12px", borderRadius: 20, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          <CheckCircle2 size={14} /> Pagado con Yappy
        </div>
        {modoEntrega === "local"
          ? <div style={{ marginTop: 10, fontSize: 13, color: "#856404", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}><Home size={14} /> Retiro en el local{(() => { const l = localesRetiro.find(x => x.id === localRetiroId) || (localesRetiro.length === 1 ? localesRetiro[0] : null); return l ? `: ${l.nombre}` : ""; })()}</div>
          : empresaSel && <div style={{ marginTop: 10, fontSize: 13, color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><Truck size={14} /> {empresaSel.nombre}{sucursalSel ? ` · ${sucursalSel.nombre}` : ""}</div>}
      </div>
      <button style={{ ...S.btnRed, justifyContent: "center", margin: "0 auto" }} onClick={() => setView("dashboard")}>Ver estado de mi pedido</button>
    </div>
  );

  return (
    <div className="oft-section" style={{ ...S.section, maxWidth: 620 }}>
      {/* AVISO DE VALIDACIÓN (reemplaza el alert() nativo del navegador) */}
      {avisoValidacion && createPortal(
        <div className="oft-overlay" style={S.overlay} onClick={() => setAvisoValidacion(null)}>
          <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 18, maxWidth: 360, width: "90%", padding: "28px 24px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FFF0EF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <AlertTriangle size={28} color={RED} strokeWidth={2} />
            </div>
            <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 8 }}>Falta un dato</div>
            <p style={{ fontSize: 14, color: GRAY3, marginBottom: 22, lineHeight: 1.5 }}>{avisoValidacion}</p>
            <button onClick={() => setAvisoValidacion(null)} className="oft-btn-press" style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 13 }}>
              Entendido
            </button>
          </div>
        </div>
      , document.body)}

      <div style={S.sectionTitle}>Finalizar Pedido</div>
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 16, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Package size={18} /> Resumen</div>
        {cart.map((item, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", borderBottom: `1px solid ${GRAY2}` }}>
            <span>{item.product.nombre} <span style={{ color: GRAY3, fontSize: 12 }}>({cartItemLabel(item)})</span></span>
            <span style={{ fontWeight: 700 }}>${cartItemTotal(item).toFixed(2)}</span>
          </div>
        ))}

        {/* CÓDIGO DE DESCUENTO */}
        <div style={{ marginTop: 14 }}>
          {!descuentoAplicado ? (
            <div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${errorCodigo ? RED : GRAY2}`, fontSize: 14, textTransform: "uppercase", outline: "none" }}
                  placeholder="¿Tienes un código?"
                  value={codigoInput}
                  onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setErrorCodigo(""); }}
                  onKeyDown={e => e.key === "Enter" && aplicarCodigo()}
                />
                <button onClick={aplicarCodigo} disabled={validandoCodigo} className="oft-btn-press" style={{ background: BLACK, color: WHITE, border: "none", borderRadius: 8, padding: "0 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: validandoCodigo ? 0.6 : 1 }}>
                  {validandoCodigo ? "..." : "Aplicar"}
                </button>
              </div>
              {errorCodigo && <div style={{ color: RED, fontSize: 12, marginTop: 6, fontWeight: 600 }}>{errorCodigo}</div>}
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} color="#2E7D32" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#2E7D32" }}>{descuentoAplicado.codigo}</div>
                  <div style={{ fontSize: 11, color: "#2E7D32" }}>{descuentoAplicado.porcentaje}% de descuento aplicado</div>
                </div>
              </div>
              <button onClick={quitarCodigo} style={{ background: "none", border: "none", cursor: "pointer", color: "#2E7D32", display: "flex" }}><X size={18} /></button>
            </div>
          )}
        </div>

        {/* DESGLOSE */}
        {montoDescuento > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 14, color: GRAY3 }}>
              <span>Subtotal</span><span>${subtotalBruto.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 6, color: "#2E7D32", fontWeight: 700 }}>
              <span>Descuento ({descuentoAplicado.porcentaje}%)</span><span>−${montoDescuento.toFixed(2)}</span>
            </div>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18, marginTop: 14 }}>
          <span>Total</span><span style={{ color: RED }}>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* MODO DE ENTREGA */}
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 16, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Truck size={18} /> ¿Cómo quieres recibir tu pedido? *</div>
        <div style={{ display: "grid", gridTemplateColumns: retiroLocalHabilitado ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 6 }}>
          <div onClick={() => setModoEntrega("sucursal")}
            style={{ border: `2px solid ${modoEntrega === "sucursal" ? RED : GRAY2}`, background: modoEntrega === "sucursal" ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 16, cursor: "pointer", textAlign: "center" }}>
            <Building2 size={28} color={modoEntrega === "sucursal" ? RED : GRAY3} strokeWidth={1.6} />
            <div style={{ fontWeight: 800, fontSize: 14, marginTop: 8 }}>Recoger en sucursal</div>
            <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>Tú eliges la empresa y sucursal</div>
          </div>
          <div onClick={() => setModoEntrega("puerta")}
            style={{ border: `2px solid ${modoEntrega === "puerta" ? RED : GRAY2}`, background: modoEntrega === "puerta" ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 16, cursor: "pointer", textAlign: "center" }}>
            <MapPin size={28} color={modoEntrega === "puerta" ? RED : GRAY3} strokeWidth={1.6} />
            <div style={{ fontWeight: 800, fontSize: 14, marginTop: 8 }}>Puerta a puerta</div>
            <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>Te lo llevamos por Servientrega</div>
          </div>
          {retiroLocalHabilitado && (
            <div onClick={() => setModoEntrega("local")}
              style={{ border: `2px solid ${modoEntrega === "local" ? RED : GRAY2}`, background: modoEntrega === "local" ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 16, cursor: "pointer", textAlign: "center" }}>
              <Home size={28} color={modoEntrega === "local" ? RED : GRAY3} strokeWidth={1.6} />
              <div style={{ fontWeight: 800, fontSize: 14, marginTop: 8 }}>Retiro en el local</div>
              <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>Pasas tú mismo a recogerlo</div>
            </div>
          )}
        </div>
      </div>

      {/* AVISO / SELECCIÓN RETIRO EN EL LOCAL */}
      {modoEntrega === "local" && retiroLocalHabilitado && (
        <div style={{ background: "#FFF5F5", border: `1.5px solid ${RED}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          {localesRetiro.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Home size={22} color={RED} />
              <div style={{ fontSize: 13 }}>
                <strong>Retiro en nuestro local en Colón, Panamá.</strong> Te avisaremos por WhatsApp apenas esté listo para que pases a recogerlo — sin costo de envío.
              </div>
            </div>
          ) : localesRetiro.length === 1 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Home size={22} color={RED} />
              <div style={{ fontSize: 13 }}>
                <strong>Retiro en: {localesRetiro[0].nombre}</strong>{localesRetiro[0].direccion ? ` — ${localesRetiro[0].direccion}` : ""}. Te avisaremos por WhatsApp apenas esté listo — sin costo de envío.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Home size={18} color={RED} /> ¿En cuál local deseas retirarlo? *</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {localesRetiro.map(loc => (
                  <div key={loc.id} onClick={() => setLocalRetiroId(loc.id)}
                    style={{ border: `2px solid ${localRetiroId === loc.id ? RED : GRAY2}`, background: localRetiroId === loc.id ? WHITE : "#FFFAFA", borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                    <Home size={16} color={localRetiroId === loc.id ? RED : GRAY3} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{loc.nombre}</div>
                      {loc.direccion && <div style={{ fontSize: 11, color: GRAY3 }}>{loc.direccion}</div>}
                    </div>
                    {localRetiroId === loc.id && <CheckCircle2 size={16} color={RED} />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* EMPRESA DE ENVÍO (solo si recoge en sucursal) */}
      {modoEntrega === "sucursal" && (
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 16, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Truck size={18} /> Empresa de envío *</div>
        {empresasActivas.length === 0 ? (
          <div style={{ background: GRAY, borderRadius: 8, padding: 14, fontSize: 13, color: GRAY3 }}>No hay empresas de envío disponibles. Contáctanos por WhatsApp para coordinar.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {empresasActivas.map(emp => (
              <div key={emp.id}
                onClick={() => { setEmpresaId(emp.id); setSucursalId(null); }}
                style={{ border: `2px solid ${empresaId === emp.id ? RED : GRAY2}`, background: empresaId === emp.id ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}
              >
                {emp.logo_url
                  ? <img src={emp.logo_url} alt={emp.nombre} style={{ height: 36, objectFit: "contain" }} />
                  : <Building2 size={30} color={empresaId === emp.id ? RED : GRAY3} strokeWidth={1.6} />
                }
                <span style={{ fontWeight: 700, fontSize: 13 }}>{emp.nombre}</span>
              </div>
            ))}
          </div>
        )}

        {/* SUCURSAL */}
        {empresaId && sucursalesEmpresa.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <label style={S.label}>Elige la sucursal de {empresaSel?.nombre} *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sucursalesEmpresa.map(suc => (
                <div key={suc.id}
                  onClick={() => setSucursalId(suc.id)}
                  style={{ border: `2px solid ${sucursalId === suc.id ? RED : GRAY2}`, background: sucursalId === suc.id ? "#FFF5F5" : WHITE, borderRadius: 10, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <MapPinIcon size={18} color={sucursalId === suc.id ? RED : GRAY3} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{suc.nombre}</div>
                    {suc.direccion && <div style={{ fontSize: 12, color: GRAY3 }}>{suc.direccion}</div>}
                    {suc.telefono && <div style={{ fontSize: 12, color: GRAY3 }}>Tel: {suc.telefono}</div>}
                  </div>
                  {sucursalId === suc.id && <CheckCircle2 size={18} color={RED} />}
                </div>
              ))}
            </div>
          </div>
        )}
        {empresaId && sucursalesEmpresa.length === 0 && (
          <div style={{ marginTop: 14, fontSize: 13, color: GRAY3, background: GRAY, borderRadius: 8, padding: 12 }}>
            Esta empresa aún no tiene sucursales registradas. Coordinaremos los detalles por WhatsApp.
          </div>
        )}
      </div>
      )}

      {/* AVISO PUERTA A PUERTA */}
      {modoEntrega === "puerta" && (
        <div style={{ background: "#FFF5F5", border: `1.5px solid ${RED}`, borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <Truck size={22} color={RED} />
          <div style={{ fontSize: 13 }}>
            <strong>Envío puerta a puerta por Servientrega.</strong> Te lo llevamos a la dirección que indiques abajo. <span style={{ color: RED, fontWeight: 700 }}>La dirección es obligatoria.</span>
          </div>
        </div>
      )}

      {/* DIRECCIÓN / NOTAS */}
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 16, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><MapPin size={18} /> Datos adicionales</div>
        <label style={S.label}>Nombre *</label>
        <input style={S.input} placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <label style={S.label}>WhatsApp / Teléfono</label>
        <input style={S.input} placeholder="Ej: 6720-0474" value={telefono} onChange={e => setTelefono(e.target.value)} />
        <label style={S.label}>Dirección {modoEntrega === "puerta" ? "*" : "(opcional)"}</label>
        <input style={{ ...S.input, borderColor: modoEntrega === "puerta" && !address.trim() ? RED : GRAY2 }} placeholder={modoEntrega === "puerta" ? "Dirección completa para la entrega..." : "Ej: cerca del parque central..."} value={address} onChange={e => setAddress(e.target.value)} />
        <label style={S.label}>Notas (tallas, colores, referencias)</label>
        <input style={S.input} placeholder="Opcional..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {/* PAGO */}
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 20, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><CreditCard size={18} /> Pago</div>

        {!pedidoPendiente && !tarjetaPagoData ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: GRAY, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
              <span style={{ fontWeight: 700 }}>Total a pagar</span>
              <span style={{ fontWeight: 900, fontSize: 22, color: RED }}>{money(total)}</span>
            </div>

            {/* MÉTODO DE PAGO */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div onClick={() => setMetodoPago("yappy")}
                style={{ border: `2px solid ${metodoPago === "yappy" ? RED : GRAY2}`, background: metodoPago === "yappy" ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "center" }}>
                <span style={{ background: "#00C2DE", borderRadius: 6, padding: "2px 8px", color: WHITE, fontWeight: 900, fontSize: 12 }}>YAPPY</span>
                <div style={{ fontSize: 12, color: GRAY3, marginTop: 6 }}>Pago instantáneo</div>
              </div>
              <div onClick={() => setMetodoPago("tarjeta")}
                style={{ border: `2px solid ${metodoPago === "tarjeta" ? RED : GRAY2}`, background: metodoPago === "tarjeta" ? "#FFF5F5" : WHITE, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "center" }}>
                <CreditCard size={18} color={metodoPago === "tarjeta" ? RED : BLACK} style={{ marginBottom: 2 }} />
                <div style={{ fontWeight: 800, fontSize: 13 }}>Tarjeta</div>
                <div style={{ fontSize: 11, color: GRAY3 }}>Crédito o débito</div>
              </div>
            </div>

            {metodoPago === "yappy" ? (
              <>
                <p style={{ fontSize: 13, color: GRAY3, marginBottom: 12 }}>
                  Paga de forma segura con Yappy. Tu pedido se confirma apenas se reciba el pago.
                </p>
                <label style={{ ...S.label, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ background: "#00C2DE", borderRadius: 6, padding: "2px 7px", color: WHITE, fontWeight: 900, fontSize: 11 }}>YAPPY</span>
                  Número de Yappy para el cobro *
                </label>
                <input
                  style={{ ...S.input, marginBottom: 12, fontWeight: 700, fontSize: 15 }}
                  type="tel"
                  inputMode="numeric"
                  placeholder="Ej: 6700-0000"
                  value={telefonoYappy}
                  onChange={e => setTelefonoYappy(e.target.value)}
                />
                <p style={{ fontSize: 11, color: GRAY3, marginBottom: 14 }}>
                  Escribe el número de teléfono registrado en tu app de Yappy. La solicitud de pago llegará a ese número.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: GRAY3, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={13} /> El formulario de tu tarjeta lo maneja directamente el banco — nunca vemos ni guardamos tu número de tarjeta.
              </p>
            )}

            <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 16, fontSize: 16, opacity: loading ? 0.7 : 1 }} onClick={handlePlace} disabled={loading}>
              {loading ? "Procesando..." : <>Continuar al pago →</>}
            </button>
          </>
        ) : tarjetaPagoData ? (
          <div ref={tarjetaContainerRef}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Lock size={14} color={RED} /> Pago seguro con tarjeta</div>
              <button onClick={() => { setTarjetaPagoData(null); showToast("Pago cancelado. Puedes intentar de nuevo."); }} style={{ background: "none", border: "none", color: GRAY3, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Cancelar</button>
            </div>
            <div style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, overflow: "hidden" }}>
              <iframe srcDoc={tarjetaPagoData.RedirectData} frameBorder="0" title="Pago con tarjeta" style={{ width: "100%", height: "750px", display: "block" }} />
            </div>
            {tarjetaProcesando && <p style={{ fontSize: 12, color: GRAY3, textAlign: "center", marginTop: 10 }}>Confirmando tu pago...</p>}
          </div>
        ) : (
          <div style={{ background: `linear-gradient(135deg, ${RED} 0%, ${RED_D} 100%)`, borderRadius: 16, padding: 22, color: WHITE, textAlign: "center", boxShadow: "0 8px 24px rgba(227,30,36,0.25)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
              <Lock size={13} /> PAGO SEGURO
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>Total a pagar</div>
            <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 18, letterSpacing: -0.5 }}>{money(pedidoPendiente.total)}</div>
            <div style={{ background: WHITE, borderRadius: 12, padding: "16px 14px" }}>
              <YappyButton
                pedido={pedidoPendiente}
                onExito={onPagoExitoso}
                onCancelar={() => { setPedidoPendiente(null); showToast("Pago cancelado. Puedes intentar de nuevo."); }}
              />
            </div>
            <p style={{ fontSize: 11, opacity: 0.85, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <CheckCircle2 size={12} /> Procesado de forma segura por Yappy
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD CLIENTE
// ═══════════════════════════════════════════════════════════════
function DashboardView() {
  const { user, setUser, products, showToast } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  // Edición de datos de la cuenta
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [perfilForm, setPerfilForm] = useState({ nombre: "", telefono: "" });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const abrirEdicion = () => {
    setPerfilForm({ nombre: user?.nombre || "", telefono: user?.telefono || "" });
    setEditandoPerfil(true);
  };
  const guardarPerfil = async () => {
    if (!perfilForm.nombre.trim()) { showToast("Escribe tu nombre"); return; }
    if (!perfilForm.telefono.trim()) { showToast("Escribe tu celular"); return; }
    if (!user?.email) { showToast("No se pudo identificar tu cuenta"); return; }
    setGuardandoPerfil(true);
    try {
      // Buscar la fila REAL en la tabla usuarios por email (id confiable)
      let fila = null;
      try {
        const filas = await sb.get("usuarios", `?email=eq.${encodeURIComponent(user.email)}&limit=1`);
        fila = filas && filas[0] ? filas[0] : null;
      } catch(e) {}

      const cambios = { nombre: perfilForm.nombre.trim(), telefono: perfilForm.telefono.trim() };

      if (fila && fila.id) {
        // Actualizar la fila existente
        const upd = await sb.patch("usuarios", fila.id, cambios);
        if (!Array.isArray(upd) || !upd[0]) {
          // La base de datos no devolvió la fila actualizada → posible bloqueo de permisos (RLS)
          throw new Error("la base de datos no guardó el cambio (revisa permisos)");
        }
        setUser({ ...user, ...upd[0] });
      } else {
        // No existe la fila (puede pasar con cuentas viejas): crearla
        const creado = await sb.post("usuarios", { ...cambios, email: user.email, es_admin: false });
        const nuevo = Array.isArray(creado) && creado[0] ? creado[0] : { ...user, ...cambios };
        setUser({ ...user, ...nuevo });
      }
      showToast("Datos actualizados");
      setEditandoPerfil(false);
    } catch(e) { showToast("Error al guardar: " + (e.message || "intenta de nuevo")); }
    setGuardandoPerfil(false);
  };

  const loadOrders = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      // Solo mostramos pedidos pagados (o los viejos sin esta columna). Los no pagados quedan ocultos hasta que Yappy confirme.
      const data = await sb.get("pedidos", `?usuario_id=eq.${user.id}&or=(pagado.is.null,pagado.is.true)&order=created_at.desc`);
      const withItems = await Promise.all((data || []).map(async o => {
        try {
          const items = await sb.get("pedido_items", `?pedido_id=eq.${o.id}`);
          return { ...o, items: items || [] };
        } catch(e) {
          return { ...o, items: [] }; // si fallan los items, igual mostramos el pedido
        }
      }));
      setOrders(withItems);
    } catch(e) {
      console.error("Error cargando pedidos:", e);
      setOrders([]); // muestra "sin pedidos" en vez de quedarse cargando
    } finally {
      setLoading(false); // SIEMPRE quita el spinner pase lo que pase
    }
  };

  useEffect(() => {
    loadOrders();
    // refresco en vivo cada 30s (no muestra spinner, solo actualiza datos)
    const interval = setInterval(() => {
      if (user?.id) {
        sb.get("pedidos", `?usuario_id=eq.${user.id}&or=(pagado.is.null,pagado.is.true)&order=created_at.desc`)
          .then(async data => {
            const withItems = await Promise.all((data || []).map(async o => {
              try { const items = await sb.get("pedido_items", `?pedido_id=eq.${o.id}`); return { ...o, items: items || [] }; }
              catch { return { ...o, items: [] }; }
            }));
            setOrders(withItems);
          })
          .catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) return <Spinner />;

  const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const activos = orders.filter(o => o.estado < 3);
  const entregados = orders.filter(o => o.estado === 3);

  // Busca imagen de producto por id
  const prodImg = (pid) => products.find(p => p.id === pid)?.imagen_url || null;

  return (
    <div className="oft-section" style={S.section}>
      {/* CABECERA */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div style={{ width: 54, height: 54, borderRadius: "50%", background: `linear-gradient(135deg, ${RED}, ${RED_D})`, display: "flex", alignItems: "center", justifyContent: "center", color: WHITE, flexShrink: 0 }}>
          <User size={26} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Hola, {user?.nombre?.split(" ")[0] || "Cliente"} 👋</div>
          <div style={{ fontSize: 13, color: GRAY3 }}>Bienvenido a tu cuenta</div>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 32 }} className="oft-prod-anim">
        {[[Package, orders.length, "Pedidos totales", RED], [RefreshCw, activos.length, "En proceso", "#856404"], [CheckCircle2, entregados.length, "Entregados", "#155724"]].map(([Icon,num,label,color]) => (
          <div key={label} style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}` }}>
            <div style={{ background: color + "15", borderRadius: 10, padding: 8, display: "inline-flex", marginBottom: 8 }}><Icon size={22} color={color} strokeWidth={2} /></div>
            <div style={{ fontSize: 30, fontWeight: 900, color }}>{num}</div>
            <div style={{ fontSize: 13, color: GRAY3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* MIS DATOS */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}`, marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editandoPerfil ? 16 : 4 }}>
          <div style={{ fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><User size={18} color={RED} /> Mis datos</div>
          {!editandoPerfil && (
            <button onClick={abrirEdicion} className="oft-btn-press" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <PencilIcon size={14} /> Editar
            </button>
          )}
        </div>

        {!editandoPerfil ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: GRAY3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Nombre completo</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{user?.nombre || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: GRAY3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>WhatsApp / Celular</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{user?.telefono || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: GRAY3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Correo electrónico</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, wordBreak: "break-all" }}>{user?.email || "—"}</div>
              <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>El correo no se puede cambiar</div>
            </div>
          </div>
        ) : (
          <div>
            <label style={S.label}>Nombre completo</label>
            <input style={S.input} value={perfilForm.nombre} onChange={e => setPerfilForm({ ...perfilForm, nombre: e.target.value })} placeholder="Tu nombre completo" />
            <label style={S.label}>WhatsApp / Celular</label>
            <input style={S.input} value={perfilForm.telefono} onChange={e => setPerfilForm({ ...perfilForm, telefono: e.target.value })} placeholder="+507 0000-0000" />
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button onClick={guardarPerfil} disabled={guardandoPerfil} className="oft-btn-press" style={{ ...S.btnRed, justifyContent: "center", opacity: guardandoPerfil ? 0.7 : 1 }}>
                {guardandoPerfil ? "Guardando..." : "Guardar cambios"}
              </button>
              <button onClick={() => setEditandoPerfil(false)} className="oft-btn-press" style={S.btnOutline}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 0", color: GRAY3 }}>
          <Package size={56} strokeWidth={1.2} style={{ margin: "0 auto 14px" }} />
          <p style={{ fontWeight: 700, fontSize: 16, color: BLACK }}>Aún no tienes pedidos</p>
          <p style={{ fontSize: 14 }}>Explora el catálogo y haz tu primer pedido</p>
        </div>
      ) : (
        <>
          {/* SEGUIMIENTO EN VIVO (pedidos activos) */}
          {activos.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="oft-live-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                Seguimiento en vivo
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {activos.map(o => (
                  <div key={o.id} className="oft-prod-anim" style={{ background: WHITE, borderRadius: 16, padding: 22, border: `1px solid ${GRAY2}`, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 17, color: RED }}>{o.codigo}</div>
                        <div style={{ fontSize: 12, color: GRAY3 }}>{new Date(o.created_at).toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" })}</div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{money(o.total)}</div>
                    </div>

                    {/* BARRA DE PROGRESO ANIMADA */}
                    <ProgressTracker estado={o.estado} retiro={o.retiro_local} />

                    {/* INFO ENVÍO O RETIRO */}
                    {o.retiro_local ? (
                      <div style={{ marginTop: 18, fontSize: 13, color: "#856404", display: "flex", alignItems: "center", gap: 6, background: "#FFF3CD", borderRadius: 8, padding: "10px 12px", fontWeight: 700 }}>
                        <Home size={15} /> Retiro en el local
                      </div>
                    ) : o.empresa_envio_nombre && (
                      <div style={{ marginTop: 18, fontSize: 13, color: GRAY3, display: "flex", alignItems: "center", gap: 6, background: GRAY, borderRadius: 8, padding: "10px 12px" }}>
                        <Truck size={15} color={RED} /> {o.empresa_envio_nombre}{o.sucursal_nombre ? ` · ${o.sucursal_nombre}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTORIAL DE COMPRAS */}
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={20} color={RED} /> Historial de compras</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.map(o => {
              const isOpen = selected === o.id;
              return (
                <div key={o.id} className="oft-card-hover" style={{ background: WHITE, borderRadius: 14, border: `1px solid ${isOpen ? RED : GRAY2}`, overflow: "hidden", transition: "border-color 0.2s" }}>
                  {/* CABECERA CLICKEABLE */}
                  <div onClick={() => setSelected(isOpen ? null : o.id)} style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                    {/* miniaturas de productos */}
                    <div style={{ display: "flex", flexShrink: 0 }}>
                      {(o.items || []).slice(0, 3).map((item, i) => {
                        const img = prodImg(item.producto_id);
                        return (
                          <div key={i} style={{ width: 44, height: 44, borderRadius: 10, background: GRAY, border: `2px solid ${WHITE}`, marginLeft: i > 0 ? -12 : 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
                            {img ? <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package size={18} color={GRAY3} />}
                          </div>
                        );
                      })}
                      {(o.items || []).length > 3 && (
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: BLACK, color: WHITE, border: `2px solid ${WHITE}`, marginLeft: -12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                          +{(o.items).length - 3}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: RED }}>{o.codigo}</div>
                      <div style={{ fontSize: 12, color: GRAY3 }}>{new Date(o.created_at).toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" })} · {(o.items || []).length} producto(s)</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>{money(o.total)}</div>
                      <div style={{ marginTop: 4 }}><StatusBadge index={o.estado} retiro={o.retiro_local} /></div>
                    </div>
                    <div style={{ flexShrink: 0 }}>{isOpen ? <ChevronUp size={18} color={GRAY3} /> : <ChevronDown size={18} color={GRAY3} />}</div>
                  </div>

                  {/* DETALLE EXPANDIBLE */}
                  {isOpen && (
                    <div className="oft-detail-open" style={{ borderTop: `1px solid ${GRAY2}`, padding: 16, background: "#FAFAFA" }}>
                      {/* progreso */}
                      <ProgressTracker estado={o.estado} compact retiro={o.retiro_local} />

                      {/* productos con imagen */}
                      <div style={{ fontWeight: 700, fontSize: 14, margin: "18px 0 10px" }}>Productos</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {(o.items || []).map((item, i) => {
                          const img = prodImg(item.producto_id);
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: WHITE, borderRadius: 10, padding: 10, border: `1px solid ${GRAY2}` }}>
                              <div style={{ width: 48, height: 48, borderRadius: 8, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                                {img ? <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package size={20} color={GRAY3} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.nombre_producto}</div>
                                <div style={{ fontSize: 12, color: GRAY3 }}>Cantidad: {item.cantidad}</div>
                              </div>
                              <div style={{ fontWeight: 800, fontSize: 14, color: RED }}>{money(item.subtotal)}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* resumen */}
                      <div style={{ marginTop: 16, background: WHITE, borderRadius: 10, padding: 14, border: `1px solid ${GRAY2}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                          <span style={{ color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={14} /> Fecha</span>
                          <span style={{ fontWeight: 600 }}>{new Date(o.created_at).toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" })}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                          <span style={{ color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={14} /> Estado</span>
                          <StatusBadge index={o.estado} retiro={o.retiro_local} />
                        </div>
                        {o.retiro_local ? (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                            <span style={{ color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><Home size={14} /> Entrega</span>
                            <span style={{ fontWeight: 700, color: "#856404" }}>Retiro en el local</span>
                          </div>
                        ) : o.empresa_envio_nombre && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                            <span style={{ color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><Truck size={14} /> Envío</span>
                            <span style={{ fontWeight: 600, textAlign: "right" }}>{o.empresa_envio_nombre}{o.sucursal_nombre ? <><br /><span style={{ fontSize: 11, color: GRAY3 }}>{o.sucursal_nombre}</span></> : ""}</span>
                          </div>
                        )}
                        {o.direccion && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                            <span style={{ color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> Dirección</span>
                            <span style={{ fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{o.direccion}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900, borderTop: `1px solid ${GRAY2}`, marginTop: 10, paddingTop: 10 }}>
                          <span>Total</span><span style={{ color: RED }}>{money(o.total)}</span>
                        </div>
                      </div>

                      {/* botón repetir / consultar */}
                      <button style={{ ...S.btnWA, width: "100%", justifyContent: "center", marginTop: 14, padding: 12 }}
                        onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola Ofertodo, quiero consultar sobre mi pedido ${o.codigo}`)}`, "_blank")}>
                        <MessageCircle size={16} /> Consultar este pedido
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── BARRA DE PROGRESO DEL PEDIDO ───────────────────────────────
function ProgressTracker({ estado, compact, retiro = false }) {
  const etiquetas = retiro ? ORDER_STATUS_RETIRO : ORDER_STATUS_ENVIO;
  const iconos = retiro ? STATUS_ICONS_RETIRO : STATUS_ICONS_ENVIO;
  const pct = (estado / (etiquetas.length - 1)) * 100;
  return (
    <div>
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginTop: compact ? 8 : 4 }}>
        {/* línea base */}
        <div style={{ position: "absolute", top: 18, left: 18, right: 18, height: 4, background: GRAY2, borderRadius: 2, zIndex: 0 }} />
        {/* línea de progreso animada */}
        <div className="oft-progress-fill" style={{ position: "absolute", top: 18, left: 18, height: 4, background: `linear-gradient(90deg, ${RED}, ${RED_D})`, borderRadius: 2, zIndex: 1, width: `calc((100% - 36px) * ${pct / 100})` }} />
        {/* pasos */}
        {etiquetas.map((s, i) => {
          const SIcon = iconos[i];
          const done = i <= estado;
          const current = i === estado;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, flex: 1, position: "relative" }}>
              <div className={current ? "oft-step-pulse" : ""} style={{
                width: 36, height: 36, borderRadius: "50%",
                background: done ? `linear-gradient(135deg, ${RED}, ${RED_D})` : WHITE,
                border: done ? "none" : `2px solid ${GRAY2}`,
                color: done ? WHITE : GRAY3,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.4s ease",
                boxShadow: current ? `0 0 0 4px ${RED}25` : "none",
              }}>
                <SIcon size={17} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 9.5, fontWeight: done ? 700 : 500, color: done ? BLACK : GRAY3, marginTop: 6, textAlign: "center", lineHeight: 1.2, maxWidth: 70 }}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CREAR PEDIDO MANUAL (ADMIN)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  FACTURA (genera PDF + PNG)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  GUÍA DE ENVÍO INTERNA (para empaque y despacho — NO para el cliente)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  AGREGAR CHIPS UNO POR UNO (tallas / colores)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  EDITOR DE DISTRIBUCIÓN POR DOCENA (admin — talla o color)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  CREAR / EDITAR CLIENTE (reutilizable — desde la sección Clientes
//  o directo desde el formulario de Nuevo Pedido/Cotización)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  APP ROOT — Estado global + carga de datos
// ═══════════════════════════════════════════════════════════════
export default function App() {
  // Vista persiste en localStorage para que el refresh no regrese al inicio
  const [view, setViewRaw] = useState(() => {
    try {
      const v = localStorage.getItem("oft_view");
      // Solo las vistas "seguras" para persistir (no modales intermedios)
      const permitidas = ["home", "catalog", "dashboard", "admin", "checkout"];
      return (v && permitidas.includes(v)) ? v : "home";
    } catch(e) { return "home"; }
  });
  const setView = (v) => {
    setViewRaw(v);
    try { localStorage.setItem("oft_view", v); } catch(e) {}
    // Siempre empieza arriba de la página nueva, sin importar qué tan abajo
    // estaba desplazado en la página anterior (ej. al elegir una categoría desde el inicio)
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // El carrito se guarda en el navegador para que NO se pierda al iniciar sesión o recargar
  const [cart, setCart] = useState(() => {
    try { const g = localStorage.getItem("oft_cart"); return g ? JSON.parse(g) : []; } catch(e) { return []; }
  });

  // Usuario persiste en localStorage para no perder la sesión al hacer refresh
  const [user, setUserRaw] = useState(() => {
    try {
      const u = localStorage.getItem("oft_user");
      if (!u) return null;
      const parsed = JSON.parse(u);
      // Si el token venció Y no hay refresh_token para renovarlo solo, se cierra la sesión.
      // Si sí hay refresh_token, se deja pasar: sb lo va a renovar solo en la próxima petición.
      if (parsed?.expires_at && Date.now() / 1000 > parsed.expires_at && !parsed?.refresh_token) {
        localStorage.removeItem("oft_user");
        localStorage.removeItem("oft_view");
        return null;
      }
      // Activa la sesión en el cliente sb para que las peticiones salgan autenticadas desde ya
      sb.setSession({ access_token: parsed?.token, refresh_token: parsed?.refresh_token, expires_at: parsed?.expires_at });
      return parsed;
    } catch(e) { return null; }
  });
  const setUser = (u) => {
    setUserRaw(u);
    if (u) sb.setSession({ access_token: u.token, refresh_token: u.refresh_token, expires_at: u.expires_at });
    else sb.clearSession();
    try {
      if (u) localStorage.setItem("oft_user", JSON.stringify(u));
      else { localStorage.removeItem("oft_user"); localStorage.removeItem("oft_view"); }
    } catch(e) {}
  };

  // AUTO SIGN OUT por inactividad (30 minutos sin tocar nada)
  const INACTIVIDAD_MS = 30 * 60 * 1000; // 30 minutos
  const ultimaActividad = useRef(Date.now());
  const [toastMsg, setToastMsg] = useState("");
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000); };

  useEffect(() => {
    if (!user) return; // Solo aplica si hay sesión
    const actualizar = () => { ultimaActividad.current = Date.now(); };
    const eventos = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    eventos.forEach(e => window.addEventListener(e, actualizar, { passive: true }));
    const intervalo = setInterval(() => {
      if (Date.now() - ultimaActividad.current > INACTIVIDAD_MS) {
        setUser(null);
        setView("home");
        showToast("Sesión cerrada por inactividad");
      }
    }, 60 * 1000); // revisa cada minuto
    return () => {
      eventos.forEach(e => window.removeEventListener(e, actualizar));
      clearInterval(intervalo);
    };
  }, [user]);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [quickView, setQuickView] = useState(null); // producto a mostrar en detalle
  const [pagoResultado, setPagoResultado] = useState(null); // resultado de un pago con tarjeta al volver de Powertranz
  const [catalogCat, setCatalogCat] = useState(0); // categoría a abrir en el catálogo (0 = todas)
  const [completeProfile, setCompleteProfile] = useState(null); // usuario de Google que debe completar sus datos
  const [googleMfaPaso, setGoogleMfaPaso] = useState(null); // pide el código 2FA cuando el login fue con Google
  const [pendingCheckout, setPendingCheckout] = useState(false); // el cliente quería pagar y tuvo que loguearse
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [gruposCategorias, setGruposCategorias] = useState([]); // grupos generales (ej. "Ropa de Dama"), cada uno con su propio ícono
  const [banners, setBanners] = useState([]); // banners promocionales del carrusel del inicio
  const [empresas, setEmpresas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [localesRetiro, setLocalesRetiro] = useState([]); // locales propios donde se puede retirar
  const [retiroLocalHabilitado, setRetiroLocalHabilitado] = useState(true); // si el cliente ve la opción en el checkout
  const [loading, setLoading] = useState(true);

  // Guarda el carrito en el navegador cada vez que cambia
  useEffect(() => {
    try { localStorage.setItem("oft_cart", JSON.stringify(cart)); } catch(e) {}
  }, [cart]);

  // Cuando el cliente inicia sesión teniendo un checkout pendiente, lo lleva directo a finalizar
  useEffect(() => {
    if (user && pendingCheckout) {
      setPendingCheckout(false);
      setShowLogin(false);
      setShowRegister(false);
      if (cart.length > 0) { setView("checkout"); showToast("¡Sesión iniciada! Continúa tu pedido"); }
    }
  }, [user, pendingCheckout]);

  const [cartPulse, setCartPulse] = useState(0);
  const addToCart = (product, qty, pres = "pieza", count = qty) => {
    setCart(prev => {
      // mismo producto Y misma presentación = se suman; si no, entrada nueva
      const existing = prev.find(i => i.product.id === product.id && i.pres === pres);
      if (existing) return prev.map(i => (i.product.id === product.id && i.pres === pres) ? { ...i, qty: i.qty + qty, count: (i.count || 0) + count } : i);
      return [...prev, { product, qty, pres, count }];
    });
    setCartPulse(p => p + 1); // dispara animación del carrito
  };

  // Cargar datos de Supabase al iniciar
  useEffect(() => {
    // Si volvemos de iniciar sesión con Google, la URL trae el token
    const procesarRetornoGoogle = async () => {
      const hash = window.location.hash || "";
      const query = window.location.search || "";
      let token = null, refreshToken = null, expiresIn = null;

      // ¿Hubo un error devuelto por Google/Supabase?
      if (hash.includes("error") || query.includes("error=")) {
        const params = new URLSearchParams((hash || query).replace(/^[#?]/, ""));
        const desc = params.get("error_description") || params.get("error") || "Error desconocido";
        alert("Google devolvió un error: " + decodeURIComponent(desc));
        window.history.replaceState(null, "", window.location.origin + window.location.pathname);
        return;
      }

      // Formato 1 (implicit): #access_token=...
      if (hash.includes("access_token")) {
        const hashParams = new URLSearchParams(hash.substring(1));
        token = hashParams.get("access_token");
        refreshToken = hashParams.get("refresh_token");
        expiresIn = hashParams.get("expires_in");
      }
      // Formato 2 (PKCE): ?code=...
      else if (query.includes("code=")) {
        const code = new URLSearchParams(query).get("code");
        const verifier = localStorage.getItem("oft_pkce_verifier");
        if (code) {
          try {
            const body = { auth_code: code };
            if (verifier) body.code_verifier = verifier;
            const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
              method: "POST",
              headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await r.json();
            token = data.access_token || null;
            refreshToken = data.refresh_token || null;
            expiresIn = data.expires_in || null;
            if (!token) alert("No se pudo completar el inicio con Google (código). Detalle: " + (data.error_description || data.msg || JSON.stringify(data)).toString().slice(0, 200));
          } catch(e) { alert("Error de conexión al validar Google: " + e.message); }
        }
      }

      if (token) {
        // Activa la sesión YA, antes de buscar el perfil, para que esa consulta salga autenticada
        sb.setSession({ access_token: token, refresh_token: refreshToken, expires_in: expiresIn });
        try {
          const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` } });
          const gUser = await r.json();
          window.history.replaceState(null, "", window.location.origin + window.location.pathname);
          if (gUser && gUser.email) {
            const nombre = gUser.user_metadata?.full_name || gUser.user_metadata?.name || gUser.email.split("@")[0];
            let perfil = [];
            try { perfil = await sb.get("usuarios", `?email=eq.${encodeURIComponent(gUser.email)}&limit=1`); } catch(e) {}
            if (perfil && perfil.length > 0) {
              let factorVerificado = null;
              try {
                const factores = await sb.mfaListFactors();
                factorVerificado = factores.find(f => f.status === "verified") || null;
              } catch(e) {}
              if (factorVerificado) {
                // Esta cuenta tiene 2FA activado: pide el código antes de terminar de entrar
                setGoogleMfaPaso({ factorId: factorVerificado.id, gUser, perfil, token, refresh_token: refreshToken, expires_at: sb.session?.expires_at });
              } else {
                setUser({ ...gUser, ...perfil[0], token, refresh_token: refreshToken, expires_at: sb.session?.expires_at });
                showToast(`¡Bienvenido de vuelta, ${perfil[0].nombre?.split(" ")[0] || ""}!`);
              }
            } else {
              setCompleteProfile({ email: gUser.email, nombre, token, refresh_token: refreshToken, expires_at: sb.session?.expires_at, gUser });
            }
          } else {
            alert("Google no devolvió un correo válido. Intenta de nuevo.");
          }
        } catch(e) { alert("Error obteniendo tu perfil de Google: " + e.message); }
      }
    };
    procesarRetornoGoogle();

    const init = async () => {
      try {
        const [cats, prods] = await Promise.all([
          sb.get("categorias", "?activa=eq.true&order=id"),
          sb.get("productos", "?activo=eq.true&order=id"),
        ]);
        setCategories(cats);
        setProducts(prods);

        // Link directo a un producto — reconoce tanto el formato nuevo y limpio
        // (/producto/ID, el que ahora genera el botón de Compartir) como el formato
        // viejo (?producto=ID, por si alguien todavía tiene guardado un link de esos).
        // Al abrirlo, se muestra ese producto directo.
        const coincideRutaLimpia = window.location.pathname.match(/^\/producto\/(\d+)/);
        const idProductoLink = coincideRutaLimpia ? coincideRutaLimpia[1] : new URLSearchParams(window.location.search).get("producto");
        if (idProductoLink) {
          const prodEncontrado = prods.find(p => String(p.id) === idProductoLink);
          if (prodEncontrado) {
            setQuickView(prodEncontrado);
          } else {
            showToast("Ese producto ya no está disponible");
          }
          // Limpia la URL para que no se quede pegada al navegar (vuelve a la portada)
          window.history.replaceState(null, "", window.location.origin + "/");
        }

        // Resultado de un pago con tarjeta (Powertranz redirige aquí tras el 3D-Secure)
        const paramsPago = new URLSearchParams(window.location.search);
        const resultadoPago = paramsPago.get("pago");
        if (resultadoPago) {
          const codigoPago = paramsPago.get("codigo");
          if (resultadoPago === "exito" && codigoPago) {
            // Trae los datos reales del pedido para mostrar una pantalla de confirmación completa
            try {
              const pedidosEncontrados = await sb.get("pedidos", `?codigo=eq.${encodeURIComponent(codigoPago)}&limit=1`);
              const pedido = pedidosEncontrados?.[0] || null;
              if (pedido) {
                const items = await sb.get("pedido_items", `?pedido_id=eq.${pedido.id}`).catch(() => []);
                setPagoResultado({ tipo: "exito", codigo: codigoPago, pedido: { ...pedido, items: items || [] } });
              } else {
                setPagoResultado({ tipo: "exito", codigo: codigoPago, pedido: null });
              }
            } catch (e) {
              setPagoResultado({ tipo: "exito", codigo: codigoPago, pedido: null });
            }
            setView("pago-resultado");
          } else if (resultadoPago === "rechazado") {
            setPagoResultado({ tipo: "rechazado", codigo: codigoPago });
            setView("pago-resultado");
          } else {
            setPagoResultado({ tipo: "error", codigo: codigoPago });
            setView("pago-resultado");
          }
          window.history.replaceState(null, "", window.location.origin + window.location.pathname);
        }
        // Empresas de envío y sucursales (no críticas, si fallan se ignoran)
        try {
          const [emps, sucs] = await Promise.all([
            sb.get("empresas_envio", "?order=id"),
            sb.get("sucursales", "?order=id"),
          ]);
          setEmpresas(emps);
          setSucursales(sucs);
        } catch(e2) { console.warn("Empresas de envío no cargadas:", e2.message); }
        // Retiro en el local: locales disponibles + si está habilitado para clientes
        try {
          const [locales, config] = await Promise.all([
            sb.get("locales_retiro", "?activo=eq.true&order=id"),
            sb.get("configuracion", "?clave=eq.retiro_local_habilitado&limit=1"),
          ]);
          setLocalesRetiro(locales || []);
          if (config && config[0]) setRetiroLocalHabilitado(config[0].valor === true || config[0].valor === "true");
        } catch(e3) { console.warn("Config de retiro en local no cargada:", e3.message); }
        // Grupos de categorías (no crítico, si falla se ignora — los grupos simplemente no muestran ícono propio)
        try {
          const grupos = await sb.get("grupos_categorias", "?order=orden.asc,nombre.asc");
          setGruposCategorias(grupos || []);
        } catch(e4) { console.warn("Grupos de categorías no cargados:", e4.message); }
        // Banners promocionales del carrusel del inicio (no crítico, si falla el inicio se ve sin carrusel)
        // Trae TODOS (activos e inactivos) -- el carrusel del cliente ya filtra solo los activos,
        // y así el admin puede ver/reactivar los que estén apagados.
        try {
          const bannersData = await sb.get("banners_promocionales", "?order=orden.asc");
          setBanners(bannersData || []);
        } catch(e5) { console.warn("Banners promocionales no cargados:", e5.message); }
      } catch(e) {
        console.warn("⚠️ Supabase no configurado. Usando datos demo.", e.message);
        // DATOS DEMO cuando Supabase no está configurado
        setCategories([
          { id: 1, nombre: "Jeans Hombre", icono: "👖", activa: true },
          { id: 2, nombre: "Jeans Dama", icono: "👗", activa: true },
          { id: 3, nombre: "Polo / Camisas", icono: "👕", activa: true },
          { id: 4, nombre: "Calzado Dama", icono: "👠", activa: true },
          { id: 5, nombre: "Calzado Hombre", icono: "👟", activa: true },
          { id: 6, nombre: "Accesorios", icono: "🧢", activa: true },
        ]);
        setProducts([
          { id: 1, referencia: "JT-001", nombre: "Jean Tumi Hombre", categoria_id: 1, descripcion: "Jean recto denim premium, cómodo y duradero.", precio_pieza: 7, precio_media_docena: 36, precio_docena: 84, activo: true, imagen_url: null, badge: "TOP" },
          { id: 2, referencia: "JP-002", nombre: "Jean Pitbull Negro", categoria_id: 1, descripcion: "Stretch straight cut, ideal para reventa.", precio_pieza: 4, precio_media_docena: 21, precio_docena: 48, activo: true, imagen_url: null, badge: "" },
          { id: 3, referencia: "JB-003", nombre: "Jean Britney Dama", categoria_id: 2, descripcion: "Skinny stretch, varios lavados disponibles.", precio_pieza: 8, precio_media_docena: 42, precio_docena: 96, activo: true, imagen_url: null, badge: "NUEVO" },
          { id: 4, referencia: "PP-004", nombre: "Polo Piqué Hombre", categoria_id: 3, descripcion: "Polo clásico, varios colores, alta calidad.", precio_pieza: 7, precio_media_docena: 36, precio_docena: 84, activo: true, imagen_url: null, badge: "" },
          { id: 5, referencia: "SD-005", nombre: "Sandalia Dama", categoria_id: 4, descripcion: "Varios modelos y colores, moda actual.", precio_pieza: 6.5, precio_media_docena: 33, precio_docena: 78, activo: true, imagen_url: null, badge: "OFERTA" },
          { id: 6, referencia: "CH-006", nombre: "Chancla HPC Polo Club", categoria_id: 4, descripcion: "Marca reconocida, calidad premium.", precio_pieza: 9.17, precio_media_docena: 48, precio_docena: 110, activo: true, imagen_url: null, badge: "MARCA" },
        ]);
      }
      setLoading(false);
    };
    init();
  }, []);

  const isAdmin = view === "admin";
  const ctx = { view, setView, cart, setCart, addToCart, cartPulse, user, setUser, showLogin, setShowLogin, showRegister, setShowRegister, showCart, setShowCart, quickView, setQuickView, pagoResultado, setPagoResultado, catalogCat, setCatalogCat, completeProfile, setCompleteProfile, googleMfaPaso, setGoogleMfaPaso, pendingCheckout, setPendingCheckout, products, setProducts, categories, setCategories, gruposCategorias, setGruposCategorias, banners, setBanners, empresas, setEmpresas, sucursales, setSucursales, localesRetiro, setLocalesRetiro, retiroLocalHabilitado, setRetiroLocalHabilitado, loading, showToast };

  return (
    <AppCtx.Provider value={ctx}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; overflow-x: hidden; max-width: 100%; font-family: Helvetica, Arial, sans-serif; }
        input, button, textarea, select { font-family: inherit; }
        img { max-width: 100%; }
        /* La tabla nunca desborda: scroll horizontal dentro de su marco (web y celular) */
        .oft-table-wrap { max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .oft-admin-main { max-width: 100%; }
        /* Mostrar/ocultar según dispositivo */
        .oft-only-mobile { display: none; }
        /* Bloques de presentación: tamaño base (escritorio) */
        .oft-pres-label { font-size: 11px; }
        .oft-pres-price { font-size: 13px; }
        .oft-pres-big .oft-pres-label { font-size: 13px; }
        .oft-pres-big .oft-pres-price { font-size: 16px; }
        .oft-only-desktop { display: block; }
        @media (max-width: 768px) {
          .oft-only-mobile { display: flex; }
          .oft-only-desktop { display: none !important; }
        }
        /* Evita el zoom automático del celular al tocar campos (iOS hace zoom si la fuente es <16px) */
        @media (max-width: 768px) {
          input, select, textarea { font-size: 16px !important; }
        }

        /* ── ANIMACIONES ── */
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.92); } 60% { opacity: 1; transform: scale(1.02); } 100% { transform: scale(1); } }
        @keyframes cartBounce { 0%,100% { transform: scale(1); } 30% { transform: scale(1.35); } 60% { transform: scale(0.9); } }
        @keyframes flyToCart { 0% { opacity: 1; transform: scale(1) translate(0,0); } 100% { opacity: 0; transform: scale(0.3) translate(var(--fly-x), var(--fly-y)); } }
        @keyframes checkPop { 0% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1.15); } 100% { opacity: 0; transform: scale(1); } }
        @keyframes badgePulse { 0% { box-shadow: 0 0 0 0 rgba(227,30,36,0.5); } 100% { box-shadow: 0 0 0 10px rgba(227,30,36,0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .oft-toast-in { animation: toastIn 0.3s ease both; }
        @keyframes qvPop { 0% { opacity: 0; transform: scale(0.88); } 100% { opacity: 1; transform: scale(1); } }
        .oft-qv-pop { animation: qvPop 0.28s cubic-bezier(0.34,1.4,0.5,1) both; }
        @keyframes sheetSlideUp { 0% { opacity: 0; transform: translateY(40px); } 100% { opacity: 1; transform: translateY(0); } }
        .oft-sheet-slide { animation: sheetSlideUp 0.32s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes catChipPop { 0% { opacity: 0; transform: scale(0.85) translateY(6px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .oft-cat-sheet-chip { animation: catChipPop 0.26s cubic-bezier(0.34,1.4,0.5,1) both; transition: border-color 0.15s, background 0.15s; }
        .oft-cat-trigger { transition: border-color 0.15s, box-shadow 0.15s; }
        .oft-cat-trigger:hover { border-color: ${RED}; box-shadow: 0 2px 10px rgba(227,30,36,0.12); }
        @keyframes groupCardIn { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
        .oft-group-card {
          position: relative; background: ${WHITE}; border: 1.5px solid ${GRAY2}; border-radius: 16px; padding: 18px 16px;
          cursor: pointer; animation: groupCardIn 0.45s cubic-bezier(0.16,1,0.3,1) both;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .oft-group-card:hover { border-color: ${RED}; box-shadow: 0 8px 20px rgba(227,30,36,0.12); transform: translateY(-2px); }
        .oft-group-card-icon {
          width: 44px; height: 44px; border-radius: 12px; background: ${GRAY};
          display: flex; align-items: center; justify-content: center; transition: background 0.2s ease;
        }
        .oft-group-card:hover .oft-group-card-icon { background: #FFF0EF; }
        .oft-group-card-chevron { position: absolute; top: 16px; right: 14px; }
        .oft-banner-thumb:hover .oft-banner-hover-overlay { opacity: 1 !important; }
        @keyframes overlayFade { from { opacity: 0; } to { opacity: 1; } }
        .oft-overlay { animation: overlayFade 0.22s ease both; }
        @keyframes authPop { 0% { opacity: 0; transform: translateY(18px) scale(0.94); } 60% { opacity: 1; transform: translateY(0) scale(1.015); } 100% { transform: translateY(0) scale(1); } }
        .oft-auth-pop { animation: authPop 0.4s cubic-bezier(0.34,1.45,0.5,1) both; }
        @keyframes qtyBump { 0% { transform: scale(1); } 40% { transform: scale(1.3); color: ${RED}; } 100% { transform: scale(1); } }
        .oft-qty-bump { animation: qtyBump 0.28s ease; }
        @keyframes chipPop { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }
        .oft-chip-pop { animation: chipPop 0.22s cubic-bezier(0.34,1.5,0.5,1) both; }
        @keyframes totalPop { 0% { transform: scale(1); } 35% { transform: scale(1.18); } 100% { transform: scale(1); } }
        .oft-total-pop { display: inline-block; animation: totalPop 0.3s ease; }
        @keyframes calPop { 0% { opacity: 0; transform: translateY(-8px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .oft-cal-pop { animation: calPop 0.22s cubic-bezier(0.34,1.4,0.5,1) both; }
        @keyframes widgetIn { 0% { opacity: 0; transform: translateY(14px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .oft-widget { animation: widgetIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .oft-widget:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.10); }
        @keyframes heroFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .oft-infobar > div { animation: heroFadeUp 0.5s ease both; }

        /* ── CARRUSEL DE PROMOCIONES ── */
        .oft-carousel { position: relative; width: 100%; aspect-ratio: 21 / 9; overflow: hidden; background: ${BLACK}; }
        @media (max-width: 640px) { .oft-carousel { aspect-ratio: 4 / 3; } }
        .oft-carousel-track { display: flex; height: 100%; transition: transform 0.55s cubic-bezier(0.65,0,0.35,1); touch-action: pan-y; }
        .oft-carousel-slide { flex: 0 0 100%; height: 100%; position: relative; cursor: pointer; }
        .oft-carousel-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .oft-carousel-caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 28px 28px 22px; background: linear-gradient(0deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%); color: ${WHITE}; pointer-events: none; }
        .oft-carousel-title { font-size: 22px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.2px; }
        .oft-carousel-subtitle { font-size: 13px; color: rgba(255,255,255,0.82); }
        .oft-carousel-dots { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; }
        .oft-carousel-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.4); border: none; cursor: pointer; padding: 0; transition: all 0.25s ease; }
        .oft-carousel-dot.active { width: 20px; border-radius: 3px; background: ${WHITE}; }

        /* ── BARRA DE MARCA + BOTONES (debajo del carrusel) ── */
        .oft-cta-bar { background: ${BLACK}; color: ${WHITE}; padding: 30px 24px 34px; text-align: center; position: relative; overflow: hidden; }
        .oft-cta-bar::before { content: ""; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 220px; height: 1px; background: linear-gradient(90deg, transparent, ${RED}, transparent); }
        .oft-cta-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: ${RED}; margin-bottom: 10px; }
        .oft-cta-title { font-size: 22px; font-weight: 800; letter-spacing: -0.3px; margin-bottom: 22px; }
        .oft-cta-title span { color: ${RED}; }
        .oft-cta-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .oft-cta-btn-primary { background: ${RED}; color: ${WHITE}; border: none; padding: 13px 30px; border-radius: 100px; font-weight: 700; font-size: 14px; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; font-family: inherit; }
        .oft-cta-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(227,30,36,0.35); }
        .oft-cta-btn-ghost { background: transparent; color: ${WHITE}; border: 1.5px solid rgba(255,255,255,0.25); padding: 12px 26px; border-radius: 100px; font-weight: 700; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: border-color 0.15s ease, background 0.15s ease; font-family: inherit; }
        .oft-cta-btn-ghost:hover { border-color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.06); }

        @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .oft-bar-grow { transform-origin: bottom; animation: barGrow 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes lineDraw { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }
        .oft-line-draw { stroke-dasharray: 1000; animation: lineDraw 1.4s ease forwards; }
        @keyframes rowIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .oft-row-in { animation: rowIn 0.45s ease both; }
        .oft-cal-day { transition: background 0.15s ease, transform 0.1s ease; }
        .oft-cal-day:hover { background: #FFE5E6 !important; }
        .oft-cal-day:active { transform: scale(0.88); }
        .oft-color-chip { transition: transform 0.15s ease, border-color 0.15s ease; }
        .oft-color-chip:active { transform: scale(0.92) !important; }
        .oft-qty-btn { transition: transform 0.12s ease, box-shadow 0.15s ease; }
        .oft-qty-btn:active { transform: scale(0.88); }
        .oft-qty-chip:active { transform: scale(0.93); }
        @keyframes liveDot { 0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.5); } 50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
        .oft-live-dot { animation: liveDot 1.5s ease-in-out infinite; }
        @keyframes stepPulse { 0%,100% { box-shadow: 0 0 0 4px rgba(227,30,36,0.18); } 50% { box-shadow: 0 0 0 8px rgba(227,30,36,0.05); } }
        .oft-step-pulse { animation: stepPulse 1.6s ease-in-out infinite; }
        @keyframes progressGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .oft-progress-fill { transform-origin: left; animation: progressGrow 0.8s ease both; }
        @keyframes detailOpen { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 2000px; } }
        .oft-detail-open { animation: detailOpen 0.4s ease both; overflow: hidden; }
        @keyframes tabAnim { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        .oft-tab-anim { animation: tabAnim 0.35s cubic-bezier(0.22,1,0.36,1) both; }

        .oft-prod-anim { animation: fadeInUp 0.45s ease both; }
        .oft-cart-bounce { animation: cartBounce 0.5s ease; }
        .oft-fly { position: fixed; z-index: 9999; pointer-events: none; animation: flyToCart 0.7s cubic-bezier(0.5,-0.3,0.7,1) forwards; }
        .oft-check-pop { animation: checkPop 0.9s ease forwards; }
        .oft-btn-press:active { transform: scale(0.94); }
        .oft-card-hover { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .oft-card-hover:hover { transform: translateY(-4px); box-shadow: 0 10px 28px rgba(0,0,0,0.12); }
        .oft-cat-chip { transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease; }
        .oft-cat-chip:active { transform: scale(0.95); }

        @media (max-width: 768px) {
          .oft-nav { padding: 0 14px !important; }
          .oft-nav-links { gap: 14px !important; font-size: 13px !important; }
          .oft-hero-title { font-size: 30px !important; }
          .oft-hero { padding: 40px 18px 48px !important; }
          .oft-infobar-item { border-right: none !important; border-bottom: 1px solid #E0E0E0; padding: 12px 16px !important; }
          .oft-section { padding: 28px 16px !important; }
          .oft-infobar { gap: 14px !important; font-size: 11px !important; padding: 10px 14px !important; }
          .oft-admin-main { margin-left: 0 !important; padding: 18px 14px 80px !important; }
          .oft-admin-sidebar { position: fixed !important; bottom: 0 !important; top: auto !important; left: 0 !important; right: 0 !important; width: 100% !important; min-height: auto !important; height: 62px !important; flex-direction: row !important; padding: 0 !important; z-index: 200 !important; border-right: none !important; border-top: 1px solid ${GRAY2} !important; box-shadow: 0 -2px 12px rgba(0,0,0,0.06); }
          .oft-admin-brand { display: none !important; }
          .oft-admin-tabs { display: flex !important; flex-direction: row !important; padding: 6px 4px !important; margin: 0 !important; width: 100%; justify-content: space-between; overflow-x: auto; gap: 2px; }
          .oft-admin-tab { flex-direction: column !important; gap: 3px !important; padding: 6px 8px !important; margin-bottom: 0 !important; font-size: 9.5px !important; border-radius: 10px !important; text-align: center; justify-content: center; flex: 0 0 auto; min-width: 56px; white-space: nowrap; }
          .oft-admin-tab.active { background: ${RED} !important; }
          .oft-admin-bottom-btns { display: flex !important; flex-direction: row !important; border-top: none !important; margin-top: 0 !important; padding: 6px 4px !important; }
          .oft-admin-divider { display: none !important; }
          .oft-dash-grid-2 { grid-template-columns: 1fr !important; }
          .oft-btn-text-hide { display: none !important; }
          /* Admin: tablas con scroll horizontal y formularios apilados */
          .oft-admin-main table { min-width: 540px; }
          .oft-table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch; border-radius: 12px; }
          .oft-form-grid { grid-template-columns: 1fr !important; }
          .oft-admin-head { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .oft-admin-head > div:last-child { display: flex; gap: 8px; flex-wrap: wrap; }
          .oft-admin-head button { flex: 1; justify-content: center; }
          .oft-modal { padding: 22px 18px !important; max-width: 100% !important; border-radius: 16px !important; }
          .oft-prod-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; width: 100% !important; }
          .oft-prod-grid > * { min-width: 0 !important; }
          .oft-prod-grid > * > div { min-width: 0 !important; }
          .oft-cat-grid { grid-template-columns: repeat(3, 1fr) !important; }
          table { font-size: 12px !important; }
          .oft-overlay { align-items: flex-end !important; padding: 0 !important; }
          .oft-modal-sheet { border-radius: 18px 18px 0 0 !important; max-width: 100% !important; max-height: 92vh !important; }
          /* Modales de documentos (factura, guía, editar cotización): centrados arriba, NO hoja inferior */
          .oft-overlay-doc { align-items: flex-start !important; padding: 12px !important; overflow-y: auto !important; }
          .oft-overlay-doc > div { margin: auto !important; width: 96% !important; max-width: 96% !important; }
          /* PRECIOS más legibles en celular */
          .oft-prod-body { padding: 12px !important; }
          .oft-price-table { padding: 10px 10px !important; }
          .oft-price-row { font-size: 12px !important; padding: 4px 0 !important; gap: 6px !important; line-height: 1.25 !important; }
          .oft-price-label { font-size: 12px !important; }
          .oft-price-big { font-size: 14px !important; }
          .oft-qty-row { flex-wrap: wrap !important; gap: 6px !important; }
          /* Bloques de presentación: mismo tamaño de número y misma altura */
          .oft-pres-chip { padding: 9px 1px !important; }
          .oft-pres-label { font-size: 10px !important; }
          .oft-pres-price { font-size: 11px !important; letter-spacing: -0.3px !important; }
          .oft-pres-grid { gap: 4px !important; }
          /* En el modal (vista detalle) hay más espacio: números más grandes */
          .oft-pres-big .oft-pres-label { font-size: 12px !important; }
          .oft-pres-big .oft-pres-price { font-size: 15px !important; letter-spacing: 0 !important; }
        }
        @media (max-width: 380px) {
          /* En pantallas muy chicas, baja un poco pero TODOS por igual */
          .oft-pres-price { font-size: 10px !important; }
          .oft-pres-label { font-size: 9px !important; }
        }
        @media (max-width: 420px) {
          .oft-cat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .oft-prod-grid { gap: 8px !important; }
          .oft-prod-body { padding: 10px !important; }
          .oft-price-row { font-size: 11px !important; }
          .oft-price-label { font-size: 11px !important; }
        }
      `}</style>
      <div style={S.app}>
        {!isAdmin && <NavBar />}
        {view === "home" && <HomeView />}
        {view === "catalogo" && <CatalogoView />}
        {(view === "terminos" || view === "devoluciones" || view === "privacidad") && <LegalPageView />}
        {view === "checkout" && <CheckoutView />}
        {view === "pago-resultado" && <PagoResultadoView />}
        {view === "dashboard" && user && <DashboardView />}
        {view === "admin" && user?.es_admin && (
          <Suspense fallback={
            <div style={{ ...S.section, textAlign: "center", padding: "80px 24px" }}>
              <RefreshCw size={32} color={GRAY3} className="spin" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: GRAY3 }}>Cargando panel de administrador...</p>
            </div>
          }>
            <AdminView />
          </Suspense>
        )}
        {view === "admin" && !user?.es_admin && (
          <div style={{ ...S.section, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Lock size={48} color={GRAY3} strokeWidth={1.5} /></div>
            <p>Acceso restringido. <span style={{ color: RED, cursor: "pointer" }} onClick={() => setShowLogin(true)}>Iniciar sesión como admin</span></p>
          </div>
        )}
        {showCart && <CartModal />}
        {showLogin && <LoginModal />}
        {showRegister && <RegisterModal />}
        {completeProfile && <CompleteProfileModal />}
        {googleMfaPaso && <GoogleMfaModal />}
        {quickView && <ProductModal />}
        {!isAdmin && <FloatingCart />}
        <Toast msg={toastMsg} />
      </div>
    </AppCtx.Provider>
  );
}
