window.__ModuleLoader__.load({
  id: 'dsh-client-ui-show-widget',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Card copy, kept beside the row because the UI otherwise reads plain labels. */
    const COPY = {
      preparing: 'Preparing widget',
      running: 'Rendering widget',
      failed: 'Widget failed',
      empty: 'The widget source is empty.',
      source: 'Source',
      showSource: 'Source',
      hideSource: 'Hide source',
      untitled: 'Widget',
    }

    const MIN_HEIGHT = 20
    const MAX_HEIGHT = 2000

    /** First physical line, for the collapsed error summary. */
    function firstLine(text) {
      const newline = text.indexOf('\n')
      return newline === -1 ? text : text.slice(0, newline)
    }

    /** The settled node carries the call payload; a running node carries it directly. */
    function callArgs(block) {
      return ('kind' in block ? block.call?.argsRaw : block.argsRaw) ?? ''
    }

    /** Tolerate streamed or malformed argument text instead of throwing mid-render. */
    function parseArgs(argsRaw) {
      try {
        const parsed = JSON.parse(argsRaw)
        if (typeof parsed === 'object' && parsed !== null) return parsed
      } catch {}
      return {}
    }

    /**
     * Read a payload field written as either the call arguments or its `arguments` envelope.
     * @param payload - parsed arguments.
     * @param key - camelCase field name.
     * @param snake - snake_case wire name.
     */
    function field(payload, key, snake) {
      const envelope = typeof payload.arguments === 'object' && payload.arguments !== null
        ? payload.arguments
        : {}
      const value = payload[key] ?? envelope[key] ?? payload[snake] ?? envelope[snake]
      return value
    }

    /** Normalize the optional status lines: an array, a JSON string, or a delimited string. */
    function stringList(value) {
      if (Array.isArray(value)) {
        return value.map((item) => (typeof item === 'string' ? item : String(item))).map((item) => item.trim()).filter(Boolean)
      }
      if (typeof value === 'string' && value.trim() !== '') return [value.trim()]
      return []
    }

    /** Result text under the generic Tool-row text contract. */
    function resultText(block) {
      if (!('kind' in block)) return null
      const parts = []
      for (const item of block.content) {
        parts.push(item.type === 'text' ? item.text : JSON.stringify(item, null, 2))
      }
      if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`)
      return parts.join('\n') || null
    }

    /**
     * Derive the card model without leaving the row.
     * @param block - running or settled tool call node.
     */
    function widgetModel(block) {
      const settled = 'kind' in block
      const payload = parseArgs(callArgs(block))
      const title = field(payload, 'title')
      const code = field(payload, 'widgetCode', 'widget_code')
      return {
        title: typeof title === 'string' && title !== '' ? firstLine(title) : COPY.untitled,
        code: typeof code === 'string' ? code : '',
        loading: stringList(field(payload, 'loadingMessages', 'loading_messages')),
        state: !settled ? 'running' : block.error?.code === 'interrupted' ? 'stopped' : block.isError ? 'error' : 'ok',
        output: resultText(block),
      }
    }

    /**
     * Vendor assets are compiled in by scripts/bundle-vendor.mjs as a single
     * module of string constants; the browser half cannot read from disk.
     */
    const VENDOR = window.__DSH_SHOW_WIDGET_VENDOR__ ?? null

    /**
     * Content-Security-Policy for the widget frame. Modelled on the WorkBuddy
     * sandbox: nothing loads by default, scripts and styles are inline or blob,
     * and no network egress is possible.
     */
    const CSP = [
      "default-src 'none'",
      "script-src 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'unsafe-inline' blob:",
      'img-src data: blob:',
      'font-src data: blob:',
      "connect-src 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ')

    /**
     * Helper classes mirroring the WorkBuddy widget palette, so model-authored
     * SVG can opt into consistent colours without carrying its own theme.
     */
    const WIDGET_CSS = [
      'html,body{margin:0;padding:0;background:transparent;overflow:hidden;',
      'color-scheme:light dark;font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;',
      '--wb-text:#1a1a1a;--wb-text-2:#666;--wb-border:#e0e0e0;--wb-bg-2:#f5f5f5;--wb-bg-3:#ebebeb}',
      '@media (prefers-color-scheme:dark){html{--wb-text:#e6e6e6;--wb-text-2:#a0a0a0;',
      '--wb-border:#3a3a3a;--wb-bg-2:#232323;--wb-bg-3:#2e2e2e}}',
      '#root{display:flow-root}*{max-width:100%}*{box-sizing:border-box}',
      'table{border-collapse:collapse;width:100%;font-size:13px}',
      'th,td{padding:7px 10px;border-bottom:1px solid var(--wb-border);text-align:left}',
      'th{font-weight:600;color:var(--wb-text)}td{color:var(--wb-text)}',
      '.t{font-size:14px;fill:var(--wb-text)}.ts{font-size:12px;fill:var(--wb-text-2)}',
      '.th{font-size:14px;font-weight:500;fill:var(--wb-text)}',
      '.box{fill:var(--wb-bg-2);stroke:var(--wb-border);stroke-width:1;rx:6}',
      '.node{cursor:pointer}.node:hover .box{fill:var(--wb-bg-3)}',
      '.arr{stroke:var(--wb-text-2);stroke-width:1.5;fill:none}',
      '.c-purple{--n-bg:#EEEDFE;--n-bd:#7F77DD;--n-tx:#26215C}',
      '.c-teal{--n-bg:#E1F5EE;--n-bd:#1D9E75;--n-tx:#04342C}',
      '.c-coral{--n-bg:#FAECE7;--n-bd:#D85A30;--n-tx:#4A1B0C}',
      '.c-pink{--n-bg:#FBEAF0;--n-bd:#D4537E;--n-tx:#4B1528}',
      '.mermaid{display:flex;justify-content:center}',
      '.mermaid svg{max-width:100%;height:auto}',
      '.mermaid-error{padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.5;',
      'background:rgba(211,47,47,.08);border:1px solid rgba(211,47,47,.3);',
      'color:#d33;white-space:pre-wrap;font-family:ui-monospace,monospace}',
    ].join('')

    /** Bootstrap logic for the frame: vendor boot, then fenced-block upgrades. */
    function frameScript() {
      return [
        '(function(){',
        'var root=document.getElementById("root");',
        // --- height reporting -------------------------------------------------
        'function report(){',
        'try{',
        'var box=root.getBoundingClientRect();',
        'var height=Math.ceil(box.height+root.offsetTop);',
        // Stay quiet while the fragment is still laying out: the parent treats a
        // zero as "not laid out yet" and asks again later.
        'if(height>0)parent.postMessage({type:"dsh-show-widget-height",height:height},"*");',
        '}catch(e){}',
        '}',
        // Expanding a collapsed transcript item does not re-fire layout observers
        // inside a sandboxed frame, so the parent pings and the frame answers.
        'window.addEventListener("message",function(e){var d=e.data;if(d&&d.type==="dsh-show-widget-ask")report();});',
        // Tell the parent to send the libraries; it cannot seed them directly.
        'function hello(){',
        'try{parent.postMessage({type:"dsh-show-widget-ready"},"*");}catch(e){}',
        '}',
        'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",hello);}else{hello();}',
        'if(window.ResizeObserver){new ResizeObserver(report).observe(root);}',
        // Mermaid and KaTeX draw after the first paint, so the first measurement
        // is always too small. Re-measure on every subtree mutation and on a few
        // trailing timers, because a sandboxed srcdoc frame does not always get a
        // ResizeObserver callback when the content grows.
        'if(window.MutationObserver){new MutationObserver(report).observe(root,{childList:true,subtree:true,characterData:true});}',
        'window.addEventListener("load",report);',
        '[0,16,50,120,300,700,1500].forEach(function(t){setTimeout(report,t);});',
        // --- fenced block extraction ------------------------------------------
        // A model writes ```mermaid ... ``` inside markup; turn each into a div.
        'function liftFences(){',
        // A model writes "<br>" for a line break inside a mermaid label, but the
        // HTML parser turns it into an element and splits the fence across several
        // text nodes, which truncates the diagram. Park every break as a
        // placeholder first, lift the fences, then put the breaks back outside them.
        'var breaks=[].slice.call(root.querySelectorAll("br"));',
        'breaks.forEach(function(br){if(br.parentNode)br.parentNode.replaceChild(document.createTextNode("\\u0001"),br);});',
        // The placeholder only replaces the elements; the text stays in adjacent
        // nodes, so merge them or the fence is still cut into pieces.
        'if(root.normalize)root.normalize();',
        'var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);',
        'var targets=[];',
        'while(walker.nextNode()){',
        'if(/```\\s*mermaid/.test(walker.currentNode.nodeValue||""))targets.push(walker.currentNode);',
        '}',
        'targets.forEach(function(node){',
        'var text=node.nodeValue||"";',
        'var host=node.parentNode;',
        'var parts=text.split(/```\\s*mermaid\\s*\\n?/);',
        'parts.forEach(function(part,index){',
        'if(index===0){if(part.trim()!=="")host.insertBefore(document.createTextNode(part),node);return;}',
        'var body=part.split("```")[0];',
        'var div=document.createElement("div");',
        'div.className="mermaid";',
        // mermaid wants "<br/>" in the source; textContent keeps it literal.
        'div.textContent=body.trim().split("\\u0001").join("<br/>");',
        'host.insertBefore(div,node);',
        '});',
        'host.removeChild(node);',
        '});',
        // Restore the breaks that were not inside a lifted fence.
        'var restore=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);',
        'var pending=[];',
        'while(restore.nextNode()){if((restore.currentNode.nodeValue||"").indexOf("\\u0001")!==-1)pending.push(restore.currentNode);}',
        'pending.forEach(function(node){',
        'var host=node.parentNode;if(!host)return;',
        'var frag=document.createDocumentFragment();',
        'var pieces=(node.nodeValue||"").split("\\u0001");',
        'pieces.forEach(function(piece,index){',
        'if(index>0)frag.appendChild(document.createElement("br"));',
        'if(piece!=="")frag.appendChild(document.createTextNode(piece));',
        '});',
        'host.replaceChild(frag,node);',
        '});',
        '}',
        // --- KaTeX: $$...$$ and \\(...\\) -----------------------------------------
        'function renderMath(){',
        'if(!window.katex)return;',
        'var html=root.innerHTML;',
        'if(html.indexOf("$$")===-1&&html.indexOf("\\\\(")===-1)return;',
        'var replaced=html',
        '.replace(/\\$\\$([\\s\\S]+?)\\$\\$/g,function(m,tex){',
        'try{return window.katex.renderToString(tex,{displayMode:true,throwOnError:false});}catch(e){return m;}',
        '})',
        '.replace(/\\\\\\(([\\s\\S]+?)\\\\\\)/g,function(m,tex){',
        'try{return window.katex.renderToString(tex,{displayMode:false,throwOnError:false});}catch(e){return m;}',
        '});',
        'if(replaced!==html)root.innerHTML=replaced;',
        '}',
        // --- mermaid ----------------------------------------------------------
        'function renderMermaid(){',
        'var blocks=[].slice.call(root.querySelectorAll(".mermaid"));',
        'if(!blocks.length||!window.mermaid)return;',
        'try{',
        'window.mermaid.initialize({startOnLoad:false,theme:window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"default",securityLevel:"strict",fontFamily:"system-ui,sans-serif"});',
        '}catch(e){}',
        '[].reduce.call(blocks,function(chain,block,index){',
        'return chain.then(function(){',
        'var source=block.textContent||"";',
        'if(!source.trim())return null;',
        'return window.mermaid.render("mmd-"+index+"-"+Date.now(),source).then(function(out){',
        'block.innerHTML=out.svg;',
        'return null;',
        '}).catch(function(err){',
        'block.className="mermaid-error";',
        'block.textContent="Mermaid: "+((err&&err.message)||"render failed");',
        'return null;',
        '});',
        '});',
        '},Promise.resolve());',
        '}',
        // --- boot -------------------------------------------------------------
        // The libraries arrive by postMessage and are installed as blob scripts;
        // rendering waits for them, because a frame cannot load the parent's blob.
        'function installLibs(payload,done){',
        'var pending=0,finished=false;',
        'function step(){pending--;if(pending<=0&&!finished){finished=true;done();}}',
        'function load(source){',
        'if(typeof source!=="string"||source==="")return;',
        'pending++;',
        'try{',
        'var url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));',
        'var tag=document.createElement("script");',
        'tag.src=url;',
        'tag.onload=function(){step();};',
        'tag.onerror=function(){step();};',
        'document.head.appendChild(tag);',
        '}catch(e){step();}',
        '}',
        'load(payload&&payload.katexJs);',
        'load(payload&&payload.mermaid);',
        'if(pending===0&&!finished){finished=true;done();}',
        '}',
        'function upgrade(){',
        'try{liftFences();}catch(e){}',
        'try{renderMath();}catch(e){}',
        'try{renderMermaid();}catch(e){}',
        'setTimeout(report,30);',
        'setTimeout(report,400);',
        '}',
        'var booted=false;',
        'function boot(payload){',
        'if(booted)return;',
        'booted=true;',
        'installLibs(payload,upgrade);',
        '}',
        'window.addEventListener("message",function(event){',
        'var data=event.data;',
        'if(!data)return;',
        'if(data.type==="dsh-show-widget-probe"){',
        'try{parent.postMessage({type:"dsh-show-widget-probe",report:{',
        'blocks:root.querySelectorAll(".mermaid").length,',
        'svgs:document.querySelectorAll("svg").length,',
        'merr:document.querySelectorAll(".mermaid-error").length,',
        'katex:document.querySelectorAll(".katex").length,',
        'mermaid:typeof window.mermaid,',
        'katexGlobal:typeof window.katex,',
        'scripts:document.querySelectorAll("script[src^=\\"blob:\\"]").length,',
        'text:(root.textContent||"").slice(0,80)',
        '}},"*");}catch(e){}',
        'return;',
        '}',
        'if(data.type!=="dsh-show-widget-libs")return;',
        'boot(data.payload);',
        '});',        'var fallback=function(){',
        'if(!booted){',
        'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){upgrade();});}',
        'else{upgrade();}',
        '}',
        '};',
        'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",fallback);}else{fallback();}',
        'if(window.ResizeObserver){new ResizeObserver(report).observe(document.body);}',
        '})();',
      ].join('\n')
    }

    /**
     * Library source handed to each frame over `postMessage`.
     *
     * A frame sandboxed without `allow-same-origin` gets its own opaque origin, so
     * a blob URL minted here is unreadable there: `script[src]` would be blocked
     * and the library would never load. The frame therefore builds its own blob
     * URL from source it receives.
     */
    function vendorPayload() {
      return {
        katexJs: typeof VENDOR?.katexJs === 'string' ? VENDOR.katexJs : '',
        mermaid: typeof VENDOR?.mermaid === 'string' ? VENDOR.mermaid : '',
      }
    }

    /**
     * One sandboxed document for the fragment, sized to the card.
     * @param code - the model-authored HTML fragment.
     */
    function buildDocument(code) {
      const katexCss = VENDOR?.katexCss ?? ''
      // Library text rides in as globals: the frame cannot read the parent's
      // scope, and the blob URL has to be built from inside the document.
      return [
        '<!doctype html><html><head><meta charset="utf-8">',
        '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">',
        '<style>' + WIDGET_CSS + '</style>',
        katexCss === '' ? '' : '<style>' + katexCss + '</style>',
        '</head><body><div id="root">',
        code,
        '</div>',
        '<script>' + frameScript() + '<\/script>',
        '</body></html>',
      ].filter(Boolean).join('\n')
    }

    /**
     * Render the widget fragment in a subframe without same-origin reach.
     * The frame is opaque to this document, so height arrives by postMessage
     * rather than by measuring the child document (which would be unreachable).
     *
     * The host re-renders slot content into a fresh container often enough to
     * leave a React ref pointing at a detached node, so the live element is
     * resolved by its own marker instead of by ref.
     * @param props - the rendered source.
     */
    function WidgetFrame({ code, title, anchor }) {
      const [height, setHeight] = React.useState(0)

      React.useEffect(() => {
        const findFrame = () => {
          if (typeof document === 'undefined' || anchor === undefined) return null
          return document.querySelector(`iframe[data-widget-frame="${anchor}"]`)
        }
        const onMessage = (event) => {
          const live = findFrame()
          if (live === null || event.source !== live.contentWindow) return
          const data = event.data
          if (data === null || typeof data !== 'object') return
          // Hand the libraries over once the frame is live: the frame's opaque
          // origin cannot read a blob URL minted in this document.
          if (data.type === 'dsh-show-widget-ready') {
            live.contentWindow?.postMessage(
              { type: 'dsh-show-widget-libs', payload: vendorPayload() },
              '*',
            )
            return
          }
          if (data.type !== 'dsh-show-widget-height') return
          const reported = Number(data.height)
          // A frame inside a collapsed transcript item measures zero, and a real
          // widget is never zero tall, so a zero is always "not laid out yet".
          if (!Number.isFinite(reported) || reported <= 0) return
          const next = Math.min(Math.max(Math.ceil(reported), MIN_HEIGHT), MAX_HEIGHT)
          setHeight((current) => (Math.abs(current - next) <= 1 ? current : next))
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, [code, anchor])

      const sizing = height > 0 ? { height: `${height}px` } : { minHeight: '120px' }
      return h('iframe', {
        'data-widget-frame': anchor,
        title,
        srcDoc: buildDocument(code),
        sandbox: 'allow-scripts',
        referrerPolicy: 'no-referrer',
        style: {
          display: 'block',
          width: '100%',
          border: '0',
          background: 'transparent',
          ...sizing,
        },
      })
    }

    /** Byte size, so a large fragment stays possible to identify while collapsed. */
    function formatSize(code) {
      const bytes = new TextEncoder().encode(code).length
      return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
    }

    /**
     * One `show_widget` call as a card. The widget itself is the point of the
     * tool, so it renders immediately; only the source stays behind a toggle.
     * @param props - keyed toolview payload.
     */
    function WidgetRow(props) {
      const [open, setOpen] = React.useState(false)

      if (props.phase === 'preparing') {
        return h('div', {
          'data-tool': 'show_widget',
          'data-call-id': props.callId,
          'data-state': 'preparing',
          style: cardStyle,
        }, h('div', { style: headerStyle }, h('span', { style: titleStyle }, COPY.preparing)))
      }

      const model = widgetModel(props.block)
      const status = model.state === 'running'
        ? COPY.running
        : model.state === 'error'
          ? COPY.failed
          : model.state === 'stopped'
            ? null
            : null
      const summary = model.state === 'error' && model.output !== null ? firstLine(model.output) : status
      const expandable = model.code !== ''

      // Mirror the settled widget into the tail seat so it survives the process fold.
      React.useEffect(() => {
        if (model.code === '' || model.state !== 'ok') return
        widgetStore.publish({
          callId: props.callId,
          title: model.title,
          code: model.code,
        })
      }, [model.code, model.title, model.state, props.callId])

      return h('div', {
        'data-tool': 'show_widget',
        'data-call-id': props.callId,
        'data-state': model.state,
        style: cardStyle,
      }, [
        h('div', { key: 'header', style: headerStyle }, [
          h('span', { key: 'title', style: titleStyle }, model.title),
          h('span', { key: 'meta', style: metaStyle }, [
            summary === null ? null : h('span', { key: 'status', style: { color: model.state === 'error' ? 'var(--dsh-color-error, #d33)' : 'inherit' } }, summary),
            expandable
              ? h('button', {
                  key: 'source',
                  type: 'button',
                  style: sourceButtonStyle,
                  'aria-expanded': open,
                  onClick: () => setOpen((value) => !value),
                }, open ? COPY.hideSource : COPY.showSource)
              : null,
            expandable ? h('span', { key: 'size' }, formatSize(model.code)) : null,
          ].filter(Boolean)),
        ]),
        model.loading.length > 0 && model.state === 'running'
          ? h('div', { key: 'loading', style: loadingStyle }, model.loading[0])
          : null,
        model.code !== '' && model.state !== 'error'
          ? h(WidgetFrame, { key: 'frame', code: model.code, title: model.title, anchor: `row:${props.callId}` })
          : null,
        expandable && open
          ? h('pre', { key: 'source', style: sourceStyle }, h('code', null, model.code))
          : null,
      ].filter(Boolean))
    }

    const cardStyle = {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '10px 12px',
      borderRadius: '10px',
      border: '1px solid var(--dsh-color-border, rgba(127,127,127,.28))',
      background: 'var(--dsh-color-surface, rgba(127,127,127,.06))',
    }
    const headerStyle = {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: '12px',
      fontSize: '12px',
    }
    const titleStyle = {
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }
    const metaStyle = {
      display: 'flex',
      gap: '10px',
      flex: 'none',
      opacity: 0.7,
      fontSize: '11px',
    }
    const loadingStyle = { fontSize: '11px', opacity: 0.65 }
    /** Secondary affordance: the widget is visible, the source is opt-in. */
    const sourceButtonStyle = {
      font: 'inherit',
      fontSize: '11px',
      padding: '1px 6px',
      borderRadius: '5px',
      border: '1px solid var(--dsh-color-border, rgba(127,127,127,.3))',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      lineHeight: 1.5,
    }
    const sourceStyle = {
      margin: 0,
      maxHeight: '320px',
      overflow: 'auto',
      padding: '8px',
      borderRadius: '8px',
      background: 'var(--dsh-color-surface-sunken, rgba(127,127,127,.12))',
      fontSize: '11px',
      lineHeight: 1.5,
    }

    /**
     * Widgets produced in this render process, newest last. The tool row writes
     * here because the turn tail (where the widget is actually shown, outside the
     * collapsible process group) only receives `{turn, seq, openFile}`.
     */
    const widgetStore = {
      entries: [],
      listeners: new Set(),
      publish(entry) {
        const index = this.entries.findIndex((item) => item.callId === entry.callId)
        if (index === -1) this.entries.push(entry)
        else this.entries[index] = entry
        this.entries = this.entries.slice(-24)
        for (const listener of this.listeners) listener()
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
      },
      /**
       * Look up a settled widget by the call that produced it.
       *
       * Claiming used to go by a count watermark, but a tool row publishes from
       * its own effect while the transcript mounts that row BEFORE the tail, so
       * the watermark already included the widget and the tail rendered empty.
       * Ownership now comes from the transcript DOM, not from publish order.
       */
      lookup(callId) {
        if (callId === undefined || callId === null) return null
        const found = this.entries.find((item) => item.callId === callId)
        return found === undefined ? null : found
      },
    }

    /**
     * The turn tail seat: renders outside the collapsible process group, so a
     * finished widget is visible without opening anything.
     *
     * The claimed entry is held in state for the life of this tail, because the
     * tail re-renders whenever the store changes and re-claiming would let it
     * jump to a later turn's widget.
     */
    /**
     * Mermaid the model wrote as an ordinary fenced block instead of a widget.
     *
     * The chat host has no code-block render slot, and a turn tail receives no
     * message text. The tail mounts directly under its own turn, so the fences
     * are the `.md-code-block` nodes between this turn and the previous one.
     * @param root - this tail's own element.
     */
    function proseDiagrams(root) {
      if (root === null || root === undefined) return []
      const turn = root.closest('[data-turn-tail]')
      if (turn === null) return []
      const blocks = []
      let node = turn.previousElementSibling
      while (node !== null && node.getAttribute('data-turn-tail') === null) {
        if (node.matches?.('.md-code-block')) blocks.push(node)
        node.querySelectorAll?.('.md-code-block').forEach((block) => blocks.push(block))
        node = node.previousElementSibling
      }
      const sources = []
      for (const block of blocks) {
        const label = block.querySelector('[class*="infostring"], [data-code-block-banner]')
        const lang = (label?.textContent ?? '').trim().toLowerCase()
        if (lang !== 'mermaid') continue
        const source = block.querySelector('pre')?.textContent ?? ''
        if (source.trim() === '') continue
        sources.push(source.trim())
      }
      return sources
    }

    /**
     * The `show_widget` rows that belong to this tail's own turn.
     *
     * Publish order cannot decide ownership: the row's effect runs before the
     * tail mounts, so any count watermark already includes the widget. Every turn
     * is a sibling transcript item, so everything between this turn's tail item
     * and the previous turn's tail item is this turn's own. Read it from the DOM.
     * @param root - this tail's own element.
     */
    function turnWidgetCalls(root) {
      if (root === null || root === undefined) return []
      const turn = root.closest('[data-turn-tail]')
      if (turn === null) return []
      const anchorOf = (node) => node.getAttribute?.('data-chat-anchor-key') ?? ''
      let item = turn
      while (item !== null && !anchorOf(item).includes('turn-tail')) item = item.parentElement
      if (item === null) return []
      const calls = []
      const collect = (scope) => {
        const selector = '[data-tool="show_widget"][data-state="ok"][data-call-id]'
        scope.querySelectorAll?.(selector).forEach((node) => {
          calls.push(node.getAttribute('data-call-id'))
        })
      }
      collect(item)
      let node = item.previousElementSibling
      while (node !== null && !anchorOf(node).includes('turn-tail')) {
        collect(node)
        node = node.previousElementSibling
      }
      return calls
    }

    function WidgetTail(props) {
      const [entries, setEntries] = React.useState([])
      const [diagrams, setDiagrams] = React.useState([])
      // Slot content gets re-rendered into a fresh container, which leaves a ref
      // pointing at a detached node. Each tail carries its turn in the markup and
      // finds itself again by that key.
      const turnKey = props.turn === null || props.turn === undefined
        ? ''
        : String(props.turn.turn ?? props.turn.index ?? props.turn.id ?? props.turn.key ?? '')
      React.useEffect(() => {
        const findSelf = () => {
          if (typeof document === 'undefined') return null
          const nodes = [...document.querySelectorAll('[data-show-widget-tail]')]
          return nodes.find((el) => el.getAttribute('data-show-widget-tail') === turnKey) ?? null
        }
        const scan = () => {
          const node = findSelf()
          if (node === null) return
          const calls = turnWidgetCalls(node)
          const found = calls
            .map((callId) => widgetStore.lookup(callId))
            .filter((item) => item !== null)
          setEntries((current) =>
            current.length === found.length && current.every((item, index) => item.callId === found[index].callId)
              ? current
              : found,
          )
          const fences = proseDiagrams(node)
          setDiagrams((current) => (current.join('\u0000') === fences.join('\u0000') ? current : fences))
        }
        scan()
        // A transcript item can be collapsed while the reply streams in and only
        // expanded much later, which mounts the tool rows that own the widgets.
        // Keep rescanning for the life of the tail instead of for a fixed window.
        const timer = window.setInterval(scan, 600)
        const unsubscribe = widgetStore.subscribe(scan)
        return () => {
          window.clearInterval(timer)
          unsubscribe()
        }
      }, [turnKey])
      if (entries.length === 0 && diagrams.length === 0) {
        return h('span', { 'data-show-widget-tail': turnKey })
      }
      return h('div', { style: tailStyle, 'data-show-widget-tail': turnKey }, [
        ...entries.map((entry) => h(WidgetFrame, {
          key: entry.callId,
          code: entry.code,
          title: entry.title,
          anchor: `tail:${entry.callId}`,
        })),
        ...diagrams.map((source, index) => h(WidgetFrame, {
          key: `mermaid-${index}`,
          code: `<div class="mermaid">${source}</div>`,
          title: 'mermaid',
          anchor: `diagram:${turnKey}:${index}`,
        })),
      ])
    }

    const tailStyle = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      marginTop: '8px',
      padding: '10px 12px',
      borderRadius: '10px',
      border: '1px solid var(--dsh-color-border, rgba(127,127,127,.28))',
      background: 'var(--dsh-color-surface, rgba(127,127,127,.06))',
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // Lets the offline render probe build the exact document the frame uses.
        if (typeof window !== 'undefined') {
          window.__DSH_TEST_BUILD__ = buildDocument
          window.__DSH_TEST_PROSE__ = proseDiagrams
        }
        // One module-level tick keeps every widget frame measured. A per-component
        // timer is unreliable here: the host re-renders slot content into fresh
        // containers, so a frame can mount, collapse and expand between two React
        // effects of the component that owns it.
        if (typeof window !== 'undefined' && window.__DSH_WIDGET_TICK === undefined
          && typeof window.setInterval === 'function' && typeof document !== 'undefined') {
          window.__DSH_WIDGET_TICK = window.setInterval(() => {
            document.querySelectorAll('iframe[data-widget-frame]').forEach((frame) => {
              frame.contentWindow?.postMessage({ type: 'dsh-show-widget-ask' }, '*')
            })
          }, 800)
        }
        ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
          name: 'tool.call.toolview',
          key: 'show_widget',
        }, WidgetRow))
        ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
          name: 'conversation.chat.turnTail',
          id: 'show-widget-tail',
          order: 50,
        }, WidgetTail))
      },
    }
  },
})
