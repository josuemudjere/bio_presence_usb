import { InvalidCredentialsError } from "../../domain/auth/AuthErrors";
import type { AuthRepository } from "../../domain/auth/AuthRepository";
import type { PublicUser, UserRole } from "../../domain/auth/User";
import { toPublicUser } from "../../domain/auth/User";

export interface LoginInput {
  email: string;
  password: string;
  role: UserRole;
}

export class LoginUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: LoginInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const user = await this.authRepository.findByEmail(email);

    if (!user || user.password !== input.password || user.role !== input.role) {
      throw new InvalidCredentialsError();
    }

    return toPublicUser(user);
  }
}
