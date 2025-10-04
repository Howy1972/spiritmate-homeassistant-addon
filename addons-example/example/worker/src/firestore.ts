import { Firestore, FieldValue } from '@google-cloud/firestore';
import { WorkerConfig, ParsedInvoice, ProductStockDocWithItemId, ProductMovementDoc, MyobProcessedInvoiceDoc, SyncRunDoc, StockUpdateOperation, ProcessingResult } from './types';

export class FirestoreClient {
  private db: Firestore;

  constructor(config: WorkerConfig) {
    this.db = new Firestore({ projectId: config.firestore.projectId, keyFilename: config.firestore.credentialsPath });
  }

  async testConnection(): Promise<boolean> {
    try { await this.db.collection('productStocks').limit(1).get(); return true; } catch { return false; }
  }

  async createSyncRun(): Promise<string> {
    const run: SyncRunDoc = { startedAt: FieldValue.serverTimestamp() as any, emailsScanned: 0, invoicesProcessed: 0, productsUpdated: 0, failures: [], status: 'running' };
    const ref = await this.db.collection('sync_runs').add(run as any);
    return ref.id;
  }

  async updateSyncRun(runId: string, emailsScanned: number, invoicesProcessed: number, productsUpdated: number, failures: Array<{ type: string; message: string; details?: Record<string, unknown> }>, status: 'completed' | 'failed'): Promise<void> {
    await this.db.collection('sync_runs').doc(runId).update({ completedAt: FieldValue.serverTimestamp(), emailsScanned, invoicesProcessed, productsUpdated, failures, status } as any);
  }

  async isInvoiceProcessed(invoiceNumber: string): Promise<boolean> {
    const doc = await this.db.collection('myob_processed_invoices').doc(invoiceNumber).get();
    return doc.exists;
  }

  async findProduct(itemId: string, description: string): Promise<{ id: string; data: ProductStockDocWithItemId } | null> {
    const snap = await this.db.collection('productStocks').get();
    for (const doc of snap.docs) {
      const data = doc.data() as ProductStockDocWithItemId;
      if (data.deleted === true) continue;
      if (data.myobMappings && Array.isArray(data.myobMappings)) {
        if (data.myobMappings.some(m => m.itemId === itemId || m.description === description)) return { id: doc.id, data };
      }
      if (data.myobItemId) {
        const ids = data.myobItemId.split(',').map(x => x.trim());
        if (ids.includes(itemId)) return { id: doc.id, data };
      }
      if (data.myobDescription) {
        const descs = data.myobDescription.split(',').map(x => x.trim());
        if (descs.includes(description)) return { id: doc.id, data };
      }
      if (data.productName === description) return { id: doc.id, data };
    }
    return null;
  }

  async processInvoice(invoice: ParsedInvoice, emailUid: number): Promise<ProcessingResult> {
    const result: ProcessingResult = { success: false, invoiceNumber: invoice.invoiceNumber, itemsProcessed: 0, productsUpdated: 0, errors: [], stockUpdates: [] };

    if (await this.isInvoiceProcessed(invoice.invoiceNumber)) { result.success = true; return result; }

    const batch = this.db.batch();
    const stockUpdates: StockUpdateOperation[] = [];
    const updatedProductIds: string[] = [];
    const productUpdates = new Map<string, { product: { id: string; data: ProductStockDocWithItemId }; totalQtyChange: number; myobItems: Array<{ itemId: string; description: string; qty: number }>; }>();

    for (const item of invoice.items) {
      const product = await this.findProduct(item.itemId, item.description);
      if (!product) { result.errors.push(`Product not found for ${item.itemId}/${item.description}`); continue; }
      const qtyChange = invoice.isCreditNote ? item.qty : -item.qty;
      if (productUpdates.has(product.id)) {
        const existing = productUpdates.get(product.id)!;
        existing.totalQtyChange += qtyChange;
        existing.myobItems.push({ itemId: item.itemId, description: item.description, qty: item.qty });
      } else {
        productUpdates.set(product.id, { product, totalQtyChange: qtyChange, myobItems: [{ itemId: item.itemId, description: item.description, qty: item.qty }] });
      }
      result.itemsProcessed++;
    }

    const productDetails: Array<{ productId: string; productName: string; brandName: string; myobItems: Array<{ itemId: string; description: string; qty: number }>; stockBefore: number; stockAfter: number; totalQtyChange: number; }> = [];

    for (const [productId, info] of productUpdates) {
      const currentStock = info.product.data.onHand || 0;
      const newStock = Math.max(0, currentStock + info.totalQtyChange);
      const productRef = this.db.collection('productStocks').doc(productId);
      batch.update(productRef, { onHand: newStock, lastMovementAt: FieldValue.serverTimestamp() } as any);

      const movement: ProductMovementDoc = { stockId: productId, type: 'myob-sync', qty: Math.abs(info.totalQtyChange), note: `MYOB ${invoice.isCreditNote ? 'Credit Note' : 'Invoice'} ${invoice.invoiceNumber}`, createdAt: FieldValue.serverTimestamp() as any };
      const movementRef = this.db.collection('productMovements').doc();
      batch.set(movementRef, movement as any);

      productDetails.push({ productId, productName: info.product.data.productName || 'Unknown', brandName: info.product.data.brandName || '', myobItems: info.myobItems, stockBefore: currentStock, stockAfter: newStock, totalQtyChange: info.totalQtyChange });
      stockUpdates.push({ productId, itemId: info.myobItems.map(m => m.itemId).join(','), description: info.myobItems.map(m => m.description).join(', '), qtyChange: info.totalQtyChange, currentStock, newStock });
      updatedProductIds.push(productId);
    }

    if (updatedProductIds.length > 0) {
      const docRef = this.db.collection('myob_processed_invoices').doc(invoice.invoiceNumber);
      const data: MyobProcessedInvoiceDoc = { invoiceNumber: invoice.invoiceNumber, processedAt: FieldValue.serverTimestamp() as any, emailUid, itemsProcessed: result.itemsProcessed, productsUpdated: updatedProductIds, isCreditNote: invoice.isCreditNote, totalQtyProcessed: stockUpdates.reduce((s, u) => s + Math.abs(u.qtyChange), 0), productDetails, success: true };
      batch.set(docRef, data as any);
    }

    await batch.commit();

    result.success = true;
    result.productsUpdated = updatedProductIds.length;
    result.stockUpdates = stockUpdates;
    return result;
  }
}


