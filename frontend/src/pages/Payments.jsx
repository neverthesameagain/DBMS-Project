import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Send, Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const Payments = () => {
    const { user } = useAuth();
    const [recipientType, setRecipientType] = useState('email');
    const [recipientIdentifier, setRecipientIdentifier] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [category, setCategory] = useState('');
    const [senderUpi, setSenderUpi] = useState('');
    
    const [paymentType, setPaymentType] = useState('PERSONAL');
    const [selectedGroupId, setSelectedGroupId] = useState('');

    const [userUpis, setUserUpis] = useState([]);
    const [groups, setGroups] = useState([]);
    
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

    const fetchUpis = async () => {
        try {
            const res = await api.get('/api/upi');
            setUserUpis(res.data);
            if (res.data.length > 0) {
                setSenderUpi(res.data[0].upi_handle);
            }
        } catch (err) {
            console.error('Failed to load upis', err);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await api.get('/api/groups');
            setGroups(res.data);
        } catch (err) {
            console.error('Failed to load groups', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchHistory();
            fetchUpis();
            fetchGroups();
        }
    }, [user]);

    const handlePayment = async (e) => {
        e.preventDefault();
        if (!amount || !recipientIdentifier) return;

        setLoading(true);
        try {
            await api.post('/api/payments', {
                recipient_type: recipientType,
                recipient_identifier: recipientIdentifier,
                amount: parseFloat(amount),
                note,
                category: category || null,
                upi_ref: senderUpi || null,
                payment_type: paymentType,
                group_id: paymentType === 'GROUP' ? selectedGroupId : null,
            });
            alert('Payment sent successfully!');
            setAmount('');
            setRecipientIdentifier('');
            setNote('');
            setCategory('');
            fetchHistory();
        } catch (err) {
            alert('Payment Failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
                    <Send className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Make a Payment</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Settle debts or transfer funds directly.</p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden mb-8">
                <form onSubmit={handlePayment} className="p-8">
                    
                    {/* Amount Block - Huge & Centered */}
                    <div className="flex flex-col items-center justify-center mb-10 mt-4">
                        <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-4">Transfer Amount</label>
                        <div className="flex items-center justify-center">
                            <span className="text-4xl text-gray-400 font-light mr-1">₹</span>
                            <input
                                type="number"
                                className="text-6xl md:text-7xl font-light text-gray-900 bg-transparent w-full max-w-[250px] text-center focus:outline-none placeholder-gray-200"
                                placeholder="0"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                required
                                min="1"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Segmented Controls for Payment Type */}
                        <div>
                            <div className="flex bg-gray-50 p-1 rounded-xl mb-3">
                                <button type="button" onClick={() => { setPaymentType('PERSONAL'); setSelectedGroupId(''); }} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${paymentType === 'PERSONAL' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>Personal Transfer</button>
                                <button type="button" onClick={() => setPaymentType('GROUP')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${paymentType === 'GROUP' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>Group Settlement</button>
                            </div>
                            
                            {paymentType === 'GROUP' && (
                                <select className="input text-center font-medium text-blue-600 bg-blue-50 border-blue-100 focus:ring-blue-500 shadow-none" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} required>
                                    <option value="">-- Select Group to Settle --</option>
                                    {groups.map(g => (
                                        <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Segmented Controls for Recipient */}
                        <div>
                            <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Recipient Details</label>
                            <div className="flex bg-gray-50 p-1 rounded-xl mb-3">
                                <button type="button" onClick={() => setRecipientType('email')} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${recipientType === 'email' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-500'}`}>Email</button>
                                <button type="button" onClick={() => setRecipientType('phone_number')} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${recipientType === 'phone_number' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-500'}`}>Phone</button>
                                <button type="button" onClick={() => setRecipientType('upi_id')} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${recipientType === 'upi_id' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-500'}`}>UPI ID</button>
                            </div>
                            <input
                                type={recipientType === 'email' ? 'email' : 'text'}
                                className="input text-center text-lg placeholder-gray-300 shadow-none bg-transparent border-b border-t-0 border-x-0 rounded-none focus:ring-0 px-0"
                                placeholder={recipientType === 'email' ? 'friend@example.com' : recipientType === 'phone_number' ? '9876543210' : 'friend@upi'}
                                value={recipientIdentifier}
                                onChange={e => setRecipientIdentifier(e.target.value)}
                                required
                            />
                        </div>
                        
                        {/* Secondary Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div>
                                <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 pl-1">Pay From</label>
                                <select className="input bg-transparent shadow-none border-gray-200 text-sm" value={senderUpi} onChange={e => setSenderUpi(e.target.value)}>
                                    <option value="">Internal Wallet</option>
                                    {userUpis.map(u => <option key={u.upi_id} value={u.upi_handle}>{u.upi_handle}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 pl-1">Category</label>
                                <select className="input bg-transparent shadow-none border-gray-200 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="">Uncategorized</option>
                                    {['General', 'Food', 'Travel', 'Entertainment', 'Shopping', 'Insurance', 'Health', 'Utilities'].map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <input
                                type="text"
                                className="w-full text-center border-b border-gray-200 py-3 text-gray-600 focus:outline-none focus:border-blue-500 transition-colors bg-transparent placeholder-gray-300 text-sm"
                                placeholder="What's this for? (Note)"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn bg-gray-900 hover:bg-black text-white flex justify-center items-center gap-2 py-4 text-lg rounded-2xl shadow-md transition-transform active:scale-[0.99] mt-4"
                        >
                            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                            {loading ? 'Processing...' : 'Send Payment'}
                        </button>
                    </div>
                </form>
            </div>
            {/* Payment History */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Payment History</h3>
                {historyLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" /></div>
                ) : history.length === 0 ? (
                    <p className="text-gray-500 text-sm italic text-center py-4">No payments yet.</p>
                ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                        {history.map(p => (
                            <div key={p.payment_id} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0 group">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${p.direction === 'sent' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                                        {p.direction === 'sent' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {p.direction === 'sent' ? `To ${p.to_name}` : `From ${p.from_name}`}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">{p.note || '—'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-medium ${p.direction === 'sent' ? 'text-gray-900' : 'text-green-600'}`}>
                                        {p.direction === 'sent' ? '-' : '+'}₹{p.amount}
                                    </p>
                                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
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
