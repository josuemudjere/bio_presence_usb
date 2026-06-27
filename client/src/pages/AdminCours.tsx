import { useEffect, useState } from 'react';
import { BookOpen, Clock, CalendarDays, Plus, Pencil, Trash2, Loader2, X, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';
import type { Cours } from '@/lib/adminData';
import { fetchCours, createCours, updateCours, deleteCours } from '@/lib/adminApi';

const emptyForm = {
  nom: '',
  nbJours: '',
  nbHeures: '',
  seuilEligibilite: '75',
  heureDebut: '',
  heureFin: '',
};

export default function AdminCours() {
  const [cours, setCours] = useState<Cours[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchCours()
      .then(setCours)
      .catch(() => toast.error('Impossible de charger les cours.'))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Cours) => {
    setEditingId(c.id);
    setForm({
      nom: c.nom,
      nbJours: String(c.nbJours),
      nbHeures: String(c.nbHeures),
      seuilEligibilite: String(c.seuilEligibilite),
      heureDebut: c.heureDebut ?? '',
      heureFin: c.heureFin ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nom.trim()) { toast.error('Le nom du cours est obligatoire.'); return; }
    const nbJours = parseInt(form.nbJours);
    const nbHeures = parseInt(form.nbHeures);
    const seuil = parseInt(form.seuilEligibilite);
    if (!nbJours || nbJours < 1) { toast.error('Le nombre de jours doit être supérieur à 0.'); return; }
    if (!nbHeures || nbHeures < 1) { toast.error('Le nombre d\'heures doit être supérieur à 0.'); return; }
    if (!seuil || seuil < 1 || seuil > 100) { toast.error('Le seuil doit être entre 1 et 100.'); return; }

    setSaving(true);
    try {
      const payload = {
        nom: form.nom.trim(),
        nbJours,
        nbHeures,
        seuilEligibilite: seuil,
        heureDebut: form.heureDebut || undefined,
        heureFin: form.heureFin || undefined,
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
                      <div className="flex items-center gap-2 text-slate-600">
                        <CalendarDays className="w-4 h-4 text-blue-500" />
                        <span><strong>{c.nbJours}</strong> jour{c.nbJours > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <span><strong>{c.nbHeures}</strong> heure{c.nbHeures > 1 ? 's' : ''}</span>
                      </div>
                      {(c.heureDebut || c.heureFin) && (
                        <div className="col-span-2 flex items-center gap-2 text-slate-600">
                          <Clock className="w-4 h-4 text-green-500" />
                          <span>{c.heureDebut || '--:--'} → {c.heureFin || '--:--'}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          Seuil éligibilité : {c.seuilEligibilite}%
                        </span>
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
                placeholder="Ex : Mathématiques, Informatique..."
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nbJours">Nombre de jours *</Label>
                <Input
                  id="nbJours"
                  type="number"
                  min={1}
                  placeholder="Ex : 30"
                  value={form.nbJours}
                  onChange={e => setForm(f => ({ ...f, nbJours: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nbHeures">Nombre d'heures *</Label>
                <Input
                  id="nbHeures"
                  type="number"
                  min={1}
                  placeholder="Ex : 60"
                  value={form.nbHeures}
                  onChange={e => setForm(f => ({ ...f, nbHeures: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="heureDebut">Heure de début</Label>
                <Input
                  id="heureDebut"
                  type="time"
                  value={form.heureDebut}
                  onChange={e => setForm(f => ({ ...f, heureDebut: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="heureFin">Heure de fin</Label>
                <Input
                  id="heureFin"
                  type="time"
                  value={form.heureFin}
                  onChange={e => setForm(f => ({ ...f, heureFin: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seuil">Seuil d'éligibilité (%) *</Label>
              <Input
                id="seuil"
                type="number"
                min={1}
                max={100}
                placeholder="Ex : 75"
                value={form.seuilEligibilite}
                onChange={e => setForm(f => ({ ...f, seuilEligibilite: e.target.value }))}
              />
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
