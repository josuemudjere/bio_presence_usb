import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  photoUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (name: string, photoUrl?: string, email?: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'biopresence_user';
const LEGACY_USER_STORAGE_KEY = 'bioattend_user';
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? localStorage.getItem(LEGACY_USER_STORAGE_KEY);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        // Invalider les anciennes sessions avec un id non-UUID (mock ou hors-ligne)
        if (parsedUser.role === 'admin' && uuidRegex.test(parsedUser.id)) {
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

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      let loggedUser: User;

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(payload.message ?? 'Identifiants invalides');
        }

        const data = await res.json() as { id: string; name: string; email: string; photoUrl?: string; role: string };
        loggedUser = { id: data.id, name: data.name, email: data.email, role: 'admin', photoUrl: data.photoUrl };
      } catch (err) {
        // Fallback local UNIQUEMENT si l'API est injoignable (TypeError = réseau)
        if (err instanceof TypeError && email === 'admin@usb.org' && password === 'admin') {
          loggedUser = { id: 'admin-local', name: 'Administrateur', email, role: 'admin' };
        } else {
          throw err;
        }
      }

      setUser(loggedUser);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(loggedUser));
    } finally {
      setIsLoading(false);
    }
  };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const updateProfile = async (name: string, photoUrl?: string, email?: string) => {
    if (!user) return;

    // Si l'utilisateur est en mode hors-ligne (id non-UUID), mise à jour locale uniquement
    if (!uuidRegex.test(user.id)) {
      const updated: User = { ...user, name, email: email ?? user.email, photoUrl: photoUrl ?? user.photoUrl };
      setUser(updated);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updated));
      return;
    }

    const res = await fetch(`${API_BASE}/auth/profile/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: email ?? null, photoUrl: photoUrl ?? user.photoUrl ?? null }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(payload.message ?? 'Erreur lors de la mise à jour du profil');
    }
    const data = await res.json() as { id: string; name: string; email: string; photoUrl?: string; role: string };
    const updated: User = { id: data.id, name: data.name, email: data.email, role: 'admin', photoUrl: data.photoUrl };
    setUser(updated);
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updated));
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return;
    if (!uuidRegex.test(user.id)) {
      throw new Error('Modification du mot de passe non disponible en mode hors-ligne');
    }
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
