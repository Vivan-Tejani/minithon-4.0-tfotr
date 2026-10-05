# CHOKEPOINT — Presentation & Demo Runbook (M4-08)

> **Hackathon Pitch Time:** 3 Minutes  
> **Roles:**
> - **M4 (Driver):** Controls browser tabs, navigates, triggers hop slider, applies fixes.
> - **M2 (Security Narrator):** Narrates attack graph topology, single points of failure (SPOF), and crown jewel paths.
> - **M3 (Engine Narrator):** Narrates CTP (Counterfactual Takeover Planner), Greedy CELF algorithm, and marginal gain interactions.
> - **M1 (Architect):** Introduces local-first privacy architecture, SQLite store, and offline resilience.

---

## 1. Pre-Demo Checklist (T-5 Minutes)

- [ ] **Display Setup:** Set screen resolution to **1440×900** or **1920×1080** with browser zoom at **100%**.
- [ ] **Tabs Preparation:**
  - **Tab 1:** `http://localhost:5173/` (Dashboard)
  - **Tab 2:** `http://localhost:5173/scenarios` (Scenarios)
  - **Tab 3:** `http://localhost:5173/fixes` (Fixes)
- [ ] **Telemetry Verification:** Verify navbar mode indicator reads `MODE: MOCK SIM` (or `MODE: LIVE API` if backend daemon is running).
- [ ] **Persona Preloaded:**
  - Hit **Reset** in top bar to confirm clean slate.
  - Click **Load Persona** to seed the canonical PRD §9 persona (12 accounts, score 41, baseline SIM swap vulnerable).
- [ ] **Audio/Mic Check:** M4 shares screen, team stands adjacent with designated talking points.

---

## 2. 3-Minute Demo Choreography (PRD §13 Strict Alignment)

```mermaid
timeline
    title 3-Minute Live Presentation Flow
    0:00 - 0:45 : Problem & Posture : Dashboard, score 41, SPOF SIM lock vulnerability
    0:45 - 1:30 : Attack Cascade : Scenarios tab, Hop slider 0->1->2, 9 accounts fall
    1:30 - 2:15 : Counterfactual CELF : Fixes checklist, Best-3 banner, marginal vs standalone
    2:15 - 2:45 : Remediation & Ghost : Apply fix, instant score jump to 68, ghost preview
    2:45 - 3:00 : Architecture & Close : Local-first zero telemetry, offline SQLite engine
```

### [0:00 – 0:45] Act 1: The Illusion of Security & Identity Chokepoints
- **M4 Action:** Display **Dashboard (`/`)**. Mouse hovers over the Dial Score Gauge (41 - Red Exposure).
- **M1 Speaks:**
  > *"Every individual and company uses dozens of SaaS apps and personal accounts. Traditional security checklists treat them in isolation: 'Enable 2FA here, change password there.' But attackers don't think in checklists—they think in graphs."*
- **M2 Speaks:**
  > *"Meet our user: 12 accounts, modern services. Yet their Audited Privacy Score is just **41**. Look at this headline: **'Your phone number alone can take over 9 of 12 accounts.'** Our central identity anchor—the carrier SIM—is a catastrophic Single Point of Failure."*
- **M4 Action:** Click `E_SIM` in the graph or the SPOF metric card. Hover over the 5 riskiest accounts.

---

### [0:45 – 1:30] Act 2: Adversarial Cascade Simulation (The SIM Swap)
- **M4 Action:** Switch to **Tab 2 (`/scenarios`)**. The `SIM Swap` tab is active.
- **M2 Speaks:**
  > *"Let's simulate what happens when an attacker executes a carrier SIM swap. Our engine doesn't just guess; it propagates deterministic recovery and authentication closures."*
- **M4 Action:** Click **Play** or drag the **Hop Slider** from **0 → 1 → 2**:
  - **Round 1:** `gmail`, `amazon`, `upi`, `zomato` light up red.
  - **Round 2:** `canva`, `photoedit`, `linkedin`, `netflix`, `instagram` fall via Google SSO and password reuse.
