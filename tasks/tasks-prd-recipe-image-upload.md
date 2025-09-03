## Relevant Files

- `prisma/schema.prisma` – Update Recipe model to support image metadata.
- `src/lib/prisma.ts` – Prisma client, update if needed for new fields.
- `src/app/api/recipes/route.ts` – Main API route for recipe CRUD, update for image support.
- `src/app/api/recipes/[id]/route.ts` – Recipe detail API, update for image retrieval/update.
- `src/app/api/recipes/import-photo/route.ts` – API for manual photo upload.
- `src/app/api/recipes/import-video/route.ts` – API for video thumbnail extraction.
- `src/app/api/recipes/upload-image/route.ts` – API for manual image upload.
- `src/components/chat/RecipeCard.tsx` – Recipe card UI, display image thumbnail.
- `src/app/recipes/data-table.tsx` – Main recipe table, support image display/edit.
- `src/app/recipes/[id]/page.tsx` – Recipe sheet view, display hero image.
- `src/app/recipes/page.tsx` – Recipe list page, display thumbnails.
- `src/app/planner/page.tsx` – Planner view, display recipe thumbnails.
- `src/app/assistant/page.tsx` – Assistant view, display recipe thumbnails.
- `src/components/ui/dialog.tsx` – Dialog component, for review and image selection.
- `public/` – Store placeholder image(s).
- `src/lib/utils.ts` – Utility functions for image processing/validation.
- `src/types/video-import.ts` – Update types for video thumbnail support.
- `src/app/api/recipes/import-photo/route.test.ts` – Unit tests for photo upload API.
- `src/app/api/recipes/import-video/route.test.ts` – Unit tests for video import API.
- `src/components/chat/RecipeCard.test.tsx` – Unit tests for recipe card image display.
- `src/app/recipes/data-table.test.tsx` – Unit tests for table image logic.
- `src/app/recipes/[id]/page.test.tsx` – Unit tests for hero image display.
- `src/app/recipes/page.test.tsx` – Unit tests for recipe list thumbnails.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Update Data Model and Storage
  - [x] 1.1 Add an image field (URL or metadata) to the `Recipe` model in `prisma/schema.prisma`.
  - [x] 1.2 Create and run a migration to update the database.
  - [x] 1.3 Decide on and set up an initial image storage solution (local filesystem or simple cloud storage).
  - [x] 1.4 Update Prisma client and types as needed.
- [x] 2.0 Implement Image Upload, Import, and Optimization Logic
  - [x] 2.1 Implement API endpoint for manual image upload (`import-photo`).
  - [x] 2.2 Implement API logic for extracting and saving video thumbnails.
  - [x] 2.3 Add image validation (JPEG, PNG, WebP, max 5MB).
  - [x] 2.4 Add image optimization (resize, compress, convert to WebP if possible).
  - [x] 2.5 Store image metadata or URL in the recipe record.
- [x] 3.0 Integrate Image Selection and Review in Recipe Import/Create/Edit Flows
  - [x] 3.1 Update import-from-URL flow to allow user to pick a frame or detected image.
  - [x] 3.2 Update import-from-video flow to use default platform thumbnail.
  - [x] 3.3 Update manual and edit flows to allow image upload, replacement, or removal.
  - [x] 3.4 Show the image (or placeholder) in the review dialog before saving.
  - [x] 3.5 Display a message in the review dialog if image import fails.
- [x] 4.0 Display Images in Recipe Sheet and Recipe Cards
  - [x] 4.1 Display the hero image (full width at the top of the recipe sheet on mobile / square image placed next a grouped title + actions on desktop).
  - [x] 4.2 Display a square thumbnail in recipe cards (assistant, planner, recipe list).
  - [x] 4.3 Use a visually appealing placeholder if no image is present.
  - [x] 4.4 Ensure images are responsive and accessible.
- [x] 5.0 Add Placeholders, Error Handling, and User Feedback
  - [x] 5.1 Add placeholder image(s) to `public/` and reference in UI.
  - [x] 5.2 Show user-friendly error messages for failed uploads or imports.
  - [x] 5.3 Add tests for all new logic and UI (API, components, error cases). 