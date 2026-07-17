import { useEffect, useMemo, useState } from 'react';
import { Download, Calendar, CalendarDays, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAttendanceForCours, fetchAttendanceWeekForCours, fetchCours, fetchPromotions, fetchStudentsForCours } from '@/lib/adminApi';
import type { AttendanceRecord, Cours, Promotion, Student } from '@/lib/adminData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfUsbLogo } from '@/lib/pdf';

const TEACHER_SELECTED_COURSE_KEY = 'biopresence_teacher_selected_course';
const TEACHER_REPORTS_REFRESH_INTERVAL_MS = 15000;

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatStudentFullName(student: Pick<Student, 'name' | 'postNom' | 'prenom'>): string {
  return [student.name, student.postNom, student.prenom]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
}

function getStudentInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

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

function resolveStudentFiliere(student: Student | undefined, promotions: Promotion[]): string {
  if (student?.promotionId != null) {
    const promotion = promotions.find((item) => item.id === student.promotionId);
    if (promotion?.programme && promotion.programme.trim().length > 0) {
      return promotion.programme;
    }
  }

  return 'Non définie';
}

type PresencePdfRow = {
  photoUrl?: string;
  statusLabel: string;
  cells: string[];
};

async function generatePresencePdf(options: {
  metadata: Array<{ label: string; value: string }>;
  head: string[];
  rows: PresencePdfRow[];
  fileName: string;
  photoColumnIndex: number;
}) {
  const { metadata, head, rows, fileName, photoColumnIndex } = options;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
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
    head: [head],
    body: rows.map((row) => row.cells),
    theme: 'grid',
    margin: { left: leftMargin, right: rightMargin, bottom: 30 },
    styles: {
      fontSize: 10,
      cellPadding: { top: 8, right: 6, bottom: 8, left: 6 },
      minCellHeight: 48,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [191, 219, 254],
      lineWidth: 0.6,
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      minCellHeight: 30,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [239, 246, 255],
    },
    columnStyles: head.reduce<Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }>>((acc, _, index) => {
      if (index === photoColumnIndex) {
        acc[index] = { cellWidth: 64, halign: 'center' };
      } else if (head[index] === 'Nom complet') {
        acc[index] = { cellWidth: 180 };
      } else if (head[index] === 'Matricule') {
        acc[index] = { cellWidth: 88, halign: 'center' };
      } else if (head[index] === 'Filière') {
        acc[index] = { cellWidth: 130 };
      } else if (head[index] === 'Entrée' || head[index] === 'Sortie' || head[index] === 'Statut' || head[index] === 'Date') {
        acc[index] = { cellWidth: 76, halign: 'center' };
      }

      return acc;
    }, {}),
    didParseCell: (data) => {
      const statusColumnIndex = head.indexOf('Statut');
      if (data.section === 'body' && data.column.index === statusColumnIndex) {
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
      if (data.section !== 'body' || data.column.index !== photoColumnIndex) {
        return;
      }

      const photoUrl = rows[data.row.index]?.photoUrl;
      if (!photoUrl) {
        return;
      }

      const size = 32;
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;
      doc.addImage(photoUrl, x, y, size, size);
    },
  });

  doc.save(fileName);
}

async function generateDailyPdf(records: AttendanceRecord[], date: string, course: Cours | null, students: Student[], promotions: Promotion[]) {
  const uniquePromotions = Array.from(new Set(
    students
      .map((student) => student.level)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  ));
  const uniqueDepartments = Array.from(new Set(
    records
      .map((record) => students.find((student) => student.id === record.studentId)?.department ?? record.department)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  ));
  const courseStartMinutes = parseTimeToMinutes(course?.heureDebut);
  const courseEndMinutes = parseTimeToMinutes(course?.heureFin);
  const courseDurationMinutes =
    courseStartMinutes != null && courseEndMinutes != null && courseEndMinutes > courseStartMinutes
      ? courseEndMinutes - courseStartMinutes
      : null;
  const minimumAttendanceMinutes = courseDurationMinutes != null ? Math.ceil(courseDurationMinutes * 0.75) : null;

  const rows = records.map((record) => {
    const student = students.find((item) => item.id === record.studentId);
    const fullName = student ? formatStudentFullName(student) : record.studentName;
    const checkInMinutes = parseTimeToMinutes(record.checkIn);
    const checkOutMinutes = parseTimeToMinutes(record.checkOut);
    const attendedMinutes =
      checkInMinutes != null && checkOutMinutes != null && checkOutMinutes >= checkInMinutes
        ? checkOutMinutes - checkInMinutes
        : null;
    const leftEarly = checkOutMinutes != null && courseEndMinutes != null && checkOutMinutes < courseEndMinutes;
    const isAbsentForReport =
      leftEarly &&
      record.estJustifiee === false &&
      minimumAttendanceMinutes != null &&
      attendedMinutes != null &&
      attendedMinutes < minimumAttendanceMinutes;
    const statusLabel = isAbsentForReport ? 'Absent' : 'Présent';

    return {
      photoUrl: student?.photoUrl,
      statusLabel,
      cells: [
        student?.photoUrl ? '' : getStudentInitials(fullName),
        fullName,
        record.matricule,
        resolveStudentFiliere(student, promotions),
        record.checkIn || '--',
        record.checkOut || 'En attente',
        statusLabel,
      ],
    } satisfies PresencePdfRow;
  });

  await generatePresencePdf({
    metadata: [
      { label: 'Date du jour', value: formatDate(date) },
      { label: 'Cours', value: course?.nom ?? 'Non défini' },
      { label: 'Promotion', value: uniquePromotions.join(', ') || 'Non définie' },
      { label: 'Departement', value: uniqueDepartments.join(', ') || 'Non défini' },
    ],
    head: ['Photo', 'Nom complet', 'Matricule', 'Filière', 'Entrée', 'Sortie', 'Statut'],
    rows,
    fileName: `presence_${date}.pdf`,
    photoColumnIndex: 0,
  });
}

