(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const promptInput = $("prompt");
  const solveButton = $("solveButton");
  const errorMessage = $("errorMessage");
  const workspace = $("workspace");
  const resultView = $("resultView");
  const historyView = $("historyView");
  let selectedSubject = "Общий вопрос";
  let history = loadHistory();
  let currentAnswer = "";
  let toastTimer;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem("qlarx_history") || "[]"); } catch { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem("qlarx_history", JSON.stringify(history.slice(0, 30))); } catch {}
    $("historyCount").textContent = String(history.length);
  }
  function showToast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }
  function showError(message) { errorMessage.textContent = message; errorMessage.hidden = false; }
  function clearError() { errorMessage.hidden = true; errorMessage.textContent = ""; }
  function showView(view) {
    workspace.hidden = view !== "home";
    resultView.hidden = view !== "result";
    historyView.hidden = view !== "history";
    $("homeNav").classList.toggle("active", view === "home" || view === "result");
    $("historyNav").classList.toggle("active", view === "history");
    $("sidebar").classList.remove("open");
    window.scrollTo({top:0, behavior:"smooth"});
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  // Small safe Markdown renderer for AI text; raw HTML from the model is always escaped.
  function renderMarkdown(text) {
    const escaped = escapeHtml(text.replace(/\r\n/g,"\n"));
    const lines = escaped.split("\n");
    let html = "", list = null, inCode = false, code = [];
    const closeList = () => { if(list){html += `</${list}>`;list=null;} };
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        closeList();
        if (inCode) { html += `<pre><code>${code.join("\n")}</code></pre>`; code=[]; inCode=false; }
        else inCode=true;
        continue;
      }
      if (inCode) { code.push(line); continue; }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) { closeList(); const level=heading[1].length; html += `<h${level}>${inlineFormat(heading[2])}</h${level}>`; continue; }
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (bullet || numbered) {
        const wanted = bullet ? "ul" : "ol";
        if(list !== wanted){closeList();html += `<${wanted}>`;list=wanted;}
        html += `<li>${inlineFormat((bullet||numbered)[1])}</li>`; continue;
      }
      closeList();
      if (!line.trim()) { continue; }
      html += `<p>${inlineFormat(line)}</p>`;
    }
    closeList();
    if(inCode) html += `<pre><code>${code.join("\n")}</code></pre>`;
    return html || "<p>Ответ пуст. Попробуйте повторить запрос.</p>";
  }
  function inlineFormat(text) {
    return text
      .replace(/`([^`]+)`/g,"<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
      .replace(/\*(.+?)\*/g,"<em>$1</em>");
  }
  function renderHistory() {
    const list = $("historyList");
    $("historyCount").textContent = String(history.length);
    if (!history.length) { list.innerHTML = '<div class="history-empty">Здесь появятся твои недавние решения.<br>Реши первую задачу, чтобы начать.</div>'; return; }
    list.innerHTML = history.map((item,index) => `<button class="history-item" data-history="${index}"><span class="history-symbol">✧</span><span><strong>${escapeHtml(item.prompt.slice(0,95))}${item.prompt.length>95?"…":""}</strong><small>${escapeHtml(item.subject)} · ${escapeHtml(item.date)}</small></span></button>`).join("");
    list.querySelectorAll("[data-history]").forEach(btn => btn.addEventListener("click", () => {
      const item = history[Number(btn.dataset.history)];
      $("questionText").textContent = item.prompt;
      $("resultMeta").textContent = `${item.subject} · ${item.date}`;
      $("answerText").innerHTML = renderMarkdown(item.answer);
      currentAnswer = item.answer; showView("result");
    }));
  }
  async function solve() {
    const question = promptInput.value.trim();
    if (!question) { showError("Сначала напиши задание или выбери пример ниже."); promptInput.focus(); return; }
    clearError();
    const apiBase = (window.QLARX_CONFIG?.apiBase || "").replace(/\/+$/,"");
    if (!apiBase && location.protocol === "file:") { showError("Откройте сайт через веб-сервер, а не напрямую как файл. См. README.md."); return; }
    solveButton.disabled = true;
    solveButton.innerHTML = '<span class="button-star">✦</span> Думаю над задачей…';
    try {
      const response = await fetch(`${apiBase}/api/solve`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({question, subject:selectedSubject, grade:$("grade").value, stepByStep:$("explain").checked})
      });
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(data.error || `Сервер ответил с кодом ${response.status}.`);
      if (!data.answer || typeof data.answer !== "string") throw new Error("Сервер не вернул ответ. Попробуйте ещё раз.");
      currentAnswer = data.answer;
      $("questionText").textContent = question;
      $("resultMeta").textContent = `${selectedSubject} · ${$("grade").value === "не указан" ? "класс не указан" : $("grade").value === "Колледж / вуз" ? "Колледж / вуз" : $("grade").value + " класс"}`;
      $("answerText").innerHTML = renderMarkdown(data.answer);
      const item = {prompt:question, subject:selectedSubject, answer:data.answer, date:new Date().toLocaleString("ru-RU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})};
      history.unshift(item); history = history.slice(0,30); saveHistory();
      showView("result");
    } catch (error) {
      const msg = error instanceof TypeError
        ? "Не удалось подключиться к серверу ИИ. Проверьте интернет, адрес backend и настройки CORS."
        : error.message;
      showError(msg);
    } finally {
      solveButton.disabled = false;
      solveButton.innerHTML = '<span class="button-star">✦</span> Решить задачу <span class="button-arrow">↗</span>';
    }
  }
  document.querySelectorAll(".subject-chip").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".subject-chip").forEach(b => b.classList.remove("selected"));
    button.classList.add("selected"); selectedSubject = button.dataset.subject;
  }));
  document.querySelectorAll(".example-card").forEach(button => button.addEventListener("click", () => {
    promptInput.value = button.dataset.prompt;
    if (button.dataset.prompt.includes("уравнение")) { selectedSubject="Математика"; }
    else if (button.dataset.prompt.includes("закон сохранения")) { selectedSubject="Физика"; }
    else { selectedSubject="Русский язык"; }
    document.querySelectorAll(".subject-chip").forEach(b => b.classList.toggle("selected", b.dataset.subject===selectedSubject));
    promptInput.focus(); promptInput.scrollIntoView({behavior:"smooth",block:"center"});
  }));
  solveButton.addEventListener("click", solve);
  promptInput.addEventListener("keydown", e => { if((e.ctrlKey||e.metaKey)&&e.key==="Enter") solve(); });
  $("newChat").addEventListener("click", () => { promptInput.value="";clearError();showView("home");promptInput.focus(); });
  $("backButton").addEventListener("click", () => { showView("home");promptInput.focus(); });
  $("homeNav").addEventListener("click", () => showView("home"));
  $("historyNav").addEventListener("click", () => {renderHistory();showView("history");});
  $("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  $("clearHistory").addEventListener("click", () => {
    if (!history.length) {showToast("История уже пуста.");return;}
    if (confirm("Удалить всю историю решений из этого браузера?")) {history=[];saveHistory();renderHistory();showToast("История очищена.");}
  });
  $("copyButton").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(currentAnswer); showToast("Ответ скопирован."); }
    catch { showToast("Не удалось скопировать. Выделите текст вручную."); }
  });
  $("themeHint").addEventListener("click", () => showToast("QLarx AI 2.0 — учись понимать ✦"));
  saveHistory();
})();