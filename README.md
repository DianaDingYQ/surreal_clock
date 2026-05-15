# Surreal Hands

**Surreal Hands** is an experimental interactive media piece: a *surreal time object* that appears to live inside your webcam feed—not a conventional webpage, dashboard, or HUD.

Built around **real-time camera input**, **hand / gesture tracking**, a **liquid mirrored clock**, and **delicate sonic feedback**, the experience treats time as a sculptural, deformable presence in physical space.

**Key visual (concept art):** [`docs/surreal-hands-concept.png`](docs/surreal-hands-concept.png)

---

## Core idea

You begin in front of the camera. With your **index finger**, you trace a **closed shape** in the air.

The system recognizes that contour and **materializes** it into a **Dalí-inspired, liquid-melt clock**—small, refined, and clearly *volumetric*: chrome-like rims, refractive glass, specular highlights, and a **heavily warped live reflection** of your face inside the object (funhouse-mirror / liquid-lens distortion—not a flat UI mask or a crude webcam crop).

The clock **does not settle**. It **floats** in front of you and stays **alive**: proximity, drag, pinch, and swipe continuously drive **local stretching**, **ripples**, **wobble**, and **liquid disturbance**—as if you were shaping a **soft glass / liquid metal** “creature of time.”

---

## Experience phases

### Phase 1 — Camera idle

- Live camera as the world.
- Warm light, gentle depth of field, soft lens bloom.
- Almost no interface: center stays clean, with minimal copy only, e.g. **“Draw a shape in the air.”**
- Mood: quiet, dreamlike, poetic, faintly futuristic—**not** sci-fi dashboard energy.

### Phase 2 — Drawing

- The stroke reads as **ink / glass / light-trail**: elegant, slightly buoyant.
- On **close**, a subtle glow; light **tracing** sound.
- Feels like **drawing time in air**, not like a drawing app.

### Phase 3 — Generation

- After closure, the contour **contracts**, **re-forms**, **liquefies**, and **twists**—metal and glass seeming to melt.
- Silhouette, numerals, hands, highlights, and **distorted webcam texture inside the volume** come together like **an object being born in a dream**.

### Phase 4 — Floating clock

- A **small**, **sculptural**, **asymmetric** liquid clock: elongated, slightly melted, **modern AR luxury surrealism**—not a giant blob, not a white web mask, not a clip-path demo clock widget.
- Reads as **liquid chrome sculpture** + **warped glass** + **liquid mirror** with real thickness and edge light.

### Phase 5 — Interaction

The clock remains responsive:

1. **Finger near** — edge attraction, local pull, soft-glass elasticity.  
2. **Drag** — localized elongation, liquid-metal stretch.  
3. **Pinch** — grab, compress, twist.  
4. **Swipe** — ripples, wobble, refractive shock.

---

## Sound

Designed as **fine-grained** audio—not cartoon SFX:

- tracing / glass resonance  
- liquid morph  
- dreamy metallic hum  
- ripples  
- elastic wet-glass touches  

---

## Visual language

Aim: **interactive installation** and **shareable AR-filter** polish—**cinematic**, **high-end**, **magical surreal realism**:

- surreal AR filter  
- liquid chrome  
- refractive lens  
- floating glass sculpture  
- poetic technology  

The piece should always read as: **a manipulable liquid-time object inhabiting the real camera space**—not a frontend demo with a big water-droplet mask.

---

## Tech stack (this repository)

- **React** + **Vite**  
- **MediaPipe Hands** for hand tracking  
- **Framer Motion** for motion / interaction feel  

---

## Local run

```bash
npm install
npm run dev
```

Use **Chrome** (or another browser that allows **camera + secure context**) and grant permissions when prompted.

---

## Credits

Concept, direction, and implementation: **Diana Ding** — a *vibe-coded* experimental piece exploring **gesture**, **time**, and **material illusion** in the browser.

---

## License

Private / all rights reserved unless otherwise noted by the author.
