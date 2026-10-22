# Cinematic responsive experience — coded motion

## Scope
The owner approved the desktop/mobile briefs with Higgsfield explicitly excluded. This is the existing authenticated Developer Command Center, not a new marketing site. The existing logo, four palettes, API endpoints, authentication, monitoring, integrations, live feed, panel editor and stored settings are retained. No new third-party media provider, service, subscription or dependency was introduced.

## Visual Story

| Scene | Visual story | Website copy |
| --- | --- | --- |
| 01 — Observe | A luminous orbital system forms around the existing wave logo. | Всичко под контрол. / Към панелите |
| 02 — Track | The same continuous mathematical object opens into a connected spherical network. | От промяната до публикуването. |
| 03 — Respond | The network resolves into a composed final orbit before the real dashboard. | Виж важното. Действай навреме. |

### Scroll pacing
The desktop container is 350svh; mobile is 260svh. Active pinned travel is **container height minus stage height**, not the full container height (roughly 2.5–2.65 desktop viewport heights and 1.6–1.75 mobile viewport heights at ordinary sizes). The actual denominator is measured from the rendered elements.

Progress intervals: 0–12% opening hold; 12–44% continuous transformation; 44–56% reading hold; 56–88% continuous resolution; 88–100% closing hold. HTML copy changes at 36% and 72%. Forward/reverse mapping is deterministic with continuous easing at holds. No wheel/touch interception, smooth-scroll dependency or video seeking.

## Responsive rendering and fallbacks
- Desktop: left copy / right visualization. Phone: visualization above a short headline and one primary action. Mobile timeline is shorter.
- The existing fixed mobile navigation remains outside the sticky section, with the original wave logo and wordmark. Closed mobile navigation is inert. Open navigation exposes a modal dialog, traps focus, supports Escape, restores focus and makes the content behind it inert. Changing to desktop closes the drawer.
- One canvas is drawn at the actual display size, capped at 1.75 device pixel ratio. No portrait/landscape footage is downloaded: the same geometric scene is recomposed for its container.
- Rendering is event-driven, at most one requested animation frame per scroll/resize event burst. It stops offscreen or when the document is hidden; observers/listeners are removed on teardown. It follows theme changes.
- Reduced-motion, Save-Data and viewport heights at or below 540px use the static composition and normal content flow. Canvas unavailability/context loss also falls back. The original SVG logo and CSS poster appear before canvas rendering.
- `Към панелите` immediately moves to and focuses the dashboard heading. `Скрий` collapses the intro; `Пусни въведението` restores it. The hide preference is browser-local under `dcc:story-hidden:v1`; operational settings still use the existing shared backend.
- Existing background video behavior is retained: opt-in on phones and reduced-motion devices. No new video is generated or substituted.

## Editable source and design board
- `app/story-content.ts`: headings, supporting copy, action, destination, timeline.
- `app/scroll-story.tsx`: canvas renderer, lifecycle and interaction.
- `app/scroll-story.css`: composition, typography, responsive spacing and fallbacks.
- `/design`: authenticated design board with original logo, existing theme tokens, type samples, action, component sample and scene copy. Its theme switch is preview-only and does not save account settings.
- `public/voicecommand-logo.svg`: original master, unchanged. No generated logo, video, image sequence or prompts are claimed.

## Validation and limits
- TypeScript, all 34 tests (31 existing backend/auth/session tests and 3 new timeline tests), and the production build passed.
- Added timeline tests cover bounds, continuity at holds, monotonic forward progression and reverse determinism.
- The isolated visual QA fixture uses existing initial data with no invented production measurements. It is not part of the repository or deployment.
- Browser QA was blocked by the environment's URL-policy gate. Mobile widths, focus behavior, canvas composition, scroll pacing and real network loading are therefore **not visually verified**. Build success is not evidence of smooth playback.
- New story media requests: only the existing 768-byte SVG logo. This excludes JS/CSS, fonts and the existing page background. No measured load-time claim.
- No live database changes, credentials changes or migrations are required. Deploy through the existing Cloudflare workflow; preserve `wrangler.jsonc` and secrets.

## Manual review checklist
Check 320×568, 360×740, 390×844, 430×932, 768×1024 and 1440×900; forward/backward scrolling; skip/hide/replay; fixed header after story; drawer focus/Escape/selection; theme changes; reduced motion; a short landscape viewport; unavailable canvas; and no horizontal overflow. Confirm the existing monitoring, integration forms and editing actions after deployment.
