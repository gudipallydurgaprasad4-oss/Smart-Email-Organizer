/**
 * classifierService.js — Hybrid Email Classifier
 * 
 * Uses a two-pronged approach for email categorization:
 * 1. Keyword Scoring Engine (primary): Weighted keyword dictionaries per category.
 *    Strong keyword matches score 3 points, moderate matches score 1 point.
 *    The category with the highest total score wins.
 * 
 * 2. Naive Bayes Classifier (secondary): A text classifier from the 'natural' NLP
 *    library, trained on seed data. Used as a tiebreaker when keyword scores are low.
 * 
 * Additional heuristics:
 * - Sender-based rules for known promotional/academic senders
 * - LinkedIn-specific handler for connection vs notification emails
 * - User feedback loop: corrections retrain the Bayes model and save sender overrides
 */

import natural from 'natural';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OVERRIDES_PATH = path.join(__dirname, '..', 'models', 'user_overrides.json');

const CATEGORIES = ['Events', 'Academics', 'Hackathons', 'Personal', 'Spam'];

// Persistent user overrides: sender email/name → category
// When a user corrects a categorization, we save the sender → category mapping
let userOverrides = {};

function loadUserOverrides() {
    try {
        if (fs.existsSync(OVERRIDES_PATH)) {
            userOverrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'));
            console.log(`[ML Classifier] Loaded ${Object.keys(userOverrides).length} user overrides`);
        }
    } catch (err) {
        console.error('[ML Classifier] Failed to load user overrides:', err.message);
        userOverrides = {};
    }
}

function saveUserOverrides() {
    try {
        const dir = path.dirname(OVERRIDES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(userOverrides, null, 2));
        console.log('[ML Classifier] User overrides saved');
    } catch (err) {
        console.error('[ML Classifier] Failed to save user overrides:', err.message);
    }
}

// Extract a clean sender key from the "from" field
// Returns both a name key and an email key for matching
function getSenderKey(from) {
    if (!from) return '';
    // Extract the display name (e.g. "FamApp" from "FamApp <noreply@fampay.in>")
    const name = from.split('<')[0].trim().toLowerCase();
    return name || from.toLowerCase();
}

// Extract the email address from the "from" field
function getSenderEmail(from) {
    if (!from) return '';
    const emailMatch = from.match(/<(.+?)>/);
    return emailMatch ? emailMatch[1].toLowerCase() : from.toLowerCase();
}

// Check if there's a user override for this sender
function getUserOverride(from) {
    const senderKey = getSenderKey(from);
    const senderEmail = getSenderEmail(from);
    if (!senderKey && !senderEmail) return null;

    // Check for exact match first (highest priority)
    if (userOverrides[senderKey]) {
        return userOverrides[senderKey];
    }
    if (userOverrides[senderEmail]) {
        return userOverrides[senderEmail];
    }

    // Check for partial match - but require minimum 3 chars to avoid false matches
    // like "x" matching everything
    for (const [key, category] of Object.entries(userOverrides)) {
        if (key.length < 3) continue; // Skip very short keys to avoid false matches
        if (senderKey.includes(key) || key.includes(senderKey)) {
            return category;
        }
        if (senderEmail.includes(key)) {
            return category;
        }
    }
    return null;
}

// Load overrides on startup
loadUserOverrides();

// ─── KEYWORD-BASED CLASSIFICATION (replaces unreliable Naive Bayes) ───

