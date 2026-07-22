import { useEffect, useState } from 'react';
import { Loader2, Download, TrendingUp } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEligibilityForCours } from '@/lib/adminApi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfUsbLogo } from '@/lib/pdf';

interface EligibilityRow {
  studentId: string;
  matricule: string;
  studentName: string;
  attendedDays: number;
  courseDays: number;
  attendancePercentage: number;
  eligible: boolean;
}

async function generateEligibilityPdf(rows: EligibilityRow[], coursName: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 40;
  const rightMargin = 40;
  const logoWidth = 56;
  const { contentX, logoBottomY } = await addPdfUsbLogo(doc, { x: leftMargin, y: 24, width: logoWidth, gap: 14 });

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`RAPPORT D'ÉLIGIBILITÉ À L'EXAMEN`, pageWidth / 2, 44, { align: 'center' });

  const headerTop = 94;
  const labelColor: [number, number, number] = [33, 97, 191];
  const valueColor: [number, number, number] = [31, 41, 55];
  const metadata = [
    { label: 'Cours', value: coursName },
    { label: 'Date de génération', value: new Intl.DateTimeFormat('fr-FR').format(new Date()) },
  ];

  metadata.forEach((item, index) => {
    const y = headerTop + index * 20;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...labelColor);
    doc.text(`${item.label}:`, leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...valueColor);
    doc.text(item.value, leftMargin + 84, y);
  });

  autoTable(doc, {
    startY: Math.max(126, logoBottomY + 28),
    head: [['N°', 'Nom', 'Matricule', 'Jours présents', 'Total jours', 'Pourcentage', 'Éligible']],
    body: rows.map((r, index) => [
      String(index + 1),
      r.studentName,
      r.matricule,
      String(r.attendedDays),
      String(r.courseDays),
      `${r.attendancePercentage.toFixed(1)}%`,
      r.eligible ? 'Oui' : 'Non',
    ]),
    theme: 'grid',
    margin: { left: leftMargin, right: rightMargin, bottom: 30 },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      lineColor: [191, 219, 254],
      lineWidth: 0.6,
    },
    headStyles: {
      fillColor: [32, 89, 188],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [239, 246, 255],
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 160 },
      2: { cellWidth: 80, halign: 'center' },
      3: { cellWidth: 64, halign: 'center' },
      4: { cellWidth: 64, halign: 'center' },
      5: { cellWidth: 58, halign: 'center' },
      6: { cellWidth: 54, halign: 'center' },
    },
  });

  doc.save(`eligibilite_${coursName.toLowerCase().replace(/\s+/g, '_')}.pdf`);
}

export default function UtilisateurEligibilite() {
  // Cette page donne à l'enseignant la vue finale des seuils d'assiduité de son cours.
  const { user } = useAuth();
  const coursId = user?.coursId;

  const [rows, setRows] = useState<EligibilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Je charge la liste dès que le cours principal de l'utilisateur est connu.
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
    <div className="flex">
      <Sidebar />

      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Éligibilité à l'examen</h1>
            <p className="mt-0.5 text-xs text-slate-400">Étudiants de votre cours</p>
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
        </header>

        <div className="max-w-5xl mx-auto p-8">
          {/* Les cartes de synthèse permettent un diagnostic rapide avant le détail par étudiant. */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900">Synthèse de présence</h2>
            <p className="mt-1 text-sm text-slate-500">Vue globale de l’éligibilité selon l’assiduité enregistrée.</p>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total étudiants</p>
              <p className="mt-1 text-3xl font-bold text-slate-800">{total}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-green-600">Éligibles</p>
              <p className="mt-1 text-3xl font-bold text-green-600">{eligible}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-red-500">Non éligibles</p>
              <p className="mt-1 text-3xl font-bold text-red-500">{total - eligible}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : !loaded || rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center shadow-sm">
              <TrendingUp className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="font-medium text-slate-500">Aucune donnée de présence disponible</p>
              <p className="mt-1 text-sm text-slate-400">Les données apparaissent après les premières présences enregistrées.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Matricule</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Jours présents</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Total jours</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Taux</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Éligible</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.studentId} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.studentName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.matricule}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{row.attendedDays}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{row.courseDays}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${row.attendancePercentage >= 75 ? 'bg-green-500' : row.attendancePercentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, row.attendancePercentage)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{row.attendancePercentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.eligible ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">✅ Oui</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">❌ Non</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
