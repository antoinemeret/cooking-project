# Recipe Image Upload & Display PRD

## 1. Introduction/Overview
Photos are a key factor in recipe selection, helping users visualize what they are about to cook. This feature will allow each recipe to have a single associated image, which can be imported automatically, uploaded manually, reviewed before saving, edited, and displayed prominently throughout the app.

## 2. Goals
- Allow users to associate a single image (JPEG, PNG, or WebP, max 5MB) with each recipe.
- Support automatic image import from URLs and videos, with user review and selection.
- Enable manual image upload or replacement during recipe creation or editing.
- Display the image as a full-width hero on the recipe sheet and as a square thumbnail in recipe cards.
- Provide a placeholder image when no picture is available.
- Ensure image upload and display is scalable for hundreds of users.
- Optimize images for web delivery.

## 3. User Stories
- As a user, I want to automatically import the header picture when importing a recipe from a URL, and pick a frame if available.
- As a user, I want to automatically import the default thumbnail when importing from video (YouTube, Instagram, TikTok).
- As a user, I want to review the picture along with title, ingredients, and instructions in the dialog before saving the recipe, and see a message if image import fails.
- As a user, I want to manually add or replace a picture when importing from photo or creating manually.
- As a user, I want to see the picture as a full-width hero image at the top of the recipe sheet.
- As a user, I want to edit (upload/replace/remove) the picture when editing a recipe.
- As a user, I want to see a square thumbnail of the picture on recipe cards (assistant, planner).

## 4. Functional Requirements
1. The system must allow users to upload a JPEG, PNG, or WebP image (max 5MB) as a recipe picture.
2. The system must allow only one image per recipe.
3. When importing from a URL, the system must allow the user to pick a frame from detected images.
4. When importing from video, the system must use the default platform thumbnail (YouTube, Instagram, TikTok).
5. The system must display the image (or a placeholder if missing) in the recipe review dialog before saving.
6. The system must allow users to upload, replace, or remove the image during recipe creation or editing.
7. The system must display the image as a full-width hero at the top of the recipe sheet.
8. The system must display a square thumbnail of the image on recipe cards in the assistant and planner views.
9. The system must show a message in the review dialog if image import fails.
10. The system must optimize images for web (compression, resizing) on upload.
11. The system must use a storage solution that is easy to set up but can scale to hundreds of users (e.g., local filesystem or simple cloud storage).

## 5. Non-Goals (Out of Scope)
- Multiple images per recipe.
- Image cropping, rotation, or advanced editing in the UI.
- Moderation or approval workflows for uploaded images.
- Support for image formats other than JPEG, PNG, or WebP.

## 6. Design Considerations
- Hero image should always be full width, responsive to screen size.
- Thumbnails should be square and consistent in size across cards.
- Use a visually appealing placeholder when no image is present.
- Follow existing UI style and accessibility guidelines.

## 7. Technical Considerations
- Use a simple, scalable storage solution (e.g., local filesystem for MVP, with abstraction for easy migration to S3 or similar if needed).
- Optimize images on upload (resize, compress, convert to WebP if possible).
- Ensure upload and retrieval are performant for hundreds of users.
- Use best practices for file validation and security.

## 8. Success Metrics
- >90% of new recipes have an image associated within 1 month of launch.
- No user reports of upload failures for supported formats/sizes.
- Images load quickly (<1s) on recipe sheets and cards.
- No storage or performance issues with hundreds of users.

## 9. Open Questions
- Which storage solution should be used for MVP: local filesystem or a simple cloud bucket?
- Should we provide basic image editing (crop/rotate) in the future?
- Should we allow users to re-order or re-capture images from video imports? 