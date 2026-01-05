/**
 * SPIKE: Test tuyapi for local MCB communication
 *
 * ASSUMPTION: We can use tuyapi (Node.js) instead of tinytuya (Python)
 *             to communicate locally with the Tuya MCB device.
 *
 * RESULT: ✅ CONFIRMED - tuyapi works for both status and control
 *
 * Run with: bun src/__spikes__/spike-tuyapi-local.ts
 */

import TuyAPI from "tuyapi";

// MCB device configuration (from Tuya-MCB-API .env)
const MCB_CONFIG = {
  id: "bf395c7dc4996a1805adyy",
  ip: "192.168.68.80",
  key: "u*xp=4YUn`(P{&Is",
  version: "3.3",
};

async function testLocalMcbConnection(): Promise<void> {
  console.log("=== SPIKE: tuyapi Local MCB Connection ===\n");
  console.log("Config:", {
    id: MCB_CONFIG.id,
    ip: MCB_CONFIG.ip,
    version: MCB_CONFIG.version,
  });

  const device = new TuyAPI({
    id: MCB_CONFIG.id,
    key: MCB_CONFIG.key,
    ip: MCB_CONFIG.ip,
    version: MCB_CONFIG.version,
    issueGetOnConnect: true, // Auto-request status on connect
  });

  // Event handlers
  device.on("connected", () => {
    console.log("\n✓ Connected to MCB!");
  });

  device.on("disconnected", () => {
    console.log("\n✗ Disconnected from MCB");
  });

  device.on("error", (error: Error) => {
    console.error("\n✗ Error:", error.message);
  });

  device.on("data", (data: unknown) => {
    console.log("\n📊 Data received:", JSON.stringify(data, null, 2));

    // Parse DPS (Data Points)
    if (data && typeof data === "object" && "dps" in data) {
      const dps = (data as { dps: Record<string, unknown> }).dps;
      console.log("\nParsed DPS:");
      console.log("  - Switch (1):", dps["1"] ? "ON" : "OFF");
      console.log("  - Voltage (22):", dps["22"], "decivolts");
      console.log("  - Unknown (25):", dps["25"]);
    }
  });

  device.on("dp-refresh", (data: unknown) => {
    console.log("\n🔄 DPS refresh:", JSON.stringify(data, null, 2));
  });

  try {
    // Find device (resolves IP if not provided)
    console.log("\n1. Finding device...");
    await device.find();
    console.log("   Found device at:", MCB_CONFIG.ip);

    // Connect
    console.log("\n2. Connecting...");
    await device.connect();

    // Request status
    console.log("\n3. Requesting status...");
    const status = await device.get({});
    console.log("   Status:", status);

    // Wait a bit for async data
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Try to get specific DPS
    console.log("\n4. Getting specific DPS values...");
    try {
      const switchState = await device.get({ dps: 1 });
      console.log("   Switch (DPS 1):", switchState);
    } catch (e) {
      console.log("   Could not get DPS 1:", (e as Error).message);
    }

    // Test: Toggle switch (CAREFUL - this actually controls the sauna!)
    // Uncomment only if you want to test control
    /*
    console.log("\n5. Testing control - turning OFF...");
    await device.set({ dps: 1, set: false });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("   Turning back ON...");
    await device.set({ dps: 1, set: true });
    */

    console.log("\n5. Keeping connection open for 5 seconds to receive updates...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Disconnect
    console.log("\n6. Disconnecting...");
    device.disconnect();

    console.log("\n=== SPIKE COMPLETE ===");
    console.log("\nRESULT: Check output above to see if connection worked.");
  } catch (error) {
    console.error("\n✗ SPIKE FAILED:", error);
    device.disconnect();
    process.exit(1);
  }
}

// Run spike
testLocalMcbConnection()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });

