import { serialSensor } from './serialSensor';

interface ScanFingerprintOptions {
  mode?: 'enrollment' | 'attendance';
  knownFingerprintIds?: string[];
}

function normalizeFingerprintId(value: string): string {
  return value.trim().toUpperCase();
}

export async function scanFingerprintFromSensor(options: ScanFingerprintOptions = {}): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Capteur biométrique indisponible dans cet environnement.');
  }

  if (!serialSensor.isConnected) {
    throw new Error(
      'Capteur introuvable. Vérifiez qu\'il est allumé, connecté au même réseau que le système avant de scanner.'
    );
  }

  const mode = options.mode ?? 'attendance';
  const fingerprintId = await serialSensor.scan(mode);
  return normalizeFingerprintId(fingerprintId);
}

export async function notifyRejectedFingerprintScan(message?: string): Promise<void> {
  await serialSensor.reportRejectedScan(message);
}
