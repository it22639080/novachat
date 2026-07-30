import { describe, expect, it } from "vitest";
import { inboxConversationQuerySchema } from "./inbox.js";

describe("inboxConversationQuerySchema", () => {
  it("accepts the production inbox conversation query", () => {
    const parsed = inboxConversationQuerySchema.parse({
      page: "1",
      pageSize: "30",
      sortBy: "lastMessageAt",
      sortDirection: "desc",
      status: "OPEN"
    });

    expect(parsed).toMatchObject({
      page: 1,
      pageSize: 30,
      sortBy: "lastMessageAt",
      sortDirection: "desc",
      status: "OPEN"
    });
  });

  it("normalizes browser query string edge cases", () => {
    const parsed = inboxConversationQuerySchema.parse({
      page: "1",
      pageSize: "30",
      search: "",
      sortBy: "lastMessageAt",
      sortDirection: "DESC",
      status: "open",
      assigneeId: "",
      unread: "false",
      tagId: "",
      dateFrom: "",
      dateTo: ""
    });

    expect(parsed).toMatchObject({
      page: 1,
      pageSize: 30,
      sortBy: "lastMessageAt",
      sortDirection: "desc",
      status: "OPEN",
      unread: false
    });
    expect(parsed.search).toBeUndefined();
    expect(parsed.assigneeId).toBeUndefined();
    expect(parsed.tagId).toBeUndefined();
    expect(parsed.dateFrom).toBeUndefined();
    expect(parsed.dateTo).toBeUndefined();
  });
});
