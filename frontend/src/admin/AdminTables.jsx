import { useEffect, useState } from 'react';
import { Database, Loader2, Table } from 'lucide-react';
import api from '../lib/api';

const AdminTables = () => {
    const [tables, setTables] = useState([]);
    const [selected, setSelected] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rowsLoading, setRowsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchTables = async () => {
            try {
                const res = await api.get('/api/admin/tables');
                setTables(res.data);
                if (res.data.length) setSelected(res.data[0].name);
            } catch {
                setError('Failed to load database tables.');
            } finally {
                setLoading(false);
            }
        };
        fetchTables();
    }, []);

    useEffect(() => {
        if (!selected) return;
        const fetchRows = async () => {
            setRowsLoading(true);
            try {
                const res = await api.get(`/api/admin/tables/${selected}`);
                setRows(res.data.rows || []);
            } catch {
                setRows([]);
            } finally {
                setRowsLoading(false);
            }
        };
        fetchRows();
    }, [selected]);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-12 text-red-600">{error}</div>;

    const columns = rows.length ? Object.keys(rows[0]) : [];

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <header className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Database className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-medium text-gray-900">Database Tables</h2>
                    <p className="text-sm text-gray-400">Admin read access to every project table and view.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                <aside className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 h-fit">
                    {tables.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => setSelected(item.name)}
                            className={`w-full flex justify-between items-center px-3 py-2 rounded-xl text-sm text-left ${
                                selected === item.name ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Table className="w-4 h-4" />
                                {item.name}
                            </span>
                            <span className="text-xs text-gray-400">{item.row_count}</span>
                        </button>
                    ))}
                </aside>

                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
                        <h3 className="font-medium text-gray-900">{selected}</h3>
                        {rowsLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    </div>
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
                                            <td key={col} className="px-4 py-3 max-w-[260px] truncate whitespace-nowrap">
                                                {row[col] === null || row[col] === undefined ? 'NULL' : String(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AdminTables;
