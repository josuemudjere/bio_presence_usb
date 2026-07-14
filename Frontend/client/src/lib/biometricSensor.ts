import { normalizeFingerprintId } from './utils';
import { serialSensor } from './serialSensor';

interface ScanFingerprintOptions {
  mode?: 'enrollment' | 'attendance';
}

function normalizeBiometricErrorText(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return 'Une erreur est survenue lors de la lecture de l\'empreinte.';
  }

  if (
    normalized.includes('fingerprint search failed') ||
    normalized.includes('empreinte non reconnue') ||
    normalized.includes('no_match') ||
    normalized.includes('no match')
  ) {
    return 'Empreinte non reconnue.';
  }

  if (
    normalized.includes('capteur introuvable') ||
    normalized.includes('capteur biométrique indisponible') ||
    normalized.includes('capteur mqtt non connecté') ||
    normalized.includes('connectez le système au capteur') ||
    normalized.includes('broker') ||
    normalized.includes('mqtt') ||
    normalized.includes('même réseau')
  ) {
    return 'Capteur biométrique indisponible. Vérifiez qu\'il est allumé et prêt à être utilisé.';
  }

  if (
    normalized.includes('temps d\'attente dépassé') ||
    normalized.includes('timeout') ||
    normalized.includes('aucun évènement')
  ) {
    return 'Le capteur ne répond pas pour le moment. Réessayez.';
  }

  if (normalized.includes('annul')) {
    return 'Lecture de l\'empreinte annulée.';
  }

  if (
    normalized.includes('déjà en cours') ||
    normalized.includes('deja en cours') ||
    normalized.includes('already in progress')
  ) {
    return 'Une lecture d\'empreinte est déjà en cours.';
  }

  if (
    normalized.includes('already associated') ||
    normalized.includes('déjà associé') ||
    normalized.includes('deja associe')
  ) {
    return 'Cette empreinte est déjà associée à un autre étudiant.';
  }

  if (normalized.includes('fingerprintid manquant') || normalized.includes('réponse mqtt invalide')) {
    return 'La lecture de l\'empreinte a échoué. Veuillez recommencer.';
  }

  return message.trim();
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

export function getBiometricErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return normalizeBiometricErrorText(error.message);
  }

  if (typeof error === 'string') {
    return normalizeBiometricErrorText(error);
  }

  return 'Une erreur est survenue lors de la lecture de l\'empreinte.';
}

export async function notifyRejectedFingerprintScan(message?: string): Promise<void> {
  // On remonte explicitement le refus au capteur pour qu'il puisse signaler l'échec côté matériel.
  await serialSensor.reportRejectedScan(message);
}
