// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/swipe" }));

afterEach(cleanup);

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
});
