"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailClient = void 0;
const imapflow_1 = require("imapflow");
class EmailClient {
    constructor(config) {
        this.config = config;
        this.client = new imapflow_1.ImapFlow({
            host: config.imap.host,
            port: config.imap.port,
            secure: true,
            auth: { user: config.imap.user, pass: config.imap.pass },
            logger: false,
        });
    }
    async connect() {
        await this.client.connect();
    }
    async disconnect() {
        if (this.client.usable)
            await this.client.logout();
    }
    async findInvoiceEmails() {
        const lock = await this.client.getMailboxLock(this.config.imap.mailbox);
        try {
            const searchCriteria = {
                unseen: true,
                from: this.config.email.fromExact,
                subject: this.config.email.subjectPrefix,
            };
            const uids = await this.client.search(searchCriteria);
            const results = [];
            if (uids === false || uids.length === 0)
                return results;
            for (const uid of uids) {
                const message = await this.client.fetchOne(uid, { envelope: true, bodyStructure: true });
                if (message === false)
                    continue;
                if (!message.envelope)
                    continue;
                const fromAddress = message.envelope.from?.[0]?.address?.toLowerCase() || '';
                if (fromAddress !== this.config.email.fromExact.toLowerCase())
                    continue;
                if (!message.envelope.subject?.startsWith(this.config.email.subjectPrefix))
                    continue;
                const attachments = await this.downloadAttachments(uid);
                const pdfAttachments = attachments.filter(a => a.contentType.toLowerCase().includes('pdf') || a.filename.toLowerCase().endsWith('.pdf'));
                if (pdfAttachments.length === 0)
                    continue;
                results.push({
                    uid,
                    subject: message.envelope.subject || '',
                    from: fromAddress,
                    date: message.envelope.date || new Date(),
                    attachments: pdfAttachments,
                });
            }
            return results;
        }
        finally {
            lock.release();
        }
    }
    async downloadAttachments(uid) {
        const message = await this.client.fetchOne(uid, { bodyStructure: true, source: true });
        const attachments = [];
        if (message !== false && message?.bodyStructure?.childNodes) {
            for (const part of message.bodyStructure.childNodes) {
                if (part.disposition === 'attachment' && part.dispositionParameters?.filename) {
                    const dl = await this.client.download(uid, part.part);
                    let buffer;
                    if (Buffer.isBuffer(dl))
                        buffer = dl;
                    else if (dl?.content) {
                        const chunks = [];
                        await new Promise((resolve, reject) => {
                            dl.content.on('data', (ch) => chunks.push(ch));
                            dl.content.on('end', () => resolve());
                            dl.content.on('error', (e) => reject(e));
                            dl.content.resume();
                        });
                        buffer = Buffer.concat(chunks);
                    }
                    else
                        buffer = Buffer.from([]);
                    attachments.push({
                        filename: part.dispositionParameters.filename,
                        content: buffer,
                        contentType: `${part.type}/${part.subtype || 'octet-stream'}`,
                    });
                }
            }
        }
        return attachments;
    }
    async markAsSeen(uid) {
        const lock = await this.client.getMailboxLock(this.config.imap.mailbox);
        try {
            await this.client.messageFlagsAdd(uid, ['\\Seen']);
        }
        finally {
            lock.release();
        }
    }
    async moveToProcessedFolder(uid) {
        if (!this.config.email.labelProcessed)
            return;
        const lock = await this.client.getMailboxLock(this.config.imap.mailbox);
        try {
            await this.ensureProcessedFolderExists();
            await this.client.messageCopy(uid, this.config.email.labelProcessed);
        }
        finally {
            lock.release();
        }
    }
    async ensureProcessedFolderExists() {
        if (!this.config.email.labelProcessed)
            return;
        const list = await this.client.list();
        if (!list.some((m) => m.name === this.config.email.labelProcessed)) {
            await this.client.mailboxCreate(this.config.email.labelProcessed);
        }
    }
}
exports.EmailClient = EmailClient;
