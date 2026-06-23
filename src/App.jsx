import { useState, useEffect, createContext, useContext, useRef } from "react";
import {
  ShoppingCart, Search, Trash2, MessageCircle, X, Package, CheckCircle2,
  MapPin, CreditCard, LayoutGrid, FolderOpen, Tag, Truck, Headphones,
  Plus, Pencil, Upload, RefreshCw, ChevronDown, ChevronUp, LogOut, User,
  Shirt, Footprints, Watch, Sparkles, ClipboardList, Image as ImageIcon,
  FileSpreadsheet, FolderPlus, Zap, Lock, Users, BarChart3, DollarSign,
  TrendingUp, Wallet, ShoppingBag, Pencil as PencilIcon, Save,
  Building2, MapPin as MapPinIcon, Send, FilePlus, Download, FileText, Receipt,
  Calendar as CalendarIcon
} from "lucide-react";

// ════════════════════════════════════════════════════════════════
//  🔧 CONFIGURACIÓN SUPABASE — Pega tus datos aquí
//  1. Ve a supabase.com → tu proyecto → Settings → API
//  2. Copia "Project URL" y "anon public key"
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL = "https://esezhctdiucwovbvxmou.supabase.co";  // ← Cambia esto
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZXpoY3RkaXVjd292YnZ4bW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDY0NjgsImV4cCI6MjA5NjY4MjQ2OH0.5u--RCUEWH6hBrH0EFnmW1hZhuVjzqMbJax1qQh7zNo";                  // ← Cambia esto
const WA_NUMBER   = "50767200474";                        // ← Tu número WhatsApp
const YAPPY_DIRECTORIO = "@ofertodopanama";               // ← Tu usuario en el Directorio de Yappy, para que el cliente te pague
const YAPPY_FN_CREAR = SUPABASE_URL + "/functions/v1/crear-orden-yappy"; // Edge Function que crea la orden de pago en Yappy

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
    // SEGURIDAD: nunca permitir un PATCH sin id válido (evita editar TODA la tabla)
    if (id === undefined || id === null || id === "") {
      throw new Error("patch: id inválido, operación cancelada por seguridad");
    }
    const r = await fetch(this.url(table, `?id=eq.${encodeURIComponent(id)}`), { method: "PATCH", headers: this.headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(table, id) {
    // SEGURIDAD: nunca permitir un DELETE sin id válido (evita borrar TODA la tabla)
    if (id === undefined || id === null || id === "") {
      throw new Error("delete: id inválido, operación cancelada por seguridad");
    }
    const r = await fetch(this.url(table, `?id=eq.${encodeURIComponent(id)}`), { method: "DELETE", headers: this.headers });
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
  // Inicia sesión con Google (OAuth). Redirige a Google y vuelve a la app.
  async signInWithGoogle() {
    // PKCE: generamos un verificador y su reto (challenge) para un login seguro
    const rand = (len) => {
      const arr = new Uint8Array(len); crypto.getRandomValues(arr);
      return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };
    const verifier = rand(64);
    localStorage.setItem("oft_pkce_verifier", verifier);
    // challenge = base64url( SHA-256(verifier) )
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const redirectTo = encodeURIComponent(window.location.origin);
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}&code_challenge=${challenge}&code_challenge_method=s256`;
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
  const { setView, setCatalogCat, categories, products, addToCart } = useApp();
  const featured = products.filter(p => p.activo && p.destacado);

  return (
    <>
      {/* HERO */}
      <div className="oft-hero" style={{ background: `linear-gradient(135deg, ${BLACK} 0%, #2a0000 60%, #1a0000 100%)`, color: WHITE, padding: "64px 24px", textAlign: "center" }}>
        <div style={{ background: RED, color: WHITE, fontSize: 11, fontWeight: 800, letterSpacing: 2, padding: "4px 14px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18, textTransform: "uppercase" }}>
          <Zap size={12} strokeWidth={2.5} /> Distribuidora · Panamá
        </div>
        <h1 className="oft-hero-title" style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, marginBottom: 16, letterSpacing: -1 }}>
          Compra más<br /><span style={{ color: RED }}>Crece más</span>
        </h1>
        <p style={{ color: "#ccc", fontSize: 16, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
          Compra por pieza, media docena o docena. Ropa, calzado y accesorios de calidad. Enviamos a todo Panamá.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{ ...S.btnRed, padding: "14px 30px", fontSize: 15 }} onClick={() => { setCatalogCat(0); setView("catalogo"); }}>Ver Catálogo →</button>
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
            <div key={c.id} onClick={() => { setCatalogCat(c.id); setView("catalogo"); }} style={{ background: WHITE, border: `2px solid ${GRAY2}`, borderRadius: 12, padding: "18px 10px", textAlign: "center", cursor: "pointer" }}>
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
          <button style={{ ...S.btnRed, padding: "14px 28px" }} onClick={() => { setCatalogCat(0); setView("catalogo"); }}>Ver Catálogo</button>
          <button style={{ ...S.btnWA, padding: "14px 24px" }} onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, "_blank")}><MessageCircle size={16} strokeWidth={2.2} /> WhatsApp</button>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: "#0a0a0a", color: WHITE, padding: "32px 24px" }}>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "space-between", maxWidth: 900, margin: "0 auto" }}>
          <div><Logo /><p style={{ color: "#aaa", fontSize: 13, marginTop: 10, maxWidth: 220 }}>Distribuidora · Panamá. Compra más, crece más.</p></div>
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
      <div className="oft-pres-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12, alignItems: "stretch" }}>
        {presentaciones.map(p => {
          const active = pres === p.key;
          return (
            <button key={p.key}
              onClick={() => { setPres(p.key); setCount(1); triggerBump(); }}
              className={"oft-pres-chip oft-btn-press" + (big ? " oft-pres-big" : "")}
              style={{
                padding: big ? "12px 4px" : "10px 2px", borderRadius: 10,
                border: `2px solid ${active ? RED : GRAY2}`,
                background: active ? "#FFF5F5" : WHITE,
                cursor: "pointer", transition: "all 0.18s",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                minWidth: 0, width: "100%", boxSizing: "border-box",
              }}
            >
              <div className="oft-pres-label" style={{ fontWeight: 800, color: active ? RED : BLACK, textAlign: "center", width: "100%", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden" }}>{p.label}</div>
              <div className="oft-pres-price" style={{ fontWeight: 900, color: active ? RED : BLACK, textAlign: "center", width: "100%", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden" }}>${p.precio.toFixed(2)}</div>
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
const COLOR_HEX = {
  rojo: "#E31E24", azul: "#1E63E3", verde: "#1FA64A", negro: "#111111", blanco: "#FFFFFF",
  amarillo: "#F5C518", naranja: "#F57C18", morado: "#8E44AD", rosa: "#E8569E", rosado: "#E8569E",
  gris: "#9E9E9E", cafe: "#7B4B2A", café: "#7B4B2A", marron: "#7B4B2A", marrón: "#7B4B2A",
  beige: "#E8D8B0", celeste: "#7EC8E3", turquesa: "#1ABC9C", vino: "#7B1E2B", dorado: "#D4AF37",
  plateado: "#C0C0C0", crema: "#F5F0E1", fucsia: "#E3197D",
};
const colorToHex = (name) => COLOR_HEX[(name || "").toLowerCase().trim()] || "#CCCCCC";

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
//  PRODUCT CARD
// ═══════════════════════════════════════════════════════════════
function ProductCard({ product }) {
  const { addToCart, showToast, setQuickView } = useApp();
  const [pres, setPres] = useState("docena");
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState(false);
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");
  const total = presTotal(product, pres, count);
  const imgUrl = product.imagen_url || null;
  const btnRef = useRef(null);

  // ¿Este producto tiene variantes y el cliente eligió "Por pieza"?
  const tieneVariantes = (product.tiene_tallas && (product.tallas || "").trim()) || (product.tiene_colores && (product.colores || "").trim());
  const modoConsulta = pres === "pieza" && tieneVariantes;

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
        </div>
        {/* Empuja los botones al fondo para alinear todas las tarjetas */}
        <div style={{ marginTop: "auto" }} />
        {modoConsulta ? (
          <button className="oft-btn-press" style={{ ...S.btnWA, width: "100%", justifyContent: "center", padding: 12 }} onClick={consultarWhatsApp}>
            <MessageCircle size={16} /> Consultar disponibilidad
          </button>
        ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button ref={btnRef} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", background: added ? "#25D366" : RED, transition: "background 0.3s" }} onClick={handleAdd}>
            {added ? <><CheckCircle2 size={16} className="oft-check-pop" /> ¡Agregado!</> : <><Plus size={15} strokeWidth={2.5} /> Agregar al pedido</>}
          </button>
          <button className="oft-btn-press" style={S.btnWA} onClick={() => { let m = `Hola Ofertodo, me interesa: ${product.nombre}`; if (product.referencia) m += ` (Ref: ${product.referencia})`; if (product.imagen_url) m += `\n\n📷 Foto:\n${product.imagen_url}`; window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(m)}`, "_blank"); }}><MessageCircle size={16} /></button>
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
  const { products, categories, loading, catalogCat } = useApp();
  const [catFilter, setCatFilter] = useState(catalogCat || 0);
  const [search, setSearch] = useState("");

  // Si el usuario eligió una categoría desde el inicio, ábrela
  useEffect(() => { setCatFilter(catalogCat || 0); }, [catalogCat]);

  const filtered = products.filter(p =>
    p.activo &&
    (catFilter === 0 || p.categoria_id === catFilter) &&
    (search === "" || p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.referencia || "").toLowerCase().includes(search.toLowerCase()))
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
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => { setPres("docena"); setCount(1); setAdded(false); setTalla(""); setColor(""); }, [product]);

  if (!product) return null;
  const total = presTotal(product, pres, count);
  const imgUrl = product.imagen_url || null;

  const tieneVariantes = (product.tiene_tallas && (product.tallas || "").trim()) || (product.tiene_colores && (product.colores || "").trim());
  const modoConsulta = pres === "pieza" && tieneVariantes;

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
            {modoConsulta ? (
              <div style={{ background: WHITE, borderRadius: 8, padding: "12px", marginTop: 12 }}>
                <VariantPicker product={product} talla={talla} setTalla={setTalla} color={color} setColor={setColor} />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: GRAY3, background: WHITE, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                <Sparkles size={13} /> {presBreakdown(pres, count, product)}
              </div>
            )}
          </div>

          {/* BOTONES */}
          {modoConsulta ? (
            <button className="oft-btn-press" style={{ ...S.btnWA, width: "100%", justifyContent: "center", padding: 14, fontSize: 15 }} onClick={consultarWhatsApp}>
              <MessageCircle size={18} /> Consultar disponibilidad
            </button>
          ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", padding: 14, fontSize: 15, background: added ? "#25D366" : RED, transition: "background 0.3s" }} onClick={handleAdd}>
              {added ? <><CheckCircle2 size={17} className="oft-check-pop" /> ¡Agregado!</> : <><Plus size={16} strokeWidth={2.5} /> Agregar al pedido</>}
            </button>
            <button className="oft-btn-press" style={{ ...S.btnWA, padding: "14px 16px" }} onClick={() => { let m = `Hola Ofertodo, me interesa: ${product.nombre}`; if (product.referencia) m += ` (Ref: ${product.referencia})`; if (product.imagen_url) m += `\n\n📷 Foto:\n${product.imagen_url}`; window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(m)}`, "_blank"); }}><MessageCircle size={18} /></button>
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
      <div className="oft-modal-sheet oft-modal oft-auth-pop" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><Logo /><button onClick={() => setShowLogin(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button></div>
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
        showToast("¡Cuenta creada! Revisa tu correo para confirmar y luego inicia sesión.");
        setShowRegister(false);
      }
    } catch(e) { setErr("Error de conexión."); }
    setLoading(false);
  };

  return (
    <div className="oft-overlay" style={S.overlay} onClick={() => setShowRegister(false)}>
      <div className="oft-modal-sheet oft-modal oft-auth-pop" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><Logo /><button onClick={() => setShowRegister(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button></div>
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
      setUser({ ...completeProfile.gUser, ...(perfil[0] || {}), token: completeProfile.token });
      showToast(`¡Cuenta creada! Bienvenido, ${nombre.split(" ")[0]}`);
      setCompleteProfile(null);
    } catch(e) { setErr("Error al guardar. Intenta de nuevo."); }
    setLoading(false);
  };

  return (
    <div className="oft-overlay" style={S.overlay}>
      <div className="oft-modal-sheet oft-modal oft-auth-pop" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><Logo /></div>
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
  const [estado, setEstado] = useState("listo"); // listo | cargando | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;

    // Cuando el cliente toca el botón de Yappy: creamos la orden en el backend
    const handleClick = async () => {
      setEstado("cargando");
      setErrorMsg("");
      try {
        btn.isButtonLoading = true;
        const resp = await fetch(YAPPY_FN_CREAR, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_KEY },
          body: JSON.stringify({ total: pedido.total, orderId: pedido.yappyOrderId }),
        });
        const result = await resp.json();
        // La respuesta de Yappy trae body.transactionId, body.token, body.documentName
        const body = result?.body;
        if (body && body.transactionId && body.token && body.documentName) {
          btn.eventPayment({
            transactionId: body.transactionId,
            documentName: body.documentName,
            token: body.token,
          });
        } else {
          const desc = result?.status?.description || "No se pudo iniciar el pago. Intenta de nuevo.";
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

    const handleSuccess = () => { onExito(); };
    const handleError = () => {
      setEstado("error");
      setErrorMsg("El pago no se completó. Puedes intentarlo de nuevo.");
      btn.isButtonLoading = false;
    };

    btn.addEventListener("eventClick", handleClick);
    btn.addEventListener("eventSuccess", handleSuccess);
    btn.addEventListener("eventError", handleError);
    return () => {
      btn.removeEventListener("eventClick", handleClick);
      btn.removeEventListener("eventSuccess", handleSuccess);
      btn.removeEventListener("eventError", handleError);
    };
  }, [pedido]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        {/* El botón oficial de Yappy se renderiza aquí */}
        {/* @ts-ignore */}
        <btn-yappy ref={ref} theme="sky"></btn-yappy>
      </div>
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
  const { cart, setCart, user, setView, showToast, empresas, sucursales } = useApp();
  const [address, setAddress] = useState(""), [notes, setNotes] = useState(""), [loading, setLoading] = useState(false), [placed, setPlaced] = useState(null);
  const [nombre, setNombre] = useState(user?.nombre || "");
  const [telefono, setTelefono] = useState(user?.telefono || "");
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursalId, setSucursalId] = useState(null);
  const [modoEntrega, setModoEntrega] = useState("sucursal"); // "sucursal" | "puerta"
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
    if (!nombre.trim()) { alert("Por favor escribe tu nombre."); return; }

    // Definir empresa, sucursal y dirección según el modo de entrega
    let empresaFinalId, empresaFinalNombre, sucursalFinalId, sucursalFinalNombre;

    if (modoEntrega === "puerta") {
      // Puerta a puerta: Servientrega automático + dirección obligatoria + sin sucursal
      if (!servientrega) { alert("El envío puerta a puerta no está disponible por ahora. Por favor elige una sucursal."); return; }
      if (!address.trim()) { alert("Para envío puerta a puerta, la dirección es obligatoria."); return; }
      empresaFinalId = servientrega.id;
      empresaFinalNombre = servientrega.nombre;
      sucursalFinalId = null;
      sucursalFinalNombre = "Puerta a puerta";
    } else {
      // Recoger en sucursal
      if (!empresaId) { alert("Por favor elige una empresa de envío."); return; }
      if (sucursalesEmpresa.length > 0 && !sucursalId) { alert("Por favor elige una sucursal."); return; }
      empresaFinalId = empresaId;
      empresaFinalNombre = empresaSel?.nombre || "";
      sucursalFinalId = sucursalId;
      sucursalFinalNombre = sucursalSel?.nombre || "";
    }

    setLoading(true);
    try {
      // orderId corto para Yappy (máx 15 caracteres alfanuméricos)
      const yappyOrderId = "OFT" + Date.now().toString().slice(-10);
      const codigo = `OFT-${Date.now().toString().slice(-6)}`;
      const pedido = await sb.post("pedidos", {
        codigo, usuario_id: user.id, nombre_cliente: nombre, telefono: telefono,
        direccion: address, notas: notes, total, estado: 0,
        empresa_envio_id: empresaFinalId, empresa_envio_nombre: empresaFinalNombre,
        sucursal_id: sucursalFinalId, sucursal_nombre: sucursalFinalNombre,
        pagado: false, yappy_order_id: yappyOrderId,
        descuento_codigo: descuentoAplicado?.codigo || null,
        descuento_monto: montoDescuento > 0 ? Number(montoDescuento.toFixed(2)) : 0,
      });
      const pedidoId = pedido[0].id;
      for (const item of cart) {
        await sb.post("pedido_items", { pedido_id: pedidoId, producto_id: item.product.id, nombre_producto: item.product.nombre, cantidad: item.qty, precio_unitario: item.product.precio_pieza, subtotal: cartItemTotal(item) });
      }
      // Guarda el pedido pendiente y muestra el botón de Yappy (el pago va primero)
      setPedidoPendiente({ id: pedidoId, codigo, yappyOrderId, total });
    } catch(e) { alert("Error al guardar el pedido: " + e.message); }
    setLoading(false);
  };

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
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
        </div>
      </div>

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

        {!pedidoPendiente ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: GRAY, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
              <span style={{ fontWeight: 700 }}>Total a pagar</span>
              <span style={{ fontWeight: 900, fontSize: 22, color: RED }}>{money(total)}</span>
            </div>
            <p style={{ fontSize: 13, color: GRAY3, marginBottom: 14 }}>
              Paga de forma segura con Yappy. Tu pedido se confirma apenas se reciba el pago.
            </p>
            <button style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 16, fontSize: 16, opacity: loading ? 0.7 : 1 }} onClick={handlePlace} disabled={loading}>
              {loading ? "Procesando..." : <>Continuar al pago →</>}
            </button>
          </>
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
//  CREAR PEDIDO MANUAL (ADMIN)
// ═══════════════════════════════════════════════════════════════
function CrearPedidoView() {
  const { products, empresas, sucursales, showToast } = useApp();
  const [items, setItems] = useState([]); // { product, pres, count }
  const [search, setSearch] = useState("");
  const [cliente, setCliente] = useState({ id: null, nombre: "", telefono: "", direccion: "" });
  const [clientesLista, setClientesLista] = useState([]); // clientes registrados para buscar
  const [busquedaCliente, setBusquedaCliente] = useState(""); // texto de búsqueda de cliente
  const [mostrarClientes, setMostrarClientes] = useState(false); // muestra el desplegable de resultados
  // Carga la lista de clientes para poder buscarlos al crear el pedido
  useEffect(() => {
    sb.get("usuarios", "?es_admin=eq.false&order=nombre.asc").then(d => setClientesLista(d || [])).catch(() => {});
  }, []);
  const [notas, setNotas] = useState("");
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursalId, setSucursalId] = useState(null);
  const [tipo, setTipo] = useState("pedido"); // 'pedido' | 'cotizacion'
  const [descuento, setDescuento] = useState(""); // porcentaje
  const [envio, setEnvio] = useState(""); // costo de envío
  const [redondeo, setRedondeo] = useState("arriba"); // "arriba" | "abajo" | "no"
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState(null); // datos de la factura generada
  // ── FLEXPACK: armar docena/media mezclando referencias ──
  const [flexPacks, setFlexPacks] = useState([]); // [{ id, modo:'docena'|'media', lineas:[{product, piezas}] }]
  const [flexSearch, setFlexSearch] = useState("");
  const [flexActiveId, setFlexActiveId] = useState(null); // pack al que se le está agregando

  const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const empresasActivas = empresas.filter(e => e.activa !== false);
  const sucursalesEmpresa = sucursales.filter(s => s.empresa_id === empresaId && s.activa !== false);
  const empresaSel = empresas.find(e => e.id === empresaId);
  const sucursalSel = sucursales.find(s => s.id === sucursalId);

  // Precio por pieza de un producto según el modo del pack (docena ÷12, media ÷6)
  const flexUnitPrice = (product, modo) => modo === "media" ? Number(product.precio_media_docena) / 6 : Number(product.precio_docena) / 12;
  const FLEX_META = { docena: 12, media: 6 };
  const flexPiezas = (pack) => pack.lineas.reduce((s, l) => s + l.piezas, 0);
  const flexTotal = (pack) => pack.lineas.reduce((s, l) => s + flexUnitPrice(l.product, pack.modo) * l.piezas, 0);
  const flexCompleto = (pack) => flexPiezas(pack) === FLEX_META[pack.modo];

  // Precio unitario de un item: usa el precio editado (override) si existe, si no el del producto
  const itemUnitPrice = (it) => {
    if (it.precioOverride !== undefined && it.precioOverride !== "" && !isNaN(Number(it.precioOverride))) {
      return Number(it.precioOverride);
    }
    return presUnitPrice(it.product, it.pres);
  };
  const itemTotal = (it) => itemUnitPrice(it) * it.count;

  const filtered = search.trim()
    ? products.filter(p => (p.nombre + " " + (p.referencia || "")).toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];
  const flexFiltered = flexSearch.trim()
    ? products.filter(p => (p.nombre + " " + (p.referencia || "")).toLowerCase().includes(flexSearch.toLowerCase())).slice(0, 6)
    : [];

  // FLEXPACK handlers
  const addFlexPack = (modo) => {
    const id = Date.now();
    setFlexPacks(prev => [...prev, { id, modo, lineas: [] }]);
    setFlexActiveId(id);
  };
  const removeFlexPack = (id) => setFlexPacks(prev => prev.filter(p => p.id !== id));
  const addFlexLine = (packId, product) => {
    setFlexPacks(prev => prev.map(pack => {
      if (pack.id !== packId) return pack;
      if (flexPiezas(pack) >= FLEX_META[pack.modo]) return pack; // ya está lleno
      const ex = pack.lineas.find(l => l.product.id === product.id);
      if (ex) return { ...pack, lineas: pack.lineas.map(l => l.product.id === product.id ? { ...l, piezas: l.piezas + 1 } : l) };
      return { ...pack, lineas: [...pack.lineas, { product, piezas: 1 }] };
    }));
    setFlexSearch("");
  };
  const updateFlexLine = (packId, prodId, piezas) => {
    setFlexPacks(prev => prev.map(pack => {
      if (pack.id !== packId) return pack;
      if (piezas <= 0) return { ...pack, lineas: pack.lineas.filter(l => l.product.id !== prodId) };
      // no exceder el máximo del pack
      const otras = pack.lineas.filter(l => l.product.id !== prodId).reduce((s, l) => s + l.piezas, 0);
      const max = FLEX_META[pack.modo] - otras;
      return { ...pack, lineas: pack.lineas.map(l => l.product.id === prodId ? { ...l, piezas: Math.min(piezas, max) } : l) };
    }));
  };

  const subtotalNormal = items.reduce((s, it) => s + itemTotal(it), 0);
  const subtotalFlex = flexPacks.reduce((s, pack) => s + flexTotal(pack), 0);
  const subtotal = subtotalNormal + subtotalFlex;
  const descPct = Math.min(Math.max(Number(descuento) || 0, 0), 100);
  const descMonto = subtotal * (descPct / 100);
  const costoEnvio = Number(envio) || 0;
  const totalReal = subtotal - descMonto + costoEnvio;
  // Redondeo al 0.50 o entero más cercano. Arriba: 120.10→120.50, 120.60→121.00. Abajo: 120.40→120.00, 120.90→120.50
  const totalArriba = Math.ceil(totalReal * 2) / 2;
  const totalAbajo = Math.floor(totalReal * 2) / 2;
  const totalRedondeado = redondeo === "arriba" ? totalArriba : redondeo === "abajo" ? totalAbajo : totalReal;
  const hayRedondeo = totalRedondeado !== totalReal;
  const total = totalRedondeado;

  const addItem = (product) => {
    setItems(prev => {
      const ex = prev.find(i => i.product.id === product.id && i.pres === "docena");
      if (ex) return prev;
      return [...prev, { product, pres: "docena", count: 1 }];
    });
    setSearch("");
  };
  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      // Si cambia la presentación, se borra el precio editado (era para la otra presentación)
      if (field === "pres") return { ...it, pres: val, precioOverride: undefined };
      return { ...it, [field]: val };
    }));
  };
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleGenerate = async () => {
    const hayNormales = items.length > 0;
    const hayFlex = flexPacks.length > 0;
    if (!hayNormales && !hayFlex) { alert("Agrega al menos un producto."); return; }
    if (!cliente.nombre.trim()) { alert("Escribe el nombre del cliente."); return; }
    // Validar que cada FLEXPACK esté completo
    for (let i = 0; i < flexPacks.length; i++) {
      const pack = flexPacks[i];
      if (!flexCompleto(pack)) {
        const meta = FLEX_META[pack.modo];
        alert(`El FLEXPACK ${pack.modo === "media" ? "media docena" : "docena"} #${i + 1} tiene ${flexPiezas(pack)} de ${meta} piezas. Complétalo o elimínalo.`);
        return;
      }
    }
    setSaving(true);
    try {
      // Número de factura correlativo
      let numFactura = null;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/siguiente_factura`, {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
          body: "{}",
        });
        if (r.ok) numFactura = await r.json();
      } catch(e) { /* si falla, usamos timestamp */ }
      if (!numFactura) numFactura = Number(Date.now().toString().slice(-6));

      const codigo = (tipo === "cotizacion" ? "COT-" : "OFT-") + numFactura;
      const pedido = await sb.post("pedidos", {
        codigo, usuario_id: cliente.id || null, nombre_cliente: cliente.nombre, telefono: cliente.telefono,
        direccion: cliente.direccion, notas, total, estado: 0,
        empresa_envio_id: empresaId, empresa_envio_nombre: empresaSel?.nombre || "",
        sucursal_id: sucursalId, sucursal_nombre: sucursalSel?.nombre || "",
        tipo, num_factura: numFactura, creado_por_admin: true, costo_envio: costoEnvio,
        pagado: true, // los pedidos/cotizaciones creados por el admin se consideran confirmados
      });
      const pedidoId = pedido[0].id;
      // Productos normales
      for (const it of items) {
        await sb.post("pedido_items", {
          pedido_id: pedidoId, producto_id: it.product.id, nombre_producto: it.product.nombre,
          cantidad: presToPiezas(it.pres, it.count), precio_unitario: itemUnitPrice(it),
          subtotal: itemTotal(it),
        });
      }
      // Líneas de FLEXPACK
      for (const pack of flexPacks) {
        const etiqueta = pack.modo === "media" ? "FLEXPACK ½ doc" : "FLEXPACK docena";
        for (const l of pack.lineas) {
          await sb.post("pedido_items", {
            pedido_id: pedidoId, producto_id: l.product.id, nombre_producto: `${l.product.nombre} (${etiqueta})`,
            cantidad: l.piezas, precio_unitario: flexUnitPrice(l.product, pack.modo),
            subtotal: flexUnitPrice(l.product, pack.modo) * l.piezas,
          });
        }
      }
      // Items para la factura (normales + flex)
      const invoiceItems = [
        ...items.map(it => ({
          nombre: it.product.nombre, referencia: it.product.referencia,
          presentacion: `${it.count} ${presLabelPlural(it.pres, it.count)}`,
          piezas: presToPiezas(it.pres, it.count),
          precioUnit: itemUnitPrice(it),
          subtotal: itemTotal(it),
        })),
        ...flexPacks.flatMap(pack => pack.lineas.map(l => ({
          nombre: l.product.nombre, referencia: l.product.referencia,
          presentacion: pack.modo === "media" ? "FLEXPACK ½ doc" : "FLEXPACK docena",
          piezas: l.piezas,
          precioUnit: flexUnitPrice(l.product, pack.modo),
          subtotal: flexUnitPrice(l.product, pack.modo) * l.piezas,
        }))),
      ];
      // Datos para la factura
      setInvoice({
        codigo, numFactura, tipo, fecha: new Date(),
        cliente: { ...cliente }, notas,
        empresa: empresaSel?.nombre || "", sucursal: sucursalSel?.nombre || "",
        items: invoiceItems,
        subtotal, descPct, descMonto, costoEnvio, total,
      });
      showToast(tipo === "cotizacion" ? "Cotización creada" : "Pedido creado");
    } catch(e) { alert("Error al crear: " + e.message); }
    setSaving(false);
  };

  const resetForm = () => {
    setItems([]); setFlexPacks([]); setFlexActiveId(null); setCliente({ nombre: "", telefono: "", direccion: "" }); setNotas("");
    setEmpresaId(null); setSucursalId(null); setTipo("pedido"); setDescuento(""); setEnvio(""); setRedondeo("arriba"); setInvoice(null);
  };

  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}><FilePlus size={24} color={RED} /> Crear Pedido / Cotización</div>
      <p style={{ fontSize: 13, color: GRAY3, marginBottom: 24 }}>Crea un pedido manual y genera una factura para imprimir o enviar.</p>

      {/* TIPO */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[["pedido", "Pedido", Package], ["cotizacion", "Cotización", FileText]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTipo(k)} className="oft-btn-press"
            style={{ flex: 1, padding: "14px", borderRadius: 12, border: `2px solid ${tipo === k ? RED : GRAY2}`, background: tipo === k ? "#FFF5F5" : WHITE, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 800, color: tipo === k ? RED : BLACK }}>
            <Icon size={18} /> {l}
          </button>
        ))}
      </div>

      <div className="oft-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
        {/* COLUMNA IZQUIERDA: productos */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
          <div style={{ fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><Tag size={18} color={RED} /> Productos</div>

          {/* Buscador */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={16} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input style={{ ...S.input, paddingLeft: 36, marginBottom: 0 }} placeholder="Buscar producto por nombre o referencia..." value={search} onChange={e => setSearch(e.target.value)} />
            {filtered.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 10, marginTop: 4, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                {filtered.map(p => (
                  <div key={p.id} onClick={() => addItem(p)} className="oft-cat-chip" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: `1px solid ${GRAY}` }}>
                    {p.imagen_url ? <img src={p.imagen_url} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={16} color={GRAY3} /></div>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nombre}</div>
                      <div style={{ fontSize: 11, color: GRAY3 }}>{p.referencia || "—"} · Docena ${p.precio_docena}</div>
                    </div>
                    <Plus size={18} color={RED} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items agregados */}
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: GRAY3, fontSize: 13 }}>
              <Package size={36} strokeWidth={1.3} style={{ margin: "0 auto 8px" }} />
              Busca y agrega productos al pedido
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((it, idx) => {
                const precioActual = itemUnitPrice(it);
                const precioEditado = it.precioOverride !== undefined && it.precioOverride !== "" && Number(it.precioOverride) !== presUnitPrice(it.product, it.pres);
                return (
                <div key={idx} style={{ border: `1px solid ${GRAY2}`, borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    {it.product.imagen_url ? <img src={it.product.imagen_url} style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 40, height: 40, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={18} color={GRAY3} /></div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{it.product.nombre}</div>
                      <div style={{ fontSize: 11, color: GRAY3 }}>{it.count} × {money(precioActual)} {presLabelPlural(it.pres, it.count)}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: RED }}>{money(itemTotal(it))}</div>
                    <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", display: "flex" }}><Trash2 size={16} /></button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={it.pres} onChange={e => updateItem(idx, "pres", e.target.value)} style={{ flex: 1, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "6px 8px", fontSize: 13, fontFamily: "inherit" }}>
                      <option value="pieza">Pieza (${it.product.precio_pieza})</option>
                      <option value="media">½ Docena (${it.product.precio_media_docena})</option>
                      <option value="docena">Docena (${it.product.precio_docena})</option>
                    </select>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "2px 6px" }}>
                      <button onClick={() => updateItem(idx, "count", Math.max(1, it.count - 1))} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: it.count <= 1 ? GRAY3 : BLACK, width: 24 }}>−</button>
                      <span style={{ fontWeight: 800, minWidth: 20, textAlign: "center" }}>{it.count}</span>
                      <button onClick={() => updateItem(idx, "count", it.count + 1)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: RED, width: 24 }}>+</button>
                    </div>
                  </div>
                  {/* EDITAR PRECIO UNITARIO */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: GRAY3, fontWeight: 700, whiteSpace: "nowrap" }}>Precio c/u $</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={it.precioOverride !== undefined ? it.precioOverride : presUnitPrice(it.product, it.pres)}
                      onChange={e => updateItem(idx, "precioOverride", e.target.value)}
                      style={{ flex: 1, border: `1.5px solid ${precioEditado ? RED : GRAY2}`, borderRadius: 8, padding: "6px 8px", fontSize: 13, fontFamily: "inherit", color: precioEditado ? RED : BLACK, fontWeight: precioEditado ? 800 : 400 }}
                    />
                    {precioEditado && (
                      <button onClick={() => updateItem(idx, "precioOverride", undefined)} title="Volver al precio original" style={{ background: "none", border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "5px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: GRAY3, whiteSpace: "nowrap" }}>
                        ↺ Original
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* ═══ FLEXPACK ═══ */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `2px dashed ${RED}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ background: RED, color: WHITE, fontWeight: 900, fontSize: 11, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.5 }}>FLEXPACK</div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Arma una docena o media mezclando referencias</span>
            </div>
            <p style={{ fontSize: 12, color: GRAY3, marginBottom: 12 }}>Cada pieza se cobra al precio de docena/media de su propia referencia. Debes completar la cantidad exacta.</p>

            {/* Botones para crear un pack */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={() => addFlexPack("docena")} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Plus size={15} /> Docena (12 pzs)
              </button>
              <button onClick={() => addFlexPack("media")} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Plus size={15} /> ½ Docena (6 pzs)
              </button>
            </div>

            {/* Packs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {flexPacks.map((pack, pIdx) => {
                const piezas = flexPiezas(pack);
                const meta = FLEX_META[pack.modo];
                const completo = piezas === meta;
                const pct = Math.min((piezas / meta) * 100, 100);
                const activo = flexActiveId === pack.id;
                return (
                  <div key={pack.id} style={{ border: `2px solid ${completo ? "#22c55e" : RED}`, borderRadius: 14, padding: 14, background: completo ? "#F0FDF4" : "#FFF9F9" }}>
                    {/* Cabecera del pack */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        {pack.modo === "media" ? "½ Docena" : "Docena"} FLEXPACK
                        <span style={{ fontSize: 12, fontWeight: 700, color: completo ? "#155724" : RED, background: completo ? "#D4EDDA" : "#FFE0E0", padding: "2px 8px", borderRadius: 10 }}>
                          {piezas}/{meta} {completo ? "✓" : ""}
                        </span>
                      </div>
                      <button onClick={() => removeFlexPack(pack.id)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", display: "flex" }}><Trash2 size={16} /></button>
                    </div>

                    {/* Barra de progreso */}
                    <div style={{ height: 6, background: GRAY2, borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: completo ? "#22c55e" : RED, borderRadius: 3, transition: "width 0.3s ease" }} />
                    </div>

                    {/* Líneas del pack */}
                    {pack.lineas.map(l => (
                      <div key={l.product.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, background: WHITE, borderRadius: 8, padding: "8px 10px" }}>
                        {l.product.imagen_url ? <img src={l.product.imagen_url} style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 34, height: 34, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={15} color={GRAY3} /></div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{l.product.nombre}</div>
                          <div style={{ fontSize: 11, color: GRAY3 }}>{money(flexUnitPrice(l.product, pack.modo))}/pza · {l.product.referencia || "—"}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "2px 6px" }}>
                          <button onClick={() => updateFlexLine(pack.id, l.product.id, l.piezas - 1)} style={{ border: "none", background: "none", fontSize: 16, cursor: "pointer", color: BLACK, width: 22 }}>−</button>
                          <span style={{ fontWeight: 800, minWidth: 18, textAlign: "center", fontSize: 14 }}>{l.piezas}</span>
                          <button onClick={() => updateFlexLine(pack.id, l.product.id, l.piezas + 1)} disabled={completo} style={{ border: "none", background: "none", fontSize: 16, cursor: completo ? "not-allowed" : "pointer", color: completo ? GRAY3 : RED, width: 22 }}>+</button>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: RED, minWidth: 52, textAlign: "right" }}>{money(flexUnitPrice(l.product, pack.modo) * l.piezas)}</div>
                      </div>
                    ))}

                    {/* Buscador para agregar al pack */}
                    {!completo && (
                      <div style={{ position: "relative", marginTop: 8 }}>
                        <input
                          style={{ ...S.input, marginBottom: 0, fontSize: 13 }}
                          placeholder={`Agregar referencia (faltan ${meta - piezas})`}
                          value={activo ? flexSearch : ""}
                          onFocus={() => setFlexActiveId(pack.id)}
                          onChange={e => { setFlexActiveId(pack.id); setFlexSearch(e.target.value); }}
                        />
                        {activo && flexFiltered.length > 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 10, marginTop: 4, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                            {flexFiltered.map(p => (
                              <div key={p.id} onClick={() => addFlexLine(pack.id, p)} className="oft-cat-chip" style={{ padding: 9, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: `1px solid ${GRAY}` }}>
                                {p.imagen_url ? <img src={p.imagen_url} style={{ width: 30, height: 30, borderRadius: 5, objectFit: "cover" }} /> : <div style={{ width: 30, height: 30, borderRadius: 5, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={14} color={GRAY3} /></div>}
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, fontSize: 12 }}>{p.nombre}</div>
                                  <div style={{ fontSize: 10, color: GRAY3 }}>{p.referencia || "—"} · {money(flexUnitPrice(p, pack.modo))}/pza</div>
                                </div>
                                <Plus size={16} color={RED} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Total del pack */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${GRAY2}`, fontWeight: 800, fontSize: 14 }}>
                      <span>{completo ? "Total del pack" : `Faltan ${meta - piezas} piezas`}</span>
                      <span style={{ color: RED }}>{money(flexTotal(pack))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TOTALES (se muestran si hay productos normales o flexpacks) */}
          {subtotal > 0 && (
            <div style={{ marginTop: 16 }}>
              {/* DESCUENTO Y ENVÍO */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 10, borderTop: `1px solid ${GRAY2}` }}>
                <div>
                  <label style={{ ...S.label, fontSize: 11 }}>Descuento (%)</label>
                  <input style={{ ...S.input, marginBottom: 0 }} type="number" min="0" max="100" placeholder="0" value={descuento} onChange={e => setDescuento(e.target.value)} />
                </div>
                <div>
                  <label style={{ ...S.label, fontSize: 11 }}>Costo de envío ($)</label>
                  <input style={{ ...S.input, marginBottom: 0 }} type="number" min="0" placeholder="0.00" value={envio} onChange={e => setEnvio(e.target.value)} />
                </div>
              </div>
              {/* RESUMEN */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 10, borderTop: `1px solid ${GRAY2}`, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: GRAY3 }}>
                  <span>Subtotal</span><span>{money(subtotal)}</span>
                </div>
                {descPct > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#155724" }}>
                    <span>Descuento ({descPct}%)</span><span>−{money(descMonto)}</span>
                  </div>
                )}
                {costoEnvio > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: GRAY3 }}>
                    <span>Envío</span><span>+{money(costoEnvio)}</span>
                  </div>
                )}
                {/* REDONDEO: arriba / abajo / no */}
                <div style={{ marginTop: 6, padding: "10px 0", borderTop: `1px dashed ${GRAY2}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    Redondear total
                    {hayRedondeo && redondeo !== "no" && (
                      <span style={{ fontSize: 10, color: redondeo === "arriba" ? "#155724" : "#7B1E1E", background: redondeo === "arriba" ? "#D4EDDA" : "#FBE0E0", padding: "1px 6px", borderRadius: 8 }}>
                        {redondeo === "arriba" ? "+" : "−"}{money(Math.abs(totalRedondeado - totalReal))}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["arriba","Arriba ↑"],["abajo","Abajo ↓"],["no","Exacto"]].map(([k,l]) => (
                      <button key={k} onClick={() => setRedondeo(k)} className="oft-btn-press"
                        style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `2px solid ${redondeo === k ? RED : GRAY2}`, background: redondeo === k ? RED : WHITE, color: redondeo === k ? WHITE : BLACK, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {redondeo !== "no" && hayRedondeo && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: GRAY3, fontSize: 12 }}>
                    <span style={{ textDecoration: "line-through" }}>Total real {money(totalReal)}</span>
                    <span style={{ color: redondeo === "arriba" ? "#155724" : "#7B1E1E" }}>redondeado {redondeo === "arriba" ? "↑" : "↓"}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18, marginTop: 4 }}>
                  <span>Total</span>
                  <span key={total} className="oft-total-pop" style={{ color: RED }}>{money(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: datos del cliente */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
            <div style={{ fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><User size={18} color={RED} /> Datos del cliente</div>

            {/* BUSCAR CLIENTE EXISTENTE */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <label style={S.label}>Buscar cliente registrado</label>
              <div style={{ position: "relative" }}>
                <Search size={15} color={GRAY3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  style={{ ...S.input, paddingLeft: 34, marginBottom: 0 }}
                  placeholder="Escribe nombre o teléfono..."
                  value={busquedaCliente}
                  onChange={e => { setBusquedaCliente(e.target.value); setMostrarClientes(true); }}
                  onFocus={() => setMostrarClientes(true)}
                />
              </div>
              {/* Resultados */}
              {mostrarClientes && busquedaCliente.trim() && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 10, marginTop: 4, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                  {clientesLista
                    .filter(c => {
                      const q = busquedaCliente.toLowerCase();
                      return (c.nombre || "").toLowerCase().includes(q) || (c.telefono || "").includes(q);
                    })
                    .slice(0, 8)
                    .map(c => (
                      <div key={c.id} onClick={() => {
                        setCliente({ id: c.id, nombre: c.nombre || "", telefono: c.telefono || "", direccion: cliente.direccion });
                        setBusquedaCliente("");
                        setMostrarClientes(false);
                        showToast(`Cliente: ${c.nombre}`);
                      }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${GRAY}`, display: "flex", alignItems: "center", gap: 10 }}
                      onMouseEnter={e => e.currentTarget.style.background = GRAY}
                      onMouseLeave={e => e.currentTarget.style.background = WHITE}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${RED}, ${RED_D})`, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                          {(c.nombre || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{c.nombre}</div>
                          <div style={{ fontSize: 12, color: GRAY3 }}>{c.telefono || "Sin teléfono"}</div>
                        </div>
                      </div>
                    ))}
                  {clientesLista.filter(c => { const q = busquedaCliente.toLowerCase(); return (c.nombre || "").toLowerCase().includes(q) || (c.telefono || "").includes(q); }).length === 0 && (
                    <div style={{ padding: "12px 14px", fontSize: 13, color: GRAY3 }}>No se encontró ese cliente. Puedes escribir sus datos abajo.</div>
                  )}
                </div>
              )}
            </div>

            <label style={S.label}>Nombre *</label>
            <input style={S.input} placeholder="Nombre del cliente" value={cliente.nombre} onChange={e => setCliente({ ...cliente, id: null, nombre: e.target.value })} />
            <label style={S.label}>WhatsApp / Teléfono</label>
            <input style={S.input} placeholder="Ej: 6720-0474" value={cliente.telefono} onChange={e => setCliente({ ...cliente, telefono: e.target.value })} />
            <label style={S.label}>Dirección / referencia</label>
            <input style={S.input} placeholder="Opcional" value={cliente.direccion} onChange={e => setCliente({ ...cliente, direccion: e.target.value })} />
          </div>

          <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
            <div style={{ fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><Truck size={18} color={RED} /> Envío (opcional)</div>
            <select style={S.input} value={empresaId || ""} onChange={e => { setEmpresaId(e.target.value ? Number(e.target.value) : null); setSucursalId(null); }}>
              <option value="">Sin empresa de envío</option>
              {empresasActivas.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
            </select>
            {empresaId && sucursalesEmpresa.length > 0 && (
              <select style={{ ...S.input, marginBottom: 0 }} value={sucursalId || ""} onChange={e => setSucursalId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Elige sucursal</option>
                {sucursalesEmpresa.map(suc => <option key={suc.id} value={suc.id}>{suc.nombre}</option>)}
              </select>
            )}
          </div>

          <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
            <div style={{ fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><FileText size={18} color={RED} /> Notas</div>
            <textarea style={{ ...S.input, marginBottom: 0, resize: "vertical" }} rows={3} placeholder="Notas del pedido (opcional)" value={notas} onChange={e => setNotas(e.target.value)} />
          </div>

          <button onClick={handleGenerate} disabled={saving} className="oft-btn-press"
            style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 16, fontSize: 16, opacity: saving ? 0.7 : 1 }}>
            <Receipt size={18} /> {saving ? "Generando..." : `Generar ${tipo === "cotizacion" ? "cotización" : "pedido"} y factura`}
          </button>
        </div>
      </div>

      {/* MODAL DE FACTURA */}
      {invoice && <InvoiceModal invoice={invoice} onClose={() => { resetForm(); }} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FACTURA (genera PDF + PNG)
// ═══════════════════════════════════════════════════════════════
function InvoiceModal({ invoice, onClose }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esCot = invoice.tipo === "cotizacion";

  // Renderiza la factura a un ancho fijo (640px) fuera de pantalla,
  // así el PDF/imagen nunca sale cortado en celular.
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
      const canvas = await window.html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", useCORS: true, width: 640, windowWidth: 640 });
      return canvas;
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
      const file = new File([blob], `${invoice.codigo}.png`, { type: "image/png" });
      if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: invoice.codigo });
          setBusy(false);
          return;
        } catch(shareErr) {
          // si el usuario cancela el compartir, caemos a descarga normal
          if (shareErr.name === "AbortError") { setBusy(false); return; }
        }
      }
      // Descarga normal (escritorio o si no hay compartir)
      const link = document.createElement("a");
      link.download = `${invoice.codigo}.png`;
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
      // Si la factura es más alta que una página, la parte en varias páginas
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
      pdf.save(`${invoice.codigo}.pdf`);
    } catch(e) { alert("Error generando PDF: " + e.message); }
    setBusy(false);
  };

  return (
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0" }} onClick={onClose}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 620, width: "92%", margin: "0 auto", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {/* Barra superior con acciones */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${GRAY2}`, background: GRAY }}>
          <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={18} color="#22c55e" /> {esCot ? "Cotización" : "Pedido"} creado</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>

        {/* FACTURA (lo que se exporta) */}
        <div style={{ padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
          <div ref={ref} style={{ background: WHITE, padding: 28, fontFamily: "'Inter','Segoe UI',sans-serif", color: BLACK }}>
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
                <div style={{ fontWeight: 900, fontSize: 20, color: esCot ? "#856404" : RED, textTransform: "uppercase" }}>{esCot ? "Cotización" : "Factura"}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>N° {invoice.numFactura}</div>
                <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>{invoice.codigo}</div>
                <div style={{ fontSize: 11, color: GRAY3, marginTop: 4 }}>{invoice.fecha.toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" })}</div>
              </div>
            </div>

            {/* Datos del cliente */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 10, color: GRAY3, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Cliente</div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{invoice.cliente.nombre}</div>
                {invoice.cliente.telefono && <div style={{ fontSize: 12, color: GRAY3 }}>{invoice.cliente.telefono}</div>}
                {invoice.cliente.direccion && <div style={{ fontSize: 12, color: GRAY3 }}>{invoice.cliente.direccion}</div>}
              </div>
              {invoice.empresa && (
                <div style={{ minWidth: 160, textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: GRAY3, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Envío</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{invoice.empresa}</div>
                  {invoice.sucursal && <div style={{ fontSize: 12, color: GRAY3 }}>{invoice.sucursal}</div>}
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
                {invoice.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${GRAY2}` }}>
                    <td style={{ padding: "9px 10px", fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{it.nombre}</div>
                      <div style={{ fontSize: 10, color: GRAY3 }}>{it.referencia ? `Ref: ${it.referencia} · ` : ""}{it.presentacion} · {it.piezas} pzs</div>
                    </td>
                    <td style={{ textAlign: "center", padding: "9px 6px", fontSize: 12 }}>{it.piezas}</td>
                    <td style={{ textAlign: "right", padding: "9px 6px", fontSize: 12 }}>{money(it.precioUnit)}</td>
                    <td style={{ textAlign: "right", padding: "9px 10px", fontSize: 12, fontWeight: 700 }}>{money(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <div style={{ minWidth: 240 }}>
                {(invoice.descMonto > 0 || invoice.costoEnvio > 0) && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", fontSize: 13, color: GRAY3 }}>
                      <span>Subtotal</span><span>{money(invoice.subtotal)}</span>
                    </div>
                    {invoice.descMonto > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", fontSize: 13, color: "#155724" }}>
                        <span>Descuento ({invoice.descPct}%)</span><span>−{money(invoice.descMonto)}</span>
                      </div>
                    )}
                    {invoice.costoEnvio > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", fontSize: 13, color: GRAY3 }}>
                        <span>Envío</span><span>+{money(invoice.costoEnvio)}</span>
                      </div>
                    )}
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: RED, color: WHITE, borderRadius: 8, fontWeight: 900, fontSize: 16, marginTop: 4 }}>
                  <span>TOTAL</span><span>{money(invoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Notas */}
            {invoice.notas && (
              <div style={{ background: GRAY, borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: GRAY3, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Notas</div>
                <div style={{ fontSize: 12 }}>{invoice.notas}</div>
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

        {/* Botones de descarga */}
        <div style={{ display: "flex", gap: 10, padding: "14px 18px", borderTop: `1px solid ${GRAY2}`, flexWrap: "wrap" }}>
          <button onClick={downloadPDF} disabled={busy} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", minWidth: 140, opacity: busy ? 0.7 : 1 }}>
            <Download size={16} /> Descargar PDF
          </button>
          <button onClick={downloadPNG} disabled={busy} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center", minWidth: 140, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.7 : 1 }}>
            <ImageIcon size={16} /> {busy ? "Generando..." : "Guardar en fotos"}
          </button>
          <button onClick={onClose} className="oft-btn-press" style={{ ...S.btnBlack, justifyContent: "center" }}>Listo</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GUÍA DE ENVÍO INTERNA (para empaque y despacho — NO para el cliente)
// ═══════════════════════════════════════════════════════════════
function ShippingLabelModal({ order, onClose }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const fecha = order.created_at ? new Date(order.created_at) : new Date();
  const totalPiezas = (order.items || []).reduce((s, it) => s + Number(it.cantidad || 0), 0);
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderCanvas = async () => {
    const source = ref.current;
    const clone = source.cloneNode(true);
    const holder = document.createElement("div");
    holder.style.position = "fixed"; holder.style.left = "-10000px"; holder.style.top = "0";
    holder.style.width = "640px"; holder.style.background = "#ffffff";
    clone.style.width = "640px"; clone.style.maxWidth = "640px";
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      return await window.html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", useCORS: true, width: 640, windowWidth: 640 });
    } finally { document.body.removeChild(holder); }
  };

  const downloadPDF = async () => {
    if (!window.html2canvas || !window.jspdf) { alert("Cargando generador, intenta de nuevo en unos segundos."); return; }
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const imgW = 190, imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, 10, imgW, imgH);
      pdf.save(`GUIA-${order.codigo}.pdf`);
    } catch(e) { alert("Error generando PDF: " + e.message); }
    setBusy(false);
  };

  const printLabel = () => {
    const contenido = ref.current.outerHTML;
    const estilos = `
      <style>
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        @page { margin: 12mm; }
        html, body { margin: 0; padding: 0; background: #ffffff; font-family: 'Inter','Segoe UI',sans-serif; }
      </style>`;
    // Usa un iframe OCULTO en la misma página: no abre ventana nueva, así no recarga
    // la app ni cierra la sesión en celular.
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<html><head><title>Guía ${order.codigo}</title>${estilos}</head><body>${contenido}</body></html>`);
    doc.close();
    // Esperar a que cargue el contenido (imágenes) antes de imprimir
    const lanzarImpresion = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch(e) { /* si falla, no hacemos nada */ }
      // Quitar el iframe después de imprimir
      setTimeout(() => { try { document.body.removeChild(iframe); } catch(e) {} }, 1000);
    };
    setTimeout(lanzarImpresion, 500);
  };

  return (
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0" }} onClick={onClose}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 620, width: "92%", margin: "0 auto", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {/* Barra superior */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${GRAY2}`, background: GRAY }}>
          <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Truck size={18} color={RED} /> Guía de envío interna</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>

        {/* GUÍA (lo que se exporta) */}
        <div style={{ padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
          <div ref={ref} style={{ background: WHITE, padding: 26, fontFamily: "'Inter','Segoe UI',sans-serif", color: BLACK, border: `2px solid ${BLACK}` }}>
            {/* Encabezado */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2px solid ${BLACK}`, paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", fontWeight: 900, fontSize: 22, letterSpacing: -1 }}>
                  <span style={{ color: RED }}>Ofer</span>
                  <span style={{ background: RED, color: WHITE, padding: "0 7px", borderRadius: 4, marginLeft: 2 }}>todo</span>
                </div>
                <div style={{ fontSize: 11, color: GRAY3, marginTop: 4, fontWeight: 700, letterSpacing: 1 }}>GUÍA DE ENVÍO · USO INTERNO</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{order.codigo}</div>
                <div style={{ fontSize: 11, color: GRAY3, marginTop: 2 }}>{fecha.toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" })}</div>
              </div>
            </div>

            {/* EMPRESA DE ENVÍO — lo más importante, bien grande */}
            <div style={{ background: RED, color: WHITE, borderRadius: 10, padding: "14px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, letterSpacing: 1 }}>ENVIAR POR</div>
              <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>{order.empresa_envio_nombre || "— Sin empresa asignada —"}</div>
              {order.sucursal_nombre && <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>📍 Sucursal: {order.sucursal_nombre}</div>}
            </div>

            {/* ESTADO DEL PAGO DEL ENVÍO */}
            {(() => {
              const envioPagado = Number(order.costo_envio || 0) > 0;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 10, padding: "12px 16px", marginBottom: 16, border: `2px solid ${envioPagado ? "#155724" : "#856404"}`, background: envioPagado ? "#E6F4EA" : "#FFF8E1" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: envioPagado ? "#155724" : "#856404", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {envioPagado ? <CheckCircle2 size={22} color="#fff" /> : <DollarSign size={22} color="#fff" />}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: envioPagado ? "#155724" : "#856404", lineHeight: 1.1 }}>
                      {envioPagado ? "ENVÍO PAGADO" : "COBRO DE ENVÍO PENDIENTE"}
                    </div>
                    <div style={{ fontSize: 12, color: envioPagado ? "#155724" : "#856404", marginTop: 2 }}>
                      {envioPagado ? "El cliente ya pagó el envío" : "Cobrar el envío al entregar / en destino"}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* DATOS DEL DESTINATARIO */}
            <div style={{ border: `2px solid ${BLACK}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY3, letterSpacing: 1, marginBottom: 8 }}>DESTINATARIO</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{order.nombre_cliente || "—"}</div>
              {order.telefono && <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>📱 {order.telefono}</div>}
              {order.direccion && <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.4 }}>📍 {order.direccion}</div>}
            </div>

            {/* RESUMEN DE EMPAQUE */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, border: `2px solid ${BLACK}`, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: GRAY3, fontWeight: 700 }}>PRODUCTOS</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{(order.items || []).length}</div>
              </div>
              <div style={{ flex: 1, border: `2px solid ${BLACK}`, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: GRAY3, fontWeight: 700 }}>PIEZAS TOTALES</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{totalPiezas}</div>
              </div>
            </div>

            {/* CHECKLIST DE EMPAQUE */}
            <div style={{ fontSize: 11, fontWeight: 700, color: GRAY3, letterSpacing: 1, marginBottom: 8 }}>CHECKLIST DE EMPAQUE</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: GRAY }}>
                  <th style={{ width: 28, padding: "8px 6px", fontSize: 11, fontWeight: 700, color: GRAY3, textAlign: "center" }}>✓</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: GRAY3 }}>Producto</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", fontSize: 11, fontWeight: 700, color: GRAY3 }}>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((it, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${GRAY2}` }}>
                    <td style={{ textAlign: "center", padding: "10px 6px" }}>
                      <span style={{ display: "inline-block", width: 18, height: 18, border: `2px solid ${BLACK}`, borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: "10px", fontSize: 13, fontWeight: 700 }}>{it.nombre_producto}</td>
                    <td style={{ textAlign: "center", padding: "10px 6px", fontSize: 15, fontWeight: 900 }}>{it.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* NOTAS */}
            {order.notas && (
              <div style={{ marginTop: 16, border: `2px dashed ${GRAY3}`, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: GRAY3, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>NOTAS DEL PEDIDO</div>
                <div style={{ fontSize: 13 }}>{order.notas}</div>
              </div>
            )}

            {/* Pie */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${GRAY2}`, display: "flex", justifyContent: "space-between", fontSize: 11, color: GRAY3 }}>
              <span>Empacado por: _______________</span>
              <span>Despachado: _______________</span>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: 10, padding: "14px 18px", borderTop: `1px solid ${GRAY2}`, flexWrap: "wrap" }}>
          <button onClick={downloadPDF} disabled={busy} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", minWidth: 140, opacity: busy ? 0.7 : 1 }}>
            <Download size={16} /> {busy ? "Generando..." : "Descargar PDF"}
          </button>
          <button onClick={printLabel} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center", minWidth: 120, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileText size={16} /> Imprimir
          </button>
          <button onClick={onClose} className="oft-btn-press" style={{ ...S.btnBlack, justifyContent: "center" }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AGREGAR CHIPS UNO POR UNO (tallas / colores)
// ═══════════════════════════════════════════════════════════════
function ChipAdder({ valor, onChange, placeholder, color }) {
  const [input, setInput] = useState("");
  const items = (valor || "").split(",").map(s => s.trim()).filter(Boolean);

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (items.some(i => i.toLowerCase() === v.toLowerCase())) { setInput(""); return; }
    onChange([...items, v].join(", "));
    setInput("");
  };
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx).join(", "));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: items.length ? 10 : 0 }}>
        <input
          style={{ ...S.input, marginBottom: 0 }}
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="oft-btn-press" style={{ background: color, color: WHITE, border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 800, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>+</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((it, idx) => (
            <span key={idx} className="oft-chip-pop" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 20, padding: "5px 8px 5px 12px", fontSize: 13, fontWeight: 700 }}>
              {it}
              <button type="button" onClick={() => remove(idx)} style={{ background: GRAY2, border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: BLACK }}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  EDITAR COTIZACIÓN
// ═══════════════════════════════════════════════════════════════
function EditCotizacionModal({ cotizacion, empresas, sucursales, onClose, onSaved, showToast }) {
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

  return (
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0" }} onClick={() => !guardando && onClose()}>
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
  const emptyProd = { referencia: "", nombre: "", descripcion: "", categoria_id: categories[0]?.id || 1, precio_pieza: "", precio_media_docena: "", precio_docena: "", badge: "", activo: true, destacado: false, imagen_url: "", tiene_tallas: false, tiene_colores: false, tallas: "", colores: "" };
  const [prodForm, setProdForm] = useState(emptyProd);
  const fileInputRef = useRef(null);
  const catFileRef = useRef(null);
  // Carga masiva CON imágenes (crea borradores)
  const [showBulkImg, setShowBulkImg] = useState(false);
  const [bulkImgCat, setBulkImgCat] = useState(categories[0]?.id || 1);
  const [bulkImgLoading, setBulkImgLoading] = useState(false);
  const [bulkImgProgress, setBulkImgProgress] = useState({ done: 0, total: 0 });
  const bulkImgRef = useRef(null);
  // Filtro por categoría en la página de productos
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  // Edición masiva (selección por checkboxes)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const emptyBulkEdit = { nombre: "", precio_pieza: "", precio_media_docena: "", precio_docena: "", badge: "", descripcion: "", activo: "", destacado: "", tiene_tallas: "", tallas: "", tiene_colores: "", colores: "" };
  const [bulkEdit, setBulkEdit] = useState(emptyBulkEdit);
  const [shippingLabel, setShippingLabel] = useState(null); // pedido para la guía de envío
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null); // pedido pendiente de eliminar (confirmación)
  const [cotizacionAEditar, setCotizacionAEditar] = useState(null); // cotización que se está editando
  const [nuevoCliente, setNuevoCliente] = useState(null); // {nombre, telefono, email} o null; modal crear cliente
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  // ── DESCUENTOS ──
  const [descuentos, setDescuentos] = useState([]); // lista de códigos de descuento
  const [descForm, setDescForm] = useState(null); // formulario crear/editar descuento o null
  const [guardandoDesc, setGuardandoDesc] = useState(false);
  const [descProductosOpen, setDescProductosOpen] = useState(false); // selector de productos en el form
  const [busquedaCotizacion, setBusquedaCotizacion] = useState(""); // buscar cotización por nombre de cliente
  const [eliminando, setEliminando] = useState(false);
  // Filtro de ventas por periodo en el dashboard
  const [rangoVentas, setRangoVentas] = useState("todo"); // dia | semana | mes | anio | todo | personalizado | rango
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
  // Nota: retornos y flete de retorno aún no existen en el sistema → 0.00 (próximamente)
  const desglose = (() => {
    let descuentos = 0, envios = 0, totales = 0;
    pedidosReales.forEach(o => {
      totales += Number(o.total || 0);
      envios += Number(o.costo_envio || 0);
      // Si el pedido guardó un descuento en monto, lo sumamos (si existe el campo)
      descuentos += Number(o.descuento_monto || 0);
    });
    const retornos = 0;          // próximamente
    const fleteRetorno = 0;      // próximamente
    // Venta bruta = total - envíos + descuentos (lo que valían los productos antes de ajustes)
    const bruta = totales - envios + descuentos;
    const netas = bruta - descuentos - retornos;
    return { bruta, descuentos, retornos, netas, envios, fleteRetorno, totales };
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

  // ── CONVERTIR COTIZACIÓN EN PEDIDO ─────────────────────────────
  const convertirAPedido = async (cot) => {
    const ok = confirm(`¿Convertir la cotización ${cot.codigo} en un pedido real?\n\nSe registrará como venta de HOY y aparecerá en Pedidos.`);
    if (!ok) return;
    try {
      // Nuevo código de pedido (mantiene el número de factura)
      const nuevoCodigo = "OFT-" + (cot.num_factura || Date.now().toString().slice(-6));
      // La fecha pasa a HOY: la venta cuenta el día en que se confirma, no el día de la cotización
      const ahora = new Date().toISOString();
      await sb.patch("pedidos", cot.id, { tipo: "pedido", codigo: nuevoCodigo, estado: 0, created_at: ahora });
      setOrders(prev => prev.map(o => o.id === cot.id ? { ...o, tipo: "pedido", codigo: nuevoCodigo, estado: 0, created_at: ahora } : o));
      showToast(`¡Cotización convertida en pedido ${nuevoCodigo}!`);
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

  // ── CREAR CLIENTE MANUALMENTE ──────────────────────────────────
  const crearClienteManual = async () => {
    if (!nuevoCliente?.nombre?.trim()) { showToast("Escribe el nombre del cliente"); return; }
    setGuardandoCliente(true);
    try {
      // Email opcional: si no ponen, generamos uno interno para identificarlo
      const email = (nuevoCliente.email || "").trim() || `cliente_${Date.now()}@ofertodo.local`;
      const fila = await sb.post("usuarios", {
        nombre: nuevoCliente.nombre.trim(),
        telefono: (nuevoCliente.telefono || "").trim(),
        email,
        es_admin: false,
      });
      if (Array.isArray(fila) && fila[0]) setUsers(prev => [fila[0], ...prev]);
      showToast("Cliente creado");
      setNuevoCliente(null);
    } catch(e) {
      showToast("Error: " + (e.message || "no se pudo crear"));
    }
    setGuardandoCliente(false);
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
    setProdForm({ referencia: p.referencia || "", nombre: p.nombre || "", descripcion: p.descripcion || "", categoria_id: p.categoria_id || categories[0]?.id || 1, precio_pieza: p.precio_pieza, precio_media_docena: p.precio_media_docena, precio_docena: p.precio_docena, badge: p.badge || "", activo: p.activo, destacado: p.destacado || false, imagen_url: p.imagen_url || "", tiene_tallas: p.tiene_tallas || false, tiene_colores: p.tiene_colores || false, tallas: p.tallas || "", colores: p.colores || "" });
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
    if (bulkEdit.destacado !== "") patch.destacado = bulkEdit.destacado === "1";
    // Tallas: si activa "Sí", guarda la lista; si activa "No", apaga y limpia
    if (bulkEdit.tiene_tallas === "1") { patch.tiene_tallas = true; if (bulkEdit.tallas.trim() !== "") patch.tallas = bulkEdit.tallas.trim(); }
    if (bulkEdit.tiene_tallas === "0") { patch.tiene_tallas = false; }
    // Colores: igual
    if (bulkEdit.tiene_colores === "1") { patch.tiene_colores = true; if (bulkEdit.colores.trim() !== "") patch.colores = bulkEdit.colores.trim(); }
    if (bulkEdit.tiene_colores === "0") { patch.tiene_colores = false; }
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
    ["crear", "Crear", FilePlus],
    ["products", "Productos", Tag],
    ["categories", "Categorías", FolderOpen],
    ["descuentos", "Descuentos", Zap],
    ["shipping", "Envíos", Truck],
    ["users", "Clientes", Users],
  ];

  const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="oft-admin-sidebar" style={{ background: WHITE, color: BLACK, width: 230, minHeight: "100vh", padding: "24px 0", position: "fixed", top: 0, left: 0, zIndex: 90, borderRight: `1px solid ${GRAY2}` }}>
        <div className="oft-admin-brand" style={{ padding: "0 22px 22px", borderBottom: `1px solid ${GRAY2}` }}><Logo /><div style={{ fontSize: 11, color: GRAY3, marginTop: 6, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}><Zap size={11} /> Panel Administrador</div></div>
        <div className="oft-admin-tabs" style={{ padding: "16px 12px" }}>
          {tabs.map(([k,l,Icon]) => (
            <div key={k} className={"oft-admin-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)} style={{ padding: "11px 16px", marginBottom: 4, cursor: "pointer", fontWeight: tab === k ? 800 : 600, fontSize: 14, color: tab === k ? WHITE : GRAY3, background: tab === k ? RED : "transparent", borderRadius: 10, display: "flex", alignItems: "center", gap: 11, transition: "all 0.18s ease" }}>
              <Icon size={18} strokeWidth={tab === k ? 2.4 : 2} /> {l}
            </div>
          ))}
        </div>
      </div>

      <div className="oft-admin-main" style={{ marginLeft: 230, padding: "32px", minHeight: "100vh", background: GRAY, boxSizing: "border-box", overflowX: "hidden" }}>
       <div key={tab} className="oft-tab-anim" style={{ minWidth: 0 }}>

        {/* ═══════════ CREAR PEDIDO ═══════════ */}
        {tab === "crear" && <CrearPedidoView />}

        {/* ═══════════ DASHBOARD ═══════════ */}
        {tab === "dashboard" && (
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
                        ["Retornos", desglose.retornos, true, true],
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
                        <StatusBadge index={o.estado} />
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

        {/* ═══════════ PEDIDOS ═══════════ */}
        {tab === "orders" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}><Package size={24} color={RED} /> Pedidos Recibidos</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
              {[["Total",pedidosReales.length,RED,ClipboardList],["En proceso",pedidosReales.filter(o=>o.estado<3).length,"#856404",RefreshCw],["Entregados",pedidosReales.filter(o=>o.estado===3).length,"#155724",CheckCircle2]].map(([l,n,c,Icon]) => (
                <div key={l} style={S.statCard}><Icon size={20} color={c} strokeWidth={1.8} /><div style={{ fontSize: 28, fontWeight: 900, color: c }}>{n}</div><div style={{ fontSize: 13, color: GRAY3 }}>{l}</div></div>
              ))}
            </div>
            {loadingData ? <Spinner /> : (
              <>
              {/* TABLA (solo escritorio) */}
              <div className="oft-table-wrap oft-only-desktop" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
                <table style={S.table}>
                  <thead><tr>{["#Pedido","Cliente","Teléfono","Envío","Total","Estado","Cambiar","Avisar"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {pedidosReales.map(o => (
                      <tr key={o.id}>
                        <td style={{ ...S.td, fontWeight: 700, color: RED }}>
                          {o.codigo}
                          {o.pagado === false && <div style={{ marginTop: 3, display: "inline-block", background: "#FFF3CD", color: "#856404", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>SIN PAGAR</div>}
                          {o.pagado === true && <div style={{ marginTop: 3, display: "inline-block", background: "#D4EDDA", color: "#155724", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>PAGADO</div>}
                        </td>
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
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => notifyWhatsApp(o, o.estado)} title="Enviar notificación por WhatsApp" style={{ ...S.btnWA, padding: "6px 10px", fontSize: 12 }}>
                              <MessageCircle size={14} /> Avisar
                            </button>
                            <button onClick={() => setShippingLabel(o)} title="Generar guía de envío" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Truck size={14} /> Guía
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
                {pedidosReales.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: GRAY3 }}>No hay pedidos aún</div>
                ) : pedidosReales.map(o => (
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
                        <div style={{ marginTop: 4 }}><StatusBadge index={o.estado} /></div>
                      </div>
                    </div>

                    {/* Envío */}
                    {o.empresa_envio_nombre && (
                      <div style={{ fontSize: 12, color: GRAY3, background: GRAY, borderRadius: 8, padding: "8px 10px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <Truck size={14} color={RED} /> {o.empresa_envio_nombre}{o.sucursal_nombre ? ` · ${o.sucursal_nombre}` : ""}
                      </div>
                    )}

                    {/* Cambiar estado */}
                    <label style={{ fontSize: 12, fontWeight: 700, color: GRAY3, display: "block", marginBottom: 4 }}>Cambiar estado:</label>
                    <select value={o.estado} onChange={e => handleStatusChange(o.id, Number(e.target.value))} style={{ width: "100%", border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", marginBottom: 10 }}>
                      {ORDER_STATUS.map((s,i) => <option key={i} value={i}>{s}</option>)}
                    </select>

                    {/* Avisar + Guía + Eliminar */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => notifyWhatsApp(o, o.estado)} style={{ ...S.btnWA, flex: 1, justifyContent: "center", padding: 12 }}>
                        <MessageCircle size={16} /> Avisar
                      </button>
                      <button onClick={() => setShippingLabel(o)} style={{ background: BLACK, color: WHITE, border: "none", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Truck size={16} /> Guía
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
            {/* MODAL CONFIRMAR ELIMINACIÓN */}
            {pedidoAEliminar && (
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
            )}
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

        {/* MODAL CREAR CLIENTE */}
        {nuevoCliente && (
          <div className="oft-overlay" style={S.overlay} onClick={() => !guardandoCliente && setNuevoCliente(null)}>
            <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 420, width: "92%", padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><Users size={18} color={RED} /> Nuevo cliente</div>
                <button onClick={() => setNuevoCliente(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
              </div>
              <label style={S.label}>Nombre *</label>
              <input style={S.input} placeholder="Nombre del cliente" value={nuevoCliente.nombre} onChange={e => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} autoFocus />
              <label style={S.label}>WhatsApp / Teléfono</label>
              <input style={S.input} placeholder="Ej: 6720-0474" value={nuevoCliente.telefono} onChange={e => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
              <label style={S.label}>Email (opcional)</label>
              <input style={S.input} placeholder="correo@ejemplo.com" value={nuevoCliente.email} onChange={e => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={() => setNuevoCliente(null)} disabled={guardandoCliente} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
                <button onClick={crearClienteManual} disabled={guardandoCliente} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardandoCliente ? 0.7 : 1 }}>
                  {guardandoCliente ? "Guardando..." : "Crear cliente"}
                </button>
              </div>
            </div>
          </div>
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

            {selectMode && (
              <div style={{ background: "#FFF5F5", border: `2px solid ${RED}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedIds.length} seleccionado(s)</span>
                <button style={{ ...S.btnOutline, padding: "6px 12px", fontSize: 13 }} onClick={selectAll}>
                  {selectedIds.length === products.length ? "Quitar todos" : "Seleccionar todos"}
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
                    <ChipAdder valor={prodForm.colores} onChange={v => setProdForm({...prodForm, colores: v})} placeholder="Ej: Rojo, Azul, Negro..." color={BLACK} />
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={handleSaveProd}><Save size={16} /> {editingId ? "Guardar cambios" : "Crear producto"}</button>
                  <button style={S.btnOutline} onClick={() => { setShowProdForm(false); setEditingId(null); }}>Cancelar</button>
                </div>
              </div>
            )}

            {/* ESTADO VACÍO: categoría sin productos */}
            {(() => {
              const lista = filtroCategoria === "todas" ? products : products.filter(p => p.categoria_id === filtroCategoria);
              if (lista.length === 0) {
                const catNombre = filtroCategoria === "todas" ? "" : (categories.find(c => c.id === filtroCategoria)?.nombre || "");
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
            {(filtroCategoria === "todas" ? products : products.filter(p => p.categoria_id === filtroCategoria)).length > 0 && (
            <div className="oft-table-wrap oft-only-desktop" style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
              <table style={S.table}>
                <thead><tr>{[...(selectMode ? ["✓"] : []), "Foto","Ref","Producto","Categoría","x1","x6","x12","Estado","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {(filtroCategoria === "todas" ? products : products.filter(p => p.categoria_id === filtroCategoria)).map(p => {
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
            )}

            {/* TARJETAS (solo celular) */}
            <div className="oft-only-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(filtroCategoria === "todas" ? products : products.filter(p => p.categoria_id === filtroCategoria)).map(p => {
                const isSel = selectedIds.includes(p.id);
                return (
                  <div key={p.id} style={{ background: WHITE, borderRadius: 14, border: `2px solid ${isSel ? RED : GRAY2}`, padding: 14 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {selectMode && (
                        <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} style={{ width: 22, height: 22, accentColor: RED, cursor: "pointer", flexShrink: 0, marginTop: 2 }} />
                      )}
                      {p.imagen_url
                        ? <img src={p.imagen_url} style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
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

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEditProduct(p)} style={{ flex: 1, background: BLACK, color: WHITE, border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><PencilIcon size={15} /> Editar</button>
                      <button onClick={() => handleToggle(p)} style={{ ...S.btnOutline, padding: "10px 14px", fontSize: 13 }}>{p.activo ? "Ocultar" : "Mostrar"}</button>
                      <button onClick={() => handleDelete(p)} style={{ background: "none", border: `1.5px solid ${RED}`, color: RED, borderRadius: 8, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN MASIVA */}
            {showBulkDelete && (
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
            )}

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
                  <label style={S.label}>Producto destacado</label>
                  <select style={S.input} value={bulkEdit.destacado} onChange={e => setBulkEdit({...bulkEdit, destacado: e.target.value})}>
                    <option value="">No cambiar</option>
                    <option value="1">Sí — mostrar en inicio</option>
                    <option value="0">No destacado</option>
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
                    <ChipAdder valor={bulkEdit.colores} onChange={v => setBulkEdit({...bulkEdit, colores: v})} placeholder="Ej: Rojo, Azul, Negro..." color={BLACK} />
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
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

        {/* ═══════════ DESCUENTOS ═══════════ */}
        {tab === "descuentos" && (
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
              <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 16px" }} onClick={() => !guardandoDesc && setDescForm(null)}>
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
                              {p.imagen_url ? <img src={p.imagen_url} style={{ width: 30, height: 30, borderRadius: 5, objectFit: "cover" }} /> : <div style={{ width: 30, height: 30, borderRadius: 5, background: GRAY }} />}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Users size={24} color={RED} /> Clientes Registrados</div>
              <button onClick={() => setNuevoCliente({ nombre: "", telefono: "", email: "" })} className="oft-btn-press" style={{ ...S.btnRed, padding: "10px 18px", fontSize: 14 }}>
                <Plus size={16} /> Crear cliente
              </button>
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
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </>
        )}
       </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  APP ROOT — Estado global + carga de datos
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("home");
  // El carrito se guarda en el navegador para que NO se pierda al iniciar sesión o recargar
  const [cart, setCart] = useState(() => {
    try { const g = localStorage.getItem("oft_cart"); return g ? JSON.parse(g) : []; } catch(e) { return []; }
  });
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [quickView, setQuickView] = useState(null); // producto a mostrar en detalle
  const [catalogCat, setCatalogCat] = useState(0); // categoría a abrir en el catálogo (0 = todas)
  const [completeProfile, setCompleteProfile] = useState(null); // usuario de Google que debe completar sus datos
  const [pendingCheckout, setPendingCheckout] = useState(false); // el cliente quería pagar y tuvo que loguearse
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000); };

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
      let token = null;

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
        token = new URLSearchParams(hash.substring(1)).get("access_token");
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
            if (!token) alert("No se pudo completar el inicio con Google (código). Detalle: " + (data.error_description || data.msg || JSON.stringify(data)).toString().slice(0, 200));
          } catch(e) { alert("Error de conexión al validar Google: " + e.message); }
        }
      }

      if (token) {
        try {
          const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` } });
          const gUser = await r.json();
          window.history.replaceState(null, "", window.location.origin + window.location.pathname);
          if (gUser && gUser.email) {
            const nombre = gUser.user_metadata?.full_name || gUser.user_metadata?.name || gUser.email.split("@")[0];
            let perfil = [];
            try { perfil = await sb.get("usuarios", `?email=eq.${encodeURIComponent(gUser.email)}&limit=1`); } catch(e) {}
            if (perfil && perfil.length > 0) {
              setUser({ ...gUser, ...perfil[0], token });
              showToast(`¡Bienvenido de vuelta, ${perfil[0].nombre?.split(" ")[0] || ""}!`);
            } else {
              setCompleteProfile({ email: gUser.email, nombre, token, gUser });
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
  const ctx = { view, setView, cart, setCart, addToCart, cartPulse, user, setUser, showLogin, setShowLogin, showRegister, setShowRegister, showCart, setShowCart, quickView, setQuickView, catalogCat, setCatalogCat, completeProfile, setCompleteProfile, pendingCheckout, setPendingCheckout, products, setProducts, categories, setCategories, empresas, setEmpresas, sucursales, setSucursales, loading, showToast };

  return (
    <AppCtx.Provider value={ctx}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; overflow-x: hidden; max-width: 100%; }
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
          .oft-hero { padding: 40px 18px !important; }
          .oft-section { padding: 28px 16px !important; }
          .oft-infobar { gap: 14px !important; font-size: 11px !important; padding: 10px 14px !important; }
          .oft-admin-main { margin-left: 0 !important; padding: 18px 14px 80px !important; }
          .oft-admin-sidebar { position: fixed !important; bottom: 0 !important; top: auto !important; left: 0 !important; right: 0 !important; width: 100% !important; min-height: auto !important; height: 62px !important; flex-direction: row !important; padding: 0 !important; z-index: 200 !important; border-right: none !important; border-top: 1px solid ${GRAY2} !important; box-shadow: 0 -2px 12px rgba(0,0,0,0.06); }
          .oft-admin-brand { display: none !important; }
          .oft-admin-tabs { display: flex !important; flex-direction: row !important; padding: 6px 4px !important; margin: 0 !important; width: 100%; justify-content: space-between; overflow-x: auto; gap: 2px; }
          .oft-admin-tab { flex-direction: column !important; gap: 3px !important; padding: 6px 8px !important; margin-bottom: 0 !important; font-size: 9.5px !important; border-radius: 10px !important; text-align: center; justify-content: center; flex: 0 0 auto; min-width: 56px; white-space: nowrap; }
          .oft-admin-tab.active { background: ${RED} !important; }
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
        {completeProfile && <CompleteProfileModal />}
        {quickView && <ProductModal />}
        {!isAdmin && <FloatingCart />}
        <Toast msg={toastMsg} />
      </div>
    </AppCtx.Provider>
  );
}
