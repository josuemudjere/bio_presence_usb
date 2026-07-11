import type { NextFunction, Request, Response } from "express";
import { LoginUseCase } from "../../../application/auth/LoginUseCase";
import type { UserRole } from "../../../domain/auth/User";

export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Le contrôleur ne fait ici que la validation d'entrée et la traduction HTTP du use case.
      const { email, password, role } = req.body as {
        email?: string;
        password?: string;
        role?: UserRole;
      };

      if (!email || !password || !role) {
        return res.status(400).json({
          message: "Les champs email, mot de passe et role sont obligatoires",
        });
      }

      const user = await this.loginUseCase.execute({ email, password, role });
      return res.status(200).json({ user });
    } catch (error) {
      // Les erreurs sont déléguées au middleware pour conserver un format de réponse uniforme.
      return next(error);
    }
  };
}
