(function () {
  const data = window.DEERFLOW_DOCS || { system: {}, docs: [] };
  const docs = data.docs || [];
  const storageKey = "deerflow-learning-state-v1";
  const notesStorageKey = "deerflow-learning-notes-v1";
  const aiStorageKey = "deerflow-learning-ai-chat-v1";
  const aiConfigStorageKey = "deerflow-learning-ai-config-v1";
  const localAiConfig = window.DEERFLOW_AI_CONFIG || {};
  const defaultAiConfig = {
    endpoint: localAiConfig.endpoint || "https://api.deepseek.com/chat/completions",
    model: localAiConfig.model || "deepseek-v4-pro",
    apiKey: localAiConfig.apiKey || "",
    webSearch: localAiConfig.webSearch !== false
  };
  const els = {
    content: document.getElementById("content"),
    docList: document.getElementById("docList"),
    courseMeta: document.getElementById("courseMeta"),
    progressPanel: document.getElementById("progressPanel"),
    notesPanel: document.getElementById("notesPanel"),
    outlinePanel: document.getElementById("outlinePanel"),
    searchPanel: document.getElementById("searchPanel"),
    search: document.getElementById("globalSearch"),
    toggleRaw: document.getElementById("toggleRaw"),
    resetProgress: document.getElementById("resetProgress"),
    mobileDrawer: document.getElementById("mobileDrawer"),
    mobileDrawerTitle: document.getElementById("mobileDrawerTitle"),
    mobileDrawerBody: document.getElementById("mobileDrawerBody"),
    mobileTabbar: document.querySelector(".mobile-tabbar")
  };

  const appState = {
    activeDocId: docs[0]?.id || "",
    view: "overview",
    query: "",
    rawMode: false,
    mobilePanel: "",
    railMode: "ai",
    aiMessages: loadAiMessages(),
    aiConfig: loadAiConfig(),
    aiBusy: false,
    docVersions: {},
    progress: loadProgress()
  };

  function loadProgress() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        completed: Array.isArray(stored.completed) ? stored.completed : [],
        lastDocId: stored.lastDocId || ""
      };
    } catch (error) {
      return { completed: [], lastDocId: "" };
    }
  }

  function saveProgress() {
    localStorage.setItem(storageKey, JSON.stringify(appState.progress));
  }

  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(notesStorageKey) || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveNotes(notes) {
    localStorage.setItem(notesStorageKey, JSON.stringify(notes));
  }

  function loadAiMessages() {
    try {
      const stored = JSON.parse(localStorage.getItem(aiStorageKey) || "[]");
      return Array.isArray(stored) ? stored.slice(-16) : [];
    } catch (error) {
      return [];
    }
  }

  function saveAiMessages() {
    localStorage.setItem(aiStorageKey, JSON.stringify(appState.aiMessages.slice(-16)));
  }

  function loadAiConfig() {
    try {
      const stored = JSON.parse(localStorage.getItem(aiConfigStorageKey) || "{}");
      return {
        endpoint: stored.endpoint || defaultAiConfig.endpoint,
        model: stored.model || defaultAiConfig.model,
        apiKey: stored.apiKey || defaultAiConfig.apiKey,
        webSearch: typeof stored.webSearch === "boolean" ? stored.webSearch : defaultAiConfig.webSearch
      };
    } catch (error) {
      return { ...defaultAiConfig };
    }
  }

  function saveAiConfig(nextConfig) {
    appState.aiConfig = {
      endpoint: nextConfig.endpoint || defaultAiConfig.endpoint,
      model: nextConfig.model || defaultAiConfig.model,
      apiKey: nextConfig.apiKey || "",
      webSearch: Boolean(nextConfig.webSearch)
    };
    try {
      localStorage.setItem(aiConfigStorageKey, JSON.stringify(appState.aiConfig));
    } catch (error) {
      // Ignore private-mode storage failures.
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "").toLowerCase();
  }

  function tokenize(value) {
    return Array.from(new Set(normalize(value).match(/[\u4e00-\u9fa5]{2,}|[a-z0-9_./-]{2,}/g) || []))
      .filter((term) => !["the", "and", "with", "from", "this", "that", "http", "https"].includes(term))
      .slice(0, 28);
  }

  function docNumber(doc) {
    return String(doc.order).padStart(2, "0");
  }

  function byId(id) {
    return docs.find((doc) => doc.id === id) || docs[0];
  }

  function activeDoc(baseDoc) {
    const doc = baseDoc || byId(appState.activeDocId);
    if (!doc?.versions?.length) return doc;
    const versionId = appState.docVersions[doc.id] || doc.currentVersion || doc.versions[doc.versions.length - 1].version;
    const version = doc.versions.find((item) => item.version === versionId) || doc.versions[doc.versions.length - 1];
    return { ...doc, ...version, versions: doc.versions, currentVersion: version.version };
  }

  function activeDocById(id) {
    return activeDoc(byId(id));
  }

  function isDone(docId) {
    return appState.progress.completed.includes(docId);
  }

  function headingId(docId, line) {
    return `${docId}-line-${line}`;
  }

  function renderInline(value) {
    const codeStore = [];
    let output = escapeHtml(value);
    output = output.replace(/`([^`]+)`/g, function (_match, code) {
      const token = `@@CODE${codeStore.length}@@`;
      codeStore.push(`<code>${code}</code>`);
      return token;
    });
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_match, text, url) {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${text}</a>`;
    });
    codeStore.forEach((html, index) => {
      output = output.replace(`@@CODE${index}@@`, html);
    });
    return output;
  }

  function isTableStart(lines, index) {
    return /^\s*\|.+\|\s*$/.test(lines[index] || "") && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[index + 1] || "");
  }

  function parseTable(lines, index) {
    const tableLines = [];
    let i = index;
    while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
      tableLines.push(lines[i]);
      i += 1;
    }
    const rows = tableLines
      .filter((_line, rowIndex) => rowIndex !== 1)
      .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
    const head = rows[0] || [];
    const body = rows.slice(1);
    const html = [
      "<table>",
      `<thead><tr>${head.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`,
      `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`,
      "</table>"
    ].join("");
    return { html, next: i };
  }

  function markdownToHtml(doc) {
    const lines = doc.markdown.split(/\r?\n/);
    const html = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (/^\s*```/.test(line)) {
        const language = line.replace(/^\s*```/, "").trim();
        const code = [];
        index += 1;
        while (index < lines.length && !/^\s*```/.test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        index += 1;
        html.push(`<pre data-language="${escapeHtml(language)}"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        continue;
      }

      const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        const text = heading[2].trim();
        html.push(`<h${level} id="${headingId(doc.id, index + 1)}">${renderInline(text)}</h${level}>`);
        index += 1;
        continue;
      }

      if (isTableStart(lines, index)) {
        const parsed = parseTable(lines, index);
        html.push(parsed.html);
        index = parsed.next;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const parts = [];
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
          parts.push(lines[index].replace(/^\s*>\s?/, ""));
          index += 1;
        }
        html.push(`<blockquote>${parts.map(renderInline).join("<br>")}</blockquote>`);
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
          index += 1;
        }
        html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
          index += 1;
        }
        html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
        continue;
      }

      if (/^\s*---+\s*$/.test(line)) {
        html.push("<hr>");
        index += 1;
        continue;
      }

      if (!line.trim()) {
        index += 1;
        continue;
      }

      const paragraph = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^\s*```/.test(lines[index]) &&
        !/^(#{1,6})\s+/.test(lines[index]) &&
        !/^\s*[-*]\s+/.test(lines[index]) &&
        !/^\s*\d+\.\s+/.test(lines[index]) &&
        !/^\s*>\s?/.test(lines[index]) &&
        !isTableStart(lines, index)
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }

    return html.join("\n");
  }

  function stripMarkdown(value) {
    return String(value || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`|[\]()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function highlight(value, query) {
    const safe = escapeHtml(value);
    if (!query || query.length < 2) return safe;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(new RegExp(escapedQuery, "gi"), (match) => `<mark class="match-mark">${match}</mark>`);
  }

  function searchDocs(query) {
    const q = normalize(query).trim();
    if (!q) return [];
    return docs
      .map((doc) => {
        const plain = stripMarkdown(doc.markdown);
        const haystack = normalize(`${doc.title} ${doc.file} ${plain}`);
        if (!haystack.includes(q)) return null;
        const hitIndex = haystack.indexOf(q);
        const snippetStart = Math.max(0, hitIndex - 70);
        const snippet = plain.slice(snippetStart, snippetStart + 180);
        const titleBoost = normalize(doc.title).includes(q) ? 2 : 0;
        return { doc, snippet, score: titleBoost + Math.max(0, 1 - hitIndex / Math.max(1, haystack.length)) };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }

  function setRoute(hash) {
    if (!hash || hash === "#/overview") {
      appState.view = "overview";
      return;
    }
    const match = /^#\/doc\/(.+)$/.exec(hash);
    if (match) {
      const doc = byId(match[1]);
      appState.activeDocId = doc.id;
      appState.progress.lastDocId = doc.id;
      appState.view = "doc";
      saveProgress();
    }
  }

  function openDoc(docId) {
    window.location.hash = `#/doc/${docId}`;
  }

  function goOverview() {
    window.location.hash = "#/overview";
  }

  function jumpToHeading(line) {
    const target = document.getElementById(headingId(activeDoc().id, line));
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.pageYOffset - 88;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function selectDocVersion(docId, version) {
    appState.docVersions[docId] = version;
    renderAll();
  }

  function noteKey(doc) {
    const current = activeDoc(doc);
    return `${current.id}::${current.currentVersion || "default"}`;
  }

  function getNote(doc) {
    return loadNotes()[noteKey(doc)] || "";
  }

  function setNote(doc, value) {
    const notes = loadNotes();
    const key = noteKey(doc);
    if (value.trim()) notes[key] = value;
    else delete notes[key];
    saveNotes(notes);
  }

  function bindNotesPanel(container, doc) {
    const textarea = container.querySelector("[data-note-text]");
    const status = container.querySelector("[data-note-status]");
    if (textarea) {
      textarea.addEventListener("input", () => {
        setNote(doc, textarea.value);
        if (status) status.textContent = textarea.value.trim() ? "已自动保存到本机浏览器" : "空笔记不会保存";
      });
    }
    const copyButton = container.querySelector("[data-note-copy]");
    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        const value = textarea?.value || "";
        if (!value.trim()) {
          if (status) status.textContent = "当前没有可复制的笔记";
          return;
        }
        try {
          await navigator.clipboard.writeText(value);
          if (status) status.textContent = "已复制到剪贴板";
        } catch (error) {
          if (status) status.textContent = "复制失败，可以手动选中文本复制";
        }
      });
    }
    const downloadButton = container.querySelector("[data-note-download]");
    if (downloadButton) {
      downloadButton.addEventListener("click", () => {
        const value = textarea?.value || "";
        if (!value.trim()) {
          if (status) status.textContent = "当前没有可导出的笔记";
          return;
        }
        const current = activeDoc(doc);
        const blob = new Blob([`# ${current.title} 笔记\n\n版本：${current.currentVersion || "default"}\n\n${value}\n`], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${current.id}-${current.currentVersion || "default"}-notes.md`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        if (status) status.textContent = "已生成本地 Markdown 笔记文件";
      });
    }
    const clearButton = container.querySelector("[data-note-clear]");
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        if (!textarea) return;
        textarea.value = "";
        setNote(doc, "");
        if (status) status.textContent = "已清空这篇当前版本的笔记";
      });
    }
  }

  function renderNotesHtml(doc) {
    const current = activeDoc(doc);
    return `
      <h3>阅读笔记</h3>
      <p class="note-context">${escapeHtml(current.shortTitle || current.title)}${current.currentVersion ? ` · v${escapeHtml(current.currentVersion)}` : ""}</p>
      <textarea class="note-textarea" data-note-text placeholder="在这里记录你的理解、疑问、待改造点。笔记会保存在本机浏览器，不会上传。">${escapeHtml(getNote(current))}</textarea>
      <div class="note-actions">
        <button class="ghost-button" type="button" data-note-copy>复制</button>
        <button class="ghost-button" type="button" data-note-download>导出</button>
        <button class="ghost-button" type="button" data-note-clear>清空</button>
      </div>
      <p class="note-status" data-note-status>${getNote(current).trim() ? "已从本机恢复笔记" : "还没有这篇当前版本的笔记"}</p>
    `;
  }

  function toggleDone(docId) {
    const completed = new Set(appState.progress.completed);
    if (completed.has(docId)) completed.delete(docId);
    else completed.add(docId);
    appState.progress.completed = Array.from(completed);
    saveProgress();
    renderAll();
  }

  function renderDocList() {
    els.courseMeta.textContent = `${data.system.totalLines || 0} 行原文，${data.system.totalHeadings || 0} 个章节标题，约 ${data.system.totalReadingMinutes || 0} 分钟阅读。`;
    els.docList.innerHTML = docs.map((doc) => `
      <button class="doc-link ${doc.id === appState.activeDocId && appState.view === "doc" ? "active" : ""} ${isDone(doc.id) ? "done" : ""}" type="button" data-doc-id="${doc.id}">
        <span class="doc-index">${docNumber(doc)}</span>
        <span>
          <strong>${escapeHtml(doc.shortTitle)}</strong>
          <small>${doc.headingCount} 节 · ${doc.codeFenceCount} 段代码 · ${doc.readingMinutes} 分钟</small>
        </span>
        <span class="check-dot" aria-hidden="true"></span>
      </button>
    `).join("");

    els.docList.querySelectorAll("[data-doc-id]").forEach((button) => {
      button.addEventListener("click", () => openDoc(button.dataset.docId));
    });
  }

  function renderMobileDocList() {
    return `
      <div class="doc-list">
        ${docs.map((doc) => `
          <button class="doc-link ${doc.id === appState.activeDocId && appState.view === "doc" ? "active" : ""} ${isDone(doc.id) ? "done" : ""}" type="button" data-mobile-doc-id="${doc.id}">
            <span class="doc-index">${docNumber(doc)}</span>
            <span>
              <strong>${escapeHtml(doc.shortTitle)}</strong>
              <small>${doc.headingCount} 节 · ${doc.codeFenceCount} 段代码 · ${doc.readingMinutes} 分钟</small>
            </span>
            <span class="check-dot" aria-hidden="true"></span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderProgressPanel() {
    const done = appState.progress.completed.length;
    const total = docs.length || 1;
    const percent = Math.round((done / total) * 100);
    const activeDoc = activeDocById(appState.activeDocId);
    els.progressPanel.innerHTML = `
      <h3>学习进度</h3>
      <div class="progress-bar" aria-label="学习进度"><span style="width:${percent}%"></span></div>
      <p class="progress-stat">已完成 ${done} / ${total} 篇，整体进度 ${percent}%。当前文档是 ${escapeHtml(activeDoc.shortTitle)}。</p>
      <div class="kbd-row">
        <button class="ghost-button" type="button" id="markDone">${isDone(activeDoc.id) ? "取消完成" : "标记当前篇完成"}</button>
        <button class="ghost-button" type="button" id="backOverview">返回总览</button>
      </div>
    `;
    document.getElementById("markDone").addEventListener("click", () => toggleDone(activeDoc.id));
    document.getElementById("backOverview").addEventListener("click", goOverview);
  }

  function renderNotesPanel() {
    const doc = activeDocById(appState.activeDocId);
    els.notesPanel.innerHTML = renderNotesHtml(doc);
    bindNotesPanel(els.notesPanel, doc);
  }

  function renderOutlineHtml(doc) {
    const visibleHeadings = doc.headings.filter((heading) => heading.level <= 4);
    return `
      <div class="outline-list">
        ${visibleHeadings.map((heading) => `
          <button class="outline-item level-${heading.level}" type="button" data-line="${heading.line}">
            ${escapeHtml(heading.text)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderAiMessageText(value) {
    const parts = String(value || "").split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) return `<pre><code>${escapeHtml(part.trim())}</code></pre>`;
      return part
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${renderInline(paragraph).replace(/\n/g, "<br>")}</p>`)
        .join("");
    }).join("");
  }

  function renderAiAssistantHtml() {
    const doc = activeDocById(appState.activeDocId);
    const messages = appState.aiMessages;
    const config = appState.aiConfig;
    return `
      <div class="ai-context">
        <strong>${escapeHtml(doc.shortTitle)}</strong>
        <span>当前章节 + 全站检索 + ${config.webSearch ? "网页搜索" : "仅本地资料"}</span>
      </div>
      <div class="ai-chat-log" data-ai-log>
        ${messages.length ? messages.map((message) => `
          <article class="ai-message ${message.role === "user" ? "user" : "assistant"}">
            <span>${message.role === "user" ? "你" : "AI"}</span>
            <div>${renderAiMessageText(message.content)}</div>
          </article>
        `).join("") : `
          <div class="ai-empty">
            <strong>可以边读边问。</strong>
            <p>它会定位你正在看的章节，检索其它文档相关片段；开启网页搜索时，还会补充 DuckDuckGo 搜索摘要。</p>
          </div>
        `}
      </div>
      <form class="ai-composer" data-ai-form>
        <div class="ai-config-grid">
          <label class="ai-key-field">
            <span>接口 URL</span>
            <input data-ai-endpoint type="url" value="${escapeHtml(config.endpoint)}" placeholder="https://api.deepseek.com/chat/completions" autocomplete="off">
          </label>
          <label class="ai-key-field">
            <span>模型 ID</span>
            <input data-ai-model type="text" value="${escapeHtml(config.model)}" placeholder="deepseek-v4-pro" autocomplete="off">
          </label>
          <label class="ai-key-field wide">
            <span>API Key</span>
            <input data-ai-key type="password" value="${escapeHtml(config.apiKey)}" placeholder="已从本机 Hermes 配置预填，可改" autocomplete="off">
          </label>
          <label class="ai-check-field">
            <input data-ai-web type="checkbox" ${config.webSearch ? "checked" : ""}>
            <span>允许网页搜索</span>
          </label>
        </div>
        <textarea data-ai-input rows="4" placeholder="例如：用新手能懂的话解释这一节的中间件执行顺序。"></textarea>
        <div class="ai-actions">
          <button class="primary-button" type="submit" ${appState.aiBusy ? "disabled" : ""}>${appState.aiBusy ? "思考中" : "提问"}</button>
          <button class="ghost-button" type="button" data-ai-clear>清空</button>
        </div>
        <p class="ai-status" data-ai-status>设置会保存到本机浏览器 localStorage。</p>
      </form>
    `;
  }

  function renderStudyPanel() {
    const doc = activeDocById(appState.activeDocId);
    els.outlinePanel.innerHTML = `
      <div class="rail-switch" role="tablist" aria-label="学习侧栏切换">
        <button class="${appState.railMode === "ai" ? "active" : ""}" type="button" data-rail-mode="ai" aria-pressed="${appState.railMode === "ai"}">问 AI</button>
        <button class="${appState.railMode === "outline" ? "active" : ""}" type="button" data-rail-mode="outline" aria-pressed="${appState.railMode === "outline"}">大纲</button>
      </div>
      ${appState.railMode === "outline" ? `<h3>本篇大纲</h3>${renderOutlineHtml(doc)}` : renderAiAssistantHtml()}
    `;
    els.outlinePanel.querySelectorAll("[data-rail-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        appState.railMode = button.dataset.railMode;
        renderStudyPanel();
      });
    });
    els.outlinePanel.querySelectorAll("[data-line]").forEach((button) => {
      button.addEventListener("click", () => jumpToHeading(Number(button.dataset.line)));
    });
    bindAiAssistantPanel();
  }

  function buildAiContext(doc) {
    const current = activeDoc(doc);
    const section = getCurrentSection(current);
    const outline = current.headings
      .filter((heading) => heading.level <= 4)
      .slice(0, 80)
      .map((heading) => `${"#".repeat(heading.level)} ${heading.text}`)
      .join("\n");
    const note = getNote(current).trim();
    return [
      `当前学习文档：${current.title}`,
      `版本：${current.currentVersion || "default"}`,
      `文件：${current.file}`,
      `当前所在章节：${section.title}`,
      "",
      "本篇大纲：",
      outline || "无",
      "",
      note ? `用户阅读笔记：\n${note}\n` : "",
      "当前章节原文：",
      section.markdown
    ].filter(Boolean).join("\n");
  }

  function getCurrentSection(doc) {
    const headings = doc.headings || [];
    if (!headings.length) {
      return { title: doc.title, markdown: doc.markdown.slice(0, 18000) };
    }
    let activeHeading = headings[0];
    headings.forEach((heading) => {
      const target = document.getElementById(headingId(doc.id, heading.line));
      if (target && target.getBoundingClientRect().top <= 130) activeHeading = heading;
    });
    const sameOrHigher = headings.find((heading) => heading.line > activeHeading.line && heading.level <= activeHeading.level);
    const lines = doc.markdown.split(/\r?\n/);
    const start = Math.max(0, activeHeading.line - 1);
    const end = sameOrHigher ? Math.max(start + 1, sameOrHigher.line - 1) : lines.length;
    const markdown = lines.slice(start, end).join("\n");
    return {
      title: activeHeading.text || doc.title,
      markdown: markdown.length > 18000 ? `${markdown.slice(0, 18000)}\n\n[当前章节过长，后续内容已截断。]` : markdown
    };
  }

  function splitDocChunks(doc) {
    const lines = doc.markdown.split(/\r?\n/);
    const headings = (doc.headings || []).length ? doc.headings : [{ line: 1, level: 1, text: doc.title }];
    return headings.map((heading, index) => {
      const next = headings[index + 1];
      const start = Math.max(0, heading.line - 1);
      const end = next ? Math.max(start + 1, next.line - 1) : lines.length;
      const markdown = lines.slice(start, end).join("\n").trim();
      return {
        doc,
        title: heading.text || doc.title,
        level: heading.level,
        line: heading.line,
        text: markdown.length > 2200 ? `${markdown.slice(0, 2200)}\n[片段截断]` : markdown
      };
    }).filter((chunk) => chunk.text);
  }

  function searchCorpus(question) {
    const terms = tokenize(question);
    if (!terms.length) return [];
    return docs.flatMap((doc) => splitDocChunks(activeDoc(doc))).map((chunk) => {
      const haystack = normalize(`${chunk.doc.title} ${chunk.doc.file} ${chunk.title} ${chunk.text}`);
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      const titleScore = terms.reduce((sum, term) => sum + (normalize(`${chunk.doc.title} ${chunk.title}`).includes(term) ? 2 : 0), 0);
      return { ...chunk, score: score + titleScore };
    }).filter((chunk) => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  function formatCorpusHits(hits) {
    if (!hits.length) return "未命中其它本地资料。";
    return hits.map((hit, index) => [
      `【本地资料 ${index + 1}】${hit.doc.shortTitle || hit.doc.title} · ${hit.title} · line ${hit.line}`,
      hit.text
    ].join("\n")).join("\n\n---\n\n");
  }

  async function fetchWebSearchContext(question) {
    if (!appState.aiConfig.webSearch) return "网页搜索未开启。";
    const query = encodeURIComponent(`${question} DeerFlow LangGraph`);
    const url = `https://r.jina.ai/http://duckduckgo.com/html/?q=${query}`;
    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) return `网页搜索失败：HTTP ${response.status}`;
      const text = await response.text();
      return text.slice(0, 6000);
    } catch (error) {
      return `网页搜索失败：${error.message || error}`;
    }
  }

  async function buildHermesMessages(question) {
    const doc = activeDocById(appState.activeDocId);
    const corpusHits = searchCorpus(question);
    const webContext = await fetchWebSearchContext(question);
    const recent = appState.aiMessages.slice(-8).map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.content
    }));
    return [
      {
        role: "system",
        content: [
          "你是 DeerFlow 学习系统里的随读助教。",
          "请用中文回答，优先围绕当前章节、本地资料检索结果和网页搜索结果解释。",
          "回答要清晰、分层、适合学习，不要编造文档里没有的源码事实。",
          "如果问题超出提供资料，请明确说明你是在推断。",
          "引用资料时，优先说明来自当前章节、本地其它文档，还是网页搜索摘要。"
        ].join("\n")
      },
      {
        role: "user",
        content: [
          "下面是当前阅读上下文和检索资料，请先理解它，后续回答都以这些资料为主要依据。",
          "",
          "## 当前阅读位置",
          buildAiContext(doc),
          "",
          "## 全站本地资料检索结果",
          formatCorpusHits(corpusHits),
          "",
          "## 网页搜索摘要",
          webContext
        ].join("\n")
      },
      ...recent,
      { role: "user", content: question }
    ];
  }

  async function askHermes(question, onDelta) {
    const config = appState.aiConfig;
    if (!config.apiKey) throw new Error("请先填入 API Key。");
    const messages = await buildHermesMessages(question);
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        temperature: 0.2,
        messages
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Hermes API 返回 ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!response.body || !contentType.includes("text/event-stream")) {
      const payload = await response.json();
      const answer = payload?.choices?.[0]?.message?.content || "";
      onDelta(answer);
      return answer;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      events.forEach((eventText) => {
        eventText.split("\n").forEach((line) => {
          if (!line.startsWith("data:")) return;
          const dataLine = line.slice(5).trim();
          if (!dataLine || dataLine === "[DONE]") return;
          try {
            const payload = JSON.parse(dataLine);
            const delta = payload?.choices?.[0]?.delta?.content || payload?.choices?.[0]?.message?.content || "";
            if (delta) {
              answer += delta;
              onDelta(delta);
            }
          } catch (error) {
            // Ignore keepalive or non-JSON SSE chunks.
          }
        });
      });
    }

    return answer;
  }

  function bindAiAssistantPanel() {
    if (appState.railMode !== "ai") return;
    const form = els.outlinePanel.querySelector("[data-ai-form]");
    const input = els.outlinePanel.querySelector("[data-ai-input]");
    const endpointInput = els.outlinePanel.querySelector("[data-ai-endpoint]");
    const modelInput = els.outlinePanel.querySelector("[data-ai-model]");
    const keyInput = els.outlinePanel.querySelector("[data-ai-key]");
    const webInput = els.outlinePanel.querySelector("[data-ai-web]");
    const status = els.outlinePanel.querySelector("[data-ai-status]");
    const clear = els.outlinePanel.querySelector("[data-ai-clear]");
    const log = els.outlinePanel.querySelector("[data-ai-log]");
    if (log) log.scrollTop = log.scrollHeight;
    clear?.addEventListener("click", () => {
      appState.aiMessages = [];
      saveAiMessages();
      renderStudyPanel();
    });
    const persistConfig = () => {
      saveAiConfig({
        endpoint: endpointInput?.value.trim() || defaultAiConfig.endpoint,
        model: modelInput?.value.trim() || defaultAiConfig.model,
        apiKey: keyInput?.value.trim() || "",
        webSearch: Boolean(webInput?.checked)
      });
      if (status) status.textContent = "AI 设置已保存到本机浏览器";
    };
    [endpointInput, modelInput, keyInput, webInput].forEach((control) => {
      control?.addEventListener("change", persistConfig);
    });
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = input?.value.trim() || "";
      if (!question || appState.aiBusy) return;
      persistConfig();
      appState.aiBusy = true;
      appState.aiMessages.push({ role: "user", content: question });
      appState.aiMessages.push({ role: "assistant", content: "" });
      saveAiMessages();
      renderStudyPanel();

      const assistantMessage = appState.aiMessages[appState.aiMessages.length - 1];
      try {
        if (status) status.textContent = appState.aiConfig.webSearch ? "正在检索本地资料和网页资料..." : "正在检索本地资料...";
        await askHermes(question, (delta) => {
          assistantMessage.content += delta;
          saveAiMessages();
          const last = els.outlinePanel.querySelector(".ai-message.assistant:last-child div");
          if (last) last.innerHTML = renderAiMessageText(assistantMessage.content);
          const activeLog = els.outlinePanel.querySelector("[data-ai-log]");
          if (activeLog) activeLog.scrollTop = activeLog.scrollHeight;
        });
        if (!assistantMessage.content.trim()) assistantMessage.content = "Hermes 没有返回文本内容。";
      } catch (error) {
        assistantMessage.content = [
          "AI 请求没有成功。",
          "",
          "请检查接口 URL、模型 ID 和 API Key 是否正确。",
          "",
          `错误信息：${error.message || error}`
        ].join("\n");
      } finally {
        appState.aiBusy = false;
        saveAiMessages();
        renderStudyPanel();
      }
    });
  }

  function renderSearchPanel() {
    const query = appState.query.trim();
    if (!query) {
      els.searchPanel.innerHTML = `
        <h3>全文搜索</h3>
        <p class="empty">输入关键词后，会在 12 篇 Markdown 原文里检索标题、正文和代码片段。</p>
      `;
      return;
    }
    const results = searchDocs(query).slice(0, 10);
    els.searchPanel.innerHTML = `
      <h3>搜索结果</h3>
      <div class="search-results">
        ${results.length ? results.map((item) => `
          <button class="result-item" type="button" data-doc-id="${item.doc.id}">
            <strong>${highlight(item.doc.shortTitle, query)}</strong>
            <span>${highlight(item.snippet, query)}</span>
          </button>
        `).join("") : `<p class="empty">没有找到与“${escapeHtml(query)}”相关的内容。</p>`}
      </div>
    `;
    els.searchPanel.querySelectorAll("[data-doc-id]").forEach((button) => {
      button.addEventListener("click", () => openDoc(button.dataset.docId));
    });
  }

  function closeMobileDrawer() {
    appState.mobilePanel = "";
    els.mobileDrawer.classList.remove("open");
    els.mobileDrawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
    els.mobileTabbar?.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
  }

  function openMobileDrawer(panel) {
    appState.mobilePanel = panel;
    const titles = {
      catalog: "课程目录",
      search: "全文搜索",
      outline: "本篇大纲",
      progress: "学习进度",
      notes: "阅读笔记"
    };
    els.mobileDrawerTitle.textContent = titles[panel] || "学习面板";
    els.mobileDrawerBody.innerHTML = renderMobilePanel(panel);
    els.mobileDrawer.classList.add("open");
    els.mobileDrawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    els.mobileTabbar?.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.mobileAction === panel);
    });
    bindMobilePanel(panel);
  }

  function renderMobilePanel(panel) {
    const doc = activeDocById(appState.activeDocId);
    if (panel === "catalog") {
      const done = appState.progress.completed.length;
      const total = docs.length || 1;
      const percent = Math.round((done / total) * 100);
      return `
        <div class="progress-bar" aria-label="学习进度"><span style="width:${percent}%"></span></div>
        <p class="progress-stat">已完成 ${done} / ${total} 篇，整体进度 ${percent}%。</p>
        <p class="empty">12 篇 Markdown 已完整导入。点击任意条目进入阅读。</p>
        ${renderMobileDocList()}
      `;
    }
    if (panel === "search") {
      const results = appState.query.trim() ? searchDocs(appState.query).slice(0, 12) : [];
      return `
        <label class="search-wrap" for="mobileSearch">
          <span>Search</span>
          <input id="mobileSearch" type="search" value="${escapeHtml(appState.query)}" placeholder="搜索 Sandbox、MCP、记忆..." autocomplete="off">
        </label>
        <div class="search-results">
          ${appState.query.trim()
            ? (results.length ? results.map((item) => `
              <button class="result-item" type="button" data-mobile-doc-id="${item.doc.id}">
                <strong>${highlight(item.doc.shortTitle, appState.query)}</strong>
                <span>${highlight(item.snippet, appState.query)}</span>
              </button>
            `).join("") : `<p class="empty">没有找到与“${escapeHtml(appState.query)}”相关的内容。</p>`)
            : `<p class="empty">输入关键词后，会在 12 篇 Markdown 原文里检索标题、正文和代码片段。</p>`}
        </div>
      `;
    }
    if (panel === "outline") {
      const visibleHeadings = doc.headings.filter((heading) => heading.level <= 4);
      return `
        <p class="empty">${escapeHtml(doc.shortTitle)}</p>
        <div class="outline-list">
          ${visibleHeadings.map((heading) => `
            <button class="outline-item level-${heading.level}" type="button" data-mobile-line="${heading.line}">
              ${escapeHtml(heading.text)}
            </button>
          `).join("")}
        </div>
      `;
    }
    if (panel === "notes") {
      return renderNotesHtml(doc);
    }
    if (panel === "progress") {
      const done = appState.progress.completed.length;
      const total = docs.length || 1;
      const percent = Math.round((done / total) * 100);
      return `
        <div class="progress-bar" aria-label="学习进度"><span style="width:${percent}%"></span></div>
        <p class="progress-stat">已完成 ${done} / ${total} 篇，整体进度 ${percent}%。当前文档是 ${escapeHtml(doc.shortTitle)}。</p>
        <div class="kbd-row">
          <button class="ghost-button" type="button" id="mobileMarkDone">${isDone(doc.id) ? "取消当前篇完成" : "标记当前篇完成"}</button>
          <button class="ghost-button" type="button" id="mobileBackOverview">返回总览</button>
        </div>
      `;
    }
    return `<p class="empty">没有可显示的面板。</p>`;
  }

  function bindMobilePanel(panel) {
    els.mobileDrawerBody.querySelectorAll("[data-mobile-doc-id]").forEach((button) => {
      button.addEventListener("click", () => {
        closeMobileDrawer();
        openDoc(button.dataset.mobileDocId);
      });
    });
    els.mobileDrawerBody.querySelectorAll("[data-mobile-line]").forEach((button) => {
      button.addEventListener("click", () => {
        closeMobileDrawer();
        jumpToHeading(Number(button.dataset.mobileLine));
      });
    });
    const mobileSearch = document.getElementById("mobileSearch");
    if (mobileSearch) {
      mobileSearch.addEventListener("input", (event) => {
        appState.query = event.target.value;
        els.search.value = appState.query;
        els.mobileDrawerBody.innerHTML = renderMobilePanel("search");
        bindMobilePanel("search");
        renderSearchPanel();
        if (appState.view === "overview") renderOverview();
      });
      mobileSearch.focus();
    }
    const mobileMarkDone = document.getElementById("mobileMarkDone");
    if (mobileMarkDone) {
      mobileMarkDone.addEventListener("click", () => {
        toggleDone(appState.activeDocId);
        openMobileDrawer("progress");
      });
    }
    const mobileBackOverview = document.getElementById("mobileBackOverview");
    if (mobileBackOverview) {
      mobileBackOverview.addEventListener("click", () => {
        closeMobileDrawer();
        goOverview();
      });
    }
    if (panel === "notes") {
      bindNotesPanel(els.mobileDrawerBody, activeDocById(appState.activeDocId));
    }
  }

  function renderOverview() {
    const system = data.system || {};
    const lastDoc = byId(appState.progress.lastDocId || docs[0]?.id);
    const results = appState.query.trim() ? searchDocs(appState.query).slice(0, 6) : [];
    els.content.classList.remove("raw-mode");
    els.content.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Learning Workspace</span>
          <h1>DeerFlow 2.0 全链路学习工作台</h1>
          <p>这套系统完整收录当前目录下的 12 篇 Markdown 文档，并把它们组织成可搜索、可追踪、可按架构路径学习的前端知识库。你可以从项目启动读到 Gateway、Runtime、中间件、记忆、工具沙箱、子代理、Skill、MCP 和模型适配。</p>
          <div class="hero-actions">
            <button class="primary-button" type="button" id="continueLearning">继续学习</button>
            <button class="secondary-button" type="button" id="startFirstDoc">从总纲开始</button>
          </div>
        </div>
        <div class="architecture-panel" aria-label="DeerFlow 架构学习图">
          <div class="arch-layer">
            <h3>IM Channels</h3>
            <p>Telegram、Discord、飞书、钉钉、Slack、微信和企业微信把外部消息带入系统。</p>
            <div class="arch-chips"><span>channels</span><span>message bus</span><span>thread mapping</span></div>
          </div>
          <div class="arch-arrow"></div>
          <div class="arch-layer">
            <h3>FastAPI Gateway</h3>
            <p>认证、安全中间件、REST API、运行创建、SSE 流式事件和渠道服务都在这一层收束。</p>
            <div class="arch-chips"><span>auth</span><span>csrf</span><span>runs</span><span>threads</span><span>stream</span></div>
          </div>
          <div class="arch-arrow"></div>
          <div class="arch-layer">
            <h3>LangGraph Runtime</h3>
            <p>Lead Agent 通过中间件链连接工具、沙箱、记忆、Skill、MCP 和 Sub-Agent。</p>
            <div class="arch-chips"><span>run_agent</span><span>make_lead_agent</span><span>middleware</span><span>sandbox</span></div>
          </div>
        </div>
      </section>

      <section class="dashboard-grid" aria-label="资料统计">
        <div class="metric-card"><b>${system.totalDocs || docs.length}</b><span>篇完整文档</span></div>
        <div class="metric-card"><b>${system.totalLines || 0}</b><span>行 Markdown 原文</span></div>
        <div class="metric-card"><b>${system.totalHeadings || 0}</b><span>个有效章节标题</span></div>
        <div class="metric-card"><b>${system.totalCodeFences || 0}</b><span>段代码或配置示例</span></div>
      </section>

      ${results.length ? `
        <section class="section">
          <div class="section-head">
            <h2>搜索命中</h2>
            <p>当前关键词“${escapeHtml(appState.query)}”在这些文档中出现。点击任意结果进入对应文档。</p>
          </div>
          <div class="course-grid">
            ${results.map((item) => renderDocCard(item.doc, item.snippet)).join("")}
          </div>
        </section>
      ` : ""}

      <section class="section">
        <div class="section-head">
          <h2>课程目录</h2>
          <p>所有 Markdown 文件都已完整导入。每张卡片显示章节数、代码块数量和估算阅读时长，适合按顺序学习，也适合按模块跳读。</p>
        </div>
        <div class="course-grid">
          ${docs.map((doc) => renderDocCard(doc)).join("")}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>三条学习路径</h2>
          <p>如果你不想线性阅读，可以按目标选择路径。每条路径仍会回到完整原文，不会把内容拆碎丢失。</p>
        </div>
        <div class="path-grid">
          <article class="path-card">
            <h3>只想跑起来</h3>
            <ol><li>项目启动</li><li>Gateway 层</li><li>总结与进阶</li></ol>
          </article>
          <article class="path-card">
            <h3>理解核心机制</h3>
            <ol><li>总纲</li><li>核心调度</li><li>中间件链</li><li>N 轮对话与记忆</li></ol>
          </article>
          <article class="path-card">
            <h3>准备二次开发</h3>
            <ol><li>工具和沙箱</li><li>子代理</li><li>Skill 系统</li><li>MCP 集成</li><li>模型适配</li></ol>
          </article>
        </div>
      </section>
      <div class="footer-note">数据来源：${escapeHtml(system.sourceRoot || "deerflow-docs")}。前端以本地静态文件运行，不需要后端服务。</div>
    `;

    document.getElementById("continueLearning").addEventListener("click", () => openDoc(lastDoc.id));
    document.getElementById("startFirstDoc").addEventListener("click", () => openDoc(docs[0].id));
    els.content.querySelectorAll("[data-card-doc-id]").forEach((card) => {
      card.addEventListener("click", () => openDoc(card.dataset.cardDocId));
    });
  }

  function renderDocCard(doc, snippet) {
    return `
      <article class="doc-card ${isDone(doc.id) ? "done" : ""}" data-card-doc-id="${doc.id}" tabindex="0">
        <div class="doc-card-top">
          <span class="doc-index">${docNumber(doc)}</span>
          <span class="metric-pill">${doc.versions?.length ? `v${doc.currentVersion}` : `${doc.readingMinutes} min`}</span>
        </div>
        <h3>${escapeHtml(doc.shortTitle)}</h3>
        <p>${snippet ? highlight(snippet, appState.query) : escapeHtml(doc.summary)}</p>
        <div class="card-meta">
          <span>${doc.headingCount} headings</span>
          <span>${doc.codeFenceCount} code</span>
          <span>${doc.lineCount} lines</span>
        </div>
      </article>
    `;
  }

  function renderVersionTabs(doc) {
    if (!doc.versions?.length) return "";
    return `
      <div class="version-tabs" aria-label="文档版本切换">
        ${doc.versions.map((version) => `
          <button class="version-tab ${version.version === doc.currentVersion ? "active" : ""}" type="button" data-version="${version.version}">
            <strong>${escapeHtml(version.label || version.version)}</strong>
            <span>${escapeHtml(version.badge || "")} · ${version.lineCount} 行 · ${version.headingCount} 节</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderReader() {
    const doc = activeDocById(appState.activeDocId);
    els.content.classList.toggle("raw-mode", appState.rawMode);
    els.content.innerHTML = `
      <article class="reader">
        <header class="reader-header">
          <span class="eyebrow">${escapeHtml(doc.file)}${doc.versions?.length ? ` · v${escapeHtml(doc.currentVersion)}` : ""}</span>
          <h1>${escapeHtml(doc.title)}</h1>
          <p>${escapeHtml(doc.summary)}</p>
          ${renderVersionTabs(doc)}
          <div class="reader-tools">
            <button class="primary-button" type="button" id="readerDone">${isDone(doc.id) ? "已完成，点击取消" : "标记本篇完成"}</button>
            <button class="secondary-button" type="button" id="readerNotes">写笔记</button>
            <button class="secondary-button" type="button" id="prevDoc">上一篇</button>
            <button class="secondary-button" type="button" id="nextDoc">下一篇</button>
            <span class="metric-pill">${doc.headingCount} 节</span>
            <span class="metric-pill">${doc.codeFenceCount} 段代码</span>
            <span class="metric-pill">${doc.lineCount} 行原文</span>
          </div>
        </header>
        <div class="reader-body">
          <div class="markdown">${markdownToHtml(doc)}</div>
          <div class="raw-view"><pre><code>${escapeHtml(doc.markdown)}</code></pre></div>
        </div>
      </article>
    `;

    document.getElementById("readerDone").addEventListener("click", () => toggleDone(doc.id));
    document.getElementById("readerNotes").addEventListener("click", () => {
      if (window.matchMedia("(max-width: 980px)").matches) {
        openMobileDrawer("notes");
      } else {
        const textarea = els.notesPanel?.querySelector("[data-note-text]");
        textarea?.focus();
      }
    });
    els.content.querySelectorAll("[data-version]").forEach((button) => {
      button.addEventListener("click", () => selectDocVersion(doc.id, button.dataset.version));
    });
    document.getElementById("prevDoc").addEventListener("click", () => {
      const prev = docs[Math.max(0, doc.order - 1)];
      openDoc(prev.id);
    });
    document.getElementById("nextDoc").addEventListener("click", () => {
      const next = docs[Math.min(docs.length - 1, doc.order + 1)];
      openDoc(next.id);
    });
  }

  function renderMain() {
    if (appState.view === "overview") renderOverview();
    else renderReader();
  }

  function renderAll() {
    renderDocList();
    renderProgressPanel();
    renderNotesPanel();
    renderStudyPanel();
    renderSearchPanel();
    renderMain();
    els.toggleRaw.setAttribute("aria-pressed", String(appState.rawMode));
    if (appState.mobilePanel) {
      openMobileDrawer(appState.mobilePanel);
    }
  }

  function boot() {
    setRoute(window.location.hash);
    renderAll();

    window.addEventListener("hashchange", () => {
      setRoute(window.location.hash);
      closeMobileDrawer();
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    els.search.addEventListener("input", (event) => {
      appState.query = event.target.value;
      renderSearchPanel();
      if (appState.view === "overview") renderOverview();
    });

    els.toggleRaw.addEventListener("click", () => {
      appState.rawMode = !appState.rawMode;
      renderMain();
      els.toggleRaw.setAttribute("aria-pressed", String(appState.rawMode));
    });

    els.resetProgress.addEventListener("click", () => {
      appState.progress.completed = [];
      saveProgress();
      renderAll();
    });

    els.mobileTabbar?.querySelectorAll("[data-mobile-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.mobileAction;
        if (action === "home") {
          closeMobileDrawer();
          goOverview();
          return;
        }
        openMobileDrawer(action);
      });
    });

    els.mobileDrawer?.querySelectorAll("[data-mobile-close]").forEach((button) => {
      button.addEventListener("click", closeMobileDrawer);
    });
  }

  boot();
})();
