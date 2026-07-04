// PLC adapter stub — Modbus TCP / OPC-UA placeholder.
// Replace with real implementation (e.g., node-modbus, node-opcua) in Phase 2.

import type { IDeviceAdapter } from "./interfaces";
import type { DeviceConfig, MetricReading, DeviceStatus, ReadResult } from "./types";

export class ModbusTCPAdapter implements IDeviceAdapter {
  readonly protocol = "MODBUS";
  private connected = false;
  private config: DeviceConfig | null = null;

  async connect(config: DeviceConfig): Promise<ReadResult<void>> {
    // TODO Phase 2: import and configure modbus-serial or similar
    this.config = config;
    this.connected = false; // stub: never actually connects
    return { ok: false, error: "Modbus TCP not yet implemented. Phase 2 integration pending." };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async read(_metrics: string[]): Promise<ReadResult<MetricReading[]>> {
    if (!this.connected) return { ok: false, error: "Not connected" };
    return { ok: false, error: "Not implemented" };
  }

  async getStatus(): Promise<DeviceStatus> {
    return { deviceCode: this.config?.ipAddress ?? "unknown", online: false, lastSeenAt: null, error: "Stub" };
  }
}

export class OPCUAAdapter implements IDeviceAdapter {
  readonly protocol = "OPCUA";
  private config: DeviceConfig | null = null;

  async connect(config: DeviceConfig): Promise<ReadResult<void>> {
    // TODO Phase 2: import node-opcua
    this.config = config;
    return { ok: false, error: "OPC-UA not yet implemented. Phase 2 integration pending." };
  }

  async disconnect(): Promise<void> {}

  async read(_metrics: string[]): Promise<ReadResult<MetricReading[]>> {
    return { ok: false, error: "Not implemented" };
  }

  async getStatus(): Promise<DeviceStatus> {
    return { deviceCode: this.config?.ipAddress ?? "unknown", online: false, lastSeenAt: null, error: "Stub" };
  }
}

/**
 * Factory function — returns the right adapter for a given protocol.
 * Add new protocols here as they are implemented.
 */
export function createPLCAdapter(protocol: string): IDeviceAdapter | null {
  switch (protocol) {
    case "MODBUS": return new ModbusTCPAdapter();
    case "OPCUA":  return new OPCUAAdapter();
    default:       return null;
  }
}
