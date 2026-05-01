import { useEffect, useState } from 'react';
import { Loader2, ReceiptText } from 'lucide-react';
import api from '../lib/api';

const AdminTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const res = await api.get('/api/admin/transactions');
                setTransactions(res.data);
            } catch {
                setError('Failed to load transactions.');
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, []);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <header className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <ReceiptText className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-medium text-gray-900">Admin Transactions</h2>
                    <p className="text-sm text-gray-400">Full unified ledger across all users.</p>
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">From</th>
                                <th className="px-6 py-4">To</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transactions.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-12 text-gray-500">No transactions found.</td></tr>
                            )}
                            {transactions.map((tx, index) => (
                                <tr key={`${tx.transaction_id || tx.reference_id}-${index}`} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-full bg-gray-100 text-xs font-bold text-gray-700">{tx.entry_type}</span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900">₹{parseFloat(tx.amount).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-gray-600">{tx.from_name || '—'}</td>
                                    <td className="px-6 py-4 text-gray-600">{tx.to_name || '—'}</td>
                                    <td className="px-6 py-4 text-gray-600">{tx.category_name || '—'}</td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(tx.created_at).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-gray-600 max-w-[240px] truncate">{tx.description || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminTransactions;
