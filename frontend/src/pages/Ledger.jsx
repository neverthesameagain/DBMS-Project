import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const Ledger = () => {
    const { user } = useAuth();
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchLedger = async () => {
            try {
                const res = await api.get('/api/ledger');
                setLedger(res.data);
            } catch {
                setError('Failed to load ledger.');
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchLedger();
    }, [user]);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    return (
        <div className="max-w-5xl mx-auto p-6">
            <header className="mb-8">
                <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Unified Ledger</h2>
                <p className="text-gray-400 mt-1 text-sm">A timeline of every transaction spanning groups, personal payments, and splits.</p>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 text-sm font-bold text-gray-700 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700 uppercase tracking-wider">From</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700 uppercase tracking-wider">To</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700 uppercase tracking-wider">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {ledger.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-12 text-gray-500 italic">No transactions found.</td></tr>
                            )}
                            {ledger.map((tx, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            tx.entry_type === 'PAYMENT' ? 'bg-blue-100 text-blue-800' :
                                            tx.entry_type === 'EXPENSE' ? 'bg-orange-100 text-orange-800' :
                                            'bg-purple-100 text-purple-800'
                                        }`}>
                                            {tx.entry_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900">₹{(parseFloat(tx.amount) || 0).toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        {tx.category_name ? <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{tx.category_name}</span> : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{tx.from_name || <span className="text-gray-400">—</span>}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{tx.to_name || <span className="text-gray-400">—</span>}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{tx.created_at ? new Date(tx.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]" title={tx.description}>{tx.description || <span className="text-gray-400">—</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Ledger;
