import { fakeRegistration } from "./webauthn";

export const BASE_URL = "http://localhost:3000";

/** Cookies `name=value` a response sets, ready for a `cookie` header. */
export const cookiesOf = (response: Response) =>
  response.headers.getSetCookie().map((line) => line.split(";")[0] as string);

type SignUp = {
  /** The signed signup ticket the ceremony carries as its `context`. */
  ticket: string;
  credentialId: Uint8Array;
  cookies?: string[];
  /** What the client asks for; the server opens a session regardless. */
  createSession?: boolean;
};

/**
 * The real passkey signup against Better Auth's handler: register options
 * for the ticket, a software authenticator's answer, then the verification.
 * Returns the verification's response.
 */
export async function signUpWith(
  handler: (request: Request) => Promise<Response>,
  { ticket, credentialId, cookies = [], createSession }: SignUp,
): Promise<Response> {
  const challenge = await handler(
    new Request(
      `${BASE_URL}/api/auth/passkey/generate-register-options?context=${encodeURIComponent(ticket)}`,
      { headers: { cookie: cookies.join("; ") } },
    ),
  );
  const { challenge: value } = (await challenge.json()) as {
    challenge: string;
  };
  const response = await fakeRegistration({
    challenge: value,
    origin: BASE_URL,
    rpId: "localhost",
    credentialId,
  });
  return handler(
    new Request(`${BASE_URL}/api/auth/passkey/verify-registration`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        cookie: [...cookies, ...cookiesOf(challenge)].join("; "),
      },
      body: JSON.stringify({ response, createSession }),
    }),
  );
}
