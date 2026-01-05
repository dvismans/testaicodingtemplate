/**
 * SSE Module - Service Layer
 *
 * Server-Sent Events broadcasting for real-time UI updates.
 *
 * @see Rule #27 (Module-Scoped Color-Coded Loggers)
 */
import { createLogger } from "../logger.js";
import type { SseEvent } from "./schema.js";

const log = createLogger("sse");

// =============================================================================
// Client Management
// =============================================================================

/**
 * SSE client connection.
 */
type SseClient = {
  id: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
  connected: boolean;
};

let clients: SseClient[] = [];
let nextClientId = 1;

/**
 * Get count of connected clients.
 */
export function getClientCount(): number {
  return clients.filter((c) => c.connected).length;
}

/**
 * Create a new SSE stream for a client.
 *
 * @returns ReadableStream for the response and cleanup function
 */
export function createSseStream(): {
  stream: ReadableStream<Uint8Array>;
  clientId: number;
} {
  const clientId = nextClientId++;
  let client: SseClient | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      client = {
        id: clientId,
        controller,
        connected: true,
      };
      clients.push(client);
      log.info(
        { clientId, totalClients: getClientCount() },
        "SSE client connected",
      );

      // Send initial connection confirmation
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`,
        ),
      );
    },
    cancel() {
      if (client) {
        client.connected = false;
        clients = clients.filter((c) => c.id !== clientId);
        log.info(
          { clientId, remainingClients: getClientCount() },
          "SSE client disconnected",
        );
      }
    },
  });

  return { stream, clientId };
}

/**
 * Remove a client by ID.
 */
export function removeClient(clientId: number): void {
  const client = clients.find((c) => c.id === clientId);
  if (client) {
    client.connected = false;
    clients = clients.filter((c) => c.id !== clientId);
    log.debug({ clientId }, "SSE client removed");
  }
}

// =============================================================================
// Event Broadcasting
// =============================================================================

/**
 * Broadcast an event to all connected clients.
 *
 * @param event - The event to broadcast
 */
export function broadcast(event: SseEvent): void {
  const connectedClients = clients.filter((c) => c.connected);

  if (connectedClients.length === 0) {
    log.debug({ eventType: event.type }, "No clients to broadcast to");
    return;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(
    `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );

  let successCount = 0;
  let errorCount = 0;

  for (const client of connectedClients) {
    try {
      client.controller.enqueue(data);
      successCount++;
    } catch (error) {
      // Client disconnected
      client.connected = false;
      errorCount++;
    }
  }

  // Clean up disconnected clients
  if (errorCount > 0) {
    clients = clients.filter((c) => c.connected);
    log.debug(
      { eventType: event.type, sent: successCount, failed: errorCount },
      "Broadcast complete with disconnections",
    );
  }

  log.debug(
    { eventType: event.type, clients: successCount },
    "Event broadcasted",
  );
}

/**
 * Broadcast MCB status change.
 */
export function broadcastMcbStatus(
  status: "ON" | "OFF" | "UNKNOWN",
  source: "polling" | "command" | "auto_safety" | "flic" | "mqtt",
): void {
  broadcast({ type: "mcb_status", status, source });
}

/**
 * Broadcast sensor data (smart meter readings).
 */
export function broadcastSensorData(
  l1: number | null,
  l2: number | null,
  l3: number | null,
): void {
  broadcast({ type: "sensor_data", l1, l2, l3 });
}

/**
 * Broadcast temperature update.
 */
export function broadcastTemperature(
  temperature: number,
  humidity: number | null,
): void {
  broadcast({ type: "temperature", temperature, humidity });
}

/**
 * Broadcast door status.
 */
export function broadcastDoor(isOpen: boolean): void {
  broadcast({ type: "door", isOpen });
}

/**
 * Broadcast ventilator status.
 */
export function broadcastVentilator(
  status: boolean,
  delayedOffRemaining: number | null,
): void {
  broadcast({ type: "ventilator", status, delayedOffRemaining });
}

/**
 * Send event to a specific client.
 */
export function sendToClient(clientId: number, event: SseEvent): boolean {
  const client = clients.find((c) => c.id === clientId && c.connected);
  if (!client) return false;

  try {
    const encoder = new TextEncoder();
    client.controller.enqueue(
      encoder.encode(
        `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      ),
    );
    return true;
  } catch {
    client.connected = false;
    return false;
  }
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Disconnect all clients (for shutdown).
 */
export function disconnectAllClients(): void {
  log.info({ clientCount: clients.length }, "Disconnecting all SSE clients...");

  for (const client of clients) {
    try {
      client.controller.close();
    } catch {
      // Already closed
    }
  }

  clients = [];
}
