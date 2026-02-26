import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.PI_BASE_URL || 'https://splitzy-pay-backend.vercel.app',
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

// On 401, clear stale token so user gets redirected to login
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('splitzy_token');
            localStorage.removeItem('splitzy_user');
        }
        return Promise.reject(error);
    }
);

export default api;