async function generateWeeklyPdf(records: AttendanceRecord[], startDate: string, endDate: string, course: Cours | null, students: Student[], promotions: Promotion[]) {
  const uniquePromotions = Array.from(new Set(
    students
      .map((student) => student.level)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  ));
  const uniqueDepartments = Array.from(new Set(
    records
      .map((record) => students.find((student) => student.id === record.studentId)?.department ?? record.department)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  ));
  const courseStartMinutes = parseTimeToMinutes(course?.heureDebut);
  const courseEndMinutes = parseTimeToMinutes(course?.heureFin);
  const courseDurationMinutes =
    courseStartMinutes != null && courseEndMinutes != null && courseEndMinutes > courseStartMinutes
      ? courseEndMinutes - courseStartMinutes
      : null;
  const minimumAttendanceMinutes = courseDurationMinutes != null ? Math.ceil(courseDurationMinutes * 0.75) : null;

  const rows = records.map((record) => {
    const student = students.find((item) => item.id === record.studentId);
    const fullName = student ? formatStudentFullName(student) : record.studentName;
    const checkInMinutes = parseTimeToMinutes(record.checkIn);
    const checkOutMinutes = parseTimeToMinutes(record.checkOut);
    const attendedMinutes =
      checkInMinutes != null && checkOutMinutes != null && checkOutMinutes >= checkInMinutes
        ? checkOutMinutes - checkInMinutes
        : null;
    const leftEarly = checkOutMinutes != null && courseEndMinutes != null && checkOutMinutes < courseEndMinutes;
    const isAbsentForReport =
      leftEarly &&
      record.estJustifiee === false &&
      minimumAttendanceMinutes != null &&
      attendedMinutes != null &&
      attendedMinutes < minimumAttendanceMinutes;
    const statusLabel = isAbsentForReport ? 'Absent' : 'Présent';

    return {
      photoUrl: student?.photoUrl,
      statusLabel,
      cells: [
        formatDate(record.date),
        student?.photoUrl ? '' : getStudentInitials(fullName),
        fullName,
        record.matricule,
        resolveStudentFiliere(student, promotions),
        record.checkIn || '--',
        record.checkOut || 'En attente',
        statusLabel,
      ],
    } satisfies PresencePdfRow;
  });

  await generatePresencePdf({
    metadata: [
      { label: 'Date du jour', value: `Du ${formatDate(startDate)} au ${formatDate(endDate)}` },
      { label: 'Cours', value: course?.nom ?? 'Non défini' },
      { label: 'Promotion', value: uniquePromotions.join(', ') || 'Non définie' },
      { label: 'Departement', value: uniqueDepartments.join(', ') || 'Non défini' },
    ],
    head: ['Date', 'Photo', 'Nom complet', 'Matricule', 'Filière', 'Entrée', 'Sortie', 'Statut'],
    rows,
    fileName: `presence_semaine_${startDate}_${endDate}.pdf`,
    photoColumnIndex: 1,
  });
}

