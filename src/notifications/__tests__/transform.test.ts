/**
 * Notifications Module - Transform Tests
 *
 * Unit tests for pure notification formatting and cooldown functions.
 *
 * @see Rule #15 (Every Transformation Gets a Test)
 */
import { describe, expect, it } from "vitest";

import { COOLDOWN_DURATIONS, INITIAL_COOLDOWN_STATE } from "../schema.js";
import {
  buildWahaRequest,
  createMcbStatusNotification,
  createSafetyShutdownNotification,
  createTemperatureNotification,
  formatMcbStatusMessage,
  formatNotificationMessage,
  formatSafetyShutdownMessage,
  formatTemperatureMessage,
  getSafetyShutdownCooldownRemaining,
  getTemperatureCooldownRemaining,
  isSafetyShutdownAllowed,
  isTemperatureNotificationAllowed,
  phoneToWhatsAppId,
  updateSafetyShutdownCooldown,
  updateTemperatureCooldown,
} from "../transform.js";

// =============================================================================
// Message Formatting Tests
// =============================================================================

describe("formatTemperatureMessage", () => {
  it("formats temperature with one decimal place", () => {
    expect(formatTemperatureMessage(75.5)).toBe(
      "Sauna temperature is now 75.5°C",
    );
  });

  it("rounds to one decimal place", () => {
    expect(formatTemperatureMessage(80.123)).toBe(
      "Sauna temperature is now 80.1°C",
    );
  });

  it("handles integer temperature", () => {
    expect(formatTemperatureMessage(90)).toBe(
      "Sauna temperature is now 90.0°C",
    );
  });
});

describe("formatSafetyShutdownMessage", () => {
  it("formats single phase", () => {
    const result = formatSafetyShutdownMessage(["L1"]);
    expect(result).toContain("L1");
    expect(result).toContain("SAFETY ALERT");
    expect(result).toContain("high amperage");
  });

  it("formats multiple phases", () => {
    const result = formatSafetyShutdownMessage(["L1", "L2", "L3"]);
    expect(result).toContain("L1, L2, L3");
  });

  it("includes safety instructions", () => {
    const result = formatSafetyShutdownMessage(["L1"]);
    expect(result).toContain("check your electrical load");
  });
});

describe("formatMcbStatusMessage", () => {
  it("formats ON status", () => {
    expect(formatMcbStatusMessage("on")).toBe("MCB has been turned ON");
  });

  it("formats OFF status", () => {
    expect(formatMcbStatusMessage("off")).toBe("MCB has been turned OFF");
  });

  it("includes reason when provided", () => {
    expect(formatMcbStatusMessage("off", "User request")).toBe(
      "MCB has been turned OFF: User request",
    );
  });
});

describe("formatNotificationMessage", () => {
  it("formats temperature notification", () => {
    const notification = createTemperatureNotification(85.5, Date.now());
    expect(formatNotificationMessage(notification)).toBe(
      "Sauna temperature is now 85.5°C",
    );
  });

  it("formats safety shutdown notification", () => {
    const notification = createSafetyShutdownNotification(["L1"], Date.now());
    const result = formatNotificationMessage(notification);
    expect(result).toContain("SAFETY ALERT");
    expect(result).toContain("L1");
  });

  it("formats MCB status notification", () => {
    const notification = createMcbStatusNotification("on", Date.now());
    expect(formatNotificationMessage(notification)).toBe(
      "MCB has been turned ON",
    );
  });

  it("formats system alert notification", () => {
    const notification = {
      type: "system_alert" as const,
      message: "Test alert",
      timestamp: Date.now(),
    };
    expect(formatNotificationMessage(notification)).toBe(
      "System Alert: Test alert",
    );
  });
});

// =============================================================================
// WAHA Request Building Tests
// =============================================================================

describe("buildWahaRequest", () => {
  it("builds request with default session", () => {
    const result = buildWahaRequest("12345@c.us", "Hello");

    expect(result).toEqual({
      chatId: "12345@c.us",
      text: "Hello",
      session: "default",
    });
  });

  it("builds request with custom session", () => {
    const result = buildWahaRequest("12345@c.us", "Hello", "custom");

    expect(result.session).toBe("custom");
  });
});

describe("phoneToWhatsAppId", () => {
  it("converts plain number", () => {
    expect(phoneToWhatsAppId("31612345678")).toBe("31612345678@c.us");
  });

  it("removes + prefix", () => {
    expect(phoneToWhatsAppId("+31612345678")).toBe("31612345678@c.us");
  });

  it("removes spaces", () => {
    expect(phoneToWhatsAppId("+31 6 1234 5678")).toBe("31612345678@c.us");
  });

  it("removes dashes", () => {
    expect(phoneToWhatsAppId("+31-612-345-678")).toBe("31612345678@c.us");
  });

  it("handles mixed formatting", () => {
    expect(phoneToWhatsAppId("+31 612-345 678")).toBe("31612345678@c.us");
  });
});

// =============================================================================
// Notification Factory Tests
// =============================================================================

