import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, Loader2, ReceiptText, Tags, TerminalSquare, Users } from 'lucide-react';
import api from '../lib/api';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/api/admin/system-stats');
                setStats(res.data);
            } catch {
                setError('Failed to load admin stats.');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    const cards = [
        { label: 'Active Users', value: stats?.total_users || 0, icon: Users, path: '/admin/users' },
        { label: 'Transactions', value: stats?.total_transactions || 0, icon: ReceiptText, path: '/admin/transactions' },
        { label: 'Groups', value: stats?.total_groups || 0, icon: Database, path: '/admin/tables' },
        { label: 'Categories', value: stats?.total_categories || 0, icon: Tags, path: '/admin/tables' },
        { label: 'Query Engine', value: 'SQL', icon: TerminalSquare, path: '/admin/query' },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <header>
                <h2 className="text-2xl font-medium text-gray-900">Admin Dashboard</h2>
                <p className="text-sm text-gray-400 mt-1">System-wide DBMS visibility.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card) => (
                    <Link key={card.label} to={card.path} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:border-blue-200 transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-2">{card.label}</p>
                                <p className="text-4xl font-light text-gray-900">{card.value}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                                <card.icon className="w-5 h-5" />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-medium text-gray-900 mb-3">Master Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Link to="/admin/users" className="btn btn-secondary text-center">Manage Users</Link>
                    <Link to="/admin/tables" className="btn btn-secondary text-center">Inspect Tables</Link>
                    <Link to="/admin/query" className="btn btn-primary text-center">Open Query Engine</Link>
                </div>
            </section>
        </div>
    );
};

export default AdminDashboard;
