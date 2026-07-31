// Conversation engine (01 §4 + 02 §4/§5): per-lead serialization, message-ID
// dedupe, hybrid input (deterministic matching for city/product/day + AI for
// free text/FAQs), stage rendering into WhatsApp primitives, follow-up resets.
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { copy } from "../copy.es-AR.js";
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import {
  addLabel,
  getLeadById,
  getOrCreateLead,
  updateLead,
  type Lead,
} from "../db/leads.js";
import { sendButtons, sendFlow, sendList, sendText } from "../kapso/send.js";
import type { NormalizedInbound } from "../kapso/webhook.js";
import { runAiTurn } from "../ai/agent.js";
import { getPriceProvider } from "../ai/tools.js";
import { COVERED_CITIES, isCoveredCity, runCoverageForLead } from "./coverage.js";
import { enterManualReview, MANUAL_REVIEW_TAG } from "./manual-review.js";
import { enqueueForLead } from "./leadQueue.js";
import { onLeadReply, scheduleFollowups } from "../engines/followups.js";
import { confirmOrder } from "../pipeline/orders.js";
import { mirrorLeadSync, mirrorMessage, reopenIfArchived } from "../crm/mirror.js";
import type { CoverageResult, PricedCatalog } from "../providers/types.js";

function normalizeText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

async function reply(lead: Lead, phoneNumberId: string, db: DB, text: string): Promise<void> {
  await sendText(phoneNumberId, lead.phone, text);
  emitEvent(db, {
    lead_id: lead.lead_id,
    source: lead.source,
    city: lead.city,
    event_type: "message_out",
    stage: lead.stage,
    metadata: { text },
  });
  mirrorMessage(db, lead, "out", text);
}

// ---------- deterministic matchers (hybrid input, engine-side) ----------

function matchCity(text: string): string | null {
  const t = normalizeText(text);
  return COVERED_CITIES.find((c) => t.includes(normalizeText(c))) ?? null;
}

function matchProduct(text: string, catalog: PricedCatalog): string | null {
  const t = normalizeText(text);
  for (const p of catalog.products) {
    const name = normalizeText(p.name);
    if (t.includes(name) || name.includes(t)) return p.name;
  }
  // Loose aliases: "bidon de 20", "20 litros", "soda", "dispenser"…
  const aliases: [RegExp, RegExp][] = [
    [/bidon.*20|20\s*l/, /bidon.*20|20\s*l/],
    [/bidon.*12|12\s*l/, /bidon.*12|12\s*l/],
    [/soda|sifon/, /soda|sifon/],
    [/saboriz/, /saboriz/],
    [/frio|calor/, /frio|calor/],
    [/dispenser/, /dispenser/],
  ];
  for (const [userRe, productRe] of aliases) {
    if (!userRe.test(t)) continue;
    const hit = catalog.products.find((p) => productRe.test(normalizeText(p.name)));
    if (hit) return hit.name;
  }
  return null;
}

function matchDeliveryOption(text: string, coverage: CoverageResult) {
  const t = normalizeText(text);
  return (
    coverage.delivery_options.find((o) => t.includes(normalizeText(o.weekday))) ?? null
  );
}

function coverageOf(lead: Lead): CoverageResult | null {
  if (!lead.coverage_json) return null;
  try {
    return JSON.parse(lead.coverage_json) as CoverageResult;
  } catch {
    return null;
  }
}

// ---------- stage rendering (which primitive each stage sends — 02 §5) ----------

