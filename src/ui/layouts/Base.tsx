/**
 * Base layout - wraps all pages with consistent structure.
 * Full page loads get layout; HTMX requests get fragments only.
 *
 * @see Rule #37
 */
import type { FC, PropsWithChildren } from "hono/jsx";
import { config } from "../../config.js";

type BaseLayoutProps = PropsWithChildren<{
  title: string;
}>;

/**
 * Base HTML layout with Pico CSS and HTMX.
 * Uses semantic HTML - Pico handles styling automatically.
 */
export const BaseLayout: FC<BaseLayoutProps> = ({ title, children }) => (
  <html lang="en" data-theme="light">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
      />
      <script src="https://unpkg.com/htmx.org@2.0.4" />
      <script src="https://unpkg.com/alpinejs@3.14.3" defer />
      <title>
        {title} | {config.APP_NAME}
      </title>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* Compact theme overrides for Pico CSS */
        :root {
          --pico-font-size: 0.9rem;
          --pico-line-height: 1.4;
          --pico-spacing: 0.75rem;
          --pico-form-element-spacing-vertical: 0.5rem;
          --pico-form-element-spacing-horizontal: 0.75rem;
          --pico-nav-element-spacing-vertical: 0.5rem;
          --pico-nav-element-spacing-horizontal: 0.5rem;
          --pico-block-spacing-vertical: 0.75rem;
          --pico-block-spacing-horizontal: 0.75rem;
          --pico-typography-spacing-vertical: 0.75rem;
        }
        body { font-size: 0.9rem; }
        h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
        h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
        hgroup > p { margin-top: 0.25rem; font-size: 0.85rem; }
        nav { padding: 0.5rem 0; }
        main { padding-top: 1rem; }
        footer { padding: 0.75rem 0; font-size: 0.8rem; }
        article { padding: 0.75rem 1rem; }
        article header { padding-bottom: 0.5rem; margin-bottom: 0.5rem; font-size: 0.85rem; }
        article footer { padding-top: 0.5rem; margin-top: 0.5rem; }
        section { margin-bottom: 1.25rem; }
        details { font-size: 0.85rem; }
        details summary { padding: 0.5rem 0; }
        
        /* HTMX indicators */
        .htmx-request { opacity: 0.5; transition: opacity 200ms; }
        .htmx-indicator { display: none; }
        .htmx-request .htmx-indicator { display: inline; }
        .greeting-result { margin-top: 0.75rem; }
        
        /* Prevent button text wrapping in input groups */
        [role="group"] button { white-space: nowrap; }
      `,
        }}
      />
    </head>
    <body>
      <nav class="container">
        <ul>
          <li>
            <strong>{config.APP_NAME}</strong>
          </li>
        </ul>
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/api/health">Health</a>
          </li>
        </ul>
      </nav>
      <main class="container">{children}</main>
      <footer class="container">
        <small>
          Built with Hono, HTMX, and Pico CSS | Environment: {config.NODE_ENV}
        </small>
      </footer>
    </body>
  </html>
);
