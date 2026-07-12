import { Prisma, prisma } from "@novachat/database";
import type {
  AiAppointmentToolInput,
  AppointmentInput,
  AppointmentReminderInput,
  AppointmentsQuery,
  AppointmentUpdateInput,
  AvailabilityQuery,
  ServiceOfferingInput,
  ServicesQuery,
  ServiceOfferingUpdateInput,
  StaffAvailabilityInput
} from "@novachat/shared-types";
import { badRequest, conflict, forbidden, notFound } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";

type Actor = {
  userId?: string | null;
};

const bookableStatuses = ["SCHEDULED", "CONFIRMED"] as const;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function dateTimeFromDayAndMinute(date: string, minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60).toString().padStart(2, "0");
  const minutes = (minuteOfDay % 60).toString().padStart(2, "0");
  return new Date(`${date}T${hours}:${minutes}:00.000Z`);
}

function utcDayOfWeek(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function serializeService(service: ServiceRecord) {
  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    durationMinutes: service.durationMinutes,
    price: toNumber(service.price),
    currency: service.currency,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    isActive: service.isActive,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString()
  };
}

function serializeAvailability(availability: AvailabilityRecord) {
  return {
    id: availability.id,
    staffUserId: availability.staffUserId,
    staff: availability.staff,
    dayOfWeek: availability.dayOfWeek,
    startsAt: availability.startsAt,
    endsAt: availability.endsAt,
    timezone: availability.timezone,
    isActive: availability.isActive,
    metadata: availability.metadata,
    createdAt: availability.createdAt.toISOString(),
    updatedAt: availability.updatedAt.toISOString()
  };
}

function serializeAppointment(appointment: AppointmentRecord) {
  return {
    id: appointment.id,
    customerId: appointment.customerId,
    serviceId: appointment.serviceId,
    staffUserId: appointment.staffUserId,
    conversationId: appointment.conversationId,
    title: appointment.title,
    description: appointment.description,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    timezone: appointment.timezone,
    status: appointment.status,
    source: appointment.source,
    customerName: appointment.customerName ?? appointment.customer?.name ?? null,
    customerPhone: appointment.customerPhone ?? appointment.customer?.phone ?? null,
    customerEmail: appointment.customerEmail ?? appointment.customer?.email ?? null,
    location: appointment.location,
    reminderScheduledAt: appointment.reminderScheduledAt?.toISOString() ?? null,
    reminderSentAt: appointment.reminderSentAt?.toISOString() ?? null,
    googleCalendarEventId: appointment.googleCalendarEventId,
    googleCalendarSyncStatus: appointment.googleCalendarSyncStatus,
    cancellationReason: appointment.cancellationReason,
    service: appointment.service ? serializeService(appointment.service) : null,
    staff: appointment.staff,
    customer: appointment.customer,
    timeline: appointment.timeline.map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString()
    })),
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString()
  };
}

const serviceInclude = {} satisfies Prisma.ServiceOfferingInclude;

type ServiceRecord = Prisma.ServiceOfferingGetPayload<{
  include: typeof serviceInclude;
}>;

const availabilityInclude = {
  staff: { select: { id: true, name: true, email: true } }
};

type AvailabilityRecord = Prisma.StaffAvailabilityGetPayload<{
  include: typeof availabilityInclude;
}>;

