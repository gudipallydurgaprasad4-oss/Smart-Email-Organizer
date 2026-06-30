import { useState } from 'react';

const CATEGORIES = ['Events', 'Academics', 'Hackathons', 'Personal', 'Spam'];

export default function EmailDetail({ email, onRecategorize, isDemo }) {
    const [recategorizing, setRecategorizing] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState('');

    if (!email) {
        return (
            <div className="email-detail">
                <div className="empty-state">
                    <div className="empty-state__icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                    </div>
                    <p className="empty-state__text">Select an email to view details</p>
                </div>
            </div>
        );
    }

    const senderName = email.from?.split('<')[0]?.trim() || email.from || 'Unknown';
    const senderEmail = email.from?.match(/<(.+)>/)?.[1] || email.from || '';

    const handleRecategorize = async (newCategory) => {
        if (newCategory === email.category) {
            setShowDropdown(false);
            return;
        }

        setRecategorizing(true);
        setFeedbackMsg('');

        if (isDemo) {
            setTimeout(() => {
                if (onRecategorize) onRecategorize(email.id, newCategory);
                setFeedbackMsg(`Moved to ${newCategory}! AI will learn from this.`);
                setTimeout(() => setFeedbackMsg(''), 3000);
                setRecategorizing(false);
                setShowDropdown(false);
            }, 600);
            return;
        }

        try {
            const response = await fetch(`/api/emails/${email.id}/recategorize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ category: newCategory, email })
            });

            if (response.ok) {
                if (onRecategorize) {
                    onRecategorize(email.id, newCategory);
                }
                setFeedbackMsg(`Moved to ${newCategory}! AI will learn from this.`);
                setTimeout(() => setFeedbackMsg(''), 3000);
            } else {
                const data = await response.json().catch(() => ({}));
                setFeedbackMsg(`Failed: ${data.error || 'Unknown error'}`);
                setTimeout(() => setFeedbackMsg(''), 4000);
            }
        } catch (err) {
            console.error('Failed to recategorize:', err);
            setFeedbackMsg('Network error. Please try again.');
            setTimeout(() => setFeedbackMsg(''), 4000);
        }
        setRecategorizing(false);
        setShowDropdown(false);
    };

    return (
        <div className="email-detail">
            <div className="email-detail__header">
                <h2 className="email-detail__subject">{email.subject}</h2>
                <div className="email-detail__meta">
                    <div className="email-detail__sender">
                        <div className="email-detail__avatar">
                            {senderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{senderName}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{senderEmail}</div>
                        </div>
                    </div>
                    <div className="email-detail__date">
                        {email.date ? new Date(email.date).toLocaleString() : ''}
                    </div>
                </div>
            </div>

            <div className="email-detail__content">
                <div
                    className="email-detail__body"
                    dangerouslySetInnerHTML={{ __html: email.body || email.snippet }}
                />

                {email.attachments && email.attachments.length > 0 && (
                    <div className="email-detail__attachments">
                        <h3 className="attachments-title">
                            Attachments ({email.attachments.length})
                        </h3>
                        <div className="attachments-list">
                            {email.attachments.map((att, idx) => (
                                <a
                                    key={idx}
                                    href={`/api/emails/${email.id}/attachments/${att.attachmentId}`}
                                    className="attachment-item"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <div className="attachment-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                    </div>
                                    <div className="attachment-info">
                                        <div className="attachment-name">{att.filename}</div>
                                        <div className="attachment-size">
                                            {(att.size / 1024).toFixed(1)} KB
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Category with re-categorize option */}
            {email.category && (
                <div className="email-detail__category-section">
                    <div className="email-detail__category-row">
                        <span className={`email-item__category ${email.category.toLowerCase()}`}>
                            {email.category}
                        </span>
                        <button
                            className="recategorize-btn"
                            onClick={() => setShowDropdown(!showDropdown)}
                            disabled={recategorizing}
                            title="Wrong category? Click to re-categorize and teach the AI"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            {recategorizing ? 'Learning...' : 'Re-categorize'}
                        </button>
                    </div>

                    {showDropdown && (
                        <div className="recategorize-dropdown">
                            <p className="recategorize-dropdown__label">Move to category (AI will learn from this):</p>
                            <div className="recategorize-dropdown__options">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        className={`recategorize-option ${cat === email.category ? 'active' : ''}`}
                                        onClick={() => handleRecategorize(cat)}
                                        disabled={recategorizing}
                                    >
                                        <span className={`recategorize-dot ${cat.toLowerCase()}`}></span>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {feedbackMsg && (
                        <div className="recategorize-feedback">{feedbackMsg}</div>
                    )}
                </div>
            )}
        </div>
    );
}