describe("createTemperatureNotification", () => {
  it("creates temperature notification", () => {
    const now = 1704067200000;
    const result = createTemperatureNotification(75.5, now);

    expect(result).toEqual({
      type: "temperature_alert",
      temperature: 75.5,
      timestamp: now,
    });
  });
});

describe("createSafetyShutdownNotification", () => {
  it("creates safety shutdown notification", () => {
    const now = 1704067200000;
    const result = createSafetyShutdownNotification(["L1", "L2"], now);

    expect(result).toEqual({
      type: "safety_shutdown",
      triggerPhases: ["L1", "L2"],
      timestamp: now,
    });
  });
});

describe("createMcbStatusNotification", () => {
  it("creates MCB status notification without reason", () => {
    const now = 1704067200000;
    const result = createMcbStatusNotification("on", now);

    expect(result).toEqual({
      type: "mcb_status",
      status: "on",
      reason: undefined,
      timestamp: now,
    });
  });

  it("creates MCB status notification with reason", () => {
    const now = 1704067200000;
    const result = createMcbStatusNotification("off", now, "Safety shutdown");

    expect(result.reason).toBe("Safety shutdown");
  });
});

// =============================================================================
// Cooldown Tests
// =============================================================================

describe("isSafetyShutdownAllowed", () => {
  it("returns true when no previous notification", () => {
    expect(isSafetyShutdownAllowed(INITIAL_COOLDOWN_STATE, Date.now())).toBe(
      true,
    );
  });

  it("returns false during cooldown period", () => {
    const state = { ...INITIAL_COOLDOWN_STATE, safetyShutdown: Date.now() };
    expect(isSafetyShutdownAllowed(state, Date.now())).toBe(false);
  });

  it("returns true after cooldown expires", () => {
    const pastTime = Date.now() - COOLDOWN_DURATIONS.safetyShutdown - 1000;
    const state = { ...INITIAL_COOLDOWN_STATE, safetyShutdown: pastTime };
    expect(isSafetyShutdownAllowed(state, Date.now())).toBe(true);
  });
});

describe("isTemperatureNotificationAllowed", () => {
  it("returns true when no previous notification", () => {
    expect(
      isTemperatureNotificationAllowed(INITIAL_COOLDOWN_STATE, Date.now()),
    ).toBe(true);
  });

  it("returns false during cooldown period", () => {
    const state = { ...INITIAL_COOLDOWN_STATE, temperature: Date.now() };
    expect(isTemperatureNotificationAllowed(state, Date.now())).toBe(false);
  });

  it("returns true after cooldown expires", () => {
    const pastTime = Date.now() - COOLDOWN_DURATIONS.temperature - 1000;
    const state = { ...INITIAL_COOLDOWN_STATE, temperature: pastTime };
    expect(isTemperatureNotificationAllowed(state, Date.now())).toBe(true);
  });
});

describe("getSafetyShutdownCooldownRemaining", () => {
  it("returns 0 when no cooldown active", () => {
    expect(
      getSafetyShutdownCooldownRemaining(INITIAL_COOLDOWN_STATE, Date.now()),
    ).toBe(0);
  });

  it("returns remaining time during cooldown", () => {
    const now = Date.now();
    const state = { ...INITIAL_COOLDOWN_STATE, safetyShutdown: now - 30000 }; // 30s ago
    const remaining = getSafetyShutdownCooldownRemaining(state, now);

    // 60s cooldown - 30s elapsed = 30s remaining
    expect(remaining).toBeCloseTo(30000, -2);
  });

  it("returns 0 when cooldown expired", () => {
    const pastTime = Date.now() - COOLDOWN_DURATIONS.safetyShutdown - 1000;
    const state = { ...INITIAL_COOLDOWN_STATE, safetyShutdown: pastTime };
    expect(getSafetyShutdownCooldownRemaining(state, Date.now())).toBe(0);
  });
});

describe("getTemperatureCooldownRemaining", () => {
  it("returns 0 when no cooldown active", () => {
    expect(
      getTemperatureCooldownRemaining(INITIAL_COOLDOWN_STATE, Date.now()),
    ).toBe(0);
  });

  it("returns remaining time during cooldown", () => {
    const now = Date.now();
    const state = { ...INITIAL_COOLDOWN_STATE, temperature: now - 60000 }; // 60s ago
    const remaining = getTemperatureCooldownRemaining(state, now);

    // 300s (5min) cooldown - 60s elapsed = 240s remaining
    expect(remaining).toBeCloseTo(240000, -2);
  });
});

describe("updateSafetyShutdownCooldown", () => {
  it("updates safetyShutdown timestamp", () => {
    const now = 1704067200000;
    const result = updateSafetyShutdownCooldown(INITIAL_COOLDOWN_STATE, now);

    expect(result.safetyShutdown).toBe(now);
    expect(result.temperature).toBe(0); // Unchanged
  });
});

describe("updateTemperatureCooldown", () => {
  it("updates temperature timestamp", () => {
    const now = 1704067200000;
    const result = updateTemperatureCooldown(INITIAL_COOLDOWN_STATE, now);

    expect(result.temperature).toBe(now);
    expect(result.safetyShutdown).toBe(0); // Unchanged
  });
});
