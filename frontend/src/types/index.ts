// ── Hardware Snapshot Types (mirrors backend schemas) ──────────────────

export interface CpuCoreData {
  core_id: number;
  usage: number;
}

export interface CpuData {
  overall_usage: number;
  cores_usage: CpuCoreData[];
  load_avg: number[];
  temperature: number;
  temperature_estimated: boolean;
  power_draw: number;
  power_draw_estimated: boolean;
  physical_cores: number;
  logical_cores: number;
  frequency_mhz: number;
}

export interface MemoryDetails {
  total: number;
  available: number;
  used: number;
  percent: number;
}

export interface MemoryData {
  virtual: MemoryDetails;
  swap: MemoryDetails;
}

export interface BatteryData {
  percent: number;
  power_plugged: boolean;
  secs_left: number;
}

export interface DiskPartitionData {
  device: string;
  mountpoint: string;
  fstype: string;
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface DiskData {
  partitions: DiskPartitionData[];
  read_speed_bps: number;
  write_speed_bps: number;
}

export interface NetworkInterfaceData {
  name: string;
  bytes_sent: number;
  bytes_recv: number;
}

export interface NetworkData {
  interfaces: NetworkInterfaceData[];
  upload_speed_bps: number;
  download_speed_bps: number;
}

export interface ProcessItem {
  pid: number;
  name: string;
  status: string;
  cpu_percent: number;
  memory_percent: number;
  username: string | null;
}

export interface SystemInfo {
  os_name: string;
  os_version: string;
  hostname: string;
  cpu_model: string;
  ram_total: number;
  uptime_seconds: number;
}

export interface HardwareSnapshot {
  timestamp: number;
  system: SystemInfo;
  cpu: CpuData;
  memory: MemoryData;
  battery: BatteryData;
  disk: DiskData;
  network: NetworkData;
  processes: ProcessItem[];
}

// ── AI Inference Types ─────────────────────────────────────────────────

export interface PredictedMetrics {
  cpu_temperature: number;
  cpu_usage: number;
  cpu_load: number;
  memory_usage: number;
  battery_level: number;
  cpu_power: number;
}

export interface PredictionData {
  next_steps: PredictedMetrics[];
  forecast_confidence: number;
}

export interface AnomalyData {
  is_anomaly: boolean;
  anomaly_score: number;
  anomaly_type: string | null;
  details: string;
}

export interface InferenceData {
  prediction: PredictionData;
  anomaly: AnomalyData;
  model_active: boolean;
  warming_up: boolean;
}

// ── WebSocket Payload (merged snapshot + inference) ────────────────────

export interface WsPayload {
  timestamp: number;
  snapshot: HardwareSnapshot;
  prediction: PredictionData;
  anomaly: AnomalyData;
  model_active: boolean;
  warming_up: boolean;
}

// ── Chart History Point ────────────────────────────────────────────────

export interface HistoryPoint {
  timeStr: string;
  cpu: number;
  memory: number;
  temp: number;
  power: number;
  // Predicted values for overlay (optional)
  predictedCpu?: number;
  predictedMemory?: number;
  predictedTemp?: number;
  predictedPower?: number;
}
