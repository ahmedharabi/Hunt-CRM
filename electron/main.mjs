/**
 * Desktop shell: boots the production Next server on a free local port and
 * shows it in a native window. The server runs on the system Node (not
 * Electron's), so better-sqlite3 keeps the ABI it was installed for and the
 * data stays in ./data like every other way of running Hunt.
 */
import { app, BrowserWindow, dialog, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ICON = path.join(ROOT, "public", "icon-512.png");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
// Launchers started from the desktop don't inherit nvm's PATH, so the
// installer bakes the absolute node path into HUNT_NODE.
const NODE = process.env.HUNT_NODE || "node";

app.setName("Hunt");

let server = null;
let win = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(start);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (!server || server.exitCode !== null) return reject(new Error("The server exited during startup."));
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("The server didn't start in time."));
        else setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}

function fail(message, logPath) {
  dialog.showErrorBox("Hunt couldn't start", `${message}\n\nServer log: ${logPath}`);
  app.quit();
}

async function start() {
  const logPath = path.join(app.getPath("userData"), "server.log");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const log = fs.openSync(logPath, "w");

  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    return fail("No production build found. Run `npm run desktop:install` (or `npm run build`) in the project first.", logPath);
  }

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,
    minHeight: 500,
    title: "Hunt",
    icon: ICON,
    backgroundColor: "#141417",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => (win = null));
  // Paint the window at once so the launch feels instant while Next boots.
  win.loadURL("data:text/html,<html style='background:%23141417'></html>");

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;

  server = spawn(NODE, [NEXT_BIN, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", log, log],
  });
  server.on("error", (err) => fail(`Couldn't run Node (${NODE}): ${err.message}`, logPath));
  server.on("exit", (code) => {
    if (!quitting) fail(`The server stopped unexpectedly (exit code ${code}).`, logPath);
  });

  try {
    await waitForServer(origin, 60_000);
  } catch (err) {
    return fail(err.message, logPath);
  }
  if (!win) return;

  // Keep the app in its window; everything else (mailto, LinkedIn, job
  // postings) goes to the default browser or mail client.
  const isInternal = (url) => url.startsWith(origin + "/") || url === origin;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isInternal(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  win.loadURL(origin);
}

function stopServer() {
  quitting = true;
  if (server && server.exitCode === null) server.kill("SIGTERM");
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", stopServer);
process.on("exit", stopServer);
