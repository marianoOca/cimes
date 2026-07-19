# Propuesta comercial — Sistema de ventas y logística por WhatsApp

**Para:** Lisandro Silva — CIMES (cimes-silva.com)
**De:** Mariano Oca — FA Automations (faautomations.net)
**Fecha:** 10 de julio de 2026
**Validez:** 15 días

---

## 1. El problema hoy

El circuito de ventas depende de dos sistemas que no están integrados entre sí: Ventry (CRM genérico sobre GoHighLevel, ~USD 200/mes) y WaterService (sistema de reparto). Eso genera:

- **Doble carga manual.** Cada pedido confirmado debe cargarse manualmente en WaterService (cliente + ticket al repartidor): ~10 minutos por pedido. Con más de 30 conversaciones abiertas, hay leads que quedan sin responder — y un lead sin respuesta es una venta perdida.
- **Búsqueda manual de cobertura.** Para determinar qué reparto y qué día corresponden a un lead, hay que buscar la dirección en el mapa de WaterService y revisar los clientes cercanos uno por uno.
- **Un bot con fallas en puntos críticos:**
  - Confunde las listas de precios (informa el precio de Mercedes a un cliente de Campana → mala primera impresión y conflicto en la entrega).
  - No tiene memoria: vuelve a pedir todos los datos a quien ya se registró en la web o escribió la semana anterior.
  - No utiliza botones ni ubicación (los leads evitan escribir).
  - Tarda ~30 segundos en responder y responde indefectiblemente a todos los mensajes.

**Los números de junio:** 700 conversaciones por WhatsApp → 70 cierres. 250 registros por la web a los que el bot vuelve a preguntarles lo que ya completaron. Hay un margen claro para convertir más con la misma pauta.

---

## 2. La solución

Un sistema propio, hecho a medida para la operación de CIMES, que **reemplaza a Ventry** y conecta todo el circuito de punta a punta:

> Anuncio → WhatsApp **o** alta autoservicio en la web → verificación de cobertura automática → confirmación del pedido → alta automática en WaterService → ticket al repartidor.

El día comienza con **pedidos listos para despachar**, en lugar de decenas de conversaciones pendientes de lectura.

---

## 3. Entregables

### 3.1 Bot de WhatsApp con IA (API oficial de Meta)

- Conectado por API oficial: **sin riesgo de bloqueo del número**. Soporta las dos líneas de la empresa (ventas y atención).
- Respuesta inmediata (sin la demora de 30 segundos).
- **Botones interactivos** para elegir producto y confirmar, y **formulario de datos de entrega** (nombre, calle, altura, entre calles) dentro del mismo WhatsApp, como el bot de Ivess.
- **Seguimiento inteligente de leads**: cuando una conversación se enfría, el sistema envía hasta 3 mensajes de seguimiento dentro de la ventana de 24 horas (sin costo), adaptados al punto exacto donde quedó cada persona. Hoy esos leads se pierden en silencio; recuperarlos es **aumento directo de la tasa de cierre**.
- **Listado de precios por ciudad**: imposible que cruce precios de Mercedes y Campana.
- **Memoria de conversación**: no vuelve a solicitar datos, aunque la conversación se retome semanas después.
- **Detecta los registros de la web**: saluda con los datos ya cargados y va directo al producto.
- Ante consultas fuera de lo previsto, **deriva la conversación a un humano y envía un aviso**.
- **Recordatorio inteligente de deuda**, clientes con saldos pendientes serán recordados la mañana o el día antes de su respectiva recorrida su saldo adeudado.

### 3.2 Cobertura y día de entrega automáticos

- La dirección del lead se consulta contra la API de WaterService (*clientes cercanos*), que la geolocaliza y devuelve los repartos que atienden la zona, con su día y franja horaria.
- El sistema muestra directamente las opciones disponibles: **"Reparto 1 — jueves a la mañana / Reparto 10 — viernes a la tarde"**, eliminando la búsqueda manual en el mapa.
- Radio de cobertura configurable (ej.: 500 m / 1.000 m).
- Detección temprana de **"otra ciudad / sin cobertura"**, antes de invertir tiempo en la conversación.

### 3.3 Alta automática en WaterService

- Pedido confirmado → se crea automáticamente el **cliente** (nombre, teléfono, dirección geolocalizada, día de reparto) y el **ticket al repartidor** (horario de paso y monto a cobrar) vía API.
- **Se elimina la doble carga:** los ~10 minutos de carga manual por pedido se reducen a cero.

### 3.4 Panel de conversaciones (reemplaza Ventry)

- Vista tipo WhatsApp con todas las conversaciones de los dos números, para revisar qué se habló y detectar cualquier error del bot.
- **Etiquetas dinámicas**: además de las etiquetas actuales (*sin respuesta, interesado, cliente cerrado, pedido cerrado, mal lead, otra ciudad*), cada lead muestra en qué etapa del proceso está y cuántos seguimientos recibió. De un vistazo se ve dónde se pierden los leads: información concreta para mejorar la conversión mes a mes.
- Cualquier conversación puede intervenirse manualmente en el momento en que se desee.

### 3.5 Planilla central de pedidos

- Todos los pedidos (web + WhatsApp) en una sola planilla: nombre, teléfono, dirección, producto, reparto asignado, día de entrega, productos, monto a cobrar.
- Funciona como tablero de control diario: cada pedido cerrado es una fila nueva, lista para despachar.

