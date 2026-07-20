"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bot,
  CalendarDays,
  CheckCheck,
  Circle,
  Clock3,
  FileUp,
  Inbox,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  UserRound,
  UsersRound
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { Badge, Button, cn, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { API_ORIGIN, apiClient } from "@/lib/api-client";

type InboxTag = {
  id: string;
  name: string;
  color: string | null;
};

type InboxMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CUSTOMER" | "USER" | "AI" | "SYSTEM";
  type: string;
  status: string;
  text: string | null;
  mediaUrl: string | null;
  metadata: {
    failureReason?: string;
    providerMessageId?: string | null;
  } | null;
  createdAt: string;
};

type InboxConversation = {
  id: string;
  status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
  priority: string;
  subject: string | null;
  assignedUserId: string | null;
  aiEnabled: boolean;
  humanHandover: boolean;
  assignedUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  lastMessageAt: string | null;
  unreadCount: number;
  noteCount: number;
  lastMessage: InboxMessage | null;
  channel: {
    type: "whatsapp";
    accountId: string | null;
    displayName: string;
    phoneNumberId: string | null;
    displayPhoneNumber: string | null;
  };
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string;
    status: string;
    tags: InboxTag[];
  };
};

type ThreadResponse = {
  conversation: InboxConversation;
  messages: InboxMessage[];
  notes: Array<{
    id: string;
    body: string;
    author: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    createdAt: string;
  }>;
};

type PaginatedResult<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type Assignee = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type CustomerOrder = {
  id: string;
  orderNumber: string | null;
  status: "DRAFT" | "PENDING" | "CONFIRMED" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  items: Array<{ id: string; name: string; quantity: number; lineTotal: number }>;
  createdAt: string;
};

type CustomerAppointment = {
  id: string;
  title: string;
  startsAt: string;
  status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  service: { id: string; name: string } | null;
  staff: { id: string; name: string | null; email: string } | null;
};

const statuses = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;

