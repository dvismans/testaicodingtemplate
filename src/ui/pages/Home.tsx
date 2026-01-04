/**
 * Home page - demonstrates HTMX form submission.
 *
 * @see Rule #33-40
 */
import type { FC } from "hono/jsx";
import { GreetingForm } from "../components/GreetingForm.js";
import { BaseLayout } from "../layouts/Base.js";

/**
 * Home page with greeting form.
 * Server renders complete page; HTMX handles interactivity.
 */
export const HomePage: FC = () => (
  <BaseLayout title="Home">
    <hgroup>
      <h1>Hello World</h1>
      <p>A demonstration of data-centric functional architecture</p>
    </hgroup>

    <section>
      <h2>Try It</h2>
      <p>
        Enter your name below to receive a greeting. The form uses HTMX to
        submit to the server and swap the result without a full page reload.
      </p>

      <GreetingForm />

      {/* HTMX will swap greeting results here */}
      <div id="greeting-result" />
    </section>

    <section>
      <h2>Architecture Highlights</h2>
      <details>
        <summary>View implemented patterns</summary>
        <ul>
          <li>
            <strong>Typed Config:</strong> Zod-validated .env parsing at startup
          </li>
          <li>
            <strong>Module-scoped Loggers:</strong> Color-coded pino loggers per
            module
          </li>
          <li>
            <strong>Result Types:</strong> neverthrow for fallible operations
          </li>
          <li>
            <strong>Request ID Tracing:</strong> Unique ID per request for
            debugging
          </li>
          <li>
            <strong>Pure Transformations:</strong> Immutable data, no side
            effects
          </li>
          <li>
            <strong>HTMX + Pico CSS:</strong> Server-rendered HTML, minimal JS
          </li>
          <li>
            <strong>Global Error Boundary:</strong> Clean error handling
          </li>
        </ul>
      </details>
    </section>
  </BaseLayout>
);
