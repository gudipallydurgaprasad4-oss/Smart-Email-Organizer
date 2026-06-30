import express from 'express';
import { fetchEmails } from '../services/gmailService.js';
import { classifyEmails, learnFromCorrection } from '../services/classifierService.js';

const router = express.Router();

router.get('/emails', async (req, res) => {
    if (!req.session.tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const emails = await fetchEmails(req.session.tokens);
        const classified = await classifyEmails(emails);

        const grouped = classified.reduce((acc, email) => {
            if (!acc[email.category]) acc[email.category] = [];
            acc[email.category].push(email);
            return acc;
        }, {});

        res.json({ emails: classified, grouped });
    } catch (error) {
        console.error('Email fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

router.get('/emails/:category', async (req, res) => {
    if (!req.session.tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const emails = await fetchEmails(req.session.tokens);
        const classified = await classifyEmails(emails);
        const filtered = classified.filter(e => e.category === req.params.category);
        res.json({ emails: filtered });
    } catch (error) {
        console.error('Email fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

router.get('/emails/:messageId/attachments/:attachmentId', async (req, res) => {
    if (!req.session.tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { messageId, attachmentId } = req.params;
        const { getAttachment, getAttachmentMetadata } = await import('../services/gmailService.js');

        // Get attachment data
        const attachment = await getAttachment(req.session.tokens, messageId, attachmentId);
        const data = Buffer.from(attachment.data, 'base64');

        // Try to get metadata for proper content-type
        let contentType = 'application/octet-stream';
        let filename = 'attachment';

        try {
            const metadata = await getAttachmentMetadata(req.session.tokens, messageId, attachmentId);
            if (metadata) {
                contentType = metadata.mimeType || contentType;
                filename = metadata.filename || filename;
            }
        } catch (metaError) {
            // If we can't get metadata, try to guess from attachmentId or use default
            console.log('Could not get attachment metadata, using defaults');
        }

        // Set appropriate headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', data.length);

        // For images, allow inline display; for others, suggest download
        if (contentType.startsWith('image/')) {
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        } else {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }

        res.end(data);
    } catch (error) {
        console.error('Attachment fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch attachment' });
    }
});

// Re-categorize endpoint — teaches the ML model
router.post('/emails/:id/recategorize', async (req, res) => {
    if (!req.session.tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { category, email } = req.body;
        if (!category || !email) {
            return res.status(400).json({ error: 'Category and email data required' });
        }

        learnFromCorrection(email, category);
        res.json({ success: true, newCategory: category });
    } catch (error) {
        console.error('Recategorize error:', error);
        res.status(500).json({ error: error.message || 'Failed to recategorize' });
    }
});

export default router;
