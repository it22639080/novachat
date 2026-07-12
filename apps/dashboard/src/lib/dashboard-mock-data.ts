import {
  Activity,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  Inbox,
  Megaphone,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UsersRound,
  Workflow
} from "lucide-react";

export const overviewStats = [
  {
    title: "Total conversations",
    value: "18,420",
    detail: "+12.8% from last week",
    tone: "blue",
    icon: Inbox
  },
  {
    title: "New leads",
    value: "642",
    detail: "118 qualified by AI",
    tone: "green",
    icon: Workflow
  },
  {
    title: "AI handled chats",
    value: "72%",
    detail: "4.6 min saved per thread",
    tone: "purple",
    icon: Bot
  },
  {
    title: "Human handovers",
    value: "216",
    detail: "-8.4% with better routing",
    tone: "amber",
    icon: UsersRound
  },
  {
    title: "Revenue",
    value: "$48.2k",
    detail: "From chat-assisted sales",
    tone: "green",
    icon: ShoppingBag
  },
  {
    title: "Conversion rate",
    value: "18.6%",
    detail: "+3.1 pts from campaigns",
    tone: "blue",
    icon: TrendingUp
  },
  {
    title: "Avg response time",
    value: "42s",
    detail: "Across AI and agents",
    tone: "purple",
    icon: Clock3
  },
  {
    title: "Campaign performance",
    value: "31.4%",
    detail: "Click-through on active sends",
    tone: "amber",
    icon: Megaphone
  }
] as const;

export const salesChartData = [
  { day: "Mon", revenue: 6200, conversations: 180, leads: 44 },
  { day: "Tue", revenue: 7400, conversations: 220, leads: 52 },
  { day: "Wed", revenue: 6800, conversations: 204, leads: 48 },
  { day: "Thu", revenue: 9200, conversations: 286, leads: 76 },
  { day: "Fri", revenue: 11000, conversations: 310, leads: 92 },
  { day: "Sat", revenue: 8600, conversations: 260, leads: 64 },
  { day: "Sun", revenue: 10400, conversations: 302, leads: 81 }
];

export const pipelineStages = [
  { label: "New", value: 128, color: "bg-sky-500" },
  { label: "Qualified", value: 82, color: "bg-violet-500" },
  { label: "Proposal", value: 46, color: "bg-emerald-500" },
  { label: "Won", value: 31, color: "bg-teal-500" }
];

export const recentConversations = [
  {
    customer: "Maya Fernando",
    channel: "WhatsApp",
    status: "AI active",
    time: "2m ago",
    summary: "Asked for delivery options on linen dresses."
  },
  {
    customer: "Ravi Stores",
    channel: "WhatsApp",
    status: "Needs agent",
    time: "9m ago",
    summary: "Bulk order quote needs manager approval."
  },
  {
    customer: "Nadia Perera",
    channel: "WhatsApp",
    status: "Resolved",
    time: "18m ago",
    summary: "Appointment booked for bridal consultation."
  }
];

export const activityTimeline = [
  {
    title: "AI assistant resolved 42 conversations",
    description: "Refund, size guide, and delivery intents were handled automatically.",
    time: "10 minutes ago"
  },
  {
    title: "Campaign audience synced",
    description: "1,284 opted-in contacts refreshed for the weekend drop.",
    time: "36 minutes ago"
  },
  {
    title: "Manager approved bulk order",
    description: "Ravi Stores moved from proposal to won.",
    time: "1 hour ago"
  }
];

export const teamAvatars = [
  { name: "Amara Silva", initials: "AS" },
  { name: "Ravi Jay", initials: "RJ" },
  { name: "Nadia P", initials: "NP" },
  { name: "Maya F", initials: "MF" }
];