// Category keyword dictionaries with weights
const CATEGORY_KEYWORDS = {
    Events: {
        // Strong signals (weight 3)
        strong: [
            'fest', 'festival', 'event', 'cultural night', 'annual day', 'inauguration',
            'freshers party', 'farewell', 'convocation ceremony', 'sports day',
            'tournament', 'concert', 'live performance', 'celebration',
            'meetup', 'gathering', 'symposium', 'conference', 'seminar', 'webinar',
            'workshop registration', 'cultural fest', 'tech fest', 'art workshop',
            'food fest', 'acfa', 'rsvp', 'keynote speaker', 'candlelight march',
            'remembrance', 'awards ceremony', 'gymkhana awards'
        ],
        // Moderate signals (weight 1)
        moderate: [
            'register now', 'registration open', 'registration extended', 'performances',
            'stalls', 'activities', 'campus event', 'hostel event', 'club',
            'society', 'folk arts', 'classical', 'recreation', 'ceremony',
            'invitation', 'invite', 'march', 'rally', 'competition'
        ]
    },
    Academics: {
        strong: [
            'assignment', 'homework', 'deadline', 'submit', 'submission',
            'exam', 'examination', 'midterm', 'final exam', 'test',
            'grade', 'result', 'marks', 'cgpa', 'gpa', 'transcript',
            'syllabus', 'lecture', 'class', 'tutorial', 'lab',
            'scholarship', 'admission', 'enrollment', 'semester',
            'internship', 'placement', 'campus hiring', 'job notification',
            'research fellow', 'jrf', 'srf', 'thesis', 'dissertation',
            'professor', 'faculty', 'registrar', 'department notice',
            'circular', 'academic notice', 'course registration',
            'attendance', 'timetable', 'schedule released',
            'mse', 'end sem', 'mid sem', 'evaluation form', 'evaluation criteria',
            'notice', 'tsg awards', 'application form', 'call for application',
            'campus hiring', 'opportunities', 'job opportunity',
            'lecdom', 'lecture demonstration'
        ],
        moderate: [
            'course', 'project', 'report', 'paper', 'review',
            'certificate', 'degree', 'convocation',
            'study', 'library', 'academic',
            'department', 'hss', 'iitkgp', 'iit', 'nit', 'iiit',
            'erp', 'admin', 'college', 'university',
            'payment', 'fee', 'tuition', 'foundation',
            'opportunity', 'application', 'career', 'placement',
            'hiring', 'trainee', 'isro', 'vssc'
        ]
    },
    Hackathons: {
        strong: [
            'hackathon', 'hack-a-thon', 'coding challenge', 'code challenge',
            'programming contest', 'competitive programming', 'devhack',
            'hackathonx', 'smart india hackathon', 'sih',
            'code fest', 'codefest', 'codejam', 'code jam',
            'open source contribution', 'build challenge',
            'innovation challenge', 'startup pitch', 'prototype',
            'technoverse hackathon', 'national-level hackathon',
            'coding competition', 'coding contest', 'national-level coding',
            'individual coding contest', 'online coding'
        ],
        moderate: [
            'hack', 'build something', 'developer competition',
            'team formation', 'prizes', 'tracks', 'mentors',
            '24 hours', '48 hours', 'problem-solving',
            'dsa', 'algorithms', 'quantitative aptitude'
        ]
    },
    Personal: {
        strong: [
            'happy birthday', 'birthday party', 'weekend plans',
            'how are you', 'miss you', 'catch up', 'coffee',
            'family reunion', 'dinner plans', 'vacation', 'trip photos',
            'congratulations', 'wedding', 'engagement',
            'roommate', 'flatmate', 'rent', 'new login',
            'accepted your invitation', 'wants to connect',
            'want to connect', 'i want to connect',
            'explore their network', 'profile views'
        ],
        moderate: [
            'friend', 'personal', 'private', 'hangout',
            'party', 'celebration', 'memories', 'photos shared',
            'pawniversary', 'login', 'new device',
            'accepted your', 'network'
        ]
    },
    Spam: {
        strong: [
            'unsubscribe', 'click here', 'limited time offer',
            'buy now', 'order now', 'discount code', 'coupon',
            'won lottery', 'claim prize', 'exclusive deal',
            'promotional', 'newsletter', 'marketing campaign',
            'product update', 'feature release', 'subscription',
            'renewal', 'trial', 'premium plan', 'upgrade now',
            'daily digest', 'weekly digest', 'trending',
            'rate your experience', 'survey', 'customer satisfaction',
            'cashback', 'reward points', 'upi reward',
            'new post for you', 'someone viewed your profile',
            'job alert', 'daily coding challenge',
            'fashion sale', 'beauty sale', 'flight deals',
            'food delivery', 'order delivery',
            'your payment of', 'payment is successful',
            'received in your famx', 'famx account',
            'produce spoiling', 'solutions enclosed',
            'many hats you wear', 'tl;dr',
            'get back on instagram', 'listen to your favorite',
            'open jobs', 'see open jobs'
        ],
        moderate: [
            'sale', 'deal', 'offer', 'free', 'guaranteed',
            'noreply', 'no-reply', 'automated', 'notification',
            'digest', 'recommendations', 'suggestions',
            'update', 'new feature', 'release notes',
            'sponsored', 'advertisement', 'brand',
            'download app', 'install', 'credit card',
            'loan', 'insurance', 'pre-approved',
            'mutual fund', 'stock market', 'portfolio',
            'streaming', 'playlist', 'watch now'
        ]
    }
};

