/**
 * Base layout for Sauna Control System PWA.
 *
 * Uses Pico CSS for classless styling and includes:
 * - HTMX for declarative AJAX
 * - SSE extension for real-time updates
 * - PWA meta tags
 *
 * @see Rule #37 (Page Layout Pattern), #40 (Styling with Pico CSS)
 */
import type { FC, PropsWithChildren } from "hono/jsx";

type BaseLayoutProps = PropsWithChildren<{
  title: string;
}>;

export const BaseLayout: FC<BaseLayoutProps> = ({ title, children }) => (
  <html lang="en" data-theme="dark">
    <head>
      <meta charset="utf-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
      />
      <meta name="color-scheme" content="dark" />
      <meta name="theme-color" content="#1a1a2e" />

      {/* PWA Meta Tags */}
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta
        name="apple-mobile-web-app-status-bar-style"
        content="black-translucent"
      />

      <title>{title}</title>

      {/* Pico CSS - Classless styling */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
      />

      {/* Custom styles for sauna control dashboard */}
      <link rel="stylesheet" href="/public/styles.css" />

      {/* HTMX - Declarative AJAX - must use closing tag for HTML script */}
      <script src="https://unpkg.com/htmx.org@2">{""}</script>

      {/* HTMX SSE Extension for real-time updates */}
      <script src="https://unpkg.com/htmx-ext-sse@2.2.2/sse.js">{""}</script>
    </head>
    <body>
      {/* Connection status bar - will be updated via SSE */}
      <div
        id="connection-status"
        class="connection-bar disconnected"
        hx-ext="sse"
        sse-connect="/api/events"
        sse-swap="connected:innerHTML"
      >
        Connecting...
      </div>

      <main class="container" style="padding-top: 2rem;">
        {children}
      </main>

      {/* SSE connection script - moved to external file to avoid JSX escaping issues */}
      <script src="/public/sse-status.js">{""}</script>
    </body>
  </html>
);
