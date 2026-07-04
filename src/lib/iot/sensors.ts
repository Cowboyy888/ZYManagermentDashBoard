// Sensor adapter stubs — temperature, power, MQTT.
// Phase 1: placeholder interfaces only. Phase 2: wire up real brokers / meters.

import type { IDeviceAdapter } from "./interfaces";
import type { DeviceConfig, MetricReading, DeviceStatus, ReadResult } from "./types";

export class MQTTAdapter implements IDeviceAdapter {
  readonly protocol = "MQTT";
  private config: DeviceConfig | null = null;

  async connect(config: DeviceConfig): Promise<ReadResult<void>> {
    // TODO Phase 2: import mqtt.js, connect to broker at config.ipAddress:config.port
    this.config = config;
    return { ok: false, error: "MQTT not yet implemented. Phase 2 integration pending." };
  }

  async disconnect(): Promise<void> {}

  async read(_metrics: string[]): Promise<ReadResult<MetricReading[]>> {
    return { ok: false, error: "Not implemented" };
  }

  async getStatus(): Promise<DeviceStatus> {
    return { deviceCode: this.config?.topicPrefix ?? "mqtt", online: false, lastSeenAt: null, error: "Stub" };
  }
}

export class RESTAdapter implements IDeviceAdapter {
  readonly protocol = "REST";
  private config: DeviceConfig | null = null;

  async connect(config: DeviceConfig): Promise<ReadResult<void>> {
    this.config = config;
    return { ok: true };
  }

  async disconnect(): Promise<void> {}

  async read(metrics: string[]): Promise<ReadResult<MetricReading[]>> {
    if (!this.config?.ipAddress) return { ok: false, error: "No endpoint configured" };
    // TODO Phase 2: fetch `http://${config.ipAddress}:${config.port}/metrics?tags=${metrics.join(',')}`
    return { ok: false, error: "REST polling not yet implemented. Phase 2 integration pending." };
  }

  async getStatus(): Promise<DeviceStatus> {
    return { deviceCode: this.config?.ipAddress ?? "rest", online: false, lastSeenAt: null, error: "Stub" };
  }
}

/**
 * Alarm rule evaluator — pure function, no I/O.
 * Evaluates sensor thresholds and returns triggered conditions.
 */
export function evaluateThresholds(metrics: Record<string, number>): { metric: string; severity: "WARNING" | "CRITICAL"; message: string }[] {
  const alerts: { metric: string; severity: "WARNING" | "CRITICAL"; message: string }[] = [];

  if (metrics.temperature != null) {
    if (metrics.temperature > 90) alerts.push({ metric: "temperature", severity: "CRITICAL", message: `Temperature critical: ${metrics.temperature}°C` });
    else if (metrics.temperature > 75) alerts.push({ metric: "temperature", severity: "WARNING", message: `Temperature high: ${metrics.temperature}°C` });
  }

  if (metrics.power_kw != null) {
    if (metrics.power_kw > 50) alerts.push({ metric: "power_kw", severity: "CRITICAL", message: `Power anomaly: ${metrics.power_kw} kW` });
  }

  return alerts;
}
