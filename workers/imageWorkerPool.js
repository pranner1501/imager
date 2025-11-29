// workers/imageWorkerPool.js
import { Worker } from 'worker_threads';
import os from 'os';
import path from "path";
import Image from "../models/Image.js";


const WORKER_COUNT = Math.max(1, os.cpus().length - 1);

class ImageWorkerPool {
  constructor() {
    this.workers = [];
    this.queue = [];

    for (let i = 0; i < WORKER_COUNT; i++) {
      this.addWorker();
    }
  }

  addWorker() {
    const worker = new Worker(
      new URL('./imageWorker.js', import.meta.url),
      { type: 'module' }       // important: ESM worker
    );

    worker.isBusy = false;
    worker.currentJob = null;

    worker.on('message', async (msg) => {
      if (worker.currentJob) {
        const { resolve, reject } = worker.currentJob;
        const completedFilePath = worker.currentJob.filePath;

        worker.currentJob = null;
        worker.isBusy = false;

        try {
          if (msg.status === 'ok') {
            const relativePath = completedFilePath.split("users")[1];
            const mongoPath = "/users" + relativePath.replace(/\\/g, "/");

            await Image.findOneAndUpdate(
              { path: mongoPath },
              { size: msg.newSize }
            );
            resolve(msg);
          } else if (msg.status === 'skipped') {
            resolve(msg);
          } else {
            reject(new Error(msg.error || "Worker error"));
          }
        } catch (err) {
          reject(err);
        }
      }
      this.runNext();
    });


    worker.on('error', (err) => {
      if (worker.currentJob) {
        worker.currentJob.reject(err);
        worker.currentJob = null;
      }
      worker.isBusy = false;
      this.runNext();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error('Worker exited with code', code);
      }
      worker.isBusy = false;
      this.runNext();
    });

    this.workers.push(worker);
  }

  runNext() {
    const idle = this.workers.find((w) => !w.isBusy);
    if (!idle) return;
    const job = this.queue.shift();
    if (!job) return;

    idle.isBusy = true;
    idle.currentJob = job;
    idle.postMessage({ filePath: job.filePath });
  }

  submit(filePath) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        filePath,
        resolve,
        reject,
      });
      this.runNext();
    });
  }
}

// singleton pool instance
const pool = new ImageWorkerPool();

// public helper
export function compressImage(filePath) {
  return pool.submit(filePath);
}
