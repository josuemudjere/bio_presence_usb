const DEFAULT_API_PORT = 8080;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  // Une URL explicite dans l'environnement prend toujours la priorité sur l'auto-détection.
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  // Côté serveur, je reste sur la convention locale par défaut.
  if (typeof window === 'undefined') {
    return `http://localhost:${DEFAULT_API_PORT}/api`;
  }

  // Dans le navigateur, j'aligne automatiquement l'hôte courant avec le port API attendu.
  return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}/api`;
}
