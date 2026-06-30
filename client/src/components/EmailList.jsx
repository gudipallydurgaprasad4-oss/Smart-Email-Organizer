export default function EmailList({ emails, selectedEmail, onSelectEmail, title }) {
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getInitials = (from) => {
        const name = from?.split('<')[0]?.trim() || from || 'U';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    if (!emails || emails.length === 0) {
        return (
            <div className="email-list">
                <div className="email-list__header">
                    <h3 className="email-list__title">{title}</h3>
                </div>
                <div className="empty-state">
                    <div className="empty-state__icon">📭</div>
                    <p className="empty-state__text">No emails in this category</p>
                </div>
            </div>
        );
    }

    return (
        <div className="email-list">
            <div className="email-list__header">
                <h3 className="email-list__title">{title}</h3>
                <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
                    {emails.length} email{emails.length !== 1 ? 's' : ''}
                </span>
            </div>
            <div className="email-list__items">
                {emails.map((email) => (
                    <div
                        key={email.id}
                        className={`email-item ${selectedEmail?.id === email.id ? 'active' : ''}`}
                        onClick={() => onSelectEmail(email)}
                    >
                        <div className="email-item__avatar">
                            {getInitials(email.from)}
                        </div>
                        <div className="email-item__content">
                            <div className="email-item__header">
                                <span className="email-item__sender">
                                    {email.from?.split('<')[0]?.trim() || email.from}
                                </span>
                                <span className="email-item__date">{formatDate(email.date)}</span>
                            </div>
                            <div className="email-item__subject">{email.subject}</div>
                            <div className="email-item__snippet">{email.snippet}</div>
                            {email.category && (
                                <span className={`email-item__category ${email.category.toLowerCase()}`}>
                                    {email.category}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
