## Relevant Files

-   `src/app/api/recipes/import-photo/route.ts` - New API route to handle image upload, OCR, and LLM processing.
-   `src/app/recipes/page.tsx` - The main recipes page where the "Import from Photo" button will be added.
-   `src/app/recipes/data-table.tsx` - Likely contains the existing import dialog and state management that will be reused.
-   `src/components/photo-import-button.tsx` - New client component to handle the file input, upload trigger, and status feedback.
-   `package.json` - To add new backend dependencies (`tesseract.js`, `ollama`).

### Notes

-   Remember to run `npm install` after adding new dependencies to `package.json`.
-   Ensure your local Ollama instance is running with the `mistral:7b-instruct` model pulled before testing the API endpoint.

## Tasks

-   [x] 1.0 Setup Backend Dependencies for OCR and LLM
    -   [x] 1.1 In `package.json`, add `tesseract.js` as a dependency for OCR.
    -   [x] 1.2 Add the `ollama` npm package as a dependency to communicate with the local LLM.
    -   [x] 1.3 Run `npm install` to install the new dependencies.

-   [x] 2.0 Create API Endpoint for Photo Import
    -   [x] 2.1 Create the new API route file: `src/app/api/recipes/import-photo/route.ts`.
    -   [x] 2.2 Implement the `POST` handler to accept `multipart/form-data`.
    -   [x] 2.3 Use `tesseract.js` within the handler to perform OCR on the uploaded image buffer and extract raw text.
    -   [x] 2.4 Craft a detailed prompt for the `mistral:7b-instruct` model, instructing it to return a JSON object containing `title`, `rawIngredients` (as an array of strings), and `instructions`, accounting for common recipe layouts.
    -   [x] 2.5 Use the `ollama` package to send the extracted text and prompt to the LLM.
    -   [x] 2.6 Parse the LLM's JSON response and return it from the API endpoint with a 200 status.

-   [x] 3.0 Develop Frontend UI for File Upload and Status Display
    -   [x] 3.1 Create a new client component file: `src/components/photo-import-button.tsx`.
    -   [x] 3.2 In this component, render a button and a hidden `input type="file"` restricted to `image/jpeg` and `image/png`.
    -   [x] 3.3 On file selection, use the `fetch` API to send the image to `/api/recipes/import-photo`.
    -   [x] 3.4 Implement a state management system (e.g., using `useState`) to track the upload and processing progress.
    -   [x] 3.5 Display multi-step status updates to the user (e.g., using toasts or a dedicated status component) for "Uploading," "Reading," and "Formatting."
    -   [x] 3.6 Add the new `<PhotoImportButton />` to `src/app/recipes/page.tsx`.

-   [x] 4.0 Integrate Photo Import Data with Existing Recipe Preview and Save Flow
    -   [x] 4.1 From `photo-import-button.tsx`, on successful API response, call the function that opens the existing recipe import dialog (this logic is likely in `data-table.tsx` or passed via props).
    -   [x] 4.2 Modify the state or props for the existing dialog to accept and pre-fill the form fields with the `title`, `rawIngredients`, and `instructions` from the photo import API.
    -   [x] 4.3 Verify that the existing "Save" button in the dialog correctly saves the new recipe to the database via Prisma.
    -   [x] 4.4 Confirm that the asynchronous follow-up jobs (`/generate-summary`, `/process-ingredients`) are triggered after saving the recipe, reusing the existing logic.

-   [x] 5.0 Implement Error Handling and Final Integrations
    -   [x] 5.1 In `photo-import-button.tsx`, add a `catch` block to the fetch call to handle API errors.
    -   [x] 5.2 Implement the "import this recipe manually" link to open the blank recipe creation dialog.
    -   [x] 5.3 Conduct an end-to-end test: upload a photo, see the loading states, preview the parsed data in the dialog, save it, and see it appear in the main recipe list. 