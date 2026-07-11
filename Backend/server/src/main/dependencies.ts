import { LoginUseCase } from "../application/auth/LoginUseCase";
import { InMemoryAuthRepository } from "../infrastructure/auth/InMemoryAuthRepository";
import { AuthController } from "../presentation/http/controllers/AuthController";
import { createAuthRoutes } from "../presentation/http/routes/authRoutes";

export function createServerDependencies() {
  // Je câble les dépendances ici pour garder les couches métier découplées du framework.
  const authRepository = new InMemoryAuthRepository();
  const loginUseCase = new LoginUseCase(authRepository);
  const authController = new AuthController(loginUseCase);
  const authRouter = createAuthRoutes(authController);

  return {
    authRepository,
    loginUseCase,
    authController,
    authRouter,
  };
}