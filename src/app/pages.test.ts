import { redirect } from "next/navigation";
import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIGNIN_PATH } from "@/access/paths";
import { getCurrentUser } from "@/server/session";
import DrawPage from "./page";
import GroupPage from "./groupe/page";
import MoviePage from "./list/[tmdbId]/page";
import ListPage from "./list/page";
import SwipePage from "./swipe/page";

vi.mock("@/server/session");
vi.mock("next/headers");
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

type Element = { type: unknown; props: { children?: ReactNode } };

/**
 * Renders a page's server side as React would, down to the first thrown
 * value: function components are called (and awaited), anything else (a
 * <Suspense>) hands over to its children.
 */
async function renderServer(node: unknown): Promise<void> {
  if (!isValidElement(node)) return;
  const { type, props } = node as Element;
  if (typeof type === "function") {
    return renderServer(await type(props));
  }
  return renderServer(props.children);
}

const params = { tmdbId: "550" };

describe("pages de l'appli connectée (session révoquée depuis le passage du proxy)", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(redirect).mockClear();
  });

  it.each([
    ["TIRER", () => DrawPage()],
    ["SWIPER", () => SwipePage({ searchParams: Promise.resolve({}) } as never)],
    ["LISTE", () => ListPage()],
    [
      "la fiche d'un film",
      () => MoviePage({ params: Promise.resolve(params) } as never),
    ],
    ["MEMBRES", () => GroupPage()],
  ])("%s sans session renvoie vers la connexion", async (_label, page) => {
    await expect(renderServer(page())).rejects.toThrow(
      `NEXT_REDIRECT ${SIGNIN_PATH}`,
    );
    expect(redirect).toHaveBeenCalledWith(SIGNIN_PATH);
  });
});
