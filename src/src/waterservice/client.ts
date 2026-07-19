// Per-endpoint WaterService wrappers (01 §1) — one thin wrapper per endpoint,
// not a generic mega-client, so out-of-scope endpoints can be added later.
// Endpoint numbers refer to the API manual v1.0.1. zod coerces numeric strings
// (manual quirk); .NET /Date(ms)/ timestamps are parsed via time.parseWsDate.
import { z } from "zod";
import { wsCall } from "./http.js";

// ---------- shared shapes ----------

const ultimasVisitas = z
  .object({
    diaSemana: z.string(),
    horarioMin: z.string().nullish(),
    horarioMax: z.string().nullish(),
    horarioProm: z.string().nullish(),
    cantidadVisitas: z.coerce.number().nullish(),
  })
  .nullish();

const visita = z.object({
  dia: z.string(),
  dia_ids: z.coerce.number().nullish(),
  reparto_id: z.coerce.number(),
  nombreReparto: z.string().nullish(),
  ultimasVisitas,
});

const neighbor = z.object({
  cliente_id: z.coerce.number(),
  nombreReparto: z.string().nullish(),
  latitud: z.coerce.number(),
  longitud: z.coerce.number(),
  distanciaMetros: z.coerce.number(),
  listaDePrecios_id: z.coerce.number(),
  visitas: z.array(visita).default([]),
  proximaVisita: z.string().nullish(),
  diasProximaVisita: z.coerce.number().nullish(),
});
export type WsNeighbor = z.infer<typeof neighbor>;

// ---------- #12 coverage by address (primary GeocodingProvider impl) ----------

const nearbyByAddressResponse = z.object({
  data: z.array(neighbor).default([]),
  coordenadas: z
    .object({ Latitud: z.coerce.number(), Longitud: z.coerce.number() })
    .nullish(),
});
export type NearbyByAddress = z.infer<typeof nearbyByAddressResponse>;

export async function buscarClientesCercanosPorDireccion(
  address: string,
  metros: number,
): Promise<NearbyByAddress> {
  const body = await wsCall({
    method: "GET",
    path: "/Repartos/BusquedaClientesCercanosResultJson",
    data: { address, metros },
  });
  return nearbyByAddressResponse.parse(body);
}

// ---------- #4 coverage by coordinates (Google Maps adapter path) ----------

const nearbyByCoordsResponse = z.object({
  clientesCercanos: z.array(neighbor).default([]),
});

export async function obtenerClientesCercanosPorCoordenadas(
  latitud: number,
  longitud: number,
  radioMetros: number,
): Promise<WsNeighbor[]> {
  const body = await wsCall({
    method: "GET",
    path: "/Repartos/ObtenerClientesCercanosPorCoordenadas",
    data: { excluir: false, latitud, longitud, radioMetros },
  });
  return nearbyByCoordsResponse.parse(body).clientesCercanos;
}

// ---------- #5 price list of a (nearest) client ----------

const priceListResponse = z.object({
  ArticulosDeListaDePrecio: z.record(z.string(), z.coerce.number()),
});

export async function obtenerListaDePreciosDeCliente(
  clienteId: number,
): Promise<Record<string, number>> {
  const body = await wsCall({
    method: "GET",
    path: "/ListaDePrecios/ObtenerListaDePreciosDeCliente",
    data: { ClienteId: clienteId },
  });
  return priceListResponse.parse(body).ArticulosDeListaDePrecio;
}

// ---------- #10 full price matrix ----------

const matrixResponse = z.object({
  matriz: z.object({
    articulos: z.array(
      z.object({
        articulo_id: z.coerce.number(),
        nombreArticulo: z.string(),
        rubro: z.string().nullish(),
        precios: z.array(
          z.object({
            lista_id: z.coerce.number(),
            articulo_id: z.coerce.number(),
            precio: z.coerce.number(),
          }),
        ),
      }),
    ),
    listas: z.array(
      z.object({ lista_id: z.coerce.number(), nombre: z.string() }),
    ),
  }),
});
export type PriceMatrix = z.infer<typeof matrixResponse>["matriz"];

export async function obtenerMatrizListaDePrecios(
  tipoListaId: number,
): Promise<PriceMatrix> {
  const body = await wsCall({
    method: "GET",
    path: "/ListaDePrecios/ObtenerMatrizListaDePrecios",
    data: { tipoLista_id: tipoListaId },
  });
  return matrixResponse.parse(body).matriz;
}

// ---------- #11 abono types (frío/calor subscriptions) ----------

