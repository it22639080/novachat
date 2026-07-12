import type { Request, Response } from "express";
import {
  createSimulatorCustomerSchema,
  incomingSimulatorMessageSchema,
  outgoingSimulatorMessageSchema
} from "@novachat/shared-types";
import { SimulatorService } from "../../application/services/simulator-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const simulatorService = new SimulatorService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class SimulatorController {
  async createCustomer(req: Request, res: Response) {
    const result = await simulatorService.createCustomer(
      tenantIdFromRequest(req),
      createSimulatorCustomerSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async customers(req: Request, res: Response) {
    const result = await simulatorService.listCustomers(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async incomingMessage(req: Request, res: Response) {
    const result = await simulatorService.incomingMessage(
      tenantIdFromRequest(req),
      incomingSimulatorMessageSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async outgoingMessage(req: Request, res: Response) {
    const result = await simulatorService.outgoingMessage(
      tenantIdFromRequest(req),
      outgoingSimulatorMessageSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async conversations(req: Request, res: Response) {
    const result = await simulatorService.listConversations(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async reset(req: Request, res: Response) {
    const result = await simulatorService.reset(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }
}
