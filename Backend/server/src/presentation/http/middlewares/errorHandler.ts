import type { ErrorRequestHandler } from "express";
import { InvalidCredentialsError } from "../../../domain/auth/AuthErrors";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof InvalidCredentialsError) {
    return res.status(401).json({ message: error.message });
  }

  if (error instanceof SyntaxError) {
    return res.status(400).json({ message: "Requete invalide" });
  }

  console.error(error);
  return res.status(500).json({ message: "Erreur interne du serveur" });
};
