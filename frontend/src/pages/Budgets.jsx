import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, PieChart, Trash2, Plus, Edit2, Check, X } from 'lucide-react';

function apiErrorMessage(err) {
    const d = err?.response?.data;
    if (typeof d?.error === 'string') return d.error;
    if (typeof d?.message === 'string') return d.message;
    return err?.message || 'Request failed';
}

const Budgets = () => {
    const { user } = useAuth();
    const [budgets, setBudgets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [pageReady, setPageReady] = useState(false);
    const [budgetsError, setBudgetsError] = useState(null);
    const [categoriesError, setCategoriesError] = useState(null);

    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [editCategoryId, setEditCategoryId] = useState(null);
    const [editAmount, setEditAmount] = useState('');

    const ceiling =
        user == null
            ? 0
            : Math.max(parseFloat(user.current_balance) || 0, parseFloat(user.opening_balance) || 0);

    const canUseBudgets = user?.role === 'USER';

    const handleEditStart = (b) => {
        setEditCategoryId(b.category_id);
        setEditAmount(String(b.allocated_amount));
    };

    const handleEditSave = async (catId) => {
        if (!editAmount) return;
        try {
            await api.put(`/api/budgets/${catId}`, { allocated_amount: parseFloat(editAmount) });
            setEditCategoryId(null);
            fetchBudgetsOnly();
        } catch (err) {
            alert(apiErrorMessage(err));
        }
    };

    const fetchBudgetsOnly = async () => {
        try {
            const res = await api.get('/api/budgets');
            setBudgets(res.data);
            setBudgetsError(null);
        } catch (err) {
            setBudgets([]);
            setBudgetsError(apiErrorMessage(err));
        }
    };

    useEffect(() => {
        if (!user) return undefined;

        let cancelled = false;

        (async () => {
            setPageReady(false);
            setBudgetsError(null);
            setCategoriesError(null);

            const [bRes, cRes] = await Promise.allSettled([
                api.get('/api/budgets'),
                api.get('/api/budgets/categories'),
            ]);

            if (cancelled) return;

            if (bRes.status === 'fulfilled') {
                setBudgets(bRes.value.data || []);
                setBudgetsError(null);
            } else {
                setBudgets([]);
                setBudgetsError(apiErrorMessage(bRes.reason));
            }

            if (cRes.status === 'fulfilled') {
                const rows = cRes.value.data || [];
                setCategories(rows);
                setCategoriesError(null);
                setCategory((prev) => {
                    if (prev && rows.some((c) => String(c.category_id) === String(prev))) return prev;
                    return rows.length ? String(rows[0].category_id) : '';
                });
            } else {
                setCategories([]);
                setCategoriesError(apiErrorMessage(cRes.reason));
                setCategory('');
            }

            setPageReady(true);
        })();

        return () => {
            cancelled = true;
        };
    }, [user]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!category) {
            alert(categories.length ? 'Choose a category.' : 'No categories available yet.');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/api/budgets', {
                category_id: parseInt(category, 10),
                allocated_amount: parseFloat(amount),
                duration: 30,
            });
            setAmount('');
            fetchBudgetsOnly();
        } catch (err) {
            alert(apiErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (catId) => {
        try {
            await api.delete(`/api/budgets/${catId}`);
            fetchBudgetsOnly();
        } catch {
            alert('Failed to delete budget');
        }
    };

    if (!user || !pageReady) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
        );
    }

    const allocatedSum = budgets.reduce((s, b) => s + (parseFloat(b.allocated_amount) || 0), 0);
    const categoriesEmptyOk = !categoriesError && categories.length === 0;
    const formDisabled =
        submitting || !canUseBudgets || !!categoriesError || categories.length === 0;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-medium text-gray-900 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-gray-400" /> Active Budgets
                </h2>
                <div className="text-right">
                    <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">
                        Wallet balance
                    </p>
                    <h3 className="text-2xl font-light text-emerald-600 flex items-baseline gap-1 justify-end">
                        <span className="text-sm text-emerald-400 font-medium">₹</span>
                        {(parseFloat(user?.current_balance) || 0).toFixed(2)}
                    </h3>
                    <p className="text-[0.65rem] text-gray-400 mt-1">
                        Budget ceiling: ₹{ceiling.toFixed(2)} (max of balance & opening)
                    </p>
                </div>
            </div>

            {!canUseBudgets && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Personal budgets apply only to standard user accounts. You can still browse expense
                    categories below.
                </div>
            )}

            {budgetsError && canUseBudgets && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {budgetsError}
                </div>
            )}

            <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-2xl mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Allocate budget
                </h3>
                <p className="text-xs text-gray-500 mb-6">
                    Categories load from the database. Total allocations cannot exceed ₹{ceiling.toFixed(2)}{' '}
                    (currently allocated ₹{allocatedSum.toFixed(2)}).
                </p>
                <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Category
                        </label>
                        <select
                            className="input h-11 bg-gray-50 border-gray-200"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            required
                            disabled={formDisabled || !!categoriesError}
                        >
                            {categoriesError && <option value="">Could not load categories</option>}
                            {!categoriesError && categoriesEmptyOk && (
                                <option value="">No categories in database</option>
                            )}
                            {!categoriesError &&
                                categories.map((c) => (
                                    <option key={c.category_id} value={String(c.category_id)}>
                                        {c.category_name}
                                    </option>
                                ))}
                        </select>
                        {categoriesError && (
                            <p className="text-xs text-red-600 mt-2">{categoriesError}</p>
                        )}
                        {categoriesEmptyOk && (
                            <p className="text-xs text-gray-600 mt-2">
                                Seed reference categories (for example run{' '}
                                <code className="rounded bg-gray-100 px-1">database/seed.sql</code> or insert into{' '}
                                <code className="rounded bg-gray-100 px-1">category</code>), then refresh this page.
                            </p>
                        )}
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Max limit (₹)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            className="input h-11 bg-gray-50 border-gray-200"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            min="0"
                            disabled={formDisabled}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={formDisabled}
                        className="btn btn-primary h-11 px-6 rounded-xl flex items-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        Create
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!canUseBudgets ? (
                    <p className="text-gray-400 text-sm italic col-span-2 text-center py-12">
                        Sign in as a user account to view and edit budgets.
                    </p>
                ) : budgetsError ? null : budgets.length === 0 ? (
                    <p className="text-gray-400 text-sm italic col-span-2 text-center py-12">
                        No budgets yet.
                    </p>
                ) : (
                    budgets.map((b) => {
                        const pct =
                            b.allocated_amount > 0
                                ? Math.min((b.amount_spent / b.allocated_amount) * 100, 100)
                                : 0;
                        const isOver = b.amount_spent >= b.allocated_amount;
                        return (
                            <div
                                key={b.category_id}
                                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="font-medium text-gray-900">{b.category_name}</h4>
                                    <div className="flex items-center gap-1">
                                        {editCategoryId !== b.category_id && (
                                            <button
                                                onClick={() => handleEditStart(b)}
                                                className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                                title="Edit limit"
                                                type="button"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(b.category_id)}
                                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            title="Delete budget"
                                            type="button"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {editCategoryId === b.category_id ? (
                                    <div className="flex items-center gap-2 mb-3 py-1">
                                        <span className="text-sm font-bold text-gray-400">₹</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input h-9 py-1 px-3 text-sm max-w-[140px]"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleEditSave(b.category_id)}
                                            className="p-1.5 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditCategoryId(null)}
                                            className="p-1.5 text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-end justify-between mb-3">
                                        <div className="flex items-baseline gap-1">
                                            <span
                                                className={`text-2xl font-light ${isOver ? 'text-red-600' : 'text-gray-900'}`}
                                            >
                                                ₹{Number(b.amount_spent).toFixed(2)}
                                            </span>
                                            <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest pl-1">
                                                Spent
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm text-gray-400 font-medium">
                                                / ₹{Number(b.allocated_amount).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                    <div
                                        className={`h-1.5 rounded-full ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                {isOver ? (
                                    <p className="text-[0.65rem] font-bold text-red-500 uppercase tracking-widest mt-3">
                                        Over budget
                                    </p>
                                ) : (
                                    <p className="text-[0.65rem] font-bold text-emerald-500 uppercase tracking-widest mt-3">
                                        On track
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default Budgets;
