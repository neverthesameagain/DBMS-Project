import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Loader2, PlusCircle, MinusCircle, Users, Activity, History, ArrowRightLeft } from 'lucide-react';

const BankerDashboard = () => {
    const [users, setUsers] = useState([]);
    const [debts, setDebts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedUser, setSelectedUser] = useState('');
    const [amount, setAmount] = useState('');
    const [action, setAction] = useState('ADD');
    const [note, setNote] = useState('');
    const [managingFunds, setManagingFunds] = useState(false);

    const [transferFrom, setTransferFrom] = useState('');
    const [transferTo, setTransferTo] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferNote, setTransferNote] = useState('');
    const [transferring, setTransferring] = useState(false);

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
            console.error('Failed to load banker data', err);
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

        const verb = action === 'ADD' ? 'deposit (cash in)' : 'withdraw (cash out)';
        const confirmMsg = `Record ${verb} of ₹${parsedAmount.toFixed(2)} for this account? Their balance will update; your banker wallet is not used as the counterparty balance.`;
        if (!window.confirm(confirmMsg)) return;

        setManagingFunds(true);
        try {
            await api.post('/api/banker/funds', {
                target_user_id: selectedUser,
                action,
                amount: parsedAmount,
                note: note || undefined,
            });
            alert('Recorded successfully.');
            setAmount('');
            setNote('');
            fetchData();
        } catch (err) {
            alert('Failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setManagingFunds(false);
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        const parsed = parseFloat(transferAmount);
        if (!transferFrom || !transferTo || transferFrom === transferTo || isNaN(parsed) || parsed <= 0) {
            alert('Pick two different accounts and a valid amount.');
            return;
        }
        if (!window.confirm(`Transfer ₹${parsed.toFixed(2)} from one account to the other?`)) return;

        setTransferring(true);
        try {
            await api.post('/api/banker/transfer', {
                from_user_id: Number(transferFrom),
                to_user_id: Number(transferTo),
                amount: parsed,
                note: transferNote || undefined,
            });
            alert('Transfer completed.');
            setTransferAmount('');
            setTransferNote('');
            fetchData();
        } catch (err) {
            alert('Transfer failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setTransferring(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const totalRetailBalance = users.reduce((acc, u) => acc + (parseFloat(u.current_balance) || 0), 0);

    const logStyles = (type) => {
        if (type === 'BANKER_ADD') return 'text-emerald-600';
        if (type === 'BANKER_REMOVE') return 'text-red-600';
        return 'text-indigo-600';
    };

    const logSummary = (log) => {
        if (log.payment_type === 'BANKER_TRANSFER') {
            return `${log.from_name} → ${log.to_name}`;
        }
        if (log.payment_type === 'BANKER_ADD') {
            return `Deposit to ${log.to_name}`;
        }
        return `Withdrawal from ${log.from_name}`;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <header className="flex justify-between items-center bg-indigo-900 text-white p-8 rounded-2xl shadow-lg">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="w-8 h-8 text-indigo-300" />
                        Banker Dashboard
                    </h2>
                    <p className="text-indigo-200 mt-2">Customer wallets, cash in/out, and transfers.</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">
                        Total customer balances
                    </p>
                    <h3 className="text-4xl font-light">₹{totalRetailBalance.toFixed(2)}</h3>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                            Cash in / out
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Records physical cash or external money movement. Only the selected customer balance changes.
                        </p>
                        <form onSubmit={handleManageFunds} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    Customer account
                                </label>
                                <select
                                    className="input"
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select user --</option>
                                    {users.map((u) => (
                                        <option key={u.user_id} value={u.user_id}>
                                            {u.first_name} {u.last_name} ({u.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    Direction
                                </label>
                                <div className="flex bg-gray-50 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setAction('ADD')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                            action === 'ADD'
                                                ? 'bg-white shadow-sm text-emerald-600 border border-gray-100'
                                                : 'text-gray-500'
                                        }`}
                                    >
                                        <PlusCircle className="w-4 h-4" /> Cash in
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAction('REMOVE')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                            action === 'REMOVE'
                                                ? 'bg-white shadow-sm text-red-600 border border-gray-100'
                                                : 'text-gray-500'
                                        }`}
                                    >
                                        <MinusCircle className="w-4 h-4" /> Cash out
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    className="input text-lg font-medium"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    Reference / note
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. Branch deposit slip #1234"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={managingFunds}
                                className="btn w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-2"
                            >
                                {managingFunds ? (
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : (
                                    `Confirm ${action === 'ADD' ? 'cash in' : 'cash out'}`
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-emerald-700" />
                            Transfer between accounts
                        </h3>
                        <form onSubmit={handleTransfer} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    From
                                </label>
                                <select
                                    className="input"
                                    value={transferFrom}
                                    onChange={(e) => setTransferFrom(e.target.value)}
                                    required
                                >
                                    <option value="">-- Account --</option>
                                    {users.map((u) => (
                                        <option key={`tf-${u.user_id}`} value={u.user_id}>
                                            {u.first_name} {u.last_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    To
                                </label>
                                <select
                                    className="input"
                                    value={transferTo}
                                    onChange={(e) => setTransferTo(e.target.value)}
                                    required
                                >
                                    <option value="">-- Account --</option>
                                    {users.map((u) => (
                                        <option key={`tt-${u.user_id}`} value={u.user_id}>
                                            {u.first_name} {u.last_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    className="input"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    Note (optional)
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    value={transferNote}
                                    onChange={(e) => setTransferNote(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={transferring}
                                className="btn w-full bg-emerald-700 hover:bg-emerald-800 text-white"
                            >
                                {transferring ? (
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : (
                                    'Execute transfer'
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <History className="w-5 h-5 text-indigo-600" />
                            Banker actions
                        </h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                            {logs.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No banker actions recorded yet.</p>
                            ) : (
                                logs.map((log) => (
                                    <div
                                        key={log.payment_id}
                                        className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`font-bold ${logStyles(log.payment_type)}`}>
                                                {log.payment_type === 'BANKER_ADD' ? '+' : ''}
                                                {log.payment_type === 'BANKER_REMOVE' ? '-' : ''}
                                                ₹{parseFloat(log.amount).toFixed(2)}
                                                {log.payment_type === 'BANKER_TRANSFER' ? ' transfer' : ''}
                                            </span>
                                            <span className="text-[0.65rem] text-gray-400 uppercase">
                                                {new Date(log.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-gray-900 font-medium">{logSummary(log)}</p>
                                        <p className="text-xs text-gray-500 mt-1">Note: {log.note || '—'}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            Customer accounts
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            User
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                                            Balance
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.map((u) => (
                                        <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {u.first_name} {u.last_name}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                ₹{(parseFloat(u.current_balance) || 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Net debts between users</h3>
                        <p className="text-xs text-gray-500 mb-4">
                            From unsettled group splits only; amounts are net per pair (two-way obligations cancel).
                            Admin and banker accounts are excluded.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            Owes
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                                            Net amount
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                                            To
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {debts.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-center py-8 text-gray-500 italic">
                                                No net debts between customers.
                                            </td>
                                        </tr>
                                    ) : (
                                        debts.map((d) => (
                                            <tr
                                                key={`${d.debtor_id}-${d.creditor_id}`}
                                                className="hover:bg-gray-50 transition-colors"
                                            >
                                                <td className="px-4 py-3 font-medium text-gray-900">{d.debtor_name}</td>
                                                <td className="px-4 py-3 text-center font-bold text-red-600">
                                                    ₹{Number(d.amount).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-900">
                                                    {d.creditor_name}
                                                </td>
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
