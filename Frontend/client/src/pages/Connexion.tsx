import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Mail, Lock, Eye, EyeOff, Fingerprint, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import bioLogo from '../../../assets/images/bio.png';

/**
 * Page de Connexion - Système de Contrôle de Présence Biométrique
 * Design: Premium avec gradient, animations fluides et feedback utilisateur
 */

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoading, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    setLocation(user.role === 'teacher' ? '/enseignant/tableau-de-bord' : '/admin/tableau-de-bord');
  }, [isAuthenticated, setLocation, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      toast.success('Connexion réussie !');
      setLocation(loggedUser.role === 'teacher' ? '/enseignant/tableau-de-bord' : '/admin/tableau-de-bord');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de connexion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const featureHighlights = [
    {
      icon: Fingerprint,
      title: 'Enrôlement biométrique',
      description: 'Associez chaque étudiant à un ID d\'empreinte unique pour fiabiliser les contrôles.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Exports administratifs',
      description: 'Générez vos relevés quotidiens au format PDF en quelques secondes.',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.22),transparent_35%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.22),transparent_30%),linear-gradient(140deg,#020617_0%,#0f172a_48%,#111827_100%)] px-4 py-8 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:26px_26px] opacity-20" />
      <div className="pointer-events-none absolute -left-20 top-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />

      <motion.div
        className="relative z-10 mx-auto grid w-full max-w-6xl items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <motion.section
          className="rounded-3xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur-xl md:p-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-1 ring-white/90">
              <img src={bioLogo} alt="Logo BioPresence" className="h-full w-full rounded-xl object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Système Sécurisé</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">BioPresence</h1>
            </div>
          </div>

          <p className="mt-6 max-w-xl text-base text-slate-200 md:text-lg">
            Administrez la présence biométrique avec une interface claire, un contrôle en temps réel et des exports prêts pour l'académie.
          </p>

          <div className="mt-8 grid gap-3">
            {featureHighlights.map((feature, index) => (
              <motion.article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-slate-900/45 p-4 shadow-xl"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.18 + index * 0.1 }}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-400/10 p-2 ring-1 ring-emerald-300/20">
                    <feature.icon className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-50">{feature.title}</h2>
                    <p className="mt-1 text-sm text-slate-300">{feature.description}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>

        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18 }}
        >
          <Card className="border border-white/15 bg-slate-900/70 shadow-2xl backdrop-blur-xl">
          <CardHeader className="border-b border-white/10 pb-5">
            <CardTitle className="text-center text-2xl font-bold text-white">Connexion administrateur / enseignant</CardTitle>
            <p className="mt-2 text-center text-sm text-slate-300">
              Connectez-vous pour gérer les cours, les utilisateurs, les pointages biométriques et les rapports de présence.
            </p>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="veuillez saisir votre email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 border-slate-600 bg-slate-800/60 pl-10 text-white placeholder:text-slate-500 transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/40"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 border-slate-600 bg-slate-800/60 pl-10 pr-10 text-white placeholder:text-slate-500 transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/40"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 transition-colors hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="mt-6 h-11 w-full rounded-xl bg-gradient-to-r from-primary via-primary to-emerald-500 font-semibold text-primary-foreground transition-all duration-300 hover:brightness-110"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Connexion en cours...
                  </div>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>

          </CardContent>
        </Card>
        </motion.div>
      </motion.div>

      
    </div>
  );
}
