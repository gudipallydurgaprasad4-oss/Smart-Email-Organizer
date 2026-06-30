import express from 'express';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are a smart, friendly AI assistant built into the Smart Email Organizer app. You help university students manage, understand, analyze, and navigate their emails.

You MUST respond ONLY with valid JSON in this exact format, with NO wrapping markdown blocks:
{"reply": "your detailed message to the user", "action": null}

When the user wants to navigate somewhere, include an action:
{"reply": "Taking you to your hackathon emails!", "action": {"type": "navigate_category", "category": "Hackathons"}}

When the user wants to search for something in their inbox:
{"reply": "I've filtered your dashboard to show search results for 'deadlines'!", "action": {"type": "search_emails", "query": "deadlines"}}

When the user wants to move/recategorize emails from a sender:
{"reply": "Moving all FamApp emails to Personal!", "action": {"type": "recategorize_by_sender", "senderName": "FamApp", "newCategory": "Personal"}}

When the user wants to move/recategorize a specific email:
{"reply": "Moving 'Tech Fest 2026' to Academics!", "action": {"type": "recategorize", "emailSubject": "Tech Fest 2026", "newCategory": "Academics"}}

Available actions:
1. {"type": "navigate_category", "category": "<name>"} - Navigate to a category. Valid categories: Events, Academics, Hackathons, Personal, Spam
2. {"type": "search_emails", "query": "<search text>"} - Search emails by keyword, sender name, or topic
3. {"type": "select_email", "emailSubject": "<partial or full subject>"} - Open a specific email by its subject
4. {"type": "go_dashboard"} - Go back to the main dashboard view
5. {"type": "recategorize", "emailSubject": "<partial or full subject>", "newCategory": "<category name>"} - Re-categorize a SINGLE email by subject match. Valid categories: Events, Academics, Hackathons, Personal, Spam
6. {"type": "recategorize_by_sender", "senderName": "<sender name like FamApp, LinkedIn, etc>", "newCategory": "<category name>"} - Re-categorize ALL emails from a specific sender. Use this when the user wants to move all emails from a sender.
7. {"type": "select_email_by_index", "index": <number>, "category": "<optional category name>"} - Open an email by its number/position in the list. Use when user says things like "take me to 7", "open email #3", "show me number 5 in Academics". The index is 1-based. Category is optional — if specified, picks from that category; otherwise picks from all emails.

RECATEGORIZATION RULES:
- When the user says an email is wrongly categorized, or asks to move/recategorize an email, use the recategorize action.
- When the user wants to move ALL emails from a specific sender, use recategorize_by_sender with the sender name.
- Always confirm what you're doing in the reply, e.g. "Moving 'Tech Fest 2026' from Events to Academics!"
- If the user doesn't specify which email, ask them to clarify.
- If the user doesn't specify the target category, ask them which category to move it to.
- CRITICAL: You MUST ALWAYS include the action object in your JSON response for the move to actually happen. Setting action to null when moving/recategorizing means NOTHING will happen. The move ONLY works through the action object.
- NEVER say you moved emails without including the action. If you say "Moving..." your action MUST NOT be null.

YOUR ADVANCED CAPABILITIES:
1. **Deadlines & Due Dates**: When asked about deadlines, scan email subjects and snippets for dates, "due", "deadline", "submit by", "last date", "extended till", "before", "registration closes". List them clearly with dates.
2. **Email Summaries**: Summarize all emails or emails in a specific category. Group by topic/sender and highlight what's important.
3. **Inbox Overview / Daily Digest**: Give a high-level overview: "You have X emails — Y academic, Z events, etc. Here's what needs attention..."
4. **Important / Urgent Detection**: Identify emails that seem urgent based on keywords like "urgent", "deadline", "today", "ASAP", "last date", "final call", "don't miss", "reminder".
5. **Event Listings**: List upcoming events, workshops, fests, hackathons with dates from the emails.
6. **Sender Insights**: Tell the user who emails them the most, or find emails from specific senders.
7. **Category Insights**: "You have 5 academic emails mostly about assignments and exams, 3 events about workshops..."
8. **Navigation**: Navigate categories, search emails, open specific emails, go to dashboard.

FORMATTING GUIDELINES for your replies:
- Use **bold** for emphasis on important items like dates and email subjects
- Use bullet points (•) for grouped lists
- Use numbered lists (1. 2. 3.) for deadlines and action items — put EACH item on its OWN line
- CRITICAL: In your JSON reply string, use newline characters (\n) to separate lines. Each list item, heading, and paragraph MUST be on a separate line. NEVER output a wall of text.
- Add blank lines (\n\n) between sections for visual breathing room
- For dates, always mention the specific date when available
- Keep summaries well-structured and scannable
- Use emojis strategically for visual appeal 📅 ⚠️ 📚 🎉 💼 🗑️

