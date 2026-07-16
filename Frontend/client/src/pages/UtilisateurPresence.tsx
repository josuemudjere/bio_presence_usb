import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Fingerprint, HeartPulse, Loader2, LogOut, ScanSearch, Users } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ATTENDANCE_WINDOW_CLOSED_MESSAGE } from '@/const';
import { loadCourseSettings, type Cours, type CourseSettings, type DepartureReason, type Student } from '@/lib/adminData';
import { createManualAttendance, fetchCours, fetchStudentsForCours, saveDepartureJustification, scanAttendanceForCours } from '@/lib/adminApi';
import { getBiometricErrorMessage, notifyRejectedFingerprintScan, scanFingerprintFromSensor } from '@/lib/biometricSensor';
import { serialSensor, type ConnectionState } from '@/lib/serialSensor';
import { hasFingerprintId } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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

const RESULT_DISPLAY_DURATION_MS = 60 * 1000;
const AUTO_QUEUE_SUCCESS_COOLDOWN_MS = 1200;
const AUTO_QUEUE_ERROR_COOLDOWN_MS = 3200;
const MAX_SCAN_FAILURES_BEFORE_MANUAL = 3;
const TEACHER_SELECTED_COURSE_KEY = 'biopresence_teacher_selected_course';
const TEACHER_ROSTER_REFRESH_INTERVAL_MS = 15000;
const ATTENDANCE_GRACE_PERIOD_MINUTES = 20;
const DEPARTURE_REASON_LABELS: Record<DepartureReason, string> = {
  maladie: 'Maladie',
  'urgence-familiale': 'Urgence familiale',
  'urgence-travail': 'Urgence au travail',
};

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

function isWithinAttendanceWindow(startTime?: string | null, endTime?: string | null, now = new Date()): boolean {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) {
    return false;
  }

  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes + ATTENDANCE_GRACE_PERIOD_MINUTES;
}

