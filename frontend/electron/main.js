const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// Replace built-in ffmpeg with full-codec version (H.264, H.265, AVI, etc.)
try {
  const ffmpeg = require("electron-ffmpeg");
  ffmpeg.install(app);
} catch (e) {
  // electron-ffmpeg not installed — codec support limited to Chromium defaults
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset", // native macOS traffic lights
    backgroundColor: "#0d0d0d",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,          // disables CORS & mixed-content checks
      allowRunningInsecureContent: true,
    },
    icon: path.join(__dirname, "../public/icon.png"),
  });

  // Remove default menu bar
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../build/index.html"));
  }
}

app.whenReady().then(() => {
  // Allow all media autoplay
  session.defaultSession.setPermissionRequestHandler((_, permission, cb) => {
    cb(true);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
