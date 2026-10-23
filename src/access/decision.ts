import { UNLOCK_PATH } from "./paths";
import { isValidAccessToken } from "./token";

export type AccessDecision = "allow" | "redirect" | "unauthorized";

interface AccessRequest {
  pathname: string;
  method: string;
  /** Value of the access cookie, if the browser sent one. */
  cookie: string | undefined;
  code: string;
}

/**
 * Paths readable without the cookie: framework assets, files from public/,
 * and the PWA manifest and icons (iOS fetches them without cookies).
 */
const PUBLIC_ASSET =
  /^(?:\/_next\/.*|\/manifest\.webmanifest|\/(?:apple-)?icon(?:\/[^/]*)?|\/[^/]+\.(?:svg|png|jpe?g|webp|gif|ico|woff2?))$/;

function isReadOnly(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

/** What the proxy does with a request, given the shared access code. */
export async function accessDecision({
  pathname,
  method,
  cookie,
  code,
}: AccessRequest): Promise<AccessDecision> {
  // /unlock serves the form and receives its Server Action POST.
  if (pathname === UNLOCK_PATH) {
    return "allow";
  }
  if (isReadOnly(method) && PUBLIC_ASSET.test(pathname)) {
    return "allow";
  }
  if (await isValidAccessToken(cookie, code)) {
    return "allow";
  }
  // Pages go to the form; Server Action POSTs cannot follow a redirect.
  return isReadOnly(method) ? "redirect" : "unauthorized";
}