function formatTime(value: string | null) {
  if (!value) {
    return "No activity";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function initials(name: string | null, fallback: string) {
  return (name ?? fallback).slice(0, 2).toUpperCase();
}

function statusVariant(status: InboxConversation["status"]) {
  if (status === "OPEN") {
    return "success";
  }

  if (status === "PENDING") {
    return "warning";
  }

  return "neutral";
}

function outboundDeliveryLabel(message: InboxMessage) {
  const status = message.status.toUpperCase();

  if (status === "FAILED") return "Failed";
  if (status === "QUEUED") return "Queued";
  if (status === "SENDING") return "Sending";
  if (status === "SENT") return "Sent";
  if (status === "DELIVERED") return "Delivered";
  if (status === "READ") return "Read";

  return message.status;
}

function outboundDeliveryClassName(message: InboxMessage) {
  const status = message.status.toUpperCase();

  if (status === "FAILED") return "text-red-400";
  if (status === "QUEUED" || status === "SENDING") return "text-yellow-300";

  return "opacity-70";
}

export default function InboxPage() {
  const { activeTenant } = useAuth();
  const [conversations, setConversations] = React.useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<ThreadResponse | null>(null);
  const [assignees, setAssignees] = React.useState<Assignee[]>([]);
  const [loadingConversations, setLoadingConversations] = React.useState(true);
  const [loadingThread, setLoadingThread] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("OPEN");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [composerMode, setComposerMode] = React.useState<"reply" | "note">("reply");
  const [messageText, setMessageText] = React.useState("");
  const [tagName, setTagName] = React.useState("");
  const [aiEnabled, setAiEnabled] = React.useState(true);
  const [handover, setHandover] = React.useState(false);
  const [customerOrders, setCustomerOrders] = React.useState<CustomerOrder[]>([]);
  const [customerAppointments, setCustomerAppointments] = React.useState<CustomerAppointment[]>([]);
  const [orderDraft, setOrderDraft] = React.useState({ name: "", quantity: "1", unitPrice: "0" });
  const [apiError, setApiError] = React.useState<string | null>(null);
  const selectedIdRef = React.useRef<string | null>(null);

  const loadConversations = React.useCallback(async () => {
    setLoadingConversations(true);
    const params = new URLSearchParams({
      page: "1",
      pageSize: "30",
      sortBy: "lastMessageAt",
      sortDirection: "desc"
    });

    if (query.trim()) {
      params.set("search", query.trim());
    }

    if (statusFilter !== "ALL") {
      params.set("status", statusFilter);
    }

    if (unreadOnly) {
      params.set("unread", "true");
    }

    try {
      const result = await apiClient.get<PaginatedResult<InboxConversation>>(
        `/inbox/conversations?${params.toString()}`
      );
      setApiError(null);
      setConversations(result.items);
      setSelectedId((current) => current ?? result.items[0]?.id ?? null);
    } catch {
      setApiError("API is offline. Start the backend on port 4000, then refresh the inbox.");
    } finally {
      setLoadingConversations(false);
    }
  }, [query, statusFilter, unreadOnly]);

  const loadThread = React.useCallback(async (conversationId: string) => {
    setLoadingThread(true);
    try {
      const result = await apiClient.get<ThreadResponse>(
        `/inbox/conversations/${conversationId}/messages`
      );
      setApiError(null);
      setThread(result);
      if (result.conversation.unreadCount > 0) {
        void apiClient.post(`/inbox/conversations/${conversationId}/read`).catch(() => undefined);
      }
    } catch {
      setApiError("Could not load this conversation. Check that the API is running on port 4000.");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  React.useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  React.useEffect(() => {
    void apiClient
      .get<Assignee[]>("/inbox/assignees")
      .then(setAssignees)
      .catch(() => {
        setApiError("API is offline. Start the backend on port 4000, then refresh the inbox.");
      });
  }, []);

  React.useEffect(() => {
    selectedIdRef.current = selectedId;

    if (selectedId) {
      void loadThread(selectedId);
    } else {
      setThread(null);
    }
  }, [loadThread, selectedId]);

  const selectedConversation = thread?.conversation ?? conversations.find((item) => item.id === selectedId);

  const loadCustomerOrders = React.useCallback(async (conversation: InboxConversation) => {
    if (!activeTenant?.id) {
      return;
    }

    try {
      const result = await apiClient.get<PaginatedResult<CustomerOrder>>(
        `/orders?page=1&pageSize=5&sortBy=createdAt&sortDirection=desc&customerId=${conversation.customer.id}`,
        { tenantId: activeTenant.id }
      );
      setCustomerOrders(result.items);
    } catch {
      setCustomerOrders([]);
    }
  }, [activeTenant?.id]);

  const loadCustomerAppointments = React.useCallback(async (conversation: InboxConversation) => {
    if (!activeTenant?.id) {
      return;
    }

    try {
      const result = await apiClient.get<PaginatedResult<CustomerAppointment>>(
        `/appointments?page=1&pageSize=5&sortBy=startsAt&sortDirection=desc&customerId=${conversation.customer.id}`,
        { tenantId: activeTenant.id }
      );
      setCustomerAppointments(result.items);
    } catch {
      setCustomerAppointments([]);
    }
  }, [activeTenant?.id]);

  React.useEffect(() => {
    if (selectedConversation) {
      setAiEnabled(selectedConversation.aiEnabled);
      setHandover(selectedConversation.humanHandover);
      void loadCustomerOrders(selectedConversation);
      void loadCustomerAppointments(selectedConversation);
    }
  }, [
    loadCustomerAppointments,
    loadCustomerOrders,
    selectedConversation?.id,
    selectedConversation?.aiEnabled,
    selectedConversation?.humanHandover
  ]);

  React.useEffect(() => {
    if (!activeTenant) {
      return undefined;
    }

    const socket: Socket = io(API_ORIGIN, {
      withCredentials: true,
      auth: {
        tenantId: activeTenant.id
      },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    const refreshActiveThread = (payload: { conversationId?: string }) => {
      void loadConversations();

      if (payload.conversationId && payload.conversationId === selectedIdRef.current) {
        void loadThread(payload.conversationId);
      }
    };

    socket.on("message:new", refreshActiveThread);
    socket.on("conversation:updated", refreshActiveThread);
    socket.on("conversation:assigned", refreshActiveThread);
    socket.on("message:read", refreshActiveThread);
    socket.on("note:created", refreshActiveThread);

    return () => {
      socket.off("message:new", refreshActiveThread);
      socket.off("conversation:updated", refreshActiveThread);
      socket.off("conversation:assigned", refreshActiveThread);
      socket.off("message:read", refreshActiveThread);
      socket.off("note:created", refreshActiveThread);
      socket.disconnect();
    };
  }, [activeTenant, loadConversations, loadThread]);

  async function sendComposer() {
    if (!selectedId || !messageText.trim()) {
      return;
    }

    const body = messageText.trim();
    setMessageText("");

    if (composerMode === "note") {
      await apiClient.post(`/inbox/conversations/${selectedId}/notes`, { body });
    } else {
      await apiClient.post(`/inbox/conversations/${selectedId}/messages`, {
        text: body,
        type: "text"
      });
    }

    await loadThread(selectedId);
    await loadConversations();
  }

  async function changeStatus(status: InboxConversation["status"]) {
    if (!selectedId) {
      return;
    }

    await apiClient.patch(`/inbox/conversations/${selectedId}/status`, { status });
    await loadConversations();
    await loadThread(selectedId);
  }

  async function assignConversation(assigneeUserId: string | null) {
    if (!selectedId) {
      return;
    }

    await apiClient.patch(`/inbox/conversations/${selectedId}/assign`, { assigneeUserId });
    await loadConversations();
    await loadThread(selectedId);
  }

  async function addTag() {
    if (!selectedId || !tagName.trim()) {
      return;
    }

    await apiClient.post(`/inbox/conversations/${selectedId}/tags`, {
      name: tagName.trim()
    });
    setTagName("");
    await loadThread(selectedId);
    await loadConversations();
  }

  async function updateAiToggle(next: { aiEnabled?: boolean; humanHandover?: boolean }) {
    if (!selectedId) {
      return;
    }

    if (next.aiEnabled !== undefined) {
      setAiEnabled(next.aiEnabled);
    }

    if (next.humanHandover !== undefined) {
      setHandover(next.humanHandover);
    }

    await apiClient.patch(`/conversations/${selectedId}/ai-toggle`, next);
    await loadThread(selectedId);
    await loadConversations();
  }

  async function removeTag(tagId: string) {
    if (!selectedId) {
      return;
    }

    await apiClient.delete(`/inbox/conversations/${selectedId}/tags/${tagId}`);
    await loadThread(selectedId);
    await loadConversations();
  }

  async function createDraftOrderFromConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversation || !activeTenant?.id || !orderDraft.name.trim()) {
      return;
    }

    await apiClient.post(
      "/orders",
      {
        customerId: selectedConversation.customer.id,
        conversationId: selectedConversation.id,
        customerName: selectedConversation.customer.name ?? undefined,
        customerPhone: selectedConversation.customer.phone,
        customerEmail: selectedConversation.customer.email ?? undefined,
        status: "DRAFT",
        source: "INBOX",
        currency: "LKR",
        items: [
          {
            name: orderDraft.name.trim(),
            quantity: Number(orderDraft.quantity),
            unitPrice: Number(orderDraft.unitPrice)
          }
        ],
        notes: "Draft created from shared inbox. Confirm only after customer approval."
      },
      { tenantId: activeTenant.id }
    );
    setOrderDraft({ name: "", quantity: "1", unitPrice: "0" });
    await loadCustomerOrders(selectedConversation);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
            Realtime shared inbox
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage WhatsApp conversations, assignments, internal notes, and customer context.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void loadConversations()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button type="button">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI assist
          </Button>
        </div>
      </div>

      {apiError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {apiError}
        </div>
      ) : null}

      <div className="grid min-h-[calc(100vh-12rem)] overflow-hidden rounded-lg border bg-card shadow-sm xl:grid-cols-[360px_minmax(0,1fr)_340px]">
        <aside className="border-b xl:border-b-0 xl:border-r">
          <div className="space-y-3 border-b p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                aria-label="Filter conversations by status"
              >
                <option value="ALL">All</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setUnreadOnly((value) => !value)}
                className={cn(
                  "h-9 rounded-md border px-3 text-sm transition-colors",
                  unreadOnly ? "bg-foreground text-background" : "bg-background hover:bg-accent"
                )}
              >
                Unread
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-2">
            {loadingConversations ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  icon={Inbox}
                  title="No conversations"
                  description="New WhatsApp messages from the simulator or Cloud API will appear here."
                />
              </div>
            ) : (
              conversations.map((conversation) => {
                const active = conversation.id === selectedId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedId(conversation.id)}
                    className={cn(
                      "mb-2 w-full rounded-lg border p-3 text-left transition hover:bg-accent",
                      active ? "border-primary/40 bg-accent shadow-sm" : "bg-background"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {initials(conversation.customer.name, conversation.customer.phone)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">
                            {conversation.customer.name ?? conversation.customer.phone}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {conversation.lastMessage?.text ?? "No messages yet"}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                            <Badge variant={statusVariant(conversation.status)}>
                              {conversation.status}
                            </Badge>
                          </div>
                          {conversation.unreadCount > 0 ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col border-b xl:border-b-0 xl:border-r">
          {selectedConversation ? (
            <>
              <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                    {initials(selectedConversation.customer.name, selectedConversation.customer.phone)}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">
                      {selectedConversation.customer.name ?? selectedConversation.customer.phone}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedConversation.channel.displayName} / {selectedConversation.customer.phone}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedConversation.status}
                    onChange={(event) =>
                      void changeStatus(event.target.value as InboxConversation["status"])
                    }
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    aria-label="Change conversation status"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm">
                    <Paperclip className="h-4 w-4" aria-hidden="true" />
                    Media
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/25 p-4">
                {loadingThread ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-2/3 rounded-lg" />
                    <Skeleton className="ml-auto h-12 w-1/2 rounded-lg" />
                    <Skeleton className="h-16 w-3/4 rounded-lg" />
                  </div>
                ) : thread?.messages.length ? (
                  thread.messages.map((message) => {
                    const outbound = message.direction === "OUTBOUND";

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex", outbound ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[82%] rounded-2xl px-4 py-2 shadow-sm md:max-w-[68%]",
                            outbound
                              ? "rounded-br-md bg-foreground text-background"
                              : "rounded-bl-md border bg-background"
                          )}
                        >
                          <div className="flex items-center gap-2 text-[11px] opacity-70">
                            <span>{message.senderType}</span>
                            <span>{formatTime(message.createdAt)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                            {message.text ?? "Media message"}
                          </p>
                          {message.mediaUrl ? (
                            <a
                              href={message.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs underline"
                            >
                              <FileUp className="h-3.5 w-3.5" />
                              Open attachment
                            </a>
                          ) : null}
                          {outbound ? (
                            <div
                              className={cn(
                                "mt-1 flex flex-col items-end gap-1 text-[11px]",
                                outboundDeliveryClassName(message)
                              )}
                            >
                              <span className="inline-flex items-center gap-1">
                                {outboundDeliveryLabel(message)}
                                <CheckCheck className="h-3.5 w-3.5" />
                              </span>
                              {message.status.toUpperCase() === "FAILED" && message.metadata?.failureReason ? (
                                <span className="max-w-64 text-right">
                                  {message.metadata.failureReason}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <EmptyState
                    icon={MessageCircle}
                    title="No messages in this thread"
                    description="Send a reply or use the simulator to add the first customer message."
                  />
                )}
              </div>

              <div className="border-t bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setComposerMode("reply")}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm",
                      composerMode === "reply" ? "bg-foreground text-background" : "bg-muted"
                    )}
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerMode("note")}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm",
                      composerMode === "note" ? "bg-amber-500 text-white" : "bg-muted"
                    )}
                  >
                    Internal note
                  </button>
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder={composerMode === "note" ? "Write a private note" : "Write a WhatsApp reply"}
                    className="min-h-20 flex-1 resize-none rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button type="button" className="h-20 px-4" onClick={() => void sendComposer()}>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={Inbox}
                title="Select a conversation"
                description="Choose a WhatsApp thread from the list to view messages, notes, tags, and assignment."
              />
            </div>
          )}
        </section>

        <aside className="space-y-4 p-4">
          {selectedConversation ? (
            <>
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 text-sm font-semibold text-white">
                    {initials(selectedConversation.customer.name, selectedConversation.customer.phone)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {selectedConversation.customer.name ?? "Unknown customer"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {selectedConversation.customer.phone}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Status</p>
                    <p className="mt-1 font-semibold">{selectedConversation.customer.status}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Notes</p>
                    <p className="mt-1 font-semibold">{thread?.notes.length ?? selectedConversation.noteCount}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Assignment</h3>
                  <UsersRound className="h-4 w-4 text-muted-foreground" />
                </div>
                <select
                  value={selectedConversation.assignedUserId ?? ""}
                  onChange={(event) => void assignConversation(event.target.value || null)}
                  className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  aria-label="Assign conversation"
                >
                  <option value="">Unassigned</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.name ?? assignee.email} ({assignee.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Automation</h3>
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <label className="mt-3 flex items-center justify-between rounded-md border p-3 text-sm">
                  <span>AI enabled</span>
                  <input
                    type="checkbox"
                    checked={aiEnabled}
                    onChange={(event) => void updateAiToggle({ aiEnabled: event.target.checked })}
                  />
                </label>
                <label className="mt-2 flex items-center justify-between rounded-md border p-3 text-sm">
                  <span>Human handover</span>
                  <input
                    type="checkbox"
                    checked={handover}
                    onChange={(event) => void updateAiToggle({ humanHandover: event.target.checked })}
                  />
                </label>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Customer orders</h3>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 space-y-2">
                  {customerOrders.length ? (
                    customerOrders.map((order) => (
                      <div key={order.id} className="rounded-md border p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{order.orderNumber ?? "Draft order"}</p>
                          <Badge variant={order.status === "DRAFT" ? "neutral" : "success"}>{order.status}</Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {order.currency} {order.totalAmount.toLocaleString()} · {order.paymentStatus}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No orders linked to this customer yet.</p>
                  )}
                </div>
                <form onSubmit={createDraftOrderFromConversation} className="mt-3 space-y-2">
                  <input
                    value={orderDraft.name}
                    onChange={(event) => setOrderDraft({ ...orderDraft, name: event.target.value })}
                    placeholder="Item or service"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="1"
                      value={orderDraft.quantity}
                      onChange={(event) => setOrderDraft({ ...orderDraft, quantity: event.target.value })}
                      placeholder="Qty"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={orderDraft.unitPrice}
                      onChange={(event) => setOrderDraft({ ...orderDraft, unitPrice: event.target.value })}
                      placeholder="Price"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full">
                    <Plus className="h-4 w-4" />
                    Create draft order
                  </Button>
                </form>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Appointments</h3>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 space-y-2">
                  {customerAppointments.length ? (
                    customerAppointments.map((appointment) => (
                      <div key={appointment.id} className="rounded-md border p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{appointment.title}</p>
                          <Badge variant={appointment.status === "CANCELLED" ? "neutral" : "success"}>
                            {appointment.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {formatTime(appointment.startsAt)} · {appointment.service?.name ?? "No service"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No appointments linked to this customer yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Tags</h3>
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedConversation.customer.tags.length ? (
                    selectedConversation.customer.tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => void removeTag(tag.id)}
                        className="rounded-full border px-2.5 py-1 text-xs"
                      >
                        {tag.name}
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No tags yet</p>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={tagName}
                    onChange={(event) => setTagName(event.target.value)}
                    placeholder="Add tag"
                    className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                  />
                  <Button type="button" size="icon" variant="outline" onClick={() => void addTag()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Timeline</h3>
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 space-y-3">
                  <TimelineItem icon={MessageCircle} label="Last message" value={formatTime(selectedConversation.lastMessageAt)} />
                  <TimelineItem icon={UserRound} label="Assigned agent" value={selectedConversation.assignedUser?.name ?? "Unassigned"} />
                  <TimelineItem icon={ShieldCheck} label="Channel" value={selectedConversation.channel.displayName} />
                </div>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <h3 className="text-sm font-semibold">Internal notes</h3>
                <div className="mt-3 space-y-2">
                  {thread?.notes.length ? (
                    thread.notes.map((note) => (
                      <div key={note.id} className="rounded-md border bg-muted/30 p-3">
                        <p className="text-sm leading-6">{note.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {note.author?.name ?? note.author?.email ?? "Team"} / {formatTime(note.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No internal notes yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={UserRound}
              title="Customer context"
              description="Customer profile, tags, notes, and timeline appear after selecting a thread."
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function TimelineItem({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
