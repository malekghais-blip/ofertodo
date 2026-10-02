// api/sitemap.js
//
// Genera el sitemap.xml de forma automatica, incluyendo cada producto activo Y
// visible del catalogo con su link limpio (/producto/ID -- el mismo formato que
// usa api/og-producto.js, donde ya estan validados los datos estructurados) --
// asi Google puede encontrar e indexar cada producto por separado, y el sitemap
// siempre esta al dia sin que haya que actualizarlo a mano cada vez que se
// agrega o quita un producto.
 
const SUPABASE_URL = "https://esezhctdiucwovbvxmou.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZXpoY3RkaXVjd292YnZ4bW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDY0NjgsImV4cCI6MjA5NjY4MjQ2OH0.5u--RCUEWH6hBrH0EFnmW1hZhuVjzqMbJax1qQh7zNo";
const SITE_URL = "https://www.ofertodo.com.pa";
 
function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
 
export default async function handler(req, res) {
  let productos = [];
  try {
    // visible_web=eq.true (no solo "distinto de false") -- en la practica todos
    // los productos activos ya tienen este campo puesto explicitamente (ni uno
    // en null), asi que es igual de seguro y mas claro de leer.
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/productos?activo=eq.true&visible_web=eq.true&select=id,imagen_url,created_at,stock_actualizado_at&order=id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    productos = await resp.json();
    if (!Array.isArray(productos)) productos = [];
  } catch (e) {
    productos = [];
  }
 
  const hoy = new Date().toISOString().split("T")[0];
 
  const urlsProductos = productos
    .map((p) => {
      const fecha = (p.stock_actualizado_at || p.created_at || "").toString().split("T")[0] || hoy;
      const imagenTag = p.imagen_url
        ? `\n    <image:image>\n      <image:loc>${escapeXml(p.imagen_url)}</image:loc>\n    </image:image>`
        : "";
      return `  <url>\n    <loc>${SITE_URL}/producto/${p.id}</loc>\n    <lastmod>${fecha}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>${imagenTag}\n  </url>`;
    })
    .join("\n");
 
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/?view=catalogo</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${urlsProductos}
</urlset>`;
 
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600"); // se actualiza cada hora como maximo
  res.status(200).send(xml);
}
