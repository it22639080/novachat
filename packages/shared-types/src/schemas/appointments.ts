import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const appointmentIdParamSchema = z.object({
  id: z.string().uuid()
});

export const appointmentStatusSchema = z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]);
export const appointmentSourceSchema = z.enum(["MANUAL", "INBOX", "AI", "SIMULATOR", "WHATSAPP", "PUBLIC_BOOKING"]);
export const serviceCurrencySchema = z.enum(["USD", "LKR", "INR", "EUR", "GBP"]);

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");

export const serviceOfferingInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(2000).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  price: z.coerce.number().min(0).max(999999999).optional(),
  currency: serviceCurrencySchema.default("USD"),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240).default(0),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(240).default(0),
  isActive: z.boolean().default(true)
});

export const serviceOfferingUpdateSchema = serviceOfferingInputSchema.partial();

export const servicesQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "durationMinutes", "price"]).default("createdAt")
});

export const staffAvailabilityInputSchema = z.object({
  staffUserId: z.string().uuid(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startsAt: timeOfDaySchema,
  endsAt: timeOfDaySchema,
  timezone: z.string().trim().min(1).max(80).default("UTC"),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional()
}).refine((input) => input.endsAt > input.startsAt, {
  path: ["endsAt"],
  message: "Availability end time must be after start time"
});

export const availabilityQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
  staffUserId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  timezone: z.string().trim().min(1).max(80).default("UTC"),
  slotMinutes: z.coerce.number().int().min(5).max(240).optional()
});

const appointmentBaseSchema = z.object({
  customerId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  staffUserId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(3000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  timezone: z.string().trim().min(1).max(80).default("UTC"),
  status: appointmentStatusSchema.default("SCHEDULED"),
  source: appointmentSourceSchema.default("MANUAL"),
  customerName: z.string().trim().max(160).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  customerEmail: z.string().trim().email().optional(),
  location: z.string().trim().max(500).optional(),
  reminderScheduledAt: z.coerce.date().optional()
});

export const appointmentInputSchema = appointmentBaseSchema.refine((input) => input.endsAt === undefined || input.endsAt > input.startsAt, {
  path: ["endsAt"],
  message: "Appointment end time must be after start time"
});

export const appointmentUpdateSchema = appointmentBaseSchema.partial().extend({
  cancellationReason: z.string().trim().max(1000).optional()
}).refine((input) => {
  if (!input.startsAt || !input.endsAt) {
    return true;
  }

  return input.endsAt > input.startsAt;
}, {
  path: ["endsAt"],
  message: "Appointment end time must be after start time"
});

export const appointmentsQuerySchema = paginationQuerySchema.extend({
  customerId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  staffUserId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  status: appointmentStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "startsAt", "status"]).default("startsAt")
});

export const appointmentReminderSchema = z.object({
  channel: z.enum(["SIMULATOR", "WHATSAPP", "INTERNAL"]).default("INTERNAL"),
  message: z.string().trim().max(2000).optional(),
  reminderScheduledAt: z.coerce.date().optional()
});

export const aiAppointmentToolSchema = z.object({
  tenantId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  toolName: z.enum([
    "check_available_slots",
    "book_appointment",
    "reschedule_appointment",
    "cancel_appointment"
  ]),
  input: z.record(z.unknown()).default({})
});

export type ServiceOfferingInput = z.infer<typeof serviceOfferingInputSchema>;
export type ServiceOfferingUpdateInput = z.infer<typeof serviceOfferingUpdateSchema>;
export type ServicesQuery = z.infer<typeof servicesQuerySchema>;
export type StaffAvailabilityInput = z.infer<typeof staffAvailabilityInputSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;
export type AppointmentsQuery = z.infer<typeof appointmentsQuerySchema>;
export type AppointmentReminderInput = z.infer<typeof appointmentReminderSchema>;
export type AiAppointmentToolInput = z.infer<typeof aiAppointmentToolSchema>;
