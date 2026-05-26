import type { User } from "./User";

export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
}