function getAvatarUrl(studentName: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=0f172a&color=ffffff&size=256`;
}

function speakText(text: string): void {
  // La synthèse vocale reste optionnelle et ne doit jamais bloquer le flux de pointage.
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

export default function UtilisateurPresence() {
  // Cette page pilote le scan biométrique, l'affichage du résultat et les exceptions manuelles.
  const { user } = useAuth();
  const assignedCourseIds = user?.coursIds ?? (user?.coursId != null ? [user.coursId] : []);

  const [students, setStudents] = useState<Student[]>([]);
  const [assignedCourses, setAssignedCourses] = useState<Cours[]>([]);
  const [selectedCoursId, setSelectedCoursId] = useState<number | null>(assignedCourseIds[0] ?? null);
  const [courseSettings, setCourseSettings] = useState<CourseSettings>(() => loadCourseSettings());
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
  const selectedCourse = assignedCourses.find((course) => course.id === selectedCoursId) ?? null;
  const isCourseScheduleConfigured = Boolean(selectedCourse?.heureDebut && selectedCourse?.heureFin);
  const isPointageWindowOpen = isWithinAttendanceWindow(selectedCourse?.heureDebut, selectedCourse?.heureFin, new Date(clockTick));
  const canScan = connectionState === 'connected' && Boolean(selectedCoursId) && isCourseScheduleConfigured && isPointageWindowOpen;
  const filteredStudents = useMemo(() => students, [students]);

  // Départ anticipé
  const [earlyDeparturePending, setEarlyDeparturePending] = useState<{
    attendanceId: string;
    studentId: string;
    studentName: string;
    photoUrl: string;
    checkOutTime: string;
  } | null>(null);
  const [selectedReason, setSelectedReason] = useState<DepartureReason | null>(null);

  const handleConfirmDeparture = async (reason: DepartureReason | null) => {
    // Une sortie anticipée est persistée côté backend pour rester visible dans tout le système.
    if (!earlyDeparturePending) return;
    const pendingDeparture = earlyDeparturePending;
    const reasonLabel = reason ? DEPARTURE_REASON_LABELS[reason] : null;

    if (!isApiReady) {
      return;
    }

    try {
      await saveDepartureJustification(pendingDeparture.attendanceId, {
        motifJustificatif: reasonLabel,
        estJustifiee: reason !== null,
      });
    } catch {
      return;
    }

    setEarlyDeparturePending(null);
    setSelectedReason(null);
  };

  useEffect(() => serialSensor.onConnectionChange(setConnectionState), []);

  useEffect(() => {
    // La file automatique n'est activée que quand le capteur est réellement disponible.
    if (connectionState === 'connected') {
      setAutoQueueEnabled(true);
      return;
    }

    setAutoQueueEnabled(false);
    setIsListening(false);
  }, [connectionState]);

  useEffect(() => {
    // Au démontage, je nettoie tout ce qui pourrait laisser un scan ou un timer orphelin.
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
  const sensorStatusLabel = connectionState === 'connected'
    ? 'Capteur connecté et prêt'
    : connectionState === 'connecting'
    ? 'Connexion au capteur en cours'
    : 'Capteur hors ligne';

  const completeManualAttendance = async (student: Student) => {
    if (!selectedCoursId) {
      throw new Error('Sélectionnez d\'abord un cours.');
    }

    if (!isPointageWindowOpen) {
      throw new Error(ATTENDANCE_WINDOW_CLOSED_MESSAGE);
    }

    const attendance = await createManualAttendance({
      studentId: student.id,
      coursId: selectedCoursId,
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

    const selectedCourseEndTime = selectedCourse?.heureFin || courseSettings.endTime;
    if (attendanceType === 'exit' && selectedCourseEndTime && checkOutTime && checkOutTime < selectedCourseEndTime) {
      setEarlyDeparturePending({
        attendanceId: attendance.id,
        studentId: attendance.studentId,
        studentName,
        photoUrl: attendance.photoUrl || resolveStudentPhoto(student, studentName),
        checkOutTime,
      });
      setSelectedReason(null);
    }

    if (attendanceType === 'exit') speakGoodbye(studentName);
    else speakWelcome(studentName);
  };

  const handleManualEntrySubmit = async () => {
    const normalizedMatricule = manualMatricule.trim().toUpperCase();
    if (!normalizedMatricule) {
      setManualEntryError('Saisissez le matricule de l\'étudiant.');
      return;
    }

    const matchedStudent = filteredStudents.find(
      (student) => student.matricule.trim().toUpperCase() === normalizedMatricule
    );

    if (!matchedStudent) {
      setManualEntryError('Aucun étudiant ne correspond à ce matricule dans ce cours.');
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

  useEffect(() => {
    // Je mémorise le cours choisi pour éviter à l'enseignant de le re-sélectionner à chaque visite.
    const savedCourseId = Number(localStorage.getItem(TEACHER_SELECTED_COURSE_KEY));
    if (Number.isFinite(savedCourseId) && assignedCourseIds.includes(savedCourseId)) {
      setSelectedCoursId(savedCourseId);
      return;
    }

    setSelectedCoursId(assignedCourseIds[0] ?? null);
  }, [user?.id, user?.coursIds, user?.coursId]);

  useEffect(() => {
    if (selectedCoursId == null) {
      localStorage.removeItem(TEACHER_SELECTED_COURSE_KEY);
      return;
    }

    localStorage.setItem(TEACHER_SELECTED_COURSE_KEY, String(selectedCoursId));
  }, [selectedCoursId]);

  const refreshTeacherRoster = async (mounted?: { current: boolean }) => {
    try {
      const apiCours = await fetchCours();
      if (mounted && !mounted.current) return;

      const filteredCourses = apiCours.filter((course) => assignedCourseIds.includes(course.id));
      setAssignedCourses(filteredCourses);

      const effectiveCoursId = selectedCoursId ?? filteredCourses[0]?.id ?? null;
      if (effectiveCoursId != null) {
        const apiStudents = await fetchStudentsForCours(effectiveCoursId);
        if (mounted && !mounted.current) return;
        setStudents(apiStudents);
      } else {
        setStudents([]);
      }

      setIsApiReady(true);
    } catch {
      if (mounted && !mounted.current) return;
      setStudents([]);
      setAssignedCourses([]);
      setIsApiReady(false);
    }
  };

  useEffect(() => {
    // Je charge le catalogue enseignant, puis la liste des inscrits du cours sélectionné depuis la base.
    const mounted = { current: true };
    void refreshTeacherRoster(mounted);
    return () => { mounted.current = false; };
  }, [assignedCourseIds, selectedCoursId, user?.id]);

  useEffect(() => {
    // La liste enseignant se rafraîchit automatiquement pour intégrer les nouveaux enrôlements faits par l'administration.
    const refreshRosterIfVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void refreshTeacherRoster();
    };

    const intervalId = window.setInterval(refreshRosterIfVisible, TEACHER_ROSTER_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshRosterIfVisible);
    document.addEventListener('visibilitychange', refreshRosterIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshRosterIfVisible);
      document.removeEventListener('visibilitychange', refreshRosterIfVisible);
    };
  }, [assignedCourseIds, selectedCoursId, user?.id]);

  const handleScan = async () => {
    // Un seul scan à la fois pour éviter les doublons et les collisions de réponse capteur.
    if (scanInProgressRef.current) return;
    if (!selectedCoursId) return;

    if (!isCourseScheduleConfigured) {
      setSensorState('error');
      setErrorMessage('Configurez d\'abord l\'heure de début et de fin du cours depuis Vue d\'ensemble.');
      setResult(null);
      return;
    }

    if (!isPointageWindowOpen) {
      setSensorState('error');
      setErrorMessage(ATTENDANCE_WINDOW_CLOSED_MESSAGE);
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

    let fingerprintId: string | null = null;

    try {
      // Je commence toujours par laisser le capteur produire l'identifiant d'empreinte source.
      const scanDetectedAt = new Date();
      const scannedFingerprintId = await scanFingerprintFromSensor({ mode: 'attendance' });
      fingerprintId = scannedFingerprintId;
      if (!pageActiveRef.current) {
        return;
      }
      setIsListening(false);
      setSensorState('loading');

      if (!isApiReady) {
        // En mode local, je tente un matching simple sur les étudiants déjà chargés dans la page.
        const matchedStudent = filteredStudents.find((student) =>
          hasFingerprintId(student.fingerprintTemplateIds ?? student.fingerprintTemplateId, scannedFingerprintId)
        );
        if (!matchedStudent) throw new Error('Empreinte non reconnue.');
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

      const scanResponse = await scanAttendanceForCours(scannedFingerprintId, selectedCoursId);
      if (!pageActiveRef.current) {
        return;
      }
      setScanFailureCount(0);
      const matchedStudent = filteredStudents.find(s => s.id === scanResponse.attendance.studentId);
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

      const selectedCourseEndTime = selectedCourse?.heureFin || courseSettings.endTime;
      // Une sortie avant l'heure de fin prévue ouvre une justification complémentaire.
      if (attendanceType === 'exit' && selectedCourseEndTime && checkOutTime && checkOutTime < selectedCourseEndTime) {
        setEarlyDeparturePending({
          attendanceId: scanResponse.attendance.id,
          studentId: scanResponse.attendance.studentId,
          studentName,
          photoUrl: scanResponse.attendance.photoUrl || resolveStudentPhoto(matchedStudent, studentName),
          checkOutTime,
        });
        setSelectedReason(null);
      }

      if (attendanceType === 'exit') speakGoodbye(studentName);
      else speakWelcome(studentName);
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
    // Le résultat visuel disparaît après un délai pour laisser la place au scan suivant.
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
    // En mode file automatique, je relance discrètement un scan dès que l'écran redevient idle.
    if (!autoQueueEnabled || !canScan || sensorState !== 'idle') return;
    const timeoutId = window.setTimeout(() => { handleScan(); }, 250);
    return () => { window.clearTimeout(timeoutId); };
  }, [autoQueueEnabled, sensorState, students, isApiReady, canScan]);

  useEffect(() => {
    // Après succès ou erreur, je réarme l'écran avec un cooldown différent selon le résultat.
    if (!autoQueueEnabled || (sensorState !== 'success' && sensorState !== 'error')) return;
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
    if (skipRetry) return;
    const timeoutId = window.setTimeout(() => {
      setSensorState('idle');
      setIsListening(canScan);
      if (sensorState === 'error') {
        setErrorMessage('');
      }
    }, sensorState === 'success' ? AUTO_QUEUE_SUCCESS_COOLDOWN_MS : AUTO_QUEUE_ERROR_COOLDOWN_MS);
    return () => { window.clearTimeout(timeoutId); };
  }, [autoQueueEnabled, sensorState, errorMessage, canScan, manualEntryOpen, scanFailureCount]);

  return (
    <div className="flex">
      <Sidebar />

      <main className="relative ml-64 min-h-screen flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef6ff_38%,#f8fafc_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:28px_28px] opacity-25" />
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl" />

        <div className="relative p-6 md:p-8">
          <div className="mx-auto max-w-3xl">
            {assignedCourseIds.length === 0 ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/90 px-5 py-4 text-center shadow-sm">
                <p className="text-sm font-semibold text-amber-800">Aucun cours assigné à votre compte</p>
                <p className="mt-1 text-sm text-amber-700">Contactez un administrateur pour recevoir au moins un cours avant d’utiliser le pointage biométrique.</p>
              </div>
            ) : (
              <section className="p-2 md:p-4">
                <div className="mb-6 w-full max-w-sm">
                  <Select value={selectedCoursId ? String(selectedCoursId) : 'none'} onValueChange={(value) => setSelectedCoursId(value === 'none' ? null : Number(value))}>
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white">
                      <SelectValue placeholder="Sélectionner un cours" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sélectionner un cours</SelectItem>
                      {assignedCourses.map((course) => (
                        <SelectItem key={course.id} value={String(course.id)}>{course.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
                  <div className="flex flex-col items-center gap-6 text-center lg:-ml-8">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Station biométrique</p>
                      <p className="text-xs text-slate-400 capitalize">{todayLabel}</p>
                    </div>

                    <div className="flex h-72 w-72 items-center justify-center rounded-full border-[10px] border-slate-200 bg-gradient-to-br from-white via-emerald-50 to-cyan-100 shadow-[0_24px_80px_-36px_rgba(16,185,129,0.35)] lg:-ml-10">
                      {sensorState === 'loading' ? (
                        <Loader2 className="h-28 w-28 animate-spin text-emerald-600" />
                      ) : sensorState === 'success' ? (
                        <CheckCircle2 className="h-28 w-28 text-emerald-600" />
                      ) : sensorState === 'error' ? (
                        <AlertTriangle className="h-28 w-28 text-rose-600" />
                      ) : (
                        <Fingerprint className={`h-28 w-28 ${
                          !selectedCoursId || connectionState !== 'connected'
                            ? 'text-slate-300'
                            : isListening
                            ? 'animate-pulse text-emerald-500'
                            : 'text-emerald-700'
                        }`} />
                      )}
                    </div>

                    <div className="max-w-sm space-y-2">
                      {sensorState === 'idle' && !isListening && connectionState !== 'connected' && (
                        <p className="text-base text-slate-500">Connectez le capteur biométrique pour démarrer le pointage.</p>
                      )}
                      {sensorState === 'idle' && !isListening && connectionState === 'connected' && selectedCoursId && !isCourseScheduleConfigured && (
                        <p className="text-base font-medium text-amber-700">Configurez d’abord l’horaire du cours depuis Vue d’ensemble.</p>
                      )}
                      {sensorState === 'idle' && !isListening && connectionState === 'connected' && selectedCoursId && isCourseScheduleConfigured && !isPointageWindowOpen && (
                        <p className="text-base font-medium text-amber-700">{ATTENDANCE_WINDOW_CLOSED_MESSAGE}</p>
                      )}
                      {sensorState === 'idle' && !isListening && canScan && (
                        <p className="text-base font-medium text-emerald-700">Posez votre doigt sur le capteur...</p>
                      )}
                      {sensorState === 'idle' && isListening && (
                        <p className="text-base font-medium text-emerald-700 animate-pulse">Posez votre doigt sur le capteur...</p>
                      )}
                      {sensorState === 'loading' && <p className="text-base font-medium text-emerald-700">Empreinte reconnue. Validation de la présence en cours...</p>}
                      {sensorState === 'error' && <p className="text-base font-medium text-rose-700">{errorMessage || 'Empreinte non reconnue.'}</p>}
                      {sensorState === 'success' && <p className="text-base font-medium text-emerald-700">Empreinte reconnue avec succès</p>}
                    </div>

                    <Button
                      onClick={handleScan}
                      disabled={sensorState === 'loading' || !canScan}
                      className="h-12 rounded-2xl bg-emerald-600 px-6 text-white hover:bg-emerald-700 disabled:opacity-40 lg:-ml-10"
                    >
                      <ScanSearch className="mr-2 h-4 w-4" />
                      {connectionState !== 'connected'
                        ? 'Capteur non connecté'
                        : !isCourseScheduleConfigured
                        ? 'Horaire non configuré'
                        : !isPointageWindowOpen
                        ? 'Pointage hors créneau'
                        : sensorState === 'loading'
                        ? 'Validation en cours...'
                        : 'Scanner la présence'}
                    </Button>

                    {connectionState === 'connected' && selectedCoursId && isCourseScheduleConfigured && (
                      <button
                        type="button"
                        onClick={() => setAutoQueueEnabled((current) => !current)}
                        className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline lg:-ml-10"
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

                  {result ? (
                    <div className={`w-full overflow-hidden rounded-[30px] border shadow-[0_28px_80px_-42px_rgba(15,23,42,0.4)] ${
                      result.attendanceType === 'exit' ? 'border-blue-200' : 'border-emerald-200'
                    }`}>
                      <div className={`h-2 w-full ${
                        result.attendanceType === 'exit'
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                      }`} />
                      <div className={`space-y-6 px-6 py-6 ${
                        result.attendanceType === 'exit'
                          ? 'bg-gradient-to-br from-blue-50 to-indigo-50'
                          : 'bg-gradient-to-br from-emerald-50 to-cyan-50'
                      }`}>
                        <div className="flex flex-col gap-5 rounded-[28px] bg-white/80 p-5 shadow-lg backdrop-blur-sm">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl ${
                              result.attendanceType === 'exit'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              <Fingerprint className="h-8 w-8" />
                            </div>
                            <div>
                              <p className={`text-2xl font-extrabold tracking-tight ${
                                result.attendanceType === 'exit' ? 'text-blue-800' : 'text-emerald-800'
                              }`}>
                                {result.attendanceType === 'exit' ? 'Au revoir' : 'Bienvenue'}
                              </p>
                            </div>
                          </div>

                          <img
                            src={result.photoUrl}
                            alt={`Photo de ${result.studentName}`}
                            className={`h-44 w-full rounded-[28px] border-4 object-cover shadow-lg ${
                              result.attendanceType === 'exit' ? 'border-blue-200' : 'border-emerald-200'
                            }`}
                          />

                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                result.attendanceType === 'exit'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                Pointé à {result.scannedAtLabel}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                {result.attendanceType === 'exit' ? 'Sortie enregistrée' : 'Entrée enregistrée'}
                              </span>
                            </div>
                            <p className="text-2xl font-semibold text-slate-800">{result.studentName}</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Matricule</p>
                                <p className="mt-1 font-semibold text-slate-800">{result.matricule}</p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Département</p>
                                <p className="mt-1 font-semibold text-slate-800">{result.department}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-2 text-center">
                          <p className="text-sm text-slate-500">
                          </p>
                          {autoQueueEnabled && (
                            <p className="text-xs text-slate-400">Le capteur se réarme automatiquement pour la personne suivante.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full min-h-[420px]" aria-hidden="true" />
                  )}
                </div>

                {sensorState === 'error' && autoQueueEnabled && (
                  <div className="mt-6 w-full rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-center">
                    <p className="text-xs font-medium text-rose-700">Nouvelle tentative automatique dans 3 secondes...</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      {/* ── Dialog départ anticipé ── */}
      <Dialog
        open={earlyDeparturePending !== null}
        onOpenChange={(open) => { if (!open) handleConfirmDeparture(null); }}
      >
        <DialogContent className="max-w-sm overflow-hidden rounded-2xl border border-blue-200 bg-white p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-6 pt-6 pb-4 text-center text-white">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
              <LogOut className="h-7 w-7" />
            </div>
            <DialogTitle className="text-lg font-bold">Départ anticipé détecté</DialogTitle>
            <p className="mt-1 text-sm text-white/90">
              {earlyDeparturePending?.studentName} quitte avant
              {(selectedCourse?.heureFin || courseSettings.endTime) ? ` ${selectedCourse?.heureFin || courseSettings.endTime}` : ' la fin du cours'}.
            </p>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Motif du départ</p>
            {([
              { value: 'maladie' as DepartureReason, label: 'Maladie', icon: HeartPulse },
              { value: 'urgence-familiale' as DepartureReason, label: 'Urgence familiale', icon: Users },
              { value: 'urgence-travail' as DepartureReason, label: 'Urgence au travail', icon: BriefcaseBusiness },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedReason(opt.value)}
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                  selectedReason === opt.value
                    ? 'border-blue-400 bg-blue-50 text-blue-900 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50/60'
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  selectedReason === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500'
                }`}>
                  <opt.icon className="h-5 w-5" />
                </span>
                {opt.label}
              </button>
            ))}
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => handleConfirmDeparture(selectedReason)}
                disabled={selectedReason === null}
                className="flex-1 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Confirmer le motif
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfirmDeparture(null)}
                className="flex-1 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Marquer absent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <label htmlFor="teacher-manual-matricule" className="text-sm font-medium text-slate-700">
                Matricule de l'étudiant
              </label>
              <Input
                id="teacher-manual-matricule"
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
