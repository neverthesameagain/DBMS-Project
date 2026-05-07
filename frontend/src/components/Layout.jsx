import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Database, LayoutDashboard, Users, PieChart, Wallet, LogOut, User, Calendar, ReceiptText, TerminalSquare, Activity } from 'lucide-react';
import clsx from 'clsx';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const tempUserImage = `https://ui-avatars.com/api/?name=${user?.first_name}+${user?.last_name}&background=random`;

    const userNavItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Users, label: 'Groups', path: '/groups' },
        { icon: PieChart, label: 'Analytics', path: '/analytics' },
        { icon: PieChart, label: 'Budgets', path: '/budgets' },
        { icon: Wallet, label: 'Payments', path: '/payments' },
        { icon: Calendar, label: 'Ledger', path: '/ledger' },
        { icon: ReceiptText, label: 'Future', path: '/future' },
        { icon: User, label: 'Profile', path: '/profile' },
    ];

    const adminNavItems = [
        { icon: Database, label: 'Admin', path: '/admin' },
        { icon: Users, label: 'Users', path: '/admin/users' },
        { icon: ReceiptText, label: 'Transactions', path: '/admin/transactions' },
        { icon: Database, label: 'Tables', path: '/admin/tables' },
        { icon: TerminalSquare, label: 'Query', path: '/admin/query' },
    ];

    let navItems = userNavItems;
    if (user?.role === 'ADMIN') {
        navItems = adminNavItems;
    } else if (user?.role === 'BANKER') {
        navItems = [
            { icon: Activity, label: 'Banker UI', path: '/banker' }
        ];
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-indigo-900 text-white hidden md:flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-indigo-300" />
                        Splitzy
                    </h1>
                </div>

                <nav className="flex-1 px-4 space-y-1 mt-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive
                                        ? "bg-indigo-800 text-white"
                                        : "text-indigo-200 hover:bg-indigo-800 hover:text-white"
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-indigo-800">
                    <div className="flex items-center gap-3 mb-4">
                        <img src={tempUserImage} alt="User" className="w-10 h-10 rounded-full bg-indigo-800" />
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{user?.first_name} {user?.last_name}</p>
                            <p className="text-xs text-indigo-300 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-800 hover:text-white rounded-md transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
