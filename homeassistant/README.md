# Sauna Control System - Home Assistant Configuration

This directory contains Home Assistant configuration files to replicate the functionality of the custom Sauna Control TypeScript application.

## Features

| Feature | Implementation |
|---------|---------------|
| MCB Control | LocalTuya switch |
| Phase Monitoring | MQTT sensors from P1 Monitor |
| Safety Shutdown | Automation with amperage threshold |
| Temperature Monitoring | MQTT from Ruuvi sensor |
| Door Sensor | MQTT binary sensor |
| Ventilator Control | Shelly integration with delayed off |
| Floor Heating | LocalTuya climate |
| Flic Button | Webhook automations |
| WhatsApp Notifications | Your existing WAHA integration |
| Dashboard | Lovelace cards |

## Prerequisites

1. **Home Assistant** installed and running
2. **HACS** (Home Assistant Community Store) installed
3. **LocalTuya** integration installed via HACS
4. **Shelly** integration configured
5. **MQTT** broker connected (for P1 Monitor, Ruuvi, door sensor)
6. **WhatsApp notification** already configured (as you mentioned)

## Installation

### Step 1: Install Required Integrations

```bash
# LocalTuya - Install via HACS
# Go to: HACS > Integrations > + Explore & Download > LocalTuya

# Shelly - Native integration
# Go to: Settings > Devices & Services > Add Integration > Shelly
```

### Step 2: Add the Package

Add the sauna package to your `configuration.yaml`:

```yaml
homeassistant:
  packages:
    sauna: !include packages/sauna.yaml
```

Or copy `packages/sauna.yaml` to your Home Assistant config directory:

```bash
cp packages/sauna.yaml /config/packages/
```

### Step 3: Add Automations

Copy the automation files to your automations directory:

```bash
cp automations/*.yaml /config/automations/
```

Or include them in your `configuration.yaml`:

```yaml
automation: !include_dir_merge_list automations/
```

If you use a single automations.yaml file, append the contents:

```bash
cat automations/*.yaml >> /config/automations.yaml
```

### Step 4: Add Scripts

Add scripts to your `configuration.yaml`:

```yaml
script: !include scripts/sauna_scripts.yaml
```

Or merge with existing scripts:

```yaml
script: !include_dir_merge_named scripts/
```

### Step 5: Configure LocalTuya Devices

Configure devices via the UI (Settings > Devices & Services > LocalTuya):

#### MCB (Main Circuit Breaker)

| Setting | Value |
|---------|-------|
| Device ID | `<from your .env: MCB_DEVICE_ID>` |
| Local Key | `<from your .env: MCB_LOCAL_KEY>` |
| IP Address | `<from your .env: MCB_DEVICE_IP>` |
| Protocol | 3.3 |
| Entity Type | Switch |
| DPS ID | 1 |
| Friendly Name | Sauna MCB |

#### Floor Heating Thermostat

| Setting | Value |
|---------|-------|
| Device ID | `<from your .env: FLOOR_HEATING_DEVICE_ID>` |
| Local Key | `<from your .env: FLOOR_HEATING_LOCAL_KEY>` |
| Protocol | 3.3 |
| Entity Type | Climate |
| Target Temp DP | 2 |
| Current Temp DP | 3 |
| Friendly Name | Sauna Floor Heating |

### Step 6: Configure Shelly Ventilator

The Shelly integration should auto-discover your device. If not:

1. Go to: Settings > Devices & Services > Add Integration
2. Select: Shelly
3. Enter IP: `<from your .env: SHELLY_VENTILATOR_IP>`
4. Rename entity to: `switch.sauna_ventilator`

### Step 7: Verify MQTT Topics

Ensure your MQTT broker is receiving data on these topics:

| Topic | Data |
|-------|------|
| `p1monitor/phase/l1_a` | Phase L1 amperage |
| `p1monitor/phase/l2_a` | Phase L2 amperage |
| `p1monitor/phase/l3_a` | Phase L3 amperage |
| `homelab/sensors/sauna/ruuvi/status` | Temperature/humidity JSON |
| `homelab/sensors/sauna/door/status` | Door sensor JSON |

Test with:

```bash
mosquitto_sub -h <mqtt_broker> -t "p1monitor/phase/#" -v
mosquitto_sub -h <mqtt_broker> -t "homelab/sensors/sauna/#" -v
```

### Step 8: Add Dashboard

1. Go to: Settings > Dashboards
2. Add Dashboard > Start with an empty dashboard
3. Edit Dashboard > Raw Configuration Editor
4. Paste contents from `lovelace/sauna_dashboard.yaml`

Or add as a view to an existing dashboard.

### Step 9: Configure Flic Button

