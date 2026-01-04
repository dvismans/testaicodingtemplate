# Tech Stack Learnings

Lessons learned from building with Bun + Hono + HTMX + Pico CSS + SSE + MQTT.

These gotchas cost debugging time. Avoid them by following these rules.

---

## Environment Variables

### L1. Quote MQTT Topics with Wildcards in .env

```bash
# BAD - # is treated as start of comment, topic becomes "homelab/sensors/sauna/door/"
MQTT_TOPIC_DOOR=homelab/sensors/sauna/door/#

# GOOD - quotes preserve the wildcard
MQTT_TOPIC_DOOR="homelab/sensors/sauna/door/#"
```

**Why:** The `#` character starts a comment in `.env` files. The parser strips everything after `#`.

**Rule:** Always quote any `.env` value containing `#`, `$`, or special characters.

---

### L2. Zod Coercion for Environment Variables

```typescript
// Numbers - use z.coerce.number()
PORT: z.coerce.number().default(3000)

// Booleans - z.coerce.boolean() DOES NOT WORK as expected
// "false" string coerces to true because non-empty string is truthy!

// BAD
ENABLE_FEATURE: z.coerce.boolean().default(false)
// .env: ENABLE_FEATURE=false → becomes TRUE (bug!)

// GOOD - custom transform
const envBoolean = (defaultValue: boolean) =>
  z.string()
    .optional()
    .transform((val) => {
      if (val === undefined) return defaultValue;
      return val.toLowerCase() === "true" || val === "1";
    });

ENABLE_FEATURE: envBoolean(false)
// .env: ENABLE_FEATURE=false → correctly becomes FALSE
```

**Why:** JavaScript's Boolean("false") returns true because "false" is a non-empty string.

---

## JSX + Client-Side Code

### L3. Never Put JavaScript in Inline `<script>` Tags in JSX

```tsx
// BAD - comparison operators get HTML-encoded
// !== becomes &amp;!== which is a JavaScript syntax error
<script>{`
  if (status !== 'connected') { 
    console.log('disconnected');
  }
`}</script>

// Browser sees:
// if (status &amp;!== 'connected') { ... }
// Result: Uncaught SyntaxError: Unexpected token '&'

// GOOD - use external script file
<script src="/public/dashboard.js" />
```

**Affected characters:**
- `&&` → `&amp;&amp;`
- `||` → (may be affected)
- `!==` → `&amp;!==`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`

**Rule:** Always use external `.js` files for client-side JavaScript. Never inline scripts in JSX.

---

### L4. Never Put CSS with Quotes in Inline `<style>` Tags in JSX

```tsx
// BAD - quotes get encoded to &quot;
<style>{`
  :root {
    --pico-font-family: "JetBrains Mono", monospace;
  }
`}</style>

// Browser receives:
// --pico-font-family: &quot;JetBrains Mono&quot;, monospace;
// Result: Font doesn't apply, falls back to Times New Roman

// GOOD - use external stylesheet
<link rel="stylesheet" href="/public/styles.css" />
```

**Symptoms:**
- Fonts appear as Times New Roman or default serif
- CSS custom properties with quoted values don't work
- No console errors (CSS silently fails)

**Rule:** Always use external `.css` files for custom styles. Only inline styles without quotes.

---

### L5. Self-Closing Script Tags in JSX

```tsx
// BAD - Biome lint error (useSelfClosingElements)
<script src="https://unpkg.com/htmx.org@2"></script>

// GOOD - self-closing for external scripts
<script src="https://unpkg.com/htmx.org@2" />
```

**Note:** For scripts with inline content, you need the closing tag, but per L3, avoid inline scripts entirely.

---

## Hono Server

### L6. Static File Serving Requires Explicit Middleware

```typescript
import { serveStatic } from "hono/bun";

const app = new Hono();

// Serve files from ./public/ directory at /public/* URL path
app.use("/public/*", serveStatic({ root: "./" }));

// Now /public/dashboard.js serves ./public/dashboard.js
```

**Why:** Hono doesn't serve static files by default. You must explicitly configure it.

**Common mistake:** Forgetting to add this middleware, then wondering why scripts/styles return 404.

---

### L7. SSE Response Format

```typescript
// Correct SSE format - note the double newline at end
const formatSseEvent = (eventType: string, data: unknown): string => {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
};

