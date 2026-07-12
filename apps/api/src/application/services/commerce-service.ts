import { Prisma, prisma } from "@novachat/database";
import type {
  AiCommerceToolInput,
  OrderConfirmationInput,
  OrderInput,
  OrdersQuery,
  OrderStatusUpdateInput,
  OrderUpdateInput,
  ProductCategoryInput,
  ProductInput,
  ProductsQuery,
  ProductUpdateInput
} from "@novachat/shared-types";
import { badRequest, forbidden, notFound } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";

type Actor = {
  userId?: string | null;
};

const highValueApprovalThreshold = 500_000;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? 0 : Number(value);
}

function serializeImage(image: {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}) {
  return image;
}

function serializeProduct(product: ProductRecord) {
  return {
    id: product.id,
    categoryId: product.categoryId,
    category: product.category,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: toNumber(product.price),
    currency: product.currency,
    stockQuantity: product.stockQuantity,
    status: product.status,
    isActive: product.isActive,
    images: product.images.map(serializeImage),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

function serializeOrder(order: OrderRecord) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    conversationId: order.conversationId,
    customerName: order.customerName ?? order.customer?.name ?? null,
    customerPhone: order.customerPhone ?? order.customer?.phone ?? null,
    customerEmail: order.customerEmail ?? order.customer?.email ?? null,
    deliveryAddress: order.deliveryAddress,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    source: order.source,
    subtotalAmount: toNumber(order.subtotalAmount),
    totalAmount: toNumber(order.totalAmount),
    currency: order.currency,
    notes: order.notes,
    requiresApproval: order.requiresApproval,
    approvedAt: order.approvedAt?.toISOString() ?? null,
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal)
    })),
    timeline: order.timeline.map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString()
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString()
  };
}

type ProductRecord = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true } };
    images: { where: { deletedAt: null }; orderBy: { position: "asc" } };
  };
}>;

const orderInclude = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  items: { where: { deletedAt: null }, orderBy: { createdAt: "asc" as const } },
  timeline: { where: { deletedAt: null }, orderBy: { createdAt: "asc" as const } }
};

type OrderRecord = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { where: { deletedAt: null }, orderBy: { position: "asc" as const } }
};

async function resolveCategory(tenantId: string, input: ProductInput | ProductUpdateInput) {
  if (input.categoryId === null) {
    return null;
  }

  if (input.categoryId) {
    const category = await prisma.productCategory.findFirst({
      where: { id: input.categoryId, tenantId, deletedAt: null },
      select: { id: true }
    });
    if (!category) {
      throw notFound("Product category not found");
    }
    return category.id;
  }

  if (input.categoryName) {
    const slug = slugify(input.categoryName);
    const category = await prisma.productCategory.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: { deletedAt: null },
      create: { tenantId, name: input.categoryName, slug },
      select: { id: true }
    });
    return category.id;
  }

  return undefined;
}

async function nextOrderNumber(tx: Prisma.TransactionClient, tenantId: string) {
  const count = await tx.order.count({ where: { tenantId } });
  return `ORD-${String(count + 1).padStart(6, "0")}`;
}

async function resolveOrderItems(
  tx: Prisma.TransactionClient,
  tenantId: string,
  items: OrderInput["items"]
) {
  const resolved = [];

  for (const item of items) {
    if (item.productId) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId, deletedAt: null },
        select: { id: true, sku: true, name: true, price: true, currency: true, stockQuantity: true, status: true }
      });

      if (!product) {
        throw notFound("Product not found");
      }

      resolved.push({
        productId: product.id,
        name: item.name ?? product.name,
        sku: item.sku ?? product.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? toNumber(product.price),
        stockQuantity: product.stockQuantity,
        productStatus: product.status
      });
      continue;
    }

    if (!item.name || item.unitPrice === undefined) {
      throw badRequest("Manual order items require name and unitPrice");
    }

    resolved.push({
      productId: null,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      stockQuantity: null,
      productStatus: null
    });
  }

  return resolved;
}

async function productWithRelations(productId: string) {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: productInclude
  });
}

async function orderWithRelations(orderId: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude
  });
}

