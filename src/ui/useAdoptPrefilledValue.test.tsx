// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useAdoptPrefilledValue } from "./useAdoptPrefilledValue";

/** A controlled field, its value echoed beside it. */
function Field({ onChange = () => {} }: { onChange?: (next: string) => void }) {
  const [value, setValue] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const change = (next: string) => {
    setValue(next);
    onChange(next);
  };
  useAdoptPrefilledValue(field, value, change);
  return (
    <>
      <input
        ref={field}
        aria-label="Champ"
        value={value}
        onChange={(event) => change(event.target.value)}
      />
      <output>{value}</output>
    </>
  );
}

describe("useAdoptPrefilledValue", () => {
  it("ce qui est tapé avant que React hydrate le champ est repris", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Field />);
    document.body.append(container);
    // Typed on the server's HTML: no React listener saw it.
    container.querySelector("input")!.value = "amelie";

    render(<Field />, { container, hydrate: true });

    expect(screen.getByRole("status")).toHaveTextContent("amelie");
    expect(screen.getByLabelText("Champ")).toHaveValue("amelie");
  });

  it("un champ vide au montage ne déclenche rien, la frappe suit son cours", async () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Champ"), "ab");
    expect(onChange).toHaveBeenLastCalledWith("ab");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
