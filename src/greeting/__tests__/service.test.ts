/**
 * Service tests - tests the orchestration layer.
 *
 * @see Rule #15, #18-24
 */
import { describe, expect, it } from "vitest";
import { processGreeting } from "../service.js";

describe("processGreeting", () => {
  const requestId = "550e8400-e29b-41d4-a716-446655440000";

  it("successfully processes valid greeting request", () => {
    const result = processGreeting({ name: "World" }, requestId);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.message).toContain("Hello, World!");
      expect(result.value.requestId).toBe(requestId);
    }
  });

  it("returns validation error for missing name", () => {
    const result = processGreeting({}, requestId);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_FAILED");
    }
  });

  it("returns validation error for empty name", () => {
    const result = processGreeting({ name: "" }, requestId);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_FAILED");
    }
  });

  it("returns validation error for name too long", () => {
    const longName = "a".repeat(101);
    const result = processGreeting({ name: longName }, requestId);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_FAILED");
    }
  });

  it("returns forbidden error for blacklisted names", () => {
    const result = processGreeting({ name: "ErrorBot" }, requestId);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("NAME_FORBIDDEN");
    }
  });

  it("handles non-object input", () => {
    const result = processGreeting("invalid", requestId);

    expect(result.isErr()).toBe(true);
  });

  it("handles null input", () => {
    const result = processGreeting(null, requestId);

    expect(result.isErr()).toBe(true);
  });
});
