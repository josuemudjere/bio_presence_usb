import { Router } from "express";
import type { AuthController } from "../controllers/AuthController";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  router.post("/login", authController.login);

  return router;
}
