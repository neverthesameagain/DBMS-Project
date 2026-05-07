import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Trash2, Users } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const AdminUsers = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [overview, setOverview] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/api/admin/users');
            setUsers(res.data);
        } catch {
            setError('Failed to load users.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = async (targetUser) => {
        if (!confirm(`Deactivate ${targetUser.first_name} ${targetUser.last_name}?`)) return;
        try {
            await api.delete(`/api/admin/user/${targetUser.user_id}`);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to deactivate user');
        }
    };

    const handleUserPatch = async (targetUser, patch) => {
        try {
            await api.patch(`/api/admin/user/${targetUser.user_id}`, patch);
            fetchUsers();
            if (selectedUserId === targetUser.user_id) fetchOverview(targetUser.user_id);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update user');
        }
    };

    const fetchOverview = async (userId) => {
        setSelectedUserId(userId);
        setOverviewLoading(true);
        try {
            const res = await api.get(`/api/admin/users/${userId}/overview`);
            setOverview(res.data);
        } catch {
            setOverview(null);
        } finally {
            setOverviewLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Users className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-medium text-gray-900">Admin Users</h2>
                    <p className="text-sm text-gray-400">All registered system users.</p>
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4 text-right">Balance</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((item) => (
                                <tr key={item.user_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        <button onClick={() => fetchOverview(item.user_id)} className="hover:text-blue-600">
                                            {item.first_name} {item.last_name}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{item.email}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.phone_number}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <select
                                                className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                                                value={item.role}
                                                disabled={item.user_id === user?.user_id}
                                                title={
                                                    item.user_id === user?.user_id
                                                        ? 'Cannot change your own role here'
                                                        : 'USER · BANKER · ADMIN'
                                                }
                                                onChange={(e) =>
                                                    handleUserPatch(item, { role: e.target.value })
                                                }
                                            >
                                                <option value="USER">USER</option>
                                                <option value="BANKER">BANKER</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                            {!item.is_active && (
                                                <span className="px-2 py-1 rounded-full bg-red-50 text-xs font-bold text-red-700">
                                                    INACTIVE
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">₹{item.current_balance}</td>
                                    <td className="px-6 py-4 text-right">
                                        {!item.is_active && (
                                            <button
                                                onClick={() => handleUserPatch(item, { is_active: true })}
                                                className="inline-flex p-2 text-emerald-600 hover:bg-emerald-50 rounded mr-1"
                                                title="Reactivate user"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(item)}
                                            disabled={item.user_id === user?.user_id || !item.is_active}
                                            className="inline-flex p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                            title="Deactivate user"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedUserId && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    {overviewLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : overview ? (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">
                                    {overview.user.first_name} {overview.user.last_name}
                                </h3>
                                <p className="text-sm text-gray-400">{overview.user.email}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs uppercase font-bold text-gray-400 mb-1">Groups</p>
                                    <p className="text-2xl font-light">{overview.groups.length}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs uppercase font-bold text-gray-400 mb-1">Payments</p>
                                    <p className="text-2xl font-light">{overview.payments.length}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs uppercase font-bold text-gray-400 mb-1">Expense Splits</p>
                                    <p className="text-2xl font-light">{overview.expenses.length}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {[
                                    ['Groups', overview.groups],
                                    ['Payments', overview.payments],
                                    ['Expenses', overview.expenses],
                                ].map(([title, items]) => (
                                    <div key={title} className="border border-gray-100 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 font-medium text-sm">{title}</div>
                                        <div className="max-h-64 overflow-auto divide-y divide-gray-100">
                                            {!items.length && <p className="p-4 text-sm text-gray-400">No rows</p>}
                                            {items.map((item, index) => (
                                                <pre key={index} className="p-3 text-[0.7rem] whitespace-pre-wrap break-words text-gray-600">
                                                    {JSON.stringify(item, null, 2)}
                                                </pre>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No overview available.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUsers;
