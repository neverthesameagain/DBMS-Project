import axios from 'axios';

// Production / preview: set VITE_API_BASE_URL to your API origin.
// Development: empty baseURL + vite proxy → requests stay same-origin as the dev server.
const apiBaseURL =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? '' : 'http://127.0.0.1:5001');

const api = axios.create({
    baseURL: apiBaseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach JWT token to every request automatically
api.interceptors.request.use(config => {
    const token = localStorage.getItem('splitzy_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// On 401 with a Bearer attached, clear stale credentials (expired / revoked JWT).
// Skip clearing when no Authorization was sent (avoids wiping a valid token uselessly).
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            const sentAuth = error.config?.headers?.Authorization;
            if (sentAuth) {
                localStorage.removeItem('splitzy_token');
                localStorage.removeItem('splitzy_user');
            }
        }
        return Promise.reject(error);
    }
);

export default api;