export const featurePages = {
  inbox: {
    eyebrow: "Inbox",
    title: "Shared WhatsApp inbox",
    description:
      "Manage active conversations, AI handoffs, internal notes, assignments, and customer context from one tenant-safe queue.",
    icon: Inbox,
    action: "Connect channel",
    emptyTitle: "No active inbox traffic",
    emptyDescription:
      "Verified WhatsApp conversations will appear here with assignment, priority, SLA, and status controls.",
    tableTitle: "Priority conversations",
    columns: ["Customer", "Intent", "Owner", "Status"],
    rows: [
      ["Maya Fernando", "Delivery question", "AI assistant", "AI active"],
      ["Ravi Stores", "Bulk quote", "Kasun", "Needs agent"],
      ["Nadia Perera", "Booking", "AI assistant", "Resolved"]
    ]
  },
  customers: {
    eyebrow: "Customers",
    title: "Customer profiles",
    description:
      "Unify phone identity, tags, lead history, orders, bookings, and consent records for every tenant customer.",
    icon: UsersRound,
    action: "Import customers",
    emptyTitle: "No customers imported",
    emptyDescription: "Customer records can be created from compliant imports, inbound messages, or checkout flows.",
    tableTitle: "Recent customers",
    columns: ["Name", "Segment", "Last activity", "Status"],
    rows: [
      ["Maya Fernando", "Retail", "2m ago", "Active"],
      ["Ravi Stores", "Wholesale", "9m ago", "Qualified"],
      ["Nadia Perera", "VIP", "18m ago", "Booked"]
    ]
  },
  leads: {
    eyebrow: "Leads CRM",
    title: "Sales pipeline",
    description:
      "Track leads, stage movement, owners, estimated value, and source attribution from chat-first sales journeys.",
    icon: Workflow,
    action: "Create lead",
    emptyTitle: "No lead pipeline yet",
    emptyDescription: "Qualified WhatsApp leads and manually created deals will move through configured stages here.",
    tableTitle: "High intent leads",
    columns: ["Lead", "Stage", "Value", "Owner"],
    rows: [
      ["Ravi Stores", "Proposal", "$4,200", "Kasun"],
      ["Luxe Bridal", "Qualified", "$1,800", "Amara"],
      ["Maya Fernando", "New", "$160", "AI assistant"]
    ]
  },
  "ai-assistant": {
    eyebrow: "AI Assistant",
    title: "Assistant operations",
    description:
      "Monitor AI coverage, fallback behavior, safety logs, model usage, and tenant-approved automation boundaries.",
    icon: Sparkles,
    action: "Configure assistant",
    emptyTitle: "No assistant published",
    emptyDescription: "AI assistants will answer with tenant-scoped knowledge, policies, and conversation context.",
    tableTitle: "Assistant intents",
    columns: ["Intent", "Automation", "Confidence", "Status"],
    rows: [
      ["Delivery ETA", "Auto reply", "94%", "Live"],
      ["Returns", "Policy answer", "91%", "Live"],
      ["Bulk pricing", "Agent handoff", "78%", "Review"]
    ]
  },
  "knowledge-base": {
    eyebrow: "Knowledge Base",
    title: "Tenant knowledge",
    description:
      "Organize approved documents, chunks, embeddings, sync status, and retrieval readiness for future RAG workflows.",
    icon: Database,
    action: "Upload document",
    emptyTitle: "No knowledge uploaded",
    emptyDescription: "Documents will be chunked, embedded with pgvector, and filtered by tenant before retrieval.",
    tableTitle: "Knowledge sources",
    columns: ["Source", "Chunks", "Last sync", "Status"],
    rows: [
      ["Shipping policy", "42", "Today", "Indexed"],
      ["Return policy", "28", "Today", "Indexed"],
      ["Product catalog FAQ", "96", "Yesterday", "Review"]
    ]
  },
  "chatbot-builder": {
    eyebrow: "Chatbot Builder",
    title: "Conversation flows",
    description:
      "Design chatbot paths, handoff rules, qualification steps, and automation triggers before publishing to channels.",
    icon: Bot,
    action: "Create flow",
    emptyTitle: "No chatbot flow published",
    emptyDescription: "Build flows with safe handoffs, approval gates, and tenant-specific knowledge boundaries.",
    tableTitle: "Draft flows",
    columns: ["Flow", "Trigger", "Conversion", "Status"],
    rows: [
      ["Order assistant", "Product question", "18.6%", "Draft"],
      ["Booking concierge", "Appointment intent", "24.2%", "Live"],
      ["Lead qualifier", "Campaign reply", "31.4%", "Review"]
    ]
  },
  campaigns: {
    eyebrow: "Campaigns",
    title: "WhatsApp campaigns",
    description:
      "Plan compliant broadcasts, segment recipients, track delivery quality, and measure downstream revenue.",
    icon: Megaphone,
    action: "New campaign",
    emptyTitle: "No campaigns scheduled",
    emptyDescription: "Campaigns will show delivery, clicks, replies, opt-outs, and revenue attribution.",
    tableTitle: "Campaign performance",
    columns: ["Campaign", "Audience", "CTR", "Status"],
    rows: [
      ["Weekend drop", "1,284", "31.4%", "Scheduled"],
      ["VIP bridal edit", "420", "38.2%", "Live"],
      ["Winback flow", "890", "14.8%", "Draft"]
    ]
  },
  products: {
    eyebrow: "Products",
    title: "Commerce catalog",
    description:
      "Manage products, categories, stock hints, pricing, and chat-assisted selling context for AI and agents.",
    icon: Package,
    action: "Add product",
    emptyTitle: "No products yet",
    emptyDescription: "Products can power assisted checkout, order capture, and product-aware AI answers.",
    tableTitle: "Top products",
    columns: ["Product", "Category", "Revenue", "Status"],
    rows: [
      ["Linen wrap dress", "Dresses", "$12.4k", "Active"],
      ["Silk scarf", "Accessories", "$4.8k", "Active"],
      ["Bridal consultation", "Service", "$9.1k", "Featured"]
    ]
  },
  orders: {
    eyebrow: "Orders",
    title: "Chat commerce orders",
    description:
      "Track orders captured from WhatsApp, agent-assisted checkout, payment state, and fulfillment progress.",
    icon: ShoppingBag,
    action: "Create order",
    emptyTitle: "No orders captured",
    emptyDescription: "Orders from chat, catalogs, and assisted checkout will be visible here.",
    tableTitle: "Recent orders",
    columns: ["Order", "Customer", "Total", "Status"],
    rows: [
      ["#NC-1042", "Maya Fernando", "$162", "Paid"],
      ["#NC-1041", "Ravi Stores", "$4,200", "Pending"],
      ["#NC-1040", "Nadia Perera", "$320", "Confirmed"]
    ]
  },
  appointments: {
    eyebrow: "Appointments",
    title: "Bookings calendar",
    description:
      "Coordinate appointments, reminders, staff assignment, booking source, and customer conversation history.",
    icon: CalendarDays,
    action: "New appointment",
    emptyTitle: "No appointments booked",
    emptyDescription: "Bookings created by agents, AI flows, or customer self-service will appear here.",
    tableTitle: "Upcoming bookings",
    columns: ["Customer", "Service", "Time", "Status"],
    rows: [
      ["Nadia Perera", "Bridal consultation", "Today 3:30 PM", "Confirmed"],
      ["Maya Fernando", "Style session", "Tomorrow 10:00 AM", "Pending"],
      ["Ravi Stores", "Wholesale call", "Fri 2:00 PM", "Confirmed"]
    ]
  },
  analytics: {
    eyebrow: "Analytics",
    title: "Business analytics",
    description:
      "Measure conversation volume, conversion, AI containment, response time, revenue, and campaign performance.",
    icon: Activity,
    action: "Export report",
    emptyTitle: "No analytics events yet",
    emptyDescription: "Analytics will become richer as conversations, campaigns, and orders flow through the tenant.",
    tableTitle: "Key metrics",
    columns: ["Metric", "Current", "Previous", "Trend"],
    rows: [
      ["AI containment", "72%", "64%", "Up"],
      ["Lead conversion", "18.6%", "15.5%", "Up"],
      ["Average response", "42s", "58s", "Better"]
    ]
  },
  team: {
    eyebrow: "Team",
    title: "Team and roles",
    description:
      "Invite members, assign roles, inspect access boundaries, and keep role changes auditable per tenant.",
    icon: UsersRound,
    action: "Invite member",
    emptyTitle: "No additional members",
    emptyDescription: "Owners and admins can invite managers, agents, and viewers with tenant-scoped roles.",
    tableTitle: "Team members",
    columns: ["Member", "Role", "Status", "Last active"],
    rows: [
      ["Amara Silva", "Owner", "Active", "Now"],
      ["Kasun Jay", "Manager", "Active", "12m ago"],
      ["Nadia P", "Agent", "Active", "1h ago"]
    ]
  },
  settings: {
    eyebrow: "Settings",
    title: "Workspace settings",
    description:
      "Control tenant profile, notification policy, channel readiness, security defaults, and operational preferences.",
    icon: CheckCircle2,
    action: "Save settings",
    emptyTitle: "Settings are ready",
    emptyDescription: "Configuration pages will connect to tenant-safe APIs in the relevant backend phase.",
    tableTitle: "Configuration areas",
    columns: ["Area", "Owner", "Status", "Updated"],
    rows: [
      ["Tenant profile", "Owner", "Ready", "Today"],
      ["Security policy", "Admin", "Ready", "Today"],
      ["Notifications", "Manager", "Draft", "Yesterday"]
    ]
  },
  billing: {
    eyebrow: "Billing",
    title: "Plan and billing",
    description:
      "Track subscription state, invoices, usage, payment history, and plan limits for the active tenant.",
    icon: CreditCard,
    action: "Manage plan",
    emptyTitle: "No billing activity yet",
    emptyDescription: "Invoices, usage limits, and payment records will appear once billing is connected.",
    tableTitle: "Billing summary",
    columns: ["Item", "Usage", "Limit", "Status"],
    rows: [
      ["Conversations", "18,420", "25,000", "Healthy"],
      ["AI replies", "12,840", "20,000", "Healthy"],
      ["Team seats", "7", "10", "Healthy"]
    ]
  }
} as const;
