import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Fingerprint, Loader2, ScanSearch } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { loadStudents, type Student } from '@/lib/adminData';
import { createManualAttendance, fetchStudents, scanAttendance } from '@/lib/adminApi';
import { getBiometricErrorMessage, notifyRejectedFingerprintScan, scanFingerprintFromSensor } from '@/lib/biometricSensor';
import { serialSensor, type ConnectionState } from '@/lib/serialSensor';
import { hasFingerprintId } from '@/lib/utils';

interface SensorResult {
  studentName: string;
  matricule: string;
  department: string;
  photoUrl: string;
  scannedAtLabel: string;
  attendanceType: 'entry' | 'exit';
  attendanceId?: string;
  studentId?: string;
  checkOutTime?: string;
}

type SensorState = 'idle' | 'loading' | 'success' | 'error';

const RESULT_DISPLAY_DURATION_MS = 2 * 60 * 1000;
const AUTO_QUEUE_SUCCESS_COOLDOWN_MS = 1200;
const AUTO_QUEUE_ERROR_COOLDOWN_MS = 3200;
const MAX_SCAN_FAILURES_BEFORE_MANUAL = 3;
const ATTENDANCE_GRACE_PERIOD_MINUTES = 30;

function parseTimeToMinutes(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function getAvatarUrl(studentName: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=0f172a&color=ffffff&size=256`;
}

// ── Audio utilities ──────────────────────────────────────────────────────────

function speakText(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.92;
  utterance.pitch = 1.05;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function resolveSpokenFirstName(fullName: string): string {
  const parts = fullName
    .split(' ')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (parts.length === 0) {
    return 'étudiant';
  }

  return parts[parts.length - 1];
}

function speakWelcome(fullName: string): void {
  const firstName = resolveSpokenFirstName(fullName);
  speakText(`Bienvenue, ${firstName}`);
}

function speakGoodbye(fullName: string): void {
  const firstName = resolveSpokenFirstName(fullName);
  speakText(`Au revoir, ${firstName}`);
}

function formatStudentFullName(student: Pick<Student, 'name' | 'postNom' | 'prenom'>): string {
  return [student.name, student.postNom, student.prenom]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
}

function resolveStudentPhoto(student?: Student, fallbackName?: string): string {
  if (student?.photoUrl && student.photoUrl.trim().length > 0) {
    return student.photoUrl;
  }

  return getAvatarUrl(fallbackName ?? (student ? formatStudentFullName(student) : 'Etudiant'));
}

function normalizeErrorMessage(input: unknown): string {
  return getBiometricErrorMessage(input);
}

function formatScanTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export default function AdminSensor() {
  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [isApiReady, setIsApiReady] = useState(false);
  const [sensorState, setSensorState] = useState<SensorState>('idle');
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<SensorResult | null>(null);
  const [autoQueueEnabled, setAutoQueueEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => serialSensor.state);
  const [scanFailureCount, setScanFailureCount] = useState(0);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualMatricule, setManualMatricule] = useState('');
  const [manualEntryError, setManualEntryError] = useState('');
  const [manualEntrySubmitting, setManualEntrySubmitting] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const scanInProgressRef = useRef(false);
  const resultTimeoutRef = useRef<number | null>(null);
  const pageActiveRef = useRef(true);

  // Synchroniser l'état de connexion du capteur série
  useEffect(() => serialSensor.onConnectionChange(setConnectionState), []);

  useEffect(() => {
    if (connectionState === 'connected') {
      setAutoQueueEnabled(true);
      return;
    }

    setAutoQueueEnabled(false);
    setIsListening(false);
  }, [connectionState]);

  useEffect(() => {
    pageActiveRef.current = true;

    return () => {
      pageActiveRef.current = false;
      scanInProgressRef.current = false;

      if (resultTimeoutRef.current !== null) {
        window.clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }

      void serialSensor.cancelScan().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date()),
    [sensorState, result]
  );
  const canScan = connectionState === 'connected';

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const apiStudents = await fetchStudents();
        if (!mounted) {
          return;
        }

        setStudents(apiStudents);
        setIsApiReady(true);
      } catch {
        if (!mounted) {
          return;
        }

        setIsApiReady(false);
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const completeManualAttendance = async (student: Student) => {
    const attendance = await createManualAttendance({
      studentId: student.id,
      coursId: student.coursId ?? undefined,
    });

    const studentName = formatStudentFullName(student);
    const attendanceType: 'entry' | 'exit' = attendance.checkOut ? 'exit' : 'entry';
    const checkOutTime = attendance.checkOut ?? '';

    setResult({
      studentName,
      matricule: attendance.matricule,
      department: attendance.department,
      photoUrl: attendance.photoUrl || resolveStudentPhoto(student, studentName),
      scannedAtLabel: formatScanTimestamp(new Date()),
      attendanceType,
      attendanceId: attendance.id,
      studentId: attendance.studentId,
      checkOutTime,
    });
    setSensorState('success');
    setErrorMessage('');
    setScanFailureCount(0);
    setManualMatricule('');
    setManualEntryError('');
    setManualEntryOpen(false);


    if (attendanceType === 'exit') {
      speakGoodbye(studentName);
    } else {
      speakWelcome(studentName);
    }
  };

  const handleManualEntrySubmit = async () => {
    const normalizedMatricule = manualMatricule.trim().toUpperCase();
    if (!normalizedMatricule) {
      setManualEntryError('Saisissez le matricule de l\'étudiant.');
      return;
    }

    const matchedStudent = students.find(
      (student) => student.matricule.trim().toUpperCase() === normalizedMatricule
    );

    if (!matchedStudent) {
      setManualEntryError('Aucun étudiant ne correspond à ce matricule.');
      return;
    }

    if (!isApiReady) {
      setManualEntryError('La saisie manuelle nécessite une connexion au backend.');
      return;
    }

    setManualEntrySubmitting(true);
    try {
      await completeManualAttendance(matchedStudent);
    } catch (error) {
      setManualEntryError(normalizeErrorMessage(error));
      setSensorState('error');
    } finally {
      setManualEntrySubmitting(false);
    }
  };

  const handleScan = async () => {
    if (scanInProgressRef.current) {
      return;
    }


    const hasRegisteredFingerprints = students.some(
      (student) => student.fingerprintRegistered && student.fingerprintTemplateId
    );

    if (!hasRegisteredFingerprints) {
      setSensorState('error');
      setErrorMessage('Aucune empreinte enregistrée.');
      setResult(null);
      return;
    }

    scanInProgressRef.current = true;
    setIsListening(true);
    setErrorMessage('');

    if (resultTimeoutRef.current !== null) {
      window.clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }

    setResult(null);
    // L'état reste 'idle' pendant l'écoute du capteur

    let fingerprintId: string | null = null;

    try {
      const scanDetectedAt = new Date();

      // La promesse se résout quand l'empreinte a déjà été reconnue par le capteur.
      const scannedFingerprintId = await scanFingerprintFromSensor({
        mode: 'attendance',
      });
      fingerprintId = scannedFingerprintId;

      if (!pageActiveRef.current) {
        return;
      }

      // Le capteur a fini sa lecture, il ne reste plus qu'à valider la présence côté application.
      setIsListening(false);
      setSensorState('loading');

      if (!isApiReady) {
        const matchedStudent = students.find(
          (student) => hasFingerprintId(student.fingerprintTemplateIds ?? student.fingerprintTemplateId, scannedFingerprintId)
        );

        if (!matchedStudent) {
          throw new Error('Empreinte non reconnue.');
        }

        const fullName = formatStudentFullName(matchedStudent);
        setResult({
          studentName: fullName,
          matricule: matchedStudent.matricule,
          department: matchedStudent.department,
          photoUrl: resolveStudentPhoto(matchedStudent, fullName),
          scannedAtLabel: formatScanTimestamp(scanDetectedAt),
          attendanceType: 'entry',
        });
        setSensorState('success');
        speakWelcome(fullName);
        return;
      }

      const scanResponse = await scanAttendance(scannedFingerprintId);
      if (!pageActiveRef.current) {
        return;
      }
      setScanFailureCount(0);
      const matchedStudent = students.find((student) => student.id === scanResponse.attendance.studentId);
      const studentName = matchedStudent ? formatStudentFullName(matchedStudent) : scanResponse.attendance.studentName;

      const attendanceType: 'entry' | 'exit' = scanResponse.attendance.checkOut ? 'exit' : 'entry';
      const checkOutTime = scanResponse.attendance.checkOut ?? '';

      setResult({
        studentName,
        matricule: scanResponse.attendance.matricule,
        department: scanResponse.attendance.department,
        photoUrl: scanResponse.attendance.photoUrl || resolveStudentPhoto(matchedStudent, studentName),
        scannedAtLabel: formatScanTimestamp(new Date()),
        attendanceType,
        attendanceId: scanResponse.attendance.id,
        studentId: scanResponse.attendance.studentId,
        checkOutTime,
      });
      setSensorState('success');

      // Détecter le départ anticipé

      if (attendanceType === 'exit') {
        speakGoodbye(studentName);
      } else {
        speakWelcome(studentName);
      }
    } catch (error) {
      if (!pageActiveRef.current) {
        return;
      }

      if (typeof fingerprintId === 'string' && fingerprintId.length > 0) {
        void notifyRejectedFingerprintScan(normalizeErrorMessage(error)).catch(() => undefined);
      }

      setIsListening(false);
      setSensorState('error');
      const normalizedMessage = normalizeErrorMessage(error);
      const nextFailureCount = scanFailureCount + 1;
      setErrorMessage(normalizedMessage);
      setScanFailureCount(nextFailureCount);
      if (nextFailureCount >= MAX_SCAN_FAILURES_BEFORE_MANUAL) {
        setAutoQueueEnabled(false);
        setManualEntryError('');
        setManualMatricule('');
        setManualEntryOpen(true);
      }
    } finally {
      scanInProgressRef.current = false;
    }
  };

  useEffect(() => {
    if (!result) {
      if (resultTimeoutRef.current !== null) {
        window.clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
      return;
    }

    resultTimeoutRef.current = window.setTimeout(() => {
      setResult(null);
      resultTimeoutRef.current = null;
    }, RESULT_DISPLAY_DURATION_MS);

    return () => {
      if (resultTimeoutRef.current !== null) {
        window.clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
    };
  }, [result]);

  useEffect(() => {
    // AutoQueue uniquement si le capteur série est connecté
    if (!autoQueueEnabled || !canScan || sensorState !== 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleScan();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoQueueEnabled, sensorState, students, isApiReady, canScan]);

  useEffect(() => {
    if (!autoQueueEnabled || (sensorState !== 'success' && sensorState !== 'error')) {
      return;
    }

    const normalizedError = errorMessage.toLowerCase();
    const skipRetry =
      sensorState === 'error' &&
      (
        normalizedError.includes('aucune empreinte') ||
        normalizedError.includes('annul') ||
        normalizedError.includes('cancel') ||
        manualEntryOpen ||
        scanFailureCount >= MAX_SCAN_FAILURES_BEFORE_MANUAL
      );

    if (skipRetry) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSensorState('idle');
      setIsListening(false);
      if (sensorState === 'error') {
        setErrorMessage('');
      }
    }, sensorState === 'success' ? AUTO_QUEUE_SUCCESS_COOLDOWN_MS : AUTO_QUEUE_ERROR_COOLDOWN_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoQueueEnabled, sensorState, errorMessage, manualEntryOpen, scanFailureCount]);

  return (
    <div className="flex">
      <Sidebar userName="Admin Administrateur" />

      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className={`w-full space-y-6 ${result ? 'max-w-5xl' : 'max-w-md'}`}>

              {/* Bannière d'état capteur (connexion gérée dans Étudiants & Configurations) */}
              {connectionState !== 'connected' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-sm font-medium text-amber-800">Capteur non connecté</p>
                  <p className="mt-0.5 text-xs text-amber-600">
                    Connectez le Capteur depuis le menu <strong>Étudiants &amp; configurations</strong> pour activer le scan.
                  </p>
                </div>
              )}
              {connectionState === 'connected' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <p className="text-xs font-medium text-emerald-700">Capteur connecté · Prêt à scanner</p>
                </div>
              )}

              {/* ── Widget scan empreinte ── */}
              <div className="flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={sensorState === 'loading' || connectionState !== 'connected'}
                  className={`group relative flex h-64 w-64 items-center justify-center rounded-full border-8 ${
                    isListening
                      ? 'animate-pulse border-emerald-400 bg-gradient-to-br from-emerald-100 to-cyan-100'
                      : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50'
                  } shadow-inner transition-all duration-300 hover:scale-[1.02] hover:border-emerald-300 disabled:cursor-not-allowed`}
                >
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.14),transparent_60%)]" />
                  {sensorState === 'loading' ? (
                    <Loader2 className="relative h-24 w-24 animate-spin text-emerald-600" />
                  ) : sensorState === 'success' ? (
                    <CheckCircle2 className="relative h-24 w-24 text-emerald-600" />
                  ) : sensorState === 'error' ? (
                    <AlertTriangle className="relative h-24 w-24 text-rose-600" />
                  ) : (
                    <Fingerprint className={`relative h-24 w-24 ${
                      connectionState !== 'connected' ? 'text-slate-300' :
                      isListening ? 'animate-pulse text-emerald-500' : 'text-emerald-700'
                    }`} />
                  )}
                </button>

                <div className="text-center">
                  {sensorState === 'idle' && !isListening && connectionState !== 'connected' && (
                    <p className="text-base text-slate-400">Connectez le capteur pour scanner</p>
                  )}
                  {sensorState === 'idle' && !isListening && connectionState === 'connected' && (
                    <p className="text-base text-slate-700">En attente du doigt sur le capteur</p>
                  )}
                  {sensorState === 'idle' && !isListening && canScan && <p className="text-base text-slate-700">En attente du doigt sur le capteur</p>}
                  {sensorState === 'idle' && isListening && <p className="text-base font-medium text-emerald-700 animate-pulse">Posez votre doigt sur le capteur...</p>}
                  {sensorState === 'loading' && <p className="text-base font-medium text-emerald-700">Empreinte reconnue. Validation de la présence en cours...</p>}
                  {sensorState === 'error' && <p className="text-base font-medium text-rose-700">{errorMessage || 'Empreinte non reconnue.'}</p>}
                  {sensorState === 'success' && <p className="text-base font-medium text-emerald-700">Empreinte reconnue avec succès</p>}
                </div>

                <Button
                  onClick={handleScan}
                  disabled={sensorState === 'loading' || !canScan}
                  className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  <ScanSearch className="mr-2 h-4 w-4" />
                  {connectionState !== 'connected'
                    ? 'Capteur non connecté'
                    : sensorState === 'loading'
                    ? 'Validation en cours...'
                    : 'Scanner maintenant'}
                </Button>

                {connectionState === 'connected' && (
                  <button
                    type="button"
                    onClick={() => setAutoQueueEnabled((current) => !current)}
                    className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                  >
                    {autoQueueEnabled ? 'Mode file actif (auto-scan après chaque résultat)' : 'Activer le mode file automatique'}
                  </button>
                )}

                {sensorState === 'error' && scanFailureCount > 0 && (
                  <p className="text-xs text-slate-500">
                    Échecs de scan consécutifs: {scanFailureCount}/{MAX_SCAN_FAILURES_BEFORE_MANUAL}
                  </p>
                )}
              </div>

              {result && (
                <div className={`rounded-3xl border shadow-xl overflow-hidden ${
                  result.attendanceType === 'exit'
                    ? 'border-blue-200'
                    : 'border-emerald-200'
                }`}>
                  {/* Bande couleur en haut */}
                  <div className={`h-2 w-full ${
                    result.attendanceType === 'exit'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                  }`} />

                  <div className={`space-y-6 px-8 py-8 ${
                    result.attendanceType === 'exit'
                      ? 'bg-gradient-to-br from-blue-50 to-indigo-50'
                      : 'bg-gradient-to-br from-emerald-50 to-cyan-50'
                  }`}>
                    <div className="flex flex-col gap-5 rounded-[28px] bg-white/80 p-6 shadow-lg backdrop-blur-sm lg:flex-row lg:items-center">
                      <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl ${
                        result.attendanceType === 'exit'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <Fingerprint className="h-10 w-10" />
                      </div>

                      <img
                        src={result.photoUrl}
                        alt={`Photo de ${result.studentName}`}
                        className={`h-32 w-32 shrink-0 rounded-3xl border-4 object-cover shadow-lg ${
                          result.attendanceType === 'exit' ? 'border-blue-200' : 'border-emerald-200'
                        }`}
                      />

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className={`text-3xl font-extrabold tracking-tight ${
                            result.attendanceType === 'exit' ? 'text-blue-800' : 'text-emerald-800'
                          }`}>
                            {result.attendanceType === 'exit' ? 'Au revoir' : 'Bienvenue'}
                          </p>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            result.attendanceType === 'exit'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            Pointé à {result.scannedAtLabel}
                          </span>
                        </div>

                        <p className="truncate text-3xl font-semibold text-slate-800">{result.studentName}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-base text-slate-600">
                          <p>Matricule: {result.matricule}</p>
                          <p>Département: {result.department}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        result.attendanceType === 'exit'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {result.attendanceType === 'exit' ? 'Sortie enregistrée' : 'Entrée enregistrée'}
                      </span>

                      <p className="text-sm text-slate-500">
                      </p>

                      {autoQueueEnabled && (
                        <p className="text-xs text-slate-400">Le capteur se réarme automatiquement pour la personne suivante.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {sensorState === 'error' && autoQueueEnabled && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-center">
                  <p className="text-xs font-medium text-rose-700">Nouvelle tentative automatique dans 3 secondes...</p>
                </div>
              )}
          </div>
        </div>
      </main>

      {/* ── Dialog départ anticipé ── */}

      <Dialog open={manualEntryOpen} onOpenChange={setManualEntryOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200 bg-white p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-slate-900 to-slate-700 px-6 pt-6 pb-4 text-white text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <DialogTitle className="text-lg font-bold">Saisie manuelle du matricule</DialogTitle>
            <p className="mt-1 text-sm text-white/80">
              Après trois refus de scan, entrez le matricule de l'étudiant pour poursuivre le pointage.
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <label htmlFor="admin-manual-matricule" className="text-sm font-medium text-slate-700">
                Matricule de l'étudiant
              </label>
              <Input
                id="admin-manual-matricule"
                value={manualMatricule}
                onChange={(event) => {
                  setManualMatricule(event.target.value.toUpperCase());
                  if (manualEntryError) {
                    setManualEntryError('');
                  }
                }}
                placeholder="Ex: 22A1234"
                autoComplete="off"
                disabled={manualEntrySubmitting}
              />
            </div>

            {manualEntryError && (
              <p className="text-sm font-medium text-rose-700">{manualEntryError}</p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                disabled={manualEntrySubmitting}
                onClick={() => {
                  setManualEntryOpen(false);
                  setManualEntryError('');
                  setManualMatricule('');
                  setScanFailureCount(0);
                }}
              >
                Annuler
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                disabled={manualEntrySubmitting}
                onClick={() => { void handleManualEntrySubmit(); }}
              >
                {manualEntrySubmitting ? 'Validation...' : 'Valider le matricule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
