// Pantallas de compra y cuenta del cliente. Se descargan solo cuando alguien entra a ellas.
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Package, CheckCircle2, MapPin, CreditCard, Truck, Headphones, RefreshCw, ChevronDown, ChevronUp, User, Home, Sparkles, ClipboardList, Lock, Pencil as PencilIcon, Building2, MapPin as MapPinIcon, AlertTriangle } from "lucide-react";
import { BLACK, GRAY, GRAY2, GRAY3, ORDER_STATUS_ENVIO, ORDER_STATUS_RETIRO, RED, RED_D, S, STATUS_ICONS_ENVIO, STATUS_ICONS_RETIRO, SUPABASE_KEY, SUPABASE_URL, Spinner, StatusBadge, WHITE, idVisitante, registrarEvento, obtenerTokenRecaptcha, trackIniciarCheckout, trackCompra, imagenOptimizada, sb, useApp, prorratearLinea, envioPerfumesAplica, useEnvioPerfumes, stockWeb } from "./shared.jsx";
import { WA_NUMBER, cartItemTotal, cartItemLabel } from "./tiendaComun.jsx";

// ← Tu usuario en el Directorio de Yappy, para que el cliente te pague
const YAPPY_FN_CREAR = SUPABASE_URL + "/functions/v1/crear-orden-yappy";

// Lista de productos del carrito para los píxeles de marketing (Flex Pack no se cuenta; una oferta cuenta como un artículo)
function itemsTrackDeCarrito(cart) {
  return cart.filter(i => !i.esFlexPack).map(i => i.esOferta
    ? { id: `oferta-${i.ofertaId}`, nombre: i.titulo, precio: i.precioUnidad, cantidad: i.unidades }
    : { id: i.product.id, nombre: i.product.nombre, precio: i.product.precio_pieza, cantidad: i.qty });
}

