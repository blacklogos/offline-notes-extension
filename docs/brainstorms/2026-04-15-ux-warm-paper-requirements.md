---
date: 2026-04-15
topic: ux-warm-paper-identity
---

# Warm-Paper Visual Identity for Offline Notes

## Problem Frame

The extension's chrome (popup, sidebar) currently uses a generic Bootstrap-ish palette (`#f8f9fa` / `#212529` / `#dee2e6` / `#667eea`) over a system font stack. It is competent but anonymous — it could be any web app from 2020. The vendored Inter Display font family in `fonts/` is unused outside the image templates, and the existing image templates (`lib/templates.js`) are the only place the extension shows any visual personality at all.

This generic chrome was tolerable when the extension lived only in the popup and sidebar. The upcoming highlight-capture feature (see origin: [`docs/brainstorms/2026-04-15-highlight-capture-requirements.md`](2026-04-15-highlight-capture-requirements.md)) introduces a **floating bubble that appears on every third-party web page**. That bubble cannot hide behind being just-another-app — it sits next to a user's selection on Medium, GitHub, news sites, marketing pages, and competes for attention against every brand color in the open web. Without a deliberate visual identity, the bubble will look like adware regardless of how well it works.

The user wants to commit to a real visual identity ("warm paper / notebook") and apply it consistently across every existing and upcoming surface, so the extension reads as a coherent product instead of a stack of features. The identity should reinforce — not fight — the product's core message: your notes, on your machine, no cloud.

## Requirements

**Identity Foundation (Design Tokens)**
- R1. Adopt a single design-token vocabulary used by every surface (popup, sidebar, in-page bubble, image templates, toolbar icon). Tokens cover at minimum: palette, typography, spacing scale, border radius, shadow, motion timing.
- R2. Palette is "warm paper": cream paper background (around `#FAF7F2`), warm dark ink text (around `#2A2622`), warm muted greys for secondary surfaces and dividers, and a single sage-green accent (`#7C9885`) used for focus states, primary actions, active states, and the toolbar badge. Exact stops (e.g. paper-50/100/200) deferred to planning.
- R3. Primary typeface is **Inter Display** (already vendored at `fonts/`), used for both headings and body. Fallback to system sans. Numerals are tabular where they appear in metadata (timestamps, counts).
- R4. Spacing is on a 4 px grid (4, 8, 12, 16, 24, 32, 48, 64). Border radii are deliberately small (4 px and 8 px only — no pill shapes, no large radii) to read as "paper edges" rather than "iOS card."
- R5. Shadows are very low-elevation, warm-tinted (no pure black `rgba(0,0,0,…)` shadows — they break the warm palette). Treat them as ink-bleed, not drop-shadows. Most surfaces have no shadow at all; only the bubble and modals carry a single soft layer.
- R6. Iconography is line-based (1.5 px stroke), not filled — Lucide style. One icon family across all surfaces.

**Popup (Quick Note)**
- R7. Popup adopts the new tokens completely: cream background, Inter Display, sage focus ring on inputs and the save button, small radii, generous breathing room.
- R8. The current popup IA (title field, content textarea, tags, save button, link to sidebar) is preserved — this brainstorm does not redesign flows. Only the visual treatment changes.
- R9. The "saved" confirmation that briefly appears after a save is restyled to match the new identity (subtle sage text, no toast-style overlay).

**Sidebar (Notes + Pages tabs)**
- R10. Sidebar adopts the new tokens completely. The existing Notes view IA is preserved.
- R11. The Notes/Pages tab strip introduced by the highlight-capture feature uses sage as the active-tab indicator (a 2 px sage underline on the active tab; muted text on the inactive tab).
- R12. Empty states (no notes yet, no page notes yet, no search results) get small line-drawing illustrations in muted sage that fit the notebook metaphor (e.g. a stylized open notebook, a magnifying-glass-on-paper). One illustration per empty state, not many.
- R13. Note list rows show note title in ink, metadata (date, tag chips) in muted ink, and use a 1 px paper-divider between rows rather than card containers.

**In-Page Bubble**
- R14. The bubble is a small cream pill (paper background, 8 px radius) with sage icon and ink label, sized to feel personal not corporate. It must look intentional on both light and dark host pages — accept that on dark pages it will be visibly cream-on-dark, which is the right choice (a notebook is always paper).
- R15. The bubble carries a single subtle warm shadow so it lifts off the host page without screaming. No glow, no gradient, no animation on appearance beyond a 120 ms fade-in.
- R16. The bubble's "Saved" success state swaps the icon to a sage check and the label to "Saved" for ~1 second, then fades. No checkmark celebration animations.
- R17. Bubble visual identity is the seed of the brand on the open web. It must be recognizable enough that a user who has seen the bubble once recognizes the next one — but not so loud that it looks like adware. The line is: cream paper + small icon + sage = "I belong to a notes app I installed," not "I am an ad."

