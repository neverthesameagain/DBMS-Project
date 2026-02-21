import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { ArrowUpRight, ArrowDownLeft, Plus, Users, Wallet, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const [stats, setStats] = useState(null);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (authLoading) return;  // wait for session restore to finish first
        const fetchDashboard = async () => {
            if (!user) {
                setLoading(false);  // not logged in — stop spinner
                return;
            }
            try {
                const [statsRes, activityRes] = await Promise.all([
                    api.get('/api/dashboard/stats'),
                    api.get('/api/dashboard/activity'),
                ]);
                setStats(statsRes.data);
                setActivity(activityRes.data);
            } catch (err) {
                setError('Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, [user, authLoading]);


    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    const chartData = {
        labels: ['You Owe', 'You are Owed', 'Monthly Spend'],
        datasets: [{
            data: [stats?.you_owe || 0, stats?.you_are_owed || 0, stats?.monthly_spend || 0],
            backgroundColor: ['#EF4444', '#10B981', '#4F46E5'],
            borderWidth: 0,
        }],
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                    <p className="text-gray-500">Welcome back, {user?.first_name}!</p>
                </div>
                <div className="flex gap-3">
                    <Link to="/groups" className="btn btn-secondary flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        My Groups
                    </Link>
                    <Link to="/payments" className="btn btn-primary flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        New Payment
                    </Link>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card bg-gradient-to-br from-indigo-500 to-indigo-600 border-none text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-indigo-100 font-medium">Overall Balance</p>
                            <h3 className="text-3xl font-bold mt-1">₹ {stats?.overall_balance || 0}</h3>
                        </div>
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-indigo-100">
                        {stats?.overall_balance >= 0 ? "You are in good standing" : "You have debts to settle"}
                    </p>
                </div>

                <div className="card">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 font-medium">You Owe</p>
                            <h3 className="text-3xl font-bold text-red-600 mt-1">₹ {stats?.you_owe || 0}</h3>
                        </div>
                        <div className="p-2 bg-red-50 rounded-lg">
                            <ArrowDownLeft className="w-6 h-6 text-red-500" />
                        </div>
                    </div>
                    <Link to="/payments" className="mt-4 inline-block text-sm text-red-600 font-medium hover:text-red-700">
                        Settle Up &rarr;
                    </Link>
                </div>

                <div className="card">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 font-medium">You are Owed</p>
                            <h3 className="text-3xl font-bold text-emerald-600 mt-1">₹ {stats?.you_are_owed || 0}</h3>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <ArrowUpRight className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                    <Link to="/groups" className="mt-4 inline-block text-sm text-emerald-600 font-medium hover:text-emerald-700">
                        View Details &rarr;
                    </Link>
                </div>
            </div>

            {/* Analytics Preview + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Expense Analysis</h3>
                    <div className="h-64 flex justify-center">
                        <Doughnut data={chartData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>

                <div className="card">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
                    <div className="h-64 overflow-y-auto space-y-3 pr-2">
                        {activity.length > 0 ? (
                            activity.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {item.type === 'PAYMENT'
                                                ? `${item.from_name} paid ${item.to_name}`
                                                : `${item.from_name} added expense`}
                                        </p>
                                        <p className="text-gray-500 text-xs">{item.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900">₹ {item.amount}</p>
                                        <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <p>No recent activity yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
