// dsh-idea-box —— Host 半边
//
// 职责只有一件事：把一句话（可以带截图）写成一个 md 文件。
// 截图落到 <灵感目录>\附件\，md 正文里带相对链接，之后随时能按链接把图读回来。
//
// 存到哪儿：
//   1. 用户在浮窗设置里指定的目录（记在 <DSH_HOME>\dsh-idea-box.json）
//   2. 没指定时，跟着当前会话的工作目录走：<工作目录>\灵感
//   3. 都拿不到时回落到 <用户主目录>\灵感
//
// 界面那一半（client.js）通过本机 Web 服务上的三个接口找它：
//   GET  /dsh-idea-box/info    -> { ok, dir, attachDir, source }
//   POST /dsh-idea-box/save    -> { ok, file, path, images } 或 { ok:false, error }
//   POST /dsh-idea-box/config  -> { ok, dir, source }（dir 为空 = 恢复默认）

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { altOf, bodyWithAttachments, candidateName, dateStamp, stemOf } from './naming.js';

const name = 'dsh-idea-box';
const inject = ['webServer', 'connection'];

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const CONFIG_PATH = path.join(DSH_HOME, 'dsh-idea-box.json');
const FOLDER_NAME = '灵感';

const ROUTE_INFO = '/dsh-idea-box/info';
const ROUTE_SAVE = '/dsh-idea-box/save';
const ROUTE_CONFIG = '/dsh-idea-box/config';

const MAX_TEXT_CHARS = 2000;
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_BODY_BYTES = 32 * 1024 * 1024;

function sendJson(res, code, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体太大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 只认图片的魔数，不认客户端说的类型。 */
function sniffExt(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 6 && buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';
  return null;
}

/** 和 dsh-startup-screen 一样：非浏览器来源的请求直接挡掉。 */
function rejectedByTrust(req, ctx) {
  try {
    const conn =
      (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection;
    if (!conn || typeof conn.requestRejection !== 'function') return undefined;
    return conn.requestRejection(req);
  } catch {
    return undefined;
  }
}

function guarded(ctx, handler) {
  return async (req, res) => {
    const code = rejectedByTrust(req, ctx);
    if (code) {
      res.statusCode = code === true ? 403 : code;
      res.end();
      return;
    }
    try {
      await handler(req, res);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      sendJson(res, 500, { ok: false, error: '写入失败：' + message });
    }
  };
}

// ---------------------------------------------------------------- 目录解析

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.dir === 'string') return { dir: parsed.dir };
  } catch {
    /* 没有配置文件或读坏了，按默认走 */
  }
  return {};
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/** 当前会话的工作目录：拿得到就用它，拿不到返回 undefined。 */
function currentWorkspace(ctx) {
  try {
    const wd = typeof ctx.get === 'function' ? ctx.get('workingDirectory') : ctx.workingDirectory;
    if (!wd) return undefined;
    const agents = typeof ctx.get === 'function' ? ctx.get('agents') : ctx.agents;
    const list = agents && typeof agents.list === 'function' ? agents.list() : [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const agent = list[i];
      if (!agent) continue;
      const session = agent.session || agent;
      try {
        const dir = wd.get(session);
        if (typeof dir === 'string' && dir) return dir;
      } catch {
        /* 这个会话拿不到，换下一个 */
      }
    }
    if (typeof wd.defaultDirectory === 'string' && wd.defaultDirectory) return wd.defaultDirectory;
  } catch {
    /* 环境里没有这两个服务 */
  }
  return undefined;
}

/** 返回 { dir, source }，source 用于在界面上告诉用户这个目录是怎么来的。 */
function resolveIdeaDir(ctx) {
  const config = readConfig();
  if (config.dir) return { dir: config.dir, source: 'custom' };
  const workspace = currentWorkspace(ctx);
  if (workspace) return { dir: path.join(workspace, FOLDER_NAME), source: 'workspace' };
  return { dir: path.join(os.homedir(), FOLDER_NAME), source: 'home' };
}

function attachDirOf(dir) {
  return path.join(dir, '附件');
}

/** 只接受绝对路径；顺便把用户的引号和前后空格清掉。 */
function normalizeDir(input) {
  const raw = String(input == null ? '' : input).trim().replace(/^["']|["']$/g, '');
  if (!raw) return '';
  if (!path.isAbsolute(raw)) throw new Error('要填完整路径，比如 E:\\我的想法');
  return path.normalize(raw);
}

// ---------------------------------------------------------------- 接口

function handleInfo(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: '只接受 GET' });
    return;
  }
  const { dir, source } = resolveIdeaDir(req.ctx);
  sendJson(res, 200, {
    ok: true,
    dir,
    attachDir: attachDirOf(dir),
    source,
    exists: fs.existsSync(dir),
  });
}

/** 把客户端传来的图片解出来；任何一张不合规就整体拒收，不留半截。 */
function decodeImages(rawImages) {
  if (!rawImages) return [];
  if (!Array.isArray(rawImages)) throw new Error('图片数据格式不对');
  if (rawImages.length > MAX_IMAGES) throw new Error('一次最多 ' + MAX_IMAGES + ' 张图');

  const decoded = [];
  let total = 0;
  for (const item of rawImages) {
    if (!item || typeof item.data !== 'string' || !item.data) {
      throw new Error('有一张图的数据是空的');
    }
    const buf = Buffer.from(item.data, 'base64');
    if (!buf.length) throw new Error('有一张图解不出来');
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new Error('单张图上限 8MB，这张超了');
    }
    total += buf.length;
    if (total > MAX_TOTAL_IMAGE_BYTES) throw new Error('一次总共上限 20MB，这些图超了');
    const ext = sniffExt(buf);
    if (!ext) throw new Error('只收图片（png / jpg / gif / webp / bmp）');
    decoded.push({ buf, ext, alt: altOf(item.name || '截图') });
  }
  return decoded;
}

