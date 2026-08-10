// api/og-producto.js
//
// Funcion de servidor (Vercel) que genera una version especial de la pagina cuando
// alguien visita un link de producto (/producto/ID) -- pensada para que WhatsApp,
// Facebook, etc. vean la foto/nombre/precio REALES del producto al mostrar la
// vista previa del link, en vez de la imagen generica de Ofertodo.
//
// Como funciona: toma el index.html YA COMPILADO que Vercel publico (asi siempre
// usa los nombres de archivo correctos que genera Vite, sin necesidad de adivinarlos
// aqui), le cambia el titulo/descripcion/imagen por los del producto real, y lo
// devuelve. La app de React sigue arrancando normal despues para cualquier persona
// real que abra el link -- esto SOLO cambia lo que ven los "bots" de vista previa
// (y de paso, tambien ayuda a que Google indexe cada producto por separado).

const SUPABASE_URL = "https://esezhctdiucwovbvxmou.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZXpoY3RkaXVjd292YnZ4bW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDY0NjgsImV4cCI6MjA5NjY4MjQ2OH0.5u--RCUEWH6hBrH0EFnmW1hZhuVjzqMbJax1qQh7zNo";
const SITE_URL = "https://www.ofertodo.com.pa";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  const productoId = req.query.producto;

  // 1) Busca el producto real en Supabase (si viene un ID valido)
  let producto = null;
  if (productoId) {
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/productos?id=eq.${encodeURIComponent(productoId)}&select=nombre,precio_pieza,imagen_url,referencia&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const data = await resp.json();
      producto = Array.isArray(data) && data[0] ? data[0] : null;
    } catch (e) {
      producto = null;
    }
  }

  // 2) Trae el index.html REAL ya publicado (con los nombres de archivo correctos
  //    que compilo Vite), para no tener que adivinarlos aqui a mano.
  let htmlBase;
  try {
    const origin = `https://${req.headers.host}`;
    const baseResp = await fetch(`${origin}/index.html`);
    htmlBase = await baseResp.text();
  } catch (e) {
    res.status(500).send("Error interno");
    return;
  }

  // 3) Arma el titulo/descripcion/imagen segun si encontro el producto o no
  const titulo = producto
    ? `${producto.nombre} | Ofertodo`
    : "Ofertodo - Distribuidora al por Mayor en Panamá | Ropa, Calzado y Accesorios";

  const descripcion = producto
    ? `${producto.nombre}${producto.referencia ? ` (Ref: ${producto.referencia})` : ""} — Desde $${Number(producto.precio_pieza || 0).toFixed(2)} por pieza. Distribuidora al por mayor en Panamá.`
    : "Distribuidora mayorista en Colón, Panamá. Ropa, calzado y accesorios por pieza, media docena y docena.";

  const imagen = producto?.imagen_url || `${SITE_URL}/og-image.jpg`;
  const urlActual = productoId ? `${SITE_URL}/producto/${encodeURIComponent(productoId)}` : SITE_URL;

  const metaNuevo = `
    <title>${escapeHtml(titulo)}</title>
    <meta name="description" content="${escapeHtml(descripcion)}" />
    <link rel="canonical" href="${escapeHtml(urlActual)}" />
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${escapeHtml(urlActual)}" />
    <meta property="og:title" content="${escapeHtml(titulo)}" />
    <meta property="og:description" content="${escapeHtml(descripcion)}" />
    <meta property="og:image" content="${escapeHtml(imagen)}" />
    <meta property="og:locale" content="es_PA" />
    <meta property="og:site_name" content="Ofertodo" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(titulo)}" />
    <meta name="twitter:description" content="${escapeHtml(descripcion)}" />
    <meta name="twitter:image" content="${escapeHtml(imagen)}" />
  `;

  // 4) Quita el titulo/meta original del index.html (para no duplicarlos) y mete
  //    los nuevos, especificos de este producto, justo antes de </head>
  const htmlFinal = htmlBase
    .replace(/<title>.*?<\/title>/is, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/i, "")
    .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, "")
    .replace("</head>", `${metaNuevo}\n  </head>`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache de 5 minutos: evita pegarle a Supabase en cada vista previa, sin dejar
  // datos desactualizados por mucho tiempo si cambias el precio o la foto.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).send(htmlFinal);
}
