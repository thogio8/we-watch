import { fakeRegistration } from "./webauthn";

export const BASE_URL = "http://localhost:3000";

/** Cookies `name=value` a response sets, ready for a `cookie` header. */
export const cookiesOf = (response: Response) =>
  response.headers.getSetCookie().map((line) => line.split(";")[0] as string);

type Registration = {
  /**
   * The signed signup ticket the ceremony carries as its `context`; none
   * when a signed-in user adds a passkey.
   */
  ticket?: string;
  credentialId: Uint8Array;
  cookies?: string[];
  /** What the client asks for; the server decides regardless. */
  createSession?: boolean;
  /** The passkey name the client asks for; the server decides regardless. */
  name?: string;
  userAgent?: string;
};

type Ceremony = {
  /** The WebAuthn creation options the server sent the device. */
  options: { user?: { name: string; displayName: string } };
  /** The verification's response. */
  response: Response;
};

function optionsUrl({ ticket, name }: Registration): string {
  const query = new URLSearchParams();
  if (ticket !== undefined) query.set("context", ticket);
  if (name !== undefined) query.set("name", name);
  return `${BASE_URL}/api/auth/passkey/generate-register-options?${query}`;
}

/**
 * The real passkey registration against Better Auth's handler, as the
 * browser client runs it: register options, a software authenticator's
 * answer, then the verification.
 */
export async function registerWith(
  handler: (request: Request) => Promise<Response>,
  registration: Registration,
): Promise<Ceremony> {
  const { credentialId, cookies = [], createSession, name } = registration;
  const userAgent = registration.userAgent ?? "";
  const challenge = await handler(
    new Request(optionsUrl(registration), {
      headers: { cookie: cookies.join("; "), "user-agent": userAgent },
    }),
  );
  const options = (await challenge.json()) as Ceremony["options"] & {
    challenge: string;
  };
  const response = await fakeRegistration({
    challenge: options.challenge,
    origin: BASE_URL,
    rpId: "localhost",
    credentialId,
  });
  return {
    options,
    response: await handler(
      new Request(`${BASE_URL}/api/auth/passkey/verify-registration`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": userAgent,
          origin: BASE_URL,
          cookie: [...cookies, ...cookiesOf(challenge)].join("; "),
        },
        body: JSON.stringify({ response, createSession, name }),
      }),
    ),
  };
}

/** The passkey signup with its ticket: the verification's response. */
export async function signUpWith(
  handler: (request: Request) => Promise<Response>,
  signUp: Registration & { ticket: string },
): Promise<Response> {
  return (await registerWith(handler, signUp)).response;
}
