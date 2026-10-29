import { describe, expect, it } from "vitest";
import { passkeysSupported } from "./passkeys";

describe("passkeysSupported", () => {
  it("un navigateur qui connaît WebAuthn gère les clés d’accès", () => {
    expect(passkeysSupported({ PublicKeyCredential: class {} })).toBe(true);
  });

  it.each([{}, { PublicKeyCredential: undefined }])(
    "sans PublicKeyCredential (%o), pas de clés d’accès",
    (win) => {
      expect(passkeysSupported(win)).toBe(false);
    },
  );
});
