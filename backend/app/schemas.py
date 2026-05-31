from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CpuCoreData(BaseModel):
    core_id: int
    usage: float

class CpuData(BaseModel):
    overall_usage: float
    cores_usage: List[CpuCoreData]
    load_avg: List[float]
    temperature: float
    temperature_estimated: bool
    power_draw: float
    power_draw_estimated: bool
    physical_cores: int
    logical_cores: int
    frequency_mhz: float

class MemoryDetails(BaseModel):
    total: int
    available: int
    used: int
    percent: float

class MemoryData(BaseModel):
    virtual: MemoryDetails
    swap: MemoryDetails

class BatteryData(BaseModel):
    percent: float
    power_plugged: bool
    secs_left: int  # -1 if fully charged or plugged in, -2 if unknown

class DiskPartitionData(BaseModel):
    device: str
    mountpoint: str
    fstype: str
    total: int
    used: int
    free: int
    percent: float

class DiskData(BaseModel):
    partitions: List[DiskPartitionData]
    read_speed_bps: float
    write_speed_bps: float

class NetworkInterfaceData(BaseModel):
    name: str
    bytes_sent: int
    bytes_recv: int

class NetworkData(BaseModel):
    interfaces: List[NetworkInterfaceData]
    upload_speed_bps: float
    download_speed_bps: float

class ProcessData(BaseModel):
    pid: int
    name: str
    status: str
    cpu_percent: float
    memory_percent: float
    username: Optional[str] = None

class SystemInfo(BaseModel):
    os_name: str
    os_version: str
    hostname: str
    cpu_model: str
    ram_total: int
    uptime_seconds: float

class HardwareSnapshot(BaseModel):
    timestamp: float
    system: SystemInfo
    cpu: CpuData
    memory: MemoryData
    battery: BatteryData
    disk: DiskData
    network: NetworkData
    processes: List[ProcessData]

# ── New Schemas for AI Predictions & Anomaly Detection ──────────────────

class PredictedMetrics(BaseModel):
    """Predicted values for each hardware metric at a future timestep.
    Matches the 6 features the model was trained on."""
    cpu_temperature: float = 0.0
    cpu_usage: float = 0.0
    cpu_load: float = 0.0
    memory_usage: float = 0.0
    battery_level: float = 0.0
    cpu_power: float = 0.0

class PredictionData(BaseModel):
    """Container for forecast results."""
    next_steps: List[PredictedMetrics] = []
    forecast_confidence: float = 0.0

class AnomalyData(BaseModel):
    """Container for anomaly detection results."""
    is_anomaly: bool = False
    anomaly_score: float = 0.0
    anomaly_type: Optional[str] = None
    details: str = "System operating within normal parameters."

class InferenceData(BaseModel):
    """Top-level wrapper for all AI inference output."""
    prediction: PredictionData = PredictionData()
    anomaly: AnomalyData = AnomalyData()
    model_active: bool = False
    warming_up: bool = False
