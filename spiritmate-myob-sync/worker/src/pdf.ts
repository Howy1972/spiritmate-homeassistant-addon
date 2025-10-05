import { ParsedInvoice, ParsedInvoiceItem } from './types';

const pdfParse = require('pdf-parse');

/**
 * Extract invoice number from PDF text
 * Handles multiple MYOB invoice number formats
 */
export function extractInvoiceNumber(text: string): string | undefined {
  // Try different patterns for MYOB invoices, ordered by specificity
  const patterns = [
    /Invoice\s+number\s+(INV[0-9]+)/i,            // "Invoice number INV001240" (most specific)
    /Invoice\s+no[:\s]+(INV[0-9]+)/i,            // "Invoice no: INV001240"
    /(INV[0-9]{6})/i,                            // "INV001240" (6 digits, specific format)
    /Invoice\s+number[^\w]*(INV[0-9]+)/i,        // "Invoice numberINV001240" (no space)
    /Invoice[:\s]+(INV[0-9]+)/i,                 // "Invoice: INV001240"
    /INV([0-9]{6})/i,                            // "INV001240" anywhere (6 digits only)
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // For the INV([0-9]{6}) pattern, add the INV prefix
      if (pattern.source === 'INV([0-9]{6})') {
        return 'INV' + match[1];
      }
      return match[1];
    }
  }
  
  console.warn('Could not extract invoice number from PDF text');
  console.log('PDF text preview for debugging:', text.substring(0, 300));
  return undefined;
}

/**
 * Detect if this is a credit note
 */
export function isCreditNote(text: string): boolean {
  return /Credit\s*Note/i.test(text);
}

/**
 * Parse invoice lines from MYOB PDF text
 * Real MYOB format has multiple products per line:
 * "001 002  Aviator Dry Gin 500ml Aviatrix Rose Gin 500ml  3 2  64.90 64.90  FRE FRE  194.70 129.80"
 */
export function parseLines(text: string): ParsedInvoiceItem[] {
  const lines: ParsedInvoiceItem[] = [];
  
  try {
    // Step 1: Find the table section - try different header patterns
    const tableHeaderPatterns = [
      /Item\s*ID\s+Description\s+UoM\s+Qty\s+Unit\s+price/i,  // Standard spaced format
      /Item\s*IDDescription\s*UoMQty/i,  // Compact format from real PDFs
      /Item\s*ID.*?Description.*?UoM.*?Qty.*?Unit\s+price/i,  // Flexible format
    ];
    
    let tableHeaderMatch = null;
    for (const pattern of tableHeaderPatterns) {
      tableHeaderMatch = text.match(pattern);
      if (tableHeaderMatch) {
        console.log(`Found table header with pattern: ${pattern}`);
        break;
      }
    }
    
    if (!tableHeaderMatch) {
      console.warn('Could not find table header in PDF text');
      console.log('Available text preview:', text.substring(0, 500));
      return lines;
    }

    // Step 2: Find the end of the table (totals section)
    const totalsMatch = text.match(/Tax\s*\$|Total\s+Amount|Subtotal/i);
    
    // Extract the table section
    const tableStartIndex = tableHeaderMatch.index! + tableHeaderMatch[0].length;
    const tableEndIndex = totalsMatch?.index || text.length;
    const tableSection = text.substring(tableStartIndex, tableEndIndex);
    
    console.log(`Table section (${tableSection.length} chars):`, tableSection);

    // Step 3: Split into lines and normalize whitespace
    const rawLines = tableSection
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    console.log('Raw lines:', rawLines);

    // Step 4: Process each line - handle both single and multi-product formats
    for (const line of rawLines) {
      // Check if line starts with Item ID pattern (1-5 digits)
      if (!/^[0-9]{1,5}/.test(line)) {
        console.log(`Skipping line (no item ID): "${line}"`);
        continue;
      }

      console.log(`Processing line: "${line}"`);
      
      // Try to detect if this is a multi-product line (has multiple spaces separating sections)
      // or a single-product line (compact format like "001Aviator Dry Gin 500ml364.90FRE194.70")
      if (line.includes('  ')) {
        // Multi-product format
        const parsedItems = parseMultiProductLine(line);
        for (const item of parsedItems) {
          if (item && item.qty > 0) {
            lines.push(item);
          }
        }
      } else {
        // Single-product compact format
        const parsedItem = parseSingleProductLine(line);
        if (parsedItem && parsedItem.qty > 0) {
          lines.push(parsedItem);
        }
      }
    }

  } catch (error) {
    console.error('Error parsing PDF lines:', error);
  }

  return lines;
}

/**
 * Parse a line with multiple products (real MYOB format)
 * Example: "001 002  Aviator Dry Gin 500ml Aviatrix Rose Gin 500ml  3 2  64.90 64.90  FRE FRE  194.70 129.80"
 * Structure: [ItemIDs] [Descriptions] [Quantities] [UnitPrices] [Tax] [Amounts]
 */
