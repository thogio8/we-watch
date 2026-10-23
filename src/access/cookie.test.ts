import { describe, expect, it } from "vitest";
import { ACCESS_COOKIE, accessCookieOptions } from "./cookie";

describe("accessCookieOptions", () => {
  it("nomme le cookie ww_access", () => {
    expect(ACCESS_COOKIE).toBe("ww_access");
  });

  it("pose un cookie httpOnly, Lax, sur tout le site, pour un an", () => {
    expect(accessCookieOptions({ secure: true })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 31_536_000,
    });
  });

  it("n'exige pas https quand on sert en http (dev local, LAN)", () => {
    expect(accessCookieOptions({ secure: false }).secure).toBe(false);
  });
});
