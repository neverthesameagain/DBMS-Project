import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useParams } from 'react-router-dom';
import { Loader2, Plus, Receipt, Users } from 'lucide-react';

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
            const [groupRes, membersRes, expensesRes, balancesRes] = await Promise.all([
                api.get(`/api/groups/${groupId}`),
                api.get(`/api/groups/${groupId}/members`),
                api.get(`/api/groups/${groupId}/expenses`),
                api.get(`/api/groups/${groupId}/balances`),
            ]);
            setGroup(groupRes.data);
            setMembers(membersRes.data);
            setExpenses(expensesRes.data);
            setBalances(balancesRes.data);

            // Init equal splits
            const initSplits = {};
            membersRes.data.forEach(m => { initSplits[m.user_id] = 0; });
            setSplits(initSplits);
        } catch (err) {
            setError('Failed to load group details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, [groupId]);

    const handleEqualSplit = () => {
        if (!amount || !members.length) return;
        const total = parseFloat(amount);
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
        if (!amount || parseFloat(amount) <= 0) return alert('Invalid amount');
        setSubmitting(true);
        try {
            if (editExpenseId) {
                await api.put(`/api/groups/${groupId}/expenses/${editExpenseId}`, {
                    amount: parseFloat(amount),
                    description
                });
            } else {
                await api.post(`/api/groups/${groupId}/expenses`, {
                    amount: parseFloat(amount),
                    description,
                    category,
                    split_with: Object.keys(splits).map(Number).filter(id => parseFloat(splits[id] || 0) > 0),
                });
            }
            setShowExpenseForm(false);
            setEditExpenseId(null);
            setAmount('');
            setDescription('');
            fetchAll();
        } catch (err) {
            alert('Error adding/editing expense: ' + (err.response?.data?.error || err.message));
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

    const handleSettle = async (paidToId) => {
        try {
            await api.post(`/api/groups/${groupId}/settle`, { paid_to: paidToId });
            fetchAll();
            alert('Debt settled successfully!');
        } catch (err) {
            alert('Failed to settle: ' + (err.response?.data?.error || err.message));
        }
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
                            {expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0).toFixed(2)}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Your Share</p>
                        <h3 className="text-3xl font-light text-indigo-600 flex items-baseline gap-1">
                            <span className="text-lg text-indigo-400 font-medium">₹</span>
                            {(balances.find(b => b.user_id === user?.user_id)?.total_paid || 0).toFixed(2)}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        {(() => {
                            const myBal = balances.find(b => b.user_id === user?.user_id);
                            if (!myBal) return <><p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p><h3 className="text-xl font-light text-gray-400 mt-1">No activity</h3></>;
                            if (myBal.net > 0) return (
                                <>
                                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Getting Back</p>
                                    <h3 className="text-3xl font-light text-emerald-600 flex items-baseline gap-1"><span className="text-lg text-emerald-400 font-medium">₹</span>{myBal.net.toFixed(2)}</h3>
                                </>
                            );
                            if (myBal.net < 0) return (
                                <>
                                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">You Owe</p>
                                    <h3 className="text-3xl font-light text-red-600 flex items-baseline gap-1"><span className="text-lg text-red-400 font-medium">₹</span>{Math.abs(myBal.net).toFixed(2)}</h3>
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
                    setShowExpenseForm(!showExpenseForm);
                }} className="btn btn-primary flex items-center gap-2 mb-6">
                    <Plus className="w-4 h-4" /> {showExpenseForm ? 'Cancel' : 'Add Expense'}
                </button>

                {showExpenseForm && (
                    <div className="card bg-gray-50 mb-8 border-indigo-100">
                        <h3 className="font-bold text-lg mb-4">{editExpenseId ? 'Edit Expense' : 'Add Expense'}</h3>
                        <form onSubmit={submitExpense} className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Amount (₹)</label>
                                    <input type="number" className="input" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
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
                                                    type="number" step="0.01" className="input text-right"
                                                    value={splits[member.user_id] || ''}
                                                    onChange={e => setSplits({ ...splits, [member.user_id]: e.target.value })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowExpenseForm(false)} className="btn btn-secondary">Cancel</button>
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
                                            <p className="font-bold text-gray-900">₹{exp.total_amount.toFixed(2)}</p>
                                            <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(exp.created_at).toLocaleDateString()}</p>
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
                                            {exp.splits.map(s => (
                                                <div key={s.expense_id} className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-600">{s.debtor_name}</span>
                                                    <span className="font-medium text-gray-900 truncate">₹{s.amount.toFixed(2)}</span>
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

            {/* Balances Sheet */}
            <div className="card mt-6">
                <h3 className="font-bold mb-4">Group Balances</h3>
                <div className="space-y-3">
                    {balances.length === 0 && <p className="text-sm text-gray-500">No balance data tracked yet.</p>}
                    {balances.map(b => (
                        <div key={b.user_id} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50">
                            <span className="font-medium text-gray-900">{b.name} {b.user_id === user?.user_id && <span className="text-xs text-indigo-500 ml-1">(you)</span>}</span>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    {b.net > 0 ? (
                                        <span className="text-green-600 font-bold block">Owed ₹{b.net}</span>
                                    ) : b.net < 0 ? (
                                        <span className="text-red-600 font-bold block">Owes ₹{Math.abs(b.net)}</span>
                                    ) : (
                                        <span className="text-gray-500 font-bold block">Settled Up</span>
                                    )}
                                </div>
                                {b.net > 0 && b.user_id !== user?.user_id && (
                                    <button 
                                        onClick={() => handleSettle(b.user_id)} 
                                        className="btn btn-primary text-xs py-1 px-3 mt-1"
                                    >
                                        Settle Debt
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GroupDetails;
