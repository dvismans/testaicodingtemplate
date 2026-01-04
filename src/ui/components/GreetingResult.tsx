/**
 * Greeting result components - server returns these HTML fragments.
 * These are swapped in by HTMX, not rendered client-side.
 *
 * @see Rule #33, #38
 */
import type { FC } from "hono/jsx";
import type { GreetingError, GreetingResponse } from "../../greeting/index.js";

type GreetingSuccessProps = {
  readonly response: GreetingResponse;
};

/**
 * Success result - displayed when greeting succeeds.
 * Uses Pico's article element which renders as a card.
 */
export const GreetingSuccess: FC<GreetingSuccessProps> = ({ response }) => (
  <article class="greeting-result">
    <header>Greeting</header>
    <p>{response.message}</p>
    <footer>
      <small>
        Request ID: <code>{response.requestId}</code>
        <br />
        Timestamp: {new Date(response.timestamp).toLocaleString()}
      </small>
    </footer>
  </article>
);

type GreetingErrorProps = {
  readonly error: GreetingError;
  readonly requestId: string;
};

/**
 * Error result - displayed when greeting fails.
 * Provides context for debugging.
 */
export const GreetingErrorDisplay: FC<GreetingErrorProps> = ({
  error,
  requestId,
}) => {
  const message =
    error.type === "VALIDATION_FAILED"
      ? error.issues.map((i) => i.message).join(", ")
      : error.reason;

  return (
    <article class="greeting-result" aria-label="Error">
      <header>Error</header>
      <p>{message}</p>
      <footer>
        <small>
          Error type: <code>{error.type}</code>
          <br />
          Request ID: <code>{requestId}</code>
        </small>
      </footer>
    </article>
  );
};
