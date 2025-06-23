# PRD: Import Recipe from Photo

## 1. Introduction/Overview

This document outlines the requirements for a feature that enables users to upload a photo of a printed or handwritten recipe and automatically extract a structured digital version. The goal is to assist users in quickly digitizing physical recipes from sources like cookbooks, notes, or magazine clippings into their personal recipe database, reducing manual data entry.

## 2. Goals

-   Allow users to upload a photo file (JPG, PNG).
-   Use Optical Character Recognition (OCR) to extract raw text from the uploaded image.
-   Use a local LLM (via Ollama) to parse the raw text and generate a structured recipe in JSON format (`title`, `rawIngredients`, `instructions`).
-   Display a preview of the structured recipe for user confirmation and editing.
-   Allow users to save the final recipe to their personal collection in the database.

## 3. User Stories

**As a user,** I want to upload a photo of a recipe, **so that** I can quickly import it into my digital recipe collection without having to type it all out manually.

## 4. Functional Requirements

1.  **File Upload:**
    -   The system must provide a UI with a file input that allows users to select a single image file for upload.
    -   The file input must be restricted to `image/jpeg` and `image/png` formats on the client-side. If the user selects an unsupported file type, a clear error message must be displayed immediately.

2.  **Processing Feedback:**
    -   During processing, the UI must display a multi-step indicator to communicate the current status to the user.
    -   The indicator should show distinct stages, such as:
        1.  "Uploading image..."
        2.  "Reading recipe text..." (OCR)
        3.  "Formatting recipe..." (LLM)

3.  **Backend Processing (`/api/import-photo`):**
    -   An API endpoint must be created at `/api/import-photo` that accepts `multipart/form-data`.
    -   The endpoint will use an OCR engine (Tesseract.js) to extract raw text from the image.
    -   The extracted text will be passed to a local LLM (Ollama, using the `mistral:7b-instruct` model).
    -   The prompt sent to the LLM should instruct it to parse the text and return a JSON object. The prompt should be optimized to handle common recipe layouts, such as a title at the top and two columns for ingredients and instructions.
    -   The expected JSON output is: `{ "title": "string", "rawIngredients": "string[]", "instructions": "string" }`.

4.  **Recipe Preview and Editing:**
    -   After successful parsing, the UI will display the data in an editable form using the current dialog used when importing recipes from url.
    -   The form must contain fields for "Title," "Ingredients," and "Instructions," pre-filled with the data from the LLM.
    -   The user must be able to modify the content in any of these fields before saving.

5.  **Saving and Redirection:**
    -   A "Save" button will submit the final, potentially edited, recipe data.
    -   On successful save to the database via Prisma, the user will be redirected to the main recipe list page (`/recipes`).

6. **Follow up**
    - Like when importing a recipe from url or manually, the routes /generate-summary and /process-ingredients must be triggered asynchronuously 

7.  **Error Handling:**
    -   If the OCR or LLM process fails to produce a usable result, the system must display a user-friendly error message: "Could not read recipe. Please try a clearer photo, or <a>import this recipe manually</a>".
    -   The "import this recipe manually" text should be a link that open the dialog made for this.

## 5. Non-Goals (Out of Scope)

-   Processing multiple images for a single recipe in this version.
-   Directly capturing a photo using a device's camera. This is a future consideration.
-   Advanced image editing tools (e.g., crop, rotate, enhance contrast).
-   Handling recipes with highly complex or non-standard layouts that deviate significantly from a title/column structure.

## 6. Design Considerations

-   The file upload interface should be clean and simple, matching the application's existing design system and using shadcn components
-   Loading indicators must be prominent to provide clear feedback and prevent duplicate submissions.
-   The recipe preview form should use existing dialog 

## 7. Technical Considerations

-   **Frontend:** Build with a standard `input type="file"` element, using its `accept` attribute for client-side file type validation.
-   **OCR Engine:** Use Tesseract.js on the server-side within the Node.js environment.
-   **LLM:** Integrate with a local Ollama instance running the `mistral:7b-instruct` model.
-   **Layout Assumption:** The system should be designed with the assumption that recipes are often single-page with a two-column layout. The LLM prompt should reflect this.
-   **Future-Proofing:** While camera input is out of scope for now, the overall architecture should not preclude adding it in the future.

## 8. Success Metrics

-   Number of recipes successfully imported using this feature.
-   The success rate of the import process (i.e., percentage of uploads that result in a saved recipe without error).
-   User adoption of the feature.

## 9. Open Questions

-   Where should the "import this recipe manually" link navigate? Should it go to a new blank recipe form page? -> yes