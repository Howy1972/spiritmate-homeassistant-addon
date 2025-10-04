import { ImapFlow } from 'imapflow';
import { WorkerConfig, EmailMessage, EmailAttachment } from './types';

export class EmailClient {
  private client: ImapFlow;
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.client = new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: true,
      auth: { user: config.imap.user, pass: config.imap.pass },
      logger: false,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client.usable) await this.client.logout();
  }

  async findInvoiceEmails(): Promise<EmailMessage[]> {
    const lock = await this.client.getMailboxLock(this.config.imap.mailbox);
    try {
      const searchCriteria = {
        unseen: true,
        from: this.config.email.fromExact,
        subject: this.config.email.subjectPrefix,
      } as any;

      const uids = await this.client.search(searchCriteria);
      const results: EmailMessage[] = [];
      if (!uids || uids === false) return results;

      for (const uid of uids) {
        const message = await this.client.fetchOne(uid, { envelope: true, bodyStructure: true });
        if (!message?.envelope) continue;

        const fromAddress = message.envelope.from?.[0]?.address?.toLowerCase() || '';
        if (fromAddress !== this.config.email.fromExact.toLowerCase()) continue;
        if (!message.envelope.subject?.startsWith(this.config.email.subjectPrefix)) continue;

        const attachments = await this.downloadAttachments(uid);
        const pdfAttachments = attachments.filter(a => a.contentType.toLowerCase().includes('pdf') || a.filename.toLowerCase().endsWith('.pdf'));
        if (pdfAttachments.length === 0) continue;

        results.push({
          uid,
          subject: message.envelope.subject || '',
          from: fromAddress,
          date: message.envelope.date || new Date(),
          attachments: pdfAttachments,
        });
      }

      return results;
    } finally {
      lock.release();
    }
  }

  private async downloadAttachments(uid: number): Promise<EmailAttachment[]> {
    const message = await this.client.fetchOne(uid, { bodyStructure: true, source: true } as any);
    const attachments: EmailAttachment[] = [];

    if (message?.bodyStructure?.childNodes) {
      for (const part of message.bodyStructure.childNodes) {
        if (part.disposition === 'attachment' && part.dispositionParameters?.filename) {
          const dl: any = await this.client.download(uid, part.part);
          let buffer: Buffer;
          if (Buffer.isBuffer(dl)) buffer = dl as Buffer;
          else if (dl?.content) {
            const chunks: Buffer[] = [];
            await new Promise<void>((resolve, reject) => {
              dl.content.on('data', (ch: Buffer) => chunks.push(ch));
              dl.content.on('end', () => resolve());
              dl.content.on('error', (e: Error) => reject(e));
              dl.content.resume();
            });
            buffer = Buffer.concat(chunks);
          } else buffer = Buffer.from([]);

          attachments.push({
            filename: part.dispositionParameters.filename,
            content: buffer,
            contentType: `${part.type}/${(part as { subtype?: string }).subtype || 'octet-stream'}`,
          });
        }
      }
    }

    return attachments;
  }

  async markAsSeen(uid: number): Promise<void> {
    const lock = await this.client.getMailboxLock(this.config.imap.mailbox);
    try {
      await this.client.messageFlagsAdd(uid, ['\\Seen']);
    } finally {
      lock.release();
    }
  }

  async moveToProcessedFolder(uid: number): Promise<void> {
    if (!this.config.email.labelProcessed) return;
    const lock = await this.client.getMailboxLock(this.config.imap.mailbox);
    try {
      await this.ensureProcessedFolderExists();
      await this.client.messageCopy(uid, this.config.email.labelProcessed);
    } finally {
      lock.release();
    }
  }

  private async ensureProcessedFolderExists(): Promise<void> {
    if (!this.config.email.labelProcessed) return;
    const list = await this.client.list();
    if (!list.some((m: any) => m.name === this.config.email.labelProcessed)) {
      await this.client.mailboxCreate(this.config.email.labelProcessed);
    }
  }
}


