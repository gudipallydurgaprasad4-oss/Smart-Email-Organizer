import { useState, useRef, useEffect, useMemo } from 'react';

const SUGGESTIONS = [
    "📅 What are my upcoming deadlines?",
    "📊 Give me an inbox overview",
    "📚 Summarize my academic emails",
    "🎉 Any events this week?",
    "⚠️ What's urgent or important?",
    "🔍 Search for assignment deadlines"
];

// Simple markdown-like renderer for chat messages
function renderFormattedText(text) {
    if (!text) return text;

    // Normalize literal \n sequences into real newlines
    let normalized = text.replace(/\\n/g, '\n');

    // Split by newlines
    const lines = normalized.split('\n');

    return lines.map((line, i) => {
        // Process bold: **text** → <strong>text</strong>
        const parts = [];
        let remaining = line;
        let key = 0;

        while (remaining.length > 0) {
            const boldStart = remaining.indexOf('**');
            if (boldStart === -1) {
                parts.push(remaining);
                break;
            }

            // Text before bold
            if (boldStart > 0) {
                parts.push(remaining.substring(0, boldStart));
            }

            const boldEnd = remaining.indexOf('**', boldStart + 2);
            if (boldEnd === -1) {
                parts.push(remaining);
                break;
            }

            // Bold text
            const boldText = remaining.substring(boldStart + 2, boldEnd);
            parts.push(<strong key={`b${i}-${key++}`}>{boldText}</strong>);
            remaining = remaining.substring(boldEnd + 2);
        }

        // Check if line starts with bullet
        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
        const isNumbered = /^\d+\.\s/.test(line.trim());
        const isListItem = isBullet || isNumbered;
        const isEmptyLine = line.trim() === '';

        return (
            <span key={i} style={isListItem ? { display: 'block', marginTop: '0.5em' } : isEmptyLine ? { display: 'block', marginTop: '0.4em' } : undefined}>
                {i > 0 && !isListItem && !isEmptyLine && <br />}
                {isBullet && <span style={{ display: 'inline-block', width: '0.5em' }} />}
                {parts.length > 0 ? parts : line}
            </span>
        );
    });
}

const ACTION_LABELS = {
    navigate_category: '📂 Navigating to category...',
    search_emails: '🔍 Searching emails...',
    select_email: '📧 Opening email...',
    select_email_by_index: '📧 Opening email...',
    go_dashboard: '🏠 Going to dashboard...',
    recategorize: '🔄 Re-categorizing email...',
    recategorize_by_sender: '🔄 Moving all emails from sender...'
};

