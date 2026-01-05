/**
 * Main Sauna Control Dashboard
 *
 * Server-rendered page using HTMX for interactivity.
 * Pico CSS for styling - semantic HTML looks good automatically.
 *
 * @see Rule #33-40 (HTMX/Pico UI Patterns)
 */
import type { FC } from "hono/jsx";
import { config } from "../../config.js";
import { BaseLayout } from "../layouts/Base.js";

/**
 * Phase display card showing amperage for a single phase.
 */
const PhaseCard: FC<{ phase: "L1" | "L2" | "L3"; color: string }> = ({
  phase,
  color,
}) => (
  <article
    id={`phase-${phase.toLowerCase()}`}
    style={{
      textAlign: "center",
      borderTop: `4px solid ${color}`,
      margin: "0",
    }}
  >
    <header style={{ padding: "0.5rem", margin: "0" }}>
      <small>
        {phase}{" "}
        <span class="threshold-hint">(max {config.AMPERAGE_THRESHOLD}A)</span>
      </small>
    </header>
    <p
      id={`${phase.toLowerCase()}-value`}
      style={{
        fontSize: "2.5rem",
        fontWeight: "bold",
        margin: "0",
        padding: "1rem 0",
      }}
    >
      —
    </p>
  </article>
);

/**
 * MCB control button with status display.
 */
const McbButton: FC = () => (
  <button
    type="button"
    id="mcb-toggle"
    class="contrast outline"
    style={{ width: "100%", padding: "1.5rem", fontSize: "1.2rem" }}
    hx-post="/api/mcb/toggle"
    hx-swap="none"
    hx-indicator="#mcb-indicator"
    disabled
  >
    <span id="mcb-status-text">Loading...</span>
    <span id="mcb-indicator" class="htmx-indicator" aria-busy="true" />
  </button>
);

/**
 * Temperature display card.
 */
const TemperatureCard: FC = () => (
  <article id="temp-card" style={{ textAlign: "center" }}>
    <p
      id="temp-value"
      style={{
        fontSize: "4rem",
        fontWeight: "bold",
        margin: "0",
        lineHeight: "1",
      }}
    >
      —<span style={{ fontSize: "2rem" }}>°C</span>
    </p>
    <small id="temp-age" style={{ color: "var(--muted-color)" }}>
      Temperature unavailable
    </small>
  </article>
);

/**
 * Status indicators (door, ventilator, floor heating).
 */
const StatusIndicators: FC = () => (
  <div class="grid">
    <div id="door-status" style={{ textAlign: "center" }}>
      <small style={{ color: "var(--muted-color)" }}>
        Door status unavailable
      </small>
    </div>
    <div id="ventilator-status" style={{ textAlign: "center" }}>
      <small style={{ color: "var(--muted-color)" }}>
        Ventilator status unavailable
      </small>
    </div>
    <div id="floor-heating-status" style={{ textAlign: "center" }}>
      <small style={{ color: "var(--muted-color)" }}>
        Floor heating unavailable
      </small>
    </div>
  </div>
);

/**
 * Dashboard props for initial server-side render.
 */
type DashboardProps = {
  mcbStatus: "ON" | "OFF" | "UNKNOWN";
  temperature: number | null;
  humidity: number | null;
  doorOpen: boolean | null;
  phaseData: { l1: number; l2: number; l3: number } | null;
  ventilatorOn: boolean;
};

/**
 * Main Dashboard page component.
 */
export const Dashboard: FC<DashboardProps> = ({
  mcbStatus,
  temperature,
  humidity,
  doorOpen,
  phaseData,
  ventilatorOn,
}) => (
  <BaseLayout title="Sauna Control">
    {/* Phase amperage display - hidden when sauna is OFF */}
    <div id="phase-section">
      <div class="grid" style={{ marginBottom: "1rem" }}>
        <PhaseCard phase="L1" color="#e74c3c" />
        <PhaseCard phase="L2" color="#f39c12" />
        <PhaseCard phase="L3" color="#3498db" />
      </div>
      <p
        id="phase-age"
        style={{
          textAlign: "center",
          color: "var(--muted-color)",
          marginBottom: "1rem",
        }}
      >
        <small>Phase data unavailable</small>
      </p>
    </div>

    {/* Temperature */}
    <TemperatureCard />

    {/* MCB Control */}
    <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
      <McbButton />
    </div>

    {/* Status indicators */}
    <StatusIndicators />

    {/* Test notification button */}
    <details style={{ marginTop: "2rem" }}>
      <summary>Developer Tools</summary>
      <div class="grid" style={{ marginTop: "1rem" }}>
        <button
          type="button"
          class="secondary outline"
          hx-post="/api/test-waha"
          hx-target="#health-result"
          hx-swap="innerHTML"
        >
          Test WhatsApp
        </button>
        <button
          type="button"
          class="secondary outline"
          hx-get="/api/health"
          hx-target="#health-result"
          hx-swap="innerHTML"
        >
          Health Check
        </button>
      </div>
      <pre
        id="health-result"
        style={{ marginTop: "1rem", fontSize: "0.8rem" }}
      />
    </details>

    {/* External dashboard script */}
    <script src="/public/dashboard.js">{""}</script>
  </BaseLayout>
);
