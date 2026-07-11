import { useEffect, useMemo, useState } from 'react';
import { Users, Fingerprint, Clock, FileSpreadsheet, ArrowRight, CalendarDays, Usb, Unplug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Sidebar from '@/components/Sidebar';
import { Link } from 'wouter';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  loadAttendanceRecords,
  loadExportsCount,
  loadStudents,
  type AttendanceRecord,
  type Student,
} from '@/lib/adminData';
import { serialSensor, type ConnectionState } from '@/lib/serialSensor';

/**
 * Interface Administrateur - Tableau de bord
 * Design: Modern Enterprise avec accent biométrique
 * Couleurs: Bleu profond (#0052CC), Vert émeraude (succès), Gris ardoise
 */

const adminSteps = [
  'Créer ou mettre à jour la fiche de l\'étudiant.',
  'Enrôler l\'empreinte digitale depuis la vue admin.',
  'Scanner l\'étudiant pour enregistrer l\'entrée puis la sortie.',
  'Contrôler la liste de présence et exporter le relevé PDF.',
];

const adminHighlights = [
  {
    title: 'Enrôlement centralisé',
    description: 'L\'administrateur gère toutes les empreintes depuis un seul écran, sans interface capteur séparée.',
  },
  {
    title: 'Pointage entrée / sortie',
    description: 'Chaque scan met à jour directement la présence avec horodatage précis pour l\'entrée et la sortie.',
  },
  {
    title: 'Reporting prêt à exporter',
    description: 'Le registre quotidien est préparé pour export PDF et contrôle administratif.',
  },
];

