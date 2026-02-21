import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Send, Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const Payments = () => {
    const { user } = useAuth();
    const [toEmail, setToEmail] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const res = await api.get('/api/payments');
            setHistory(res.data);
        } catch (err) {
            console.error('Failed to load payment history', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchHistory();
    }, [user]);

    const handlePayment = async (e) => {
        e.preventDefault();
        if (!amount || !toEmail) return;

        setLoading(true);
        try {
            await api.post('/api/payments', {
                to_email: toEmail,
                amount: parseFloat(amount),
                note,
            });
            alert('Payment sent successfully!');
            setAmount('');
            setToEmail('');
            setNote('');
            fetchHistory();
        } catch (err) {
            alert('Payment Failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Make a Payment</h2>

            <div className="card">
                <form onSubmit={handlePayment} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="friend@example.com"
                            value={toEmail}
                            onChange={e => setToEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">₹</span>
                            <input
                                type="number"
                                className="input pl-7"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                required
                                min="1"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Dinner, rent, etc."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn btn-primary flex justify-center items-center gap-2 py-3 text-lg"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
                        {loading ? 'Processing...' : 'Pay Now'}
                    </button>
                </form>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                Note: Use this to settle debts or make direct transfers. For group expenses, go to the Group page.
            </div>

            {/* Payment History */}
            <div className="card">
                <h3 className="font-bold text-gray-900 mb-4">Payment History</h3>
                {historyLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" /></div>
                ) : history.length === 0 ? (
                    <p className="text-gray-500 text-sm italic text-center py-4">No payments yet.</p>
                ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                        {history.map(p => (
                            <div key={p.payment_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                                <div className="flex items-center gap-3">
                                    {p.direction === 'sent'
                                        ? <ArrowUpRight className="w-4 h-4 text-red-500" />
                                        : <ArrowDownLeft className="w-4 h-4 text-green-500" />
                                    }
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {p.direction === 'sent' ? `To ${p.to_name}` : `From ${p.from_name}`}
                                        </p>
                                        <p className="text-xs text-gray-500">{p.note || '—'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${p.direction === 'sent' ? 'text-red-600' : 'text-green-600'}`}>
                                        {p.direction === 'sent' ? '-' : '+'}₹{p.amount}
                                    </p>
                                    <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Payments;
