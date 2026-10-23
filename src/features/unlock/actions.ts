"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, accessCookieOptions } from "@/access/cookie";
import { createAccessToken, isValidAccessToken } from "@/access/token";
import { getServerEnv } from "@/env";
import {
  WRONG_CODE_DELAY_MS,
  WRONG_CODE_MESSAGE,
  type UnlockState,
} from "./state";

/** « ENTRER »: a right code remembers the device for a year, then opens the app. */
export async function unlock(
  _previous: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  // Server Actions are public endpoints: the body may not be a form, and the
  // field may be missing or a file. All of these are a wrong code.
  const submitted = formData instanceof FormData ? formData.get("code") : null;
  const code = typeof submitted === "string" ? submitted : "";
  const { ACCESS_CODE } = getServerEnv();

  // Web Crypto rejects an empty HMAC key, and an empty code is wrong anyway.
  if (
    code === "" ||
    !(await isValidAccessToken(await createAccessToken(code), ACCESS_CODE))
  ) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_CODE_DELAY_MS));
    return { error: WRONG_CODE_MESSAGE };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACCESS_COOKIE,
    await createAccessToken(ACCESS_CODE),
    accessCookieOptions({ secure: process.env.NODE_ENV === "production" }),
  );
  redirect("/");
}
