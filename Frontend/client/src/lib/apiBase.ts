function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  // Une URL explicite dans l'environnement prend toujours la priorité sur l'auto-détection.
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  // En production Docker, le frontend est servi via Nginx et le backend est proxifié
  // sur le même hôte via /api. Utiliser un chemin relatif évite les problèmes de
  // ports différents et garantit l'accès depuis un autre appareil du réseau.
  return '/api';
}
