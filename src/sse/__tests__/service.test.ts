/**
 * SSE Service Tests
 *
 * Tests SSE client management and broadcasting.
 *
 * @see TESTING.md - T1 (Test at Three Levels)
 */
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

// Mock logger
vi.mock("../../logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks
import {
  getClientCount,
  createSseStream,
  removeClient,
  broadcast,
  broadcastMcbStatus,
  broadcastSensorData,
  broadcastTemperature,
  broadcastDoor,
  broadcastVentilator,
  sendToClient,
  disconnectAllClients,
} from "../service.js";

describe("SSE Service", () => {
  beforeEach(() => {
    // Clean up any existing clients before each test
    disconnectAllClients();
  });

  afterEach(() => {
    disconnectAllClients();
  });

  // ===========================================================================
  // Client Management
  // ===========================================================================

  describe("getClientCount", () => {
    test("returns 0 when no clients connected", () => {
      expect(getClientCount()).toBe(0);
    });

    test("returns correct count after clients connect", () => {
      // Create some clients
      createSseStream();
      createSseStream();
      createSseStream();

      expect(getClientCount()).toBe(3);
    });
  });

  describe("createSseStream", () => {
    test("returns stream and client ID", () => {
      const { stream, clientId } = createSseStream();

      expect(stream).toBeInstanceOf(ReadableStream);
      expect(typeof clientId).toBe("number");
      expect(clientId).toBeGreaterThan(0);
    });

    test("increments client ID for each new client", () => {
      const client1 = createSseStream();
      const client2 = createSseStream();
      const client3 = createSseStream();

      expect(client2.clientId).toBeGreaterThan(client1.clientId);
      expect(client3.clientId).toBeGreaterThan(client2.clientId);
    });

    test("sends connected event on stream start", async () => {
      const { stream, clientId } = createSseStream();
      const reader = stream.getReader();

      // Read the initial connected event
      const { value, done } = await reader.read();
      reader.releaseLock();

      expect(done).toBe(false);
      expect(value).toBeDefined();

      const text = new TextDecoder().decode(value);
      expect(text).toContain("event: connected");
      expect(text).toContain(`"clientId":${clientId}`);
    });
  });

  describe("removeClient", () => {
    test("removes client by ID", () => {
      const { clientId } = createSseStream();
      expect(getClientCount()).toBe(1);

      removeClient(clientId);
      expect(getClientCount()).toBe(0);
    });

    test("does nothing for non-existent client ID", () => {
      createSseStream();
      expect(getClientCount()).toBe(1);

      removeClient(99999);
      expect(getClientCount()).toBe(1);
    });
  });

  describe("disconnectAllClients", () => {
    test("disconnects all connected clients", () => {
      createSseStream();
      createSseStream();
      createSseStream();
      expect(getClientCount()).toBe(3);

      disconnectAllClients();
      expect(getClientCount()).toBe(0);
    });
  });

  // ===========================================================================
  // Broadcasting
  // ===========================================================================

  describe("broadcast", () => {
    test("sends event to all connected clients", async () => {
      // Create two clients
      const { stream: stream1 } = createSseStream();
      const { stream: stream2 } = createSseStream();

      const reader1 = stream1.getReader();
      const reader2 = stream2.getReader();

      // Read initial connected events
      await reader1.read();
      await reader2.read();

      // Broadcast an event
      broadcast({ type: "mcb_status", status: "ON", source: "command" });

      // Read the broadcasted event from both clients
      const { value: value1 } = await reader1.read();
      const { value: value2 } = await reader2.read();

      const text1 = new TextDecoder().decode(value1);
      const text2 = new TextDecoder().decode(value2);

      expect(text1).toContain("event: mcb_status");
      expect(text2).toContain("event: mcb_status");
      expect(text1).toContain('"status":"ON"');

      reader1.releaseLock();
      reader2.releaseLock();
    });

    test("does nothing when no clients connected", () => {
      // Should not throw
      expect(() => {
        broadcast({ type: "mcb_status", status: "OFF", source: "polling" });
      }).not.toThrow();
    });
  });

  describe("broadcastMcbStatus", () => {
    test("broadcasts MCB status with correct format", async () => {
      const { stream } = createSseStream();
      const reader = stream.getReader();
      await reader.read(); // Initial connected event

      broadcastMcbStatus("ON", "command");

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("event: mcb_status");
      expect(text).toContain('"status":"ON"');
      expect(text).toContain('"source":"command"');

      reader.releaseLock();
    });
  });

  describe("broadcastSensorData", () => {
    test("broadcasts phase data with correct format", async () => {
      const { stream } = createSseStream();
      const reader = stream.getReader();
      await reader.read();

      broadcastSensorData(15.5, 8.2, 12.0);

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("event: sensor_data");
      expect(text).toContain('"l1":15.5');
      expect(text).toContain('"l2":8.2');
      expect(text).toContain('"l3":12');

      reader.releaseLock();
    });

    test("handles null phase values", async () => {
      const { stream } = createSseStream();
      const reader = stream.getReader();
      await reader.read();

      broadcastSensorData(null, null, null);

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain('"l1":null');
      expect(text).toContain('"l2":null');
      expect(text).toContain('"l3":null');

      reader.releaseLock();
    });
  });

  describe("broadcastTemperature", () => {
    test("broadcasts temperature with correct format", async () => {
      const { stream } = createSseStream();
      const reader = stream.getReader();
      await reader.read();

      broadcastTemperature(65.5, 42.0);

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("event: temperature");
      expect(text).toContain('"temperature":65.5');
      expect(text).toContain('"humidity":42');

      reader.releaseLock();
    });
  });

  describe("broadcastDoor", () => {
    test("broadcasts door open status", async () => {
      const { stream } = createSseStream();
      const reader = stream.getReader();
      await reader.read();

      broadcastDoor(true);

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("event: door");
      expect(text).toContain('"isOpen":true');

      reader.releaseLock();
    });

    test("broadcasts door closed status", async () => {
      const { stream } = createSseStream();
      const reader = stream.getReader();
      await reader.read();

      broadcastDoor(false);

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain('"isOpen":false');

      reader.releaseLock();
    });
  });

  describe("broadcastVentilator", () => {
    test("broadcasts ventilator status with remaining time", async () => {
      const { stream } = createSseStream();
      const reader = stream.getReader();
      await reader.read();

      broadcastVentilator(true, 3600000);

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("event: ventilator");
      expect(text).toContain('"status":true');
      expect(text).toContain('"delayedOffRemaining":3600000');

      reader.releaseLock();
    });
  });

  // ===========================================================================
  // sendToClient
  // ===========================================================================

  describe("sendToClient", () => {
    test("sends event to specific client only", async () => {
      const { stream: stream1, clientId: id1 } = createSseStream();
      const { stream: stream2, clientId: id2 } = createSseStream();

      const reader1 = stream1.getReader();
      const reader2 = stream2.getReader();

      await reader1.read(); // Initial connected
      await reader2.read();

      // Send to client 1 only
      const sent = sendToClient(id1, { type: "mcb_status", status: "ON", source: "command" });
      expect(sent).toBe(true);

      // Client 1 should receive the event
      const result1 = await reader1.read();
      const text1 = new TextDecoder().decode(result1.value);
      expect(text1).toContain("mcb_status");

      // We can't easily verify client 2 didn't receive it without timing out
      // So we just verify the return value

      reader1.releaseLock();
      reader2.releaseLock();
    });

    test("returns false for non-existent client", () => {
      const sent = sendToClient(99999, { type: "mcb_status", status: "ON", source: "command" });
      expect(sent).toBe(false);
    });
  });
});

