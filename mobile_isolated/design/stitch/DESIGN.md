---
name: Pro-Ledger Financial
colors:
  surface: '#f7f9fe'
  surface-dim: '#d8dadf'
  surface-bright: '#f7f9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f9'
  surface-container: '#eceef3'
  surface-container-high: '#e6e8ed'
  surface-container-highest: '#e0e2e7'
  on-surface: '#181c20'
  on-surface-variant: '#45464f'
  inverse-surface: '#2d3135'
  inverse-on-surface: '#eff1f6'
  outline: '#767680'
  outline-variant: '#c6c5d0'
  surface-tint: '#505c8f'
  primary: '#000421'
  on-primary: '#ffffff'
  primary-container: '#0d1b4b'
  on-primary-container: '#7884ba'
  inverse-primary: '#b8c4fe'
  secondary: '#005db7'
  on-secondary: '#ffffff'
  secondary-container: '#64a1ff'
  on-secondary-container: '#003670'
  tertiary: '#00070f'
  on-tertiary: '#ffffff'
  tertiary-container: '#002135'
  on-tertiary-container: '#518cb8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4fe'
  on-primary-fixed: '#081747'
  on-primary-fixed-variant: '#384475'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#a9c7ff'
  on-secondary-fixed: '#001b3d'
  on-secondary-fixed-variant: '#00468c'
  tertiary-fixed: '#cbe6ff'
  tertiary-fixed-dim: '#93cdfc'
  on-tertiary-fixed: '#001e30'
  on-tertiary-fixed-variant: '#004b71'
  background: '#f7f9fe'
  on-background: '#181c20'
  surface-variant: '#e0e2e7'
  success: '#43a047'
  danger: '#e53935'
  warning: '#fb8c00'
  surface-card: '#ffffff'
  border-regular: '#e0e0e0'
  hardware-bezel: '#1a1a2e'
typography:
  display-metric:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '800'
    lineHeight: 16px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '800'
    lineHeight: 14px
  body-base:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
  body-bold:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '800'
    lineHeight: 12px
  label-sm:
    fontFamily: Inter
    fontSize: 8px
    fontWeight: '700'
    lineHeight: 10px
  label-caps:
    fontFamily: Inter
    fontSize: 8px
    fontWeight: '800'
    lineHeight: 10px
    letterSpacing: 0.05em
  ui-text:
    fontFamily: Inter
    fontSize: 7px
    fontWeight: '600'
    lineHeight: 9px
  table-data:
    fontFamily: Inter
    fontSize: 6px
    fontWeight: '500'
    lineHeight: 8px
  caption:
    fontFamily: Inter
    fontSize: 5px
    fontWeight: '800'
    lineHeight: 7px
    letterSpacing: 0.1em
  micro:
    fontFamily: Inter
    fontSize: 4px
    fontWeight: '400'
    lineHeight: 6px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  page-margin: 12px
  section-gap: 10px
  component-padding: 8px
  card-margin: 6px
  micro-gap: 4px
  grid-unit: 2px
---

## Brand & Style

The design system is a high-performance corporate identity engineered for professional-grade financial analysis. It prioritizes **Information Density** and **Absolute Clarity**, catering to market participants who require instantaneous access to complex data arrays. The aesthetic is "Pro-Tool" utility: every pixel serves a functional purpose, minimizing decorative elements to maximize the signal-to-noise ratio.

The chosen design style is **Corporate / Modern** with elements of **Flat Design**. 
- It avoids skeuomorphism and heavy shadows to maintain a clean, "paper-on-glass" digital workspace.
- It utilizes high-contrast semantic coloring as a primary navigational aid.
- The interface is characterized by rigorous grid alignment, structured borders, and a hardware-inspired mobile frame that provides a sense of enclosure and focus.
- The tone is authoritative, analytical, and dependable, evoking the feeling of a sophisticated trading terminal.

## Colors

The palette is anchored by **Midnight Corporate Navy**, establishing an immediate sense of institutional trust. 

- **Primary Color:** Used for structural anchors like the App Bar, active navigation states, and primary Call-to-Action (CTA) backgrounds.
- **Secondary Color (Action Blue):** Reserved for interactive elements, links, and broker-specific actions to differentiate "Trade" activity from "Navigation" activity.
- **Neutral Color:** A pale ice blue that serves as the canvas for the entire application, providing enough contrast for white cards to appear elevated without using shadows.
- **Semantic Logic:** A strict traffic-light system is implemented. **Success Green** is used for bullish data and "Buy" actions; **Danger Red** for bearish data and "Sell" actions; **Warning Orange** for "Hold" or neutral-warning status. These colors must maintain high legibility against white and light-tinted backgrounds.

