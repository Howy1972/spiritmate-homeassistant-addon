import * as dotenv from 'dotenv';
import { WorkerConfig } from './types';
import { EmailClient } from './email';
import { FirestoreClient } from './firestore';
import { parsePdfInvoice } from './pdf';

dotenv.config();

function loadConfig(): WorkerConfig {
  const requiredEnvVars = [
    'IMAP_HOST',
    'IMAP_PORT',
    'IMAP_USER',
    'IMAP_PASS',
    'FROM_EXACT',
    'SUBJECT_PREFIX',
    'FIRESTORE_PROJECT_ID'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Use hardcoded path for credentials (always at /app/service-account.json in container)
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/app/service-account.json';

  return {
    imap: {
      host: process.env.IMAP_HOST!,
      port: parseInt(process.env.IMAP_PORT!, 10),
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASS!,
      mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    },
    email: {
      fromExact: process.env.FROM_EXACT!,
      subjectPrefix: process.env.SUBJECT_PREFIX!,
      labelProcessed: process.env.LABEL_PROCESSED,
    },
    firestore: {
      projectId: process.env.FIRESTORE_PROJECT_ID!,
      credentialsPath: credentialsPath,
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
  };
}

export async function runWorker(): Promise<{ emails: number; invoices: number; products: number; failures: number; runId?: string }> {
  const startTime = new Date();
  console.log(`MYOB Sync Worker started at ${startTime.toISOString()}`);

  let config!: WorkerConfig;
  let emailClient: EmailClient | undefined;
  let firestoreClient: FirestoreClient | undefined;
  let syncRunId: string | undefined;

  try {
    config = loadConfig();
    emailClient = new EmailClient(config);
    firestoreClient = new FirestoreClient(config);

    const firestoreOk = await firestoreClient.testConnection();
    if (!firestoreOk) throw new Error('Firestore connection test failed');

    syncRunId = await firestoreClient.createSyncRun();

    await emailClient.connect();

    const emails = await emailClient.findInvoiceEmails();
    if (emails.length === 0) {
      await firestoreClient.updateSyncRun(syncRunId, 0, 0, 0, [], 'completed');
      return { emails: 0, invoices: 0, products: 0, failures: 0, runId: syncRunId };
    }

    let totalInvoicesProcessed = 0;
    let totalProductsUpdated = 0;
    const failures: Array<{ type: string; message: string; details?: Record<string, unknown> }> = [];

    for (const email of emails) {
      try {
        for (const attachment of email.attachments) {
          try {
            const invoice = await parsePdfInvoice(attachment.content);
            if (!invoice) {
              failures.push({ type: 'pdf', message: `Failed to parse PDF: ${attachment.filename}` });
              continue;
            }

            const result = await firestoreClient.processInvoice(invoice, email.uid);
            if (result.success) {
              totalInvoicesProcessed++;
              totalProductsUpdated += result.productsUpdated;
              await emailClient.markAsSeen(email.uid);
              if (config.email.labelProcessed) await emailClient.moveToProcessedFolder(email.uid);
            } else {
              failures.push({ type: 'firestore', message: `Failed invoice ${invoice.invoiceNumber}: ${result.errors.join(', ')}` });
            }
          } catch (err) {
            failures.push({ type: 'parsing', message: String(err) });
          }
        }
      } catch (err) {
        failures.push({ type: 'email', message: String(err) });
      }
    }

    await firestoreClient.updateSyncRun(
      syncRunId,
      emails.length,
      totalInvoicesProcessed,
      totalProductsUpdated,
      failures,
      'completed'
    );

    console.log('Worker completed');
    if (failures.length > 0) {
      console.error(`Worker completed with ${failures.length} failure(s):`);
      failures.forEach((f, i) => console.error(`  [${i+1}] ${f.type}: ${f.message}`, f.details || ''));
    }
    return { emails: emails.length, invoices: totalInvoicesProcessed, products: totalProductsUpdated, failures: failures.length, runId: syncRunId };

  } catch (error) {
    console.error('Worker failed:', error);
    if (syncRunId && firestoreClient) {
      try {
        await firestoreClient.updateSyncRun(syncRunId, 0, 0, 0, [ { type: 'system', message: String(error) } ], 'failed');
      } catch {}
    }
    throw error;
  } finally {
    if (emailClient) await emailClient.disconnect();
  }
}

if (require.main === module) {
  runWorker().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}


