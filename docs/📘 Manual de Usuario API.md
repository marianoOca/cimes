## **CHANGELOG** 

|**CHANGELOG**|**CHANGELOG**|**CHANGELOG**|
|---|---|---|
|**Versión**|**Fecha**|**Log**|
|**1.0.0**|**2026-03-03**|**Corrección en el nombre de la variable requerida en la API 21**|
|**1.0.1**|**2026-03-03**|**Documentación API 31: Obtener Abonos masivamente**|


## 📘 **Manual de Usuario API – Integración Chatbot** 

Este manual describe cómo interactuar con los distintos endpoints disponibles para la integración del chatbot con el sistema. 

Todos los endpoints salvo el de logueo, requieren un HEADER con el token obtenido precisamente en el logueo, con la siguiente definición 

|||||**Token de sesión**|
|---|---|---|---|---|
|HEADER|**CURRENTTOKENVALUE**|**Alfanumérico**|**40**|**obtenido con el**|
|||||**método GetToken()**|



Los endpoints que devuelven JSON siempre obtendrán un status 200, con el dato “error” dentro de la respuesta igual a 0. En caso de error la respuesta tendrá el dato “error” distinto de 0 y la siguiente forma 

**DESCRIPCIÓN { "error": 1, "message": "Mensaje de error determinado por el servidor", …. }** 

## **ÍNDICE** 

**==> picture [429 x 548] intentionally omitted <==**

**----- Start of picture text -----**<br>
|||
|---|---|
|🔐|1. Logueo para el sistema......................................................................................5|
|🧍|2. Identificación del cliente...................................................................................6|
|🎫|3. Generación de ticket.........................................................................................9|
|📍|4. Clientes cercanos por coordenada...................................................................14|
|💲|5. Obtener lista de precios del cliente de un cliente............................................ 16|
|📄|6. Generación del Alta Temprana del cliente....................................................... 17|
|📇|7. Agregar contacto a cliente...............................................................................21|
|🧍|8. Obtener datos de un cliente............................................................................23|
|🧍|9. Obtener cliente Sucursales..............................................................................25|
|📥|10. Obtener matriz de lista de precios.................................................................27|
|💲|11. Obtener abonos tipos.................................................................................... 29|
|📍|12. Clientes cercanos por dirección..................................................................... 30|
|📄|13. Historial de facturas del cliente por fecha......................................................32|
|📄|14. Recibos de pago de un cliente....................................................................... 34|
|📄|15. Resumen de cuenta cliente........................................................................... 36|
|📄|16. Orden de trabajo servicio técnico..................................................................38|
|📄|17. Remitos de entrega....................................................................................... 40|
|📄|18. Descarga de remitos de entrega.................................................................... 42|
|📄|19. Descarga de archivos.....................................................................................43|
|💲|20. Obtener link mercado pago............................................................................44|
|💲|21. Obtener saldos de cliente..............................................................................45|
|📤|22. Reenvío de Factura........................................................................................46|
|📤|23. Reenvío de Remito........................................................................................46|
|📤|24. Reenvío de Recibo.........................................................................................47|
|🔐|25. Obtener Usuario y Contraseña de un Cliente................................................. 48|
|📄|26. Obtener Incidentes de un Cliente.................................................................. 49|
|📄|27. Obtener Clientes con contactos modificados...............................................51|
|💲|28. Obtener Facturas con saldos modificados................................................... 54|
|📄|29. Obtener Clientes Masivamente.......................................................................56|
|📄|30. Obtener Contactos Masivamente................................................................... 59|
|📄|31. Obtener Abonos Masivamente....................................................................... 61|
|APÉNDICE.................................................................................................................... 64|

**----- End of picture text -----**<br>


4 

## 🔐 1. Logueo para el sistema 

**Descripción:** Autentica al usuario y devuelve un token para el uso de los demás endpoints. 

## **Endpoint:** POST (URL)+ /api/Session/GetToken 

Request Content Type: application/json sobre HTTPS 

## **Parámetros** 

## **POST BODY** 

**{ "username": "admin", "password": "sistemaws" }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**username**|Alfanumérico|50|Nombre del<br>usuario para<br>inicio de sesión|
|**password**|Alfanumérico|50|Contraseña de<br>usuario|



## ✅ **Response** 

**JSON { "tokenValido": "687f8b1325da9d0d54c3f046", "vencimiento": "2025-07-22 11:58:59", "error": 0, "message": "Logueo correcto", "usuario_id": 12 }** 

5 

## 2. Identificación del cliente 🧍 

## **Endpoint:** POST (url) + /api/Clientes/BusquedaRapidaResultJson 

**Descripción:** Devuelve los datos de un cliente en base a algún criterio (teléfono, nombre, DNI/CUIT, domicilio). 

Request Content Type: application/json sobre HTTPS 

## **Parámetros** 

**POST BODY { "datosCliente": "christian", "telefono": "+54", "dni": "3", "domicilio":"a" }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**datosCliente**|Alfanumérico|50|Obtener aproximación de nombre por texto<br>de cliente o datos de facturación|
|**telefono**|Alfanumérico|15|Obtener cliente por el teléfono|
|**dni**|Alfanumérico|20|Obtener cliente por el DNI/CUIT|
|**domicilio**|Alfanumérico|80|Obtener cliente por el domicilio|



## ✅ **Response** 

**JSON { "data": [ { "fechaProximaVisita1": "2026-02-09", "fechaProximaVisita2": "2026-02-23", "fechaProximaVisita3": "2026-03-09", "usuarioRepartidorHabitual": 13886, "cliente_id": 53, "nombreCliente": "Alvarez Pablo", "nombreReparto": "1234", "nombrePromotor": "Admin", "actividad_ids": 24, "tipoCliente_ids": 1, "estadoCliente_ids": 1, "promotor_id": 1, "reparto_id": 2, "dniCliente": null, "nombreProvincia": "Buenos Aires", "nombreCiudad": "Brandsen", "nombreBarrio": "Brandsen","domicilioCompleto": "Brandsen, Rivadavia 770.", "provincia_ids": 2, "ciudad_id": 10, "barrio_id": 477, "calle_id": 17, "torre": "", "piso": "", "depto": "", "manzana": "", "lote": "", "numeroPuerta": "770", "nombreCalle": "Rivadavia", "actividadCliente": "Taller", "tipoCliente": "Familia", "estadoCliente": "Activo", "datosCompletos": true, "clientePadre": null, "fechaNacimiento": "/Date(1577847600000)/", "fechaIngreso": "/Date(1577847600000)/", "codigoPostal": "1980", "altitud": "", "longitud": "", "fechaUtlimaEntrega": null, "fechaUltimoCobroFactura": null, "fechaUltimaEnvases": null, "fechaUltimaDevoluciones": null, "validarOrdenesDeCompra": false, "validaCredito": false, "creditoPermitido": 100000.00, "limiteFacturas": 30, "facturacionAutomatica": true, "datosFacturacion_id": 53, "condicionIva_ids": 2, "tipoFactura_ids": 2, "cuit": "1111111111", "dniPersona": "", "ingresosBrutos": "1111111111", "domicioFiscal": "Rivadavia 770", "razonSocial": "Alvarez Pablo", "centroDistribucion_id": 1, "centroDeDistribucion": "CD Testing", "orden": 0, "cicloVisitas": 0, "etiquetas": [], "situacionConsumo": 1, "situacionSaldos": 1 } ], "error": 0, "message": "" }Nota: con cualquiera de los parámetros (datoscliente, teléfono, dni, domicilio) se puede realizar la búsqueda.** 

8 

## 3. Generación de ticket 🎫 

## **Endpoint:** POST /api/Incidentes/Save 

**Descripción:** Crea un ticket para que un operador llame al cliente. Para profundizar más en el tema tenemos una tabla de tipos de incidentes y otras que son subtipos de incidentes, y se describen a continuación a modo de ejemplo, ya que dependen de cada entorno: 

|**Id**|**Nombre Incidente**|
|---|---|
|**1**|**Gestión en ruta**|
|**8**|**Gestión Administrativa**|
|**2**|**Servicio Técnico**|
|**50**|**Llamadas a cliente**|
|**60**|**Gestión de alertas**|



Ahora las tablas de sub tipos de incidentes: 

## 1. **Gestión en ruta** : 

|**Id**|**Nombre Incidente**|
|---|---|
|**1**|Solicitud de artículos|
|**2**|Reclamopor no visita|
|**13**|Gestión cobranza|
|**28**|Visita por alta|
|**48**|Gestión de envases|
|**502**|Replanificación visita|



## **2. Gestiones Administrativas:** 

|**Id**|**Nombre Incidente**|
|---|---|
|**501**|Gestión de baja de cliente|
|**510**|Pausado de cliente|
|**42**|Cobranza|



## **3. Servicio técnico:** 

|**Id**|**Nombre Incidente**|
|---|---|
|**4**|Instalaciónde dispenser|
|**5**|Quitar dispenser|
|**7**|Sanitización|
|**8**|Reubicación dispenser|
|**9**|Reparación|



## **4. Llamadas a cliente:** 

|**Id**|**Nombre Incidente**|
|---|---|
|**50**|Llamarpor replanificación de servicio técnico|



9 

## **5. Gestión de alertas:** 

