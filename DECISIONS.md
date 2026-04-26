# Architectural Decisions - NevUp Track 3

This document outlines the key technical and design choices made during the development of the System of Engagement for NevUp Hackathon 2026.

## 1. Framework: Next.js 15 with App Router
We selected Next.js for its built-in optimizations (font loading, image optimization) and its robust routing system. The App Router allows for a clean separation between "Post-Session Debrief" and the "Behavioral Dashboard," while maintaining shared layouts and state.

## 2. Data Strategy: Hybrid Mocking (SEED Mode)
While the specification requires consuming the Prism Mock API, we implemented a **SEED mode** that reads directly from `nevup_seed_dataset.json`. 
- **Rationale:** Mock servers often return generic/random examples. By building a local seed parser, we ensure the dashboard displays the full 388-trade history across all 10 traders, providing a much richer "data storytelling" experience for reviewers.

## 3. Visualization: Custom SVG Heatmap
Instead of using off-the-shelf libraries like `react-calendar-heatmap`, we built a custom SVG-based heatmap from scratch.
- **Rationale:** Off-the-shelf libraries are often difficult to style and lack the specific interaction requirements (mobile responsive, custom tooltips, precise click-to-navigate). Our custom SVG implementation allows for sub-pixel precision and high-performance rendering of the 90-day window.

## 4. State Management: Zustand + React Query
- **React Query:** Used for all server-state (fetching profiles, metrics, and sessions). It provides automatic loading/error states and caching.
- **Zustand:** Used for client-side state in the multi-step debrief flow. It is lightweight and prevents prop-drilling across the 5 steps.

## 5. Aesthetics: Neo-Cyberpunk Glassmorphism
The UI utilizes a dark, high-contrast palette with translucent surfaces (`glass-card`).
- **Rationale:** Day traders often work in low-light environments and prefer high-contrast "neon" signals. The use of `#FF0000` for losses and `#4ade80` for wins provides instant cognitive feedback.

## 6. Real-Time Experience: Simulated SSE
The coaching panel implements a robust SSE (Server-Sent Events) handler.
- **Rationale:** To ensure the app remains functional in environments without a live backend, we added a simulation layer that mimics token-by-token AI responses. This demonstrates the UI's ability to handle streaming data and reconnection logic (exponential backoff).
