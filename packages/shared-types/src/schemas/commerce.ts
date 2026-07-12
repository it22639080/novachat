import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const currencySchema = z.enum(["USD", "LKR", "INR", "EUR", "GBP"]);
export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED"]);
export const orderStatusSchema = z.enum(["DRAFT", "PENDING", "CONFIRMED", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]);
export const paymentStatusSchema = z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]);
export const deliveryStatusSchema = z.enum(["NOT_REQUIRED", "PENDING", "READY", "SHIPPED", "DELIVERED", "FAILED", "RETURNED"]);
export const orderSourceSchema = z.enum(["MANUAL", "INBOX", "AI", "SIMULATOR", "WHATSAPP"]);

export const commerceIdParamSchema = z.object({
  id: z.string().uuid()
});

export const productCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120).optional()
});

export const productImageInputSchema = z.object({
  url: z.string().trim().url().max(2048),
  alt: z.string().trim().max(160).optional(),
  position: z.coerce.number().int().min(0).default(0)
});

export const productInputSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  categoryName: z.string().trim().min(1).max(100).optional(),
  sku: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(3000).optional(),
  price: z.coerce.number().min(0).max(999999999),
  currency: currencySchema.default("USD"),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  status: productStatusSchema.default("ACTIVE"),
  isActive: z.boolean().optional(),
  images: z.array(productImageInputSchema).max(12).default([])
});

export const productUpdateSchema = productInputSchema.partial();

export const productsQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  status: productStatusSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "price", "stockQuantity", "status"]).default("createdAt")
});

export const orderItemInputSchema = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(180).optional(),
  sku: z.string().trim().max(80).optional(),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().min(0).max(999999999).optional()
});

export const orderInputSchema = z.object({
  customerId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  customerName: z.string().trim().max(160).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  customerEmail: z.string().trim().email().optional(),
  deliveryAddress: z.string().trim().max(1000).optional(),
  status: orderStatusSchema.default("DRAFT"),
  paymentStatus: paymentStatusSchema.default("PENDING"),
  deliveryStatus: deliveryStatusSchema.default("PENDING"),
  source: orderSourceSchema.default("MANUAL"),
  currency: currencySchema.default("USD"),
  notes: z.string().trim().max(3000).optional(),
  requiresApproval: z.boolean().optional(),
  items: z.array(orderItemInputSchema).min(1).max(80)
});

export const orderUpdateSchema = orderInputSchema.partial().extend({
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  deliveryStatus: deliveryStatusSchema.optional(),
  items: z.array(orderItemInputSchema).min(1).max(80).optional()
});

export const ordersQuerySchema = paginationQuerySchema.extend({
  customerId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  deliveryStatus: deliveryStatusSchema.optional(),
  source: orderSourceSchema.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "totalAmount", "status", "paymentStatus", "deliveryStatus"]).default("createdAt")
});

export const orderStatusUpdateSchema = z.object({
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  deliveryStatus: deliveryStatusSchema.optional(),
  note: z.string().trim().max(1000).optional()
});

export const orderConfirmationSchema = z.object({
  channel: z.enum(["SIMULATOR", "WHATSAPP"]).default("SIMULATOR"),
  message: z.string().trim().max(2000).optional()
});

export const aiCommerceToolSchema = z.object({
  tenantId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  toolName: z.enum([
    "search_products",
    "check_product_availability",
    "create_draft_order",
    "confirm_order",
    "update_order_status",
    "get_order_status"
  ]),
  input: z.record(z.unknown()).default({})
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductsQuery = z.infer<typeof productsQuerySchema>;
export type ProductCategoryInput = z.infer<typeof productCategoryInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
export type OrderConfirmationInput = z.infer<typeof orderConfirmationSchema>;
export type AiCommerceToolInput = z.infer<typeof aiCommerceToolSchema>;
