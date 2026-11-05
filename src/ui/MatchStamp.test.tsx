// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchStamp } from "./MatchStamp";

/** Names a region after the stamp: what assistive technologies read of it. */
function renderNamed(size: "small" | "large") {
  render(
    <section aria-labelledby="stamp">
      <MatchStamp size={size} id="stamp" />
    </section>,
  );
  return screen.getByRole("region");
}

describe("MatchStamp", () => {
  it("le petit tampon montre « ♥♥ MATCH » et se lit « MATCH »", () => {
    const region = renderNamed("small");

    expect(region).toHaveTextContent("♥♥ MATCH");
    expect(region).toHaveAccessibleName("MATCH");
  });

  it("le grand tampon montre « C’EST UN MATCH ♥♥ » et se lit sans les cœurs", () => {
    const region = renderNamed("large");

    expect(region).toHaveTextContent("C’EST UN MATCH ♥♥");
    expect(region).toHaveAccessibleName("C’EST UN MATCH");
  });

  it("les deux cœurs sont cachés aux lecteurs d'écran", () => {
    renderNamed("small");

    const hearts = screen.getAllByText("♥");
    expect(hearts).toHaveLength(2);
    expect(hearts[0]?.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(hearts[0]?.parentElement).toBe(hearts[1]?.parentElement);
  });
});
