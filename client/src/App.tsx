import { useEffect, useMemo, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/Introuvable";
import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Connexion";
import AdminDashboard from "./pages/AdminTableauDeBord";
import AdminUsers from "./pages/AdminEtudiants";
import AdminSensor from "./pages/AdminPresence";

type RouteGroup = "home" | "login" | "admin" | "other";

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

  return "other";
}

function Router() {
  const [location] = useLocation();
  const previousLocationRef = useRef(location);

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

    if (previousGroup === "admin" && currentGroup === "admin") {
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

  useEffect(() => {
    previousLocationRef.current = location;
  }, [location]);

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
          <Route path={"/admin/presence"}>
            <ProtectedRoute requiredRole="admin">
              <AdminSensor />
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

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
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
