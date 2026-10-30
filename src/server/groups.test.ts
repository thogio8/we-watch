import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("./session");
vi.mock("./container", () => ({ getGroups: () => ({ groupsOf, isMember }) }));

const LEA = { userId: "user-1", name: "Léa" };
const NOUS_DEUX: GroupSummary = {
  id: "g-1",
  name: "NOUS DEUX",
  memberCount: 2,
};
const COLOC: GroupSummary = { id: "g-2", name: "LA COLOC", memberCount: 3 };

beforeEach(async () => {
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

  it("sans session, on obtient null sans lire les groupes", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(getActiveGroup()).resolves.toBeNull();
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

  it("en production, le cookie est secure", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await rememberGroup(COLOC.id);

    expect((await cookies()).get(GROUP_COOKIE)).toMatchObject({
      secure: true,
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
  it("supprime le cookie quand il désigne ce groupe", async () => {
    await rememberGroup(COLOC.id);

    await forgetGroup(COLOC.id);

    expect((await cookies()).get(GROUP_COOKIE)).toBeUndefined();
  });

  it("laisse le cookie d’un autre groupe", async () => {
    await rememberGroup(NOUS_DEUX.id);

    await forgetGroup(COLOC.id);

    expect((await cookies()).get(GROUP_COOKIE)?.value).toBe(NOUS_DEUX.id);
  });
});