// Known promotional / newsletter senders (very high confidence → Spam)
const SPAM_SENDER_PATTERNS = [
    'geeksforgeeks', 'myfitnesspal', 'noreply', 'no-reply',
    'newsletter', 'promo', 'marketing', 'survey', 'feedback',
    'leetcode', 'hackerrank', 'codechef', 'medium.com', 'digest',
    'mailer', 'notifications',
    'coursera', 'udemy', 'skillshare',
    'zomato', 'swiggy', 'amazon', 'flipkart',
    'quora', 'twitter',
    'donotreply', 'do-not-reply', 'bulk', 'campaigns',
    'ola', 'olacabs', 'replit', 'adobe', 'mail.adobe.com',
    'google one', 'googleone', 'fampay', 'famapp',
    'canva', 'gamma', 'bookmyshow', 'makemytrip',
    'wps', 'kingsoft', 'paytm', 'phonepe', 'razorpay', 'cred',
    'groww', 'zerodha', 'dream11', 'myntra', 'nykaa', 'hotstar',
    'netflix', 'slack', 'figma', 'grammarly',
    'cleartrip', 'goibibo', 'yatra', 'irctc',
    'uber', 'rapido', 'dunzo', 'blinkit', 'bigbasket',
    'meesho', 'ajio', 'tatacliq', 'croma', 'boat',
    'upstox', 'mstock', 'angelone', 'kuvera',
    'practo', 'pharmeasy', 'netmeds', '1mg',
    'unacademy', 'byjus', 'whitehatjr', 'testbook', 'vedantu',
    'indigo', 'goindigo',
    'instagram', 'facebook'
];

// Senders that should NOT be auto-classified as spam even if they match patterns
// (because they have legitimate personal interaction content)
const PERSONAL_INTERACTION_SENDERS = [
    'linkedin', 'github', 'spotify', 'snapchat', 'chess.com',
    'internshala', 'naukri', 'indeed', 'glassdoor', 'monster',
    'notion', 'telegram', 'whatsapp', 'discord', 'signal'
];

// Known academic / institutional sender patterns
const ACADEMIC_SENDER_PATTERNS = [
    '.ac.in', '.edu', 'iitkgp', 'iitk', 'iitb', 'iitd', 'iitm',
    'hss.', 'department', 'registrar', 'professor', 'faculty',
    'adm.iitkgp', 'erp', 'ernet.in', 'nit', 'iiit', 'iiser',
    'university', 'college', 'dean', 'warden'
];

// ─── Hybrid Keyword + Bayes Classifier ───

let classifier = null;
let isModelLoaded = false;

