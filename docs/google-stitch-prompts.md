# Meeting Voice Assistant — Google Stitch Prompts

> **Hướng dẫn sử dụng:** Mỗi prompt dưới đây tương ứng với 1 màn hình. Paste từng prompt vào Stitch theo thứ tự, rồi dùng tính năng "Stitch screens together" để nối flow. Sau khi generate xong tất cả, click "Play" để preview interactive prototype.
>
> **Recommended mode:** Experimental Mode (Gemini 2.5 Pro) cho chất lượng cao nhất.

---

## DESIGN.md (Paste vào Stitch trước khi bắt đầu để thiết lập design system)

```
# DESIGN.md — Meeting Voice Assistant

## Brand
- App name: Meeting Voice Assistant (MVA)
- Tagline: "Understand every voice. Reply with confidence."
- Target user: Senior executives at Vietnamese telecom corporations who attend multilingual meetings

## Design Tokens

### Colors
- Primary: #6C5CE7 (deep violet)
- Primary Light: #A29BFE
- Accent: #00D2A0 (teal green — used for "active/live" states)
- Background: #FAFAFA (light mode), #0A0A0F (dark mode)
- Surface: #FFFFFF (light), #12121A (dark)
- Text Primary: #1A1A2E (light), #E4E2EE (dark)
- Text Secondary: #6B7280 (light), #9895AD (dark)
- Lane Original: #3B82F6 (blue)
- Lane Translation: #F59E0B (amber)
- Lane AI Suggest: #EF4444 (coral/red)
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444

### Typography
- Font Family: Inter (headings + body), JetBrains Mono (timestamps, latency, technical labels)
- H1: 24px / 700
- H2: 18px / 600
- Body: 15px / 400
- Caption: 12px / 400
- Mono: 11px / 400

### Spacing
- xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px

### Corner Radius
- Small: 8px (badges, buttons)
- Medium: 12px (cards, input fields)
- Large: 16px (panels, bottom sheets)
- Full: 9999px (pills, FABs)

### Design Principles
1. Glanceable: User glances at phone during meeting — information hierarchy must be instantly clear
2. Non-distracting: Subtle animations, no attention-grabbing elements that could distract during a meeting
3. Professional: Premium feel befitting a C-suite executive tool
4. Dark mode first: Most meeting rooms are dimly lit; dark mode reduces screen glare
```

---

## Prompt 1 — Splash / Model Loading Screen

```
Design a mobile app splash screen for "Meeting Voice Assistant" — a premium real-time translation app for executives in multilingual meetings.

Screen purpose: Shown while the AI speech recognition model (~234MB) loads into memory on first launch or app start. This takes 3-8 seconds.

Layout:
- Centered app icon: a stylized microphone with sound waves morphing into text lines, in deep violet (#6C5CE7) and teal (#00D2A0)
- App name "Meeting Voice Assistant" below the icon in Inter 24px bold
- Tagline "Understand every voice" in 14px light gray
- A thin progress bar at the bottom showing model loading progress (e.g., "Loading AI model... 67%") in teal green
- Below the progress bar, small text "SenseVoice • EN / JA / KO" in monospace font

Vibe: Premium, calm, confident. Like opening a Bloomberg Terminal or a luxury banking app. Dark background (#0A0A0F). No playful elements. This is a serious business tool.

Platform: Mobile (iPhone 15 Pro size, 393x852 pts). Dark mode.
```

---

## Prompt 2 — Server Connection Screen

