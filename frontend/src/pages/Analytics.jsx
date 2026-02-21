import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Loader2 } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const PALETTE = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

const Analytics = () => {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) fetchAnalytics();
    }, [user]);

    const fetchAnalytics = async () => {
        try {
            const res = await api.get('/api/analytics');
            setAnalytics(res.data);
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card text-center">
                    <p className="text-sm text-gray-500 mb-1">Total Paid</p>
                    <p className="text-2xl font-bold text-indigo-600">₹{analytics?.total_paid || 0}</p>
                </div>
                <div className="card text-center">
                    <p className="text-sm text-gray-500 mb-1">You Are Owed</p>
                    <p className="text-2xl font-bold text-green-600">₹{analytics?.you_are_owed || 0}</p>
                </div>
                <div className="card text-center">
                    <p className="text-sm text-gray-500 mb-1">You Owe</p>
                    <p className="text-2xl font-bold text-red-600">₹{analytics?.you_owe || 0}</p>
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
        </div>
    );
};

export default Analytics;
