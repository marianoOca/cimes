// GeocodingProvider (01 §3): default impl = WaterService #12 (geocodes AND
// returns neighbors/coverage in one call). Google Maps adapter behind the
// same interface, selected via GEOCODING_PROVIDER; coverage then via #4.
// No manual validation gate — assume #12 works, keep it swappable (settled).
import { config } from "../config.js";
import { copy } from "../copy.es-AR.js";
import * as ws from "../waterservice/client.js";
import type { WsNeighbor } from "../waterservice/client.js";
import type { CoverageResult, DeliveryOption, GeocodingProvider } from "./types.js";

function hourOf(time: string | null | undefined): string {
  if (!time) return "";
  return time.split(":")[0] ?? "";
}

// The delivery route is fixed by where the customer lives — it is not a choice. Scope the
// day options to the reparto that serves the nearest neighbors. Aggregating every neighbor's
// route (a 10 km radius pulls the whole town) produced dozens of redundant day buttons and
// let the alta (pipeline/orders) pick a reparto that doesn't actually serve the address.
const WEEKDAY_ORDER = [
  "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
];

/** reparto_id of the closest neighbor that has a visit schedule, or null if none do. */
function servingRepartoId(sortedNeighbors: WsNeighbor[]): number | null {
  for (const n of sortedNeighbors) {
    if (n.visitas.length > 0) return n.visitas[0]!.reparto_id;
  }
  return null;
}

/** Weekdays the serving reparto visits: one option per weekday, in week order. */
function optionsForReparto(neighbors: WsNeighbor[], repartoId: number): DeliveryOption[] {
  const byWeekday = new Map<string, DeliveryOption>();
  for (const n of neighbors) {
    for (const v of n.visitas) {
      if (v.reparto_id !== repartoId) continue;
      const weekday = v.dia.toLowerCase();
      if (byWeekday.has(weekday)) continue;
      const hourMin = hourOf(v.ultimasVisitas?.horarioMin);
      const hourMax = hourOf(v.ultimasVisitas?.horarioMax);
      byWeekday.set(weekday, {
        reparto_id: v.reparto_id,
        route: v.nombreReparto ?? String(v.reparto_id),
        weekday,
        hour_min: hourMin,
        hour_max: hourMax,
        time_window: copy.deliveryWindow(hourMin, hourMax),
      });
    }
  }
  const rank = (w: string) => {
    const i = WEEKDAY_ORDER.indexOf(w);
    return i === -1 ? WEEKDAY_ORDER.length : i;
  };
  return [...byWeekday.values()].sort((a, b) => rank(a.weekday) - rank(b.weekday));
}

function resultFromNeighbors(
  neighbors: WsNeighbor[],
  coordinates: { lat: number; lng: number } | null,
): CoverageResult {
  if (neighbors.length === 0) {
    return {
      covered: false,
      coordinates,
      price_list: null,
      delivery_options: [],
      nearest_client_id: null,
    };
  }
  const sorted = [...neighbors].sort((a, b) => a.distanciaMetros - b.distanciaMetros);
  const nearest = sorted[0]!;
  const repartoId = servingRepartoId(sorted);
  return {
    covered: true,
    coordinates:
      coordinates ?? { lat: nearest.latitud, lng: nearest.longitud },
    // Location-based price list from the nearest neighbor (01 §4.1).
    price_list: String(nearest.listaDePrecios_id),
    delivery_options: repartoId === null ? [] : optionsForReparto(sorted, repartoId),
    nearest_client_id: nearest.cliente_id,
  };
}

/** Default implementation — WaterService #12 (address → coverage in one call). */
export class WaterServiceGeocodingProvider implements GeocodingProvider {
  async resolve(address: string, radiusMeters: number): Promise<CoverageResult> {
    const res = await ws.buscarClientesCercanosPorDireccion(address, radiusMeters);
    const coords = res.coordenadas
      ? { lat: res.coordenadas.Latitud, lng: res.coordenadas.Longitud }
      : null;
    return resultFromNeighbors(res.data, coords);
  }
}

/** Google Maps adapter: geocode → coordinates, then coverage via #4. */
export class GoogleMapsGeocodingProvider implements GeocodingProvider {
  async resolve(address: string, radiusMeters: number): Promise<CoverageResult> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", config.GOOGLE_MAPS_API_KEY);
    url.searchParams.set("region", "ar");
    const res = await fetch(url);
    const body = (await res.json()) as {
      status: string;
      results: { geometry: { location: { lat: number; lng: number } } }[];
    };
    const location = body.results[0]?.geometry.location;
    if (body.status !== "OK" || !location) {
      return {
        covered: false,
        coordinates: null,
        price_list: null,
        delivery_options: [],
        nearest_client_id: null,
      };
    }
    const neighbors = await ws.obtenerClientesCercanosPorCoordenadas(
      location.lat,
      location.lng,
      radiusMeters,
    );
    return resultFromNeighbors(neighbors, location);
  }
}

export function createGeocodingProvider(): GeocodingProvider {
  return config.GEOCODING_PROVIDER === "googlemaps"
    ? new GoogleMapsGeocodingProvider()
    : new WaterServiceGeocodingProvider();
}
