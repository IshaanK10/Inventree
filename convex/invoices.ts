import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const generateInvoicePDF = action({
  args: { saleId: v.id("sales") },
  handler: async (ctx, args): Promise<{ html: string; filename: string }> => {
    const sale = await ctx.runQuery(api.sales.get, { id: args.saleId });
    if (!sale) {
      throw new Error("Sale not found");
    }
    
    // Generate HTML invoice
    const invoiceHTML: string = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${sale._id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 40px; }
          .company-name { font-size: 24px; font-weight: bold; color: #333; }
          .invoice-details { margin-bottom: 30px; }
          .customer-details { margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f8f9fa; font-weight: bold; }
          .total-row { font-weight: bold; background-color: #f8f9fa; }
          .text-right { text-align: right; }
          .summary { margin-top: 30px; }
          .summary table { width: 300px; margin-left: auto; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Inventree</div>
          <p>Inventory & Billing System</p>
        </div>
        
        <div class="invoice-details">
          <h2>Invoice #${sale._id.slice(-8)}</h2>
          <p><strong>Date:</strong> ${new Date(sale._creationTime).toLocaleDateString()}</p>
          <p><strong>Payment Method:</strong> ${sale.paymentMethod}</p>
        </div>
        
        ${sale.customerName ? `
        <div class="customer-details">
          <h3>Customer Details</h3>
          <p><strong>Name:</strong> ${sale.customerName}</p>
          ${sale.customerEmail ? `<p><strong>Email:</strong> ${sale.customerEmail}</p>` : ''}
        </div>
        ` : ''}
        
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th class="text-right">Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map((item: any) => `
              <tr>
                <td>${item.productName}</td>
                <td>${item.quantity}</td>
                <td class="text-right">$${item.price.toFixed(2)}</td>
                <td class="text-right">$${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <table>
            <tr>
              <td>Subtotal:</td>
              <td class="text-right">$${sale.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Tax:</td>
              <td class="text-right">$${sale.tax.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td><strong>Total:</strong></td>
              <td class="text-right"><strong>$${sale.total.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>
        
        <div style="margin-top: 50px; text-align: center; color: #666;">
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `;
    
    return {
      html: invoiceHTML,
      filename: `invoice-${sale._id.slice(-8)}.html`,
    };
  },
});
