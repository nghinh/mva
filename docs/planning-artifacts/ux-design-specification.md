# UX Design Specification — Meeting Voice Assistant

**Author:** nghinh  
**Date:** 2026-04-13  
**Version:** 3.0 (Offline-Only)  
**Status:** Approved

---

## 1. Design Strategy

### 1.1 Product Context

- **Type:** Single-purpose utility — real-time meeting transcription + translation
- **Users:** Senior executives (40-55), moderate tech literacy, time-constrained
- **Context:** Phone on meeting table in dimly-lit conference room, glanced at periodically
- **Interaction model:** Passive consumption (read-only during meeting), active review (post-meeting)

### 1.2 Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Glanceable** | User glances 2-3 seconds at a time — text hierarchy must be instantly clear |
| **Non-distracting** | No attention-grabbing animations, sounds, or bright elements during meetings |
| **Dark mode first** | Conference rooms are dim; reduce screen glare on the meeting table |
| **One-hand ready** | Start/stop meeting with single tap; no complex gestures needed |
| **Offline-confident** | Never show "connecting" or "loading" states that imply network dependency |

### 1.3 Information Architecture

```
App
├── Home (Session List)
│   ├── Start New Meeting → Meeting Screen
│   ├── Past Session → Review Screen
│   └── Settings → Settings Screen
├── Meeting Screen (2-lane live view)
│   ├── Transcript Lane (EN/JA/KO)
│   └── Translation Lane (VI)
├── Review Screen (post-meeting)
│   └── Unified timeline with transcript + translation
├── Settings Screen
│   ├── Model Management
│   ├── Target Language
│   └── About / Storage
└── First Launch
    ├── Model Download
    └── Permission Request (microphone)
```

---

## 2. Design System

### 2.1 Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--bg-primary` | #FAFAFA | #0A0A0F | App background |
| `--bg-surface` | #FFFFFF | #12121A | Cards, panels |
| `--bg-elevated` | #F5F5F5 | #1A1A26 | Section headers |
| `--text-primary` | #1A1A2E | #E4E2EE | Body text, transcriptions |
| `--text-secondary` | #6B7280 | #9895AD | Timestamps, labels |
| `--text-tertiary` | #9CA3AF | #6B6880 | Hints, placeholders |
| `--accent-primary` | #6C5CE7 | #A29BFE | Primary actions, brand |
| `--accent-transcript` | #3B82F6 | #60A5FA | Transcript lane accent |
| `--accent-translation` | #F59E0B | #FBBF24 | Translation lane accent |
| `--accent-success` | #10B981 | #34D399 | Model ready, recording active |
| `--accent-warning` | #F59E0B | #FBBF24 | Draft indicator |
| `--accent-danger` | #EF4444 | #F87171 | Stop button, errors |
| `--border` | rgba(0,0,0,0.08) | rgba(255,255,255,0.08) | Dividers |

### 2.2 Typography

| Style | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| H1 | Inter | 24px | 700 | Screen titles (Home, Settings) |
| H2 | Inter | 18px | 600 | Section headers |
| Body | Inter | 15px | 400 | Transcript + translation text |
| Caption | Inter | 12px | 400 | Timestamps, metadata |
| Badge | Inter | 11px | 600 | Language badges (EN/JA/KO) |
| Mono | JetBrains Mono | 11px | 400 | Dev mode metrics, model sizes |

### 2.3 Spacing & Radius

| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 16px |
| `--radius-full` | 9999px |

---

## 3. Screen Specifications

### 3.1 First Launch — Model Download

**Purpose:** Download STT + Translation models on first run.

```
┌─────────────────────────────┐
│                             │
│      [App Icon - MVA]       │
│                             │
│    Meeting Voice Assistant  │
│   "Understand every voice"  │
│                             │
│  ┌───────────────────────┐  │
│  │ ◉ SenseVoice (STT)   │  │
│  │   234 MB  [████░] 67% │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ NLLB (Translation)  │  │
│  │   800 MB  [waiting]   │  │
│  └───────────────────────┘  │
│                             │
│  Total: 1.0 GB             │
│  WiFi recommended           │
│                             │
└─────────────────────────────┘
```

- Sequential download: STT first, then Translation
- Progress bar per model with percentage
- After both complete → request microphone permission → navigate to Home
- Error state: retry button per model, resume-from-offset

