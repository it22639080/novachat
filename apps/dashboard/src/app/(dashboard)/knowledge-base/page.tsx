"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Database,
  FileText,
  Globe,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UploadCloud
} from "lucide-react";
import { Badge, Button, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiClientError, apiClient } from "@/lib/api-client";

type KnowledgeDocument = {
  id: string;
  title: string;
  sourceType: "FILE" | "URL";
  sourceUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  status: "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";
  error: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeChunk = {
  id: string;
  documentId: string;
  content: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  position: number;
  score: number;
};

type PaginatedResult<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const tenantMissingMessage = "Tenant/business not selected. Please select or create a business first.";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

function formatBytes(value: number | null) {
  if (!value) {
    return "0 KB";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusVariant(status: KnowledgeDocument["status"]) {
  if (status === "COMPLETED") {
    return "success";
  }

  if (status === "FAILED") {
    return "warning";
  }

  return "neutral";
}

function statusLabel(status: KnowledgeDocument["status"]) {
  if (status === "UPLOADED") {
    return "QUEUED";
  }

  return status;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] ?? "" : value);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function KnowledgeBasePage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [documents, setDocuments] = React.useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [urlTitle, setUrlTitle] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [question, setQuestion] = React.useState("What services do you offer?");
  const [chunks, setChunks] = React.useState<KnowledgeChunk[]>([]);
  const [answer, setAnswer] = React.useState<string | null>(null);

  const loadDocuments = React.useCallback(async () => {
    if (!tenantId) {
      setNotice(tenantMissingMessage);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.get<PaginatedResult<KnowledgeDocument>>(
        "/knowledge/documents?page=1&pageSize=50",
        { tenantId }
      );
      setDocuments(result.items);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error, "Could not load knowledge documents."));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  React.useEffect(() => {
    const hasActiveJobs = documents.some((document) => ["UPLOADED", "PROCESSING"].includes(document.status));

    if (!hasActiveJobs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDocuments();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [documents, loadDocuments]);

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!tenantId) {
      setNotice(tenantMissingMessage);
      return;
    }

    setUploading(true);
    try {
      const contentBase64 = await readFileAsBase64(file);
      await apiClient.post(
        "/knowledge/documents",
        {
          tenantId,
          title: file.name.replace(/\.[^.]+$/, ""),
          sourceType: "FILE",
          fileName: file.name,
          mimeType: file.type || "text/plain",
          contentBase64
        },
        { tenantId }
      );
      setNotice("Document uploaded and queued. Start the worker to process embeddings.");
      await loadDocuments();
    } catch (error) {
      setNotice(errorMessage(error, "Could not upload document."));
    } finally {
      setUploading(false);
    }
  }

  async function addUrl() {
    if (!tenantId) {
      setNotice(tenantMissingMessage);
      return;
    }

    try {
      await apiClient.post(
        "/knowledge/documents",
        {
          tenantId,
          title: urlTitle || sourceUrl,
          sourceType: "URL",
          sourceUrl
        },
        { tenantId }
      );
      setUrlTitle("");
      setSourceUrl("");
      setNotice("URL source added. Processing has started.");
      await loadDocuments();
    } catch (error) {
      setNotice(errorMessage(error, "Could not add URL source."));
    }
  }

  async function reprocess(documentId: string) {
    if (!tenantId) {
      setNotice(tenantMissingMessage);
      return;
    }

    await apiClient.post(`/knowledge/documents/${documentId}/reprocess`, undefined, { tenantId });
    setNotice("Document queued for reprocessing. Start the worker if it is not already running.");
    await loadDocuments();
  }

  async function deleteDocument(documentId: string) {
    if (!tenantId) {
      setNotice(tenantMissingMessage);
      return;
    }

    await apiClient.delete(`/knowledge/documents/${documentId}`, { tenantId });
    setNotice("Document deleted.");
    await loadDocuments();
  }

  async function testSearch() {
    if (!tenantId) {
      setNotice(tenantMissingMessage);
      return;
    }

    try {
      const result = await apiClient.post<{ chunks: KnowledgeChunk[] }>(
        "/knowledge/test-search",
        { tenantId, query: question, topK: 5 },
        { tenantId }
      );
      setChunks(result.chunks);
      setAnswer(null);
    } catch (error) {
      setNotice(errorMessage(error, "Knowledge search failed."));
    }
  }

  async function testAnswer() {
    if (!tenantId) {
      setNotice(tenantMissingMessage);
      return;
    }

    try {
      const result = await apiClient.post<{ answer: string; chunks: KnowledgeChunk[] }>(
        "/knowledge/test-answer",
        { tenantId, query: question, topK: 5 },
        { tenantId }
      );
      setChunks(result.chunks);
      setAnswer(result.answer);
    } catch (error) {
      setNotice(errorMessage(error, "Knowledge answer failed."));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            Tenant RAG Knowledge
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload approved business knowledge, process embeddings, and test retrieval before live automation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadDocuments()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">
            <UploadCloud className="h-4 w-4" />
            {uploading ? "Uploading" : "Upload"}
            <input
              type="file"
              className="sr-only"
              accept=".txt,.csv,.pdf,.docx,text/plain,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => void uploadFile(event)}
            />
          </label>
        </div>
      </div>

      {notice ? <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}
      {documents.some((document) => document.status === "UPLOADED") ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Some documents are queued. Run <span className="font-mono">pnpm dev:worker</span> in a separate terminal to process PDFs and embeddings.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-sm font-semibold">Documents</h2>
            <Badge>{documents.length} sources</Badge>
          </div>
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          ) : documents.length ? (
            <div className="divide-y">
              {documents.map((document) => (
                <motion.div
                  key={document.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {document.sourceType === "URL" ? <Globe className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      <p className="truncate text-sm font-semibold">{document.title}</p>
                      <Badge variant={statusVariant(document.status)}>{statusLabel(document.status)}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {document.sourceUrl ?? document.fileName ?? "Uploaded source"} / {document.chunkCount} chunks /{" "}
                      {formatBytes(document.fileSize)}
                    </p>
                    {document.error ? <p className="mt-1 text-xs text-destructive">{document.error}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void reprocess(document.id)}>
                      <RefreshCw className="h-4 w-4" />
                      Reprocess
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void deleteDocument(document.id)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No knowledge sources yet. Upload a TXT/CSV document or add a website URL.
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Add website URL</h2>
            </div>
            <input
              value={urlTitle}
              onChange={(event) => setUrlTitle(event.target.value)}
              placeholder="Source title"
              className="mt-4 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.com/pricing"
              className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            <Button type="button" className="mt-3 w-full" onClick={() => void addUrl()} disabled={!sourceUrl}>
              <Globe className="h-4 w-4" />
              Add URL source
            </Button>
          </section>

          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Test retrieval</h2>
            </div>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="mt-4 min-h-24 w-full resize-none rounded-md border bg-background p-3 text-sm"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => void testSearch()}>
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button type="button" onClick={() => void testAnswer()}>
                <Send className="h-4 w-4" />
                Answer
              </Button>
            </div>
            {answer ? (
              <div className="mt-4 rounded-lg border bg-background p-3 text-sm leading-6">{answer}</div>
            ) : null}
          </section>
        </aside>
      </div>

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Retrieved sources</h2>
          <Badge>{chunks.length} matches</Badge>
        </div>
        {chunks.length ? (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {chunks.map((chunk) => (
              <div key={chunk.id} className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{chunk.sourceTitle ?? "Knowledge source"}</p>
                  <Badge>{Math.round(chunk.score * 100)}%</Badge>
                </div>
                <p className="mt-3 line-clamp-5 text-sm leading-6 text-muted-foreground">{chunk.content}</p>
                {chunk.sourceUrl ? <p className="mt-3 truncate text-xs text-muted-foreground">{chunk.sourceUrl}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Run a test search to preview the chunks that will be added to AI prompts.
          </div>
        )}
      </section>
    </div>
  );
}
