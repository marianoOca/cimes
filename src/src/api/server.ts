// REST API (01 §9) + inbound webhooks (Kapso, Chatwoot, Meta leadgen).
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import type { DB } from "../db/db.js";
import { emitEvent, eventsInRange, eventsToCsv } from "../db/events.js";
import { addLabel, getLeadByPhone, getOrCreateLead, updateLead } from "../db/leads.js";
import { getOrder, updatePendingOrder } from "../db/orders.js";
import { getPriceProvider } from "../ai/tools.js";
import { createGeocodingProvider } from "../providers/geocoding.js";
import { handleInbound } from "../engine/conversation.js";
import { isCoveredCity } from "../engine/coverage.js";
import { normalizeInbound, verifyKapsoSignature } from "../kapso/webhook.js";
import { sendText } from "../kapso/send.js";
import { confirmOrder, maybeSendWebConfirmation } from "../pipeline/orders.js";
import { handleInstagramLead, verifyMetaSignature } from "./instagram.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export function buildServer(db: DB): FastifyInstance {
  const app = Fastify({ logger: true });

  // Keep the raw body for webhook signature verification.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    req.rawBody = body as string;
    try {
      done(null, body === "" ? {} : JSON.parse(body as string));
    } catch (err) {
      done(err as Error);
    }
  });

  // ---------- public REST (website + chatbot consumers) ----------

  app.get("/api/prices", async (req, reply) => {
    const { city } = z.object({ city: z.string().min(1) }).parse(req.query);
    const catalog = await getPriceProvider().getCatalog(city);
    return { city, price_list: catalog.price_list, products: catalog.products };
  });

  const geocoding = createGeocodingProvider();

  app.post("/api/coverage", async (req) => {
    const body = z
      .object({
        city: z.string().min(1),
        address: z.string().min(1),
        cross_streets: z.string().optional(),
      })
      .parse(req.body);
    const result = await geocoding.resolve(
      `Argentina, ${body.city}, ${body.address}`,
      config.COVERAGE_RADIUS_M,
    );
    emitEvent(db, {
      lead_id: "web-anonymous",
      source: "web",
      city: body.city,
      event_type: "coverage_checked",
      metadata: { covered: result.covered, address: body.address },
    });
    return {
      covered: result.covered,
      coordinates: result.coordinates,
      price_list: result.price_list,
      delivery_options: result.delivery_options.map((o) => ({
        route: o.route,
        weekday: o.weekday,
        time_window: o.time_window,
      })),
    };
  });

  app.post("/api/orders", async (req, reply) => {
    const body = z
      .object({
        source: z.enum(["whatsapp", "web", "instagram"]),
        name: z.string().min(1),
        phone: z.string().min(5),
        city: z.string().min(1),
        address: z.string().min(1),
        cross_streets: z.string().default(""),
        product: z.string().min(1),
        delivery_day: z.string().min(1),
        delivery_window: z.string().default(""),
      })
      .parse(req.body);

    const { lead: created, created: isNew } = getOrCreateLead(db, {
      phone: body.phone,
      source: body.source,
      name: body.name,
    });
    if (isNew) {
      emitEvent(db, {
        lead_id: created.lead_id,
        source: body.source,
        city: body.city,
        event_type: "lead_created",
      });
    }

    // Out-of-city / in-city-no-coverage leads are saved + labeled (01 §4.2).
    if (!isCoveredCity(body.city)) {
      updateLead(db, created.lead_id, { city: body.city });
      addLabel(db, created.lead_id, "otra_ciudad");
      return reply.code(422).send({ error: "city_not_covered" });
    }

    let lead = updateLead(db, created.lead_id, {
      name: body.name,
      city: body.city,
      address: body.address,
      cross_streets: body.cross_streets,
      product: body.product,
      delivery_day: body.delivery_day,
      delivery_window: body.delivery_window,
    });

    // Resolve coverage (coords, price list, reparto) for the alta.
    const coverage = await geocoding.resolve(
      `Argentina, ${body.city}, ${body.address}`,
      config.COVERAGE_RADIUS_M,
    );
    emitEvent(db, {
      lead_id: lead.lead_id,
      source: lead.source,
      city: lead.city,
      event_type: "coverage_checked",
      metadata: { covered: coverage.covered, address: body.address },
    });
    if (!coverage.covered) {
      addLabel(db, lead.lead_id, "mal_lead");
      return reply.code(422).send({ error: "address_not_covered" });
    }
    lead = updateLead(db, lead.lead_id, {
      coverage_json: JSON.stringify(coverage),
      price_list: coverage.price_list ?? "",
    });

    // Price from the resolved list — never client-supplied.
    const catalog = await getPriceProvider().getPricesForList(coverage.price_list!);
    const product = catalog.products.find(
      (p) => p.name.toLowerCase() === body.product.toLowerCase() || p.id === body.product,
    );
    if (!product) return reply.code(422).send({ error: "unknown_product" });
    const option =
      coverage.delivery_options.find((o) => o.weekday === body.delivery_day.toLowerCase()) ??
      null;
    if (!option) return reply.code(422).send({ error: "unknown_delivery_day" });
    lead = updateLead(db, lead.lead_id, {
      price: product.price,
      product: product.name,
      route: option.route,
      delivery_day: option.weekday,
      delivery_window: option.time_window,
    });

    const result = await confirmOrder(db, lead.lead_id);
    maybeSendWebConfirmation(db, lead, result.order);
    return {
      order_id: result.order.id,
      waterservice_client_id: result.waterservice_client_id,
      ticket_status: "scheduled",
      sync_status: result.sync_status,
      label: "cliente_cerrado",
    };
  });

  // Operator override: route/day editable until dispatch (01 §4.5/§4.6).
  app.patch("/api/orders/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const patch = z
      .object({
        route: z.string().optional(),
        delivery_day: z.string().optional(),
        delivery_window: z.string().optional(),
        delivery_date: z.string().optional(),
      })
      .parse(req.body);
    const updated = updatePendingOrder(db, id, patch);
    if (!updated) {
      const exists = getOrder(db, id);
      return reply
        .code(exists ? 409 : 404)
        .send({ error: exists ? "already_dispatched" : "not_found" });
    }
    return updated;
  });

  app.get("/api/export/events", async (req, reply) => {
    const { from, to } = z
      .object({ from: z.string().min(1), to: z.string().min(1) })
      .parse(req.query);
    reply.header("content-type", "text/csv; charset=utf-8");
    return eventsToCsv(eventsInRange(db, from, to));
  });

  // ---------- Kapso webhook (inbound WhatsApp) ----------

  app.post("/webhooks/kapso", async (req, reply) => {
    const signature = req.headers["x-webhook-signature"] as string | undefined;
    if (
      config.KAPSO_WEBHOOK_SECRET &&
      !verifyKapsoSignature(req.rawBody ?? "", signature, config.KAPSO_WEBHOOK_SECRET)
    ) {
      return reply.code(401).send({ error: "bad signature" });
    }
    const normalized = normalizeInbound(req.body);
    // Ack fast; process async (per-lead queue serializes).
    if (normalized) void handleInbound(db, normalized);
    return { ok: true };
  });

  // ---------- Chatwoot webhook (03-crm; 01 §10.3) ----------

  app.post("/webhooks/chatwoot", async (req, reply) => {
    // Chatwoot sends no HMAC; the secret rides the URL/header as a shared token.
    const token =
      (req.headers["x-chatwoot-secret"] as string | undefined) ??
      (req.query as { token?: string }).token;
    if (config.CHATWOOT_WEBHOOK_SECRET && token !== config.CHATWOOT_WEBHOOK_SECRET) {
      return reply.code(401).send({ error: "bad token" });
    }
    const body = req.body as {
      event?: string;
      message_type?: string;
      private?: boolean;
      content?: string;
      conversation?: { id?: number; status?: string; labels?: string[] };
      sender?: { type?: string };
    };
    const convId = body.conversation?.id;
    if (!convId) return { ok: true };
    const leadRow = db
      .prepare("SELECT phone FROM leads WHERE chatwoot_conversation_id = ?")
      .get(convId) as { phone: string } | undefined;
    if (!leadRow) return { ok: true };
    const lead = getLeadByPhone(db, leadRow.phone);
    if (!lead) return { ok: true };

    if (
      body.event === "message_created" &&
      body.message_type === "outgoing" &&
      !body.private &&
      body.sender?.type === "user" && // an agent, not the bot mirror
      body.content
    ) {
      await sendText(config.WHATSAPP_NUMBER_SALES, lead.phone, body.content);
      emitEvent(db, {
        lead_id: lead.lead_id,
        source: lead.source,
        city: lead.city,
        event_type: "message_out",
        stage: lead.stage,
        metadata: { text: body.content, by: "human" },
      });
    }

    if (body.event === "conversation_status_changed") {
      // open → human takeover; pending → bot owns it (00-master §5.2).
      const status = body.conversation?.status;
      if (status === "open") updateLead(db, lead.lead_id, { ai_enabled: false });
      if (status === "pending") updateLead(db, lead.lead_id, { ai_enabled: true });
      if (status === "resolved") updateLead(db, lead.lead_id, { archived: true });
    }

    if (body.event === "conversation_updated" && body.conversation?.labels) {
      updateLead(db, lead.lead_id, { labels: body.conversation.labels });
    }
    return { ok: true };
  });

  // ---------- Meta leadgen webhook (Flow D; 02 §7) ----------

  app.get("/webhooks/meta", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === config.META_VERIFY_TOKEN) {
      return reply.send(q["hub.challenge"]);
    }
    return reply.code(403).send();
  });

  app.post("/webhooks/meta", async (req, reply) => {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    if (
      config.META_APP_SECRET &&
      !verifyMetaSignature(req.rawBody ?? "", signature, config.META_APP_SECRET)
    ) {
      return reply.code(401).send({ error: "bad signature" });
    }
    void handleInstagramLead(db, req.body).catch((err) =>
      app.log.error({ err }, "instagram lead ingestion failed"),
    );
    return { ok: true };
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}
