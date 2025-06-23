import { NextRequest } from "next/server";
import { Ollama } from "ollama";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

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

const runOcrScript = (imagePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "ocr.js");
    const child = spawn("node", [scriptPath, imagePath]);

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`OCR script exited with code ${code}: ${errorOutput}`);
        reject(new Error(`OCR process failed.`));
      } else {
        resolve(output);
      }
    });

    child.on("error", (err) => {
      console.error("Failed to start OCR script.", err);
      reject(err);
    });
  });
};

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
  const tempFilePath = path.join(os.tmpdir(), `ocr-temp-${Date.now()}-${file.name}`);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendJSON = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {
        await fs.writeFile(tempFilePath, imageBuffer);

        sendJSON({ status: "Reading recipe text..." });
        const text = await runOcrScript(tempFilePath);
        console.log("Extracted text:", text);
        
        sendJSON({ status: "Formatting recipe..." });
        const ollama = new Ollama();
        const response = await ollama.chat({
          model: "mistral:7b-instruct",
          messages: [{ role: "user", content: getPrompt(text) }],
          format: "json",
          stream: false,
        });

        let structuredData;
        try {
          structuredData = JSON.parse(response.message.content);
        } catch (jsonError) {
          console.log("Failed to parse JSON, attempting to repair...");
          const repairResponse = await ollama.chat({
            model: "mistral:7b-instruct", // Or a more powerful model if available
            messages: [
              {
                role: "user",
                content: `The following JSON is malformed. Please fix it and return only the corrected JSON object. Do not add any commentary.\n\n${response.message.content}`,
              },
            ],
            format: "json",
            stream: false,
          });
          structuredData = JSON.parse(repairResponse.message.content);
        }
        
        sendJSON({ status: "done", data: structuredData });
      } catch (error) {
        console.error("Error processing photo import:", error);
        sendJSON({ status: 'error', error: 'Failed to process the recipe.' });
      } finally {
        controller.close();
        // Clean up the temporary file
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error("Failed to clean up temporary file:", cleanupError);
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
} 