async function presentStage(db: DB, leadId: string, phoneNumberId: string): Promise<void> {
  const lead = getLeadById(db, leadId);
  if (!lead) return;
  switch (lead.stage) {
    case "inicio":
      await sendList(
        phoneNumberId,
        lead.phone,
        copy.cityPrompt,
        copy.cityListButton,
        [...COVERED_CITIES.map((c) => ({ id: `city:${c}`, title: title(c) })), {
          id: "city:otra",
          title: "Otra",
        }],
      );
      break;
    case "producto": {
      const catalog = await catalogFor(lead);
      // >3 products → list (Meta limit) (02 §5).
      await sendList(
        phoneNumberId,
        lead.phone,
        copy.productPrompt,
        copy.productListButton,
        catalog.products
          .slice(0, 10)
          .map((p) => ({ id: `product:${p.id}`, title: p.name.slice(0, 24), description: `$${p.price}` })),
      );
      break;
    }
    case "datos_entrega":
      if (config.KAPSO_DELIVERY_FLOW_ID) {
        await sendFlow(
          phoneNumberId,
          lead.phone,
          copy.deliveryDataPrompt,
          copy.deliveryDataFormButton,
          randomUUID(),
        );
      } else {
        // Flow not published yet — free-text path still works (02 §4).
        await reply(lead, phoneNumberId, db, copy.deliveryDataPrompt);
      }
      break;
    case "dia_entrega": {
      const coverage = coverageOf(lead);
      const options = coverage?.delivery_options ?? [];
      const rows = options.slice(0, 10).map((o, i) => ({
        id: `day:${i}`,
        title: `${o.weekday} ${o.time_window}`.slice(0, 24),
        description: copy.deliveryOption(o.route, o.weekday, o.time_window).slice(0, 72),
      }));
      if (rows.length === 0) {
        await reply(lead, phoneNumberId, db, copy.deliveryDayFreeText);
      } else if (rows.length <= 3) {
        await sendButtons(
          phoneNumberId,
          lead.phone,
          copy.deliveryDayPrompt,
          rows.map((r) => ({ id: r.id, title: r.title.slice(0, 20) })),
        );
      } else {
        await sendList(phoneNumberId, lead.phone, copy.deliveryDayPrompt, "Ver días", rows);
      }
      break;
    }
    case "confirmacion":
      await sendButtons(
        phoneNumberId,
        lead.phone,
        copy.orderSummaryConfirm({
          product: lead.product,
          price: lead.price ?? 0,
          address: `${lead.address}${lead.cross_streets ? ` (entre ${lead.cross_streets})` : ""}`,
          day: lead.delivery_day,
          window: lead.delivery_window,
        }),
        [
          { id: "confirm:yes", title: copy.confirmButton },
          { id: "confirm:edit", title: copy.modifyButton },
        ],
      );
      break;
    case "cliente_cerrado":
      break;
  }
}

function title(s: string): string {
  return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase()).slice(0, 24);
}

async function catalogFor(lead: Lead): Promise<PricedCatalog> {
  // Location-based list once coverage ran; provisional city map before that.
  return lead.price_list
    ? getPriceProvider().getPricesForList(lead.price_list)
    : getPriceProvider().getCatalog(lead.city);
}

// ---------- stage advancement helpers ----------

async function setCity(db: DB, lead: Lead, city: string, phoneNumberId: string): Promise<boolean> {
  if (!isCoveredCity(city)) {
    updateLead(db, lead.lead_id, { city });
    if (addLabel(db, lead.lead_id, "otra_ciudad")) {
      emitEvent(db, {
        lead_id: lead.lead_id,
        source: lead.source,
        city,
        event_type: "label_applied",
        stage: lead.stage,
        metadata: { label: "otra_ciudad" },
      });
    }
    await reply(lead, phoneNumberId, db, copy.coverageNegative);
    mirrorLeadSync(db, getLeadById(db, lead.lead_id)!);
    return false;
  }
  updateLead(db, lead.lead_id, { city });
  enterStage(db, lead.lead_id, "producto");
  return true;
}

function enterStage(db: DB, leadId: string, stage: Lead["stage"]): void {
  const lead = getLeadById(db, leadId);
  if (!lead || lead.stage === stage) return;
  updateLead(db, leadId, { stage });
  emitEvent(db, {
    lead_id: leadId,
    source: lead.source,
    city: lead.city,
    event_type: "stage_entered",
    stage,
    followup_count: 0,
  });
}

async function setProduct(
  db: DB,
  leadId: string,
  productName: string,
  phoneNumberId: string,
): Promise<void> {
  const lead = getLeadById(db, leadId)!;
  const catalog = await catalogFor(lead);
  const product = catalog.products.find((p) => p.name === productName || p.id === productName);
  if (!product) return;
  updateLead(db, leadId, { product: product.name, price: product.price });
  // producto + price merged: quote immediately in the same exchange (§5.4).
  await reply(lead, phoneNumberId, db, copy.quote(product.name, product.price));
  enterStage(db, leadId, "datos_entrega");
}

