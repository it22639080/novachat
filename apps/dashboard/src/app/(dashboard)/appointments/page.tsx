"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Scissors,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { Badge, Button, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ApiClientError, apiClient } from "@/lib/api-client";

type PaginatedResult<T> = {
  items: T[];
  pagination: { total: number };
};

type Assignee = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type ServiceOffering = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number | null;
  currency: "USD" | "LKR" | "INR" | "EUR" | "GBP";
  isActive: boolean;
};

type StaffAvailability = {
  id: string;
  staffUserId: string;
  staff: { id: string; name: string | null; email: string };
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isActive: boolean;
};

type Appointment = {
  id: string;
  customerId: string | null;
  serviceId: string | null;
  staffUserId: string | null;
  conversationId: string | null;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  source: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  location: string | null;
  reminderScheduledAt: string | null;
  reminderSentAt: string | null;
  service: ServiceOffering | null;
  staff: { id: string; name: string | null; email: string } | null;
  timeline: Array<{ id: string; type: string; message: string; createdAt: string }>;
};

type SlotResult = {
  date: string;
  timezone: string;
  durationMinutes: number;
  slots: Array<{
    staffUserId: string;
    staffName: string | null;
    startsAt: string;
    endsAt: string;
    available: boolean;
  }>;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateTimeLocal(value: Date) {
  return value.toISOString().slice(0, 16);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusVariant(status: Appointment["status"]) {
  if (status === "CONFIRMED" || status === "COMPLETED") return "success";
  if (status === "SCHEDULED") return "warning";
  return "neutral";
}

export default function AppointmentsPage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [services, setServices] = React.useState<ServiceOffering[]>([]);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [availability, setAvailability] = React.useState<StaffAvailability[]>([]);
  const [assignees, setAssignees] = React.useState<Assignee[]>([]);
  const [slots, setSlots] = React.useState<SlotResult | null>(null);
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [date, setDate] = React.useState(todayInputValue());
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [serviceForm, setServiceForm] = React.useState({
    name: "",
    durationMinutes: "30",
    price: "",
    currency: "LKR",
    description: ""
  });
  const [availabilityForm, setAvailabilityForm] = React.useState({
    staffUserId: "",
    dayOfWeek: String(new Date().getDay()),
    startsAt: "09:00",
    endsAt: "17:00",
    timezone: "Asia/Colombo"
  });
  const [appointmentForm, setAppointmentForm] = React.useState({
    title: "",
    customerName: "",
    customerPhone: "",
    serviceId: "",
    staffUserId: "",
    startsAt: toDateTimeLocal(new Date()),
    location: "",
    timezone: "Asia/Colombo"
  });

  const loadData = React.useCallback(async () => {
    if (!tenantId) {
      setMessage("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const from = new Date(`${date}T00:00:00.000Z`);
    const to = new Date(`${date}T23:59:59.999Z`);
    const params = new URLSearchParams({
      page: "1",
      pageSize: "100",
      sortBy: "startsAt",
      sortDirection: "asc",
      from: from.toISOString(),
      to: to.toISOString()
    });
    if (query.trim()) params.set("search", query.trim());

    try {
      const [serviceResult, appointmentResult, availabilityResult, assigneeResult] = await Promise.all([
        apiClient.get<PaginatedResult<ServiceOffering>>("/services?page=1&pageSize=100&isActive=true", { tenantId }),
        apiClient.get<PaginatedResult<Appointment>>(`/appointments?${params.toString()}`, { tenantId }),
        apiClient.get<StaffAvailability[]>("/staff-availability", { tenantId }),
        apiClient.get<Assignee[]>("/inbox/assignees", { tenantId })
      ]);
      setServices(serviceResult.items);
      setAppointments(appointmentResult.items);
      setAvailability(availabilityResult);
      setAssignees(assigneeResult);
      setSelectedAppointment((current) =>
        current ? appointmentResult.items.find((item) => item.id === current.id) ?? null : appointmentResult.items[0] ?? null
      );
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not load appointment data.");
    } finally {
      setLoading(false);
    }
  }, [date, query, tenantId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    try {
      await apiClient.post(
        "/services",
        {
          name: serviceForm.name,
          durationMinutes: Number(serviceForm.durationMinutes),
          price: serviceForm.price ? Number(serviceForm.price) : undefined,
          currency: serviceForm.currency,
          description: serviceForm.description || undefined,
          isActive: true
        },
        { tenantId }
      );
      setServiceForm({ name: "", durationMinutes: "30", price: "", currency: "LKR", description: "" });
      await loadData();
      setMessage("Service saved.");
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not save service.");
    } finally {
      setSaving(false);
    }
  }

  async function createAvailability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId || !availabilityForm.staffUserId) return;
    setSaving(true);
    try {
      await apiClient.post(
        "/staff-availability",
        {
          staffUserId: availabilityForm.staffUserId,
          dayOfWeek: Number(availabilityForm.dayOfWeek),
          startsAt: availabilityForm.startsAt,
          endsAt: availabilityForm.endsAt,
          timezone: availabilityForm.timezone,
          isActive: true
        },
        { tenantId }
      );
      await loadData();
      setMessage("Staff availability saved.");
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not save staff availability.");
    } finally {
      setSaving(false);
    }
  }

  async function checkSlots() {
    if (!tenantId || !appointmentForm.staffUserId) {
      setMessage("Select a staff member before checking slots.");
      return;
    }
    const params = new URLSearchParams({
      date,
      staffUserId: appointmentForm.staffUserId,
      timezone: appointmentForm.timezone
    });
    if (appointmentForm.serviceId) params.set("serviceId", appointmentForm.serviceId);
    const result = await apiClient.get<SlotResult>(`/appointments/availability?${params.toString()}`, { tenantId });
    setSlots(result);
  }

  async function createAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    try {
      const service = services.find((item) => item.id === appointmentForm.serviceId);
      const startsAt = new Date(appointmentForm.startsAt);
      const endsAt = new Date(startsAt.getTime() + (service?.durationMinutes ?? 30) * 60_000);
      const appointment = await apiClient.post<Appointment>(
        "/appointments",
        {
          title: appointmentForm.title || service?.name || "Appointment",
          customerName: appointmentForm.customerName || undefined,
          customerPhone: appointmentForm.customerPhone || undefined,
          serviceId: appointmentForm.serviceId || undefined,
          staffUserId: appointmentForm.staffUserId || undefined,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: appointmentForm.timezone,
          location: appointmentForm.location || undefined,
          status: "SCHEDULED",
          source: "MANUAL"
        },
        { tenantId }
      );
      setSelectedAppointment(appointment);
      await loadData();
      setMessage("Appointment booked.");
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not book appointment.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppointment(appointmentId: string) {
    if (!tenantId) return;
    await apiClient.delete(`/appointments/${appointmentId}`, { tenantId });
    await loadData();
    setMessage("Appointment cancelled.");
  }

  async function sendReminder(appointmentId: string) {
    if (!tenantId) return;
    await apiClient.post(`/appointments/${appointmentId}/send-reminder`, { channel: "INTERNAL" }, { tenantId });
    await loadData();
    setMessage("Reminder scheduled.");
  }

  const customerHistory = selectedAppointment
    ? appointments.filter((item) =>
        selectedAppointment.customerId
          ? item.customerId === selectedAppointment.customerId
          : item.customerPhone && item.customerPhone === selectedAppointment.customerPhone
      )
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            Calendar / Appointments
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage service bookings, staff availability, reminders, and customer appointment history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            aria-label="Calendar date"
          />
          <Button type="button" variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {message ? <div className="rounded-lg border bg-card px-4 py-3 text-sm">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Daily calendar</h2>
              </div>
              <label className="relative block w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search customer, phone, appointment"
                  className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>
            <div className="divide-y">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="p-4">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="mt-2 h-4 w-80" />
                  </div>
                ))
              ) : appointments.length ? (
                appointments.map((appointment) => (
                  <motion.button
                    key={appointment.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedAppointment(appointment)}
                    className="grid w-full gap-3 p-4 text-left transition hover:bg-muted/40 lg:grid-cols-[120px_minmax(0,1fr)_130px_110px]"
                  >
                    <div className="text-sm">
                      <p className="font-semibold">{formatTime(appointment.startsAt).split(",").pop()?.trim()}</p>
                      <p className="text-muted-foreground">{formatTime(appointment.endsAt).split(",").pop()?.trim()}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{appointment.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {appointment.customerName ?? "No customer"} · {appointment.service?.name ?? "No service"}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">{appointment.staff?.name ?? appointment.staff?.email ?? "Unassigned"}</p>
                    <Badge variant={statusVariant(appointment.status)}>{appointment.status}</Badge>
                  </motion.button>
                ))
              ) : (
                <div className="p-8">
                  <EmptyState icon={CalendarDays} title="No appointments for this date" description="Create a booking or adjust staff availability to open slots." />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <form onSubmit={createService} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Service management</h2>
              </div>
              <div className="mt-4 space-y-3">
                <input required value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} placeholder="Service name" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" min="5" value={serviceForm.durationMinutes} onChange={(event) => setServiceForm({ ...serviceForm, durationMinutes: event.target.value })} placeholder="Minutes" className="h-10 rounded-md border bg-background px-3 text-sm" />
                  <input type="number" min="0" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} placeholder="Price" className="h-10 rounded-md border bg-background px-3 text-sm" />
                  <select value={serviceForm.currency} onChange={(event) => setServiceForm({ ...serviceForm, currency: event.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Currency">
                    <option value="LKR">LKR</option>
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="Description" className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" />
                <Button type="submit" className="w-full" disabled={saving}><Plus className="h-4 w-4" />Save service</Button>
              </div>
              <div className="mt-4 space-y-2">
                {services.slice(0, 5).map((service) => (
                  <div key={service.id} className="rounded-md border p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{service.name}</span>
                      <span className="text-muted-foreground">{service.durationMinutes}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </form>

            <form onSubmit={createAvailability} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Staff availability</h2>
              </div>
              <div className="mt-4 space-y-3">
                <select required value={availabilityForm.staffUserId} onChange={(event) => setAvailabilityForm({ ...availabilityForm, staffUserId: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Staff member">
                  <option value="">Select staff</option>
                  {assignees.map((item) => <option key={item.id} value={item.id}>{item.name ?? item.email}</option>)}
                </select>
                <select value={availabilityForm.dayOfWeek} onChange={(event) => setAvailabilityForm({ ...availabilityForm, dayOfWeek: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Day of week">
                  {dayNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={availabilityForm.startsAt} onChange={(event) => setAvailabilityForm({ ...availabilityForm, startsAt: event.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" />
                  <input type="time" value={availabilityForm.endsAt} onChange={(event) => setAvailabilityForm({ ...availabilityForm, endsAt: event.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" />
                </div>
                <Button type="submit" className="w-full" disabled={saving}><Plus className="h-4 w-4" />Save availability</Button>
              </div>
              <div className="mt-4 space-y-2">
                {availability.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{item.staff.name ?? item.staff.email}</p>
                    <p className="text-muted-foreground">{dayNames[item.dayOfWeek]} · {item.startsAt}-{item.endsAt}</p>
                  </div>
                ))}
              </div>
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <form onSubmit={createAppointment} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Create appointment</h2>
            </div>
            <div className="mt-4 space-y-3">
              <input value={appointmentForm.title} onChange={(event) => setAppointmentForm({ ...appointmentForm, title: event.target.value })} placeholder="Appointment title" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <input value={appointmentForm.customerName} onChange={(event) => setAppointmentForm({ ...appointmentForm, customerName: event.target.value })} placeholder="Customer name" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <input value={appointmentForm.customerPhone} onChange={(event) => setAppointmentForm({ ...appointmentForm, customerPhone: event.target.value })} placeholder="Contact number" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <select value={appointmentForm.serviceId} onChange={(event) => setAppointmentForm({ ...appointmentForm, serviceId: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Service">
                <option value="">Select service</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes}m</option>)}
              </select>
              <select value={appointmentForm.staffUserId} onChange={(event) => setAppointmentForm({ ...appointmentForm, staffUserId: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Staff">
                <option value="">Select staff</option>
                {assignees.map((item) => <option key={item.id} value={item.id}>{item.name ?? item.email}</option>)}
              </select>
              <input type="datetime-local" value={appointmentForm.startsAt} onChange={(event) => setAppointmentForm({ ...appointmentForm, startsAt: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <input value={appointmentForm.location} onChange={(event) => setAppointmentForm({ ...appointmentForm, location: event.target.value })} placeholder="Location or meeting link" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => void checkSlots()}>
                  <Clock3 className="h-4 w-4" />Slots
                </Button>
                <Button type="submit" disabled={saving}>Book</Button>
              </div>
            </div>
            {slots ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {slots.slots.slice(0, 8).map((slot) => (
                  <button
                    key={`${slot.staffUserId}-${slot.startsAt}`}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setAppointmentForm({ ...appointmentForm, startsAt: slot.startsAt.slice(0, 16) })}
                    className="rounded-md border px-2 py-2 text-xs disabled:opacity-40"
                  >
                    {formatTime(slot.startsAt).split(",").pop()?.trim()}
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            {selectedAppointment ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{selectedAppointment.title}</p>
                    <p className="text-sm text-muted-foreground">{formatTime(selectedAppointment.startsAt)}</p>
                  </div>
                  <Badge variant={statusVariant(selectedAppointment.status)}>{selectedAppointment.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border p-3"><p className="text-muted-foreground">Customer</p><p className="mt-1 font-semibold">{selectedAppointment.customerName ?? "Not set"}</p></div>
                  <div className="rounded-md border p-3"><p className="text-muted-foreground">Staff</p><p className="mt-1 font-semibold">{selectedAppointment.staff?.name ?? selectedAppointment.staff?.email ?? "Unassigned"}</p></div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => void sendReminder(selectedAppointment.id)}>
                    <Bell className="h-4 w-4" />Reminder
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => void cancelAppointment(selectedAppointment.id)}>
                    <X className="h-4 w-4" />Cancel
                  </Button>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Customer history</h3>
                  <div className="mt-3 space-y-2">
                    {customerHistory.length ? customerHistory.map((item) => (
                      <div key={item.id} className="rounded-md border p-3 text-xs">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground">{formatTime(item.startsAt)} · {item.status}</p>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No previous appointments on this date.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Timeline</h3>
                  <div className="mt-3 space-y-2">
                    {selectedAppointment.timeline.length ? selectedAppointment.timeline.map((event) => (
                      <div key={event.id} className="rounded-md border p-3 text-xs">
                        <p className="font-medium">{event.type}</p>
                        <p className="text-muted-foreground">{event.message}</p>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No timeline events yet.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={UserRound} title="Select an appointment" description="Customer details, reminder controls, and timeline appear here." />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
