const { app, BrowserWindow, dialog, ipcMain, net, protocol, screen, session } = require('electron');
const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mixdeck',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

const audioFiles = new Map();
const audioIdsByPath = new Map();
let mainWindow;
let audioLibraryPath;
let stemModelPath;
let stemModelDownloadPromise;
const stemModelSize = 180534758;
const stemModelSha256 = 'e5e425c17683f163a472462eb5f5a4ffcd11c31858d57fbd0833b012d8b88077';
const stemModelUrl = 'https://huggingface.co/timcsy/demucs-web-onnx/resolve/92e33df61cfc9eb820272aaa62d2ef6dcf4d950d/htdemucs_embedded.onnx';

const assetTypes = {
  '/index.html': 'text/html; charset=utf-8',
  '/styles.css': 'text/css; charset=utf-8',
  '/renderer.js': 'text/javascript; charset=utf-8',
  '/stem-engine.js': 'text/javascript; charset=utf-8'
};
const audioExtensions = new Set(['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.opus', '.wav', '.wma']);

function isolatedHeaders(headers = {}) {
  return {
    ...headers,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}

async function serveLocalFile(request, filePath, contentType) {
  const { size } = await fs.stat(filePath);
  let start = 0;
  let end = size - 1;
  let status = 200;
  const headers = {
    'Accept-Ranges': 'bytes',
    'Content-Type': contentType,
    'Content-Length': String(size)
  };
  const range = request.headers.get('range');

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || size === 0) {
      return new Response(null, { status: 416, headers: isolatedHeaders({ 'Content-Range': `bytes */${size}` }) });
    }
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
    } else {
      const suffixLength = Number(match[2]);
      start = Math.max(0, size - suffixLength);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) {
      return new Response(null, { status: 416, headers: isolatedHeaders({ 'Content-Range': `bytes */${size}` }) });
    }
    end = Math.min(end, size - 1);
    status = 206;
    headers['Content-Length'] = String(end - start + 1);
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }

  const body = size === 0 ? null : Readable.toWeb(createReadStream(filePath, { start, end }));
  return new Response(body, { status, headers: isolatedHeaders(headers) });
}

