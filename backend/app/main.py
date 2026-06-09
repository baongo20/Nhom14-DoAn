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

# ── Helper to mount frontend static files ─────────────────────────────
def _mount_frontend():
    """Mount the built frontend dist directory at the root path."""
    # main.py is at backend/app/main.py, so go up 3 levels to reach project root
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")
    if os.path.isdir(frontend_dist):
        # Check if already mounted (avoid duplicate on reload)
        already_mounted = any(
            route.path == "/" and hasattr(route, "app")
            for route in app.routes
        )
        if not already_mounted:
            app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
            logger.info(f"Serving frontend from {frontend_dist}")
    else:
        logger.warning(f"Frontend dist not found at {frontend_dist}. Run 'npm run build' in frontend/ first.")


@app.on_event("startup")
async def startup_event():
    """Mount frontend immediately, then load AI model in background."""
    # 1. Mount frontend static files FIRST — so the server responds right away
    _mount_frontend()

    # 2. Start model loading in background (does not block the event loop)
    logger.info("Starting background AI inference engine initialization...")

    async def _load_model_background():
        """Load the TF model in a thread executor so it doesn't block startup."""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, inference_engine.initialize)
            logger.info(f"Inference engine ready. Model active: {inference_engine.model_active}")
        except Exception as e:
            logger.error(f"Background model loading failed: {e}")

    asyncio.create_task(_load_model_background())

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


