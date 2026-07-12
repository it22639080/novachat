"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, PackageSearch, Plus, RefreshCw, Search, Send } from "lucide-react";
import { Badge, Button, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ApiClientError, apiClient } from "@/lib/api-client";

type Product = { id: string; name: string; sku: string | null; price: number; currency: string; stockQuantity: number };
type Order = {
  id: string;
  orderNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  conversationId: string | null;
  status: "DRAFT" | "PENDING" | "CONFIRMED" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
  paymentStatus: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  deliveryStatus: "NOT_REQUIRED" | "PENDING" | "READY" | "SHIPPED" | "DELIVERED" | "FAILED" | "RETURNED";
  source: string;
  totalAmount: number;
  currency: string;
  requiresApproval: boolean;
  items: Array<{ id: string; productId: string | null; name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  timeline: Array<{ id: string; type: string; message: string; createdAt: string }>;
  createdAt: string;
};
type PaginatedResult<T> = { items: T[]; pagination: { total: number } };

function statusVariant(status: Order["status"]) {
  if (["CONFIRMED", "PAID", "FULFILLED"].includes(status)) return "success";
  if (status === "PENDING") return "warning";
  return "neutral";
}

function formatMoney(order: Pick<Order, "currency" | "totalAmount">) {
  return `${order.currency} ${order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function OrdersPage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    customerName: "",
    customerPhone: "",
    productId: "",
    quantity: "1",
    deliveryAddress: ""
  });

  const loadOrders = React.useCallback(async () => {
    if (!tenantId) {
      setMessage("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ page: "1", pageSize: "50", sortBy: "createdAt", sortDirection: "desc" });
    if (query.trim()) params.set("search", query.trim());
    if (status !== "ALL") params.set("status", status);

    try {
      const [orderResult, productResult] = await Promise.all([
        apiClient.get<PaginatedResult<Order>>(`/orders?${params.toString()}`, { tenantId }),
        apiClient.get<PaginatedResult<Product>>("/products?page=1&pageSize=100&status=ACTIVE", { tenantId })
      ]);
      setOrders(orderResult.items);
      setProducts(productResult.items);
      setSelectedOrder((current) => current ? orderResult.items.find((item) => item.id === current.id) ?? null : orderResult.items[0] ?? null);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [query, status, tenantId]);

  React.useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    const product = products.find((item) => item.id === form.productId);
    if (!product) {
      setMessage("Select an active product before creating an order.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post(
        "/orders",
        {
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
          deliveryAddress: form.deliveryAddress || undefined,
          status: "DRAFT",
          paymentStatus: "PENDING",
          deliveryStatus: "PENDING",
          source: "MANUAL",
          currency: product.currency,
          items: [{ productId: product.id, quantity: Number(form.quantity) }]
        },
        { tenantId }
      );
      setForm({ customerName: "", customerPhone: "", productId: "", quantity: "1", deliveryAddress: "" });
      setMessage("Draft order created. Confirm only after customer approval.");
      await loadOrders();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not create order.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmOrder(orderId: string) {
    if (!tenantId) return;
    try {
      const order = await apiClient.post<Order>(`/orders/${orderId}/confirm`, undefined, { tenantId });
      setSelectedOrder(order);
      await loadOrders();
      setMessage("Order confirmed and stock reserved.");
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not confirm order.");
    }
  }

  async function sendConfirmation(orderId: string) {
    if (!tenantId) return;
    await apiClient.post(`/orders/${orderId}/send-confirmation`, { channel: "SIMULATOR" }, { tenantId });
    setMessage("Confirmation queued in the order timeline.");
    await loadOrders();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            Commerce / Orders
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create draft orders from chat demand, confirm after customer approval, and track fulfillment.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadOrders()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {message ? <div className="rounded-lg border bg-card px-4 py-3 text-sm">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, phone" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Filter orders">
              <option value="ALL">All orders</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>
          </div>

          <div className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="p-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-4 w-72" />
                </div>
              ))
            ) : orders.length ? (
              orders.map((order) => (
                <motion.button
                  key={order.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedOrder(order)}
                  className="grid w-full gap-3 p-4 text-left transition hover:bg-muted/40 lg:grid-cols-[minmax(0,1fr)_130px_110px_120px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{order.orderNumber ?? order.id}</p>
                    <p className="truncate text-sm text-muted-foreground">{order.customerName ?? "Walk-in customer"} · {order.customerPhone ?? "No phone"}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(order)}</p>
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                  <p className="text-sm text-muted-foreground">{order.source}</p>
                </motion.button>
              ))
            ) : (
              <div className="p-8">
                <EmptyState icon={FileText} title="No orders yet" description="Create a manual draft or create one from a conversation." />
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <form onSubmit={createOrder} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Create draft order</h2>
            </div>
            <div className="mt-4 space-y-3">
              <input value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="Customer name" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <input value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} placeholder="Customer phone" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Select product">
                <option value="">Select product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.currency} {product.price}</option>)}
              </select>
              <input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="Quantity" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <textarea value={form.deliveryAddress} onChange={(event) => setForm({ ...form, deliveryAddress: event.target.value })} placeholder="Delivery address" className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" />
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "Creating..." : "Create draft"}</Button>
            </div>
          </form>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            {selectedOrder ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{selectedOrder.orderNumber ?? "Order detail"}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.customerName ?? "No customer name"}</p>
                  </div>
                  <Badge variant={statusVariant(selectedOrder.status)}>{selectedOrder.status}</Badge>
                </div>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="rounded-md border p-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <span>{item.quantity} x {item.name}</span>
                        <span className="font-semibold">{selectedOrder.currency} {item.lineTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border p-3"><p className="text-muted-foreground">Payment</p><p className="mt-1 font-semibold">{selectedOrder.paymentStatus}</p></div>
                  <div className="rounded-md border p-3"><p className="text-muted-foreground">Delivery</p><p className="mt-1 font-semibold">{selectedOrder.deliveryStatus}</p></div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" className="flex-1" onClick={() => void confirmOrder(selectedOrder.id)} disabled={!["DRAFT", "PENDING"].includes(selectedOrder.status)}>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => void sendConfirmation(selectedOrder.id)}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Timeline</h3>
                  <div className="mt-3 space-y-2">
                    {selectedOrder.timeline.length ? selectedOrder.timeline.map((event) => (
                      <div key={event.id} className="rounded-md border p-3 text-xs">
                        <p className="font-medium">{event.type}</p>
                        <p className="mt-1 text-muted-foreground">{event.message}</p>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No timeline events yet.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={PackageSearch} title="Select an order" description="Open an order to review items, status, and confirmation actions." />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
