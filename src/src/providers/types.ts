// Provider contracts (00-master §5.7). The AI reaches prices/coverage only
// through these — never computes them itself (guardrail 00 §6).

export interface PricedProduct {
  id: string;
  name: string;
  price: number;
  unit?: string;
  notes?: string;
}

export interface PricedCatalog {
  price_list: string; // resolved listaDePrecios_id (or sheet list key)
  products: PricedProduct[];
}

export interface PriceProvider {
  /**
   * Catalog + prices for a given city. Never mixes two cities' lists.
   * `frioCalor` switches to the comodato-only list where one exists (01 §2).
   */
  getCatalog(city: string, opts?: { frioCalor?: boolean }): Promise<PricedCatalog>;
  /** Prices for a specific WaterService price-list id (from #12 neighbors). */
  getPricesForList(listaDePreciosId: string): Promise<PricedCatalog>;
}

export interface DeliveryOption {
  reparto_id: number;
  route: string; // route display name/id, e.g. "19"
  weekday: string; // lowercase Spanish, e.g. "sábado"
  hour_min: string; // "10" (from ultimasVisitas horarioMin)
  hour_max: string; // "13"
  time_window: string; // preformatted via copy module, e.g. "entre 10 y 13"
}

export interface CoverageResult {
  covered: boolean;
  coordinates: { lat: number; lng: number } | null;
  price_list: string | null; // location-based listaDePrecios_id
  delivery_options: DeliveryOption[];
  /** Nearest neighbor's WaterService client id — the dispatch scheduler reads
   *  its usual driver (#8) at dispatch time. */
  nearest_client_id: number | null;
}

export interface GeocodingProvider {
  resolve(address: string, radiusMeters: number): Promise<CoverageResult>;
}
