"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Boxes, ImageIcon, PackagePlus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Badge, Button, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ApiClientError, apiClient } from "@/lib/api-client";

type Product = {
  id: string;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  sku: string | null;
  name: string;
  description: string | null;
  price: number;
  currency: "USD" | "LKR" | "INR" | "EUR" | "GBP";
  stockQuantity: number;
  status: "DRAFT" | "ACTIVE" | "OUT_OF_STOCK" | "ARCHIVED";
  isActive: boolean;
  images: Array<{ id: string; url: string; alt: string | null; position: number }>;
  updatedAt: string;
};

type Category = { id: string; name: string; slug: string };
type PaginatedResult<T> = { items: T[]; pagination: { total: number } };

const emptyForm = {
  name: "",
  sku: "",
  categoryName: "",
  description: "",
  price: "0",
  currency: "LKR",
  stockQuantity: "0",
  imageUrl: ""
};

function money(product: Product) {
  return `${product.currency} ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function productStatusVariant(status: Product["status"]) {
  if (status === "ACTIVE") return "success";
  if (status === "OUT_OF_STOCK") return "warning";
  return "neutral";
}

export default function ProductsPage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("ACTIVE");
  const [form, setForm] = React.useState(emptyForm);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadProducts = React.useCallback(async () => {
    if (!tenantId) {
      setMessage("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({
      page: "1",
      pageSize: "50",
      sortBy: "createdAt",
      sortDirection: "desc"
    });
    if (query.trim()) params.set("search", query.trim());
    if (status !== "ALL") params.set("status", status);

    try {
      const [productResult, categoryResult] = await Promise.all([
        apiClient.get<PaginatedResult<Product>>(`/products?${params.toString()}`, { tenantId }),
        apiClient.get<Category[]>("/product-categories", { tenantId })
      ]);
      setProducts(productResult.items);
      setCategories(categoryResult);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, [query, status, tenantId]);

  React.useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    try {
      await apiClient.post(
        "/products",
        {
          name: form.name,
          sku: form.sku || undefined,
          categoryName: form.categoryName || undefined,
          description: form.description || undefined,
          price: Number(form.price),
          currency: form.currency,
          stockQuantity: Number(form.stockQuantity),
          status: Number(form.stockQuantity) > 0 ? "ACTIVE" : "OUT_OF_STOCK",
          images: form.imageUrl ? [{ url: form.imageUrl, alt: form.name, position: 0 }] : []
        },
        { tenantId }
      );
      setForm(emptyForm);
      setMessage("Product saved.");
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(productId: string) {
    if (!tenantId) return;
    await apiClient.delete(`/products/${productId}`, { tenantId });
    await loadProducts();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            Commerce / Catalog
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the catalog AI and agents use for chat-assisted selling.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadProducts()}>
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
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, SKU, description"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              aria-label="Filter products by status"
            >
              <option value="ACTIVE">Active</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
              <option value="DRAFT">Draft</option>
              <option value="ALL">All products</option>
            </select>
          </div>

          <div className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))
            ) : products.length ? (
              products.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid gap-3 p-4 lg:grid-cols-[56px_minmax(0,1fr)_120px_120px_90px]"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {product.images[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.images[0].url} alt={product.images[0].alt ?? product.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{product.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {product.sku ?? "No SKU"} · {product.category?.name ?? "Uncategorized"}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">{money(product)}</p>
                    <p className="text-muted-foreground">Price</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">{product.stockQuantity}</p>
                    <p className="text-muted-foreground">Stock</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={productStatusVariant(product.status)}>{product.status}</Badge>
                    <Button type="button" size="icon" variant="ghost" onClick={() => void archiveProduct(product.id)} aria-label="Archive product">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-8">
                <EmptyState icon={Boxes} title="No products found" description="Create the first sellable item for this tenant catalog." />
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <form onSubmit={createProduct} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Add product</h2>
            </div>
            <div className="mt-4 space-y-3">
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Product name" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="SKU" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <input list="categories" value={form.categoryName} onChange={(event) => setForm({ ...form, categoryName: event.target.value })} placeholder="Category" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <datalist id="categories">
                {categories.map((category) => <option key={category.id} value={category.name} />)}
              </datalist>
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Short description" className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="Price" className="h-10 rounded-md border bg-background px-3 text-sm" />
                <select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Currency">
                  <option value="LKR">LKR</option>
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <input type="number" min="0" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} placeholder="Stock quantity" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="Image URL" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Save product"}</Button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
