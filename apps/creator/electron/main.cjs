const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const developmentUrl = process.env.PCAG_CREATOR_DEV_URL;
const permittedRoots = new Set();
const exportedAnimationFiles = new Set();
const pendingAnimationImports = new Map();
const animationScript = path.join(__dirname, '..', '..', '..', 'tools', 'sprites', 'animation-editor', 'project_animation.py');
const animationVideo = relative => typeof relative === 'string' && /^(?:animation|video)\/(?:[A-Za-z0-9_. ()-]+\/)*[A-Za-z0-9_. ()-]+\.(mp4|webm|mov|gif)$/i.test(relative)
  && !relative.split('/').some(part => part === '.' || part === '..');
function runAnimationPython(request) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', [animationScript], { cwd: path.join(__dirname, '..', '..', '..'), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Animation processing timed out.')); }, 300000);
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(errors.trim() || `Animation processing failed (${code}).`));
      else { try { resolve(JSON.parse(output)); } catch { reject(new Error('Animation processing returned invalid data.')); } }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
async function projectAnimation(root, relative) {
  if (!animationVideo(relative)) throw new Error('Choose a video from the project video folder.');
  const parts = relative.split('/');
  for (let length = 2; length < parts.length; length++) {
    const directory = await checkedPath(root, parts.slice(0, length).join('/'));
    if (await fs.stat(path.join(directory, 'source.json')).then(value => value.isFile()).catch(() => false)) throw new Error('Choose a source video, not a file inside an animation work folder.');
  }
  const video = await checkedPath(root, relative);
  if (!(await fs.stat(video)).isFile()) throw new Error('Animation source is not a file.');
  const helperRelative = `${path.posix.dirname(relative)}/_${path.posix.parse(relative).name}`;
  const helper = await checkedPath(root, helperRelative);
  const kind = await fs.stat(helper).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (kind && (!kind.isDirectory() || !await fs.stat(path.join(helper, 'source.json')).then(value => value.isFile()).catch(() => false))) throw new Error('The animation work folder name is already in use. Rename the source video or that folder.');
  return { video, helper, helperRelative };
}
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
  expose('pick-character-file', async (root, kind) => {
    if (!permittedRoots.has(root) || !['reference', 'animation'].includes(kind)) throw new Error('Select a project folder first.');
    const folder = await checkedPath(root, kind === 'reference' ? 'images' : 'animation');
    const result = await dialog.showOpenDialog({
      title: kind === 'reference' ? 'Choose character reference' : 'Choose animation sprite or GIF',
      defaultPath: folder,
      properties: ['openFile'],
      filters: [{ name: kind === 'reference' ? 'Images' : 'Sprites and GIFs', extensions: kind === 'reference' ? ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] : ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = await fs.realpath(result.filePaths[0]);
    const relative = path.relative(root, selected).split(path.sep).join('/');
    const validRoot = kind === 'reference' ? /^(images|backgrounds)\// : /^(images|animation)\//;
    const validExtension = kind === 'reference' ? /\.(png|jpe?g|webp|svg|gif)$/i : /\.(png|jpe?g|webp|gif)$/i;
    if (!validRoot.test(relative) || !validExtension.test(relative)) throw new Error('Choose a supported file inside this project’s image or animation folders.');
    await checkedPath(root, relative);
    if (!(await fs.stat(selected)).isFile()) throw new Error('Choose a file.');
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
  expose('remove', async (root, relative, recursive = false) => {
    const target = await checkedPath(root, relative);
    if (recursive && (typeof relative !== 'string' || !/^(?:animation|video)\/(?:[^/.][^/]*\/)*_[^/]+$/.test(relative) || !await fs.stat(path.join(target, 'source.json')).then(value => value.isFile()).catch(() => false))) throw new Error('Recursive removal is only available for animation work folders.');
    if ((await fs.stat(target)).isDirectory()) { if (recursive) await fs.rm(target, { recursive: true }); else await fs.rmdir(target); }
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
  expose('animation-inspect', async (root, relative) => {
    const { video, helper } = await projectAnimation(root, relative);
    return runAnimationPython({ operation: 'inspect', video, helper });
  });
  expose('animation-pick-source', async (root, kind) => {
    if (kind !== 'video' && kind !== 'frames') throw new Error('Choose a video or frames.');
    const folder = await checkedPath(root, kind === 'video' ? 'video' : 'images');
    const choice = await dialog.showOpenDialog({ title: kind === 'video' ? 'Load video' : 'Import animation frames', defaultPath: folder, properties: kind === 'video' ? ['openFile'] : ['openFile', 'multiSelections'], filters: [{ name: kind === 'video' ? 'Videos and GIFs' : 'Image frames', extensions: kind === 'video' ? ['mp4', 'gif', 'mov', 'webm'] : ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (choice.canceled || !choice.filePaths.length) return { cancelled: true };
    const files = choice.filePaths.sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true, sensitivity: 'base' }));
    if (kind === 'frames' && files.length < 2) throw new Error('Select at least two image frames.');
    const extensions = kind === 'video' ? ['.mp4', '.gif', '.mov', '.webm'] : ['.png', '.jpg', '.jpeg', '.webp'];
    if (files.some(file => !extensions.includes(path.extname(file).toLowerCase()))) throw new Error('Unsupported animation source file.');
    const suggested = (kind === 'video' ? path.parse(files[0]).name : path.basename(path.dirname(files[0]))).replace(/[^A-Za-z0-9_. ()-]+/g, '_').replace(/^[_ .]+|[_ .]+$/g, '') || 'animation';
    const token = randomUUID();
    pendingAnimationImports.set(token, { root, kind, files });
    return { token, kind, name: suggested, count: files.length };
  });
  expose('animation-import-selection', async (root, token, requestedName) => {
    const pending = pendingAnimationImports.get(token);
    if (!pending || pending.root !== root) throw new Error('Select the animation source again.');
    const name = typeof requestedName === 'string' ? requestedName.trim() : '';
    if (!name || !/^[A-Za-z0-9_. ()-]+$/.test(name) || name === '.' || name === '..' || name.startsWith('_')) throw new Error('Enter an animation name using letters, numbers, spaces, underscores, dots, or hyphens.');
    const extension = pending.kind === 'video' ? path.extname(pending.files[0]).toLowerCase() : '.gif';
    const relative = `video/${name}${extension}`;
    const video = await checkedPath(root, relative);
    const helper = await checkedPath(root, `video/_${name}`);
    if (pending.kind === 'video') {
      const source = await fs.realpath(pending.files[0]);
      const same = source === video;
      if (!same && await fs.stat(video).then(() => true).catch(() => false)) throw new Error('An animation with this name already exists. Choose another name.');
      if (!same && await fs.stat(helper).then(() => true).catch(() => false)) throw new Error('An animation work folder with this name already exists.');
      if (!same) await fs.copyFile(source, video, 1);
      try {
        const { helper: work } = await projectAnimation(root, relative);
        const result = await runAnimationPython({ operation: 'inspect', video, helper: work });
        pendingAnimationImports.delete(token);
        return { path: relative, result };
      } catch (error) { if (!same) await fs.rm(video, { force: true }); throw error; }
    }
    if (await fs.stat(video).then(() => true).catch(() => false) || await fs.stat(helper).then(() => true).catch(() => false)) throw new Error('An animation with this name already exists. Choose another name.');
    const result = await runAnimationPython({ operation: 'import-frames', video, helper, frames: pending.files, fps: 6 });
    pendingAnimationImports.delete(token);
    return { path: relative, result };
  });
  expose('animation-confirm', async (root, relative, start, end) => {
    const { video, helper } = await projectAnimation(root, relative);
    return runAnimationPython({ operation: 'confirm', video, helper, start, end });
  });
  expose('animation-transfer-work', async (root, from, to) => {
    const oldWork = await projectAnimation(root, from);
    const newWork = await projectAnimation(root, to);
    const source = await fs.readFile(path.join(oldWork.helper, 'source.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!source) return false;
    const stat = await fs.stat(oldWork.video, { bigint: true });
    if (source.file !== path.basename(oldWork.video) || source.size !== Number(stat.size) || source.modifiedNs !== stat.mtimeNs.toString()) throw new Error('The animation source changed before it was moved.');
    await fs.rename(oldWork.helper, newWork.helper);
    const current = await fs.stat(newWork.video, { bigint: true });
    await fs.writeFile(path.join(newWork.helper, 'source.json'), JSON.stringify({ file: path.basename(newWork.video), size: Number(current.size), modifiedNs: current.mtimeNs.toString() }, null, 2) + '\n');
    return true;
  });
  expose('animation-frame', async (root, relative, index, removeBg, pixelSize = 1, palette = [], manual = {}) => {
    if (!Number.isInteger(index) || index < 0 || typeof removeBg !== 'boolean') throw new Error('Invalid animation frame.');
    const { video, helper } = await projectAnimation(root, relative);
    return (await runAnimationPython({ operation: 'frame', video, helper, index, removeBg, pixelSize, palette, manual })).data;
  });
  expose('animation-target', async (root, relative, index, x, y, removeBg, manual = {}) => {
    if (![index, x, y].every(value => Number.isInteger(value) && value >= 0) || typeof removeBg !== 'boolean') throw new Error('Invalid target point.');
    const { video, helper } = await projectAnimation(root, relative);
    return runAnimationPython({ operation: 'target', video, helper, index, x, y, removeBg, manual });
  });
  expose('animation-suggest-palette', async (root, relative, index, removeBg, pixelSize, manual = {}) => {
    if (!Number.isInteger(index) || index < 0 || typeof removeBg !== 'boolean' || !Number.isInteger(pixelSize) || pixelSize < 1 || pixelSize > 128) throw new Error('Invalid palette suggestion.');
    const { video, helper } = await projectAnimation(root, relative);
    return runAnimationPython({ operation: 'suggest-palette', video, helper, index, removeBg, pixelSize, manual });
  });
  expose('animation-export', async (root, relative, request) => {
    if (!request || typeof request !== 'object') throw new Error('Invalid animation export.');
    const { video, helper } = await projectAnimation(root, relative);
    const images = await checkedPath(root, 'images');
    const animation = await checkedPath(root, 'animation');
    const choice = await dialog.showOpenDialog({ title: 'Export animation GIF and atlas', defaultPath: animation, properties: ['openDirectory', 'createDirectory'] });
    if (choice.canceled || !choice.filePaths[0]) return { cancelled: true };
    const destination = await fs.realpath(choice.filePaths[0]);
    if (!(await fs.stat(destination)).isDirectory()) throw new Error('Choose an export folder.');
    const insideProjectImages = destination === images || destination.startsWith(images + path.sep);
    const insideProjectAnimation = destination === animation || destination.startsWith(animation + path.sep);
    if (destination.startsWith(root + path.sep) && !insideProjectImages && !insideProjectAnimation) throw new Error('Choose a folder inside this project’s animation or images folder, or a folder outside the project.');
    const result = await runAnimationPython({ operation: 'export-bundle', video, helper, destination, export: request });
    exportedAnimationFiles.add(result.gif);
    exportedAnimationFiles.add(result.atlas);
    return { ...result, insideProjectAssets: insideProjectImages || insideProjectAnimation };
  });
  expose('animation-regenerate-gif', async (root, relative) => {
    if (typeof relative !== 'string' || !/^animation\/(?:[A-Za-z0-9_. ()-]+\/)*[A-Za-z0-9_. ()-]+\.json$/i.test(relative) || relative.split('/').some(part => part === '.' || part === '..')) throw new Error('Choose an animation atlas JSON file.');
    const metadata = await checkedPath(root, relative);
    const content = await fs.readFile(metadata, 'utf8');
    if (content.length > 1_000_000) throw new Error('Animation atlas metadata is too large.');
    const info = JSON.parse(content);
    const safeName = (name, extension) => typeof name === 'string' && /^[A-Za-z0-9_. ()-]+$/i.test(name) && name.toLowerCase().endsWith(extension) && name !== '.' && name !== '..';
    if (info?.format !== 'pcag-animation-atlas' || !safeName(info.image, '.png') || !safeName(info.gif, '.gif')) throw new Error('Invalid animation atlas metadata.');
    const parent = path.posix.dirname(relative);
    const atlas = await checkedPath(root, `${parent}/${info.image}`);
    const gif = await checkedPath(root, `${parent}/${info.gif}`);
    if (!(await fs.stat(atlas)).isFile()) throw new Error('Animation atlas image is missing.');
    return runAnimationPython({ operation: 'regenerate-gif', metadata, atlas, gif });
  });
  expose('animation-reveal-export', async (root, relative, file) => {
    await projectAnimation(root, relative);
    if (typeof file !== 'string' || !exportedAnimationFiles.has(file)) throw new Error('Invalid animation export path.');
    await fs.access(file);
    shell.showItemInFolder(file);
  });

  const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 1000, minHeight: 650,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (developmentUrl) {
    await window.loadURL(developmentUrl);
    window.webContents.openDevTools({ mode: 'detach' });
  } else await window.loadFile(path.join(__dirname, '..', '..', '..', 'dist', 'creator', 'index.html'));
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
