import { describe, expect, it, vi } from "vitest";
import { canShare, shareOrCopy } from "./share";

const LINK = "https://wewatch.test/invitation/abc";
const abort = () => Promise.reject(new DOMException("annulé", "AbortError"));
const broken = () => Promise.reject(new Error("raw text"));

describe("canShare", () => {
  it("vrai seulement si le téléphone sait partager", () => {
    expect(canShare({ share: vi.fn() })).toBe(true);
    expect(canShare({})).toBe(false);
  });
});

describe("shareOrCopy", () => {
  it("partage le lien quand le téléphone sait partager, sans le copier", async () => {
    const share = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());

    const sharer = { share, clipboard: { writeText } };

    const outcome = await shareOrCopy(LINK, sharer);

    expect(outcome).toBe("shared");
    expect(share).toHaveBeenCalledExactlyOnceWith({ url: LINK });
    // On the navigator itself, or the browser refuses.
    expect(share.mock.contexts[0]).toBe(sharer);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("partage annulé : rien d’autre", async () => {
    const writeText = vi.fn(() => Promise.resolve());

    const outcome = await shareOrCopy(LINK, {
      share: abort,
      clipboard: { writeText },
    });

    expect(outcome).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it.each([
    [
      "une autre erreur du navigateur",
      () => Promise.reject(new DOMException("non", "NotAllowedError")),
    ],
    [
      "une erreur ordinaire nommée AbortError",
      () =>
        Promise.reject(Object.assign(new Error("x"), { name: "AbortError" })),
    ],
  ])("%s n'est pas une annulation : le lien est copié", async (_, share) => {
    const writeText = vi.fn(() => Promise.resolve());

    const outcome = await shareOrCopy(LINK, {
      share,
      clipboard: { writeText },
    });

    expect(outcome).toBe("copied");
  });

  it.each([
    ["sans partage", {}],
    ["partage en panne", { share: broken }],
  ])("%s : le lien est copié", async (_, sharer) => {
    const writeText = vi.fn(() => Promise.resolve());

    const outcome = await shareOrCopy(LINK, {
      ...sharer,
      clipboard: { writeText },
    });

    expect(outcome).toBe("copied");
    expect(writeText).toHaveBeenCalledExactlyOnceWith(LINK);
  });

  it.each([
    [
      "presse-papiers refusé",
      { share: broken, clipboard: { writeText: broken } },
    ],
    ["ni partage ni presse-papiers (http)", {}],
  ])("%s : échec, pour afficher le lien", async (_, sharer) => {
    expect(await shareOrCopy(LINK, sharer)).toBe("failed");
  });
});
