export interface AttendanceScanAvailabilityInput {
  connectionState: 'disconnected' | 'connecting' | 'connected';
  selectedCoursId: number | null;
  isCourseScheduleConfigured: boolean;
  isPointageWindowOpen: boolean;
  hasRegisteredFingerprints: boolean;
}

export interface AttendanceScanAvailability {
  canScan: boolean;
  reason?: string;
}

export type AttendanceScanProgressEventName = 'READY' | 'FINGER_PLACED' | 'MATCH' | 'NO_MATCH' | 'ERROR' | 'ACK' | 'CANCELLED';

export function getAttendanceScanAvailability(input: AttendanceScanAvailabilityInput): AttendanceScanAvailability {
  if (!input.selectedCoursId) {
    return { canScan: false, reason: 'Sélectionnez d\'abord un cours.' };
  }

  if (!input.isCourseScheduleConfigured) {
    return { canScan: false, reason: 'Configurez l’horaire du cours avant de pointer la présence.' };
  }

  if (!input.isPointageWindowOpen) {
    return { canScan: false, reason: 'La plage horaire de présence est fermée pour ce cours.' };
  }

  if (!input.hasRegisteredFingerprints) {
    return { canScan: false, reason: 'Aucune empreinte enregistrée.' };
  }

  return { canScan: true };
}

export function getAttendanceScanProgressMessage(event: AttendanceScanProgressEventName | string | undefined): string {
  switch (event) {
    case 'READY':
      return 'En attente du doigt sur le capteur';
    case 'FINGER_PLACED':
      return 'Empreinte détectée. Recherche de la correspondance...';
    case 'MATCH':
      return 'Correspondance trouvée. Validation en cours...';
    case 'NO_MATCH':
      return 'Empreinte non reconnue.';
    case 'ACK':
      return 'Commande reçue. Le capteur prépare la lecture...';
    case 'CANCELLED':
      return 'Scan annulé.';
    case 'ERROR':
      return 'Le capteur a signalé une erreur.';
    default:
      return 'En attente du doigt sur le capteur';
  }
}
