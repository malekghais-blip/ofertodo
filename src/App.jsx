import { useState, useEffect, createContext, useContext, useRef } from "react";
import {
  ShoppingCart, Search, Trash2, MessageCircle, X, Package, CheckCircle2,
  MapPin, CreditCard, LayoutGrid, FolderOpen, Tag, Truck, Headphones,
  Plus, Pencil, Upload, RefreshCw, ChevronDown, ChevronUp, LogOut, User,
  Shirt, Footprints, Watch, Sparkles, ClipboardList, Image as ImageIcon,
  FileSpreadsheet, FolderPlus, Zap, Lock, Users, BarChart3, DollarSign,
  TrendingUp, Wallet, ShoppingBag, Pencil as PencilIcon, Save,
  Building2, MapPin as MapPinIcon, Send
} from "lucide-react";

// ════════════════════════════════════════════════════════════════
//  🔧 CONFIGURACIÓN SUPABASE — Pega tus datos aquí
//  1. Ve a supabase.com → tu proyecto → Settings → API
//  2. Copia "Project URL" y "anon public key"
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL = "https://esezhctdiucwovbvxmou.supabase.co";  // ← Cambia esto
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZXpoY3RkaXVjd292YnZ4bW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDY0NjgsImV4cCI6MjA5NjY4MjQ2OH0.5u--RCUEWH6hBrH0EFnmW1hZhuVjzqMbJax1qQh7zNo";                  // ← Cambia esto
const WA_NUMBER   = "50767200474";                        // ← Tu número WhatsApp

// ─── Supabase client minimalista (sin instalar paquetes) ────────
const sb = {
  headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
  url: (table, query = "") => `${SUPABASE_URL}/rest/v1/${table}${query}`,

  async get(table, query = "") {
    const r = await fetch(this.url(table, query), { headers: this.headers });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(table, body) {
    const r = await fetch(this.url(table), { method: "POST", headers: this.headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async patch(table, id, body) {
    const r = await fetch(this.url(table, `?id=eq.${id}`), { method: "PATCH", headers: this.headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(table, id) {
    const r = await fetch(this.url(table, `?id=eq.${id}`), { method: "DELETE", headers: this.headers });
    if (!r.ok) throw new Error(await r.text());
    return true;
  },
  // Auth
  async signUp(email, password, meta) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: this.headers, body: JSON.stringify({ email, password, data: meta }) });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: this.headers, body: JSON.stringify({ email, password }) });
    return r.json();
  },
  // Storage
  uploadUrl(bucket, path) { return `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`; },
  publicUrl(bucket, path) { return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`; },
  async upload(bucket, path, file) {
    const r = await fetch(this.uploadUrl(bucket, path), {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
        "cache-control": "3600",
      },
      body: file,
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Error subiendo imagen: ${errText}`);
    }
    return r.json();
  }
};

// ─── BRAND TOKENS ───────────────────────────────────────────────
const RED = "#E31E24", RED_D = "#B01519", BLACK = "#111", GRAY = "#F5F5F5", GRAY2 = "#E0E0E0", GRAY3 = "#9E9E9E", WHITE = "#FFFFFF";

// ─── CONTEXT ────────────────────────────────────────────────────
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

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
const ORDER_STATUS = ["Pedido realizado", "Empacando pedido...", "Listo para envío", "Pedido enviado"];
const STATUS_COLORS = [
  { bg: GRAY2, color: BLACK },
  { bg: "#FFF3CD", color: "#856404" },
  { bg: "#D4EDDA", color: "#155724" },
  { bg: "#CCE5FF", color: "#004085" },
];
const STATUS_ICONS = [ClipboardList, RefreshCw, Package, Truck];

