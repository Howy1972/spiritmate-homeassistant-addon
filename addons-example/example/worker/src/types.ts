import { Timestamp, FieldValue } from '@google-cloud/firestore';

export interface WorkerConfig {
  imap: { host: string; port: number; user: string; pass: string; mailbox: string; };
  email: { fromExact: string; subjectPrefix: string; labelProcessed?: string; };
  firestore: { projectId: string; credentialsPath: string; };
  logging: { level: string; };
}

export interface ParsedInvoiceItem { itemId: string; description: string; qty: number; unitPrice?: number; }
export interface ParsedInvoice { invoiceNumber: string; isCreditNote: boolean; items: ParsedInvoiceItem[]; }

export interface EmailAttachment { filename: string; content: Buffer; contentType: string; }
export interface EmailMessage { uid: number; subject: string; from: string; date: Date; attachments: EmailAttachment[]; }

export interface ProductStockDoc {  productName: string; brandName: string; productType: string; sizeMl: number; category?: string; onHand: number; samples?: number; batch?: string; myobItemId?: string; myobDescription?: string; myobMappings?: Array<{ itemId: string; description: string }>; imageUrl?: string; lastMovementAt?: Timestamp | FieldValue; createdAt: Timestamp | FieldValue; deleted?: boolean; deletedAt?: Timestamp | FieldValue; deletedBy?: string; }
export type ProductStockDocWithItemId = ProductStockDoc;

export interface ProductMovementDoc { stockId: string; type: 'in' | 'out' | 'stocktake' | 'sample' | 'myob-sync'; qty: number; note?: string; createdAt: Timestamp | FieldValue; }

export interface MyobProcessedInvoiceDoc { invoiceNumber: string; processedAt: Timestamp | FieldValue; emailUid: number; itemsProcessed: number; productsUpdated: string[]; isCreditNote: boolean; totalQtyProcessed: number; productDetails?: Array<{ productId: string; productName: string; brandName: string; myobItems: Array<{ itemId: string; description: string; qty: number }>; stockBefore: number; stockAfter: number; totalQtyChange: number; }>; success: boolean; }

export interface SyncRunDoc { startedAt: Timestamp | FieldValue; completedAt?: Timestamp | FieldValue; emailsScanned: number; invoicesProcessed: number; productsUpdated: number; failures: Array<{ type: 'email' | 'pdf' | 'parsing' | 'firestore'; message: string; details?: Record<string, unknown>; }>; status: 'running' | 'completed' | 'failed'; }

export interface StockUpdateOperation { productId: string; itemId: string; description: string; qtyChange: number; currentStock: number; newStock: number; }
export interface ProcessingResult { success: boolean; invoiceNumber: string; itemsProcessed: number; productsUpdated: number; errors: string[]; stockUpdates: StockUpdateOperation[]; }


