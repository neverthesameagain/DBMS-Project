import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const Groups = () => {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchGroups = async () => {
        try {
            const res = await api.get('/api/groups');
            setGroups(res.data);
        } catch (err) {
            console.error('Failed to fetch groups:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchGroups();
    }, [user]);

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        setCreating(true);
        try {
            await api.post('/api/groups/create', { group_name: newGroupName });
            setNewGroupName('');
            setShowCreate(false);
            fetchGroups();
        } catch (err) {
            alert('Failed to create group: ' + (err.response?.data?.error || err.message));
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Your Groups</h2>
                </div>
                <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Group
                </button>
            </header>

            {/* Master Net Balance Across all Groups */}
            {!loading && groups.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1">Global Debt Tally</p>
                        {(() => {
                            const total = groups.reduce((acc, g) => acc + (parseFloat(g.net_balance) || 0), 0);
                            if (total > 0) return <h3 className="text-3xl font-light text-emerald-600 flex items-baseline gap-1"><span className="text-lg text-emerald-400 font-medium">₹</span>{total.toFixed(2)}</h3>;
                            if (total < 0) return <h3 className="text-3xl font-light text-red-600 flex items-baseline gap-1"><span className="text-lg text-red-400 font-medium">₹</span>{Math.abs(total).toFixed(2)}</h3>;
                            return <h3 className="text-3xl font-light text-gray-800 flex items-baseline gap-1">Settled Up</h3>;
                        })()}
                    </div>
                </div>
            )}

            {showCreate && (
                <div className="card">
                    <form onSubmit={handleCreateGroup} className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Group Name (e.g. Goa Trip)"
                            className="input flex-1"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary" disabled={creating}>
                            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create'}
                        </button>
                    </form>
                </div>
            )}

            <div className="grid gap-4">
                {groups.map(group => (
                    <Link to={`/groups/${group.group_id}`} key={group.group_id} className="card hover:border-blue-500 flex justify-between items-center group transition-colors border-2 border-transparent">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">{group.group_name}</h3>
                                <p className="text-sm text-gray-500">
                                    {group.member_count} member{group.member_count !== 1 ? 's' : ''} · Joined {new Date(group.joined_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right mr-4 hidden md:block">
                                {(() => {
                                    const netBal = parseFloat(group.net_balance) || 0;
                                    if (!netBal) return <p className="text-sm font-medium text-gray-500">Settled Up</p>;
                                    if (netBal > 0) return (
                                        <>
                                            <p className="text-xs text-gray-400 font-medium">You get back</p>
                                            <p className="text-sm font-bold text-emerald-600">₹{netBal.toFixed(2)}</p>
                                        </>
                                    );
                                    if (netBal < 0) return (
                                        <>
                                            <p className="text-xs text-gray-400 font-medium">You owe</p>
                                            <p className="text-sm font-bold text-red-600">₹{Math.abs(netBal).toFixed(2)}</p>
                                        </>
                                    );
                                })()}
                            </div>
                            <span className="px-3 py-1 text-xs font-semibold uppercase bg-gray-100 text-gray-600 rounded">
                                {group.role}
                            </span>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                        </div>
                    </Link>
                ))}

                {groups.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        You are not part of any groups yet. Create one to get started!
                    </div>
                )}
            </div>
        </div>
    );
};

export default Groups;