### 3.2 Home Screen — Session List

**Purpose:** Landing screen showing past sessions + prominent "Start Meeting" button.

```
┌─────────────────────────────┐
│  MVA                    ⚙️  │ ← App name + settings icon
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ Apr 12 • 14:30-15:45  │  │
│  │ 1h 15m  EN JA  47 utt │  │  ← Session card
│  │ "Báo cáo quý cho th..." │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Apr 11 • 09:00-10:20  │  │
│  │ 1h 20m  EN KO  52 utt │  │
│  │ "Chúng ta cần hoàn..." │  │
│  └───────────────────────┘  │
│                             │
│                 ┌─────────┐ │
│                 │  🎙 New │ │ ← FAB (violet, bottom-right)
│                 │ Meeting │ │
│                 └─────────┘ │
└─────────────────────────────┘
```

- Session cards: date, duration, language badges (colored pills), utterance count, last translation preview
- Empty state: illustration + "Start your first meeting" with arrow to FAB
- Swipe-to-delete on session cards
- FAB: circular violet button with microphone icon

### 3.3 Meeting Screen — Live 2-Lane View (Core Screen)

**Purpose:** Real-time display during active meeting. User glances at phone on table.

```
┌─────────────────────────────┐
│ ● Recording  00:12:34   JA  │ ← Top bar: red dot + timer + detected lang
├─────────────────────────────┤
│▎ ORIGINAL                   │ ← Blue left border (2px)
│▎                            │
│▎ JA  四半期の報告書は15%の    │
│▎     成長を示しています       │
│▎                   14:32:07 │
│▎                            │
│▎ EN  We should focus on the │ ← Previous utterance
│▎     Southeast Asian market │
│▎                   14:31:42 │
├─────────────────────────────┤ ← Thin divider (1px, 10% opacity)
│▎ BẢN DỊCH                  │ ← Amber left border (2px)
│▎                            │
│▎ Báo cáo quý cho thấy tăng │
│▎ trưởng 15%          draft  │ ← Draft indicator (amber, small)
│▎                   14:32:07 │
│▎                            │
│▎ Chúng ta nên tập trung vào │
│▎ thị trường Đông Nam Á      │
│▎                   14:31:42 │
│                             │
├─────────────────────────────┤
│  [ ■  Stop Meeting ]        │ ← Full-width outlined red button
│  STT: 180ms  Trans: 920ms  │ ← Dev mode only (tiny monospace)
└─────────────────────────────┘
```

**Critical UX details:**

- **Two lanes split ~50/50 vertically**, each independently scrollable
- **Left color border:** blue (2px) for Transcript, amber (2px) for Translation — instant visual distinction when glancing
- **Language badge:** small colored pill (EN=blue, JA=red, KO=green) at start of each transcript entry
- **Timestamps:** monospace, right-aligned, secondary color
- **Draft indicator:** when partial/speculative translation is shown, display small amber "draft" label. When final translation replaces it, label disappears smoothly (opacity transition 200ms)
- **Auto-scroll:** both lanes scroll to latest. If user manually scrolls up, a floating "↓ Latest" pill appears at bottom of that lane
- **Streaming text:** latest transcript entry appears word-by-word (cursor blink animation at end)
- **Recording indicator:** red dot with subtle pulse animation (0.5s cycle, opacity 0.6-1.0)
- **No distracting elements:** no floating buttons, no toasts, no modals during active meeting

### 3.4 Meeting Screen — Waiting State

**Purpose:** After "Start Meeting" tapped, before any speech detected.

```
┌─────────────────────────────┐
│ ● Recording  00:00:00       │
├─────────────────────────────┤
│                             │
│                             │
│       ~ ~ ~ ~ ~ ~          │ ← Subtle sound wave lines (violet, 30% opacity)
│                             │
│       Listening...          │
│                             │
│   Speak in EN, JA, or KO   │
│                             │
│▎ ORIGINAL                   │ ← Empty lane headers visible
│▎ (waiting for speech...)    │
├─────────────────────────────┤
│▎ BẢN DỊCH                  │
│▎ (waiting for speech...)    │
├─────────────────────────────┤
│  [ ■  Stop Meeting ]        │
└─────────────────────────────┘
```

### 3.5 Review Screen — Post-Meeting

**Purpose:** Scroll through completed meeting transcript with translations.