### 3.6 Página web nueva (estilo Ivess Rosmino)

- Estructura de referencia: aguaivess.rosmino.com.ar — doble vía de alta (**autoservicio en la web** + **WhatsApp**), catálogo de productos (botellones, soda, saborizadas, dispensers frío-calor), "cómo funciona" en 3 pasos, zonas de cobertura.
- **Alta autoservicio de punta a punta**: la persona elige su ciudad, ve los productos con los precios que le corresponden, carga sus datos, y el sistema verifica la cobertura en el momento y le ofrece los días de reparto disponibles. Al confirmar, el pedido entra directo a la planilla y a WaterService, **sin pasar por WhatsApp ni ocupar a nadie del equipo**: la web vende sola, las 24 horas. (Confirmación por WhatsApp opcional)
- **Mobile-first**, optimizada para la conversión en mobile. Con versión desktop disponible también.
- **SEO básico**: metadata y estructura para aparecer en búsquedas de Google ("soda Mercedes", "dispenser agua Luján", etc.).
- Publicada en el hosting actual de la empresa (Hostinger).

### 3.7 Captación directa en Instagram (lead form nativo)

- Publicidad en Instagram donde la persona **completa sus datos sin salir de la app**: al deslizar, se abre un formulario nativo con nombre y teléfono ya pre-cargados por Meta, solo confirma y envía.
- Cada registro entra automáticamente al sistema y **recibe al instante un WhatsApp con sus datos ya cargados**, listo para elegir producto y día de entrega. Menos fricción en el anuncio = más leads con la misma pauta.
- Requiere la aprobación de permisos de Meta para la cuenta (trámite estándar; se inicia el primer día).

---

## 4. Inversión

| Concepto | Monto |
|---|---|
| Desarrollo (alcance completo del punto 3) | **USD 600** |
| — Anticipo al inicio | USD 300 |
| — Contra entrega | USD 300 |
| Mantenimiento mensual **todo incluido** (detalle a continuación) | **USD 90/mes** |

**Comparación:** el costo actual de Ventry es de ~USD 200/mes. Este sistema, con todos los costos incluidos, representa un **ahorro de USD 110/mes**: la inversión de desarrollo se amortiza en poco más de 5 meses.

**El abono de USD 90/mes incluye todos los costos del sistema:**

- Plataforma de WhatsApp API oficial de Meta (Kapso, plan Pro): los dos números de la empresa conectados, sin riesgo de bloqueo.
- Plantillas de Meta (los mensajes que inicia la empresa: primer contacto a los leads de Instagram y confirmaciones opcionales). Las conversaciones con los leads y los seguimientos no tienen costo.
- IA (Claude de Anthropic) para el bot.
- Servidores y hosting del sistema.
- Soporte, ajustes del bot y mejoras menores.

**Cláusula de volumen:** el abono cubre la operación actual, hasta ~1.000 conversaciones/mes. Si la pauta escala por encima de ese volumen, el abono se ajusta en proporción al consumo real, con los números a la vista.

---

## 5. Plazo

**1 semana** desde el anticipo y la entrega de accesos. La validación se realiza con una emulación de un número real. Incluye 2 semanas de ajustes post-entrega sin costo.

---

## 6. Qué se necesita para arrancar

1. **Confirmación de la propuesta y anticipo de USD 300.**
2. **Números de WhatsApp:** los dos números están hoy conectados a Ventry vía la API de Meta. Para pasarlos a la nueva plataforma es necesario migrarlos, lo que requiere acceso de administrador al Business Manager de Meta y la liberación de cada número por parte de Ventry. Se puede dejar como último paso una vez que esté todo construido y testeado.
3. **Acceso a Hostinger** para publicar la página web.
4. **Acceso a WaterService** para configurar las APIs para las integraciones.
5. **Conocimiento comercial para el bot:** modalidad de cobro del frío-calor, alquiler o venta de bidones, frecuencia de visitas, horarios, y las preguntas frecuentes con sus respuestas. Idealmente, la configuración actual del bot de Ventry como punto de partida. **Acceso al ventri actual** también.
6. **Delimitación de zonas de alcance del servicio** para que cuando el usuario nos de una dirección poder confirmarle si se le puede enviar a su dirección o no.

---

## 7. Consultas a resolver

**Precios: ¿dónde se encuentran estos?**
 - Sistema WaterService
 - Google Sheets
Esto cambia cómo se conecta a la IA para que se obtengan los precios para las consultas de los clientes.

**Página web: ¿colores / branding?** La iniciativa es que la página web sea exactamente igual a la de la competencia (https://aguaivess.rosmino.com.ar/), pero con los logos de Cimes; eso puede que no combine bien con los colores de la página que vamos a copiar. ¿Preferís definirlo ahora, o cuando ya tengamos la página armada vemos los últimos retoques? (Serán solo colores o imágenes de fondo/productos, sin ningún re-diseño más allá de eso.)

**Radio de cobertura. ¿De cuánto?** Un usuario nuevo se quiere dar de alta, para ello se le ofrecen los horarios de los recorridos próximos a su domicilio. Los recorridos ofrecidos se basan en los recorridos de gente que ya es cliente dentro de un cierto radio. ¿De cuánto es ese radio? Es decir, ¿cuántos metros más se extendería un recorrido para alcanzar a un nuevo cliente?

---

*Mariano Oca — FA Automations — marianoagoca@gmail.com*
