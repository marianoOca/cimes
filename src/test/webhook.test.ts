import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeInbound, verifyKapsoSignature } from "../src/kapso/webhook.js";
import { verifyMetaSignature } from "../src/api/instagram.js";

describe("Kapso webhook", () => {
  it("verifies HMAC-SHA256 signatures", () => {
    const body = JSON.stringify({ hello: "world" });
    const sig = createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyKapsoSignature(body, sig, "secret")).toBe(true);
    expect(verifyKapsoSignature(body, sig, "other")).toBe(false);
    expect(verifyKapsoSignature(body, undefined, "secret")).toBe(false);
  });

  it("normalizes text messages", () => {
    const n = normalizeInbound({
      event_type: "whatsapp.message.received",
      phone_number_id: "PN1",
      message: { id: "wamid.1", from: "549111", type: "text", text: { body: "hola" } },
    });
    expect(n).toMatchObject({ messageId: "wamid.1", from: "549111", kind: "text", content: "hola" });
  });

  it("normalizes button, list, flow and media messages", () => {
    const button = normalizeInbound({
      message: {
        id: "m2",
        from: "5491",
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "confirm:yes", title: "Confirmar" } },
      },
    });
    expect(button).toMatchObject({ kind: "button", content: "confirm:yes" });

    const list = normalizeInbound({
      message: {
        id: "m3",
        from: "5491",
        type: "interactive",
        interactive: { type: "list_reply", list_reply: { id: "city:luján", title: "Luján" } },
      },
    });
    expect(list).toMatchObject({ kind: "list", content: "city:luján" });

    const flow = normalizeInbound({
      message: {
        id: "m4",
        from: "5491",
        type: "interactive",
        interactive: {
          type: "nfm_reply",
          nfm_reply: { response_json: '{"calle":"Rivadavia","altura":"770"}' },
        },
      },
    });
    expect(flow?.kind).toBe("flow");
    expect(flow?.flowResponse).toEqual({ calle: "Rivadavia", altura: "770" });

    const media = normalizeInbound({
      message: { id: "m5", from: "5491", type: "audio" },
    });
    expect(media?.kind).toBe("media");
  });

  it("returns null for non-message events", () => {
    expect(normalizeInbound({ event_type: "whatsapp.conversation.ended" })).toBeNull();
  });
});

describe("Meta leadgen webhook", () => {
  it("verifies X-Hub-Signature-256", () => {
    const body = JSON.stringify({ entry: [] });
    const sig = "sha256=" + createHmac("sha256", "appsecret").update(body).digest("hex");
    expect(verifyMetaSignature(body, sig, "appsecret")).toBe(true);
    expect(verifyMetaSignature(body, sig, "wrong")).toBe(false);
    expect(verifyMetaSignature(body, undefined, "appsecret")).toBe(false);
  });
});
