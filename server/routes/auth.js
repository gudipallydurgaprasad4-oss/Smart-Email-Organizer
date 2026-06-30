import express from 'express';
import { getAuthUrl, getTokens, setCredentials, getUserInfo } from '../config/oauth.js';

const router = express.Router();

router.get('/google', (req, res) => {
    const authUrl = getAuthUrl();
    res.json({ url: authUrl });
});

router.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=no_code`);
    }

    try {
        const tokens = await getTokens(code);
        const auth = setCredentials(tokens);
        const userInfo = await getUserInfo(auth);

        req.session.tokens = tokens;
        req.session.user = {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
        };

        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard`);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`);
    }
});

router.get('/user', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user, isAuthenticated: true });
    } else {
        res.json({ user: null, isAuthenticated: false });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true });
    });
});

export default router;
