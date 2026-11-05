// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteLink } from "./InviteLink";

const LINK = "https://wewatch.test/invitation/premier";
const NEW_LINK = "https://wewatch.test/invitation/second";
const COPY = "COPIER LE LIEN D’INVITATION";

type Sharer = {
  share?: (data: ShareData) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

/** After userEvent.setup(), which installs its own clipboard. */
function stubNavigator({ share, writeText }: Sharer) {
  if (share) {
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
  }
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

function renderLink(sharer: Sharer, load = vi.fn(() => Promise.resolve(LINK))) {
  const regenerate = vi.fn(() => Promise.resolve(NEW_LINK));
  const user = userEvent.setup();
  stubNavigator(sharer);
  const { rerender } = render(
    <InviteLink load={load} regenerate={regenerate} />,
  );
  return { user, load, regenerate, rerender };
}

const button = (name: string) => screen.getByRole("button", { name });
const failed = () => Promise.reject(new Error("raw text"));

describe("InviteLink", () => {
  it("demande le lien une fois, au montage", async () => {
    const { load } = renderLink({ writeText: vi.fn(() => Promise.resolve()) });

    await vi.waitFor(() => expect(button(COPY)).toBeEnabled());
    expect(load).toHaveBeenCalledOnce();
  });

  it("un nouveau rendu de la page, avec une autre action liée, ne redemande pas le lien", async () => {
    const { load, regenerate, rerender } = renderLink({
      writeText: vi.fn(() => Promise.resolve()),
    });
    await vi.waitFor(() => expect(button(COPY)).toBeEnabled());

    const rebound = vi.fn(() => Promise.resolve(LINK));
    rerender(<InviteLink load={rebound} regenerate={regenerate} />);
    await vi.waitFor(() => expect(button(COPY)).toBeEnabled());

    expect(load).toHaveBeenCalledOnce();
    expect(rebound).not.toHaveBeenCalled();
  });

  it("le téléphone sait partager : « PARTAGER » ouvre son partage", async () => {
    const share = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = renderLink({ share, writeText });

    await vi.waitFor(() => expect(button("PARTAGER")).toBeEnabled());
    await user.click(button("PARTAGER"));

    expect(share).toHaveBeenCalledExactlyOnceWith({ url: LINK });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("sinon le lien est copié, et « LIEN COPIÉ » s’affiche", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = renderLink({ writeText });

    await vi.waitFor(() => expect(button(COPY)).toBeEnabled());
    await user.click(button(COPY));

    expect(writeText).toHaveBeenCalledExactlyOnceWith(LINK);
    expect(screen.getByRole("status")).toHaveTextContent("LIEN COPIÉ");
  });

  it("partage et copie impossibles : le lien s’affiche en clair", async () => {
    const { user } = renderLink({ share: failed, writeText: failed });

    await vi.waitFor(() => expect(button("PARTAGER")).toBeEnabled());
    await user.click(button("PARTAGER"));

    expect(screen.getByRole("alert")).toHaveTextContent("SÉLECTIONNE LE LIEN");
    expect(screen.getByText(LINK)).toBeVisible();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("le lien n’arrive pas : le message, et toucher le bouton le redemande", async () => {
    const load = vi.fn<() => Promise<string>>(failed);
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = renderLink({ writeText }, load);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À OBTENIR LE LIEN, RÉESSAIE",
    );
    load.mockResolvedValue(LINK);
    await user.click(button(COPY));

    expect(load).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(LINK);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("régénérer passe par une confirmation ; annuler n’appelle rien", async () => {
    const { user, regenerate } = renderLink({});

    await user.click(button("RÉGÉNÉRER LE LIEN"));
    const ticket = screen.getByRole("group", {
      name: "L’ANCIEN LIEN NE MARCHERA PLUS. RÉGÉNÉRER\u00A0?",
    });
    await user.click(within(ticket).getByRole("button", { name: "ANNULER" }));

    expect(regenerate).not.toHaveBeenCalled();
    expect(button("RÉGÉNÉRER LE LIEN")).toHaveFocus();
  });

  it("régénérer, confirmé : une seule fois, puis le nouveau lien est copié", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { user, regenerate } = renderLink({ writeText });

    await vi.waitFor(() => expect(button(COPY)).toBeEnabled());
    await user.click(button(COPY));
    await user.click(button("RÉGÉNÉRER LE LIEN"));
    await user.dblClick(button("RÉGÉNÉRER"));

    expect(regenerate).toHaveBeenCalledOnce();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    await user.click(button(COPY));
    expect(writeText).toHaveBeenLastCalledWith(NEW_LINK);
  });

  it("régénérer en panne : le message dans le ticket", async () => {
    const { user, regenerate } = renderLink({});
    regenerate.mockImplementation(failed);

    await user.click(button("RÉGÉNÉRER LE LIEN"));
    await user.click(button("RÉGÉNÉRER"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À RÉGÉNÉRER LE LIEN, RÉESSAIE",
    );
  });
});
