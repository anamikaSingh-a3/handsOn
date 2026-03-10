import express from 'express';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * GET /api/workers/blocking
 * Runs a CPU task directly on the main thread — BLOCKS the event loop.
 */
router.get('/blocking', (_req, res) => {
  const start = Date.now();
  // Fibonacci is exponentially expensive — much heavier than a simple counter
  function fib(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
  }
  const result = fib(45); // fib(45) takes several seconds on any machine
  res.json({
    result,
    durationMs: Date.now() - start,
    blocked: true,
  });
});

/**
 * GET /api/workers/info
 * Explains what worker threads are and when to use them.
 */
router.get('/info', (_req, res) => {
  res.json({
    what: 'Worker Threads run JavaScript in parallel threads inside the same process.',
    vsCluster:
      'Cluster forks separate processes (separate memory). ' +
      'Worker threads share memory with the main process — faster for data exchange.',
    useWhen: [
      'CPU-heavy computation (image processing, encryption, parsing)',
      'You want parallel work without the overhead of separate processes',
      'You need to share memory (SharedArrayBuffer) between threads',
    ],
    doNotUseFor: [
      'I/O tasks (file reads, DB queries) — the event loop already handles these efficiently',
      'Simple async work — Promises/async-await is enough',
    ],
    mainThreadPid: process.pid,
  });
});

/**
 * GET /api/workers/offload
 * Runs a heavy task in a Worker Thread — main thread stays FREE during execution.
 * Try hitting /api/cluster/block and /api/workers/offload at the same time to see the difference.
 */
router.get('/offload', (_req, res) => {
  const start = Date.now();
  const workerPath = join(__dirname, '../workers/heavyTask.js');

  const worker = new Worker(workerPath);

  // Worker sends result back via postMessage
  worker.on('message', (data) => {
    res.json({
      message: 'Heavy task completed in a Worker Thread',
      result: data.result,
      durationMs: Date.now() - start,
      mainThreadPid: process.pid,
      lesson:
        'While this ran, the main thread was NOT blocked. ' +
        'Other requests were handled normally during this computation.',
    });
  });

  worker.on('error', (err) => {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  });
});

/**
 * GET /api/workers/compare
 * Runs the same task BOTH on main thread and in a worker — shows the difference.
 */
router.get('/compare', (_req, res) => {
  const limit = 100_000_000;

  // Run on main thread (blocks)
  const mainStart = Date.now();
  let mainCount = 0;
  for (let i = 0; i < limit; i++) mainCount++;
  const mainDuration = Date.now() - mainStart;

  // Run in worker thread (non-blocking)
  const workerStart = Date.now();
  const workerPath = join(__dirname, '../workers/heavyTask.js');
  const worker = new Worker(workerPath, { workerData: { limit } });

  worker.on('message', (data) => {
    res.json({
      mainThread: {
        result: mainCount,
        durationMs: mainDuration,
        blocked: true,
      },
      workerThread: {
        result: data.result,
        durationMs: Date.now() - workerStart,
        blocked: false,
      },
    });
  });

  worker.on('error', (err) => {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  });
});

export default router;
