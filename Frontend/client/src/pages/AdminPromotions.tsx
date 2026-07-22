import { useEffect, useState } from 'react';
import { BookCopy, GraduationCap, Layers3, Loader2, Pencil, Plus, Trash2, X, Save } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Cours, Promotion, Departement, Filiere, Programme } from '@/lib/adminData';
import {
  createDepartement,
  createProgramme,
  createPromotion,
  deleteDepartement,
  deleteProgramme,
  deletePromotion,
  fetchCours,
  fetchCyclesLmd,
  fetchDepartements,
  fetchFilieres,
  fetchProgrammes,
  fetchPromotions,
  resyncStudentInscriptions,
  updateDepartement,
  updateProgramme,
  updatePromotion,
} from '@/lib/adminApi';

const emptyForm = {
  niveau: '',
  description: '',
  departement: '',
  programme: '',
  filiereId: null as number | null,
  coursIds: [] as string[],
};

export default function AdminPromotions() {
  // Cet écran relie une promotion à son département, sa filière et son panier de cours.
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [cours, setCours] = useState<Cours[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resyncing, setResyncing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [cyclesLmd, setCyclesLmd] = useState<Array<'LICENCE' | 'MASTER' | 'DOCTORAT'>>([]);
  const [newDepartementNom, setNewDepartementNom] = useState('');
  const [newDepartementCode, setNewDepartementCode] = useState('');
  const [newProgrammeNom, setNewProgrammeNom] = useState('');
  const [newProgrammeCode, setNewProgrammeCode] = useState('');
  const [newProgrammeCycle, setNewProgrammeCycle] = useState<'LICENCE' | 'MASTER' | 'DOCTORAT'>('LICENCE');
  const [newProgrammeDuree, setNewProgrammeDuree] = useState('6');
  const [newProgrammeCredits, setNewProgrammeCredits] = useState('180');

  useEffect(() => {
    // Je charge les promotions et les listes de sélection pour alimenter l’écran.
    setLoading(true);
    Promise.all([fetchPromotions(), fetchCours(), fetchDepartements(), fetchFilieres(), fetchProgrammes(), fetchCyclesLmd()])
      .then(([promotionRows, coursRows, departementRows, filiereRows, programmeRows, cyclesRows]) => {
        setPromotions(promotionRows);
        setCours(coursRows);
        setDepartements(departementRows);
        setFilieres(filiereRows);
        setProgrammes(programmeRows);
        setCyclesLmd(cyclesRows);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Impossible de charger les promotions.');
      })
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    // En création, le formulaire repart d'un état neutre.
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (promotion: Promotion) => {
    // En édition, je convertis les ids de cours en chaînes pour les checkboxes contrôlées.
    setEditingId(promotion.id);
    setForm({
      niveau: promotion.niveau,
      description: promotion.description ?? '',
      departement: promotion.departement,
      programme: promotion.programme,
      filiereId: promotion.filiereId ?? null,
      coursIds: promotion.coursIds.map(String),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Une promotion sans rattachement ni cours n'est pas exploitable côté enrôlement.
    if (!form.niveau.trim() || !form.departement.trim() || !form.programme.trim() || form.coursIds.length === 0) {
      toast.error('Renseignez le niveau, le département, la filière et au moins un cours.');
      return;
    }

    const selectedFiliere = form.filiereId !== null ? filieres.find((item) => item.id === form.filiereId) : null;
    const resolvedDepartement = selectedFiliere
      ? departements.find((item) => item.id === selectedFiliere.departementId)?.nom ?? form.departement.trim()
      : form.departement.trim();
    const resolvedProgramme = selectedFiliere ? selectedFiliere.nom : form.programme.trim();

    setSaving(true);
    try {
      // Le backend attend à la fois un nom et un niveau, je garde les deux alignés ici.
      const payload = {
        nom: form.niveau.trim(),
        niveau: form.niveau.trim(),
        description: form.description.trim() || undefined,
        departement: resolvedDepartement,
        programme: resolvedProgramme,
        filiereId: form.filiereId,
        coursIds: form.coursIds.map(Number),
      };

      if (editingId !== null) {
        const updated = await updatePromotion(editingId, payload);
        setPromotions((current) => current.map((item) => (item.id === editingId ? updated : item)));
        toast.success('Promotion mise à jour.');
      } else {
        const created = await createPromotion(payload);
        setPromotions((current) => [...current, created]);
        toast.success('Promotion créée.');
      }

      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer la promotion.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    // Je n'immobilise que la carte ciblée pendant la suppression.
    setDeletingId(id);
    try {
      await deletePromotion(id);
      setPromotions((current) => current.filter((item) => item.id !== id));
      toast.success('Promotion supprimée.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de supprimer la promotion.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResyncInscriptions = async () => {
    setResyncing(true);
    try {
      const result = await resyncStudentInscriptions();
      toast.success(`${result.message} ${result.syncedStudents} étudiant(s) recalculé(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de resynchroniser les inscriptions.');
    } finally {
      setResyncing(false);
    }
  };

  const refreshAcademicCatalog = async () => {
    const [departementRows, programmeRows] = await Promise.all([fetchDepartements(), fetchProgrammes()]);
    setDepartements(departementRows);
    setProgrammes(programmeRows);
  };

  const handleCreateOrUpdateDepartement = async () => {
    if (!newDepartementNom.trim() || !newDepartementCode.trim()) {
      toast.error('Le nom et le code du département sont obligatoires.');
      return;
    }

    try {
      const existing = departements.find((item) => item.code.toUpperCase() === newDepartementCode.trim().toUpperCase());
      if (existing) {
        await updateDepartement(existing.id, { nom: newDepartementNom.trim(), code: newDepartementCode.trim().toUpperCase() });
        toast.success('Département mis à jour.');
      } else {
        await createDepartement({ nom: newDepartementNom.trim(), code: newDepartementCode.trim().toUpperCase() });
        toast.success('Département créé.');
      }
      setNewDepartementNom('');
      setNewDepartementCode('');
      await refreshAcademicCatalog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d\'enregistrer le département.');
    }
  };

  const handleDeleteDepartement = async (departementId: number) => {
    try {
      await deleteDepartement(departementId);
      await refreshAcademicCatalog();
      toast.success('Département supprimé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de supprimer le département.');
    }
  };

  const handleCreateOrUpdateProgramme = async () => {
    if (!newProgrammeNom.trim() || !newProgrammeCode.trim()) {
      toast.error('Le nom et le code du programme sont obligatoires.');
      return;
    }

    const dureeSemestres = Math.max(1, parseInt(newProgrammeDuree || '1'));
    const totalCredits = Math.max(1, parseInt(newProgrammeCredits || '1'));

    try {
      const existing = programmes.find((item) => item.code.toUpperCase() === newProgrammeCode.trim().toUpperCase());
      const payload = {
        nom: newProgrammeNom.trim(),
        code: newProgrammeCode.trim().toUpperCase(),
        cycle: newProgrammeCycle,
        dureeSemestres,
        totalCredits,
      };

      if (existing) {
        await updateProgramme(existing.id, payload);
        toast.success('Programme mis à jour.');
      } else {
        await createProgramme(payload);
        toast.success('Programme créé.');
      }

      setNewProgrammeNom('');
      setNewProgrammeCode('');
      await refreshAcademicCatalog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d\'enregistrer le programme.');
    }
  };

  const handleDeleteProgramme = async (programmeId: number) => {
    try {
      await deleteProgramme(programmeId);
      await refreshAcademicCatalog();
      toast.success('Programme supprimé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de supprimer le programme.');
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        {/* L'administration des promotions est pensée comme un référentiel peu fréquent mais structurant. */}
        <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Promotions</h1>
            <p className="text-xs text-slate-400 mt-0.5">Configurez les promotions, départements et filières utilisées à l’enrôlement.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleResyncInscriptions} disabled={resyncing} className="gap-2">
              {resyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Resynchroniser les inscriptions
            </Button>
            <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="w-4 h-4" /> Nouvelle promotion
            </Button>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : promotions.length === 0 ? (
            <Card className="text-center py-16 border-dashed border-2 border-slate-200">
              <CardContent>
                <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Aucune promotion configurée</p>
                <p className="text-slate-400 text-sm mt-1">Créez une promotion pour alimenter les listes déroulantes d’enrôlement.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {promotions.map((promotion) => (
                <Card key={promotion.id} className="shadow-sm hover:shadow-md transition-shadow border-slate-100">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        <Layers3 className="w-3.5 h-3.5" />
                        {promotion.niveau}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => openEdit(promotion)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => handleDelete(promotion.id)}
                          disabled={deletingId === promotion.id}
                        >
                          {deletingId === promotion.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-600">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-sky-500" />
                        <span>{promotion.departement || 'Département non défini'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookCopy className="w-4 h-4 text-indigo-500" />
                        <span>{promotion.programme || 'Filière non définie'}</span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      {promotion.description?.trim() || 'Les étudiants de cette promotion recevront les cours cochés dans cette configuration.'}
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      <span>Cours inclus</span>
                      <span className="font-semibold text-slate-700">{promotion.coursIds.length}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* La modale concentre toute la configuration d'une promotion pour éviter de fragmenter le flux. */}
        <DialogContent className="sm:max-w-[560px] p-0 gap-0 rounded-2xl border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-900 px-6 py-5 rounded-t-2xl">
            <DialogTitle className="text-white text-lg font-bold">
              {editingId !== null ? 'Modifier la promotion' : 'Nouvelle promotion'}
            </DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="promotion-niveau">Niveau *</Label>
              <Input id="promotion-niveau" placeholder="Saisir le niveau de la promotion" value={form.niveau} onChange={(e) => setForm((current) => ({ ...current, niveau: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                <Label htmlFor="promotion-departement">Département *</Label>
                <Select value={form.departement || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, departement: value === 'none' ? '' : value }))}>
                  <SelectTrigger id="promotion-departement" className="w-full">
                    <SelectValue placeholder="Sélectionner un département" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sélectionner un département</SelectItem>
                    {departements.map((item) => (
                      <SelectItem key={item.id} value={item.nom}>{item.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promotion-filiere">Filière</Label>
                <Select value={form.filiereId !== null ? String(form.filiereId) : 'none'} onValueChange={(value) => {
                  const selectedId = value === 'none' ? null : Number(value);
                  const selectedFiliere = selectedId === null ? null : filieres.find((item) => item.id === selectedId);
                  setForm((current) => ({
                    ...current,
                    filiereId: selectedId,
                    departement: selectedFiliere ? (departements.find((item) => item.id === selectedFiliere.departementId)?.nom ?? current.departement) : current.departement,
                    programme: selectedFiliere ? selectedFiliere.nom : current.programme,
                  }));
                }}>
                  <SelectTrigger id="promotion-filiere" className="w-full">
                    <SelectValue placeholder="Sélectionner une filière existante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune filière sélectionnée</SelectItem>
                    {filieres.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promotion-programme">Filière *</Label>
                <Select value={form.programme || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, programme: value === 'none' ? '' : value }))}>
                  <SelectTrigger id="promotion-programme" className="w-full">
                    <SelectValue placeholder="Sélectionner une filière" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sélectionner une filière</SelectItem>
                    {programmes.map((item) => (
                      <SelectItem key={item.id} value={item.nom}>{`${item.nom} (${item.cycle})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Référentiel académique (cycles, départements, filières)</p>

              <div className="grid gap-3 md:grid-cols-[1fr_120px_120px]">
                <Input placeholder="Nom département" value={newDepartementNom} onChange={(e) => setNewDepartementNom(e.target.value)} />
                <Input placeholder="Code" value={newDepartementCode} onChange={(e) => setNewDepartementCode(e.target.value)} />
                <Button type="button" onClick={handleCreateOrUpdateDepartement}>Ajouter/Maj</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {departements.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600"
                    onClick={() => {
                      setNewDepartementNom(item.nom);
                      setNewDepartementCode(item.code);
                    }}
                    onDoubleClick={() => void handleDeleteDepartement(item.id)}
                    title="Double-cliquez pour supprimer"
                  >
                    {item.nom} ({item.code})
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <Input className="md:col-span-2" placeholder="Nom filière" value={newProgrammeNom} onChange={(e) => setNewProgrammeNom(e.target.value)} />
                <Input placeholder="Code" value={newProgrammeCode} onChange={(e) => setNewProgrammeCode(e.target.value)} />
                <Select value={newProgrammeCycle} onValueChange={(value: 'LICENCE' | 'MASTER' | 'DOCTORAT') => {
                  setNewProgrammeCycle(value);
                  if (value === 'LICENCE') {
                    setNewProgrammeDuree('6');
                    setNewProgrammeCredits('180');
                  } else if (value === 'MASTER') {
                    setNewProgrammeDuree('4');
                    setNewProgrammeCredits('120');
                  } else {
                    setNewProgrammeDuree('16');
                    setNewProgrammeCredits('480');
                  }
                }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Cycle" /></SelectTrigger>
                  <SelectContent>
                    {cyclesLmd.map((cycle) => <SelectItem key={cycle} value={cycle}>{cycle}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={handleCreateOrUpdateProgramme}>Ajouter/Maj</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Durée semestres" type="number" min={1} value={newProgrammeDuree} onChange={(e) => setNewProgrammeDuree(e.target.value)} />
                <Input placeholder="Total crédits" type="number" min={1} value={newProgrammeCredits} onChange={(e) => setNewProgrammeCredits(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                {programmes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600"
                    onClick={() => {
                      setNewProgrammeNom(item.nom);
                      setNewProgrammeCode(item.code);
                      setNewProgrammeCycle(item.cycle);
                      setNewProgrammeDuree(String(item.dureeSemestres ?? 1));
                      setNewProgrammeCredits(String(item.totalCredits ?? 1));
                    }}
                    onDoubleClick={() => void handleDeleteProgramme(item.id)}
                    title="Double-cliquez pour supprimer"
                  >
                    {`${item.nom} (${item.cycle})`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promotion-description">Description</Label>
              <Textarea id="promotion-description" placeholder="Optionnel: précisions pédagogiques, groupe, remarques..." value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Cours de la promotion *</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                {cours.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun cours disponible. Créez d'abord des cours dans le menu Cours.</p>
                ) : (
                  cours.map((course) => {
                    const checked = form.coursIds.includes(String(course.id));
                    return (
                      <label key={course.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const isChecked = value === true;
                            setForm((current) => ({
                              ...current,
                              coursIds: isChecked
                                ? [...current.coursIds, String(course.id)]
                                : current.coursIds.filter((item) => item !== String(course.id)),
                            }));
                          }}
                        />
                        <span>{course.nom}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> Annuler
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}