```
┌─────────────────────────────┐
│  ←  Meeting Apr 12     📤  │ ← Back + export button
├─────────────────────────────┤
│  Duration: 1h 15m           │
│  Languages: EN (34) JA (12) │ ← Summary card
│  Utterances: 47             │
├─────────────────────────────┤
│                             │
│  14:30:05                   │
│  EN  Good morning everyone  │
│  ➜ Chào buổi sáng mọi người│ ← Amber text for translation
│                             │
│  14:30:18                   │
│  JA  今日は第3四半期の...     │
│  ➜ Hôm nay chúng ta thảo...│
│                             │
│  ... (scrollable) ...       │
│                             │
├─────────────────────────────┤
│  [ Export Transcript ]      │ ← Outlined button, full-width
└─────────────────────────────┘
```

- Unified chronological timeline (not split lanes)
- Each entry: timestamp → language badge + original → "➜" + Vietnamese translation
- Export generates `.txt` file and opens system share sheet

### 3.6 Settings Screen

```
┌─────────────────────────────┐
│  ←  Settings                │
├─────────────────────────────┤
│                             │
│  AI Models                  │
│  ┌───────────────────────┐  │
│  │ SenseVoice (STT)      │  │
│  │ 234 MB • ✅ Ready      │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ NLLB-600M (Translate) │  │
│  │ 800 MB • ✅ Ready      │  │
│  └───────────────────────┘  │
│                             │
│  Translation                │
│  Target Language    [VI 🇻🇳]│
│                             │
│  Storage                    │
│  Models: 1.0 GB             │
│  Sessions: 12 MB            │
│  [Delete All Sessions]      │
│                             │
│  Developer Mode     [○    ] │
│                             │
│  About                      │
│  Version 1.0 • 100% Offline │
│                             │
└─────────────────────────────┘
```

---

## 4. Interaction Patterns

### 4.1 Meeting Lifecycle

```
Home → [Tap FAB "New Meeting"]
  → Permission check (mic)
  → Meeting Screen (waiting state)
  → [Speech detected] → live transcription + translation
  → [Tap "Stop Meeting"]
  → Session saved to SQLite
  → Navigate back to Home (new session at top of list)
```

### 4.2 Draft → Final Transition

When partial STT triggers an on-device translation:
1. Translation text appears at **0.75 opacity** with amber "draft" label
2. When final STT result is processed and final translation arrives:
   - Old text fades out (opacity 0.75 → 0, 150ms)
   - New text fades in (opacity 0 → 1.0, 150ms)
   - "draft" label disappears
3. If final translation is identical to draft → simply remove "draft" label (no text change)

### 4.3 Scroll Behavior

- Auto-scroll is ON by default in both lanes
- When user touches and drags UP in either lane → auto-scroll pauses for THAT lane only
- A floating pill "↓ Latest" appears at the bottom of the paused lane
- Tapping the pill → smooth scroll to bottom + re-enable auto-scroll
- New entries continue arriving in both lanes regardless of scroll state

### 4.4 Error States

| State | UI Treatment |
|-------|-------------|
| Model not downloaded | Full-screen download UI (blocks meeting start) |
| Mic permission denied | Alert explaining why mic is needed + "Open Settings" button |
| Translation model fails to load | Banner: "Translation unavailable — transcription still active" |
| Device too hot (thermal throttle) | Subtle warning: "Device warm — performance may be reduced" |
| Storage full | Alert when session can't be saved |

---

## 5. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Text size | Respect system Dynamic Type / font scale settings |
| Contrast | All text meets WCAG AA (4.5:1 ratio) in both light/dark mode |
| Screen reader | All interactive elements have accessibility labels |
| Reduce motion | Honor `prefers-reduced-motion` — disable pulse animation, use instant transitions |
| Color independence | Lane distinction via left border position + header label (not color alone) |

---

## 6. Responsive Considerations

| Device | Adaptation |
|--------|-----------|
| Small phone (iPhone SE) | Lanes split 45/55 (less space for translation). Reduce font to 14px. |
| Standard phone (iPhone 15) | Default 50/50 split. 15px font. |
| Large phone (iPhone 15 Pro Max) | 50/50 split. Consider showing 3 lines per entry instead of 2. |
| Tablet (iPad) | Side-by-side lanes (horizontal split) instead of vertical. |