// Pre-seeded training data for Naive Bayes (used as secondary signal only)
const TRAINING_DATA = [
    // === Events ===
    { text: 'tech fest register now campus event', category: 'Events' },
    { text: 'cultural night performances food celebration', category: 'Events' },
    { text: 'annual day ceremony inauguration event', category: 'Events' },
    { text: 'sports tournament cricket football competition', category: 'Events' },
    { text: 'invite invitation rsvp gathering meetup', category: 'Events' },
    { text: 'concert music show live performance', category: 'Events' },
    { text: 'freshers party welcome event new students', category: 'Events' },
    { text: 'farewell graduation ceremony batch celebration', category: 'Events' },
    { text: 'club society annual fest registration open', category: 'Events' },
    { text: 'symposium conference keynote speaker event', category: 'Events' },
    { text: 'food festival stalls activities campus fun', category: 'Events' },
    { text: 'workshop event hands on learning session register', category: 'Events' },
    { text: 'fun surprise activity monday noon campus hostel', category: 'Events' },
    { text: 'hss department activity event fun surprise students', category: 'Events' },
    { text: 'campus activity fun event recreation hostel students', category: 'Events' },
    { text: 'art workshop registration extended acfa academy folk arts', category: 'Events' },
    { text: 'gkf art workshop acfa registration call classical folk arts', category: 'Events' },
    { text: 'cultural fest art performance workshop registration campus', category: 'Events' },
    { text: 'invitation to food fest gujarat cultural association', category: 'Events' },
    { text: 'candlelight march remembrance memorial event', category: 'Events' },
    { text: 'gymkhana awards ceremony evaluation form tsg', category: 'Events' },

    // === Academics ===
    { text: 'assignment deadline submit homework due', category: 'Academics' },
    { text: 'exam schedule final midterm test paper', category: 'Academics' },
    { text: 'course registration enrollment semester', category: 'Academics' },
    { text: 'professor lecture class notes syllabus', category: 'Academics' },
    { text: 'grade result marks cgpa gpa report', category: 'Academics' },
    { text: 'scholarship admission application deadline', category: 'Academics' },
    { text: 'internship placement opportunity apply now', category: 'Academics' },
    { text: 'lab practical experiment report submission', category: 'Academics' },
    { text: 'thesis dissertation research paper review', category: 'Academics' },
    { text: 'job offer notification career fair placement intern', category: 'Academics' },
    { text: 'research fellow position hiring jrf srf application', category: 'Academics' },
    { text: 'looking for intern internship opportunity join team', category: 'Academics' },
    { text: 'attendance warning below minimum required', category: 'Academics' },
    { text: 'faculty department registrar office notice', category: 'Academics' },
    { text: 'tutorial class cancelled rescheduled new time', category: 'Academics' },
    { text: 'certificate degree convocation academic transcript', category: 'Academics' },
    { text: 'group study session library meet project partner', category: 'Academics' },
    { text: 'hss iitkgp department notice circular announcement', category: 'Academics' },
    { text: 'iit kharagpur department academic notice students', category: 'Academics' },
    { text: 'erp iitkgp admin college notice circular registration', category: 'Academics' },
    { text: 'college university department notice students academic', category: 'Academics' },
    { text: 'payment fee semester tuition college university erp', category: 'Academics' },
    { text: 'campus hiring opportunities mind tree group', category: 'Academics' },
    { text: 'call for application scholarship foundation students', category: 'Academics' },
    { text: 'isro vssc junior research fellow job notification', category: 'Academics' },
    { text: 'notice evaluation form tsg awards criteria', category: 'Academics' },
    { text: 'information systems project academic assignment', category: 'Academics' },

    // === Hackathons ===
    { text: 'hackathon 24 hours coding challenge build', category: 'Hackathons' },
    { text: 'programming contest prizes winner team developer', category: 'Hackathons' },
    { text: 'code fest innovation startup pitch prototype', category: 'Hackathons' },
    { text: 'tech challenge hack build deploy solution', category: 'Hackathons' },
    { text: 'devhack hackathon registration team formation', category: 'Hackathons' },
    { text: 'open source contribution github pull request', category: 'Hackathons' },
    { text: '48 hours hackathon prizes tracks mentors', category: 'Hackathons' },
    { text: 'coding competition algorithmic challenge competitive programming', category: 'Hackathons' },
    { text: 'smart india hackathon national level innovation', category: 'Hackathons' },
    { text: 'hackathonx build something amazing innovation challenge', category: 'Hackathons' },
    { text: 'technoverse hackathon cognizant national level engineering', category: 'Hackathons' },

    // === Personal ===
    { text: 'hey how are you doing weekend plans friend', category: 'Personal' },
    { text: 'happy birthday wishes celebration party personal', category: 'Personal' },
    { text: 'family reunion dinner plans holiday trip', category: 'Personal' },
    { text: 'catch up coffee hangout old friend miss you', category: 'Personal' },
    { text: 'photos shared memories trip vacation fun', category: 'Personal' },
    { text: 'congratulations wedding baby personal milestones', category: 'Personal' },
    { text: 'roommate rent apartment room flatmate share', category: 'Personal' },
    { text: 'personal message direct conversation private chat', category: 'Personal' },
    { text: 'invitation birthday party celebrate weekend', category: 'Personal' },
    { text: 'accepted your invitation explore their network connect', category: 'Personal' },
    { text: 'wants to connect invitation linkedin personal', category: 'Personal' },
    { text: 'new login device verification account security', category: 'Personal' },
    { text: 'profile views who viewed your profile', category: 'Personal' },
    { text: 'chess pawniversary anniversary game personal', category: 'Personal' },

    // === Spam (Promotions / Newsletters / Surveys) ===
    { text: 'unsubscribe click here limited time offer sale', category: 'Spam' },
    { text: 'buy now order discount free guaranteed deal', category: 'Spam' },
    { text: 'congratulations you won lottery prize claim', category: 'Spam' },
    { text: 'promotional newsletter marketing campaign offer', category: 'Spam' },
    { text: 'product update new feature release notes upgrade', category: 'Spam' },
    { text: 'subscription renew expire trial premium plan', category: 'Spam' },
    { text: 'exclusive deal coupon code save money limited', category: 'Spam' },
    { text: 'noreply notification automated message system', category: 'Spam' },
    { text: 'credit card loan insurance apply now pre approved', category: 'Spam' },
    { text: '50 percent off sale exclusive student discount code', category: 'Spam' },
    { text: 'advertisement sponsored content promoted brand', category: 'Spam' },
    { text: 'newsletter tech update blog digest weekly roundup', category: 'Spam' },
    { text: 'survey feedback rate us review customer satisfaction', category: 'Spam' },
    { text: 'happy festival greetings wish newsletter promotional', category: 'Spam' },
    { text: 'payment successful upi cashback reward recharge', category: 'Spam' },
    { text: 'your payment is successful amount received', category: 'Spam' },
    { text: 'you received famx account fampay money', category: 'Spam' },
    { text: 'food delivery order discount swiggy zomato', category: 'Spam' },
    { text: 'fashion sale clothing brand shopping discount', category: 'Spam' },
    { text: 'flight hotel booking travel deals discount', category: 'Spam' },
    { text: 'streaming subscription series movie watch recommendation', category: 'Spam' },
    { text: 'daily digest article recommendations newsletter', category: 'Spam' },
    { text: 'new post trending news digest notification', category: 'Spam' },
    { text: 'see open jobs job alert recommendation', category: 'Spam' },
    { text: 'produce spoiling solutions enclosed tips', category: 'Spam' },
    { text: 'many hats you wear canva create design', category: 'Spam' },
    { text: 'easy to get back on instagram social media', category: 'Spam' },
    { text: 'listen to your favorite music spotify playlist', category: 'Spam' },
    { text: 'indigo welcome benefits double enjoy credit card', category: 'Spam' },
];

