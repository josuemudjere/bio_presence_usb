import { useState } from 'react';
import { FileText, Download, Calendar, CalendarDays, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAttendanceForCours, fetchAttendanceWeekForCours } from '@/lib/adminApi';
import type { AttendanceRecord } from '@/lib/adminData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const coursId = user?.coursId;

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

  const handleFetchDaily = async () => {
    if (!coursId) return;
    setDailyLoading(true);
    try {
      const records = await fetchAttendanceForCours(coursId, dailyDate);
      setDailyRecords(records);
    } catch {
      setDailyRecords([]);
    } finally {
      setDailyLoading(false);
    }
  };

  const handleFetchWeek = async () => {
    if (!coursId) return;
    setWeekLoading(true);
    try {
      const records = await fetchAttendanceWeekForCours(coursId, weekStart, weekEnd);
      setWeekRecords(records);
    } catch {
      setWeekRecords([]);
    } finally {
      setWeekLoading(false);
    }
  };

  const coursName = `Cours #${coursId ?? '?'}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <Sidebar />
      <div className="pl-64">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Rapports de présence
            </h1>
            <p className="text-slate-500 mt-1">Générez des rapports PDF pour votre cours</p>
          </div>

          {!coursId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 mb-6">
              Aucun cours assigné à votre compte. Contactez un administrateur.
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
                      disabled={!coursId || dailyLoading}
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
                            Télécharger PDF ({dailyRecords.length} enregistrement{dailyRecords.length > 1 ? 's' : ''})
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
                      disabled={!coursId || weekLoading}
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
                            Télécharger PDF ({weekRecords.length} enregistrement{weekRecords.length > 1 ? 's' : ''})
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
      </div>
    </div>
  );
}
