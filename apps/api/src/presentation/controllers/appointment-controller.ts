import type { Request, Response } from "express";
import {
  aiAppointmentToolSchema,
  appointmentIdParamSchema,
  appointmentInputSchema,
  appointmentReminderSchema,
  appointmentsQuerySchema,
  appointmentUpdateSchema,
  availabilityQuerySchema,
  serviceOfferingInputSchema,
  servicesQuerySchema,
  serviceOfferingUpdateSchema,
  staffAvailabilityInputSchema
} from "@novachat/shared-types";
import { AiAppointmentToolService, AppointmentService } from "../../application/services/appointment-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const appointmentService = new AppointmentService();
const aiAppointmentToolService = new AiAppointmentToolService();

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

export class AppointmentController {
  async services(req: Request, res: Response) {
    const result = await appointmentService.services(
      tenantIdFromRequest(req),
      servicesQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async createService(req: Request, res: Response) {
    const result = await appointmentService.createService(
      tenantIdFromRequest(req),
      serviceOfferingInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async updateService(req: Request, res: Response) {
    const { id } = appointmentIdParamSchema.parse(req.params);
    const result = await appointmentService.updateService(
      tenantIdFromRequest(req),
      id,
      serviceOfferingUpdateSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async deleteService(req: Request, res: Response) {
    const { id } = appointmentIdParamSchema.parse(req.params);
    const result = await appointmentService.deleteService(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async staffAvailability(req: Request, res: Response) {
    const result = await appointmentService.staffAvailability(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async createStaffAvailability(req: Request, res: Response) {
    const result = await appointmentService.createStaffAvailability(
      tenantIdFromRequest(req),
      staffAvailabilityInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async availability(req: Request, res: Response) {
    const result = await appointmentService.availability(
      tenantIdFromRequest(req),
      availabilityQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async appointments(req: Request, res: Response) {
    const result = await appointmentService.appointments(
      tenantIdFromRequest(req),
      appointmentsQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async createAppointment(req: Request, res: Response) {
    const result = await appointmentService.createAppointment(
      tenantIdFromRequest(req),
      appointmentInputSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result, 201);
  }

  async updateAppointment(req: Request, res: Response) {
    const { id } = appointmentIdParamSchema.parse(req.params);
    const result = await appointmentService.updateAppointment(
      tenantIdFromRequest(req),
      id,
      appointmentUpdateSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result);
  }

  async deleteAppointment(req: Request, res: Response) {
    const { id } = appointmentIdParamSchema.parse(req.params);
    const result = await appointmentService.deleteAppointment(
      tenantIdFromRequest(req),
      id,
      actorFromRequest(req)
    );
    sendSuccess(res, result);
  }

  async sendReminder(req: Request, res: Response) {
    const { id } = appointmentIdParamSchema.parse(req.params);
    const result = await appointmentService.sendReminder(
      tenantIdFromRequest(req),
      id,
      appointmentReminderSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result, 202);
  }

  async executeAiTool(req: Request, res: Response) {
    const result = await aiAppointmentToolService.execute(
      tenantIdFromRequest(req),
      aiAppointmentToolSchema.parse(req.body),
      actorFromRequest(req)
    );
    sendSuccess(res, result, 201);
  }
}
