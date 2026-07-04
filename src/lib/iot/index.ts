// IoT service layer — public API surface.
// Import from here, not directly from adapter files.

export type { DeviceConfig, MetricReading, DeviceStatus, MachineSnapshot, ReadResult } from "./types";
export type { IDeviceAdapter, IMachineDataProvider, IAlarmEvaluator, AlarmCondition, IDataSink, IScannerAdapter, IScaleAdapter } from "./interfaces";
export { createPLCAdapter } from "./plc";
export { evaluateThresholds } from "./sensors";

/**
 * Supported protocols (for UI dropdowns and validation).
 * Update when new adapters are added in Phase 2+.
 */
export const SUPPORTED_PROTOCOLS = ["MODBUS", "OPCUA", "MQTT", "HTTP", "SERIAL", "REST"] as const;
export type SupportedProtocol = typeof SUPPORTED_PROTOCOLS[number];

/**
 * Integration status — used on the IoT dashboard to show readiness.
 */
export type IntegrationPhase = "STUB" | "CONFIGURED" | "ACTIVE" | "ERROR";

export function getIntegrationPhase(_protocol: string): IntegrationPhase {
  // Phase 1: all protocols are stubs
  return "STUB";
}

export const IOT_INTEGRATION_NOTE = "Phase 1: Interface layer only. Hardware communication will be enabled in Phase 2 after PLC/sensor hardware selection and network configuration.";
