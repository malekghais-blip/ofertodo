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
  prodGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 },
  prodCard: { background: WHITE, border: `1px solid ${GRAY2}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
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
//  NAV
// ═══════════════════════════════════════════════════════════════
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
              <div key={p.id} className="oft-prod-anim" style={{ animationDelay: `${Math.min(i * 0.08, 0.5)}s` }}>
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
//  PRODUCT CARD
// ═══════════════════════════════════════════════════════════════
function ProductCard({ product }) {
  const { addToCart, showToast } = useApp();
  const [qty, setQty] = useState(12);
  const [added, setAdded] = useState(false);
  const total = calcPrice(product, qty);
  const imgUrl = product.imagen_url || null;
  const btnRef = useRef(null);

  const handleAdd = (e) => {
    addToCart(product, qty);
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
      <div data-prod-img style={{ background: GRAY, aspectRatio: "1 / 1", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {imgUrl
          ? <img src={imgUrl} alt={product.nombre} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <Package size={56} color={GRAY3} strokeWidth={1.3} />
        }
        {product.badge && <span style={{ position: "absolute", top: 10, left: 10, background: RED, color: WHITE, fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}><Sparkles size={11} /> {product.badge}</span>}
      </div>
      <div className="oft-prod-body" style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: GRAY3, fontWeight: 600, marginBottom: 4 }}>REF: {product.referencia}</div>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{product.nombre}</div>
        <div style={{ fontSize: 13, color: GRAY3, marginBottom: 12, lineHeight: 1.4 }}>{product.descripcion}</div>
        {/* TABLA DE PRECIOS REFERENCIA */}
        <div className="oft-price-table" style={S.priceTable}>
          <div className="oft-price-row" style={S.priceRow}>
            <span className="oft-price-label" style={{ color: GRAY3 }}>1–5 piezas</span>
            <span style={{ fontWeight: 800 }}>${Number(product.precio_pieza).toFixed(2)} c/u</span>
          </div>
          <div className="oft-price-row" style={S.priceRow}>
            <span className="oft-price-label" style={{ color: GRAY3 }}>Media docena (6)</span>
            <span style={{ fontWeight: 800 }}>${Number(product.precio_media_docena).toFixed(2)}</span>
          </div>
          <div className="oft-price-row" style={{ ...S.priceRow, borderTop: `1px solid ${GRAY2}`, marginTop: 4, paddingTop: 6 }}>
            <span style={{ fontWeight: 700 }}>Docena (12)</span>
            <span className="oft-price-big" style={{ fontWeight: 900, color: RED, fontSize: 15 }}>${Number(product.precio_docena).toFixed(2)}</span>
          </div>
        </div>

        {/* SELECTOR DE CANTIDAD + TOTAL CALCULADO */}
        <div style={{ marginBottom: 8 }}>
          <div className="oft-qty-row" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Cantidad:</span>
            <select
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
              style={{ border: `1.5px solid ${GRAY2}`, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontFamily: "inherit" }}
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ fontSize: 16, color: RED, fontWeight: 900 }}>${Number(total).toFixed(2)}</span>
          </div>
          {/* DESGLOSE DEL CÁLCULO */}
          <div style={{ fontSize: 11, color: GRAY3, background: GRAY, borderRadius: 6, padding: "6px 10px", display: "flex", alignItems: "center", gap: 5 }}>
            <Sparkles size={12} /> {priceBreakdown(product, qty)}
          </div>
        </div>
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
              <div key={p.id} className="oft-prod-anim" style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
      }
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
  const total = cart.reduce((s, i) => s + calcPrice(i.product, i.qty), 0);

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
  const total = cart.reduce((s, i) => s + calcPrice(i.product, i.qty), 0);

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
                  <div style={{ fontSize: 12, color: GRAY3 }}>Cant: {item.qty} · ${calcPrice(item.product, item.qty).toFixed(2)}</div>
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
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursalId, setSucursalId] = useState(null);
  const total = cart.reduce((s, i) => s + calcPrice(i.product, i.qty), 0);

  const empresasActivas = empresas.filter(e => e.activa !== false);
  const sucursalesEmpresa = sucursales.filter(s => s.empresa_id === empresaId && s.activa !== false);
  const empresaSel = empresas.find(e => e.id === empresaId);
  const sucursalSel = sucursales.find(s => s.id === sucursalId);

  const handlePlace = async () => {
    if (!empresaId) { alert("Por favor elige una empresa de envío."); return; }
    if (sucursalesEmpresa.length > 0 && !sucursalId) { alert("Por favor elige una sucursal."); return; }
    setLoading(true);
    try {
      const codigo = `OFT-${Date.now().toString().slice(-6)}`;
      const pedido = await sb.post("pedidos", {
        codigo, usuario_id: user.id, nombre_cliente: user.nombre, telefono: user.telefono,
        direccion: address, notas: notes, total, estado: 0,
        empresa_envio_id: empresaId, empresa_envio_nombre: empresaSel?.nombre || "",
        sucursal_id: sucursalId, sucursal_nombre: sucursalSel?.nombre || "",
      });
      const pedidoId = pedido[0].id;
      for (const item of cart) {
        await sb.post("pedido_items", { pedido_id: pedidoId, producto_id: item.product.id, nombre_producto: item.product.nombre, cantidad: item.qty, precio_unitario: item.product.precio_pieza, subtotal: calcPrice(item.product, item.qty) });
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
            <span>{item.product.nombre} × {item.qty}</span>
            <span style={{ fontWeight: 700 }}>${calcPrice(item.product, item.qty).toFixed(2)}</span>
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
        <label style={S.label}>Nombre</label>
        <input style={S.input} value={user?.nombre || ""} readOnly />
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
  const { user } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await sb.get("pedidos", `?usuario_id=eq.${user.id}&order=created_at.desc`);
        const withItems = await Promise.all(data.map(async o => {
          const items = await sb.get("pedido_items", `?pedido_id=eq.${o.id}`);
          return { ...o, items };
        }));
        setOrders(withItems);
      } catch(e) { console.error(e); }
      setLoading(false);
    };
    if (user?.id) load();
  }, [user]);

  if (loading) return <Spinner />;

  return (
    <div className="oft-section" style={S.section}>
      <div style={S.sectionTitle}>Mi Cuenta — <span style={{ color: GRAY3, fontWeight: 500, fontSize: 16 }}>{user?.nombre}</span></div>
      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        {[[Package, orders.length, "Pedidos totales"], [CheckCircle2, orders.filter(o => o.estado === 3).length, "Entregados"], [RefreshCw, orders.filter(o => o.estado < 3).length, "En proceso"]].map(([Icon,num,label]) => (
          <div key={label} style={S.statCard}><Icon size={22} color={RED} strokeWidth={1.8} /><div style={{ fontSize: 32, fontWeight: 900, color: RED }}>{num}</div><div style={{ fontSize: 13, color: GRAY3 }}>{label}</div></div>
        ))}
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Mis Pedidos</div>
      {orders.length === 0
        ? <div style={{ textAlign: "center", padding: "40px 0", color: GRAY3 }}><Package size={48} strokeWidth={1.3} style={{ margin: "0 auto 12px" }} /><p>Aún no tienes pedidos</p></div>
        : <div style={{ background: WHITE, borderRadius: 12, overflow: "hidden", border: `1px solid ${GRAY2}` }}>
          <table style={S.table}>
            <thead><tr>{["Pedido","Fecha","Total","Estado",""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {orders.map(o => [
                <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setSelected(selected === o.id ? null : o.id)}>
                  <td style={{ ...S.td, fontWeight: 700, color: RED }}>{o.codigo}</td>
                  <td style={S.td}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>${Number(o.total).toFixed(2)}</td>
                  <td style={S.td}><StatusBadge index={o.estado} /></td>
                  <td style={S.td}>{selected === o.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                </tr>,
                selected === o.id && (
                  <tr key={o.id+"_d"}>
                    <td colSpan={5} style={{ ...S.td, background: GRAY }}>
                      <div style={{ padding: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Productos:</div>
                        {(o.items || []).map((item, i) => (
                          <div key={i} style={{ fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Package size={14} color={GRAY3} /> {item.nombre_producto} × {item.cantidad} — ${Number(item.subtotal).toFixed(2)}</div>
                        ))}
                        <div style={{ fontWeight: 700, marginTop: 14, marginBottom: 8 }}>Estado del envío:</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {ORDER_STATUS.map((s, i) => {
                            const SIcon = STATUS_ICONS[i];
                            return <span key={i} style={{ ...STATUS_COLORS[i], padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, opacity: i <= o.estado ? 1 : 0.3, border: i === o.estado ? `2px solid ${RED}` : "2px solid transparent", display: "inline-flex", alignItems: "center", gap: 5 }}><SIcon size={12} /> {s}</span>;
                          })}
                        </div>
                        <div style={{ marginTop: 12, fontSize: 12, color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><MapPin size={13} /> Dirección: {o.direccion || "—"}</div>
                        {o.empresa_envio_nombre && <div style={{ marginTop: 6, fontSize: 12, color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><Truck size={13} /> Envío: {o.empresa_envio_nombre}{o.sucursal_nombre ? ` · ${o.sucursal_nombre}` : ""}</div>}
                      </div>
                    </td>
                  </tr>
                )
              ])}
            </tbody>
          </table>
        </div>
      }
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

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await sb.patch("pedidos", orderId, { estado: newStatus });
      setOrders(orders.map(o => o.id === orderId ? { ...o, estado: newStatus } : o));
      showToast("Estado actualizado");
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
              <div style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
                <table style={S.table}>
                  <thead><tr>{["#Pedido","Cliente","Teléfono","Envío","Total","Estado","Cambiar"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><Tag size={24} color={RED} /> Productos</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...S.btnOutline, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => { setShowBulk(!showBulk); setShowProdForm(false); }}>
                  <FileSpreadsheet size={16} /> Carga masiva
                </button>
                <button style={{ ...S.btnRed, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={openNewProduct}>
                  <Plus size={16} strokeWidth={2.5} /> Nuevo producto
                </button>
              </div>
            </div>

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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

            <div style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
              <table style={S.table}>
                <thead><tr>{["Foto","Ref","Producto","Categoría","x1","x6","x12","Estado","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td style={S.td}>
                        {p.imagen_url ? <img src={p.imagen_url} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={16} color={GRAY3} /></div>}
                      </td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{p.referencia}</td>
                      <td style={S.td}>{p.nombre}</td>
                      <td style={S.td}>{categories.find(c=>c.id===p.categoria_id)?.nombre || "-"}</td>
                      <td style={S.td}>${p.precio_pieza}</td>
                      <td style={S.td}>${p.precio_media_docena}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: RED }}>${p.precio_docena}</td>
                      <td style={S.td}><span style={{ background: p.activo ? "#D4EDDA" : GRAY2, color: p.activo ? "#155724" : BLACK, padding: "3px 8px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{p.activo ? "Activo" : "Inactivo"}</span></td>
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEditProduct(p)} style={{ background: "none", border: `1px solid ${BLACK}`, color: BLACK, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><PencilIcon size={13} /> Editar</button>
                          <button style={{ ...S.btnOutline, padding: "4px 10px", fontSize: 12 }} onClick={() => handleToggle(p)}>{p.activo ? "Ocultar" : "Mostrar"}</button>
                          <button onClick={() => handleDelete(p)} style={{ background: "none", border: `1px solid ${RED}`, color: RED, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center" }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <div style={{ background: WHITE, borderRadius: 12, overflow: "auto" }}>
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
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000); };

  const [cartPulse, setCartPulse] = useState(0);
  const addToCart = (product, qty) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { product, qty }];
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
  const ctx = { view, setView, cart, setCart, addToCart, cartPulse, user, setUser, showLogin, setShowLogin, showRegister, setShowRegister, showCart, setShowCart, products, setProducts, categories, setCategories, empresas, setEmpresas, sucursales, setSucursales, loading, showToast };

  return (
    <AppCtx.Provider value={ctx}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; overflow-x: hidden; max-width: 100%; }
        img { max-width: 100%; }

        /* ── ANIMACIONES ── */
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.92); } 60% { opacity: 1; transform: scale(1.02); } 100% { transform: scale(1); } }
        @keyframes cartBounce { 0%,100% { transform: scale(1); } 30% { transform: scale(1.35); } 60% { transform: scale(0.9); } }
        @keyframes flyToCart { 0% { opacity: 1; transform: scale(1) translate(0,0); } 100% { opacity: 0; transform: scale(0.3) translate(var(--fly-x), var(--fly-y)); } }
        @keyframes checkPop { 0% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1.15); } 100% { opacity: 0; transform: scale(1); } }
        @keyframes badgePulse { 0% { box-shadow: 0 0 0 0 rgba(227,30,36,0.5); } 100% { box-shadow: 0 0 0 10px rgba(227,30,36,0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .oft-toast-in { animation: toastIn 0.3s ease both; }

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
          .oft-modal { padding: 22px 18px !important; max-width: 100% !important; border-radius: 16px !important; }
          .oft-prod-grid { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
          .oft-cat-grid { grid-template-columns: repeat(3, 1fr) !important; }
          table { font-size: 12px !important; }
          .oft-overlay { align-items: flex-end !important; padding: 0 !important; }
          .oft-modal-sheet { border-radius: 18px 18px 0 0 !important; max-width: 100% !important; max-height: 92vh !important; }
          /* PRECIOS más legibles en celular */
          .oft-price-table { padding: 12px 12px !important; }          .oft-price-row { font-size: 13px !important; padding: 5px 0 !important; gap: 8px !important; line-height: 1.3 !important; }
          .oft-price-row span { white-space: nowrap !important; }
          .oft-price-big { font-size: 15px !important; }
          .oft-qty-row { flex-wrap: wrap !important; gap: 8px !important; }
        }
        @media (max-width: 420px) {
          .oft-cat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .oft-prod-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .oft-prod-body { padding: 12px !important; }
          .oft-price-label { font-size: 12px !important; }
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
        {!isAdmin && <FloatingCart />}
        <Toast msg={toastMsg} />
      </div>
    </AppCtx.Provider>
  );
}
