/**
 * Greeting form component - uses HTMX for server interaction.
 * No client-side state management - server handles everything.
 *
 * @see Rule #34, #36
 */
import type { FC } from "hono/jsx";

/**
 * Form for submitting greeting requests.
 * HTMX handles the POST and swaps the result into #greeting-result.
 */
export const GreetingForm: FC = () => (
  <form
    hx-post="/api/greet"
    hx-target="#greeting-result"
    hx-swap="innerHTML"
    hx-indicator="#greeting-loading"
  >
    {/* role="group" tells Pico CSS to render as inline input+button group */}
    <div role="group">
      <input
        type="text"
        name="name"
        placeholder="Enter your name"
        required
        minlength={1}
        maxlength={100}
        aria-label="Your name"
      />
      <button type="submit">Say Hello</button>
    </div>
    <span class="htmx-indicator" id="greeting-loading" aria-busy="true">
      Sending...
    </span>
  </form>
);
