import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, User as UserIcon, Trash2, Plus } from 'lucide-react';

const Profile = () => {
    const { user } = useAuth();
    const [upis, setUpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newUpi, setNewUpi] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchUpis = async () => {
        try {
            const res = await api.get('/api/upi');
            setUpis(res.data);
        } catch (err) {
            console.error('Failed to load UPIs', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchUpis();
    }, [user]);

    const handleAddUpi = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/upi', { upi_handle: newUpi });
            setNewUpi('');
            fetchUpis();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to add UPI');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUpi = async (id) => {
        try {
            await api.delete(`/api/upi/${id}`);
            fetchUpis();
        } catch (err) {
            alert('Failed to delete UPI');
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <header className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
                    <UserIcon className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Profile Settings</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Manage your account information and linked UPI IDs.</p>
                </div>
            </header>

            {/* Profile Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Account Information</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-500">Name</p>
                        <p className="font-medium">{user.first_name} {user.last_name}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{user.email}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{user.phone_number}</p>
                    </div>
                </div>
            </div>

            {/* UPI Management */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Manage UPI IDs</h3>
                
                <form onSubmit={handleAddUpi} className="flex gap-3 mb-6">
                    <input 
                        type="text" 
                        value={newUpi} 
                        onChange={e => setNewUpi(e.target.value)} 
                        placeholder="e.g. aryan@okicici"
                        className="input flex-1"
                        required
                    />
                    <button type="submit" disabled={submitting} className="btn btn-primary flex items-center gap-2">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                    </button>
                </form>

                <div className="space-y-3">
                    {upis.length === 0 && <p className="text-gray-500 text-sm">No UPI IDs linked. Add one above.</p>}
                    {upis.map(upi => (
                        <div key={upi.upi_id} className="flex items-center justify-between p-3 bg-gray-50 border rounded">
                            <span className="font-medium font-mono">{upi.upi_handle}</span>
                            <button onClick={() => handleDeleteUpi(upi.upi_id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Profile;
