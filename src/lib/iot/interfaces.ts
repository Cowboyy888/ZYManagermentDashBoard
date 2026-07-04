// Extensibility interfaces for IoT adapters.
// Implement these to add a new device protocol — no other code changes required.

import type { DeviceConfig, MetricReading, DeviceStatus, MachineSnapshot, ReadResult } from "./types";

/**
 * A device adapter reads one or more metrics from a physical device.
 * Each protocol (Modbus, MQTT, OPC-UA) implements this interface.
 */
export interface IDeviceAdapter {
  readonly protocol: string;
  connect(config: DeviceConfig): Promise<ReadResult<void>>;
  disconnect(): Promise<void>;
  read(metrics: string[]): Promise<ReadResult<MetricReading[]>>;
  getStatus(): Promise<DeviceStatus>;
}

/**
 * A machine data provider aggregates readings from one or more adapters
 * and maps them to a normalized MachineSnapshot.
 */
export interface IMachineDataProvider {
  getMachineSnapshot(machineCode: string): Promise<ReadResult<MachineSnapshot>>;
  getAllSnapshots(): Promise<ReadResult<MachineSnapshot[]>>;
}

/**
 * Alarm evaluator — inspects a snapshot and emits alarm conditions.
 * Phase 1: rule-based. Phase 2+: ML anomaly detection.
 */
export interface IAlarmEvaluator {
  evaluate(snapshot: MachineSnapshot): Promise<AlarmCondition[]>;
}

export interface AlarmCondition {
  machineCode: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description?: string;
}

/**
 * Data sink — where normalized readings land after collection.
 * Phase 1: PostgreSQL via Prisma. Phase 2+: time-series DB (InfluxDB / TimescaleDB).
 */
export interface IDataSink {
  writeReading(reading: MetricReading): Promise<void>;
  writeBatch(readings: MetricReading[]): Promise<void>;
}

/**
 * Scanner adapter for barcode / QR / RFID devices.
 */
export interface IScannerAdapter {
  readonly deviceType: "BARCODE" | "QR" | "RFID";
  onScan(handler: (code: string, deviceCode: string) => void): void;
  offScan(): void;
}

/**
 * Scale adapter — industrial weighing scales.
 */
export interface IScaleAdapter {
  readWeight(unit?: "kg" | "g" | "lb"): Promise<ReadResult<number>>;
  tare(): Promise<ReadResult<void>>;
}