function parseMultiProductLine(line: string): ParsedInvoiceItem[] {
  const items: ParsedInvoiceItem[] = [];
  
  try {
    console.log(`Parsing multi-product line: "${line}"`);
    
    // Split the line into sections by multiple spaces (2 or more)
    const sections = line.split(/\s{2,}/).filter(section => section.trim().length > 0);
    console.log('Sections:', sections);
    
    if (sections.length < 4) {
      console.warn(`Not enough sections in line (need 4+, got ${sections.length})`);
      return items;
    }
    
    // Extract sections
    const itemIdsSection = sections[0];
    const descriptionsSection = sections[1];
    const quantitiesSection = sections[2];
    const unitPricesSection = sections[3];
    // sections[4] would be tax (FRE FRE)
    // sections[5] would be amounts (194.70 129.80)
    
    // Parse item IDs
    const itemIds = itemIdsSection.trim().split(/\s+/);
    console.log('Item IDs:', itemIds);
    
    // Parse quantities
    const quantities = quantitiesSection.trim().split(/\s+/).map(q => parseFloat(q));
    console.log('Quantities:', quantities);
    
    // Parse unit prices
    const unitPrices = unitPricesSection.trim().split(/\s+/).map(p => parseFloat(p));
    console.log('Unit prices:', unitPrices);
    
    // Parse descriptions - this is tricky as they're concatenated
    const descriptions = parseDescriptionsFromConcatenated(descriptionsSection, itemIds.length);
    console.log('Descriptions:', descriptions);
    
    // Ensure all arrays have the same length
    const numProducts = itemIds.length;
    if (quantities.length !== numProducts || unitPrices.length !== numProducts || descriptions.length !== numProducts) {
      console.warn(`Array length mismatch: IDs=${itemIds.length}, Qty=${quantities.length}, Prices=${unitPrices.length}, Desc=${descriptions.length}`);
      // Try to match what we can
    }
    
    // Create items
    for (let i = 0; i < numProducts && i < quantities.length && i < unitPrices.length && i < descriptions.length; i++) {
      items.push({
        itemId: itemIds[i],
        description: descriptions[i],
        qty: quantities[i],
        unitPrice: unitPrices[i]
      });
    }
    
    console.log('Parsed items:', items);
    return items;
    
  } catch (error) {
    console.error(`Error parsing multi-product line: ${line}`, error);
    return items;
  }
}

/**
 * Parse descriptions from concatenated string
 * Example: "Aviator Dry Gin 500ml Aviatrix Rose Gin 500ml" with 2 products
 */
function parseDescriptionsFromConcatenated(concatenated: string, numProducts: number): string[] {
  // This is a heuristic approach - try to split by common patterns
  const descriptions: string[] = [];
  
  if (numProducts === 1) {
    descriptions.push(concatenated.trim());
  } else if (numProducts === 2) {
    // Look for common product patterns to split
    // Try splitting by "500ml", "700ml", etc. followed by a capital letter
    const splitPattern = /(\d+ml)\s+([A-Z])/g;
    const matches = [...concatenated.matchAll(splitPattern)];
    
    if (matches.length === 1) {
      // Found one split point
      const splitIndex = matches[0].index! + matches[0][1].length;
      descriptions.push(concatenated.substring(0, splitIndex).trim());
      descriptions.push(concatenated.substring(splitIndex).trim());
    } else {
      // Fallback: split roughly in half
      const midPoint = Math.floor(concatenated.length / 2);
      const spaceNearMid = concatenated.indexOf(' ', midPoint);
      if (spaceNearMid !== -1) {
        descriptions.push(concatenated.substring(0, spaceNearMid).trim());
        descriptions.push(concatenated.substring(spaceNearMid).trim());
      } else {
        descriptions.push(concatenated.trim());
        descriptions.push('Unknown Product');
      }
    }
  } else {
    // For 3+ products, use a more complex heuristic
    // Look for repeating patterns like "500ml", "(Wholesale)", etc.
    const words = concatenated.split(/\s+/);
    const avgWordsPerProduct = Math.floor(words.length / numProducts) || 1;
    
    for (let i = 0; i < numProducts; i++) {
      const startIndex = i * avgWordsPerProduct;
      const endIndex = i === numProducts - 1 ? words.length : (i + 1) * avgWordsPerProduct;
      descriptions.push(words.slice(startIndex, endIndex).join(' '));
    }
  }
  
  return descriptions;
}

/**
 * Parse single product line in compact format
 * Example: "001Aviator Dry Gin 500ml364.90FRE194.70"
 * Format: ItemID + Description + Qty + UnitPrice + Tax + Amount (no spaces)
 */
