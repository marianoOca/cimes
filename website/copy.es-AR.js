// es-AR copy module (04-website §7): every visible string lives here, voseo.
// The website owns its own copy file (deployed separately from the backend);
// confirmation phrasing kept consistent with the chatbot's copy module.
window.CIMES_COPY = {
  brand: "CIMES",
  a11y: { skip: "Ir al alta automática" },
  nav: { signup: "Alta automática", whatsapp: "WhatsApp" },
  hero: {
    eyebrow: "Agua pura, protegida y a domicilio",
    title: "Agua y soda a domicilio, todas las semanas",
    subtitle:
      "Sumate a CIMES y recibí bidones, soda y dispensers en tu casa, en tu día de reparto semanal.",
    cta: "¡Quiero darme de alta!",
    badges: {
      delivery: "Reparto semanal",
      returnable: "Envases retornables",
      quick: "Alta en 2 minutos",
    },
  },
  dualCta: {
    title: "Elegí cómo darte de alta",
    auto: {
      title: "Alta automática",
      description: "Completá el alta acá en la web en 2 minutos, sin salir de la página.",
      button: "Empezar ahora",
    },
    whatsapp: {
      title: "Alta por WhatsApp",
      description: "Escribinos y nuestro asistente te da de alta por chat, al toque.",
      button: "Abrir WhatsApp",
      prefill: "Hola, quiero darme de alta",
    },
  },
  how: {
    title: "En 3 pasos tenés CIMES en tu casa",
    steps: [
      { title: "1. Completás el formulario", text: "Elegís tu ciudad, tu producto y nos dejás tus datos de entrega." },
      { title: "2. Te confirmamos por WhatsApp", text: "Te avisamos el día y horario de tu reparto." },
      { title: "3. Recibís tu pedido", text: "Tu repartidor pasa cada semana, y le pagás directamente a él." },
    ],
  },
  products: {
    title: "Nuestros productos",
    note: "Los precios varían según tu ciudad: consultalos en el alta automática o por WhatsApp.",
    ctaLabel: "Consultar por WhatsApp",
    items: [
      { name: "Bidón retornable 12L", description: "Agua de mesa en bidón retornable de 12 litros.", emoji: "💧" },
      { name: "Bidón retornable 20L", description: "Agua de mesa en bidón retornable de 20 litros.", emoji: "💧" },
      { name: "Soda en sifón", description: "Soda clásica en sifón retornable.", emoji: "🥤" },
      { name: "Agua saborizada", description: "Saborizadas para toda la familia.", emoji: "🍊" },
      { name: "Dispenser frío-calor", description: "Abono mensual con mantenimiento incluido.", emoji: "🌡️" },
      { name: "Dispenser natural", description: "La opción simple, sin frío ni calor.", emoji: "🚰" },
    ],
  },
  trust: {
    title: "Por qué elegir CIMES",
    items: [
      { title: "Calidad garantizada", text: "Agua de mesa controlada, entregada con la frecuencia justa para tu consumo." },
      { title: "Compromiso ambiental", text: "Envases retornables: menos plástico descartable, semana a semana." },
      { title: "Servicio semanal confiable", text: "Tu repartidor pasa siempre en tu día de reparto. Sin vueltas." },
    ],
  },
  coverage: {
    title: "Zonas de cobertura",
    text: "Llevamos agua y soda a domicilio en estas ciudades:",
    cities: [
      "Mercedes",
      "Luján",
      "San Andrés de Giles",
      "San Antonio de Areco",
      "Chivilcoy",
      "Campana",
      "Zárate",
    ],
  },
  testimonials: {
    title: "Lo que dicen nuestros clientes",
    // Placeholder slots — the client provides the 3 real testimonials (04 §2.8).
    items: [
      { name: "Cliente de Mercedes", text: "“Testimonio pendiente — lo proporciona el cliente.”" },
      { name: "Cliente de Luján", text: "“Testimonio pendiente — lo proporciona el cliente.”" },
      { name: "Cliente de Campana", text: "“Testimonio pendiente — lo proporciona el cliente.”" },
    ],
  },
  footer: {
    tagline: "Agua y soda a domicilio, semana a semana.",
    email: "clientes@cimes-silva.com",
    instagram: "cimes.silva",
    instagramUrl: "https://www.instagram.com/cimes.silva/",
    facebookUrl: "https://www.facebook.com/people/Cimes-Silva-e-Hijos/61564228611826/",
    tiktokUrl: "https://www.tiktok.com/@cimes.silva",
    privacy: "Política de privacidad",
    rights: "© CIMES. Todos los derechos reservados.",
  },
  wizard: {
    title: "Alta automática",
    subtitle: "2 minutos, 5 simples pasos.",
    cityStep: { title: "¿De qué ciudad sos?", other: "Otra ciudad" },
    productStep: { title: "Elegí tu producto", loading: "Buscando los precios de tu ciudad…" },
    dataStep: {
      title: "Tus datos de entrega",
      firstName: "Nombre",
      lastName: "Apellido",
      phone: "Teléfono (WhatsApp)",
      street: "Calle",
      number: "Altura",
      crossStreets: "Entre calles",
      next: "Verificar cobertura",
      errors: {
        required: "Completá este campo.",
        phone: "Ingresá un teléfono válido (ej: 2324 123456).",
      },
    },
    dayStep: {
      title: "Elegí tu día de entrega",
      checking: "Verificando cobertura…",
      optionLabel: (route, weekday, window) => `Reparto ${route} — ${weekday} ${window}`,
    },
    summaryStep: {
      title: "Confirmá tu pedido",
      product: "Producto",
      price: "Precio",
      address: "Dirección",
      day: "Entrega",
      confirm: "Confirmar pedido",
      sending: "Enviando…",
    },
    success: (day, window) => `¡Listo! 🎉 Te lo llevamos el ${day} ${window}. El pago es al repartidor cuando te lo entrega.`,
    successTitle: "¡Pedido confirmado!",
    noCoverage: {
      city: "Uy, por ahora no llegamos a tu ciudad 😔. Guardamos tu contacto y te avisamos si sumamos reparto por ahí.",
      address: "No encontramos reparto para esa dirección todavía. Lo pasamos al equipo para revisarlo, ¡gracias por escribirnos!",
    },
    genericError: "Algo salió mal. Revisá los datos e intentá de nuevo, ¿dale?",
    back: "Volver",
  },
};