export class CommerceService {
  async productCategories(tenantId: string) {
    return prisma.productCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true }
    });
  }

  async createProductCategory(tenantId: string, input: ProductCategoryInput) {
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    const category = await prisma.productCategory.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: { name: input.name, deletedAt: null },
      create: { tenantId, name: input.name, slug },
      select: { id: true, name: true, slug: true }
    });
    return category;
  }

  async products(tenantId: string, query: ProductsQuery) {
    const pagination = createPagination(query);
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { sku: { contains: query.search, mode: "insensitive" as const } },
              { description: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.product.count({ where })
    ]);

    return { items: items.map(serializeProduct), pagination: pagination.meta(total) };
  }

  async createProduct(tenantId: string, input: ProductInput) {
    const categoryId = await resolveCategory(tenantId, input);
    const productId = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          name: input.name,
          ...(input.description !== undefined ? { description: input.description } : {}),
          price: input.price,
          currency: input.currency,
          stockQuantity: input.stockQuantity,
          status: input.status,
          isActive: input.isActive ?? input.status === "ACTIVE"
        }
      });

      if (input.images.length) {
        await tx.productImage.createMany({
          data: input.images.map((image) => ({
            tenantId,
            productId: product.id,
            url: image.url,
            alt: image.alt ?? null,
            position: image.position
          }))
        });
      }

      return product.id;
    });

    return serializeProduct(await productWithRelations(productId));
  }

  async updateProduct(tenantId: string, productId: string, input: ProductUpdateInput) {
    const existing = await prisma.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } });
    if (!existing) {
      throw notFound("Product not found");
    }

    const categoryId = await resolveCategory(tenantId, input);
    const product = await prisma.$transaction(async (tx) => {
      if (input.images) {
        await tx.productImage.updateMany({
          where: { tenantId, productId },
          data: { deletedAt: new Date() }
        });
      }

      const data: Prisma.ProductUncheckedUpdateInput = {
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isActive === undefined && input.status ? { isActive: input.status === "ACTIVE" } : {})
      };

      await tx.product.update({
        where: { id: productId },
        data
      });

      if (input.images?.length) {
        await tx.productImage.createMany({
          data: input.images.map((image) => ({
            tenantId,
            productId,
            url: image.url,
            alt: image.alt ?? null,
            position: image.position
          }))
        });
      }

      return productId;
    });

    return serializeProduct(await productWithRelations(product));
  }

  async deleteProduct(tenantId: string, productId: string) {
    const product = await prisma.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } });
    if (!product) {
      throw notFound("Product not found");
    }

    await prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date(), isActive: false, status: "ARCHIVED" }
    });

    return { deleted: true };
  }

  async orders(tenantId: string, query: OrdersQuery) {
    const pagination = createPagination(query);
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.conversationId ? { conversationId: query.conversationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.deliveryStatus ? { deliveryStatus: query.deliveryStatus } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: "insensitive" as const } },
              { customerName: { contains: query.search, mode: "insensitive" as const } },
              { customerPhone: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.order.count({ where })
    ]);

    return { items: items.map(serializeOrder), pagination: pagination.meta(total) };
  }

  async order(tenantId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: orderInclude
    });
    if (!order) {
      throw notFound("Order not found");
    }
    return serializeOrder(order);
  }

  async createOrder(tenantId: string, input: OrderInput, actor: Actor) {
    const orderId = await prisma.$transaction(async (tx) => {
      const items = await resolveOrderItems(tx, tenantId, input.items);
      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const requiresApproval = input.requiresApproval ?? subtotal >= highValueApprovalThreshold;
      const orderNumber = await nextOrderNumber(tx, tenantId);

      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
          ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
          ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
          ...(input.customerPhone !== undefined ? { customerPhone: input.customerPhone } : {}),
          ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
          ...(input.deliveryAddress !== undefined ? { deliveryAddress: input.deliveryAddress } : {}),
          status: input.status,
          paymentStatus: input.paymentStatus,
          deliveryStatus: input.deliveryStatus,
          source: input.source,
          currency: input.currency,
          subtotalAmount: subtotal,
          totalAmount: subtotal,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          requiresApproval
        }
      });

      await tx.orderItem.createMany({
        data: items.map((item) => ({
          tenantId,
          orderId: order.id,
          productId: item.productId,
          name: item.name,
          sku: item.sku ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.unitPrice * item.quantity
        }))
      });

      await tx.orderTimelineEvent.create({
        data: {
          tenantId,
          orderId: order.id,
          actorUserId: actor.userId ?? null,
          type: "ORDER_CREATED",
          message: `Order ${orderNumber} created as ${input.status.toLowerCase()}`
        },
      });

      return order.id;
    });

    return serializeOrder(await orderWithRelations(orderId));
  }

  async updateOrder(tenantId: string, orderId: string, input: OrderUpdateInput, actor: Actor) {
    const existing = await prisma.order.findFirst({ where: { id: orderId, tenantId, deletedAt: null } });
    if (!existing) {
      throw notFound("Order not found");
    }

    const updatedOrderId = await prisma.$transaction(async (tx) => {
      let totals: { subtotalAmount?: number; totalAmount?: number } = {};
      if (input.items) {
        const items = await resolveOrderItems(tx, tenantId, input.items);
        await tx.orderItem.deleteMany({ where: { tenantId, orderId } });
        await tx.orderItem.createMany({
          data: items.map((item) => ({
            tenantId,
            orderId,
            productId: item.productId,
            name: item.name,
            sku: item.sku ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.unitPrice * item.quantity
          }))
        });
        const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        totals = { subtotalAmount: subtotal, totalAmount: subtotal };
      }

      await tx.orderTimelineEvent.create({
        data: {
          tenantId,
          orderId,
          actorUserId: actor.userId ?? null,
          type: "ORDER_UPDATED",
          message: "Order details updated"
        }
      });

      const data: Prisma.OrderUncheckedUpdateInput = {
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
        ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
        ...(input.customerPhone !== undefined ? { customerPhone: input.customerPhone } : {}),
        ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
        ...(input.deliveryAddress !== undefined ? { deliveryAddress: input.deliveryAddress } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.paymentStatus !== undefined ? { paymentStatus: input.paymentStatus } : {}),
        ...(input.deliveryStatus !== undefined ? { deliveryStatus: input.deliveryStatus } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.requiresApproval !== undefined ? { requiresApproval: input.requiresApproval } : {}),
        ...totals
      };

      await tx.order.update({
        where: { id: orderId },
        data
      });

      return orderId;
    });

    return serializeOrder(await orderWithRelations(updatedOrderId));
  }

  async updateOrderStatus(tenantId: string, orderId: string, input: OrderStatusUpdateInput, actor: Actor) {
    const order = await prisma.order.findFirst({ where: { id: orderId, tenantId, deletedAt: null } });
    if (!order) {
      throw notFound("Order not found");
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.paymentStatus !== undefined ? { paymentStatus: input.paymentStatus } : {}),
          ...(input.deliveryStatus !== undefined ? { deliveryStatus: input.deliveryStatus } : {})
        }
      }),
      prisma.orderTimelineEvent.create({
        data: {
          tenantId,
          orderId,
          actorUserId: actor.userId ?? null,
          type: "STATUS_UPDATED",
          message: input.note ?? "Order status updated",
          metadata: input as Prisma.InputJsonValue
        }
      })
    ]);

    return serializeOrder(await orderWithRelations(orderId));
  }

  async approveOrder(tenantId: string, orderId: string, actor: Actor) {
    const order = await prisma.order.findFirst({ where: { id: orderId, tenantId, deletedAt: null } });
    if (!order) {
      throw notFound("Order not found");
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { approvedAt: new Date(), approvedByUserId: actor.userId ?? null }
      }),
      prisma.orderTimelineEvent.create({
        data: {
          tenantId,
          orderId,
          actorUserId: actor.userId ?? null,
          type: "ORDER_APPROVED",
          message: "High-value order approved by staff"
        }
      })
    ]);

    return serializeOrder(await orderWithRelations(orderId));
  }

  async confirmOrder(tenantId: string, orderId: string, actor: Actor) {
    const confirmedOrderId = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId, deletedAt: null },
        include: { items: { where: { deletedAt: null } } }
      });

      if (!order) {
        throw notFound("Order not found");
      }

      if (order.status !== "DRAFT" && order.status !== "PENDING") {
        throw badRequest("Only draft or pending orders can be confirmed");
      }

      if (order.requiresApproval && !order.approvedAt) {
        throw forbidden("This high-value order requires staff approval before confirmation");
      }

      for (const item of order.items) {
        if (!item.productId) {
          continue;
        }

        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId, deletedAt: null },
          select: { stockQuantity: true, name: true }
        });
        if (!product || product.stockQuantity < item.quantity) {
          throw badRequest(`Not enough stock for ${item.name}`);
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } }
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date()
        }
      });

      await tx.orderTimelineEvent.create({
        data: {
          tenantId,
          orderId,
          actorUserId: actor.userId ?? null,
          type: "ORDER_CONFIRMED",
          message: "Order confirmed by staff"
        }
      });

      return orderId;
    });

    return serializeOrder(await orderWithRelations(confirmedOrderId));
  }

  async sendConfirmation(tenantId: string, orderId: string, input: OrderConfirmationInput, actor: Actor) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: orderInclude
    });
    if (!order) {
      throw notFound("Order not found");
    }

    const message =
      input.message ??
      `Order ${order.orderNumber ?? order.id} confirmation: ${order.items
        .map((item) => `${item.quantity} x ${item.name}`)
        .join(", ")}. Total ${order.currency} ${Number(order.totalAmount).toFixed(2)}.`;

    await prisma.orderTimelineEvent.create({
      data: {
        tenantId,
        orderId,
        actorUserId: actor.userId ?? null,
        type: "CONFIRMATION_SENT",
        message: `Confirmation queued via ${input.channel}`,
        metadata: { channel: input.channel, message }
      }
    });

    return { sent: true, channel: input.channel, message };
  }
}

