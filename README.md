# Kitchen.batching.dashboard
#  BatchOptima KDS — Capacity-Constrained Kitchen Batching Engine
### *Submission for Speedcode 2026 @ Nitte Meenakshi Institute of Technology (NMIT), Bengaluru*

---

##  Executive Summary & Problem Solved
In hyper-growth food delivery markets like Bengaluru, the traditional **"First-Come, First-Dispatched"** single-order delivery model leads to immense kitchen station bottlenecks, delivery bag thermal overloading, and excessive rider congestion across city arterial roads.

**BatchOptima KDS** is a dual-constrained online kitchen batching and dispatch dashboard that solves this optimization challenge by combining:
1. **Temporal Clustering:** Rolling **5-Minute Accumulation Windows** grouped by Bengaluru geographical delivery zones (`BLR-NORTH`, `BLR-CENTRAL`, `BLR-TECH`, `BLR-SOUTH`, `BLR-WEST`).
2. **Strict Capacity Constraint & Auto-Splitting:** A strict maximum limit of **5 items per batch** (and/or physical weight ceiling). When an incoming order causes a zone batch to exceed 5 items, the algorithm automatically partitions the items into secondary sibling batches (`Batch #101-A` [5/5 FULL] and `Batch #101-B` [Overflow]) for the same zone within the same active time window.
3. **End-to-End Kitchen Display System (KDS):** Multi-stage real-time pipeline (Accumulating ➔ Cooking/Prep Stations ➔ Packaging & QC ➔ Dispatched).
4. **Live Radar & Sustainability Analytics:** Interactive Bengaluru zone map and mathematical bin-packing ROI metrics (42% fewer rider dispatches, reduced carbon footprint, 0% capacity violations).

---

## ss Quick Start (Instant Run)

You can run this project in **3 convenient ways** with zero complex setup:

### Method 1: Direct Double-Click (Zero Setup / Offline Ready)
- Simply double-click **`index.html`** to open the dashboard directly in Google Chrome, Safari, Edge, or Firefox.

### Method 2: Python One-Liner
```bash
python3 server.py