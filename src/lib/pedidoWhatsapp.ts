// Mensaje de WhatsApp con toda la información del pedido, para que el cliente solo toque "Enviar".
// Sigue el mismo orden y estilo que "Copiar pedido" del panel (Pedidos), escrito desde el cliente.
// Se arma con el pedido que devuelve el servidor (precios reales, cupón, tasa y entrega).

// Número de Mirra que recibe los pedidos (el mismo del botón flotante de WhatsApp): 0414-145.40.86
export const WHATSAPP_PEDIDOS = '584141454086';

const redondear = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// "85. DOLCE GABBANA ... Presentación 60ml" -> "60 ml"
function tamanoDe(nombre: string | null | undefined): string {
  const m = /(\d+(?:[.,]\d+)?)\s*ml\b/i.exec(String(nombre || ''));
  return m ? `${m[1]} ml` : '';
}

// Mismas líneas que el método de entrega del panel (buildDeliveryLines en Pedidos)
function lineasEntrega(pedido: any): string[] {
  const tipo = String(pedido?.tipo_entrega || '');
  if (!tipo) return [];
  const d = pedido?.datos_entrega || {};
  const lineas = ['🚚 *Método de entrega*'];
  if (tipo === 'tienda') {
    lineas.push('🏬 Retiro en tienda');
    if (d.sucursal_nombre) lineas.push(d.sucursal_nombre);
    if (d.sucursal_direccion) lineas.push(`📍 ${d.sucursal_direccion}`);
  } else if (tipo === 'envio_nacional') {
    const empresa = d.transportista === 'OTRA' ? (d.transportista_otro || 'Otra') : (d.transportista || 'MRW');
    lineas.push(`📦 Envío nacional por ${empresa}`);
    if (d.estado) lineas.push(`🏙️ ${d.ciudad ? `${d.ciudad}, ` : ''}${d.estado}`);
    if (d.agencia_codigo) lineas.push(`Agencia: ${d.agencia_codigo}`);
    if (d.agencia_direccion) lineas.push(`📍 ${d.agencia_direccion}`);
  } else if (tipo === 'delivery') {
    const enlace = d.ubicacion_link
      || (d.ubicacion_latitud != null && d.ubicacion_longitud != null
        ? `https://www.google.com/maps/search/?api=1&query=${d.ubicacion_latitud},${d.ubicacion_longitud}`
        : null);
    lineas.push('🛵 Delivery');
    if (enlace) lineas.push(`📍 Ubicación: ${enlace}`);
  } else {
    lineas.push(tipo);
  }
  return lineas;
}

export function mensajePedidoWhatsapp(pedido: any): string {
  const productos: any[] = Array.isArray(pedido?.productos) ? pedido.productos : [];
  const tasa = Number(pedido?.tasa_cambio_monto);
  const conTasa = Number.isFinite(tasa) && tasa > 0;
  // Montos en $ y, si el pedido tiene tasa, también en Bs: "$29,10 (Bs 247,35)"
  const numero = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const enBs = (monto: number) => redondear(monto * tasa);
  const ambos = (usd: number, bs: number) => (conTasa ? `$${numero(usd)} (Bs ${numero(bs)})` : `$${numero(usd)}`);
  const dinero = (monto: number) => ambos(redondear(monto), enBs(monto));

  const descuento = redondear(pedido?.descuento_cupon ?? 0);
  const descuentoMayor = redondear(pedido?.descuento_mayor ?? 0);
  const porcentajeMayor = Number(pedido?.descuento_mayor_porcentaje);
  const total = redondear(pedido?.total ?? 0);
  const subtotal = redondear(pedido?.total_base ?? total + descuento + descuentoMayor);
  const porcentaje = Number(pedido?.cupon_descuento_porcentaje);

  const lineasProductos = productos.map((p) => {
    const nombre = String(p.producto_nombre || p.nombre_producto || 'Producto').trim();
    const tamano = tamanoDe(p.formula_nombre) || tamanoDe(p.producto_nombre);
    const cantidad = Number(p.cantidad);
    return `• ${nombre}${tamano && !tamanoDe(nombre) ? ` (${tamano})` : ''}${Number.isFinite(cantidad) && cantidad > 1 ? ` × ${cantidad}` : ''}`;
  });

  const resumen: string[] = [`Subtotal: ${dinero(subtotal)}`];
  if (descuento > 0) {
    const codigo = String(pedido?.cupon_codigo || '').trim();
    resumen.push(`🎟️ Cupón${codigo ? ` ${codigo}` : ''}${Number.isFinite(porcentaje) && porcentaje > 0 ? ` (${porcentaje}%)` : ''}: - ${ambos(redondear(subtotal - total), redondear(enBs(subtotal) - enBs(total)))}`);
    // (el descuento se calcula como subtotal - total, en cada moneda, para que la resta cuadre al céntimo)
  }
  if (descuentoMayor > 0) {
    const pct = Number.isFinite(porcentajeMayor) && porcentajeMayor > 0 ? ` (${porcentajeMayor}%)` : '';
    resumen.push(`🎁 Descuento al mayor${pct}: - ${ambos(redondear(subtotal - total), redondear(enBs(subtotal) - enBs(total)))}`);
  }
  // Si escribió un cupón pero el descuento al mayor era más alto, se aplicó solo el mayor
  const cuponNoAplicado = pedido?.cupon_no_aplicado?.codigo;
  if (cuponNoAplicado && descuentoMayor > 0) {
    resumen.push(`(El cupón ${cuponNoAplicado} no se sumó: se aplicó el descuento al mayor, que es más alto)`);
  }

  const entrega = lineasEntrega(pedido);
  return [
    '¡Hola, Mirra Perfumería! 👋✨',
    'Acabo de hacer un pedido en la web y quiero confirmarlo.',
    '',
    `🧾 *Pedido #${pedido?.id ?? ''}*`,
    '',
    '👤 *Mis datos*',
    `Nombre: ${pedido?.nombre_cliente || '-'}`,
    `Cédula: ${pedido?.cedula || '-'}`,
    `Teléfono: ${pedido?.telefono || '-'}`,
    '',
    '🛍️ *Productos*',
    ...lineasProductos,
    '',
    '💰 *Resumen*',
    ...resumen,
    `*Total de productos: ${dinero(total)}*`,
    '_El costo de delivery o envío me lo confirman por aquí._',
    ...(entrega.length > 0 ? ['', ...entrega] : []),
    '',
    'Quedo atento(a) a la confirmación ✅',
  ].join('\n');
}

export function enlaceWhatsappPedido(pedido: any): string {
  // Enlace directo (no wa.me): la redirección de wa.me daña los emojis en WhatsApp Web y escritorio ("��")
  return `https://api.whatsapp.com/send?phone=${WHATSAPP_PEDIDOS}&text=${encodeURIComponent(mensajePedidoWhatsapp(pedido))}`;
}
