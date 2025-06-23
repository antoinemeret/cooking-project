const { createWorker } = require('tesseract.js');
const fs = require('fs').promises;

(async () => {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Error: No image path provided.');
    process.exit(1);
  }

  try {
    await fs.access(imagePath);

    const worker = await createWorker('eng+fra');
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();
    
    // Send the extracted text to stdout so the parent process can capture it
    process.stdout.write(text);
  } catch (error) {
    console.error('Error during OCR process:', error);
    process.exit(1);
  }
})(); 