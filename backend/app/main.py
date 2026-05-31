import asyncio
import json
import logging
import os
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .monitor import SystemMonitor
from .schemas import HardwareSnapshot, SystemInfo, InferenceData
from ai.inference import InferenceEngine

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("HardwareMonitorApp")

app = FastAPI(
    title="Windows Real-Time Hardware Monitor API",
    description="Backend API streaming Windows hardware metrics over WebSockets with AI anomaly detection"
)

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the stateful system monitor
monitor = SystemMonitor()

# Initialize the AI inference engine
inference_engine = InferenceEngine()

@app.on_event("startup")
async def startup_event():
    """Initialize the inference engine on server startup."""
    logger.info("Initializing AI inference engine...")
    # Run model loading in a thread to avoid blocking startup
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, inference_engine.initialize)
    logger.info(f"Inference engine ready. Model active: {inference_engine.model_active}")

    # ── Serve built frontend (from frontend/dist) ──────────────────────────
    # main.py is at backend/app/main.py, so go up 3 levels to reach project root
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")
    if os.path.isdir(frontend_dist):
        # Only mount if not already mounted (avoid duplicate on reload)
        already_mounted = any(
            route.path == "/" and hasattr(route, "app")
            for route in app.routes
        )
        if not already_mounted:
            from fastapi.staticfiles import StaticFiles
            app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
            logger.info(f"Serving frontend from {frontend_dist}")
    else:
        logger.warning(f"Frontend dist not found at {frontend_dist}. Run 'npm run build' in frontend/ first.")

# Trigger an initial check to populate baseline IO and processes
try:
    monitor.get_snapshot()
except Exception as e:
    logger.error(f"Error during baseline system read: {e}")


@app.get("/api/info", response_model=SystemInfo, summary="Get static system information")
def get_static_system_info():
    """
    Returns initial static system specifications (OS, Hostname, CPU Model, RAM size, Uptime).
    """
    snapshot = monitor.get_snapshot()
    return snapshot.system


@app.get("/api/snapshot", response_model=HardwareSnapshot, summary="Get a single hardware snapshot")
def get_hardware_snapshot():
    """
    Performs a one-time check of all hardware metrics and returns the snapshot.
    """
    return monitor.get_snapshot()


@app.get("/api/inference-status")
def get_inference_status():
    """Returns the current status of the AI inference engine."""
    return {
        "model_active": inference_engine.model_active,
        "model_path": inference_engine.model_loader.model_path,
        "model_available": inference_engine.model_loader.is_available,
        "buffer_fill_ratio": round(inference_engine.preprocessor.buffer.fill_ratio(), 3),
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket channel that pushes active hardware metrics (CPU, Memory, Disk, Network, Processes)
    along with AI predictions and anomaly detection results to connected clients once per second.
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected from {websocket.client.host if websocket.client else 'Unknown'}")

    try:
        # Send initial snapshot immediately
        snapshot = monitor.get_snapshot()
        inference_result = inference_engine.analyze(snapshot.model_dump())

        payload = {
            "timestamp": snapshot.timestamp,
            "snapshot": snapshot.model_dump(),
            **inference_result.to_dict(),
        }
        await websocket.send_json(payload)

        while True:
            # Wait for 0.5 seconds (high-frequency real-time update rate)
            await asyncio.sleep(0.5)

            # Fetch fresh snapshot
            snapshot = monitor.get_snapshot()

            # Run AI inference (in thread pool to avoid blocking)
            loop = asyncio.get_event_loop()
            inference_result = await loop.run_in_executor(
                None,
                inference_engine.analyze,
                snapshot.model_dump(),
            )

            # Merge snapshot + inference into single payload
            payload = {
                "timestamp": snapshot.timestamp,
                "snapshot": snapshot.model_dump(),
                **inference_result.to_dict(),
            }

            # Broadcast to user
            await websocket.send_json(payload)

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket loop: {e}")
        try:
            await websocket.close()
        except Exception:
            pass