export default function ChatBot({ emails = [], onNavigateCategory, onSearch, onSelectEmail, onGoDashboard, onRecategorize, isDemo }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hi! I'm your AI email assistant 🚀\n\nI can help you with:\n• **Navigate** — \"show me hackathon emails\"\n• **Deadlines** — \"what are my upcoming deadlines?\"\n• **Summaries** — \"summarize my academic emails\"\n• **Events** — \"any events this week?\"\n• **Insights** — \"give me an inbox overview\"\n\nWhat would you like to know?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastAction, setLastAction] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Clear action indicator after a delay
    useEffect(() => {
        if (lastAction) {
            const timer = setTimeout(() => setLastAction(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [lastAction]);

    // Build a rich, structured email summary for the chatbot context
    const emailSummary = useMemo(() => {
        if (!emails || emails.length === 0) return '';

        // Category counts
        const catCounts = {};
        emails.forEach(e => {
            catCounts[e.category || 'Uncategorized'] = (catCounts[e.category || 'Uncategorized'] || 0) + 1;
        });
        let summary = `INBOX OVERVIEW: ${emails.length} total emails\n`;
        summary += `Categories: ${Object.entries(catCounts).map(([cat, count]) => `${cat}: ${count}`).join(', ')}\n\n`;

        // Today's date for context
        summary += `TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

        // --- DEADLINE CANDIDATES: scan ALL emails for deadline-related keywords ---
        const deadlineKeywords = /deadline|due|submit|assignment|last date|registration closes|preponed|postponed|extended|exam|quiz|test|project.*submission|before\s+\d/i;
        const deadlineCandidates = emails.filter(e => {
            const text = `${e.subject || ''} ${e.snippet || ''}`;
            return deadlineKeywords.test(text);
        });

        if (deadlineCandidates.length > 0) {
            summary += `--- ⚠️ DEADLINE CANDIDATES (${deadlineCandidates.length} emails with deadline/due-date keywords) ---\n`;
            deadlineCandidates.slice(0, 10).forEach((e, i) => {
                const from = e.from?.split('<')[0]?.trim() || e.from || 'Unknown';
                const date = e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                const snippet = e.snippet?.substring(0, 200) || '';
                summary += `${i + 1}. "${e.subject}" from ${from} (${date}) — ${snippet}\n`;
            });
            summary += '\n';
        }

        // Group emails by category for better AI comprehension
        const grouped = {};
        emails.forEach(e => {
            const cat = e.category || 'Uncategorized';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(e);
        });

        // Process important categories first with full detail, Spam last with minimal detail
        const priorityOrder = ['Academics', 'Events', 'Hackathons', 'Personal', 'Spam', 'Uncategorized'];
        const orderedCategories = priorityOrder.filter(cat => grouped[cat]);
        // Add any categories not in the priority list
        for (const cat of Object.keys(grouped)) {
            if (!orderedCategories.includes(cat)) orderedCategories.push(cat);
        }

        for (const cat of orderedCategories) {
            const catEmails = grouped[cat];
            if (!catEmails) continue;

            summary += `--- ${cat.toUpperCase()} (${catEmails.length} emails) ---\n`;

            if (cat === 'Spam') {
                // Spam: brief listing to save space for important categories
                catEmails.slice(0, 10).forEach((e, i) => {
                    const from = e.from?.split('<')[0]?.trim() || e.from || 'Unknown';
                    summary += `${i + 1}. "${e.subject}" from ${from}\n`;
                });
                if (catEmails.length > 10) {
                    summary += `... and ${catEmails.length - 10} more spam emails\n`;
                }
            } else {
                // Important categories: full detail with longer snippets, include ALL emails
                catEmails.forEach((e, i) => {
                    const from = e.from?.split('<')[0]?.trim() || e.from || 'Unknown';
                    const date = e.date ? new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
                    const snippet = e.snippet?.substring(0, 300) || '';
                    summary += `${i + 1}. "${e.subject}" from ${from} (${date}) — ${snippet}\n`;
                });
            }
            summary += '\n';
        }

        // Cap total summary generously — the server will truncate further if needed
        if (summary.length > 15000) {
            summary = summary.substring(0, 15000) + '\n... (truncated)';
        }

        return summary;
    }, [emails]);

    // Execute an action returned by the AI
    const executeAction = (action) => {
        if (!action || !action.type) return;

        setLastAction(action.type);

        switch (action.type) {
            case 'navigate_category':
                if (action.category && onNavigateCategory) {
                    onNavigateCategory(action.category);
                }
                break;
            case 'search_emails':
                if (action.query && onSearch) {
                    onSearch(action.query);
                }
                break;
            case 'select_email':
                if (action.emailSubject && onSelectEmail) {
                    onSelectEmail(action.emailSubject);
                }
                break;
            case 'go_dashboard':
                if (onGoDashboard) {
                    onGoDashboard();
                }
                break;
            case 'recategorize':
                if (action.emailSubject && action.newCategory && onRecategorize) {
                    const searchTerm = action.emailSubject.toLowerCase();
                    // Find all matching emails by subject or sender
                    const matches = emails.filter(e =>
                        e.subject?.toLowerCase().includes(searchTerm) ||
                        e.from?.toLowerCase().includes(searchTerm)
                    );
                    if (matches.length > 0) {
                        matches.forEach(found => {
                            if (isDemo) {
                                onRecategorize(found.id, action.newCategory);
                            } else {
                                fetch(`/api/emails/${found.id}/recategorize`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ category: action.newCategory, email: found })
                                }).then(res => {
                                    if (res.ok) {
                                        onRecategorize(found.id, action.newCategory);
                                    }
                                }).catch(err => console.error('Recategorize failed:', err));
                            }
                        });
                    }
                }
                break;
            case 'recategorize_by_sender':
                if (action.senderName && action.newCategory && onRecategorize) {
                    const sender = action.senderName.toLowerCase();
                    const senderMatches = emails.filter(e =>
                        e.from?.toLowerCase().includes(sender)
                    );
                    if (senderMatches.length > 0) {
                        senderMatches.forEach(found => {
                            if (isDemo) {
                                onRecategorize(found.id, action.newCategory);
                            } else {
                                fetch(`/api/emails/${found.id}/recategorize`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ category: action.newCategory, email: found })
                                }).then(res => {
                                    if (res.ok) {
                                        onRecategorize(found.id, action.newCategory);
                                    }
                                }).catch(err => console.error('Recategorize failed:', err));
                            }
                        });
                    }
                }
                break;
            case 'select_email_by_index':
                if (action.index && onSelectEmail) {
                    const idx = action.index - 1; // convert 1-based to 0-based
                    let emailList = emails;
                    // If a category is specified, filter to that category
                    if (action.category) {
                        emailList = emails.filter(e =>
                            e.category?.toLowerCase() === action.category.toLowerCase()
                        );
                        // Also navigate to that category
                        if (onNavigateCategory) {
                            onNavigateCategory(action.category);
                        }
                    }
                    if (idx >= 0 && idx < emailList.length) {
                        const email = emailList[idx];
                        onSelectEmail(email.subject);
                    }
                }
                break;
            default:
                break;
        }
    };

    const sendMessage = async (text) => {
        const messageText = text || input.trim();
        if (!messageText || isLoading) return;

        const userMessage = { role: 'user', content: messageText };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Send conversation history (exclude the initial greeting for cleaner context)
            const history = updatedMessages
                .slice(1) // skip initial greeting
                .map(m => ({ role: m.role, content: m.content }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    message: messageText,
                    history,
                    emailSummary
                })
            });

            const data = await response.json();
            console.log('[ChatBot] AI response:', data);
            const assistantMessage = { role: 'assistant', content: data.reply || data.error || "Sorry, I couldn't process that." };
            setMessages(prev => [...prev, assistantMessage]);

            // Execute any navigation action returned by the AI
            if (data.action) {
                console.log('[ChatBot] Executing action:', data.action);
                executeAction(data.action);
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, something went wrong. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleClearChat = () => {
        setMessages([
            { role: 'assistant', content: "Hi! I'm your AI email assistant 🚀\n\nHow can I help you today?" }
        ]);
        setLastAction(null);
    };

    return (
        <>
            <button
                className="chat-fab"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Open AI Assistant"
            >
                {isOpen ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
            </button>

            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <div className="chat-header__avatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg></div>
                        <div>
                            <div className="chat-header__title">AI Assistant</div>
                            <div className="chat-header__status">
                                {emails.length > 0
                                    ? `${emails.length} emails loaded · Ready to assist`
                                    : 'Ready to help'}
                            </div>
                        </div>
                        {messages.length > 1 && (
                            <button
                                className="chat-clear-btn"
                                onClick={handleClearChat}
                                title="Clear chat"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            </button>
                        )}
                    </div>

                    {/* Action indicator */}
                    {lastAction && (
                        <div className="chat-action-indicator">
                            {ACTION_LABELS[lastAction] || 'Performing action...'}
                        </div>
                    )}

                    <div className="chat-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`chat-message chat-message--${msg.role}`}>
                                {msg.role === 'assistant' ? renderFormattedText(msg.content) : msg.content}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="chat-message chat-message--assistant">
                                <span className="chat-typing">
                                    <span></span><span></span><span></span>
                                </span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {messages.length === 1 && (
                        <div className="chat-suggestions">
                            {SUGGESTIONS.map((s, i) => (
                                <button key={i} onClick={() => sendMessage(s)} className="chat-suggestion">
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="chat-input-area">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask: deadlines, summaries, events..."
                            disabled={isLoading}
                            className="chat-input"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck="false"
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className="chat-send"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
