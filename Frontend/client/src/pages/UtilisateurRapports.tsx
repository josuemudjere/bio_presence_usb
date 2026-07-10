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
import { fetchAttendanceForCours, fetchAttendanceWeekForCours, fetchCours } from '@/lib/adminApi';
import type { AttendanceRecord, Cours } from '@/lib/adminData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TEACHER_SELECTED_COURSE_KEY = 'biopresence_teacher_selected_course';

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

function generateDailyPdf(records: AttendanceRecord[], date: string, coursName: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Rapport de présence — ${coursName}`, 14, 18);
  doc.setFontSize(11);
  doc.text(`Date : ${formatDate(date)}`, 14, 28);
  doc.text(`Généré le : ${new Intl.DateTimeFormat('fr-FR').format(new Date())}`, 14, 34);

  autoTable(doc, {
    startY: 42,
    head: [['Nom', 'Matricule', 'Département', 'Entrée', 'Sortie', 'Statut']],
    body: records.map(r => [
      r.studentName,
      r.matricule,
      r.department,
      r.checkIn || '--',
      r.checkOut || '--',
      r.status === 'Clôturé' ? 'Clôturé' : 'En cours',
    ]),
    headStyles: { fillColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`presence_${date}.pdf`);
}

function generateWeeklyPdf(records: AttendanceRecord[], startDate: string, endDate: string, coursName: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(`Rapport hebdomadaire — ${coursName}`, 14, 18);
  doc.setFontSize(11);
  doc.text(`Semaine du ${formatDate(startDate)} au ${formatDate(endDate)}`, 14, 28);
  doc.text(`Généré le : ${new Intl.DateTimeFormat('fr-FR').format(new Date())}`, 14, 34);

  autoTable(doc, {
    startY: 42,
    head: [['Date', 'Nom', 'Matricule', 'Département', 'Entrée', 'Sortie', 'Statut']],
    body: records.map(r => [
      formatDate(r.date),
      r.studentName,
      r.matricule,
      r.department,
      r.checkIn || '--',
      r.checkOut || '--',
      r.status === 'Clôturé' ? 'Clôturé' : 'En cours',
    ]),
    headStyles: { fillColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`presence_semaine_${startDate}_${endDate}.pdf`);
}

export default function UtilisateurRapports() {
  const { user } = useAuth();
  const assignedCourseIds = user?.coursIds ?? (user?.coursId != null ? [user.coursId] : []);
  const [assignedCourses, setAssignedCourses] = useState<Cours[]>([]);
  const [selectedCoursId, setSelectedCoursId] = useState<number | null>(assignedCourseIds[0] ?? null);

  useEffect(() => {
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
    let mounted = true;

    const loadAssignedCourses = async () => {
      try {
        const allCourses = await fetchCours();
        if (!mounted) {
          return;
        }
        setAssignedCourses(allCourses.filter((course) => assignedCourseIds.includes(course.id)));
      } catch {
        if (!mounted) {
          return;
        }
        setAssignedCourses([]);
      }
    };

    void loadAssignedCourses();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

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
    if (!selectedCoursId) {
      setDailyRecords(null);
      return;
    }

    void handleFetchDaily();
  }, [selectedCoursId, dailyDate]);

  const handleFetchWeek = async () => {
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
                            onClick={() => generateDailyPdf(dailyRecords, dailyDate, coursName)}
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
                            onClick={() => generateWeeklyPdf(weekRecords, weekStart, weekEnd, coursName)}
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
