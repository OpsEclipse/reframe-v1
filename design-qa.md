# Design QA

Reference: Figma node `70:648`.

## Checks

- Dark stage and warm outer shell: blocked
- Heading alignment and copy: blocked
- Card order: blocked
- Initial selected archetype: blocked
- Muted unselected cards: blocked
- Tag styling: blocked
- Mobile stacking: blocked
- Card click selection: blocked
- Enter-to-continue: blocked

## Blocker

Local visual QA is blocked because the dev server returns `500` before the app renders.

Observed local error:

```text
Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.
```

The app cannot reach the authenticated flow without those Supabase environment values.

final result: blocked
