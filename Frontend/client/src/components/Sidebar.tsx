import { useState, useRef } from 'react';
import { LayoutDashboard, ScanSearch, Users, LogOut, UserCog, Camera, X, Save, KeyRound, Eye, EyeOff, BookOpen, FileText, CheckSquare, GraduationCap } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import bioLogo from '../../../assets/images/bio.png';

interface SidebarProps {
  userName?: string;
}

export default function Sidebar({ userName = 'Administrateur' }: SidebarProps) {
  const { user, logout, updateProfile, updatePassword } = useAuth();
  const [location, setLocation] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  // Cet état alimente le formulaire de profil indépendamment des valeurs déjà persistées.
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(undefined);

  // Ces champs restent isolés pour éviter de mélanger les flux profil et sécurité.
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // La visibilité est pilotée champ par champ pour ne pas surprendre l'utilisateur.
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Ces dérivés me permettent de garder le rendu simple et sans duplication de logique.
  const displayName = user?.name ?? userName;
  const avatarUrl = user?.photoUrl;
  const isAdmin = user?.role === 'admin';
  const roleLabel = isAdmin ? 'Administrateur' : 'Enseignant';
  const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const handleOpenProfile = () => {
    // À l'ouverture, je repars toujours des données de session courantes pour éviter un formulaire sale.
    setEditName(displayName);
    setEditEmail(user?.email ?? '');
    setPhotoPreview(avatarUrl);
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setSaveError('');
    setSaveSuccess('');
    setProfileOpen(true);
  };

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Je redimensionne côté client pour garder un avatar léger avant envoi ou stockage local.
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setSaveError('La photo dépasse 2 Mo. Veuillez choisir une image de 2 Mo ou moins.');
      e.target.value = '';
      return;
    }
    setSaveError('');
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 400;
      const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      setPhotoPreview(canvas.toDataURL('image/jpeg', 0.80));
    };
    img.src = objectUrl;
  };

  const handleSaveProfile = async () => {
    // Le profil et la sécurité ont chacun leur message de retour mais partagent le même verrou d'enregistrement.
    setSaveError('');
    setSaveSuccess('');
    setSaving(true);
    try {
      await updateProfile(editName, photoPreview, editEmail !== user?.email ? editEmail : undefined);
      setSaveSuccess('Profil mis à jour avec succès.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Impossible de sauvegarder le profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    // Je valide d'abord localement les cas simples pour éviter un aller-retour backend inutile.
    setSaveError('');
    setSaveSuccess('');
    if (!currentPwd) { setSaveError('Entrez votre mot de passe actuel.'); return; }
    if (newPwd.length < 4) { setSaveError('Le nouveau mot de passe doit contenir au moins 4 caractères.'); return; }
    if (newPwd !== confirmPwd) { setSaveError('Les mots de passe ne correspondent pas.'); return; }
    setSaving(true);
    try {
      await updatePassword(currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setSaveSuccess('Mot de passe modifié avec succès.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Impossible de changer le mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    // La déconnexion invalide la session puis renvoie explicitement vers l'écran public.
    await logout();
    setLocation('/connexion');
  };

  // Le menu est construit à partir du rôle pour garder une seule sidebar pour tous les profils.
  const menuItems = isAdmin
    ? [
        { icon: LayoutDashboard, label: "Vue d'ensemble", href: '/admin/tableau-de-bord' },
        { icon: Users, label: 'Étudiants & configurations', href: '/admin/etudiants' },
        { icon: BookOpen, label: 'Cours', href: '/admin/cours' },
        { icon: GraduationCap, label: 'Promotions', href: '/admin/promotions' },
        { icon: Users, label: 'Utilisateurs', href: '/admin/utilisateurs' },
      ]
    : [
        { icon: LayoutDashboard, label: "Vue d'ensemble", href: '/enseignant/tableau-de-bord' },
        { icon: ScanSearch, label: 'Pointer la présence', href: '/enseignant/presence' },
        { icon: FileText, label: 'Rapports', href: '/enseignant/rapports' },
        { icon: CheckSquare, label: 'Éligibilité', href: '/enseignant/eligibilite' },
      ];

  return (
    <>
      <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-blue-950 via-[#0a1628] to-[#060d1f] text-white shadow-2xl flex flex-col border-r border-white/5 will-change-transform">
        {/* Header */}
        <div className="relative py-8 px-6 border-b border-white/10 flex flex-col items-center gap-3 overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-900">
          {/* Cercles décoratifs */}
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10 blur-sm" />
          <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10 blur-sm" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 p-2 shadow-xl ring-2 ring-white/60 backdrop-blur-sm">
            <img src={bioLogo} alt="Logo BioPresence" className="h-full w-full rounded-xl object-contain" />
          </div>
          <h1 className="relative text-lg font-bold text-white drop-shadow-sm tracking-wide">BioPresence</h1>
        </div>

        {/* User Info — cliquable pour ouvrir le profil */}
        <button
          onClick={handleOpenProfile}
          className="px-6 py-4 border-b border-white/10 flex items-center gap-3 hover:bg-white/5 transition-colors text-left group"
        >
          <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center bg-white/10 shrink-0 ring-2 ring-white/20">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              : <span className="text-sm font-bold text-blue-200">{initials}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-white">{displayName}</p>
            <p className="text-xs text-blue-300/70">{roleLabel}</p>
          </div>
          <UserCog className="w-4 h-4 text-white/30 group-hover:text-white/60 shrink-0" />
        </button>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer ${
                    location.startsWith(item.href)
                      ? 'bg-white/10 text-white font-semibold shadow-sm border-l-2 border-blue-400'
                      : 'text-blue-100/70 hover:bg-white/5 hover:text-white'
                  }`}>
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-blue-200/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
            <span>Déconnexion</span>
          </Button>
        </div>
      </aside>

      {/* Dialog Profil */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-0 shadow-2xl">

          {/* Bannière dégradée + avatar */}
          <div className="relative bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-900 px-6 pt-8 pb-16 rounded-t-2xl overflow-hidden">
            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10 blur-md" />
            <div className="absolute bottom-0 left-0 h-12 w-40 rounded-tr-full bg-white/5" />
            <h2 className="relative text-lg font-bold text-white tracking-wide">Mon profil</h2>
            <p className="relative text-xs text-blue-200/70 mt-0.5">Gérez vos informations personnelles</p>
          </div>

          {/* Avatar centré sur la bannière */}
          <div className="flex flex-col items-center -mt-12 pb-2 z-10 relative">
            <div className="relative">
              <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white shadow-xl flex items-center justify-center bg-slate-100">
                {photoPreview
                  ? <img src={photoPreview} alt="Aperçu" className="h-full w-full object-cover" />
                  : <span className="text-2xl font-bold text-blue-800">{initials}</span>}
              </div>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors border-2 border-white"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => setPhotoPreview(undefined)}
                  className="absolute top-0 right-0 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center shadow hover:bg-red-600 transition-colors border-2 border-white"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
            <p className="mt-2 text-xs text-slate-400">Cliquez sur l'icône pour changer la photo</p>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Section infos */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Informations</p>
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-slate-600 text-xs font-medium">Nom complet</Label>
                <Input
                  id="profile-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Votre nom"
                  className="bg-white border-slate-200 focus-visible:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email" className="text-slate-600 text-xs font-medium">Adresse email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="bg-white border-slate-200 focus-visible:ring-blue-500"
                />
              </div>
              <Button
                onClick={handleSaveProfile}
                disabled={saving || !editName.trim() || !editEmail.trim()}
                className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white shadow-md"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
              </Button>
            </div>

            {/* Section mot de passe */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                  <KeyRound className="w-3.5 h-3.5 text-blue-700" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Sécurité</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="current-pwd" className="text-slate-600 text-xs font-medium">Mot de passe actuel</Label>
                <div className="relative">
                  <Input id="current-pwd" type={showCurrentPwd ? 'text' : 'password'} value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••"
                    autoComplete="current-password" className="pr-10 bg-white border-slate-200 focus-visible:ring-blue-500" />
                  <button type="button" onClick={() => setShowCurrentPwd(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-pwd" className="text-slate-600 text-xs font-medium">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input id="new-pwd" type={showNewPwd ? 'text' : 'password'} value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••"
                    autoComplete="new-password" className="pr-10 bg-white border-slate-200 focus-visible:ring-blue-500" />
                  <button type="button" onClick={() => setShowNewPwd(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pwd" className="text-slate-600 text-xs font-medium">Confirmer le nouveau mot de passe</Label>
                <div className="relative">
                  <Input id="confirm-pwd" type={showConfirmPwd ? 'text' : 'password'} value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)} placeholder="••••••••"
                    autoComplete="new-password" className="pr-10 bg-white border-slate-200 focus-visible:ring-blue-500" />
                  <button type="button" onClick={() => setShowConfirmPwd(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button onClick={handleSavePassword} disabled={saving || !currentPwd || !newPwd || !confirmPwd}
                variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-400">
                <KeyRound className="w-4 h-4 mr-2" />
                {saving ? 'Modification…' : 'Changer le mot de passe'}
              </Button>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-600">
                <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-700">
                <Save className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {saveSuccess}
              </div>
            )}

            <Button variant="ghost" onClick={() => setProfileOpen(false)} disabled={saving}
              className="w-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-sm">
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

