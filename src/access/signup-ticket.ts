import { z } from "zod";
import { parseDisplayName } from "../domain/display-name";
import { constantTimeEqual } from "./token";

/**
 * Short-lived signed signup ticket: `base64url(JSON {name, owner, exp})` + `.`
 * + `base64url(HMAC-SHA256)`. Issued by the signup Server Action, re-read
 * before Better Auth creates the user. Web Crypto only (also runs in the proxy).
 * The signed message is prefixed with a fixed label so the signature can never
 * be confused with another HMAC made from the same secret.
 */
export type SignupTicket = { name: string; owner: boolean };

const DOMAIN_LABEL = "wewatch:signup-ticket:v1";
const LIFETIME_MS = 10 * 60 * 1000;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const payloadSchema = z.strictObject({
  name: z.string(),
  owner: z.boolean(),
  exp: z.number().int(),
});

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** Returns null (never throws) on anything that is not canonical base64url. */
function decode(text: string): Uint8Array | null {
  if (!BASE64URL.test(text)) {
    return null;
  }
  try {
    const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sign(encodedPayload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${DOMAIN_LABEL}.${encodedPayload}`),
  );
  return encode(new Uint8Array(mac));
}

export async function createSignupTicket(
  ticket: SignupTicket,
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const payload = {
    name: ticket.name,
    owner: ticket.owner,
    exp: now + LIFETIME_MS,
  };
  const encoded = encode(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded, secret)}`;
}

function parsePayload(encoded: string): z.infer<typeof payloadSchema> | null {
  const bytes = decode(encoded);
  if (bytes === null) {
    return null;
  }
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(decoder.decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readSignupTicket(
  token: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): Promise<SignupTicket | null> {
  const parts = token?.split(".");
  if (parts?.length !== 2) {
    return null;
  }
  const [encoded, signature] = parts as [string, string];
  if (!constantTimeEqual(signature, await sign(encoded, secret))) {
    return null;
  }
  const payload = parsePayload(encoded);
  if (payload === null || payload.exp < now) {
    return null;
  }
  const name = parseDisplayName(payload.name);
  return name === null ? null : { name, owner: payload.owner };
}
