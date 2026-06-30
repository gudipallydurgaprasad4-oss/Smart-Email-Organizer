import { useState, useMemo } from 'react';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_COLORS = {
    Events: '#A78BFA',
    Academics: '#3B82F6',
    Hackathons: '#FB923C',
    Personal: '#F472B6',
    Spam: '#9CA3AF',
};

export default function EventCalendar({ emails = [], onEventClick }) {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDay, setSelectedDay] = useState(null);

    // Build a map of date -> emails for the current month
    const emailsByDate = useMemo(() => {
        const map = {};
        emails.forEach(email => {
            const dateToUse = email.eventDate || email.date;
            if (!dateToUse) return;
            const d = new Date(dateToUse);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                const key = d.getDate();
                if (!map[key]) map[key] = [];
                map[key].push(email);
            }
        });
        return map;
    }, [emails, currentMonth, currentYear]);

    // Upcoming events — next 5 emails from today onward, sorted by date
    const upcomingEvents = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return emails
            .filter(e => {
                const dateToUse = e.eventDate || e.date;
                if (!dateToUse) return false;
                const d = new Date(dateToUse);
                return d >= now && (e.category === 'Events' || e.category === 'Academics' || e.category === 'Hackathons');
            })
            .sort((a, b) => new Date(a.eventDate || a.date) - new Date(b.eventDate || b.date))
            .slice(0, 6);
    }, [emails]);

    // Events for a selected day
    const selectedDayEvents = useMemo(() => {
        if (selectedDay === null) return null;
        return emailsByDate[selectedDay] || [];
    }, [selectedDay, emailsByDate]);

    // Calendar grid generation
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;

    const calendarCells = [];
    for (let i = 0; i < totalCells; i++) {
        const dayNum = i - firstDayOfMonth + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
            calendarCells.push(null);
        } else {
            calendarCells.push(dayNum);
        }
    }

    const goToPrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(y => y - 1);
        } else {
            setCurrentMonth(m => m - 1);
        }
        setSelectedDay(null);
    };

    const goToNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(y => y + 1);
        } else {
            setCurrentMonth(m => m + 1);
        }
        setSelectedDay(null);
    };

    const goToToday = () => {
        setCurrentMonth(today.getMonth());
        setCurrentYear(today.getFullYear());
        setSelectedDay(today.getDate());
    };

    const isToday = (day) => {
        return (
            day === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear()
        );
    };

    const formatEventDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatEventTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    // Get unique category dots for a day
    const getDayDots = (day) => {
        const dayEmails = emailsByDate[day];
        if (!dayEmails) return [];
        const seen = new Set();
        return dayEmails
            .filter(e => {
                if (seen.has(e.category)) return false;
                seen.add(e.category);
                return true;
            })
            .map(e => e.category)
            .slice(0, 3);
    };

    return (
        <div className="event-calendar animate-fade-in">
            <div className="event-calendar__container">
                {/* Calendar Section */}
                <div className="event-calendar__calendar-section">
                    <div className="event-calendar__header">
                        <button className="event-calendar__nav-btn" onClick={goToPrevMonth} aria-label="Previous month">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <div className="event-calendar__month-display">
                            <h3 className="event-calendar__month-title">{MONTH_NAMES[currentMonth]} {currentYear}</h3>
                            <button className="event-calendar__today-btn" onClick={goToToday}>Today</button>
                        </div>
                        <button className="event-calendar__nav-btn" onClick={goToNextMonth} aria-label="Next month">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                    </div>

                    {/* Day labels */}
                    <div className="event-calendar__day-labels">
                        {DAY_LABELS.map(d => (
                            <div key={d} className="event-calendar__day-label">{d}</div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="event-calendar__grid">
                        {calendarCells.map((day, idx) => (
                            <div
                                key={idx}
                                className={`event-calendar__day ${day === null ? 'empty' : ''} ${isToday(day) ? 'today' : ''} ${selectedDay === day && day !== null ? 'selected' : ''} ${emailsByDate[day] ? 'has-events' : ''}`}
                                onClick={() => day !== null && setSelectedDay(day === selectedDay ? null : day)}
                            >
                                {day !== null && (
                                    <>
                                        <span className="event-calendar__day-num">{day}</span>
                                        {getDayDots(day).length > 0 && (
                                            <div className="event-calendar__dots">
                                                {getDayDots(day).map((cat, i) => (
                                                    <span
                                                        key={i}
                                                        className="event-calendar__dot"
                                                        style={{ background: CATEGORY_COLORS[cat] || '#667EEA' }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Upcoming Events Section */}
                <div className="event-calendar__upcoming-section">
                    <h4 className="event-calendar__upcoming-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {selectedDay !== null
                            ? `Events on ${MONTH_NAMES[currentMonth]} ${selectedDay}`
                            : 'Upcoming Events'}
                    </h4>

                    <div className="event-calendar__event-list">
                        {selectedDay !== null ? (
                            selectedDayEvents && selectedDayEvents.length > 0 ? (
                                selectedDayEvents.map((event, idx) => (
                                    <div 
                                        key={idx} 
                                        className="event-calendar__event-item"
                                        onClick={() => onEventClick && onEventClick(event)}
                                        style={{ cursor: onEventClick ? 'pointer' : 'default' }}
                                    >
                                        <div
                                            className="event-calendar__event-stripe"
                                            style={{ background: CATEGORY_COLORS[event.category] || '#667EEA' }}
                                        />
                                        <div className="event-calendar__event-content">
                                            <div className="event-calendar__event-subject">{event.subject}</div>
                                            <div className="event-calendar__event-meta">
                                                <span className="event-calendar__event-category" style={{ color: CATEGORY_COLORS[event.category] || '#667EEA' }}>
                                                    {event.category}
                                                </span>
                                                <span className="event-calendar__event-time">{formatEventTime(event.eventDate || event.date)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="event-calendar__no-events">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                    <span>No events on this day</span>
                                </div>
                            )
                        ) : (
                            upcomingEvents.length > 0 ? (
                                upcomingEvents.map((event, idx) => (
                                    <div 
                                        key={idx} 
                                        className="event-calendar__event-item" 
                                        style={{ animationDelay: `${idx * 60}ms`, cursor: onEventClick ? 'pointer' : 'default' }}
                                        onClick={() => onEventClick && onEventClick(event)}
                                    >
                                        <div
                                            className="event-calendar__event-stripe"
                                            style={{ background: CATEGORY_COLORS[event.category] || '#667EEA' }}
                                        />
                                        <div className="event-calendar__event-content">
                                            <div className="event-calendar__event-subject">{event.subject}</div>
                                            <div className="event-calendar__event-meta">
                                                <span className="event-calendar__event-category" style={{ color: CATEGORY_COLORS[event.category] || '#667EEA' }}>
                                                    {event.category}
                                                </span>
                                                <span className="event-calendar__event-date">{formatEventDate(event.eventDate || event.date)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="event-calendar__no-events">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></svg>
                                    <span>No upcoming events</span>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
