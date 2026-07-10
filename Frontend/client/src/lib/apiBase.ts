const DEFAULT_API_PORT = 8080;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  if (typeof window === 'undefined') {
    return `http://localhost:${DEFAULT_API_PORT}/api`;
  }

  return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}/api`;
}
