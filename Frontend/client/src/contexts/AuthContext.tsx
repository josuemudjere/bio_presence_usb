import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/lib/apiBase';

export type UserRole = 'admin' | 'teacher';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  coursId?: number | null;
  coursIds?: number[];
  photoUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateProfile: (name: string, photoUrl?: string, email?: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'biopresence_user';
const LEGACY_USER_STORAGE_KEY = 'bioattend_user';
const API_BASE = getApiBaseUrl();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Je limite la persistance locale aux comptes issus du backend pour éviter des sessions fantômes.
  const isPersistableUser = (candidate: User) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return (candidate.role === 'admin' || candidate.role === 'teacher') && uuidRegex.test(candidate.id);
  };

  useEffect(() => {
    // Je relis d'abord la clé courante puis l'ancienne pour rester compatible avec les anciennes sessions.
    const savedUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? localStorage.getItem(LEGACY_USER_STORAGE_KEY);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        if (isPersistableUser(parsedUser)) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
          localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
        }
      } catch {
        // session corrompue ignorée
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      let loggedUser: User;

      try {
        // Le flux normal passe par l'API d'authentification exposée par le backend.
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(payload.message ?? 'Identifiants invalides');
        }

        const data = await res.json() as { id: string; name: string; email: string; photoUrl?: string; role: string; coursId?: number | null; coursIds?: number[] };
        loggedUser = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role === 'admin' ? 'admin' : 'teacher',
          coursId: data.coursId ?? null,
          coursIds: data.coursIds ?? (data.coursId != null ? [data.coursId] : []),
          photoUrl: data.photoUrl,
        };
      } catch (err) {
        // Je garde un mode local minimal uniquement pour continuer les démos hors ligne.
        if (err instanceof TypeError && email === 'admin@usb.org' && password === 'admin') {
          loggedUser = { id: 'admin-local', name: 'Administrateur', email, role: 'admin' };
        } else if (err instanceof TypeError && email === 'enseignant@usb.org' && password === 'enseignant') {
          loggedUser = { id: 'teacher-local', name: 'Enseignant', email, role: 'teacher', coursId: 1, coursIds: [1] };
        } else {
          throw err;
        }
      }

      // Une authentification réussie met immédiatement le contexte et le stockage local à jour.
      setUser(loggedUser);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(loggedUser));
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const updateProfile = async (name: string, photoUrl?: string, email?: string) => {
    if (!user) return;

    // En mode hors ligne, je simule seulement la mise à jour pour garder l'expérience cohérente.
    if (!uuidRegex.test(user.id)) {
      const updated: User = { ...user, name, email: email ?? user.email, photoUrl: photoUrl ?? user.photoUrl };
      setUser(updated);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updated));
      return;
    }

    // En mode connecté, le profil reste piloté par la source de vérité backend.
    const res = await fetch(`${API_BASE}/auth/profile/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: email ?? null, photoUrl: photoUrl ?? user.photoUrl ?? null }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(payload.message ?? 'Erreur lors de la mise à jour du profil');
    }
    const data = await res.json() as { id: string; name: string; email: string; photoUrl?: string; role: string; coursId?: number | null; coursIds?: number[] };
    const updated: User = {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role === 'admin' ? 'admin' : 'teacher',
      coursId: data.coursId ?? null,
      coursIds: data.coursIds ?? (data.coursId != null ? [data.coursId] : []),
      photoUrl: data.photoUrl,
    };
    setUser(updated);
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updated));
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return;
    if (!uuidRegex.test(user.id)) {
      throw new Error('Modification du mot de passe non disponible en mode hors-ligne');
    }

    // Le mot de passe ne transite jamais par le stockage local, uniquement par l'API dédiée.
    const res = await fetch(`${API_BASE}/auth/profile/${user.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(payload.message ?? 'Erreur lors du changement de mot de passe');
    }
  };

  const logout = () => {
    // La déconnexion doit nettoyer les deux clés tant que l'ancien format existe encore.
    setUser(null);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, updateProfile, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};
