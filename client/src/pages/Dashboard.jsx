import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CategoryCard from '../components/CategoryCard';
import EmailList from '../components/EmailList';
import EmailDetail from '../components/EmailDetail';
import ChatBot from '../components/ChatBot';
import EventCalendar from '../components/EventCalendar';
import { getCurrentUser, getEmails } from '../services/api';

const CATEGORIES = ['Events', 'Academics', 'Hackathons', 'Personal', 'Spam'];

const DEMO_EMAILS = [
    { id: '1', subject: 'Tech Fest 2026 - Register Now!', snippet: 'Join us for the biggest tech fest of the year with workshops, competitions, and more!', from: 'Events Team <events@university.edu>', date: new Date().toISOString(), category: 'Events' },
    { id: '2', subject: 'AI Workshop - Introduction to Machine Learning', snippet: 'Learn the fundamentals of AI and machine learning in this hands-on workshop.', from: 'CS Department <cs@university.edu>', date: new Date().toISOString(), category: 'Academics' },
    { id: '3', subject: 'HackathonX 2026 - 48 Hours of Innovation', snippet: 'The annual hackathon is here! Form your teams and build something amazing.', from: 'HackathonX <hack@university.edu>', date: new Date().toISOString(), category: 'Hackathons' },
    { id: '4', subject: 'Assignment 3 Deadline Extended', snippet: 'Due to multiple requests, I am extending the deadline to next Monday at 11:59 PM.', from: 'Prof. Sarah Johnson <s.johnson@university.edu>', date: new Date().toISOString(), category: 'Academics' },
    { id: '5', subject: 'Weekend plans?', snippet: 'Hey! Are you free this weekend? Thinking of organizing a group study session.', from: 'Alex Chen <alex.chen@gmail.com>', date: new Date().toISOString(), category: 'Personal' },
    { id: '6', subject: '50% OFF - Limited Time Only!', snippet: 'Exclusive student discount on all courses! Use code STUDENT50 at checkout.', from: 'PromoDeals <noreply@promos.com>', date: new Date().toISOString(), category: 'Spam' },
    { id: '7', subject: 'Cultural Night - Performances & Food', snippet: 'Celebrate diversity at our annual cultural night featuring performances from 15 countries.', from: 'Student Council <council@university.edu>', date: new Date().toISOString(), category: 'Events' },
    { id: '8', subject: 'Deep Learning Course Registration Open', snippet: 'Register now for the advanced AI course covering neural networks and deep learning applications.', from: 'AI Club <aiclub@university.edu>', date: new Date().toISOString(), category: 'Academics' },
    { id: '9', subject: 'Exam Schedule Released', snippet: 'The final exam schedule for Spring 2026 has been released. Please check your student portal.', from: 'Registrar Office <registrar@university.edu>', date: new Date().toISOString(), category: 'Academics' },
];

function getDemoData() {
    const grouped = CATEGORIES.reduce((acc, category) => {
        acc[category] = DEMO_EMAILS.filter(e => e.category === category);
        return acc;
    }, {});
    return { emails: DEMO_EMAILS, grouped };
}



