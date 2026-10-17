// Funciones y datos que usan a la vez la tienda y las pantallas de compra/cuenta.
import { presLabelPlural, presUnitPrice } from "./shared.jsx";

// ════════════════════════════════════════════════════════════════
//  🔧 CONFIGURACIÓN SUPABASE — Pega tus datos aquí
//  1. Ve a supabase.com → tu proyecto → Settings → API
//  2. Copia "Project URL" y "anon public key"
// ════════════════════════════════════════════════════════════════
export const WA_NUMBER   = "50767200474";

export function calcPrice(product, qty) {
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

export function presTotal(product, pres, count) {
  return presUnitPrice(product, pres) * count;
}

// Precio total de un item del carrito (soporta presentación o cantidad libre)
export function cartItemTotal(item) {
  if (item.esOferta) return Math.round(Number(item.precioUnidad) * item.unidades * 100) / 100;
  if (item.esFlexPack) return Number(item.precioTotal) || 0;
  if (item.pres) return presTotal(item.product, item.pres, item.count || 1);
  return calcPrice(item.product, item.qty); // compatibilidad con items viejos
}

export function cartItemLabel(item) {
  if (item.esOferta) return `${item.unidades} ${item.tipo === "combo" ? (item.unidades === 1 ? "combo" : "combos") : (item.unidades === 1 ? "oferta" : "ofertas")} · ${item.qty} pzs`;
  if (item.esFlexPack) return `Flex Pack · ${item.totalPiezas} piezas`;
  if (item.pres) return `${item.count} ${presLabelPlural(item.pres, item.count, item.product)} · ${item.qty} pzs`;
  return `${item.qty} pzs`;
}
