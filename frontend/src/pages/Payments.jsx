import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Send, Loader2, ArrowUpRight, ArrowDownLeft, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

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
    const [groupActionMode, setGroupActionMode] = useState('SETTLE'); // 'SETTLE' | 'EXPENSE'

    const [searchParams] = useSearchParams();

    const [userUpis, setUserUpis] = useState([]);
    const [groups, setGroups] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    // Group settlement state
    const [groupBalances, setGroupBalances] = useState([]);
    const [groupBalancesLoading, setGroupBalancesLoading] = useState(false);

    // Budget state
    const [budgets, setBudgets] = useState([]);
    const [budgetWarning, setBudgetWarning] = useState(null);

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

    const fetchBudgets = async () => {
        try {
            const res = await api.get('/api/budgets');
            setBudgets(res.data);
        } catch (err) {
            console.error('Failed to load budgets', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchHistory();
            fetchUpis();
            fetchGroups();
            fetchBudgets();
        }
    }, [user]);

    // Handle deep links from Group Details "Settle Up"
    useEffect(() => {
        const urlGroupId = searchParams.get('groupId');
        const urlAmount = searchParams.get('amount');
        const urlSettleUserId = searchParams.get('settleUserId');
        
        if (urlGroupId) {
            setPaymentType('GROUP');
            setSelectedGroupId(urlGroupId);
            setGroupActionMode('SETTLE');
            if (urlAmount) {
                setAmount(parseFloat(urlAmount).toFixed(2));
            }
        }
    }, [searchParams]);

    // When a group is selected, fetch its balances to show who you owe
    useEffect(() => {
        if (paymentType === 'GROUP' && selectedGroupId) {
            const fetchGroupBalances = async () => {
                setGroupBalancesLoading(true);
                try {
                    const res = await api.get(`/api/groups/${selectedGroupId}/balances`);
                    setGroupBalances(res.data);
                } catch (err) {
                    console.error('Failed to load group balances', err);
                    setGroupBalances([]);
                } finally {
                    setGroupBalancesLoading(false);
                }
            };
            fetchGroupBalances();
        } else {
            setGroupBalances([]);
        }
    }, [paymentType, selectedGroupId]);

    // Check budget when category changes
    useEffect(() => {
        if (category && amount) {
            const budget = budgets.find(b => b.category_name === category);
            if (budget) {
                const spent = parseFloat(budget.amount_spent) || 0;
                const allocated = parseFloat(budget.allocated_amount) || 0;
                const parsedAmount = parseFloat(amount) || 0;
                if (allocated > 0 && (spent + parsedAmount) > allocated) {
                    setBudgetWarning({
                        category: budget.category_name,
                        spent,
                        allocated,
                        newTotal: spent + parsedAmount,
                    });
                    return;
                }
            }
        }
        setBudgetWarning(null);
    }, [category, amount, budgets]);

    const handleSelectGroupDebt = (bal) => {
        // Find the member's email from the group members
        setRecipientType('email');
        if (bal.email) {
            setRecipientIdentifier(bal.email);
        }
        // Set the amount to what you owe them
        const owedAmount = parseFloat(bal.current_user_owes_them) || 0;
        if (owedAmount > 0) {
            setAmount(owedAmount.toFixed(2));
        }
        setNote(`Group settlement: ${groups.find(g => String(g.group_id) === String(selectedGroupId))?.group_name || 'Group'}`);
    };

    // Auto-fill recipient if deep linked
    useEffect(() => {
        const urlSettleUserId = searchParams.get('settleUserId');
        if (urlSettleUserId && groupBalances.length > 0) {
            const bal = groupBalances.find(b => String(b.user_id) === String(urlSettleUserId));
            if (bal) {
                handleSelectGroupDebt(bal);
            }
        }
    }, [groupBalances, searchParams]);

    const handlePayment = async (e) => {
        e.preventDefault();
        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            alert('Please enter a valid positive amount.');
            return;
        }
        if (!recipientIdentifier.trim()) {
            alert('Please enter a recipient.');
            return;
        }

        // Budget over-limit warning — ask for confirmation but don't block
        if (budgetWarning) {
            const proceed = confirm(
                `⚠️ Budget Warning: This payment will bring your "${budgetWarning.category}" spending to ₹${budgetWarning.newTotal.toFixed(2)} (budget: ₹${budgetWarning.allocated.toFixed(2)}).\n\nDo you want to proceed anyway?`
            );
            if (!proceed) return;
        }

        setLoading(true);
        try {
            await api.post('/api/payments', {
                recipient_type: recipientType,
                recipient_identifier: recipientIdentifier.trim(),
                amount: Math.round(parsedAmount * 100) / 100,
                note,
                category: category || null,
                upi_ref: senderUpi || null,
                payment_type: paymentType,
                group_id: paymentType === 'GROUP' ? selectedGroupId : null,
            });
            // If "Pay & Split", also create an equal split group expense
            if (paymentType === 'GROUP' && groupActionMode === 'EXPENSE' && selectedGroupId) {
                try {
                    await api.post(`/api/groups/${selectedGroupId}/expenses`, {
                        amount: Math.round(parsedAmount * 100) / 100,
                        description: note || 'Paid & Split via Payments',
                        category: category || 'General',
                        // split_with empty triggers equal split among all group members in backend
                    });
                } catch (expErr) {
                    console.error('Failed to create split for payment:', expErr);
                    alert('Payment sent, but failed to automatically create the group split.');
                }
            }

            alert('Payment sent successfully!');
            setAmount('');
            setRecipientIdentifier('');
            setNote('');
            setCategory('');
            setBudgetWarning(null);
            fetchHistory();
            fetchBudgets();
            // Refresh group balances if it was a group payment
            if (paymentType === 'GROUP' && selectedGroupId) {
                const res = await api.get(`/api/groups/${selectedGroupId}/balances`);
                setGroupBalances(res.data);
            }
        } catch (err) {
            alert('Payment Failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Get debts where current user owes others in the selected group
    const groupDebts = groupBalances.filter(b => 
        b.user_id !== user?.user_id && (parseFloat(b.current_user_owes_them) || 0) > 0
    );

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
                    
                    {/* Amount Block */}
                    <div className="flex flex-col items-center justify-center mb-10 mt-4">
                        <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-4">Transfer Amount</label>
                        <div className="flex items-center justify-center">
                            <span className="text-3xl text-gray-400 font-light mr-1">₹</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="text-4xl md:text-5xl font-light text-gray-900 bg-transparent w-full max-w-[250px] text-center focus:outline-none placeholder-gray-200"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Budget Warning */}
                    {budgetWarning && (
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-amber-800">Over Budget Warning</p>
                                <p className="text-xs text-amber-700 mt-1">
                                    This will bring <strong>{budgetWarning.category}</strong> spending to ₹{budgetWarning.newTotal.toFixed(2)} 
                                    (limit: ₹{budgetWarning.allocated.toFixed(2)}). You can still proceed.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Segmented Controls for Payment Type */}
                        <div>
                            <div className="flex bg-gray-50 p-1 rounded-xl mb-3">
                                <button type="button" onClick={() => { setPaymentType('PERSONAL'); setSelectedGroupId(''); }} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${paymentType === 'PERSONAL' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>Personal Transfer</button>
                                <button type="button" onClick={() => setPaymentType('GROUP')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${paymentType === 'GROUP' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>Group Settlement</button>
                            </div>
                            
                            {paymentType === 'GROUP' && (
                                <>
                                    <select className="input text-center font-medium text-blue-600 bg-blue-50 border-blue-100 focus:ring-blue-500 shadow-none mb-3" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} required>
                                        <option value="">-- Select Group --</option>
                                        {groups.map(g => (
                                            <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                                        ))}
                                    </select>
                                    {/* Sub-toggle for Group Action Mode */}
                                    <div className="flex bg-gray-100 p-1 rounded-lg mb-4 mt-2 max-w-xs mx-auto">
                                        <button type="button" onClick={() => setGroupActionMode('SETTLE')} className={`flex-1 py-1 text-xs font-medium rounded transition-all ${groupActionMode === 'SETTLE' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500'}`}>Settle Existing Debt</button>
                                        <button type="button" onClick={() => setGroupActionMode('EXPENSE')} className={`flex-1 py-1 text-xs font-medium rounded transition-all ${groupActionMode === 'EXPENSE' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500'}`}>Pay & Split Equally</button>
                                    </div>

                                    {/* Show group debts when SETTLE is selected */}
                                    {selectedGroupId && groupActionMode === 'SETTLE' && (
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-2">
                                            <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-3">Your Debts in This Group</p>
                                            {groupBalancesLoading ? (
                                                <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                                            ) : groupDebts.length === 0 ? (
                                                <p className="text-sm text-gray-500 italic">No outstanding debts in this group.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {groupDebts.map(bal => {
                                                        const owedAmount = parseFloat(bal.current_user_owes_them) || 0;
                                                        return (
                                                            <button
                                                                key={bal.user_id}
                                                                type="button"
                                                                onClick={() => handleSelectGroupDebt(bal)}
                                                                className="w-full flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                                                            >
                                                                <div>
                                                                    <span className="text-sm font-medium text-gray-900">{bal.name}</span>
                                                                    <span className="text-xs text-gray-400 ml-2">tap to select</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-red-600">₹{owedAmount.toFixed(2)}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
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
                                        {p.direction === 'sent' ? '-' : '+'}₹{(parseFloat(p.amount) || 0).toFixed(2)}
                                    </p>
                                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mt-1">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</p>
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
