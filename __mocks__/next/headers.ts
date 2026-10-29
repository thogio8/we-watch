import { vi } from "vitest";

type Cookie = { name: string; value: string } & Record<string, unknown>;

const jar = new Map<string, Cookie>();

// Picked up by `vi.mock("next/headers")`: one in-memory cookie jar shared by
// the whole test file (clear it with `delete` between tests).
export const cookies = vi.fn(async () => ({
  get: (name: string) => jar.get(name),
  set: (name: string, value: string, options: Record<string, unknown> = {}) => {
    jar.set(name, { ...options, name, value });
  },
  delete: (name: string) => {
    jar.delete(name);
  },
}));

export const headers = vi.fn(async () => new Headers());