// Required headers for SSE
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  },
});
```

**Critical:** The double newline (`\n\n`) at the end is required. Single newline won't dispatch the event.

---

### L8. Hono Request ID Middleware Pattern

```typescript
// Define in middleware
app.use("*", async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
});

// Access in route handler
routes.get("/api/health", (c) => {
  const requestId = c.get("requestId");
  return c.json({ status: "ok", requestId });
});
```

**Why:** Enables request tracing across logs. Include in all log entries and error responses.

---

## HTMX + SSE

### L9. HTMX SSE Extension Load Order

```html
<!-- HTMX must load BEFORE the SSE extension -->
<script src="https://unpkg.com/htmx.org@2" />
<script src="https://unpkg.com/htmx-ext-sse@2.2.2/sse.js" />

<!-- BAD - extension loads before HTMX, fails silently -->
<script src="https://unpkg.com/htmx-ext-sse@2.2.2/sse.js" />
<script src="https://unpkg.com/htmx.org@2" />
```

**Symptoms:** SSE attributes like `hx-ext="sse"` don't work, no console errors.

---

### L10. SSE Event Listeners in Vanilla JavaScript

```javascript
const eventSource = new EventSource("/api/events");

// Named events (with "event: typename") require addEventListener
eventSource.addEventListener("mcb_status", (e) => {
  const data = JSON.parse(e.data);
  console.log("MCB status:", data.status);
});

eventSource.addEventListener("temperature", (e) => {
  const data = JSON.parse(e.data);
  console.log("Temperature:", data.temperature);
});

// onmessage ONLY catches events WITHOUT explicit event type
eventSource.onmessage = (e) => {
  // Only receives: data: {...}\n\n
  // Does NOT receive: event: mcb_status\ndata: {...}\n\n
};
```

**Rule:** Always use `addEventListener` for named SSE events.

---

## TypeScript Strict Mode

### L11. Optional Parameters with exactOptionalPropertyTypes

```typescript
// With tsconfig: "exactOptionalPropertyTypes": true

type McbError = 
  | { type: "NETWORK_ERROR"; message: string; cause: Error }
  | { type: "AUTH_FAILED"; message: string };

// BAD - TS2322 error
function networkError(message: string, cause?: Error): McbError {
  return { type: "NETWORK_ERROR", message, cause };
  // Error: cause is Error | undefined, but type expects Error
}

// GOOD - explicit cast for optional parameter
function networkError(message: string, cause?: Error): McbError {
  return { 
    type: "NETWORK_ERROR", 
    message, 
    cause: cause as Error | undefined 
  };
}
```

**Why:** `exactOptionalPropertyTypes` distinguishes between "property is missing" and "property is undefined".

---

### L12. Readonly Types for Immutability

```typescript
// Define state as Readonly
type MonitoringState = Readonly<{
  mcbStatus: McbStatus;
  phaseData: PhaseData | null;
  isRunning: boolean;
}>;

// Update with spread (immutable)
state = { ...state, mcbStatus: newStatus };

// For arrays, use ReadonlyArray
type Phases = ReadonlyArray<{ phase: string; amperage: number }>;
```

**Why:** Prevents accidental mutations. TypeScript catches `state.mcbStatus = "ON"` at compile time.

---

## Pico CSS

### L13. Pico is Classless - Use Semantic HTML

```html
<!-- No classes needed - Pico styles these automatically -->
<button>Primary Button</button>
<article>This becomes a card</article>
<nav><ul><li><a href="/">Home</a></li></ul></nav>
<table><thead>...</thead><tbody>...</tbody></table>
<input type="text" placeholder="Styled input" />
<details><summary>Expandable</summary>Content</details>

<!-- Add classes only for variants -->
<button class="secondary">Secondary</button>
<button class="contrast">High contrast</button>
<button class="outline">Outline style</button>

<!-- Layout classes -->
<div class="container">Centered, max-width content</div>
<div class="grid">Auto grid layout</div>
```

**Rule:** Write semantic HTML first. Only add classes for variants or layout.

---

### L14. Pico Theme Control

```html
<!-- Auto theme (follows system preference) -->
<html lang="en">

