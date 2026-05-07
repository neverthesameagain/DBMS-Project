import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Receipt, Users, ArrowRightCircle } from 'lucide-react';

const CATEGORIES = ['General', 'Food', 'Travel', 'Entertainment', 'Shopping', 'Utilities', 'Health'];

const GroupDetails = () => {
    const { groupId } = useParams();
    const { user } = useAuth();
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Expense form
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('General');
    const [splits, setSplits] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [expenseFormError, setExpenseFormError] = useState('');
    const [recentPayments, setRecentPayments] = useState([]);
    const [selectedPaymentId, setSelectedPaymentId] = useState('');

    // Add member
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('Member');
    const [addingMember, setAddingMember] = useState(false);

    // Balances
    const [balances, setBalances] = useState([]);

    // Edit logic
    const [editExpenseId, setEditExpenseId] = useState(null);

    const isAdmin = members.some(m => m.user_id === user?.user_id && m.role === 'Admin');

    const fetchAll = async () => {
        try {
            const [groupRes, membersRes, expensesRes, balancesRes, paymentsRes] = await Promise.all([
                api.get(`/api/groups/${groupId}`),
                api.get(`/api/groups/${groupId}/members`),
                api.get(`/api/groups/${groupId}/expenses`),
                api.get(`/api/groups/${groupId}/balances`),
                api.get('/api/payments'),
            ]);
            setGroup(groupRes.data);
            setMembers(membersRes.data);
            setExpenses(expensesRes.data);
            setBalances(balancesRes.data);
            setRecentPayments((paymentsRes.data || []).filter((p) => p.direction === 'sent'));

            const initSplits = {};
            membersRes.data.forEach((m) => {
                initSplits[m.user_id] = 0;
            });
            setSplits(initSplits);
        } catch {
            setError('Failed to load group details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const handleEqualSplit = () => {
        if (!amount || !members.length) return;
        const total = parseFloat(amount);
        if (isNaN(total) || total <= 0) return;
        const share = parseFloat((total / members.length).toFixed(2));
        const newSplits = {};
        let running = 0;
        members.forEach((m, idx) => {
            if (idx === members.length - 1) {
                newSplits[m.user_id] = parseFloat((total - running).toFixed(2));
            } else {
                newSplits[m.user_id] = share;
                running += share;
            }
        });
        setSplits(newSplits);
    };

    const submitExpense = async (e) => {
        e.preventDefault();
        setExpenseFormError('');
        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            setExpenseFormError('Amount must be a positive number');
            return;
        }

        // Build the splits payload — send actual amounts, not just IDs
        const splitEntries = {};
        let hasCustomAmounts = false;
        for (const [uid, val] of Object.entries(splits)) {
            const v = parseFloat(val || 0);
            if (v > 0) {
                splitEntries[uid] = v;
                hasCustomAmounts = true;
            }
        }

        if (!hasCustomAmounts) {
            setExpenseFormError('Set the split amounts first (use "Split Equally" or enter custom amounts)');
            return;
        }

        setSubmitting(true);
        try {
            if (editExpenseId) {
                await api.put(`/api/groups/${groupId}/expenses/${editExpenseId}`, {
                    amount: parsedAmount,
                    description
                });
            } else {
                // Send splits as a dict of {user_id: amount} so the backend uses custom amounts
                await api.post(`/api/groups/${groupId}/expenses`, {
                    amount: parsedAmount,
                    description,
                    category,
                    splits: splitEntries,
                });
            }
            setShowExpenseForm(false);
            setEditExpenseId(null);
            setAmount('');
            setDescription('');
            setSelectedPaymentId('');
            setExpenseFormError('');
            fetchAll();
        } catch (err) {
            setExpenseFormError(err.response?.data?.error || err.message || 'Failed to save expense');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteExpenseEvent = async (exp) => {
        if (!confirm('Delete this entire expense event block?')) return;
        try {
            await Promise.all(exp.splits.map(s => api.delete(`/api/groups/${groupId}/expenses/${s.expense_id}`)));
            fetchAll();
        } catch (err) {
            alert('Failed to delete: ' + (err.response?.data?.error || err.message));
        }
    };

    const navigate = useNavigate();

    const handleSettle = (paidToId, owedAmount) => {
        navigate(`/payments?groupId=${groupId}&settleUserId=${paidToId}&amount=${owedAmount}`);
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await api.put(`/api/groups/${groupId}/members/${userId}`, { role: newRole });
            fetchAll();
        } catch (err) {
            alert('Failed to change role: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!confirm('Remove member?')) return;
        try {
            await api.delete(`/api/groups/${groupId}/members/${userId}`);
            fetchAll();
        } catch (err) {
            alert('Failed to remove: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        setAddingMember(true);
        try {
            await api.post(`/api/groups/${groupId}/members`, { email: newMemberEmail, role: newMemberRole });
            setNewMemberEmail('');
            fetchAll();
        } catch (err) {
            alert('Failed to add member: ' + (err.response?.data?.error || err.message));
        } finally {
            setAddingMember(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    // Safe total spending calculation — use total_amount from event objects
    const totalSpending = expenses.reduce((sum, exp) => {
        const val = parseFloat(exp.total_amount);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    // Compute the running split total to help the user
    const splitTotal = Object.values(splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">{group?.group_name}</h2>
                    <p className="text-gray-500">{members.length} members</p>
                </div>
                {isAdmin && (
                    <form onSubmit={handleAddMember} className="flex gap-2">
                        <input
                            type="email"
                            placeholder="Add member by email..."
                            className="input py-1 px-3 text-sm h-10 w-48"
                            value={newMemberEmail}
                            onChange={e => setNewMemberEmail(e.target.value)}
                            required
                        />
                        <select
                            className="input py-1 px-2 text-sm h-10 w-28"
                            value={newMemberRole}
                            onChange={e => setNewMemberRole(e.target.value)}
                        >
                            <option value="Member">Member</option>
                            <option value="Admin">Admin</option>
                        </select>
                        <button type="submit" disabled={addingMember} className="btn btn-secondary h-10 flex items-center gap-1 px-3">
                            {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </button>
                    </form>
                )}
            </header>

            {/* Minimalist Splitwise Group Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Spending</p>
                        <h3 className="text-3xl font-light text-gray-900 flex items-baseline gap-1">
                            <span className="text-lg text-gray-400 font-medium">₹</span>
                            {totalSpending.toFixed(2)}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Your Share</p>
                        <h3 className="text-3xl font-light text-indigo-600 flex items-baseline gap-1">
                            <span className="text-lg text-indigo-400 font-medium">₹</span>
                            {(parseFloat(balances.find(b => b.user_id === user?.user_id)?.total_paid) || 0).toFixed(2)}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        {(() => {
                            const myBal = balances.find(b => b.user_id === user?.user_id);
                            const net = myBal ? parseFloat(myBal.net) || 0 : 0;
                            if (!myBal) return <><p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p><h3 className="text-xl font-light text-gray-400 mt-1">No activity</h3></>;
                            if (net > 0) return (
                                <>
                                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Getting Back</p>
                                    <h3 className="text-3xl font-light text-emerald-600 flex items-baseline gap-1"><span className="text-lg text-emerald-400 font-medium">₹</span>{net.toFixed(2)}</h3>
                                </>
                            );
                            if (net < 0) return (
                                <>
                                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">You Owe</p>
                                    <h3 className="text-3xl font-light text-red-600 flex items-baseline gap-1"><span className="text-lg text-red-400 font-medium">₹</span>{Math.abs(net).toFixed(2)}</h3>
                                </>
                            );
                            return (
                                <>
                                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                    <h3 className="text-2xl font-light text-gray-800">Settled Up</h3>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Add/Edit Expense */}
            <section>
                <button onClick={() => {
                    setAmount(''); setDescription(''); setEditExpenseId(null);
                    setExpenseFormError('');
                    setShowExpenseForm(!showExpenseForm);
                }} className="btn btn-primary flex items-center gap-2 mb-6">
                    <Plus className="w-4 h-4" /> {showExpenseForm ? 'Cancel' : 'Add Expense'}
                </button>

                {showExpenseForm && (
                    <div className="card bg-gray-50 mb-8 border-indigo-100">
                        <h3 className="font-bold text-lg mb-4">{editExpenseId ? 'Edit Expense' : 'Add Expense'}</h3>
                        <form onSubmit={submitExpense} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {!editExpenseId && recentPayments.length > 0 && (
                                    <div className="md:col-span-3 mb-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Split an existing payment? (Optional)</label>
                                        <select 
                                            className="input" 
                                            value={selectedPaymentId} 
                                            onChange={e => {
                                                setSelectedPaymentId(e.target.value);
                                                if (e.target.value) {
                                                    const p = recentPayments.find(p => p.payment_id === parseInt(e.target.value));
                                                    if (p) {
                                                        setAmount(p.amount);
                                                        setDescription(p.note || `Payment to ${p.to_name}`);
                                                        if (p.category) setCategory(p.category);
                                                    }
                                                } else {
                                                    setAmount('');
                                                    setDescription('');
                                                }
                                            }}
                                        >
                                            <option value="">-- No, create manual expense --</option>
                                            {recentPayments.map(p => (
                                                <option key={p.payment_id} value={p.payment_id}>
                                                    ₹{parseFloat(p.amount).toFixed(2)} to {p.to_name} ({new Date(p.created_at).toLocaleDateString()})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Amount (₹)</label>
                                    <input type="number" step="0.01" min="0.01" className="input" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <input type="text" className="input" placeholder="Dinner, Taxi..." value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Category</label>
                                    <select className="input" value={category} onChange={e => setCategory(e.target.value)} disabled={editExpenseId}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            {!editExpenseId && (
                                <>
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-medium text-sm text-gray-700">Split Breakdown</h4>
                                        <button type="button" onClick={handleEqualSplit} className="text-xs text-indigo-600 font-medium hover:underline">
                                            Split Equally
                                        </button>
                                    </div>

                                    <div className="space-y-2 bg-white p-4 rounded-lg border border-gray-200">
                                        {members.map(member => (
                                            <div key={member.user_id} className="flex justify-between items-center gap-4">
                                                <span className="text-sm text-gray-700 w-1/3 truncate">
                                                    {member.first_name} {member.last_name}
                                                    {member.user_id === user?.user_id && ' (you)'}
                                                </span>
                                                <input
                                                    type="number" step="0.01" min="0" className="input text-right"
                                                    value={splits[member.user_id] || ''}
                                                    onChange={e => setSplits({ ...splits, [member.user_id]: e.target.value })}
                                                />
                                            </div>
                                        ))}
                                        {/* Split total indicator */}
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                                            <span className="text-sm font-bold text-gray-700">Split Total</span>
                                            <span className={`text-sm font-bold ${Math.abs(splitTotal - (parseFloat(amount) || 0)) < 0.02 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                ₹{splitTotal.toFixed(2)} / ₹{(parseFloat(amount) || 0).toFixed(2)}
                                                {Math.abs(splitTotal - (parseFloat(amount) || 0)) >= 0.02 && ' ⚠️'}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {expenseFormError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {expenseFormError}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setExpenseFormError('');
                                        setShowExpenseForm(false);
                                    }}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Members */}
                <div className="card">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5" /> Members
                    </h3>
                    <ul className="divide-y divide-gray-100">
                        {members.map(m => (
                            <li key={m.user_id} className="py-3 flex justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {m.first_name} {m.last_name}
                                        {m.user_id === user?.user_id && <span className="text-xs text-indigo-500 ml-1">(you)</span>}
                                    </p>
                                    <p className="text-xs text-gray-500">{m.email}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isAdmin && m.user_id !== user?.user_id ? (
                                        <select 
                                            className="text-xs border-gray-300 rounded p-1"
                                            value={m.role}
                                            onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Member">Member</option>
                                        </select>
                                    ) : (
                                        <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">{m.role}</span>
                                    )}
                                    {isAdmin && m.user_id !== user?.user_id && (
                                        <button onClick={() => handleRemoveMember(m.user_id)} className="text-red-500 text-xs hover:underline">Remove</button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Expenses */}
                <div className="card">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Receipt className="w-5 h-5" /> Recent Expenses
                    </h3>
                    {expenses.length > 0 ? (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {expenses.map(exp => (
                                <div key={exp.event_id} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-900">{exp.description || exp.category}</p>
                                            <p className="text-xs text-gray-500">Paid by {exp.payer_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900">₹{(parseFloat(exp.total_amount) || 0).toFixed(2)}</p>
                                            <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mt-1">{exp.created_at ? new Date(exp.created_at).toLocaleDateString() : ''}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-3 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">Split Details</p>
                                            {isAdmin && (
                                                <button onClick={() => handleDeleteExpenseEvent(exp)} className="text-[0.65rem] font-bold text-red-500 uppercase tracking-widest hover:text-red-700 transition-colors">
                                                    Delete Event
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            {(exp.splits || []).map(s => (
                                                <div key={s.expense_id} className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-600">{s.debtor_name}</span>
                                                    <span className="font-medium text-gray-900 truncate">₹{(parseFloat(s.amount) || 0).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm italic">No expenses yet.</p>
                    )}
                </div>
            </div>

            {/* Balances — simplified "who owes whom" + settle */}
            <div className="card mt-6 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Balances</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Net amounts from unsettled splits in this group only.
                        </p>
                    </div>
                </div>

                {balances.length === 0 ? (
                    <p className="text-sm text-gray-500">No balance data yet.</p>
                ) : (
                    (() => {
                        const mine = balances.find((b) => b.user_id === user?.user_id);
                        const others = balances.filter((b) => b.user_id !== user?.user_id);
                        const iOwe = others.filter((b) => (parseFloat(b.current_user_owes_them) || 0) > 0);
                        const oweMe = others.filter((b) => (parseFloat(b.they_owe_current_user) || 0) > 0);
                        const nothingForYou = iOwe.length === 0 && oweMe.length === 0;

                        return (
                            <div className="space-y-8">
                                {nothingForYou && (
                                    <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-5 py-6 text-center">
                                        <p className="text-emerald-800 font-semibold">Everyone is settled up</p>
                                        <p className="text-sm text-emerald-700/90 mt-1">
                                            No open debts between members in this group.
                                        </p>
                                    </div>
                                )}

                                {iOwe.length > 0 && (
                                    <div>
                                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400 mb-3">
                                            You pay
                                        </p>
                                        <ul className="space-y-3">
                                            {iOwe.map((b) => {
                                                const owed = parseFloat(b.current_user_owes_them) || 0;
                                                return (
                                                    <li
                                                        key={b.user_id}
                                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="mt-0.5 rounded-full bg-red-50 p-2 text-red-600">
                                                                <ArrowRightCircle className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-900">{b.name}</p>
                                                                <p className="text-sm text-gray-600 mt-0.5">
                                                                    You owe{' '}
                                                                    <span className="font-bold text-red-600 tabular-nums">
                                                                        ₹{owed.toFixed(2)}
                                                                    </span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSettle(b.user_id, owed)}
                                                            className="btn btn-primary text-sm shrink-0 py-2 px-5 rounded-xl"
                                                        >
                                                            Settle ₹{owed.toFixed(2)}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {oweMe.length > 0 && (
                                    <div>
                                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400 mb-3">
                                            You&apos;re owed
                                        </p>
                                        <ul className="space-y-2">
                                            {oweMe.map((b) => {
                                                const amt = parseFloat(b.they_owe_current_user) || 0;
                                                return (
                                                    <li
                                                        key={b.user_id}
                                                        className="flex justify-between items-center rounded-xl bg-gray-50 px-4 py-3 text-sm"
                                                    >
                                                        <span className="font-medium text-gray-900">{b.name}</span>
                                                        <span className="font-bold text-emerald-700 tabular-nums">
                                                            ₹{amt.toFixed(2)}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <p className="text-xs text-gray-400 mt-2">
                                            They can settle with you from their account using Payments.
                                        </p>
                                    </div>
                                )}

                                <details className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
                                    <summary className="cursor-pointer text-sm font-medium text-gray-700">
                                        Full member snapshot
                                    </summary>
                                    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                                        {balances.map((b) => {
                                            const net = parseFloat(b.net) || 0;
                                            const isSelf = b.user_id === user?.user_id;
                                            return (
                                                <div
                                                    key={b.user_id}
                                                    className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0"
                                                >
                                                    <span className="text-gray-700">
                                                        {b.name}
                                                        {isSelf && (
                                                            <span className="text-indigo-500 ml-1">(you)</span>
                                                        )}
                                                    </span>
                                                    <span
                                                        className={`font-semibold tabular-nums ${
                                                            net > 0.005
                                                                ? 'text-emerald-600'
                                                                : net < -0.005
                                                                  ? 'text-red-600'
                                                                  : 'text-gray-400'
                                                        }`}
                                                    >
                                                        {Math.abs(net) < 0.005
                                                            ? 'Even'
                                                            : net > 0
                                                              ? `+₹${net.toFixed(2)}`
                                                              : `−₹${Math.abs(net).toFixed(2)}`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                        <p className="text-[0.65rem] text-gray-400 mt-3 leading-relaxed">
                                            Snapshot net is for this group only (positive ≈ more owed to you than you
                                            owe).
                                        </p>
                                </details>
                            </div>
                        );
                    })()
                )}
            </div>
        </div>
    );
};

export default GroupDetails;
