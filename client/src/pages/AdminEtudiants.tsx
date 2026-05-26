import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalendarDays, CheckCircle2, Clock, Download, FileCheck2, Fingerprint, ImagePlus, Loader2, LogOut, Plus, Search, Trash2, Unplug, Usb, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';
import {
  loadAttendanceRecords,
  loadCourseSettings,
  loadDepartureExceptions,
  loadExportsCount,
  loadStudents,
  saveAttendanceRecords,
  saveCourseSettings,
  saveExportsCount,
  saveStudents,
  type AttendanceRecord,
  type CourseSettings,
  type DepartureException,
  type Student,
} from '@/lib/adminData';
import {
  createStudent as createStudentApi,
  deleteStudent as deleteStudentApi,
  fetchAttendanceToday,
  fetchCourseSettings,
  fetchStudents,
  saveCourseSettingsApi,
  scanAttendance,
  updateStudent as updateStudentApi,
} from '@/lib/adminApi';
import { scanFingerprintFromSensor } from '@/lib/biometricSensor';
import { serialSensor, type ConnectionState } from '@/lib/serialSensor';

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

export default function AdminUsers() {
  type ScanDialogStep = 'idle' | 'prompt' | 'loading' | 'success';
  type ScanDialogMode = 'attendance' | 'enrollment';

  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => loadAttendanceRecords());
  const [exportsCount, setExportsCount] = useState<number>(() => loadExportsCount());
  const [isSensorBusy, setIsSensorBusy] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanDialogStep, setScanDialogStep] = useState<ScanDialogStep>('idle');
  const [scanDialogMode, setScanDialogMode] = useState<ScanDialogMode>('attendance');
  const [pendingFingerprintId, setPendingFingerprintId] = useState('');
  const [courseSettings, setCourseSettings] = useState<CourseSettings>(() => loadCourseSettings());
  const [courseSettingsForm, setCourseSettingsForm] = useState<CourseSettings>(() => loadCourseSettings());
  const [isApiReady, setIsApiReady] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => serialSensor.state);
  const [departureExceptions, setDepartureExceptions] = useState<DepartureException[]>(() => loadDepartureExceptions());

  // Rafraîchir les exceptions quand la fenêtre reprend le focus (depuis AdminSensor)
  useEffect(() => {
    const refresh = () => setDepartureExceptions(loadDepartureExceptions());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  // Synchroniser l'état de connexion du capteur série
  useEffect(() => serialSensor.onConnectionChange(setConnectionState), []);
  const [studentForm, setStudentForm] = useState({
    name: '',
    matricule: '',
    department: '',
    level: '',
    photoUrl: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFile = (file: File | undefined) => {
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

  useEffect(() => {
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
    let mounted = true;

    const hydrateFromApi = async () => {
      try {
        const [apiStudents, apiAttendanceToday, apiCourseSettings] = await Promise.all([
          fetchStudents(),
          fetchAttendanceToday(),
          fetchCourseSettings(),
        ]);

        if (!mounted) {
          return;
        }

        setStudents(apiStudents);
        setAttendanceRecords(apiAttendanceToday);
        setCourseSettings(apiCourseSettings);
        setCourseSettingsForm(apiCourseSettings);
        setIsApiReady(true);
      } catch {
        if (!mounted) {
          return;
        }

        setIsApiReady(false);
        toast.warning('API Java indisponible: mode local activé dans ce navigateur.');
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
      student.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const today = formatAttendanceDate(new Date());
  const todayLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date());
  const attendanceToday = attendanceRecords.filter((record) => record.date === today);
  const trackedStudentsCount = students.length;
  const activeFingerprintsCount = students.filter((student) => student.fingerprintRegistered).length;
  const presentTodayCount = attendanceToday.length;
  const checkedOutCount = attendanceToday.filter((record) => record.checkOut).length;

  const kpiCards = [
    {
      title: 'Étudiants suivis',
      value: trackedStudentsCount,
      icon: Users,
      iconClassName: 'text-blue-600',
      chipClassName: 'border-blue-200 bg-blue-50 text-blue-700',
      toneClassName: 'from-blue-50 to-white',
    },
    {
      title: 'Empreintes actives',
      value: activeFingerprintsCount,
      icon: Fingerprint,
      iconClassName: 'text-violet-600',
      chipClassName: 'border-violet-200 bg-violet-50 text-violet-700',
      toneClassName: 'from-violet-50 to-white',
    },
    {
      title: 'Présences du jour',
      value: presentTodayCount,
      icon: Clock,
      iconClassName: 'text-cyan-700',
      chipClassName: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      toneClassName: 'from-cyan-50 to-white',
    },
    {
      title: 'Sorties pointées',
      value: checkedOutCount,
      icon: CheckCircle2,
      iconClassName: 'text-emerald-600',
      chipClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      toneClassName: 'from-emerald-50 to-white',
    },
  ];
  const isCourseConfigured =
    courseSettings.courseName.trim().length > 0 &&
    courseSettings.courseDays > 0 &&
    courseSettings.courseHours > 0;
  const recordedCourseDays = Array.from(new Set(attendanceRecords.map((record) => record.date))).length;
  const isCourseCompleted = isCourseConfigured && recordedCourseDays >= courseSettings.courseDays;
  const eligibilityThreshold = 75;

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

  const handleSaveCourseSettings = async () => {
    const courseName = courseSettingsForm.courseName.trim();
    const courseDays = Number(courseSettingsForm.courseDays);
    const courseHours = Number(courseSettingsForm.courseHours);
    const startTime = courseSettingsForm.startTime.trim();
    const endTime = courseSettingsForm.endTime.trim();

    if (!courseName || !Number.isFinite(courseDays) || courseDays <= 0 || !Number.isFinite(courseHours) || courseHours <= 0) {
      toast.error('Définissez correctement le cours, le nombre de jours et le nombre d\'heures avant le pointage.');
      return;
    }

    if (startTime && endTime && startTime >= endTime) {
      toast.error('L\'heure de fin doit être après l\'heure de début.');
      return;
    }

    if (isApiReady) {
      try {
        const saved = await saveCourseSettingsApi({ courseName, courseDays, courseHours, eligibilityThreshold, startTime, endTime });
        setCourseSettings(saved);
        setCourseSettingsForm(saved);
        toast.success('Paramètres du cours enregistrés Avec Succès.');
        return;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Impossible d\'enregistrer le cours.');
      }
    }

    setCourseSettings({ courseName, courseDays, courseHours, startTime, endTime });
    toast.success('Paramètres du cours enregistrés en local.');
  };

  const handleCreateStudent = async () => {
    if (!pendingFingerprintId) {
      toast.error('Scannez d\'abord l\'empreinte avant de créer l\'étudiant.');
      return;
    }

    if (!studentForm.name || !studentForm.matricule || !studentForm.department || !studentForm.level) {
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

    if (isApiReady) {
      try {
        const created = await createStudentApi({
          name: studentForm.name,
          matricule: studentForm.matricule,
          department: studentForm.department,
          level: studentForm.level,
          photoUrl: studentForm.photoUrl.trim() || undefined,
          fingerprintTemplateId: pendingFingerprintId,
          fingerprintCount: 1,
        });
        setStudents((currentStudents) => [created, ...currentStudents]);
        setPendingFingerprintId('');
        setStudentForm({ name: '', matricule: '', department: '', level: '', photoUrl: '' });
        toast.success('Étudiant enregistré Avec Succès avec empreinte biométrique.');
        return;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Impossible de créer l\'étudiant.');
      }
    }

    const newStudent: Student = {
      id: crypto.randomUUID(),
      name: studentForm.name,
      matricule: studentForm.matricule.toUpperCase(),
      department: studentForm.department,
      level: studentForm.level,
      photoUrl: studentForm.photoUrl.trim() || undefined,
      fingerprintRegistered: true,
      fingerprintTemplateId: pendingFingerprintId,
      fingerprintCount: 1,
      lastFingerprintScan: formatDisplayDateTime(new Date()),
      status: 'ready',
    };

    setStudents((currentStudents) => [newStudent, ...currentStudents]);
    setPendingFingerprintId('');
    setStudentForm({ name: '', matricule: '', department: '', level: '', photoUrl: '' });
    setPhotoPreview(null);
    setPhotoPreview(null);
    toast.success('Étudiant enregistré en local avec empreinte biométrique.');
  };

  const handlePrepareFingerprintForRegistration = async () => {
    if (isSensorBusy) {
      return;
    }

    setIsSensorBusy(true);
    setScanDialogMode('enrollment');
    setScanDialogOpen(true);
    setScanDialogStep('prompt');

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setScanDialogStep('loading');

      // Appel réel au capteur : la promesse se résout quand le doigt est détecté
      await scanFingerprintFromSensor({ mode: 'enrollment' });

      // Générer un ID séquentiel court (0001, 0002, ...)
      const numericIds = students
        .map(s => s.fingerprintTemplateId)
        .filter(Boolean)
        .map(id => parseInt(id!, 10))
        .filter(n => !isNaN(n));
      const nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
      const fingerprintId = String(nextNum).padStart(4, '0');

      setPendingFingerprintId(fingerprintId);
      setScanDialogStep('success');
      await new Promise((resolve) => setTimeout(resolve, 900));
      toast.success('Empreinte capturée. Vous pouvez maintenant compléter les informations étudiant.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec du scan biométrique.');
    } finally {
      setScanDialogOpen(false);
      setScanDialogStep('idle');
      setScanDialogMode('attendance');
      setIsSensorBusy(false);
    }
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
      id: crypto.randomUUID(),
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

  const handleEnrollFingerprint = async (studentId: string) => {
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

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setScanDialogStep('loading');

      // Appel réel au capteur : attend que le doigt soit placé sur le capteur
      await scanFingerprintFromSensor({ mode: 'enrollment' });

      let seqFingerprintId: string;
      let newCount: number;

      if (student.fingerprintRegistered && student.fingerprintTemplateId) {
        // Même ID, on ajoute un doigt supplémentaire
        seqFingerprintId = student.fingerprintTemplateId;
        newCount = currentCount + 1;
      } else {
        // Nouvel étudiant : générer un ID séquentiel court (0001, 0002, ...)
        const numericIds = students
          .filter(s => s.id !== studentId)
          .map(s => s.fingerprintTemplateId)
          .filter(Boolean)
          .map(id => parseInt(id!, 10))
          .filter(n => !isNaN(n));
        const nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
        seqFingerprintId = String(nextNum).padStart(4, '0');
        const fingerprintAlreadyUsed = students.some(
          (item) => item.id !== studentId && item.fingerprintTemplateId === seqFingerprintId
        );
        if (fingerprintAlreadyUsed) {
          toast.error('Cet ID d\'empreinte est déjà associé à un autre étudiant.');
          return;
        }
        newCount = 1;
      }

      if (isApiReady) {
        const updated = await updateStudentApi(student.id, {
          name: student.name,
          matricule: student.matricule,
          department: student.department,
          level: student.level,
          photoUrl: student.photoUrl,
          fingerprintTemplateId: seqFingerprintId,
          fingerprintCount: newCount,
        });
        setStudents((currentStudents) =>
          currentStudents.map((item) => (item.id === studentId ? updated : item))
        );
      } else {
        const scanMoment = formatDisplayDateTime(new Date());
        setStudents((currentStudents) =>
          currentStudents.map((item) =>
            item.id === studentId
              ? {
                  ...item,
                  fingerprintRegistered: true,
                  fingerprintTemplateId: seqFingerprintId,
                  fingerprintCount: newCount,
                  lastFingerprintScan: scanMoment,
                  status: 'ready',
                }
              : item
          )
        );
      }
      setScanDialogStep('success');
      await new Promise((resolve) => setTimeout(resolve, 900));
      toast.success(`Doigt ${newCount}/3 enrôlé pour ${student.name} (ID: ${seqFingerprintId}).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec du scan biométrique.');
    } finally {
      setScanDialogOpen(false);
      setScanDialogStep('idle');
      setScanDialogMode('attendance');
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

    const knownFingerprintIds = students
      .filter((student) => student.fingerprintRegistered && student.fingerprintTemplateId)
      .map((student) => student.fingerprintTemplateId as string);

    if (knownFingerprintIds.length === 0) {
      toast.error('Aucune empreinte enregistrée pour le pointage.');
      return;
    }

    setIsSensorBusy(true);
    setScanDialogMode('attendance');
    setScanDialogOpen(true);
    setScanDialogStep('prompt');

    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      setScanDialogStep('loading');

      const fingerprintId = await scanFingerprintFromSensor({
        mode: 'attendance',
        knownFingerprintIds,
      });
      if (isApiReady) {
        const scanResult = await scanAttendance(fingerprintId);
        const [apiStudents, apiAttendanceToday] = await Promise.all([
          fetchStudents(),
          fetchAttendanceToday(),
        ]);
        setStudents(apiStudents);
        setAttendanceRecords(apiAttendanceToday);
        toast.success(scanResult.message);
      } else {
        const student = students.find(
          (item) => item.fingerprintRegistered && item.fingerprintTemplateId === fingerprintId
        );

        if (!student) {
          toast.error('Aucun étudiant ne correspond à cet ID d\'empreinte.');
          return;
        }

        markAttendanceForStudent(student);
      }

      setScanDialogStep('success');
      await new Promise((resolve) => setTimeout(resolve, 900));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec du scan biométrique.');
    } finally {
      setScanDialogOpen(false);
      setScanDialogStep('idle');
      setScanDialogMode('attendance');
      setIsSensorBusy(false);
    }
  };

  const handleExportPdf = () => {
    if (attendanceToday.length === 0) {
      toast.error('Aucune présence journalière à exporter.');
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    doc.setFontSize(16);
    doc.text('Rapport journalier de présence', 40, 40);
    doc.setFontSize(11);
    doc.text(`Date: ${todayLabel}`, 40, 62);
    doc.text(`Cours: ${courseSettings.courseName || 'Non défini'}`, 40, 80);
    doc.text(`Durée du cours: ${courseSettings.courseDays} jour(s) - ${courseSettings.courseHours} heure(s)`, 40, 98);

    autoTable(doc, {
      startY: 120,
      head: [['Matricule', 'Étudiant', 'Département', 'Entrée', 'Sortie']],
      body: attendanceToday.map((record) => [
        record.matricule,
        record.studentName,
        record.department,
        record.checkIn,
        record.checkOut ?? '',
      ]),
      styles: {
        fontSize: 10,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [32, 89, 188],
      },
    });

    const safeCourseName = (courseSettings.courseName || 'cours').replace(/\s+/g, '-').toLowerCase();
    doc.save(`presence-${safeCourseName}-${today}.pdf`);
    setExportsCount((currentCount) => currentCount + 1);
    toast.success('Rapport PDF journalier généré avec succès.');
  };

  const handleExportGlobalEligibilityPdf = () => {
    if (!isCourseConfigured) {
      toast.error('Configurez d\'abord le cours avant d\'exporter le rapport global.');
      return;
    }

    if (!isCourseCompleted) {
      toast.error('Le cours n\'est pas encore terminé. Attendez la fin du nombre de jours défini.');
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    doc.setFontSize(16);
    doc.text('Rapport global de présence et éligibilité', 40, 40);
    doc.setFontSize(11);
    doc.text(`Cours: ${courseSettings.courseName}`, 40, 62);
    doc.text(`Durée: ${courseSettings.courseDays} jour(s) - ${courseSettings.courseHours} heure(s)`, 40, 80);
    doc.text(`Seuil d'éligibilité à l'examen: ${eligibilityThreshold}%`, 40, 98);

    autoTable(doc, {
      startY: 120,
      head: [['Matricule', 'Étudiant', 'Jours présents', 'Jours du cours', '% présence', 'Éligibilité']],
      body: studentEligibilityRows.map((row) => [
        row.student.matricule,
        row.student.name,
        String(row.attendedDays),
        String(courseSettings.courseDays),
        `${row.attendancePercentage.toFixed(1)}%`,
        row.isEligible ? 'Éligible' : 'Non éligible',
      ]),
      styles: {
        fontSize: 10,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [32, 89, 188],
      },
    });

    const safeCourseName = courseSettings.courseName.replace(/\s+/g, '-').toLowerCase();
    doc.save(`rapport-global-presence-${safeCourseName}.pdf`);
    toast.success('Rapport global PDF généré avec succès.');
  };

  const handleResetAttendanceData = () => {
    const confirmed = window.confirm(
      'Voulez-vous vraiment réinitialiser toutes les données de présence (pointages) ? Cette action est irréversible.'
    );

    if (!confirmed) {
      return;
    }

    setAttendanceRecords([]);
    setExportsCount(0);
    toast.success('Les données de présence ont été réinitialisées.');
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
            <p className="text-xs text-slate-400 mt-0.5">Enrôlement biométrique, registre des étudiants et paramétrage</p>
          </div>
          <div className="flex items-center gap-3">
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
          <div className="grid gap-5 md:grid-cols-4">
            {kpiCards.map((kpi) => (
              <div key={kpi.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
                  <div className={`rounded-xl border p-2 ${kpi.chipClassName}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.iconClassName}`} />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* ── Widget connexion capteur NodeMCU ── */}
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
                  {connectionState === 'connected' ? 'Connecté via USB · Enrôlement activé' :
                   connectionState === 'connecting' ? 'Connexion en cours...' :
                   'Non connecté — branchez le câble USB pour activer l\'enrôlement'}
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
                onClick={() => serialSensor.connect().catch(() => {})}
                disabled={connectionState === 'connecting'}
                className="text-xs bg-blue-700 hover:bg-blue-800 text-white"
              >
                <Usb className="mr-1.5 h-3.5 w-3.5" />
                {connectionState === 'connecting' ? 'Connexion...' : 'Connecter le capteur'}
              </Button>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Enregistrer un étudiant</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-foreground">Étape 1: Capturer l'empreinte</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scannez d'abord l'empreinte sur le capteur, puis complétez les informations étudiant.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handlePrepareFingerprintForRegistration}
                      disabled={isSensorBusy || connectionState !== 'connected'}
                      className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Fingerprint className="h-4 w-4" />
                      {connectionState !== 'connected' ? 'Capteur non connecté' : isSensorBusy ? 'Scan en cours...' : 'Scanner d\'abord l\'empreinte'}
                    </Button>
                    {pendingFingerprintId ? (
                      <span className="inline-flex max-w-full items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[11px] text-emerald-700">
                        ID capturé: {pendingFingerprintId}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun ID d'empreinte capturé.</span>
                    )}
                  </div>
                </div>

                <p className="text-sm font-medium text-foreground">Étape 2: Informations étudiant</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    placeholder="Nom complet"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm((current) => ({ ...current, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Matricule"
                    value={studentForm.matricule}
                    onChange={(e) => setStudentForm((current) => ({ ...current, matricule: e.target.value }))}
                  />
                  <Input
                    placeholder="Département"
                    value={studentForm.department}
                    onChange={(e) => setStudentForm((current) => ({ ...current, department: e.target.value }))}
                  />
                  <Input
                    placeholder="Niveau"
                    value={studentForm.level}
                    onChange={(e) => setStudentForm((current) => ({ ...current, level: e.target.value }))}
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
                  Enregistrer l'étudiant avec l'empreinte
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Paramétrage du cours</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm font-medium text-foreground">Configuration obligatoire avant pointage</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="Intitulé du cours"
                      value={courseSettingsForm.courseName}
                      onChange={(e) =>
                        setCourseSettingsForm((current) => ({
                          ...current,
                          courseName: e.target.value,
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Nombre de jours"
                      value={courseSettingsForm.courseDays === 0 ? '' : String(courseSettingsForm.courseDays)}
                      onChange={(e) =>
                        setCourseSettingsForm((current) => ({
                          ...current,
                          courseDays: Number(e.target.value) || 0,
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Nombre d'heures"
                      value={courseSettingsForm.courseHours === 0 ? '' : String(courseSettingsForm.courseHours)}
                      onChange={(e) =>
                        setCourseSettingsForm((current) => ({
                          ...current,
                          courseHours: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Heure de début du cours</label>
                      <Input
                        type="time"
                        value={courseSettingsForm.startTime}
                        onChange={(e) =>
                          setCourseSettingsForm((current) => ({
                            ...current,
                            startTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Heure de fin du cours</label>
                      <Input
                        type="time"
                        value={courseSettingsForm.endTime}
                        onChange={(e) =>
                          setCourseSettingsForm((current) => ({
                            ...current,
                            endTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button onClick={handleSaveCourseSettings} variant="outline" className="rounded-xl border-slate-300 bg-white">
                      Enregistrer le cours
                    </Button>
                  </div>
                    {isCourseConfigured ? (
                      <span className="text-xs font-medium text-emerald-700">Cours configuré : {courseSettings.courseName}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Configurez le cours avant l'export du rapport.</span>
                    )}
                </div>

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
                            <img src={student.photoUrl} alt={student.name} className="h-9 w-9 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 uppercase">
                              {student.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">{student.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{student.matricule}</td>
                        <td className="py-3 px-4 text-muted-foreground">{student.department}</td>
                        <td className="py-3 px-4 text-muted-foreground">{student.level}</td>
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
                          const exc = departureExceptions.find((e) => e.attendanceId === record.id);
                          if (!exc) return null;
                          const reasonLabels: Record<string, string> = {
                            maladie: 'Maladie',
                            'urgence-familiale': 'Urgence familiale',
                            'urgence-travail': 'Urgence au travail',
                          };
                          return (
                            <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                              exc.status === 'justified'
                                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                                : 'bg-rose-50 border border-rose-200 text-rose-800'
                            }`}>
                              <LogOut className="h-3.5 w-3.5 shrink-0" />
                              {exc.status === 'justified'
                                ? `Départ anticipé — ${reasonLabels[exc.reason ?? ''] ?? exc.reason}`
                                : 'Départ anticipé non justifié — Marqué absent'}
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
          </div>

          <DialogTitle className="mt-5 text-xl font-semibold text-slate-900">
            {scanDialogStep === 'prompt' &&
              (scanDialogMode === 'enrollment' ? 'Enrôlement biométrique' : 'Scanner l\'empreinte')}
            {scanDialogStep === 'loading' &&
              (scanDialogMode === 'enrollment' ? 'Enrôlement en cours' : 'Lecture en cours')}
            {scanDialogStep === 'success' &&
              (scanDialogMode === 'enrollment' ? 'Enrôlement confirmé' : 'Scan confirmé')}
          </DialogTitle>

          <DialogDescription className="mt-2 text-sm text-slate-600">
            {scanDialogStep === 'prompt' && 'Placez votre doigt sur le capteur pour scanner.'}
            {scanDialogStep === 'loading' &&
              (scanDialogMode === 'enrollment'
                ? 'Veuillez patienter pendant l\'association de l\'empreinte à l\'étudiant...'
                : 'Veuillez patienter pendant la vérification biométrique...')}
            {scanDialogStep === 'success' &&
              (scanDialogMode === 'enrollment'
                ? 'Empreinte associée à l\'étudiant avec succès.'
                : 'Empreinte détectée avec succès.')}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}
