"use client";

import * as React from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  GitBranch,
  Hand,
  ListChecks,
  MessageSquareText,
  Package,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Send,
  Timer,
  UserPlus,
  Workflow
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ApiClientError, apiClient } from "@/lib/api-client";

type NodeKind =
  | "start"
  | "text"
  | "buttons"
  | "list"
  | "question"
  | "condition"
  | "collect_info"
  | "product_selection"
  | "create_order"
  | "appointment_booking"
  | "api_webhook"
  | "human_handover"
  | "delay"
  | "end";

type FlowNodeData = {
  label: string;
  message?: string;
  prompt?: string;
  keyword?: string;
  buttons?: string[];
  items?: string[];
  fallbackMessage?: string;
};

type ChatbotFlow = {
  id: string;
  name: string;
  version: number;
  graph: { nodes: Node<FlowNodeData>[]; edges: Edge[] };
  isActive: boolean;
  createdAt: string;
};

type Chatbot = {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  systemPrompt: string;
  modelProvider: "OPENAI" | "GEMINI";
  modelName: string;
  temperature: number;
  latestFlow: ChatbotFlow | null;
  activeFlow: ChatbotFlow | null;
  updatedAt: string;
};

type Paginated<T> = { items: T[]; pagination: { total: number } };
type TestResult = {
  flow: ChatbotFlow;
  result: {
    handled: boolean;
    replies: string[];
    handover: boolean;
    reason?: string;
    visitedNodeIds: string[];
  };
};

const nodeCatalog: Array<{ type: NodeKind; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: "start", label: "Start", icon: Workflow },
  { type: "text", label: "Text", icon: MessageSquareText },
  { type: "buttons", label: "Buttons", icon: ListChecks },
  { type: "list", label: "List", icon: ListChecks },
  { type: "question", label: "Question", icon: MessageSquareText },
  { type: "condition", label: "Condition", icon: GitBranch },
  { type: "collect_info", label: "Collect info", icon: UserPlus },
  { type: "product_selection", label: "Product select", icon: Package },
  { type: "create_order", label: "Create order", icon: Package },
  { type: "appointment_booking", label: "Appointment", icon: Timer },
  { type: "api_webhook", label: "API webhook", icon: GitBranch },
  { type: "human_handover", label: "Handover", icon: Hand },
  { type: "delay", label: "Delay", icon: Timer },
  { type: "end", label: "End", icon: CheckCircle2 }
];

const defaultNodes: Node<FlowNodeData>[] = [
  {
    id: "start",
    type: "start",
    position: { x: 80, y: 180 },
    data: { label: "Start" }
  },
  {
    id: "welcome",
    type: "text",
    position: { x: 360, y: 160 },
    data: {
      label: "Welcome message",
      message: "Hi! Welcome to NovaChat. How can we help you today?"
    }
  }
];

const defaultEdges: Edge[] = [{ id: "start-welcome", source: "start", target: "welcome" }];

function nodeDefaults(type: NodeKind): FlowNodeData {
  const label = nodeCatalog.find((item) => item.type === type)?.label ?? "Node";

  if (type === "buttons") {
    return { label, message: "Choose an option:", buttons: ["Products", "Appointments", "Talk to agent"] };
  }

  if (type === "list") {
    return { label, message: "Select from this list:", items: ["Pricing", "Services", "Support"] };
  }

  if (type === "question") {
    return { label, message: "Could you share more details?" };
  }

  if (type === "condition") {
    return { label, keyword: "price" };
  }

  if (type === "collect_info") {
    return { label, prompt: "Please share your name and phone number." };
  }

  if (type === "human_handover") {
    return { label, message: "I am handing this to a team member now." };
  }

  if (type === "api_webhook") {
    return { label, fallbackMessage: "I need to check another system. A team member will continue shortly." };
  }

  if (type === "end") {
    return { label, message: "Thanks. We will be here if you need anything else." };
  }

  return { label, message: `${label} response` };
}

