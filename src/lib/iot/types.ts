// IoT / PLC integration type contracts.
// Phase 1: Interfaces only. No hardware communication implemented.
// Phase 2+: Concrete adapters replace the stubs.

export type IoTProtocol = "MODBUS" | "OPCUA" | "MQTT" | "HTTP" | "SERIAL" | "REST";

export interface DeviceConfig {
  protocol: IoTProtocol;
  ipAddress?: string;
  port?: number;
  slaveId?: number;       // Modbus slave ID
  topicPrefix?: string;   // MQTT topic prefix
  pollIntervalMs?: number;
  timeout?: number;
}

export interface MetricReading {
  deviceCode: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt: Date;
  quality: "GOOD" | "BAD" | "UNCERTAIN";
}

export interface DeviceStatus {
  deviceCode: string;
  online: boolean;
  lastSeenAt: Date | null;
  error?: string;
}

export interface MachineSnapshot {
  machineCode: string;
  isRunning: boolean;
  speedRpm?: number;
  outputCount?: number;
  temperature?: number;
  powerKw?: number;
  source: "MANUAL" | "PLC" | "MODBUS" | "MQTT" | "OPCUA";
  timestamp: Date;
}

// Generic read result — allows adapters to signal partial failures
export interface ReadResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
