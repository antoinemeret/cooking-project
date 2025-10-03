## Relevant Files

- `src/lib/assistant/state.ts` - Zustand store and state machine for assistant flow.
- `src/lib/assistant/types.ts` - Types and Zod schemas for constraints, API payloads.
- `src/lib/assistant/prompt.ts` - LLM prompt and JSON schema enforcement for parsing.
- `src/lib/assistant/recommendations.ts` - Recipe matching, ranking, pagination helpers.
- `src/components/assistant/VoiceRecordButton.tsx` - Voice recording UI with states.
- `src/components/assistant/ConstraintCard.tsx` - Displays and edits a single constraint.
- `src/components/assistant/ConstraintSection.tsx` - Groups constraints (general, per-meal).
- `src/components/assistant/RecipeCard.tsx` - Recipe item with preview/select actions.
- `src/components/assistant/RecipeSuggestionList.tsx` - Two-section suggestions with pagination.
- `src/app/assistant/page.tsx` - Entry screen(s) and navigation between steps.
- `src/app/api/voice/transcribe/route.ts` - Transcription endpoint (Whisper integration).
- `src/app/api/constraints/parse/route.ts` - LLM constraint parsing endpoint.
- `src/app/api/recipes/suggest/route.ts` - Suggestions endpoint with filters and ranking.
- `src/lib/analytics.ts` - Track key events and metrics for the assistant.
- `src/__tests__/assistant/state.test.ts` - Unit tests for state and reducers.
- `src/__tests__/assistant/parsing.test.ts` - Unit tests for Zod schemas and parsing.
- `src/__tests__/assistant/recommendations.test.ts` - Unit tests for ranking/pagination.
- `src/__tests__/integration/assistant-flow.test.ts` - Flow-level integration test.

### Notes

- Unit tests should typically live near the code or under `src/__tests__` as in this repo.
- Use `npx jest` to run tests; pass file paths to run specific tests.

## Tasks

- [x] 0.0 Create a new Git branch for this feature
  - [x] 0.1 Create branch `feature/ai-meal-planning-assistant`
  - [x] 0.2 Push branch to remote and set upstream
  - [x] 0.3 Enable PR draft template and link PRD in PR description

- [x] 1.0 Establish assistant state and navigation skeleton
  - [x] 1.1 Define assistant states (recording, interpreting, editing, suggesting, validating, done)
  - [x] 1.2 Implement Zustand store with typed selectors and actions
  - [x] 1.3 Persist constraints and selections across steps in memory
  - [x] 1.4 Create `src/app/assistant/page.tsx` with step-based UI shell
  - [x] 1.5 Add route guards to preserve state when navigating back/forward
  - [x] 1.6 Basic unit tests for state transitions

- [x] 2.0 Implement voice recording UI and transcription API
  - [x] 2.1 Build `VoiceRecordButton` with idle/recording/processing states
  - [x] 2.2 Capture audio (WebM/AAC 16kHz), enforce 60s max, real-time recording signal
  - [x] 2.3 Create API `POST /api/voice/transcribe` (Whisper), return { transcript, confidence }
  - [x] 2.4 Handle connectivity errors and retries (exponential backoff on client)
  - [x] 2.5 Wire result into state and proceed to interpretation step
  - [x] 2.6 Tests: component behavior, API handler (mock provider)

- [x] 3.0 Build constraint parsing pipeline and interpretation summary UI
  - [x] 3.1 Define Zod schemas for v1 constraints (mealCount, include/exclude, dishType, dietary, cuisine)
  - [x] 3.2 Create `POST /api/constraints/parse` using Claude with strict JSON output
  - [x] 3.3 Validate LLM JSON with Zod; on failure, return partial interpretation
  - [x] 3.4 Implement summary UI with highlighted extracted values and conflict flags
  - [x] 3.5 Mixed FR/EN behavior: show mixed when confidence high, else preferred UI language
  - [x] 3.6 Tests: schema validation, parsing fallback paths

- [ ] 4.0 Implement constraint editing (general and per-meal) with persistence
  - [ ] 4.1 Build `ConstraintSection` (general, Plat 1..N) with separators
  - [ ] 4.2 Build `ConstraintCard` supporting add/edit/delete for each constraint type
  - [ ] 4.3 Controls: chip inputs (ingredients), selects (dish type, dietary, cuisine), stepper (meal count)
  - [ ] 4.4 Persist edits to state; update suggestion steps when meal count changes
  - [ ] 4.5 Tests: add/edit/remove constraints; per-meal overrides

- [ ] 5.0 Implement recipe recommendations API and UI (two sections + pagination)
  - [ ] 5.1 Implement `POST /api/recipes/suggest` with SQL filters via Prisma
  - [ ] 5.2 Ranking by match %, tie-break by most recently cooked
  - [ ] 5.3 Return two sections: perfectMatches then partialMatches; paginate 8 initial, +5
  - [ ] 5.4 Build `RecipeSuggestionList` and `RecipeAssistantCard` with Eye and Calendar actions
  - [ ] 5.5 Handle empty/no-match state with guidance to relax constraints
  - [ ] 5.6 Tests: ranking, pagination, API behavior (mock DB)

- [ ] 6.0 Implement selection flow, drawer preview, final validation, and planning write
  - [ ] 6.1 Implement drawer preview (shadcn drawer) reusing recipe sheet layout
  - [ ] 6.2 Calendar action: add current meal and advance; last meal → validation
  - [ ] 6.3 Validation screen: list selections with remove (no regen)
  - [ ] 6.4 On confirm, write selections to Planning and clear assistant state
  - [ ] 6.5 Tests: selection sequence, state persistence, final write

- [ ] 7.0 Add loading/error states, analytics/metrics, and polish
  - [ ] 7.1 Loading indicators for transcription, parsing, and suggestions
  - [ ] 7.2 Error toasts for network/transcription/no-results; success toast on confirm
  - [ ] 7.3 Track metrics: interpretation accuracy sample tagging hooks, completion rate, time to completion
  - [ ] 7.4 Accessibility pass: aria labels, keyboard nav, screen reader announcements
  - [ ] 7.5 Mobile polish: bottom nav visibility except when drawer open; touch target checks
  - [ ] 7.6 Basic integration test covering the happy path


