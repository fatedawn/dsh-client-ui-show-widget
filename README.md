# dsh-client-ui-show-widget

把对话里的「图」变成真的图。为 DeepSeek Harness（DSH）注册 `show_widget` 工具：模型直接产出内联 HTML/SVG 小组件，在你的消息流里渲染成一张卡片——内置 Mermaid 与 KaTeX，不落盘、不跳转、不开新窗口。

- 包名：`dsh-client-ui-show-widget`
- 版本：`0.2.0`
- 适配：DSH `>=44.0.0`
- 许可：MIT

---

## 需求

模型默认用文字描述结构：步骤写成编号段落，对比写成 Markdown 表格，架构写成「A 调用 B，B 调用 C」的散文。人脑读这种内容要自己在脑内重建图形，比看图慢一个量级；而 Markdown 表格在窄窗口会横向溢出，复杂流程更是完全无法表达。

已有的替代方案都有代价：让模型写文件再打开，中断对话流；让它输出图片链接，需要外部托管；让它画 ASCII 图，字符宽度一变就错位。

这个插件解决的就是这一段：**让图成为对话内容本身**，和文字一样可以滚动、可以夹在段落之间、可以逐条出现。

具体三个需求点：

1. 模型要有能力画——注册一个真实可调用的工具，并用系统提示词把「结构性回答优先出图」变成默认行为，而不是等用户开口要图。
2. 画出来的东西要能承载真实结构——流程图、时序图、类图、状态机、甘特、饼图、思维导图、散点/折线，以及公式。
3. 渲染必须隔离——模型产出的 HTML 不可信，不能在会话页面的主文档里直接执行。

## 效果

一次工具调用 = 消息流里一张卡片，卡片内是完整的交互文档。

实测（DSH 44.7.0 / Windows / 会话内 4 个 widget 连续渲染）：

| 观察项 | 结果 |
| --- | --- |
| 对比表格（4 行 3 列） | 卡片高度 696px，圆角边框完整，无横向溢出 |
| Mermaid 流程图 | 输出真实 `<svg>`，卡片高度 1287px，节点与连线可读 |
| 第二个表格 | 674px，与前一张样式一致 |
| 高度自适应 | 由 iframe 内 `documentElement.scrollHeight` 上报，钳制区间 20–2000px |
| 主题 | 跟随 `prefers-color-scheme`，Mermaid 自动切 `dark` / `default` |

渲染形态：

- 卡头显示标题、状态（`Preparing widget` → `Rendering widget` → 完成）、可折叠的源码。
- 卡片主体是 `sandbox="allow-scripts"` 的 `srcdoc` iframe，独立不透明源，CSP 默认禁止一切外部请求。
- 高度随内容增长自动上报，不出现内部滚动条；页面继续滚动的是会话本身。
- 工具返回给模型的是回执文本（`Widget "标题" rendered`），不是 widget 源码，避免同一份 HTML 在上下文里被重复计入。

## 使用场景

**架构与流程**：请求链路、微服务拓扑、CI 流水线、审批流。写成分层流程图，比三段文字快。

**对比与选型**：A/B 方案取舍、版本差异、能力矩阵。表格自带对齐与边框，窄窗口不塌。

**时序与状态**：接口调用顺序、重试与超时、状态机迁移。Mermaid `sequenceDiagram` / `stateDiagram-v2` 直接表达。

**公式与推导**：`$$...$$` 走 KaTeX，行内 `\(...\)` 同样支持；适合讲清一个损失函数或复杂度推导。

**可视化数据**：`xychart`、`pie`、`gantt`、`mindmap`——不追求出版级图表，只为让人一眼看出比例与先后。

**教程与说明**：分步骤操作图解、目录结构、键盘布局，用 HTML/SVG 精确控制位置。

不适合的场景：需要长期保存的正式图表（用文件）、需要交互后端的数据面板（用网页应用）、纯文字就能说清的一两句话。

## 安装

### 通过市场索引

在 DSH 的插件市场里添加索引 URL：