export default function UtilisateurRapports() {
  // L'enseignant peut ici extraire les présences de son cours par jour ou par semaine.
  const { user } = useAuth();
  const assignedCourseIds = user?.coursIds ?? (user?.coursId != null ? [user.coursId] : []);
  const [assignedCourses, setAssignedCourses] = useState<Cours[]>([]);
  const [selectedCoursId, setSelectedCoursId] = useState<number | null>(assignedCourseIds[0] ?? null);
  const [courseStudents, setCourseStudents] = useState<Student[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const loadAssignedCourses = async (mounted?: { current: boolean }) => {
    try {
      const [allCourses, allPromotions] = await Promise.all([fetchCours(), fetchPromotions()]);
      if (mounted && !mounted.current) {
        return;
      }

      setAssignedCourses(allCourses.filter((course) => assignedCourseIds.includes(course.id)));
      setPromotions(allPromotions);
    } catch {
      if (mounted && !mounted.current) {
        return;
      }

      setAssignedCourses([]);
      setPromotions([]);
    }
  };

  const loadCourseStudents = async (mounted?: { current: boolean }, coursId = selectedCoursId) => {
    if (!coursId) {
      if (!mounted || mounted.current) {
        setCourseStudents([]);
      }
      return;
    }

    try {
      const students = await fetchStudentsForCours(coursId);
      if (mounted && !mounted.current) {
        return;
      }

      setCourseStudents(students);
    } catch {
      if (mounted && !mounted.current) {
        return;
      }

      setCourseStudents([]);
    }
  };

  useEffect(() => {
    // Je restaure le dernier cours choisi si l'utilisateur y a encore accès.
    const savedCourseId = Number(localStorage.getItem(TEACHER_SELECTED_COURSE_KEY));
    if (Number.isFinite(savedCourseId) && assignedCourseIds.includes(savedCourseId)) {
      setSelectedCoursId(savedCourseId);
      return;
    }

    setSelectedCoursId(assignedCourseIds[0] ?? null);
  }, [user?.id, user?.coursIds, user?.coursId]);

  useEffect(() => {
    // Le choix courant est persisté pour harmoniser cette page avec les autres vues enseignant.
    if (selectedCoursId == null) {
      localStorage.removeItem(TEACHER_SELECTED_COURSE_KEY);
      return;
    }

    localStorage.setItem(TEACHER_SELECTED_COURSE_KEY, String(selectedCoursId));
  }, [selectedCoursId]);

  useEffect(() => {
    // Je récupère le catalogue complet puis je filtre sur les cours réellement assignés.
    let mounted = true;

    void loadAssignedCourses({ current: mounted });

    return () => {
      mounted = false;
    };
  }, [assignedCourseIds, user?.id, user?.coursId, user?.coursIds]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void loadAssignedCourses();
    };

    const intervalId = window.setInterval(refreshIfVisible, TEACHER_REPORTS_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [assignedCourseIds, user?.id, user?.coursId, user?.coursIds]);

  useEffect(() => {
    let mounted = true;

    void loadCourseStudents({ current: mounted });

    return () => {
      mounted = false;
    };
  }, [selectedCoursId]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void loadCourseStudents();
    };

    const intervalId = window.setInterval(refreshIfVisible, TEACHER_REPORTS_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [selectedCoursId]);

  const [dailyDate, setDailyDate] = useState(toIsoDate(new Date()));
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[] | null>(null);

  const monday = getMondayOfWeek(new Date());
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const [weekStart, setWeekStart] = useState(toIsoDate(monday));
  const [weekEnd, setWeekEnd] = useState(toIsoDate(friday));
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[] | null>(null);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date()),
    []
  );

  const handleFetchDaily = async () => {
    // Ce chargement reste explicite pour permettre à l'utilisateur de rejouer la requête quand il change de date.
    if (!selectedCoursId) return;
    setDailyLoading(true);
    try {
      const records = await fetchAttendanceForCours(selectedCoursId, dailyDate);
      setDailyRecords(records);
    } catch {
      setDailyRecords([]);
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    // Le rapport journalier se recharge automatiquement quand le cours ou la date changent.
    if (!selectedCoursId) {
      setDailyRecords(null);
      return;
    }

    void handleFetchDaily();
  }, [selectedCoursId, dailyDate]);

  const handleFetchWeek = async () => {
    // La semaine se charge à la demande car la plage peut varier librement.
    if (!selectedCoursId) return;
    setWeekLoading(true);
    try {
      const records = await fetchAttendanceWeekForCours(selectedCoursId, weekStart, weekEnd);
      setWeekRecords(records);
    } catch {
      setWeekRecords([]);
    } finally {
      setWeekLoading(false);
    }
  };

  const selectedCourse = assignedCourses.find((course) => course.id === selectedCoursId) ?? null;
  const coursName = selectedCourse?.nom ?? `Cours #${selectedCoursId ?? '?'}`;

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Rapports de présence</h1>
            <p className="mt-0.5 text-xs text-slate-400">Générez des rapports PDF pour votre cours</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 capitalize">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            {todayLabel}
          </span>
        </header>

        <div className="p-8 max-w-4xl mx-auto">
          {/* J'affiche d'abord les contraintes d'affectation pour éviter une page vide incompréhensible. */}
          {assignedCourseIds.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 mb-6">
              Aucun cours assigné à votre compte. Contactez un administrateur.
            </div>
          )}

          {assignedCourseIds.length > 0 && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr] md:items-end">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cours du rapport</p>
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

          <Tabs defaultValue="daily">
            <TabsList className="mb-6">
              <TabsTrigger value="daily" className="gap-2">
                <Calendar className="w-4 h-4" /> Rapport journalier
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2">
                <CalendarDays className="w-4 h-4" /> Rapport hebdomadaire
              </TabsTrigger>
            </TabsList>

            {/* Daily tab */}
            <TabsContent value="daily">
              <Card className="shadow-sm border-slate-100">
                <CardHeader>
                  <CardTitle className="text-lg">Rapport du jour</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="daily-date">Date</Label>
                      <Input
                        id="daily-date"
                        type="date"
                        value={dailyDate}
                        onChange={e => setDailyDate(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleFetchDaily}
                      disabled={!selectedCoursId || dailyLoading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {dailyLoading && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                      Charger
                    </Button>
                  </div>

                  {dailyRecords !== null && (
                    <div>
                      {dailyRecords.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6">Aucune présence pour cette date.</p>
                      ) : (
                        <>
                          <div className="rounded-xl border border-slate-100 overflow-hidden mb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Nom</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Matricule</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Entrée</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Sortie</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Statut</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dailyRecords.map(r => (
                                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                                    <td className="px-3 py-2 font-medium text-slate-800">{r.studentName}</td>
                                    <td className="px-3 py-2 text-slate-600">{r.matricule}</td>
                                    <td className="px-3 py-2 text-slate-600">{r.checkIn || '--'}</td>
                                    <td className="px-3 py-2 text-slate-600">{r.checkOut || '--'}</td>
                                    <td className="px-3 py-2">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === 'Clôturé' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                        {r.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <Button
                            onClick={() => generateDailyPdf(dailyRecords, dailyDate, selectedCourse, courseStudents, promotions)}
                            className="gap-2 bg-slate-900 hover:bg-slate-800"
                          >
                            <Download className="w-4 h-4" />
                            Exporter en PDF ({dailyRecords.length} présence{dailyRecords.length > 1 ? 's' : ''})
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Weekly tab */}
            <TabsContent value="weekly">
              <Card className="shadow-sm border-slate-100">
                <CardHeader>
                  <CardTitle className="text-lg">Rapport de la semaine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[140px] space-y-1.5">
                      <Label htmlFor="week-start">Du</Label>
                      <Input
                        id="week-start"
                        type="date"
                        value={weekStart}
                        onChange={e => setWeekStart(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 min-w-[140px] space-y-1.5">
                      <Label htmlFor="week-end">Au</Label>
                      <Input
                        id="week-end"
                        type="date"
                        value={weekEnd}
                        onChange={e => setWeekEnd(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleFetchWeek}
                      disabled={!selectedCoursId || weekLoading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {weekLoading && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                      Charger
                    </Button>
                  </div>

                  {weekRecords !== null && (
                    <div>
                      {weekRecords.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6">Aucune présence pour cette période.</p>
                      ) : (
                        <>
                          <div className="rounded-xl border border-slate-100 overflow-hidden mb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Date</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Nom</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Matricule</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Entrée</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Sortie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {weekRecords.map(r => (
                                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                                    <td className="px-3 py-2 text-slate-500">{formatDate(r.date)}</td>
                                    <td className="px-3 py-2 font-medium text-slate-800">{r.studentName}</td>
                                    <td className="px-3 py-2 text-slate-600">{r.matricule}</td>
                                    <td className="px-3 py-2 text-slate-600">{r.checkIn || '--'}</td>
                                    <td className="px-3 py-2 text-slate-600">{r.checkOut || '--'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <Button
                            onClick={() => generateWeeklyPdf(weekRecords, weekStart, weekEnd, selectedCourse, courseStudents, promotions)}
                            className="gap-2 bg-slate-900 hover:bg-slate-800"
                          >
                            <Download className="w-4 h-4" />
                            Exporter en PDF ({weekRecords.length} présence{weekRecords.length > 1 ? 's' : ''})
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
