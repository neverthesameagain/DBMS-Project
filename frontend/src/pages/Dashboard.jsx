import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { ArrowUpRight, ArrowDownLeft, Plus, Users, Wallet, Loader2, Send, CreditCard, PieChart, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const [stats, setStats] = useState(null);
    const [activity, setActivity] = useState([]);
    const [budgets, setBudgets] = useState([]);
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
                const [statsRes, activityRes, budgetsRes] = await Promise.all([
                    api.get('/api/dashboard/stats'),
                    api.get('/api/dashboard/activity'),
                    api.get('/api/budgets'),
                ]);
                setStats(statsRes.data);
                setActivity(activityRes.data);
                setBudgets(budgetsRes.data);
            } catch {
                setError('Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, [user, authLoading]);


    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    const categories = stats?.category_breakdown ? Object.keys(stats.category_breakdown) : [];
    const categoryValues = stats?.category_breakdown ? Object.values(stats.category_breakdown) : [];
    const hasSpending = categories.length > 0;
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6'];

    const chartData = {
        labels: hasSpending ? categories : ['No Spending'],
        datasets: [{
            data: hasSpending ? categoryValues : [1],
            backgroundColor: hasSpending ? colors.slice(0, categories.length) : ['#E5E7EB'],
            borderWidth: 0,
        }],
    };

    // Safe numeric formatting helper
    const fmt = (val) => {
        const n = parseFloat(val);
        return isNaN(n) ? '0.00' : n.toFixed(2);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <header className="flex justify-between items-center py-4">
                <div>
                    <h2 className="text-xl font-medium text-gray-900">Dashboard</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Welcome back, {user?.first_name}</p>
                </div>
                <div className="flex gap-2">
                    <Link to="/payments" className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full" title="Send Money">
                        <Send className="w-4 h-4" />
                    </Link>
                    <Link to="/budgets" className="p-2 text-gray-400 hover:text-indigo-600 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full" title="Budgets">
                        <PieChart className="w-4 h-4" />
                    </Link>
                    <Link to="/groups" className="p-2 text-gray-400 hover:text-orange-600 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full" title="Groups">
                        <Users className="w-4 h-4" />
                    </Link>
                </div>
            </header>

            {/* Budget Alerts */}
            {budgets.filter(b => {
                const spent = parseFloat(b.amount_spent) || 0;
                const allocated = parseFloat(b.allocated_amount) || 1;
                return spent / allocated >= 0.70;
            }).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {budgets.filter(b => {
                        const spent = parseFloat(b.amount_spent) || 0;
                        const allocated = parseFloat(b.allocated_amount) || 1;
                        return spent / allocated >= 0.70;
                    }).map(b => {
                        const spent = parseFloat(b.amount_spent) || 0;
                        const allocated = parseFloat(b.allocated_amount) || 1;
                        const pct = Math.round((spent / allocated) * 100);
                        return (
                            <div key={b.category_id} className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-orange-800 text-sm flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4" /> 
                                        {b.category_name} Warning
                                    </h4>
                                    <p className="text-orange-600 text-[0.65rem] font-bold uppercase tracking-wider mt-1">₹{spent.toFixed(0)} of ₹{allocated.toFixed(0)} used ({pct}%)</p>
                                </div>
                                <Link to="/budgets" className="text-orange-700 hover:text-orange-900 bg-orange-100/50 hover:bg-orange-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors">
                                    Review
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Subtle Minimalist Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Net Worth */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Balance</p>
                        <h3 className="text-3xl font-light text-gray-900 flex items-baseline gap-1">
                            <span className="text-lg text-gray-400 font-medium">₹</span>
                            {fmt(stats?.overall_balance)}
                        </h3>
                    </div>
                </div>

                {/* You are Owed */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Getting Back</p>
                        <h3 className="text-3xl font-light text-emerald-600 flex items-baseline gap-1">
                            <span className="text-lg text-emerald-400 font-medium">₹</span>
                            {fmt(stats?.you_are_owed)}
                        </h3>
                    </div>
                </div>

                {/* You Owe */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Owe</p>
                        <h3 className="text-3xl font-light text-red-600 flex items-baseline gap-1">
                            <span className="text-lg text-red-400 font-medium">₹</span>
                            {fmt(stats?.you_owe)}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Analytics Preview + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-400 mb-6 tracking-wide uppercase">Expense Analysis</h3>
                    <div className="h-64 flex justify-center">
                        <Doughnut data={chartData} options={{ maintainAspectRatio: false, cutout: '80%' }} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-400 mb-6 tracking-wide uppercase">Recent Activity</h3>
                    <div className="h-64 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                        {activity.length > 0 ? (
                            activity.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 group">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${
                                            item.type === 'WALLET_ADJUSTMENT'
                                                ? 'bg-slate-100 text-slate-600'
                                                : item.type === 'PAYMENT'
                                                    ? (item.direction === 'sent' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500')
                                                    : 'bg-orange-50 text-orange-600'
                                        }`}>
                                            {item.type === 'WALLET_ADJUSTMENT' ? (
                                                item.direction === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />
                                            ) : item.type === 'PAYMENT' ? (
                                                item.direction === 'sent' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpRight className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                                                {item.type === 'WALLET_ADJUSTMENT' ? (
                                                    <span>{item.direction === 'in' ? 'Wallet credit (bank)' : 'Wallet debit (bank)'}</span>
                                                ) : item.type === 'PAYMENT' ? (
                                                    <span className="truncate max-w-[180px] inline-block">
                                                        {item.payment_type === 'GROUP'
                                                            ? `Group settlement · ${item.from_name} → ${item.to_name}`
                                                            : `${item.from_name} → ${item.to_name}`}
                                                    </span>
                                                ) : (
                                                    <span className="truncate max-w-[180px] inline-block">{item.from_name} recorded split · {item.to_name}</span>
                                                )}
                                            </p>
                                            <p className="text-gray-400 text-xs mt-0.5">{item.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium text-gray-900">₹{fmt(item.amount)}</p>
                                        <p className="text-[0.65rem] font-bold text-gray-400 tracking-wider uppercase mt-1">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                <p className="text-sm">No recent activity yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
