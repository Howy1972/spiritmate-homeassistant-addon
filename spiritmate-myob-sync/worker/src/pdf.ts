// pdf-parse has no types in our env; declare module in-place
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import { ParsedInvoice, ParsedInvoiceItem } from './types';

export function extractInvoiceNumber(text: string): string | undefined {
  const patterns = [
    /Invoice\s+number\s+(INV[0-9]+)/i,
    /Invoice\s+no[:\s]+(INV[0-9]+)/i,
    /(INV[0-9]{6})/i,
    /Invoice\s+number[^\w]*(INV[0-9]+)/i,
    /Invoice[:\s]+(INV[0-9]+)/i,
    /INV([0-9]{6})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source === 'INV([0-9]{6})') return 'INV' + match[1];
      return match[1];
    }
  }
  return undefined;
}

export function isCreditNote(text: string): boolean {
  return /Credit\s*Note/i.test(text);
}

export function parseLines(text: string): ParsedInvoiceItem[] {
  const lines: ParsedInvoiceItem[] = [];
  const headerPatterns = [
    /Item\s*ID\s+Description\s+UoM\s+Qty\s+Unit\s+price/i,
    /Item\s*IDDescription\s*UoMQty/i,
    /Item\s*ID.*?Description.*?UoM.*?Qty.*?Unit\s+price/i,
  ];
  let headerMatch: RegExpMatchArray | null = null;
  for (const p of headerPatterns) { headerMatch = text.match(p); if (headerMatch) break; }
  if (!headerMatch) return lines;

  const totalsMatch = text.match(/Tax\s*\$|Total\s+Amount|Subtotal/i);
  const tableStart = headerMatch.index! + headerMatch[0].length;
  const tableEnd = totalsMatch?.index || text.length;
  const table = text.substring(tableStart, tableEnd);

  const rawLines = table.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of rawLines) {
    if (!/^[0-9]{1,5}/.test(line)) continue;
    if (line.includes('  ')) {
      parseMultiProductLine(line).forEach(i => { if (i.qty > 0) lines.push(i); });
    } else {
      const one = parseSingleProductLine(line);
      if (one && one.qty > 0) lines.push(one);
    }
  }
  return lines;
}

function parseMultiProductLine(line: string): ParsedInvoiceItem[] {
  const items: ParsedInvoiceItem[] = [];
  const sections = line.split(/\s{2,}/).filter(Boolean);
  if (sections.length < 4) return items;
  const itemIds = sections[0].trim().split(/\s+/);
  const descriptions = parseDescriptionsFromConcatenated(sections[1], itemIds.length);
  const quantities = sections[2].trim().split(/\s+/).map(x => parseFloat(x));
  const unitPrices = sections[3].trim().split(/\s+/).map(x => parseFloat(x));
  const n = Math.min(itemIds.length, descriptions.length, quantities.length, unitPrices.length);
  for (let i = 0; i < n; i++) {
    items.push({ itemId: itemIds[i], description: descriptions[i], qty: quantities[i], unitPrice: unitPrices[i] });
  }
  return items;
}

function parseDescriptionsFromConcatenated(concatenated: string, n: number): string[] {
  if (n === 1) return [concatenated.trim()];
  if (n === 2) {
    const splitPattern = /(\d+ml)\s+([A-Z])/g;
    const matches = [...concatenated.matchAll(splitPattern)];
    if (matches.length === 1) {
      const idx = matches[0].index! + matches[0][1].length;
      return [concatenated.substring(0, idx).trim(), concatenated.substring(idx).trim()];
    }
    const mid = Math.floor(concatenated.length / 2);
    const space = concatenated.indexOf(' ', mid);
    if (space !== -1) return [concatenated.substring(0, space).trim(), concatenated.substring(space).trim()];
    return [concatenated.trim(), 'Unknown Product'];
  }
  const words = concatenated.split(/\s+/);
  const avg = Math.floor(words.length / n) || 1;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const start = i * avg;
    const end = i === n - 1 ? words.length : (i + 1) * avg;
    parts.push(words.slice(start, end).join(' '));
  }
  return parts;
}

function parseSingleProductLine(line: string): ParsedInvoiceItem | null {
  const idMatch = line.match(/^([0-9]{1,5})/);
  if (!idMatch) return null;
  const itemId = idMatch[1];
  const rest = line.substring(itemId.length);
  const numberMatches = [...rest.matchAll(/(\d+\.?\d*)/g)];
  if (numberMatches.length < 2) return null;

  let qty: number | undefined;
  let unitPrice: number | undefined;
  for (let i = 0; i < numberMatches.length; i++) {
    const numStr = numberMatches[i][1];
    const after = rest.substring(numberMatches[i].index! + numStr.length, numberMatches[i].index! + numStr.length + 2);
    if (after.startsWith('ml')) continue;
    if (i === numberMatches.length - 1) continue; // total
    if (numStr.length >= 4 && numStr.includes('.')) {
      for (let d = 1; d <= 2; d++) {
        const q = parseInt(numStr.substring(0, d), 10);
        const p = parseFloat(numStr.substring(d));
        if (q >= 1 && q <= 50 && p >= 10 && p <= 300 && numStr.substring(d).includes('.')) {
          qty = q; unitPrice = p; break;
        }
      }
      if (qty !== undefined) break;
    }
  }
  if (qty === undefined || unitPrice === undefined) return null;
  const firstNumIdx = numberMatches.find(m => !rest.substring(0, m.index).endsWith('ml'))?.index ?? rest.length;
  const description = rest.substring(0, firstNumIdx).trim();
  if (!description) return null;
  return { itemId, description, qty, unitPrice };
}

export async function parsePdfInvoice(pdfBuffer: Buffer): Promise<ParsedInvoice | null> {
  try {
    console.log(`[PDF] Parsing PDF, buffer size: ${pdfBuffer.length} bytes`);
    const pdfData = await (pdfParse as any).default(pdfBuffer);
    const text = pdfData.text as string;
    console.log(`[PDF] Extracted text length: ${text.length} chars`);
    console.log(`[PDF] First 500 chars: ${text.substring(0, 500)}`);
    
    const invoiceNumber = extractInvoiceNumber(text);
    console.log(`[PDF] Extracted invoice number: ${invoiceNumber || 'NOT FOUND'}`);
    
    if (!invoiceNumber) {
      console.error('[PDF] Failed to extract invoice number from text');
      return null;
    }
    
    const items = parseLines(text);
    console.log(`[PDF] Parsed ${items.length} line items`);
    
    return { invoiceNumber, isCreditNote: isCreditNote(text), items };
  } catch (e) {
    console.error('[PDF] Parse error:', e);
    return null;
  }
}


