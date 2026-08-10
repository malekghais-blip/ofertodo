// api/sitemap.js
//
// Genera el sitemap.xml de forma automatica, incluyendo cada producto activo del
// catalogo con su link limpio (/producto/ID) -- asi Google puede encontrar e indexar
// cada producto por separado, y el sitemap siempre esta al dia sin que haya que
// actualizarlo a mano cada vez que se agrega o quita un producto.
 
const SUPABASE_URL = "https://esezhctdiucwovbvxmou.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZXpoY3RkaXVjd292YnZ4bW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDY0NjgsImV4cCI6MjA5NjY4MjQ2OH0.5u--RCUEWH6hBrH0EFnmW1hZhuVjzqMbJax1qQh7zNo";
const SITE_URL = "https://www.ofertodo.com.pa";
 
export default async function handler(req, res) {
  let productos = [];
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/productos?activo=eq.true&select=id&order=id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    productos = await resp.json();
    if (!Array.isArray(productos)) productos = [];
  } catch (e) {
    productos = [];
  }
 
  const urlsProductos = productos
    .map((p) => `  <url>\n    <loc>${SITE_URL}/producto/${p.id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`)
    .join("\n");
 
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${urlsProductos}
</urlset>`;
 
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600"); // se actualiza cada hora como maximo
  res.status(200).send(xml);
}
 