EXAMPLE for deadline responses (notice each item is on its own line with spacing):
{"reply": "📅 Here are your upcoming deadlines:\n\n1. **MOIS Home Assignment 2** — Due: **Friday, 17 Apr 2026, 5 PM**\n\n2. **Group Project on Statistical Inference** — Submission preponed to: **Thursday, 16 Apr 2026**\n\nWould you like me to open any of these emails?", "action": null}

RESPONSE GUIDELINES:
- ALWAYS respond with valid JSON. Never respond with plain text.
- Be concise but thorough. Use formatted text for readability.
- When the user clearly wants to navigate or search, ALWAYS include an action, and your reply must definitively confirm the action is complete (e.g. "I've filtered your dashboard!") rather than saying you are "Searching..." since the results appear instantly in the main UI.
- When the user asks to move/recategorize emails, ALWAYS include a recategorize or recategorize_by_sender action — NEVER set action to null for move requests
- When the user asks for info/summaries/deadlines, provide detailed answers using the email context with action: null
- For summaries, aim for comprehensive but scannable responses (up to 300 words is fine)
- If asked to send/delete emails, explain you can only help with reading and navigating
- If no deadline info is found in emails, say so honestly — don't make up dates
- Be proactive: after answering, suggest a relevant follow-up (e.g. "Would you like me to open that email?")`;

// Helper: attempt a chat completion with retries and fallback model
async function attemptChatCompletion(chatMessages, retries = 2) {
    let lastError = null;

    // Try primary model with retries
    for (let i = 0; i <= retries; i++) {
        try {
            const completion = await groq.chat.completions.create({
                messages: chatMessages,
                model: PRIMARY_MODEL,
                temperature: 0.4,
                max_tokens: 2500
            });
            return completion;
        } catch (err) {
            lastError = err;
            console.warn(`[Chat AI] Primary model attempt ${i + 1} failed:`, err.status || err.message);

            // Don't retry on auth errors
            if (err.status === 401) throw err;

            // If rate limited or payload too large, immediately fallback
            if (err.status === 429 || err.status === 413) {
                console.warn(`[Chat AI] ${err.status} on primary model. Skipping retries.`);
                break;
            }

            // Wait before retrying (exponential backoff)
            if (i < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    // Try fallback model with truncated context to avoid 413
    console.log('[Chat AI] Trying fallback model:', FALLBACK_MODEL);
    try {
        // Truncate system message for smaller model
        const fallbackMessages = chatMessages.map(msg => {
            if (msg.role === 'system' && msg.content.length > 12000) {
                return { ...msg, content: msg.content.substring(0, 12000) + '\n... (context truncated for smaller model)' };
            }
            return msg;
        });
        const completion = await groq.chat.completions.create({
            messages: fallbackMessages,
            model: FALLBACK_MODEL,
            temperature: 0.4,
            max_tokens: 2000
        });
        return completion;
    } catch (fallbackErr) {
        console.error('[Chat AI] Fallback model also failed:', fallbackErr.status || fallbackErr.message);
        throw lastError; // throw the original error
    }
}

// Helper: sanitize raw AI output so JSON.parse can handle literal newlines
function sanitizeJsonString(raw) {
    // Replace literal newlines/tabs inside JSON string values with escape sequences
    // Walk character by character tracking whether we're inside a JSON string
    let result = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (escaped) {
            result += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\' && inString) {
            result += ch;
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            result += ch;
            continue;
        }
        if (inString) {
            if (ch === '\n') { result += '\\n'; continue; }
            if (ch === '\r') { result += '\\r'; continue; }
            if (ch === '\t') { result += '\\t'; continue; }
        }
        result += ch;
    }
    return result;
}

// Helper: parse AI response safely
function parseAIResponse(rawContent) {
    let reply = "I couldn't generate a response.";
    let action = null;

    // Try direct parse first
    try {
        const parsed = JSON.parse(rawContent);
        reply = parsed.reply || reply;
        action = parsed.action || null;
    } catch (parseErr) {
        // Try after sanitizing literal newlines
        try {
            const sanitized = sanitizeJsonString(rawContent);
            const parsed = JSON.parse(sanitized);
            reply = parsed.reply || reply;
            action = parsed.action || null;
        } catch (e2) {
            // Try to extract JSON block from surrounding text
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const sanitized = sanitizeJsonString(jsonMatch[0]);
                    const parsed = JSON.parse(sanitized);
                    reply = parsed.reply || rawContent;
                    action = parsed.action || null;
                } catch (e3) {
                    // Last resort: regex extract the reply value
                    const replyMatch = rawContent.match(/"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"action"/);
                    if (replyMatch) {
                        reply = replyMatch[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t');
                    } else {
                        reply = rawContent.replace(/^\{?\s*"reply"\s*:\s*"?/, '').replace(/"?\s*,?\s*"action"\s*:.*\}?$/, '') || rawContent;
                    }
                }
            } else {
                reply = rawContent;
            }
        }
    }

    // Validate action structure
    if (action && typeof action === 'object') {
        const validTypes = ['navigate_category', 'search_emails', 'select_email', 'go_dashboard', 'recategorize', 'recategorize_by_sender', 'select_email_by_index'];
        if (!validTypes.includes(action.type)) {
            action = null;
        }
    } else if (action && typeof action !== 'object') {
        action = null; // ignore string/number actions
    }

    // FALLBACK: If the AI mentions moving/recategorizing in the reply but forgot the action,
    // try to auto-detect and construct the action from the reply text
    if (!action && reply) {
        const replyLower = reply.toLowerCase();
        const validCategories = ['Events', 'Academics', 'Hackathons', 'Personal', 'Spam'];

        // Check if the reply mentions moving/recategorizing
        const isMoveIntent = /\b(moving|moved|relocat|recategoriz|categoriz)\b/i.test(reply);

        if (isMoveIntent) {
            // Try to find the target category
            let targetCategory = null;
            for (const cat of validCategories) {
                // Match patterns like "to Personal", "to Spam", etc.
                if (new RegExp(`\\bto\\s+${cat}\\b`, 'i').test(reply)) {
                    targetCategory = cat;
                    break;
                }
            }

            if (targetCategory) {
                // Try to extract sender name from patterns like "all X emails" or "X emails from"
                const senderMatch = reply.match(/\ball\s+(.+?)\s+emails?\b/i) ||
                    reply.match(/\b(?:from|by)\s+(\w+)\b/i);

                if (senderMatch) {
                    const senderName = senderMatch[1].replace(/\band\b/gi, '').trim();
                    // If it mentions multiple senders, split by "and" / ","
                    const senders = senderName.split(/\s*(?:,|and)\s*/i).filter(s => s.trim().length > 0);

                    if (senders.length === 1) {
                        action = { type: 'recategorize_by_sender', senderName: senders[0].trim(), newCategory: targetCategory };
                        console.log('[Chat AI] Fallback: auto-detected recategorize_by_sender action:', action);
                    } else if (senders.length > 1) {
                        // For multiple senders, pick the first one; the frontend will handle it
                        action = { type: 'recategorize_by_sender', senderName: senders[0].trim(), newCategory: targetCategory };
                        console.log('[Chat AI] Fallback: auto-detected recategorize_by_sender for first sender:', action);
                    }
                }

                // If no sender found, try to extract email subject
                if (!action) {
                    const subjectMatch = reply.match(/['""](.+?)['""]/) || reply.match(/moving\s+['"]?(.+?)['"]?\s+(?:from|to)/i);
                    if (subjectMatch) {
                        action = { type: 'recategorize', emailSubject: subjectMatch[1].trim(), newCategory: targetCategory };
                        console.log('[Chat AI] Fallback: auto-detected recategorize action:', action);
                    }
                }
            }
        }
    }

    return { reply, action };
}

router.post('/', async (req, res) => {
    try {
        const { message, history = [], emailSummary = '' } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Build the system prompt with email context if available
        let contextPrompt = SYSTEM_PROMPT;
        if (emailSummary) {
            // Truncate email summary safely. Llama-3 handles 8k tokens (~32k chars).
            const truncatedSummary = emailSummary.length > 20000
                ? emailSummary.substring(0, 20000) + '\n... (truncated)'
                : emailSummary;
            contextPrompt += `\n\nHere is a summary of the user's recent emails:\n${truncatedSummary}`;
        }

        // Build messages array with conversation history for multi-turn context
        const chatMessages = [
            { role: 'system', content: contextPrompt }
        ];

        // Add conversation history (limit to last 10 exchanges to stay within token limits)
        const recentHistory = history.slice(-20); // last 20 messages (10 exchanges)
        for (const msg of recentHistory) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                chatMessages.push({ role: msg.role, content: msg.content });
            }
        }

        const completion = await attemptChatCompletion(chatMessages);

        const rawContent = completion.choices[0]?.message?.content || '{}';
        console.log('[Chat AI] Raw response:', rawContent);

        const { reply, action } = parseAIResponse(rawContent);

        console.log('[Chat AI] Parsed reply:', reply);
        console.log('[Chat AI] Parsed action:', action);

        res.json({ reply, action });
    } catch (error) {
        console.error('Chat error:', error.status || error.message);

        // Provide user-friendly error messages
        if (error.status === 429) {
            res.status(429).json({
                reply: "I'm getting too many requests right now. Please wait a moment and try again! ⏳",
                action: null
            });
        } else if (error.status === 401) {
            res.status(500).json({
                reply: "There's an issue with my AI configuration. Please let the admin know. 🔧",
                action: null
            });
        } else {
            res.status(500).json({
                reply: "Oops! I had trouble processing that. Please try again in a moment. 🔄",
                action: null
            });
        }
    }
});

export default router;
