import { logout } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ user, onSelectCategory, selectedCategory }) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar__logo">
                <div className="sidebar__logo-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </div>
                <span className="sidebar__logo-text">Smart Email</span>
            </div>

            <nav className="sidebar__nav">
                <a href="/dashboard" className="sidebar__nav-item active">
                    <span className="sidebar__nav-item-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                    </span>
                    Dashboard
                </a>
                <a href="/dashboard?demo=true" className="sidebar__nav-item">
                    <span className="sidebar__nav-item-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4" /></svg>
                    </span>
                    Demo Mode
                </a>
            </nav>

            <div className="sidebar__footer">
                {user ? (
                    <div className="sidebar__user">
                        <div className="sidebar__user-avatar" style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 700, fontSize: '0.85rem'
                        }}>
                            {user.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="sidebar__user-info">
                            <div className="sidebar__user-name">{user.name}</div>
                            <div className="sidebar__user-email">{user.email}</div>
                        </div>
                    </div>
                ) : (
                    <button className="sidebar__nav-item" onClick={() => navigate('/login')}>
                        <span className="sidebar__nav-item-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        </span>
                        Sign In
                    </button>
                )}
                {user && (
                    <button className="sidebar__nav-item" onClick={handleLogout} style={{ marginTop: '0.5rem' }}>
                        <span className="sidebar__nav-item-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        </span>
                        Logout
                    </button>
                )}
            </div>
        </aside>
    );
}
