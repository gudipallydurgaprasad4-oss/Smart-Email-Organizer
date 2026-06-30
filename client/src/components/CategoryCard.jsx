const CATEGORY_INFO = {
    Events: { subtitle: 'Campus events & activities', color: 'events' },
    Academics: { subtitle: 'Courses, exams & assignments', color: 'academics' },
    Hackathons: { subtitle: 'Coding competitions', color: 'hackathons' },
    Personal: { subtitle: 'Friends & family', color: 'personal' },
    Spam: { subtitle: 'Promotions & ads', color: 'spam' }
};

export default function CategoryCard({ category, emails, onClick }) {
    const info = CATEGORY_INFO[category] || { subtitle: 'Emails', color: 'personal' };
    const count = emails?.length || 0;

    return (
        <div className={`category-card ${info.color} animate-fade-in`} onClick={onClick}>
            <h3 className="category-card__title">{category}</h3>
            <p className="category-card__subtitle">{info.subtitle}</p>
            <div className="category-card__count">
                <span>{count}</span>
                <span>email{count !== 1 ? 's' : ''}</span>
            </div>
            {emails && emails.length > 0 && (
                <div className="category-card__emails">
                    {emails.slice(0, 2).map((email, idx) => (
                        <div key={idx} className="category-card__email-item">
                            {email.subject}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