const appointmentInclude = {
  service: { include: serviceInclude },
  staff: { select: { id: true, name: true, email: true } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  timeline: { where: { deletedAt: null }, orderBy: { createdAt: "asc" as const } }
};

type AppointmentRecord = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

async function appointmentWithRelations(id: string) {
  return prisma.appointment.findUniqueOrThrow({
    where: { id },
    include: appointmentInclude
  });
}

async function assertStaffMembership(tenantId: string, staffUserId: string) {
  const member = await prisma.tenantMember.findFirst({
    where: { tenantId, userId: staffUserId, deletedAt: null },
    select: { id: true }
  });

  if (!member) {
    throw notFound("Staff member not found in this tenant");
  }
}

async function assertService(tenantId: string, serviceId: string | undefined) {
  if (!serviceId) {
    return null;
  }

  const service = await prisma.serviceOffering.findFirst({
    where: { id: serviceId, tenantId, deletedAt: null }
  });

  if (!service) {
    throw notFound("Service not found");
  }

  return service;
}

async function assertCustomer(tenantId: string, customerId: string | undefined) {
  if (!customerId) {
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, deletedAt: null },
    select: { id: true }
  });

  if (!customer) {
    throw notFound("Customer not found");
  }
}

async function assertConversation(tenantId: string, conversationId: string | undefined) {
  if (!conversationId) {
    return;
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId, deletedAt: null },
    select: { id: true }
  });

  if (!conversation) {
    throw notFound("Conversation not found");
  }
}

async function assertNoOverlap(params: {
  tenantId: string;
  staffUserId?: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeAppointmentId?: string;
}) {
  if (!params.staffUserId) {
    return;
  }

  const existing = await prisma.appointment.findFirst({
    where: {
      tenantId: params.tenantId,
      staffUserId: params.staffUserId,
      status: { in: [...bookableStatuses] },
      deletedAt: null,
      ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
      startsAt: { lt: params.endsAt },
      endsAt: { gt: params.startsAt }
    },
    select: { id: true }
  });

  if (existing) {
    throw conflict("This staff member already has an appointment in that time slot");
  }
}

export class AppointmentService {
  async services(tenantId: string, query: ServicesQuery) {
    const pagination = createPagination(query);
    const where: Prisma.ServiceOfferingWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.serviceOffering.findMany({
        where,
        include: serviceInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.serviceOffering.count({ where })
    ]);

    return { items: items.map(serializeService), pagination: pagination.meta(total) };
  }

