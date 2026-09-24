# Admin sidebar-08 design

## Goal

Replace the protected admin area's horizontal navigation with the official
shadcn/ui `sidebar-08` pattern. Keep its inset layout and add icon-collapse
behavior. Preserve existing admin destinations and sign-out behavior.

## Project context

- Admin authorization already lives in the protected route-group layout.
- `AdminNav` currently owns the admin links, responsive menu, and sign-out
  request with pending and error states.
- The admin destinations are Dashboard, Albums, Settings, Private links, and
  Messages. Album and message detail routes must keep their parent item active.
- The project uses Tailwind CSS 4, shadcn `new-york` configuration, `radix-ui`,
  `class-variance-authority`, `cn`, and `lucide-react`.
- `globals.css` defines ivory, charcoal, and warm line colors, plus serif
  headings and sans-serif body text.

## Reference block

The official `sidebar-08` `AppSidebar` already sets `variant="inset"` and
accepts `Sidebar` props. Its page composes `SidebarProvider`, `AppSidebar`,
`SidebarInset`, and `SidebarTrigger`. Pass `collapsible="icon"` to
`AppSidebar` where the protected admin layout renders it.

References:

- [sidebar-08 AppSidebar](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/blocks/sidebar-08/components/app-sidebar.tsx)
- [sidebar-08 page composition](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/blocks/sidebar-08/page.tsx)

## Composition and behavior

- Use the official `sidebar-08` structure and required sidebar primitives.
- Adapt its sample navigation to the five real admin routes. Do not keep demo
  routes, charts, project data, sample users, or sample avatars.
- Use relevant existing Lucide icons so destinations remain identifiable in
  icon mode. Provide tooltips and accessible names for icon-only links.
- Mark the current route active, including `/admin/albums/*` and
  `/admin/messages/*` detail pages.
- Keep the Elhaq Photography name in the sidebar header.
- Move the current admin name and sign-out control into the sidebar footer.
  Preserve sign-out pending, error, and redirect behavior.
- Keep login outside the protected sidebar shell.
- Place protected page content inside `SidebarInset`; retain existing page
  content and content width.
- Use the block's mobile sheet behavior and its existing reduced-motion-safe
  transitions. Desktop trigger toggles between full labels and icon mode.

## Visual direction

Design Read: photographer CMS admin, warm editorial utility UI. ENERGY 1,
RHYTHM 1, MOTION 1.

- Reuse the site's ivory, charcoal, and warm line colors. Add sidebar CSS
  variables by mapping them to existing tokens; do not introduce a new palette.
- Keep typography from the current design system. Sidebar's compact text serves
  navigation density; serif brand text preserves the existing editorial cue.
- Icons are functional labels for the collapsed state, not decoration. Each
  icon must map directly to its destination.
- Keep animation limited to the sidebar's necessary collapse and mobile-sheet
  transitions.

## Scope

Expected integration points: the official sidebar primitives and support
components, an admin sidebar component adapted from `sidebar-08`, the protected
admin layout, and sidebar color tokens in `globals.css`. Add only the support
primitives required by the block. Do not modify the public site or login page.

## Acceptance checks

1. Protected admin pages use inset sidebar; login remains outside it.
2. Dashboard, Albums, Settings, Private links, and Messages navigate to existing
   routes. Detail pages activate their parent item.
3. Desktop trigger collapses to icons and expands labels. Each icon-only item
   retains an accessible name and tooltip.
4. Mobile trigger opens the sidebar sheet; links remain usable and page has no
   horizontal overflow.
5. Admin name, sign-out pending state, sign-out error, and redirect continue to
   work. No fictional user or avatar appears.
6. Run tests, lint, TypeScript, and production build. Verify desktop and mobile
   behavior in a browser, including keyboard navigation and focus visibility.
7. Verify foreground, background, selected-item, border, and focus contrast.