**Toolbar Badge and Icon**
- R18. Toolbar extension icon is redesigned to match the identity — a small notebook in cream paper with a sage spine. Replaces the current generic icon. SVG source committed to `images/`.
- R19. The per-tab highlight-count badge uses sage as the badge background with cream text. Numeric only, no other indicators.

**Image Templates**
- R20. All five existing image templates (`default`, `minimal`, `card`, `quote`, `modern`) are replaced with a five-template warm-paper family. Suggested: `paper-default`, `paper-minimal`, `paper-quote`, `paper-card`, `paper-letterhead` — final names and exact compositions deferred to planning.
- R21. Each new template uses cream backgrounds, Inter Display, sage accents (sparingly — most ink is dark on cream). They must remain visually distinguishable from each other (the value of having five templates is choice, not five near-identical paper rectangles).
- R22. Existing template export size and 2× scale behavior are preserved. The performance budget (300–900 ms per template noted in the README) is not regressed.

**Highlight Mark Style**
- R23. The `<mark>` style applied when re-painting saved highlights in the page (introduced by the highlight-capture feature) uses a soft warm-paper highlight color — not pure yellow. Suggested: a tinted cream-yellow around `#F4E4A1` so it reads as "highlighter on aged paper" and harmonizes with sage. Final value deferred to planning, but the constraint is: must remain legible over arbitrary host page text colors, including dark mode pages.
- R24. The flash animation when jump-to-highlight scrolls to a mark uses a brief sage outline pulse (~1.5 s, ease-out) rather than a generic blue flash.

## Success Criteria

- A first-time user installing the extension and opening the popup forms a clear, specific impression of the product within seconds — words like "notebook," "personal," "calm," "made by someone with taste" should be plausible reactions, while "could be anything," "default," and "looks like an ad" should not.
- The in-page bubble appears on a Medium article, a GitHub issue, a heavily-styled marketing landing page, and a dark IDE page (e.g. a docs site in dark mode), and on all four it reads as deliberate and consistent with itself — a user notices "oh, that's the notes thing" rather than "what is this overlay?"
- Every visible surface — popup, sidebar Notes, sidebar Pages, bubble, badge, the five image templates, the toolbar icon — uses the same palette, typeface, spacing scale, and accent. A reviewer can recognise that they belong to the same product without being told.
- The chrome refresh does not regress any existing functionality. All keyboard shortcuts, save flows, and image generation continue to work identically.
- The identity is durable enough that adding a new surface in 6 months (e.g. a settings page, an export modal, a different note type) has an obvious visual answer that doesn't require re-litigating the palette.

## Scope Boundaries

- Light theme only. Dark mode is explicitly deferred to a future iteration. The single "warm paper" mode must look right on both light and dark host pages (R14) but the extension itself ships only in light mode.
- No information-architecture rework. The popup's fields, the sidebar's structure, the keyboard shortcuts, the save flows, and the export options stay as they are. Only visual treatment and the small per-surface details listed in R7–R24 change.
- No new functional features beyond what the highlight-capture brainstorm already specifies. This brainstorm is identity, not behavior.
- No vendoring of new fonts. Inter Display is already in `fonts/` and is the answer.
- No animation library, no motion framework. Motion is limited to CSS transitions on a small set of properties (opacity, transform, color) at consistent durations (120 ms for micro-interactions, 1.5 s for the highlight flash).
- Toolbar icon redesign is in scope (R18) but the Chrome Web Store listing assets (screenshots, store description) are out of scope for this brainstorm — they ride on the same identity once it lands.

### Deferred to Separate Tasks

- **Settings UI surface.** The dark-mode toggle (R-not-required-this-iteration) and any future preference would need a settings panel that does not currently exist. Designing the settings surface is a separate brainstorm if and when settings appear.
- **Onboarding / first-run experience.** Today the extension just opens the sidebar on install (`background/background.js`). A real onboarding flow (welcome card, three-step explainer, example highlights) would amplify the identity but is its own brainstorm.

## Key Decisions

