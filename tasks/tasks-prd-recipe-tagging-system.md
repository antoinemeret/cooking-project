## Relevant Files

- `src/components/ui/tag-input.tsx` - New reusable tag input component with dropdown suggestions and validation
- `src/components/ui/tag-input.test.tsx` - Unit tests for the tag input component
- `src/lib/tag-utils.ts` - Utility functions for tag normalization, validation, and frequency tracking
- `src/lib/tag-utils.test.ts` - Unit tests for tag utilities
- `src/app/api/tags/route.ts` - API endpoints for tag operations (suggestions, frequency tracking)
- `src/app/api/tags/route.test.ts` - Unit tests for tag API endpoints
- `src/app/api/recipes/[id]/route.ts` - API endpoint for updating individual recipe tags
- `src/app/api/recipes/import-video/route.ts` - Enhanced to include LLM auto-tagging (existing file)
- `src/app/api/recipes/import-photo/route.ts` - Enhanced to include LLM auto-tagging (existing file)
- `src/app/api/recipes/route.ts` - Enhanced to include tag filtering and creation (existing file)
- `src/app/recipes/[id]/page.tsx` - Enhanced to include tag editing in recipe sheet (existing file)
- `src/app/recipes/page.tsx` - Enhanced to include tag filtering functionality (existing file)
- `src/lib/ai-prompts.ts` - Enhanced with tag suggestion prompts (existing file)
- `src/lib/ai-client.ts` - Enhanced with tag suggestion methods (existing file)
- `scripts/backfill-recipe-tags.ts` - Script to backfill existing recipes with LLM-generated tags
- `prisma/schema.prisma` - Updated to add TagUsage model for per-user tag frequency tracking
- prisma/migrations/20250703101432_add_tag_usage_table/migration.sql: Migration for TagUsage table
- `src/app/recipes/data-table.tsx`: Integrated TagInput component into ValidateRecipeForm for manual and imported recipe creation

### Notes

- Unit tests should typically be placed alongside the code files they are testing
- Use `npx jest [optional/path/to/test/file]` to run tests
- The tag input component should be reusable across multiple forms and contexts
- LLM integration will require performance testing to compare different models

## Tasks

- [ ] 1.0 Create Core Tag Input Component and Backend Infrastructure
  - [x] 1.1 Create `src/lib/tag-utils.ts` with tag normalization, validation, and frequency tracking functions
  - [x] 1.2 Create `src/lib/tag-utils.test.ts` with comprehensive unit tests for tag utilities
  - [x] 1.3 Create `src/app/api/tags/route.ts` with GET endpoint for tag suggestions based on user input and frequency
  - [x] 1.4 Create `src/app/api/tags/route.test.ts` with API endpoint tests
  - [x] 1.5 Create `src/components/ui/tag-input.tsx` with Notion-style dropdown, autocomplete, and validation
  - [x] 1.6 Create `src/components/ui/tag-input.test.tsx` with component behavior and interaction tests
  - [x] 1.7 Add tag frequency tracking to Prisma schema if needed for user-specific suggestions
  - [x] 1.8 Test tag input component integration with existing forms

- [x] 2.0 Implement Manual Tag Management in Recipe Creation and Viewing
  - [x] 2.1 Add tag input field to manual recipe creation form
  - [x] 2.2 Integrate tag input component with recipe detail sheet for viewing and editing
  - [x] 2.3 Implement immediate tag saving when modified in recipe sheet component
  - [x] 2.4 Add tag display to recipe sheet component with proper styling
  - [x] 2.5 Handle tag validation and error states in all forms
  - [x] 2.6 Test manual tag management across all recipe interaction points
  - [x] 2.7 Ensure tag changes are properly persisted to database

- [ ] 3.0 Add LLM Auto-Tagging for Recipe Import Pipeline
  - [ ] 3.1 Add tag suggestion prompts to `src/lib/ai-prompts.ts` for recipe analysis
  - [ ] 3.2 Create tag suggestion method in `src/lib/ai-client.ts` with model comparison capability
  - [ ] 3.3 Integrate LLM tag suggestions into `src/app/api/recipes/import-video/route.ts`
  - [ ] 3.4 Integrate LLM tag suggestions into `src/app/api/recipes/import-photo/route.ts`
  - [ ] 3.5 Enhance import dialog to show suggested tags for user review and editing
  - [ ] 3.6 Implement tag review functionality (approve, reject, modify) in import flow
  - [ ] 3.7 Add performance testing script to compare Llama vs Mistral vs DeepSeek models
  - [ ] 3.8 Ensure suggested tags are not saved without user approval
  - [ ] 3.9 Test LLM integration with various recipe types and content

- [ ] 4.0 Implement Tag Filtering and Display Features
  - [ ] 4.1 Make tags clickable on recipe cards to trigger filtering
  - [ ] 4.2 Add tag filtering functionality to `src/app/recipes/page.tsx` recipe list
  - [ ] 4.3 Update recipe search/filter API to support tag-based filtering
  - [ ] 4.4 Enhance assistant chat to consider tags when providing recipe suggestions
  - [ ] 4.5 Add tag filter UI components to recipe list page
  - [ ] 4.6 Implement URL parameter handling for tag filters (using nuqs)
  - [ ] 4.7 Test tag filtering performance with large numbers of recipes
  - [ ] 4.8 Ensure consistent tag display styling across all components

- [ ] 5.0 Create Tag Migration and Performance Optimization
  - [ ] 5.1 Create `scripts/backfill-recipe-tags.ts` script to add tags to existing recipes using LLM
  - [ ] 5.2 Add database indexing for tags field to improve query performance
  - [ ] 5.3 Implement tag suggestion caching to reduce API calls
  - [ ] 5.4 Add performance monitoring for tag-related operations
  - [ ] 5.5 Test backfill script with sample data before production run
  - [ ] 5.6 Optimize tag frequency tracking queries
  - [ ] 5.7 Add error handling and recovery for tag operations
  - [ ] 5.8 Create documentation for tag system maintenance and troubleshooting 