const abonosResponse = z.object({
  abonosTipos: z.array(
    z.object({
      id: z.coerce.number(),
      nombreAbono: z.string(),
      leyendaFacturacion: z.string().nullish(),
      precio: z.coerce.number(),
      activo: z.boolean().nullish(),
    }),
  ),
});
export type AbonoTipo = z.infer<typeof abonosResponse>["abonosTipos"][number];

export async function obtenerAbonosTipos(): Promise<AbonoTipo[]> {
  const body = await wsCall({
    method: "GET",
    path: "/AbonosTipos/ObtenerAbonosTipos",
    data: { activo: true },
  });
  return abonosResponse.parse(body).abonosTipos;
}

// ---------- #2 existing-client lookup (dedupe before alta; support) ----------

const clientSummary = z.object({
  cliente_id: z.coerce.number(),
  nombreCliente: z.string().nullish(),
  reparto_id: z.coerce.number().nullish(),
  usuarioRepartidorHabitual: z.coerce.number().nullish(),
  fechaProximaVisita1: z.string().nullish(),
  fechaProximaVisita2: z.string().nullish(),
  fechaProximaVisita3: z.string().nullish(),
  nombreCiudad: z.string().nullish(),
  domicilioCompleto: z.string().nullish(),
  centroDistribucion_id: z.coerce.number().nullish(),
  etiquetas: z.array(z.unknown()).nullish(),
});
export type WsClientSummary = z.infer<typeof clientSummary>;

const busquedaRapidaResponse = z.object({ data: z.array(clientSummary).default([]) });

export async function busquedaRapidaPorTelefono(
  telefono: string,
): Promise<WsClientSummary[]> {
  const body = await wsCall({
    method: "POST",
    path: "/api/Clientes/BusquedaRapidaResultJson",
    data: { telefono },
  });
  return busquedaRapidaResponse.parse(body).data;
}

// ---------- #8 client detail by id ----------

const clientDetail = clientSummary.extend({
  diaProximaVisita1: z.string().nullish(),
  diaProximaVisita2: z.string().nullish(),
  diaProximaVisita3: z.string().nullish(),
});
export type WsClientDetail = z.infer<typeof clientDetail>;

export async function obtenerDatosCliente(clienteId: number): Promise<WsClientDetail> {
  const body = await wsCall({
    method: "POST",
    path: "/api/Clientes/ObtenerDatosCliente",
    data: { cliente_id: clienteId },
  });
  return clientDetail.parse(body);
}

// ---------- #6 alta (create client, Borrador state) ----------

export interface AltaInput {
  nombre: string;
  telefono: string;
  listaDePreciosId: number;
  repartoId: number;
  domicilio: {
    provincia: string;
    ciudad: string;
    calle: string;
    puerta: string;
    observaciones: string;
    latitud: string;
    longitud: string;
  };
}

const altaResponse = z.object({
  data: z.object({ cliente_id: z.coerce.number() }),
});

export async function crearNuevoClientePorChatBot(input: AltaInput): Promise<number> {
  const body = await wsCall({
    method: "POST",
    path: "/Clientes/CrearNuevoClientePorChatBot",
    data: {
      cliente: {
        nombre: input.nombre,
        tipoDeClienteId: 1, // Familia
        actividadId: 15, // Consumidor final
        condicionIvaId: 2, // Consumidor Final
        dniCuit: "",
        telefono: input.telefono,
        // No flow collects email (01 §1.1 note) — send empty.
        email: "",
        listaDePreciosId: input.listaDePreciosId,
        reparto_id: input.repartoId,
        domicilio: {
          provincia: input.domicilio.provincia,
          ciudad: input.domicilio.ciudad,
          calle: input.domicilio.calle,
          puerta: input.domicilio.puerta,
          observaciones: input.domicilio.observaciones,
          piso: "",
          depto: "",
          torre: "",
          cp: "",
          lote: "",
          manzana: "",
          latitud: input.domicilio.latitud,
          longitud: input.domicilio.longitud,
        },
      },
    },
  });
  return altaResponse.parse(body).data.cliente_id;
}

// ---------- #7 attach contact (the WhatsApp number) ----------

export async function createContacto(input: {
  clienteId: number;
  nombrePersona: string;
  celular: string;
}): Promise<void> {
  await wsCall({
    method: "POST",
    path: "/api/Clientes/CreateContacto",
    data: {
      ModeloContacto: {
        tipoContacto_ids: 1, // Primer contacto
        nombrePersona: input.nombrePersona,
        sectorEmpresa: null,
        telefono: "",
        email: "",
        observaciones: "Alta por chatbot",
        cliente_id: input.clienteId,
        contactoPrincipal: 1,
        celular: input.celular,
        sector_ids: 6, // Titular
        caracteristicaCelular: 0,
        porCuentaCorriente: false,
        fechaValidacionEmail: null,
        codigoValidacion: null,
        // Notification flags default false (01 §1.1) — revisit later.
        enviarComprobanteFiscalAdjunto: false,
        enviarRemitos: false,
        enviarOrdenesDeTrabajo: false,
        enviarAvisoDeProximaVisita: false,
      },
    },
  });
}

