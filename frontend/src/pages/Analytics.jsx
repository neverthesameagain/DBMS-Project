import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { ArrowUpRight, ArrowDownLeft, Loader2, ListOrdered } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const PALETTE = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

const Analytics = () => {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) fetchAnalytics();
    }, [user]);

    const fetchAnalytics = async () => {
        try {
            const [resAnalytics, resPayments] = await Promise.all([
                api.get('/api/analytics'),
                api.get('/api/payments')
            ]);
            setAnalytics(resAnalytics.data);
            setPayments(resPayments.data);
        } catch (err) {
            setError('Failed to load analytics.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    const catLabels = analytics?.category_breakdown?.map(c => c.category) || [];
    const catData = analytics?.category_breakdown?.map(c => c.amount) || [];

    const monthLabels = analytics?.monthly_spending?.map(m => m.month) || [];
    const monthData = analytics?.monthly_spending?.map(m => m.amount) || [];

    const doughnutData = {
        labels: catLabels,
        datasets: [{
            data: catData,
            backgroundColor: PALETTE,
            borderWidth: 0,
        }],
    };

    const barData = {
        labels: monthLabels,
        datasets: [{
            label: 'Monthly Spending (₹)',
            data: monthData,
            backgroundColor: '#4F46E5',
            borderRadius: 6,
        }],
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Paid</p>
                        <h3 className="text-2xl lg:text-3xl font-light text-indigo-600 flex items-baseline gap-1">
                            <span className="text-base text-indigo-400 font-medium">₹</span>
                            {analytics?.total_paid || 0}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Sent</p>
                        <h3 className="text-2xl lg:text-3xl font-light text-orange-600 flex items-baseline gap-1">
                            <span className="text-base text-orange-400 font-medium">₹</span>
                            {analytics?.total_sent || 0}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Received</p>
                        <h3 className="text-2xl lg:text-3xl font-light text-blue-600 flex items-baseline gap-1">
                            <span className="text-base text-blue-400 font-medium">₹</span>
                            {analytics?.total_received || 0}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Getting Back</p>
                        <h3 className="text-2xl lg:text-3xl font-light text-emerald-600 flex items-baseline gap-1">
                            <span className="text-base text-emerald-400 font-medium">₹</span>
                            {analytics?.you_are_owed || 0}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">You Owe</p>
                        <h3 className="text-2xl lg:text-3xl font-light text-red-600 flex items-baseline gap-1">
                            <span className="text-base text-red-400 font-medium">₹</span>
                            {analytics?.you_owe || 0}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Doughnut */}
                <div className="card">
                    <h3 className="text-lg font-bold mb-4">Category Breakdown</h3>
                    <div className="h-64 flex justify-center">
                        {catLabels.length > 0 ? (
                            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
                        ) : (
                            <p className="text-gray-400 self-center">No spending data yet</p>
                        )}
                    </div>
                </div>

                {/* Bar */}
                <div className="card">
                    <h3 className="text-lg font-bold mb-4">Monthly Spending</h3>
                    <div className="h-64">
                        {monthLabels.length > 0 ? (
                            <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                        ) : (
                            <p className="text-gray-400 text-center py-12">No data available</p>
                        )}
                    </div>
                </div>
            </div>
            {/* Comprehensive Payment History Tracker */}
            <div className="card">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <ListOrdered className="w-5 h-5 text-gray-500" />
                    Complete Payment History
                </h3>
                {payments.length === 0 ? (
                    <p className="text-gray-400 italic text-sm text-center py-6">No payments transferred or received yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Date</th>
                                    <th className="px-4 py-3">Direction</th>
                                    <th className="px-4 py-3">To / From</th>
                                    <th className="px-4 py-3">Category / Note</th>
                                    <th className="px-4 py-3 text-right rounded-tr-lg">Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.payment_id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            {p.direction === 'sent' ? (
                                                <span className="flex items-center gap-1 text-red-600 font-semibold"><ArrowUpRight className="w-3 h-3"/> Sent</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-emerald-600 font-semibold"><ArrowDownLeft className="w-3 h-3"/> Rcvd</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {p.direction === 'sent' ? p.to_name : p.from_name}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {p.category ? <span className="bg-gray-200 px-2 py-0.5 rounded mr-2">{p.category}</span> : ''}
                                            {p.note || '—'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${p.direction === 'sent' ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {p.direction === 'sent' ? '-' : '+'}₹{p.amount}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Analytics;
