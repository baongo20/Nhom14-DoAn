import os
import time
import random
import platform
import socket
import winreg
import psutil
from typing import List, Dict, Any, Tuple
from .schemas import (
    HardwareSnapshot, SystemInfo, CpuData, CpuCoreData,
    MemoryData, MemoryDetails, BatteryData, DiskData,
    DiskPartitionData, NetworkData, NetworkInterfaceData, ProcessData
)

# Optional WMI import for Windows temperature
try:
    import wmi
    # Initialize WMI in thread-safe manner inside functions if needed
except ImportError:
    wmi = None

class SystemMonitor:
    def __init__(self):
        self.hostname = socket.gethostname()
        self.os_name = "Windows"
        self.os_version = f"{platform.system()} {platform.release()} (Build {platform.version()})"
        self.cpu_model = self._get_cpu_model()
        self.physical_cores = psutil.cpu_count(logical=False) or 1
        self.logical_cores = psutil.cpu_count(logical=True) or 1
        self.boot_time = psutil.boot_time()
        
        # Tracking for network and disk speeds
        self.prev_time = time.time()
        self.prev_net_io = psutil.net_io_counters()
        self.prev_disk_io = psutil.disk_io_counters()
        
        # Process CPU tracking cache
        self.proc_cache: Dict[int, psutil.Process] = {}
        
        # WMI client container
        self._wmi_client = None
        self._wmi_failed = False

    def _get_cpu_model(self) -> str:
        try:
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            name, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            winreg.CloseKey(key)
            return name.strip()
        except Exception:
            return platform.processor() or "AMD/Intel Processor"

    def _get_wmi_client(self):
        if self._wmi_failed:
            return None
        if self._wmi_client is None and wmi is not None:
            try:
                # CoInitialize should technically be called per-thread in async,
                # but standard wmi.WMI() is fine for synchronous calls
                self._wmi_client = wmi.WMI(namespace="root\\wmi")
            except Exception:
                self._wmi_failed = True
        return self._wmi_client

    def get_cpu_temperature(self, current_usage: float) -> Tuple[float, bool]:
        """
        Attempts to read CPU temperature using WMI on Windows.
        If unavailable, falls back to a realistic estimate based on CPU utilization.
        """
        wmi_cli = self._get_wmi_client()
        if wmi_cli:
            try:
                # Query MSAcpi_ThermalZoneTemperature (returns temp in deci-Kelvin: 10 * Kelvin)
                thermal_zones = wmi_cli.MSAcpi_ThermalZoneTemperature()
                if thermal_zones:
                    # Take average or the first zone
                    temps = []
                    for zone in thermal_zones:
                        temp_k = zone.CurrentTemperature / 10.0
                        temp_c = temp_k - 273.15
                        # Ensure reasonable reading (sometimes faulty WMI reports 0 or static 300K)
                        if 10.0 < temp_c < 120.0:
                            temps.append(temp_c)
                    if temps:
                        return round(sum(temps) / len(temps), 1), False
            except Exception:
                # WMI failed, mark as failed to avoid log spam/stalls
                self._wmi_failed = True

        # Fallback thermodynamic model:
        # Idle = 35-40 C, Max Load = 75-85 C
        base_temp = 36.0
        thermal_gain = current_usage * 0.46
        noise = random.uniform(-1.2, 1.2)
        estimated_temp = base_temp + thermal_gain + noise
        return round(max(15.0, min(100.0, estimated_temp)), 1), True

    def get_cpu_power(self, current_usage: float) -> Tuple[float, bool]:
        """
        Estimates power draw in Watts based on logical cores, load, and random noise.
        """
        # Baseline idle: ~8W + 1.5W per core. Peak: scales with TDP (~65W-125W baseline)
        idle_power = 8.0 + (self.physical_cores * 1.5)
        tdp_estimate = 45.0 + (self.physical_cores * 10.0) # 65W for 2 cores, 105W for 6 cores
        range_power = tdp_estimate - idle_power
        
        load_factor = current_usage / 100.0
        # Dynamic power draw based on load with some efficiency curves
        power = idle_power + (range_power * (load_factor ** 1.2))
        power += random.uniform(-1.5, 1.5)
        return round(max(5.0, power), 1), True

    def get_cpu_load(self, overall_usage: float) -> List[float]:
        """
        Returns load average. On Windows, getloadavg() is not natively supported by psutil.
        We return current usage, and mock load averages (1m, 5m, 15m) based on sliding usage.
        """
        try:
            return list(psutil.getloadavg())
        except AttributeError:
            # Fallback for Windows
            # Generate realistic trailing loads
            l1 = overall_usage / 100.0 * self.logical_cores
            l5 = max(0.1, l1 * 0.95 + random.uniform(-0.1, 0.1))
            l15 = max(0.1, l5 * 0.92 + random.uniform(-0.05, 0.05))
            return [round(l1, 2), round(l5, 2), round(l15, 2)]

    def get_cpu_data(self) -> CpuData:
        # Call percpu usage ONCE to avoid psutil internal delta calculations resetting.
        cores_usage_raw = psutil.cpu_percent(interval=None, percpu=True)
        if not cores_usage_raw:
            cores_usage_raw = [0.0] * self.logical_cores
            
        overall_usage = sum(cores_usage_raw) / len(cores_usage_raw)
        
        cores_usage = [
            CpuCoreData(core_id=idx, usage=usage)
            for idx, usage in enumerate(cores_usage_raw)
        ]
        
        temp, temp_est = self.get_cpu_temperature(overall_usage)
        power, power_est = self.get_cpu_power(overall_usage)
        
        try:
            freq = psutil.cpu_freq().current
        except Exception:
            freq = 2500.0 # Default fallback in MHz
            
        return CpuData(
            overall_usage=overall_usage,
            cores_usage=cores_usage,
            load_avg=self.get_cpu_load(overall_usage),
            temperature=temp,
            temperature_estimated=temp_est,
            power_draw=power,
            power_draw_estimated=power_est,
            physical_cores=self.physical_cores,
            logical_cores=self.logical_cores,
            frequency_mhz=freq
        )

    def get_memory_data(self) -> MemoryData:
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        return MemoryData(
            virtual=MemoryDetails(
                total=vm.total,
                available=vm.available,
                used=vm.used,
                percent=vm.percent
            ),
            swap=MemoryDetails(
                total=swap.total,
                available=swap.free, # swap.free represents available swap space
                used=swap.used,
                percent=swap.percent
            )
        )

    def get_battery_data(self) -> BatteryData:
        battery = psutil.sensors_battery()
        if battery:
            return BatteryData(
                percent=round(battery.percent, 1),
                power_plugged=battery.power_plugged,
                secs_left=battery.secsleft if battery.secsleft is not None else -1
            )
        else:
            # Desktop computer - no battery
            return BatteryData(
                percent=100.0,
                power_plugged=True,
                secs_left=-1
            )

    def get_disk_data(self, delta_time: float) -> DiskData:
        partitions_data = []
        for part in psutil.disk_partitions(all=False):
            if 'cdrom' in part.opts or part.fstype == '':
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
                partitions_data.append(
                    DiskPartitionData(
                        device=part.device,
                        mountpoint=part.mountpoint,
                        fstype=part.fstype,
                        total=usage.total,
                        used=usage.used,
                        free=usage.free,
                        percent=usage.percent
                    )
                )
            except PermissionError:
                # System partition restricted or network drive disconnected
                continue
            except Exception:
                continue
                
        # Calculate speed
        curr_disk_io = psutil.disk_io_counters()
        read_speed = 0.0
        write_speed = 0.0
        
        if curr_disk_io and self.prev_disk_io and delta_time > 0:
            read_bytes = curr_disk_io.read_bytes - self.prev_disk_io.read_bytes
            write_bytes = curr_disk_io.write_bytes - self.prev_disk_io.write_bytes
            read_speed = max(0.0, read_bytes / delta_time)
            write_speed = max(0.0, write_bytes / delta_time)
            
        self.prev_disk_io = curr_disk_io
        
        return DiskData(
            partitions=partitions_data,
            read_speed_bps=read_speed,
            write_speed_bps=write_speed
        )

    def get_network_data(self, delta_time: float) -> NetworkData:
        interfaces = []
        net_io_by_if = psutil.net_io_counters(pernic=True)
        
        for if_name, counters in net_io_by_if.items():
            # Filter inactive interfaces or loops
            if counters.bytes_sent > 0 or counters.bytes_recv > 0:
                interfaces.append(
                    NetworkInterfaceData(
                        name=if_name,
                        bytes_sent=counters.bytes_sent,
                        bytes_recv=counters.bytes_recv
                    )
                )
                
        # Speed calculations
        curr_net_io = psutil.net_io_counters()
        up_speed = 0.0
        down_speed = 0.0
        
        if curr_net_io and self.prev_net_io and delta_time > 0:
            sent_bytes = curr_net_io.bytes_sent - self.prev_net_io.bytes_sent
            recv_bytes = curr_net_io.bytes_recv - self.prev_net_io.bytes_recv
            up_speed = max(0.0, sent_bytes / delta_time)
            down_speed = max(0.0, recv_bytes / delta_time)
            
        self.prev_net_io = curr_net_io
        
        return NetworkData(
            interfaces=interfaces,
            upload_speed_bps=up_speed,
            download_speed_bps=down_speed
        )

    def get_process_list(self) -> List[ProcessData]:
        processes = []
        # Querying active processes
        for proc in psutil.process_iter(['pid', 'name', 'status', 'cpu_percent', 'memory_percent', 'username']):
            try:
                # To get accurate cpu_percent, psutil needs cache because cpu_percent is computed
                # comparing time elapsed since last call. We keep a light reference cache.
                pid = proc.info['pid']
                if pid not in self.proc_cache:
                    self.proc_cache[pid] = proc
                
                cached_proc = self.proc_cache[pid]
                
                # Fetch cpu percent (non-blocking)
                cpu_p = cached_proc.cpu_percent(interval=None)
                
                processes.append(
                    ProcessData(
                        pid=pid,
                        name=proc.info['name'] or "Unknown",
                        status=proc.info['status'] or "unknown",
                        cpu_percent=round(cpu_p, 1),
                        memory_percent=round(proc.info['memory_percent'] or 0.0, 1),
                        username=proc.info['username']
                    )
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
                
        # Clean up dead cache
        current_pids = {p.pid for p in processes}
        self.proc_cache = {pid: pr for pid, pr in self.proc_cache.items() if pid in current_pids}
        
        # Sort processes by CPU usage first, then Memory usage, limit to top 15
        processes.sort(key=lambda x: (x.cpu_percent, x.memory_percent), reverse=True)
        return processes[:15]

    def get_snapshot(self) -> HardwareSnapshot:
        now = time.time()
        delta_time = now - self.prev_time
        self.prev_time = now
        
        sys_info = SystemInfo(
            os_name=self.os_name,
            os_version=self.os_version,
            hostname=self.hostname,
            cpu_model=self.cpu_model,
            ram_total=psutil.virtual_memory().total,
            uptime_seconds=now - self.boot_time
        )
        
        # Collect all parameters
        cpu = self.get_cpu_data()
        memory = self.get_memory_data()
        battery = self.get_battery_data()
        disk = self.get_disk_data(delta_time)
        network = self.get_network_data(delta_time)
        processes = self.get_process_list()
        
        return HardwareSnapshot(
            timestamp=now,
            system=sys_info,
            cpu=cpu,
            memory=memory,
            battery=battery,
            disk=disk,
            network=network,
            processes=processes
        )
