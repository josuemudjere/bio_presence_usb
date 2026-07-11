export class InvalidCredentialsError extends Error {
  constructor() {
    // Je garde un message métier stable pour simplifier la traduction côté HTTP.
    super("Identifiants invalides");
    this.name = "InvalidCredentialsError";
  }
}