function parseSingleProductLine(line: string): ParsedInvoiceItem | null {
  try {
    console.log(`Parsing single-product line: "${line}"`);
    
    // Extract item ID (leading digits)
    const itemIdMatch = line.match(/^([0-9]{1,5})/);
    if (!itemIdMatch) return null;
    
    const itemId = itemIdMatch[1];
    const remaining = line.substring(itemId.length);
    
    // Find all numeric values
    const numberMatches = [...remaining.matchAll(/(\d+\.?\d*)/g)];
    console.log('Found numbers:', numberMatches.map(m => m[1]));
    
    if (numberMatches.length < 2) {
      console.warn(`Not enough numeric values in single line: ${line}`);
      return null;
    }
    
    let qty: number | undefined;
    let unitPrice: number | undefined;
    
    // Strategy: Find the number that looks like qty+price combined
    for (let i = 0; i < numberMatches.length; i++) {
      const match = numberMatches[i];
      const numStr = match[1];
      
      // Skip bottle sizes (number immediately followed by "ml")
      const afterNumber = remaining.substring(match.index! + numStr.length, match.index! + numStr.length + 2);
      
      if (afterNumber.startsWith('ml')) {
        console.log(`Skipping bottle size: ${numStr}ml`);
        continue;
      }
      
      // Skip if this is likely the final total (last number in the line)
      if (i === numberMatches.length - 1) {
        console.log(`Skipping final total: ${numStr}`);
        continue;
      }
      
      // This should be the qty+price combined number
      if (numStr.length >= 4 && numStr.includes('.')) {
        console.log(`Analyzing potential qty+price: ${numStr}`);
        
        // Try splitting: first 1-2 digits as qty, rest as price
        for (let qtyDigits = 1; qtyDigits <= 2; qtyDigits++) {
          const qtyStr = numStr.substring(0, qtyDigits);
          const priceStr = numStr.substring(qtyDigits);
          
          const testQty = parseInt(qtyStr, 10);
          const testPrice = parseFloat(priceStr);
          
          console.log(`  Testing split: qty=${testQty}, price=$${testPrice}`);
          
          // Validate this makes sense for spirits:
          // - Qty: 1-50 bottles per order
          // - Price: $10-300 per bottle (broadened range)
          if (testQty >= 1 && testQty <= 50 && 
              testPrice >= 10 && testPrice <= 300 &&
              priceStr.includes('.')) {
            
            qty = testQty;
            unitPrice = testPrice;
            console.log(`✅ Found valid qty+price: ${numStr} → qty=${qty}, price=$${unitPrice}`);
            break;
          }
        }
        
        if (qty !== undefined) break;
      }
    }
    
    if (qty === undefined || unitPrice === undefined) {
      console.warn(`Could not extract qty/price from line: ${line}`);
      return null;
    }
    
    // Description is everything up to the first number (excluding bottle sizes)
    const firstNumberIndex = numberMatches.find(m => {
      const beforeNum = remaining.substring(0, m.index);
      return !beforeNum.endsWith('ml');
    })?.index || remaining.length;
    
    const description = remaining.substring(0, firstNumberIndex).trim();
    
    if (!description) {
      console.warn(`No description found in single line: ${line}`);
      return null;
    }
    
    console.log(`✅ Single line parsed: ${itemId} - "${description}" (${qty}x$${unitPrice})`);
    
    return {
      itemId,
      description,
      qty,
      unitPrice
    };
    
  } catch (error) {
    console.error(`Error parsing single-product line: ${line}`, error);
    return null;
  }
}

/**
 * Main function to parse PDF buffer and extract invoice data
 */
export async function parsePdfInvoice(pdfBuffer: Buffer): Promise<ParsedInvoice | null> {
  try {
    console.log(`[PDF] Parsing PDF buffer of ${pdfBuffer.length} bytes`);
    
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    
    console.log(`[PDF] Extracted ${text.length} characters from PDF`);
    console.log(`[PDF] First 500 chars:`, text.substring(0, 500));
    
    // Extract invoice number
    const invoiceNumber = extractInvoiceNumber(text);
    if (!invoiceNumber) {
      console.error('[PDF] Could not extract invoice number from PDF');
      return null;
    }
    console.log(`[PDF] Invoice number: ${invoiceNumber}`);

    // Check if credit note
    const isCredit = isCreditNote(text);
    console.log(`[PDF] Is credit note: ${isCredit}`);

    // Parse line items
    const items = parseLines(text);
    console.log(`[PDF] Parsed ${items.length} line items from invoice`);

    if (items.length === 0) {
      console.warn('[PDF] No line items found in invoice');
    }

    return {
      invoiceNumber,
      isCreditNote: isCredit,
      items
    };

  } catch (error) {
    console.error('[PDF] Parse error:', error);
    return null;
  }
}
