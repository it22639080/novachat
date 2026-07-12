import { describe, expect, it } from "vitest";
import { paginationQuerySchema } from "./pagination";

describe("paginationQuerySchema", () => {
  it("applies production-safe defaults", () => {
    const parsed = paginationQuerySchema.parse({});

    expect(parsed).toEqual({
      page: 1,
      pageSize: 20,
      sortDirection: "desc"
    });
  });

  it("caps page size at 100", () => {
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });
});
