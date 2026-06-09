# Hardware Sentinel — Phát Hiện Bất Thường & Dự Báo Thời Gian Thực

> **Hệ thống giám sát phần cứng Windows thời gian thực với khả năng phát hiện bất thường và dự báo chuỗi thời gian sử dụng mô hình học sâu Conv1D-LSTM.**

![Tech Stack](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python-009688?style=flat-square)
![Tech Stack](https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript%20%7C%20Vite-61DAFB?style=flat-square)
![Tech Stack](https://img.shields.io/badge/AI-TensorFlow%20%7C%20Conv1D--LSTM-FF6F00?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square)

---

## 📋 Mục Lục

- [Tổng Quan](#-tổng-quan)
- [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
- [Cấu Trúc Dự Án](#-cấu-trúc-dự-án)
- [Tính Năng](#-tính-năng)
- [Yêu Cầu Hệ Thống](#-yêu-cầu-hệ-thống)
- [Cài Đặt & Chạy](#-cài-đặt--chạy)
  - [1. Cài Đặt Backend](#1-cài-đặt-backend)
  - [2. Cài Đặt Frontend](#2-cài-đặt-frontend)
  - [3. Chạy Ứng Dụng](#3-chạy-ứng-dụng)
- [Chạy Mô Phỏng](#-chạy-mô-phỏng)
- [API Endpoints](#-api-endpoints)
- [Giao Thức WebSocket](#-giao-thức-websocket)
- [Quy Trình Suy Luận AI](#-quy-trình-suy-luận-ai)
- [Chiến Lược Dự Phòng](#-chiến-lược-dự-phòng)
- [Cấu Hình](#-cấu-hình)
- [Xử Lý Sự Cố](#-xử-lý-sự-cố)

---

## 🚀 Tổng Quan

**Hardware Sentinel** là một ứng dụng full-stack có khả năng:

1. **Giám sát** các chỉ số phần cứng Windows thời gian thực (CPU, RAM, Ổ cứng, Mạng, Pin, Tiến trình) thông qua thư viện [`psutil`](backend/app/monitor.py:22)
2. **Truyền phát** dữ liệu qua WebSocket với tần suất 0.5 giây từ máy chủ [FastAPI](backend/app/main.py:17)
3. **Phát hiện bất thường** bằng mô hình Conv1D-LSTM đã huấn luyện (dựa trên sai số MSE) hoặc phương pháp thống kê z-score dự phòng
4. **Dự báo** các chỉ số phần cứng trong tương lai (tối đa 2.5 giây) với dự đoán đa bước lặp
5. **Hiển thị trực quan** trên giao diện [React](frontend/src/App.tsx:9) với biểu đồ trực tiếp, cảnh báo bất thường và lớp phủ dự đoán

Hệ thống được thiết kế dành riêng cho **Windows**, sử dụng [`pywin32`](backend/requirements.txt:5) và [`WMI`](backend/requirements.txt:6) để đọc nhiệt độ CPU, kèm theo mô hình nhiệt động lực học dự phòng khi cảm biến phần cứng không khả dụng.

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PHẦN CỨNG MÁY TÍNH                          │
│  CPU / RAM / Ổ cứng / Mạng / Pin / Tiến trình                      │
└────────────────────────┬────────────────────────────────────────────┘
                         │ psutil (mỗi 0.5s)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                                 │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐  │
│  │ SystemMonitor │───▶│ DataPreprocessor │───▶│  InferenceEngine  │  │
│  │ (monitor.py)  │    │ (preprocess.py)  │    │  (inference.py)   │  │
│  └──────────────┘    └──────────────────┘    └────────┬──────────┘  │
│                                                        │            │
│  ┌─────────────────────────────────────────────────────┘            │
│  │  WebSocket hợp nhất: { snapshot + dự đoán + bất thường }         │
│  ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  /ws  (WebSocket endpoint - truyền mỗi 0.5s)                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │ WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  App.tsx  (WebSocket client - nhận dữ liệu hợp nhất)         │   │
│  └──────────┬───────────────────────────────────────────────────┘   │
│             │                                                       │
│  ┌──────────▼──────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Dashboard.tsx      │  │  LiveChart.tsx    │  │  AnomalyAlert │  │
│  │  (hiển thị số liệu) │  │  (biểu đồ + dự   │  │  (cảnh báo)   │  │
│  │                     │  │   đoán)           │  │               │  │
│  └─────────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  AiInsights.tsx  (bảng AI tự động cập nhật)                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Luồng Dữ Liệu

1. **SystemMonitor** ([`backend/app/monitor.py`](backend/app/monitor.py:22)) thu thập chỉ số phần cứng qua `psutil` mỗi 0.5 giây
2. **DataPreprocessor** ([`backend/ai/preprocess.py`](backend/ai/preprocess.py:182)) trích xuất 6 đặc trưng, chuẩn hóa bằng `MinMaxScaler` đã huấn luyện trước, và duy trì bộ đệm cửa sổ trượt 10 bước thời gian
3. **InferenceEngine** ([`backend/ai/inference.py`](backend/ai/inference.py:154)) chạy mô hình Conv1D-LSTM (hoặc dự phòng thống kê) để:
   - Dự đoán giá trị nhiệt độ CPU tiếp theo
   - Tính điểm bất thường dựa trên MSE
   - Tạo dự báo đa bước (5 bước ≈ 2.5 giây)
4. **WebSocket endpoint** ([`backend/app/main.py:97`](backend/app/main.py:97)) hợp nhất ảnh chụp phần cứng + kết quả suy luận thành một payload JSON và đẩy đến frontend
5. **React frontend** ([`frontend/src/App.tsx`](frontend/src/App.tsx:9)) hiển thị thẻ số liệu trực tiếp, biểu đồ thời gian thực với lớp phủ dự đoán, cảnh báo bất thường và bảng thông tin AI

---

## 📁 Cấu Trúc Dự Án

```
Web/
├── README.md                          # ← Bạn đang ở đây
├── simulate_realtime.py               # Script mô phỏng ngoại tuyến
├── simulation_results.csv             # Kết quả mô phỏng đã xuất
│
├── backend/                           # Backend Python FastAPI
│   ├── requirements.txt               # Thư viện Python phụ thuộc
│   ├── run.py                         # Điểm vào (tự động cài đặt + khởi động server)
│   │
│   ├── app/                           # Ứng dụng FastAPI
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app, REST endpoints, WebSocket handler
│   │   ├── monitor.py                 # SystemMonitor — thu thập dữ liệu phần cứng qua psutil
│   │   └── schemas.py                 # Mô hình Pydantic cho tất cả cấu trúc dữ liệu
│   │
│   └── ai/                            # Pipeline suy luận AI
│       ├── __init__.py
│       ├── agent.py                   # Agent dựa trên luật cũ (không còn dùng)
│       ├── config.py                  # Hằng số cấu hình (đường dẫn, ngưỡng, đặc trưng)
│       ├── inference.py               # InferenceEngine + StatisticalFallback
│       ├── model_loader.py            # Trình tải mô hình Conv1D-LSTM .h5
│       ├── preprocess.py              # Trích xuất đặc trưng, chuẩn hóa, cửa sổ trượt
│       │
│       └── models/                    # Các tạo tác mô hình đã huấn luyện
│           ├── conv1d_lstm.h5         # Mô hình Conv1D-LSTM đã huấn luyện (tùy chọn)
│           └── scaler.gz              # MinMaxScaler đã fit trên dữ liệu huấn luyện
│
├── frontend/                          # Frontend React + TypeScript + Vite
│   ├── package.json                   # Thư viện Node.js phụ thuộc
│   ├── vite.config.ts                 # Cấu hình build Vite
│   ├── tsconfig.json                  # Cấu hình TypeScript
│   ├── tailwind.config.js             # Cấu hình Tailwind CSS
│   ├── postcss.config.js              # Cấu hình PostCSS
│   ├── index.html                     # Điểm vào HTML
│   │
│   └── src/
│       ├── main.tsx                   # Điểm vào React
│       ├── App.tsx                    # App chính — WebSocket client + quản lý state
│       ├── App.css                    # Style toàn cục
│       ├── index.css                  # Import Tailwind + style nền
│       │
│       ├── types/
│       │   └── index.ts              # Giao diện TypeScript (tương ứng backend schemas)
│       │
│       ├── components/
│       │   ├── Dashboard.tsx          # Bố cục dashboard chính
│       │   ├── MetricCard.tsx         # Thẻ hiển thị số liệu riêng lẻ
│       │   ├── LiveChart.tsx          # Biểu đồ vùng Recharts với lớp phủ dự đoán
│       │   ├── AiInsights.tsx         # Bảng thông tin AI tự động cập nhật
│       │   ├── AnomalyAlert.tsx       # Thanh cảnh báo bất thường nổi
│       │   ├── PredictionGauge.tsx    # Widget đồng hồ dự đoán thu nhỏ
│       │   └── ProcessTable.tsx       # Bảng tiến trình hàng đầu
│       │
│       └── assets/                    # Tài nguyên tĩnh (hình ảnh, icon)
│
└── plans/                             # Tài liệu kiến trúc & kế hoạch
    └── conv1d-lstm-anomaly-detection-plan.md
```

---

## ✨ Tính Năng

### Backend
- **Giám sát phần cứng thời gian thực** — Sử dụng CPU, nhiệt độ, công suất, tần số, thống kê từng lõi; RAM (ảo + swap); I/O ổ cứng; I/O mạng; trạng thái pin; 15 tiến trình hàng đầu
- **Phát hiện bất thường bằng AI** — Mô hình Conv1D-LSTM dự đoán nhiệt độ CPU; sai số MSE giữa dự đoán và giá trị thực đánh dấu bất thường
- **Dự báo thời gian đa bước** — Dự đoán chỉ số phần cứng 5 bước thời gian (≈2.5 giây) trong tương lai
- **Suy giảm linh hoạt** — Tự động chuyển sang phát hiện bất thường thống kê z-score khi không có mô hình ML
- **Tự động cài đặt thư viện** — [`run.py`](backend/run.py:5) tự động cài đặt gói Python khi khởi chạy lần đầu
- **Phục vụ frontend tĩnh** — Phục vụ ứng dụng React đã build từ thư mục `frontend/dist/`

### Frontend
- **Dashboard trực tiếp** — Thẻ số liệu thời gian thực với giá trị động
- **Biểu đồ tương tác** — Lịch sử 60 giây với lớp phủ dự đoán (đường đứt nét)
- **Cảnh báo bất thường** — Thanh thông báo nổi với mã màu mức độ (xanh → vàng → đỏ)
- **Bảng thông tin AI** — Tóm tắt dự báo tự động cập nhật, điểm tin cậy và lịch sử bất thường
- **Bảng tiến trình** — Các tiến trình tiêu tốn CPU nhiều nhất, sắp xếp theo mức sử dụng
- **Tự động kết nối lại** — WebSocket client với cơ chế back-off theo cấp số nhân
- **Thiết kế responsive** — Giao diện tối màu xây dựng với Tailwind CSS

---

## 📦 Yêu Cầu Hệ Thống

| Phần mềm | Phiên bản | Ghi chú |
|-----------|-----------|---------|
| **Python** | ≥ 3.10 | Yêu cầu cho backend |
| **Node.js** | ≥ 18 | Yêu cầu cho frontend |
| **npm** | ≥ 9 | Đi kèm với Node.js |
| **Windows** | 10 / 11 | Yêu cầu cho cảm biến nhiệt độ WMI |

> **Lưu ý:** Backend sử dụng thư viện dành riêng cho Windows (`pywin32`, `WMI`). Sẽ không chạy được trên Linux/macOS nếu không sửa đổi lớp giám sát phần cứng.

---

## 🔧 Cài Đặt & Chạy

### 1. Cài Đặt Backend

```bash
# Di chuyển đến thư mục backend
cd backend

# (Khuyến nghị) Tạo môi trường ảo
python -m venv venv
venv\Scripts\activate

# Cài đặt thư viện
pip install -r requirements.txt
```

**Các thư viện backend chính** ([`backend/requirements.txt`](backend/requirements.txt)):
| Gói | Mục đích |
|-----|----------|
| `fastapi` | Web framework cho REST + WebSocket |
| `uvicorn` | ASGI server |
| `psutil` | Giám sát phần cứng hệ thống |
| `pywin32` | Truy cập Windows API |
| `wmi` | Windows Management Instrumentation (nhiệt độ CPU) |
| `tensorflow` | Suy luận mô hình Conv1D-LSTM |
| `numpy` | Tính toán số học |
| `scikit-learn` | MinMaxScaler cho chuẩn hóa đặc trưng |
| `pandas` | Thao tác dữ liệu |

### 2. Cài Đặt Frontend

```bash
# Di chuyển đến thư mục frontend
cd frontend

# Cài đặt thư viện
npm install

# (Tùy chọn) Build cho production — cho phép backend phục vụ file tĩnh
npm run build
```

**Các thư viện frontend chính** ([`frontend/package.json`](frontend/package.json)):
| Gói | Mục đích |
|-----|----------|
| `react` + `react-dom` | UI framework |
| `recharts` | Biểu đồ tương tác |
| `lucide-react` | Thư viện icon |
| `tailwindcss` | CSS framework tiện ích |
| `vite` | Công cụ build & dev server |
| `typescript` | An toàn kiểu dữ liệu |

### 3. Chạy Ứng Dụng

#### Cách A: Chế độ Phát Triển (khuyến nghị)

Khởi động backend và frontend trong hai terminal riêng biệt:

**Terminal 1 — Backend:**
```bash
cd backend
python run.py
```
Server khởi động tại [`http://127.0.0.1:8000`](http://127.0.0.1:8000). Script [`run.py`](backend/run.py:5) sẽ:
1. Tự động cài đặt các thư viện Python còn thiếu
2. Khởi động FastAPI server với hot-reload

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Vite dev server khởi động tại [`http://localhost:5173`](http://localhost:5173) với HMR (Hot Module Replacement).

#### Cách B: Chế độ Production

```bash
# 1. Build frontend
cd frontend && npm run build

# 2. Khởi động backend (sẽ tự động phục vụ frontend đã build)
cd ../backend && python run.py
```

Sau đó mở [`http://127.0.0.1:8000`](http://127.0.0.1:8000) trên trình duyệt.

---

## 🧪 Chạy Mô Phỏng

Script mô phỏng ngoại tuyến ([`simulate_realtime.py`](simulate_realtime.py:1)) được cung cấp để kiểm tra pipeline phát hiện bất thường mà không cần phần cứng thực tế:

```bash
python simulate_realtime.py
```

Script này:
1. **Tạo** 200 bước thời gian dữ liệu tổng hợp với 6 đặc trưng (nhiệt độ CPU, sử dụng CPU, tải CPU, bộ nhớ, pin, công suất CPU)
2. **Chèn** 2 bất thường tổng hợp tại các bước 80 và 150 (tăng đột biến nhiệt độ CPU)
3. **Mô phỏng** pipeline phát hiện thời gian thực — cửa sổ trượt, chuẩn hóa, suy luận mô hình, tính MSE
4. **Xuất** bảng kết quả đã định dạng ra console
5. **Xuất** kết quả ra file [`simulation_results.csv`](simulation_results.csv) để phân tích thêm
6. **In** phân tích thống kê bao gồm thời gian suy luận, tỷ lệ phát hiện và thống kê sai số dư

**Kết quả mong đợi** (bất thường được phát hiện tại các bước 80–84 và 150–154):
```
Step | Predicted |    Actual |  Residual | Threshold |   Time(ms) | STATUS
-----|-----------|-----------|-----------|-----------|------------|----------------
  80 |    0.1234 |    0.5678 |    0.4444 |    0.0500 |    12.345 | ** ANOMALY **
 150 |    0.2345 |    0.6789 |    0.4444 |    0.0500 |    11.234 | ** ANOMALY **
```

---

## 🌐 API Endpoints

| Phương thức | Endpoint | Mô tả |
|-------------|----------|-------|
| `GET` | [`/api/info`](backend/app/main.py:69) | Thông tin hệ thống tĩnh (HĐH, hostname, CPU, RAM, uptime) |
| `GET` | [`/api/snapshot`](backend/app/main.py:78) | Ảnh chụp chỉ số phần cứng đơn lẻ |
| `GET` | [`/api/inference-status`](backend/app/main.py:86) | Trạng thái engine suy luận AI (model active, tỷ lệ đầy bộ đệm) |
| `WS` | [`/ws`](backend/app/main.py:97) | Luồng WebSocket thời gian thực (snapshot + dự đoán + bất thường mỗi 0.5s) |

---

## 🔌 Giao Thức WebSocket

Khi kết nối đến [`ws://127.0.0.1:8000/ws`](backend/app/main.py:97), server đẩy payload JSON mỗi 0.5 giây:

```json
{
  "timestamp": 1718000000.0,
  "snapshot": {
    "system": { "os_name": "Windows", "hostname": "DESKTOP-...", "cpu_model": "...", "ram_total": 17179869184, "uptime_seconds": 3600 },
    "cpu": { "overall_usage": 45.2, "temperature": 62.1, "power_draw": 35.0, "load_avg": [1.2, 1.0, 0.8], "frequency_mhz": 3200.0, "cores_usage": [...], "physical_cores": 4, "logical_cores": 8 },
    "memory": { "virtual": { "total": 17179869184, "available": 8589934592, "used": 8589934592, "percent": 50.0 }, "swap": { ... } },
    "battery": { "percent": 85.0, "power_plugged": true, "secs_left": -1 },
    "disk": { "partitions": [...], "read_speed_bps": 0, "write_speed_bps": 0 },
    "network": { "interfaces": [...], "upload_speed_bps": 0, "download_speed_bps": 0 },
    "processes": [ { "pid": 1234, "name": "chrome.exe", "cpu_percent": 12.5, "memory_percent": 8.2, ... }, ... ]
  },
  "prediction": {
    "next_steps": [
      { "cpu_temperature": 62.5, "cpu_usage": 46.0, "cpu_load": 1.2, "memory_usage": 50.2, "battery_level": 84.9, "cpu_power": 35.5 },
      ...
    ],
    "forecast_confidence": 0.88
  },
  "anomaly": {
    "is_anomaly": false,
    "anomaly_score": 0.0123,
    "anomaly_type": null,
    "details": "Hệ thống đang hoạt động trong ngưỡng bình thường."
  },
  "model_active": true,
  "warming_up": false
}
```

---

## 🧠 Quy Trình Suy Luận AI

### Kiến Trúc Mô Hình

Mô hình Conv1D-LSTM đã huấn luyện ([`backend/ai/models/conv1d_lstm.h5`](backend/ai/models/conv1d_lstm.h5)) có:

| Tầng | Kích thước | Mô tả |
|------|------------|-------|
| **Đầu vào** | `(None, 10, 6)` | 10 bước thời gian × 6 đặc trưng |
| **Đầu ra** | `(None, 1)` | Giá trị chuẩn hóa đơn lẻ (dự báo nhiệt độ CPU) |

### Các Đặc Trưng (6)

Được định nghĩa trong [`backend/ai/config.py:27`](backend/ai/config.py:27):

| # | Đặc trưng | Nguồn | Đơn vị |
|---|-----------|-------|--------|
| 0 | `cpu_temperature` | Cảm biến CPU / mô hình nhiệt động | °C |
| 1 | `cpu_usage` | `psutil.cpu_percent()` | % |
| 2 | `cpu_load` | Tải trung bình (1 phút) | — |
| 3 | `memory_usage` | Sử dụng RAM | % |
| 4 | `battery_level` | Mức pin | % |
| 5 | `cpu_power` | Công suất ước tính | W |

### Luồng Suy Luận ([`backend/ai/inference.py:246`](backend/ai/inference.py:246))

1. **Tiền xử lý** — Trích xuất 6 đặc trưng từ snapshot → chuẩn hóa qua `MinMaxScaler` → thêm vào bộ đệm cửa sổ trượt (10 bước thời gian)
2. **Kiểm tra bộ đệm** — Nếu bộ đệm chưa đầy, trả về `warming_up: true` kèm tỷ lệ phần trăm đã đầy
3. **Suy luận mô hình** — Chạy Conv1D-LSTM để dự đoán nhiệt độ CPU tiếp theo (đã chuẩn hóa)
4. **Phát hiện bất thường** — Tính MSE giữa nhiệt độ dự đoán và thực tế; đánh dấu nếu > `ANOMALY_THRESHOLD_MSE` (0.05)
5. **Dự báo đa bước** — Dự đoán lặp 5 bước thời gian tương lai bằng cách trượt cửa sổ về phía trước
6. **Trả về** — [`InferenceResult`](backend/ai/inference.py:114) với dự đoán, trạng thái bất thường và điểm tin cậy

### Cấu Hình ([`backend/ai/config.py`](backend/ai/config.py:1))

| Hằng số | Giá trị | Mô tả |
|---------|---------|-------|
| `SEQUENCE_LENGTH` | 10 | Số bước thời gian quá khứ dùng cho dự đoán (10 × 0.5s = 5s) |
| `PREDICTION_HORIZON` | 5 | Số bước thời gian tương lai để dự báo (5 × 0.5s = 2.5s) |
| `ANOMALY_THRESHOLD_MSE` | 0.05 | Ngưỡng MSE để đánh dấu bất thường |
| `ANOMALY_ZSCORE_THRESHOLD` | 3.0 | Ngưỡng Z-score cho dự phòng thống kê |
| `SAMPLE_INTERVAL` | 0.5 | Giây giữa các mẫu (khớp với vòng lặp WebSocket) |

---

## 🛡️ Chiến Lược Dự Phòng

Khi không có file mô hình `.h5` tại [`backend/ai/models/conv1d_lstm.h5`](backend/ai/models/conv1d_lstm.h5), hệ thống tự động chuyển sang **phát hiện bất thường thống kê** ([`StatisticalFallback`](backend/ai/inference.py:38)):

1. **Z-score cuộn** — Với mỗi đặc trưng, duy trì một cửa sổ cuộn các giá trị gần đây. Đánh dấu nếu giá trị hiện tại lệch > 3σ so với giá trị trung bình cuộn.
2. **Ngoại suy tuyến tính** — Dự báo dựa trên xu hướng đơn giản sử dụng độ dốc của 3 điểm dữ liệu gần nhất.
3. **Chỉ báo frontend** — Hiển thị huy hiệu "No Model" thay vì "Model Active".

Điều này đảm bảo hệ thống vẫn hoạt động đầy đủ ngay cả khi không có mô hình học sâu đã huấn luyện.

---

## ⚙️ Cấu Hình

### Cấu Hình Backend ([`backend/ai/config.py`](backend/ai/config.py))

Chỉnh sửa file này để điều chỉnh:
- Đường dẫn file mô hình và scaler
- Độ dài chuỗi và tầm nhìn dự báo
- Ngưỡng phát hiện bất thường
- Định nghĩa cột đặc trưng
- Thời gian chờ suy luận và hành vi đa luồng

### Cấu Hình Frontend

- **URL WebSocket** — Thay đổi tại [`frontend/src/App.tsx:62`](frontend/src/App.tsx:62) nếu backend chạy ở host/port khác
- **Cửa sổ lịch sử** — Điều chỉnh giới hạn 120 điểm tại [`frontend/src/App.tsx:112`](frontend/src/App.tsx:112)
- **Giao diện biểu đồ** — Sửa đổi trong [`frontend/src/components/LiveChart.tsx`](frontend/src/components/LiveChart.tsx)

---

## 🔍 Xử Lý Sự Cố

### Backend

| Vấn đề | Giải pháp |
|--------|-----------|
| `ModuleNotFoundError: No module named 'wmi'` | Cài đặt `pywin32` và `wmi`: `pip install pywin32 wmi` |
| `Could not find 'conv1d_lstm.h5'` | Hệ thống sẽ chạy ở chế độ dự phòng thống kê. Để dùng ML, đặt mô hình đã huấn luyện tại [`backend/ai/models/conv1d_lstm.h5`](backend/ai/models/conv1d_lstm.h5) |
| `Address already in use` | Cổng 8000 đã được sử dụng. Thay đổi cổng trong [`backend/run.py:25`](backend/run.py:25) |
| `WMI connection failed` | Nhiệt độ CPU sẽ sử dụng dự phòng ước tính nhiệt động. Điều này bình thường. |

### Frontend

| Vấn đề | Giải pháp |
|--------|-----------|
| `WebSocket connection failed` | Đảm bảo backend đang chạy tại `127.0.0.1:8000` |
| `Trang trắng sau khi build` | Chạy `npm run build` trong thư mục `frontend/` trước khi khởi động backend |
| `Lỗi CORS` | Backend cho phép tất cả origin trong chế độ phát triển. Nếu triển khai, hãy giới hạn [`allow_origins`](backend/app/main.py:25) |
| `Biểu đồ không cập nhật` | Kiểm tra console trình duyệt để xem lỗi WebSocket. Thử nút "Reconnect". |

### Mô Phỏng

| Vấn đề | Giải pháp |
|--------|-----------|
| `ImportError: No module named 'ai'` | Chạy script từ thư mục gốc dự án, không phải từ bên trong `backend/` |
| `Không phát hiện bất thường` | Ngưỡng ([`ANOMALY_THRESHOLD_MSE`](backend/ai/config.py:23)) có thể cần điều chỉnh. Thử giảm trong [`backend/ai/config.py`](backend/ai/config.py) |
| `Lỗi TensorFlow GPU` | Đặt `TF_CPP_MIN_LOG_LEVEL=3` (đã làm trong [`simulate_realtime.py:26`](simulate_realtime.py:26)) |

---

*Được xây dựng với FastAPI, React, TensorFlow và ❤️*