export class AiCommerceToolService {
  private readonly commerce = new CommerceService();

  async execute(tenantId: string, input: AiCommerceToolInput, actor?: Actor) {
    const logInput = input.input as Prisma.InputJsonValue;
    try {
      const result = await this.executeTool(tenantId, input);
      await prisma.aiToolCallLog.create({
        data: {
          tenantId,
          actorUserId: actor?.userId ?? null,
          conversationId: input.conversationId ?? null,
          orderId: typeof result === "object" && result && "id" in result ? String(result.id) : null,
          toolName: input.toolName,
          status: "SUCCESS",
          input: logInput,
          output: result as Prisma.InputJsonValue
        }
      });
      return result;
    } catch (error) {
      await prisma.aiToolCallLog.create({
        data: {
          tenantId,
          actorUserId: actor?.userId ?? null,
          conversationId: input.conversationId ?? null,
          toolName: input.toolName,
          status: error instanceof Error && error.message.includes("confirmation") ? "BLOCKED" : "FAILED",
          input: logInput,
          error: error instanceof Error ? error.message : "AI commerce tool failed"
        }
      });
      throw error;
    }
  }

  private async executeTool(tenantId: string, tool: AiCommerceToolInput) {
    if (tool.toolName === "search_products") {
      return this.commerce.products(tenantId, {
        page: 1,
        pageSize: 10,
        sortDirection: "desc",
        sortBy: "createdAt",
        search: typeof tool.input.query === "string" ? tool.input.query : undefined,
        status: "ACTIVE"
      });
    }

    if (tool.toolName === "check_product_availability") {
      const productId = String(tool.input.productId ?? "");
      const quantity = Number(tool.input.quantity ?? 1);
      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId, deletedAt: null },
        select: { id: true, name: true, stockQuantity: true, status: true }
      });
      if (!product) {
        throw notFound("Product not found");
      }
      return { ...product, requestedQuantity: quantity, available: product.status === "ACTIVE" && product.stockQuantity >= quantity };
    }

    if (tool.toolName === "create_draft_order") {
      return this.commerce.createOrder(
        tenantId,
        {
          ...(tool.input as OrderInput),
          status: "DRAFT",
          source: "AI",
          conversationId: tool.conversationId ?? (tool.input.conversationId as string | undefined)
        },
        { userId: null }
      );
    }

    if (tool.toolName === "confirm_order") {
      throw forbidden("AI cannot create final orders without customer confirmation and staff-controlled confirmation");
    }

    if (tool.toolName === "update_order_status") {
      const orderId = String(tool.input.orderId ?? "");
      return this.commerce.updateOrderStatus(
        tenantId,
        orderId,
        tool.input as OrderStatusUpdateInput,
        { userId: null }
      );
    }

    if (tool.toolName === "get_order_status") {
      return this.commerce.order(tenantId, String(tool.input.orderId ?? ""));
    }

    throw badRequest("Unsupported AI commerce tool");
  }
}
