import path from "path";

import { getAppConfig } from "../infrastructure/config/env";
import { createApp } from "../presentation/http/app";
import { createServerDependencies } from "./dependencies";

function resolveStaticPath(): string {
  // En production, le serveur Node diffuse aussi le bundle front déjà compilé.
  return path.resolve(process.cwd(), "dist", "public");
}

export async function startServer(): Promise<void> {
  // Le bootstrap assemble la config, les dépendances et l'application Express avant d'écouter.
  const config = getAppConfig();
  const dependencies = createServerDependencies();
  const app = createApp({
    authRouter: dependencies.authRouter,
    staticPath: resolveStaticPath(),
  });

  await new Promise<void>((resolve, reject) => {
    // Je renvoie une promesse explicite pour que le démarrage soit pilotable par le point d'entrée.
    const server = app.listen(config.port, () => {
      resolve();
    });

    server.on("error", reject);
  });
}