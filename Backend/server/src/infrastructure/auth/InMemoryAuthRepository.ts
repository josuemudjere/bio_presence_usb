import type { AuthRepository } from "../../domain/auth/AuthRepository";
import type { User } from "../../domain/auth/User";

const USERS: User[] = [
  {
    id: "admin-1",
    name: "Administrateur BioPresence",
    email: "admin@usb.org",
    role: "admin",
    matricule: "ADMIN-001",
    password: "Josue2026",
  },
  {
    id: "teacher-1",
    name: "Enseignant Demo",
    email: "teacher@usb.org",
    role: "teacher",
    matricule: "ENS-001",
    password: "Josue2026",
  },
  {
    id: "sensor-1",
    name: "Passerelle Capteur",
    email: "sensor@usb.org",
    role: "sensor",
    matricule: "SENSOR-001",
    password: "Josue2026",
  },
];

export class InMemoryAuthRepository implements AuthRepository {
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return USERS.find((user) => user.email.toLowerCase() === normalizedEmail) ?? null;
  }
}