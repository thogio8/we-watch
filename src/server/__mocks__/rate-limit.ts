import { vi } from "vitest";

// Picked up by `vi.mock("@/server/rate-limit")`: every attempt is allowed.
export const withinLimit = vi.fn(async (): Promise<boolean> => true);
export const clientIp = vi.fn(async (): Promise<string> => "203.0.113.9");
