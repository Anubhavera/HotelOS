# Styling Rules

## Design System
- Use CSS Custom Properties (variables) for ALL colors, spacing, typography, and shadows
- Define tokens in `src/app/globals.css` under `:root` and `[data-theme="dark"]`
- NEVER hardcode colors — always reference `var(--color-name)`

## Theme
- Support both light and dark modes via `data-theme` attribute on `<html>`
- Default to system preference via `prefers-color-scheme` media query
- Allow manual toggle that persists in localStorage

## Color Palette
- Primary: Deep teal/emerald tones (professional, premium feel)
- Accent: Gold/amber (luxury hotel branding)
- Status colors: Green (available/success), Red (occupied/error), Amber (pending/warning), Blue (info)
- Background: Off-white (light) / Deep charcoal (dark)

## Typography
- Font family: `Inter` from Google Fonts (with system fallbacks)
- Font sizes: Use a modular scale (clamp for responsive sizing)
- Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

## Spacing
- Use 4px base unit: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Consistent padding on cards: 20px (mobile), 24px (desktop)

## Responsive Breakpoints
- Mobile: < 768px (primary target — PWA for owners)
- Tablet: 768px - 1024px
- Desktop: > 1024px (staff web interface)

## Component Styling
- Each component has its own CSS file imported at the component level
- Use BEM-like naming: `.room-card`, `.room-card__header`, `.room-card--occupied`
- Avoid deep nesting (max 3 levels)
- Use `gap` for spacing between flex/grid children (not margin hacks)

## Animations
- Use `transition` for hover/state changes (200-300ms ease)
- Use `@keyframes` for loading spinners and entrance animations
- Respect `prefers-reduced-motion` — disable animations when user requests
- Add micro-interactions: button press scale, card hover lift, badge pulse

## Glassmorphism
- Use `backdrop-filter: blur()` sparingly for modals and overlays
- Ensure fallback styles for browsers without backdrop-filter support