|**Id**|**Nombre Incidente**|
|---|---|
|**61**|Límite Superado|
|**62**|Préstamos envases vencidos|
|**46**|Verificar cantidad de abonosydispensers|
|**100**|Toma de coordenadas|
|**503**|Precios especialesvencido|
|**504**|Precios especiales por vencer|
|**505**|Orden compra vencida|
|**506**|Orden compra por vencer|
|**507**|Abono cliente vencido|
|**508**|Abono clientepor vencer|
|**509**|Alta rápida de cliente|



## **Parámetros** 

**POST BODY { "centroDistribucion_id": 3, "cliente_id":1018, "descripcion":"<p>Descripción Prueba</p>",** 

**"estadoIncidente_ids":null, "fechaCierreEstimado":"21/7/2025",** 

**"severidad_ids":2, "subTipoIncidente_ids": 1, "tipoIncidente_ids": 50, "titulo":"Titulo Prueba", "usuarioResponsable_id": null, “grupoResponsable_ids” : null, “usuariosSeguimiento_ids”: [1, 6] }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**centroDistribucion_id**|numérico||Id del centro de distribución|
|**cliente_id**|numérico||Id del cliente|
|**descripcion**|Alfanumérico|255|Campo de texto que describe el<br>incidente con detalle Ejemplo:<br><p>TEXTO<p/>|
|**estadoIncidente_ids**|numérico||Id que define el estado del<br>incidente, Abierto = 1, Cerrado =<br>5, Cancelado = 3, Pausado = 4,<br>PendienteAprobacion = 6,<br>Derivado = 7|
|**fechaCierreEstimado**|Alfanumérico|12|Fecha estimada de cierre del<br>incidente en formato<br>“dd/MM/yyyy”|



10 

|**severidad_ids**|numérico||Id usado para saber la prioridad<br>del incidente. Ejemplo:<br>Baja=1, Media=2, Alta=3,|
|---|---|---|---|
|**tipoIncidente_ids**|numérico||Id que define el tipo del<br>incidente.<br>Para"Lamar a cliente" =50|
|**subTipoIncidente_ids**|numérico||Id que define el subtipo del<br>incidente. Ejemplo:<br>“Llamar por replanificación de<br>Ser Tec” = 50|
|**titulo**|Alfanumérico|100|Es el título que va a tener el<br>incidente|
|**usuarioResponsable_id**|numérico||Es el Id del usuario que será<br>responsable, en caso de enviar el<br>grupo responsable, este valor<br>debe ser null|
|**grupoResponsable_ids**|numérico||Es el id del grupo responsable<br>del ticket, en caso de mandar el<br>id del usuario responsable, este<br>campo debe viajar null.|
|**usuariosSeguimiento_ids**|array||Listado de ids de usuarios para<br>dar seguimiento al incidente|



## ✅ **Response** 

**JSON { "error": 0, "incidente": { "id": 10190, "fechaHoraRegistro": "/Date(1753112501144)/", "usuarioRegistra": 1, "cliente_id": 1018, "titulo": "Titulo Prueba", "descripcion": "<p>Descripción Prueba</p>", "tipoIncidente_ids": 50, "severidad_ids": 2, "pedido_id": null, "usuarioResponsable_id": 0, "fechaCierreEstimado": "/Date(1753066800000)/", "fechaCierreReal": null, "estadoIncidente_ids": 0, "eliminado": false, "subTipoIncidente_ids": 1, "clientePadre_id": 1018, "servicioTecnico_id": null, "incidenteRelacionado": null, "grupoResponsable_ids": null, "usuariosSeguimiento_ids": null, "centroDistribucion_id": 3, "usuariosSeguimiento": null}, "servicioTecnico": { "id": 0, "cantidadDispensers": 0, "sectorUbicacion": null, "responsableEnCliente": null, "telefonoResponsable": null, "comentariosDeCierre": null, "usuarioTecnicoId": null, "fechaVisitaPlanificada": null, "cumplido": false, "fechaRealVisita": null, "esSanitizacionPlanificada": false, "precio": null, "RazonesDeCierre_ids": null, "orden": null, "dispenser_id": null, "sintoma_ids": 0, "cliente_id": 1018, "fechaCreacion": "/Date(-62135586000000)/", "prioridad_ids": 0, "estadoServicioTecnico_ids": 0, "comentarios": null, "franjaHoraria_ids": null, "centroDistribucion_id": 3, "idsDispensers": null }, "pedido": { "id": 0, "clienteFactura_id": 0, "clienteAVisitar_id": 0, "fechaRecepcion": "/Date(-62135586000000)/", "usuarioRegistra": 0, "tipoPedido_ids": 0, "comentarios": null, "asignarHojaDeRuta": false, "hojaDeRuta_id": null, "reparto_id": null, "fechaPlanificadaAtencion": null, "estadoPedido_ids": 0, "fechaRealAtencion": null, "repartoIdRealAtencion": null, "comentariosAtencion": null, "enviadoAMovil": false } }** 

12 

13 

## 📍 4. Clientes cercanos por coordenada 

**Endpoint:** GET /Repartos/ObtenerClientesCercanosPorCoordenadas **Descripción:** Lista clientes dentro de un radio determinado a partir de coordenadas GPS. 

## **Parámetros** 