export default function AdminDashboard() {
  // Le tableau de bord admin synthétise l'activité du registre et l'état du capteur.
  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => loadAttendanceRecords());
  const [exportsCount, setExportsCount] = useState<number>(() => loadExportsCount());
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => serialSensor.state);
  const serialSupportError = serialSensor.getSupportError();

  useEffect(() => serialSensor.onConnectionChange(setConnectionState), []);

  useEffect(() => {
    // Je rafraîchis les métriques quand la page reprend le focus ou qu'un autre onglet modifie le stockage.
    const refreshMetrics = () => {
      setStudents(loadStudents());
      setAttendanceRecords(loadAttendanceRecords());
      setExportsCount(loadExportsCount());
    };

    window.addEventListener('focus', refreshMetrics);
    window.addEventListener('storage', refreshMetrics);

    return () => {
      window.removeEventListener('focus', refreshMetrics);
      window.removeEventListener('storage', refreshMetrics);
    };
  }, []);

  // Ces bornes temporelles servent à agréger les statistiques quotidiennes et hebdomadaires.
  const today = useMemo(() => new Intl.DateTimeFormat('sv-SE').format(new Date()), []);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date()),
    []
  );
  const attendanceToday = attendanceRecords.filter((record) => record.date === today);
  const activeFingerprints = students.filter((student) => student.fingerprintRegistered).length;
  const checkOutCount = attendanceToday.filter((record) => record.checkOut).length;

  const [statFilter, setStatFilter] = useState<'daily' | 'weekly'>('daily');

  // Je construis une fenêtre glissante sur sept jours pour alimenter les graphes de tendance.
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return new Intl.DateTimeFormat('sv-SE').format(d);
    });
  }, []);

  const weeklyRecords = useMemo(
    () => attendanceRecords.filter((r) => last7Days.includes(r.date)),
    [attendanceRecords, last7Days]
  );

  const weeklyByDay = useMemo(
    () =>
      last7Days.map((date) => {
        const dayRecords = attendanceRecords.filter((r) => r.date === date);
        return {
          date,
          label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(
            new Date(date + 'T00:00:00')
          ),
          count: dayRecords.length,
          completed: dayRecords.filter((r) => r.checkOut).length,
        };
      }),
    [attendanceRecords, last7Days]
  );

  const maxDayCount = useMemo(() => Math.max(...weeklyByDay.map((d) => d.count), 1), [weeklyByDay]);

  const dailyStats = useMemo(
    () => ({
      total: attendanceToday.length,
      completed: attendanceToday.filter((r) => r.checkOut).length,
      pending: attendanceToday.filter((r) => !r.checkOut).length,
      records: attendanceToday,
    }),
    [attendanceToday]
  );

  const hourlyChartData = useMemo(() => {
    type HourBucket = { heure: string; entrées: number; sorties: number };
    const buckets: Record<number, HourBucket> = {};
    for (const record of attendanceToday) {
      const inHour = parseInt(record.checkIn.split(':')[0], 10);
      if (!buckets[inHour]) {
        buckets[inHour] = { heure: `${String(inHour).padStart(2, '0')}h`, entrées: 0, sorties: 0 };
      }
      buckets[inHour].entrées++;
      if (record.checkOut) {
        const outHour = parseInt(record.checkOut.split(':')[0], 10);
        if (!buckets[outHour]) {
          buckets[outHour] = { heure: `${String(outHour).padStart(2, '0')}h`, entrées: 0, sorties: 0 };
        }
        buckets[outHour].sorties++;
      }
    }
    return Object.values(buckets).sort((a, b) => parseInt(a.heure) - parseInt(b.heure));
  }, [attendanceToday]);

  const weeklyChartData = useMemo(
    () =>
      weeklyByDay.map((day) => ({
        jour: day.label,
        présences: day.count,
        sorties: day.completed,
        isToday: day.date === today,
      })),
    [weeklyByDay, today]
  );

  const quickMetrics = [
    {
      title: 'Étudiants enrôlés',
      value: String(students.length),
      hint: students.length === 0 ? 'Aucun étudiant enregistré' : `${students.length} étudiant(s) au registre`,
      icon: Users,
    },
    {
      title: 'Empreintes actives',
      value: String(activeFingerprints),
      hint: activeFingerprints === 0 ? 'Aucune empreinte enrôlée' : `${activeFingerprints} empreinte(s) disponible(s)`,
      icon: Fingerprint,
    },
    {
      title: 'Présences du jour',
      value: String(attendanceToday.length),
      hint: attendanceToday.length === 0 ? 'Aucun scan effectué' : `${checkOutCount} sortie(s) déjà pointée(s)`,
      icon: Clock,
    },
    {
      title: 'Exports PDF',
      value: String(exportsCount),
      hint: exportsCount === 0 ? 'Aucun export généré' : `${exportsCount} export(s) généré(s)`,
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="flex">
      <Sidebar userName="Admin Administrateur" />

      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        {/* Page Header */}
        <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Vue d'ensemble</h1>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{todayLabel}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            {todayLabel}
          </span>
        </header>

        <div className="p-8 space-y-8">
          {/* Ce bandeau remonte l'état de connexion réel du capteur sans quitter le tableau de bord. */}
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
                  {connectionState === 'connected' ? 'Capteur connecté · prêt à l utilisation' :
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
            <p className="-mt-6 text-xs text-amber-700">{serialSupportError}</p>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-5">
            {quickMetrics.map((metric) => (
              <div key={metric.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
                    <metric.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{metric.value}</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{metric.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{metric.hint}</p>
              </div>
            ))}
          </div>

          {/* Statistiques de présence */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Statistiques de présence</h2>
                <p className="mt-0.5 text-xs text-slate-400">Données issues des pointages biométriques</p>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  onClick={() => setStatFilter('daily')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    statFilter === 'daily'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Aujourd'hui
                </button>
                <button
                  onClick={() => setStatFilter('weekly')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    statFilter === 'weekly'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Cette semaine
                </button>
              </div>
            </div>

            {statFilter === 'daily' ? (
              <div className="mt-5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{dailyStats.total}</p>
                    <p className="mt-1 text-xs text-slate-500">Total pointages</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{dailyStats.completed}</p>
                    <p className="mt-1 text-xs text-emerald-600">Sorties complètes</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">{dailyStats.pending}</p>
                    <p className="mt-1 text-xs text-amber-600">En attente de sortie</p>
                  </div>
                </div>

                {hourlyChartData.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                    Aucun pointage enregistré aujourd'hui.
                  </div>
                ) : (
                  <div className="mt-5">
                    <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                        Entrées
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                        Sorties
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={hourlyChartData} barCategoryGap="30%" barGap={3}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="heure"
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          width={24}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        <Bar dataKey="entrées" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                        <Bar dataKey="sorties" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5">
                <div className="mb-6 grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{weeklyRecords.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Total 7 jours</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">
                      {weeklyRecords.filter((r) => r.checkOut).length}
                    </p>
                    <p className="mt-1 text-xs text-blue-600">Sorties complètes</p>
                  </div>
                  <div className="rounded-xl bg-primary/5 p-4 text-center">
                    <p className="text-2xl font-bold text-primary">
                      {weeklyRecords.length > 0 ? (weeklyRecords.length / 7).toFixed(1) : '0'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Moy. / jour</p>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                    Présences
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                    Sorties complètes
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyChartData} barCategoryGap="30%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="jour"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={24}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="présences" radius={[4, 4, 0, 0]} maxBarSize={36}>
                      {weeklyChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isToday ? 'hsl(var(--primary))' : '#bfdbfe'}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="sorties" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Workflow */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Guide pour administrateur</h2>
              <p className="mt-0.5 text-xs text-slate-400">Suivez ces étapes pour gérer le cycle biométrique complet.</p>
              <div className="mt-5 space-y-3">
                {adminSteps.map((step, index) => (
                  <div key={step} className="flex items-start gap-4 rounded-xl bg-slate-50 px-4 py-3.5 transition-colors hover:bg-slate-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white mt-0.5">
                      {index + 1}
                    </span>
                    <p className="text-sm text-slate-600 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
              <Link href="/admin/etudiants">
                <Button className="mt-6 w-full gap-2 rounded-xl bg-primary text-white hover:bg-primary/90 shadow-sm">
                  Ouvrir l'espace étudiants & présences
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Highlights */}
            <div className="rounded-2xl bg-gradient-to-b from-primary to-blue-800 p-6 text-white shadow-xl">
              <h2 className="text-base font-semibold">Capacités admin actives</h2>
              <p className="mt-0.5 text-xs text-blue-200">Fonctionnalités clés du système BioPresence.</p>
              <div className="mt-5 space-y-3">
                {adminHighlights.map((highlight) => (
                  <div key={highlight.title} className="rounded-xl border border-white/10 bg-white/10 p-4">
                    <p className="text-sm font-semibold">{highlight.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-blue-100">{highlight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