- **Identity = warm paper / notebook.** Rationale: reinforces the "your notes on your machine" message in a way Linear-sharp or terminal-dark cannot. Warmth signals personal, local, calm — exactly what differentiates this from cloud notes apps. Inter Display is already vendored and carries the look without new dependencies.
- **Single accent = sage green `#7C9885`.** Rationale: lowest visual aggression of the three considered (sage / terracotta / mustard); doesn't compete with brand colors on the open web when the bubble appears next to a selection; reads as "library / thoughtful tool" which matches the product's positioning.
- **Light-only for v1.** Rationale: dark mode roughly doubles design surface area (every token, every contrast check, every illustration variant) and would split attention before the identity has landed. Ship one mode well, add dark later only if requested.
- **Image templates fully refreshed into a warm-paper family** (R20). Rationale: the templates are the most-shared external artifact of the extension (users export images to social media, presentations); they must carry the brand. Five distinct paper variants preserve the "choice" value of having five templates without diluting the identity.
- **Bubble identity is the brand seed on the open web.** Rationale: it is the only surface that appears on third-party pages. Every visual decision should be checked against "does the bubble look right?" — not the popup, which only loyal users see.
- **No information-architecture rework in this brainstorm** (Scope Boundaries). Rationale: bundling visual identity with flow changes turns a 1-week design pass into a 4-week project and makes it harder to evaluate either change on its own merits. IA improvements get their own brainstorm if needed.

## Dependencies / Assumptions

- Assumption: the highlight-capture plan (`docs/plans/2026-04-15-001-feat-highlight-capture-plan.md`, Units 4 and 7) is structured so the bubble's CSS file (`content/highlight.css`) and the sidebar's Pages-tab CSS additions can be replaced wholesale by this design pass without churning the capture/re-paint logic. Verified: that plan explicitly comments both files as "replaceable" and isolates visual styling from behavior.
- Assumption: Inter Display, as vendored in `fonts/`, includes weights for at least Regular (400) and Semibold (600). Should be verified during planning before locking type ramps. Unverified at brainstorm time.
- Assumption: replacing the toolbar icon (R18) does not require Chrome Web Store re-review (the extension is loaded unpacked per README; if/when listed, icon changes are part of normal store update process).
- Dependency: sage `#7C9885` must pass WCAG AA contrast against the paper background (`#FAF7F2`) when used for text and for ≥3 px borders/icons. Quick check during planning; if marginal, darken sage to a paired stop (e.g. `#5F7A6A`) for text-only use while keeping `#7C9885` for ≥3 px elements.

## Outstanding Questions

### Resolve Before Planning

(none — all product decisions are settled)

### Deferred to Planning

- [Affects R2][Technical] Exact palette stops (paper-50/100/200/300, ink-700/900, sage-300/500/700, warm-grey scale). Pick during planning by sampling against real content and contrast-checking; brainstorm only commits to the headline colors.
- [Affects R3][Needs research] Verify Inter Display weight availability in `fonts/` and pick a 4-step type ramp (e.g. 12/14/16/20 px or 13/15/17/22 px). Decide line-heights and letter-spacing per step.
- [Affects R6][Technical] Pick a specific icon set (Lucide is the obvious candidate given existing 1.5 px stroke convention; alternatives: Phosphor, Heroicons-outline). Vendor SVGs into `images/icons/` rather than pulling at runtime. Decide which 8–12 icons are needed across all surfaces and bake the set rather than reaching for the full library.
- [Affects R12][Technical] Empty-state illustrations: hand-drawn SVG by the implementer, vendored from a permissively-licensed set (e.g. unDraw, Reshot), or skip illustrations and use a single muted-sage line of text per empty state. Decide during planning based on time budget.
- [Affects R18][Needs research] Toolbar icon SVG — produce in-house (simple notebook glyph) or commission. Either way, the source SVG plus generated PNGs at 16/32/48/128 px are the deliverable. The brainstorm just commits to "small notebook in cream with sage spine."
- [Affects R20, R21][Technical] Final five template names and exact compositions (which fields are large vs small, where the source URL appears, whether tags are chips or inline text). The constraint is "five distinguishable warm-paper variants"; the specific compositions are a planning-time exercise.
- [Affects R23][Needs research] Highlight `<mark>` color — `#F4E4A1` is a starting suggestion; verify legibility over the 10 most common host page text colors (pure black, near-black, dark grey, mid grey, white-on-dark, etc.) before locking. May need two values (one for light pages, one for dark pages) detected via host page background sample.

## Next Steps

This requirements document and the highlight-capture plan are the two inputs for the next planning pass. The implementation plan for this UX work should slot in alongside the highlight-capture plan such that:

- Tokens, popup refresh, sidebar refresh, and image templates can land independently of highlight capture (they only touch existing files).
- The bubble CSS and Pages tab CSS deliverables of *this* plan replace the placeholder CSS from highlight-capture Units 4 and 7. Whichever lands second wins; both plans must produce a coherent shipped product.
- The toolbar icon redesign (R18) is the smallest atomic change and a good first commit — it's instantly visible and signals the work in progress.

-> `/compound-engineering:ce-plan` against this document, with the highlight-capture plan as a sibling reference.
