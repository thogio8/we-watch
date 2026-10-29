/**
 * Whether this browser can create and use passkeys (WebAuthn). Read on the
 * client only: the server cannot know, so it assumes they work.
 */
export function passkeysSupported(win: {
  PublicKeyCredential?: unknown;
}): boolean {
  return typeof win.PublicKeyCredential !== "undefined";
}
