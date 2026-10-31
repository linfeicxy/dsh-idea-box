# dsh-idea-box

A small floating box for the DSH web UI. Click the lightbulb, write one line (or drop a screenshot), press Enter — it becomes a Markdown file in a folder you control.

Notes are written straight to disk as plain `.md`, so you can read, search, sync or delete them with anything you already use. The plugin keeps no database of its own.

## What it does

- A round lightbulb button floating over the interface. It stays after a restart because it is a plugin, not a script.
- Click it to open a card: one text box, one drop zone, one **Save** button.
- **Enter** saves, **Shift+Enter** makes a new line, **Esc** closes.
- Screenshots: drag them onto the card or paste with **Ctrl+V**. Up to 6 per note, 8 MB each.
- After a save the card clears and shows a short "saved" confirmation, then closes by itself.
- If a write fails, the reason is shown in the card. Nothing is swallowed.

## Where files go

By default the folder is `灵感` under the working directory of the session you are in:

```
<working directory>/灵感/20261101_your note title.md
<working directory>/灵感/附件/20261101_your note title-1.png
```

- File name: `YYYYMMDD_` plus the first ~12 characters of your text. A second note with the same name on the same day gets `-2`, then `-3`.
- Images are stored beside the note in `附件`, and the note links them with a relative path, so the pair stays together when the folder is moved.
- A saved note looks like this:

```markdown
Text you typed

![screenshot](附件/20261101_your note title-1.png)

<!-- 2026-11-01 04:20 -->
```

The folder is created on the first save. Nothing else on disk is touched.

## Changing the folder

Open the card and click **改** next to the folder path, then type an absolute path. **恢复默认** puts it back to "follow the working directory".

The choice is stored in `<DSH_HOME>/dsh-idea-box.json` (one small file, nothing else).

## Limits

- 2000 characters per note, 6 images per note, 8 MB per image.
- Only real images are accepted — the file signature is checked on the host side, not the name.
- If any image in a batch is invalid, the whole batch is refused rather than half-saved.

## Install

Install it from the DSH plugin market, or

```sh
dsh plugin add dsh-idea-box
```

## Uninstall

Remove it with the same plugin manager you installed it from. The notes folder and everything in it is yours and is left untouched.

## License

MIT.

---

## 中文

界面里一个圆形的灯泡按钮：点开是一张小卡片，写一句话、拖进或粘贴截图，回车就存成 md 文件。

- 默认存在当前会话工作目录下的 `灵感\`，截图存进 `灵感\附件\`，正文里带相对链接。
- 卡片底部能看到当前保存位置，点 **改** 可以换目录，**恢复默认** 回到跟工作目录走。
- 一次最多 6 张图、单张 8MB、正文 2000 字。
- 写失败会把原因显示在卡片里，不会悄悄吞掉。
- 插件不建数据库，你的笔记就是磁盘上的 md 文件，随时可以直接打开、搬走、删掉。
