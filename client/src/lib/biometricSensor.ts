import { serialSensor } from './serialSensor';

type SensorResult = string | { fingerprintId: string };

interface ScanFingerprintOptions {
  mode?: 'enrollment' | 'attendance';
  knownFingerprintIds?: string[];
}

declare global {
  interface Window {
    bioPresenceSensor?: {
      scanFingerprint: () => Promise<SensorResult> | SensorResult;
    };
  }
}

function normalizeFingerprintId(value: string): string {
  return value.trim().toUpperCase();
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function randomBytes(size: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(size);
  const bytes = new Uint8Array(buffer);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function tryScanWithPlatformAuthenticator(options: ScanFingerprintOptions): Promise<string | null> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
    return null;
  }

  const mode = options.mode ?? 'attendance';
  const knownIds = (options.knownFingerprintIds ?? []).filter(Boolean);

  try {
    if (mode === 'attendance' && knownIds.length > 0) {
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          allowCredentials: knownIds.map((id) => ({
            id: fromBase64Url(id),
            type: 'public-key' as const,
          })),
          userVerification: 'required',
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (credential?.rawId) {
        return normalizeFingerprintId(toBase64Url(credential.rawId));
      }
    }

    if (mode === 'enrollment') {
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: randomBytes(32),
          rp: {
            name: 'Bio_Presence',
          },
          user: {
            id: randomBytes(16),
            name: `biopresence-${Date.now()}`,
            displayName: 'Bio Presence User',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      })) as PublicKeyCredential | null;

      if (credential?.rawId) {
        return normalizeFingerprintId(toBase64Url(credential.rawId));
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function scanFingerprintFromSensor(options: ScanFingerprintOptions = {}): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Capteur biométrique indisponible dans cet environnement.');
  }

  const mode = options.mode ?? 'attendance';

  // ── Priorité 1 : capteur série NodeMCU via USB (Web Serial API) ───────────
  if (serialSensor.isConnected) {
    return serialSensor.scan(mode);
  }

  // ── Priorité 2 : bridge natif (window.bioPresenceSensor) ─────────────────
  if (window.bioPresenceSensor?.scanFingerprint) {
    const result = await window.bioPresenceSensor.scanFingerprint();
    const rawId = typeof result === 'string' ? result : result.fingerprintId;
    const fingerprintId = normalizeFingerprintId(rawId ?? '');

    if (!fingerprintId) {
      throw new Error('Le capteur n\'a pas retourné d\'ID d\'empreinte valide.');
    }

    return fingerprintId;
  }

  // ── Priorité 3 : WebAuthn / Touch ID (fallback navigateur) ───────────────
  const webAuthnFingerprintId = await tryScanWithPlatformAuthenticator(options);
  if (webAuthnFingerprintId) {
    return webAuthnFingerprintId;
  }

  // ── Priorité 4 : saisie manuelle ─────────────────────────────────────────
  if (mode === 'attendance') {
    throw new Error(
      'Aucun capteur connecté. Branchez le NodeMCU via USB et cliquez sur "Connecter le capteur".'
    );
  }

  const manualId = window.prompt(
    'Capteur non connecté. Saisissez manuellement l\'ID d\'empreinte pour l\'enrôlement :'
  );
  const fingerprintId = normalizeFingerprintId(manualId ?? '');

  if (!fingerprintId) {
    throw new Error('Scan annulé ou ID d\'empreinte vide.');
  }

  return fingerprintId;
}
