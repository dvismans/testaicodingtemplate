/**
 * Spike: Discover P1 Monitor MQTT message format
 *
 * Run with: bun src/__spikes__/spike-p1monitor-topics.ts
 */
import mqtt from "mqtt";

const BROKER_URL = "mqtt://192.168.68.64:1883";
const TOPIC = "p1monitor/#";

console.log(`Connecting to ${BROKER_URL}...`);
console.log(`Subscribing to: ${TOPIC}`);
console.log("Waiting for messages (will exit after 30 seconds)...\n");

const client = mqtt.connect(BROKER_URL);

client.on("connect", () => {
  console.log("✓ Connected to MQTT broker");
  client.subscribe(TOPIC, (err) => {
    if (err) {
      console.error("Subscribe error:", err);
    } else {
      console.log(`✓ Subscribed to ${TOPIC}\n`);
    }
  });
});

client.on("message", (topic, message) => {
  const payload = message.toString();

  // Check if it's JSON
  try {
    const json = JSON.parse(payload);
    console.log(`📩 Topic: ${topic}`);
    console.log("   Format: JSON");
    console.log(`   Keys: ${Object.keys(json).join(", ")}`);
    if (json.l1_a !== undefined) {
      console.log(`   L1: ${json.l1_a}A, L2: ${json.l2_a}A, L3: ${json.l3_a}A`);
    }
    console.log("");
  } catch {
    // Not JSON - probably individual value
    console.log(`📩 Topic: ${topic}`);
    console.log("   Format: Plain value");
    console.log(`   Value: ${payload}`);
    console.log("");
  }
});

client.on("error", (err) => {
  console.error("MQTT Error:", err.message);
});

// Exit after 30 seconds
setTimeout(() => {
  console.log("\n⏱️ 30 seconds elapsed, disconnecting...");
  client.end();
  process.exit(0);
}, 30000);
