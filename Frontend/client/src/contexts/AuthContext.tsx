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
  token?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (name: string, photoUrl?: string, email?: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'biopresence_user';
const LEGACY_USER_STORAGE_KEY = 'bioattend_user';
const AUTH_TOKEN_STORAGE_KEY = 'biopresence_token';
const API_BASE = getApiBaseUrl();
const SESSION_REFRESH_INTERVAL_MS = 15000;

export function getStoredAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function isBackendUser(candidate: User | null): candidate is User {
  if (!candidate) {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(candidate.id);
}

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
    const savedToken = getStoredAuthToken();
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        if (isPersistableUser(parsedUser)) {
          setUser(savedToken ? { ...parsedUser, token: savedToken } : parsedUser);
        } else {
          localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
          localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
          localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
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

        const data = await res.json() as { id: string; name: string; email: string; photoUrl?: string; role: string; coursId?: number | null; coursIds?: number[]; token?: string };
        loggedUser = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role === 'admin' ? 'admin' : 'teacher',
          coursId: data.coursId ?? null,
          coursIds: data.coursIds ?? (data.coursId != null ? [data.coursId] : []),
          photoUrl: data.photoUrl,
          token: data.token,
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
      persistUser(loggedUser);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const persistUser = (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      return;
    }

    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(nextUser));
    if (nextUser.token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextUser.token);
    }
  };

  const refreshSession = async (sessionUser?: User | null) => {
    const activeUser = sessionUser ?? user;
    if (!isBackendUser(activeUser) || !activeUser.token) {
      return;
    }

    const res = await fetch(`${API_BASE}/auth/profile/${activeUser.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeUser.token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        persistUser(null);
      }
      return;
    }

    const data = await res.json() as { id: string; name: string; email: string; photoUrl?: string; role: string; coursId?: number | null; coursIds?: number[]; token?: string };
    persistUser({
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role === 'admin' ? 'admin' : 'teacher',
      coursId: data.coursId ?? null,
      coursIds: data.coursIds ?? (data.coursId != null ? [data.coursId] : []),
      photoUrl: data.photoUrl,
      token: data.token ?? activeUser.token,
    });
  };

  useEffect(() => {
    if (!isBackendUser(user) || !user.token) {
      return;
    }

    let cancelled = false;

    const refreshIfVisible = async () => {
      if (cancelled || document.visibilityState !== 'visible') {
        return;
      }

      await refreshSession(user);
    };

    const handleVisibilityOrFocus = () => {
      void refreshIfVisible();
    };

    const intervalId = window.setInterval(() => {
      void refreshIfVisible();
    }, SESSION_REFRESH_INTERVAL_MS);

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    void refreshIfVisible();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [user]);

  useEffect(() => {
    if (!isBackendUser(user) || !user.token) {
      return;
    }

    const eventSource = new EventSource(
      `${API_BASE}/auth/events?token=${encodeURIComponent(user.token)}`
    );

    const handleSessionUpdated = () => {
      void refreshSession(user);
    };

    eventSource.addEventListener('session-updated', handleSessionUpdated);

    return () => {
      eventSource.removeEventListener('session-updated', handleSessionUpdated);
      eventSource.close();
    };
  }, [user?.id]);

  const updateProfile = async (name: string, photoUrl?: string, email?: string) => {
    if (!user) return;

    // En mode hors ligne, je simule seulement la mise à jour pour garder l'expérience cohérente.
    if (!uuidRegex.test(user.id)) {
      const updated: User = { ...user, name, email: email ?? user.email, photoUrl: photoUrl ?? user.photoUrl };
      persistUser(updated);
      return;
    }

    // En mode connecté, le profil reste piloté par la source de vérité backend.
    const res = await fetch(`${API_BASE}/auth/profile/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
      },
      body: JSON.stringify({ name, email: email ?? null, photoUrl: photoUrl ?? user.photoUrl ?? null }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(payload.message ?? 'Erreur lors de la mise à jour du profil');
    }
    const data = await res.json() as { id: string; name: string; email: string; photoUrl?: string; role: string; coursId?: number | null; coursIds?: number[]; token?: string };
    const updated: User = {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role === 'admin' ? 'admin' : 'teacher',
      coursId: data.coursId ?? null,
      coursIds: data.coursIds ?? (data.coursId != null ? [data.coursId] : []),
      photoUrl: data.photoUrl,
      token: data.token ?? user.token,
    };
    persistUser(updated);
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return;
    if (!uuidRegex.test(user.id)) {
      throw new Error('Modification du mot de passe non disponible en mode hors-ligne');
    }

    // Le mot de passe ne transite jamais par le stockage local, uniquement par l'API dédiée.
    const res = await fetch(`${API_BASE}/auth/profile/${user.id}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(payload.message ?? 'Erreur lors du changement de mot de passe');
    }
  };

  const logout = async () => {
    // La déconnexion invalide le jeton côté backend puis nettoie la session locale.
    if (isBackendUser(user) && user.token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
        });
      } catch {
        // Une erreur réseau ne doit pas bloquer la sortie locale.
      }
    }

    persistUser(null);
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