```
https://raw.githubusercontent.com/fatedawn/dsh-client-ui-show-widget/main/market/index.json
```

然后在「发现」里搜索 `show widget` 或直接安装 `dsh-client-ui-show-widget`。索引条目指向本仓库的固定 commit，安装即复现同一份代码。

### 手动安装

在 profile 目录（例如 `~/.dsh/profiles/desktop`）执行：

```bash
pnpm add dsh-client-ui-show-widget@git+https://github.com/fatedawn/dsh-client-ui-show-widget.git#22ff0cf2a9a77241a13485e21468221fde5ad223
```

或本地开发时直接链接：

```jsonc
// package.json
{
  "dependencies": {
    "dsh-client-ui-show-widget": "file:D:/开发/widget-plugin"
  },
  "dsh": {
    "profile": {
      "bundles": ["...", "dsh-client-ui-show-widget"]
    }
  }
}
```

插件通过 `cordis.patch.yml` 插入 `client-ui-show-widget` 行，Host 侧注册工具，Web 侧挂上工具视图。

## 工作原理

**Host 侧**（`lib/index.js`）：`apply(ctx)` 里做两件事——向 `systemPrompt` 注册 `show-widget:policy` 段落（order 950，先于各工具说明，设定「结构性回答直接出图」的预期），再向 `tools` 注册 `show_widget`（参数 `title` / `widget_code` / `loading_messages`）。`execute` 立即返回 `{ title, status: 'rendered' }`，渲染不阻塞对话。

**Web 侧**（`lib/client.js`）：按工具名接管工具卡片，在同一 turn 的尾部与每个调用行插入 iframe。

- 定位不靠 React ref，而靠 DOM 属性：`iframe[data-widget-frame="row:<callId>"]` / `tail:<turnKey>`。宿主会重渲染 slot 内容，ref 会悬空，属性查询不会。
- 高度上报走模块级单 tick（`window.__DSH_WIDGET_TICK`），不依赖各组件 effect 的先后顺序；布局完成前上报的 0 会被 20px 下限挡住，因此必须在布局后重读。
- `liftFences` 把正文里裸写的 ` ```mermaid ` 块提升为卡片，先用占位符替换 `<br>` 再做 `root.normalize()` 合并相邻文本节点——否则模型写在 label 里的换行会把 fence 切成两段，后半截泄漏成纯文本。
- 文档由 `buildDocument(code)` 生成：CSP `default-src 'none'`、脚本与样式仅内联/blob、KaTeX 样式内联、Mermaid/KaTeX 运行时作为字符串注入（`sandbox="allow-scripts"` 无 `allow-same-origin`，frame 拿不到父页面任何东西）。

**体积**：`lib/client.js` 约 8 MB，其中绝大部分是内联的 Mermaid 与 KaTeX。代价是一次性下载，收益是零外部请求、离线可用。

## 开发

```bash
npm run build     # 把 vendor/ 内联进 lib/client.js
npm test          # verify-render + verify-tail + verify-tool-runtime
```

源码是 `lib/client.src.js`（可读），产物是 `lib/client.js`（内联 vendor 后）。改完必须重新 build，否则运行的是旧产物。

`vendor/` 保留 Mermaid、KaTeX 的原始 min 文件与许可证，供重新打包与复审。

## 已知限制

- **Mermaid 布局在极窄容器里可能失败**：dagre 报 `Could not find a suitable point for the given distance` 时卡片显示错误框。同一张图在宽度充足处渲染正常；遇到时把图拆小或改用 HTML 表格。
- **不支持热更新 widget**：卡片是渲染时快照，模型后续修改需要新的工具调用。
- **不持久化**：widget 不进会话导出文件，重新打开会话时按调用参数重建。
- **单卡片高度上限 2000px**：超出部分在 iframe 内滚动，避免一张图吃掉整屏。
- **无外部资源**：CSP 禁止外链图片、字体、脚本。需要图片时用 `data:` URL 或内联 SVG。