- **M2 Speaks:**
  > *"In just 2 hops, the adversary gains total compromise over 9 critical services. Financial payment vectors like UPI fall, photo storage falls, and corporate data in LinkedIn leaks. Blast radius score collapses to 5."*

---

### [1:30 – 2:15] Act 3: Counterfactual Remediation & Greedy CELF Planner
- **M4 Action:** Switch to **Tab 3 (`/fixes`)**. Hover over the glowing Best-3 Banner.
- **M3 Speaks:**
  > *"How do we fix this? Traditional scanners give you 30 alerts with no prioritization. Chokepoint uses a **Counterfactual Takeover Planner (CTP)** with **Lazy Greedy CELF** optimization."*
- **M3 Speaks:**
  > *"Notice this banner: **'Do these 3 fixes → score 41 → 68 (+27 pts)'**. Notice the marginal interaction note: Fix #1 (Carrier SIM Lock) is worth 4.1 standalone points. But once you lock the SIM, fixing Gmail recovery drops to 0.6 marginal value! Our engine mathematically eliminates redundant mitigations so you only do what matters."*

---

### [2:15 – 2:45] Act 4: Live Remediation & Ghost Previews
- **M4 Action:** Click **Preview** on *"Turn on carrier SIM lock"*.
- **M4 Speaks:**
  > *"Before changing a single credential, our Ghost Graph engine projects the counterfactual future in dashed amber. We see exactly which attack routes evaporate."*
- **M4 Action:** Click **Apply** on the top fix.
- **M4 Action:** Switch back to **Dashboard (`/`)**.
- **M2 Speaks:**
  > *"Instantly applied! Watch the dashboard: score jumps from 41 to 58, the radial gauge flips from red to amber, the graph recolours, and the trend chart logs an immutable posture snapshot."*

---

### [2:45 – 3:00] Act 5: Alerts, Architecture & Privacy Guarantee
- **M4 Action:** Click the **Bell Icon** to slide open the **Alerts Panel**.
- **M1 Speaks:**
  > *"Finally, Chokepoint monitors hygiene—flagging stale legacy forums from 2019 and password reuse groups. Most importantly: **Zero telemetry leaves this machine.** All graph traversal, Monte Carlo closures, and SQLite storage execute 100% locally. Model-based estimates, not guesses. Data stays on your device."*
- **Team Concludes:**
  > *"Chokepoint turns complex identity graphs into actionable mathematical clarity. Thank you!"*

---

## 3. Submission Screenshots Guide (5 Mandatory Frames)

| Screenshot | Target Route / State | Key Visual Elements to Include |
|---|---|---|
| `01_dashboard.png` | `http://localhost:5173/` | Score Dial (41 Red), headline diagnostic, 4 KPI cards, full layered Cytoscape topology, snapshots trend chart. |
| `02_scenario_cascade.png` | `http://localhost:5173/scenarios` | SIM Swap tab, diagnostic sentence (`9 accounts in 2 steps`), hop slider at Hop 2, glowing red node highlights on graph. |
| `03_crown_jewel_path.png` | `http://localhost:5173/` with Account Detail drawer open | UPI Account Detail drawer showing recovery routes, SMS OTP gate, blast radius impact rating (10). |
| `04_fixes_best3.png` | `http://localhost:5173/fixes` | Glowing Best-3 Header Banner (`41 → 68`), Greedy CELF badges, ranked fix cards with effort chips. |
| `05_ghost_preview.png` | `http://localhost:5173/fixes` (Preview clicked) | Live Ghost Preview card showing delta score (+17), cut paths, and dashed amber ghost nodes on the attack graph. |

---

## 4. Emergency Fallback Recording Protocol

If the live presentation projector or network hiccups:
1. **Screen Capture:** Use Windows Game Bar (`Win + Alt + R`) or OBS Studio at 1080p 60fps.
2. **Timing:** Exactly 2 minutes 50 seconds to leave 10 seconds buffer for judges.
3. **Backup File:** Export to `docs/demo_backup_recording.mp4`.
