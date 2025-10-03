## Introduction / Overview

This document specifies the AI‑Powered Meal Planning Assistant. The feature replaces the existing free‑form conversational agent with a structured, voice‑first assistant that helps users select recipes from their own collection based on spoken constraints. The assistant is optimized for mobile web while supporting desktop, enables quick constraint capture via voice with clear validation and editing, and guides the user through sequential recipe selection per meal until final confirmation.

### Goals
- Enable meal planning completion in under 2 minutes for typical scenarios
- Correctly interpret ≥80% of voice constraints (French‑first, English fallback)
- Allow editing/adding/removing constraints without restarting the flow
- Provide predictable, low‑friction navigation using a state‑driven UI


## User Stories

### Epic 1: Voice Input
- As a user, I want to record my meal planning constraints by voice so I don't have to type.
- As a user, I want a real‑time recording signal so I know the system is listening.
- As a user, I want to retry recording if I make a mistake.

### Epic 2: Constraint Management
- As a user, I want to see a clear summary of what the system understood from my voice input.
- As a user, I want to edit individual constraints without re‑recording.
- As a user, I want to add constraints that I forgot to mention in my voice input.
- As a user, I want to manage general constraints and per‑meal constraints (unique per meal).

### Epic 3: Recipe Discovery
- As a user, I want to see recipes that match all my constraints first.
- As a user, I want to also see partial matches if there aren't enough perfect matches.
- As a user, I want to preview a recipe before selecting it.
- As a user, I want to load more suggestions beyond the initial set.

### Epic 4: Selection & Validation
- As a user, I want to select one recipe per meal in sequence.
- As a user, I want to review all my selections before adding them to my planning.
- As a user, I want to modify my selections or constraints before final validation.
- As a user, I want to see how many meals I've selected out of the total.


## Functional Requirements

### 1. Entry Points & Navigation
1.1 The assistant is accessible from the Planning page via: (a) header "+" button and (b) empty‑state button "Dicter ma consigne".
1.2 The flow is linear with well‑defined steps: Voice Recording → Interpretation → Constraint Editing → Suggestions (per meal) → Final Validation → Confirmation.
1.3 Navigation must preserve state when moving backward and forward.

### 2. Voice Recording & Transcription
2.1 Support French and English voice input; UI defaults to French with English fallback.
2.2 Provide a real‑time recording signal (visual indicator) during capture; full streaming transcript is not required for v1.
2.3 Maximum recording duration: 60 seconds; active internet required.
2.4 Show loading state during transcription (target 2–5s). If connection is lost, display an error and allow retry.

### 3. Constraint Interpretation
3.1 Extract at least these constraint types for v1: number of meals, include ingredients, exclude ingredients, dish type, dietary restrictions, cuisine style. (Other types may be parsed but are non‑blocking.)
3.2 Display a natural‑language summary with extracted values highlighted (numbers, ingredients, dish types, etc.). Default to the user’s preferred language for display (French by default).
3.3 Detect conflicts (e.g., vegetarian with chicken) and flag them for user review in edit mode.
3.4 If the user speaks mixed French/English, show a mixed‑language summary when extraction confidence is high; otherwise fall back to preferred UI language.

### 4. Constraint Editing
4.1 All interpreted constraints must be editable; users can add new constraints not mentioned in the voice input.
4.2 Support unique per‑meal constraints by default, in addition to general (global) constraints.
4.3 Changes persist across navigation; modifying the number of meals updates the count of suggestion steps.
4.4 Provide controls appropriate to each constraint type (e.g., chip lists for ingredients, toggles, selects, etc.).

### 5. Recipe Recommendation
5.1 Rank recipes by constraint match percentage; tie‑break using “most recently cooked” when available.
5.2 Show two sections per meal: (A) matches all constraints; (B) matches most constraints.
5.3 If perfect matches < 4, fill partial‑matches to show 8 recipes total initially.
5.4 Initial display: 8 recipes; “Afficher 5 recettes de plus” loads 5 more.
5.5 If no recipes match, display: “Aucune recette ne correspond à vos consignes. Essayez de modifier vos critères.”
5.6 Show loading during recommendation generation (target 3–7s) with progressive feedback.

### 6. Recipe Selection & Drawer
6.1 Recipe cards include: image thumbnail, name, prep/cook time, servings, “eye” (drawer preview), and calendar (select and advance) icons.
6.2 Clicking calendar adds the recipe to the current meal and advances to the next meal, or to Final Validation on the last meal.
6.3 The drawer uses `shadcn/ui` bottom sheet behavior; it must not block navigation or lose selection state.
6.4 Bottom navigation remains visible throughout, except while the drawer is open for focus.

