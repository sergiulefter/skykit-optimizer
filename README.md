# SkyKit Optimizer  
### 🏅 8th Place – Honorable Mention  
**HACKITALL 2025 – SAP 48H Section**

SkyKit Optimizer is a full-stack airline logistics optimization system built in 48 hours during HACKITALL 2025 (SAP track).

Our solution ranked **8th overall**, receiving an **Honorable Mention** for engineering quality, optimization strategy, and system design.

---

# ✈️ The Challenge

The SAP 48H competition simulated a real-world airline rotables logistics system.

Every hour (for 30 simulated days), the system had to:

- Decide how many kits to load per flight  
- Decide how many kits to purchase  
- Avoid capacity overflow  
- Avoid leaving passengers without kits  
- Minimize total operational cost  

Total score:

```
Transport + Processing + Purchasing + Penalties
```

Lower score = better performance.

---

# 🧠 Our Solution

SkyKit Optimizer is a **stateful, adaptive optimization engine with real-time observability**.

Instead of using fixed rules, the system:

- Calibrates itself to the dataset
- Learns from penalties during runtime
- Dynamically adjusts buffers and thresholds
- Balances overflow risk against stock starvation

---

## 🚀 Key Engineering Ideas

### Dataset-Aware Calibration
Before simulation starts, the backend analyzes:

- Network topology
- Route distances
- Demand distribution
- Capacity limits
- Penalty-to-cost ratio

From this, it computes dynamic purchasing thresholds and load factors.

---

### Adaptive Penalty Learning
During the 720-round simulation:

- Penalties are recorded in real time
- Recurring issues adjust safety buffers
- High-risk airports are detected
- Economy loading factors are tuned dynamically

The strategy evolves during execution.

---

### Capacity-Aware Purchasing
Purchasing decisions account for:

- HUB capacity constraints
- Current inventory levels
- Spoke distribution
- Forecasted demand
- Overflow probability

This reduces:

- Late-game overflow penalties
- Over-purchasing
- Capital lock-up

---

### Structured Analytics
The backend exports structured penalty diagnostics:

- Overflow grouped by airport and class
- Unfulfilled passengers grouped by flight distance
- Cost breakdown per penalty type
- Comparable scoring metric (excluding identical end-game penalties)

---

# 🏗 Architecture

## Backend (TypeScript / Node.js)

- Simulation engine
- Adaptive optimization module
- Dataset calibration system
- Penalty analytics engine
- SAP evaluation API integration
- Local API server for dashboard
- Automatic eval platform lifecycle management

---

## Frontend (React + TypeScript + Vite)

Real-time dashboard providing:

- Live total cost tracking
- Cumulative penalties
- Comparable score
- Inventory monitoring
- Flight event timeline
- Simulation controls

The frontend acts as the **control center** for the entire system.

---

# ▶️ Running the Project

You only need to start the frontend.

```bash
cd frontend
npm install
npm run dev
```

Open:

```
http://localhost:5173
```

From the dashboard:

- Click **Start Simulation**
- The frontend triggers the backend automatically
- The evaluation platform starts automatically
- The 720-round simulation runs
- Results stream live into the dashboard

No manual backend startup required.

---

# 💡 Why This Project Stands Out

This project demonstrates:

- Algorithmic optimization under constraints
- Adaptive runtime learning
- Systems-level architecture design
- Full-stack engineering
- Real-time state management
- Data-driven decision making
- Clean modular TypeScript implementation
- End-to-end automation (UI → backend → external platform)

All built within a strict 48-hour hackathon.

---

# 🏆 Result

- 🏅 8th Place Overall  
- 🎖 Honorable Mention  
- Delivered complete full-stack adaptive optimizer in 48 hours  

---

# 📜 License

Hackathon and portfolio project.  
Built for HACKITALL 2025 – SAP 48H Section.
