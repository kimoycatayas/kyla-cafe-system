declare module "@prisma/extension-accelerate" {
  import type { PrismaClient } from "@prisma/client/edge";

  export interface AccelerateExtensionOptions {
    useHttpHeader?: boolean;
  }

  export function withAccelerate(
    options?: AccelerateExtensionOptions
  ): Parameters<PrismaClient["$extends"]>[0];
}
