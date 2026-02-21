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
    const [addingMember, setAddingMember] = useState(false);

    const fetchAll = async () => {
        try {
            const [groupRes, membersRes, expensesRes] = await Promise.all([
                api.get(`/api/groups/${groupId}`),
                api.get(`/api/groups/${groupId}/members`),
                api.get(`/api/groups/${groupId}/expenses`),
            ]);
            setGroup(groupRes.data);
            setMembers(membersRes.data);
            setExpenses(expensesRes.data);

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
            await api.post(`/api/groups/${groupId}/expenses`, {
                amount: parseFloat(amount),
                description,
                category,
                split_with: Object.keys(splits).map(Number),
            });
            setShowExpenseForm(false);
            setAmount('');
            setDescription('');
            fetchAll();
        } catch (err) {
            alert('Error adding expense: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        setAddingMember(true);
        try {
            await api.post(`/api/groups/${groupId}/members`, { email: newMemberEmail });
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
                <form onSubmit={handleAddMember} className="flex gap-2">
                    <input
                        type="email"
                        placeholder="Add member by email..."
                        className="input py-1 px-3 text-sm h-10 w-64"
                        value={newMemberEmail}
                        onChange={e => setNewMemberEmail(e.target.value)}
                        required
                    />
                    <button type="submit" disabled={addingMember} className="btn btn-secondary h-10 flex items-center gap-1">
                        {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                </form>
            </header>

            {/* Add Expense */}
            <section>
                <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="btn btn-primary flex items-center gap-2 mb-6">
                    <Plus className="w-4 h-4" /> Add Expense
                </button>

                {showExpenseForm && (
                    <div className="card bg-gray-50 mb-8 border-indigo-100">
                        <h3 className="font-bold text-lg mb-4">Add Expense</h3>
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
                                    <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <h4 className="font-medium text-sm text-gray-700">Split Preview</h4>
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
                                <span className="text-sm text-gray-500">{m.role}</span>
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
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                            {expenses.map(exp => (
                                <div key={exp.expense_id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{exp.description || exp.category}</p>
                                        <p className="text-xs text-gray-500">Paid by {exp.payer_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900">₹{exp.amount}</p>
                                        <p className="text-xs text-gray-400">{new Date(exp.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm italic">No expenses yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroupDetails;
