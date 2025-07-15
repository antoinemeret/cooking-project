# Edit and Delete Recipe from Sheet View

## 1. Introduction/Overview
This feature enables users to edit and delete recipes directly from the sheet view in the application. The goal is to provide a seamless, in-context editing and deletion experience for recipes, improving user efficiency and satisfaction.

## 2. Goals
- Allow users to edit recipe details (title, ingredients, instructions) from the sheet view.
- Allow users to delete a recipe from the sheet view, with confirmation.
- Ensure the UI is intuitive, responsive, and uses shadcn UI components for consistency.

## 3. User Stories
- **User Story 1:** As a user, I want to be able to edit a recipe from the sheet view so that I can quickly update recipe details without leaving the context.
- **User Story 2:** As a user, I want to be able to delete a recipe from the sheet view so that I can remove recipes I no longer need.

## 4. Functional Requirements
1. The sheet view must display an "edit" button (with icon) at the top right of the sheet container, always visible.
2. Clicking the "edit" button enables edit mode:
    - The title, ingredients, and instructions fields become editable using shadcn input components with labels ([reference](https://ui.shadcn.com/docs/components/input)).
    - A "close" (X) icon button (from shadcn) appears in the same location as the edit button, allowing the user to exit edit mode and return to normal view.
    - A footer appears at the bottom of the sheet, always visible even if the content is scrollable. The footer contains a "Save" button (from shadcn).
3. When the user clicks "Save":
    - The UI updates optimistically to reflect the changes.
    - A toast notification (using shadcn Sonner, [reference](https://ui.shadcn.com/docs/components/sonner)) displays "Changes saved".
    - If saving fails, an alert (using shadcn Alert, [reference](https://ui.shadcn.com/docs/components/alert)) displays the error reason.
4. If the user tries to leave edit mode with unsaved changes, show a warning/confirmation dialog.
5. If a second user tries to edit the same recipe concurrently, show an alert (shadcn Alert) indicating the recipe is being edited by someone else.
6. The sheet view must display a "delete" button (with icon) at the top right, next to the edit button, always visible.
7. Clicking the "delete" button opens a confirmation dialog. If confirmed, the recipe is permanently deleted and the sheet closes.
8. All users can edit or delete any recipe. No authentication is required for these actions.

## 5. Non-Goals (Out of Scope)
- Editing tags, metadata, or other fields not specified above.
- Soft delete or undo functionality for deleted recipes.
- Authentication or permission checks.
- Validation of input fields (for now).
- Mobile-specific UI/UX (unless already supported by the sheet component).

## 6. Design Considerations
- Use shadcn UI components for all buttons, inputs, alerts, and toasts for visual consistency ([Button](https://ui.shadcn.com/docs/components/button), [Input](https://ui.shadcn.com/docs/components/input), [Alert](https://ui.shadcn.com/docs/components/alert), [Sonner](https://ui.shadcn.com/docs/components/sonner)).
- The edit and delete buttons should always be visible in the top right of the sheet.
- Edit mode should be inline (not a modal or separate page).
- The footer with the "Save" button must remain visible even when scrolling.

## 7. Technical Considerations
- Use shadcn Button with icon for edit, delete, and close actions.
- Use shadcn Input with label for editing fields.
- Use shadcn Sonner for success toasts and shadcn Alert for error/warning messages.
- Optimistic UI updates for save action.
- Handle concurrent editing by showing an alert if another user is editing the recipe.
- No authentication or user checks required.

## 8. Success Metrics
- Users can successfully edit and save recipe details from the sheet view.
- Users can delete a recipe and see the sheet close immediately.
- No metadata or system tags are shown in the tag list.
- All UI feedback (toasts, alerts) uses shadcn components.
- No errors or unexpected behavior during edit/delete flows.

## 9. Open Questions
- Should there be an undo option for deletion in the future?
- Should we add field validation or autosave in future iterations?
- How should we handle very large recipes (performance, scrolling)? 