// This file runs INSIDE the worker thread (separate thread, not main)
import { parentPort } from 'worker_threads';

// Same computation as the blocking route — fib(45) is exponentially expensive
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

const result = fib(45);

// Send result back to the main thread
if (parentPort) {
  parentPort.postMessage({ result });
}