export type UserRole = "admin" | "teacher" | "sensor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  matricule: string;
  password: string;
}

export type PublicUser = Omit<User, "password">;

export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}
