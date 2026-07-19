import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Download, FileCheck2, Fingerprint, ImagePlus, Loader2, LogOut, Pencil, Plus, Search, Trash2, Unplug, Usb, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';
import { addPdfUsbLogo } from '@/lib/pdf';
import {
  loadAttendanceRecords,
  loadCourseSettings,
  loadExportsCount,
  loadStudents,
  saveAttendanceRecords,
  saveCourseSettings,
  saveExportsCount,
  saveStudents,
  type AttendanceRecord,
  type CourseSettings,
  type Promotion,
  type Student,
} from '@/lib/adminData';
import {
  fetchCours,
  createStudent as createStudentApi,
  deleteStudent as deleteStudentApi,
  fetchAttendanceToday,
  fetchCourseSettings,
  fetchPromotions,
  fetchStudents,
  releaseFingerprintEnrollment,
  resetAttendanceRecordsApi,
  reserveFingerprintEnrollment,
  scanAttendance,
  updateFingerprintMetadata,
  updateStudent as updateStudentApi,
} from '@/lib/adminApi';
import { enrollFingerprintFromSensor, getBiometricErrorMessage, notifyRejectedFingerprintScan, scanFingerprintFromSensor } from '@/lib/biometricSensor';
import { serialSensor, type ConnectionState, type SensorProgressEvent } from '@/lib/serialSensor';
import { appendFingerprintId, createUuid, hasFingerprintId, parseFingerprintIds } from '@/lib/utils';

/**
 * Interface Administrateur - Gestion des utilisateurs
 * Design: Modern Enterprise avec accent biométrique
 */

function formatAttendanceDate(date: Date) {
  return new Intl.DateTimeFormat('sv-SE').format(date);
}