/** 先在灵感目录里占住一个不重名的 md 名字，图片就能和它同名配对。 */
function reserveEntryFile(dir, base) {
  for (let n = 1; n <= 999; n += 1) {
    const candidate = candidateName(base, n);
    const full = path.join(dir, candidate);
    try {
      const fd = fs.openSync(full, 'wx');
      fs.closeSync(fd);
      return { fileName: candidate, fullPath: full, stem: candidate.slice(0, -3) };
    } catch (error) {
      if (error && error.code === 'EEXIST') continue;
      throw error;
    }
  }
  throw new Error('同名文件太多了，先整理一下 ' + dir);
}

function removeQuietly(target) {
  try {
    fs.unlinkSync(target);
  } catch {
    /* 清理失败就算了，不影响报错 */
  }
}

async function handleSave(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: '只接受 POST' });
    return;
  }

  const raw = await readBody(req, MAX_BODY_BYTES);
  let text = '';
  let images = [];
  try {
    const parsed = JSON.parse(raw || '{}');
    if (parsed && typeof parsed.text === 'string') text = parsed.text;
    if (parsed && parsed.images) images = parsed.images;
  } catch {
    sendJson(res, 400, { ok: false, error: '请求格式不对' });
    return;
  }

  const trimmed = text.replace(/\r\n?/g, '\n').trim();
  if (Array.from(trimmed).length > MAX_TEXT_CHARS) {
    sendJson(res, 400, {
      ok: false,
      error: '太长了（上限 ' + MAX_TEXT_CHARS + ' 字），拆成几条吧',
    });
    return;
  }

  let decoded;
  try {
    decoded = decodeImages(images);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
    return;
  }

  if (!trimmed && decoded.length === 0) {
    sendJson(res, 400, { ok: false, error: '写一句，或者拖张图进来' });
    return;
  }

  const { dir } = resolveIdeaDir(req.ctx);
  const attachDir = attachDirOf(dir);
  const now = new Date();
  fs.mkdirSync(dir, { recursive: true });

  const stem = trimmed ? stemOf(trimmed) : '截图';
  const base = dateStamp(now) + '_' + stem;

  let reserved = null;
  const writtenImages = [];
  try {
    reserved = reserveEntryFile(dir, base);

    const attachments = [];
    for (let i = 0; i < decoded.length; i += 1) {
      const image = decoded[i];
      const file = reserved.stem + '-' + (i + 1) + '.' + image.ext;
      const full = path.join(attachDir, file);
      fs.mkdirSync(attachDir, { recursive: true });
      fs.writeFileSync(full, image.buf);
      writtenImages.push(full);
      attachments.push({ file, alt: image.alt });
    }

    const body = bodyWithAttachments(trimmed, now, attachments);
    fs.writeFileSync(reserved.fullPath, body, 'utf8');

    sendJson(res, 200, {
      ok: true,
      file: reserved.fileName,
      path: reserved.fullPath,
      dir,
      images: writtenImages.map((full) => path.basename(full)),
    });
  } catch (error) {
    for (const full of writtenImages) removeQuietly(full);
    if (reserved) removeQuietly(reserved.fullPath);
    sendJson(res, 500, {
      ok: false,
      error: '写入失败：' + (error && error.message ? error.message : String(error)),
    });
  }
}

async function handleConfig(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: '只接受 POST' });
    return;
  }
  const raw = await readBody(req, 64 * 1024);
  let dir = '';
  try {
    const parsed = JSON.parse(raw || '{}');
    dir = normalizeDir(parsed && parsed.dir);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
    return;
  }

  try {
    if (dir) {
      fs.mkdirSync(dir, { recursive: true });
      writeConfig({ dir });
    } else {
      removeQuietly(CONFIG_PATH);
    }
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: '改不了目录：' + (error && error.message ? error.message : String(error)),
    });
    return;
  }

  const resolved = resolveIdeaDir(req.ctx);
  sendJson(res, 200, {
    ok: true,
    dir: resolved.dir,
    attachDir: attachDirOf(resolved.dir),
    source: resolved.source,
    exists: fs.existsSync(resolved.dir),
  });
}

function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined;
    if (viaGet) return viaGet;
  } catch {
    /* 回落到属性访问 */
  }
  return ctx.webServer;
}

function hasRoutes(server) {
  return server && typeof server.register === 'function' && typeof server.tapIndex === 'function';
}

function apply(ctx) {
  const server = resolveWebServer(ctx);
  if (!hasRoutes(server)) {
    console.warn('[dsh-idea-box] 当前环境没有可用的 webServer，浮窗无法保存（插件本身已加载）');
    return;
  }

  const bind = (path_, handler) =>
    server.register({
      kind: 'exact',
      path: path_,
      handler: async (req, res) => {
        req.ctx = ctx;
        await guarded(ctx, handler)(req, res);
      },
    });

  const disposers = [];
  disposers.push(bind(ROUTE_INFO, handleInfo));
  disposers.push(bind(ROUTE_SAVE, handleSave));
  disposers.push(bind(ROUTE_CONFIG, handleConfig));

  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          /* 卸载时忽略 */
        }
      }
    });
  }
}

export { apply, inject, name };
