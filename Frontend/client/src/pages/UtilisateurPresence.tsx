import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Fingerprint, Loader2, LogOut, ScanSearch, PencilLine } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadCourseSettings, saveDepartureException, type Cours, type CourseSettings, type DepartureReason, type Student } from '@/lib/adminData';
import { createManualAttendance, fetchCours, fetchStudents, scanAttendanceForCours } from '@/lib/adminApi';
import { notifyRejectedFingerprintScan, scanFingerprintFromSensor } from '@/lib/biometricSensor';
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

const RESULT_DISPLAY_DURATION_MS = 2 * 60 * 1000;
const AUTO_QUEUE_SUCCESS_COOLDOWN_MS = 1200;
const AUTO_QUEUE_ERROR_COOLDOWN_MS = 3200;
const TEACHER_SELECTED_COURSE_KEY = 'biopresence_teacher_selected_course';

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

function speakWelcome(fullName: string): void {
  const firstName = fullName.split(' ')[0];
  speakText(`Bienvenue, ${firstName}`);
}

function speakGoodbye(fullName: string): void {
  const firstName = fullName.split(' ')[0];
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
  return 'Empreinte non reconnue.';
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
  const scanInProgressRef = useRef(false);
  const resultTimeoutRef = useRef<number | null>(null);
  const pageActiveRef = useRef(true);
  const selectedCourse = assignedCourses.find((course) => course.id === selectedCoursId) ?? null;
  const filteredStudents = useMemo(() => {
    if (selectedCoursId == null) {
      return [];
    }

    return students.filter((student) => {
      if (student.coursIds && student.coursIds.length > 0) {
        return student.coursIds.includes(selectedCoursId);
      }

      return student.coursId === selectedCoursId;
    });
  }, [students, selectedCoursId]);

  // Départ anticipé
  const [earlyDeparturePending, setEarlyDeparturePending] = useState<{
    attendanceId: string;
    studentId: string;
    studentName: string;
    photoUrl: string;
    checkOutTime: string;
  } | null>(null);
  const [selectedReason, setSelectedReason] = useState<DepartureReason | null>(null);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  const handleConfirmDeparture = (reason: DepartureReason | null) => {
    // Une sortie anticipée crée une exception locale qui sera visible dans les contrôles ultérieurs.
    if (!earlyDeparturePending) return;
    saveDepartureException({
      attendanceId: earlyDeparturePending.attendanceId,
      studentId: earlyDeparturePending.studentId,
      studentName: earlyDeparturePending.studentName,
      reason,
      status: reason ? 'justified' : 'absent',
      recordedAt: new Date().toISOString(),
    });
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

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date()),
    [sensorState, result]
  );

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

  useEffect(() => {
    // L'hydratation charge uniquement les cours réellement affectés à l'enseignant connecté.
    let mounted = true;
    const hydrate = async () => {
      try {
        const [apiStudents, apiCours] = await Promise.all([fetchStudents(), fetchCours()]);
        if (!mounted) return;
        setStudents(apiStudents);
        setAssignedCourses(apiCours.filter((course) => assignedCourseIds.includes(course.id)));
        setIsApiReady(true);
      } catch {
        if (!mounted) return;
        setIsApiReady(false);
      }
    };
    hydrate();
    return () => { mounted = false; };
  }, [user?.id]);

  const handleScan = async () => {
    // Un seul scan à la fois pour éviter les doublons et les collisions de réponse capteur.
    if (scanInProgressRef.current) return;
    if (!selectedCoursId) return;

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
        const matchedStudent = filteredStudents.find(s => hasFingerprintId(s.fingerprintTemplateId, scannedFingerprintId));
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
      const matchedStudent = filteredStudents.find(s => s.id === scanResponse.attendance.studentId);
      const studentName = matchedStudent ? formatStudentFullName(matchedStudent) : scanResponse.attendance.studentName;
      const attendanceType: 'entry' | 'exit' = scanResponse.attendance.checkOut ? 'exit' : 'entry';
      const checkOutTime = scanResponse.attendance.checkOut ?? '';

      setResult({
        studentName,
        matricule: scanResponse.attendance.matricule,
        department: scanResponse.attendance.department,
        photoUrl: resolveStudentPhoto(matchedStudent, studentName),
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
          photoUrl: resolveStudentPhoto(matchedStudent, studentName),
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
      setErrorMessage(normalizeErrorMessage(error));
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
    if (!autoQueueEnabled || connectionState !== 'connected' || sensorState !== 'idle') return;
    const timeoutId = window.setTimeout(() => { handleScan(); }, 250);
    return () => { window.clearTimeout(timeoutId); };
  }, [autoQueueEnabled, sensorState, students, isApiReady, connectionState]);

  useEffect(() => {
    // Après succès ou erreur, je réarme l'écran avec un cooldown différent selon le résultat.
    if (!autoQueueEnabled || (sensorState !== 'success' && sensorState !== 'error')) return;
    const normalizedError = errorMessage.toLowerCase();
    const skipRetry =
      sensorState === 'error' &&
      (normalizedError.includes('aucune empreinte') || normalizedError.includes('annul') || normalizedError.includes('cancel'));
    if (skipRetry) return;
    const timeoutId = window.setTimeout(() => {
      setSensorState('idle');
      setIsListening(false);
      if (sensorState === 'error') {
        setErrorMessage('');
      }
    }, sensorState === 'success' ? AUTO_QUEUE_SUCCESS_COOLDOWN_MS : AUTO_QUEUE_ERROR_COOLDOWN_MS);
    return () => { window.clearTimeout(timeoutId); };
  }, [autoQueueEnabled, sensorState, errorMessage]);

  const handleManualAttendance = async () => {
    if (!selectedCoursId || !manualStudentId) {
      return;
    }

    setManualSaving(true);
    try {
      await createManualAttendance({
        studentId: manualStudentId,
        coursId: selectedCoursId,
        checkIn: manualCheckIn || undefined,
        checkOut: manualCheckOut || undefined,
      });
      setManualStudentId('');
      setManualCheckIn('');
      setManualCheckOut('');
      setSensorState('success');
      setResult(null);
      setErrorMessage('');
    } catch (error) {
      setSensorState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de saisir la présence manuellement.');
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div className="flex">
      <Sidebar />

      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        <div className="p-8">
          <div className="mx-auto max-w-4xl">
            <div className={`mx-auto w-full space-y-6 ${result ? 'max-w-5xl' : 'max-w-md'}`}>

            {/* Date du jour */}
            <p className="text-center text-xs text-slate-400 capitalize">{todayLabel}</p>

            {/* Bannière cours du professeur */}
            {assignedCourseIds.length === 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-sm font-medium text-amber-800">Aucun cours assigné</p>
                <p className="mt-0.5 text-xs text-amber-600">Contactez un administrateur pour vous assigner un cours.</p>
              </div>
            )}

            {assignedCourseIds.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="grid gap-3 md:grid-cols-[1.2fr_1fr] md:items-end">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cours de pointage</p>
                    <Select value={selectedCoursId ? String(selectedCoursId) : 'none'} onValueChange={(value) => setSelectedCoursId(value === 'none' ? null : Number(value))}>
                      <SelectTrigger className="w-full">
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
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-700">Horaire du cours</p>
                    <p className="mt-1">{selectedCourse?.heureDebut || '--:--'} à {selectedCourse?.heureFin || '--:--'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bannière état capteur */}
            {connectionState !== 'connected' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-sm font-medium text-amber-800">Capteur non connecté</p>
                <p className="mt-0.5 text-xs text-amber-600">
                  Connectez le capteur depuis le menu <strong>Étudiants</strong> pour activer le scan.
                </p>
              </div>
            )}
            {connectionState === 'connected' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <p className="text-xs font-medium text-emerald-700">Capteur connecté via MQTT · Prêt à scanner</p>
              </div>
            )}

            {/* ── Widget scan empreinte ── */}
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={handleScan}
                disabled={sensorState === 'loading' || connectionState !== 'connected' || !selectedCoursId}
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
                    connectionState !== 'connected' || !selectedCoursId ? 'text-slate-300' :
                    isListening ? 'animate-pulse text-emerald-500' : 'text-emerald-700'
                  }`} />
                )}
              </button>

              <div className="text-center">
                {sensorState === 'idle' && !isListening && connectionState !== 'connected' && (
                  <p className="text-base text-slate-400">Connectez le capteur pour scanner</p>
                )}
                {sensorState === 'idle' && !isListening && connectionState === 'connected' && selectedCoursId && (
                  <p className="text-base text-slate-700">En attente du doigt sur le capteur</p>
                )}
                {sensorState === 'idle' && isListening && (
                  <p className="text-base font-medium text-emerald-700 animate-pulse">Posez votre doigt sur le capteur...</p>
                )}
                {sensorState === 'loading' && <p className="text-base font-medium text-emerald-700">Scannage en cours...</p>}
                {sensorState === 'error' && <p className="text-base font-medium text-rose-700">{errorMessage || 'Empreinte non reconnue.'}</p>}
                {sensorState === 'success' && <p className="text-base font-medium text-emerald-700">Empreinte reconnue avec succès</p>}
              </div>

              <Button
                onClick={handleScan}
                disabled={sensorState === 'loading' || connectionState !== 'connected' || !selectedCoursId}
                className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <ScanSearch className="mr-2 h-4 w-4" />
                {!selectedCoursId ? 'Sélectionnez un cours' : connectionState !== 'connected' ? 'Capteur non connecté' : sensorState === 'loading' ? 'Scan en cours...' : 'Scanner maintenant'}
              </Button>

              {connectionState === 'connected' && selectedCoursId && (
                <button
                  type="button"
                  onClick={() => setAutoQueueEnabled((current) => !current)}
                  className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  {autoQueueEnabled ? 'Mode file actif (auto-scan après chaque résultat)' : 'Activer le mode file automatique'}
                </button>
              )}
            </div>

            {/* Carte résultat */}
            {result && (
              <div className={`rounded-3xl border shadow-xl overflow-hidden ${
                result.attendanceType === 'exit' ? 'border-blue-200' : 'border-emerald-200'
              }`}>
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
                      Profil affiché pendant 2 minutes ou jusqu’au prochain pointage.
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

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <PencilLine className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">Saisie manuelle</h2>
              </div>
              <div className="space-y-3">
                <Select value={manualStudentId || 'none'} onValueChange={(value) => setManualStudentId(value === 'none' ? '' : value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un étudiant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sélectionner un étudiant</SelectItem>
                    {filteredStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>{formatStudentFullName(student)} - {student.matricule}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="time" value={manualCheckIn} onChange={(event) => setManualCheckIn(event.target.value)} placeholder="Entrée" />
                  <Input type="time" value={manualCheckOut} onChange={(event) => setManualCheckOut(event.target.value)} placeholder="Sortie" />
                </div>
                <Button onClick={handleManualAttendance} disabled={!manualStudentId || manualSaving || !selectedCoursId} className="w-full bg-blue-600 hover:bg-blue-700">
                  {manualSaving ? 'Enregistrement...' : 'Saisir une présence manuelle'}
                </Button>
              </div>
            </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Dialog départ anticipé ── */}
      <Dialog
        open={earlyDeparturePending !== null}
        onOpenChange={(open) => { if (!open) handleConfirmDeparture(null); }}
      >
        <DialogContent className="max-w-sm rounded-2xl border border-amber-200 bg-white p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-6 pt-6 pb-4 text-white text-center">
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
              { value: 'maladie' as DepartureReason, label: 'Maladie', icon: '🏥' },
              { value: 'urgence-familiale' as DepartureReason, label: 'Urgence familiale', icon: '👨‍👩‍👧' },
              { value: 'urgence-travail' as DepartureReason, label: 'Urgence au travail', icon: '💼' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedReason(opt.value)}
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                  selectedReason === opt.value
                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => handleConfirmDeparture(selectedReason)}
                disabled={selectedReason === null}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl disabled:opacity-40"
              >
                Confirmer le motif
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfirmDeparture(null)}
                className="flex-1 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Marquer absent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
