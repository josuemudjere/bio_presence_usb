import type { User } from "./User";

export interface AuthRepository {
  // Le domaine ne dépend que de la capacité à retrouver un utilisateur par email.
  findByEmail(email: string): Promise<User | null>;
}
