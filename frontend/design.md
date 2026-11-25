# Collective interface direction

Source: extracted from the legacy CSS and the ratified interface contract.

Character: calm, precise collective bookkeeping. Dark teal navigation anchors a light workspace with white panels, restrained serif page headings and clear tabular money.

## Build mandate

Preserve the legacy visual hierarchy without its Firebase or allocation logic. Use the tokens in `src/app/globals.css`. Shared pages show collective totals and individual contributions only. Forms explain external verification and server supplied attribution. Never imply that a preview submission saved a financial record.

## Composition and components

Desktop uses a fixed sidebar, context header, page introduction and content panels. Mobile uses a labeled dialog menu reaching every page. Authentication has a brand panel and focused labeled form. Tables scroll within their card; content must not overflow the viewport. Use shadcn Button and Base UI based dialog primitives, native labeled inputs and semantic tables.

## Responsive behavior

Start with one column. Add metric and form columns at medium widths. Sidebar appears at large widths. Minimum control height is 44px. Focus, dialogs, errors, loading and empty states are required. No external imagery, real roster assets or font services.

## Do and do not

Use exact decimal strings for display, explicit status text and subtle borders. Keep backend errors honest. No charts implying invented trends, no individual expense shares, no unconfirmed budgets, no fake sessions. Synthetic fixtures are only reachable through the server gated development preview.
