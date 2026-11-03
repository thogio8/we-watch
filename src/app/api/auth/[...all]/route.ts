import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/container";

// Better Auth's endpoints. The instance is built on the first request, not
// when the route module loads (the build has no environment).
export const { GET, POST } = toNextJsHandler((request) =>
  getAuth().handler(request),
);
