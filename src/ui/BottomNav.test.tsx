// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

const pathname = vi.hoisted(() => ({ current: "/swipe" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

afterEach(() => {
  pathname.current = "/swipe";
});

describe("BottomNav", () => {
  it("BottomNav marque l'onglet courant", () => {
    render(<BottomNav />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SWIPER" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "SWIPER" })).toHaveAttribute(
      "href",
      "/swipe",
    );
    expect(screen.getByRole("link", { name: "TIRER" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "TIRER" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "LISTE" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "LISTE" })).toHaveAttribute(
      "href",
      "/list",
    );
  });

  it("BottomNav disparaît sur l'écran de connexion", () => {
    pathname.current = "/connexion";
    render(<BottomNav />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("BottomNav disparaît sur une invitation, page hors de l'appli", () => {
    pathname.current = `/invitation/${"A".repeat(43)}`;
    render(<BottomNav />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
