import express, { type Router } from "express";
import path from "path";
import { errorHandler } from "./middlewares/errorHandler";

interface CreateAppOptions {
  authRouter: Router;
  staticPath: string;
}

export function createApp(options: CreateAppOptions) {
  // Toute la composition HTTP est centralisée ici pour garder le main léger.
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  // Cette route sert uniquement au monitoring et aux tests de disponibilité.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Les routes métier sont montées sous /api pour rester séparées du front statique.
  app.use("/api/auth", options.authRouter);

  app.use(express.static(options.staticPath));

  app.get("*", (req, res, next) => {
    // Toute route non API retombe sur le client SPA pour laisser le routage au frontend.
    if (req.path.startsWith("/api/")) {
      return next();
    }

    return res.sendFile(path.join(options.staticPath, "index.html"));
  });

  app.use(errorHandler);

  return app;
}