// ---------- #3 driver ticket (Incident) — called by the dispatch scheduler ----------

export interface TicketInput {
  centroDistribucionId: number;
  clienteId: number;
  titulo: string;
  descripcionHtml: string;
  fechaCierreEstimado: string; // dd/MM/yyyy (request-date guardrail)
  tipoIncidenteId: number;
  subTipoIncidenteId: number;
  severidadId: number;
  usuarioResponsableId: number | null;
  grupoResponsableIds: number | null; // mutually exclusive with usuarioResponsable_id
}

const ticketResponse = z.object({
  incidente: z.object({ id: z.coerce.number() }),
});

export async function crearTicket(input: TicketInput): Promise<number> {
  const body = await wsCall({
    method: "POST",
    path: "/api/Incidentes/Save",
    data: {
      centroDistribucion_id: input.centroDistribucionId,
      cliente_id: input.clienteId,
      descripcion: input.descripcionHtml,
      estadoIncidente_ids: null,
      fechaCierreEstimado: input.fechaCierreEstimado,
      severidad_ids: input.severidadId,
      subTipoIncidente_ids: input.subTipoIncidenteId,
      tipoIncidente_ids: input.tipoIncidenteId,
      titulo: input.titulo,
      usuarioResponsable_id: input.usuarioResponsableId,
      grupoResponsable_ids: input.grupoResponsableIds,
      usuariosSeguimiento_ids: [],
    },
  });
  return ticketResponse.parse(body).incidente.id;
}

// ---------- #28 balance deltas (nightly debt sync, paginated) ----------

const facturasResponse = z.object({
  Facturas: z
    .array(
      z.object({
        cliente_id: z.coerce.number(),
        factura_id: z.coerce.number(),
        saldoPendiente: z.coerce.number(),
        UltimaModificacionSaldoPendiente: z.string().nullish(),
      }),
    )
    .default([]),
  HasMore: z.boolean().default(false),
});
export type FacturasPage = z.infer<typeof facturasResponse>;

export async function obtenerFacturasConSaldoModificado(
  desde: string, // dd/MM/yyyy
  pagina: number,
  cantidadXPagina = 500,
): Promise<FacturasPage> {
  const body = await wsCall({
    method: "GET",
    path: "/Facturacion/ObtenerFacturasConSaldoModificado",
    data: { desde, pagina, cantidadXPagina },
  });
  return facturasResponse.parse(body);
}

// ---------- #21 per-client balance (re-check right before reminding) ----------

const saldosResponse = z.object({
  saldos: z.object({
    cliente_id: z.coerce.number(),
    saldoCuentaFacturacion: z.coerce.number(),
    saldoCuentaConsumo: z.coerce.number().nullish(),
    fechaUltimoCobro: z.string().nullish(),
    diasVisita: z.string().nullish(),
  }),
});
export type WsSaldos = z.infer<typeof saldosResponse>["saldos"];

export async function obtenerSaldosDeCliente(clienteId: number): Promise<WsSaldos> {
  const body = await wsCall({
    method: "GET",
    path: "/api/Movimientos/ObtenerSaldosDeCliente",
    data: { clienteId },
  });
  return saldosResponse.parse(body).saldos;
}

// ---------- #14 receipts (verify "ya pagué" claims) ----------

const recibosResponse = z.object({
  recibos: z
    .array(
      z.object({
        id: z.coerce.number(),
        fechaRecibo: z.string(),
        montoTotalRecibo: z.coerce.number(),
      }),
    )
    .default([]),
});
export type WsRecibo = z.infer<typeof recibosResponse>["recibos"][number];

export async function obtenerRecibosDeCobros(
  clienteId: number,
  fechaReciboDesde: string, // dd/MM/yyyy
  fechaReciboHasta: string, // dd/MM/yyyy
): Promise<WsRecibo[]> {
  const body = await wsCall({
    method: "POST",
    path: "/Recibos/ObtenerRecibosDeCobros",
    data: { clienteId, fechaReciboDesde, fechaReciboHasta, saldoDisponible: false },
  });
  return recibosResponse.parse(body).recibos;
}
