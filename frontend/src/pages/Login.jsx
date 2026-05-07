import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, Loader2 } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            if (user.role === 'ADMIN') navigate('/admin');
            else if (user.role === 'BANKER') navigate('/banker');
            else navigate('/');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const loggedIn = await login(email, password);
            const role = loggedIn?.role;
            if (role === 'ADMIN') navigate('/admin');
            else if (role === 'BANKER') navigate('/banker');
            else navigate('/');
        } catch {
            setError('Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <Wallet className="w-10 h-10 text-primary" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Sign in to Splitzy Pay
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Use your credentials to access your account
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input
                                type="email" required
                                className="input mt-1"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            <input
                                type="password" required
                                className="input mt-1"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn btn-primary flex justify-center"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <p className="text-center text-sm text-gray-600">
                            Don't have an account?
                            <Link to="/signup" className="ml-1 font-medium text-primary hover:text-indigo-500">
                                Create new account
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
