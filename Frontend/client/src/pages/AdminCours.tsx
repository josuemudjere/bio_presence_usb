import { useEffect, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Loader2, X, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';
import type { Cours, Departement, Programme } from '@/lib/adminData';
import { fetchCours, createCours, updateCours, deleteCours, fetchDepartements, fetchProgrammes } from '@/lib/adminApi';

const emptyForm = {
  nom: '',
  code: '',
  credits: '0',
  volumeHoraire: '0',
  departementId: '',
  programmeId: '',
  seuilEligibilite: '75',
};

export default function AdminCours() {
  // Cet écran rassemble la liste, l'édition et la suppression des cours dans un seul flux admin.
  const [cours, setCours] = useState<Cours[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);

  useEffect(() => {
    // Au montage, je charge le référentiel des cours une seule fois pour hydrater la vue.
    setLoading(true);
    Promise.all([fetchCours(), fetchDepartements(), fetchProgrammes()])
      .then(([coursRows, departementRows, programmeRows]) => {
        setCours(coursRows);
        setDepartements(departementRows);
        setProgrammes(programmeRows);
      })
      .catch(() => toast.error('Impossible de charger les cours.'))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    // En création, je repars d'un formulaire vierge et sans identifiant courant.
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Cours) => {
    // En édition, je convertis les valeurs numériques en chaînes pour alimenter les inputs contrôlés.
    setEditingId(c.id);
    setForm({
      nom: c.nom,
      code: c.code ?? '',
      credits: String(c.credits ?? 0),
      volumeHoraire: String(c.volumeHoraire ?? 0),
      departementId: c.departementId != null ? String(c.departementId) : '',
      programmeId: c.programmeId != null ? String(c.programmeId) : '',
      seuilEligibilite: String(c.seuilEligibilite ?? 75),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Les contrôles minimaux restent côté client avant de composer la charge utile API.
    if (!form.nom.trim()) { toast.error('Le nom du cours est obligatoire.'); return; }
    const credits = parseInt(form.credits || '0');
    const volumeHoraire = parseInt(form.volumeHoraire || '0');
    const seuilEligibilite = Math.max(1, parseInt(form.seuilEligibilite || '75'));

    setSaving(true);
    try {
      // Le payload garde le contrat backend complet, même si cet écran n'expose pas encore tous les champs.
      const payload = {
        nom: form.nom.trim(),
        code: form.code.trim() || undefined,
        credits: Number.isFinite(credits) ? Math.max(0, credits) : 0,
        volumeHoraire: Number.isFinite(volumeHoraire) ? Math.max(0, volumeHoraire) : 0,
        horaire: undefined,
        seuilEligibilite,
        departementId: form.departementId ? Number(form.departementId) : null,
        programmeId: form.programmeId ? Number(form.programmeId) : null,
      };
      if (editingId !== null) {
        const updated = await updateCours(editingId, payload);
        setCours(prev => prev.map(c => c.id === editingId ? updated : c));
        toast.success('Cours mis à jour.');
      } else {
        const created = await createCours(payload);
        setCours(prev => [...prev, created]);
        toast.success('Cours créé.');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    // Je verrouille uniquement la carte concernée pour garder le reste de l'écran interactif.
    setDeletingId(id);
    try {
      await deleteCours(id);
      setCours(prev => prev.filter(c => c.id !== id));
      toast.success('Cours supprimé.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de supprimer.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        {/* L'entête fixe garde les actions principales visibles même sur une longue liste. */}
        <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Gestion des cours</h1>
            <p className="text-xs text-slate-400 mt-0.5">Créez et gérez les cours du système</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" /> Nouveau cours
          </Button>
        </header>
        <div className="p-8 max-w-5xl mx-auto">

          {/* Je fais alterner les états de chargement, vide et liste pour clarifier le statut de la page. */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : cours.length === 0 ? (
            <Card className="text-center py-16 border-dashed border-2 border-slate-200">
              <CardContent>
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Aucun cours créé</p>
                <p className="text-slate-400 text-sm mt-1">Cliquez sur « Nouveau cours » pour commencer.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {cours.map(c => (
                <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow border-slate-100">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg font-semibold text-slate-800 line-clamp-2">{c.nom}</CardTitle>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                        >
                          {deletingId === c.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {c.code && (
                        <div className="col-span-2 text-xs font-mono text-slate-500">
                          Code: {c.code}
                        </div>
                      )}
                      <div className="col-span-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>Crédits: <strong>{c.credits ?? 0}</strong></span>
                        <span>Volume horaire: <strong>{c.volumeHoraire ?? c.nbHeures}</strong> h</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* La modale mutualise la création et l'édition pour limiter la duplication de formulaire. */}
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 rounded-2xl border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-900 px-6 py-5 rounded-t-2xl">
            <DialogTitle className="text-white text-lg font-bold">
              {editingId !== null ? 'Modifier le cours' : 'Nouveau cours'}
            </DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nom">Nom du cours *</Label>
              <Input
                id="nom"
                placeholder="Saisir le nom du Cours"
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" placeholder="Saisir le code du Cours" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="credits">Crédits</Label>
                <Input id="credits" type="number" min={0} value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="volumeHoraire">Volume horaire</Label>
                <Input id="volumeHoraire" type="number" min={0} value={form.volumeHoraire} onChange={e => setForm(f => ({ ...f, volumeHoraire: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Département</Label>
                <Select value={form.departementId || 'none'} onValueChange={(value) => setForm(f => ({ ...f, departementId: value === 'none' ? '' : value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {departements.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Programme (Cycle LMD)</Label>
                <Select value={form.programmeId || 'none'} onValueChange={(value) => setForm(f => ({ ...f, programmeId: value === 'none' ? '' : value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {programmes.map((item) => <SelectItem key={item.id} value={String(item.id)}>{`${item.nom} (${item.cycle})`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="seuilEligibilite">Seuil %</Label>
                <Input id="seuilEligibilite" type="number" min={1} max={100} value={form.seuilEligibilite} onChange={e => setForm(f => ({ ...f, seuilEligibilite: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                <X className="w-4 h-4 mr-1" /> Annuler
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleSave}
                disabled={saving}
              >
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
