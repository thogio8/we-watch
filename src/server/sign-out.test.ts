import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOutThisDevice } from "./sign-out";

vi.mock("next/headers");

let baseURL = "";
vi.mock("./container", () => ({
  getAuth: () => ({ options: { baseURL } }),
}));

const jar = async () => cookies();

beforeEach(async () => {
  const cookieJar = await jar();
  for (const name of [
    "ww_group",
    "better-auth.session_token",
    "better-auth.session_data",
    "better-auth.dont_remember",
    "__Secure-better-auth.session_token",
    "__Secure-better-auth.session_data",
    "__Secure-better-auth.dont_remember",
  ]) {
    cookieJar.delete(name);
  }
});

const expired = (name: string, secure: boolean) => ({
  name,
  value: "",
  maxAge: 0,
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure,
});

describe("signOutThisDevice", () => {
  it("en http : expire les cookies de session et le groupe affiché", async () => {
    baseURL = "http://localhost:3000";

    await signOutThisDevice();

    const cookieJar = await jar();
    for (const name of [
      "better-auth.session_token",
      "better-auth.session_data",
      "better-auth.dont_remember",
    ]) {
      expect(cookieJar.get(name)).toMatchObject(expired(name, false));
    }
    expect(cookieJar.get("ww_group")).toMatchObject(expired("ww_group", false));
  });

  it("en https : les cookies de session portent le préfixe __Secure-", async () => {
    baseURL = "https://wewatch.example";

    await signOutThisDevice();

    const cookieJar = await jar();
    for (const name of [
      "__Secure-better-auth.session_token",
      "__Secure-better-auth.session_data",
      "__Secure-better-auth.dont_remember",
    ]) {
      expect(cookieJar.get(name)).toMatchObject(expired(name, true));
    }
  });
});
