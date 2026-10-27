// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { TICKET_POSTER_ATTR } from "@/ui/Ticket";
import {
  FADE,
  stampVariants,
  tearOf,
  ticketVariants,
  viewVariants,
} from "./drawMotion";
import { tearClips } from "./tear";

const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height }) as DOMRect;

function ticket(ticketBox: DOMRect, posterBox: DOMRect) {
  const wrapper = document.createElement("div");
  const poster = document.createElement("div");
  poster.setAttribute(TICKET_POSTER_ATTR, "");
  wrapper.append(poster);
  wrapper.getBoundingClientRect = () => ticketBox;
  poster.getBoundingClientRect = () => posterBox;
  return wrapper;
}

type Exit = (exit: unknown) => Record<string, unknown>;

describe("tearOf", () => {
  it("sans ticket à l'écran, déchire au gabarit du téléphone", () => {
    expect(tearOf(null)).toEqual(tearClips("horizontal", 290, 540));
  });

  it("ticket debout : déchire sous l'affiche", () => {
    const wrapper = ticket(box(0, 100, 360, 600), box(0, 100, 360, 300));
    expect(tearOf(wrapper)).toEqual(tearClips("horizontal", 300, 600));
  });

  it("ticket couché : déchire à droite de l'affiche", () => {
    const wrapper = ticket(box(50, 0, 700, 400), box(50, 0, 200, 400));
    expect(tearOf(wrapper)).toEqual(tearClips("vertical", 200, 700));
  });
});

describe("variantes d'animation", () => {
  it("mouvement réduit : rien ne bouge", () => {
    for (const variants of [viewVariants, ticketVariants, stampVariants]) {
      expect(variants(true)).toEqual({ hidden: {}, shown: {}, exit: {} });
    }
  });

  it("RETIRER : l'écran reste en place, le ticket tombe déchiré", () => {
    const tear = { kind: "tear", clips: { intact: "A", torn: "B" } };
    const screenExit = viewVariants(false).exit as Exit;
    const ticketExit = ticketVariants(false).exit as Exit;

    expect(screenExit(tear)).toEqual({});
    expect(ticketExit(tear)).toMatchObject({ clipPath: ["A", "B", "B"] });
  });

  it("sinon, écran et ticket s'effacent", () => {
    const screenExit = viewVariants(false).exit as Exit;
    const ticketExit = ticketVariants(false).exit as Exit;

    expect(screenExit(FADE)).toMatchObject({ opacity: 0 });
    expect(ticketExit(FADE)).toMatchObject({ opacity: 0 });
    expect(stampVariants(false).shown).toMatchObject({ opacity: 1 });
  });
});
