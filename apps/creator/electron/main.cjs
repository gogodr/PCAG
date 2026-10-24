const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const developmentUrl = process.env.PCAG_CREATOR_DEV_URL;
const permittedRoots = new Set();
const recentFile = () => path.join(app.getPath('userData'), 'recent-project.json');

function inside(root, relative = '') {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid project path.');
  if (!permittedRoots.has(root)) throw new Error('Select a project folder first.');
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error('Project path escapes its folder.');
  return target;
}

async function checkedPath(root, relative = '') {
  const target = inside(root, relative);
  const realRoot = await fs.realpath(root);
  let cursor = target;
  while (cursor !== root) {
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not supported in project folders.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    cursor = path.dirname(cursor);
  }
  if (realRoot !== root) throw new Error('Project folder changed on disk.');
  return target;
}

function expose(channel, operation) {
  ipcMain.handle(`pcag:${channel}`, async (event, ...args) => {
    if (!BrowserWindow.fromWebContents(event.sender)) throw new Error('Unexpected window.');
    return operation(...args);
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  expose('pick-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    const root = await fs.realpath(result.filePaths[0]);
    permittedRoots.add(root);
    return { root, name: path.basename(root) };
  });
  expose('pick-background', async root => {
    if (!permittedRoots.has(root)) throw new Error('Select a project folder first.');
    const backgrounds = await checkedPath(root, 'backgrounds');
    const result = await dialog.showOpenDialog({
      defaultPath: backgrounds,
      properties: ['openFile'],
      filters: [{ name: 'Background images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = await fs.realpath(result.filePaths[0]);
    const relative = path.relative(root, selected).split(path.sep).join('/');
    if (!relative.startsWith('backgrounds/') || !['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(path.extname(selected).toLowerCase())) {
      throw new Error('Choose an image inside this project’s backgrounds folder.');
    }
    await checkedPath(root, relative);
    if (!(await fs.stat(selected)).isFile()) throw new Error('Choose a background image file.');
    return relative;
  });
  expose('recent-folder', async () => {
    try {
      const saved = JSON.parse(await fs.readFile(recentFile(), 'utf8'));
      const root = await fs.realpath(saved.path);
      permittedRoots.add(root);
      return { root, name: path.basename(root) };
    } catch { return null; }
  });
  expose('remember-folder', async root => {
    if (!permittedRoots.has(root)) throw new Error('No folder selected.');
    await fs.mkdir(path.dirname(recentFile()), { recursive: true });
    await fs.writeFile(recentFile(), JSON.stringify({ path: root }));
  });
  expose('forget-folder', async () => { await fs.rm(recentFile(), { force: true }); });
  expose('entries', async (root, relative) => {
    const entries = await fs.readdir(await checkedPath(root, relative), { withFileTypes: true });
    return entries.map(entry => ({ name: entry.name, kind: entry.isDirectory() ? 'directory' : 'file' }));
  });
  expose('mkdir', async (root, relative) => { const target = await checkedPath(root, relative); await fs.mkdir(target); });
  expose('read', async (root, relative) => Array.from(await fs.readFile(await checkedPath(root, relative))));
  expose('write', async (root, relative, bytes) => { await fs.writeFile(await checkedPath(root, relative), Buffer.from(bytes)); });
  expose('remove', async (root, relative) => {
    const target = await checkedPath(root, relative);
    if ((await fs.stat(target)).isDirectory()) await fs.rmdir(target);
    else await fs.rm(target);
  });
  expose('exists', async (root, relative) => {
    try { const stat = await fs.stat(await checkedPath(root, relative)); return stat.isDirectory() ? 'directory' : 'file'; }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  });
  expose('player-template', async () => {
    const template = developmentUrl
      ? path.join(__dirname, '..', 'public', 'player-template')
      : path.join(__dirname, '..', '..', '..', 'dist', 'creator', 'player-template');
    const manifest = JSON.parse(await fs.readFile(path.join(template, 'manifest.json'), 'utf8'));
    if (!Array.isArray(manifest.files)) throw new Error('Player template manifest is invalid.');
    return Promise.all(manifest.files.map(async file => {
      if (typeof file !== 'string' || !file || file.includes('\\') || file.split('/').some(part => part === '.' || part === '..' || !part)) throw new Error('Invalid player template path.');
      return { path: file, data: (await fs.readFile(path.join(template, file))).toString('base64') };
    }));
  });

  const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 1000, minHeight: 650,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (developmentUrl) {
    await window.loadURL(developmentUrl);
    window.webContents.openDevTools({ mode: 'detach' });
  } else await window.loadFile(path.join(__dirname, '..', '..', '..', 'dist', 'creator', 'index.html'));
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
