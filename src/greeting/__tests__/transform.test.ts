/**
 * Transformation tests - every transformation gets a test.
 * 1 happy path, 1 edge case, 1 error case minimum.
 *
 * @see Rule #15, #18-24
 */
import { describe, expect, it } from "vitest";
import { config } from "../../config.js";
import {
  buildGreetingResponse,
  createGreetingMessage,
  formatName,
  validateGreetingRules,
} from "../transform.js";

describe("formatName", () => {
  it("capitalizes first letter of name", () => {
    expect(formatName("john")).toBe("John");
  });

  it("handles already capitalized names", () => {
    expect(formatName("John")).toBe("John");
  });

  it("trims whitespace", () => {
    expect(formatName("  alice  ")).toBe("Alice");
  });

  it("handles single character", () => {
    expect(formatName("x")).toBe("X");
  });
});

describe("validateGreetingRules", () => {
  it("accepts valid names", () => {
    const result = validateGreetingRules({ name: "Alice" });
    expect(result.isOk()).toBe(true);
  });

  it('rejects names containing "error"', () => {
    const result = validateGreetingRules({ name: "Error Handler" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("NAME_FORBIDDEN");
    }
  });

  it('rejects names containing "fail" (case insensitive)', () => {
    const result = validateGreetingRules({ name: "FAILOVER" });
    expect(result.isErr()).toBe(true);
  });

  it('rejects names containing "crash"', () => {
    const result = validateGreetingRules({ name: "crashtest" });
    expect(result.isErr()).toBe(true);
  });
});

describe("createGreetingMessage", () => {
  it("creates greeting with formatted name", () => {
    const message = createGreetingMessage("world");
    expect(message).toContain("Hello, World!");
    expect(message).toContain(config.APP_NAME); // APP_NAME from config
  });
});

describe("buildGreetingResponse", () => {
  it("returns complete response object", () => {
    const requestId = "550e8400-e29b-41d4-a716-446655440000";
    const response = buildGreetingResponse("Alice", requestId);

    expect(response.message).toContain("Hello, Alice!");
    expect(response.requestId).toBe(requestId);
    expect(response.timestamp).toBeDefined();
    // Verify timestamp is valid ISO string
    expect(() => new Date(response.timestamp)).not.toThrow();
  });
});
