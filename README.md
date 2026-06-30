# Smart Email Organizer

An AI-powered email management system built for university students. It connects to your Gmail inbox via OAuth 2.0, fetches recent emails, and automatically classifies them into meaningful categories using a hybrid ML approach combining keyword analysis with Naive Bayes text classification.

## Features

- **Gmail Integration** — Secure OAuth 2.0 authentication to read emails (read-only access)
- **Automatic Email Classification** — Hybrid keyword-scoring + Naive Bayes classifier that categorizes emails into:
  - 📅 **Events** — Campus fests, workshops, cultural activities
  - 📚 **Academics** — Assignments, notices, scholarships, placements
  - 💻 **Hackathons** — Coding competitions, hackathons, contests
  - 👤 **Personal** — Friend messages, LinkedIn connections, personal notifications
  - 🗑️ **Spam** — Promotions, newsletters, automated notifications
- **AI Chatbot Assistant** — Natural language chatbot powered by Groq (Llama 3.3) that can:
  - Summarize emails by category
  - Find deadlines and upcoming events
  - Navigate categories and search emails
  - Re-categorize misclassified emails
- **Adaptive Learning** — Users can correct misclassified emails, and the ML model learns from corrections
- **Email Search** — Full-text search across subjects, snippets, and senders
- **Event Calendar** — Visual calendar widget showing upcoming events extracted from emails
- **Attachment Support** — View and download email attachments inline
- **Demo Mode** — Try the app with sample data without connecting Gmail

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js, Express.js |
| Authentication | Google OAuth 2.0 (googleapis) |
| ML Classification | natural (Naive Bayes), custom keyword-scoring engine |
| AI Chatbot | Groq API (Llama 3.3 70B) |
| Styling | Vanilla CSS with CSS custom properties |

## Project Structure

```
smart-email-organizer/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── CategoryCard.jsx
│   │   │   ├── ChatBot.jsx
│   │   │   ├── EmailDetail.jsx
│   │   │   ├── EmailList.jsx
│   │   │   ├── EventCalendar.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # Main dashboard page
│   │   │   └── Login.jsx       # Login page with Google OAuth
│   │   ├── services/
│   │   │   └── api.js          # API client functions
│   │   ├── App.jsx             # Root component with routing
│   │   ├── main.jsx            # Entry point
│   │   └── index.css           # Global styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                     # Node.js backend
│   ├── config/
│   │   └── oauth.js            # Google OAuth2 client setup
│   ├── routes/
│   │   ├── auth.js             # Authentication endpoints
│   │   ├── chat.js             # AI chatbot endpoint
│   │   └── emails.js           # Email fetch & classify endpoints
│   ├── services/
│   │   ├── classifierService.js # Hybrid ML email classifier
│   │   └── gmailService.js     # Gmail API integration
│   ├── models/
│   │   └── user_overrides.json  # Persistent user corrections
│   ├── index.js                # Express server entry point
│   ├── .env                    # Environment variables (not committed)
│   └── package.json
├── .gitignore
├── package.json                # Root scripts
└── README.md
```

## How the Classifier Works

The email classifier uses a **hybrid approach** for robust accuracy:

1. **Keyword Scoring Engine** (primary) — Each category has weighted keyword dictionaries. Email subjects and snippets are scored against these dictionaries. Strong matches get weight 3, moderate matches get weight 1.

2. **Naive Bayes Classifier** (secondary) — A `natural` library Bayes classifier trained on seed data acts as a tiebreaker when keyword scores are low.

3. **Sender-Based Rules** — Known promotional senders (e.g., Zomato, LinkedIn notifications) are flagged as Spam. Academic senders (`.ac.in`, `.edu` domains) get an Academics boost.

4. **LinkedIn Special Handler** — LinkedIn emails are specially handled since they can be personal interactions (connection requests) or spam (job alerts, digests).

5. **User Feedback Loop** — When users re-categorize emails, the system:
   - Retrains the Bayes model with the correction
   - Saves sender-level overrides for future emails from the same sender

## Setup & Installation

### Prerequisites
- Node.js 18+ 
- Google Cloud Console project with Gmail API enabled
- Groq API key (for the chatbot)

### 1. Clone and install dependencies
```bash
cd smart-email-organizer
npm run install:all
```

### 2. Configure environment variables
Create `server/.env`:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/callback
GROQ_API_KEY=your_groq_api_key
SESSION_SECRET=your_session_secret
PORT=3001
CLIENT_URL=http://localhost:5173
```

### 3. Run the application
```bash
# Terminal 1 — Start the backend
npm run dev:server

# Terminal 2 — Start the frontend
npm run dev:client
```

The app will be available at `http://localhost:5173`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/google` | Get Google OAuth URL |
| GET | `/auth/callback` | OAuth callback handler |
| GET | `/auth/user` | Get current authenticated user |
| POST | `/auth/logout` | Logout and destroy session |
| GET | `/api/emails` | Fetch and classify all emails |
| GET | `/api/emails/:category` | Fetch emails by category |
| POST | `/api/emails/:id/recategorize` | Re-categorize an email (trains ML) |
| POST | `/api/chat` | Send message to AI chatbot |
