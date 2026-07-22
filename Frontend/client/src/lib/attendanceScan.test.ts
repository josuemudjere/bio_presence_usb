import { describe, expect, it } from 'vitest';
import { getAttendanceScanAvailability, getAttendanceScanProgressMessage } from './attendanceScan';

describe('getAttendanceScanAvailability', () => {
  it('allows attendance scanning even when the hardware sensor is disconnected', () => {
    const availability = getAttendanceScanAvailability({
      connectionState: 'disconnected',
      selectedCoursId: 42,
      isCourseScheduleConfigured: true,
      isPointageWindowOpen: true,
      hasRegisteredFingerprints: true,
    });

    expect(availability.canScan).toBe(true);
    expect(availability.reason).toBeUndefined();
  });

  it('blocks scanning when the course has not been selected', () => {
    const availability = getAttendanceScanAvailability({
      connectionState: 'disconnected',
      selectedCoursId: null,
      isCourseScheduleConfigured: true,
      isPointageWindowOpen: true,
      hasRegisteredFingerprints: true,
    });

    expect(availability.canScan).toBe(false);
    expect(availability.reason).toBe('Sélectionnez d\'abord un cours.');
  });

  it('maps sensor progress messages to the expected waiting and matching states', () => {
    expect(getAttendanceScanProgressMessage('READY')).toBe('En attente du doigt sur le capteur');
    expect(getAttendanceScanProgressMessage('FINGER_PLACED')).toBe('Empreinte détectée. Recherche de la correspondance...');
    expect(getAttendanceScanProgressMessage('MATCH')).toBe('Correspondance trouvée. Validation en cours...');
  });
});