// ─── ICONOS DE CATEGORÍA (imagen subida o icono futurista) ──────
function CategoryIcon({ cat, name, size = 28, color = RED }) {
  // Si recibe un objeto categoría con icono_url, muestra la imagen
  const iconoUrl = cat?.icono_url;
  if (iconoUrl) {
    return <img src={iconoUrl} alt={cat?.nombre || name} style={{ width: size, height: size, objectFit: "contain", borderRadius: 6 }} />;
  }
  const n = (cat?.nombre || name || "").toLowerCase();
  let Icon = Tag;
  if (n.includes("jean") && n.includes("hombre")) Icon = Shirt;
  else if (n.includes("jean")) Icon = Shirt;
  else if (n.includes("polo") || n.includes("camisa")) Icon = Shirt;
  else if (n.includes("calzado") || n.includes("sandalia") || n.includes("chancla") || n.includes("zapato")) Icon = Footprints;
  else if (n.includes("accesorio")) Icon = Watch;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════
const S = {
  app: { fontFamily: "'Inter','Segoe UI',sans-serif", background: WHITE, color: BLACK, minHeight: "100vh" },
  nav: { background: WHITE, borderBottom: `2px solid ${RED}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  btnRed: { background: RED, color: WHITE, border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, transition: "background 0.2s" },
  btnBlack: { background: BLACK, color: WHITE, border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  btnOutline: { background: "transparent", color: RED, border: `2px solid ${RED}`, borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  btnWA: { background: "#25D366", color: WHITE, border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  input: { width: "100%", border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 600, color: BLACK, display: "block", marginBottom: 6 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: WHITE, borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" },
  section: { padding: "48px 24px", maxWidth: 1200, margin: "0 auto" },
  sectionTitle: { fontSize: 22, fontWeight: 800, marginBottom: 24 },
  prodGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, alignItems: "stretch" },
  prodCard: { background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", minWidth: 0, width: "100%", display: "flex", flexDirection: "column", height: "100%" },
  priceTable: { background: GRAY, borderRadius: 8, padding: "10px 12px", marginBottom: 14 },
  priceRow: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" },
  table: { width: "100%", borderCollapse: "collapse", background: WHITE, borderRadius: 12, overflow: "hidden" },
  th: { background: BLACK, color: WHITE, padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 700 },
  td: { padding: "12px 16px", fontSize: 13, borderBottom: `1px solid ${GRAY2}` },
  statCard: { background: WHITE, borderRadius: 12, padding: "20px 24px", flex: 1, minWidth: 140, border: `1px solid ${GRAY2}` },
  toast: { position: "fixed", top: 76, left: "50%", transform: "translateX(-50%)", background: BLACK, color: WHITE, padding: "10px 16px", borderRadius: 24, fontWeight: 600, fontSize: 13, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", maxWidth: "88vw", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  spinner: { border: `3px solid ${GRAY2}`, borderTop: `3px solid ${RED}`, borderRadius: "50%", width: 32, height: 32, animation: "spin 0.8s linear infinite", margin: "60px auto" },
};

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function Logo({ onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}>
      <span style={{ color: RED, fontWeight: 800, fontSize: 22, letterSpacing: -1 }}>Ofer</span>
      <span style={{ background: RED, color: WHITE, fontWeight: 800, fontSize: 22, padding: "2px 8px", borderRadius: 6, letterSpacing: -1 }}>todo</span>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="oft-toast-in" style={{ ...S.toast, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} style={{ flexShrink: 0 }} /> {msg}</div>;
}

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.spinner} />
      <p style={{ color: GRAY3, marginTop: 12 }}>Cargando...</p>
    </div>
  );
}

function StatusBadge({ index }) {
  const s = STATUS_COLORS[index] || STATUS_COLORS[0];
  const Icon = STATUS_ICONS[index] || ClipboardList;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}>
      <Icon size={13} strokeWidth={2.2} /> {ORDER_STATUS[index]}
    </span>
  );
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
const PRES_PIEZAS = { pieza: 1, media: 6, docena: 12 };

function presLabel(pres) {
  return pres === "pieza" ? "pieza" : pres === "media" ? "½ docena" : "docena";
}
function presLabelPlural(pres, count) {
  if (pres === "pieza") return count === 1 ? "pieza" : "piezas";
  if (pres === "media") return count === 1 ? "½ docena" : "½ docenas";
  return count === 1 ? "docena" : "docenas";
}
// Precio unitario de cada presentación
function presUnitPrice(product, pres) {
  if (pres === "pieza")  return Number(product.precio_pieza);
  if (pres === "media")  return Number(product.precio_media_docena);
  return Number(product.precio_docena);
}
// Total de piezas según presentación y cantidad de paquetes
function presToPiezas(pres, count) {
  return (PRES_PIEZAS[pres] || 1) * count;
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
      <Logo onClick={() => setView("home")} />
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
function HomeView() {
  const { setView, categories, products, addToCart } = useApp();
  const featured = products.filter(p => p.activo && p.badge);

  return (
    <>
      {/* HERO */}
      <div className="oft-hero" style={{ background: `linear-gradient(135deg, ${BLACK} 0%, #2a0000 60%, #1a0000 100%)`, color: WHITE, padding: "64px 24px", textAlign: "center" }}>
        <div style={{ background: RED, color: WHITE, fontSize: 11, fontWeight: 800, letterSpacing: 2, padding: "4px 14px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18, textTransform: "uppercase" }}>
          <Zap size={12} strokeWidth={2.5} /> Distribuidora Mayorista · Panamá
        </div>
        <h1 className="oft-hero-title" style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, marginBottom: 16, letterSpacing: -1 }}>
          Precios al mayor<br /><span style={{ color: RED }}>sin complicaciones</span>
        </h1>
        <p style={{ color: "#ccc", fontSize: 16, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
          Compra por pieza, media docena o docena. Ropa, calzado y accesorios de calidad. Enviamos a todo Panamá.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{ ...S.btnRed, padding: "14px 30px", fontSize: 15 }} onClick={() => setView("catalogo")}>Ver Catálogo →</button>
          <button style={{ ...S.btnWA, padding: "14px 24px", fontSize: 15 }} onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=Hola%20Ofertodo%2C%20quiero%20hacer%20un%20pedido`, "_blank")}>
            <MessageCircle size={16} strokeWidth={2.2} /> Consultar por WhatsApp
          </button>
        </div>
      </div>

      {/* INFO BAR */}
      <div className="oft-infobar" style={{ background: RED, color: WHITE, padding: "10px 24px", display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap", fontSize: 13, fontWeight: 600 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Package size={15} strokeWidth={2.2} /> Pedido mínimo: 1 docena</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Truck size={15} strokeWidth={2.2} /> Envíos a todo Panamá</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MessageCircle size={15} strokeWidth={2.2} /> WhatsApp disponible</span>
      </div>

      {/* CATEGORÍAS */}
      <div className="oft-section" style={{ ...S.section, paddingBottom: 0 }}>
        <div style={S.sectionTitle}><span style={{ color: RED }}>▮</span> Categorías</div>
        <div className="oft-cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
          {categories.map(c => (
            <div key={c.id} onClick={() => setView("catalogo")} style={{ background: WHITE, border: `2px solid ${GRAY2}`, borderRadius: 12, padding: "18px 10px", textAlign: "center", cursor: "pointer" }}>
              <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}><CategoryIcon cat={c} size={30} /></div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.nombre}</div>
            </div>
          ))}
        </div>
      </div>

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
          <button style={{ ...S.btnRed, padding: "14px 28px" }} onClick={() => setView("catalogo")}>Ver Catálogo</button>
          <button style={{ ...S.btnWA, padding: "14px 24px" }} onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, "_blank")}><MessageCircle size={16} strokeWidth={2.2} /> WhatsApp</button>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: "#0a0a0a", color: WHITE, padding: "32px 24px" }}>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "space-between", maxWidth: 900, margin: "0 auto" }}>
          <div><Logo /><p style={{ color: "#aaa", fontSize: 13, marginTop: 10, maxWidth: 220 }}>Distribuidora mayorista y minorista en Panamá.</p></div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Contacto</div>
            <div style={{ fontSize: 13, color: "#aaa", lineHeight: 2.2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><MessageCircle size={14} /> WhatsApp: +507 6720-0474</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><User size={14} /> info@ofertodo.com</div>
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

  const presentaciones = [
    { key: "pieza", label: "Pieza", precio: Number(product.precio_pieza), porPieza: Number(product.precio_pieza) },
    { key: "media", label: "½ Doc", precio: Number(product.precio_media_docena), porPieza: Number(product.precio_media_docena) / 6 },
    { key: "docena", label: "Docena", precio: Number(product.precio_docena), porPieza: Number(product.precio_docena) / 12 },
  ];

  return (
    <div>
      {/* SELECTOR DE PRESENTACIÓN */}
      <div className="oft-pres-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12, alignItems: "stretch" }}>
        {presentaciones.map(p => {
          const active = pres === p.key;
          return (
            <button key={p.key}
              onClick={() => { setPres(p.key); setCount(1); triggerBump(); }}
              className="oft-pres-chip oft-btn-press"
              style={{
                padding: big ? "12px 4px" : "10px 2px", borderRadius: 10,
                border: `2px solid ${active ? RED : GRAY2}`,
                background: active ? "#FFF5F5" : WHITE,
                cursor: "pointer", transition: "all 0.18s",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                minWidth: 0, width: "100%", boxSizing: "border-box",
              }}
            >
              <div className="oft-pres-label" style={{ fontSize: big ? 12 : 11, fontWeight: 800, color: active ? RED : BLACK, textAlign: "center", width: "100%", lineHeight: 1.2, whiteSpace: "nowrap" }}>{p.label}</div>
              <div className="oft-pres-price" style={{ fontSize: big ? 15 : 13, fontWeight: 900, color: active ? RED : BLACK, textAlign: "center", width: "100%", lineHeight: 1.2, whiteSpace: "nowrap" }}>${p.precio.toFixed(2)}</div>
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
//  PRODUCT CARD
// ═══════════════════════════════════════════════════════════════
function ProductCard({ product }) {
  const { addToCart, showToast, setQuickView } = useApp();
  const [pres, setPres] = useState("docena");
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState(false);
  const total = presTotal(product, pres, count);
  const imgUrl = product.imagen_url || null;
  const btnRef = useRef(null);

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
          ? <img src={imgUrl} alt={product.nombre} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <Package size={56} color={GRAY3} strokeWidth={1.3} />
        }
        {product.badge && <span style={{ position: "absolute", top: 10, left: 10, background: RED, color: WHITE, fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}><Sparkles size={11} /> {product.badge}</span>}
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
          {/* DESGLOSE */}
          <div style={{ fontSize: 11, color: GRAY3, background: GRAY, borderRadius: 6, padding: "6px 10px", display: "flex", alignItems: "center", gap: 5, marginTop: 8, minHeight: 30 }}>
            <Sparkles size={12} style={{ flexShrink: 0 }} /> <span>{presBreakdown(pres, count, product)}</span>
          </div>
        </div>
        {/* Empuja los botones al fondo para alinear todas las tarjetas */}
        <div style={{ marginTop: "auto" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button ref={btnRef} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", background: added ? "#25D366" : RED, transition: "background 0.3s" }} onClick={handleAdd}>
            {added ? <><CheckCircle2 size={16} className="oft-check-pop" /> ¡Agregado!</> : <><Plus size={15} strokeWidth={2.5} /> Agregar al pedido</>}
          </button>
          <button className="oft-btn-press" style={S.btnWA} onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=Hola%20Ofertodo%2C%20me%20interesa:%20${encodeURIComponent(product.nombre)}`, "_blank")}><MessageCircle size={16} /></button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CATÁLOGO
// ═══════════════════════════════════════════════════════════════
function CatalogoView() {
  const { products, categories, loading } = useApp();
  const [catFilter, setCatFilter] = useState(0);
  const [search, setSearch] = useState("");

  const filtered = products.filter(p =>
    p.activo &&
    (catFilter === 0 || p.categoria_id === catFilter) &&
    (search === "" || p.nombre.toLowerCase().includes(search.toLowerCase()) || p.referencia.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <Spinner />;

  return (
    <div className="oft-section" style={S.section}>
      <div style={S.sectionTitle}><span style={{ color: RED }}>▮</span> Catálogo <span style={{ color: RED }}>de Productos</span></div>
      <div style={{ position: "relative", maxWidth: 400, marginBottom: 24 }}>
        <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input style={{ ...S.input, paddingLeft: 36, marginBottom: 0 }} placeholder="Buscar producto o referencia..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="oft-cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 16, marginBottom: 28 }}>
        <div className="oft-cat-chip" onClick={() => setCatFilter(0)} style={{ border: `2px solid ${catFilter === 0 ? RED : GRAY2}`, borderRadius: 10, padding: "14px 8px", textAlign: "center", cursor: "pointer", background: catFilter === 0 ? "#FFF5F5" : WHITE }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}><LayoutGrid size={22} color={catFilter === 0 ? RED : BLACK} strokeWidth={1.8} /></div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Todo</div>
        </div>
        {categories.map(c => (
          <div key={c.id} className="oft-cat-chip" onClick={() => setCatFilter(c.id)} style={{ border: `2px solid ${catFilter === c.id ? RED : GRAY2}`, borderRadius: 10, padding: "14px 8px", textAlign: "center", cursor: "pointer", background: catFilter === c.id ? "#FFF5F5" : WHITE }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}><CategoryIcon cat={c} size={22} color={catFilter === c.id ? RED : BLACK} /></div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{c.nombre}</div>
          </div>
        ))}
      </div>
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
  const [pres, setPres] = useState("docena");
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => { setPres("docena"); setCount(1); setAdded(false); }, [product]);

  if (!product) return null;
  const total = presTotal(product, pres, count);
  const imgUrl = product.imagen_url || null;

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
            ? <img src={imgUrl} alt={product.nombre} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
            <div style={{ fontSize: 12, color: GRAY3, background: WHITE, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
              <Sparkles size={13} /> {presBreakdown(pres, count, product)}
            </div>
          </div>

          {/* BOTONES */}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", padding: 14, fontSize: 15, background: added ? "#25D366" : RED, transition: "background 0.3s" }} onClick={handleAdd}>
              {added ? <><CheckCircle2 size={17} className="oft-check-pop" /> ¡Agregado!</> : <><Plus size={16} strokeWidth={2.5} /> Agregar al pedido</>}
            </button>
            <button className="oft-btn-press" style={{ ...S.btnWA, padding: "14px 16px" }} onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=Hola%20Ofertodo%2C%20me%20interesa:%20${encodeURIComponent(product.nombre)}`, "_blank")}><MessageCircle size={18} /></button>
          </div>
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
  const { cart, setCart, setShowCart, user, setShowLogin, setView } = useApp();
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
              onClick={() => { setShowCart(false); user ? setView("checkout") : setShowLogin(true); }}>
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

  const handle = async () => {
    setLoading(true); setErr("");
    try {
      const res = await sb.signIn(email, pass);
      if (res.error) { setErr(res.error.message || "Credenciales incorrectas"); }
      else {
        const users = await sb.get("usuarios", `?email=eq.${encodeURIComponent(email)}&limit=1`);
        setUser({ ...res.user, ...(users[0] || {}), token: res.access_token });
        showToast("¡Bienvenido de vuelta!");
        setShowLogin(false);
      }
    } catch(e) { setErr("Error de conexión. Verifica tu configuración de Supabase."); }
    setLoading(false);
  };

  return (
    <div className="oft-overlay" style={S.overlay} onClick={() => setShowLogin(false)}>
      <div className="oft-modal-sheet oft-modal" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><Logo /><button onClick={() => setShowLogin(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button></div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>Iniciar sesión</div>
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
  const { setShowRegister, setUser, showToast } = useApp();
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "", pass: "" });
  const [loading, setLoading] = useState(false), [err, setErr] = useState("");

  const handle = async () => {
    if (!form.nombre || !form.email || !form.pass) { setErr("Por favor completa todos los campos."); return; }
    setLoading(true); setErr("");
    try {
      const auth = await sb.signUp(form.email, form.pass, { nombre: form.nombre });
      if (auth.error) { setErr(auth.error.message); }
      else {
        await sb.post("usuarios", { nombre: form.nombre, email: form.email, telefono: form.telefono, es_admin: false });
        showToast("¡Cuenta creada! Ya puedes iniciar sesión.");
        setShowRegister(false);
      }
    } catch(e) { setErr("Error de conexión."); }
    setLoading(false);
  };

  return (
    <div className="oft-overlay" style={S.overlay} onClick={() => setShowRegister(false)}>
      <div className="oft-modal-sheet oft-modal" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><Logo /><button onClick={() => setShowRegister(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button></div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>Crear cuenta</div>
        {[["nombre","Nombre completo","Tu nombre completo"],["telefono","WhatsApp / Celular","+507 0000-0000"],["email","Correo electrónico","tu@email.com"],["pass","Contraseña","Mínimo 6 caracteres"]].map(([k,l,ph]) => (
          <div key={k}><label style={S.label}>{l}</label><input style={S.input} type={k==="pass"?"password":k==="email"?"email":"text"} placeholder={ph} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} /></div>
        ))}
        {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 14, fontSize: 15, opacity: loading ? 0.7 : 1 }} onClick={handle} disabled={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CHECKOUT
// ═══════════════════════════════════════════════════════════════
function CheckoutView() {
  const { cart, setCart, user, setView, showToast, empresas, sucursales } = useApp();
  const [address, setAddress] = useState(""), [notes, setNotes] = useState(""), [loading, setLoading] = useState(false), [placed, setPlaced] = useState(null);
  const [nombre, setNombre] = useState(user?.nombre || "");
  const [telefono, setTelefono] = useState(user?.telefono || "");
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursalId, setSucursalId] = useState(null);
  const total = cart.reduce((s, i) => s + cartItemTotal(i), 0);

  const empresasActivas = empresas.filter(e => e.activa !== false);
  const sucursalesEmpresa = sucursales.filter(s => s.empresa_id === empresaId && s.activa !== false);
  const empresaSel = empresas.find(e => e.id === empresaId);
  const sucursalSel = sucursales.find(s => s.id === sucursalId);

  const handlePlace = async () => {
    if (!nombre.trim()) { alert("Por favor escribe tu nombre."); return; }
    if (!empresaId) { alert("Por favor elige una empresa de envío."); return; }
    if (sucursalesEmpresa.length > 0 && !sucursalId) { alert("Por favor elige una sucursal."); return; }
    setLoading(true);
    try {
      const codigo = `OFT-${Date.now().toString().slice(-6)}`;
      const pedido = await sb.post("pedidos", {
        codigo, usuario_id: user.id, nombre_cliente: nombre, telefono: telefono,
        direccion: address, notas: notes, total, estado: 0,
        empresa_envio_id: empresaId, empresa_envio_nombre: empresaSel?.nombre || "",
        sucursal_id: sucursalId, sucursal_nombre: sucursalSel?.nombre || "",
      });
      const pedidoId = pedido[0].id;
      for (const item of cart) {
        await sb.post("pedido_items", { pedido_id: pedidoId, producto_id: item.product.id, nombre_producto: item.product.nombre, cantidad: item.qty, precio_unitario: item.product.precio_pieza, subtotal: cartItemTotal(item) });
      }
      setPlaced(codigo);
      setCart([]);
      showToast("¡Pedido realizado con éxito!");
    } catch(e) { alert("Error al guardar el pedido: " + e.message); }
    setLoading(false);
  };

  if (placed) return (
    <div className="oft-section" style={{ ...S.section, textAlign: "center", maxWidth: 500 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><CheckCircle2 size={64} color={RED} strokeWidth={1.5} /></div>
      <h2 style={{ fontSize: 24, fontWeight: 900 }}>¡Pedido realizado!</h2>
      <p style={{ color: GRAY3 }}>Sigue el estado de tu pedido desde "Mi Cuenta".</p>
      <div style={{ background: GRAY, borderRadius: 12, padding: 20, margin: "20px 0", textAlign: "left" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Número: <span style={{ color: RED }}>{placed}</span></div>
        <StatusBadge index={0} />
        {empresaSel && <div style={{ marginTop: 10, fontSize: 13, color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><Truck size={14} /> {empresaSel.nombre}{sucursalSel ? ` · ${sucursalSel.nombre}` : ""}</div>}
      </div>
      <button style={{ ...S.btnRed, justifyContent: "center", margin: "0 auto" }} onClick={() => setView("dashboard")}>Ver estado de mi pedido</button>
    </div>
  );

  return (
    <div className="oft-section" style={{ ...S.section, maxWidth: 620 }}>
      <div style={S.sectionTitle}>Finalizar Pedido</div>
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 16, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Package size={18} /> Resumen</div>
        {cart.map((item, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", borderBottom: `1px solid ${GRAY2}` }}>
            <span>{item.product.nombre} <span style={{ color: GRAY3, fontSize: 12 }}>({cartItemLabel(item)})</span></span>
            <span style={{ fontWeight: 700 }}>${cartItemTotal(item).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18, marginTop: 14 }}>
          <span>Total</span><span style={{ color: RED }}>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* EMPRESA DE ENVÍO */}
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

      {/* DIRECCIÓN / NOTAS */}
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 16, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><MapPin size={18} /> Datos adicionales</div>
        <label style={S.label}>Nombre *</label>
        <input style={S.input} placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <label style={S.label}>WhatsApp / Teléfono</label>
        <input style={S.input} placeholder="Ej: 6720-0474" value={telefono} onChange={e => setTelefono(e.target.value)} />
        <label style={S.label}>Dirección o referencia (opcional)</label>
        <input style={S.input} placeholder="Ej: cerca del parque central..." value={address} onChange={e => setAddress(e.target.value)} />
        <label style={S.label}>Notas (tallas, colores, referencias)</label>
        <input style={S.input} placeholder="Opcional..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 20, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><CreditCard size={18} /> Pago</div>
        <div style={{ background: GRAY, borderRadius: 8, padding: 14, fontSize: 14, color: GRAY3 }}>
          El pago se coordina por WhatsApp (Yappy, Nequi, transferencia o efectivo al recibir)
        </div>
      </div>
      <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 16, fontSize: 16, opacity: loading ? 0.7 : 1 }} onClick={handlePlace} disabled={loading}>
        {loading ? "Procesando..." : <><CheckCircle2 size={18} /> Confirmar Pedido</>}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD CLIENTE
// ═══════════════════════════════════════════════════════════════
function DashboardView() {
  const { user, products } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const loadOrders = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const data = await sb.get("pedidos", `?usuario_id=eq.${user.id}&order=created_at.desc`);
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
        sb.get("pedidos", `?usuario_id=eq.${user.id}&order=created_at.desc`)
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
                    <ProgressTracker estado={o.estado} />

                    {/* INFO ENVÍO */}
                    {o.empresa_envio_nombre && (
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
                      <div style={{ marginTop: 4 }}><StatusBadge index={o.estado} /></div>
                    </div>
                    <div style={{ flexShrink: 0 }}>{isOpen ? <ChevronUp size={18} color={GRAY3} /> : <ChevronDown size={18} color={GRAY3} />}</div>
                  </div>

                  {/* DETALLE EXPANDIBLE */}
                  {isOpen && (
                    <div className="oft-detail-open" style={{ borderTop: `1px solid ${GRAY2}`, padding: 16, background: "#FAFAFA" }}>
                      {/* progreso */}
                      <ProgressTracker estado={o.estado} compact />

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
                          <StatusBadge index={o.estado} />
                        </div>
                        {o.empresa_envio_nombre && (
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
function ProgressTracker({ estado, compact }) {
  const pct = (estado / (ORDER_STATUS.length - 1)) * 100;
  return (
    <div>
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginTop: compact ? 8 : 4 }}>
        {/* línea base */}
        <div style={{ position: "absolute", top: 18, left: 18, right: 18, height: 4, background: GRAY2, borderRadius: 2, zIndex: 0 }} />
        {/* línea de progreso animada */}
        <div className="oft-progress-fill" style={{ position: "absolute", top: 18, left: 18, height: 4, background: `linear-gradient(90deg, ${RED}, ${RED_D})`, borderRadius: 2, zIndex: 1, width: `calc((100% - 36px) * ${pct / 100})` }} />
        {/* pasos */}
        {ORDER_STATUS.map((s, i) => {
          const SIcon = STATUS_ICONS[i];
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
//  ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
function AdminView() {
  const { products, setProducts, categories, setCategories, empresas, setEmpresas, sucursales, setSucursales, showToast } = useApp();
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
  const emptyProd = { referencia: "", nombre: "", descripcion: "", categoria_id: categories[0]?.id || 1, precio_pieza: "", precio_media_docena: "", precio_docena: "", badge: "", activo: true, imagen_url: "" };
  const [prodForm, setProdForm] = useState(emptyProd);
  const fileInputRef = useRef(null);
  const catFileRef = useRef(null);
  // Carga masiva CON imágenes (crea borradores)
  const [showBulkImg, setShowBulkImg] = useState(false);
  const [bulkImgCat, setBulkImgCat] = useState(categories[0]?.id || 1);
  const [bulkImgLoading, setBulkImgLoading] = useState(false);
  const [bulkImgProgress, setBulkImgProgress] = useState({ done: 0, total: 0 });
  const bulkImgRef = useRef(null);
  // Edición masiva (selección por checkboxes)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const emptyBulkEdit = { nombre: "", precio_pieza: "", precio_media_docena: "", precio_docena: "", badge: "", descripcion: "", activo: "" };
  const [bulkEdit, setBulkEdit] = useState(emptyBulkEdit);

  // Carga pedidos y usuarios al entrar
  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      try {
        const [ordersData, usersData] = await Promise.all([
          sb.get("pedidos", "?order=created_at.desc"),
          sb.get("usuarios", "?order=created_at.desc").catch(() => []),
        ]);
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

  // ── MÉTRICAS ───────────────────────────────────────────────────
  const ingresoTotal = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const ordenesTotal = orders.length;
  const clientesTotal = users.length;
  const balance = orders.filter(o => o.estado === 3).reduce((s, o) => s + Number(o.total || 0), 0); // entregados = cobrado

  // Ingresos por día (últimos 7 registros con pedidos)
  const ingresosPorFecha = (() => {
    const map = {};
    orders.forEach(o => {
      const d = new Date(o.created_at).toLocaleDateString("es-PA", { day: "2-digit", month: "2-digit" });
      if (!map[d]) map[d] = { fecha: d, ingreso: 0, ordenes: 0 };
      map[d].ingreso += Number(o.total || 0);
      map[d].ordenes += 1;
    });
    return Object.values(map).slice(-7);
  })();
  const maxIngreso = Math.max(...ingresosPorFecha.map(d => d.ingreso), 1);

  // Mejores productos (por cantidad vendida)
  const mejoresProductos = (() => {
    const map = {};
    orders.forEach(o => (o.items || []).forEach(it => {
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
    const mensajes = [
      `¡Hola ${nombre}! 👋\n\nTu pedido *${codigo}* en Ofertodo ha sido *recibido* ✅\n\nEstamos procesándolo y pronto comenzaremos a empacarlo.${envio}\n\n¡Gracias por tu compra! 🛍️`,
      `¡Hola ${nombre}! 📦\n\nTu pedido *${codigo}* ya está siendo *empacado* con cuidado.\n\nTe avisaremos cuando esté listo para envío.${envio}\n\n¡Gracias por tu paciencia! 🙌`,
      `¡Hola ${nombre}! ✅\n\n¡Buenas noticias! Tu pedido *${codigo}* está *listo para envío* 🎉\n\nPronto será despachado.${envio}\n\n¡Ya casi lo tienes! 🚀`,
      `¡Hola ${nombre}! 🚚\n\nTu pedido *${codigo}* ha sido *enviado* 📨\n\nYa va en camino hacia ti.${envio}\n\n¡Gracias por comprar en Ofertodo! ❤️`,
    ];
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
        const ok = confirm(`Estado actualizado a "${ORDER_STATUS[newStatus]}".\n\n¿Notificar al cliente por WhatsApp?`);
        if (ok) notifyWhatsApp({ ...order, estado: newStatus }, newStatus);
      }
    } catch(e) { alert("Error al actualizar estado"); }
  };

  // ── SUBIDA DE IMAGEN DE PRODUCTO ───────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}_${cleanName}`;
      await sb.upload("productos", path, file);
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
      const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}_${cleanName}`;
      await sb.upload("categorias", path, file);
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
    setProdForm({ referencia: p.referencia || "", nombre: p.nombre || "", descripcion: p.descripcion || "", categoria_id: p.categoria_id || categories[0]?.id || 1, precio_pieza: p.precio_pieza, precio_media_docena: p.precio_media_docena, precio_docena: p.precio_docena, badge: p.badge || "", activo: p.activo, imagen_url: p.imagen_url || "" });
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

  const handleToggle = async (product) => {
    try {
      await sb.patch("productos", product.id, { activo: !product.activo });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, activo: !p.activo } : p));
      showToast(`Producto ${!product.activo ? "activado" : "desactivado"}`);
    } catch(e) { alert("Error"); }
  };

  const handleDelete = async (product) => {
    if (!confirm(`¿Eliminar "${product.nombre}"?`)) return;
    try {
      await sb.delete("productos", product.id);
      setProducts(prev => prev.filter(p => p.id !== product.id));
      showToast("Producto eliminado");
    } catch(e) { alert("Error eliminando producto"); }
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
      const [referencia, nombre, descripcion, categoria_id, precio_pieza, precio_media_docena, precio_docena, badge] = cols;
      if (!nombre || !precio_pieza) { err++; continue; }
      try {
        const saved = await sb.post("productos", {
          referencia: referencia || "", nombre, descripcion: descripcion || "",
          categoria_id: Number(categoria_id) || categories[0]?.id || 1,
          precio_pieza: Number(precio_pieza) || 0, precio_media_docena: Number(precio_media_docena) || 0,
          precio_docena: Number(precio_docena) || 0, badge: badge || "", activo: true, imagen_url: "",
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
        const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${Date.now()}_${i}_${cleanName}`;
        await sb.upload("productos", path, file);
        const url = `${sb.publicUrl("productos", path)}?t=${Date.now()}`;
        // Nombre por defecto desde el nombre del archivo (sin extensión)
        const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").trim();
        const saved = await sb.post("productos", {
          referencia: "", nombre: baseName || "Producto sin nombre", descripcion: "",
          categoria_id: Number(bulkImgCat) || categories[0]?.id || 1,
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
    if (selectedIds.length === products.length) setSelectedIds([]);
    else setSelectedIds(products.map(p => p.id));
  };
  const handleBulkEdit = async () => {
    if (selectedIds.length === 0) { alert("Selecciona al menos un producto."); return; }
    // Solo aplica los campos que tienen valor (los vacíos no se tocan)
    const patch = {};
    if (bulkEdit.nombre !== "") patch.nombre = bulkEdit.nombre;
    if (bulkEdit.precio_pieza !== "") patch.precio_pieza = Number(bulkEdit.precio_pieza);
    if (bulkEdit.precio_media_docena !== "") patch.precio_media_docena = Number(bulkEdit.precio_media_docena);
    if (bulkEdit.precio_docena !== "") patch.precio_docena = Number(bulkEdit.precio_docena);
    if (bulkEdit.badge !== "") patch.badge = bulkEdit.badge;
    if (bulkEdit.descripcion !== "") patch.descripcion = bulkEdit.descripcion;
    if (bulkEdit.activo !== "") patch.activo = bulkEdit.activo === "1";
    if (Object.keys(patch).length === 0) { alert("Llena al menos un campo para aplicar."); return; }
    setBulkEditLoading(true);
    let ok = 0, err = 0;
    for (const id of selectedIds) {
      try {
        const updated = await sb.patch("productos", id, patch);
        setProducts(prev => prev.map(p => p.id === id ? updated[0] : p));
        ok++;
      } catch(e) { err++; }
    }
    setBulkEditLoading(false);
    setShowBulkEdit(false);
    setBulkEdit(emptyBulkEdit);
    setSelectedIds([]);
    setSelectMode(false);
    showToast(`${ok} producto(s) editados${err > 0 ? `, ${err} con error` : ""}`);
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
      const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}_${cleanName}`;
      await sb.upload("empresas", path, file);
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
      const saved = await sb.post("sucursales", { empresa_id: empId, nombre: form.nombre.trim(), direccion: form.direccion || "", telefono: form.telefono || "", activa: true });
      setSucursales(prev => [...prev, saved[0]]);
      setSucForm(prev => ({ ...prev, [empId]: { nombre: "", direccion: "", telefono: "" } }));
      showToast("Sucursal agregada");
    } catch(e) { alert("Error: " + e.message); }
  };

  const handleDeleteSucursal = async (suc) => {
    if (!confirm(`¿Eliminar la sucursal "${suc.nombre}"?`)) return;
    try {
      await sb.delete("sucursales", suc.id);
      setSucursales(prev => prev.filter(s => s.id !== suc.id));
      showToast("Sucursal eliminada");
    } catch(e) { alert("Error: " + e.message); }
  };

  const tabs = [
    ["dashboard", "Dashboard", BarChart3],
    ["orders", "Pedidos", Package],
    ["products", "Productos", Tag],
    ["categories", "Categorías", FolderOpen],
    ["shipping", "Envíos", Truck],
    ["users", "Clientes", Users],
  ];

  const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div className="oft-admin-sidebar" style={{ background: BLACK, color: WHITE, width: 220, minHeight: "100vh", padding: "24px 0", position: "fixed", top: 0, left: 0, zIndex: 90 }}>
        <div className="oft-admin-brand" style={{ padding: "0 20px 24px", borderBottom: "1px solid #333" }}><Logo /><div style={{ fontSize: 11, color: "#aaa", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}><Zap size={11} /> Panel Administrador</div></div>
        <div className="oft-admin-tabs" style={{ padding: "16px 0" }}>
          {tabs.map(([k,l,Icon]) => (
            <div key={k} className={"oft-admin-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)} style={{ padding: "12px 24px", cursor: "pointer", fontWeight: 600, fontSize: 14, color: tab === k ? WHITE : "#aaa", background: tab === k ? RED : "transparent", borderLeft: tab === k ? "3px solid white" : "3px solid transparent", display: "flex", alignItems: "center", gap: 10 }}>
              <Icon size={17} strokeWidth={2} /> {l}
            </div>
          ))}
        </div>
      </div>

      <div className="oft-admin-main" style={{ marginLeft: 220, padding: "32px", minHeight: "100vh", background: GRAY, flex: 1 }}>

        {/* ═══════════ DASHBOARD ═══════════ */}
        {tab === "dashboard" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><BarChart3 size={24} color={RED} /> Dashboard</div>
            {loadingData ? <Spinner /> : (
              <>
                {/* TARJETAS DE MÉTRICAS */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                  {[
                    ["Ingresos totales", money(ingresoTotal), DollarSign, RED],
                    ["Órdenes totales", ordenesTotal, ShoppingBag, "#004085"],
                    ["Clientes", clientesTotal, Users, "#155724"],
                    ["Mi balance", money(balance), Wallet, "#856404"],
                  ].map(([label, val, Icon, color]) => (
                    <div key={label} style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}` }}>
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

                {/* GRÁFICO DE INGRESOS + MEJORES PRODUCTOS */}
                <div className="oft-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 28 }}>
                  {/* GRÁFICO INGRESOS */}
                  <div style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}` }}>
                    <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={18} color={RED} /> Estadística de Ingresos</div>
                    <div style={{ fontSize: 12, color: GRAY3, marginBottom: 20 }}>Ingresos y órdenes por día</div>
                    {ingresosPorFecha.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 40, color: GRAY3 }}>Aún no hay datos de ventas</div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, paddingTop: 10 }}>
                        {ingresosPorFecha.map((d, i) => (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: RED }}>{money(d.ingreso)}</div>
                            <div style={{ width: "100%", maxWidth: 48, background: `linear-gradient(180deg, ${RED} 0%, ${RED_D} 100%)`, borderRadius: "6px 6px 0 0", height: `${Math.max((d.ingreso / maxIngreso) * 150, 4)}px`, transition: "height 0.3s" }} />
                            <div style={{ fontSize: 11, color: GRAY3 }}>{d.fecha}</div>
                            <div style={{ fontSize: 10, color: GRAY3, background: GRAY, borderRadius: 10, padding: "1px 7px" }}>{d.ordenes} ord</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* MEJORES PRODUCTOS */}
                  <div style={{ background: WHITE, borderRadius: 14, padding: 24, border: `1px solid ${GRAY2}` }}>
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
                  {orders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 30, color: GRAY3, fontSize: 13 }}>Aún no hay órdenes</div>
                  ) : orders.slice(0, 5).map(o => {
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
                        <StatusBadge index={o.estado} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════ PEDIDOS ═══════════ */}
        {tab === "orders" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><Package size={24} color={RED} /> Pedidos Recibidos</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
              {[["Total",orders.length,RED,ClipboardList],["En proceso",orders.filter(o=>o.estado<3).length,"#856404",RefreshCw],["Entregados",orders.filter(o=>o.estado===3).length,"#155724",CheckCircle2]].map(([l,n,c,Icon]) => (
                <div key={l} style={S.statCard}><Icon size={20} color={c} strokeWidth={1.8} /><div style={{ fontSize: 28, fontWeight: 900, color: c }}>{n}</div><div style={{ fontSize: 13, color: GRAY3 }}>{l}</div></div>
              ))}
            </div>
            {loadingData ? <Spinner /> : (
              <div className="oft-table-wrap" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
                <table style={S.table}>
                  <thead><tr>{["#Pedido","Cliente","Teléfono","Envío","Total","Estado","Cambiar","Avisar"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td style={{ ...S.td, fontWeight: 700, color: RED }}>{o.codigo}</td>
                        <td style={S.td}>{o.nombre_cliente}</td>
                        <td style={S.td}>{o.telefono}</td>
                        <td style={S.td}>
                          {o.empresa_envio_nombre
                            ? <span style={{ fontSize: 12 }}>{o.empresa_envio_nombre}{o.sucursal_nombre ? <><br /><span style={{ color: GRAY3 }}>{o.sucursal_nombre}</span></> : ""}</span>
                            : <span style={{ color: GRAY3 }}>—</span>}
                        </td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{money(o.total)}</td>
                        <td style={S.td}><StatusBadge index={o.estado} /></td>
                        <td style={S.td}>
                          <select value={o.estado} onChange={e => handleStatusChange(o.id, Number(e.target.value))} style={{ border: `1.5px solid ${GRAY2}`, borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: "inherit" }}>
                            {ORDER_STATUS.map((s,i) => <option key={i} value={i}>{s}</option>)}
                          </select>
                        </td>
                        <td style={S.td}>
                          <button onClick={() => notifyWhatsApp(o, o.estado)} title="Enviar notificación por WhatsApp" style={{ ...S.btnWA, padding: "6px 10px", fontSize: 12 }}>
                            <MessageCircle size={14} /> Avisar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══════════ PRODUCTOS ═══════════ */}
        {tab === "products" && (
          <>
            <div className="oft-admin-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Tag size={24} color={RED} /> Productos</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

            {/* BARRA DE EDICIÓN MASIVA (cuando hay seleccionados) */}
            {selectMode && (
              <div style={{ background: "#FFF5F5", border: `2px solid ${RED}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedIds.length} seleccionado(s)</span>
                <button style={{ ...S.btnOutline, padding: "6px 12px", fontSize: 13 }} onClick={selectAll}>
                  {selectedIds.length === products.length ? "Quitar todos" : "Seleccionar todos"}
                </button>
                <button style={{ ...S.btnRed, padding: "6px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, opacity: selectedIds.length === 0 ? 0.5 : 1 }} disabled={selectedIds.length === 0} onClick={() => setShowBulkEdit(true)}>
                  <PencilIcon size={14} /> Editar seleccionados
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
                  referencia,nombre,descripcion,categoria_id,precio_pieza,precio_media_docena,precio_docena,badge
                </div>
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
                  {[["referencia","Referencia"],["nombre","Nombre del producto"],["precio_pieza","Precio x pieza ($)"],["precio_media_docena","Precio x media docena ($)"],["precio_docena","Precio x docena ($)"],["badge","Badge (NUEVO, OFERTA, etc)"]].map(([k,l]) => (
                    <div key={k}><label style={S.label}>{l}</label><input style={S.input} value={prodForm[k]} onChange={e => setProdForm({...prodForm,[k]:e.target.value})} /></div>
                  ))}
                  <div><label style={S.label}>Categoría</label>
                    <select style={{ ...S.input }} value={prodForm.categoria_id} onChange={e => setProdForm({...prodForm,categoria_id:Number(e.target.value)})}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div><label style={S.label}>Estado</label>
                    <select style={{ ...S.input }} value={prodForm.activo ? "1" : "0"} onChange={e => setProdForm({...prodForm,activo:e.target.value === "1"})}>
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
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
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={handleSaveProd}><Save size={16} /> {editingId ? "Guardar cambios" : "Crear producto"}</button>
                  <button style={S.btnOutline} onClick={() => { setShowProdForm(false); setEditingId(null); }}>Cancelar</button>
                </div>
              </div>
            )}

            <div className="oft-table-wrap" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
              <table style={S.table}>
                <thead><tr>{[...(selectMode ? ["✓"] : []), "Foto","Ref","Producto","Categoría","x1","x6","x12","Estado","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {products.map(p => {
                    const isSel = selectedIds.includes(p.id);
                    return (
                    <tr key={p.id} style={{ background: isSel ? "#FFF5F5" : "transparent" }}>
                      {selectMode && (
                        <td style={S.td}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} style={{ width: 18, height: 18, accentColor: RED, cursor: "pointer" }} />
                        </td>
                      )}
                      <td style={S.td}>
                        {p.imagen_url ? <img src={p.imagen_url} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={16} color={GRAY3} /></div>}
                      </td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{p.referencia || "—"}</td>
                      <td style={S.td}>{p.nombre}</td>
                      <td style={S.td}>{categories.find(c=>c.id===p.categoria_id)?.nombre || "-"}</td>
                      <td style={S.td}>${p.precio_pieza}</td>
                      <td style={S.td}>${p.precio_media_docena}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: RED }}>${p.precio_docena}</td>
                      <td style={S.td}><span style={{ background: p.activo ? "#D4EDDA" : GRAY2, color: p.activo ? "#155724" : BLACK, padding: "3px 8px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{p.activo ? "Activo" : "Borrador"}</span></td>
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEditProduct(p)} style={{ background: "none", border: `1px solid ${BLACK}`, color: BLACK, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><PencilIcon size={13} /> Editar</button>
                          <button style={{ ...S.btnOutline, padding: "4px 10px", fontSize: 12 }} onClick={() => handleToggle(p)}>{p.activo ? "Ocultar" : "Mostrar"}</button>
                          <button onClick={() => handleDelete(p)} style={{ background: "none", border: `1px solid ${RED}`, color: RED, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center" }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MODAL DE EDICIÓN MASIVA */}
            {showBulkEdit && (
              <div className="oft-overlay" style={S.overlay} onClick={() => setShowBulkEdit(false)}>
                <div className="oft-modal-sheet oft-qv-pop" style={{ ...S.modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><PencilIcon size={18} color={RED} /> Editar {selectedIds.length} producto(s)</div>
                    <button onClick={() => setShowBulkEdit(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
                  </div>
                  <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>Solo se cambian los campos que llenes. Los vacíos se quedan igual.</p>
                  <label style={S.label}>Nombre del producto</label>
                  <input style={S.input} placeholder="(dejar vacío para no cambiar)" value={bulkEdit.nombre} onChange={e => setBulkEdit({...bulkEdit, nombre: e.target.value})} />
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
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: bulkEditLoading ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={handleBulkEdit} disabled={bulkEditLoading}>
                      <Save size={16} /> {bulkEditLoading ? "Guardando..." : "Aplicar cambios"}
                    </button>
                    <button style={S.btnOutline} onClick={() => setShowBulkEdit(false)}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════ CATEGORÍAS ═══════════ */}
        {tab === "categories" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><FolderOpen size={24} color={RED} /> Categorías</div>
            <div style={{ background: WHITE, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${GRAY2}`, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={S.label}>Nueva categoría</label>
                <input style={{ ...S.input, marginBottom: 0 }} placeholder="Ej: Gorras, Ropa Deportiva..." value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCategory()} />
              </div>
              <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6, height: 42 }} onClick={handleAddCategory}><FolderPlus size={16} /> Agregar categoría</button>
            </div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 16 }}>Haz click en el icono de cada categoría para subir tu propia imagen.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16 }}>
              {categories.map(c => (
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
                  <div style={{ fontSize: 12, color: GRAY3, marginTop: 4 }}>{products.filter(p=>p.categoria_id===c.id).length} productos</div>
                </div>
              ))}
            </div>
            {/* input oculto compartido para subir icono */}
            <input ref={catFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
              const catId = Number(e.target.dataset.catId);
              const cat = categories.find(c => c.id === catId);
              if (cat) handleCatIconUpload(e, cat);
              e.target.value = "";
            }} />
          </>
        )}

        {/* ═══════════ ENVÍOS ═══════════ */}
        {tab === "shipping" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><Truck size={24} color={RED} /> Empresas de Envío</div>

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
                                <button onClick={() => handleDeleteSucursal(suc)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* FORM NUEVA SUCURSAL */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }} className="oft-dash-grid-2">
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
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><Users size={24} color={RED} /> Clientes Registrados</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
              {[["Total clientes", users.length, Users, RED], ["Con pedidos", new Set(orders.map(o => o.usuario_id)).size, ShoppingBag, "#155724"]].map(([l,n,Icon,c]) => (
                <div key={l} style={S.statCard}><Icon size={20} color={c} strokeWidth={1.8} /><div style={{ fontSize: 28, fontWeight: 900, color: c }}>{n}</div><div style={{ fontSize: 13, color: GRAY3 }}>{l}</div></div>
              ))}
            </div>
            {loadingData ? <Spinner /> : (
              <div className="oft-table-wrap" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
                <table style={S.table}>
                  <thead><tr>{["Nombre","Email","WhatsApp","Pedidos","Registrado"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", color: GRAY3, padding: 30 }}>Aún no hay clientes registrados</td></tr>
                    ) : users.map(u => {
                      const pedidosUser = orders.filter(o => o.usuario_id === u.id).length;
                      return (
                        <tr key={u.id}>
                          <td style={{ ...S.td, fontWeight: 700 }}>{u.nombre}{u.es_admin && <span style={{ marginLeft: 6, fontSize: 10, background: RED, color: WHITE, padding: "1px 6px", borderRadius: 10 }}>ADMIN</span>}</td>
                          <td style={S.td}>{u.email}</td>
                          <td style={S.td}>{u.telefono || "-"}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: RED }}>{pedidosUser}</td>
                          <td style={S.td}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  APP ROOT — Estado global + carga de datos
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("home");
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [quickView, setQuickView] = useState(null); // producto a mostrar en detalle
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000); };

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
    const init = async () => {
      try {
        const [cats, prods] = await Promise.all([
          sb.get("categorias", "?activa=eq.true&order=id"),
          sb.get("productos", "?activo=eq.true&order=id"),
        ]);
        setCategories(cats);
        setProducts(prods);
        // Empresas de envío y sucursales (no críticas, si fallan se ignoran)
        try {
          const [emps, sucs] = await Promise.all([
            sb.get("empresas_envio", "?order=id"),
            sb.get("sucursales", "?order=id"),
          ]);
          setEmpresas(emps);
          setSucursales(sucs);
        } catch(e2) { console.warn("Empresas de envío no cargadas:", e2.message); }
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
  const ctx = { view, setView, cart, setCart, addToCart, cartPulse, user, setUser, showLogin, setShowLogin, showRegister, setShowRegister, showCart, setShowCart, quickView, setQuickView, products, setProducts, categories, setCategories, empresas, setEmpresas, sucursales, setSucursales, loading, showToast };

  return (
    <AppCtx.Provider value={ctx}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; overflow-x: hidden; max-width: 100%; }
        img { max-width: 100%; }
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
        @keyframes qtyBump { 0% { transform: scale(1); } 40% { transform: scale(1.3); color: ${RED}; } 100% { transform: scale(1); } }
        .oft-qty-bump { animation: qtyBump 0.28s ease; }
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
          .oft-hero { padding: 40px 18px !important; }
          .oft-section { padding: 28px 16px !important; }
          .oft-infobar { gap: 14px !important; font-size: 11px !important; padding: 10px 14px !important; }
          .oft-admin-main { margin-left: 0 !important; padding: 18px 14px 80px !important; }
          .oft-admin-sidebar { position: fixed !important; bottom: 0 !important; top: auto !important; left: 0 !important; right: 0 !important; width: 100% !important; min-height: auto !important; height: 64px !important; flex-direction: row !important; padding: 0 !important; z-index: 200 !important; border-top: 2px solid ${RED}; }
          .oft-admin-brand { display: none !important; }
          .oft-admin-tabs { display: flex !important; flex-direction: row !important; padding: 0 !important; width: 100%; justify-content: space-around; }
          .oft-admin-tab { flex-direction: column !important; gap: 3px !important; padding: 8px 4px !important; font-size: 10px !important; border-left: none !important; border-top: 3px solid transparent; text-align: center; flex: 1; justify-content: center; }
          .oft-admin-tab.active { border-left: none !important; border-top: 3px solid white !important; }
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
          /* PRECIOS más legibles en celular */
          .oft-prod-body { padding: 12px !important; }
          .oft-price-table { padding: 10px 10px !important; }
          .oft-price-row { font-size: 12px !important; padding: 4px 0 !important; gap: 6px !important; line-height: 1.25 !important; }
          .oft-price-label { font-size: 12px !important; }
          .oft-price-big { font-size: 14px !important; }
          .oft-qty-row { flex-wrap: wrap !important; gap: 6px !important; }
          /* Bloques de presentación: iguales y sin desbordar en celular */
          .oft-pres-chip { padding: 9px 1px !important; }
          .oft-pres-label { font-size: 10px !important; }
          .oft-pres-price { font-size: 11.5px !important; }
          .oft-pres-grid { gap: 4px !important; }
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
        {view === "checkout" && <CheckoutView />}
        {view === "dashboard" && user && <DashboardView />}
        {view === "admin" && user?.es_admin && <AdminView />}
        {view === "admin" && !user?.es_admin && (
          <div style={{ ...S.section, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Lock size={48} color={GRAY3} strokeWidth={1.5} /></div>
            <p>Acceso restringido. <span style={{ color: RED, cursor: "pointer" }} onClick={() => setShowLogin(true)}>Iniciar sesión como admin</span></p>
          </div>
        )}
        {showCart && <CartModal />}
        {showLogin && <LoginModal />}
        {showRegister && <RegisterModal />}
        {quickView && <ProductModal />}
        {!isAdmin && <FloatingCart />}
        <Toast msg={toastMsg} />
      </div>
    </AppCtx.Provider>
  );
}
