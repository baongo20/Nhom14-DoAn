import os
import sys
import subprocess

def install_dependencies():
    print("Checking and installing backend dependencies...")
    try:
        # Get path to requirements.txt relative to run.py
        base_dir = os.path.dirname(os.path.abspath(__file__))
        req_path = os.path.join(base_dir, "requirements.txt")
        
        if os.path.exists(req_path):
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_path])
            print("Dependencies successfully verified/installed.")
        else:
            print(f"Error: Could not find requirements.txt at {req_path}")
    except Exception as e:
        print(f"Warning: Failed to auto-install dependencies. Please run 'pip install -r requirements.txt' manually. Error: {e}")

def run_server():
    print("Starting FastAPI Uvicorn Server on http://127.0.0.1:8000 ...")
    try:
        import uvicorn
        # Run server. Use app.main:app, enable hot-reload
        uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
    except ImportError:
        print("Uvicorn is not installed. Attempting installation...")
        install_dependencies()
        try:
            import uvicorn
            uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
        except Exception as e:
            print(f"Critical Error: Failed to start the server: {e}")
            sys.exit(1)

if __name__ == "__main__":
    # Ensure current working directory is backend directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Auto install on first run
    install_dependencies()
    
    # Launch uvicorn
    run_server()
