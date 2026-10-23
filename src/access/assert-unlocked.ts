import "server-only";
import { cookies } from "next/headers";
import { getServerEnv } from "@/env";
import { ACCESS_COOKIE } from "./cookie";
import { isValidAccessToken } from "./token";

/**
 * First line of every Server Action: the proxy already locks them, but
 * actions are public endpoints and may be forwarded across routes by Next,
 * so each one checks the access cookie itself (defence in depth).
 */
export async function assertUnlocked(): Promise<void> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!(await isValidAccessToken(token, getServerEnv().ACCESS_CODE))) {
    throw new Error("Server Action refused: device is locked");
  }
}
