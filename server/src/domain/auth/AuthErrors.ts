export class InvalidCredentialsError extends Error {
  constructor() {
    super("Identifiants invalides");
    this.name = "InvalidCredentialsError";
  }
}
