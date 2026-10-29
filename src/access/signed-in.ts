/** Logs why a session could not be read, never the value thrown as is. */
export function logSessionFailure(context: string, error: unknown): void {
  console.error(
    `${context}, treated as signed out:`,
    error instanceof Error ? error.message : "unknown error",
  );
}

/**
 * The proxy's session check. Fails closed: if the session cannot be read
 * (database down), the request is treated as signed out, never let through
 * and never a 500.
 */
export async function readSignedIn(
  read: () => Promise<unknown>,
): Promise<boolean> {
  try {
    return (await read()) !== null;
  } catch (error) {
    logSessionFailure("Session check failed", error);
    return false;
  }
}
