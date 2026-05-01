import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, PieChart, Trash2, Plus, Edit2, Check, X } from 'lucide-react';

const CATEGORIES = [
  { id: 1, name: 'Food' },
  { id: 2, name: 'Travel' },
  { id: 3, name: 'Entertainment' },
  { id: 4, name: 'Shopping' },
  { id: 5, name: 'Utilities' },
  { id: 6, name: 'Insurance' },
  { id: 7, name: 'Health' },
  { id: 8, name: 'General' },
];

const Budgets = () => {
    const { user } = useAuth();
    const [budgets, setBudgets] = useState([]);
    const [loading, setLoading] = useState(true);

    const [category, setCategory] = useState(1);
    const [amount, setAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Edit State
    const [editCategoryId, setEditCategoryId] = useState(null);
    const [editAmount, setEditAmount] = useState('');

    const handleEditStart = (b) => {
        setEditCategoryId(b.category_id);
        setEditAmount(b.allocated_amount);
    };

    const handleEditSave = async (catId) => {
        if (!editAmount) return;
        try {
            await api.put(`/api/budgets/${catId}`, { allocated_amount: parseFloat(editAmount) });
            setEditCategoryId(null);
            fetchBudgets();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update budget');
        }
    };

    const fetchBudgets = async () => {
        try {
            const res = await api.get('/api/budgets');
            setBudgets(res.data);
        } catch (err) {
            console.error('Failed to load budgets', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchBudgets();
    }, [user]);

    const handleAdd = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/budgets', {
                category_id: parseInt(category),
                allocated_amount: parseFloat(amount),
                duration: 30
            });
            setAmount('');
            fetchBudgets();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to set budget');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (catId) => {
        try {
            await api.delete(`/api/budgets/${catId}`);
            fetchBudgets();
        } catch {
            alert('Failed to delete budget');
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-medium text-gray-900 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-gray-400" /> Active Budgets
                </h2>
                <div className="text-right">
                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Available Funds</p>
                    <h3 className="text-2xl font-light text-emerald-600 flex items-baseline gap-1 justify-end">
                        <span className="text-sm text-emerald-400 font-medium">₹</span>
                        {user.current_balance}
                    </h3>
                </div>
            </div>

            <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-2xl mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Allocate Standard Budget</h3>
                <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-2">Target Category</label>
                        <select className="input h-11 bg-gray-50 border-gray-200" value={category} onChange={e => setCategory(e.target.value)}>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-2">Max Limit (₹)</label>
                        <input type="number" className="input h-11 bg-gray-50 border-gray-200" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required min="0" />
                    </div>
                    <button type="submit" disabled={submitting} className="btn btn-primary h-11 px-6 rounded-xl flex items-center gap-2">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {budgets.length === 0 && <p className="text-gray-400 text-sm italic col-span-2 text-center py-12">No budgets mapped to categories yet.</p>}
                {budgets.map(b => {
                    const pct = Math.min((b.amount_spent / b.allocated_amount) * 100, 100) || 0;
                    const isOver = b.amount_spent >= b.allocated_amount;
                    return (
                        <div key={b.category_id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="font-medium text-gray-900">{b.category_name}</h4>
                                <div className="flex items-center gap-1">
                                    {editCategoryId !== b.category_id && (
                                        <button onClick={() => handleEditStart(b)} className="text-gray-400 hover:text-blue-500 transition-colors p-1" title="Edit limit">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(b.category_id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete Budget">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            {editCategoryId === b.category_id ? (
                                <div className="flex items-center gap-2 mb-3 py-1">
                                    <span className="text-sm font-bold text-gray-400">₹</span>
                                    <input type="number" className="input h-9 py-1 px-3 text-sm max-w-[140px]" value={editAmount} onChange={e => setEditAmount(e.target.value)} autoFocus />
                                    <button onClick={() => handleEditSave(b.category_id)} className="p-1.5 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditCategoryId(null)} className="p-1.5 text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <div className="flex items-end justify-between mb-3">
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-2xl font-light ${isOver ? 'text-red-600' : 'text-gray-900'}`}>₹{b.amount_spent}</span>
                                        <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest pl-1">Spent</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm text-gray-400 font-medium">/ ₹{b.allocated_amount}</span>
                                    </div>
                                </div>
                            )}
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                <div className={`h-1.5 rounded-full ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-orange-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }}></div>
                            </div>
                            {isOver ? (
                                <p className="text-[0.65rem] font-bold text-red-500 uppercase tracking-widest mt-3">Over Budget Line!</p>
                            ) : (
                                <p className="text-[0.65rem] font-bold text-emerald-500 uppercase tracking-widest mt-3 whitespace-nowrap overflow-hidden text-ellipsis">Tracking Safely</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Budgets;
