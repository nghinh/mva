# Design System Strategy: The Executive Oracle

## 1. Overview & Creative North Star
The North Star for this design system is **"The Intelligent Monolith."** 

Unlike consumer-grade apps that rely on playful roundedness and loud colors, this system is built for the high-stakes boardroom. It is an editorial, dark-mode-first experience that feels like a bespoke luxury timepiece: precise, expensive, and authoritative. We break the "template" look by eschewing standard grids in favor of **Intentional Asymmetry**. Information flows in prioritized lanes, using deep tonal layering to create a sense of infinite digital space. This isn't just a tool; it's a quiet, powerful advisor sitting at the table.

## 2. Colors & The Tonal Philosophy
We do not use color for decoration; we use it for **semantic intelligence**. The palette is anchored in deep obsidian tones, allowing our primary "Confidence Purple" and accent "Precision Teal" to glow with purpose.

### The "No-Line" Rule
**Borders are a failure of hierarchy.** Within this system, 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined through background color shifts or subtle tonal transitions.
- Use `surface_container_low` against `surface` to define a sidebar.
- Use `surface_container_highest` to pull a primary action card forward.
- **Physicality over Geometry:** Think of the UI as stacked sheets of obsidian glass. The depth comes from the light reflecting off the "surfaces," not from drawn lines.

### Surface Hierarchy & Nesting
Depth is achieved through the material's proximity to the user:
*   **Base:** `surface` (#131318) — The desk upon which everything sits.
*   **Secondary Workspaces:** `surface_container_low` — For persistent navigation or background data.
*   **Active Focus:** `surface_container_high` — For the primary transcript or active meeting lanes.
*   **Floating Intelligence:** `surface_container_highest` — For AI suggestions and "Reply with Confidence" prompts.

### The "Glass & Gradient" Rule
To elevate the experience from "software" to "service," use Glassmorphism for floating modals.
- **Recipe:** Apply `surface_container` with 60% opacity and a `24px` backdrop blur. 
- **Signature Gradient:** For high-impact CTAs, use a linear gradient from `primary` (#C6BFFF) to `primary_container` (#6C5CE7) at a 135-degree angle. This adds "visual soul" and a metallic shimmer that feels premium.

## 3. Typography: Editorial Authority
We utilize **Inter** for its Swiss-inspired neutrality and **JetBrains Mono** for technical precision.

*   **Display & Headlines (Inter):** Use tight letter-spacing (-0.02em) for `display-lg` through `headline-sm`. This creates a dense, "newsprint" authority. 
*   **Body (Inter):** High-information density is achieved through `body-md` (0.875rem) with generous line-height (1.6) to ensure executive readability during fast-paced conversations.
*   **Technical Labels (JetBrains Mono):** All timestamps, confidence scores, and translation metadata must use `label-sm` or `label-md` in JetBrains Mono. This monospaced contrast signals to the user that they are looking at "hard data" processed by the AI.

## 4. Elevation & Depth
We move away from the traditional drop-shadows of the web's early days toward **Ambient Tonal Layering**.

*   **The Layering Principle:** Instead of a shadow, place a `surface_container_highest` element on a `surface_dim` background. The 4% difference in luminosity is enough for the executive eye to perceive depth without the "fuzziness" of a shadow.
*   **Ambient Shadows:** If a floating element (like a context menu) requires a shadow, use the `on_surface` color at 8% opacity with a `32px` blur and `12px` Y-offset. It should feel like a soft glow of light, not a dark smudge.
*   **The "Ghost Border":** For high-density data tables where separation is critical, use `outline_variant` at **15% opacity**. This provides a "suggestion" of a boundary that disappears into the background upon quick glance.

## 5. Components: Executive Primitives

### Semantic Lanes (The Core Experience)
The MVA experience is defined by three distinct vertical or horizontal lanes. These do not use borders; they use **Glow Headers**:
- **Original Lane:** Tinted with a 5% `primary_fixed` background wash.
- **Translation Lane:** Tinted with a 5% `secondary` (#44EEBA) wash.
- **AI Suggest Lane:** Utilizes a subtle `error_container` (#93000A) pulse only when a high-confidence suggestion is ready.

### Buttons & Interaction
- **Primary:** Gradient-filled (Primary to Primary Container), `xl` (1.5rem) corner radius. No border.
- **Secondary:** Ghost style. No background, `outline` at 20% opacity. 
- **AI Action Chips:** Use `secondary_container` with JetBrains Mono text. These should feel like "Tactical Buttons."

### Input Fields
- **State:** Resting inputs use `surface_container_lowest`. 
- **Focus:** Transition the background to `surface_container_high` and add a 1px "Ghost Border" of `primary` at 40% opacity. 
- **Forbid:** Do not use labels inside the box. Use `label-md` in JetBrains Mono *above* the field to maintain an architectural look.

### Cards & Lists
- **Forbid Dividers:** Do not use horizontal lines to separate meeting participants or transcript segments. 
- **The Gap Rule:** Use `16px` of vertical white space (from the Spacing Scale) combined with a 2% background shift to denote a change in speaker.

## 6. Do's and Don'ts

### Do
*   **Do** embrace negative space. Executives need "glanceable" data; overcrowding leads to fatigue.
*   **Do** use `JetBrains Mono` for all numbers. It ensures columns of figures align perfectly.
*   **Do** use the `xl` (24px) corner radius for main application containers to soften the "tech" feel.

### Don't
*   **Don't** use pure black (#000000). It kills the depth of the "Glassmorphism" effect. Use `surface_dim` (#131318).
*   **Don't** use "Pop-up" animations. Use "Slide and Fade" transitions (200ms) to mimic the movement of physical slides.
*   **Don't** use high-saturation reds for errors. Use the `error` token (#FFB4AB) which is tuned for dark-mode legibility and professional restraint.