**GET PARAMS { "excluir": false, "latitud": "-31.34374425512577 ", "longitud": "-64.25413477249496 ", "radioMetros ": 500 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**excluir**|Alfanumérico|50|Campo booleano que normalmente es<br>falso, es para aplicar el filtros o no|
|**latitud**|Alfanumérico|50|La latitud indica laposición norte o sur|
|**longitud**|Alfanumérico|50|La longitud indica la posición este u<br>oeste.|
|**radioMetros**|numérico||Son los metros de distancia del lugar<br>buscado|



## ✅ **Response** 

**JSON { "clientesCercanos": [ { "cliente_id": 1017, "nombreCliente": "Julieta Pillado", "nombreReparto": "1234", "zona": "Sin especificar", "latitud": -31.3441697, "longitud": -64.254893299999992, "domicilioCompleto": "Córdoba, PADRE FRANCISCO PALAU 6575. depto 3. ", "distanciaMetros": 86.18, "listaDePrecios_id": 1, "visitas": [ { "cliente_id": 1017, "dia_ids": 5, "orden": 0.00, "nombreCliente": "Julieta Pillado", "domicilioCompleto": "Córdoba, PADRE FRANCISCO PALAU 6575. depto 3. ", "reparto_id": 2, "nombreReparto": "1234", "tipoCliente": "Empresa","estadoCliente": "Activo", "dia": "Viernes", "altitud": "-31.3441697", "longitud": "-64.25489329999999", "semana": 1, "semanaMensual": 1, "color": null, "haCambiado": 0, "ultimasVisitas": null } ], "proximaVisita": "/Date(1753401600000)/", "diasProximaVisita": 3 } ], "error": 0 }** 

15 

## 💲 5. Obtener lista de precios del cliente de un cliente 

**Endpoint:** GET /ListaDePrecios/ObtenerListaDePreciosDeCliente **Descripción:** Devuelve la lista de precios correspondiente al cliente más cercano. 

## **Parámetros** 

**==> picture [393 x 108] intentionally omitted <==**

**----- Start of picture text -----**<br>
GET PARAMS<br>{<br>    "ClienteId":1036<br>}<br>Definición de datos<br>PARÁMETRO  TIPO DATO   LONGITUD  DESCRIPCIÓN<br>ClienteId  numérico  Id del cliente<br>**----- End of picture text -----**<br>


**==> picture [63 x 14] intentionally omitted <==**

**----- Start of picture text -----**<br>
✅  Response<br>**----- End of picture text -----**<br>


**==> picture [336 x 153] intentionally omitted <==**

**----- Start of picture text -----**<br>
JSON<br>{<br>    "ArticulosDeListaDePrecio": {<br>        "Bidon x 20 lts": 800.00,<br>        "Bidon x 12 lts": 500.00,<br>        "Sifon x 1 1/4": 500.00,<br>        "bidon de 20L Monte": 150.00,<br>        "bidon de 12L Monte": 200.00<br>    },<br>    "error": 0<br>}<br>**----- End of picture text -----**<br>


16 

## 📄 6. Generación del Alta Temprana del cliente 

**Endpoint:** POST /Clientes/CrearNuevoClientePorChatBot **Descripción:** Registra anticipadamente un nuevo cliente en el sistema. 

## **Parámetros** 

**POST BODY { "cliente": { "nombre": "Cliente de alta rapida", "tipoDeClienteId": 1, "condicionIvaId": 2, "dniCuit": "3454564566", "telefono": "00", "email": "al456756756@test.com", "listaDePreciosId": 1, "reparto_id": 1007, "domicilio": { "provincia": "Salta", "ciudad": "Salta", "calle": "Av. Sarmiento", "puerta": 2, "observaciones": "", "piso": "4", "depto": "b", "torre": "", "cp": "X5012", "lote": "", "manzana": "", "latitud": "-31.3651314", "longitud": "-64.156489" } } }** 

17 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**cliente**|Objeto Cliente||Estructura con los datos del cliente|



## **Estructura Objeto Cliente** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**Nombre**|Alfanumérico|50|Nombre del cliente|
|**tipoDeClienteId**|numérico||Id del tipo de Cliente:<br>“Familia” = 1,<br>“Empresa” = 2|
|**actividadId**|numérico||Id de la actividad del cliente:<br>“Comercio” = 1<br>“Servicios Profesionales” = 2,<br>“Educación” = 3,<br>“Industria” = 4,<br>“Consumidor final” = 15,<br>“Otras” = 18|
|**condicionIvaId**|numérico||Id de la Condición del Iva:<br>“Responsable Inscripto” = 1,<br>“Consumidor Final” = 2,<br>“Monotributista”= 3,<br>“Sujeto Exento”= 4,<br>“IVA No alcanzado” = 5|
|**dniCuit**|Alfanumérico|30||
|**Telefono**|Alfanumérico|15||
|**Email**|Alfanumérico|50||
|**listaDePreciosId**|numérico||Id lista deprecios|
|**reparto_id**|numérico||Id del reparto|
|**domicilio**|Objeto<br>Domicilio||Estructura con los datos del domicilio<br>para el nuevo cliente|



## **Estructura Objeto Domicilio** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|
|---|---|---|---|
|**provincia**|Alfanumérico|250|Nombre de la provincia|
|**ciudad**|Alfanumérico|250|Nombre de la ciudad|
|**calle**|Alfanumérico|250|Nombre de la calle|
|**puerta**|Numérico||Numeración de la calle|
|**observaciones**|Alfanumérico|250|Observaciónadicionaldeldomicilio|
|**piso**|Alfanumérico|30|Piso del domicilio|
|**depto**|Alfanumérico|30|Identificación del departamento|
|**torre**|Alfanumérico|30|Identificación torre o edificio|
|**cp**|Alfanumérico|20|Códigopostal del domicilio|
|**lote**|Alfanumérico|20|Lote de domicilio|
|**manzana**|Alfanumérico|30|Manzana del domicilio|
|**latitud**|Alfanumérico|50|Latitud del domicilio|
|**longitud**|Alfanumérico|50|Longitud del domicilio|



✅ **ResponseJSON** 

**{ "error": 0, "message": "", "data": { "cliente_id": 1042, "nombreCliente": "Cliente de alta rapida", "nombreReparto": "S/R", "nombrePromotor": null, "actividad_ids": 15, "tipoCliente_ids": 1, "estadoCliente_ids": 5, "promotor_id": 0, "reparto_id": 0, "dniCliente": "963345344", "nombreProvincia": "Córdoba", "nombreCiudad": "Córdoba", "nombreBarrio": "ALTA CORDOBA", "domicilioCompleto": "Córdoba, ALEJANDRA PIZERNICK 2. piso 4.  depto b. ", "provincia_ids": 1, "ciudad_id": 1, "barrio_id": 19, "calle_id": 397, "torre": null, "piso": "4", "depto": "b", "manzana": null, "lote": null, "numeroPuerta": "2", "nombreCalle": "ALEJANDRA PIZERNICK", "actividadCliente": "Consumidor Final", "tipoCliente": "Familia", "estadoCliente": "Borrador", "datosCompletos": false, "clientePadre": null, "fechaNacimiento": null, "fechaIngreso": "/Date(1753275884110)/", "codigoPostal": "X5012", "altitud": "-31.3651314", "longitud": "-64.156489", "fechaUtlimaEntrega": null, "fechaUltimoCobroFactura": null, "fechaUltimaEnvases": null, "fechaUltimaDevoluciones": null, "validarOrdenesDeCompra": false, "validaCredito": false, "creditoPermitido": 0.00, "limiteFacturas": 0, "facturacionAutomatica": true, "datosFacturacion_id": 1035, "condicionIva_ids": 2,"tipoFactura_ids": 0, "cuit": null, "dniPersona": "963345344", "ingresosBrutos": null, "domicioFiscal": "-", "razonSocial": "Cliente de alta rapida", "centroDistribucion_id": 3, "centroDeDistribucion": "PRUEBA", "orden": 0, "cicloVisitas": 0, "etiquetas": [], "situacionConsumo": 1, "situacionSaldos": 1 } }** 

20 

## 📇 7. Agregar contacto a cliente 

**Endpoint:** POST /api/Clientes/CreateContacto 

**Descripción:** Añade un contacto secundario o alternativo a un cliente existente. 

## **Parámetros** 

**POST BODY { "ModeloContacto": { "tipoContacto_ids": 1, "nombrePersona":"Nombre Persona", "sectorEmpresa":null, "telefono":"+54", "email":"contactoejemplo@test.net", "observaciones":"observaciones", "cliente_id": 33, "contactoPrincipal": 0, "celular":"Prueba 2", "sector_ids": 1077, "caracteristicaCelular": 0, "porCuentaCorriente": 0, "fechaValidacionEmail": null, "codigoValidacion": null, "enviarComprobanteFiscalAdjunto": 0, "enviarRemitos": 0, "enviarOrdenesDeTrabajo": 0, "enviarAvisoDeProximaVisita": 0 } }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|ModeloContacto|Objeto Contacto||Estructura con los datos del<br>contacto|



## **Estructura Objeto Contacto** 

|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**tipoContacto_ids**|numérico||Id que define el tipo de<br>contacto:<br>“Primer contacto” = 1,<br>“Contacto Alternativo” =2|
|**nombrePersona**|Alfanumérico|100|Nombre del Contacto|
|**sectorEmpresa**|Alfanumérico|50|Valor del texto en el<br>sector_ids|
|**telefono**|Alfanumérico|20|Teléfono fijo|
|**email**|Alfanumérico|50|Email del contacto|
|**observaciones**|Alfanumérico|250|Observación sobre el<br>contacto|



21 

|**cliente_id**|numérico||Id del cliente|
|---|---|---|---|
|**celular**|Alfanumérico|20|Celular del contacto|
|**sector_ids**|numérico||Id donde se identifica la<br>relación del contacto con<br>el cliente:<br>“Gerente” = 1,<br>“RRHH” =2<br>“Calidad” = 3<br>“Compras” = 4<br>“Encargado” = 5<br>“Titular” = 6<br>“Pareja” = 7<br>“Organización” =8|
|**caracteristicaCelular**|numérico||Código de área del<br>celular|
|**porCuentaCorriente**|booleano||Valor para establecer la<br>cuenta corriente debe ser<br>false en este caso|
|**enviarComprobanteFiscalAdjunto**|booleano||Bandera (true/false)|
|**enviarRemitos**|booleano||Bandera (true/false)|
|**enviarOrdenesDeTrabajo**|booleano||Bandera (true/false)|
|**enviarAvisoDeProximaVisita**|booleano||Bandera (true/false)|



## ✅ **Response** 

**JSON { "error": "0", "message": "El contacto ha sido creado exitosamente", "cliente_id": "0" }** 

22 

## 8. Obtener datos de un cliente 🧍 

**Endpoint:** POST (url) + /api/Clientes/ObtenerDatosCliente **Descripción:** Devuelve los datos de un cliente en base necesita el (cliente_id) Request Content Type: application/json sobre HTTPS 

## **Parámetros** 

**POST BODY { "cliente_id":  208 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|
|---|---|---|---|
|**cliente_id**|numérico||Id del cliente|



## ✅ **Response** 

**JSON { "fechaProximaVisita1": "2026-03-04", "fechaProximaVisita3": "2026-04-01", "fechaProximaVisita2": "2026-03-18", "diaProximaVisita1": "miércoles", "diaProximaVisita2": "miércoles", "diaProximaVisita3": "miércoles", "cliente_id": 208, "nombreCliente": "Neyra Patricia", "nombreReparto": "1234", "nombrePromotor": "Admin", "actividad_ids": 31, "tipoCliente_ids": 1, "estadoCliente_ids": 1, "promotor_id": 1, "reparto_id": 2, "dniCliente": null, "nombreProvincia": "Buenos Aires", "nombreCiudad": "Ranchos", "nombreBarrio": "Ranchos", "domicilioCompleto": "Ranchos, Chaco  3088.", "provincia_ids": 2, "ciudad_id": 11, "barrio_id": 479, "calle_id": 43, "torre": "", "piso": "", "depto": "", "manzana": "", "lote": "","numeroPuerta": "3088", "nombreCalle": "Chaco ", "actividadCliente": "No aplica", "tipoCliente": "Familia", "estadoCliente": "Activo", "datosCompletos": true, "clientePadre": null, "fechaNacimiento": "/Date(1577847600000)/", "fechaIngreso": "/Date(1577847600000)/", "codigoPostal": "1987", "altitud": "", "longitud": "", "fechaUtlimaEntrega": null, "fechaUltimoCobroFactura": null, "fechaUltimaEnvases": null, "fechaUltimaDevoluciones": null, "validarOrdenesDeCompra": false, "validaCredito": false, "creditoPermitido": 100000.00, "limiteFacturas": 30, "facturacionAutomatica": true, "datosFacturacion_id": 208, "condicionIva_ids": 2, "tipoFactura_ids": 2, "cuit": "1111111111", "dniPersona": "", "ingresosBrutos": "1111111111", "domicioFiscal": "Chaco 3088", "razonSocial": "Neyra Patricia", "centroDistribucion_id": 1, "centroDeDistribucion": "CD Testing", "orden": 0, "cicloVisitas": 0, "etiquetas": [], "situacionConsumo": 1, "situacionSaldos": 1 }** 

24 

## 9. Obtener cliente Sucursales 🧍 

**Endpoint:** POST (url) + /api/Clientes/ObtenerSucursalesJson 

**Descripción:** Devuelve los datos y las sucursales de un cliente en base necesita el (cliente_id) Request Content Type: application/json sobre HTTPS 

## **Parámetros** 

**==> picture [215 x 58] intentionally omitted <==**

**----- Start of picture text -----**<br>
POST BODY<br>{<br>    "cliente_id":  208<br>}<br>**----- End of picture text -----**<br>


## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|
|---|---|---|---|
|**cliente_id**|numérico||Id del cliente|



## ✅ **Response** 

**JSON { "error": 0, "message": "", "data": [ { "cliente_id": 208, "nombreCliente": "Neyra Patricia", "nombreReparto": "1234", "nombrePromotor": "Admin", "actividad_ids": 31, "tipoCliente_ids": 1, "estadoCliente_ids": 1, "promotor_id": 1, "reparto_id": 2, "dniCliente": null, "nombreProvincia": "Buenos Aires", "nombreCiudad": "Ranchos", "nombreBarrio": "Ranchos", "domicilioCompleto": "Ranchos, Chaco  3088.", "provincia_ids": 2, "ciudad_id": 11, "barrio_id": 479, "calle_id": 43, "torre": "", "piso": "", "depto": "", "manzana": "", "lote": "", "numeroPuerta": "3088", "nombreCalle": "Chaco ","actividadCliente": "No aplica", "tipoCliente": "Familia", "estadoCliente": "Activo", "datosCompletos": true, "clientePadre": null, "fechaNacimiento": "/Date(1577847600000)/", "fechaIngreso": "/Date(1577847600000)/", "codigoPostal": "1987", "altitud": "", "longitud": "", "fechaUtlimaEntrega": null, "fechaUltimoCobroFactura": null, "fechaUltimaEnvases": null, "fechaUltimaDevoluciones": null, "validarOrdenesDeCompra": false, "validaCredito": false, "creditoPermitido": 100000.00, "limiteFacturas": 30, "facturacionAutomatica": true, "datosFacturacion_id": 208, "condicionIva_ids": 2, "tipoFactura_ids": 2, "cuit": "1111111111", "dniPersona": "", "ingresosBrutos": "1111111111", "domicioFiscal": "Chaco 3088", "razonSocial": "Neyra Patricia", "centroDistribucion_id": 1, "centroDeDistribucion": "CD Testing", "orden": 0, "cicloVisitas": 0, "etiquetas": [], "situacionConsumo": 1, "situacionSaldos": 1 } ] }** 

26 

## 📥 10. Obtener matriz de lista de precios 

## **Endpoint:** GET (url) + / **ListaDePrecios/ObtenerMatrizListaDePrecios** 

**Descripción:** Este endpoint permite obtener la matriz de precios actual de productos, que se obtiene mediante un tipoLista_id 

## **Parámetros** 

**==> picture [215 x 58] intentionally omitted <==**

**----- Start of picture text -----**<br>
GET PARAMS<br>{<br>    "tipoLista_id ":  2<br>}<br>**----- End of picture text -----**<br>


## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|
|---|---|---|---|
|**tipoLista_id**|numérico||Id de la lista de precios|



## ✅ **Response** 

**JSON { "error": 0, "matriz": { "articulos": [ { "articulo_id": 1, "nombreArticulo": "Bidon x 20 lts", "codigoInterno": "1", "tipoArticulo_ids": 1, "tipo": "Producto comercilizable", "rubro_ids": 2, "rubro": "Agua en Bidon", "precios": [ { "lista_id": 5, "tipoLista_ids": 2, "articulo_id": 1, "precio": 800.00 } ] }, { "articulo_id": 2, "nombreArticulo": "Bidon x 12 lts", "codigoInterno": "2", "tipoArticulo_ids": 1, "tipo": "Producto comercilizable", "rubro_ids": 2, "rubro": "Agua en Bidon", "precios": [{ "lista_id": 5, "tipoLista_ids": 2, "articulo_id": 2, "precio": 500.00 } ] } ], "listas": [ { "lista_id": 5, "nombre": "Distribuidores", "tipo_ids": 2, "tipo": "Lista" } ] } }** 

28 

## 💲11. Obtener abonos tipos 

**Endpoint:** GET (url) + /AbonosTipos/ObtenerAbonosTipos 

**Descripción:** Obtiene una lista de los abonos disponibles en el sistema para agregar a un cliente 

## **Parámetros** 

**GET PARAMS { "desde": null, "hasta": null, "concepto": null, "activo": true }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**desde**|Alfanumérico|15|(Opcional) Fecha en formato dd/MM/yyyy|
|**hasta**|Alfanumérico|15|(Opcional) Fecha en formato dd/MM/yyyy|
|**concepto**|Alfanumérico|100|Filtro opcional|
|**activo**|booleano||Obligatorio. Filtrapor abonos activos o no.|



## ✅ **Response** 

**JSON { "error": 0, "abonosTipos": [ { "id": 1007, "articuloAbonoConcepto_id": 4, "articuloAbonoConcepto": "Concepto de Abono Tipo", "nombreAbono": "abono 4 x 20", "leyendaFacturacion": "abono ,emsual de 4 bidones de 20litros", "precio": 30000.00, "tipoAbonoTipo_ids": 1, "tipoAbonoTipo": "Abono Aguas", "fechaAlta": "/Date(1735909324993)/", "usuarioAlta_id": 1, "nombreApellidoAlta": "Admin", "activo": true, "fechaBaja": null, "usuarioBaja_id": null, "nombreApellidoBaja": null } ] }** 

29 

## 📍 12. Clientes cercanos por dirección 

**Endpoint:** GET /Repartos/BusquedaClientesCercanosResultJson **Descripción:** Lista clientes dentro de un radio determinado a partir de dirección. 

## **Parámetros** 

**GET PARAMS { "address": "Argentina, Córdoba, Córdoba capital, Centro, Av. Maipu 150" "metros ": 1000 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|
|---|---|---|---|
|**address**|Alfanumérico|50|Cadena que contiene la dirección.|
|**metros**|numérico||Metros de distancia desde la dirección para<br>buscar los clientes|



## ✅ **Response** 

**JSON { "data": [ { "cliente_id": 802, "nombreCliente": "Granja  Velicceli (Cristina Alibue)", "nombreReparto": "1234", "zona": "Sin especificar", "latitud": -31.4148491, "longitud": -64.1792179, "domicilioCompleto": "Córdoba, MENDOZA 237.", "distanciaMetros": 270.60, "listaDePrecios_id": 1, "visitas": [ { "cliente_id": 802, "dia_ids": 2, "orden": 3.00, "nombreCliente": "Granja  Velicceli (Cristina Alibue)", "domicilioCompleto": "Córdoba, MENDOZA 237.", "reparto_id": 2, "nombreReparto": "1234", "tipoCliente": "Familia", "estadoCliente": "Activo", "dia": "Martes", "altitud": "-31.4148491", "longitud": "-64.1792179", "semana": 1, "semanaMensual": 0,"color": null, "haCambiado": 0, "ultimasVisitas": { "cliente_id": 802, "diaSemana": "Martes", "diaId": 2, "horarioMin": "15:45", "horarioMax": "15:45", "horarioProm": "15:45", "cantidadVisitas": 1, "ultimaVisita": "/Date(1750790700000)/", "horarioMaxSeg": 56700, "horarioMinSeg": 56700, "horarioPromSeg": 56700, "ultimaVisitaString": "24/06/2025 15:45" } } ], "proximaVisita": "/Date(1755561600000)/", "diasProximaVisita": 8 } ], "error": 0, "message": "", "coordenadas": { "Latitud": -31.4126304, "Longitud": -64.1780465 } }** 

31 

## 📄 13. Historial de facturas del cliente por fecha 

**Endpoint:** POST /Facturacion/ObtenerHistorialDeFacturas **Descripción:** Se obtiene una lista de clientes de las facturas de un cliente en un rango de fecha. 

## **Parámetros** 

**POST BODY { "cliente_id":8, "fechaDesde":"05/12/2022", "fechaHasta":"26/09/2025", "saldoPendiente": false }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**cliente_id**|numérico||Id del cliente que se desea buscar|
|**fechaDesde**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|**fechaHasta**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|**saldoPendiente**|booleano||Determina si se desean obtener solo<br>aquellas facturas con saldo<br>pendiente depago|



## ✅ **Response** 

**JSON { "error": 0, "facturas": [ { "id": 10039, "nroFactura": "003-00000064", "fechaFactura": "/Date(1744047204477)/", "tipoFactura": "Factura A", "montoFacturaTotal": 300050.00, "montoTotalNeto": 247975.2100000, "montoFacturaIVA": 52074.79, "montoExcento": 0.00, "montoGravado": 300050.00, "fechaVencimiento1": "/Date(1741195625157)/", "fechaVencimiento2": "/Date(1742491625157)/", "fechaVencimiento3": "/Date(1743787625157)/", "cobrado": 0, "cliente_id": 8, "estadoFactura": "No Vencida", "interesVencimiento2": 1.05, "interesVencimiento3": 1.10, "estadoFactura_ids": 1,"leyenda1": null, "leyenda2": "Remitos asociados a las ventas facturadas: ", "leyenda3": null, "leyenda4": null, "codigoAfip": "x", "eliminada": false, "pathFactura": null, "facturaElectronica_id": 35, "resultado": 0, "mensaje": null, "cae": "75146229004566", "numeroComprobante": 64, "fechaVencimientoCae": "/Date(1744858800000)/", "fechaVencimientoComprobante": "/Date(1744858800000)/", "observaciones": "", "facturarAfip": true, "puntoDeVenta": 3, "tipoComprobanteAfip": 11, "pathFacturaDuplicado": null, "entregadaPapel": false, "entregadaEmail": false, "fechaEntregadaPapel": null, "fechaEntregadaEmail": null, "impresa": false, "procesoFacturacion_id": 11105, "notaDeDebitoAjusteId": null, "centroFacturacion_id": 1, "montoImputado": 300050.00, "saldoPendienteDeImputar": 0.00, "ItemsFactura": null } ], "ajustes": [] }** 

33 

## 📄 14. Recibos de pago de un cliente 

**Endpoint:** POST /Recibos/ObtenerRecibosDeCobros **Descripción:** Se obtiene una lista de recibos de un cliente en un rango de fecha. 

## **Parámetros** 

**POST BODY { "clienteId":8, "fechaReciboDesde":"07/04/2025", "fechaReciboHasta":"26/09/2025", "saldoDisponible": false }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**clienteId**|numérico||Id del clienteque se desea buscar|
|**fechaReciboDesde**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|**fechaReciboHasta  **|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|**saldoDisponible**|booleano||Determina si se desea obtener solo<br>aquellos recibos con saldo pendiente de<br>imputarafacturas|



## ✅ **Response** 

**JSON { "recibos": [ { "id": 10112, "cliente_id": 8, "clienteEntrega_id": 8, "usuarioRecibe_id": 1, "fechaRecibo": "/Date(1751571804133)/", "fechaAlta": "/Date(1751571804133)/", "nroReciboDigital": "00000027", "nroReciboFisico": null, "esRecibo": false, "pathPdf": null, "hojaDeRuta_id": null, "fechaEnvioMail": null, "fechaEntregadaConfirmadaEmail": null, "centroDeFacturacion_id": 1, "esCreditoDisponible": true, "esAfip": true, "liquidado": true, "clienteRecibo": "Correo Argentino","clienteEntrega": "Correo Argentino", "centroDeFacturacion": "Principal", "usuarioRecibe": "Admin", "fechaRuta": null, "reparto": null, "montoTotalUtilizado": 12312.00, "montoTotalRecibo": 12312.00, "montoDisponible": 0.00, "permisoEditar": true, "permisoImputar": true, "permisoEditarNumero": true, "items": null, "imputaciones": null } ], "error": 0 }** 

35 

## 15. Resumen de cuenta cliente 📄 

## **Endpoint:** POST /Movimientos/BuscarMovimientos 

**Descripción:** Se obtiene una lista de movimientos de un cliente en un rango de fecha. Generando 3 listas los consumos sin facturar, las facturas y los movimientos agrupados por periodo. 

## **Parámetros** 

**POST BODY { "clienteId":8, "desde":"07/04/2025", "hasta":"26/09/2025" }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**clienteId**|numérico||Id del clienteque se desea buscar|
|**desde**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|**hasta**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|



## ✅ **Response** 

**JSON { "dashboard": { "movimientosConsumos": [ { "fecha": "/Date(1751338799000)/", "descripcion": "Venta", "nroComprobante": "Rm-e-00016", "montoDebe": 1780.0000, "montoHaber": 0, "saldo": 0, "entidadId": 10736, "tipoDeEntidad": 5 }, { "fecha": "/Date(1750362180000)/", "descripcion": "Venta", "nroComprobante": "Rm-e-00014", "montoDebe": 0.0000, "montoHaber": 0, "saldo": 0, "entidadId": 10730, "tipoDeEntidad": 5 } ],"movimientosFacturacion": [ { "fecha": "/Date(1751571804133)/", "descripcion": "Recibo", "nroComprobante": "Rc-e-00000027", "montoDebe": 0, "montoHaber": 12312.00, "saldo": 0, "entidadId": 10112, "tipoDeEntidad": 3 }, { "fecha": "/Date(1751571770237)/", "descripcion": "Factura", "nroComprobante": "F-0000", "montoDebe": 12312.00, "montoHaber": 0, "saldo": 0, "entidadId": 10065, "tipoDeEntidad": 2 } ], "movimientosPeriodo": [ { "periodo": "202504", "articulo_id": 1, "nombreArticulo": "Bidon x 20 lts", "precioUnitario": 3000.00, "cantidad": 1.00, "subtotal": 3000.0000, "clienteFacturable_id": 8 }, { "periodo": "202505", "articulo_id": 1, "nombreArticulo": "Bidon x 20 lts", "precioUnitario": 3000.00, "cantidad": 2.00, "subtotal": 6000.0000, "clienteFacturable_id": 8 } ] }, "error": 0 }** 

37 

## 📄 16. Orden de trabajo servicio técnico 

**Endpoint:** GET /UsuariosClientes/ObtenerServiciosTecnicos 

**Descripción:** Se obtiene los servicios de un cliente en un rango de fechas. 

## **Parámetros** 

**GET PARAMS { "clienteId":8, "desde":"07/02/2025", "hasta":"26/09/2025" }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**clienteId**|numérico||Id del cliente que se desea buscar|
|**desde**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|**hasta**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|✅**Response**||||



**JSON { "serviciosTecnicos": { "items": [ { "id": 10022, "clienteUbicacion": "Correo Argentino", "clienteIdUbicacion": 8, "fechaPlanificada": "/Date(1743130800000)/", "fechaReal": "/Date(1743706682687)/", "creado": "/Date(1743706529567)/", "estadoIds": 4, "estado": "Cerrado", "nroComprobante": "(D) 10022", "repartoId": 2, "reparto": "1234", "archivoComprobante": "comprobante_st_8_10022.pdf", "sintoma": "Sanitización" }, { "id": 10019, "clienteUbicacion": "Correo Argentino", "clienteIdUbicacion": 8, "fechaPlanificada": "/Date(1743044400000)/", "fechaReal": null, "creado": "/Date(1743704804467)/", "estadoIds": 3,"estado": "Cancelado", "nroComprobante": "(D) 10019", "repartoId": 2, "reparto": "1234", "archivoComprobante": null, "sintoma": "Sanitización" } ] }, "error": 0 }** 

39 

## 📄 17. Remitos de entrega 

**Endpoint:** POST /Movimientos/ObtenerVentasPorCliente 

**Descripción:** Se obtiene los consumos de un cliente en un rango de fechas con o sin facturas. 

**Parámetros** 

**POST BODY { "cliente_id":8, "fechaDesde":"07/04/2025", "fechaHasta":"26/09/2025", "consumosSinFacturar": false }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**cliente_id**|numérico||Id del cliente que se desea buscar|
|**fechaDesde**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|**fechaHasta**|Alfanumérico|15|Fecha en formato dd/MM/yyyy|
|**consumosSinFacturar**|Booleano||Determina si se desea obtener sólo<br>los consumos aún no facturados|



## ✅ **Response** 

**JSON { "ventas": [ { "id": 11013, "fechaVenta": "/Date(1755800760000)/", "montoTotalVenta": 0, "hojaRuta_id": 20179, "clienteEntrega_id": 8, "factura_id": null, "remito_id": 10606, "nroRemito": "00055", "nroRemitoFisico": null, "clienteEntrega": "Correo Argentino", "archivoRemitoPdf": "8_20179.pdf", "fueEditada": false, "visita_id": 20212, "nombreRepartoEntrega": "1234", "Articulos": [ { "id": 11038, "articulo_id": 1, "precioUnitario": 0, "cantidad": 3,"codigoInterno": "1", "nombreArticulo": "Bidon x 20 lts", "esImputacionAbono": false, "factura_id": null, "leyenda": null, "facturaDeItem_id": null, "porcentajeDescuentoManual": 0, "porcentajeDescuentoPorCantidad": 0, "porcentajeDescuentoVenta": 0, "precioUnitarioOriginal": 0, "tipoItem_id": 2 } ] }, { "id": 11008, "fechaVenta": "/Date(1755800707967)/", "montoTotalVenta": 0, "hojaRuta_id": null, "clienteEntrega_id": 8, "factura_id": null, "remito_id": 10600, "nroRemito": "00053", "nroRemitoFisico": null, "clienteEntrega": "Correo Argentino", "archivoRemitoPdf": "8_st_10600.pdf", "fueEditada": false, "visita_id": 11047, "nombreRepartoEntrega": null, "Articulos": [ { "id": 11032, "articulo_id": 1014, "precioUnitario": 0, "cantidad": 1, "codigoInterno": "04", "nombreArticulo": "Sanitizacion de Dispenser", "esImputacionAbono": false, "factura_id": null, "leyenda": "Sanitizacion de Dispenser", "facturaDeItem_id": null, "porcentajeDescuentoManual": 0, "porcentajeDescuentoPorCantidad": 0, "porcentajeDescuentoVenta": 0, "precioUnitarioOriginal": 0, "tipoItem_id": 10 } ] } ], "error": 0 }** 

41 

## 📄 18. Descarga de remitos de entrega 

**Endpoint:** GET /VentasEntregas/ObtenerRemitoPorVenta 

**Descripción:** Se descarga el PDF del remito. 

**Parámetros** 

**GET PARAMS { "idVenta":8 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**idVenta**|numérico||Id de la ventaque se desea descargar|
|✅**Response**||||
|**OCTET-STREAM**||||
|**Este endpoint devuelve los bytes del archivo PDF para el remito buscado**||||



42 

## 📄 19. Descarga de archivos 

**Endpoint:** GET /Publicaciones/ObtenerPublicaciones 

**Descripción:** obtiene una lista de publicaciones, con el nombre del archivo. Para construir el path de descarga, se concatena el nombre del archivo después de “/Archivos/Publicaciones/”. 

## **Parámetros** 

**GET PARAMS { "cliente_id”: null }** 

## **Definición de datos** 

**PARÁMETRO TIPO DATO  LONGITUD DESCRIPCIÓN** Si se envía, solo devolverá el listado de publicaciones para ese cliente. **cliente_id** numérico Si no se envía, traerá el listado completo de publicaciones. 

## ✅ **Response** 

**JSON { "error": 0, "publicaciones": [ { "id": 1, "cliente_id": null, "titulo": "Titulo publicación", "descripcion": null, "usuario_id": 1, "fechaAlta": "/Date(1756477342130)/", "eliminado": false, "tipoPublicacion_ids": 2, "tipoPublicacion": "Documentación comercial", "usuario": "Admin", "archivos": [ { "id": 1, "publicacion_id": 1, "nombreArchivo": "archivo_publicado.pdf", "tituloArchivo": "Titulo publicación" } ] } ] }** 

43 

## 💲20. Obtener link mercado pago 

**Endpoint:** POST (url) + /Sync/ObtenerLinkMP 

**Descripción:** Obtiene un link de mercado pago, con la intención de pago para un cliente, para ello se necesita el cliente id y el monto a cobrar. 

## **Parámetros** 

**POST BODY { "cliente_id": 8, "monto": 1000 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**cliente_id**|entero||El id o identificador únicopara un cliente|
|**monto**|decimal||Monto en formato decimal, con 2<br>decimales separados por un punto (.)|



## ✅ **Response** 

**JSON { "error": 0, "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1740847852-9a77f20b3906-4743-9ae0-c83498773fae" }** 

44 

## 21. Obtener saldos de cliente 💲 

**Endpoint:** GET (url) + /api/Movimientos/ObtenerSaldosDeCliente/ 

**Descripción:** obtiene información financiera y logística detallada de un cliente específico. 

## **Parámetros** 

**==> picture [215 x 58] intentionally omitted <==**

**----- Start of picture text -----**<br>
GET PARAMS<br>{<br>  "clienteId": 8,<br>}<br>**----- End of picture text -----**<br>


## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**clienteId**|entero||El id o identificador únicopara un cliente|



**==> picture [63 x 14] intentionally omitted <==**

**----- Start of picture text -----**<br>
✅  Response<br>**----- End of picture text -----**<br>


**==> picture [336 x 206] intentionally omitted <==**

**----- Start of picture text -----**<br>
JSON<br>{<br>    "saldos": {<br>        "cliente_id": 3131,<br>        "nombreCliente": "(de 09 a 13)EXPERTA ART SA",<br>        "nombreReparto": "Reparto 3 ( Rosario)",<br>        "diasVisita": "S4 Jueves, ",<br>        "fechaUltimoCobro": "12/09/2025",<br>        "fechaUltimaEntrega": "11/09/2025",<br>        "saldoCuentaConsumo": 33440.000,<br>        "saldoCuentaFacturacion": 0.00,<br>        "listaDePrecios": "Lista Base CD1 Tipo Listas Bases"<br>    },<br>    "error": 0<br>}<br>**----- End of picture text -----**<br>


45 

## 22. Reenvío de Factura 📤 

**Endpoint:** POST (url) + /Facturacion/EnviarFacturaPorMail **Descripción:** Reenvía por correo electrónico una factura específica a la dirección asociada al cliente. 

## **Parámetros** 

**POST BODY { "facturaId": 121471 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**facturaId**|entero||El id o identificador único para una factura|



## ✅ **Response** 

**JSON { "error": 0 }** 

## 23. Reenvío de Remito 📤 

**Endpoint:** POST (url) + /Facturacion/EnviarRemitoPorMail **Descripción:** Reenvía por correo un remito especificado. 

## **Parámetros** 

**POST BODY { "remitoId": 227194 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**remitoId**|entero||El id o identificador únicopara un remito|



## ✅ **Response** 

**JSON { "error": 0 }** 

46 

## 24. Reenvío de Recibo 📤 

**Endpoint:** POST (url) + /Recibos/EnviarPorMail **Descripción:** Envía nuevamente un recibo a la dirección registrada del cliente. 

## **Parámetros** 

**POST BODY { "reciboId": 171406 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**reciboId**|entero||El id o identificador únicopara un recibo|



## ✅ **Response** 

**JSON { "error": 0 }** 

47 

## 🔐 25. Obtener Usuario y Contraseña de un Cliente 

**Endpoint:** POST (url) + /UsuariosClientes/ObtenerUsuarioPorCliente **Descripción:** Recupera el nombre de usuario y contraseña (en caso de restablecimiento o envío inicial) de un cliente. 

## **Parámetros** 

**==> picture [215 x 62] intentionally omitted <==**

**----- Start of picture text -----**<br>
POST BODY<br>{<br>  "cliente_id": 14854<br>}<br>**----- End of picture text -----**<br>


## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN **|
|---|---|---|---|
|**cliente_id**|entero||El identificador único para un cliente|



**==> picture [63 x 14] intentionally omitted <==**

**----- Start of picture text -----**<br>
✅  Response<br>**----- End of picture text -----**<br>


**==> picture [336 x 163] intentionally omitted <==**

**----- Start of picture text -----**<br>
DESCRIPCIÓN<br>{<br>    "error": 0,<br>    "usuario": {<br>        "id": 14854,<br>        "nombreApellido": "Nombre del cliente",<br>        "userName": "14716",<br>        "password": "*Contraseña*",<br>        "centroDistribucion_id": 4<br>    }<br>}<br>**----- End of picture text -----**<br>


48 

## 26. Obtener Incidentes de un Cliente 📄 

**Endpoint:** POST (url) + /Incidentes/ObtenerIncidentesCliente 

**Descripción:** Recupera el nombre de usuario y contraseña (en caso de restablecimiento o envío inicial) de un cliente. 

## **Parámetros** 

**POST BODY** 

**{** 

**"cliente": 8, "fechaDesde": "19/07/2025",** 

- **"fechaHasta": "19/02/2026",** 

**"ordenarDescendente": true,** 

**“tipoIncidente”: 1** 

**}** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**cliente**|entero||El identificador único para un cliente|
|**fechaDesde**|Alfanumérico|**10**|Fecha en formato dd/MM/yyyy|
|**fechaHasta**|Alfanumérico|**10**|Fecha en formato dd/MM/yyyy|
|**ordenarDescendente**|booleano||Determina si el resultado debe ser<br>ordenada en forma descendente|
|**tipoIncidente**|entero||Filtra por tipo de incidente<br>(Opcional)|



## ✅ **Response** 

**DESCRIPCIÓN { "error": 0, "incidentes": [ { "id": 10194, "fechaHoraRegistro": "\/Date(1753300170313)\/", "usuarioRegistraId": 1, "cliente_id": 8, "repartoCliente": "1234", "titulo": "Prueba Error Incidencia", "descripcion": "\u003cp\u003ePrueba Error Incidencia\u003c/p\u003e", "tipoIncidente_ids": 1, "severidad_ids": 1, "pedido_id": 48, "usuarioResponsable_id": 0, "fechaCierreEstimado": "\/Date(1753758000000)\/", "fechaCierreReal": "\/Date(1755092377157)\/", "estadoIncidente_ids": 5,"usuarioRegistra": "Admin", "usuarioResponsable": null, "repartoRealAtencion": null, "fechaRealAtencion": null, "fechaPlanificadaAtencion": "\/Date(1753758000000)\/", "repartoPlanifiicado": "1234", "cliente": "Correo Argentino", "tipoIncidente": "Gestiones en Hoja de Ruta", "estadoIncidente": "Cerrado", "servicioTecnico_id": null, "subTipoIncidente_ids": 1, "subtipoIncidente": "Solicitud de artículos", "esParaAprobacion": false, "solTomaCoordenadas_id": null, "incidenteRelacionado": null, "domicilioResumen": "MATHEU 1167. ", "fechaUltimaEnvases": "\/Date(1767236400000)\/", "fechaUltimaDevoluciones": null, "fechaUltimoCobroFactura": "\/Date(1764126000000)\/", "fechaUtlimaEntrega": "\/Date(1768510088880)\/", "grupoResponsable": "Verificar abonos", "grupoResponsable_ids": 1, "fechaCierreEstimadoReplanificada": null, "centroDistribucion_id": 1, "centroDeDistribucion": "CD Testing", "usuariosSeguimiento": [ { "id": 0, "usuario_id": 1, "incidente_id": 10194, "nombreApellido": "Admin" } "usuarioCierre": "Usuario Testing 1234", "repartoCierre": "1234", "esResponsable": true,** 

**} ] }** 

50 

## 27. Obtener Clientes con contactos modificados 📄 

**Endpoint:** GET (url) + /Clientes/BuscarClienteConContactoModificado **Descripción:** Obtiene un listado de clientes que hayan sufrido modificaciones en sus datos de contactos desde determinada fecha. La respuesta incluirá un valor booleano denominado 

“ **HasMore** ” que indicará si existen más registros, para lo cual deberá avanzar el número de página, manteniendo la misma cantidadXPagina. **Solo se obtendrán los clientes principales, no las sucursales.** 

## **Parámetros** 

## **GET PARAMS** 

**{ “desde”: “26/01/2026”, “tipoClienteId”: [1,2], “condicionIvaId”: [1,2], “estadoClienteId”: [1], “pagina”: 1, “cantidadXPagina”: 100 }** 

**“desde”: “26/01/2026”, “tipoClienteId”: [1,2], “condicionIvaId”: [1,2],** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**desde**|Alfanumérico|**10**|Fecha en formato dd/MM/yyyy|
|**tipoClienteId**|entero[]||(opcional) lista de tipos de cliente<br>para obtener un resultado ya<br>filtrado (1=Familia, 2=Empresa)|
|**condicionIvaId**|entero[]||(opcional) lista de condiciones de iva<br>del cliente para obtener un<br>resultado ya filtrado<br>1= Responsable Inscripto<br>2=Consumidor Final<br>3=Monotributista<br>4=Sujeto Exento<br>5=Iva No Alcanzado|
|**estadoClienteId**|entero[]||(opcional) lista de estados del<br>cliente para obtener un resultado ya<br>filtrado<br>1= Activo<br>2=Pausado<br>4=Baja<br>5=Borrador<br>6=En Gestión de Baja|
|**pagina**|entero||(Opcional) número de paginado que<br>desea obtener. Si no se envía se<br>interpretará como 1|
|**cantidadXPagina**|entero||(opcional) cantidad de registros que<br>devuelve por página. Si no se envía,<br>se interpretará como 100|



51 

## ✅ **Response** 

**DESCRIPCIÓN { "error": 0, "clientes": [ { "cliente_id": 1426, "nombreCliente": "DRALLNY,FELIPE OSCAR", "razonSocial": "DRALLNY,FELIPE OSCAR", "cuit": "20064915356", "dniPersona": "0", "tipoCliente": "Empresa", "tipoCliente_ids": 2, "condicionIva_ids": 2, "condicionIva": "ConsumidorFinal", "FechaUltimaModificacionDatosContacto": "22/01/2026", "estadoCliente": "Activo", "estadoCliente_ids": 1, "nombreCobrador": "NOMBRE DEL COBRADOR", "cobrador_id": 2861, "nombrePromotor": "NOMBRE DEL PROMOTOR", "promotor_id": 12391, “passwod”:”xxxxxxx”, "contactos": [ { "nombre": " ", "email": "", "celular": "351-5408368", "fijo": "" }, { "nombre": " ", "email": "", "celular": "0-0" "fijo": "", }, { "nombre": "DRALLNY,FELIPE OSCAR", "email": "", "celular": "0-0" "fijo": "" } ] }, { "cliente_id": 7181,"nombreCliente": "MOISES FLORENCIA ", "razonSocial": "MOISES FLORENCIA ", "cuit": "", "dniPersona": "27355727667", "tipoCliente": "Empresa", "tipoCliente_ids": 2, "condicionIva_ids": 1, "condicionIva": "ResponsableInscripto", "FechaUltimaModificacionDatosContacto": "23/01/2026", "estadoCliente": "Activo", "estadoCliente_ids": 1, "nombreCobrador": "NOMBRE DEL COBRADOR", "cobrador_id": 2861, "nombrePromotor": "NOMBRE DEL PROMOTOR", "promotor_id": 12391, “passwod”:”xxxxxxx”, "contactos": [ { "nombre": "FLORENCIA", "email": "", "celular": "351-2323135", "fijo": "" }, { "nombre": "TESTING", "email": "", "celular": "351-5408368", "fijo": "" } ] } ], "HasMore": false, "desde": "22/01/2026", "pagina": 1, "cantidadXPagina": 100 }** 

53 

## 28. Obtener Facturas con saldos modificados 💲 

**Endpoint:** GET (url) + /Facturacion/ObtenerFacturasConSaldoModificado **Descripción:** Obtiene un listado de facturas que hayan sufrido modificaciones en el saldo pendiente desde determinada fecha. La respuesta incluirá un valor booleano denominado “ **HasMore** ” que indicará si existen más registros, para lo cual deberá avanzar el número de página, manteniendo la misma cantidadXPagina. 

## **Parámetros** 

**GET PARAMS { “desde”: “20/01/2026”, “tipoClienteId”: [1,2], “condicionIvaId”: [2,3], “pagina”: 1, “cantidadXPagina”: 500 }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**desde**|Alfanumérico|**10**|Fecha en formato dd/MM/yyyy|
|**tipoClienteId**|entero[]||(opcional) lista de tipos de cliente<br>para obtener un resultado ya<br>filtrado (1=Familia, 2=Empresa)|
|**condicionIvaId**|entero[]||(opcional) lista de condiciones de iva<br>del cliente para obtener un<br>resultado ya filtrado<br>1= Responsable Inscripto<br>2=Consumidor Final<br>3=Monotributista<br>4=Sujeto Exento<br>5=Iva No Alcanzado|
|**pagina**|entero||(Opcional) número de paginado que<br>desea obtener. Si no se envía se<br>interpretará como 1|
|**cantidadXPagina**|entero||(opcional) cantidad de registros que<br>devuelve por página. Si no se envía,<br>se interpretará como 500|



## ✅ **Response** 

**DESCRIPCIÓN { "error": 0, "Facturas": [ { "cliente_id": 1706, "factura_id": 125176,"numeroComprobante": 18264, "montoFacturaTotal": 33899.84, "saldoPendiente": 0, "tipoCliente": "Empresa", "tipoCliente_ids": 2, "condicionIva_ids": 1, "condicionIva": "ResponsableInscripto", "moneda": "ARS", "fechaFactura": "01/01/2026", "fechaVencimiento": "11/01/2026", "UltimaModificacionSaldoPendiente": "20/01/2026", “passwod”:”xxxxxxx” }, { "cliente_id": 10858, "factura_id": 114784, "numeroComprobante": 13063, "montoFacturaTotal": 32000, "saldoPendiente": 0, "tipoCliente": "Empresa", "tipoCliente_ids": 2, "condicionIva_ids": 1, "condicionIva": "ResponsableInscripto", "moneda": "ARS", "fechaFactura": "26/12/2025", "fechaVencimiento": "05/01/2026", "UltimaModificacionSaldoPendiente": "20/01/2026", “passwod”:”xxxxxxx” } ], "HasMore": false, "desde": "20/01/2026", "pagina": 1, "cantidadXPagina": 500 }** 

55 

## 29. Obtener Clientes Masivamente 📄 

**Endpoint:** POST (url) + /Reportes/ObtenerClientesDashboard 

**Descripción:** Obtiene información estadística de clientes, junto con un listado de clientes con información reducida. 

## **Parámetros** 

**POST BODY { "filtros": { … } }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**filtro**|Objeto||Un objeto que contiene un conjunto<br>de filtros. Consultar el apéndice<br>para conocer la Definición de estos<br>parámetros|



## ✅ **Response** 

**DESCRIPCIÓN { "datos": { "items": [], "itemsLight": [ { "cliente_id": 1111, "nombreCliente": "NOMBRE CLIENTE", "tipoCliente": "Empresa", "actividad": "ACTIVIDAD DEL CLIENTE", "estadoCliente": "Activo", "nombreReparto": "NOMBRE REPARTO", "nombrePromotor": "NOMPRE PROMOTOR", "nombreCiudad": "Córdoba", "domicilioCompleto": "DOMICILIO CLIENTE", "condicionIva": "Sujeto Exento", "zona": "Norte", "fechaBaja": null, "fechaIngreso": "\/Date(1548730800000)\/", "fechaUtlimaEntrega": "\/Date(1770224760000)\/", "clientePadre": null, "cantidadAbonos": 74, "cantidadDispensers": 48, "cantidadDispensersSucursales": 0, "consumosSinFacturar": 2418884.22, "saldoFacturas": 4615439.56,"creditoAFavor": 0.00, "saldoFinal": 7034323.78, "listaDePrecios": "Empresas", "centroDeFacturacion": "RAZON SOCIAL CENTRO DE FACTURACION", "facturacionAutomatica": true, "centroDeDistribucion": "Principal" }, … ],"cantidadPorTiposDeClientes": [ {"descripcion": "Familia","id": null,"valor": 3,"valores": null}, {"descripcion": "Empresa","id": null,"valor": 68,"valores": null} ], "cantidadPorActividadesDeClientes": [ {"descripcion": "Educación","id": null,"valor": 1,"valores": null}, {"descripcion": "Industria","id": null,"valor": 15,"valores": null}, {"descripcion": "Construccion","id": null,"valor": 9,"valores": null}, … ], "cantidadPorCondicionesDeIva": [ {"descripcion": "Sujeto Exento","id": null,"valor": 3,"valores": null}, {"descripcion": "Responsable Inscripto","id": null,"valor": 64,"valores": null}, {"descripcion": "Consumidor Final","id": null,"valor": 4,"valores": null} ], "cantidadPorEstados": [ {"descripcion": "Activo","id": null,"valor": 95,"valores": null}, … ], "cantidadPorCentrosDeDistribucion": [ {"descripcion": "Principal","id": null,"valor": 71,"valores": null}, … ], "cantidadPorCentrosDeFacturacion": [ {"descripcion": "Nombre Centro de Distribucion","id": null,"valor": 71,"valores": null}, … ], "cantidadPorListasDePrecios": [ {"descripcion": "Nombre Lista de precio","id": null,"valor": 39,"valores": null}, … ], "cantidadPorRepartos": [ {"descripcion": "Nombre Reparto","id": null,"valor": 95,"valores": null}, … ], "cantidadPorZonas": [ {"descripcion": "Norte","id": null,"valor": 69,"valores": null}, … ],"cantidadPorDiaDeSemana": [** 

**{"descripcion": "Lunes","id": null,"valor": 15,"valores": null},** 

**… ], "cantidadPorCiudad": [ {"descripcion": "Córdoba","id": null,"valor": 66,"valores": null}, {"descripcion": "Malagueño","id": null,"valor": 26,"valores": null}, … ], "clientesConDispensers": [ {"descripcion": "Con dispensers","id": null,"valor": 53,"valores": null}, {"descripcion": "Sin dispensers","id": null,"valor": 42,"valores": null} ], "clientesConAbonos": [ {"descripcion": "Con abonos","id": null,"valor": 53,"valores": null}, {"descripcion": "Sin abonos","id": null,"valor": 18,"valores": null} ], "saldosPorRepartosPorTiposDeClientes": [ {"descripcion": "Reparto 01","id": null,"valor": 96628995.30,"valores": [ 23467.69, 96605527.61 ]} ], "cantidadPorPromotores": [ {"descripcion": "Nombre Promotor","id": null,"valor": 1,"valores": null}, "altasYBajasPorRepartos": null, "cantidadPorAumentosMasivos": [ {"descripcion": "No","id": null,"valor": 55,"valores": null}, {"descripcion": "Si","id": null,"valor": 16,"valores": null} ], "cantidadPorFacturacionAutomatica": [ {"descripcion": "Si","id": null,"valor": 63,"valores": null}, {"descripcion": "No","id": null,"valor": 8,"valores": null} ], "cantidadPorDatosCompletos": [ {"descripcion": "Incompletos","id": null,"valor": 87,"valores": null}, {"descripcion": "Completos","id": null,"valor": 8,"valores": null} ] }, “error”: 0 }** 

58 

## 30. Obtener Contactos Masivamente 📄 

**Endpoint:** POST (url) + /Reportes/ObtenerContactosClientes 

**Descripción:** Obtiene información estadística de clientes, junto con un listado de clientes con información reducida. 

## **Parámetros** 

**POST BODY { "filtros": { … } }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO**<br>**LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**filtro**|Objeto||Un objeto que contiene un conjunto<br>de filtros. Consultar el apéndice<br>para conocer la Definición de estos<br>parámetros|



## ✅ **Response** 

**DESCRIPCIÓN { "datos": [ { "id": 0, "cliente_id": 1111, "nombreCliente": "NOMBRE DEL CLIENTE", "reparto_id": 1, "nombreReparto": "NOMBRE DEL REPARTO", "tipoContacto": "Primer contacto", "nombrePersona": "NOMBRE DEL CONTACTO", "sectorEmpresa": "", "tipoContacto_ids": 1, "repartoId": 0, "telefono": "", "contactoPrincipal": false, "email": "EMAIL DEL CONTACTO", "celular": "351-12345678", "caracteristicaCelular": "351", "sector_ids": 1, "sectorContacto": "Gerente", "observaciones": ""}, … ], "error": 0 }** 

60 

## 31. Obtener Abonos Masivamente 📄 

**Endpoint:** POST (url) + /Reportes/ObtenerContactosClientes 

**Descripción:** Obtiene información estadística de clientes, junto con un listado de clientes con información reducida. 

## **Parámetros** 

**POST BODY** 

**{ "filtros": { … }, “fechaInicioDesde”:null, “fechaInicioHasta”:null, “fechaVencimientoDesde”:null, “fechaVencimientoHasta”:null, “fechaEliminadoDesde”:null, “fechaEliminadoHasta”:null, “idsArticulos”:[], “idsAbonosTipos”:[], “inicios”:false, “eliminados”:false, “vencimiento”:false, “incluirEliminados”:false }** 

## **Definición de datos** 

|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|**PARÁMETRO**<br>**TIPO DATO  LONGITUD**<br>**DESCRIPCIÓN**|
|---|---|---|---|
|**filtro**|Objeto||Un objeto que contiene un conjunto de<br>filtros. Consultar el apéndice para<br>conocer la Definición de estos<br>parámetros|
|**fechaInicioDesde**|Fecha||Fecha en formato dd/MM/yyyy<br>Requerido solo si inicios es true|
|**fechaInicioHasta**|Fecha||Fecha en formato dd/MM/yyyy<br>Requerido solo si inicios es true|
|**fechaVencimientoDesde**|Fecha||Fecha en formato dd/MM/yyyy<br>Requerido solo si vencimiento es true|
|**fechaVencimientoHasta**|Fecha||Fecha en formato dd/MM/yyyy<br>Requerido solo si vencimiento es true|
|**fechaEliminadoDesde**|Fecha||Fecha en formato dd/MM/yyyy<br>Requerido solo si eliminados es true|
|**fechaEliminadoHasta**|Fecha||Fecha en formato dd/MM/yyyy<br>Requerido solo si eliminados es true|
|**idsArticulos**|Array||Listado numérico con los ids de<br>artículos que debe incluir el abono<br>buscado|
|**idsAbonosTipos**|Array||Listado numérico con los ids de<br>abonosTipoque se intenta buscar|



61 

|**inicios**|Booleano||Si es true, buscará los abonos con<br>inicio de vigencia dentro del rango de<br>fechas especificado en<br>fechaInicioDesdeyfechaInicioHasta.|
|---|---|---|---|
|**eliminados**|Booleano||Si es true, buscará los abonos con<br>inicio de vigencia dentro del rango de<br>fechas especificado en<br>fechaEliminadoDesde y<br>fechaEliminadoHasta.|
|**vencimiento**|Booleano||Si es true, buscará los abonos con<br>inicio de vigencia dentro del rango de<br>fechas especificado en<br>fechaVencimientoDesde y<br>fechaVencimientoHasta.|
|**incluirEliminados**|Booleano||Determina si el resultado final de la<br>búsqueda debe incluir abonos que ya<br>se eliminaron de los clientes. Si se<br>busca con rango de fechas de<br>eliminación, este parámetro debe ser<br>true onotraerá datos|



✅ **Response** 

**DESCRIPCIÓN [ { "id": 234, "cliente_id": 123456, "nombreCliente": "XXXXXX ", "estadoCliente": "Activo", "nombreReparto": "XXXXXX", "centroFacturacion_id": 1, "centroFacturacion": "Nombre del Centro de Facturación en el cliente", "leyendaFactura": "abono mensual de 4 botellones de 20 lts", "cantidadAbonos": 1, "precioAbono": 0, "abonoTipo_id": 1, "nombreArticulo": "10002  -  BOTELLON 20L", "cantidad": 4, "nombreAbono": "abono mensual de 4 botellones de 20 lts", "fechaVigencia": "/Date(1757473200000)/", "fechaVigenciaHasta": null, "precio": 28800, "precioEspecial": 0, "precioArticulo": 6100, "precioLista": 7200, "fechaEliminado": null} ]** 

63 

## APÉNDICE 

## Filtro de Reportes 

Para aquellos endpoints que requieren un filtro avanzado de clientes, el objeto de filtro tiene la siguiente estructura 

**POST BODY { "idsRepartos": [], "idsPromotores": [], "idsCobradores": [], "idsSemanasVisitas": [], "idsDiasDeVisitas": [], "idsTipos": [], "idsEstados": [], "idsZonas": [], "idsAlertas": [], "idsActividades": [], "idsCondicionesIva": [], "idsListasDePrecios": [], "fechaAltaDesde": null, "fechaAltaHasta": null, "fechaBajaDesde": null, "fechaBajaHasta": null, "incluirAlta": false, "incluirBaja": false, "excluirAlta": false, "excluirBaja": false, "facturaAutomatica": null, "aumentoMasivoDePrecios": null, "datosCompletos": null, "idsCentrosDistribucion": [], "idsCentrosFacturacion": [], "diasUltimaVisita": null, "diasUltimaVisitaPosterior": true, "diasUltimoCobro": null, "diasUltimoCobroPosterior": true, "fechaDesde": null, "fechaHasta": null, "abonados": false, "Etiquetas_seleccionadas": [], "opcionEtiquetas": 1, "incluirLista": true, "calcularMetricas": true }** 

64 

Consideraciones respecto al filtro de reportes: 

- ❖ Si no se requiere calcular las métricas, enviar “calcularMetricas” en false o no enviar la propiedad. Esto simplifica la consulta y mejora el rendimiento 

- ❖ Los parámetros de tipo fecha, deben enviarse con formato “DD/MM/YYYY” 

- ❖ Algunos parámetros tienen valores predefinidos para su uso: 

   - ➢ **"idsEstados": Estados del cliente** 

      - **Activo = 1,** 

      - **Pausado = 2,** 

      - **Baja=4,** 

      - **Borrador=5,** 

      - **EnGestionDeBaja=6** 

   - ➢ **"opcionEtiquetas": Determina cómo se aplicará el filtro sobre el parámetro de "Etiquetas_seleccionadas"** 

      - **1 = El cliente debe tener asociadas todas las etiquetas** 

      - **2 = El cliente debe tener al menos 1 de las etiquetas** 

- ❖ Incluir/Excluir Bajas/Altas: estos 4 parámetros son excluyentes entre si, y solo debe enviarse 1 de los 4 en true, o todos null, y según la opción enviada, se utilizaran los filtros de fechaAlta(Desde y Hasta) o fechaBaja(Desde y Hasta) 

- ❖ DiasUltimaVisita buscará aquellos clientes que hayan sido visitados hace más de X días 

- ❖ DiasUltimaVisitaPosterior invierte el filtro, buscando visitados hace menos de X días 

- ❖ DiasUltimoCobro buscará aquellos clientes que hayan pagado hace más de X días 

- ❖ DiasUltimoCobroPosterior invierte el filtro, buscando que hayan padao hace menos de X días 

65 

