"use client";

import * as React from "react";
import {
  Eraser,
  FileText,
  ImageIcon,
  ListChecks,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send
} from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useAuth } from "@/components/auth/auth-provider";
import { apiClient, ApiClientError } from "@/lib/api-client";

type SimulatorCustomer = {
  id: string;
  name: string | null;
  phone: string;
  status: string;
  createdAt: string;
};

type SimulatorMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: string;
  type: string;
  status: string;
  text: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

type SimulatorConversation = {
  id: string;
  status: string;
  subject: string | null;
  lastMessageAt: string | null;
  customer: {
    id: string;
    name: string | null;
    phone: string;
  };
  messages: SimulatorMessage[];
};

const messageTypes = [
  { value: "text", label: "Text", icon: MessageSquareText },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "document", label: "Document", icon: FileText },
  { value: "button_reply", label: "Button", icon: ListChecks },
  { value: "list_reply", label: "List", icon: ListChecks }
] as const;

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

export default function SimulatorPage() {
  const { activeTenant } = useAuth();
  const [customers, setCustomers] = React.useState<SimulatorCustomer[]>([]);
  const [conversations, setConversations] = React.useState<SimulatorConversation[]>([]);
  const [selectedPhone, setSelectedPhone] = React.useState("");
  const [customerName, setCustomerName] = React.useState("Demo Customer");
  const [customerPhone, setCustomerPhone] = React.useState("+15550100001");
  const [messageType, setMessageType] = React.useState<(typeof messageTypes)[number]["value"]>("text");
  const [messageText, setMessageText] = React.useState("Hi, do you have this item in stock?");
  const [mediaUrl, setMediaUrl] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedConversation = conversations.find(
    (conversation) => conversation.customer.phone === selectedPhone
  );

  async function loadSimulator() {
    setLoading(true);
    setError(null);

    try {
      const [nextCustomers, nextConversations] = await Promise.all([
        apiClient.get<SimulatorCustomer[]>("/simulator/customers"),
        apiClient.get<SimulatorConversation[]>("/simulator/conversations")
      ]);

      setCustomers(nextCustomers);
      setConversations(nextConversations);
      setSelectedPhone((current) => current || nextCustomers[0]?.phone || "");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadSimulator();
  }, []);

  async function createCustomer() {
    setSubmitting(true);
    setError(null);

    try {
      const customer = await apiClient.post<SimulatorCustomer>("/simulator/customers", {
        name: customerName,
        phone: customerPhone
      });
      setSelectedPhone(customer.phone);
      await loadSimulator();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendIncomingMessage() {
    const phone = selectedPhone || customerPhone;
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/simulator/incoming-message", {
        phone,
        name: customerName,
        type: messageType,
        text: messageType === "text" ? messageText : undefined,
        mediaUrl: messageType === "image" || messageType === "document" ? mediaUrl : undefined,
        interactivePayload:
          messageType === "button_reply" || messageType === "list_reply"
            ? {
                id: "simulator-choice",
                title: messageText || "Selected option"
              }
            : undefined
      });
      setSelectedPhone(phone);
      await loadSimulator();
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendOutgoingMessage(status: "sent" | "delivered" | "read" = "sent") {
    if (!selectedConversation) {
      setError("Select or create a conversation before sending an outgoing message.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/simulator/outgoing-message", {
        conversationId: selectedConversation.id,
        type: "text",
        text: "Manual simulator reply from the business.",
        status
      });
      await loadSimulator();
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSubmitting(false);
    }
  }

  async function resetSimulator() {
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/simulator/reset");
      setCustomers([]);
      setConversations([]);
      setSelectedPhone("");
      await loadSimulator();
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Development simulator"
        title="Fake WhatsApp simulator"
        description="Send tenant-scoped fake WhatsApp messages through the same internal message processing service that the real Cloud API webhook will use later."
        action={
          <Button type="button" variant="outline" onClick={loadSimulator} disabled={loading || submitting}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
        meta={
          <>
            <StatusBadge tone="info">No Meta approval required</StatusBadge>
            <StatusBadge tone="success">{activeTenant?.name ?? "Active tenant"}</StatusBadge>
          </>
        }
      />

      {error ? (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create fake customer</CardTitle>
              <CardDescription>Creates a tenant-scoped simulator customer by phone number.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Phone</span>
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <Button type="button" className="w-full" onClick={createCustomer} disabled={submitting}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create customer
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fake customers</CardTitle>
              <CardDescription>Select a customer to inspect the message timeline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {customers.length ? (
                customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedPhone(customer.phone)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                      selectedPhone === customer.phone ? "bg-accent text-foreground" : "bg-background"
                    }`}
                  >
                    <span className="block font-medium">{customer.name ?? "Unnamed customer"}</span>
                    <span className="block text-xs text-muted-foreground">{customer.phone}</span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No simulator customers yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send test message</CardTitle>
              <CardDescription>Incoming messages create customers and conversations automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-5">
                {messageTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setMessageType(type.value)}
                      className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs transition-colors hover:bg-accent ${
                        messageType === type.value ? "bg-accent text-foreground" : "bg-background text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {type.label}
                    </button>
                  );
                })}
              </div>

              <label className="block text-sm">
                <span className="font-medium">Message text or reply title</span>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring/20"
                />
              </label>

              {(messageType === "image" || messageType === "document") && (
                <label className="block text-sm">
                  <span className="font-medium">Media URL</span>
                  <input
                    value={mediaUrl}
                    onChange={(event) => setMediaUrl(event.target.value)}
                    placeholder="https://example.com/file.png"
                    className="mt-2 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </label>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={sendIncomingMessage} disabled={submitting}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send incoming
                </Button>
                <Button type="button" variant="outline" onClick={() => sendOutgoingMessage("delivered")} disabled={submitting}>
                  Fake delivered reply
                </Button>
                <Button type="button" variant="outline" onClick={() => sendOutgoingMessage("read")} disabled={submitting}>
                  Fake read reply
                </Button>
                <Button type="button" variant="outline" onClick={resetSimulator} disabled={submitting}>
                  <Eraser className="h-4 w-4" aria-hidden="true" />
                  Reset simulator
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message timeline</CardTitle>
              <CardDescription>
                Inbound and outbound records are stored in the real tenant message tables.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedConversation?.messages.length ? (
                <div className="space-y-3">
                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-lg border px-4 py-3 text-sm shadow-sm ${
                          message.direction === "OUTBOUND"
                            ? "bg-foreground text-background"
                            : "bg-background text-foreground"
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs opacity-80">
                          <span>{message.senderType}</span>
                          <span>/</span>
                          <span>{message.type}</span>
                          <span>/</span>
                          <span>{message.status}</span>
                        </div>
                        <p>{message.text ?? message.mediaUrl ?? "No content"}</p>
                        <p className="mt-2 text-xs opacity-70">{new Date(message.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={MessageSquareText}
                  title="No simulator messages"
                  description="Create a fake customer and send an incoming message to create the first conversation."
                  actionLabel="Send a message"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
