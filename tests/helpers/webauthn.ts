import { createHash } from "node:crypto";

/**
 * A software authenticator: answers a WebAuthn registration challenge with
 * "none" attestation and a fresh P-256 key, as a browser would send it to
 * /passkey/verify-registration. Enough CBOR to encode that, nothing more.
 */
type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;

function head(major: number, length: number): number[] {
  if (length < 24) {
    return [(major << 5) | length];
  }
  if (length < 256) {
    return [(major << 5) | 24, length];
  }
  return [(major << 5) | 25, length >> 8, length & 0xff];
}

function cbor(value: Cbor): number[] {
  if (typeof value === "number") {
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  }
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    return [...head(3, bytes.length), ...bytes];
  }
  if (value instanceof Uint8Array) {
    return [...head(2, value.length), ...value];
  }
  return [
    ...head(5, value.size),
    ...[...value].flatMap(([key, item]) => [...cbor(key), ...cbor(item)]),
  ];
}

const b64url = (bytes: Uint8Array | string) =>
  Buffer.from(bytes).toString("base64url");

async function coseKey(): Promise<Uint8Array> {
  const { publicKey } = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
  return new Uint8Array(
    cbor(
      new Map<Cbor, Cbor>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, raw.slice(1, 33)],
        [-3, raw.slice(33, 65)],
      ]),
    ),
  );
}

export async function fakeRegistration(options: {
  challenge: string;
  origin: string;
  rpId: string;
  credentialId: Uint8Array;
}) {
  const { challenge, origin, rpId, credentialId } = options;
  const authData = new Uint8Array([
    ...createHash("sha256").update(rpId).digest(),
    0x45, // user present + user verified + attested credential data
    ...[0, 0, 0, 0], // sign count
    ...new Uint8Array(16), // AAGUID
    credentialId.length >> 8,
    credentialId.length & 0xff,
    ...credentialId,
    ...(await coseKey()),
  ]);
  const attestationObject = new Uint8Array(
    cbor(
      new Map<Cbor, Cbor>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    ),
  );
  const clientDataJSON = JSON.stringify({
    type: "webauthn.create",
    challenge,
    origin,
    crossOrigin: false,
  });
  return {
    id: b64url(credentialId),
    rawId: b64url(credentialId),
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: b64url(clientDataJSON),
      attestationObject: b64url(attestationObject),
      transports: ["internal"],
    },
  };
}
