/**
 * SPIKE: Test tuyapi for floor heating control
 *
 * ASSUMPTION: We can use tuyapi to control the Tuya floor heating device
 *             directly, similar to the MCB.
 *
 * RESULT: [pending]
 *
 * Run with: bun src/__spikes__/spike-floor-heating.ts
 */

import TuyAPI from "tuyapi";

// Floor heating device configuration
const FLOOR_HEATING_CONFIG = {
  id: "bfe088e2f8de814194rg59",
  key: "I`&DO5kHK&h(+{!r",
  version: "3.3", // Most common, try 3.4 if this fails
};

// We need to find the device IP first
const device = new TuyAPI({
  id: FLOOR_HEATING_CONFIG.id,
  key: FLOOR_HEATING_CONFIG.key,
  version: FLOOR_HEATING_CONFIG.version,
});

// Event handlers
device.on("connected", () => {
  console.log("✓ Connected to floor heating device");
});

device.on("disconnected", () => {
  console.log("✗ Disconnected from floor heating device");
});

device.on("error", (error: Error) => {
  console.log("Error:", error.message);
});

device.on("data", (data: unknown) => {
  console.log("\n📊 Data received:", JSON.stringify(data, null, 2));

  // Try to parse known DPS values
  if (data && typeof data === "object" && "dps" in data) {
    const dps = (data as { dps: Record<string, unknown> }).dps;
    console.log("\nParsed DPS:");
    for (const [key, value] of Object.entries(dps)) {
      console.log(`  - DPS ${key}: ${value} (${typeof value})`);
    }
  }
});

device.on("dp-refresh", (data: unknown) => {
  console.log("\n🔄 DP Refresh:", JSON.stringify(data, null, 2));
});

async function runSpike() {
  console.log("=== SPIKE: Floor Heating via tuyapi ===\n");
  console.log("Device ID:", FLOOR_HEATING_CONFIG.id);
  console.log("Version:", FLOOR_HEATING_CONFIG.version);

  try {
    // Step 1: Find the device on the network
    console.log("\n1. Finding device on network...");
    console.log("   (This may take 10-20 seconds)");

    const found = await device.find({ timeout: 20 });
    if (found) {
      console.log(`   ✓ Found device at: ${FLOOR_HEATING_CONFIG.id}`);
    } else {
      console.log("   ✗ Device not found. Check:");
      console.log("     - Device is powered on and connected to WiFi");
      console.log("     - Device ID is correct");
      console.log("     - Local network access is available");
      return;
    }

    // Step 2: Connect to the device
    console.log("\n2. Connecting to device...");
    await device.connect();

    // Step 3: Get current status
    console.log("\n3. Requesting current status...");
    await device.get({});

    // Wait for data event
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 4: Try to get specific DPS values
    console.log("\n4. Checking common DPS values...");

    // Common Tuya thermostat/heating DPS:
    // 1 = Power switch (bool)
    // 2 = Target temperature (int, often in 0.5°C increments)
    // 3 = Current temperature (int)
    // 4 = Mode (enum: manual, schedule, etc.)

    try {
      const power = await device.get({ dps: 1 });
      console.log(`   Power (DPS 1): ${power}`);
    } catch {
      console.log("   Power (DPS 1): Not available");
    }

    // Step 5: Test turning ON (uncomment to test)
    // console.log("\n5. Testing: Turning floor heating ON...");
    // await device.set({ dps: 1, set: true });
    // console.log("   ✓ ON command sent");

    // Wait to see result
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    console.error("\n❌ SPIKE ERROR:", error);

    if (error instanceof Error) {
      if (error.message.includes("key")) {
        console.log("\n💡 Try:");
        console.log("   - Check if local key is correct");
        console.log("   - Try version 3.4 instead of 3.3");
      }
      if (error.message.includes("timeout")) {
        console.log("\n💡 Try:");
        console.log("   - Check if device is on the same network");
        console.log("   - Device might need to be re-paired in Tuya app");
      }
    }
  } finally {
    console.log("\n6. Disconnecting...");
    device.disconnect();
    console.log("\n=== SPIKE COMPLETE ===");
    console.log("\nRESULT: Check output above to see if connection worked.");
    console.log(
      "If successful, look at DPS values to understand the device schema.",
    );
  }
}

runSpike();
