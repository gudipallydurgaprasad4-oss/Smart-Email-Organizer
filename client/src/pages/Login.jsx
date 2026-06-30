import { useEffect, useRef } from 'react';

export default function Login() {
    const starsRef = useRef(null);

    useEffect(() => {
        // Generate random stars
        const container = starsRef.current;
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 120; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.width = star.style.height = `${Math.random() * 2.5 + 0.5}px`;
            star.style.animationDelay = `${Math.random() * 3}s`;
            star.style.animationDuration = `${Math.random() * 2 + 2}s`;
            container.appendChild(star);
        }
    }, []);

    const handleGoogleLogin = async () => {
        try {
            const response = await fetch('/auth/google');
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    return (
        <div className="login-page space-theme">
            {/* Stars background */}
            <div className="stars-container" ref={starsRef}></div>

            {/* Solar System */}
            <div className="solar-system">
                {/* Central Sun */}
                <div className="sun">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </div>

                {/* Orbit 1 - Events */}
                <div className="orbit orbit--1">
                    <div className="orbit__ring"></div>
                    <div className="planet planet--events">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    </div>
                </div>

                {/* Orbit 2 - Academics */}
                <div className="orbit orbit--2">
                    <div className="orbit__ring"></div>
                    <div className="planet planet--academics">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                    </div>
                </div>

                {/* Orbit 3 - Hackathons */}
                <div className="orbit orbit--3">
                    <div className="orbit__ring"></div>
                    <div className="planet planet--hackathons">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                    </div>
                </div>

                {/* Orbit 4 - Personal */}
                <div className="orbit orbit--4">
                    <div className="orbit__ring"></div>
                    <div className="planet planet--personal">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                </div>

                {/* Orbit 5 - Spam */}
                <div className="orbit orbit--5">
                    <div className="orbit__ring"></div>
                    <div className="planet planet--spam">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </div>
                </div>
            </div>

            {/* Login Card */}
            <div className="login-card">
                <div className="login-card__logo">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#667EEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </div>
                <h1 className="login-card__title">Smart Email Organizer</h1>
                <p className="login-card__subtitle">
                    AI-powered email management designed for university students
                </p>

                <button className="login-btn" onClick={handleGoogleLogin}>
                    <svg className="login-btn__icon" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                </button>
                <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                    Or <a href="/dashboard?demo=true" style={{ color: '#667EEA', fontWeight: 600, textDecoration: 'none' }}>try demo mode</a>
                </p>
            </div>
        </div>
    );
}
