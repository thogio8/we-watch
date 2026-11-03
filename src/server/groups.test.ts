import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIGNIN_PATH } from "@/access/paths";
import { GROUP_COOKIE, type GroupSummary } from "@/domain/group";
import {
  assertMember,
  forgetGroup,
  getActiveGroup,
  isMemberOf,
  rememberGroup,
} from "./groups";
import { assertSignedIn, getCurrentUser } from "./session";

const groupsOf = vi.fn();
const isMember = vi.fn();

vi.mock("next/headers");
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("./session");
vi.mock("./container", () => ({ getGroups: () => ({ groupsOf, isMember }) }));
let baseURL = "http://localhost:3000";
vi.mock("@/env", () => ({
  getServerEnv: () => ({ BETTER_AUTH_URL: baseURL }),
}));

const LEA = { userId: "user-1", name: "Léa", sessionId: "session-1" };
const NOUS_DEUX: GroupSummary = {
  id: "g-1",
  name: "NOUS DEUX",
  memberCount: 2,
};
const COLOC: GroupSummary = { id: "g-2", name: "LA COLOC", memberCount: 3 };

beforeEach(async () => {
  baseURL = "http://localhost:3000";
  (await cookies()).delete(GROUP_COOKIE);
  vi.mocked(getCurrentUser).mockReset().mockResolvedValue(LEA);
  groupsOf.mockReset().mockResolvedValue([NOUS_DEUX, COLOC]);
  isMember.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getActiveGroup", () => {
  it("garde le groupe du cookie quand j’en suis membre", async () => {
    await rememberGroup(COLOC.id);

    await expect(getActiveGroup()).resolves.toEqual({
      user: LEA,
      group: COLOC,
      groups: [NOUS_DEUX, COLOC],
    });
    expect(groupsOf).toHaveBeenCalledWith("user-1");
  });

  it("un cookie d’un groupe dont je ne suis pas membre donne mon premier groupe", async () => {
    await rememberGroup("groupe-des-autres");

    await expect(getActiveGroup()).resolves.toMatchObject({
      group: NOUS_DEUX,
    });
  });

  it("sans cookie, on obtient le premier groupe", async () => {
    await expect(getActiveGroup()).resolves.toMatchObject({
      group: NOUS_DEUX,
    });
  });

  it("aucun groupe donne group: null", async () => {
    groupsOf.mockResolvedValue([]);
    await rememberGroup(COLOC.id);

    await expect(getActiveGroup()).resolves.toEqual({
      user: LEA,
      group: null,
      groups: [],
    });
  });

  it("sans session (révoquée depuis que le proxy a laissé passer), renvoie vers la connexion sans lire les groupes", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(getActiveGroup()).rejects.toThrow(
      `NEXT_REDIRECT ${SIGNIN_PATH}`,
    );
    expect(redirect).toHaveBeenCalledWith(SIGNIN_PATH);
    expect(groupsOf).not.toHaveBeenCalled();
  });
});

describe("rememberGroup", () => {
  const OPTIONS = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 24 * 60 * 60,
  };

  it("pose le cookie du groupe affiché, httpOnly, 400 jours", async () => {
    await rememberGroup(COLOC.id);

    expect((await cookies()).get(GROUP_COOKIE)).toEqual({
      name: GROUP_COOKIE,
      value: COLOC.id,
      ...OPTIONS,
      secure: false,
    });
  });

  it("sur une adresse publique en https, le cookie est secure, même hors production", async () => {
    baseURL = "https://wewatch.example";

    await rememberGroup(COLOC.id);

    expect((await cookies()).get(GROUP_COOKIE)).toMatchObject({
      secure: true,
    });
  });

  it("sur une adresse en http, le cookie n’est pas secure, même en production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await rememberGroup(COLOC.id);

    expect((await cookies()).get(GROUP_COOKIE)).toMatchObject({
      secure: false,
    });
  });
});

describe("assertMember", () => {
  it("un membre : donne l’utilisateur et le groupe", async () => {
    await expect(assertMember("g-1")).resolves.toEqual({
      user: LEA,
      groupId: "g-1",
    });
    expect(isMember).toHaveBeenCalledWith("g-1", "user-1");
  });

  it("refuse un non-membre", async () => {
    isMember.mockResolvedValue(false);

    await expect(assertMember("g-3")).rejects.toThrow(
      "Server Action refused: not a member",
    );
  });

  it.each([
    ["une chaîne vide", ""],
    ["un nombre", 42],
    ["65 caractères", "g".repeat(65)],
    ["undefined", undefined],
    ["un objet", {}],
    ["un tableau", ["g-1"]],
  ])("refuse %s sans interroger la base", async (_, groupId) => {
    await expect(assertMember(groupId)).rejects.toThrow(
      "Server Action refused: not a member",
    );
    expect(isMember).not.toHaveBeenCalled();
  });

  it("accepte un identifiant de 64 caractères", async () => {
    const groupId = "g".repeat(64);

    await expect(assertMember(groupId)).resolves.toMatchObject({ groupId });
  });

  it("sans session : refuse avant toute validation", async () => {
    vi.mocked(assertSignedIn).mockRejectedValueOnce(
      new Error("Server Action refused: not signed in"),
    );

    await expect(assertMember("g-1")).rejects.toThrow(
      "Server Action refused: not signed in",
    );
    expect(isMember).not.toHaveBeenCalled();
  });
});

describe("isMemberOf (lectures)", () => {
  it("vrai pour un groupe dont je suis membre", async () => {
    await expect(isMemberOf("g-1")).resolves.toBe(true);
    expect(isMember).toHaveBeenCalledWith("g-1", "user-1");
  });

  it("faux pour un groupe étranger", async () => {
    isMember.mockResolvedValue(false);

    await expect(isMemberOf("g-3")).resolves.toBe(false);
  });

  it.each([
    ["une chaîne vide", ""],
    ["65 caractères", "g".repeat(65)],
    ["un objet", {}],
  ])("faux pour %s, sans interroger la base", async (_, groupId) => {
    await expect(isMemberOf(groupId)).resolves.toBe(false);
    expect(isMember).not.toHaveBeenCalled();
  });

  it("faux sans session, sans interroger la base", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    await expect(isMemberOf("g-1")).resolves.toBe(false);
    expect(isMember).not.toHaveBeenCalled();
  });
});

describe("forgetGroup", () => {
  it.each([
    ["http://localhost:3000", false],
    ["https://wewatch.example", true],
  ])(
    "sur %s, expire le cookie quand il désigne ce groupe, avec ses attributs (secure: %s)",
    async (url, secure) => {
      baseURL = url;
      await rememberGroup(COLOC.id);

      await forgetGroup(COLOC.id);

      expect((await cookies()).get(GROUP_COOKIE)).toEqual({
        name: GROUP_COOKIE,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: 0,
      });
    },
  );

  it("laisse le cookie d’un autre groupe", async () => {
    await rememberGroup(NOUS_DEUX.id);

    await forgetGroup(COLOC.id);

    expect((await cookies()).get(GROUP_COOKIE)?.value).toBe(NOUS_DEUX.id);
  });
});
