# Workspace UI Refinement Design

**Date:** 2026-08-01

**Goal:** Make Project Manager substantially clearer and more polished without changing its layout, product behavior, or existing feature set.

## Product Truth

Project Manager is a vanilla JavaScript single-page workspace for tracking projects, tasks, deadlines, team members, activity, goals, and account settings. It supports authenticated API mode plus a client-side mock mode, dark and light themes, desktop sidebar navigation, mobile bottom navigation, command-palette navigation, task drawers, Kanban boards, calendar views, notifications, and keyboard shortcuts.

## Scope

This is a refinement, not a rebrand or information-architecture rewrite.

- Preserve all existing page routes, DOM regions, API routes, auth flows, data fields, and mobile navigation.
- Preserve the current mint/pine identity, using it with tighter contrast and less visual competition.
- Improve the shared visual system across dashboard, projects, project detail, tasks, calendar, team, analytics, settings, onboarding, drawers, dialogs, and popovers.
- Add small client-side quality-of-life improvements that do not change server contracts.
- Keep reduced-motion behavior, keyboard access, and responsive behavior as first-class requirements.

## Visual Direction

### Surfaces and color

Use four readable surface levels: page canvas, navigation surface, raised content, and modal/overlay. Use the existing pine and mint tokens for primary actions and active states. Keep warning and danger colors reserved for real urgency. Remove decorative gradients or glows that compete with content; retain only subtle accent edges where they clarify grouping.

### Typography

- `Plus Jakarta Sans` for page titles, section headings, and high-value dashboard numbers.
- `Inter` for body copy, labels, controls, and navigation.
- `JetBrains Mono` only for keyboard hints, compact numeric values, and technical metadata.

Use a consistent type scale, sentence-case labels, tabular numerals for counts, and predictable heading-to-supporting-copy spacing.

### Layout rhythm

Keep the existing shell and two-column dashboard layout. Normalize padding, gaps, card radii, border weight, action alignment, and mobile wrapping through shared tokens and final-layer selectors. Every page should read in this order: title and context, primary action, controls, main content, supporting content.

### Signature detail

Add a compact dashboard work-pulse rail alongside the existing summary content. It surfaces overdue work, due-today work, and completion momentum using the same data already loaded by the dashboard. It is an organizing aid, not a new data source or a decorative chart.

## Organization and Quality of Life

- Keep dashboard metrics and work pulse first, projects as the primary work surface, and activity/goals as supporting context.
- Standardize page toolbars so search appears first, filters follow, sorting stays last, and primary actions remain visually dominant.
- Preserve existing last-page, last-project, sidebar-collapse, theme, calendar, notification, and sound preferences.
- Persist task filter and sort choices locally so returning to My Tasks restores the working view.
- Improve the command palette so it can search current projects and tasks with clear result groups and predictable keyboard selection, while preserving existing navigation and creation commands.
- Show a reset affordance when project or task filtering is active; reset only the current view's filters.
- Keep empty states actionable and specific; keep destructive actions explicit and confirmable.
- Keep mobile controls usable without horizontal overflow, with bottom navigation and primary actions reachable above safe-area padding.

## Implementation Boundaries

### `css/polish.css`

Treat this as the visual source of truth for the refinement. Organize overrides by tokens, shell, typography, controls, content surfaces, page-specific organization, overlays, responsive behavior, and reduced motion. Avoid broad selector churn in `css/styles.css` unless a base rule prevents an accessible or responsive fix.

### `js/app.js`

Make only focused behavior additions:

- Render the work-pulse rail from existing dashboard task data.
- Persist and restore task filter/sort state.
- Extend command-palette indexing and filtering to tasks without breaking current actions.
- Add current-view reset behavior for active filters.

Keep server communication, auth, data models, and rendering contracts unchanged.

### `index.html`

Change markup only when needed for semantic labels, a work-pulse mount point, or accessible control names. Do not restructure the app shell or page layout.

## Testing and Verification

- Add focused unit coverage for task preference serialization, default handling, and invalid stored values before implementation.
- Run the existing lint command and the new test command.
- Run the app in mock mode and verify dashboard, projects, tasks, calendar, project detail, team, analytics, settings, drawers, command palette, theme switching, and mobile navigation.
- Verify desktop and mobile layouts at representative widths, keyboard focus, reduced motion, and no console errors.
- Run the Impeccable detector against changed UI targets.
- Inspect the final git diff, commit the design spec and implementation separately when practical, then push the requested update to the configured GitHub remote.

## Success Criteria

- Existing features remain available and functional.
- Pages share one clear visual hierarchy instead of competing card and gradient treatments.
- Task and project work surfaces scan faster at desktop and mobile widths.
- Returning users keep useful view preferences without server changes.
- Command-palette search reaches projects and tasks with keyboard-only interaction.
- `npm run lint` and focused tests pass; browser verification shows no new console errors or layout overflow.