// Initialize the classifier (fresh training only, never loads corrupted model)
function initializeClassifier() {
    if (isModelLoaded && classifier) return;

    // Always train a fresh classifier to avoid loading corrupted models
    classifier = new natural.BayesClassifier();
    for (const item of TRAINING_DATA) {
        classifier.addDocument(item.text, item.category);
    }
    classifier.train();
    isModelLoaded = true;
    console.log(`[ML Classifier] Trained fresh model with ${TRAINING_DATA.length} examples`);
}

// ─── Keyword scoring engine ───

function scoreEmail(email) {
    const from = (email.from || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();
    const snippet = (email.snippet || '').toLowerCase();
    const combined = `${subject} ${snippet}`;

    const scores = {};
    for (const category of CATEGORIES) {
        scores[category] = 0;
    }

    // Score each category based on keyword matches
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords.strong) {
            if (combined.includes(keyword)) {
                scores[category] += 3;
            }
        }
        for (const keyword of keywords.moderate) {
            if (combined.includes(keyword)) {
                scores[category] += 1;
            }
        }
    }

    // Sender-based scoring
    const isSpamSender = SPAM_SENDER_PATTERNS.some(p => from.includes(p));
    const isPersonalSender = PERSONAL_INTERACTION_SENDERS.some(p => from.includes(p));
    const isAcademicSender = ACADEMIC_SENDER_PATTERNS.some(p => from.includes(p));

    if (isSpamSender) {
        scores['Spam'] += 5;
    }
    if (isPersonalSender) {
        // Personal interaction senders get a Personal boost,
        // but their content keywords can still override
        scores['Personal'] += 2;
    }
    if (isAcademicSender) {
        scores['Academics'] += 3;
        scores['Events'] += 1; // academic senders can send event emails too
    }

    return scores;
}

