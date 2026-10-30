/** The only page reachable without a session: sign in or create an account. */
export const SIGNIN_PATH = "/connexion";

/** Better Auth's endpoints (passkey ceremonies, session): open to everyone. */
export const AUTH_API_PREFIX = "/api/auth/";

/**
 * Invite links, `/invitation/<token>`: open to everyone, to sign up through
 * them. The prefix lets every Server Action through too (an action is a POST
 * to the page's route, whichever action it names), so each action asserts
 * the session itself: only prepareSignup is public.
 */
export const INVITATION_PREFIX = "/invitation/";
