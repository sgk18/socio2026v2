# SOCIO — Font Reference for Claude Design

Give this file to Claude when asking for any UI/design work on the SOCIO application.

---

## Primary Font — DM Sans (Global)

**Used everywhere across the entire app.**

| Property | Value |
|----------|-------|
| Family | DM Sans |
| Source | Google Fonts via `next/font/google` |
| CSS variable | `--font-dm-sans` |
| Fallback stack | `system-ui, sans-serif` |
| Subset | Latin |
| Display | `swap` |
| Applied to | `<body>` via `dmSans.className` + `.font-sans` class |

### How it is loaded (layout.tsx)
```ts
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

// Applied on body:
<body className={`${dmSans.className} font-sans antialiased`}>
```

### How it is declared (globals.css)
```css
:root {
  --font-dm-sans: "DM Sans", system-ui, sans-serif;
}

.font-sans {
  font-family: var(--font-dm-sans);
}
```

### DM Sans Weight Usage Patterns

| Weight class | Tailwind | Used for |
|---|---|---|
| 400 Regular | `font-normal` | Body paragraphs, descriptions |
| 500 Medium | `font-medium` | Labels, metadata, nav items |
| 600 Semi-Bold | `font-semibold` | Buttons, sub-headings, badges |
| 700 Bold | `font-bold` | Card titles, section headings |
| 800 Extra-Bold | `font-extrabold` | Feature headings |
| 900 Black | `font-black` | Hero headlines |

### DM Sans Size Usage Patterns

| Tailwind class | Pixel size | Used for |
|---|---|---|
| `text-xs` | 12px | Metadata labels, timestamps, tags |
| `text-sm` | 14px | Body text, form labels, card meta |
| `text-base` | 16px | Default body, paragraph text |
| `text-lg` | 18px | Card titles, list headings |
| `text-xl` | 20px | Section sub-headings |
| `text-2xl` | 24px | Section headings (desktop) |
| `text-3xl` | 30px | Page headings (mobile hero) |
| `text-4xl` | 36px | Hero headings |
| `text-5xl` | 48px | Large hero headings (tablet) |
| `text-6xl` | 60px | XL hero display text (desktop) |

### Letter-spacing & Line-height
- Section label caps: `tracking-widest uppercase text-xs font-semibold`
- Hero display: `leading-tight` or `leading-none`
- Body paragraphs: `leading-relaxed`
- Card descriptions: `leading-snug`

---

## Secondary Fonts — Internal Admin Tool Only

These two fonts are **only used on the `/statuscheck` page** (a developer/admin diagnostic tool).
Do NOT use them on any regular app page or new component.

### Space Grotesk (statuscheck headings only)
```ts
import { Space_Grotesk } from "next/font/google";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
});
```
- Applied as page-level heading font on the statuscheck dashboard
- Gives a "technical dashboard" feel distinct from the main app

### JetBrains Mono (statuscheck code/terminal only)
```ts
import { JetBrains_Mono } from "next/font/google";

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
});
```
- Used for monospace display: API URLs, keyboard shortcuts, code blocks, JSON output
- Applied inline via `monoFont.className` on specific `<span>` and `<pre>` elements

---

## Rules for New Components

1. **Always use DM Sans** — it is already loaded globally, no import needed
2. **Never import a new font** without discussing it first — only DM Sans is in the global bundle
3. For monospace needs (e.g., ticket IDs, QR codes, codes): use Tailwind's `font-mono` class which falls back to the system monospace stack
4. Do NOT add Space Grotesk or JetBrains Mono to new pages — they are intentionally scoped to `/statuscheck`

---

## Quick Copy-Paste Reference for Claude

```
SOCIO Font Rules:
- One font family: DM Sans (Google Fonts, already loaded globally)
- CSS var: var(--font-dm-sans) | Tailwind: font-sans (applied on body)
- Weights available: 400 / 500 / 600 / 700 / 800 / 900
  → font-normal, font-medium, font-semibold, font-bold, font-extrabold, font-black
- Sizes: text-xs (12) → text-sm (14) → text-base (16) → text-lg (18) →
         text-xl (20) → text-2xl (24) → text-3xl (30) → text-4xl (36) →
         text-5xl (48) → text-6xl (60)
- Hero display text: text-4xl–6xl font-black leading-tight
- Section headers:   text-xl–2xl font-bold
- Card titles:       text-lg font-bold
- Body text:         text-sm–base font-medium text-slate-600
- Labels/meta:       text-xs–sm font-semibold text-gray-500
- Monospace fallback (IDs, codes): font-mono (system font, no import needed)
- DO NOT import new fonts. DO NOT use Space Grotesk or JetBrains Mono on new pages.
```
