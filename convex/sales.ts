import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function getLoggedInUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

export const list = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    
    if (args.status) {
      const statusFilter = args.status;
      return await ctx.db
        .query("sales")
        .withIndex("by_status", (q) => q.eq("status", statusFilter))
        .order("desc")
        .take(args.limit || 50);
    }
    
    return await ctx.db
      .query("sales")
      .order("desc")
      .take(args.limit || 50);
  },
});

export const get = query({
  args: { id: v.id("sales") },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    items: v.array(v.object({
      productId: v.id("products"),
      quantity: v.number(),
    })),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    paymentMethod: v.string(),
    taxRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    
    // Validate and calculate sale items
    const saleItems = [];
    let subtotal = 0;
    
    for (const item of args.items) {
      const product = await ctx.db.get(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }
      
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
      
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      
      saleItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
      });
    }
    
    const taxRate = args.taxRate || 0.1; // 10% default tax
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    
    // Create the sale
    const saleId = await ctx.db.insert("sales", {
      items: saleItems,
      subtotal,
      tax,
      total,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      paymentMethod: args.paymentMethod,
      status: "completed",
      createdBy: userId,
    });
    
    // Update stock for each item
    for (const item of args.items) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        await ctx.db.patch(item.productId, {
          stock: product.stock - item.quantity,
        });
      }
    }
    
    return saleId;
  },
});

export const getTodaysSales = query({
  args: {},
  handler: async (ctx) => {
    await getLoggedInUser(ctx);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    const sales = await ctx.db.query("sales").collect();
    const todaysSales = sales.filter(sale => sale._creationTime >= todayTimestamp);
    
    const totalRevenue = todaysSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalTransactions = todaysSales.length;
    
    return {
      sales: todaysSales,
      totalRevenue,
      totalTransactions,
    };
  },
});

export const getSalesReport = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    
    const sales = await ctx.db.query("sales").collect();
    
    let filteredSales = sales;
    if (args.startDate) {
      filteredSales = filteredSales.filter(sale => sale._creationTime >= args.startDate!);
    }
    if (args.endDate) {
      filteredSales = filteredSales.filter(sale => sale._creationTime <= args.endDate!);
    }
    
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalTransactions = filteredSales.length;
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    // Top selling products
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.total;
      });
    });
    
    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    return {
      totalRevenue,
      totalTransactions,
      averageTransaction,
      topProducts,
      sales: filteredSales,
    };
  },
});