  async createService(tenantId: string, input: ServiceOfferingInput) {
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    const service = await prisma.serviceOffering.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {
        name: input.name,
        ...(input.description !== undefined ? { description: input.description } : {}),
        durationMinutes: input.durationMinutes,
        ...(input.price !== undefined ? { price: input.price } : {}),
        currency: input.currency,
        bufferBeforeMinutes: input.bufferBeforeMinutes,
        bufferAfterMinutes: input.bufferAfterMinutes,
        isActive: input.isActive,
        deletedAt: null
      },
      create: {
        tenantId,
        name: input.name,
        slug,
        ...(input.description !== undefined ? { description: input.description } : {}),
        durationMinutes: input.durationMinutes,
        ...(input.price !== undefined ? { price: input.price } : {}),
        currency: input.currency,
        bufferBeforeMinutes: input.bufferBeforeMinutes,
        bufferAfterMinutes: input.bufferAfterMinutes,
        isActive: input.isActive
      },
      include: serviceInclude
    });

    return serializeService(service);
  }

  async updateService(tenantId: string, serviceId: string, input: ServiceOfferingUpdateInput) {
    const service = await prisma.serviceOffering.findFirst({
      where: { id: serviceId, tenantId, deletedAt: null }
    });

    if (!service) {
      throw notFound("Service not found");
    }

    const updated = await prisma.serviceOffering.update({
      where: { id: serviceId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.bufferBeforeMinutes !== undefined ? { bufferBeforeMinutes: input.bufferBeforeMinutes } : {}),
        ...(input.bufferAfterMinutes !== undefined ? { bufferAfterMinutes: input.bufferAfterMinutes } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      },
      include: serviceInclude
    });

    return serializeService(updated);
  }

  async deleteService(tenantId: string, serviceId: string) {
    const service = await prisma.serviceOffering.findFirst({
      where: { id: serviceId, tenantId, deletedAt: null },
      select: { id: true }
    });

    if (!service) {
      throw notFound("Service not found");
    }

    await prisma.serviceOffering.update({
      where: { id: serviceId },
      data: { deletedAt: new Date(), isActive: false }
    });

    return { deleted: true };
  }

  async staffAvailability(tenantId: string) {
    const items = await prisma.staffAvailability.findMany({
      where: { tenantId, deletedAt: null },
      include: availabilityInclude,
      orderBy: [{ dayOfWeek: "asc" }, { startsAt: "asc" }]
    });

    return items.map(serializeAvailability);
  }

  async createStaffAvailability(tenantId: string, input: StaffAvailabilityInput) {
    await assertStaffMembership(tenantId, input.staffUserId);
    const availability = await prisma.staffAvailability.create({
      data: {
        tenantId,
        staffUserId: input.staffUserId,
        dayOfWeek: input.dayOfWeek,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone,
        isActive: input.isActive,
        ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {})
      },
      include: availabilityInclude
    });

    return serializeAvailability(availability);
  }

  async availability(tenantId: string, query: AvailabilityQuery) {
    const service = await assertService(tenantId, query.serviceId);
    const duration = query.slotMinutes ?? service?.durationMinutes ?? 30;
    const dayOfWeek = utcDayOfWeek(query.date);

    if (query.staffUserId) {
      await assertStaffMembership(tenantId, query.staffUserId);
    }

    const availability = await prisma.staffAvailability.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        dayOfWeek,
        ...(query.staffUserId ? { staffUserId: query.staffUserId } : {})
      },
      include: availabilityInclude,
      orderBy: [{ startsAt: "asc" }]
    });

    const slots: Array<{
      staffUserId: string;
      staffName: string | null;
      startsAt: string;
      endsAt: string;
      available: boolean;
    }> = [];

    for (const window of availability) {
      const windowStart = timeToMinutes(window.startsAt);
      const windowEnd = timeToMinutes(window.endsAt);
      for (let cursor = windowStart; cursor + duration <= windowEnd; cursor += duration) {
        const startsAt = dateTimeFromDayAndMinute(query.date, cursor);
        const endsAt = addMinutes(startsAt, duration);
        const overlap = await prisma.appointment.findFirst({
          where: {
            tenantId,
            staffUserId: window.staffUserId,
            status: { in: [...bookableStatuses] },
            deletedAt: null,
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt }
          },
          select: { id: true }
        });

        slots.push({
          staffUserId: window.staffUserId,
          staffName: window.staff.name,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          available: !overlap
        });
      }
    }

    return {
      date: query.date,
      timezone: query.timezone,
      durationMinutes: duration,
      slots
    };
  }

  async appointments(tenantId: string, query: AppointmentsQuery) {
    const pagination = createPagination(query);
    const where: Prisma.AppointmentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.staffUserId ? { staffUserId: query.staffUserId } : {}),
      ...(query.conversationId ? { conversationId: query.conversationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {})
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { customerName: { contains: query.search, mode: "insensitive" } },
              { customerPhone: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.appointment.count({ where })
    ]);

    return { items: items.map(serializeAppointment), pagination: pagination.meta(total) };
  }

  async createAppointment(tenantId: string, input: AppointmentInput, actor: Actor) {
    return this.saveAppointment(tenantId, input, actor, undefined);
  }

  async updateAppointment(tenantId: string, appointmentId: string, input: AppointmentUpdateInput, actor: Actor) {
    const existing = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId, deletedAt: null }
    });

    if (!existing) {
      throw notFound("Appointment not found");
    }

    if (input.status === "CANCELLED") {
      return this.cancelAppointment(tenantId, appointmentId, input.cancellationReason, actor);
    }

    return this.saveAppointment(tenantId, input, actor, existing);
  }

  async deleteAppointment(tenantId: string, appointmentId: string, actor: Actor) {
    return this.cancelAppointment(tenantId, appointmentId, "Cancelled by staff", actor);
  }

  async sendReminder(tenantId: string, appointmentId: string, input: AppointmentReminderInput, actor: Actor) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId, deletedAt: null }
    });

    if (!appointment) {
      throw notFound("Appointment not found");
    }

    const message =
      input.message ??
      `Reminder: ${appointment.title} is booked for ${appointment.startsAt.toISOString()}.`;

    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          reminderScheduledAt: input.reminderScheduledAt ?? appointment.reminderScheduledAt ?? new Date(),
          ...(input.channel === "INTERNAL" ? { reminderSentAt: new Date() } : {})
        }
      }),
      prisma.appointmentTimelineEvent.create({
        data: {
          tenantId,
          appointmentId,
          actorUserId: actor.userId ?? null,
          type: "REMINDER_SCHEDULED",
          message: `Reminder scheduled via ${input.channel}`,
          metadata: { channel: input.channel, message } as Prisma.InputJsonValue
        }
      })
    ]);

    return {
      scheduled: true,
      channel: input.channel,
      message,
      googleCalendar: {
        status: "PLACEHOLDER",
        message: "Google Calendar sync will be connected in a future integration phase."
      }
    };
  }

  private async saveAppointment(
    tenantId: string,
    input: AppointmentInput | AppointmentUpdateInput,
    actor: Actor,
    existing: { id: string; startsAt: Date; endsAt: Date } | undefined
  ) {
    const service = await assertService(tenantId, input.serviceId);
    await assertCustomer(tenantId, input.customerId);
    await assertConversation(tenantId, input.conversationId);
    if (input.staffUserId) {
      await assertStaffMembership(tenantId, input.staffUserId);
    }

    const startsAt = input.startsAt ?? existing?.startsAt;
    if (!startsAt) {
      throw badRequest("Appointment start time is required");
    }

    const duration = service?.durationMinutes ?? 30;
    const endsAt = input.endsAt ?? existing?.endsAt ?? addMinutes(startsAt, duration);
    if (endsAt <= startsAt) {
      throw badRequest("Appointment end time must be after start time");
    }

    await assertNoOverlap({
      tenantId,
      startsAt,
      endsAt,
      ...(input.staffUserId !== undefined ? { staffUserId: input.staffUserId } : {}),
      ...(existing?.id ? { excludeAppointmentId: existing.id } : {})
    });

    const appointmentId = await prisma.$transaction(async (tx) => {
      const data: Prisma.AppointmentUncheckedCreateInput | Prisma.AppointmentUncheckedUpdateInput = {
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.serviceId !== undefined ? { serviceId: input.serviceId } : {}),
        ...(input.staffUserId !== undefined ? { staffUserId: input.staffUserId } : {}),
        ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        startsAt,
        endsAt,
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
        ...(input.customerPhone !== undefined ? { customerPhone: input.customerPhone } : {}),
        ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.reminderScheduledAt !== undefined ? { reminderScheduledAt: input.reminderScheduledAt } : {})
      };

      const appointment = existing
        ? await tx.appointment.update({
            where: { id: existing.id },
            data: data as Prisma.AppointmentUncheckedUpdateInput
          })
        : await tx.appointment.create({
            data: {
              tenantId,
              title: "Appointment",
              timezone: "UTC",
              ...data
            } as Prisma.AppointmentUncheckedCreateInput
          });

      await tx.appointmentTimelineEvent.create({
        data: {
          tenantId,
          appointmentId: appointment.id,
          actorUserId: actor.userId ?? null,
          type: existing ? "APPOINTMENT_RESCHEDULED" : "APPOINTMENT_BOOKED",
          message: existing ? "Appointment updated or rescheduled" : "Appointment booked"
        }
      });

      return appointment.id;
    });

    return serializeAppointment(await appointmentWithRelations(appointmentId));
  }

  private async cancelAppointment(
    tenantId: string,
    appointmentId: string,
    reason: string | undefined,
    actor: Actor
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId, deletedAt: null }
    });

    if (!appointment) {
      throw notFound("Appointment not found");
    }

    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "CANCELLED",
          cancellationReason: reason ?? "Cancelled"
        }
      }),
      prisma.appointmentTimelineEvent.create({
        data: {
          tenantId,
          appointmentId,
          actorUserId: actor.userId ?? null,
          type: "APPOINTMENT_CANCELLED",
          message: reason ?? "Appointment cancelled"
        }
      })
    ]);

    return serializeAppointment(await appointmentWithRelations(appointmentId));
  }
}

