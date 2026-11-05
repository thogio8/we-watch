// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { inertOutside } from "./inertOutside";

const page = `
  <div class="shell">
    <main>
      <button id="pill">NOUS DEUX</button>
      <section id="deck" inert><button>ON LE VEUT</button></section>
      <div id="overlay"><div id="moment"><button>CONTINUER</button></div></div>
    </main>
  </div>
  <nav id="nav"><a href="/">TIRER</a></nav>
`;

const inert = () =>
  [...document.querySelectorAll("[inert]")].map((element) =>
    element.id === "" ? element.className || element.tagName : element.id,
  );

describe("inertOutside", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("rend inerte tout ce qui est hors de l’élément gardé et de ses ancêtres", () => {
    document.body.innerHTML = page;
    inertOutside(document.getElementById("overlay")!);

    expect(inert().sort()).toEqual(["deck", "nav", "pill"]);
    expect(document.getElementById("moment")!.hasAttribute("inert")).toBe(
      false,
    );
  });

  it("défait seulement ce qu’il a fait : un élément déjà inerte le reste", () => {
    document.body.innerHTML = page;
    const undo = inertOutside(document.getElementById("overlay")!);
    undo();

    expect(inert()).toEqual(["deck"]);
  });

  it("un élément détaché n’a rien à rendre inerte", () => {
    const loose = document.createElement("div");
    expect(inertOutside(loose)).toBeTypeOf("function");
    expect(inert()).toEqual([]);
  });
});