In your Flic app, set up these HTTP requests:

| Action | URL |
|--------|-----|
| Click | `https://homeassistant.local/api/webhook/sauna_flic_click` |
| Double Click | `https://homeassistant.local/api/webhook/sauna_flic_double_click` |
| Hold | `https://homeassistant.local/api/webhook/sauna_flic_hold` |

Or use the universal webhook with action parameter:

```
https://homeassistant.local/api/webhook/sauna_flic?action=click
https://homeassistant.local/api/webhook/sauna_flic?action=double_click
https://homeassistant.local/api/webhook/sauna_flic?action=hold
```

## Entity Reference

After configuration, you should have these entities:

### Switches
- `switch.sauna_mcb` - Main circuit breaker
- `switch.sauna_ventilator` - Ventilator relay

### Climate
- `climate.sauna_floor_heating` - Floor heating thermostat

### Sensors
- `sensor.p1_phase_l1_amperage` - Phase L1 current
- `sensor.p1_phase_l2_amperage` - Phase L2 current
- `sensor.p1_phase_l3_amperage` - Phase L3 current
- `sensor.sauna_temperature` - Ruuvi temperature
- `sensor.sauna_humidity` - Ruuvi humidity
- `sensor.sauna_phase_max_amperage` - Maximum of all phases

### Binary Sensors
- `binary_sensor.sauna_door` - Door open/closed
- `binary_sensor.sauna_amperage_alert` - Over-threshold alert

### Input Numbers (Configurable)
- `input_number.sauna_amperage_threshold` - Safety threshold (default: 25A)
- `input_number.sauna_ventilator_delay_off_minutes` - Delay off time (default: 60min)
- `input_number.sauna_floor_heating_temp_on` - Temp when sauna on (default: 21°C)
- `input_number.sauna_floor_heating_temp_off` - Temp when sauna off (default: 5°C)

### Input Booleans (Feature Flags)
- `input_boolean.sauna_safety_shutdown_enabled`
- `input_boolean.sauna_notifications_enabled`
- `input_boolean.sauna_ventilator_control_enabled`
- `input_boolean.sauna_floor_heating_control_enabled`

### Timers
- `timer.sauna_ventilator_delay_off` - Ventilator cooldown timer
- `timer.sauna_safety_cooldown` - Prevents rapid on/off

### Scripts
- `script.sauna_toggle` - Toggle MCB
- `script.sauna_on` - Turn MCB on
- `script.sauna_off` - Turn MCB off
- `script.sauna_emergency_shutdown` - Emergency stop all
- `script.sauna_test_notification` - Test WhatsApp

## Comparison with Custom App

| Aspect | Custom App | Home Assistant |
|--------|------------|----------------|
| Safety Logic | TypeScript code | YAML automations |
| UI | Custom HTMX/SSE | Lovelace dashboard |
| Notifications | Direct WAHA API | HA notify service |
| Real-time Updates | SSE | HA frontend (auto) |
| Configuration | .env file | HA UI + YAML |
| Maintenance | Code updates | HA updates |
| Extensibility | Write code | Add integrations |

## Troubleshooting

### LocalTuya Not Connecting

1. Verify device IP is correct and reachable
2. Ensure no other app is connected to the device (Tuya devices support only 1 local connection)
3. Close Tuya/Smart Life app on your phone
4. Check protocol version (try 3.4 if 3.3 doesn't work)

### MQTT Sensors Not Updating

1. Verify MQTT broker connection in HA
2. Check topics with `mosquitto_sub`
3. Verify P1 Monitor and Ruuvi bridge are running

### Webhook Not Working from Flic

1. Ensure HA is accessible from Flic hub network
2. Try internal URL: `http://homeassistant.local:8123/api/webhook/...`
3. Check HA logs for webhook events

### Safety Shutdown Not Triggering

1. Check `input_boolean.sauna_safety_shutdown_enabled` is ON
2. Verify phase sensors are updating
3. Check threshold value in `input_number.sauna_amperage_threshold`
4. Look at automation trace in Settings > Automations

## File Structure

```
homeassistant/
├── packages/
│   ├── sauna.yaml              # Main package (sensors, inputs, templates)
│   └── localtuya_devices.yaml  # LocalTuya documentation
├── automations/
│   ├── sauna_safety.yaml       # Safety shutdown automations
│   ├── sauna_control.yaml      # MCB/ventilator control
│   └── sauna_flic.yaml         # Flic button webhooks
├── scripts/
│   └── sauna_scripts.yaml      # Reusable scripts
├── lovelace/
│   └── sauna_dashboard.yaml    # Dashboard configuration
└── README.md                   # This file
```