```
Design a mobile settings/connection screen for "Meeting Voice Assistant."

Screen purpose: First-time setup where user enters their self-hosted server URL and tests the connection before starting a meeting.

Layout from top to bottom:
- Top nav bar with back arrow and title "Server Setup"
- Section "Server Connection" with:
  - Text input field labeled "Server URL" with placeholder "wss://meeting-server.local:443/ws" — monospace font, dark input field with subtle violet border
  - "Test Connection" button (outlined, violet) — when connected, shows green checkmark with "Connected • 3ms latency" in teal text
- Section "AI Settings" with:
  - Toggle row "AI Response Suggestions" with on/off switch (teal when on)
  - Segmented control "AI Mode": Auto | Questions Only | Manual — styled as pill buttons
- Section "Translation" with:
  - Dropdown "Target Language" showing "Vietnamese 🇻🇳" selected
- Section "Speech Recognition" with:
  - Model info card showing: "SenseVoice-Small (int8)" / "234 MB" / "Languages: EN, JA, KO" / green badge "Ready"
  - Small "Manage Models" link text

Bottom: Large primary button "Save & Continue" in solid violet (#6C5CE7), full width, rounded 12px

Vibe: Clean, technical but approachable. Settings should feel like configuring a professional tool — not consumer app settings. Dark mode, surface cards (#12121A) on dark background (#0A0A0F).

Platform: Mobile (iPhone 15 Pro). Dark mode.
```

---

## Prompt 3 — Meeting Sessions List (Home Screen)

```
Design the home screen of "Meeting Voice Assistant" — a list of past and upcoming meeting sessions.

Screen purpose: Main landing screen after setup. Shows meeting history and a prominent button to start a new meeting session.

Layout:
- Top bar: App name "MVA" on the left in bold, connection status indicator dot (green = connected) on the right, and a gear icon for settings
- Large floating action button at the bottom-right corner: circular, violet (#6C5CE7), with a microphone icon, labeled "New Meeting" — this is the primary CTA
- Main content area: vertical list of past meeting sessions, each as a card with:
  - Date and time (e.g., "Apr 11, 2026 • 14:30–15:45")
  - Duration badge (e.g., "1h 15m")
  - Language badges: small colored pills showing which languages were detected (EN = blue, JA = red, KO = green)
  - Number of utterances (e.g., "47 utterances")
  - Preview of last translated text in gray, truncated to 1 line
- If no sessions yet, show an empty state: illustration of a meeting room with speech bubbles containing different language flags, and text "Start your first meeting" with an arrow pointing to the FAB

Vibe: Clean, organized, like a premium productivity app (similar to Notion or Linear). Cards have subtle borders, generous whitespace. Dark mode.

Platform: Mobile (iPhone 15 Pro). Dark mode.
```

---

## Prompt 4 — Main Meeting Screen (Core Screen — Most Important)

