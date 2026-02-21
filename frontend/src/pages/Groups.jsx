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
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Your Groups</h2>
                <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Group
                </button>
            </div>

            {showCreate && (
                <div className="card animate-in fade-in slide-in-from-top-4">
                    <form onSubmit={handleCreateGroup} className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Group Name (e.g. Goa Trip)"
                            className="input flex-1"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary" disabled={creating}>
                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                        </button>
                    </form>
                </div>
            )}

            <div className="grid gap-4">
                {groups.map(group => (
                    <Link to={`/groups/${group.group_id}`} key={group.group_id} className="card hover:shadow-md transition-shadow flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 rounded-full group-hover:bg-indigo-100 transition-colors">
                                <Users className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">{group.group_name}</h3>
                                <p className="text-sm text-gray-500">
                                    {group.member_count} member{group.member_count !== 1 ? 's' : ''} · Joined {new Date(group.joined_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                {group.role}
                            </span>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
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
