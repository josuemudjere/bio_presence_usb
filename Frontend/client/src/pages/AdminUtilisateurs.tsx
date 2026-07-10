import { useEffect, useState } from 'react';
import { GraduationCap, Plus, Pencil, PowerOff, Power, Loader2, X, Save, Mail, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';
import type { Cours, Utilisateur } from '@/lib/adminData';
import { fetchCours, fetchUtilisateurs, createUtilisateur, updateUtilisateur, toggleActifUtilisateur } from '@/lib/adminApi';

const emptyForm = { nom: '', email: '', password: '', coursId: '', coursIds: [] as string[], role: 'teacher' };

export default function AdminUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [cours, setCours] = useState<Cours[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchUtilisateurs(), fetchCours()])
      .then(([u, c]) => { setUtilisateurs(u); setCours(c); })
      .catch(() => toast.error('Impossible de charger les données.'))
      .finally(() => setLoading(false));
  }, []);

  const getCoursNom = (id?: number | null) => {
    if (!id) return null;
    return cours.find(c => c.id === id)?.nom ?? null;
  };

  const getCoursNoms = (ids?: number[]) => {
    if (!ids || ids.length === 0) return [];
    return ids
      .map((id) => cours.find((course) => course.id === id)?.nom)
      .filter((value): value is string => Boolean(value));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEdit = (u: Utilisateur) => {
    setEditingId(u.id);
    setForm({
      nom: u.nom,
      email: u.email,
      password: '',
      coursId: u.coursId ? String(u.coursId) : '',
      coursIds: (u.coursIds ?? (u.coursId ? [u.coursId] : [])).map(String),
      role: u.role ?? 'teacher'
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nom.trim()) { toast.error('Le nom est obligatoire.'); return; }
    if (!form.email.trim()) { toast.error('L\'email est obligatoire.'); return; }
    if (!editingId && form.password.length < 4) { toast.error('Le mot de passe doit faire au moins 4 caractères.'); return; }

    setSaving(true);
    try {
      const payload = {
        nom: form.nom.trim(),
        email: form.email.trim(),
        password: form.password || '****',
        coursId: form.coursIds[0] ? parseInt(form.coursIds[0]) : null,
        coursIds: form.coursIds.map((value) => parseInt(value)),
        role: form.role || 'teacher',
      };
      if (editingId !== null) {
        const updated = await updateUtilisateur(editingId, payload);
        setUtilisateurs(prev => prev.map(u => u.id === editingId ? updated : u));
        toast.success('Utilisateur mis à jour.');
      } else {
        const created = await createUtilisateur(payload);
        setUtilisateurs(prev => [...prev, created]);
        toast.success('Utilisateur créé.');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActif = async (id: string) => {
    setTogglingId(id);
    try {
      const updated = await toggleActifUtilisateur(id);
      setUtilisateurs(prev => prev.map(u => u.id === id ? updated : u));
      toast.success(updated.actif ? 'Compte activé.' : 'Compte désactivé.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de modifier le statut.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 min-h-screen flex-1 bg-slate-50">
        <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Gestion des utilisateurs</h1>
            <p className="text-xs text-slate-400 mt-0.5">Enseignants et professeurs du système</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" /> Ajouter utilisateur
          </Button>
        </header>
        <div className="p-8 max-w-5xl mx-auto">

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : utilisateurs.length === 0 ? (
            <Card className="text-center py-16 border-dashed border-2 border-slate-200">
              <CardContent>
                <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Aucun utilisateur créé</p>
                <p className="text-slate-400 text-sm mt-1">Cliquez sur « Nouvel utilisateur » pour commencer.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nom</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rôle</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cours assignés</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {utilisateurs.map((u, i) => (
                    <tr key={u.id} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} ${u.actif === false ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-800">{u.nom}</td>
                      <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />{u.email}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === 'admin'
                          ? <span className="inline-flex items-center bg-purple-50 text-purple-700 text-xs font-medium px-2.5 py-1 rounded-full">Administrateur</span>
                          : <span className="inline-flex items-center bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">Enseignant</span>}
                      </td>
                      <td className="px-4 py-3">
                        {u.actif === false
                          ? <span className="inline-flex items-center bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full">Désactivé</span>
                          : <span className="inline-flex items-center bg-emerald-50 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">Actif</span>}
                      </td>
                      <td className="px-4 py-3">
                        {getCoursNoms(u.coursIds ?? (u.coursId ? [u.coursId] : [])).length > 0
                          ? <div className="flex flex-wrap gap-1.5">{getCoursNoms(u.coursIds ?? (u.coursId ? [u.coursId] : [])).map((courseName) => <span key={courseName} className="inline-flex items-center bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">{courseName}</span>)}</div>
                          : <span className="text-slate-400 text-sm italic">Non assigné</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-blue-600"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${u.actif === false ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-400 hover:text-red-500'}`}
                            onClick={() => handleToggleActif(u.id)}
                            disabled={togglingId === u.id}
                            title={u.actif === false ? 'Activer le compte' : 'Désactiver le compte'}
                          >
                            {togglingId === u.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : u.actif === false
                                ? <Power className="w-4 h-4" />
                                : <PowerOff className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 rounded-2xl border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-900 px-6 py-5 rounded-t-2xl">
            <DialogTitle className="text-white text-lg font-bold">
              {editingId !== null ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-nom">Nom complet *</Label>
              <Input
                id="u-nom"
                placeholder="Ex : Jean Dupont"
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email *</Label>
              <Input
                id="u-email"
                type="email"
                placeholder="ex@usb.org"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-password">{editingId ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}</Label>
              <div className="relative">
                <Input
                  id="u-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={editingId ? '••••' : 'Minimum 4 caractères'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-role">Rôle *</Label>
              <Select
                value={form.role}
                onValueChange={v => setForm(f => ({ ...f, role: v }))}
              >
                <SelectTrigger id="u-role">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Enseignant</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cours assignés</Label>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                {cours.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun cours disponible.</p>
                ) : (
                  cours.map((course) => {
                    const checked = form.coursIds.includes(String(course.id));
                    return (
                      <label key={course.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const isChecked = value === true;
                            setForm((current) => {
                              const nextCoursIds = isChecked
                                ? [...current.coursIds, String(course.id)]
                                : current.coursIds.filter((item) => item !== String(course.id));

                              return {
                                ...current,
                                coursId: nextCoursIds[0] ?? '',
                                coursIds: nextCoursIds,
                              };
                            });
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