```
Design the core meeting screen of "Meeting Voice Assistant" — this is the screen the user sees during an active meeting. It must be glanceable and non-distracting.

Screen purpose: Real-time display of speech transcription, Vietnamese translation, and AI response suggestions in three parallel lanes while a meeting is happening. The user's phone sits on the meeting table; they glance at it periodically.

Layout — three-lane vertical stack, each lane independently scrollable:

TOP BAR (fixed, minimal):
- Left: red recording dot pulsing animation + "Recording" text + elapsed time "00:12:34"
- Center: detected language badge that updates live (shows "EN" in blue pill, or "JA" in red pill, or "KO" in green pill)
- Right: connection status dot (green) + "•" + AI suggest status icon (brain icon, teal when active, gray when off)

LANE 1 — Original Transcript (top section, ~30% of screen height):
- Header: small label "ORIGINAL" in blue (#3B82F6) with left-colored border accent
- Content: scrollable list of transcribed utterances. Each entry shows:
  - Language badge (EN/JA/KO) as small pill on the left
  - Transcribed text in white, 15px
  - Timestamp in monospace gray "14:32:07"
  - The LATEST entry has a subtle typing/streaming animation (cursor blink) showing text appearing word by word
- The lane has a thin blue left border (#3B82F6, 2px) to visually distinguish it

LANE 2 — Vietnamese Translation (middle section, ~30% of screen height):
- Header: small label "BẢN DỊCH" in amber (#F59E0B) with left-colored border accent
- Content: corresponding Vietnamese translations. Each entry shows:
  - Vietnamese text in 15px white
  - If it's a speculative (partial) translation, the text has slightly lower opacity (70%) with a small "..." indicator
  - Timestamp matching the original utterance
- Thin amber left border (#F59E0B, 2px)

LANE 3 — AI Suggestions (bottom section, ~25% of screen height):
- Header: small label "GỢI Ý TRẢ LỜI" in coral (#EF4444) with left-colored border accent + toggle switch to turn AI on/off
- Content: AI-generated response suggestions. Each entry shows:
  - Vietnamese suggestion text in 15px
  - If currently streaming, text appears with a typing cursor animation
  - A "Copy" icon button on the right side of each suggestion (clipboard icon)
  - Small label showing which utterance triggered this suggestion
- Thin coral left border (#EF4444, 2px)

BOTTOM BAR (fixed):
- Large "Stop Meeting" button (outlined red, full width) with square stop icon
- Above it, a mini status bar showing: "Translation: 45ms • AI: 1.2s" in tiny monospace gray text

IMPORTANT DETAILS:
- Each lane can scroll independently — when the user scrolls up in one lane to review history, the others continue auto-scrolling
- The lanes are separated by thin horizontal dividers (1px, 10% opacity)
- Content is left-aligned, text-heavy, no unnecessary decorations
- The screen should feel like a Bloomberg Terminal or trading app — dense but organized information
- When a new entry appears in any lane, it should feel like it naturally flows in, no jarring animations

Vibe: Professional command center. Dense information, impeccably organized. Dark mode is essential — the phone sits on a meeting table in a dimly-lit conference room, and the screen should not draw attention from other meeting participants. Minimal chrome, maximum content.

Platform: Mobile (iPhone 15 Pro). Dark mode only.
```

---

## Prompt 5 — Meeting Screen: Empty / Waiting State

```
Design the waiting state of the meeting screen for "Meeting Voice Assistant" — shown right after the user taps "New Meeting" but before anyone starts speaking.

Layout:
- Same top bar as the active meeting screen (recording dot + timer at 00:00:00 + connection status)
- Center of screen: large, subtle sound wave animation (very low-key, just gentle lines pulsing) in violet at 30% opacity
- Text below the animation: "Listening..." in 18px light gray
- Below that: "Speak in English, Japanese, or Korean" in 14px dimmer gray
- Three small language icons in a row: 🇬🇧 EN • 🇯🇵 JA • 🇰🇷 KO
- The three lanes (Original, Translation, AI Suggest) are visible but empty, with their colored left borders and headers, showing the structure that will fill with content
- Bottom bar with "Stop Meeting" button (same as active screen)

Vibe: Calm, anticipatory. Like a recording studio that's ready but waiting. Dark mode.

Platform: Mobile (iPhone 15 Pro). Dark mode.
```

---

## Prompt 6 — Meeting Screen: Offline / Degraded State

```
Design the degraded state of the meeting screen for "Meeting Voice Assistant" — shown when the server connection is lost during an active meeting.

Layout:
- Same three-lane layout as the active meeting screen
- Top bar: connection status dot is now YELLOW with "Offline" text. Recording timer continues.
- LANE 1 (Original): continues to show transcribed text normally (STT works on-device without server)
- LANE 2 (Translation): shows a subtle yellow banner at the top: "⚠ Server offline — translation paused" and existing translations remain visible but no new ones appear
- LANE 3 (AI Suggest): shows a subtle yellow banner: "⚠ AI suggestions unavailable" — the toggle is grayed out
- Bottom: same "Stop Meeting" button, plus a small "Reconnecting..." text with a spinning indicator

Vibe: The app is resilient, not broken. Core functionality (transcription) still works. The degradation is communicated clearly but calmly. Dark mode.

Platform: Mobile (iPhone 15 Pro). Dark mode.
```

---

## Prompt 7 — Meeting Review / History Detail Screen

