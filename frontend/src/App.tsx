import { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Cpu } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { AnomalyAlert } from './components/AnomalyAlert';
import type { WsPayload, HistoryPoint, AnomalyData, PredictedMetrics } from './types';

export function App() {
  const [wsPayload, setWsPayload] = useState<WsPayload | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [anomaly, setAnomaly] = useState<AnomalyData | null>(null);
  const [predictions, setPredictions] = useState<PredictedMetrics[]>([]);
  const [forecastConfidence, setForecastConfidence] = useState(0);
  const [modelActive, setModelActive] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const connectAttemptsRef = useRef(0);
  const reconnectDelayRef = useRef(1000);
  const isConnectingRef = useRef(false);

  // Parse time from epoch timestamp
  const formatTime = (epoch: number) => {
    const d = new Date(epoch * 1000);
    return d.toTimeString().split(' ')[0];
  };

  // Stable connect function — never recreated (empty deps)
  const connect = useCallback(() => {
    // Guard: don't connect if component unmounted
    if (!mountedRef.current) return;

    // Guard: prevent concurrent connect() calls
    if (isConnectingRef.current) {
      console.log("Already connecting, skipping...");
      return;
    }

    // Guard: if already have an open/connecting socket, skip
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        console.log("WebSocket already open or connecting, skipping...");
        return;
      }
    }

    // Guard: throttle rapid reconnect attempts
    const now = Date.now();
    if (connectAttemptsRef.current > 0 && (now - connectAttemptsRef.current) < 500) {
      console.log("Throttling rapid reconnect attempts...");
      return;
    }
    connectAttemptsRef.current = now;
    isConnectingRef.current = true;

    console.log("Establishing connection to WebSocket stream...");
    const ws = new WebSocket('ws://127.0.0.1:8000/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket channel connected successfully.');
      isConnectingRef.current = false;
      setIsConnected(true);
      reconnectDelayRef.current = 1000;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: WsPayload = JSON.parse(event.data);

        setWsPayload(data);

        if (data.anomaly) {
          setAnomaly(data.anomaly);
        }
        if (data.prediction) {
          setPredictions(data.prediction.next_steps || []);
          setForecastConfidence(data.prediction.forecast_confidence || 0);
        }
        setModelActive(data.model_active || false);
        setWarmingUp(data.warming_up || false);

        const timeStr = formatTime(data.timestamp);
        const snapshot = data.snapshot;
        const newPoint: HistoryPoint = {
          timeStr,
          cpu: snapshot.cpu.overall_usage,
          memory: snapshot.memory.virtual.percent,
          temp: snapshot.cpu.temperature,
          power: snapshot.cpu.power_draw,
        };

        if (data.prediction?.next_steps?.length > 0) {
          const next = data.prediction.next_steps[0];
          newPoint.predictedCpu = next.cpu_usage;
          newPoint.predictedMemory = next.memory_usage;
          newPoint.predictedTemp = next.cpu_temperature;
          newPoint.predictedPower = next.cpu_power;
        }

        setHistory((prev) => {
          const next = [...prev, newPoint];
          if (next.length > 120) {
            next.shift();
          }
          return next;
        });

      } catch (err) {
        console.error('Error parsing inbound telemetry payload:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed.');
      isConnectingRef.current = false;
      setIsConnected(false);

      if (!mountedRef.current) return;

      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 8000);
      console.log(`Scheduling reconnect attempt in ${delay}ms`);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, delay);
    };

    ws.onerror = (err) => {
      console.error('WebSocket encountered telemetry error:', err);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reconnectDelayRef.current = 1000;
    connect();

    return () => {
      mountedRef.current = false;
      isConnectingRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent onclose from firing after unmount
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const handleManualReconnect = () => {
    reconnectDelayRef.current = 1000;
    connect();
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 relative">
      <AnomalyAlert
        anomaly={anomaly}
        modelActive={modelActive}
        warmingUp={warmingUp}
      />

      <nav className="glass-panel border-b border-slate-800/80 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                Hardware Sentinel
              </h1>
              <p className="text-[10px] text-slate-500 tracking-wider uppercase">
                Real-Time Performance Monitor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {modelActive ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Model Active
              </span>
            ) : warmingUp ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Warming Up
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                No Model
              </span>
            )}

            {isConnected ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            ) : (
              <button
                onClick={handleManualReconnect}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Stream Lost - Reconnect
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="py-6 relative z-10">
        <Dashboard
          snapshot={wsPayload?.snapshot ?? null}
          history={history}
          isConnected={isConnected}
          onReconnect={handleManualReconnect}
          predictions={predictions}
          forecastConfidence={forecastConfidence}
          modelActive={modelActive}
          warmingUp={warmingUp}
          anomaly={anomaly}
        />
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/40 py-6 text-center text-xs text-slate-500 mt-12">
        <p>Hardware Sentinel &copy; {new Date().getFullYear()} &mdash; Real-Time Anomaly Detection Engine v2.0</p>
      </footer>
    </div>
  );
}
export default App;
