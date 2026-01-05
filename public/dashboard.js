/**
 * Sauna Control Dashboard Client Script
 *
 * Handles SSE connection, real-time updates, and MCB control.
 * Includes "time ago" counters for sensor data freshness.
 */
(function () {
  "use strict";

  // ==========================================================================
  // State
  // ==========================================================================

  var mcbStatus = null;
  var eventSource = null;
  var reconnectAttempts = 0;
  var MAX_RECONNECT_DELAY = 30000;

  // Timestamps for "time ago" display (null = never received)
  var timestamps = {
    temperature: null,
    door: null,
    ventilator: null,
    phase: null,
    floorHeating: null,
  };

  // Cached sensor values for display
  var sensorData = {
    temperature: null,
    humidity: null,
    doorOpen: null,
    doorBattery: null,
    ventilatorOn: null,
    phase: { l1: null, l2: null, l3: null },
    floorHeating: { currentTemp: null, targetTemp: null, action: null },
  };

  // ==========================================================================
  // DOM Elements
  // ==========================================================================

  var connectionEl = document.getElementById("connection-status");
  var mcbToggle = document.getElementById("mcb-toggle");
  var mcbStatusText = document.getElementById("mcb-status-text");
  var tempValue = document.getElementById("temp-value");
  var tempAge = document.getElementById("temp-age");
  var phaseSection = document.getElementById("phase-section");
  var phaseAge = document.getElementById("phase-age");
  var doorStatus = document.getElementById("door-status");
  var ventilatorStatus = document.getElementById("ventilator-status");
  var floorHeatingStatus = document.getElementById("floor-heating-status");

  // ==========================================================================
  // Time Formatting
  // ==========================================================================

  /**
   * Format seconds ago into human-readable string.
   */
  function formatAge(seconds) {
    if (seconds < 0) return "time sync issue";
    if (seconds < 5) return "just now";
    if (seconds < 60) return seconds + "s ago";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    return Math.floor(seconds / 86400) + "d ago";
  }

  /**
   * Get age in seconds from timestamp.
   */
  function getAgeSeconds(timestamp) {
    if (!timestamp) return null;
    return Math.floor((Date.now() - timestamp) / 1000);
  }

  // ==========================================================================
  // UI Update Functions
  // ==========================================================================

  function setConnectionStatus(connected, message) {
    if (!connectionEl) return;
    connectionEl.textContent = message;
    connectionEl.style.background = connected
      ? "var(--pico-ins-color, #22c55e)"
      : "var(--pico-del-color, #ef4444)";
    connectionEl.style.color = "white";
  }

  function updateMcbButton() {
    if (!mcbToggle || !mcbStatusText) return;

    if (mcbStatus === "ON") {
      // Red button when ON (danger - click to turn off)
      mcbToggle.className = "";
      mcbToggle.style.background = "#dc2626";
      mcbToggle.style.borderColor = "#dc2626";
      mcbToggle.style.color = "white";
      mcbStatusText.textContent = "Sauna ON — Turn OFF";
      mcbToggle.disabled = false;
    } else if (mcbStatus === "OFF") {
      // Green button when OFF (safe - click to turn on)
      mcbToggle.className = "";
      mcbToggle.style.background = "#16a34a";
      mcbToggle.style.borderColor = "#16a34a";
      mcbToggle.style.color = "white";
      mcbStatusText.textContent = "Sauna OFF — Turn ON";
      mcbToggle.disabled = false;
    } else {
      // Gray button when unknown
      mcbToggle.className = "secondary outline";
      mcbToggle.style.background = "";
      mcbToggle.style.borderColor = "";
      mcbToggle.style.color = "";
      mcbStatusText.textContent = "Status Unknown";
      mcbToggle.disabled = true;
    }

    // Show/hide phase section based on MCB status
    updatePhaseSectionVisibility();
  }

  /**
   * Show phase section only when sauna is ON.
   * When OFF, phase data is not relevant to sauna operation.
   */
  function updatePhaseSectionVisibility() {
    if (!phaseSection) return;

    if (mcbStatus === "ON") {
      phaseSection.style.display = "";
    } else {
      phaseSection.style.display = "none";
    }
  }

  function updatePhaseDisplay() {
    ["l1", "l2", "l3"].forEach(function (phase) {
      var el = document.getElementById(phase + "-value");
      if (el) {
        var value = sensorData.phase[phase];
        el.textContent =
          value !== null && value !== undefined ? value.toFixed(1) : "—";
      }
    });
  }

  function updatePhaseAge() {
    if (!phaseAge) return;
    var age = getAgeSeconds(timestamps.phase);
    if (age === null) {
      phaseAge.innerHTML = "<small>Phase data unavailable</small>";
    } else {
      phaseAge.innerHTML = "<small>Updated: " + formatAge(age) + "</small>";
    }
  }

  function updateTemperatureDisplay() {
    if (!tempValue) return;
    if (sensorData.temperature !== null) {
      tempValue.innerHTML =
        sensorData.temperature.toFixed(1) +
        '<span style="font-size:2rem">°C</span>';
    } else {
      tempValue.innerHTML = '—<span style="font-size:2rem">°C</span>';
    }
  }

  function updateTemperatureAge() {
    if (!tempAge) return;
    var age = getAgeSeconds(timestamps.temperature);
    if (age === null) {
      tempAge.textContent = "Temperature unavailable";
    } else {
      tempAge.textContent = "Updated: " + formatAge(age);
    }
  }

  function updateDoorDisplay() {
    if (!doorStatus) return;
    var age = getAgeSeconds(timestamps.door);

    if (sensorData.doorOpen === null) {
      doorStatus.innerHTML =
        "<small>Door status unavailable</small>";
      return;
    }

    var status = sensorData.doorOpen ? "OPEN" : "CLOSED";
    var battery =
      sensorData.doorBattery !== null
        ? " (" + sensorData.doorBattery + "%)"
        : "";
    var ageStr = age !== null ? " · " + formatAge(age) : "";

    doorStatus.innerHTML =
      "<small>Door: " + status + battery + ageStr + "</small>";
  }

  function updateVentilatorDisplay() {
    if (!ventilatorStatus) return;
    var age = getAgeSeconds(timestamps.ventilator);

    if (sensorData.ventilatorOn === null) {
      ventilatorStatus.innerHTML =
        "<small>Ventilator status unavailable</small>";
      return;
    }

    var status = sensorData.ventilatorOn ? "ON" : "OFF";
    var ageStr = age !== null ? " · " + formatAge(age) : "";

    ventilatorStatus.innerHTML =
      "<small>Ventilator: " + status + ageStr + "</small>";
  }

  function updateFloorHeatingDisplay() {
    if (!floorHeatingStatus) return;
    var age = getAgeSeconds(timestamps.floorHeating);

    if (sensorData.floorHeating.currentTemp === null) {
      floorHeatingStatus.innerHTML =
        "<small>Floor heating unavailable</small>";
      return;
    }

    var temp = sensorData.floorHeating.currentTemp.toFixed(1);
    var target = sensorData.floorHeating.targetTemp;
    var action = sensorData.floorHeating.action;
    var ageStr = age !== null ? " · " + formatAge(age) : "";

    // Show action indicator
    var actionIcon = action === "heating" ? "🔥" : (action === "warming" ? "♨️" : "");
    
    floorHeatingStatus.innerHTML =
      "<small>Floor: " + temp + "°C → " + target + "°C " + actionIcon + ageStr + "</small>";
  }

  /**
   * Update all age displays (called every second).
   */
  function updateAllAges() {
    updateTemperatureAge();
    updatePhaseAge();
    updateDoorDisplay();
    updateVentilatorDisplay();
    updateFloorHeatingDisplay();
  }

  // ==========================================================================
  // SSE Event Handlers
  // ==========================================================================

  function handlePhaseData(data) {
    sensorData.phase.l1 = data.l1;
    sensorData.phase.l2 = data.l2;
    sensorData.phase.l3 = data.l3;

    // Only update timestamp if we have actual data (not all nulls)
    if (data.l1 !== null || data.l2 !== null || data.l3 !== null) {
      timestamps.phase = Date.now();
    }

    updatePhaseDisplay();
    updatePhaseAge();
  }

  function handleTemperature(data) {
    sensorData.temperature = data.temperature;
    sensorData.humidity = data.humidity;
    timestamps.temperature = Date.now();

    updateTemperatureDisplay();
    updateTemperatureAge();
  }

  function handleDoor(data) {
    sensorData.doorOpen = data.isOpen;
    sensorData.doorBattery = data.batteryPercent || null;
    timestamps.door = Date.now();

    updateDoorDisplay();
  }

  function handleVentilator(data) {
    sensorData.ventilatorOn = data.status;
    timestamps.ventilator = Date.now();

    updateVentilatorDisplay();
  }

  function handleFloorHeating(data) {
    sensorData.floorHeating.currentTemp = data.currentTemp;
    sensorData.floorHeating.targetTemp = data.targetTemp;
    sensorData.floorHeating.action = data.action;
    timestamps.floorHeating = Date.now();

    updateFloorHeatingDisplay();
  }

  // ==========================================================================
  // SSE Connection
  // ==========================================================================

  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    setConnectionStatus(false, "Connecting...");
    eventSource = new EventSource("/api/events");

    eventSource.onopen = function () {
      setConnectionStatus(true, "Connected");
      reconnectAttempts = 0;
    };

    eventSource.addEventListener("connected", function (e) {
      console.log("SSE connected:", JSON.parse(e.data));
    });

    eventSource.addEventListener("mcb_status", function (e) {
      var data = JSON.parse(e.data);
      mcbStatus = data.status;
      updateMcbButton();
    });

    eventSource.addEventListener("sensor_data", function (e) {
      var data = JSON.parse(e.data);
      handlePhaseData(data);
    });

    eventSource.addEventListener("temperature", function (e) {
      var data = JSON.parse(e.data);
      handleTemperature(data);
    });

    eventSource.addEventListener("door", function (e) {
      var data = JSON.parse(e.data);
      handleDoor(data);
    });

    eventSource.addEventListener("ventilator", function (e) {
      var data = JSON.parse(e.data);
      handleVentilator(data);
    });

    eventSource.addEventListener("floor_heating", function (e) {
      var data = JSON.parse(e.data);
      handleFloorHeating(data);
    });

    eventSource.addEventListener("heartbeat", function (e) {
      console.log("SSE heartbeat:", JSON.parse(e.data));
    });

    eventSource.onerror = function () {
      setConnectionStatus(false, "Disconnected. Reconnecting...");

      // Exponential backoff
      reconnectAttempts++;
      var delay = Math.min(
        1000 * Math.pow(2, reconnectAttempts),
        MAX_RECONNECT_DELAY
      );

      setTimeout(connectSSE, delay);
    };
  }

  // ==========================================================================
  // MCB Control
  // ==========================================================================

  if (mcbToggle) {
    mcbToggle.addEventListener("click", function (e) {
      e.preventDefault();
      if (mcbStatus === null) return;

      var action = mcbStatus === "ON" ? "off" : "on";
      mcbToggle.disabled = true;
      mcbStatusText.textContent = "Sending...";

      fetch("/api/mcb/" + action, { method: "POST" })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (data.success) {
            mcbStatus = action.toUpperCase();
          }
          updateMcbButton();
        })
        .catch(function (err) {
          console.error("MCB control error:", err);
          updateMcbButton();
        });
    });
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  // Start SSE connection
  connectSSE();

  // Hide phase section initially (until we know MCB is ON)
  if (phaseSection) {
    phaseSection.style.display = "none";
  }

  // Initial MCB status fetch
  fetch("/api/mcb/status")
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      mcbStatus = data.status;
      updateMcbButton();
    })
    .catch(function (err) {
      console.error("Initial status fetch error:", err);
    });

  // Update age displays every second
  setInterval(updateAllAges, 1000);
})();
