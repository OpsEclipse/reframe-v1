# Archetype Analysis Design

Date: 2026-07-02

## Goal

Add a mocked archetype analysis result to the Reflect flow.

The screen should match Figma node `70:648` from the Reframe file. It shows three archetype cards. `SEEKER` starts selected.

## User Flow

The Reflect flow becomes:

1. User chooses Reflect.
2. User reviews the journal entry.
3. Existing reflection analysis plays.
4. New archetype result screen appears.
5. User continues to the reflection prompt.

## Scope

In scope:

- Add a new `ArchetypeAnalysisScreen` component.
- Use mock archetype data in the client.
- Match the Figma layout, colors, spacing, borders, and typography.
- Let the user click a card to select an archetype.
- Let the user continue with Enter or a button.
- Keep the app responsive for smaller screens.
- Add focused tests for data and flow wiring where practical.

Out of scope:

- Real archetype analysis.
- Database storage for archetype results.
- New backend API routes.
- New onboarding screens.

## Architecture

Add a new screen state in `src/app/App.tsx` named `archetypeAnalysis`.

The existing `handleAnalysisComplete` will move from `reflectionAnalysis` to `archetypeAnalysis`. A new handler will move from `archetypeAnalysis` to `reflectionPrompt`.

Create `src/app/components/ArchetypeAnalysisScreen.tsx`. The component owns selected-card state, because this first version is mocked and local.

Use a small typed data structure for archetypes:

- `id`
- `name`
- `description`
- `inspiredBy`
- `tags`
- `color`
- `selected`

This keeps the UI easy to connect to real analysis later.

## UI Behavior

The screen uses the same app shell and stage as the rest of the product.

Desktop target:

- Outer shell remains the existing warm page gradient.
- Inner stage remains dark with the same border and bottom inset shadow.
- Heading is centered near the top.
- Three cards sit in a row.
- The selected card has a brighter border and an outer tinted stroke.
- Unselected cards are dimmed but still clickable.
- Tags render as small outlined pills.

Responsive behavior:

- At narrow widths, cards stack vertically.
- Card text remains readable.
- The selected state remains obvious.
- The continue action stays reachable without overlapping content.

## Interactions

Clicking a card changes the selected archetype.

Pressing Enter continues to the reflection prompt.

The continue button appears below the cards. It should use the existing action button style so the screen feels native to the app.

## Data Flow

Mock archetype data lives in the component file for this pass.

No API calls are added.

Later, the mock data can be replaced with API data from the reflection session response without changing the user flow.

## Error Handling

There is no remote failure state in this mocked version.

If the selected archetype is missing for any reason, the first archetype becomes selected.

## Testing

Add or update tests to verify:

- The app includes the `archetypeAnalysis` screen in the Reflect flow.
- The archetype component includes the three expected archetypes.
- The selected archetype can be represented without relying on backend data.

Visual QA should compare the local screen against the Figma screenshot after implementation.
