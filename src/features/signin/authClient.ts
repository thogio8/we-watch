import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth in the browser, on the app's own origin (/api/auth). Pure
 * wiring, excluded from coverage: useSignin and the screen tests mock it.
 */
export const authClient = createAuthClient({ plugins: [passkeyClient()] });