## Typography

This system uses **Inter** throughout to leverage its exceptional legibility at small sizes and high-density environments. The typographic hierarchy relies on weight (600 to 800) and letter-spacing rather than large jumps in font size.

- **Data Density:** Large metric values are capped at 13px to ensure they do not consume excessive vertical space. 
- **Tabular Data:** Use the `table-data` (6px) role for ticker symbols and price details. This allows for up to 6 columns of data to be displayed on a standard mobile viewport without horizontal scrolling.
- **Alignment:** Financial values (numbers, percentages) should always use tabular lining figures if available, or be right-aligned in tables to ensure decimal points align vertically. Labels and identifiers are always left-aligned.

## Layout & Spacing

The design system employs a **Fixed Grid** philosophy optimized for mobile-first dashboard environments. The layout is built on a strict **2px grid unit**.

- **Structure:** The content is contained within white cards that sit on a `Pale Ice Blue` background.
- **Grid Models:** 
    - Dashboard widgets use a 2-column (`1fr 1fr`) or 3-column (`1fr 1fr 1fr`) CSS Grid.
    - Tables use a multi-column flex layout with fixed widths for labels and fluid widths for metric data.
- **Margins:** A consistent 12px margin is maintained around the device edges. Vertical spacing between different functional sections (e.g., Index Strip to Portfolio Snapshot) is fixed at 10px to maintain a rhythmic, ledger-like appearance.
- **Breakpoints:** On tablets or larger screens, cards do not stretch; instead, the 3-column grid expands to a 4 or 6-column grid to prevent metrics from becoming too wide and losing readability.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** rather than shadows. This maintains a clean, professional aesthetic that mimics a physical document or high-end financial terminal.

- **Layer 0 (Background):** `Neutral Color` (#f4f6fb). The base canvas.
- **Layer 1 (Cards/Surfaces):** `Surface Card` (#ffffff). Individual modules like price charts or watchlists.
- **Layer 2 (Functional Overlays):** `Muted Surface` (#f0f2f8) or `Highlight Surface` (#e3f2fd). Used for table headers, inactive pills, or focused row highlights.
- **Outlines:** Depth is reinforced by `1px solid` borders using `#e0e0e0`. This "Low-contrast outline" technique defines boundaries without adding visual weight.
- **Glassmorphism:** Reserved exclusively for high-level navigation components (like a persistent home indicator or notch background) using a subtle 10% white opacity with a background blur.

## Shapes

The shape language is **Soft**, providing a professional balance between modern tech and traditional institutional design.

- **Primary Radius:** 0.25rem (4px) for input fields, table rows, and smaller buttons.
- **Container Radius:** 0.5rem (8px) for metric cards and main action panels.
- **Pill Radius:** Full rounding (999px) is used for status chips (Buy/Sell), category filters, and navigation tabs to clearly distinguish them as interactive, touch-friendly elements.
- **Exceptions:** The outer "Hardware Frame" of the application shell uses a 32px radius to simulate modern smartphone ergonomics.

## Components

- **Buttons:** 
    - *Primary:* Solid `Midnight Navy` with white text. 
    - *Action:* Solid `Secondary Blue`. 
    - *Semantic:* Solid `Success Green` (Buy) or `Danger Red` (Sell).
- **Index Strips:** Horizontal scrolling rows with 1px bottom borders. Each item contains a bold ticker, a display metric, and a colored percentage badge.
- **Metric Cards:** White cards with 8px radius and hairline borders. Title at top (8px bold), value in center (13px bold), and trend indicator at bottom.
- **Trade Panels:** Integrated order forms with segmented Buy/Sell controls. Inputs use 4px radius and 1px borders that thicken to the primary navy on focus.
- **Chips/Badges:** Small, highly-rounded pills with light semantic backgrounds (e.g., light green background for green text) to indicate status without overpowering the numeric data.
- **Lists/Tables:** High-density rows with 1px light gray separators. Row height is minimized to show maximum data. Active or "Selected" rows should use a `Pale Ice Blue` background tint.
- **Navigation:** Bottom navigation uses 13px icons with 7px labels. The active state is indicated by a primary color shift and a subtle top-border indicator.