## Relevant Files

- `src/app/recipes/data-table.tsx`  
  Main data table for recipes; likely entry point for opening the sheet view and triggering edit/delete actions.
- `src/app/recipes/data-table.test.tsx`  
  Unit tests for the data table and sheet integration.
- `src/app/recipes/[id]/page.tsx`  
  Dynamic recipe page; may contain or launch the sheet view for a single recipe.
- `src/components/ui/sheet.tsx`  
  Sheet UI component; will be extended to support edit/delete controls and inline editing.
- `src/components/ui/button.tsx`  
  shadcn Button component, used for edit, delete, close, and save actions.
- `src/components/ui/input.tsx`  
  shadcn Input component, used for editing fields.
- `src/app/api/recipes/route.ts`  
  API route for updating and deleting recipes.
- `src/app/api/recipes/route.test.ts`  
  Unit tests for recipe update/delete API.
- `src/components/ui/alert.tsx`  
  shadcn Alert component, used for error and warning messages.
- `src/components/ui/sonner.tsx`  
  shadcn Sonner component, used for success toasts.
- `src/lib/prisma.ts`  
  Prisma client for database operations.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [ ] 1.0 Add Edit and Delete Controls to Sheet View
  - [x] 1.1 Add an always-visible "edit" button (with icon) to the top right of the sheet container.
  - [x] 1.2 Add an always-visible "delete" button (with icon) next to the edit button.
  - [x] 1.3 Ensure both buttons use shadcn Button with icon.
  - [x] 1.4 Add unit tests to verify the presence and correct placement of these controls.

- [ ] 2.0 Implement Inline Edit Mode for Recipe Fields
  - [x] 2.1 Toggle edit mode and render editable fields
  - [x] 2.2 Replace edit button with close (X) in edit mode
  - [x] 2.3 Make close button sticky in edit mode
  - [x] 2.4 Auto-focus the title input when entering edit mode
  - [x] 2.5 Auto-select the title text when entering edit mode
  - [x] 2.6 Remove duplicate/irrelevant titles and controls in edit mode, add full-width Save button in footer
  - [ ] 2.7 Add a persistent footer to the sheet with a "Save" button (shadcn), always visible even when scrolling.
  - [x] 2.4 Add logic to track unsaved changes and block navigation/exit with a warning dialog if there are unsaved edits.
  - [ ] 2.5 Add unit tests for entering/exiting edit mode, editing fields, and footer visibility.

- [ ] 3.0 Implement Save, Optimistic UI, and Feedback Mechanisms
  - [ ] 3.1 On "Save", optimistically update the UI with the new recipe data.
  - [ ] 3.2 Send a PATCH/PUT request to the API to persist changes.
  - [ ] 3.3 On success, show a "Changes saved" toast using shadcn Sonner.
  - [ ] 3.4 On failure, show an error alert using shadcn Alert with the reason.
  - [ ] 3.5 Add unit tests for optimistic updates, toast/alert feedback, and error handling.

- [ ] 4.0 Implement Delete Flow with Confirmation Dialog
  - [ ] 4.1 On "delete" click, open a confirmation dialog.
  - [ ] 4.2 If confirmed, send a DELETE request to the API and close the sheet on success.
  - [ ] 4.3 Ensure deletion is permanent (no undo/soft delete).
  - [ ] 4.4 Add unit tests for the delete flow, dialog, and sheet closing behavior.

- [ ] 5.0 Handle Edge Cases: Unsaved Changes, Concurrent Editing, and Error Alerts
  - [ ] 5.1 Show a warning/confirmation dialog if the user tries to leave edit mode with unsaved changes.
  - [ ] 5.2 If a second user tries to edit the same recipe, show an alert (shadcn Alert) indicating the recipe is being edited by someone else.
  - [ ] 5.3 Ensure no metadata or system tags are shown in the tag list.
  - [ ] 5.4 Add unit tests for all edge cases and error alerts. 