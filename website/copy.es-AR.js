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
      { name: "Bidón Retornable", description: "20 ó 12 litros, agua pura y fresca, cuidada, directo a tu mesa.", image: "botellon-20l.webp" },
      { name: "Bidón Menos Sodio", description: "20 ó 12 litros, la misma calidad de siempre, ahora baja en sodio.", image: "botellon-12l-ms.webp" },
      { name: "Soda en Sifón", description: "1.5 L, retornable y eco-firedly, el clásico de toda mesa Argentina.", image: "soda-sifon.webp" },
      { name: "Agua Saborizada", description: "1.5 L de pura frescura! Sabores naranja, pomelo, manzana, multifruta y citrus.", image: "saborizada.webp" },
      { name: "Gaseosas", description: "2 L, infaltables en tu mesa! Sabores cola, pomelo, tónica, lima limón y naranja.", image: "gaseosas.webp" },
      { name: "Agua en Botellas", description: "2 L, la misma pureza que conocés, lista para acompañarte a donde vayas!", image: "agua-botellas.webp" },
      { name: "Cimes Plus Isotónica", description: "750 mL, lo mejor para el entreno! Sabores frutas tropicales, manzana y cold blue.", image: "isotonica.webp" },
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
    ],
    // Argentine mobile area codes per covered city (for the phone-field prefill/mask).
    areaCodes: {
      "Agote": "2324",
      "Altamira": "2324",
      "Belén de Escobar": "348",
      "Campana": "3489",
      "Capilla del Señor": "2323",
      "Capitán Sarmiento": "2478",
      "Carlos Keen": "2323",
      "Carmen de Areco": "2273",
      "Chivilcoy": "2346",
      "Fátima": "230",
      "Gowland": "2324",
      "José María Jauregui": "2323",
      "General Las Heras": "220",
      "Lobos": "2227",
      "Loma Verde": "348",
      "Los Cardales": "3489",
      "Luján": "2323",
      "Manzanares": "230",
      "Mercedes": "2324",
      "Navarro": "2272",
      "Olivera": "2323",
      "Open Door": "2323",
      "Parada Robles": "2323",
      "Pilar": "230",
      "Pueblo Nuevo": "2285",
      "San Andrés de Giles": "2325",
      "San Antonio de Areco": "2326",
      "Suipacha": "2324",
      "Tomás Jofré": "2324",
      "Torres": "2323",
      "Villa Lía": "2326",
      "Villa Ruiz": "2323",
      "Zárate": "3487"
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
    // Numbered stepper labels (progress bar), one per wizard step. The city is
    // picked before the wizard starts (home page / bare /alta), so it isn't one.
    steps: ["Datos", "Dispenser", "Productos", "Envío", "Resumen"],
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
    // Step 2. Two decisions on one screen: which dispenser (or none) and which
    // water. The water choice filters the catalog on the next step — común and
    // bajo en sodio can't be mixed on a comodato — and sets the abono price.
    // Every number here comes from the API's `frio_calor` block; nothing about
    // prices is written in this file.
    dispenserStep: {
      title: "¿Querés un dispenser?",
      // Comodato is the one idea both cards share; maintenance belongs to the
      // frío/calor card only (the natural has no electronics to service).
      intro: "Te prestamos el dispenser en comodato, lo disfrutas sin costo.",
      waterLabel: "¿Qué agua tomás?",
      water: { comun: "Común", bajo_sodio: "Bajo en sodio" },
      continue: "Continuar",
      frioCalor: {
        title: "Dispenser Frío/Calor",
        badge: "50% OFF el primer mes",
        // `abono` = full monthly price, `first` = what they pay on delivery day.
        // First line is the price line. Said here and in the summary, nowhere else.
        body: (bottles, abono, first) => [
          `**${first}** el primer mes, luego ${abono}.`,
          `Incluye ${bottles} botellones de 20L todos los meses.`,
          "Frío y calor al instante.",
          "Mantenimiento y service, por nuestra cuenta.",
        ],
        // The things people are surprised by later, said up front. The first one
        // is the big one: the included botellones are a monthly allowance, not a
        // single drop-off. Deliberately says nothing about visit frequency.
        fine: (bottles, excedente) =>
          `Tarifa fija: se cobra completa aunque consumas menos de ${bottles}. ` +
          `Del ${bottles + 1}º botellón en adelante, ${excedente} cada uno. Se abona del 1 al 10.`,
      },
      natural: {
        title: "Dispenser Natural",
        badge: "GRATIS",
        // No electronics in it, so nothing about maintenance or service here — the
        // selling point is the opposite: nothing to plug in, nothing to pay.
        body: [
          "Sin cargo: pagás solo los botellones.",
          "Agua a temperatura ambiente.",
          "No se enchufa: ponelo donde quieras.",
        ],
      },
      ninguno: {
        title: "Sin dispenser",
        body: "Me interesan **otros productos** y no preciso dispenser.",
      },
      errors: { required: "Por favor, elija una opción para continuar." },
    },
    productStep: {
      title: "Elegí tus productos",
      loading: "Buscando los precios de tu ciudad…",
      continue: "Continuar",
      total: "Total",
      // With an abono this step only totals the products; the abono joins them at
      // the summary, so the bar says subtotal rather than pretending to be a total.
      subtotalProducts: "Subtotal productos",
      // On the card of the botellón the abono covers: says the listed price only
      // starts applying once those are used up.
      included: (n) => `primeros ${n} incluidos`,
      // Natural comodato only: the dispenser is free, so the botellones ARE the
      // order. Said up front here, enforced on Continuar (steps.js product()).
      naturalHint: "Dispenser Natural: por favor elija al menos un botellón.",
      errors: {
        bottleRequired: "Por favor, elija al menos un botellón de 20 o 12 L para continuar.",
      },
    },
    // Step 1. The city is already chosen (it's in the URL), so it's shown here as
    // a header row with a way back to the picker rather than as its own step.
    dataStep: {
      title: "Tus datos de entrega",
      cityLabel: "Ciudad",
      change: "Cambiar",
      firstName: "Nombre",
      lastName: "Apellido",
      phone: "Teléfono (WhatsApp)",
      direccion: "Dirección",
      // Example carries a city to signal that a full address is accepted here — the
      // field is freeform and the backend geocodes the raw string (see places.js).
      direccionPlaceholder: "Ej: Av. Rivadavia 770, Luján",
      piso: "Piso / Depto / Referencia (opcional)",
      crossStreets: "Entre calles (opcional)",
      next: "Continuar",
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
      // With a frío/calor abono the total isn't just the products: the first
      // (discounted) month is collected on delivery day too, so the two are
      // broken out before the total rather than silently added together.
      totalOnDelivery: "Total a pagar en la entrega",
      subtotalProducts: "Subtotal productos",
      included: "Incluido",
      // Restated at confirmation: the included botellones are a monthly
      // allowance, not one delivery. Same promise as the card's fine print.
      abonoNote: (bottles) =>
        `Los ${bottles} botellones incluidos son el total del mes y te los vamos dejando a medida que los consumís.`,
      address: "Dirección",
      day: "Entrega",
      dispenser: "Dispenser",
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
