import type { Request, Response } from "express";
import {
  aiCommerceToolSchema,
  commerceIdParamSchema,
  orderConfirmationSchema,
  orderInputSchema,
  ordersQuerySchema,
  orderStatusUpdateSchema,
  orderUpdateSchema,
  productCategoryInputSchema,
  productInputSchema,
  productsQuerySchema,
  productUpdateSchema
} from "@novachat/shared-types";
import { AiCommerceToolService, CommerceService } from "../../application/services/commerce-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const commerceService = new CommerceService();
const aiCommerceToolService = new AiCommerceToolService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

function actorFromRequest(req: Request) {
  if (!req.user) {
    throw unauthorized();
  }

  return { userId: req.user.id };
}

export class CommerceController {
  async productCategories(req: Request, res: Response) {
    const result = await commerceService.productCategories(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async createProductCategory(req: Request, res: Response) {
    const result = await commerceService.createProductCategory(
      tenantIdFromRequest(req),
      productCategoryInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async products(req: Request, res: Response) {
    const result = await commerceService.products(
      tenantIdFromRequest(req),
      productsQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async createProduct(req: Request, res: Response) {
    const result = await commerceService.createProduct(
      tenantIdFromRequest(req),
      productInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async updateProduct(req: Request, res: Response) {
    const { id } = commerceIdParamSchema.parse(req.params);
    const result = await commerceService.updateProduct(
      tenantIdFromRequest(req),
      id,
      productUpdateSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async deleteProduct(req: Request, res: Response) {
    const { id } = commerceIdParamSchema.parse(req.params);
    const result = await commerceService.deleteProduct(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async orders(req: Request, res: Response) {
    const result = await commerceService.orders(
      tenantIdFromRequest(req),
      ordersQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async createOrder(req: Request, res: Response) {
    const result = await commerceService.createOrder(
      tenantIdFromRequest(req),
      orderInputSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result, 201);
  }

  async order(req: Request, res: Response) {
    const { id } = commerceIdParamSchema.parse(req.params);
    const result = await commerceService.order(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async updateOrder(req: Request, res: Response) {
    const { id } = commerceIdParamSchema.parse(req.params);
    const result = await commerceService.updateOrder(
      tenantIdFromRequest(req),
      id,
      orderUpdateSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result);
  }

  async updateOrderStatus(req: Request, res: Response) {
    const { id } = commerceIdParamSchema.parse(req.params);
    const result = await commerceService.updateOrderStatus(
      tenantIdFromRequest(req),
      id,
      orderStatusUpdateSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result);
  }

  async confirmOrder(req: Request, res: Response) {
    const { id } = commerceIdParamSchema.parse(req.params);
    const result = await commerceService.confirmOrder(tenantIdFromRequest(req), id, actorFromRequest(req));
    sendSuccess(res, result);
  }

  async sendConfirmation(req: Request, res: Response) {
    const { id } = commerceIdParamSchema.parse(req.params);
    const result = await commerceService.sendConfirmation(
      tenantIdFromRequest(req),
      id,
      orderConfirmationSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result, 202);
  }

  async executeAiTool(req: Request, res: Response) {
    const result = await aiCommerceToolService.execute(
      tenantIdFromRequest(req),
      aiCommerceToolSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result, 201);
  }
}
