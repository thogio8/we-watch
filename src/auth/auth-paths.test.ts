import { describe, expect, it } from "vitest";
import {
  AUTH_PATHS,
  authPathOf,
  isAuthPath,
  onlyAuthPaths,
} from "./auth-paths";

describe("AUTH_PATHS", () => {
  it("ouvre la déconnexion et les quatre étapes des cérémonies passkey, rien d'autre", () => {
    expect([...AUTH_PATHS].sort()).toEqual([
      "/passkey/generate-authenticate-options",
      "/passkey/generate-register-options",
      "/passkey/verify-authentication",
      "/passkey/verify-registration",
      "/sign-out",
    ]);
  });
});

describe("isAuthPath", () => {
  it.each(AUTH_PATHS)("%s est un chemin ouvert", (path) => {
    expect(isAuthPath(path)).toBe(true);
  });

  it.each([
    "/get-session",
    "/ok",
    "/sign-in/email",
    "/passkey/delete-passkey",
    "/sign-out/x",
    "/",
    "",
  ])("%s ne l'est pas", (path) => {
    expect(isAuthPath(path)).toBe(false);
  });
});

describe("authPathOf", () => {
  it.each([
    ["http://localhost:3000/api/auth/sign-out", "/sign-out"],
    ["http://localhost:3000/api/auth/sign-out/", "/sign-out"],
    ["http://localhost:3000/api/auth/sign-out//?x=1", "/sign-out"],
    [
      "https://we.watch/api/auth/passkey/verify-registration",
      "/passkey/verify-registration",
    ],
    ["http://localhost:3000/api/auth", "/"],
    ["http://localhost:3000/api/auth/", "/"],
    ["http://localhost:3000/api/authx/sign-out", "/api/authx/sign-out"],
    ["http://localhost:3000/", "/"],
    ["pas une adresse", "/"],
  ])("%s → %s, comme Better Auth le normalise", (url, path) => {
    expect(authPathOf(url)).toBe(path);
  });
});

describe("onlyAuthPaths", () => {
  const onRequest = (url: string) => onlyAuthPaths.onRequest(new Request(url));

  it.each([
    "http://localhost:3000/api/auth/get-session",
    "http://localhost:3000/api/auth/ok",
    "http://localhost:3000/api/auth/callback/google",
    "http://localhost:3000/api/auth",
  ])("%s → la requête s'arrête sur un 404", async (url) => {
    const result = await onRequest(url);

    expect(result).toEqual({ response: expect.any(Response) });
    const { response } = result as { response: Response };
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("un chemin ouvert passe, inchangé", async () => {
    await expect(
      onRequest("http://localhost:3000/api/auth/sign-out"),
    ).resolves.toBeUndefined();
  });
});
