// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProviderTags } from "./ProviderTags";

afterEach(cleanup);

describe("ProviderTags", () => {
  it("ProviderTags affiche chaque plateforme", () => {
    render(
      <ProviderTags
        providers={[
          { id: 8, name: "Netflix", logoPath: "/netflix.png" },
          { id: 381, name: "Canal+", logoPath: null },
        ]}
      />,
    );

    expect(screen.getByText("Netflix")).toBeVisible();
    expect(screen.getByText("Canal+")).toBeVisible();
    expect(screen.queryByText("PAS EN STREAMING")).not.toBeInTheDocument();
  });

  it("ProviderTags vide → « PAS EN STREAMING »", () => {
    render(<ProviderTags providers={[]} />);

    expect(screen.getByText("PAS EN STREAMING")).toBeVisible();
  });
});
