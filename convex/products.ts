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
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    
    if (args.search) {
      const searchTerm = args.search;
      return await ctx.db
        .query("products")
        .withSearchIndex("search_products", (q) =>
          args.category 
            ? q.search("name", searchTerm).eq("category", args.category)
            : q.search("name", searchTerm)
        )
        .collect();
    }
    
    if (args.category) {
      const categoryName = args.category;
      return await ctx.db
        .query("products")
        .withIndex("by_category", (q) => q.eq("category", categoryName))
        .collect();
    }
    
    return await ctx.db.query("products").collect();
  },
});

export const getByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    
    return await ctx.db
      .query("products")
      .withIndex("by_barcode", (q) => q.eq("barcode", args.barcode))
      .unique();
  },
});

export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    barcode: v.optional(v.string()),
    price: v.number(),
    cost: v.optional(v.number()),
    stock: v.number(),
    category: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getLoggedInUser(ctx);
    
    // Check if barcode already exists
    if (args.barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_barcode", (q) => q.eq("barcode", args.barcode))
        .unique();
      
      if (existing) {
        throw new Error("Product with this barcode already exists");
      }
    }
    
    return await ctx.db.insert("products", {
      ...args,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    barcode: v.optional(v.string()),
    price: v.optional(v.number()),
    cost: v.optional(v.number()),
    stock: v.optional(v.number()),
    category: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    
    const { id, ...updates } = args;
    
    // Check if barcode already exists (excluding current product)
    if (updates.barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_barcode", (q) => q.eq("barcode", updates.barcode))
        .unique();
      
      if (existing && existing._id !== id) {
        throw new Error("Product with this barcode already exists");
      }
    }
    
    return await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    return await ctx.db.delete(args.id);
  },
});

export const updateStock = mutation({
  args: {
    id: v.id("products"),
    quantity: v.number(),
    operation: v.union(v.literal("add"), v.literal("subtract")),
  },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    
    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new Error("Product not found");
    }
    
    const newStock = args.operation === "add" 
      ? product.stock + args.quantity
      : product.stock - args.quantity;
    
    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }
    
    return await ctx.db.patch(args.id, { stock: newStock });
  },
});

export const getLowStock = query({
  args: { threshold: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    
    const threshold = args.threshold || 10;
    const products = await ctx.db.query("products").collect();
    
    return products.filter(product => product.stock <= threshold);
  },
});
