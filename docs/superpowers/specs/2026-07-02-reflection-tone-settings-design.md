# Reflection Tone Settings Design

## Goal

Let the user tune the style of generated reflections before starting a reflection session.

For this first version, save the choice in `localStorage` only. This keeps the feature local to the current browser and avoids database changes.

## User Experience

The Settings popover gets a small "Reflection tone" control above the sign-out button.

The available tones are:

- `Default`
- `Gentler`
- `More direct`
- `More practical`
- `More curious`

`Default` keeps the current reflection behavior.

When the user picks a tone, the app saves it immediately. The next reflection session uses that tone. Existing reflection sessions do not change.

## Architecture

Add a shared tone type and helper functions in a small reflection tone module.

The module owns:

- Allowed tone values.
- The default tone.
- Validation for incoming tone values.
- The tone-specific prompt instruction text.

This keeps browser, API, and prompt code using the same vocabulary.

## Data Flow

`App.tsx` owns `reflectionTone` state.

On mount, it reads the saved value from `localStorage`. If the saved value is missing or invalid, it uses `Default`.

When the setting changes, it writes the new value to `localStorage`.

When starting a reflection, `App.tsx` sends this JSON body to `/api/reflections/session`:

```json
{ "tone": "gentler" }
```

The API validates the value and passes it through:

`route.ts` -> `createReflectionSession` -> `generateReflectionResponse` -> `buildReflectionInstructions`

The prompt builder keeps the existing base prompt and appends one tone instruction when the tone is not `Default`.

## Prompt Behavior

Tone instructions should be small steering notes, not separate prompt rewrites.

Examples:

- `Gentler`: soften challenges and add more reassurance.
- `More direct`: be clearer and less cushioning, while still caring.
- `More practical`: connect insights to concrete next steps.
- `More curious`: ask more open questions and explore possibilities.

The JSON response schema stays the same.

## Error Handling

If `localStorage` is unavailable, the app still works with `Default`.

If the API receives an invalid tone, it falls back to `Default` instead of failing the reflection.

## Testing

Use test-first implementation.

Tests should cover:

- Invalid tone values normalize to `Default`.
- Each non-default tone adds the expected instruction to reflection instructions.
- `generateReflectionResponse` sends tone-adjusted system instructions.
- The reflection session API accepts a valid tone body and defaults invalid or missing tone values.

If client-side tests are not already easy to add, verify the settings UI manually after server and prompt tests pass.