// Determine the best category from scores
function getBestCategory(scores) {
    let bestCategory = 'Spam'; // default fallback
    let bestScore = -1;

    for (const [category, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    return { category: bestCategory, score: bestScore };
}

// Check if an email looks like a hackathon (strong keyword check)
function looksLikeHackathon(email) {
    const text = `${email.subject || ''} ${email.snippet || ''}`.toLowerCase();
    const hackathonKeywords = [
        'hackathon', 'hack-a-thon', 'coding challenge', 'code challenge',
        'hack', 'code fest', 'codefest', 'developer competition',
        'competitive programming', 'open source contribution',
        'startup pitch', 'devhack', 'innovation challenge',
        'technoverse hackathon', 'smart india hackathon'
    ];
    return hackathonKeywords.some(kw => text.includes(kw));
}

// Check if an email looks like an event (workshop, fest, registration, etc.)
function isLikelyEvent(email) {
    const subject = (email.subject || '').toLowerCase();
    const snippet = (email.snippet || '').toLowerCase();
    const combined = `${subject} ${snippet}`;
    const eventKeywords = [
        'fest', 'cultural', 'workshop', 'registration', 'event',
        'tournament', 'concert', 'performance', 'celebration', 'ceremony',
        'meetup', 'symposium', 'conference', 'seminar',
        'art workshop', 'acfa', 'folk arts', 'freshers', 'farewell',
        'candlelight march', 'remembrance', 'awards ceremony', 'gymkhana'
    ];
    return eventKeywords.some(kw => combined.includes(kw));
}

// LinkedIn-specific categorization
function classifyLinkedInEmail(email) {
    const subject = (email.subject || '').toLowerCase();
    const snippet = (email.snippet || '').toLowerCase();
    const combined = `${subject} ${snippet}`;

    // Personal interactions on LinkedIn
    const personalPatterns = [
        'accepted your invitation', 'wants to connect', 'want to connect',
        'i want to connect', 'explore their network', 'profile views',
        'viewed your profile', 'endorsed you', 'new invitation',
        'reacted to', 'commented on', 'mentioned you',
        'member reacted', 'congratulations on'
    ];
    if (personalPatterns.some(p => combined.includes(p))) {
        return 'Personal';
    }

    // LinkedIn promotional / notification content
    const spamPatterns = [
        'new post for you', 'trending', 'job alert',
        'job recommendation', 'celebrating national', 'see open jobs',
        'daily digest', 'weekly digest', 'newsletter'
    ];
    if (spamPatterns.some(p => combined.includes(p))) {
        return 'Spam';
    }

    return 'Personal'; // Default LinkedIn to personal
}

// Classify a single email using the hybrid approach
export async function classifyEmail(email) {
    initializeClassifier();

    const from = (email.from || '').toLowerCase();

    // Step 1: Check user overrides FIRST (highest priority)
    const userOverride = getUserOverride(email.from);
    if (userOverride) {
        console.log(`[ML Classifier] User override: "${email.subject}" → ${userOverride}`);
        return userOverride;
    }

    // Step 2: Special-case LinkedIn emails (complex sender)
    if (from.includes('linkedin')) {
        const category = classifyLinkedInEmail(email);
        console.log(`[ML Classifier] LinkedIn special: "${email.subject}" → ${category}`);
        return category;
    }

    // Step 3: Keyword scoring
    const scores = scoreEmail(email);
    const { category: keywordCategory, score: keywordScore } = getBestCategory(scores);

    // Step 4: Naive Bayes as secondary signal
    const text = `${from} ${(email.subject || '').toLowerCase()} ${(email.snippet || '').toLowerCase()}`;
    const bayesCategory = classifier.classify(text);

    // Step 5: Determine final category
    let category;

    if (keywordScore >= 3) {
        // Strong keyword match — trust keyword scoring
        category = keywordCategory;
    } else if (keywordScore > 0 && keywordCategory === bayesCategory) {
        // Keywords and Bayes agree — high confidence
        category = keywordCategory;
    } else if (keywordScore > 0) {
        // Keywords found but Bayes disagrees — trust keywords
        category = keywordCategory;
    } else {
        // No keyword matches — use Bayes but apply safety guards
        category = bayesCategory;
    }

    // Step 6: Safety guard — Hackathons must have hackathon keywords
    if (category === 'Hackathons' && !looksLikeHackathon(email)) {
        category = isLikelyEvent(email) ? 'Events' : 'Academics';
        console.log(`[ML Classifier] Guard: "${email.subject}" lacks hackathon keywords → ${category}`);
    }

    // Step 7: Safety guard — known spam senders override to Spam
    // (unless user override already handled it)
    const isSpamSender = SPAM_SENDER_PATTERNS.some(p => from.includes(p));
    if (isSpamSender && category !== 'Spam') {
        // Only force to Spam if content doesn't clearly indicate another category
        if (keywordScore < 3 || keywordCategory === 'Spam') {
            console.log(`[ML Classifier] Guard: "${email.subject}" from promo sender → Spam (was ${category})`);
            category = 'Spam';
        }
    }

    // Step 8: Safety guard — academic senders shouldn't be Personal or Spam
    const isAcadSender = ACADEMIC_SENDER_PATTERNS.some(p => from.includes(p));
    if (isAcadSender && (category === 'Personal' || category === 'Spam')) {
        const newCat = isLikelyEvent(email) ? 'Events' : 'Academics';
        console.log(`[ML Classifier] Guard: "${email.subject}" from academic sender → ${newCat} (was ${category})`);
        category = newCat;
    }

    console.log(`[ML Classifier] "${email.subject}" → ${category} (keyword: ${keywordCategory}=${keywordScore}, bayes: ${bayesCategory})`);
    return category;
}

// Extract a future/event date from text using regex
function extractEventDate(text, emailDateStr) {
    const lowerText = text.toLowerCase();
    const emailDate = emailDateStr ? new Date(emailDateStr) : new Date();

    // 1. DD Month YYYY (e.g. 24th march 2026)
    const regex1 = /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})/i;
    const match1 = lowerText.match(regex1);
    if (match1) {
        const d = new Date(`${match1[1]} ${match1[2]} ${match1[3]}`);
        if (!isNaN(d)) return d.toISOString();
    }

    // 2. Month DD YYYY (e.g. March 24th, 2026)
    const regex2 = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})/i;
    const match2 = lowerText.match(regex2);
    if (match2) {
        const d = new Date(`${match2[2]} ${match2[1]} ${match2[3]}`);
        if (!isNaN(d)) return d.toISOString();
    }

    // 3. DD Month (e.g. 24th march)
    const regex3 = /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)/i;
    const match3 = lowerText.match(regex3);
    if (match3) {
        const currentYear = emailDate.getFullYear();
        let d = new Date(`${match3[1]} ${match3[2]} ${currentYear}`);
        if (!isNaN(d)) {
            if (d < emailDate && emailDate.getMonth() > 9 && d.getMonth() < 3) {
                d.setFullYear(currentYear + 1);
            }
            return d.toISOString();
        }
    }

    // 4. Month DD
    const regex4 = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/i;
    const match4 = lowerText.match(regex4);
    if (match4) {
        const currentYear = emailDate.getFullYear();
        let d = new Date(`${match4[2]} ${match4[1]} ${currentYear}`);
        if (!isNaN(d)) {
            if (d < emailDate && emailDate.getMonth() > 9 && d.getMonth() < 3) {
                d.setFullYear(currentYear + 1);
            }
            return d.toISOString();
        }
    }

    // 5. MM/DD/YYYY or DD/MM/YYYY
    const regex5 = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
    const match5 = lowerText.match(regex5);
    if (match5) {
        let m = match5[1];
        let day = match5[2];
        let y = match5[3];
        if (y.length === 2) y = '20' + y;

        let d1 = new Date(`${m}/${day}/${y}`);
        let d2 = new Date(`${day}/${m}/${y}`);

        let best = null;
        if (!isNaN(d1) && d1 >= emailDate) best = d1;
        else if (!isNaN(d2) && d2 >= emailDate) best = d2;
        else if (!isNaN(d1)) best = d1;

        if (best) return best.toISOString();
    }

    // Fallback
    return emailDate.toISOString();
}

