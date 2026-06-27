import { useEffect, useState } from 'react';
import { CheckSquare, Loader2, Download, TrendingUp } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEligibilityForCours } from '@/lib/adminApi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EligibilityRow {
  studentId: string;
  matricule: string;
  studentName: string;
  attendedDays: number;
  courseDays: number;
  attendancePercentage: number;
  eligible: boolean;
}

function generateEligibilityPdf(rows: EligibilityRow[], coursName: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Éligibilité à l'examen — ${coursName}`, 14, 18);
  doc.setFontSize(11);
  doc.text(`Généré le : ${new Intl.DateTimeFormat('fr-FR').format(new Date())}`, 14, 28);

  autoTable(doc, {
    startY: 36,
    head: [['Nom', 'Matricule', 'Jours présents', 'Total jours', 'Pourcentage', 'Éligible']],
    body: rows.map(r => [
      r.studentName,
      r.matricule,
      r.attendedDays,
      r.courseDays,
      `${r.attendancePercentage.toFixed(1)}%`,
      r.eligible ? 'Oui' : 'Non',
    ]),
    headStyles: { fillColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`eligibilite_${coursName.toLowerCase().replace(/\s+/g, '_')}.pdf`);
}

export default function UtilisateurEligibilite() {
  const { user } = useAuth();
  const coursId = user?.coursId;

  const [rows, setRows] = useState<EligibilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!coursId) return;
    setLoading(true);
    fetchEligibilityForCours(coursId)
      .then(data => { setRows(data); setLoaded(true); })
      .catch(() => { setRows([]); setLoaded(true); })
      .finally(() => setLoading(false));
  }, [coursId]);

  const eligible = rows.filter(r => r.eligible).length;
  const total = rows.length;
  const coursName = `Cours #${coursId ?? '?'}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <Sidebar />
      <div className="pl-64">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <CheckSquare className="w-8 h-8 text-blue-600" />
                Éligibilité à l'examen
              </h1>
              <p className="text-slate-500 mt-1">Étudiants de votre cours</p>
            </div>
            {rows.length > 0 && (
              <Button
                onClick={() => generateEligibilityPdf(rows, coursName)}
                className="gap-2 bg-slate-900 hover:bg-slate-800"
              >
                <Download className="w-4 h-4" />
                Exporter PDF
              </Button>
            )}
          </div>

          {!coursId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 mb-6">
              Aucun cours assigné à votre compte. Contactez un administrateur.
            </div>
          )}

          {/* Summary cards */}
          {loaded && rows.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total étudiants</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{total}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Éligibles</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{eligible}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-red-500 font-medium uppercase tracking-wider">Non éligibles</p>
                <p className="text-3xl font-bold text-red-500 mt-1">{total - eligible}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : !loaded || rows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-16">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Aucune donnée de présence disponible</p>
              <p className="text-slate-400 text-sm mt-1">Les données apparaissent après les premières présences enregistrées.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nom</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Matricule</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jours présents</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total jours</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Taux</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Éligible</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.studentId} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.studentName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.matricule}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{r.attendedDays}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{r.courseDays}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${r.attendancePercentage >= 75 ? 'bg-green-500' : r.attendancePercentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, r.attendancePercentage)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{r.attendancePercentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.eligible
                          ? <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">✅ Oui</span>
                          : <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">❌ Non</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
