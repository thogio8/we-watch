/**
 * Device unlock token: HMAC-SHA256(key = ACCESS_CODE, message = TOKEN_MESSAGE), hex.
 * Web Crypto only, so it runs both in the proxy and in Server Actions.
 * Changing ACCESS_CODE (or bumping the message version) invalidates every device.
 */
const TOKEN_MESSAGE = "we-watch-access-v1";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createAccessToken(code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(code),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(TOKEN_MESSAGE),
  );
  return toHex(signature);
}

/** Compares every character so timing does not reveal the matching prefix. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function isValidAccessToken(
  token: string | undefined,
  code: string,
): Promise<boolean> {
  if (token === undefined) {
    return false;
  }
  return constantTimeEqual(token, await createAccessToken(code));
}