### 7. Final Validation & Confirmation
7.1 Display all selected recipes (compact list with thumbnails); allow removing an item.
7.2 “Modifier consignes” returns to Constraint Editing while preserving selections.
7.3 Removing from validation does not regenerate suggestions; it only removes the item.
7.4 “Valider” adds all selections to the planning and exits the assistant.


## Non‑Goals (Out of Scope)
- Voice feedback (text‑to‑speech)
- Multi‑user collaborative planning
- Nutritional analysis or budgeting
- Wake‑word hands‑free mode
- Automatic substitution suggestions after removal (v1 TBD)


## Design Considerations

### Principles
- Clarity over abundance: initially show 8 recipes with progressive disclosure
- Inform without imposing: separate perfect from partial matches
- Living unity: consistent animations and smooth transitions

### Interaction States
- Buttons have hover, active, disabled states
- Loading states for transcription, interpretation, and recommendations
- Error states for network failure, no recipes found, and transcription failure
- Success feedback on final validation (e.g., toast)

### Mobile‑First
- Optimize for 375–428 px widths; touch targets ≥44×44 pt
- Bottom navigation always visible except when the drawer is open
- Use `shadcn/ui` drawer for bottom‑sheet UX
- Use `lucide-react` for iconography


## Technical Considerations

### Voice Processing
- Provider: OpenAI Whisper (or equivalent)
- Send audio in chunks when possible to reduce latency (light streaming acceptable)
- Audio format: WebM or AAC, 16 kHz; max size 5 MB

### Constraint Parsing
- Use LLM (Claude) to extract structured constraints from the transcript
- Enforce a strict JSON schema in the prompt; validate with Zod; fall back to partial interpretation on errors

### Recommendation & Data
- Data source: Postgres via Prisma
- Implement SQL filters matching the supported constraints for v1
- Cache recommendation results per constraint set; paginate (8 initial, +5 on demand)
- Assume ≤1k recipes per user for performance targets; optimize queries accordingly
- Current attributes are partially available; plan to add missing fields iteratively

### State & App Architecture
- Use Zustand for state management (aligns with repo conventions) and a simple state‑machine model for navigation
- Persist constraints and selections across steps; clear all state after final validation or when closing the flow
- Progressive loading is acceptable over strict SLOs (best‑effort: Whisper ≤5s, LLM ≤3s, recos ≤7s)

### APIs (Proposed)
- POST /voice/transcribe → { transcript, confidence }
- POST /constraints/parse → { constraints, conflicts[] }
- POST /recipes/suggest → { perfectMatches[], partialMatches[], hasMore }
- Implement retry with exponential backoff for transcription and LLM endpoints


## Acceptance Criteria
1. Users can initiate the assistant from the Planning page via two entry points.
2. Recording UI shows a clear real‑time recording signal and enforces 60s max duration.
3. The system extracts and highlights at least the v1 constraint set and flags conflicts.
4. Users can edit general and per‑meal constraints and add/remove any constraint.
5. Suggestions per meal show 2 sections, with 8 results initially and +5 on demand.
6. Selecting via the calendar icon adds to the current meal and advances the flow; the drawer preview does not lose state.
7. Final validation shows all selections, supports removal, and “Valider” updates the planning.
8. State persists across navigation; closing the flow clears assistant state.


## Success Metrics (v1 Dashboard Priorities)
- Constraint interpretation accuracy on a human‑labeled sample
- Secondary: track completion rate, time to completion, adoption rate as supporting metrics


## Open Questions
1. Mixed‑language display fallback thresholds: what confidence threshold triggers mixed vs. single‑language summaries?
2. Empty recipe collection handling: redirect to import, show demo suggestions, or offer a choice?
3. Additional tie‑breakers (e.g., rating, shortest time) and their weights for later iterations.
4. Which missing recipe attributes should be prioritized for the next data model update?
5. Should we store and surface past constraint sets for quick reuse?


## Dependencies
- Speech‑to‑text provider (Whisper)
- LLM provider (Claude) for constraint extraction
- Recipe database with filterable attributes and images (thumbnail CDN)
- `shadcn/ui` drawer and `lucide-react` icons


## Suggested Implementation Order
1) State + navigation between screens (mocked data)
2) Recording + transcription + recording indicator
3) LLM parsing + constraint editing (general + per‑meal)
4) Suggestion algorithm + recipe display (two sections, pagination)
5) Selection flow + final validation
6) Polish, errors, tests, analytics


