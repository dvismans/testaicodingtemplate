/**
 * SSE Connection Status Handler
 *
 * Handles HTMX SSE events for connection status display.
 */
(function () {
  "use strict";

  function handleSseOpen() {
    var bar = document.getElementById("connection-status");
    if (bar) {
      bar.className = "connection-bar connected";
      bar.textContent = "Connected";
    }
    document.body.setAttribute("data-sse-connected", "true");
  }

  function handleSseError() {
    var bar = document.getElementById("connection-status");
    if (bar) {
      bar.className = "connection-bar disconnected";
      bar.textContent = "Disconnected - Reconnecting...";
    }
    document.body.setAttribute("data-sse-connected", "false");
  }

  function handleSseClose() {
    var bar = document.getElementById("connection-status");
    if (bar) {
      bar.className = "connection-bar disconnected";
      bar.textContent = "Disconnected";
    }
    document.body.setAttribute("data-sse-connected", "false");
  }

  document.body.addEventListener("htmx:sseOpen", handleSseOpen);
  document.body.addEventListener("htmx:sseError", handleSseError);
  document.body.addEventListener("htmx:sseClose", handleSseClose);
})();

