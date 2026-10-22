# Cinematic responsive v2 — implementation handoff

## Scope and compatibility
This repository is an authenticated developer dashboard, not a public-facing product marketing website. The supplied desktop cinematic-scroll and mobile-experience briefs are reference requirements. Preserve all existing dashboard modules, API operations, navigation, login, account settings, credentials and four themes. Do not replace dashboard workflows with an unrelated marketing page or introduce fabricated content.

## Implemented on this branch
- Retained the existing fixed mobile header, accessible menu close/Escape/focus return, sidebar and dashboard.
- Made the existing background video poster-first on viewports <= 760px and for reduced-motion users. The visitor can opt in to video; video is paused when hidden.
- Added static poster background even when no video element is mounted.
- Improved mobile safe-area positioning, touch size of the video switch, table scroll containment and content wrapping.
- No backend or production configuration changes.

## Visual story (proposal; media not yet generated)

| Scene | Visual story | Website copy |
| --- | --- | --- |
| 01 — Overview | Existing luminous system background emphasizes live summary and site health, with dashboard cards remaining interactive | "Всичко под контрол." + live operational status |
| 02 — Monitoring | Transition is represented by motion in existing dashboard components, not a blocking fullscreen takeover | "Мониторинг на сайтове" + live status/history |
| 03 — Deployments | Current deployments and commits are displayed as actionable, accessible information | "Deployments и commits" + live integration data |
| 04 — Resolution | Alerts and shortcuts stay in normal page flow; no fake counters | "Център за известия" + real incident state |

## Important limitations
- No Higgsfield MCP media production is configured here; no new connected 16:9 / 9:16 video clips, frame sequences, or generated logos are claimed.
- A pinned scrubbed canvas story would fundamentally alter an operational dashboard. Introduce it only as an optional, skippable introductory layer after a dedicated storyboard and real video assets are reviewed.
- Production build, browser scroll behavior, device width tests, frame continuity and real network performance still require validation before merge.

## Validation checklist
1. Install dependencies and run the repository's build and lint/type scripts.
2. Test at 320, 360, 390, 430, 768 and 1440px widths.
3. Confirm no video request on first mobile load or when reduced-motion is enabled; confirm poster paints.
4. Verify video starts through the button, stops and releases when toggled off, and pauses when tab is hidden.
5. Verify fixed mobile header, hamburger menu, focus trap, Escape, click-away, anchor/navigation and scroll behavior.
6. Verify dashboard table scrolling, interactions, cards, forms and auth after changes.
7. Confirm main production branch unchanged and only merge after review.
