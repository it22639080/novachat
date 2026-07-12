import type { Request, Response } from "express";
import {
  crmIdParamSchema,
  customerImportSchema,
  customerInputSchema,
  customerNoteSchema,
  customerTagInputSchema,
  customersQuerySchema,
  customerUpdateSchema,
  leadInputSchema,
  leadOutcomeSchema,
  leadsQuerySchema,
  leadStageInputSchema,
  leadStageMoveSchema,
  leadUpdateSchema
} from "@novachat/shared-types";
import { CrmService } from "../../application/services/crm-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const crmService = new CrmService();

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

export class CrmController {
  async customers(req: Request, res: Response) {
    const result = await crmService.listCustomers(
      tenantIdFromRequest(req),
      customersQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async createCustomer(req: Request, res: Response) {
    const result = await crmService.createCustomer(
      tenantIdFromRequest(req),
      customerInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async customerProfile(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.getCustomerProfile(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async updateCustomer(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.updateCustomer(
      tenantIdFromRequest(req),
      id,
      customerUpdateSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async deleteCustomer(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.deleteCustomer(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async customerNote(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.createCustomerNote(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      id,
      customerNoteSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async addCustomerTag(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.addCustomerTag(
      tenantIdFromRequest(req),
      id,
      customerTagInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async removeCustomerTag(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const { tagId } = customerTagInputSchema.required({ tagId: true }).parse(req.body);
    const result = await crmService.removeCustomerTag(tenantIdFromRequest(req), id, tagId);
    sendSuccess(res, result);
  }

  async importCustomers(req: Request, res: Response) {
    const result = await crmService.importCustomers(
      tenantIdFromRequest(req),
      customerImportSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async exportCustomers(req: Request, res: Response) {
    const csv = await crmService.exportCustomersCsv(tenantIdFromRequest(req));
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", 'attachment; filename="novachat-customers.csv"');
    res.status(200).send(csv);
  }

  async leads(req: Request, res: Response) {
    const result = await crmService.listLeads(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      leadsQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async kanban(req: Request, res: Response) {
    const result = await crmService.kanban(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async createLead(req: Request, res: Response) {
    const result = await crmService.createLead(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      leadInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async updateLead(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.updateLead(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      id,
      leadUpdateSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async deleteLead(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.deleteLead(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async moveLeadStage(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.moveLeadStage(
      tenantIdFromRequest(req),
      id,
      leadStageMoveSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async outcome(req: Request, res: Response) {
    const { id } = crmIdParamSchema.parse(req.params);
    const result = await crmService.markLeadOutcome(
      tenantIdFromRequest(req),
      id,
      leadOutcomeSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async leadStages(req: Request, res: Response) {
    const result = await crmService.listLeadStages(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async createLeadStage(req: Request, res: Response) {
    const result = await crmService.createLeadStage(
      tenantIdFromRequest(req),
      leadStageInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }
}
