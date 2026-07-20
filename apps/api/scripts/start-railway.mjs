import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const children = new Map();
let shuttingDown = false;
const appDirectory = fileURLToPath(new URL("..", import.meta.url));

function startProcess(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: appDirectory,
    env: process.env,
    stdio: "inherit"
  });

  children.set(name, child);

  child.on("error", (error) => {
    console.error(`[${name}] failed to start`, error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(name);
    if (shuttingDown) return;

    const exitCode = code ?? (signal ? 1 : 0);
    console.error(`[${name}] exited`, { code, signal });
    shutdown(exitCode);
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const [name, child] of children.entries()) {
    if (!child.killed) {
      console.log(`[${name}] stopping`);
      child.kill("SIGTERM");
    }
  }

  const forceKillTimer = setTimeout(() => {
    for (const [name, child] of children.entries()) {
      if (!child.killed) {
        console.warn(`[${name}] force stopping`);
        child.kill("SIGKILL");
      }
    }
  }, 10_000);

  const exitWhenDone = setInterval(() => {
    if (children.size === 0) {
      clearTimeout(forceKillTimer);
      clearInterval(exitWhenDone);
      process.exit(exitCode);
    }
  }, 100);
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

startProcess("api", ["dist/main.js"]);
startProcess("worker", ["dist/worker.js"]);
