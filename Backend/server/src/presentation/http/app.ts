import express, { type Router } from "express";
import path from "path";
import { errorHandler } from "./middlewares/errorHandler";

interface CreateAppOptions {
  authRouter: Router;
  staticPath: string;
}

export function createApp(options: CreateAppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", options.authRouter);

  app.use(express.static(options.staticPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }

    return res.sendFile(path.join(options.staticPath, "index.html"));
  });

  app.use(errorHandler);

  return app;
}