async function handleDeliveryData(
  db: DB,
  leadId: string,
  fields: { name?: string; address?: string; cross_streets?: string; notes?: string },
  phoneNumberId: string,
): Promise<void> {
  const patch: Partial<Lead> = {};
  if (fields.name) patch.name = fields.name;
  if (fields.address) patch.address = fields.address;
  if (fields.cross_streets) patch.cross_streets = fields.cross_streets;
  if (fields.notes) patch.notes = fields.notes;
  let lead = updateLead(db, leadId, patch);
  if (!lead.address) return;

  const coverage = await runCoverageForLead(db, lead, lead.address);
  lead = updateLead(db, leadId, { coverage_json: JSON.stringify(coverage) });
  // Covered city but no offerable delivery time (no serviceable neighbor/route) → hand to
  // a human instead of dead-ending (01 §4.5 / 04-website §5).
  if (coverage.delivery_options.length === 0) {
    await enterManualReview(db, lead);
    await reply(lead, phoneNumberId, db, copy.coverageNegativeInCity);
    return;
  }
  // Re-quote if the location-based list changed the price (01 §4.1).
  if (lead.product) {
    const catalog = await getPriceProvider().getPricesForList(coverage.price_list!);
    const product = catalog.products.find((p) => p.name === lead.product);
    if (product && product.price !== lead.price) {
      updateLead(db, leadId, { price: product.price });
      await reply(lead, phoneNumberId, db, copy.requote(product.name, product.price));
    }
  }
  enterStage(db, leadId, "dia_entrega");
}

async function finalizeOrder(db: DB, leadId: string, phoneNumberId: string): Promise<void> {
  const result = await confirmOrder(db, leadId);
  const lead = getLeadById(db, leadId)!;
  await reply(
    lead,
    phoneNumberId,
    db,
    copy.confirmation(result.order.delivery_day, result.order.delivery_window),
  );
}

// ---------- the entry point ----------

/** Handle one deduped, normalized inbound WhatsApp message. */
export function handleInbound(db: DB, msg: NormalizedInbound): Promise<void> {
  return enqueueForLead(msg.from, () => processInbound(db, msg));
}

async function processInbound(db: DB, msg: NormalizedInbound): Promise<void> {
  // Dedupe by message ID — webhooks can be redelivered (guardrail 00 §6).
  const inserted = db
    .prepare("INSERT OR IGNORE INTO processed_messages (message_id) VALUES (?)")
    .run(msg.messageId);
  if (inserted.changes === 0) return;

  const { lead: created, created: isNew } = getOrCreateLead(db, {
    phone: msg.from,
    source: "whatsapp",
    // Pre-fill name from the WhatsApp profile when present (02 §5 datos_entrega).
    name: msg.contactName,
  });
  let lead = created;
  if (isNew) {
    emitEvent(db, {
      lead_id: lead.lead_id,
      source: "whatsapp",
      event_type: "lead_created",
      stage: lead.stage,
    });
  }

  emitEvent(db, {
    lead_id: lead.lead_id,
    source: lead.source,
    city: lead.city,
    event_type: "message_in",
    stage: lead.stage,
    followup_count: lead.followup_count,
    metadata: { text: msg.content || msg.title || `[${msg.kind}]`, kind: msg.kind },
  });
  mirrorMessage(db, lead, "in", msg.content || msg.title || `[${msg.kind}]`);

  // Inbound on an archived conversation reopens it (03 §2).
  reopenIfArchived(db, lead);

  // A reply cancels pending follow-up timers and resets the counter (01 §7).
  onLeadReply(db, lead);
  lead = updateLead(db, lead.lead_id, { last_message_at: new Date().toISOString() });

  // ≥2 user exchanges → interesado (00-master §5.3).
  const inboundCount = (
    db
      .prepare("SELECT COUNT(*) AS n FROM events WHERE lead_id = ? AND event_type = 'message_in'")
      .get(lead.lead_id) as { n: number }
  ).n;
  if (inboundCount >= 2 && addLabel(db, lead.lead_id, "interesado")) {
    emitEvent(db, {
      lead_id: lead.lead_id,
      source: lead.source,
      city: lead.city,
      event_type: "label_applied",
      stage: lead.stage,
      metadata: { label: "interesado", reason: "exchanges" },
    });
  }

  // Website manual-review deep link: the sentinel in the prefilled WhatsApp text hands the
  // lead to a human, covering a web-phone ≠ WhatsApp-phone mismatch (phone-match miss).
  if (lead.ai_enabled && msg.kind === "text" && (msg.content ?? "").includes(MANUAL_REVIEW_TAG)) {
    await enterManualReview(db, lead);
    await reply(lead, msg.phoneNumberId, db, copy.coverageNegativeInCity);
    return;
  }

  try {
    // Human owns the conversation — mirror only, no auto-reply (00-master §5.2).
    if (!lead.ai_enabled) return;

    if (msg.kind === "media") {
      await reply(lead, msg.phoneNumberId, db, copy.mediaFallback);
      return;
    }

    await routeMessage(db, lead.lead_id, msg);
  } finally {
    const fresh = getLeadById(db, lead.lead_id);
    if (fresh) {
      scheduleFollowups(db, fresh, msg.phoneNumberId);
      mirrorLeadSync(db, fresh);
    }
  }
}