function FlowCardNode({ data, type }: NodeProps<Node<FlowNodeData>>) {
  const Icon = nodeCatalog.find((item) => item.type === type)?.icon ?? Bot;
  return (
    <div className="min-w-52 rounded-lg border bg-background shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">{data.label}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{type}</p>
        </div>
      </div>
      <p className="line-clamp-3 px-3 py-2 text-xs text-muted-foreground">
        {data.message ?? data.prompt ?? data.fallbackMessage ?? data.keyword ?? "Configure this node"}
      </p>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}

const nodeTypes = {
  start: FlowCardNode,
  text: FlowCardNode,
  buttons: FlowCardNode,
  list: FlowCardNode,
  question: FlowCardNode,
  condition: FlowCardNode,
  collect_info: FlowCardNode,
  product_selection: FlowCardNode,
  create_order: FlowCardNode,
  appointment_booking: FlowCardNode,
  api_webhook: FlowCardNode,
  human_handover: FlowCardNode,
  delay: FlowCardNode,
  end: FlowCardNode
};

function validationErrors(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  const errors: string[] = [];
  const startCount = nodes.filter((node) => node.type === "start").length;
  const nodeIds = new Set(nodes.map((node) => node.id));

  if (startCount !== 1) errors.push("Flow needs exactly one Start node.");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} points to a missing node.`);
  }
  if (nodes.length > 1 && edges.length === 0) errors.push("Connect the start node to at least one next step.");

  return errors;
}

function errorText(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Something went wrong. Please try again.";
}

export default function ChatbotBuilderPage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [chatbots, setChatbots] = React.useState<Chatbot[]>([]);
  const [activeChatbotId, setActiveChatbotId] = React.useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [flowName, setFlowName] = React.useState("Main support flow");
  const [testMessage, setTestMessage] = React.useState("What services do you offer?");
  const [testResult, setTestResult] = React.useState<TestResult["result"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const activeChatbot = chatbots.find((chatbot) => chatbot.id === activeChatbotId) ?? null;
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const errors = validationErrors(nodes, edges);

  const loadChatbots = React.useCallback(async () => {
    if (!tenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.get<Paginated<Chatbot>>("/chatbots?page=1&pageSize=25&sortBy=updatedAt&sortOrder=desc", {
        tenantId
      });
      setChatbots(result.items);
      const first = result.items[0] ?? null;
      setActiveChatbotId((current) => current ?? (first ? first.id : null));
      if (first?.latestFlow?.graph) {
        setNodes(first.latestFlow.graph.nodes);
        setEdges(first.latestFlow.graph.edges);
        setFlowName(first.latestFlow.name);
      }
      setNotice(null);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [setEdges, setNodes, tenantId]);

  React.useEffect(() => {
    void loadChatbots();
  }, [loadChatbots]);

  function switchChatbot(chatbot: Chatbot) {
    setActiveChatbotId(chatbot.id);
    const graph = chatbot.latestFlow?.graph;
    setNodes(graph?.nodes ?? defaultNodes);
    setEdges(graph?.edges ?? defaultEdges);
    setFlowName(chatbot.latestFlow?.name ?? "Main support flow");
    setSelectedNodeId(null);
    setTestResult(null);
  }

  function addNode(type: NodeKind) {
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
    setNodes((current) => [
      ...current,
      {
        id,
        type,
        position: { x: 220 + current.length * 24, y: 120 + current.length * 18 },
        data: nodeDefaults(type)
      }
    ]);
  }

  function updateSelectedNode(key: keyof FlowNodeData, value: string) {
    if (!selectedNode) return;
    const parsedValue = key === "buttons" || key === "items" ? value.split("\n").map((item) => item.trim()).filter(Boolean) : value;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                [key]: parsedValue
              }
            }
          : node
      )
    );
  }

  async function createChatbot() {
    if (!tenantId) return;
    setSaving(true);
    try {
      const chatbot = await apiClient.post<Chatbot>(
        "/chatbots",
        {
          name: `Support bot ${chatbots.length + 1}`,
          systemPrompt: "Use the published no-code flow before AI fallback.",
          status: "DRAFT",
          modelProvider: "OPENAI",
          modelName: "gpt-4o-mini",
          temperature: 0.2
        },
        { tenantId }
      );
      setChatbots((current) => [chatbot, ...current]);
      switchChatbot(chatbot);
      setNotice("Chatbot created. Build and save the first draft flow.");
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveFlow() {
    if (!tenantId || !activeChatbot) return;
    if (errors.length) {
      setNotice(errors[0] ?? "Fix validation issues before saving.");
      return;
    }

    setSaving(true);
    try {
      const flow = await apiClient.post<ChatbotFlow>(
        `/chatbots/${activeChatbot.id}/flows`,
        {
          name: flowName,
          graph: { nodes, edges }
        },
        { tenantId }
      );
      setChatbots((current) =>
        current.map((chatbot) => (chatbot.id === activeChatbot.id ? { ...chatbot, latestFlow: flow } : chatbot))
      );
      setNotice(`Draft saved as version ${flow.version}.`);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function publishFlow() {
    if (!tenantId || !activeChatbot) return;
    setSaving(true);
    try {
      const result = await apiClient.post<{ chatbot: Chatbot; activeFlow: ChatbotFlow }>(
        `/chatbots/${activeChatbot.id}/publish`,
        undefined,
        { tenantId }
      );
      setChatbots((current) => current.map((chatbot) => (chatbot.id === result.chatbot.id ? result.chatbot : chatbot)));
      setNotice(`Published version ${result.activeFlow.version}. Incoming messages will use this flow before AI fallback.`);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function testFlow() {
    if (!tenantId || !activeChatbot) return;
    setSaving(true);
    try {
      const result = await apiClient.post<TestResult>(
        `/chatbots/${activeChatbot.id}/test`,
        {
          message: testMessage,
          customerName: "Fake Customer",
          customerPhone: "+15550000001"
        },
        { tenantId }
      );
      setTestResult(result.result);
      setNotice(result.result.handled ? "Flow test completed." : "Flow could not continue and would fall back to AI.");
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  const onConnect = React.useCallback(
    (connection: Connection) => setEdges((current) => addEdge({ ...connection, animated: true }, current)),
    [setEdges]
  );

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="neutral" className="mb-3">No-code automation</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Chatbot Builder</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Build tenant-specific conversation flows, publish versions, and test the customer path before AI fallback.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadChatbots()} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => void saveFlow()} disabled={!activeChatbot || saving}>
            <Save className="h-4 w-4" /> Save draft
          </Button>
          <Button onClick={() => void publishFlow()} disabled={!activeChatbot?.latestFlow || saving}>
            <Rocket className="h-4 w-4" /> Publish
          </Button>
        </div>
      </motion.div>

      {notice ? <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
          <Skeleton className="h-[680px]" />
          <Skeleton className="h-[680px]" />
          <Skeleton className="h-[680px]" />
        </div>
      ) : !activeChatbot ? (
        <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-background">
            <Bot className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-base font-semibold">No chatbot yet</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Create a tenant chatbot, then design and publish its first flow.
          </p>
          <Button className="mt-5" onClick={() => void createChatbot()} disabled={saving}>
            <Plus className="h-4 w-4" /> Create chatbot
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bots</CardTitle>
                <CardDescription>Tenant chatbot records and active versions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {chatbots.map((chatbot) => (
                  <button
                    key={chatbot.id}
                    type="button"
                    onClick={() => switchChatbot(chatbot)}
                    className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted ${chatbot.id === activeChatbot.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{chatbot.name}</p>
                      <Badge variant={chatbot.status === "ACTIVE" ? "success" : "neutral"}>{chatbot.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Latest v{chatbot.latestFlow?.version ?? 0} / Active v{chatbot.activeFlow?.version ?? 0}
                    </p>
                  </button>
                ))}
                <Button variant="outline" className="w-full" onClick={() => void createChatbot()} disabled={saving}>
                  <Plus className="h-4 w-4" /> New chatbot
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Node palette</CardTitle>
                <CardDescription>Add steps to the canvas, then connect them.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {nodeCatalog.map((item) => (
                  <Button key={item.type} variant="outline" className="justify-start" onClick={() => addNode(item.type)}>
                    <item.icon className="h-4 w-4" /> {item.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{activeChatbot.name}</CardTitle>
                  <CardDescription>
                    Drag nodes, connect paths, then save a version and publish it.
                  </CardDescription>
                </div>
                <input
                  value={flowName}
                  onChange={(event) => setFlowName(event.target.value)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  aria-label="Flow name"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[680px] bg-muted/20">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  fitView
                >
                  <Background />
                  <Controls />
                  <MiniMap pannable zoomable />
                </ReactFlow>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Node settings</CardTitle>
                <CardDescription>{selectedNode ? `Editing ${selectedNode.data.label}` : "Select a node on the canvas."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedNode ? (
                  <>
                    <label className="block text-sm font-medium">
                      Label
                      <input
                        value={selectedNode.data.label}
                        onChange={(event) => updateSelectedNode("label", event.target.value)}
                        className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                      />
                    </label>
                    {selectedNode.type === "condition" ? (
                      <label className="block text-sm font-medium">
                        Keyword
                        <input
                          value={selectedNode.data.keyword ?? ""}
                          onChange={(event) => updateSelectedNode("keyword", event.target.value)}
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        />
                      </label>
                    ) : null}
                    {selectedNode.type === "api_webhook" ? (
                      <label className="block text-sm font-medium">
                        Fallback message
                        <textarea
                          value={selectedNode.data.fallbackMessage ?? ""}
                          onChange={(event) => updateSelectedNode("fallbackMessage", event.target.value)}
                          className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    ) : null}
                    {selectedNode.type === "collect_info" ? (
                      <label className="block text-sm font-medium">
                        Prompt
                        <textarea
                          value={selectedNode.data.prompt ?? ""}
                          onChange={(event) => updateSelectedNode("prompt", event.target.value)}
                          className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    ) : null}
                    {selectedNode.type !== "start" && selectedNode.type !== "condition" && selectedNode.type !== "collect_info" && selectedNode.type !== "api_webhook" ? (
                      <label className="block text-sm font-medium">
                        Message
                        <textarea
                          value={selectedNode.data.message ?? ""}
                          onChange={(event) => updateSelectedNode("message", event.target.value)}
                          className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    ) : null}
                    {selectedNode.type === "buttons" ? (
                      <label className="block text-sm font-medium">
                        Buttons
                        <textarea
                          value={(selectedNode.data.buttons ?? []).join("\n")}
                          onChange={(event) => updateSelectedNode("buttons", event.target.value)}
                          className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    ) : null}
                    {selectedNode.type === "list" ? (
                      <label className="block text-sm font-medium">
                        List items
                        <textarea
                          value={(selectedNode.data.items ?? []).join("\n")}
                          onChange={(event) => updateSelectedNode("items", event.target.value)}
                          className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    ) : null}
                  </>
                ) : (
                  <EmptyState icon={Workflow} title="No node selected" description="Click a canvas node to edit copy and options." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Validation</CardTitle>
                <CardDescription>Blocking issues before save and publish.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {errors.length ? (
                  errors.map((error) => <p key={error} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-300">{error}</p>)
                ) : (
                  <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-700 dark:text-emerald-300">
                    Flow is valid and ready to save.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Phone preview</CardTitle>
                <CardDescription>Test the published or latest saved flow with a fake customer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={testMessage}
                  onChange={(event) => setTestMessage(event.target.value)}
                  className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button className="w-full" onClick={() => void testFlow()} disabled={!activeChatbot.latestFlow || saving}>
                  <Send className="h-4 w-4" /> Test flow
                </Button>
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <div className="ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {testMessage}
                  </div>
                  <div className="mt-3 space-y-2">
                    {testResult?.replies.length ? (
                      testResult.replies.map((reply, index) => (
                        <div key={`${reply}-${index}`} className="max-w-[90%] whitespace-pre-wrap rounded-2xl bg-background px-3 py-2 text-sm shadow-sm">
                          {reply}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Run a test to see the bot response.</p>
                    )}
                  </div>
                  {testResult ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={testResult.handled ? "success" : "warning"}>{testResult.handled ? "Handled" : "AI fallback"}</Badge>
                      {testResult.handover ? <Badge variant="warning">Human handover</Badge> : null}
                      <Badge variant="neutral">{testResult.reason ?? "completed"}</Badge>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