// ═══════════════════════════════════════════════════════════════
//  HOME
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  PÁGINAS LEGALES: Términos, Devoluciones, Privacidad
// ═══════════════════════════════════════════════════════════════
export function LegalPageView() {
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
// Botones al terminar una compra: con sesión, ver el pedido; sin sesión (compra de invitado), invitar a
// crear la cuenta con los mismos datos -- si usa el mismo correo, su ficha de cliente se une sola a la cuenta.
function FinPedidoAcciones({ email, nombre, telefono }) {
  const { user, setView, setShowRegister, setRegisterPrefill } = useApp();
  if (user) {
    return <button style={{ ...S.btnRed, justifyContent: "center", margin: "0 auto" }} onClick={() => setView("dashboard")}>Ver estado de mi pedido</button>;
  }
  return (
    <div>
      {email && <p style={{ fontSize: 13, color: GRAY3, marginBottom: 14 }}>Te enviamos la confirmación a <strong>{email}</strong>.</p>}
      <div style={{ background: "#FFF5F5", border: `1.5px solid ${RED}`, borderRadius: 12, padding: 16, textAlign: "left", marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>¿Quieres seguir tus pedidos?</div>
        <div style={{ fontSize: 13, color: GRAY3, marginBottom: 12, lineHeight: 1.45 }}>
          Crea tu cuenta con este mismo correo y verás aquí este pedido y los siguientes, y comprarás más rápido la próxima vez.
        </div>
        <button className="oft-btn-press" style={{ ...S.btnRed, width: "100%", justifyContent: "center", padding: 12 }}
          onClick={() => { setRegisterPrefill({ nombre, email, telefono }); setShowRegister(true); }}>
          Crear mi cuenta
        </button>
      </div>
      <button style={{ background: "none", border: "none", color: GRAY3, fontSize: 13, textDecoration: "underline", cursor: "pointer" }} onClick={() => setView("home")}>
        Seguir comprando
      </button>
    </div>
  );
}

export function PagoResultadoView() {
  const { pagoResultado, setView, user } = useApp();
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
        <p style={{ color: GRAY3 }}>{user ? 'Tu pedido está confirmado. Sigue su estado desde "Mi Cuenta".' : "Tu pedido está confirmado. Te avisaremos por WhatsApp y por correo."}</p>
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
        <FinPedidoAcciones email={pagoResultado.email || ""} nombre={pagoResultado.nombre || ""} telefono={pagoResultado.telefono || ""} />
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
        <button style={{ ...S.btnWA, justifyContent: "center" }} onClick={() => { registrarEvento("consulta_whatsapp", null, "Problema con el pago"); window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola, tuve un problema confirmando el pago de mi pedido ${codigo || ""}`)}`, "_blank"); }}>
          <MessageCircle size={16} /> Escribir por WhatsApp
        </button>
        <button style={{ ...S.btnOutline, justifyContent: "center" }} onClick={() => setView("home")}>Ir al inicio</button>
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
// Sección dentro de "Mi Cuenta" para cambiar la contraseña estando ya logueado
// (distinto del flujo de "olvidé mi contraseña", que es para cuando NO se puede entrar)
function SeccionCambiarPassword() {
  const { showToast } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [pass, setPass] = useState(""), [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false), [err, setErr] = useState("");

  const guardar = async () => {
    const passLimpio = pass.trim(), pass2Limpio = pass2.trim();
    if (passLimpio.length < 6) { setErr("La contraseña debe tener al menos 6 caracteres."); return; }
    if (passLimpio !== pass2Limpio) { setErr("Las contraseñas no coinciden."); return; }
    setLoading(true); setErr("");
    try {
      const r = await sb.updatePassword(passLimpio);
      if (!r.ok) { setErr(r.data?.msg || r.data?.error_description || "No se pudo cambiar la contraseña."); setLoading(false); return; }
      showToast("Contraseña actualizada");
      setPass(""); setPass2(""); setAbierto(false);
    } catch(e) { setErr("Error de conexión, intenta de nuevo."); }
    setLoading(false);
  };

  return (
    <div style={{ background: WHITE, borderRadius: 14, padding: 20, border: `1px solid ${GRAY2}`, marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: abierto ? 16 : 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><Lock size={17} color={RED} /> Contraseña</div>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="oft-btn-press" style={{ background: "none", border: `1.5px solid ${BLACK}`, color: BLACK, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <PencilIcon size={14} /> Cambiar
          </button>
        )}
      </div>
      {abierto && (
        <div>
          <label style={S.label}>Nueva contraseña</label>
          <input style={S.input} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} />
          <label style={S.label}>Confirma la contraseña</label>
          <input style={S.input} type="password" placeholder="••••••••" value={pass2} onChange={e => setPass2(e.target.value)} onKeyDown={e => e.key === "Enter" && guardar()} />
          {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={guardar} disabled={loading} className="oft-btn-press" style={{ ...S.btnRed, justifyContent: "center", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
            <button onClick={() => { setAbierto(false); setErr(""); setPass(""); setPass2(""); }} className="oft-btn-press" style={S.btnOutline}>Cancelar</button>
          </div>
        </div>
      )}
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
export function CheckoutView() {
  const { cart, setCart, user, setView, showToast, products, categories, empresas, sucursales, localesRetiro, retiroLocalHabilitado, setShowLogin, setPendingCheckout, sincronizarOfertasCarrito } = useApp();
  const [localRetiroId, setLocalRetiroId] = useState(null);
  const [address, setAddress] = useState(""), [areaEnvio, setAreaEnvio] = useState(""), [notes, setNotes] = useState(""), [loading, setLoading] = useState(false), [placed, setPlaced] = useState(null);
  const [avisoValidacion, setAvisoValidacion] = useState(null); // mensaje del pop-up de validación (reemplaza alert() nativo)
  const [nombre, setNombre] = useState(user?.nombre || "");
  const [telefono, setTelefono] = useState(user?.telefono || "");
  const [telefonoYappy, setTelefonoYappy] = useState(user?.telefono || ""); // número específico para pagar con Yappy
  const [email, setEmail] = useState(user?.email || "");
  // Sin sesión iniciada = compra de invitado: no hace falta cuenta, pero sí nombre, WhatsApp y correo
  const esInvitado = !user;
  // Si inicia sesión estando ya aquí, se rellenan sus datos sin pisar lo que ya escribió
  useEffect(() => {
    if (!user) return;
    setNombre(n => n || user.nombre || "");
    setTelefono(t => t || user.telefono || "");
    setTelefonoYappy(t => t || user.telefono || "");
    setEmail(e => e || user.email || "");
  }, [user]);
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursalId, setSucursalId] = useState(null);
  const [modoEntrega, setModoEntrega] = useState("sucursal"); // "sucursal" | "puerta"
  const [costoEnvioPuerta, setCostoEnvioPuerta] = useState(0);

  // Costo fijo de puerta a puerta -- un solo valor, configurado en el admin
  useEffect(() => {
    sb.get("configuracion", "?clave=eq.costo_envio_puerta_a_puerta&limit=1")
      .then(data => { if (data?.[0]?.valor != null) setCostoEnvioPuerta(Number(data[0].valor)); })
      .catch(() => {});
  }, []);
  const [metodoPago, setMetodoPago] = useState("yappy"); // "yappy" | "tarjeta"
  const [tarjetaPagoData, setTarjetaPagoData] = useState(null); // { RedirectData, codigo } — cuando se muestra el iframe de la tarjeta
  const tarjetaContainerRef = useRef(null);
  const [tarjetaProcesando, setTarjetaProcesando] = useState(false);

  // Scroll al inicio al abrir el checkout — importante en celular
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  // Empieza a cargar el script de reCAPTCHA desde que el cliente llega aquí (no
  // hasta que le dé clic a "Pagar") -- así ya está listo cuando lo necesite, en
  // vez de tener que esperar esa carga justo en el momento del pago.
  useEffect(() => { obtenerTokenRecaptcha("checkout_precarga").catch(() => {}); }, []);

  // Avisa a los píxeles de marketing que el cliente llegó al checkout (una sola
  // vez, al entrar a esta pantalla con productos en el carrito)
  useEffect(() => {
    if (cart.length > 0) {
      trackIniciarCheckout({
        total: cart.reduce((s, i) => s + cartItemTotal(i), 0),
        items: itemsTrackDeCarrito(cart),
      });
    }
  }, []);
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
      // Las ofertas y combos ya tienen su precio rebajado: el código no se acumula con ellas
      const baseSinOfertas = cart.reduce((s, i) => i.esOferta ? s : s + cartItemTotal(i), 0);
      return baseSinOfertas * pct;
    }
    // Solo sobre los productos incluidos en el descuento
    const ids = descuentoAplicado.productos_ids || [];
    const baseAplicable = cart.reduce((s, i) => (i.product && ids.includes(i.product.id)) ? s + cartItemTotal(i) : s, 0);
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
          const hayAlguno = cart.some(i => i.product && ids.includes(i.product.id));
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

  // Costo de envío según el modo elegido: gratis en retiro local, fijo en puerta a
  // puerta, o el que tenga configurada la sucursal elegida (puede ser $0 también)
  // Envío especial de perfumes: solo a sucursal, si TODO el carrito son perfumes y la cantidad
  // cae dentro del rango que se configura en el admin (ej. 1 a 3 perfumes = $5)
  const cfgEnvioPerf = useEnvioPerfumes();
  const envioPerfumesActivo = modoEntrega === "sucursal"
    && envioPerfumesAplica(cfgEnvioPerf, cart.flatMap(i => {
      // Una oferta o combo también se revisa producto por producto (piezas × unidades pedidas)
      if (i.esOferta) return (i.lineas || []).map(l => ({ product: products.find(p => p.id === l.productId) || null, piezas: (Number(l.piezas) || 0) * (Number(i.unidades) || 1) }));
      // Un Flex Pack se revisa producto por producto: si todos son perfumes cuenta como perfumes
      if (i.esFlexPack) return (i.items || []).map(it => ({ product: products.find(p => p.id === it.productId) || null, piezas: it.cantidad }));
      return [{ product: i.product, piezas: i.qty }];
    }), categories);
  const costoSucursal = (suc) => envioPerfumesActivo ? cfgEnvioPerf.precio : (Number(suc?.costo_envio) || 0);
  const costoEnvioFinal = modoEntrega === "local" ? 0
    : modoEntrega === "puerta" ? costoEnvioPuerta
    : (sucursalSel ? costoSucursal(sucursalSel) : 0);
  const totalConEnvio = total + costoEnvioFinal;

  const [pedidoPendiente, setPedidoPendiente] = useState(null); // pedido guardado, esperando pago Yappy

    const construirItemsPayload = () => cart.flatMap(item => {
          if (item.esOferta) return prorratearLinea(item); // varias filas, con oferta_id y oferta_unidades
          if (item.esFlexPack) {
            // Una línea de Flex Pack se reparte en varias filas (una por producto elegido),
            // prorrateando el precio del paquete por pieza -- tiene un precio ÚNICO para
            // todo el conjunto, no por producto.
            const precioPorPieza = item.precioTotal / item.totalPiezas;
            return item.items.map(it => ({
              producto_id: it.productId, nombre_producto: `${it.nombre} (Flex Pack ${item.grupoNombre})`,
              cantidad: it.cantidad, precio_unitario: Number(precioPorPieza.toFixed(4)),
              subtotal: Number((precioPorPieza * it.cantidad).toFixed(2)), presentacion: "pieza",
            }));
          }
          return [{
            producto_id: item.product.id, nombre_producto: item.product.nombre,
            cantidad: item.qty, precio_unitario: item.product.precio_pieza, subtotal: cartItemTotal(item),
            presentacion: item.pres || "pieza",
          }];
        });

  const handlePlace = async () => {
    if (!nombre.trim()) { setAvisoValidacion("Por favor escribe tu nombre."); return; }
    if (esInvitado) {
      if (!/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(email.trim())) { setAvisoValidacion("Por favor escribe un correo válido: ahí te enviamos la confirmación de tu pedido."); return; }
      if (telefono.replace(/\D/g, "").length < 7) { setAvisoValidacion("Por favor escribe tu WhatsApp o celular para coordinar tu pedido."); return; }
    }
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
      if (!areaEnvio.trim()) { setAvisoValidacion("Para envío puerta a puerta, escribe tu provincia o área."); return; }
      if (!address.trim()) { setAvisoValidacion("Para envío puerta a puerta, escribe tu dirección exacta."); return; }
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

    // La dirección solo existe en puerta a puerta (provincia/área + dirección exacta);
    // en sucursal o retiro en local no se envía ninguna, aunque se haya escrito antes.
    const direccionFinal = modoEntrega === "puerta" ? `${areaEnvio.trim()} — ${address.trim()}` : "";

    // Muestras abiertas: si algún perfume del pedido tiene una pieza de muestra (no vendible) y
    // lo que pide el cliente ya no cabe, se frena aquí aunque el carrito se haya armado antes de
    // que se marcara la muestra. Odoo no se toca; solo la web deja de venderla.
    try {
      const pedidas = {};
      for (const i of cart) {
        if (i.esOferta) (i.lineas || []).forEach(l => { pedidas[l.productId] = (pedidas[l.productId] || 0) + (Number(l.piezas) || 0) * (Number(i.unidades) || 1); });
        else if (i.esFlexPack) (i.items || []).forEach(it => { pedidas[it.productId] = (pedidas[it.productId] || 0) + (Number(it.cantidad) || 0); });
        else if (i.product) pedidas[i.product.id] = (pedidas[i.product.id] || 0) + (Number(i.qty) || 0);
      }
      const ids = Object.keys(pedidas);
      let frescos = products;
      try { const r = await sb.get("productos", `?id=in.(${ids.join(",")})&select=id,nombre,stock,piezas_muestra,stock_actualizado_at,proveedor_id,tiene_stock_fisico`); if (Array.isArray(r) && r.length) frescos = r; } catch (e) { /* si no se puede consultar, se usa lo que ya tiene la página */ }
      const sinCupo = [];
      for (const id of ids) {
        const p = frescos.find(x => String(x.id) === String(id));
        if (!p || !(Number(p.piezas_muestra) > 0) || !p.stock_actualizado_at || (p.proveedor_id && !p.tiene_stock_fisico)) continue;
        const disponibles = stockWeb(p);
        if (pedidas[id] > disponibles) sinCupo.push(`${p.nombre}: ${disponibles > 0 ? `solo quedan ${disponibles} disponibles` : "ya no está disponible"}`);
      }
      if (sinCupo.length) { setAvisoValidacion("Algunos productos ya no tienen la cantidad que pediste:\n\n" + sinCupo.join("\n") + "\n\nAjusta tu pedido y vuelve a intentarlo."); return; }
    } catch (e) { /* esta revisión nunca debe impedir una compra normal */ }

    const localElegido = modoEntrega === "local" ? (localesRetiro.find(l => l.id === localRetiroId) || localesRetiro[0] || null) : null;

    setLoading(true);

    // Si hay ofertas o combos en el pedido, se confirma con el servidor que sigan vigentes y que el
    // precio sea el de la oferta (por si cambió o terminó la campaña mientras el cliente decidía).
    if (cart.some(i => i.esOferta)) {
      try {
        const filas = construirItemsPayload().filter(r => r.oferta_id).map(r => ({ oferta_id: r.oferta_id, oferta_unidades: r.oferta_unidades, producto_id: r.producto_id, cantidad: r.cantidad, subtotal: r.subtotal }));
        await sb.ensureFreshToken();
        const rr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verificar_ofertas_items`, { method: "POST", headers: sb.dataHeaders(), body: JSON.stringify({ p_items: filas }) });
        if (rr.ok) {
          const chk = await rr.json();
          if (chk && chk.ok === false) {
            const avisos = await sincronizarOfertasCarrito();
            setLoading(false);
            setAvisoValidacion(((chk.errores || []).join(" ") + " Actualizamos tu pedido con las ofertas vigentes: revísalo y vuelve a confirmar.").trim());
            return;
          }
        }
      } catch (e) { /* si no se puede consultar, el servidor vuelve a verificar al guardar */ }
    }

    // Verificación antibots (reCAPTCHA v3, pedida por el banco) -- nunca bloquea
    // la compra si el servicio de Google o nuestra propia verificación fallan,
    // solo frena si Google mismo dice con seguridad que esto parece un robot.
    try {
      const tokenRecaptcha = await obtenerTokenRecaptcha("checkout");
      const verifResp = await fetch(`${SUPABASE_URL}/functions/v1/verificar-recaptcha`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRecaptcha }),
      });
      const verifData = await verifResp.json();
      if (verifData && verifData.ok === false) {
        setLoading(false);
        setAvisoValidacion("No pudimos confirmar que esto sea una compra real. Por favor recarga la página e intenta de nuevo.");
        return;
      }
    } catch (e) { /* si la verificación misma falla, no se bloquea la compra por eso */ }

    try {
      if (metodoPago === "tarjeta") {
        // El pedido se crea DENTRO de la función (junto con el inicio del pago en Powertranz)
        const itemsPayload = construirItemsPayload();
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/crear-pago-tarjeta`, {
          method: "POST", headers: sb.functionHeaders(),
          body: JSON.stringify({
            usuario_id: user?.id || null, cliente: esInvitado ? { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() } : undefined,
            nombre_cliente: nombre, telefono, direccion: direccionFinal, notas: notes, total: totalConEnvio,
            items: itemsPayload,
            empresa_envio_id: empresaFinalId, empresa_envio_nombre: empresaFinalNombre,
            sucursal_id: sucursalFinalId, sucursal_nombre: sucursalFinalNombre,
            retiro_local: modoEntrega === "local", local_retiro_id: localElegido?.id || null, local_retiro_nombre: localElegido?.nombre || null,
            costo_envio: costoEnvioFinal,
            descuento_codigo: descuentoAplicado?.codigo || null,
            descuento_monto: montoDescuento > 0 ? Number(montoDescuento.toFixed(2)) : 0,
            visitante_id: idVisitante(),
          }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) { setAvisoValidacion("Error al iniciar el pago: " + (data.error || "intenta de nuevo")); setLoading(false); return; }
        // Al volver del banco la página se recarga y un invitado no puede leer su pedido (solo lo ve su dueño
        // con sesión) -- se guarda un resumen aquí mismo para poder mostrarle su confirmación y avisar a marketing.
        try {
          localStorage.setItem("oft_pago_tarjeta_pendiente", JSON.stringify({
            codigo: data.codigo, email: esInvitado ? email.trim() : (user?.email || ""), nombre: nombre.trim(), telefono: telefono.trim(),
            pedido: {
              total: totalConEnvio, retiro_local: modoEntrega === "local", local_retiro_nombre: localElegido?.nombre || null,
              empresa_envio_nombre: empresaFinalNombre, sucursal_nombre: sucursalFinalNombre,
              items: itemsPayload.map(it => ({ nombre_producto: it.nombre_producto, cantidad: it.cantidad, subtotal: it.subtotal })),
            },
            itemsTrack: itemsTrackDeCarrito(cart),
          }));
        } catch (e) {}
        setTarjetaPagoData({ RedirectData: data.RedirectData, codigo: data.codigo, modoPrueba: data.modo_prueba });
      } else if (esInvitado) {
        // Compra SIN cuenta: la ficha del cliente y el pedido los crea el servidor
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/crear-pedido-invitado`, {
          method: "POST", headers: sb.functionHeaders(),
          body: JSON.stringify({
            cliente: { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() },
            nombre_cliente: nombre, telefono, direccion: direccionFinal, notas: notes, total: totalConEnvio,
            items: construirItemsPayload(),
            empresa_envio_id: empresaFinalId, empresa_envio_nombre: empresaFinalNombre,
            sucursal_id: sucursalFinalId, sucursal_nombre: sucursalFinalNombre,
            retiro_local: modoEntrega === "local", local_retiro_id: localElegido?.id || null, local_retiro_nombre: localElegido?.nombre || null,
            costo_envio: costoEnvioFinal,
            descuento_codigo: descuentoAplicado?.codigo || null,
            descuento_monto: montoDescuento > 0 ? Number(montoDescuento.toFixed(2)) : 0,
            visitante_id: idVisitante(),
          }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) { setAvisoValidacion(data.error || "No se pudo crear el pedido. Intenta de nuevo."); setLoading(false); return; }
        setPedidoPendiente({ id: data.pedido_id, codigo: data.codigo, yappyOrderId: data.yappy_order_id, total: totalConEnvio, telefono: telefonoYappy });
      } else {
        // orderId corto para Yappy (máx 15 caracteres alfanuméricos)
        const yappyOrderId = "OFT" + Date.now().toString().slice(-10);
        const codigo = `OFT-${Date.now().toString().slice(-6)}`;
        const pedido = await sb.post("pedidos", {
          codigo, usuario_id: user.id, nombre_cliente: nombre, telefono: telefono,
          direccion: direccionFinal, notas: notes, total: totalConEnvio, estado: 0,
          empresa_envio_id: empresaFinalId, empresa_envio_nombre: empresaFinalNombre,
          sucursal_id: sucursalFinalId, sucursal_nombre: sucursalFinalNombre,
          retiro_local: modoEntrega === "local",
          local_retiro_id: localElegido?.id || null, local_retiro_nombre: localElegido?.nombre || null,
          pagado: false, yappy_order_id: yappyOrderId, metodo_pago: "yappy",
          costo_envio: costoEnvioFinal,
          descuento_codigo: descuentoAplicado?.codigo || null,
          descuento_monto: montoDescuento > 0 ? Number(montoDescuento.toFixed(2)) : 0,
        });
        const pedidoId = pedido[0].id;
        for (const item of cart) {
          if (item.esOferta) {
            // Oferta o combo: una fila por producto, con el precio de la oferta repartido y la marca de oferta
            for (const fila of prorratearLinea(item)) await sb.post("pedido_items", { pedido_id: pedidoId, ...fila });
          } else if (item.esFlexPack) {
            // Una línea de Flex Pack se reparte en varias filas de pedido_items (una por
            // producto elegido), prorrateando el precio del paquete por pieza -- ya que el
            // Flex Pack tiene un precio ÚNICO para todo el conjunto, no por producto.
            const precioPorPieza = item.precioTotal / item.totalPiezas;
            for (const it of item.items) {
              await sb.post("pedido_items", {
                pedido_id: pedidoId, producto_id: it.productId, nombre_producto: `${it.nombre} (Flex Pack ${item.grupoNombre})`,
                cantidad: it.cantidad, precio_unitario: Number(precioPorPieza.toFixed(4)),
                subtotal: Number((precioPorPieza * it.cantidad).toFixed(2)), presentacion: "pieza",
              });
            }
          } else {
            await sb.post("pedido_items", { pedido_id: pedidoId, producto_id: item.product.id, nombre_producto: item.product.nombre, cantidad: item.qty, precio_unitario: item.product.precio_pieza, subtotal: cartItemTotal(item), presentacion: item.pres || "pieza" });
          }
        }
        // Guarda el pedido pendiente y muestra el botón de Yappy (el pago va primero)
        setPedidoPendiente({ id: pedidoId, codigo, yappyOrderId, total: totalConEnvio, telefono: telefonoYappy });
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
    // La confirmación oficial del pago la hace el IPN de Yappy en el servidor (con firma).
    // El navegador ya NO marca el pedido como pagado: la base de datos lo bloquea por seguridad.
    setPlaced(pedidoPendiente.codigo);
    trackCompra({
      codigo: pedidoPendiente.codigo, total: pedidoPendiente.total,
      items: itemsTrackDeCarrito(cart),
    });
    setCart([]);
    setPedidoPendiente(null);
    showToast("¡Pago recibido! Tu pedido está confirmado.");
  };

  if (placed) return (
    <div className="oft-section" style={{ ...S.section, textAlign: "center", maxWidth: 500 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><CheckCircle2 size={64} color="#22c55e" strokeWidth={1.5} /></div>
      <h2 style={{ fontSize: 24, fontWeight: 900 }}>¡Pago recibido!</h2>
      <p style={{ color: GRAY3 }}>{user ? 'Tu pedido está confirmado. Sigue su estado desde "Mi Cuenta".' : "Tu pedido está confirmado. Te avisaremos por WhatsApp y por correo."}</p>
      <div style={{ background: GRAY, borderRadius: 12, padding: 20, margin: "20px 0", textAlign: "left" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Número: <span style={{ color: RED }}>{placed}</span></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#D4EDDA", color: "#155724", padding: "4px 12px", borderRadius: 20, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          <CheckCircle2 size={14} /> Pagado con Yappy
        </div>
        {modoEntrega === "local"
          ? <div style={{ marginTop: 10, fontSize: 13, color: "#856404", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}><Home size={14} /> Retiro en el local{(() => { const l = localesRetiro.find(x => x.id === localRetiroId) || (localesRetiro.length === 1 ? localesRetiro[0] : null); return l ? `: ${l.nombre}` : ""; })()}</div>
          : empresaSel && <div style={{ marginTop: 10, fontSize: 13, color: GRAY3, display: "flex", alignItems: "center", gap: 6 }}><Truck size={14} /> {empresaSel.nombre}{sucursalSel ? ` · ${sucursalSel.nombre}` : ""}</div>}
      </div>
      <FinPedidoAcciones email={email.trim()} nombre={nombre.trim()} telefono={telefono.trim()} />
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
            <p style={{ fontSize: 14, color: GRAY3, marginBottom: 22, lineHeight: 1.5, whiteSpace: "pre-line" }}>{avisoValidacion}</p>
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
            <span>{item.esOferta ? `${item.tipo === "combo" ? "Combo" : "Oferta"}: ${item.titulo}` : item.esFlexPack ? `Flex Pack (${item.grupoNombre})` : item.product.nombre} <span style={{ color: GRAY3, fontSize: 12 }}>({cartItemLabel(item)})</span></span>
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
            {envioPerfumesActivo && (
              <div style={{ background: "#E8F6F1", border: "1px solid #0F6E56", color: "#0F6E56", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>
                Envío especial por pedir perfumes: {money(cfgEnvioPerf.precio)} a cualquier sucursal
              </div>
            )}
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
                  <span style={{ fontSize: 13, fontWeight: 800, color: costoSucursal(suc) > 0 ? BLACK : "#0F6E56", textAlign: "right" }}>
                    {envioPerfumesActivo && Number(suc.costo_envio) > costoSucursal(suc) && (
                      <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: GRAY3, textDecoration: "line-through" }}>{money(suc.costo_envio)}</span>
                    )}
                    {costoSucursal(suc) > 0 ? money(costoSucursal(suc)) : "Gratis"}
                  </span>
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
            <strong>Envío puerta a puerta por Servientrega — {costoEnvioPuerta > 0 ? money(costoEnvioPuerta) : "Gratis"}.</strong> Te lo llevamos a la dirección que indiques abajo. <span style={{ color: RED, fontWeight: 700 }}>La provincia o área y la dirección exacta son obligatorias.</span>
          </div>
        </div>
      )}

      {/* DIRECCIÓN / NOTAS */}
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 16, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><MapPin size={18} /> Datos adicionales</div>
        {esInvitado && (
          <div style={{ background: "#F0FAF3", border: "1px solid #BFE5CB", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#1F6B3A", lineHeight: 1.45 }}>
            <strong>Compra sin crear cuenta.</strong> Solo necesitamos tus datos de contacto. ¿Ya tienes cuenta?{" "}
            <span style={{ color: RED, fontWeight: 700, cursor: "pointer" }} onClick={() => { setPendingCheckout(true); setShowLogin(true); }}>Inicia sesión</span>
          </div>
        )}
        <label style={S.label}>Nombre *</label>
        <input style={S.input} placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" />
        <label style={S.label}>WhatsApp / Teléfono{esInvitado ? " *" : ""}</label>
        <input style={S.input} placeholder="Ej: 6720-0474" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} autoComplete="tel" />
        {esInvitado && (
          <>
            <label style={S.label}>Correo electrónico *</label>
            <input style={S.input} placeholder="tu@correo.com" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            <div style={{ fontSize: 11, color: GRAY3, marginTop: -6, marginBottom: 10 }}>Ahí te enviamos la confirmación de tu pedido.</div>
          </>
        )}
        {modoEntrega === "puerta" && (
          <>
            <label style={S.label}>Provincia o área *</label>
            <input style={{ ...S.input, borderColor: !areaEnvio.trim() ? RED : GRAY2 }} placeholder="Ej: Colón, Costa Arriba, Panamá Oeste..." value={areaEnvio} onChange={e => setAreaEnvio(e.target.value)} autoComplete="address-level1" />
            <label style={S.label}>Dirección exacta *</label>
            <input style={{ ...S.input, borderColor: !address.trim() ? RED : GRAY2 }} placeholder="Calle, casa o edificio, punto de referencia..." value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" />
          </>
        )}
        <label style={S.label}>Notas (tallas, colores, referencias)</label>
        <input style={S.input} placeholder="Opcional..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {/* PAGO */}
      <div style={{ background: WHITE, borderRadius: 12, padding: 24, marginBottom: 20, border: `1px solid ${GRAY2}` }}>
        <div style={{ fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><CreditCard size={18} /> Pago</div>

        {!pedidoPendiente && !tarjetaPagoData ? (
          <>
            <div style={{ background: GRAY, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: GRAY3, marginBottom: 6 }}>
                <span>Subtotal</span>
                <span>{money(total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: GRAY3, marginBottom: 10 }}>
                <span>Envío {modoEntrega === "local" ? "(retiro en local)" : modoEntrega === "puerta" ? "(puerta a puerta)" : sucursalSel ? `(${sucursalSel.nombre})` : ""}</span>
                <span>{costoEnvioFinal > 0 ? money(costoEnvioFinal) : "Gratis"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${GRAY2}`, paddingTop: 10 }}>
                <span style={{ fontWeight: 700 }}>Total a pagar</span>
                <span style={{ fontWeight: 900, fontSize: 22, color: RED }}>{money(totalConEnvio)}</span>
              </div>
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
            <p style={{ fontSize: 11, color: GRAY3, textAlign: "center", marginTop: 10, lineHeight: 1.4 }}>
              Este sitio está protegido por reCAPTCHA y se aplican la{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: GRAY3 }}>Política de Privacidad</a>{" "}
              y los <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: GRAY3 }}>Términos de Servicio</a> de Google.
            </p>
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
// Tarjeta chica y minimalista para las filas de "Comprar otra vez" / "Tus intereses"
// en Mi Cuenta — al tocarla abre el detalle del producto para elegir cantidad y comprar.
function MiniProductCard({ product }) {
  const { setQuickView } = useApp();
  const imgUrl = product.imagen_url ? imagenOptimizada(product.imagen_url, 240) : null;
  return (
    <div className="oft-mini-card" onClick={() => setQuickView(product)}>
      <div className="oft-mini-card-img">
        {imgUrl ? <img src={imgUrl} alt={product.nombre} loading="lazy" decoding="async" /> : <Package size={26} color={GRAY3} strokeWidth={1.4} />}
      </div>
      <div className="oft-mini-card-name">{product.nombre}</div>
    </div>
  );
}

export function DashboardView() {
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
        const creado = await sb.post("usuarios", { ...cambios, email: user.email, es_admin: false, origen_cuenta: "web" });
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

  // "Comprar otra vez": productos que ya compró antes, del más reciente al más viejo
  // "Tus intereses": otros productos de esas mismas categorías que todavía no ha comprado
  const idsComprados = new Set();
  const fechaMasReciente = new Map();
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      if (!it.producto_id) return;
      idsComprados.add(it.producto_id);
      if (!fechaMasReciente.has(it.producto_id) || o.created_at > fechaMasReciente.get(it.producto_id)) {
        fechaMasReciente.set(it.producto_id, o.created_at);
      }
    });
  });

  const comprarOtraVez = [...fechaMasReciente.entries()]
    .sort((a, b) => new Date(b[1]) - new Date(a[1]))
    .map(([pid]) => products.find(p => p.id === pid))
    .filter(p => p && p.activo && p.visible_web !== false)
    .slice(0, 10);

  const categoriasDeInteres = [...new Set(
    [...idsComprados].map(pid => products.find(p => p.id === pid)?.categoria_id).filter(Boolean)
  )];
  const tusIntereses = products
    .filter(p => p.activo && p.visible_web !== false && categoriasDeInteres.includes(p.categoria_id) && !idsComprados.has(p.id))
    .slice(0, 10);

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

      {/* CAMBIAR CONTRASEÑA */}
      <SeccionCambiarPassword />

      {/* COMPRAR OTRA VEZ */}
      {comprarOtraVez.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw size={17} color={RED} strokeWidth={2.2} /> Comprar otra vez
          </div>
          <div className="oft-mini-row">
            {comprarOtraVez.map(p => <MiniProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {/* TUS INTERESES */}
      {tusIntereses.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={17} color={RED} strokeWidth={2.2} /> Basado en tus intereses
          </div>
          <div className="oft-mini-row">
            {tusIntereses.map(p => <MiniProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}

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
                        onClick={() => { registrarEvento("consulta_whatsapp", null, "Consulta sobre un pedido"); window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola Ofertodo, quiero consultar sobre mi pedido ${o.codigo}`)}`, "_blank"); }}>
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
  const n = etiquetas.length;
  // Con "flex: 1" cada paso ocupa una columna de ancho igual (100%/n), y su círculo
  // queda centrado DENTRO de esa columna -- no a una distancia fija del borde. Por
  // eso la línea tiene que ir de centro a centro en porcentajes, no en píxeles fijos:
  // el círculo del paso i está en el (i + 0.5) / n de todo el ancho.
  const offset = (50 / n); // % desde el borde hasta el centro del primer/último círculo
  const pct = (estado / (n - 1)) * (100 - offset * 2);
  return (
    <div>
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginTop: compact ? 8 : 4 }}>
        {/* línea base -- va de centro del primer círculo a centro del último */}
        <div style={{ position: "absolute", top: 18, left: `${offset}%`, right: `${offset}%`, height: 4, background: GRAY2, borderRadius: 2, zIndex: 0 }} />
        {/* línea de progreso animada */}
        <div className="oft-progress-fill" style={{ position: "absolute", top: 18, left: `${offset}%`, height: 4, background: `linear-gradient(90deg, ${RED}, ${RED_D})`, borderRadius: 2, zIndex: 1, width: `${pct}%` }} />
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