async function routeMessage(db: DB, leadId: string, msg: NormalizedInbound): Promise<void> {
  let lead = getLeadById(db, leadId)!;
  const pn = msg.phoneNumberId;

  // --- deterministic UI replies (button/list/flow ids) ---
  if (msg.kind === "button" || msg.kind === "list") {
    const [kind, ...rest] = msg.content.split(":");
    const value = rest.join(":");
    switch (kind) {
      case "city": {
        if (value === "otra") {
          await setCity(db, lead, "otra", pn);
        } else if (await setCity(db, lead, value, pn)) {
          await presentStage(db, leadId, pn);
        }
        return;
      }
      case "product":
        await setProduct(db, leadId, value, pn);
        await presentStage(db, leadId, pn);
        return;
      case "day": {
        const coverage = coverageOf(lead);
        const option = coverage?.delivery_options[Number(value)];
        if (option) {
          updateLead(db, leadId, {
            route: option.route,
            delivery_day: option.weekday,
            delivery_window: option.time_window,
          });
          enterStage(db, leadId, "confirmacion");
          await presentStage(db, leadId, pn);
        }
        return;
      }
      case "confirm":
        if (value === "yes") {
          await finalizeOrder(db, leadId, pn);
        } else {
          // "Modificar" — restart from delivery data (address most likely wrong).
          enterStage(db, leadId, "datos_entrega");
          await presentStage(db, leadId, pn);
        }
        return;
    }
    return;
  }

  // --- delivery-data form (WhatsApp Flow) response ---
  if (msg.kind === "flow" && msg.flowResponse) {
    const f = msg.flowResponse as Record<string, string>;
    const name = [f.nombre, f.apellido].filter(Boolean).join(" ");
    const address = [f.calle, f.altura].filter(Boolean).join(" ");
    await handleDeliveryData(
      db,
      leadId,
      {
        name: name || undefined,
        address: address || undefined,
        cross_streets: f.entre_calles ?? f.entreCalles,
        notes: f.notas,
      },
      pn,
    );
    await presentStage(db, leadId, pn);
    return;
  }

  // --- free text: engine-side matching first (hybrid fast path, 02 §4) ---
  const text = msg.content;
  if (msg.kind === "text" && text) {
    let advanced = false;

    if (!lead.city) {
      const city = matchCity(text);
      if (city) {
        if (isNewLead(db, leadId)) await reply(lead, pn, db, copy.greeting);
        if (!(await setCity(db, getLeadById(db, leadId)!, city, pn))) return;
        lead = getLeadById(db, leadId)!;
        advanced = true;
      }
    }
    if (lead.city && !lead.product) {
      try {
        const catalog = await catalogFor(lead);
        const product = matchProduct(text, catalog);
        if (product) {
          await setProduct(db, leadId, product, pn);
          lead = getLeadById(db, leadId)!;
          advanced = true;
        }
      } catch {
        // No price list configured for the city yet — let the AI answer.
      }
    }
    if (lead.stage === "dia_entrega") {
      const coverage = coverageOf(lead);
      const option = coverage ? matchDeliveryOption(text, coverage) : null;
      if (option) {
        updateLead(db, leadId, {
          route: option.route,
          delivery_day: option.weekday,
          delivery_window: option.time_window,
        });
        enterStage(db, leadId, "confirmacion");
        advanced = true;
      }
    }
    if (lead.stage === "confirmacion" && /^(si|sí|dale|ok|confirmo|listo)\b/i.test(text.trim())) {
      await finalizeOrder(db, leadId, pn);
      return;
    }

    if (advanced) {
      await presentStage(db, leadId, pn);
      return;
    }

    // First contact with no extractable data: greet + guided path.
    if (isNewLead(db, leadId) && !lead.city) {
      await reply(lead, pn, db, copy.greeting);
      await presentStage(db, leadId, pn);
      return;
    }

    // --- everything else: the AI (FAQs, glue, extraction via tools) ---
    const catalog = lead.city ? await catalogFor(lead).catch(() => null) : null;
    const result = await runAiTurn(db, leadId, text, { phoneNumberId: pn }, catalog);
    for (const replyText of result.replies) {
      const fresh = getLeadById(db, leadId)!;
      await reply(fresh, pn, db, replyText);
    }
    // If the AI's tools advanced the stage, render the next primitive.
    const after = getLeadById(db, leadId)!;
    if (!result.handoffTriggered && after.stage !== lead.stage) {
      await presentStage(db, leadId, pn);
    }
  }
}

function isNewLead(db: DB, leadId: string): boolean {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM events WHERE lead_id = ? AND event_type = 'message_in'",
    )
    .get(leadId) as { n: number };
  return row.n <= 1;
}
