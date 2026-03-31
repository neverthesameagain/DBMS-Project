import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, Calendar, CheckCircle, Trash2 } from 'lucide-react';

const CATEGORIES = ['General', 'Food', 'Travel', 'Entertainment', 'Shopping', 'Insurance', 'Health', 'Utilities', 'Other'];

const FutureExpenses = () => {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [category, setCategory] = useState('General');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/future-expenses');
            setExpenses(res.data);
        } catch (err) {
            console.error('Failed to load future expenses', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const handleAdd = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/future-expenses', {
                title,
                estimated_amount: parseFloat(amount),
                due_date: dueDate || null,
                category,
            });
            setTitle('');
            setAmount('');
            setDueDate('');
            setCategory('General');
            fetchData();
        } catch (err) {
            alert('Failed to add: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleComplete = async (id) => {
        try {
            await api.patch(`/api/future-expenses/${id}`, { is_completed: true });
            fetchData();
        } catch (err) {
            alert('Failed to update');
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/future-expenses/${id}`);
            fetchData();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    const pending = expenses.filter(e => e.status !== 'COMPLETED' && e.status !== 'CANCELLED');
    const done = expenses.filter(e => e.status === 'COMPLETED');

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
                    <Calendar className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Future Expenses</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Plan and track upcoming financial responsibilities.</p>
                </div>
            </header>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Plan New Expense</h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">Title</label>
                        <input type="text" className="input" placeholder="e.g. Car Insurance" value={title} onChange={e => setTitle(e.target.value)} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Category</label>
                        <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                        <input type="number" className="input" value={amount} onChange={e => setAmount(e.target.value)} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Due Date</label>
                        <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary md:col-span-5" disabled={submitting}>
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Plan It'}
                    </button>
                </form>
            </div>

            {/* Pending */}
            {pending.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-8 mb-4">Upcoming</h3>
                    <div className="grid gap-3">
                        {pending.map(exp => (
                            <div key={exp.future_id} className="bg-white rounded-2xl shadow-sm border border-l-4 border-blue-400 border-y-gray-100 border-r-gray-100 p-5 flex justify-between items-center transition-shadow hover:shadow-md">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-bold text-gray-900">{exp.title}</h4>
                                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                                            {exp.category}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        {exp.due_date ? `Due: ${new Date(exp.due_date).toLocaleDateString()}` : 'No specific due date'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-xl text-gray-900">₹{exp.estimated_amount}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleComplete(exp.future_id)} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors" title="Mark Done">
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(exp.future_id)} className="p-2 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors" title="Delete">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Completed */}
            {done.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-8 mb-4">Completed</h3>
                    <div className="grid gap-3">
                        {done.map(exp => (
                            <div key={exp.future_id} className="bg-white rounded-2xl border border-gray-100 p-5 opacity-60 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold line-through">{exp.title}</h4>
                                    <p className="text-sm text-gray-500">{exp.category}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-lg">₹{exp.estimated_amount}</span>
                                    <button onClick={() => handleDelete(exp.future_id)} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Delete">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {expenses.length === 0 && (
                <p className="text-center text-gray-500 py-8">No planned expenses. Add one above!</p>
            )}
        </div>
    );
};

export default FutureExpenses;
