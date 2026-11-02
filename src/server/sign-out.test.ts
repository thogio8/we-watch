import { getCookies } from "better-auth/cookies";
import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/auth/create-auth";
import { createDatabase } from "@/db/create-database";
import { signOutThisDevice } from "./sign-out";

vi.mock("next/headers");

// The real Better Auth configuration: only its options are read.
let auth: ReturnType<typeof createAuth>;
vi.mock("./container", () => ({ getAuth: () => auth }));

const useBaseURL = (baseURL: string) => {
  auth = createAuth({
    db: createDatabase(":memory:"),
    secret: "sign-out-test-secret-0123456789abcdef",
    baseURL,
  });
};

beforeEach(async () => {
  const jar = await cookies();
  for (const prefix of ["", "__Secure-"]) {
    for (const name of ["session_token", "session_data", "dont_remember"]) {
      jar.delete(`${prefix}better-auth.${name}`);
    }
  }
  jar.delete("ww_group");
});

/** Better Auth's own cookies, as it names and sets them for this config. */
const sessionCookies = () => {
  const { sessionToken, sessionData, dontRememberToken } = getCookies(
    auth.options,
  );
  return [sessionToken, sessionData, dontRememberToken];
};

describe("signOutThisDevice", () => {
  it.each([
    ["http", "http://localhost:3000", "", false],
    ["https", "https://wewatch.example", "__Secure-", true],
  ])(
    "en %s : expire les cookies de session avec les attributs de Better Auth",
    async (_, baseURL, prefix, secure) => {
      useBaseURL(baseURL);

      await signOutThisDevice();

      const jar = await cookies();
      const expected = sessionCookies();
      expect(expected.map(({ name }) => name)).toEqual([
        `${prefix}better-auth.session_token`,
        `${prefix}better-auth.session_data`,
        `${prefix}better-auth.dont_remember`,
      ]);
      for (const { name, attributes } of expected) {
        expect(jar.get(name)).toEqual({
          name,
          value: "",
          maxAge: 0,
          path: attributes.path,
          httpOnly: attributes.httpOnly,
          sameSite: attributes.sameSite.toLowerCase(),
          secure,
        });
      }
    },
  );

  it("oublie aussi le groupe affiché", async () => {
    useBaseURL("http://localhost:3000");

    await signOutThisDevice();

    expect((await cookies()).get("ww_group")).toMatchObject({
      name: "ww_group",
      value: "",
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
  });
});
