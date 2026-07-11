import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Loader2, ScanLine, Usb, Unplug, Users } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAttendanceForCours, fetchAttendanceWeekForCours, fetchCours } from '@/lib/adminApi';
import type { AttendanceRecord, Cours } from '@/lib/adminData';
import { serialSensor, type ConnectionState } from '@/lib/serialSensor';
import { toast } from 'sonner';

function getMondayOfWeek(date: Date): Date {
  const value = new Date(date);
  const day = value.getDay();
  const diff = value.getDate() - day + (day === 0 ? -6 : 1);
  value.setDate(diff);
  return value;
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function UtilisateurTableauDeBord() {
  // Le tableau de bord enseignant reprend les chiffres utiles sans exposer toute la complexité admin.
  const { user } = useAuth();
  const assignedCourseIds = user?.coursIds ?? (user?.coursId != null ? [user.coursId] : []);
  const [assignedCourses, setAssignedCourses] = useState<Cours[]>([]);
  const [selectedCoursId, setSelectedCoursId] = useState<number | null>(assignedCourseIds[0] ?? null);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => serialSensor.state);
  const serialSupportError = serialSensor.getSupportError();

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date()),
    []
  );
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const weekStart = useMemo(() => toIsoDate(getMondayOfWeek(new Date())), []);
  const weekEnd = useMemo(() => {
    const friday = new Date(getMondayOfWeek(new Date()));
    friday.setDate(friday.getDate() + 4);
    return toIsoDate(friday);
  }, []);

  const selectedCourse = assignedCourses.find((course) => course.id === selectedCoursId) ?? null;

  useEffect(() => serialSensor.onConnectionChange(setConnectionState), []);

  useEffect(() => {
    // Par défaut, je sélectionne le premier cours affecté à l'enseignant connecté.
    setSelectedCoursId(assignedCourseIds[0] ?? null);
  }, [user?.id]);

  useEffect(() => {
    // Le catalogue complet est filtré côté client pour n'afficher que les cours assignés.
    let mounted = true;

    const loadCourses = async () => {
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

    void loadCourses();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    // Le changement de cours entraîne le rechargement des chiffres du jour et de la semaine.
    let mounted = true;

    const loadStats = async () => {
      if (!selectedCoursId) {
        setTodayRecords([]);
        setWeekRecords([]);
        return;
      }

      setLoading(true);
      try {
        const [todayRows, weekRows] = await Promise.all([
          fetchAttendanceForCours(selectedCoursId, todayIso),
          fetchAttendanceWeekForCours(selectedCoursId, weekStart, weekEnd),
        ]);

        if (!mounted) {
          return;
        }

        setTodayRecords(todayRows);
        setWeekRecords(weekRows);
      } catch {
        if (!mounted) {
          return;
        }

        setTodayRecords([]);
        setWeekRecords([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      mounted = false;
    };
  }, [selectedCoursId, todayIso, weekStart, weekEnd]);

  const uniqueStudentsWeek = useMemo(
    () => new Set(weekRecords.map((record) => record.studentId)).size,
    [weekRecords]
  );
  const completedToday = useMemo(
    () => todayRecords.filter((record) => record.checkOut).length,
    [todayRecords]
  );
  const pendingToday = todayRecords.length - completedToday;
  const openWeek = useMemo(
    () => weekRecords.filter((record) => !record.checkOut).length,
    [weekRecords]
  );

  const quickMetrics = [
    {
      title: 'Pointages du jour',
      value: todayRecords.length,
      hint: 'Total des entrées et sorties enregistrées aujourd hui',
      icon: ScanLine,
    },
    {
      title: 'Sorties complètes',
      value: completedToday,
      hint: 'Étudiants ayant déjà pointé leur sortie',
      icon: CheckCircle2,
    },
    {
      title: 'En attente',
      value: pendingToday,
      hint: 'Présences ouvertes sans sortie enregistrée',
      icon: Clock3,
    },
    {
      title: 'Étudiants cette semaine',
      value: uniqueStudentsWeek,
      hint: 'Étudiants distincts vus sur la semaine en cours',
      icon: Users,
    },
  ];

  return (
    <div className="flex">
      <Sidebar />

      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Vue d'ensemble</h1>
            <p className="mt-0.5 text-xs text-slate-400">Statistiques de présence de vos cours</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 capitalize">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            {todayLabel}
          </span>
        </header>

        <div className="p-8 space-y-6">
          {/* Le bandeau capteur donne à l'enseignant le même niveau d'information qu'à l'administration. */}
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
                  {connectionState === 'connected' ? 'Capteur connecté · prêt au pointage' :
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
            <p className="-mt-4 text-xs text-amber-700">{serialSupportError}</p>
          )}

          {assignedCourseIds.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
              Aucun cours assigné à votre compte. Contactez un administrateur.
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Cours actif</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sélection du cours</p>
                    <Select value={selectedCoursId ? String(selectedCoursId) : 'none'} onValueChange={(value) => setSelectedCoursId(value === 'none' ? null : Number(value))}>
                      <SelectTrigger>
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horaire</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{selectedCourse?.heureDebut || '--:--'} à {selectedCourse?.heureFin || '--:--'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{selectedCourse?.code || 'Non défini'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Résumé semaine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Total pointages semaine</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{weekRecords.length}</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="text-xs text-blue-600">Présences encore ouvertes</p>
                    <p className="mt-1 text-2xl font-bold text-blue-700">{openWeek}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {quickMetrics.map((metric) => (
              <div key={metric.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
                  <metric.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{loading ? '--' : metric.value}</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{metric.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{metric.hint}</p>
              </div>
            ))}
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Lecture rapide</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des statistiques...
                </div>
              ) : selectedCoursId == null ? (
                <p className="text-sm text-slate-500">Sélectionnez un cours pour afficher ses statistiques.</p>
              ) : todayRecords.length === 0 && weekRecords.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun pointage enregistré pour ce cours sur la période en cours.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Aujourd hui</p>
                    <p className="mt-1 text-sm text-emerald-900">{completedToday} sortie(s) déjà finalisée(s).</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">En attente</p>
                    <p className="mt-1 text-sm text-amber-900">{pendingToday} présence(s) ouverte(s) sans sortie.</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semaine</p>
                    <p className="mt-1 text-sm text-slate-800">{uniqueStudentsWeek} étudiant(s) différent(s) ont déjà été pointés.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}