```
Design a meeting review screen for "Meeting Voice Assistant" — shown when the user taps on a past meeting session from the home screen.

Screen purpose: Review the full transcript with translations and AI suggestions from a completed meeting.

Layout:
- Top bar: back arrow + meeting title "Meeting Apr 11, 2026" + share/export icon
- Summary card at top:
  - Duration: "1h 15m"
  - Languages detected: EN (34 utterances), JA (12 utterances), KO (1 utterance)
  - Total utterances: 47
  - AI suggestions generated: 8
- Below the summary, a unified timeline view:
  - Each entry is a card containing:
    - Timestamp (monospace, left-aligned)
    - Language badge (EN/JA/KO pill)
    - Original text in white
    - Vietnamese translation in amber text below
    - If an AI suggestion was generated for this utterance, it appears in a subtle coral-tinted card below the translation with a "Copy" button
  - Entries are in chronological order, vertically scrollable
- Bottom: "Export Transcript" button (outlined, full width)

Vibe: Clean reading experience, like reviewing meeting minutes. Comfortable for long scrolling. Dark mode.

Platform: Mobile (iPhone 15 Pro). Dark mode.
```

---

## Prompt 8 — Model Download Screen

```
Design a model download/management screen for "Meeting Voice Assistant."

Screen purpose: Shown on first launch or when managing downloaded AI models.

Layout:
- Top bar: "AI Models" title
- Model card for "SenseVoice-Small":
  - Model name and version
  - Size: "234 MB"
  - Supported languages: EN, JA, KO, ZH with flag icons
  - Status: either "Download" button (blue, outlined) or progress bar during download, or green "Ready" badge with "Delete" option
  - Performance info: "Real-time factor: 0.05 on iPhone 15 Pro"
- Optional second model card for "Whisper-Small" (grayed out, labeled "Coming Soon")
- Storage info at bottom: "Models: 234 MB / 512 MB available"

Vibe: Technical but clean. Like an app store for AI models. Dark mode.

Platform: Mobile (iPhone 15 Pro). Dark mode.
```

---

## Screen Flow (sau khi generate xong tất cả screens, dùng tính năng Stitch để nối)

```
Flow 1: First Launch
  Splash (Prompt 1) → Model Download (Prompt 8) → Server Setup (Prompt 2) → Home (Prompt 3)

Flow 2: Start Meeting
  Home (Prompt 3) → [tap FAB] → Meeting Waiting (Prompt 5) → [speech detected] → Meeting Active (Prompt 4) → [tap Stop] → Home (Prompt 3)

Flow 3: Review Past Meeting
  Home (Prompt 3) → [tap session card] → Meeting Review (Prompt 7) → [tap back] → Home (Prompt 3)

Flow 4: Server Disconnects Mid-Meeting
  Meeting Active (Prompt 4) → [connection lost] → Meeting Offline (Prompt 6) → [reconnected] → Meeting Active (Prompt 4)
```

---

## Follow-up Refinement Prompts (dùng sau khi generate xong để tinh chỉnh)

```
Refinement 1: "Make the three lanes in the meeting screen more visually distinct. Increase the left border width to 3px and add a very subtle background tint to each lane — blue at 3% opacity for Original, amber at 3% for Translation, coral at 3% for AI Suggest."

Refinement 2: "The meeting screen feels too sparse. Add sample realistic content: an English sentence 'We need to finalize the Q3 partnership agreement with Softbank by next Friday', its Vietnamese translation 'Chúng ta cần hoàn tất thỏa thuận đối tác Q3 với Softbank trước thứ Sáu tuần sau', and an AI suggestion 'Tôi đồng ý. Tôi sẽ yêu cầu phòng pháp chế gửi bản dự thảo cuối cùng vào thứ Tư.'"

Refinement 3: "Add a floating 'Jump to latest' pill button that appears when the user scrolls up in any lane. The pill should be positioned at the bottom of the scrolled lane, semi-transparent violet background, with a down arrow and text 'Latest'."

Refinement 4: "Show me this entire app in light mode as well. Keep the same layout but invert to light backgrounds with the same accent colors."
```