function formatDisplayDateTime(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatStudentFullName(student: Pick<Student, 'name' | 'postNom' | 'prenom'>) {
  return [student.name, student.postNom, student.prenom]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
}

function getStudentInitials(student: Pick<Student, 'name' | 'postNom' | 'prenom'>) {
  return formatStudentFullName(student)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function parseTimeToMinutes(value?: string) {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function resolveStudentFiliere(student: Student | undefined, promotions: Promotion[]): string {
  if (!student) {
    return 'Non définie';
  }

  if (student?.promotionId != null) {
    const promotion = promotions.find((item) => item.id === student.promotionId);
    if (promotion?.programme && promotion.programme.trim().length > 0) {
      return promotion.programme;
    }
  }

  if (student.level && student.level.trim().length > 0) {
    const promotionByLevel = promotions.find(
      (item) => item.niveau?.trim().toLowerCase() === student.level.trim().toLowerCase()
    );
    if (promotionByLevel?.programme && promotionByLevel.programme.trim().length > 0) {
      return promotionByLevel.programme;
    }
  }

  return 'Non définie';
}

function resolveStudentPromotion(student: Student | undefined, promotions: Promotion[]): string {
  if (!student) {
    return 'Non définie';
  }

  if (student.promotionId != null) {
    const promotion = promotions.find((item) => item.id === student.promotionId);
    if (promotion?.niveau && promotion.niveau.trim().length > 0) {
      return promotion.niveau;
    }
  }

  return student.level?.trim().length ? student.level : 'Non définie';
}

export default function AdminUsers() {
  type ScanDialogStep = 'idle' | 'prompt' | 'loading' | 'success' | 'error';
  type ScanDialogMode = 'attendance' | 'enrollment';
  type ScanProgressState = {
    sensorReady: boolean;
    fingerPlaced: boolean;
    confirmed: boolean;
    message: string;
  };

  const defaultProgressMessage = 'Placez votre doigt pour scanner.';
  const scanFeedbackDelayMs = 1400;
  const initialScanProgress = (): ScanProgressState => ({
    sensorReady: false,
    fingerPlaced: false,
    confirmed: false,
    message: defaultProgressMessage,
  });
  const waitForScanFeedback = () => new Promise((resolve) => window.setTimeout(resolve, scanFeedbackDelayMs));

  const applySensorProgressEvent = (
    current: ScanProgressState,
    event: SensorProgressEvent,
    mode: ScanDialogMode
  ): ScanProgressState => {
    const fallbackErrorMessage =
      mode === 'enrollment'
        ? 'L\'enrôlement de l\'empreinte a été interrompu.'
        : 'La lecture de l\'empreinte a été interrompue.';

    // Je traduis ici les événements bas niveau du capteur en messages d'interface compréhensibles.
    switch (event.event) {
      case 'ACK':
        return {
          ...current,
          sensorReady: true,
          message: mode === 'enrollment'
            ? 'Placez votre doigt pour scanner'
            : event.message || 'Commande reçue par le capteur. Initialisation en cours...',
        };
      case 'READY':
        return {
          ...current,
          sensorReady: true,
          message: event.message || 'Capteur prêt. Placez votre doigt sur le lecteur.',
        };
      case 'FINGER_PLACED':
        return {
          ...current,
          sensorReady: true,
          fingerPlaced: true,
          message: mode === 'enrollment'
            ? 'Extraction de l\'image de l\'empreinte'
            : 'Doigt détecté. Image capturée, vérification en cours. Vous pouvez retirer le doigt.',
        };
      case 'IMAGE_CAPTURED':
        return {
          ...current,
          sensorReady: true,
          fingerPlaced: true,
          message: 'Image d\'empreinte capturée avec succès. Retirez puis replacez le doigt pour confirmer le template.',
        };
      case 'MATCH':
        return {
          ...current,
          sensorReady: true,
          fingerPlaced: true,
          confirmed: true,
          message: 'Empreinte reconnue. Validation de la présence en cours...',
        };
      case 'ENROLLED':
        return {
          ...current,
          sensorReady: true,
          fingerPlaced: true,
          confirmed: true,
          message: 'Template biométrique validé. L\'empreinte pourra être reconnue lors du pointage de présence.',
        };
      case 'NO_MATCH':
        return {
          ...current,
          sensorReady: true,
          fingerPlaced: true,
          message: 'Aucune empreinte correspondante n\'a été trouvée.',
        };
      case 'ERROR':
      case 'CANCELLED':
        return {
          ...current,
          message: event.message ? getBiometricErrorMessage(event.message) : fallbackErrorMessage,
        };
      default:
        return current;
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => loadAttendanceRecords());
  const [exportsCount, setExportsCount] = useState<number>(() => loadExportsCount());
  const [isSensorBusy, setIsSensorBusy] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanDialogStep, setScanDialogStep] = useState<ScanDialogStep>('idle');
  const [scanDialogMode, setScanDialogMode] = useState<ScanDialogMode>('attendance');
  const [scanProgress, setScanProgress] = useState<ScanProgressState>(() => initialScanProgress());
  const [pendingFingerprintId, setPendingFingerprintId] = useState('');
  const [pendingFingerprintDoigt, setPendingFingerprintDoigt] = useState<'POUCE_DROIT' | 'INDEX_DROIT' | 'MAJEUR_DROIT' | 'ANNULAIRE_DROIT' | 'AURICULAIRE_DROIT' | 'POUCE_GAUCHE' | 'INDEX_GAUCHE' | 'MAJEUR_GAUCHE' | 'ANNULAIRE_GAUCHE' | 'AURICULAIRE_GAUCHE'>('INDEX_DROIT');
  const [courseSettings, setCourseSettings] = useState<CourseSettings>(() => loadCourseSettings());
  const [reportCoursId, setReportCoursId] = useState<number | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => serialSensor.state);
  const [cours, setCours] = useState<{ id: number; nom: string; departementId?: number | null; programmeId?: number | null }[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const serialSupportError = serialSensor.getSupportError();

  // L'état du capteur et sa progression sont suivis en direct pour guider l'enrôlement et le pointage.
  useEffect(() => serialSensor.onConnectionChange(setConnectionState), []);
  useEffect(
    () =>
      serialSensor.onProgress((event) => {
        setScanProgress((current) => applySensorProgressEvent(current, event, scanDialogMode));
        if (event.event === 'FINGER_PLACED') {
          setScanDialogStep('loading');
        }
        if (event.event === 'IMAGE_CAPTURED' && scanDialogMode === 'enrollment') {
          toast.success('Image d\'empreinte capturée avec succès. Retirez puis replacez le doigt pour finaliser l\'enrôlement.');
        }
        if (event.event === 'MATCH' || event.event === 'ENROLLED') {
          setScanDialogStep('success');
        }
        if (event.event === 'ERROR' || event.event === 'CANCELLED') {
          setScanDialogStep('error');
        }
      }),
    [scanDialogMode]
  );
  const [studentForm, setStudentForm] = useState({
    name: '',
    postNom: '',
    prenom: '',
    matricule: '',
    dateNaissance: '',
    lieuNaissance: '',
    adresse: '',
    telephone: '',
    department: '',
    level: '',
    status: 'ACTIF' as 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU',
    coursId: '',
    promotionId: '',
    creditCoursIds: [] as string[],
    photoUrl: '',
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [savingStudentEdit, setSavingStudentEdit] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({
    name: '',
    postNom: '',
    prenom: '',
    matricule: '',
    dateNaissance: '',
    lieuNaissance: '',
    adresse: '',
    telephone: '',
    department: '',
    level: '',
    status: 'ACTIF' as 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU',
    coursId: '',
    promotionId: '',
    creditCoursIds: [] as string[],
    photoUrl: '',
  });
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const initialStudentFormState = {
    name: '',
    postNom: '',
    prenom: '',
    matricule: '',
    dateNaissance: '',
    lieuNaissance: '',
    adresse: '',
    telephone: '',
    department: '',
    level: '',
    status: 'ACTIF' as 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU',
    coursId: '',
    promotionId: '',
    creditCoursIds: [] as string[],
    photoUrl: '',
  };

  const isStudentIdentityStepEnabled = Boolean(pendingFingerprintId);

  const resetStudentRegistrationForm = () => {
    setPendingFingerprintId('');
    setPendingFingerprintDoigt('INDEX_DROIT');
    setStudentForm(initialStudentFormState);
    setPhotoPreview(null);
  };

  const releasePendingFingerprintReservation = async (fingerprintId?: string) => {
    if (!isApiReady || !fingerprintId) {
      return;
    }

    try {
      await releaseFingerprintEnrollment(fingerprintId);
    } catch {
      // Une réservation orpheline ne doit pas bloquer l'interface d'enrôlement.
    }
  };

  const handlePhotoFile = (file: File | undefined) => {
    // La photo est compressée côté navigateur pour éviter de stocker un payload inutilement lourd.
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La photo dépasse 2 Mo. Veuillez choisir une image de 2 Mo ou moins.');
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      URL.revokeObjectURL(objectUrl);
      setPhotoPreview(dataUrl);
      setStudentForm((current) => ({ ...current, photoUrl: dataUrl }));
    };
    img.src = objectUrl;
  };

  const handleEditPhotoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La photo dépasse 2 Mo. Veuillez choisir une image de 2 Mo ou moins.');
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      URL.revokeObjectURL(objectUrl);
      setEditPhotoPreview(dataUrl);
      setEditStudentForm((current) => ({ ...current, photoUrl: dataUrl }));
    };
    img.src = objectUrl;
  };

  useEffect(() => {
    // Les sauvegardes locales maintiennent le mode dégradé opérationnel même sans API Java.
    saveStudents(students);
  }, [students]);

  useEffect(() => {
    saveAttendanceRecords(attendanceRecords);
  }, [attendanceRecords]);

  useEffect(() => {
    saveExportsCount(exportsCount);
  }, [exportsCount]);

  useEffect(() => {
    saveCourseSettings(courseSettings);
  }, [courseSettings]);

  useEffect(() => {
    // Au démarrage, je tente d'hydrater la page depuis l'API puis je retombe sur le mode local si besoin.
    let mounted = true;

    const hydrateFromApi = async () => {
      try {
        const [apiStudents, apiAttendanceToday, apiCourseSettings, apiCours, apiPromotions] = await Promise.all([
          fetchStudents(),
          fetchAttendanceToday(),
          fetchCourseSettings(),
          fetchCours(),
          fetchPromotions(),
        ]);

        if (!mounted) {
          return;
        }

        setStudents(apiStudents);
        setAttendanceRecords(apiAttendanceToday);
        setCourseSettings(apiCourseSettings);
        setCours(apiCours.map((item) => ({ id: item.id, nom: item.nom, departementId: item.departementId, programmeId: item.programmeId })));
        setPromotions(apiPromotions);
        setIsApiReady(true);
      } catch {
        if (!mounted) {
          return;
        }

        setIsApiReady(false);
        toast.warning('impossible de charger les données');
      }
    };

    hydrateFromApi();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.postNom ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.prenom ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const today = formatAttendanceDate(new Date());
  const todayLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date());
  const attendanceToday = attendanceRecords.filter((record) => record.date === today);
  const isCourseConfigured =
    courseSettings.courseName.trim().length > 0 &&
    courseSettings.courseDays > 0 &&
    courseSettings.courseHours > 0;
  const recordedCourseDays = Array.from(new Set(attendanceRecords.map((record) => record.date))).length;
  const isCourseCompleted = isCourseConfigured && recordedCourseDays >= courseSettings.courseDays;
  const eligibilityThreshold = 75;
  const selectedPromotion = promotions.find((item) => String(item.id) === studentForm.promotionId);
  const promotionCourseIds = new Set(selectedPromotion?.coursIds ?? []);
  const creditCourseOptions = cours.filter((item) => {
    if (!selectedPromotion) {
      return false;
    }

    if (promotionCourseIds.has(item.id)) {
      return false;
    }

    return true;
  });
  const selectedEditPromotion = promotions.find((item) => String(item.id) === editStudentForm.promotionId);
  const editPromotionCourseIds = new Set(selectedEditPromotion?.coursIds ?? []);
  const editCreditCourseOptions = cours.filter((item) => {
    if (!selectedEditPromotion) {
      return false;
    }

    if (editPromotionCourseIds.has(item.id)) {
      return false;
    }

    return true;
  });

  useEffect(() => {
    // Le choix d'une promotion préremplit automatiquement le département, le niveau et les cours principaux.
    if (!selectedPromotion) {
      return;
    }

    setStudentForm((current) => ({
      ...current,
      department: selectedPromotion.departement,
      level: selectedPromotion.niveau,
      coursId: selectedPromotion.coursIds[0] ? String(selectedPromotion.coursIds[0]) : '',
      creditCoursIds: current.creditCoursIds.filter((value) => !selectedPromotion.coursIds.includes(Number(value))),
    }));
  }, [selectedPromotion]);

  useEffect(() => {
    if (!selectedEditPromotion) {
      return;
    }

    setEditStudentForm((current) => ({
      ...current,
      department: selectedEditPromotion.departement,
      level: selectedEditPromotion.niveau,
      coursId: selectedEditPromotion.coursIds[0] ? String(selectedEditPromotion.coursIds[0]) : '',
      creditCoursIds: current.creditCoursIds.filter((value) => !selectedEditPromotion.coursIds.includes(Number(value))),
    }));
  }, [selectedEditPromotion]);

  const studentEligibilityRows = students
    .map((student) => {
      const attendedDays = new Set(
        attendanceRecords
          .filter((record) => record.studentId === student.id)
          .map((record) => record.date)
      ).size;

      const attendancePercentage = isCourseConfigured
        ? Math.min(100, (attendedDays / courseSettings.courseDays) * 100)
        : 0;

      const isEligible = attendancePercentage >= eligibilityThreshold;

      return {
        student,
        attendedDays,
        attendancePercentage,
        isEligible,
      };
    })
    .sort((a, b) => a.student.name.localeCompare(b.student.name, 'fr'));

  const sortedAttendanceRecords = [...attendanceRecords].sort((left, right) => {
    const leftStudent = students.find((item) => item.id === left.studentId || item.matricule.trim().toUpperCase() === left.matricule.trim().toUpperCase());
    const rightStudent = students.find((item) => item.id === right.studentId || item.matricule.trim().toUpperCase() === right.matricule.trim().toUpperCase());
    const leftName = formatStudentFullName(leftStudent ?? { name: left.studentName, postNom: '', prenom: '' });
    const rightName = formatStudentFullName(rightStudent ?? { name: right.studentName, postNom: '', prenom: '' });
    return leftName.localeCompare(rightName, 'fr');
  });

  useEffect(() => {
    if (cours.length === 0) {
      return;
    }

    if (reportCoursId != null && cours.some((item) => item.id === reportCoursId)) {
      return;
    }

    if (courseSettings.coursId != null && cours.some((item) => item.id === courseSettings.coursId)) {
      setReportCoursId(courseSettings.coursId);
      return;
    }

    setReportCoursId(cours[0]?.id ?? null);
  }, [cours, courseSettings.coursId, reportCoursId]);

  const handleCreateStudent = async () => {
    if (!isApiReady) {
      toast.error('La création d\'étudiant nécessite une connexion active au backend.');
      return;
    }

    if (!pendingFingerprintId) {
      toast.error('Scannez d\'abord l\'empreinte avant de créer l\'étudiant.');
      return;
    }

    if (!studentForm.name || !studentForm.matricule || !studentForm.promotionId) {
      toast.error('Renseignez tous les champs étudiant avant enregistrement.');
      return;
    }

    const matriculeAlreadyUsed = students.some(
      (student) => student.matricule.toLowerCase() === studentForm.matricule.toLowerCase()
    );

    if (matriculeAlreadyUsed) {
      toast.error('Ce matricule existe déjà.');
      return;
    }

    try {
      const created = await createStudentApi({
        name: studentForm.name,
        postNom: studentForm.postNom || undefined,
        prenom: studentForm.prenom || undefined,
        matricule: studentForm.matricule,
        dateNaissance: studentForm.dateNaissance || undefined,
        lieuNaissance: studentForm.lieuNaissance || undefined,
        adresse: studentForm.adresse || undefined,
        telephone: studentForm.telephone || undefined,
        department: studentForm.department,
        level: studentForm.level,
        status: studentForm.status,
        coursId: studentForm.coursId ? Number(studentForm.coursId) : null,
        promotionId: Number(studentForm.promotionId),
        creditCoursIds: studentForm.creditCoursIds.map(Number),
        photoUrl: studentForm.photoUrl.trim() || undefined,
        fingerprintTemplateIds: [pendingFingerprintId],
        fingerprintTemplateId: pendingFingerprintId,
        fingerprintCount: 1,
      });
      setStudents((currentStudents) => [created, ...currentStudents]);
      resetStudentRegistrationForm();
      toast.success('Étudiant enregistré Avec Succès avec empreinte biométrique.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de créer l\'étudiant.');
    }
  };

  const handlePrepareFingerprintForRegistration = async () => {
    if (!isApiReady) {
      toast.error('L\'enrôlement nécessite une connexion active au backend.');
      return;
    }

    if (isSensorBusy) {
      return;
    }

    setIsSensorBusy(true);
    setScanDialogMode('enrollment');
    setScanDialogOpen(true);
    setScanDialogStep('prompt');
    setScanProgress(initialScanProgress());

    try {
      // Le capteur ne résout la promesse qu'après avoir terminé la lecture utile.
      const enrollment = await enrollFingerprintFromSensor();
      const fingerprintId = enrollment.fingerprintId;

      const fingerprintAlreadyUsed = students.some((student) => hasFingerprintId(student.fingerprintTemplateId, fingerprintId));
      if (fingerprintAlreadyUsed) {
        throw new Error('Cette empreinte est déjà associée à un autre étudiant.');
      }

      if (pendingFingerprintId && pendingFingerprintId !== fingerprintId) {
        await releasePendingFingerprintReservation(pendingFingerprintId);
      }

      const reservation = await reserveFingerprintEnrollment(
        fingerprintId,
        enrollment.fingerprintTemplateBase64,
        pendingFingerprintDoigt
      );
      setPendingFingerprintId(reservation.fingerprintTemplateId);
      setScanDialogStep('success');
      setScanProgress((current) => ({
        ...current,
        confirmed: true,
        message: reservation.message,
      }));
      toast.success('Empreinte capturée');
      await waitForScanFeedback();
    } catch (error) {
      toast.error(getBiometricErrorMessage(error));
    } finally {
      setScanDialogOpen(false);
      setScanDialogStep('idle');
      setScanDialogMode('attendance');
      setScanProgress(initialScanProgress());
      setIsSensorBusy(false);
    }
  };

  const handleClearPendingFingerprint = async () => {
    await releasePendingFingerprintReservation(pendingFingerprintId);
    setPendingFingerprintId('');
    toast.success('Empreinte capturée supprimée. Vous pouvez relancer un nouvel enrôlement.');
  };

  const markAttendanceForStudent = (student: Student) => {
    const now = new Date();
    const scanDate = formatAttendanceDate(now);
    const scanTime = formatTime(now);

    setStudents((currentStudents) =>
      currentStudents.map((item) =>
        item.id === student.id
          ? {
              ...item,
              lastFingerprintScan: formatDisplayDateTime(now),
            }
          : item
      )
    );

    const recordsForDay = attendanceRecords.filter(
      (record) => record.studentId === student.id && record.date === scanDate
    );

    const existingOpenRecord = recordsForDay.find((record) => !record.checkOut);
    if (existingOpenRecord) {
      setAttendanceRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === existingOpenRecord.id
            ? {
                ...record,
                checkOut: scanTime,
                status: 'Clôturé',
              }
            : record
        )
      );
      toast.success(`Sortie enregistrée pour ${student.name} à ${scanTime}.`);
      return;
    }

    const hasClosedRecordForDay = recordsForDay.some((record) => Boolean(record.checkOut));
    if (hasClosedRecordForDay) {
      toast.error(`${student.name} a déjà pointé une entrée et une sortie aujourd'hui.`);
      return;
    }

    const newRecord: AttendanceRecord = {
      id: createUuid(),
      studentId: student.id,
      studentName: student.name,
      matricule: student.matricule,
      department: student.department,
      date: scanDate,
      checkIn: scanTime,
      status: 'Ouvert',
    };

    setAttendanceRecords((currentRecords) => [newRecord, ...currentRecords]);
    toast.success(`Entrée enregistrée pour ${student.name} à ${scanTime}.`);
  };

  const handleDeleteStudent = async (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;
    if (!window.confirm(`Supprimer l'étudiant "${student.name}" ? Cette action est irréversible.`)) return;

    if (isApiReady) {
      try {
        await deleteStudentApi(studentId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Impossible de supprimer l’étudiant.');
        return;
      }
    }

    setStudents((currentStudents) => currentStudents.filter((item) => item.id !== studentId));
    setAttendanceRecords((currentRecords) => currentRecords.filter((r) => r.studentId !== studentId));
    toast.success(`Étudiant "${student.name}" supprimé.`);
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudentId(student.id);
    setEditStudentForm({
      name: student.name,
      postNom: student.postNom ?? '',
      prenom: student.prenom ?? '',
      matricule: student.matricule,
      dateNaissance: student.dateNaissance ?? '',
      lieuNaissance: student.lieuNaissance ?? '',
      adresse: student.adresse ?? '',
      telephone: student.telephone ?? '',
      department: student.department,
      level: student.level,
      status: student.academicStatus ?? 'ACTIF',
      coursId: student.coursId != null ? String(student.coursId) : '',
      promotionId: student.promotionId != null ? String(student.promotionId) : '',
      creditCoursIds: (student.creditCoursIds ?? []).map(String),
      photoUrl: student.photoUrl ?? '',
    });
    setEditPhotoPreview(student.photoUrl ?? null);
    setEditDialogOpen(true);
  };

  const handleUpdateStudentProfile = async () => {
    if (!editingStudentId) {
      return;
    }

    if (!editStudentForm.name || !editStudentForm.matricule || !editStudentForm.promotionId) {
      toast.error('Renseignez le nom, le matricule et la promotion.');
      return;
    }

    const duplicateMatricule = students.some(
      (student) => student.id !== editingStudentId && student.matricule.toLowerCase() === editStudentForm.matricule.toLowerCase()
    );

    if (duplicateMatricule) {
      toast.error('Ce matricule existe déjà.');
      return;
    }

    const currentStudent = students.find((student) => student.id === editingStudentId);
    if (!currentStudent) {
      toast.error('Étudiant introuvable.');
      return;
    }

    setSavingStudentEdit(true);
    try {
      const payload = {
        name: editStudentForm.name,
        postNom: editStudentForm.postNom || undefined,
        prenom: editStudentForm.prenom || undefined,
        matricule: editStudentForm.matricule,
        dateNaissance: editStudentForm.dateNaissance || undefined,
        lieuNaissance: editStudentForm.lieuNaissance || undefined,
        adresse: editStudentForm.adresse || undefined,
        telephone: editStudentForm.telephone || undefined,
        department: editStudentForm.department,
        level: editStudentForm.level,
        status: editStudentForm.status,
        coursId: editStudentForm.coursId ? Number(editStudentForm.coursId) : null,
        promotionId: editStudentForm.promotionId ? Number(editStudentForm.promotionId) : null,
        creditCoursIds: editStudentForm.creditCoursIds.map(Number),
        photoUrl: editStudentForm.photoUrl.trim() || undefined,
        fingerprintTemplateIds: currentStudent.fingerprintTemplateIds,
        fingerprintTemplateId: currentStudent.fingerprintTemplateId,
        fingerprintCount: currentStudent.fingerprintCount,
      };

      if (isApiReady) {
        const updated = await updateStudentApi(editingStudentId, payload);
        setStudents((currentStudents) => currentStudents.map((student) => student.id === editingStudentId ? updated : student));
      } else {
        const selectedPromotionForEdit = promotions.find((item) => String(item.id) === editStudentForm.promotionId);
        setStudents((currentStudents) => currentStudents.map((student) => (
          student.id === editingStudentId
            ? {
                ...student,
                name: editStudentForm.name,
                postNom: editStudentForm.postNom || undefined,
                prenom: editStudentForm.prenom || undefined,
                matricule: editStudentForm.matricule.toUpperCase(),
                dateNaissance: editStudentForm.dateNaissance || undefined,
                lieuNaissance: editStudentForm.lieuNaissance || undefined,
                adresse: editStudentForm.adresse || undefined,
                telephone: editStudentForm.telephone || undefined,
                department: editStudentForm.department,
                level: editStudentForm.level,
                coursId: editStudentForm.coursId ? Number(editStudentForm.coursId) : null,
                promotionId: editStudentForm.promotionId ? Number(editStudentForm.promotionId) : null,
                coursIds: selectedPromotionForEdit?.coursIds ?? [],
                creditCoursIds: editStudentForm.creditCoursIds.map(Number),
                photoUrl: editStudentForm.photoUrl.trim() || undefined,
                academicStatus: editStudentForm.status,
              }
            : student
        )));
      }

      setEditDialogOpen(false);
      setEditingStudentId(null);
      toast.success('Profil étudiant mis à jour.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de mettre à jour le profil étudiant.');
    } finally {
      setSavingStudentEdit(false);
    }
  };

  const handleEnrollFingerprint = async (studentId: string) => {
    if (!isApiReady) {
      toast.error('L\'enrôlement nécessite une connexion active au backend.');
      return;
    }

    if (isSensorBusy) {
      return;
    }

    const student = students.find((item) => item.id === studentId);
    if (!student) {
      toast.error('Étudiant introuvable pour enrôlement.');
      return;
    }

    const currentCount = student.fingerprintCount ?? (student.fingerprintRegistered ? 1 : 0);
    if (currentCount >= 3) {
      toast.error('Maximum de 3 doigts déjà enrôlés pour cet étudiant.');
      return;
    }

    setIsSensorBusy(true);
    setScanDialogMode('enrollment');
    setScanDialogOpen(true);
    setScanDialogStep('prompt');
    setScanProgress(initialScanProgress());

    try {
      // Appel réel au capteur : attend que le doigt soit placé sur le capteur
      const enrollment = await enrollFingerprintFromSensor();
      const enrolledFingerprintId = enrollment.fingerprintId;

      let seqFingerprintId: string;
      let newCount: number;

      seqFingerprintId = appendFingerprintId(student.fingerprintTemplateId, enrolledFingerprintId);
      const nextFingerprintIds = parseFingerprintIds(seqFingerprintId);
      const fingerprintAlreadyUsed = students.some(
        (item) => item.id !== studentId && hasFingerprintId(item.fingerprintTemplateId, enrolledFingerprintId)
      );
      if (fingerprintAlreadyUsed) {
        toast.error('Cette empreinte est déjà associée à un autre étudiant.');
        return;
      }
      newCount = nextFingerprintIds.length;

      await reserveFingerprintEnrollment(enrolledFingerprintId, enrollment.fingerprintTemplateBase64, pendingFingerprintDoigt);
      await updateFingerprintMetadata(enrolledFingerprintId, {
        doigt: pendingFingerprintDoigt,
      });
      const updated = await updateStudentApi(student.id, {
        name: student.name,
        postNom: student.postNom,
        prenom: student.prenom,
        matricule: student.matricule,
        dateNaissance: student.dateNaissance,
        lieuNaissance: student.lieuNaissance,
        adresse: student.adresse,
        telephone: student.telephone,
        department: student.department,
        level: student.level,
        coursId: student.coursId,
        promotionId: student.promotionId,
        creditCoursIds: student.creditCoursIds,
        status: student.academicStatus,
        photoUrl: student.photoUrl,
        fingerprintTemplateIds: nextFingerprintIds,
        fingerprintTemplateId: seqFingerprintId,
        fingerprintCount: newCount,
      });
      setStudents((currentStudents) =>
        currentStudents.map((item) => (item.id === studentId ? updated : item))
      );
      setScanDialogStep('success');
      setScanProgress((current) => ({
        ...current,
        confirmed: true,
        message: `Empreinte enregistrée pour ${student.name}.`,
      }));
      toast.success(`Doigt ${newCount}/3 enrôlé pour ${student.name}.`);
      await waitForScanFeedback();
    } catch (error) {
      toast.error(getBiometricErrorMessage(error));
    } finally {
      setScanDialogOpen(false);
      setScanDialogStep('idle');
      setScanDialogMode('attendance');
      setScanProgress(initialScanProgress());
      setIsSensorBusy(false);
    }
  };

  const handleFingerprintScan = async () => {
    if (isSensorBusy) {
      return;
    }

    if (!isCourseConfigured) {
      toast.error('Configurez d\'abord le cours (intitulé, jours, heures) avant de pointer la présence.');
      return;
    }

    const hasRegisteredFingerprints = students.some(
      (student) => student.fingerprintRegistered && student.fingerprintTemplateId
    );

    if (!hasRegisteredFingerprints) {
      toast.error('Aucune empreinte enregistrée pour le pointage.');
      return;
    }

    setIsSensorBusy(true);
    setScanDialogMode('attendance');
    setScanDialogOpen(true);
    setScanDialogStep('prompt');
    setScanProgress(initialScanProgress());
    let fingerprintId: string | null = null;

    try {
      const scannedFingerprintId = await scanFingerprintFromSensor({
        mode: 'attendance',
      });
      fingerprintId = scannedFingerprintId;
      if (isApiReady) {
        const scanResult = await scanAttendance(scannedFingerprintId);
        const [apiStudents, apiAttendanceToday] = await Promise.all([
          fetchStudents(),
          fetchAttendanceToday(),
        ]);
        setStudents(apiStudents);
        setAttendanceRecords(apiAttendanceToday);
        toast.success(scanResult.message);
      } else {
        const student = students.find(
          (item) => item.fingerprintRegistered && hasFingerprintId(item.fingerprintTemplateId, scannedFingerprintId)
        );

        if (!student) {
          toast.error('Aucun étudiant ne correspond à cet ID d\'empreinte.');
          return;
        }

        markAttendanceForStudent(student);
      }

      setScanDialogStep('success');
      setScanProgress((current) => ({
        ...current,
        confirmed: true,
        message: 'Empreinte validée avec succès.',
      }));
      await waitForScanFeedback();
    } catch (error) {
      if (typeof fingerprintId === 'string' && fingerprintId.length > 0) {
        void notifyRejectedFingerprintScan(error instanceof Error ? error.message : 'Scan refuse').catch(() => undefined);
      }

      toast.error('Empreinte non reconnue.');
    } finally {
      setScanDialogOpen(false);
      setScanDialogStep('idle');
      setScanDialogMode('attendance');
      setScanProgress(initialScanProgress());
      setIsSensorBusy(false);
    }
  };

  const handleExportPdf = async () => {
    if (attendanceToday.length === 0) {
      toast.error('Aucune présence journalière à exporter.');
      return;
    }

    const exportRows = [...attendanceToday].sort((left, right) => {
      const leftStudent = students.find((item) => item.id === left.studentId || item.matricule.trim().toUpperCase() === left.matricule.trim().toUpperCase());
      const rightStudent = students.find((item) => item.id === right.studentId || item.matricule.trim().toUpperCase() === right.matricule.trim().toUpperCase());
      const leftName = formatStudentFullName(leftStudent ?? { name: left.studentName, postNom: '', prenom: '' });
      const rightName = formatStudentFullName(rightStudent ?? { name: right.studentName, postNom: '', prenom: '' });
      return leftName.localeCompare(rightName, 'fr');
    }).map((record) => ({
      record,
      student: students.find(
        (item) => item.id === record.studentId || item.matricule.trim().toUpperCase() === record.matricule.trim().toUpperCase()
      ),
    }));

    const selectedReportCourse = reportCoursId == null ? null : cours.find((item) => item.id === reportCoursId) ?? null;
    const resolvedCourseName =
      selectedReportCourse?.nom
      ?? ((courseSettings.courseName || '').trim().length > 0
        ? courseSettings.courseName.trim()
        : cours.find((item) => item.id === courseSettings.coursId)?.nom ?? 'Non défini');

    const uniqueDepartments = Array.from(new Set(exportRows
      .map(({ student, record }) => student?.department ?? record.department)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)));

    const courseStartMinutes = parseTimeToMinutes(courseSettings.startTime);
    const courseEndMinutes = parseTimeToMinutes(courseSettings.endTime);
    const courseDurationMinutes =
      courseStartMinutes != null && courseEndMinutes != null && courseEndMinutes > courseStartMinutes
        ? courseEndMinutes - courseStartMinutes
        : null;
    const minimumAttendanceMinutes = courseDurationMinutes != null ? Math.ceil(courseDurationMinutes * 0.75) : null;
    const reportRows = exportRows.map(({ record, student }, index) => {
      const checkInMinutes = parseTimeToMinutes(record.checkIn);
      const checkOutMinutes = parseTimeToMinutes(record.checkOut);
      const attendedMinutes =
        checkInMinutes != null && checkOutMinutes != null && checkOutMinutes >= checkInMinutes
          ? checkOutMinutes - checkInMinutes
          : null;
      const leftEarly =
        checkOutMinutes != null && courseEndMinutes != null && checkOutMinutes < courseEndMinutes;
      const hasUnjustifiedEarlyDeparture = leftEarly && record.estJustifiee === false;
      const isAbsentForReport =
        hasUnjustifiedEarlyDeparture &&
        minimumAttendanceMinutes != null &&
        attendedMinutes != null &&
        attendedMinutes < minimumAttendanceMinutes;

      return {
        record,
        student,
        index: index + 1,
        statusLabel: isAbsentForReport ? 'Absent' : 'Présent',
      };
    });

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 40;
    const rightMargin = 40;
    const logoWidth = 68;

    const { logoBottomY } = await addPdfUsbLogo(doc, { x: pageWidth - rightMargin - logoWidth, y: 34, width: logoWidth, gap: 0 });

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTROLE DE PRESENCE', pageWidth / 2, 44, { align: 'center' });

    const headerTop = 94;
    const labelColor: [number, number, number] = [33, 97, 191];
    const valueColor: [number, number, number] = [31, 41, 55];
    const metadata = [
      { label: 'Date du jour', value: todayLabel },
      { label: 'Cours', value: resolvedCourseName },
      { label: 'Departement', value: uniqueDepartments.join(', ') || 'Non défini' },
    ];

    metadata.forEach((item, index) => {
      const y = headerTop + (index * 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...labelColor);
      doc.text(`${item.label}:`, leftMargin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...valueColor);
      doc.text(item.value, leftMargin + 84, y);
    });

    autoTable(doc, {
      startY: Math.max(188, logoBottomY + 26),
      head: [['N°', 'Photo', 'Noms Etudiant', 'Matricule', 'Promotion', 'Filière', 'Entrée', 'Sortie', 'Statut']],
      body: reportRows.map(({ record, student, statusLabel, index }) => {
        return [
          String(index),
          student?.photoUrl ? '' : getStudentInitials(student ?? { name: record.studentName, postNom: '', prenom: '' }),
          student ? formatStudentFullName(student) : record.studentName,
          record.matricule,
          resolveStudentPromotion(student, promotions),
          resolveStudentFiliere(student, promotions),
          record.checkIn,
          record.checkOut ?? 'En attente',
          statusLabel,
        ];
      }),
      theme: 'grid',
      margin: { left: leftMargin, right: rightMargin, bottom: 30 },
      styles: {
        fontSize: 8,
        cellPadding: { top: 6, right: 4, bottom: 6, left: 4 },
        minCellHeight: 38,
        valign: 'middle',
        textColor: [30, 41, 59],
        lineColor: [191, 219, 254],
        lineWidth: 0.6,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [29, 78, 216],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        minCellHeight: 24,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [239, 246, 255],
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 44, halign: 'center' },
        2: { cellWidth: 94 },
        3: { cellWidth: 56, halign: 'center' },
        4: { cellWidth: 64 },
        5: { cellWidth: 76 },
        6: { cellWidth: 48, halign: 'center' },
        7: { cellWidth: 48, halign: 'center' },
        8: { cellWidth: 48, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          if (String(data.cell.raw).toLowerCase() === 'absent') {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fillColor = [254, 242, 242];
          } else {
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fillColor = [240, 253, 244];
          }
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 1) {
          return;
        }

        const photoUrl = reportRows[data.row.index]?.student?.photoUrl;
        if (!photoUrl) {
          return;
        }

        const size = 24;
        const x = data.cell.x + (data.cell.width - size) / 2;
        const y = data.cell.y + (data.cell.height - size) / 2;
        doc.addImage(photoUrl, x, y, size, size);
      },
    });

    const safeCourseName = (resolvedCourseName || 'cours').replace(/\s+/g, '-').toLowerCase();
    doc.save(`presence-${safeCourseName}-${today}.pdf`);
    setExportsCount((currentCount) => currentCount + 1);
    toast.success('Rapport PDF journalier généré avec succès.');
  };

  const handleExportGlobalEligibilityPdf = async () => {
    if (!isCourseConfigured) {
      toast.error('Configurez d\'abord le cours avant d\'exporter le rapport global.');
      return;
    }

    if (!isCourseCompleted) {
      toast.error('Le cours n\'est pas encore terminé. Attendez la fin du nombre de jours défini.');
      return;
    }

    const selectedReportCourse = reportCoursId == null ? null : cours.find((item) => item.id === reportCoursId) ?? null;
    const resolvedCourseName =
      selectedReportCourse?.nom
      ?? ((courseSettings.courseName || '').trim().length > 0
        ? courseSettings.courseName.trim()
        : cours.find((item) => item.id === courseSettings.coursId)?.nom ?? 'Non défini');

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const { contentX, logoBottomY } = await addPdfUsbLogo(doc, { x: 40, y: 24, width: 56, gap: 14 });

    doc.setFontSize(16);
    doc.text('Rapport global de présence et éligibilité', contentX, 44);
    doc.setFontSize(11);
    doc.text(`Cours: ${resolvedCourseName}`, contentX, 66);
    doc.text(`Durée: ${courseSettings.courseDays} jour(s) - ${courseSettings.courseHours} heure(s)`, contentX, 84);
    doc.text(`Seuil d'éligibilité à l'examen: ${eligibilityThreshold}%`, contentX, 102);

    autoTable(doc, {
      startY: Math.max(126, logoBottomY + 28),
      head: [['N°', 'Matricule', 'Étudiant', 'Jours présents', 'Jours du cours', '% présence', 'Éligibilité']],
      body: studentEligibilityRows.map((row) => [
        String(studentEligibilityRows.indexOf(row) + 1),
        row.student.matricule,
        row.student.name,
        String(row.attendedDays),
        String(courseSettings.courseDays),
        `${row.attendancePercentage.toFixed(1)}%`,
        row.isEligible ? 'Éligible' : 'Non éligible',
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [32, 89, 188],
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 64, halign: 'center' },
        2: { cellWidth: 120 },
        3: { cellWidth: 60, halign: 'center' },
        4: { cellWidth: 64, halign: 'center' },
        5: { cellWidth: 54, halign: 'center' },
        6: { cellWidth: 60, halign: 'center' },
      },
    });

    const safeCourseName = (resolvedCourseName || 'cours').replace(/\s+/g, '-').toLowerCase();
    doc.save(`rapport-global-presence-${safeCourseName}.pdf`);
    toast.success('Rapport global PDF généré avec succès.');
  };

  const handleResetAttendanceData = async () => {
    const confirmed = window.confirm(
      'Voulez-vous vraiment réinitialiser toutes les données de présence (pointages) ? Cette action est irréversible.'
    );

    if (!confirmed) {
      return;
    }

    try {
      if (isApiReady) {
        await resetAttendanceRecordsApi();
        const [apiStudents, apiAttendanceToday, apiCours] = await Promise.all([
          fetchStudents(),
          fetchAttendanceToday(),
          fetchCours(),
        ]);
        setStudents(apiStudents);
        setAttendanceRecords(apiAttendanceToday);
        setCours(apiCours.map((item) => ({ id: item.id, nom: item.nom, departementId: item.departementId, programmeId: item.programmeId })));
      } else {
        setAttendanceRecords([]);
      }
      setExportsCount(0);
      toast.success(
        isApiReady
          ? 'Les données de présence ont été réinitialisées dans la base de données.'
          : 'Les données de présence ont été réinitialisées en local.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de réinitialiser les données de présence.');
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'ready'
      ? 'bg-accent/10 text-accent'
      : 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="flex">
      <Sidebar userName="Admin Administrateur" />

      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        {/* Page Header */}
        <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Étudiants &amp; configurations</h1>
            <p className="text-xs text-slate-400 mt-0.5">Enrôlement biométrique et registre des étudiants</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-64">
              <Select
                value={reportCoursId != null ? String(reportCoursId) : 'none'}
                onValueChange={(value) => {
                  const nextCoursId = value === 'none' ? null : Number(value);
                  setReportCoursId(nextCoursId);
                  if (nextCoursId == null) {
                    return;
                  }

                  const selectedCourse = cours.find((item) => item.id === nextCoursId);
                  setCourseSettings((current) => ({
                    ...current,
                    coursId: nextCoursId,
                    courseName: selectedCourse?.nom ?? current.courseName,
                  }));
                }}
              >
                <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-xs text-slate-600">
                  <SelectValue placeholder="Cours du rapport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cours du rapport</SelectItem>
                  {cours.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {todayLabel}
            </span>
            <Button onClick={handleExportPdf} variant="outline" size="sm" className="gap-2 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* ── Widget connexion capteur MQTT ── */}
          <div className={`rounded-2xl border p-4 flex items-center justify-between shadow-sm ${
            connectionState === 'connected'
              ? 'border-emerald-200 bg-emerald-50'
              : connectionState === 'connecting'
              ? 'border-amber-200 bg-amber-50'
              : 'border-slate-200 bg-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                connectionState === 'connected' ? 'bg-emerald-500 animate-pulse' :
                connectionState === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
              }`} />
              <div>
                <p className="text-sm font-semibold text-slate-800">Capteur biométrique</p>
                <p className="text-xs text-slate-500">
                  {connectionState === 'connected' ? 'Capteur détecté · Enrôlement activé' :
                   connectionState === 'connecting' ? 'Connexion en cours...' :
                   serialSupportError ?? 'Non connecté — allumez le capteur et placez-le sur le même réseau que ce système'}
                </p>
              </div>
            </div>
            {connectionState === 'connected' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => serialSensor.disconnect()}
                className="text-xs border-slate-300 text-slate-600 hover:border-red-300 hover:text-red-600"
              >
                <Unplug className="mr-1.5 h-3.5 w-3.5" />
                Déconnecter
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => serialSensor.connect().catch((error) => {
                  toast.error(error instanceof Error ? error.message : 'Impossible de connecter le capteur.');
                })}
                disabled={connectionState === 'connecting' || Boolean(serialSupportError)}
                className="text-xs bg-blue-700 hover:bg-blue-800 text-white"
              >
                <Usb className="mr-1.5 h-3.5 w-3.5" />
                {connectionState === 'connecting' ? 'Connexion...' : 'Connecter le capteur'}
              </Button>
            )}
          </div>
          {serialSupportError && connectionState !== 'connected' && (
            <p className="-mt-2 text-xs text-amber-700">
              {serialSupportError}
            </p>
          )}

          <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Enregistrer un étudiant</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-foreground">Étape 1: Capturer l'empreinte</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handlePrepareFingerprintForRegistration}
                      disabled={isSensorBusy || connectionState !== 'connected'}
                      className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Fingerprint className="h-4 w-4" />
                      {connectionState !== 'connected' ? 'Capteur non connecté' : isSensorBusy ? 'Scan en cours...' : pendingFingerprintId ? 'Recapturer l\'empreinte' : 'Capturer l\'empreinte'}
                    </Button>
                    {pendingFingerprintId ? (
                      <>
                        <span className="inline-flex max-w-full items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[11px] text-emerald-700">
                          ID capturé: {pendingFingerprintId}
                        </span>
                        <Button type="button" variant="outline" size="sm" onClick={handleClearPendingFingerprint} className="rounded-lg">
                          Effacer l'empreinte
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun ID d'empreinte capturé.</span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Doigt capturé</Label>
                      <Select value={pendingFingerprintDoigt} onValueChange={(value: 'POUCE_DROIT' | 'INDEX_DROIT' | 'MAJEUR_DROIT' | 'ANNULAIRE_DROIT' | 'AURICULAIRE_DROIT' | 'POUCE_GAUCHE' | 'INDEX_GAUCHE' | 'MAJEUR_GAUCHE' | 'ANNULAIRE_GAUCHE' | 'AURICULAIRE_GAUCHE') => setPendingFingerprintDoigt(value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir un doigt" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POUCE_DROIT">Pouce droit</SelectItem>
                          <SelectItem value="INDEX_DROIT">Index droit</SelectItem>
                          <SelectItem value="MAJEUR_DROIT">Majeur droit</SelectItem>
                          <SelectItem value="ANNULAIRE_DROIT">Annulaire droit</SelectItem>
                          <SelectItem value="AURICULAIRE_DROIT">Auriculaire droit</SelectItem>
                          <SelectItem value="POUCE_GAUCHE">Pouce gauche</SelectItem>
                          <SelectItem value="INDEX_GAUCHE">Index gauche</SelectItem>
                          <SelectItem value="MAJEUR_GAUCHE">Majeur gauche</SelectItem>
                          <SelectItem value="ANNULAIRE_GAUCHE">Annulaire gauche</SelectItem>
                          <SelectItem value="AURICULAIRE_GAUCHE">Auriculaire gauche</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                  </p>
                </div>

                <p className="text-sm font-medium text-foreground">Étape 2: Informations étudiant</p>
                <fieldset disabled={!isStudentIdentityStepEnabled} className={!isStudentIdentityStepEnabled ? 'opacity-60' : ''}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    placeholder="Nom"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm((current) => ({ ...current, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Post-nom"
                    value={studentForm.postNom}
                    onChange={(e) => setStudentForm((current) => ({ ...current, postNom: e.target.value }))}
                  />
                  <Input
                    placeholder="Prénom"
                    value={studentForm.prenom}
                    onChange={(e) => setStudentForm((current) => ({ ...current, prenom: e.target.value }))}
                  />
                  <Input
                    placeholder="Matricule"
                    value={studentForm.matricule}
                    onChange={(e) => setStudentForm((current) => ({ ...current, matricule: e.target.value }))}
                  />
                  <Input
                    type="date"
                    placeholder="Date de naissance"
                    value={studentForm.dateNaissance}
                    onChange={(e) => setStudentForm((current) => ({ ...current, dateNaissance: e.target.value }))}
                  />
                  <Input
                    placeholder="Lieu de naissance"
                    value={studentForm.lieuNaissance}
                    onChange={(e) => setStudentForm((current) => ({ ...current, lieuNaissance: e.target.value }))}
                  />
                  <Input
                    placeholder="Téléphone"
                    value={studentForm.telephone}
                    onChange={(e) => setStudentForm((current) => ({ ...current, telephone: e.target.value }))}
                  />
                  <Select value={studentForm.status} onValueChange={(value: 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU') => setStudentForm((current) => ({ ...current, status: value }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Statut académique" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIF">Actif</SelectItem>
                      <SelectItem value="INACTIF">Inactif</SelectItem>
                      <SelectItem value="SUSPENDU">Suspendu</SelectItem>
                      <SelectItem value="DIPLOME">Diplômé</SelectItem>
                      <SelectItem value="EXCLU">Exclu</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={studentForm.promotionId || 'none'} onValueChange={(value) => setStudentForm((current) => ({ ...current, promotionId: value === 'none' ? '' : value }))}>
                    <SelectTrigger className="md:col-span-2 w-full">
                      <SelectValue placeholder="Promotion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sélectionner une promotion</SelectItem>
                      {promotions.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>{item.niveau}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPromotion && creditCourseOptions.length > 0 && (
                    <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Cours de crédit à ajouter</Label>
                        <div className="grid gap-2 md:grid-cols-2">
                          {creditCourseOptions.map((course) => {
                            const checked = studentForm.creditCoursIds.includes(String(course.id));
                            return (
                              <label key={course.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    const isChecked = value === true;
                                    setStudentForm((current) => ({
                                      ...current,
                                      creditCoursIds: isChecked
                                        ? [...current.creditCoursIds, String(course.id)]
                                        : current.creditCoursIds.filter((item) => item !== String(course.id)),
                                    }));
                                  }}
                                />
                                <span>{course.nom}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  <Input
                    className="md:col-span-2"
                    placeholder="Adresse"
                    value={studentForm.adresse}
                    onChange={(e) => setStudentForm((current) => ({ ...current, adresse: e.target.value }))}
                  />
                  <div
                    className="col-span-full flex items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Aperçu" className="h-14 w-14 rounded-full object-cover border-2 border-primary/30 shrink-0" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-400">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {photoPreview ? 'Photo sélectionnée — cliquer pour changer' : 'Importer une photo (optionnel)'}
                      </p>
                      <p className="text-xs text-slate-400">JPG, PNG, WEBP — max recommandé 2 Mo</p>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateStudent}
                  disabled={!pendingFingerprintId}
                  className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" />
                  Étape 3: Enregistrer l'étudiant avec l'empreinte
                </Button>
                </fieldset>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Outils de présence</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                  <p className="text-sm font-medium text-rose-900">Réinitialisation des données</p>
                  <p className="mt-1 text-xs text-rose-700">
                    Utilisez ce paramètre pour vider le marquage de présence et repartir d'une feuille blanche.
                  </p>
                  <Button
                    onClick={handleResetAttendanceData}
                    variant="outline"
                    className="mt-3 flex items-center gap-2 rounded-xl border-rose-300 bg-white text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                  >
                    <Trash2 className="h-4 w-4" />
                    Réinitialiser les présences
                  </Button>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-sm font-medium text-emerald-900">Rapport global de fin de cours</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    À la fin du cours, exportez le PDF global avec le pourcentage de présence et l'éligibilité à l'examen (minimum 75%).
                  </p>
                  <Button
                    onClick={handleExportGlobalEligibilityPdf}
                    disabled={!isCourseCompleted}
                    variant="outline"
                    className="mt-3 flex items-center gap-2 rounded-xl border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    Export PDF global (éligibilité)
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Éligibilité à l'examen <span className="text-slate-400 font-normal">(seuil : 75%)</span></h2>
            <div className="mt-5">
              {students.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Aucun étudiant enregistré pour calculer l'éligibilité.
                </div>
              ) : !isCourseConfigured ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Configurez d'abord le cours pour afficher les pourcentages et l'éligibilité.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Étudiant</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jours présents</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jours du cours</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">% Présence</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Décision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentEligibilityRows.map((row) => (
                        <tr key={row.student.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-foreground">{row.student.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.attendedDays}</td>
                          <td className="px-4 py-3 text-muted-foreground">{courseSettings.courseDays}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.attendancePercentage.toFixed(1)}%</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                row.isEligible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {row.isEligible ? 'Éligible' : 'Non éligible'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher par nom, matricule ou département..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl border-slate-200 bg-white shadow-sm h-11"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Registre des étudiants <span className="text-slate-400 font-normal">({filteredStudents.length})</span></h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nom</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Matricule</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Département</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Niveau</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empreinte</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dernier scan</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt={formatStudentFullName(student)} className="h-9 w-9 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 uppercase">
                              {getStudentInitials(student)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">{formatStudentFullName(student)}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{student.matricule}</td>
                        <td className="py-3 px-4 text-muted-foreground">{student.department}</td>
                        <td className="py-3 px-4 text-muted-foreground">{student.level}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{student.academicStatus ?? 'ACTIF'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${getStatusColor(
                              student.status
                            )} text-xs font-medium`}
                          >
                            <span className="w-2 h-2 rounded-full bg-current"></span>
                            {student.fingerprintRegistered
                              ? `Enrôlée (${student.fingerprintCount ?? 1}/3)`
                              : 'En attente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">{student.lastFingerprintScan ?? 'Pas encore scanné'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              className="gap-2"
                              onClick={() => handleOpenEditStudent(student)}
                            >
                              <Pencil className="w-4 h-4" />
                              Modifier
                            </Button>
                            <Button
                              variant={student.fingerprintRegistered ? 'outline' : 'default'}
                              className="gap-2"
                              disabled={isSensorBusy || connectionState !== 'connected' || (student.fingerprintRegistered && (student.fingerprintCount ?? 1) >= 3)}
                              onClick={() => handleEnrollFingerprint(student.id)}
                            >
                              <Fingerprint className="w-4 h-4" />
                              {student.fingerprintRegistered
                                ? (student.fingerprintCount ?? 1) >= 3
                                  ? '3/3 max'
                                  : `Ajouter doigt (${student.fingerprintCount ?? 1}/3)`
                                : 'Enrôler'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Supprimer l'étudiant"
                              onClick={() => handleDeleteStudent(student.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Liste des présences</h2>
              </div>
              <div className="p-6">
                {attendanceRecords.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Aucun enregistrement de présence pour le moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attendanceRecords.map((record) => (
                      <div key={record.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-semibold text-foreground">{record.studentName}</p>
                            <p className="text-sm text-muted-foreground">
                              {record.matricule} · {record.department}
                            </p>
                          </div>
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                            {record.status}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span>{record.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            <span>Entrée : {record.checkIn}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            <span>Sortie : {record.checkOut ?? 'En attente'}</span>
                          </div>
                        </div>
                        {(() => {
                          if (record.motifJustificatif) {
                            return (
                              <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                <LogOut className="h-3.5 w-3.5 shrink-0" />
                                {`Départ anticipé — ${record.motifJustificatif}`}
                              </div>
                            );
                          }

                          if (!record.justificatifId || record.estJustifiee) return null;

                          return (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                              <LogOut className="h-3.5 w-3.5 shrink-0" />
                              Départ anticipé non justifié — Marqué absent
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={scanDialogOpen} onOpenChange={(open) => !isSensorBusy && setScanDialogOpen(open)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
            {scanDialogStep === 'prompt' && <Fingerprint className="h-10 w-10 animate-pulse text-primary" />}
            {scanDialogStep === 'loading' && <Loader2 className="h-10 w-10 animate-spin text-primary" />}
            {scanDialogStep === 'success' && <CheckCircle2 className="h-10 w-10 text-emerald-500" />}
            {scanDialogStep === 'error' && <AlertTriangle className="h-10 w-10 text-rose-500" />}
          </div>

          <DialogTitle className="mt-5 text-xl font-semibold text-slate-900">
            {scanDialogStep === 'prompt' &&
              (scanDialogMode === 'enrollment' ? 'Enrôlement biométrique' : 'Scanner l\'empreinte')}
            {scanDialogStep === 'loading' &&
              (scanDialogMode === 'enrollment' ? 'Enrôlement en cours' : 'Lecture en cours')}
            {scanDialogStep === 'success' &&
              (scanDialogMode === 'enrollment' ? 'Enrôlement confirmé' : 'Scan confirmé')}
            {scanDialogStep === 'error' &&
              (scanDialogMode === 'enrollment' ? 'Enrôlement interrompu' : 'Lecture interrompue')}
          </DialogTitle>

          <DialogDescription className="mt-2 text-sm text-slate-600">
            {scanProgress.message}
          </DialogDescription>

          <div className="mt-6 space-y-3 text-left">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <div className={`h-2.5 w-2.5 rounded-full ${scanProgress.sensorReady ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div>
                <p className="text-sm font-medium text-slate-800">Capteur détecté</p>

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-[720px] p-0 gap-0 rounded-2xl border-0 shadow-2xl">
              <div className="bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-900 px-6 py-5 rounded-t-2xl">
                <DialogTitle className="text-white text-lg font-bold">Modifier le profil étudiant</DialogTitle>
                <DialogDescription className="mt-1 text-blue-100 text-sm">
                  Mettez à jour la promotion et ajoutez des cours de crédit d'autres promotions après l'enregistrement initial.
                </DialogDescription>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input placeholder="Nom" value={editStudentForm.name} onChange={(e) => setEditStudentForm((current) => ({ ...current, name: e.target.value }))} />
                  <Input placeholder="Post-nom" value={editStudentForm.postNom} onChange={(e) => setEditStudentForm((current) => ({ ...current, postNom: e.target.value }))} />
                  <Input placeholder="Prénom" value={editStudentForm.prenom} onChange={(e) => setEditStudentForm((current) => ({ ...current, prenom: e.target.value }))} />
                  <Input placeholder="Matricule" value={editStudentForm.matricule} onChange={(e) => setEditStudentForm((current) => ({ ...current, matricule: e.target.value }))} />
                  <Input type="date" value={editStudentForm.dateNaissance} onChange={(e) => setEditStudentForm((current) => ({ ...current, dateNaissance: e.target.value }))} />
                  <Input placeholder="Lieu de naissance" value={editStudentForm.lieuNaissance} onChange={(e) => setEditStudentForm((current) => ({ ...current, lieuNaissance: e.target.value }))} />
                  <Input placeholder="Téléphone" value={editStudentForm.telephone} onChange={(e) => setEditStudentForm((current) => ({ ...current, telephone: e.target.value }))} />
                  <Select value={editStudentForm.status} onValueChange={(value: 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU') => setEditStudentForm((current) => ({ ...current, status: value }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Statut académique" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIF">Actif</SelectItem>
                      <SelectItem value="INACTIF">Inactif</SelectItem>
                      <SelectItem value="SUSPENDU">Suspendu</SelectItem>
                      <SelectItem value="DIPLOME">Diplômé</SelectItem>
                      <SelectItem value="EXCLU">Exclu</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={editStudentForm.promotionId || 'none'} onValueChange={(value) => setEditStudentForm((current) => ({ ...current, promotionId: value === 'none' ? '' : value }))}>
                    <SelectTrigger className="md:col-span-2 w-full">
                      <SelectValue placeholder="Promotion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sélectionner une promotion</SelectItem>
                      {promotions.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>{item.niveau}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEditPromotion && editCreditCourseOptions.length > 0 && (
                    <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Cours de crédit d'autres promotions</Label>
                        <div className="grid gap-2 md:grid-cols-2">
                          {editCreditCourseOptions.map((course) => {
                            const checked = editStudentForm.creditCoursIds.includes(String(course.id));
                            return (
                              <label key={course.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    const isChecked = value === true;
                                    setEditStudentForm((current) => ({
                                      ...current,
                                      creditCoursIds: isChecked
                                        ? [...current.creditCoursIds, String(course.id)]
                                        : current.creditCoursIds.filter((item) => item !== String(course.id)),
                                    }));
                                  }}
                                />
                                <span>{course.nom}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  <Input className="md:col-span-2" placeholder="Adresse" value={editStudentForm.adresse} onChange={(e) => setEditStudentForm((current) => ({ ...current, adresse: e.target.value }))} />
                  <div
                    className="col-span-full flex items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    onClick={() => editPhotoInputRef.current?.click()}
                  >
                    {editPhotoPreview ? (
                      <img src={editPhotoPreview} alt="Aperçu" className="h-14 w-14 rounded-full object-cover border-2 border-primary/30 shrink-0" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-400">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {editPhotoPreview ? 'Photo sélectionnée — cliquer pour changer' : 'Importer une photo (optionnel)'}
                      </p>
                      <p className="text-xs text-slate-400">JPG, PNG, WEBP — max recommandé 2 Mo</p>
                    </div>
                    <input ref={editPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleEditPhotoFile(e.target.files?.[0])} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)} disabled={savingStudentEdit}>
                    Annuler
                  </Button>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleUpdateStudentProfile} disabled={savingStudentEdit}>
                    {savingStudentEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
                    Enregistrer les modifications
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
                <p className="text-xs text-slate-500">Connexion du capteur validée et appareil prêt.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <div className={`h-2.5 w-2.5 rounded-full ${scanProgress.fingerPlaced ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div>
                <p className="text-sm font-medium text-slate-800">Doigt posé</p>
                <p className="text-xs text-slate-500">Le capteur confirme la lecture physique du doigt.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <div className={`h-2.5 w-2.5 rounded-full ${scanProgress.confirmed ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {scanDialogMode === 'enrollment' ? 'Empreinte enregistrée' : 'Empreinte confirmée'}
                </p>
                <p className="text-xs text-slate-500">
                  {scanDialogMode === 'enrollment'
                    ? 'Le système reçoit et associe l\'empreinte au dossier étudiant.'
                    : 'Le système valide l\'identité et enregistre le pointage.'}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
