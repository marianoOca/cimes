// es-AR copy module (04-website §7): every visible string lives here, voseo.
// The website owns its own copy file (deployed separately from the backend);
// confirmation phrasing kept consistent with the chatbot's copy module.
window.CIMES_COPY = {
  brand: "CIMES",
  a11y: { skip: "Ir al alta automática" },
  nav: { signup: "Darme de alta" },
  hero: {
    eyebrow: "Agua pura y protegida",
    title: "Agua y soda a domicilio, todas las semanas",
    subtitle:
      "Recibís bidones, soda y dispensers directo en tu puerta. Delivery sin costo.",
    reassure: "Sin costo de alta. Pagás al recibir. Tu primera entrega, esta semana.",
    badges: {
      delivery: "Reparto semanal",
      returnable: "Envases retornables",
      quick: "Alta en 2 minutos",
    },
  },
  dualCta: {
    auto: {
      title: "Alta automática",
      description: "Completala acá en 2 minutos, sin salir de la página.",
      button: "Darme de alta",
    },
    whatsapp: {
      title: "Alta por WhatsApp",
      description: "Escribinos y te damos de alta por chat, al toque.",
      button: "Abrir WhatsApp",
      prefill: "Hola, quiero darme de alta",
    },
  },
  how: {
    title: "En 3 pasos tenés CIMES en tu casa",
    steps: [
      { title: "Completás el formulario", text: "Elegís tu ciudad, tu producto y nos dejás tus datos de entrega." },
      { title: "Te confirmamos por WhatsApp", text: "Te avisamos el día y horario de tu reparto." },
      { title: "Recibís tu pedido", text: "Tu repartidor pasa cada semana, y le pagás directamente a él." },
    ],
  },
  products: {
    title: "Nuestros productos",
    note: "Los precios varían según tu ciudad: consultalos en el alta automática o por WhatsApp.",
    ctaLabel: "Consultar por WhatsApp",
    // Real product photos from cimescentral.com (assets/products/*.webp).
    items: [
      { name: "Bidón retornable 12L", description: "12 litros para que dejes de fingir que tomás 2 por día.", image: "botellon-12l.webp" },
      { name: "Bidón retornable 20L", description: "20 litros: para cuando el de 12 te pareció poco compromiso.", image: "botellon-20l.webp" },
      { name: "Bidón 12L Menos Sodio", description: "Baja en sodio, alta en autoestima. Tu médico va a estar orgulloso.", image: "botellon-12l-ms.webp" },
      { name: "Soda en sifón", description: "El sifón de toda la vida, para hacerte el gracioso en la sobremesa.", image: "soda-sifon.webp" },
      { name: "Agua saborizada", description: "Agua disfrazada de premio para que los chicos no se den cuenta.", image: "saborizada.webp" },
      { name: "Gaseosas 2,25L", description: "2,25 litros para el asado donde nunca falta nadie, salvo la dieta.", image: "gaseosas.webp" },
      { name: "Agua en botellas", description: "Para cuando ni al bidón le tenés la paciencia de servir con vaso.", image: "agua-botellas.webp" },
      { name: "Jugo en polvo", description: "Un sobrecito que rinde 2 litros, como las excusas de tu cuñado.", image: "jugo.webp" },
    ],
  },
  trust: {
    title: "La marca que ya conocés, ahora a domicilio",
    items: [
      { title: "Calidad garantizada", text: "Agua de mesa controlada, la misma en cada entrega.", icon: "verified" },
      { title: "Reparto semanal confiable", text: "Tu repartidor pasa siempre en tu día. Nunca te quedás sin agua ni soda.", icon: "local-shipping" },
      { title: "Pagás al recibir", text: "Nada por adelantado: pagás recién cuando lo tenés en tu casa.", icon: "monetization" },
      { title: "Servicio técnico gratuito", text: "Disfruta de tu aga, fría o caliente; nosotros nos encargamos del resto.", icon: "build" },
      { title: "Compromiso ambiental", text: "Envases retornables, menos plástico, un futuro más limpio para todos <3", icon: "eco" },
    ],
    ctaButton: "Darme de alta gratis",
    ctaNote: "Alta en 2 minutos, sin vueltas.",
  },
  coverage: {
    // Wizard step 1 (app.js) builds the city picker from this list.
    // The standalone "Zonas de cobertura" section was removed as redundant.
    cities: [
      "Mercedes",
      "Luján",
      "San Andrés de Giles",
      "San Antonio de Areco",
      "Chivilcoy",
      "Campana",
      "Zárate",
    ],
    // Argentine mobile area codes per covered city (for the phone-field prefill/mask).
    areaCodes: {
      "Mercedes": "2324",
      "Luján": "2323",
      "San Andrés de Giles": "2325",
      "San Antonio de Areco": "2326",
      "Chivilcoy": "2346",
      "Campana": "3489",
      "Zárate": "3487",
    },
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
    // Numbered stepper labels (progress bar), one per wizard step.
    steps: ["Ciudad", "Productos", "Datos", "Envío", "Resumen"],
    stepOf: (n) => `Paso ${n} de 5`,
    waFallback: "Probá escribinos por WhatsApp",
    successHint: "Guardá esta confirmación. Ante cualquier duda, escribinos por WhatsApp.",
    cityStep: { title: "¿De qué ciudad sos?", other: "Otra ciudad" },
    // Waitlist form (/alta?waitlist=1): capture contact for uncovered zones.
    waitlist: {
      title: "Dejanos tus datos",
      intro:
        "Todavía no llegamos a tu zona, pero estamos sumando ciudades. Dejanos tu contacto y te avisamos apenas lleguemos.",
      name: "Nombre",
      phone: "Teléfono (WhatsApp)",
      zone: "¿De qué ciudad o zona sos?",
      zonePlaceholder: "Ej: Navarro, Buenos Aires",
      comment: "Comentario (opcional)",
      submit: "Avisame cuando lleguen",
      sending: "Enviando…",
      successTitle: "¡Listo!",
      success: "Te anotamos 🙌. Te escribimos apenas sumemos tu zona.",
    },
    productStep: {
      title: "Elegí tus productos",
      loading: "Buscando los precios de tu ciudad…",
      continue: "Continuar",
      total: "Total",
    },
    dataStep: {
      title: "Tus datos de entrega",
      cityLabel: "Ciudad",
      firstName: "Nombre",
      lastName: "Apellido",
      phone: "Teléfono (WhatsApp)",
      direccion: "Dirección",
      direccionPlaceholder: "Ej: Av. Rivadavia 770",
      piso: "Piso / Depto / Referencia (opcional)",
      crossStreets: "Entre calles (opcional)",
      next: "Verificar cobertura",
      errors: {
        required: "Completá este campo.",
        phone: "Ingresá un teléfono válido (ej: +54 9 2324 12-3456).",
      },
    },
    dayStep: {
      title: "Elegí tu día de entrega",
      checking: "Verificando cobertura…",
      optionLabel: (route, weekday, window) => `Reparto ${route} · ${weekday} ${window}`,
    },
    summaryStep: {
      title: "Confirmá tu pedido",
      product: "Producto",
      price: "Precio",
      total: "Total",
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
    genericError: "Algo salió mal. Seguramente la soda salpicó el server...",
    back: "Volver",
  },
};
