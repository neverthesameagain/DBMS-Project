import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // On app load: try to restore session from stored token
    useEffect(() => {
        const restoreSession = async () => {
            const token = localStorage.getItem('splitzy_token');
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const res = await api.get('/api/auth/profile');
                setUser(res.data);
            } catch {
                // Token expired or invalid — clear it
                localStorage.removeItem('splitzy_token');
                localStorage.removeItem('splitzy_user');
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/api/auth/login', { email, password });
        const { access_token, user: userData } = res.data;
        localStorage.setItem('splitzy_token', access_token);

        let resolved = userData || null;
        if (resolved) {
            localStorage.setItem('splitzy_user', JSON.stringify(resolved));
            setUser(resolved);
        } else {
            localStorage.removeItem('splitzy_user');
            try {
                const profileRes = await api.get('/api/auth/profile');
                resolved = profileRes.data;
                localStorage.setItem('splitzy_user', JSON.stringify(resolved));
                setUser(resolved);
            } catch {
                resolved = { email };
                setUser(resolved);
            }
        }
        return resolved;
    };

    const logout = useCallback(async () => {
        try {
            await api.post('/api/auth/logout');
        } catch {
            // If the token is already expired/invalid, still clear client state
        } finally {
            setUser(null);
            localStorage.removeItem('splitzy_token');
            localStorage.removeItem('splitzy_user');
            // ProtectedRoute watches `user` and redirects to /login automatically
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