export class AiAppointmentToolService {
  private readonly appointments = new AppointmentService();

  async execute(tenantId: string, input: AiAppointmentToolInput, actor?: Actor) {
    const logInput = input.input as Prisma.InputJsonValue;
    try {
      const result = await this.executeTool(tenantId, input);
      await prisma.aiToolCallLog.create({
        data: {
          tenantId,
          actorUserId: actor?.userId ?? null,
          conversationId: input.conversationId ?? null,
          appointmentId: typeof result === "object" && result && "id" in result ? String(result.id) : null,
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
          status: error instanceof Error && error.message.includes("confirm") ? "BLOCKED" : "FAILED",
          input: logInput,
          error: error instanceof Error ? error.message : "AI appointment tool failed"
        }
      });
      throw error;
    }
  }

  private async executeTool(tenantId: string, tool: AiAppointmentToolInput) {
    if (tool.toolName === "check_available_slots") {
      return this.appointments.availability(tenantId, {
        date: String(tool.input.date ?? ""),
        serviceId: typeof tool.input.serviceId === "string" ? tool.input.serviceId : undefined,
        staffUserId: typeof tool.input.staffUserId === "string" ? tool.input.staffUserId : undefined,
        timezone: typeof tool.input.timezone === "string" ? tool.input.timezone : "UTC",
        slotMinutes: typeof tool.input.slotMinutes === "number" ? tool.input.slotMinutes : undefined
      });
    }

    if (tool.toolName === "book_appointment") {
      this.assertAiBookingConfirmed(tool.input);
      return this.appointments.createAppointment(
        tenantId,
        {
          ...(tool.input as AppointmentInput),
          source: "AI",
          conversationId: tool.conversationId ?? (tool.input.conversationId as string | undefined)
        },
        { userId: null }
      );
    }

    if (tool.toolName === "reschedule_appointment") {
      const appointmentId = String(tool.input.appointmentId ?? "");
      if (!tool.input.confirmed) {
        throw forbidden("AI must confirm the new appointment date and time before rescheduling");
      }
      return this.appointments.updateAppointment(
        tenantId,
        appointmentId,
        tool.input as AppointmentUpdateInput,
        { userId: null }
      );
    }

    if (tool.toolName === "cancel_appointment") {
      const appointmentId = String(tool.input.appointmentId ?? "");
      if (!tool.input.confirmed) {
        throw forbidden("AI must confirm cancellation with the customer before cancelling");
      }
      return this.appointments.deleteAppointment(tenantId, appointmentId, { userId: null });
    }

    throw badRequest("Unsupported AI appointment tool");
  }

  private assertAiBookingConfirmed(input: Record<string, unknown>) {
    const missing = [
      ["confirmed", input.confirmed === true],
      ["startsAt", typeof input.startsAt === "string" || input.startsAt instanceof Date],
      ["customerName", typeof input.customerName === "string" && input.customerName.trim().length > 0],
      ["customerPhone", typeof input.customerPhone === "string" && input.customerPhone.trim().length > 0],
      ["staffUserId", typeof input.staffUserId === "string" && input.staffUserId.trim().length > 0]
    ]
      .filter(([, ok]) => !ok)
      .map(([field]) => field);

    if (missing.length) {
      throw forbidden(
        `AI must confirm date, time, customer name, contact number, and staff availability before booking. Missing: ${missing.join(", ")}`
      );
    }
  }
}
