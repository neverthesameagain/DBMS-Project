import { useState } from 'react';
import { Loader2, Play, TerminalSquare } from 'lucide-react';
import api from '../lib/api';

const AdminQueryEngine = () => {
    const [query, setQuery] = useState('SELECT * FROM users LIMIT 20;');
    const [rows, setRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const runQuery = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/api/admin/query', { query });
            setRows(res.data.rows || []);
            setColumns(res.data.columns || []);
        } catch (err) {
            setRows([]);
            setColumns([]);
            setError(err.response?.data?.error || 'Query failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <header className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <TerminalSquare className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-medium text-gray-900">Query Engine</h2>
                    <p className="text-sm text-gray-400">Read-only SQL console for admin inspection.</p>
                </div>
            </header>

            <form onSubmit={runQuery} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full h-48 p-5 font-mono text-sm bg-gray-950 text-gray-100 focus:outline-none"
                    spellCheck="false"
                />
                <div className="px-5 py-4 flex justify-between items-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">Only single-statement SELECT / WITH queries are allowed.</p>
                    <button type="submit" disabled={loading} className="btn btn-primary flex items-center gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Run
                    </button>
                </div>
            </form>

            {error && <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">{error}</div>}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 uppercase text-gray-500">
                            <tr>
                                {columns.map((col) => <th key={col} className="px-4 py-3 whitespace-nowrap">{col}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {!rows.length && (
                                <tr><td className="px-4 py-10 text-center text-gray-400" colSpan={Math.max(columns.length, 1)}>No rows</td></tr>
                            )}
                            {rows.map((row, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    {columns.map((col) => (
                                        <td key={col} className="px-4 py-3 max-w-[280px] truncate whitespace-nowrap">
                                            {row[col] === null || row[col] === undefined ? 'NULL' : String(row[col])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminQueryEngine;
