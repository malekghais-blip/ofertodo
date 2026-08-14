import { useState, useEffect, useRef, useContext, createContext } from "react";
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

// ═══════════════════════════════════════════════════════════════
//  ARCHIVO COMPARTIDO — piezas que usan TANTO App.jsx (la tienda,
//  para el cliente) COMO AdminView.jsx (el panel de administrador).
//  Vive separado de los dos para que ninguno dependa directamente
//  del otro (evita el problema de "dependencia circular").
// ═══════════════════════════════════════════════════════════════

export const SUPABASE_URL = "https://esezhctdiucwovbvxmou.supabase.co";  // ← Cambia esto

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZXpoY3RkaXVjd292YnZ4bW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDY0NjgsImV4cCI6MjA5NjY4MjQ2OH0.5u--RCUEWH6hBrH0EFnmW1hZhuVjzqMbJax1qQh7zNo";                  // ← Cambia esto

export const sb = {
  // Sesión del usuario logueado (se llena con setSession al iniciar sesión o al restaurar
  // desde localStorage). Mientras no haya sesión, se usa la llave pública (anon) normal.
  session: null,

  setSession(s) {
    if (!s || !s.access_token) { this.session = null; return; }
    this.session = {
      access_token: s.access_token,
      refresh_token: s.refresh_token || null,
      // expires_at viene en segundos-epoch desde Supabase; si solo viene expires_in, lo calculamos
      expires_at: s.expires_at || (s.expires_in ? Math.floor(Date.now() / 1000) + Number(s.expires_in) : null),
    };
  },
  clearSession() { this.session = null; },

  // Antes de cada petición, si el token está por vencer (o ya venció), lo renueva
  // usando el refresh_token. Si algo falla, sigue con lo que haya (nunca rompe la petición).
  async ensureFreshToken() {
    if (!this.session || !this.session.refresh_token) return;
    const margenSeg = 60;
    const ahora = Math.floor(Date.now() / 1000);
    if (this.session.expires_at && this.session.expires_at - ahora > margenSeg) return;
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.session.refresh_token }),
      });
      const data = await r.json();
      if (data.access_token) {
        this.setSession(data);
        // Actualiza también lo guardado en localStorage para que sobreviva un refresh de página
        try {
          const stored = JSON.parse(localStorage.getItem("oft_user") || "null");
          if (stored) {
            stored.token = data.access_token;
            stored.refresh_token = data.refresh_token || stored.refresh_token;
            stored.expires_at = this.session.expires_at;
            localStorage.setItem("oft_user", JSON.stringify(stored));
          }
        } catch(e) {}
      }
    } catch(e) { /* si falla la renovación, se sigue con el token anterior */ }
  },

  // Headers para peticiones de datos: usan el token de la persona logueada si existe
  // Y todavía es válido, o la llave pública (anon) si nadie ha iniciado sesión O si el
  // token venció y por algún motivo no se pudo renovar (ensureFreshToken ya lo intentó
  // antes de esto, pero si esa renovación falló, aquí es donde se evita mandar un token
  // vencido -- mandarlo hace que Supabase rechace la petición por completo).
  dataHeaders() {
    const ahora = Math.floor(Date.now() / 1000);
    const tokenSigueValido = this.session?.access_token && this.session.expires_at && this.session.expires_at > ahora;
    const token = tokenSigueValido ? this.session.access_token : SUPABASE_KEY;
    return { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" };
  },
  // Headers para llamar Edge Functions (Odoo, crear equipo, etc.) — igual que dataHeaders
  // pero SIN "Prefer", que es un header solo para tablas (PostgREST) y que las Edge Functions
  // no permiten en su configuración CORS — mandarlo hace que el navegador bloquee la petición.
  functionHeaders() {
    const ahora = Math.floor(Date.now() / 1000);
    const tokenSigueValido = this.session?.access_token && this.session.expires_at && this.session.expires_at > ahora;
    const token = tokenSigueValido ? this.session.access_token : SUPABASE_KEY;
    return { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  },
  // Headers para login/registro: siempre con la llave pública (antes de tener sesión propia)
  authHeaders() {
    return { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
  },

  url: (table, query = "") => `${SUPABASE_URL}/rest/v1/${table}${query}`,

  async get(table, query = "") {
    await this.ensureFreshToken();
    const r = await fetch(this.url(table, query), { headers: this.dataHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(table, body) {
    await this.ensureFreshToken();
    const r = await fetch(this.url(table), { method: "POST", headers: this.dataHeaders(), body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async patch(table, id, body) {
    // SEGURIDAD: nunca permitir un PATCH sin id válido (evita editar TODA la tabla)
    if (id === undefined || id === null || id === "") {
      throw new Error("patch: id inválido, operación cancelada por seguridad");
    }
    await this.ensureFreshToken();
    const r = await fetch(this.url(table, `?id=eq.${encodeURIComponent(id)}`), { method: "PATCH", headers: this.dataHeaders(), body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(table, id) {
    // SEGURIDAD: nunca permitir un DELETE sin id válido (evita borrar TODA la tabla)
    if (id === undefined || id === null || id === "") {
      throw new Error("delete: id inválido, operación cancelada por seguridad");
    }
    await this.ensureFreshToken();
    const r = await fetch(this.url(table, `?id=eq.${encodeURIComponent(id)}`), { method: "DELETE", headers: this.dataHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return true;
  },
  // Auth
  async signUp(email, password, meta) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: this.authHeaders(), body: JSON.stringify({ email, password, data: meta }) });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: this.authHeaders(), body: JSON.stringify({ email, password }) });
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
  // ── MFA / Verificación en dos pasos (TOTP tipo Google Authenticator) ──
  mfaHeaders() {
    return { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${this.session?.access_token || SUPABASE_KEY}`, "Content-Type": "application/json" };
  },
  async mfaListFactors() {
    // Endpoint dedicado para listar factores — más confiable que asumir
    // que vienen incluidos dentro de la respuesta de /auth/v1/user.
    // Como respaldo, si no devuelve nada usable, se intenta también por /auth/v1/user
    // (algunas versiones de Supabase los incluyen ahí en vez de en el endpoint dedicado).
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/factors`, { headers: this.mfaHeaders() });
      if (r.ok) {
        const data = await r.json();
        const lista = Array.isArray(data) ? data : (data?.factors || []);
        if (lista.length > 0) return lista.filter(f => f.factor_type === "totp");
      }
    } catch(e) {}
    try {
      const r2 = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: this.mfaHeaders() });
      const data2 = await r2.json();
      return (data2?.factors || []).filter(f => f.factor_type === "totp");
    } catch(e) { return []; }
  },
  async mfaEnroll() {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/factors`, {
      method: "POST", headers: this.mfaHeaders(),
      body: JSON.stringify({ factor_type: "totp", friendly_name: "Autenticador" }),
    });
    return r.json(); // { id, totp: { qr_code, secret, uri } }
  },
  async mfaChallenge(factorId) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}/challenge`, { method: "POST", headers: this.mfaHeaders() });
    return r.json(); // { id, expires_at }
  },
  async mfaVerify(factorId, challengeId, code) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}/verify`, {
      method: "POST", headers: this.mfaHeaders(),
      body: JSON.stringify({ challenge_id: challengeId, code }),
    });
    return r.json(); // éxito: { access_token, refresh_token, ... } sesión nueva ya con 2do factor confirmado
  },
  async mfaUnenroll(factorId) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}`, { method: "DELETE", headers: this.mfaHeaders() });
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
        "Authorization": `Bearer ${this.session?.access_token || SUPABASE_KEY}`,
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

export const RED = "#E31E24", RED_D = "#B01519", BLACK = "#111", GRAY = "#F5F5F5", GRAY2 = "#E0E0E0", GRAY3 = "#9E9E9E", WHITE = "#FFFFFF";

const AppCtx = createContext(null);

export const useApp = () => useContext(AppCtx);

export function useLockBodyScroll() {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);
}

const ORDER_STATUS_ENVIO = ["Pedido realizado", "Empacando pedido...", "Listo para envío", "Pedido enviado"];

const ORDER_STATUS_RETIRO = ["Pedido realizado", "Empacando pedido...", "Pedido listo para retiro", "Pedido retirado"];

export function estadosDe(order) { return order?.retiro_local ? ORDER_STATUS_RETIRO : ORDER_STATUS_ENVIO; }

const STATUS_COLORS = [
  { bg: GRAY2, color: BLACK },
  { bg: "#FFF3CD", color: "#856404" },
  { bg: "#D4EDDA", color: "#155724" },
  { bg: "#CCE5FF", color: "#004085" },
];

const STATUS_ICONS_ENVIO = [ClipboardList, RefreshCw, Package, Truck];

const STATUS_ICONS_RETIRO = [ClipboardList, RefreshCw, Package, CheckCircle2];

export function CategoryIcon({ cat, name, size = 28, color = RED }) {
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

export const S = {
  app: { fontFamily: "Helvetica, Arial, sans-serif", background: WHITE, color: BLACK, minHeight: "100vh" },
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

const LOGO_URL = "https://esezhctdiucwovbvxmou.supabase.co/storage/v1/object/public/brand/ESTE.png";

export function Logo({ onClick, height = 28 }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", cursor: onClick ? "pointer" : "default" }}>
      <img src={LOGO_URL} alt="Ofertodo" style={{ height: height, width: "auto", objectFit: "contain" }} />
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.spinner} />
      <p style={{ color: GRAY3, marginTop: 12 }}>Cargando...</p>
    </div>
  );
}

export function StatusBadge({ index, retiro = false }) {
  const s = STATUS_COLORS[index] || STATUS_COLORS[0];
  const iconos = retiro ? STATUS_ICONS_RETIRO : STATUS_ICONS_ENVIO;
  const etiquetas = retiro ? ORDER_STATUS_RETIRO : ORDER_STATUS_ENVIO;
  const Icon = iconos[index] || ClipboardList;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}>
      <Icon size={13} strokeWidth={2.2} /> {etiquetas[index]}
    </span>
  );
}

const PRES_PIEZAS = { pieza: 1, media: 6, docena: 12 };

function presLabelPlural(pres, count) {
  if (pres === "pieza") return count === 1 ? "pieza" : "piezas";
  if (pres === "media") return count === 1 ? "½ docena" : "½ docenas";
  return count === 1 ? "docena" : "docenas";
}

function presUnitPrice(product, pres) {
  if (pres === "pieza")  return Number(product.precio_pieza);
  if (pres === "media")  return Number(product.precio_media_docena);
  return Number(product.precio_docena);
}

// ═══════════════════════════════════════════════════════════════
//  ANALÍTICA — registra eventos de uso del sitio (visitas, clics en
//  categorías/productos, búsquedas, agregar al carrito) para el panel
//  de Analítica del admin. Nunca bloquea ni rompe la app si falla.
// ═══════════════════════════════════════════════════════════════

// Identificador anónimo y constante por navegador/dispositivo, para poder
// contar "visitantes únicos" sin necesidad de que se hayan registrado.
export function idVisitante() {
  try {
    let id = localStorage.getItem("oft_visitante_id");
    if (!id) {
      id = "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("oft_visitante_id", id);
    }
    return id;
  } catch (e) {
    return "v_anonimo"; // si el navegador bloquea localStorage, no rompe nada, solo agrupa distinto ese caso raro
  }
}

export function registrarEvento(tipo, valor = null, valorNombre = null, usuarioId = null) {
  try {
    sb.post("eventos_analytics", {
      tipo,
      valor: valor != null ? String(valor) : null,
      valor_nombre: valorNombre || null,
      visitante_id: idVisitante(),
      usuario_id: usuarioId || null,
    }).catch(() => {}); // best-effort: si falla, no importa, nunca debe afectar la experiencia del cliente
  } catch (e) { /* nunca truena la app por esto */ }
}

export function imagenOptimizada(url, tamano = 400, calidad = 75) {
  if (!url || !url.includes("/storage/v1/object/public/")) return url;
  // Confirmado: Supabase no comprime archivos .svg con esta transformación (los sirve
  // tal cual, ignorando el tamaño pedido) -- pedirla solo suma una vuelta de más sin
  // ningún beneficio, así que para SVG se usa la imagen original directo.
  if (url.toLowerCase().includes(".svg")) return url;
  const base = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  return base + (base.includes("?") ? "&" : "?") + `width=${tamano}&height=${tamano}&resize=contain&quality=${calidad}`;
}

// Comprime/redimensiona una foto ANTES de subirla — así las fotos de celular (que suelen
// pesar 2-3 MB) quedan livianas para la web (normalmente 80-200 KB), sin que se note
// diferencia de calidad a simple vista. Si algo falla, sube la foto original tal cual,
// para nunca bloquear al usuario por esto.
//
// Los archivos SVG normalmente se saltan (son íconos vectoriales chiquitos que no hace
// falta comprimir) -- PERO si forzarRaster=true, también se convierten a JPEG. Esto es
// para casos como los banners del carrusel, donde un "SVG" puede en realidad ser una
// composición de diseño pesada (con una foto incrustada adentro) de varios MB, y
// Supabase no sabe comprimir SVGs para servirlos más livianos como sí hace con fotos.
export function comprimirImagen(file, maxDimension = 1400, calidad = 0.82, forzarRaster = false) {
  return new Promise((resolve) => {
    const esSvg = file.type === "image/svg+xml";
    if (!file.type || !file.type.startsWith("image/") || (esSvg && !forzarRaster) || file.type === "image/gif") {
      resolve(file); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) { height = Math.round(height * (maxDimension / width)); width = maxDimension; }
          else { width = Math.round(width * (maxDimension / height)); height = maxDimension; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; } // si no mejora, sube la original
          const nombreFinal = file.name.replace(/\.\w+$/, "") + ".jpg";
          resolve(new File([blob], nombreFinal, { type: "image/jpeg" }));
        }, "image/jpeg", calidad);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function presToPiezas(pres, count) {
  return (PRES_PIEZAS[pres] || 1) * count;
}

function parseDistribucion(json) {
  if (!json) return {};
  try {
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    return obj && typeof obj === "object" ? obj : {};
  } catch { return {}; }
}

const PANAMA_ZONAS = [
  "Panamá Oeste", "La Chorrera", "Arraiján", "Capira", "Chame", "San Carlos",
  "Bocas del Toro", "Changuinola", "Almirante", "Bastimentos",
  "Coclé", "Penonomé", "Aguadulce", "Antón", "Natá", "Olá",
  "Colón", "Sabanitas", "Cristóbal", "Portobelo", "Santa Isabel",
  "Chiriquí", "David", "Boquete", "Puerto Armuelles", "Volcán", "Bugaba", "Dolega",
  "Darién", "Metetí", "La Palma", "Yaviza",
  "Herrera", "Chitré", "Ocú", "Los Pozos", "Parita",
  "Los Santos", "Las Tablas", "Guararé", "Pedasí", "Tonosí",
  "Veraguas", "Santiago", "Soná", "Atalaya", "Santa Fe",
  "Guna Yala", "Emberá", "Ngäbe-Buglé",
  "San Miguelito", "Tocumen", "Pacora", "Chilibre", "Las Cumbres", "Juan Díaz",
  "Panamá", // provincia/ciudad genérica — al final por ser la más amplia
];

export function resolverAreaVenta(pedido) {
  if (pedido.sucursal_nombre && pedido.sucursal_nombre.trim()) {
    return pedido.sucursal_nombre.trim();
  }
  const texto = `${pedido.direccion || ""}`.toLowerCase();
  if (!texto.trim()) return "Sin dirección";
  for (const zona of PANAMA_ZONAS) {
    if (texto.includes(zona.toLowerCase())) return zona;
  }
  return "Otra zona";
}

function mediaDocenaDesdeDistribucion(distDocena) {
  const entradas = Object.entries(distDocena || {}).filter(([, qty]) => Number(qty) > 0);
  if (entradas.length === 0) return {};

  const media = {};
  entradas.forEach(([k, qty]) => { media[k] = Math.max(1, Math.floor(Number(qty) / 2)); });
  let restante = 6 - Object.values(media).reduce((a, b) => a + b, 0);

  if (restante < 0) {
    // Caso raro: más de 6 tallas/colores distintos en la docena — no caben todas en 6 piezas.
    // Se recorta empezando por las variantes con MENOS unidades en la docena.
    const asc = [...entradas].sort((a, b) => Number(a[1]) - Number(b[1]));
    let i = 0;
    while (restante < 0 && i < asc.length * 3) {
      const [k] = asc[i % asc.length];
      if (media[k] > 0) { media[k] -= 1; restante += 1; }
      i++;
    }
    Object.keys(media).forEach(k => { if (media[k] <= 0) delete media[k]; });
    return media;
  }

  // Reparte lo que falta para llegar a 6, priorizando la variante que más se repite en la docena
  const desc = [...entradas].sort((a, b) => Number(b[1]) - Number(a[1]));
  let i = 0;
  while (restante > 0) {
    const [k] = desc[i % desc.length];
    media[k] += 1;
    restante -= 1;
    i++;
  }
  return media;
}

const COLOR_HEX = {
  rojo: "#E31E24", azul: "#1E63E3", verde: "#1FA64A", negro: "#111111", blanco: "#FFFFFF",
  amarillo: "#F5C518", naranja: "#F57C18", morado: "#8E44AD", rosa: "#E8569E", rosado: "#E8569E",
  gris: "#9E9E9E", cafe: "#7B4B2A", café: "#7B4B2A", marron: "#7B4B2A", marrón: "#7B4B2A",
  beige: "#E8D8B0", celeste: "#7EC8E3", turquesa: "#1ABC9C", vino: "#7B1E2B", dorado: "#D4AF37",
  plateado: "#C0C0C0", crema: "#F5F0E1", fucsia: "#E3197D",
};

const colorToHex = (name) => COLOR_HEX[(name || "").toLowerCase().trim()] || "#CCCCCC";

export function CrearPedidoView() {
  const { products, empresas, sucursales, localesRetiro, showToast } = useApp();
  const [items, setItems] = useState([]); // { product, pres, count }
  const [search, setSearch] = useState("");
  const [cliente, setCliente] = useState({ id: null, nombre: "", telefono: "", direccion: "" });
  const [clientesLista, setClientesLista] = useState([]); // clientes registrados para buscar
  const [busquedaCliente, setBusquedaCliente] = useState(""); // texto de búsqueda de cliente
  const [mostrarClientes, setMostrarClientes] = useState(false); // muestra el desplegable de resultados
  const [clienteForm, setClienteForm] = useState(null); // null | {} — modal para crear cliente directo desde aquí
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
  const [retiroLocal, setRetiroLocal] = useState(false); // true = el cliente retira en el local, sin envío
  const [localRetiroId, setLocalRetiroId] = useState(null); // en cuál local específico (si hay más de uno)
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
  // Precio real de una línea del FlexPack: usa el precio editado (override) si existe, si no el calculado
  const flexLineUnitPrice = (linea, modo) => {
    if (linea.precioOverride !== undefined && linea.precioOverride !== "" && !isNaN(Number(linea.precioOverride))) {
      return Number(linea.precioOverride);
    }
    return flexUnitPrice(linea.product, modo);
  };
  const FLEX_META = { docena: 12, media: 6 };
  const flexPiezas = (pack) => pack.lineas.reduce((s, l) => s + l.piezas, 0);
  const flexTotal = (pack) => pack.lineas.reduce((s, l) => s + flexLineUnitPrice(l, pack.modo) * l.piezas, 0);
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
  const updateFlexLinePrice = (packId, prodId, precio) => {
    setFlexPacks(prev => prev.map(pack => {
      if (pack.id !== packId) return pack;
      return { ...pack, lineas: pack.lineas.map(l => l.product.id === prodId ? { ...l, precioOverride: precio } : l) };
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
    // Siempre agrega una nueva línea — permite el mismo producto con distintas presentaciones
    // (ej: docena + 4 piezas de la misma referencia)
    setItems(prev => [...prev, { product, pres: "docena", count: 1 }]);
    setSearch("");
  };
  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      // Si cambia la presentación, se borra el precio editado (era para la otra presentación)
      if (field === "pres") return { ...it, pres: val, precioOverride: undefined };
      if (field === "count") {
        // Ajusta el arreglo de variantes (talla/color por pieza) al nuevo tamaño
        const nuevoCount = Math.max(1, val);
        const variantesActuales = it.variantes || [];
        let nuevasVariantes = variantesActuales.slice(0, nuevoCount);
        while (nuevasVariantes.length < nuevoCount) nuevasVariantes.push({ talla: "", color: "" });
        return { ...it, count: nuevoCount, variantes: nuevasVariantes };
      }
      return { ...it, [field]: val };
    }));
  };
  // Actualiza la talla o color de UNA pieza específica dentro de un item
  const updateVariantePieza = (idx, piezaIdx, campo, val) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const variantes = [...(it.variantes || Array.from({ length: it.count }, () => ({ talla: "", color: "" })))];
      variantes[piezaIdx] = { ...variantes[piezaIdx], [campo]: val };
      return { ...it, variantes };
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
    // Validar que cada pieza tenga su talla/color asignados (si el producto tiene variantes)
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.pres !== "pieza") continue;
      const requiereTalla = it.product.tiene_tallas && (it.product.tallas || "").trim();
      const requiereColor = it.product.tiene_colores && (it.product.colores || "").trim();
      if (!requiereTalla && !requiereColor) continue;
      const variantes = it.variantes && it.variantes.length === it.count ? it.variantes : [];
      const asignadas = variantes.filter(v => (!requiereTalla || v.talla) && (!requiereColor || v.color)).length;
      if (asignadas < it.count) {
        alert(`"${it.product.nombre}" tiene ${asignadas} de ${it.count} piezas con talla/color asignados. Completa todas las piezas antes de generar el pedido.`);
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
      const localElegidoAdmin = retiroLocal ? (localesRetiro.find(l => l.id === localRetiroId) || (localesRetiro.length === 1 ? localesRetiro[0] : null)) : null;
      const pedido = await sb.post("pedidos", {
        codigo, usuario_id: cliente.id || null, nombre_cliente: cliente.nombre, telefono: cliente.telefono,
        direccion: cliente.direccion, notas, total, estado: 0,
        empresa_envio_id: empresaId, empresa_envio_nombre: empresaSel?.nombre || "",
        sucursal_id: sucursalId, sucursal_nombre: sucursalSel?.nombre || "",
        retiro_local: retiroLocal,
        local_retiro_id: localElegidoAdmin?.id || null, local_retiro_nombre: localElegidoAdmin?.nombre || null,
        tipo, num_factura: numFactura, creado_por_admin: true, costo_envio: costoEnvio,
        // Las cotizaciones se marcan pagadas de una vez (no son ventas reales).
        // Los PEDIDOS se insertan como NO pagados y se marcan pagados en un segundo paso
        // (más abajo, después de crear los items) — igual que el flujo web con Yappy.
        // Esto es importante porque la sincronización con Odoo está enganchada al cambio
        // de "pagado" de false → true, no a la creación del registro: si se inserta ya
        // pagado=true de una vez, esa transición nunca ocurre y la venta no llega a Odoo.
        pagado: tipo === "cotizacion" ? true : false,
      });
      const pedidoId = pedido[0].id;
      // Productos normales — si es "pieza" y tiene variantes por pieza, se agrupan por combinación talla+color
      for (const it of items) {
        const tieneVariantesPorPieza = it.pres === "pieza" && it.variantes && it.variantes.length === it.count &&
          ((it.product.tiene_tallas && (it.product.tallas || "").trim()) || (it.product.tiene_colores && (it.product.colores || "").trim()));
        if (tieneVariantesPorPieza) {
          // Agrupa las piezas por combinación exacta de talla+color
          const grupos = {};
          it.variantes.forEach(v => {
            const key = `${v.talla || ""}|||${v.color || ""}`;
            grupos[key] = (grupos[key] || 0) + 1;
          });
          for (const key of Object.keys(grupos)) {
            const [talla, color] = key.split("|||");
            const cantidadGrupo = grupos[key];
            const variante = [talla ? `Talla: ${talla}` : null, color ? `Color: ${color}` : null].filter(Boolean).join(" · ");
            const nombreConVariante = variante ? `${it.product.nombre} (${variante})` : it.product.nombre;
            const precioUnit = itemUnitPrice(it);
            await sb.post("pedido_items", {
              pedido_id: pedidoId, producto_id: it.product.id, nombre_producto: nombreConVariante,
              cantidad: cantidadGrupo, precio_unitario: precioUnit,
              subtotal: precioUnit * cantidadGrupo,
            });
          }
        } else {
          await sb.post("pedido_items", {
            pedido_id: pedidoId, producto_id: it.product.id, nombre_producto: it.product.nombre,
            cantidad: presToPiezas(it.pres, it.count), precio_unitario: itemUnitPrice(it),
            subtotal: itemTotal(it),
          });
        }
      }
      // Líneas de FLEXPACK
      for (const pack of flexPacks) {
        const etiqueta = pack.modo === "media" ? "FLEXPACK ½ doc" : "FLEXPACK docena";
        for (const l of pack.lineas) {
          await sb.post("pedido_items", {
            pedido_id: pedidoId, producto_id: l.product.id, nombre_producto: `${l.product.nombre} (${etiqueta})`,
            cantidad: l.piezas, precio_unitario: flexLineUnitPrice(l, pack.modo),
            subtotal: flexLineUnitPrice(l, pack.modo) * l.piezas,
          });
        }
      }
      // Items para la factura (normales + flex) — agrupa piezas con variantes por combinación talla+color
      const invoiceItems = [
        ...items.flatMap(it => {
          const tieneVariantesPorPieza = it.pres === "pieza" && it.variantes && it.variantes.length === it.count &&
            ((it.product.tiene_tallas && (it.product.tallas || "").trim()) || (it.product.tiene_colores && (it.product.colores || "").trim()));
          if (tieneVariantesPorPieza) {
            const grupos = {};
            it.variantes.forEach(v => {
              const key = `${v.talla || ""}|||${v.color || ""}`;
              grupos[key] = (grupos[key] || 0) + 1;
            });
            const precioUnit = itemUnitPrice(it);
            return Object.keys(grupos).map(key => {
              const [talla, color] = key.split("|||");
              const cantidadGrupo = grupos[key];
              const variante = [talla ? `Talla: ${talla}` : null, color ? `Color: ${color}` : null].filter(Boolean).join(" · ");
              return {
                nombre: variante ? `${it.product.nombre} (${variante})` : it.product.nombre, referencia: it.product.referencia,
                presentacion: `${cantidadGrupo} pieza${cantidadGrupo > 1 ? "s" : ""}`,
                piezas: cantidadGrupo,
                precioUnit,
                subtotal: precioUnit * cantidadGrupo,
              };
            });
          }
          return [{
            nombre: it.product.nombre, referencia: it.product.referencia,
            presentacion: `${it.count} ${presLabelPlural(it.pres, it.count)}`,
            piezas: presToPiezas(it.pres, it.count),
            precioUnit: itemUnitPrice(it),
            subtotal: itemTotal(it),
          }];
        }),
        ...flexPacks.flatMap(pack => pack.lineas.map(l => ({
          nombre: l.product.nombre, referencia: l.product.referencia,
          presentacion: pack.modo === "media" ? "FLEXPACK ½ doc" : "FLEXPACK docena",
          piezas: l.piezas,
          precioUnit: flexLineUnitPrice(l, pack.modo),
          subtotal: flexLineUnitPrice(l, pack.modo) * l.piezas,
        }))),
      ];

      if (tipo !== "cotizacion") {
        // Marca el PEDIDO como pagado ahora que ya existen sus items.
        try {
          await sb.patch("pedidos", pedidoId, { pagado: true });
        } catch(e) {
          showToast("Pedido creado, pero hubo un problema marcándolo como pagado. Revísalo en Pedidos.");
        }
        // Crea la venta en Odoo directamente.
        // IMPORTANTE: la sincronización con Odoo NO está en un trigger de la base de datos —
        // vive dentro de la función "yappy-ipn", que Yappy llama únicamente cuando confirma un
        // pago real. Un pedido manual del admin nunca pasa por Yappy, así que ese webhook nunca
        // se dispara para estos pedidos. Por eso llamamos aquí, directo, a la misma función que
        // usa yappy-ipn ("crear-venta-odoo") con los mismos datos que ella le manda.
        // No bloquea el flujo si falla (igual que en yappy-ipn).
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/crear-venta-odoo`, {
            method: "POST",
            headers: sb.functionHeaders(),
            body: JSON.stringify({
              codigo, nombre_cliente: cliente.nombre, email_cliente: null,
              telefono: cliente.telefono, direccion: cliente.direccion,
              costo_envio: costoEnvio, empresa_envio: empresaSel?.nombre || "",
              items: invoiceItems.map(it => ({
                referencia: it.referencia, nombre_producto: it.nombre,
                cantidad: it.piezas,
                // Precio real POR PIEZA (derivado del subtotal, que siempre es correcto),
                // no el precio de la docena/media docena completa — así Odoo no infla el total.
                precio_unitario: it.piezas > 0 ? it.subtotal / it.piezas : it.precioUnit,
              })),
            }),
          });
        } catch(e) {
          console.error("Error creando venta en Odoo:", e);
          showToast("Pedido creado, pero no se pudo sincronizar con Odoo. Avísale a soporte.");
        }
      }

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
    setEmpresaId(null); setSucursalId(null); setRetiroLocal(false); setLocalRetiroId(null); setTipo("pedido"); setDescuento(""); setEnvio(""); setRedondeo("arriba"); setInvoice(null);
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
                    {p.imagen_url ? <img src={imagenOptimizada(p.imagen_url, 150)} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={16} color={GRAY3} /></div>}
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

                  {/* ASIGNAR TALLA Y COLOR POR CADA PIEZA — solo si es "Por pieza" y el producto tiene variantes */}
                  {it.pres === "pieza" && (it.product.tiene_tallas || it.product.tiene_colores) && (() => {
                    const tallas = (it.product.tallas || "").split(",").map(s => s.trim()).filter(Boolean);
                    const colores = (it.product.colores || "").split(",").map(s => s.trim()).filter(Boolean);
                    const requiereTalla = it.product.tiene_tallas && tallas.length > 0;
                    const requiereColor = it.product.tiene_colores && colores.length > 0;
                    const variantes = it.variantes && it.variantes.length === it.count ? it.variantes : Array.from({ length: it.count }, () => ({ talla: "", color: "" }));
                    const asignadas = variantes.filter(v => (!requiereTalla || v.talla) && (!requiereColor || v.color)).length;
                    const completo = asignadas === it.count;
                    return (
                      <div style={{ marginTop: 8, background: GRAY, borderRadius: 8, padding: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 800 }}>Talla / color por pieza</span>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: completo ? "#D4EDDA" : "#FFF3CD", color: completo ? "#155724" : "#856404" }}>
                            {asignadas}/{it.count} asignadas {completo ? "✓" : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {variantes.map((v, piezaIdx) => {
                            const piezaOk = (!requiereTalla || v.talla) && (!requiereColor || v.color);
                            return (
                              <div key={piezaIdx} style={{ background: WHITE, borderRadius: 8, padding: "8px 10px", border: `1.5px solid ${piezaOk ? "#A5D6A7" : GRAY2}` }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY3, marginBottom: 6 }}>Pieza {piezaIdx + 1} de {it.count}</div>
                                {requiereTalla && (
                                  <div style={{ marginBottom: requiereColor ? 6 : 0 }}>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                      {tallas.map(t => {
                                        const active = v.talla === t;
                                        return (
                                          <button key={t} type="button" onClick={() => updateVariantePieza(idx, piezaIdx, "talla", active ? "" : t)}
                                            style={{ minWidth: 28, padding: "3px 7px", borderRadius: 5, border: `2px solid ${active ? RED : GRAY2}`, background: active ? RED : WHITE, color: active ? WHITE : BLACK, fontWeight: 800, fontSize: 10, cursor: "pointer" }}>
                                            {t}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {requiereColor && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    {colores.map(c => {
                                      const active = v.color === c;
                                      return (
                                        <button key={c} type="button" onClick={() => updateVariantePieza(idx, piezaIdx, "color", active ? "" : c)}
                                          style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px 2px 4px", borderRadius: 14, border: `2px solid ${active ? RED : GRAY2}`, background: active ? "#FFF5F5" : WHITE, cursor: "pointer" }}>
                                          <span style={{ width: 11, height: 11, borderRadius: "50%", background: colorToHex(c), border: `1px solid ${GRAY2}` }} />
                                          <span style={{ fontSize: 10, fontWeight: 700, color: active ? RED : BLACK }}>{c}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
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
                    {pack.lineas.map(l => {
                      const precioLinea = flexLineUnitPrice(l, pack.modo);
                      const precioEditado = l.precioOverride !== undefined && l.precioOverride !== "" && Number(l.precioOverride) !== flexUnitPrice(l.product, pack.modo);
                      return (
                      <div key={l.product.id} style={{ background: WHITE, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {l.product.imagen_url ? <img src={l.product.imagen_url} style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 34, height: 34, borderRadius: 6, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={15} color={GRAY3} /></div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{l.product.nombre}</div>
                            <div style={{ fontSize: 11, color: GRAY3 }}>{money(precioLinea)}/pza · {l.product.referencia || "—"}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "2px 6px" }}>
                            <button onClick={() => updateFlexLine(pack.id, l.product.id, l.piezas - 1)} style={{ border: "none", background: "none", fontSize: 16, cursor: "pointer", color: BLACK, width: 22 }}>−</button>
                            <span style={{ fontWeight: 800, minWidth: 18, textAlign: "center", fontSize: 14 }}>{l.piezas}</span>
                            <button onClick={() => updateFlexLine(pack.id, l.product.id, l.piezas + 1)} disabled={completo} style={{ border: "none", background: "none", fontSize: 16, cursor: completo ? "not-allowed" : "pointer", color: completo ? GRAY3 : RED, width: 22 }}>+</button>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: RED, minWidth: 52, textAlign: "right" }}>{money(precioLinea * l.piezas)}</div>
                        </div>
                        {/* EDITAR PRECIO POR PIEZA DE ESTA LÍNEA */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: GRAY3, fontWeight: 700, whiteSpace: "nowrap" }}>Precio/pza $</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={l.precioOverride !== undefined ? l.precioOverride : flexUnitPrice(l.product, pack.modo)}
                            onChange={e => updateFlexLinePrice(pack.id, l.product.id, e.target.value)}
                            style={{ flex: 1, border: `1.5px solid ${precioEditado ? RED : GRAY2}`, borderRadius: 8, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", color: precioEditado ? RED : BLACK, fontWeight: precioEditado ? 800 : 400 }}
                          />
                          {precioEditado && (
                            <button onClick={() => updateFlexLinePrice(pack.id, l.product.id, undefined)} title="Volver al precio original" style={{ background: "none", border: `1.5px solid ${GRAY2}`, borderRadius: 8, padding: "4px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", color: GRAY3, whiteSpace: "nowrap" }}>
                              ↺ Original
                            </button>
                          )}
                        </div>
                      </div>
                      );
                    })}

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
                                {p.imagen_url ? <img src={imagenOptimizada(p.imagen_url, 150)} style={{ width: 30, height: 30, borderRadius: 5, objectFit: "cover" }} /> : <div style={{ width: 30, height: 30, borderRadius: 5, background: GRAY, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={14} color={GRAY3} /></div>}
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><User size={18} color={RED} /> Datos del cliente</div>
              {!cliente.id && (
                <button
                  onClick={() => setClienteForm({ nombre: cliente.nombre, telefono: cliente.telefono })}
                  className="oft-btn-press"
                  style={{ background: "none", border: "none", color: RED, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <Plus size={14} /> Crear cliente
                </button>
              )}
            </div>

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
                      }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${GRAY}`, display: "flex", alignItems: "center", gap: 10, background: WHITE }}>
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

          {clienteForm && (
            <ClienteFormModal
              cliente={clienteForm}
              showToast={showToast}
              onClose={() => setClienteForm(null)}
              onSaved={(saved) => {
                setClientesLista(prev => [saved, ...prev]);
                // Selecciona automáticamente al cliente recién creado, así el pedido queda ligado a él
                setCliente({ id: saved.id, nombre: saved.nombre || "", telefono: saved.telefono || "", direccion: cliente.direccion });
              }}
            />
          )}

          <div style={{ background: WHITE, borderRadius: 16, padding: 20, border: `1px solid ${GRAY2}` }}>
            <div style={{ fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><Truck size={18} color={RED} /> Envío (opcional)</div>
            <div onClick={() => { setRetiroLocal(v => !v); setEmpresaId(null); setSucursalId(null); setEnvio(""); }}
              style={{ display: "flex", alignItems: "center", gap: 10, background: retiroLocal ? "#FFF5F5" : GRAY, border: `1.5px solid ${retiroLocal ? RED : GRAY2}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={retiroLocal} onChange={() => {}} style={{ width: 18, height: 18, pointerEvents: "none" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Home size={14} color={retiroLocal ? RED : GRAY3} /> Retiro en el local</div>
                <div style={{ fontSize: 11, color: GRAY3 }}>El cliente pasa a recogerlo, sin empresa de envío ni costo</div>
              </div>
            </div>
            {!retiroLocal && (
              <>
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
              </>
            )}
            {retiroLocal && localesRetiro.length > 1 && (
              <select style={{ ...S.input, marginBottom: 0 }} value={localRetiroId || ""} onChange={e => setLocalRetiroId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">¿En cuál local retira?</option>
                {localesRetiro.map(loc => <option key={loc.id} value={loc.id}>{loc.nombre}</option>)}
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

function InvoiceModal({ invoice, onClose }) {
  useLockBodyScroll();
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

  return createPortal(
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onClick={onClose}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 620, width: "92%", margin: "0 auto", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {/* Barra superior con acciones - siempre visible arriba */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${GRAY2}`, background: GRAY, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={18} color="#22c55e" /> {esCot ? "Cotización" : "Pedido"} creado</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={downloadPDF} disabled={busy} className="oft-btn-press" style={{ ...S.btnRed, padding: "8px 14px", fontSize: 13, opacity: busy ? 0.7 : 1 }}>
              <Download size={14} /> PDF
            </button>
            <button onClick={downloadPNG} disabled={busy} className="oft-btn-press" style={{ ...S.btnOutline, padding: "8px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.7 : 1 }}>
              <ImageIcon size={14} /> {busy ? "..." : "PNG"}
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}><X size={22} /></button>
          </div>
        </div>

        {/* FACTURA (lo que se exporta) */}
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
      </div>
    </div>
  , document.body);
}

export function ShippingLabelModal({ order, onClose }) {
  useLockBodyScroll();
  const { products } = useApp();
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
        html, body { margin: 0; padding: 0; background: #ffffff; font-family: Helvetica, Arial, sans-serif; }
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

  return createPortal(
    <div className="oft-overlay oft-overlay-doc" style={{ ...S.overlay, alignItems: "flex-start", overflowY: "auto", padding: "20px 0", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onClick={onClose}>
      <div className="oft-qv-pop" style={{ background: WHITE, borderRadius: 16, maxWidth: 620, width: "92%", margin: "0 auto", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {/* Barra superior - siempre visible arriba */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${GRAY2}`, background: GRAY, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Truck size={18} color={RED} /> Guía de envío interna</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={downloadPDF} disabled={busy} className="oft-btn-press" style={{ ...S.btnRed, padding: "8px 14px", fontSize: 13, opacity: busy ? 0.7 : 1 }}>
              <Download size={14} /> {busy ? "..." : "PDF"}
            </button>
            <button onClick={printLabel} className="oft-btn-press" style={{ ...S.btnOutline, padding: "8px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FileText size={14} /> Imprimir
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}><X size={22} /></button>
          </div>
        </div>

        {/* GUÍA (lo que se exporta) */}
        <div style={{ padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
          <div ref={ref} style={{ background: WHITE, padding: 26, fontFamily: "Helvetica, Arial, sans-serif", color: BLACK, border: `2px solid ${BLACK}` }}>
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
                  <th style={{ textAlign: "left", padding: "8px 6px", fontSize: 11, fontWeight: 700, color: GRAY3 }}>Ref.</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", fontSize: 11, fontWeight: 700, color: GRAY3 }}>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((it, i) => {
                  const prod = products.find(p => p.id === it.producto_id);
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${GRAY2}` }}>
                      <td style={{ textAlign: "center", padding: "10px 6px" }}>
                        <span style={{ display: "inline-block", width: 18, height: 18, border: `2px solid ${BLACK}`, borderRadius: 4 }} />
                      </td>
                      <td style={{ padding: "10px", fontSize: 13, fontWeight: 700 }}>{it.nombre_producto}</td>
                      <td style={{ padding: "10px 6px", fontSize: 13, fontWeight: 700, color: GRAY3 }}>{prod?.referencia || "—"}</td>
                      <td style={{ textAlign: "center", padding: "10px 6px", fontSize: 15, fontWeight: 900 }}>{it.cantidad}</td>
                    </tr>
                  );
                })}
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
      </div>
    </div>
  , document.body);
}

export function ChipAdder({ valor, onChange, placeholder, color }) {
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

export function DistribucionEditor({ prodForm, setProdForm, activaTallas, activaColores }) {
  const tieneTallas = (activaTallas !== undefined ? activaTallas : prodForm.tiene_tallas) && (prodForm.tallas || "").trim();
  const tieneColores = (activaColores !== undefined ? activaColores : prodForm.tiene_colores) && (prodForm.colores || "").trim();
  if (!tieneTallas && !tieneColores) return null;

  const eje = prodForm.distribucion_eje || (tieneTallas ? "talla" : "color");
  const variantes = (eje === "talla" ? prodForm.tallas : prodForm.colores).split(",").map(s => s.trim()).filter(Boolean);
  const dist = parseDistribucion(prodForm.distribucion_docena);

  const setQty = (v, qty) => {
    const n = Math.max(0, Math.min(12, Number(qty.replace(/[^0-9]/g, "")) || 0));
    const nuevo = { ...dist, [v]: n };
    setProdForm({ ...prodForm, distribucion_docena: JSON.stringify(nuevo), distribucion_eje: eje });
  };

  const cambiarEje = (nuevoEje) => {
    setProdForm({ ...prodForm, distribucion_eje: nuevoEje, distribucion_docena: "" });
  };

  const total = variantes.reduce((s, v) => s + (Number(dist[v]) || 0), 0);
  const diff = 12 - total;
  const distActiva = Object.fromEntries(variantes.map(v => [v, Number(dist[v]) || 0]));
  const media = mediaDocenaDesdeDistribucion(distActiva);

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${GRAY2}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Distribución por docena (opcional)</span>
        {tieneTallas && tieneColores && (
          <select style={{ ...S.input, width: "auto", padding: "4px 8px", marginBottom: 0, fontSize: 12 }}
            value={eje} onChange={e => cambiarEje(e.target.value)}>
            <option value="talla">Distribuir por talla</option>
            <option value="color">Distribuir por color</option>
          </select>
        )}
      </div>
      <p style={{ fontSize: 12, color: GRAY3, marginBottom: 10 }}>
        Indica cuántas piezas de cada {eje} trae 1 docena completa (deben sumar 12). La media docena se calcula sola: incluye todas las {eje === "color" ? "colores" : "tallas"} y repite primero la que más se repite en la docena.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {variantes.map(v => (
          <div key={v} style={{ display: "flex", alignItems: "center", gap: 6, background: WHITE, border: `1.5px solid ${GRAY2}`, borderRadius: 10, padding: "6px 10px" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
            <input
              type="number" min="0" max="12" inputMode="numeric"
              value={dist[v] || ""} placeholder="0"
              onChange={e => setQty(v, e.target.value)}
              style={{ width: 44, border: "none", borderBottom: `2px solid ${GRAY2}`, textAlign: "center", fontWeight: 800, fontSize: 14, outline: "none" }}
            />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: diff === 0 && total > 0 ? "#1FA64A" : RED }}>
        Total: {total} / 12 {total === 0 ? "" : diff === 0 ? "✓ Completo" : diff > 0 ? `— faltan ${diff}` : `— sobran ${-diff}`}
      </div>
      {diff === 0 && total > 0 && (
        <div style={{ background: WHITE, borderRadius: 10, padding: "10px 12px", border: `1px solid ${GRAY2}`, marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GRAY3, marginBottom: 6 }}>Media docena (automático)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(media).map(([v, qty]) => (
              <span key={v} style={{ fontSize: 12, fontWeight: 700, background: GRAY, borderRadius: 8, padding: "3px 8px" }}>{qty}× {v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClienteFormModal({ cliente, onClose, onSaved, showToast }) {
  useLockBodyScroll();
  const esEdicion = !!cliente?.id;
  const [form, setForm] = useState({
    nombre: cliente?.nombre || "",
    telefono: cliente?.telefono || "",
    email: cliente?.email && !cliente.email.includes("@ofertodo.local") ? cliente.email : "",
    cedula: cliente?.cedula || "",
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) { showToast("Escribe el nombre del cliente"); return; }
    setGuardando(true);
    try {
      if (esEdicion) {
        const payload = {
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim(),
          email: form.email.trim() || cliente.email,
          cedula: form.cedula.trim() || null,
        };
        const fila = await sb.patch("usuarios", cliente.id, payload);
        onSaved({ ...cliente, ...(Array.isArray(fila) && fila[0] ? fila[0] : payload) });
        showToast("Cliente actualizado");
      } else {
        // Email opcional: si no ponen, generamos uno interno para identificarlo
        const email = form.email.trim() || `cliente_${Date.now()}@ofertodo.local`;
        const fila = await sb.post("usuarios", {
          nombre: form.nombre.trim(), telefono: form.telefono.trim(), email, es_admin: false,
          cedula: form.cedula.trim() || null, origen_cuenta: "admin_manual",
        });
        onSaved(Array.isArray(fila) && fila[0] ? fila[0] : fila);
        showToast("Cliente creado");
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
          <div style={{ fontWeight: 800, fontSize: 17 }}>{esEdicion ? "Editar cliente" : "Crear cliente"}</div>
          <button onClick={() => !guardando && onClose()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={22} /></button>
        </div>
        <label style={S.label}>Nombre *</label>
        <input style={S.input} placeholder="Nombre del cliente" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} autoFocus />
        <label style={S.label}>WhatsApp / Teléfono</label>
        <input style={S.input} placeholder="Ej: 6720-0474" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
        <label style={S.label}>Correo (opcional)</label>
        <input style={S.input} placeholder="correo@ejemplo.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <label style={S.label}>Cédula (opcional)</label>
        <input style={S.input} placeholder="Ej: 8-123-4567" value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => !guardando && onClose()} disabled={guardando} className="oft-btn-press" style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="oft-btn-press" style={{ ...S.btnRed, flex: 1, justifyContent: "center", opacity: guardando ? 0.7 : 1 }}>
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear cliente"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

export {
  AppCtx, ORDER_STATUS_ENVIO, ORDER_STATUS_RETIRO, STATUS_COLORS,
  STATUS_ICONS_ENVIO, STATUS_ICONS_RETIRO, LOGO_URL, PRES_PIEZAS,
  presLabelPlural, presUnitPrice, presToPiezas, parseDistribucion,
  PANAMA_ZONAS, mediaDocenaDesdeDistribucion, COLOR_HEX, colorToHex,
  InvoiceModal, SUPABASE_KEY,
};
