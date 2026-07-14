import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  // Je fusionne les classes conditionnelles en laissant Tailwind résoudre les collisions finales.
  return twMerge(clsx(inputs));
}

export function createUuid(): string {
  // Je préfère l'UUID natif quand il existe, sinon je reproduis un v4 côté client.
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function normalizeFingerprintId(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return '';
  }

  if (/^\d{1,4}$/.test(normalized)) {
    return String(Number.parseInt(normalized, 10)).padStart(4, '0');
  }

  if (/^FP-ETU-\d{1,4}$/.test(normalized)) {
    const suffix = normalized.slice(normalized.lastIndexOf('-') + 1);
    return String(Number.parseInt(suffix, 10)).padStart(4, '0');
  }

  return normalized;
}

export function parseFingerprintIds(value?: string | string[] | null): string[] {
  // Plusieurs empreintes peuvent arriver soit en tableau API, soit en chaîne CSV historique.
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return [];
  }

  const rawIds = Array.isArray(value) ? value : value.split(',');

  return Array.from(
    new Set(
      rawIds
        .map((item) => normalizeFingerprintId(item))
        .filter(Boolean)
    )
  );
}

export function hasFingerprintId(value: string | string[] | null | undefined, fingerprintId: string): boolean {
  // Toutes les comparaisons passent en majuscules pour ignorer les variations de casse du capteur.
  const normalizedFingerprintId = normalizeFingerprintId(fingerprintId);
  if (!normalizedFingerprintId) {
    return false;
  }

  return parseFingerprintIds(value).includes(normalizedFingerprintId);
}

export function appendFingerprintId(value: string | string[] | null | undefined, fingerprintId: string): string {
  // J'empêche l'ajout de doublons tout en conservant le format de stockage existant.
  const normalizedFingerprintId = normalizeFingerprintId(fingerprintId);
  const ids = parseFingerprintIds(value);

  if (!ids.includes(normalizedFingerprintId)) {
    ids.push(normalizedFingerprintId);
  }

  return ids.join(',');
}
