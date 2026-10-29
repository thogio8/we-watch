/** What Better Auth's `getSession({ returnHeaders: true })` answers. */
type SessionRead = { response: unknown; headers: Headers };

export type SignedInCheck = { signedIn: boolean; setCookies: string[] };

/**
 * The proxy's session check. Fails closed: if the session cannot be read
 * (database down), the request is treated as signed out, never let through
 * and never a 500. Cookies Better Auth refreshed (session cache, renewed
 * expiry) are returned so the proxy can hand them to the browser.
 */
export async function readSignedIn(
  read: () => Promise<SessionRead>,
): Promise<SignedInCheck> {
  try {
    const { response, headers } = await read();
    return {
      signedIn: response !== null,
      setCookies: headers.getSetCookie(),
    };
  } catch (error) {
    console.error("Session check failed, treated as signed out:", error);
    return { signedIn: false, setCookies: [] };
  }
}
