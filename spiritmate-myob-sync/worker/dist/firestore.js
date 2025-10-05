"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreClient = void 0;
const firestore_1 = require("@google-cloud/firestore");
class FirestoreClient {
    constructor(config) {
        this.db = new firestore_1.Firestore({ projectId: config.firestore.projectId, keyFilename: config.firestore.credentialsPath });
    }
    async testConnection() {
        try {
            await this.db.collection('productStocks').limit(1).get();
            return true;
        }
        catch {
            return false;
        }
    }
    async createSyncRun() {
        const run = { startedAt: firestore_1.FieldValue.serverTimestamp(), emailsScanned: 0, invoicesProcessed: 0, productsUpdated: 0, failures: [], status: 'running' };
        const ref = await this.db.collection('sync_runs').add(run);
        return ref.id;
    }
    async updateSyncRun(runId, emailsScanned, invoicesProcessed, productsUpdated, failures, status) {
        await this.db.collection('sync_runs').doc(runId).update({ completedAt: firestore_1.FieldValue.serverTimestamp(), emailsScanned, invoicesProcessed, productsUpdated, failures, status });
    }
    async isInvoiceProcessed(invoiceNumber) {
        const doc = await this.db.collection('myob_processed_invoices').doc(invoiceNumber).get();
        return doc.exists;
    }
    async findProduct(itemId, description) {
        const snap = await this.db.collection('productStocks').get();
        for (const doc of snap.docs) {
            const data = doc.data();
            if (data.deleted === true)
                continue;
            if (data.myobMappings && Array.isArray(data.myobMappings)) {
                if (data.myobMappings.some(m => m.itemId === itemId || m.description === description))
                    return { id: doc.id, data };
            }
            if (data.myobItemId) {
                const ids = data.myobItemId.split(',').map(x => x.trim());
                if (ids.includes(itemId))
                    return { id: doc.id, data };
            }
            if (data.myobDescription) {
                const descs = data.myobDescription.split(',').map(x => x.trim());
                if (descs.includes(description))
                    return { id: doc.id, data };
            }
            if (data.productName === description)
                return { id: doc.id, data };
        }
        return null;
    }
    async processInvoice(invoice, emailUid) {
        const result = { success: false, invoiceNumber: invoice.invoiceNumber, itemsProcessed: 0, productsUpdated: 0, errors: [], stockUpdates: [] };
        if (await this.isInvoiceProcessed(invoice.invoiceNumber)) {
            result.success = true;
            return result;
        }
        const batch = this.db.batch();
        const stockUpdates = [];
        const updatedProductIds = [];
        const productUpdates = new Map();
        for (const item of invoice.items) {
            const product = await this.findProduct(item.itemId, item.description);
            if (!product) {
                result.errors.push(`Product not found for ${item.itemId}/${item.description}`);
                continue;
            }
            const qtyChange = invoice.isCreditNote ? item.qty : -item.qty;
            if (productUpdates.has(product.id)) {
                const existing = productUpdates.get(product.id);
                existing.totalQtyChange += qtyChange;
                existing.myobItems.push({ itemId: item.itemId, description: item.description, qty: item.qty });
            }
            else {
                productUpdates.set(product.id, { product, totalQtyChange: qtyChange, myobItems: [{ itemId: item.itemId, description: item.description, qty: item.qty }] });
            }
            result.itemsProcessed++;
        }
        const productDetails = [];
        for (const [productId, info] of productUpdates) {
            const currentStock = info.product.data.onHand || 0;
            const newStock = Math.max(0, currentStock + info.totalQtyChange);
            const productRef = this.db.collection('productStocks').doc(productId);
            batch.update(productRef, { onHand: newStock, lastMovementAt: firestore_1.FieldValue.serverTimestamp() });
            const movement = { stockId: productId, type: 'myob-sync', qty: Math.abs(info.totalQtyChange), note: `MYOB ${invoice.isCreditNote ? 'Credit Note' : 'Invoice'} ${invoice.invoiceNumber}`, createdAt: firestore_1.FieldValue.serverTimestamp() };
            const movementRef = this.db.collection('productMovements').doc();
            batch.set(movementRef, movement);
            productDetails.push({ productId, productName: info.product.data.productName || 'Unknown', brandName: info.product.data.brandName || '', myobItems: info.myobItems, stockBefore: currentStock, stockAfter: newStock, totalQtyChange: info.totalQtyChange });
            stockUpdates.push({ productId, itemId: info.myobItems.map(m => m.itemId).join(','), description: info.myobItems.map(m => m.description).join(', '), qtyChange: info.totalQtyChange, currentStock, newStock });
            updatedProductIds.push(productId);
        }
        if (updatedProductIds.length > 0) {
            const docRef = this.db.collection('myob_processed_invoices').doc(invoice.invoiceNumber);
            const data = { invoiceNumber: invoice.invoiceNumber, processedAt: firestore_1.FieldValue.serverTimestamp(), emailUid, itemsProcessed: result.itemsProcessed, productsUpdated: updatedProductIds, isCreditNote: invoice.isCreditNote, totalQtyProcessed: stockUpdates.reduce((s, u) => s + Math.abs(u.qtyChange), 0), productDetails, success: true };
            batch.set(docRef, data);
        }
        await batch.commit();
        result.success = true;
        result.productsUpdated = updatedProductIds.length;
        result.stockUpdates = stockUpdates;
        return result;
    }
}
exports.FirestoreClient = FirestoreClient;
