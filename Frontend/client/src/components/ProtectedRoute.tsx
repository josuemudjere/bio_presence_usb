import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredRoles?: UserRole[];
}

export default function ProtectedRoute({ children, requiredRole, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const allowedRoles = requiredRoles ?? (requiredRole ? [requiredRole] : undefined);

  useEffect(() => {
    // La redirection reste centralisée ici pour éviter de répéter la même garde dans chaque page.
    if (!isLoading && !isAuthenticated) {
      setLocation('/connexion');
    } else if (!isLoading && allowedRoles && (!user || !allowedRoles.includes(user.role))) {
      setLocation('/connexion');
    }
  }, [isAuthenticated, isLoading, allowedRoles, user, setLocation]);

  // J'affiche le même loader que le routeur principal pour garder une expérience homogène.
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

  // Une route interdite ne rend rien ici, car la redirection est déjà partie dans l'effet.
  if (!isAuthenticated || (allowedRoles && (!user || !allowedRoles.includes(user.role)))) {
    return null;
  }

  return <>{children}</>;
}
