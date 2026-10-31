// dsh-idea-box —— Client 半边
//
// 界面只有一个东西：右下角一个圆按钮，点开是一张小卡片：
//   上面一块写字的框，下面一条放截图的地方，右下角「存」。
// 回车或点「存」→ POST /dsh-idea-box/save → 成功清空并显示约 1 秒「已存」，失败把原因写在卡片里。
// 截图可以拖进来，也可以 Ctrl+V 粘进来。
window.__ModuleLoader__.load({
  id: 'dsh-idea-box',
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require('react');
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;

    var MAX_IMAGES = 6;
    var MAX_IMAGE_BYTES = 8 * 1024 * 1024;

    var CSS = [
      '.dib-root{position:fixed;right:20px;bottom:max(120px,38.2vh);z-index:60;pointer-events:auto;',
      'display:flex;flex-direction:column;align-items:flex-end;',
      'font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);}',
      '.dib-fab{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;',
      'justify-content:center;cursor:pointer;padding:0;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);',
      'color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv2);',
      'transition:transform .15s ease,background .15s ease;}',
      '.dib-fab:hover{transform:scale(1.06);background:var(--dsw-alias-interactive-bg-hover);}',
      '.dib-fab:active{transform:scale(.96);}',
      '.dib-card{display:flex;flex-direction:column;gap:8px;padding:10px;width:400px;',
      'border-radius:14px;border:1px solid var(--dsw-alias-border-l1);',
      'background:var(--dsw-alias-bg-overlay);box-shadow:var(--dsw-shadow-lv3);}',
      '.dib-card.is-drag{border-color:var(--dsw-alias-brand-primary);',
      'box-shadow:0 0 0 2px var(--dsw-alias-brand-primary) inset,var(--dsw-shadow-lv3);}',
      '.dib-head{display:flex;align-items:center;justify-content:space-between;',
      'font-size:12px;color:var(--dsw-alias-label-tertiary);}',
      '.dib-input{width:100%;box-sizing:border-box;min-height:64px;resize:none;',
      'border:none;outline:none;background:transparent;padding:2px;',
      'color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.6;',
      'font-family:inherit;}',
      '.dib-input::placeholder{color:var(--dsw-alias-label-tertiary);}',
      '.dib-drop{display:flex;align-items:center;gap:8px;flex-wrap:wrap;',
      'min-height:52px;padding:6px;border-radius:10px;',
      'border:1px dashed var(--dsw-alias-border-l2);}',
      '.dib-drop.is-over{border-color:var(--dsw-alias-brand-primary);',
      'background:var(--dsw-alias-interactive-bg-hover);}',
      '.dib-hint{font-size:12px;color:var(--dsw-alias-label-tertiary);}',
      '.dib-thumb{position:relative;width:48px;height:48px;border-radius:8px;overflow:hidden;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);}',
      '.dib-thumb img{width:100%;height:100%;object-fit:cover;display:block;}',
      '.dib-thumb button{position:absolute;top:0;right:0;width:16px;height:16px;padding:0;',
      'border:none;border-radius:0 0 0 6px;cursor:pointer;line-height:14px;font-size:12px;',
      'background:rgba(0,0,0,.55);color:#fff;}',
      '.dib-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
      '.dib-status{flex:1;min-width:0;font-size:12px;line-height:1.4;word-break:break-all;}',
      '.dib-status.is-ok{color:var(--dsw-alias-state-success-primary);}',
      '.dib-status.is-err{color:var(--dsw-alias-state-error-primary);}',
      '.dib-save{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-button-primary-fill);',
      'color:var(--dsw-alias-label-primary-foreground);font-size:12px;line-height:1;',
      'padding:7px 14px;border-radius:8px;cursor:pointer;white-space:nowrap;}',
      '.dib-save[disabled]{opacity:.5;cursor:default;}',
      '.dib-close{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);',
      'font-size:16px;line-height:1;padding:2px 6px;cursor:pointer;border-radius:6px;}',
      '.dib-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);}',
      '.dib-dir{display:flex;align-items:center;gap:6px;font-size:11px;line-height:1.4;',
      'color:var(--dsw-alias-label-tertiary);}',
      '.dib-dir span.dib-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.dib-dir button{border:none;background:transparent;color:var(--dsw-alias-label-secondary);',
      'font-size:11px;padding:2px 4px;border-radius:4px;cursor:pointer;}',
      '.dib-dir button:hover{background:var(--dsw-alias-interactive-bg-hover);',
      'color:var(--dsw-alias-label-primary);}',
      '.dib-dir input{flex:1;min-width:0;box-sizing:border-box;font-size:11px;padding:3px 6px;',
      'border-radius:6px;border:1px solid var(--dsw-alias-border-l1);',
      'background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);outline:none;',
      'font-family:inherit;}',
    ].join('');

    var CSS_ID = 'dsh-idea-box/main.css';

    // 关键布局同时内联一份：万一样式表没挂上（缓存、旧样例），卡片也不会摊成一行。
    var LAYOUT = {
      root: {
        position: 'fixed',
        right: 20,
        bottom: 'max(120px, 38.2vh)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'auto',
      },
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 400,
        maxWidth: 'calc(100vw - 48px)',
        boxSizing: 'border-box',
      },
      input: { width: '100%', minHeight: 64, boxSizing: 'border-box', resize: 'none', display: 'block' },
      drop: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        minHeight: 52,
        boxSizing: 'border-box',
      },
      foot: { display: 'flex', alignItems: 'center', gap: 8 },
      dir: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 },
    };

    // 每次都换掉旧样式：改名/改版之后，页面里可能还留着上一版的 <style>，
    // 同名的 class 会被旧规则抢先，界面就会错位（第一版就踩过：卡片摊成一行）。
    function installCss() {
      if (typeof document === 'undefined') return;
      var stale = document.querySelectorAll('style[data-plugin-css^="dsh-idea-box/"]');
      for (var i = 0; i < stale.length; i += 1) {
        try {
          stale[i].parentNode.removeChild(stale[i]);
        } catch (error) {
          /* 忽略 */
        }
      }
      var style = document.createElement('style');
      style.setAttribute('data-plugin-css', CSS_ID);
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    function lightbulb(size) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        h('path', { d: 'M9 18h6' }),
        h('path', { d: 'M10 22h4' }),
        h('path', { d: 'M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z' }),
      );
    }

    function readFileAsBase64(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var result = String(reader.result || '');
          var comma = result.indexOf(',');
          if (comma < 0) {
            reject(new Error('读不到这张图'));
            return;
          }
          resolve({
            key: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            name: file.name || '截图.png',
            data: result.slice(comma + 1),
            url: typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '',
          });
        };
        reader.onerror = function () {
          reject(new Error('读不到这张图'));
        };
        reader.readAsDataURL(file);
      });
    }

    function revoke(images) {
      for (var i = 0; i < images.length; i += 1) {
        try {
          if (images[i] && images[i].url) URL.revokeObjectURL(images[i].url);
        } catch (error) {
          /* 忽略 */
        }
      }
    }

    function IdeaBox() {
      var openState = useState(false);
      var open = openState[0];
      var setOpen = openState[1];

      var textState = useState('');
      var text = textState[0];
      var setText = textState[1];

      var statusState = useState(null);
      var status = statusState[0];
      var setStatus = statusState[1];

      var busyState = useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];

      var imagesState = useState([]);
      var images = imagesState[0];
      var setImages = imagesState[1];

      var dragState = useState(false);
      var dragging = dragState[0];
      var setDragging = dragState[1];

      var inputRef = useRef(null);
      var timerRef = useRef(null);
      var dragDepth = useRef(0);
      var imagesRef = useRef([]);
      imagesRef.current = images;

      var dirState = useState(null);
      var dirInfo = dirState[0];
      var setDirInfo = dirState[1];

      var editState = useState(false);
      var editingDir = editState[0];
      var setEditingDir = editState[1];

      var draftState = useState('');
      var dirDraft = draftState[0];
      var setDirDraft = draftState[1];

      function applyDirInfo(data) {
        if (data && data.ok) {
          setDirInfo({ dir: data.dir, source: data.source, exists: data.exists });
        }
      }

      useEffect(
        function () {
          if (!open) return;
          fetch('/dsh-idea-box/info')
            .then(function (response) {
              return response.json();
            })
            .then(applyDirInfo)
            .catch(function () {
              setDirInfo({ error: true });
            });
        },
        [open],
      );

      function startEditDir() {
        setDirDraft(dirInfo && dirInfo.dir ? dirInfo.dir : '');
        setEditingDir(true);
      }

      function saveDir(value) {
        fetch('/dsh-idea-box/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir: value }),
        })
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            if (data && data.ok) {
              applyDirInfo(data);
              setEditingDir(false);
              setStatus({ kind: 'ok', msg: '以后存到这里' });
              return;
            }
            setStatus({
              kind: 'err',
              msg: (data && data.error) || '改目录失败',
            });
          })
          .catch(function () {
            setStatus({ kind: 'err', msg: '改目录失败：连不上后台' });
          });
      }

      useEffect(
        function () {
          if (open && inputRef.current) {
            try {
              inputRef.current.focus();
            } catch (error) {
              /* 忽略 */
            }
          }
        },
        [open],
      );

      useEffect(function () {
        return function () {
          if (timerRef.current) clearTimeout(timerRef.current);
          revoke(imagesRef.current);
        };
      }, []);

      function addFiles(list) {
        var files = [];
        for (var i = 0; i < (list ? list.length : 0); i += 1) {
          var file = list[i];
          if (file && typeof file.type === 'string' && file.type.indexOf('image/') === 0) {
            files.push(file);
          }
        }
        if (!files.length) {
          setStatus({ kind: 'err', msg: '只收图片：截图直接拖进来，或者 Ctrl+V 粘贴' });
          return;
        }
        var room = MAX_IMAGES - images.length;
        if (room <= 0) {
          setStatus({ kind: 'err', msg: '一次最多 ' + MAX_IMAGES + ' 张图' });
          return;
        }
        var tooBig = false;
        var accepted = [];
        for (var j = 0; j < files.length && accepted.length < room; j += 1) {
          if (files[j].size > MAX_IMAGE_BYTES) {
            tooBig = true;
            continue;
          }
          accepted.push(files[j]);
        }
        if (!accepted.length) {
          setStatus({ kind: 'err', msg: '单张图上限 8MB，这张超了' });
          return;
        }
        setStatus(tooBig ? { kind: 'err', msg: '有图超过 8MB，已跳过' } : null);
        Promise.all(accepted.map(readFileAsBase64)).then(
          function (items) {
            setImages(function (prev) {
              return prev.concat(items).slice(0, MAX_IMAGES);
            });
          },
          function (error) {
            setStatus({ kind: 'err', msg: error && error.message ? error.message : '读图失败' });
          },
        );
      }

      function removeImage(key) {
        setImages(function (prev) {
          var next = [];
          for (var i = 0; i < prev.length; i += 1) {
            if (prev[i].key === key) revoke([prev[i]]);
            else next.push(prev[i]);
          }
          return next;
        });
      }

      function reset() {
        setText('');
        setImages(function (prev) {
          revoke(prev);
          return [];
        });
      }

      function save() {
        if (busy) return;
        var value = String(text || '').trim();
        if (!value && images.length === 0) {
          setStatus({ kind: 'err', msg: '写一句，或者拖张图进来' });
          return;
        }
        setBusy(true);
        setStatus(null);
        fetch('/dsh-idea-box/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: value,
            images: images.map(function (image) {
              return { name: image.name, data: image.data };
            }),
          }),
        })
          .then(function (response) {
            return response.text().then(function (raw) {
              var data = null;
              try {
                data = JSON.parse(raw);
              } catch (error) {
                data = null;
              }
              return { ok: response.ok, status: response.status, data: data };
            });
          })
          .then(function (result) {
            setBusy(false);
            if (result.ok && result.data && result.data.ok) {
              reset();
              setStatus({ kind: 'ok', msg: '已存' });
              timerRef.current = setTimeout(function () {
                setStatus(null);
                setOpen(false);
              }, 1000);
              return;
            }
            var message =
              (result.data && (result.data.error || result.data.message)) ||
              '保存失败（HTTP ' + result.status + '）';
            setStatus({ kind: 'err', msg: message });
          })
          .catch(function (error) {
            setBusy(false);
            setStatus({
              kind: 'err',
              msg: '保存失败：' + (error && error.message ? error.message : '网络不通'),
            });
          });
      }

      function onKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          save();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          setStatus(null);
        }
      }

      function onPaste(event) {
        var data = event.clipboardData;
        if (!data || !data.items) return;
        var picked = [];
        for (var i = 0; i < data.items.length; i += 1) {
          var item = data.items[i];
          if (item.kind === 'file' && String(item.type).indexOf('image/') === 0) {
            var file = item.getAsFile();
            if (file) picked.push(file);
          }
        }
        if (picked.length) {
          event.preventDefault();
          addFiles(picked);
        }
      }

      if (!open) {
        return h(
          'div',
          { className: 'dib-root', style: LAYOUT.root },
          h(
            'button',
            {
              type: 'button',
              className: 'dib-fab',
              title: '记一条（可以拖截图）',
              'aria-label': '记一条',
              onClick: function () {
                setStatus(null);
                setOpen(true);
              },
            },
            lightbulb(20),
          ),
        );
      }

      return h(
        'div',
        { className: 'dib-root' },
        h(
          'div',
          {
            className: 'dib-card' + (dragging ? ' is-drag' : ''),
            style: LAYOUT.card,
            onDragEnter: function (event) {
              event.preventDefault();
              dragDepth.current += 1;
              setDragging(true);
            },
            onDragOver: function (event) {
              event.preventDefault();
            },
            onDragLeave: function (event) {
              event.preventDefault();
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            },
            onDrop: function (event) {
              event.preventDefault();
              dragDepth.current = 0;
              setDragging(false);
              addFiles(event.dataTransfer ? event.dataTransfer.files : null);
            },
          },
          h(
            'div',
            { className: 'dib-head' },
            h('span', null, '记一条 · 回车存'),
            h(
              'button',
              {
                type: 'button',
                className: 'dib-close',
                title: '收起',
                'aria-label': '收起',
                onClick: function () {
                  setOpen(false);
                  setStatus(null);
                },
              },
              '\u00d7',
            ),
          ),
          h('textarea', {
            ref: inputRef,
            className: 'dib-input',
            style: LAYOUT.input,
            rows: 2,
            value: text,
            maxLength: 2000,
            placeholder: '一句话。想不起来怎么写就先拖张截图进来。',
            onChange: function (event) {
              setText(event.target.value);
            },
            onKeyDown: onKeyDown,
            onPaste: onPaste,
          }),
          h(
            'div',
            { className: 'dib-drop' + (dragging ? ' is-over' : ''), style: LAYOUT.drop },
            images.map(function (image) {
              return h(
                'div',
                { className: 'dib-thumb', key: image.key, title: image.name },
                h('img', { src: image.url, alt: image.name }),
                h(
                  'button',
                  {
                    type: 'button',
                    title: '删掉这张',
                    onClick: function () {
                      removeImage(image.key);
                    },
                  },
                  '\u00d7',
                ),
              );
            }),
            h(
              'span',
              { className: 'dib-hint' },
              images.length
                ? images.length + '/' + MAX_IMAGES + ' 张 · 还能再拖'
                : '拖截图到这里，或 Ctrl+V 粘贴',
            ),
          ),
          h(
            'div',
            { className: 'dib-dir', style: LAYOUT.dir },
            editingDir
              ? [
                  h('input', {
                    key: 'input',
                    value: dirDraft,
                    placeholder: '完整路径，比如 E:\\我的想法',
                    onChange: function (event) {
                      setDirDraft(event.target.value);
                    },
                    onKeyDown: function (event) {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        saveDir(dirDraft);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingDir(false);
                      }
                    },
                  }),
                  h(
                    'button',
                    {
                      key: 'ok',
                      type: 'button',
                      onClick: function () {
                        saveDir(dirDraft);
                      },
                    },
                    '存',
                  ),
                  h(
                    'button',
                    {
                      key: 'cancel',
                      type: 'button',
                      onClick: function () {
                        setEditingDir(false);
                      },
                    },
                    '取消',
                  ),
                ]
              : [
                  h(
                    'span',
                    {
                      key: 'path',
                      className: 'dib-path',
                      title: dirInfo && dirInfo.dir ? dirInfo.dir : '',
                    },
                    dirInfo && dirInfo.error
                      ? '读不到保存位置'
                      : dirInfo && dirInfo.dir
                        ? '存到 ' + dirInfo.dir
                        : '存到 读取中…',
                  ),
                  h(
                    'button',
                    {
                      key: 'edit',
                      type: 'button',
                      onClick: startEditDir,
                    },
                    '改',
                  ),
                  dirInfo && dirInfo.source === 'custom'
                    ? h(
                        'button',
                        {
                          key: 'reset',
                          type: 'button',
                          onClick: function () {
                            saveDir('');
                          },
                        },
                        '恢复默认',
                      )
                    : null,
                ],
          ),
          h(
            'div',
            { className: 'dib-foot', style: LAYOUT.foot },
            h(
              'span',
              { className: 'dib-status' + (status ? ' is-' + status.kind : '') },
              status ? status.msg : '',
            ),
            h(
              'button',
              { type: 'button', className: 'dib-save', disabled: busy, onClick: save },
              busy ? '存…' : '存',
            ),
          ),
        ),
      );
    }

    var inject = ['slots'];

    function apply(ctx) {
      installCss();
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register(
          { name: 'shell.overlay', id: 'dsh-idea-box', order: 230, label: '灵感小窗' },
          function () {
            return h(IdeaBox, {});
          },
        );
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
