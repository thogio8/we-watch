// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrailerLink } from "./TrailerLink";

describe("TrailerLink", () => {
  it("ouvre la bande-annonce YouTube dans un nouvel onglet", () => {
    render(<TrailerLink trailerKey="abc_12" title="WHIPLASH" />);
    const link = screen.getByRole("link", {
      name: "Bande-annonce de WHIPLASH (YouTube)",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abc_12",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("▶ BANDE-ANNONCE");
  });

  it("rien sans bande-annonce", () => {
    const { container } = render(
      <TrailerLink trailerKey={null} title="WHIPLASH" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