// Classify multiple emails
export async function classifyEmails(emails) {
    initializeClassifier();
    console.log(`[ML Classifier] Classifying ${emails.length} emails...`);

    const classified = [];
    for (const email of emails) {
        const category = await classifyEmail(email);

        // Extract event date from content
        let eventDate = email.date ? new Date(email.date).toISOString() : new Date().toISOString();
        if (category !== 'Spam') {
            const contentText = `${email.subject || ''} ${email.snippet || ''} ${email.body || ''}`.substring(0, 1000);
            eventDate = extractEventDate(contentText, email.date);
        }

        classified.push({ ...email, category, eventDate });
    }

    // Log summary
    const summary = {};
    for (const email of classified) {
        summary[email.category] = (summary[email.category] || 0) + 1;
    }
    console.log('[ML Classifier] Summary:', summary);

    return classified;
}

// Learn from user correction — this is the key ML feedback loop
export function learnFromCorrection(email, correctCategory) {
    initializeClassifier();

    if (!CATEGORIES.includes(correctCategory)) {
        throw new Error(`Invalid category: ${correctCategory}`);
    }

    const text = `${(email.from || '').toLowerCase()} ${(email.subject || '').toLowerCase()} ${(email.snippet || '').toLowerCase()}`;

    // Add the correction as training data and retrain
    classifier.addDocument(text, correctCategory);
    classifier.train();

    // Save sender-level override so it persists across reloads
    const senderKey = getSenderKey(email.from);
    if (senderKey && senderKey.length >= 3) {
        userOverrides[senderKey] = correctCategory;
        saveUserOverrides();
        console.log(`[ML Classifier] Saved sender override: "${senderKey}" → ${correctCategory}`);
    }

    console.log(`[ML Classifier] Learned: "${email.subject}" should be ${correctCategory}`);
    return true;
}

// Get classification with confidence scores for all categories
export function getClassificationScores(email) {
    initializeClassifier();

    // Return keyword scores as confidence
    const scores = scoreEmail(email);
    const total = Object.values(scores).reduce((a, b) => a + b, 1); // +1 to avoid division by zero

    return CATEGORIES.map(category => ({
        category,
        confidence: scores[category] / total
    }));
}
