import { google } from 'googleapis';
import { oauth2Client } from '../config/oauth.js';

// Store attachment metadata cache to avoid re-fetching message for each attachment
const attachmentMetadataCache = new Map();

export async function fetchEmails(tokens, maxResults = 50) {
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get date 7 days ago in Gmail query format (YYYY/MM/DD)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const dateQuery = `${oneWeekAgo.getFullYear()}/${String(oneWeekAgo.getMonth() + 1).padStart(2, '0')}/${String(oneWeekAgo.getDate()).padStart(2, '0')}`;

    const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: `in:inbox after:${dateQuery}`
    });

    const messages = response.data.messages || [];

    // Process up to 50 emails from past 3 days concurrently
    const emailPromises = messages.slice(0, 50).map(async (msg) => {
        try {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });

            const parsed = parseMessage(detail.data);

            // Cache attachment metadata for this message
            if (parsed.attachments && parsed.attachments.length > 0) {
                for (const att of parsed.attachments) {
                    const cacheKey = `${msg.id}:${att.attachmentId}`;
                    attachmentMetadataCache.set(cacheKey, {
                        filename: att.filename,
                        mimeType: att.mimeType,
                        size: att.size
                    });
                }
            }

            return {
                id: msg.id,
                ...parsed
            };
        } catch (error) {
            console.error(`Failed to fetch message ${msg.id}`, error);
            return null; // Return null so we can filter failed requests later
        }
    });

    const results = await Promise.all(emailPromises);
    const emails = results.filter(Boolean); // removes nulls

    return emails;
}

export async function getAttachment(tokens, messageId, attachmentId) {
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: messageId,
        id: attachmentId
    });

    return response.data;
}

export async function getAttachmentMetadata(tokens, messageId, attachmentId) {
    // Check cache first
    const cacheKey = `${messageId}:${attachmentId}`;
    if (attachmentMetadataCache.has(cacheKey)) {
        return attachmentMetadataCache.get(cacheKey);
    }

    // If not in cache, fetch the message and find the attachment
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
        const detail = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });

        // Search for the attachment in the message parts
        function findAttachment(part) {
            if (part.body && part.body.attachmentId === attachmentId) {
                return {
                    filename: part.filename || 'attachment',
                    mimeType: part.mimeType || 'application/octet-stream',
                    size: part.body.size
                };
            }
            if (part.parts) {
                for (const subPart of part.parts) {
                    const found = findAttachment(subPart);
                    if (found) return found;
                }
            }
            return null;
        }

        const metadata = findAttachment(detail.data.payload);
        if (metadata) {
            attachmentMetadataCache.set(cacheKey, metadata);
            return metadata;
        }
    } catch (error) {
        console.error('Error fetching attachment metadata:', error);
    }

    return null;
}

function parseMessage(message) {
    const headers = message.payload.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const customSubject = getHeader('Subject');
    const from = getHeader('From');
    const date = getHeader('Date');

    let body = '';
    let attachments = [];
    let inlineImages = {}; // Map of Content-ID to attachment info

    // Helper to get part headers
    function getPartHeader(part, name) {
        const partHeaders = part.headers || [];
        return partHeaders.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    }

    // Recursive function to traverse mime parts
    function traverse(part) {
        if (part.mimeType === 'text/html' && part.body && part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/plain' && !body && part.body && part.body.data) {
            // Fallback to text/plain if no html found yet
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }

        // Check for attachments and inline images
        if (part.body && part.body.attachmentId) {
            const contentId = getPartHeader(part, 'Content-ID');
            const contentDisposition = getPartHeader(part, 'Content-Disposition');

            // Clean Content-ID (remove angle brackets)
            const cleanCid = contentId.replace(/[<>]/g, '');

            if (part.filename || cleanCid) {
                const attachmentInfo = {
                    filename: part.filename || `inline-${cleanCid}`,
                    mimeType: part.mimeType,
                    attachmentId: part.body.attachmentId,
                    size: part.body.size,
                    contentId: cleanCid
                };

                // If it's an inline image (has Content-ID), add to inlineImages map
                if (cleanCid && part.mimeType?.startsWith('image/')) {
                    inlineImages[cleanCid] = attachmentInfo;
                }

                // Add to attachments if it has a filename (actual attachment)
                if (part.filename) {
                    attachments.push(attachmentInfo);
                }
            }
        }

        if (part.parts) {
            part.parts.forEach(traverse);
        }
    }

    traverse(message.payload);

    // Replace cid: references in HTML body with actual API URLs
    if (body && Object.keys(inlineImages).length > 0) {
        for (const [cid, imgInfo] of Object.entries(inlineImages)) {
            // Replace both cid:xxx and cid:xxx formats
            const cidPattern = new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
            body = body.replace(cidPattern, `/api/emails/${message.id}/attachments/${imgInfo.attachmentId}`);
        }
    }

    return {
        id: message.id,
        threadId: message.threadId,
        snippet: message.snippet,
        subject: customSubject,
        from,
        date,
        body: body || message.snippet, // Fallback to snippet if no body found
        attachments,
        inlineImages: Object.keys(inlineImages).length > 0 ? inlineImages : undefined
    };
}


