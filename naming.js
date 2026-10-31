// 文件名与正文的纯函数：给 index.js 用，也可以在 Node 里直接跑着验。
// 规则（来自交接文档）：
//   YYYYMMDD_<内容前 8-12 字>.md，同一天重名加 -2、-3
//   正文 = 原文 + （附件链接）+ 末尾一行 <!-- YYYY-MM-DD HH:mm -->

const MAX_STEM_CHARS = 12;

/** 去掉 Windows 文件名里不许出现的字符，压平空白。 */
function clean(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n?/g, '\n')
    .replace(/[\n\t]+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 取正文前 12 个字做文件名主干；不足 12 字就全用。 */
export function stemOf(text) {
  const cleaned = clean(text);
  const chars = Array.from(cleaned);
  let cut = Math.min(chars.length, MAX_STEM_CHARS);

  // 前 12 字里如果正好有标点，就断在标点上，别把词截断（太靠前的标点不用，否则只剩两三个字）
  const head = chars.slice(0, MAX_STEM_CHARS);
  for (let i = head.length - 1; i >= 5; i -= 1) {
    if ('，。、；：！？,.;:!?'.includes(head[i])) {
      cut = i;
      break;
    }
  }

  let stem = chars.slice(0, cut).join('');
  // Windows 不允许文件名以点或空格结尾
  stem = stem.replace(/[.\s]+$/g, '');
  return stem || '灵感';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 20261101 */
export function dateStamp(date) {
  return String(date.getFullYear()) + pad2(date.getMonth() + 1) + pad2(date.getDate());
}

/** 2026-11-01 04:20 */
export function timeStamp(date) {
  return (
    String(date.getFullYear()) +
    '-' +
    pad2(date.getMonth() + 1) +
    '-' +
    pad2(date.getDate()) +
    ' ' +
    pad2(date.getHours()) +
    ':' +
    pad2(date.getMinutes())
  );
}

/** 图片的 alt 文本：用原文件名，去掉会破坏 markdown 链接的字符。 */
export function altOf(name) {
  const base = String(name == null ? '' : name).replace(/[[\]()]/g, '');
  const clean_ = base.replace(/[\u0000-\u001f]/g, '').trim();
  return Array.from(clean_).slice(0, 60).join('') || '截图';
}

/** 一条想法的正文：原文 + 每条附件一行图片链接 + 末尾一行时间注释。 */
export function bodyWithAttachments(text, date, attachments) {
  const parts = [];
  const main = String(text == null ? '' : text).trim();
  if (main) parts.push(main);
  for (const item of attachments || []) {
    parts.push('![' + altOf(item.alt || item.file) + '](附件/' + item.file + ')');
  }
  parts.push('<!-- ' + timeStamp(date) + ' -->');
  return parts.join('\n\n') + '\n';
}

/** 没有附件时就是交接文档写的那个格式。 */
export function bodyOf(text, date) {
  return bodyWithAttachments(text, date, []);
}

/** 一次算齐：{ base, body }，base 还不带 .md 和去重后缀。 */
export function entryOf(text, date) {
  return {
    base: dateStamp(date) + '_' + stemOf(text),
    body: bodyOf(text, date),
  };
}

/** 第 n 个重名候选：n<=1 不加后缀，n=2 加 -2。 */
export function candidateName(base, n) {
  return n <= 1 ? base + '.md' : base + '-' + n + '.md';
}
