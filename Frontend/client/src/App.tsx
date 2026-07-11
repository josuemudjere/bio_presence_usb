import { useEffect, useMemo, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/Introuvable";
import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Connexion";
import AdminDashboard from "./pages/AdminTableauDeBord";
import AdminUsers from "./pages/AdminEtudiants";
import AdminCours from "./pages/AdminCours";
import AdminPromotions from "./pages/AdminPromotions";
import AdminUtilisateurs from "./pages/AdminUtilisateurs";
import UtilisateurPresence from "./pages/UtilisateurPresence";
import UtilisateurTableauDeBord from "./pages/UtilisateurTableauDeBord";
import UtilisateurRapports from "./pages/UtilisateurRapports";
import UtilisateurEligibilite from "./pages/UtilisateurEligibilite";

type RouteGroup = "home" | "login" | "admin" | "teacher" | "other";

// Je regroupe les routes par zone fonctionnelle pour piloter les animations entre écrans.
function getRouteGroup(path: string): RouteGroup {
  if (path === "/accueil") {
    return "home";
  }

  if (path === "/connexion" || path === "/") {
    return "login";
  }

  if (path.startsWith("/admin")) {
    return "admin";
  }

  if (path.startsWith("/enseignant")) {
    return "teacher";
  }

  return "other";
}

function Router() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const previousLocationRef = useRef(location);

  // Les transitions changent selon le contexte pour garder une navigation lisible.
  const transitionConfig = useMemo(() => {
    const previousGroup = getRouteGroup(previousLocationRef.current);
    const currentGroup = getRouteGroup(location);

    if (previousGroup === "login" && currentGroup === "admin") {
      return {
        initial: { opacity: 0, y: 22, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -14, scale: 1.01 },
        transition: { duration: 0.34 },
      };
    }

    if ((previousGroup === "admin" && currentGroup === "admin") || (previousGroup === "teacher" && currentGroup === "teacher")) {
      return {
        initial: { opacity: 1, x: 0 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 1, x: 0 },
        transition: { duration: 0 },
      };
    }

    if (currentGroup === "login") {
      return {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.28 },
      };
    }

    return {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
      transition: { duration: 0.24 },
    };
  }, [location]);

  // Je mémorise la route précédente pour calculer correctement la transition suivante.
  useEffect(() => {
    previousLocationRef.current = location;
  }, [location]);

  // Tant que la session n'est pas résolue, je bloque l'UI sur un état de chargement neutre.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, seules les routes d'authentification restent accessibles.
  if (!isAuthenticated) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key="login-required"
          initial={transitionConfig.initial}
          animate={transitionConfig.animate}
          exit={transitionConfig.exit}
          transition={transitionConfig.transition}
        >
          <Switch>
            <Route path={"/"} component={Login} />
            <Route path={"/connexion"} component={Login} />
            <Route component={Login} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Une fois authentifié, je laisse chaque écran protégé gérer son contrôle d'accès fin.
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={transitionConfig.initial}
        animate={transitionConfig.animate}
        exit={transitionConfig.exit}
        transition={transitionConfig.transition}
      >
        <Switch>
          <Route path={"/"} component={Login} />
          <Route path={"/connexion"} component={Login} />
          <Route path={"/admin/tableau-de-bord"}>
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          </Route>
          <Route path={"/admin/etudiants"}>
            <ProtectedRoute requiredRole="admin">
              <AdminUsers />
            </ProtectedRoute>
          </Route>
          <Route path={"/admin/cours"}>
            <ProtectedRoute requiredRole="admin">
              <AdminCours />
            </ProtectedRoute>
          </Route>
          <Route path={"/admin/promotions"}>
            <ProtectedRoute requiredRole="admin">
              <AdminPromotions />
            </ProtectedRoute>
          </Route>
          <Route path={"/admin/utilisateurs"}>
            <ProtectedRoute requiredRole="admin">
              <AdminUtilisateurs />
            </ProtectedRoute>
          </Route>
          <Route path={"/enseignant/tableau-de-bord"}>
            <ProtectedRoute requiredRole="teacher">
              <UtilisateurTableauDeBord />
            </ProtectedRoute>
          </Route>
          <Route path={"/enseignant/presence"}>
            <ProtectedRoute requiredRole="teacher">
              <UtilisateurPresence />
            </ProtectedRoute>
          </Route>
          <Route path={"/enseignant/rapports"}>
            <ProtectedRoute requiredRole="teacher">
              <UtilisateurRapports />
            </ProtectedRoute>
          </Route>
          <Route path={"/enseignant/eligibilite"}>
            <ProtectedRoute requiredRole="teacher">
              <UtilisateurEligibilite />
            </ProtectedRoute>
          </Route>
          <Route path={"/404"} component={NotFound} />
          {/* Final fallback route */}
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}


function App() {
  // J'empile ici les providers globaux pour centraliser les dépendances partagées de l'application.
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
