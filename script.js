(function () {
  const sourceText = document.getElementById("sourceText");
  const outputText = document.getElementById("outputText");
  const previewDesktop = document.getElementById("previewDesktop");
  const previewMobile = document.getElementById("previewMobile");
  const inputMeter = document.getElementById("inputMeter");
  const outputMeter = document.getElementById("outputMeter");
  const copyState = document.getElementById("copyState");
  const issueList = document.getElementById("issueList");
  const previewWidth = document.getElementById("previewWidth");
  const previewWidthValue = document.getElementById("previewWidthValue");
  const densityRange = document.getElementById("densityRange");
  const densityLabel = document.getElementById("densityLabel");
  const densityHint = document.getElementById("densityHint");

  const formatBtn = document.getElementById("formatBtn");
  const restoreBtn = document.getElementById("restoreBtn");
  const inspectBtn = document.getElementById("inspectBtn");
  const clearBtn = document.getElementById("clearBtn");
  const copyBtn = document.getElementById("copyBtn");

  const blankAfterHeading = document.getElementById("blankAfterHeading");
  const splitJapanesePeriod = document.getElementById("splitJapanesePeriod");
  const protectLists = document.getElementById("protectLists");
  const viewNoteEditor = document.getElementById("viewNoteEditor");
  const viewMobileNovelist = document.getElementById("viewMobileNovelist");
  const viewNovelEditor = document.getElementById("viewNovelEditor");

  let lastSource = "";

  const storageKey = "note-text-polish:v1";
  const densityProfiles = {
    "-2": {
      label: "うさぴこ基準",
      hint: "以前の標準です。小説の密度を残しつつ、必要な息継ぎだけ入れます。",
    },
    "-1": {
      label: "小説寄り",
      hint: "うさぴこ基準より少しだけ、会話や長い文の間を見やすくします。",
    },
    0: {
      label: "標準",
      hint: "noteで読み落としにくいよう、句点ごとの余白を標準にします。",
    },
    1: {
      label: "note寄り",
      hint: "長い地の文を文単位に近づけ、スマホで視線を戻しやすくします。",
    },
    2: {
      label: "note基準",
      hint: "noteらしさを強めに出し、文のまとまりを大きくほぐします。",
    },
  };

  function setPreviewWidth(value) {
    const width = Math.min(65, Math.max(35, Number(value) || 55));
    document.documentElement.style.setProperty("--preview-width", `${width}%`);
    previewWidth.value = String(width);
    previewWidthValue.textContent = `${width}%`;
    return width;
  }

  function setDensity(value) {
    const density = Math.min(2, Math.max(-2, Number(value) || 0));
    const profile = densityProfiles[density] || densityProfiles[0];
    densityRange.value = String(density);
    densityLabel.textContent = profile.label;
    densityHint.textContent = profile.hint;
    return density;
  }

  function countParagraphs(text) {
    return text
      .trim()
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean).length;
  }

  function setMeter(node, text) {
    node.textContent = `${[...text].length}字 / ${countParagraphs(text)}段落`;
  }

  function normalizeBase(text) {
    return text
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isListLine(line) {
    return /^(\s*[-*+]|\s*\d+[.)])\s+/.test(line);
  }

  function isHeading(line) {
    return /^#{1,6}\s+/.test(line);
  }

  function isFence(line) {
    return /^\s*```/.test(line);
  }

  function isDialogue(line) {
    return /^[「『].*[」』]$/.test(line.trim());
  }

  function isSceneBreak(line) {
    return /^[-*＊]{3,}$/.test(line.trim()) || /^[◇◆□■]+$/.test(line.trim());
  }

  function endsSentence(line) {
    return /[。！？!?」』）)]$/.test(line);
  }

  function splitSentenceChunks(line, density) {
    const trimmed = line.trim();
    if (isHeading(trimmed) || isListLine(trimmed) || isSceneBreak(trimmed)) {
      return [line];
    }

    const minLength = density >= 2 ? 34 : 74;
    if ([...line].length < minLength) {
      return [line];
    }

    const chunks = line
      .split(/(?<=[。！？!?」』）)])/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (chunks.length <= 1) {
      return [line];
    }

    return chunks;
  }

  function shouldAddBlankLine(current, nextTrim, options) {
    if (!options.splitPeriod) return false;
    if (options.headingGap && isHeading(current)) return true;
    if (isSceneBreak(current)) return true;
    if (!endsSentence(current)) return false;

    const length = [...current].length;
    const nextIsDialogue = isDialogue(nextTrim);
    const currentIsDialogue = isDialogue(current);

    if (options.density <= -2) {
      return length >= 55 || currentIsDialogue || nextIsDialogue;
    }
    if (options.density === -1) {
      return length >= 35 || currentIsDialogue || nextIsDialogue;
    }
    return true;
  }

  function formatForNote(text) {
    const options = {
      headingGap: blankAfterHeading.checked,
      splitPeriod: splitJapanesePeriod.checked,
      keepLists: protectLists.checked,
      density: Number(densityRange.value),
    };
    const lines = normalizeBase(text).split("\n");
    const formatted = [];
    let inCode = false;

    for (let index = 0; index < lines.length; index += 1) {
      const current = lines[index].trimEnd();
      const next = lines[index + 1] || "";
      const nextTrim = next.trim();

      if (isFence(current)) {
        inCode = !inCode;
        formatted.push(current);
        continue;
      }

      if (inCode || current === "") {
        formatted.push(current);
        continue;
      }

      const chunks = options.density >= 1 ? splitSentenceChunks(current, options.density) : [current];
      if (chunks.length > 1) {
        chunks.forEach((chunk, chunkIndex) => {
          formatted.push(chunk);
          if (chunkIndex < chunks.length - 1) {
            formatted.push("");
          }
        });
        if (shouldAddBlankLine(chunks[chunks.length - 1], nextTrim, options)) {
          formatted.push("");
        }
        continue;
      }

      formatted.push(current);

      const nextIsStructural =
        nextTrim === "" ||
        isFence(nextTrim) ||
        isHeading(nextTrim) ||
        (options.keepLists && isListLine(nextTrim));
      const currentIsList = options.keepLists && isListLine(current);

      if (nextIsStructural || currentIsList) {
        continue;
      }

      if (shouldAddBlankLine(current, nextTrim, options)) {
        formatted.push("");
      }
    }

    return normalizeBase(formatted.join("\n"));
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return map[char];
    });
  }

  function renderPreview(text) {
    const safe = escapeHtml(text);
    const blocks = safe.split(/\n{2,}/).filter((block) => block.trim());
    const html = blocks
      .map((block) => {
        if (/^```/.test(block.trim())) {
          return `<pre><code>${block.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "")}</code></pre>`;
        }
        if (/^###\s+/.test(block)) {
          return `<h4>${block.replace(/^###\s+/, "")}</h4>`;
        }
        if (/^##?\s+/.test(block)) {
          return `<h3>${block.replace(/^#{1,2}\s+/, "")}</h3>`;
        }
        if (/^(\s*[-*+]|\s*\d+[.)])\s+/m.test(block)) {
          const items = block
            .split("\n")
            .filter(Boolean)
            .map((line) => line.replace(/^(\s*[-*+]|\s*\d+[.)])\s+/, ""));
          return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
        }
        return `<p>${block.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
    previewDesktop.innerHTML = html;
    previewMobile.innerHTML = html;
  }

  function saveState() {
    const payload = {
      source: sourceText.value,
      output: outputText.value,
      blankAfterHeading: blankAfterHeading.checked,
      splitJapanesePeriod: splitJapanesePeriod.checked,
      protectLists: protectLists.checked,
      previewWidth: Number(previewWidth.value),
      previewModeVersion: 2,
      density: Number(densityRange.value),
      viewNoteEditor: viewNoteEditor.checked,
      viewMobileNovelist: viewMobileNovelist.checked,
      viewNovelEditor: viewNovelEditor.checked,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  function updateAll() {
    setMeter(inputMeter, sourceText.value);
    setMeter(outputMeter, outputText.value);
    renderPreview(outputText.value);
    saveState();
  }

  function setIssue(text, isOk) {
    const item = document.createElement("div");
    item.className = isOk ? "issue ok" : "issue";
    item.textContent = text;
    issueList.appendChild(item);
  }

  function inspectText() {
    issueList.innerHTML = "";
    const text = outputText.value || sourceText.value;
    const checks = [];
    const baseChecks = [
      {
        test: /\n{3,}/,
        text: "空行が3行以上続いています",
      },
      {
        test: /[ \t]+$/m,
        text: "行末に空白があります",
      },
      {
        test: /、、|。。|！！|？？/,
        text: "読点・句点・感嘆符の重複があります",
      },
      {
        test: /[^\n]{120,}/,
        text: "長い段落があります",
      },
      {
        test: /([ぁ-んァ-ヶ一-龠]) ([ぁ-んァ-ヶ一-龠])/,
        text: "日本語の間に半角スペースがあります",
      },
    ];

    checks.push(...baseChecks);

    if (viewNoteEditor.checked) {
      checks.push(
        {
          test: /[^\n]{180,}/,
          text: "note編集者: スマホ画面では長く見える段落があります",
        },
        {
          test: /^#{1,6}\s+.+\n(?!\n)/m,
          text: "note編集者: 見出し直後に余白がない箇所があります",
        },
      );
    }

    if (viewMobileNovelist.checked) {
      checks.push(
        {
          test: /(?:[^\n]{70,}\n){3,}/,
          text: "スマホ小説家: 長めの行が続き、画面内の息継ぎが少なめです",
        },
        {
          test: /[。！？!?」』）)]\n[「『]/,
          text: "スマホ小説家: 会話前の間を空けると視線が戻りやすい箇所があります",
        },
      );
    }

    if (viewNovelEditor.checked) {
      checks.push(
        {
          test: /「[^」]{80,}」/,
          text: "小説編集者: 長い台詞があります",
        },
        {
          test: /(?:。[^。\n]{0,10}){4,}/,
          text: "小説編集者: 短い文末が続き、リズムが単調に見える箇所があります",
        },
      );
    }

    const hits = checks.filter((check) => check.test.test(text));

    if (hits.length === 0) {
      setIssue("目立つ崩れはありません", true);
      return;
    }

    hits.forEach((hit) => setIssue(hit.text, false));
  }

  sourceText.addEventListener("input", () => {
    outputText.value = sourceText.value;
    updateAll();
  });

  outputText.addEventListener("input", updateAll);

  [blankAfterHeading, splitJapanesePeriod, protectLists].forEach((control) => {
    control.addEventListener("change", saveState);
  });

  [viewNoteEditor, viewMobileNovelist, viewNovelEditor].forEach((control) => {
    control.addEventListener("change", saveState);
  });

  densityRange.addEventListener("input", () => {
    setDensity(densityRange.value);
    if ((sourceText.value || outputText.value).trim()) {
      lastSource = outputText.value;
      outputText.value = formatForNote(sourceText.value || outputText.value);
      updateAll();
      return;
    }
    saveState();
  });

  previewWidth.addEventListener("input", () => {
    setPreviewWidth(previewWidth.value);
    saveState();
  });

  formatBtn.addEventListener("click", () => {
    lastSource = outputText.value || sourceText.value;
    outputText.value = formatForNote(sourceText.value || outputText.value);
    updateAll();
    inspectText();
  });

  restoreBtn.addEventListener("click", () => {
    if (!lastSource) return;
    outputText.value = lastSource;
    updateAll();
  });

  inspectBtn.addEventListener("click", inspectText);

  clearBtn.addEventListener("click", () => {
    lastSource = outputText.value;
    sourceText.value = "";
    outputText.value = "";
    issueList.innerHTML = "";
    copyState.textContent = "";
    updateAll();
  });

  copyBtn.addEventListener("click", async () => {
    const text = outputText.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyState.textContent = "コピーしました";
    } catch (error) {
      outputText.select();
      document.execCommand("copy");
      copyState.textContent = "選択範囲をコピーしました";
    }
    window.setTimeout(() => {
      copyState.textContent = "";
    }, 2200);
  });

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      sourceText.value = saved.source || "";
      outputText.value = saved.output || saved.source || "";
      blankAfterHeading.checked = saved.blankAfterHeading !== false;
      splitJapanesePeriod.checked = saved.splitJapanesePeriod !== false;
      protectLists.checked = saved.protectLists !== false;
      setPreviewWidth(saved.previewModeVersion === 2 ? saved.previewWidth : 55);
      setDensity(saved.density || 0);
      viewNoteEditor.checked = saved.viewNoteEditor !== false;
      viewMobileNovelist.checked = saved.viewMobileNovelist !== false;
      viewNovelEditor.checked = saved.viewNovelEditor !== false;
    } catch (error) {
      sourceText.value = "";
      outputText.value = "";
      setPreviewWidth(55);
      setDensity(0);
    }
    updateAll();
  }

  loadState();
})();