function audioContentType(filePath) {
  const types = {
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.wav': 'audio/wav',
    '.wma': 'audio/x-ms-wma'
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function isAllowedModuleAsset(filePath) {
  const roots = [
    path.resolve(__dirname, 'node_modules', 'demucs-web', 'src'),
    path.resolve(__dirname, 'node_modules', 'onnxruntime-web', 'dist')
  ];
  const extension = path.extname(filePath);
  return roots.some((root) => filePath.startsWith(`${root}${path.sep}`))
    && ['.js', '.mjs', '.wasm'].includes(extension);
}

function registerAudioFile(filePath) {
  const id = createHash('sha256')
    .update(path.resolve(filePath).toLowerCase())
    .digest('hex');
  audioFiles.set(id, filePath);
  audioIdsByPath.set(filePath, id);
  return {
    id,
    name: path.basename(filePath),
    folder: path.basename(path.dirname(filePath)),
    url: `mixdeck://app/audio/${id}`
  };
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function downloadStemModel(event) {
  await fs.mkdir(path.dirname(stemModelPath), { recursive: true });
  const response = await net.fetch(stemModelUrl);
  if (!response.ok || !response.body) {
    throw new Error(`تعذر تنزيل نموذج Stems (HTTP ${response.status}).`);
  }

  const temporaryPath = `${stemModelPath}.${randomUUID()}.partial`;
  const hash = createHash('sha256');
  let downloaded = 0;
  const verifier = new Transform({
    transform(chunk, encoding, callback) {
      downloaded += chunk.length;
      hash.update(chunk);
      if (!event.sender.isDestroyed()) {
        event.sender.send('stems:model-progress', { loaded: downloaded, total: stemModelSize });
      }
      callback(null, chunk);
    },
    flush(callback) {
      if (downloaded !== stemModelSize || hash.digest('hex') !== stemModelSha256) {
        callback(new Error('فشل التحقق من سلامة نموذج Stems بعد التنزيل.'));
        return;
      }
      callback();
    }
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body),
      verifier,
      createWriteStream(temporaryPath, { flags: 'wx' })
    );
    await fs.rename(temporaryPath, stemModelPath);
    return 'mixdeck://app/stem-model/htdemucs_embedded.onnx';
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function ensureStemModel(event) {
  if (stemModelDownloadPromise) return stemModelDownloadPromise;
  stemModelDownloadPromise = (async () => {
    try {
      const metadata = await fs.stat(stemModelPath);
      if (metadata.isFile() && metadata.size === stemModelSize && await hashFile(stemModelPath) === stemModelSha256) {
        return 'mixdeck://app/stem-model/htdemucs_embedded.onnx';
      }
      await fs.rm(stemModelPath, { force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return downloadStemModel(event);
  })();
  try {
    return await stemModelDownloadPromise;
  } finally {
    stemModelDownloadPromise = null;
  }
}

function registerProtocolHandler() {
  protocol.handle('mixdeck', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') {
      return new Response('Not found', { status: 404 });
    }

    if (url.pathname.startsWith('/audio/')) {
      const audioPath = audioFiles.get(url.pathname.slice('/audio/'.length));
      if (!audioPath) {
        return new Response('Audio file not found', { status: 404 });
      }
      return serveLocalFile(request, audioPath, audioContentType(audioPath));
    }

    if (url.pathname === '/stem-model/htdemucs_embedded.onnx') {
      try {
        await fs.access(stemModelPath);
      } catch (error) {
        if (error.code === 'ENOENT') return new Response('Stem model not found', { status: 404 });
        throw error;
      }
      return serveLocalFile(request, stemModelPath, 'application/octet-stream');
    }

    if (url.pathname.startsWith('/node_modules/')) {
      const modulePath = path.resolve(__dirname, `.${decodeURIComponent(url.pathname)}`);
      if (!isAllowedModuleAsset(modulePath)) {
        return new Response('Not found', { status: 404 });
      }
      const contentType = path.extname(modulePath) === '.wasm'
        ? 'application/wasm'
        : 'text/javascript; charset=utf-8';
      return serveLocalFile(request, modulePath, contentType);
    }

    const contentType = assetTypes[url.pathname];
    if (!contentType) {
      return new Response('Not found', { status: 404 });
    }

    const contents = await fs.readFile(path.join(__dirname, url.pathname.slice(1)));
    return new Response(contents, {
      headers: {
        'Content-Type': contentType,
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; media-src 'self' blob:; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'",
        ...isolatedHeaders()
      }
    });
  });
}

async function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1050,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'noor-dj.ico'),
    backgroundColor: '#0c0d12',
    title: 'NOOR DJ',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-changed', false);
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await mainWindow.loadURL('mixdeck://app/index.html');
  mainWindow.maximize();
  mainWindow.show();
}

ipcMain.handle('audio:select', async (_event, language) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: language === 'en' ? 'Choose music files' : 'اختر ملفات الموسيقى',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'ملفات الصوت',
        extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma']
      }
    ]
  });

  if (result.canceled) {
    return [];
  }

  const tracks = result.filePaths.map(registerAudioFile);
  await fs.writeFile(audioLibraryPath, JSON.stringify([...audioIdsByPath.keys()], null, 2), 'utf8');
  return tracks;
});

ipcMain.handle('audio:select-folder', async (_event, language) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: language === 'en' ? 'Choose a music folder' : 'اختر مجلد الموسيقى',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return [];

  const audioPaths = [];
  const pendingDirectories = [result.filePaths[0]];
  while (pendingDirectories.length) {
    const directory = pendingDirectories.pop();
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (entry.isFile() && audioExtensions.has(path.extname(entry.name).toLowerCase())) {
        audioPaths.push(entryPath);
      }
    }
  }

  const tracks = audioPaths.sort((left, right) => left.localeCompare(right)).map(registerAudioFile);
  if (tracks.length) {
    await fs.writeFile(audioLibraryPath, JSON.stringify([...audioIdsByPath.keys()], null, 2), 'utf8');
  }
  return tracks;
});

