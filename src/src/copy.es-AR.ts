// THE canonical home of every user-facing string (00-master §2, 02 §10).
// Argentine Spanish, voseo, warm, short. Never hardcode Spanish inline in
// logic — import from here. Interpolation values are injected by callers.

export const copy = {
  greeting:
    "Buenas! Te voy a ayudar a darte de alta y darle CIMES a tu vida!",
  cityPrompt: "De qué ciudad sos? Elegí de la lista 👇",
  cityListButton: "Ver ciudades",
  zonePrompt: "Ok! En qué ciudad recibirías el pedido?",
  productPrompt: "Qué producto te interesa? Elegí de la lista 👇",
  productListButton: "Ver productos",
  quote: (product: string, price: number): string =>
    `${product} te sale $${formatPrice(price)}. ¿Querés que te lo llevemos?`,
  requote: (product: string, price: number): string =>
    `Un detalle: por tu zona, ${product} te queda en $${formatPrice(price)}.`,
  coverageNegativeInCity:
    "No encontramos reparto para esa dirección todavía. Lo pasamos al equipo para revisarlo y te avisamos, ¿dale?",
  deliveryDataPrompt:
    "Buenísimo! Para coordinar la entrega necesito tus datos. Completá el formulario 👇 o escribime tu dirección directamente.",
  deliveryDataFormButton: "Completar datos",
  locationConfirmPrompt:
    "La ubicación es correcta?",
  locationConfirmYes: "Sí",
  locationConfirmNo: "No",
  locationReenterPrompt:
    "Escribime la dirección completa (calle y número y ciudad). Solo entregamos en la provincia de Buenos Aires 🙌",
  locationHandoff:
    "Permitime un momento mientras verifico la cobertura en tu área, gracias!",
  deliveryDayPrompt: "¿Qué día te queda mejor? Estas son las opciones para tu zona 👇",
  deliveryDayFreeText: "Escribime qué día te viene mejor y te confirmo.",
  deliveryWindow: (hourMin: string, hourMax: string): string =>
    hourMin && hourMax ? `entre ${hourMin} y ${hourMax}` : "en horario a confirmar",
  deliveryOption: (route: string, weekday: string, window: string): string =>
    `Reparto ${route} — ${weekday} ${window}`,
  orderSummaryConfirm: (o: {
    product: string;
    price: number;
    address: string;
    day: string;
    window: string;
  }): string =>
    `Buenísimo! Te confirmo el pedido:\n\n📦 ${o.product} — $${formatPrice(o.price)}\n📍 ${o.address}\n🚚 ${o.day} ${o.window}\n\nEstá todo bien?`,
  confirmButton: "Confirmar",
  modifyButton: "Modificar",
  confirmation: (day: string, window: string): string =>
    `¡Listo! 🎉 Te lo llevamos el ${day} ${window}. El pago es al repartidor cuando te lo entrega. ¡Gracias por elegir CIMES!`,
  followup: {
    inicio: "Hola! Seguís ahí? Contame de qué ciudad sos y te paso los precios 😊",
    producto: "¿Te quedó alguna duda con los productos? Decime cuál te interesa y te paso el precio.",
    datos_entrega: "Nos faltan solo tus datos de entrega para coordinar el pedido. ¿Los completamos?",
    confirmar_ubicacion: "Quedó pendiente confirmar tu dirección en el mapa. ¿La revisás?",
    dia_entrega: "Quedó pendiente elegir el día de entrega. ¿Cuál te queda mejor?",
    confirmacion: "Tu pedido está casi listo, solo falta confirmarlo. ¿Lo cerramos?",
  },
  handoffToSupport: (supportNumber: string): string =>
    `Para ayudarte mejor con esto, escribile a nuestro equipo al ${supportNumber} 📱. Ya les avisamos que vas a escribir.`,
  igGreeting: (name: string, city: string, product: string): string =>
    `¡Hola ${name}! Gracias por tu consulta por ${product} en ${city} 💧. Soy el asistente de CIMES: respondeme por acá y seguimos con tu pedido.`,
  debtReminder: (amount: number): string =>
    `¡Hola! Mañana pasa el repartidor de CIMES por tu domicilio. Te recordamos que tenés un saldo pendiente de $${formatPrice(amount)}, que podés abonar directamente al repartidor. ¡Gracias!`,
  debtMentionOpportunistic: (amount: number): string =>
    `Te comento además que tenés un saldo pendiente de $${formatPrice(amount)} — lo podés abonar al repartidor en la próxima visita.`,
  mediaFallback:
    "No puedo procesar audios, fotos ni ubicaciones por acá 🙏. ¿Me lo escribís como texto?",
  callFallback:
    "Por esta línea no atendemos llamadas, pero escribime por acá y te respondo al toque 💬.",
  operatorHandoffAlert: (phone: string, reason: string, link: string): string =>
    `⚠️ Derivación: el lead ${phone} necesita atención humana (${reason}). Conversación: ${link}`,
  operatorFailureAlert: (phone: string, detail: string): string =>
    `❌ Falló la sincronización del pedido de ${phone}: ${detail}. Quedó en cola de reintento.`,
  operatorPriceRefreshFailedAlert: (detail: string): string =>
    `⚠️ No se pudieron actualizar los precios desde WaterService: ${detail}. Seguimos cotizando con los últimos precios guardados.`,
  operatorPricesStaleAlert: (since: string): string =>
    `⚠️ Los precios guardados no se actualizan desde ${since}. Revisá la conexión con WaterService.`,
  operatorMissingSkusAlert: (detail: string): string =>
    `⚠️ Faltan productos del catálogo en la lista de precios: ${detail}. Los clientes de esas zonas no los ven.`,
  operatorNewZoneAlert: (phone: string, address: string): string =>
    `📍 Lead sin cobertura para revisar: ${phone} — ${address}`,
  operatorManualReviewAlert: (
    phone: string,
    city: string,
    address: string,
    link: string,
  ): string =>
    `🔔 Revisar cobertura manual: ${phone} — ${city}, ${address}. Zona con cobertura pero sin horario para ofrecer. Chatwoot: ${link}`,
  manualReviewNote: (items: string, address: string, crossStreets: string): string =>
    `Lead en ciudad con cobertura pero sin ruta/horario para ofrecer → decisión manual. Pedido: ${items}. Dirección: ${address}${crossStreets ? `. Entre calles: ${crossStreets}` : ""}.`,
  webConfirmation: (day: string, window: string): string =>
    `¡Pedido confirmado! 🎉 Te lo llevamos el ${day} ${window}. Cualquier cosa escribinos por acá.`,
} as const;

function formatPrice(price: number): string {
  return price.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