<!-- Force light theme -->
<html lang="en" data-theme="light">

<!-- Force dark theme -->
<html lang="en" data-theme="dark">
```

**CSS variables for custom theming:**
```css
:root {
  --pico-font-family: system-ui, sans-serif;
  --pico-primary: #3498db;
}
```

---

### L15. Pico aria-busy for Loading States

```html
<!-- Button shows spinner automatically -->
<button aria-busy="true">Loading...</button>

<!-- Set via JavaScript when submitting -->
button.setAttribute("aria-busy", "true");
// After response:
button.removeAttribute("aria-busy");
```

**Why:** Pico CSS includes built-in loading spinner styles for `aria-busy="true"`.

---

## MQTT with Bun

### L16. mqtt.js Works with Bun

```typescript
// No special configuration needed
import mqtt from "mqtt";

const client = mqtt.connect("mqtt://192.168.68.64:1883");

client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe("homelab/sensors/#");
});

client.on("message", (topic, message) => {
  const data = JSON.parse(message.toString());
  console.log(topic, data);
});
```

**Confirmed:** Spike test verified mqtt.js works with Bun runtime. No alternative library needed.

---

### L17. MQTT Topic Subscription Patterns

```typescript
// + = single level wildcard
client.subscribe("homelab/sensors/sauna/+/status");
// Matches: homelab/sensors/sauna/door/status
// Matches: homelab/sensors/sauna/ruuvi/status
// No match: homelab/sensors/sauna/door/battery/status

// # = multi-level wildcard (must be last)
client.subscribe("homelab/sensors/sauna/#");
// Matches: homelab/sensors/sauna/door
// Matches: homelab/sensors/sauna/door/status
// Matches: homelab/sensors/sauna/ruuvi/temperature/celsius
```

---

## Debugging

### L18. Use LOG_LEVEL=debug During Development

```bash
# .env
LOG_LEVEL=debug   # Development - see everything
LOG_LEVEL=info    # Production - less noise
```

**Debug level shows:**
- Every MQTT message received
- Every API call made
- Every SSE event broadcast
- Detailed error context

---

### L19. Check Server Logs First

When debugging:

| Symptom | Check logs for |
|---------|----------------|
| UI not updating | SSE broadcast logs |
| API returning errors | Request/response logs with status codes |
| MQTT data missing | MQTT connection and subscription logs |
| External API failing | Full error response from Tuya/WAHA/etc |

**Pattern:** Server logs show the actual error message from external APIs, not just "failed".

---

### L20. Common 404 Causes

| 404 on... | Likely cause |
|-----------|--------------|
| `/public/*.js` | Missing `serveStatic` middleware |
| `/api/*` | Route not registered or wrong HTTP method |
| `/service-worker.js` | PWA manifest references non-existent file (safe to ignore) |

---

## Testing

### L21. `bun test` vs `bun run test`

```bash
# BAD - Uses Bun's built-in test runner (different API from Vitest)
bun test

# GOOD - Runs the "test" script from package.json, which uses Vitest
bun run test

# Also good - directly run Vitest
npx vitest run
```

**Why:** `bun test` invokes Bun's native test runner, which has a different API than Vitest. Functions like `vi.stubGlobal()`, `vi.mocked()`, and module mocking work differently or don't exist.

**Symptoms:**
- `TypeError: vi.stubGlobal is not a function`
- `TypeError: vi.mocked is not a function`
- Tests pass with `npx vitest run` but fail with `bun test`

**Rule:** Always use `bun run test` (package.json script) or `npx vitest run`, never `bun test` directly.

---

## Summary Checklist

Before deploying, verify:

- [ ] MQTT topics with `#` are quoted in `.env`
- [ ] No inline `<script>` or `<style>` with complex content in JSX
- [ ] External scripts/styles are served via `serveStatic`
- [ ] SSE events use correct format with `\n\n` terminator
- [ ] HTMX loads before HTMX extensions
- [ ] `LOG_LEVEL=debug` during development
- [ ] All tests pass with `bun run test` (NOT `bun test`)