ipcMain.handle('audio:list', async () => {
  let savedPaths;
  try {
    savedPaths = JSON.parse(await fs.readFile(audioLibraryPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  if (!Array.isArray(savedPaths) || savedPaths.some((filePath) => typeof filePath !== 'string')) {
    throw new Error('ملف مكتبة الموسيقى غير صالح.');
  }

  const tracks = [];
  for (const filePath of savedPaths) {
    try {
      await fs.access(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }

    tracks.push(registerAudioFile(filePath));
  }
  return tracks;
});

ipcMain.handle('audio:metadata', async (event, audioId) => {
  if (event.sender !== mainWindow?.webContents) {
    throw new Error('طلب معلومات مسار من نافذة غير معتمدة.');
  }
  if (typeof audioId !== 'string' || !audioFiles.has(audioId)) {
    throw new Error('ملف الصوت المطلوب غير موجود في المكتبة.');
  }

  const { parseFile } = await import('music-metadata');
  const filePath = audioFiles.get(audioId);
  const [metadata, fileStats] = await Promise.all([
    parseFile(filePath, { duration: true }),
    fs.stat(filePath)
  ]);
  const common = metadata.common;
  const firstText = (value) => Array.isArray(value) ? value.find((item) => typeof item === 'string') || '' : typeof value === 'string' ? value : '';
  const numberValue = (value) => Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null;

  return {
    title: common.title || path.basename(filePath, path.extname(filePath)),
    artist: firstText(common.artists) || common.artist || '',
    albumArtist: common.albumartist || '',
    album: common.album || '',
    genre: Array.isArray(common.genre) ? common.genre.filter((item) => typeof item === 'string') : [],
    year: numberValue(common.year),
    date: common.date || '',
    bpm: numberValue(common.bpm),
    key: common.key || '',
    composer: firstText(common.composer),
    publisher: common.label || '',
    track: common.track?.no ? `${common.track.no}${common.track.of ? ` / ${common.track.of}` : ''}` : '',
    disc: common.disk?.no ? `${common.disk.no}${common.disk.of ? ` / ${common.disk.of}` : ''}` : '',
    comment: firstText(common.comment),
    format: metadata.format.container || metadata.format.codec || path.extname(filePath).slice(1).toUpperCase(),
    codec: metadata.format.codec || '',
    duration: numberValue(metadata.format.duration),
    bitrate: numberValue(metadata.format.bitrate),
    sampleRate: numberValue(metadata.format.sampleRate),
    bitDepth: numberValue(metadata.format.bitsPerSample),
    channels: numberValue(metadata.format.numberOfChannels),
    lossless: metadata.format.lossless,
    fileSize: fileStats.size
  };
});

ipcMain.handle('stems:model:ensure', (event) => ensureStemModel(event));

ipcMain.handle('window:is-fullscreen', (event) => {
  if (event.sender !== mainWindow?.webContents) {
    throw new Error('طلب حالة ملء الشاشة من نافذة غير معتمدة.');
  }
  return mainWindow.isFullScreen();
});

ipcMain.handle('window:toggle-fullscreen', (event) => {
  if (event.sender !== mainWindow?.webContents) {
    throw new Error('طلب ملء الشاشة من نافذة غير معتمدة.');
  }
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

app.whenReady().then(async () => {
  audioLibraryPath = path.join(app.getPath('userData'), 'library.json');
  stemModelPath = path.join(app.getPath('userData'), 'models', 'htdemucs_embedded.onnx');
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'midi' && webContents === mainWindow?.webContents;
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isMidiRequest = permission === 'midi' && !details?.requestingUrl?.includes('sysex');
    callback(isMidiRequest && webContents === mainWindow?.webContents);
  });
  registerProtocolHandler();
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
