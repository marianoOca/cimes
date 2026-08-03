// es-AR copy module (04-website §7): every visible string lives here, voseo.
// The website owns its own copy file (deployed separately from the backend);
// confirmation phrasing kept consistent with the chatbot's copy module.
window.CIMES_COPY = {
  brand: "CIMES",
  a11y: { skip: "Ir al alta automática" },
  nav: { signup: "Darme de alta" },
  hero: {
    eyebrow: "Pureza Bien Protegida",
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
    items: [
      { name: "Bidón Retornable", description: "20 y 12 litros: para cuando el de 12 te pareció poco compromiso.", image: "botellon-20l.webp" },
      { name: "Bidón Menos Sodio", description: "20 y 12 litros, Baja en sodio, alta en autoestima. Tu médico va a estar orgulloso.", image: "botellon-12l-ms.webp" },
      { name: "Soda en Sifón", description: "1.5 L. Retornable. El sifón de toda la vida, para hacerte el gracioso en la sobremesa.", image: "soda-sifon.webp" },
      { name: "Agua Saborizada", description: "1.5 L. Agua disfrazada de premio para que los chicos no se den cuenta.", image: "saborizada.webp" },
      { name: "Gaseosas", description: "2 L litros para el asado donde nunca falta nadie, salvo la dieta.", image: "gaseosas.webp" },
      { name: "Agua en Botellas", description: "2 L. Para cuando ni al bidón le tenés la paciencia de servir con vaso.", image: "agua-botellas.webp" },
      { name: "Cimes Plus Isotónica", description: "750 ml (tipo powerade)", image: "isotonica.webp" },
      // TODO: agegar sabores para saborizada, gaseosa e isotónica
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
      "Escobar",
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
      "Escobar": "0348",
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
    // Shortcut cities are the quick picks; "other" is the free-text entry that
    // snaps to the closest BA city and continues the normal flow.
    cityStep: {
      title: "¿De qué ciudad sos?",
      other: "Otra Ciudad",
      otherPlaceholder: "Ej: Necochea",
      otherSubmit: "Continuar",
      // Second thought when the typed city isn't in our list: offer the 1–3
      // closest real cities, but let the user proceed with what they typed
      // (coverage decides). `didYouMean` is appended to `notInList` on one line
      // when there are suggestions.
      notInList: (city) => `No encontramos «${city}» en nuestra lista.`,
      didYouMean: "¿Quisiste decir…?",
      proceedAnyway: (city) => `Continuar igual con «${city}»`,
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
    // Coverage check timed out / errored on the first try (app.js day(), attempt 1). Offer
    // one retry; if it fails again the flow falls through to manualReview below.
    coverageRetry: {
      title: "Estamos verificando tu zona…",
      message: "Alguien debió salpicarle soda al servidor. Probá de nuevo 👇",
      button: "Reintentar",
    },
    // Covered city, but no delivery time we can offer (no serviceable route). Hand off to
    // a human via WhatsApp; the lead is already saved server-side (POST /api/manual-review).
    manualReview: {
      title: "¡Estás en nuestra zona!",
      message:
        "Para coordinar el día de entrega escribinos por WhatsApp! 👇",
      button: "Coordinar por WhatsApp",
      // The [REV-COB] tag lets the backend recognize the case and keep the AI silent so a
      // human replies (mirror of MANUAL_REVIEW_TAG in src/engine/manual-review.ts).
      waText:
        "Hola! Me registré en la web y quiero coordinar la entrega en mi zona! [REV-COB]",
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
