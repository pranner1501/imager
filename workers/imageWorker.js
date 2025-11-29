// workers/imageWorker.js
import { parentPort } from 'worker_threads';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';


const __root = process.cwd();

parentPort.on('message', async (job) => {
  const { filePath } = job;

  try {
    const ext = path.extname(filePath).toLowerCase();
    let pipeline = sharp(filePath);

    // Keep SAME format, just recompress
    if (ext === '.jpg' || ext === '.jpeg') {
      pipeline = pipeline.jpeg({ quality: 70 }); // adjust quality if you like
    } else if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality: 70 });
    } else {
      // unsupported → just skip
      parentPort.postMessage({
        status: 'skipped',
        filePath,
        reason: 'Unsupported format',
      });
      return;
    }
    // Write to temp file then replace original
    const tmpPath = filePath + '.tmp';
    await pipeline.toFile(tmpPath);
    await fs.rename(tmpPath, filePath);
     const filename = path.basename(filePath);
      console.log(`Worker processing: ${filename}`);
      const newImageSize = (await fs.stat(filePath)).size;
      console.log(`Recompressed ${filename}: ${newImageSize} bytes`);
   

    parentPort.postMessage({ status: 'ok', filePath, newSize: newImageSize });
  } catch (err) {
    parentPort.postMessage({
      status: 'error',
      filePath,
      error: err.message,
    });
  }
});
