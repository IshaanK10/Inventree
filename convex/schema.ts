import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  products: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    barcode: v.optional(v.string()),
    price: v.number(),
    cost: v.optional(v.number()),
    stock: v.number(),
    category: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    createdBy: v.id("users"),
  })
    .index("by_barcode", ["barcode"])
    .index("by_category", ["category"])
    .index("by_created_by", ["createdBy"])
    .searchIndex("search_products", {
      searchField: "name",
      filterFields: ["category"],
    }),

  sales: defineTable({
    items: v.array(v.object({
      productId: v.id("products"),
      productName: v.string(),
      quantity: v.number(),
      price: v.number(),
      total: v.number(),
    })),
    subtotal: v.number(),
    tax: v.number(),
    total: v.number(),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    paymentMethod: v.string(),
    status: v.string(), // "completed", "pending", "cancelled"
    createdBy: v.id("users"),
  })
    .index("by_created_by", ["createdBy"])
    .index("by_status", ["status"]),

  categories: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_created_by", ["createdBy"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
