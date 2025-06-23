import { NextRequest } from "next/server";
import { createWorker } from "tesseract.js";
import { Ollama } from "ollama";

const getPrompt = (text: string) => `
You are an expert recipe parser. Your task is to analyze the following text, which was extracted from a recipe photo via OCR, and convert it into a structured JSON object.

The text might be messy and contain formatting errors from the OCR process. Do your best to interpret it.

Follow these rules:
1.  Identify the recipe's title. It's usually at the top and in a larger font.
2.  Identify the list of ingredients. They are often in a list or a column. Return them as an array of strings in the 'rawIngredients' field.
3.  Identify the preparation instructions. This is typically the main body of text. Return it as a single string in the 'instructions' field.
4.  The output MUST be a valid JSON object. Do not include any text, notes, or explanations outside of the JSON object itself.

Here is an example of the expected output format:
{
  "title": "Example Title",
  "rawIngredients": [
    "1 cup flour",
    "2 eggs",
    "1/2 tsp salt"
  ],
  "instructions": "Step 1: Mix all ingredients. Step 2: Bake at 350°F for 30 minutes."
}

Here is the OCR text to parse:
---
${text}
---
`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return new Response(JSON.stringify({ error: "No file uploaded." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer());

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (data: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(data)));

      try {
        enqueue({ status: "Reading recipe text..." });
        const worker = await createWorker("eng+fra");
        const {
          data: { text },
        } = await worker.recognize(imageBuffer);
        await worker.terminate();

        enqueue({ status: "Formatting recipe..." });
        const ollama = new Ollama();
        const response = await ollama.chat({
          model: "mistral:7b-instruct",
          messages: [{ role: "user", content: getPrompt(text) }],
          format: "json",
        });

        const structuredData = JSON.parse(response.message.content);
        enqueue({ status: "done", data: structuredData });
      } catch (error) {
        console.error("An error occurred during import:", error);
        enqueue({ status: "error", error: "Failed to process the recipe." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
} 