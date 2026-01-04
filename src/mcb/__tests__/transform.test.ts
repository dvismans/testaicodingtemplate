/**
 * MCB Transform Tests
 *
 * Tests for pure transformation functions.
 *
 * @see Rule #15 (Every Transformation Gets a Test)
 */
import { describe, expect, it } from "vitest";
import type { LocalMcbStatusResponse } from "../schema.js";
import {
  buildCommandPath,
  buildCommandPayload,
  buildStringToSign,
  calculateTokenExpiry,
  hmacSha256Hex,
  isTokenValid,
  parseLocalMcbStatus,
  sha256Hex,
} from "../transform.js";

describe("MCB Transform", () => {
  // ===========================================================================
  // Command Payload Building
  // ===========================================================================

  describe("buildCommandPayload", () => {
    it("builds TURN_ON payload with value true", () => {
      const payload = buildCommandPayload({ type: "TURN_ON" });

      expect(payload).toEqual({
        commands: [{ code: "switch_1", value: true }],
      });
    });

    it("builds TURN_OFF payload with value false", () => {
      const payload = buildCommandPayload({ type: "TURN_OFF" });

      expect(payload).toEqual({
        commands: [{ code: "switch_1", value: false }],
      });
    });
  });

  describe("buildCommandPath", () => {
    it("builds correct device command path", () => {
      const path = buildCommandPath("device123");

      expect(path).toBe("/v1.0/iot-03/devices/device123/commands");
    });

    it("handles device IDs with special characters", () => {
      const path = buildCommandPath("device-abc_123");

      expect(path).toBe("/v1.0/iot-03/devices/device-abc_123/commands");
    });
  });

  // ===========================================================================
  // Local API Response Parsing
  // ===========================================================================

  describe("parseLocalMcbStatus", () => {
    it("returns ON when switch is true", () => {
      const response: LocalMcbStatusResponse = {
        status: "success",
        device_id: "dev123",
        dps_data: { "1": true },
      };

      expect(parseLocalMcbStatus(response)).toBe("ON");
    });

    it("returns OFF when switch is false", () => {
      const response: LocalMcbStatusResponse = {
        status: "success",
        device_id: "dev123",
        dps_data: { "1": false },
      };

      expect(parseLocalMcbStatus(response)).toBe("OFF");
    });

    it("returns UNKNOWN when status is error", () => {
      const response: LocalMcbStatusResponse = {
        status: "error",
        message: "Device unreachable",
      };

      expect(parseLocalMcbStatus(response)).toBe("UNKNOWN");
    });

    it("returns UNKNOWN when dps_data is missing", () => {
      const response: LocalMcbStatusResponse = {
        status: "success",
        device_id: "dev123",
      };

      expect(parseLocalMcbStatus(response)).toBe("UNKNOWN");
    });

    it("returns UNKNOWN when switch key is missing", () => {
      const response: LocalMcbStatusResponse = {
        status: "success",
        device_id: "dev123",
        dps_data: {}, // No "1" key
      };

      expect(parseLocalMcbStatus(response)).toBe("UNKNOWN");
    });
  });

  // ===========================================================================
  // Token Validation
  // ===========================================================================

  describe("isTokenValid", () => {
    it("returns true when token is valid with buffer", () => {
      const now = 1000000;
      const expiresAt = now + 120000; // Expires in 2 minutes

      expect(isTokenValid(expiresAt, now)).toBe(true);
    });

    it("returns false when token is within 1 minute of expiry", () => {
      const now = 1000000;
      const expiresAt = now + 30000; // Expires in 30 seconds

      expect(isTokenValid(expiresAt, now)).toBe(false);
    });

    it("returns false when token is already expired", () => {
      const now = 1000000;
      const expiresAt = now - 1000; // Already expired

      expect(isTokenValid(expiresAt, now)).toBe(false);
    });
  });

  describe("calculateTokenExpiry", () => {
    it("calculates expiry timestamp correctly", () => {
      const now = 1000000;
      const expiresInSeconds = 7200; // 2 hours

      const expiry = calculateTokenExpiry(expiresInSeconds, now);

      expect(expiry).toBe(now + 7200 * 1000);
    });
  });

  // ===========================================================================
  // Signature Generation
  // ===========================================================================

  describe("sha256Hex", () => {
    it("generates correct SHA256 hash for empty string", () => {
      const hash = sha256Hex("");

      // Known SHA256 hash of empty string
      expect(hash).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      );
    });

    it("generates correct SHA256 hash for content", () => {
      const hash = sha256Hex('{"test":"value"}');

      // Hash should be consistent
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("hmacSha256Hex", () => {
    it("generates uppercase signature", () => {
      const signature = hmacSha256Hex("secret", "message");

      expect(signature).toMatch(/^[A-F0-9]+$/);
      expect(signature).toHaveLength(64);
    });

    it("produces different signatures for different messages", () => {
      const sig1 = hmacSha256Hex("secret", "message1");
      const sig2 = hmacSha256Hex("secret", "message2");

      expect(sig1).not.toBe(sig2);
    });

    it("produces different signatures for different keys", () => {
      const sig1 = hmacSha256Hex("secret1", "message");
      const sig2 = hmacSha256Hex("secret2", "message");

      expect(sig1).not.toBe(sig2);
    });
  });

  describe("buildStringToSign", () => {
    it("builds correct string for GET request", () => {
      const result = buildStringToSign("GET", "/v1.0/token?grant_type=1", null);

      // Format: METHOD\nContentSHA256\n\nPath
      const lines = result.split("\n");
      expect(lines[0]).toBe("GET");
      expect(lines[1]).toHaveLength(64); // SHA256 of empty string
      expect(lines[2]).toBe(""); // Empty headers
      expect(lines[3]).toBe("/v1.0/token?grant_type=1");
    });

    it("builds correct string for POST request with body", () => {
      const body = '{"commands":[{"code":"switch_1","value":true}]}';
      const result = buildStringToSign(
        "POST",
        "/v1.0/devices/123/commands",
        body,
      );

      const lines = result.split("\n");
      expect(lines[0]).toBe("POST");
      expect(lines[1]).toHaveLength(64); // SHA256 of body
      expect(lines[1]).not.toBe(sha256Hex("")); // Should be different from empty
      expect(lines[3]).toBe("/v1.0/devices/123/commands");
    });
  });
});
