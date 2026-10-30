# Relic Reborn

**Relic Reborn** is an interactive digital archaeology exhibition and AI-to-3D restoration studio built with **Next.js, TypeScript, Tailwind CSS, Three.js (`@react-three/fiber` & `@react-three/drei`), OpenAI / Google Gemini, and the Tripo AI OpenAPI v3**.

Visitors can immediately explore **five pre-generated historical artifact reconstructions** sourced from **The Metropolitan Museum of Art Open Access Collection (CC0 1.0)**—complete with interactive 360° PBR 3D models, draggable before-and-after split comparisons, and scholarly conservation dossiers—or upload a photograph of their own damaged artifact using session-scoped API keys.

---

## Featured Open-Access Museum Artifacts (CC0 1.0)

1. **Exhibit I — Fragments of a Terracotta Black-Figure Amphora (Boxer Panel)**
   - **Culture & Date:** Ancient Greek, Attic, ca. 550–525 BCE
   - **Collection:** The Metropolitan Museum of Art, Accession No. `57.12.9a–d` ([Object 254947](https://www.metmuseum.org/art/collection/search/254947))
2. **Exhibit II — Marble Statue of Eirene (Personification of Peace)**
   - **Culture & Date:** Roman Imperial, ca. 14–68 CE (copy of ca. 375–360 BCE Greek bronze original by Kephisodotos the Elder)
   - **Collection:** The Metropolitan Museum of Art, Accession No. `06.311` ([Object 247173](https://www.metmuseum.org/art/collection/search/247173))
3. **Exhibit III — Fragment of a Queen's Face**
   - **Culture & Date:** Ancient Egyptian, New Kingdom, Amarna Period, Dynasty 18, ca. 1353–1336 BCE (Yellow Jasper)
   - **Collection:** The Metropolitan Museum of Art, Accession No. `26.7.1396` ([Object 544514](https://www.metmuseum.org/art/collection/search/544514))
4. **Exhibit IV — Bull's Head from a Monumental Column Capital (Persepolis Bull)**
   - **Culture & Date:** Ancient Persian, Achaemenid Empire (Istakhr near Persepolis), ca. 5th century BCE
   - **Collection:** The Metropolitan Museum of Art, Accession No. `47.100.83` ([Object 324025](https://www.metmuseum.org/art/collection/search/324025))
5. **Exhibit V — Greenstone Ceremonial Funerary Mask**
   - **Culture & Date:** Classic Teotihuacan, Central Mexico, ca. 250–650 CE (Chlorite schist)
   - **Collection:** The Metropolitan Museum of Art, Accession No. `1979.206.527` ([Object 312736](https://www.metmuseum.org/art/collection/search/312736))

---

## Architecture & Security

- **`src/components/viewer/`** — Three.js + React Three Fiber museum stage with `RoomEnvironment` PBR lighting, sculpted limestone/emerald plinth, contact shadows, camera angle presets (`Front`, `Right`, `Back`, `Left`), and a two-pass WebGL scissor before-and-after comparison curtain alongside authentic 2D photographic reference overlays.
- **`src/lib/security/session-credentials.ts`** — Ephemeral AES-256-GCM encrypted in-memory session store bound to an `HttpOnly`, `SameSite=Strict` session cookie. User API keys are never persisted to browser storage, URLs, logs, or frontend bundles, and AI provider credentials are strictly isolated from Tripo 3D credentials.
- **`src/lib/ai/`** — Multimodal vision fracture analysis (`Step 1`), live Open-Access Museum parallel lookup + scholarly conservation synthesis (`Step 2`), and multi-hypothesis restored image generation (`Step 3`) supporting both **OpenAI** (`GPT-4o` + `gpt-image-1.5`) and **Google Gemini** (`Gemini 2.5 Flash` + `Gemini Image Generation`).
- **`src/lib/tripo/client.ts`** — Latest **Tripo OpenAPI v3** (`https://openapi.tripo3d.ai/v3`) integration supporting `/v3/account/balance`, `/v3/files`, `/v3/generation/image-to-multiview`, `/v3/generation/image-to-model`, `/v3/generation/multiview-to-model`, `/v3/tasks/{taskId}`, and local `.glb` persistence before presigned CDN links expire.

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to explore the five pre-generated museum reconstructions immediately, or click **Upload Your Artifact** → **API Settings** to enter session-scoped credentials for custom restorations.
