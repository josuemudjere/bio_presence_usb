import path from "path";

import { getAppConfig } from "../infrastructure/config/env";
import { createApp } from "../presentation/http/app";
import { createServerDependencies } from "./dependencies";

function resolveStaticPath(): string {
  return path.resolve(process.cwd(), "dist", "public");
}

export async function startServer(): Promise<void> {
  const config = getAppConfig();
  const dependencies = createServerDependencies();
  const app = createApp({
    authRouter: dependencies.authRouter,
    staticPath: resolveStaticPath(),
  });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(config.port, () => {
      resolve();
    });

    server.on("error", reject);
  });
}