export default function Dashboard() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isDemo = searchParams.get('demo') === 'true';

    const [user, setUser] = useState(isDemo ? { name: 'Demo User', email: 'demo@university.edu' } : null);
    const [loading, setLoading] = useState(!isDemo);
    const [emailData, setEmailData] = useState(isDemo ? getDemoData() : { emails: [], grouped: {} });
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Handle re-categorization — updates local state when user corrects a category
    const handleRecategorize = (emailId, newCategory) => {
        setEmailData(prev => {
            const updatedEmails = prev.emails.map(e =>
                e.id === emailId ? { ...e, category: newCategory } : e
            );
            const grouped = updatedEmails.reduce((acc, email) => {
                if (!acc[email.category]) acc[email.category] = [];
                acc[email.category].push(email);
                return acc;
            }, {});
            return { emails: updatedEmails, grouped };
        });
        // Update selected email too
        setSelectedEmail(prev =>
            prev && prev.id === emailId ? { ...prev, category: newCategory } : prev
        );
    };

    useEffect(() => {
        if (isDemo) return;

        const checkAuth = async () => {
            try {
                const { user, isAuthenticated } = await getCurrentUser();
                if (!isAuthenticated) {
                    navigate('/login');
                    return;
                }
                setUser(user);
                const data = await getEmails();
                setEmailData(data);
            } catch (error) {
                console.error('Auth check failed:', error);
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [navigate, isDemo]);

    const handleBackToCategories = () => {
        setSelectedCategory(null);
        setSelectedEmail(null);
        setSearchQuery('');
    };

    // Filter emails based on search query — searches subject, snippet, from, and body
    const filterEmails = (emails) => {
        if (!searchQuery.trim()) return emails;
        const query = searchQuery.toLowerCase();
        return emails.filter(email => {
            const plainBody = email.body
                ? email.body.replace(/<[^>]*>/g, ' ').toLowerCase()
                : '';
            return (
                email.subject?.toLowerCase().includes(query) ||
                email.snippet?.toLowerCase().includes(query) ||
                email.from?.toLowerCase().includes(query) ||
                plainBody.includes(query)
            );
        });
    };

    // Get search results across all emails
    const getSearchResults = () => {
        if (!searchQuery.trim()) return null;
        return filterEmails(emailData.emails);
    };



    if (loading) {
        return (
            <div className="app-layout">
                <Sidebar user={null} />
                <main className="main-content">
                    <div className="loading"><div className="loading__spinner" /></div>
                </main>
            </div>
        );
    }

    const searchResults = getSearchResults();
    const displayEmails = searchResults || (selectedCategory ? emailData.grouped[selectedCategory] || [] : emailData.emails);

    return (
        <div className="app-layout">
            <Sidebar
                user={user}
                categories={CATEGORIES}
                grouped={emailData.grouped}
                onSelectCategory={(cat) => {
                    setSelectedCategory(cat);
                    setSelectedEmail(null);
                    setSearchQuery('');
                }}
                selectedCategory={selectedCategory}
            />
            <main className="main-content">
                <header className="dashboard-header">
                    <h1 className="dashboard-header__title">
                        {selectedCategory ? (
                            <>
                                <button onClick={handleBackToCategories} className="back-btn">←</button>
                                {selectedCategory}
                            </>
                        ) : 'Dashboard'}
                    </h1>
                    <p className="dashboard-header__subtitle">
                        {searchQuery
                            ? `Found ${searchResults?.length || 0} emails matching "${searchQuery}"`
                            : selectedCategory
                                ? `${displayEmails.length} emails in this category`
                                : `You have ${emailData.emails.length} emails organized across ${Object.keys(emailData.grouped).length} categories.`}
                    </p>
                    {isDemo && (
                        <div className="demo-badge">Demo Mode — Sample Data</div>
                    )}
                </header>



                {/* Search Bar */}
                <div className="search-container">
                    <div className="search-bar">
                        <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search emails by subject, content, or sender..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="search-clear"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {/* Show search results */}
                {searchQuery && searchResults && (
                    <div className="email-section">
                        <EmailList
                            emails={searchResults}
                            selectedEmail={selectedEmail}
                            onSelectEmail={setSelectedEmail}
                            title={`Search Results for "${searchQuery}"`}
                        />
                        <EmailDetail email={selectedEmail} onRecategorize={handleRecategorize} isDemo={isDemo} />
                    </div>
                )}

                {/* Show categories when not searching */}
                {!searchQuery && !selectedCategory && (
                    <div className="bento-grid">
                        {CATEGORIES.map((category) => (
                            <CategoryCard
                                key={category}
                                category={category}
                                emails={emailData.grouped[category] || []}
                                onClick={() => setSelectedCategory(category)}
                            />
                        ))}
                    </div>
                )}

                {/* Calendar Widget */}
                {!searchQuery && !selectedCategory && emailData.emails.length > 0 && (
                    <EventCalendar 
                        emails={emailData.emails} 
                        onEventClick={(event) => {
                            setSelectedCategory(event.category);
                            setSelectedEmail(event);
                        }}
                    />
                )}

                {!searchQuery && selectedCategory && (
                    <div className="email-section">
                        <EmailList
                            emails={displayEmails}
                            selectedEmail={selectedEmail}
                            onSelectEmail={setSelectedEmail}
                            title={selectedCategory}
                        />
                        <EmailDetail email={selectedEmail} onRecategorize={handleRecategorize} isDemo={isDemo} />
                    </div>
                )}

                {!searchQuery && !selectedCategory && emailData.emails.length > 0 && (
                    <>
                        <h2 style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>Recent Emails</h2>
                        <div className="email-section">
                            <EmailList
                                emails={emailData.emails.slice(0, 10)}
                                selectedEmail={selectedEmail}
                                onSelectEmail={setSelectedEmail}
                                title="All Categories"
                            />
                            <EmailDetail email={selectedEmail} onRecategorize={handleRecategorize} isDemo={isDemo} />
                        </div>
                    </>
                )}
            </main>
            <ChatBot
                emails={emailData.emails}
                isDemo={isDemo}
                onNavigateCategory={(category) => {
                    // Navigate to a category
                    const validCategories = CATEGORIES.map(c => c.toLowerCase());
                    const matchedCategory = CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase());
                    if (matchedCategory) {
                        setSelectedCategory(matchedCategory);
                        setSelectedEmail(null);
                        setSearchQuery('');
                    }
                }}
                onSearch={(query) => {
                    // Fill search bar and show results
                    setSearchQuery(query);
                    setSelectedCategory(null);
                    setSelectedEmail(null);
                }}
                onSelectEmail={(emailSubject) => {
                    // Find and select an email by subject match
                    const subject = emailSubject.toLowerCase();
                    const found = emailData.emails.find(e =>
                        e.subject?.toLowerCase().includes(subject)
                    );
                    if (found) {
                        setSelectedCategory(found.category);
                        setSelectedEmail(found);
                        setSearchQuery('');
                    }
                }}
                onGoDashboard={() => {
                    // Return to main dashboard view
                    setSelectedCategory(null);
                    setSelectedEmail(null);
                    setSearchQuery('');
                }}
                onRecategorize={handleRecategorize}
            />
        </div>
    );
}
