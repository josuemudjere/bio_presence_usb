import type { ErrorRequestHandler } from "express";
import { InvalidCredentialsError } from "../../../domain/auth/AuthErrors";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // Je traduis d'abord les erreurs métier connues avant de tomber sur le cas générique.
  if (error instanceof InvalidCredentialsError) {
    return res.status(401).json({ message: error.message });
  }

  if (error instanceof SyntaxError) {
    return res.status(400).json({ message: "Requete invalide" });
  }

  // Le log reste côté serveur, le client ne reçoit qu'un message générique de sécurité.
  console.error(error);
  return res.status(500).json({ message: "Erreur interne du serveur" });
};
