import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, PlusCircle, MinusCircle, Users, Activity, History, ArrowRightLeft } from 'lucide-react';

const BankerDashboard = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [debts, setDebts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fund management state
    const [selectedUser, setSelectedUser] = useState('');
    const [amount, setAmount] = useState('');
    const [action, setAction] = useState('ADD');
    const [note, setNote] = useState('');
    const [managingFunds, setManagingFunds] = useState(false);

    const fetchData = async () => {
        try {
            const [usersRes, debtsRes, logsRes] = await Promise.all([
                api.get('/api/banker/users'),
                api.get('/api/banker/debts'),
                api.get('/api/banker/logs'),
            ]);
            setUsers(usersRes.data);
            setDebts(debtsRes.data);
            setLogs(logsRes.data);
        } catch (err) {
            console.error("Failed to load banker data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleManageFunds = async (e) => {
        e.preventDefault();
        const parsedAmount = parseFloat(amount);
        if (!selectedUser || !action || isNaN(parsedAmount) || parsedAmount <= 0) {
            alert('Please fill out all fields with valid amounts.');
            return;
        }

        const confirmMsg = `Are you sure you want to ${action} ₹${parsedAmount.toFixed(2)} ${action === 'ADD' ? 'to' : 'from'} this user?`;
        if (!window.confirm(confirmMsg)) return;

        setManagingFunds(true);
        try {
            await api.post('/api/banker/funds', {
                target_user_id: selectedUser,
                action,
                amount: parsedAmount,
                note: note || `Banker ${action}`,
            });
            alert(`Successfully ${action.toLowerCase()}ed funds!`);
            setAmount('');
            setNote('');
            fetchData();
        } catch (err) {
            alert('Failed to manage funds: ' + (err.response?.data?.error || err.message));
        } finally {
            setManagingFunds(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

    const totalSystemBalance = users.reduce((acc, u) => acc + (parseFloat(u.current_balance) || 0), 0);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <header className="flex justify-between items-center bg-indigo-900 text-white p-8 rounded-2xl shadow-lg">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="w-8 h-8 text-indigo-300" />
                        Banker Dashboard
                    </h2>
                    <p className="text-indigo-200 mt-2">Financial oversight and system-wide control.</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Total System Capital</p>
                    <h3 className="text-4xl font-light">₹{totalSystemBalance.toFixed(2)}</h3>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Manage Funds & Logs */}
                <div className="lg:col-span-1 space-y-8">
                    {/* Manage Funds */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                            Manage Funds
                        </h3>
                        <form onSubmit={handleManageFunds} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Target Account</label>
                                <select className="input" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} required>
                                    <option value="">-- Select User --</option>
                                    {users.map(u => (
                                        <option key={u.user_id} value={u.user_id}>{u.first_name} {u.last_name} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Action</label>
                                <div className="flex bg-gray-50 p-1 rounded-xl">
                                    <button type="button" onClick={() => setAction('ADD')} className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium rounded-lg transition-all ${action === 'ADD' ? 'bg-white shadow-sm text-emerald-600 border border-gray-100' : 'text-gray-500'}`}>
                                        <PlusCircle className="w-4 h-4" /> Add
                                    </button>
                                    <button type="button" onClick={() => setAction('REMOVE')} className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium rounded-lg transition-all ${action === 'REMOVE' ? 'bg-white shadow-sm text-red-600 border border-gray-100' : 'text-gray-500'}`}>
                                        <MinusCircle className="w-4 h-4" /> Remove
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Amount (₹)</label>
                                <input type="number" step="0.01" min="0.01" className="input text-lg font-medium" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Internal Note / Reference</label>
                                <input type="text" className="input" placeholder="e.g. Wire transfer correction" value={note} onChange={e => setNote(e.target.value)} />
                            </div>

                            <button type="submit" disabled={managingFunds} className="btn w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-2">
                                {managingFunds ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `Confirm ${action}`}
                            </button>
                        </form>
                    </div>

                    {/* Audit Logs */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <History className="w-5 h-5 text-indigo-600" />
                            Audit Log
                        </h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                            {logs.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No banker actions recorded.</p>
                            ) : (
                                logs.map(log => (
                                    <div key={log.payment_id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`font-bold ${log.payment_type === 'BANKER_ADD' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {log.payment_type === 'BANKER_ADD' ? '+' : '-'} ₹{parseFloat(log.amount).toFixed(2)}
                                            </span>
                                            <span className="text-[0.65rem] text-gray-400 uppercase">{new Date(log.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-gray-900 font-medium">{log.to_name}</p>
                                        <p className="text-xs text-gray-500 mt-1">Note: {log.note || 'None'}</p>
                                        <p className="text-[0.65rem] text-gray-400 mt-1">By: {log.from_name}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: User Accounts & Global Debts */}
                <div className="lg:col-span-2 space-y-8">
                    {/* User Accounts Overview */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            All Accounts
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Current Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.map(u => (
                                        <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900">{u.first_name} {u.last_name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 text-[0.65rem] font-bold uppercase rounded-full ${u.role === 'BANKER' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                ₹{(parseFloat(u.current_balance) || 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Global Debt Graph */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">System-wide Active Debts</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Owes</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Amount</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">To</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {debts.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-8 text-gray-500 italic">No active debts in the system.</td></tr>
                                    ) : (
                                        debts.map(d => (
                                            <tr key={`${d.expense_id}-${d.debtor_id}`} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-900">{d.debtor_name}</td>
                                                <td className="px-4 py-3 text-center font-bold text-red-600">₹{d.amount.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-900">{d.payer_name}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[150px]" title={d.description}>{d.description}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BankerDashboard;
