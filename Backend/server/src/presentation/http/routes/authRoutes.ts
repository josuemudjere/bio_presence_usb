import { Router } from "express";
import type { AuthController } from "../controllers/AuthController";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Une seule route pour l'instant, mais ce point d'entrée facilite l'extension du module auth.
  router.post("/login", authController.login);

  return router;
}
