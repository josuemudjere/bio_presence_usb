import { serialSensor } from './serialSensor';

interface ScanFingerprintOptions {
  mode?: 'enrollment' | 'attendance';
  knownFingerprintIds?: string[];
}

function normalizeFingerprintId(value: string): string {
  return value.trim().toUpperCase();
}

export async function scanFingerprintFromSensor(options: ScanFingerprintOptions = {}): Promise<string> {
  // Le scan biométrique n'a de sens que dans le navigateur, jamais pendant un rendu serveur.
  if (typeof window === 'undefined') {
    throw new Error('Capteur biométrique indisponible dans cet environnement.');
  }

  // Je préfère bloquer tôt avec un message métier plutôt que laisser remonter une erreur technique floue.
  if (!serialSensor.isConnected) {
    throw new Error(
      'Capteur introuvable. Vérifiez qu\'il est allumé, connecté au même réseau que le système avant de scanner.'
    );
  }

  // Le mode change le comportement du capteur entre enrôlement et pointage simple.
  const mode = options.mode ?? 'attendance';
  const fingerprintId = await serialSensor.scan(mode);
  return normalizeFingerprintId(fingerprintId);
}

export async function notifyRejectedFingerprintScan(message?: string): Promise<void> {
  // On remonte explicitement le refus au capteur pour qu'il puisse signaler l'échec côté matériel.
  await serialSensor.reportRejectedScan(message);
}
