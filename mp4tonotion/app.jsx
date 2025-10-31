import React, { useState, useEffect } from "react";

// Single-file React component app
// - Upload multiple .txt files
// - Merge and deduplicate lines
// - Simple client-side "AI" summarizer (extractive, TF-like scoring)
// - Optionally create a Notion page if user pastes a Notion integration token + parent page id
// - Download merged file, copy to clipboard

export default function MergeNotionApp() {
  const [files, setFiles] = useState([]);
  const [mergedText, setMergedText] = useState("");
  const [cleanText, setCleanText] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryPercent, setSummaryPercent] = useState(20);
  const [notionToken, setNotionToken] = useState("");
  const [notionParent, setNotionParent] = useState("");
  const [status, setStatus] = useState("");

  // read selected files
  async function handleFiles(e) {
    const list = Array.from(e.target.files || []);
    setFiles(list.map((f) => ({ name: f.name, file: f })));
  }

  // helper: read text from file
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file, "utf-8");
    });
  }

  // Merge and dedupe lines, keep order
  async function mergeAndClean() {
    if (!files.length) return;
    setStatus("Łączenie plików...");
    const contents = [];
    for (const fObj of files) {
      try {
        const txt = await readFileAsText(fObj.file);
        contents.push(`#FILE:${fObj.name}\n` + txt);
      } catch (e) {
        console.error("read error", e);
      }
    }
    const full = contents.join("\n\n");
    setMergedText(full);

    // dedupe lines, keep order, skip empties
    const lines = full.split(/\r?\n/).map((l) => l.trim());
    const seen = new Set();
    const uniq = [];
    for (const l of lines) {
      if (!l) continue;
      if (!seen.has(l)) {
        seen.add(l);
        uniq.push(l);
      }
    }
    const cleaned = uniq.join("\n");
    setCleanText(cleaned);
    setStatus("Połączono i oczyszczono.");
  }

  // Simple extractive summarizer: score sentences by word frequency
  function generateSummary() {
    if (!cleanText) return;
    setStatus("Tworzę streszczenie (lokalne AI)...");

    // split into sentences (simple split by punctuation)
    const sentences = cleanText.match(/[^.!?\n]+[.!?]?/g) || [cleanText];

    // build word frequencies
    const words = cleanText
      .toLowerCase()
      .replace(/[^a-zA-Z0-9ąćęłńóśżź\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const freq = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;

    // score sentences
    const sentenceScores = sentences.map((s, idx) => {
      const sw = s
        .toLowerCase()
        .replace(/[^a-zA-Z0-9ąćęłńóśżź\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      let score = 0;
      for (const w of sw) score += freq[w] || 0;
      return { idx, text: s.trim(), score };
    });

    // choose top N sentences
    const keepPercent = Math.max(5, Math.min(90, Number(summaryPercent) || 20));
    const keepCount = Math.max(1, Math.round((keepPercent / 100) * sentenceScores.length));

    const top = [...sentenceScores]
      .sort((a, b) => b.score - a.score)
      .slice(0, keepCount)
      // restore original order
      .sort((a, b) => a.idx - b.idx)
      .map((s) => s.text);

    const stext = top.join(" ");
    setSummary(stext);
    setStatus("Streszczenie gotowe.");
  }

  // download merged or cleaned text as file
  function downloadText(content, filename = "merged.txt") {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // copy to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Skopiowano do schowka.");
    } catch (e) {
      setStatus("Błąd przy kopiowaniu: " + e.message);
    }
  }

  // create a Notion page if token + parent provided
  async function createNotionPage(title, content) {
    if (!notionToken || !notionParent) {
      setStatus("Brakuje tokenu Notion lub parent page id. Możesz wkleić treść ręcznie.");
      return;
    }

    setStatus("Tworzę stronę w Notion...");

    // build simple page with a heading and a paragraph block
    const blocks = [];
    // split content into paragraphs for blocks
    const paras = content.split(/\n\n+/).slice(0, 40); // limit blocks
    for (const p of paras) {
      if (!p.trim()) continue;
      blocks.push({ type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: p.slice(0, 2000) } }] } });
    }

    const body = {
      parent: { page_id: notionParent },
      properties: {
        title: [
          {
            type: "text",
            text: { content: title || "Generated note" },
          },
        ],
      },
      children: blocks,
    };

    try {
      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Notion API error: ${res.status} ${text}`);
      }
      const data = await res.json();
      setStatus("Utworzono stronę w Notion (id: " + data.id + ")");
    } catch (e) {
      console.error(e);
      setStatus("Błąd przy tworzeniu Notion: " + e.message + ". Upewnij się, że token i parent są poprawne.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-3">Merge → Clean → AI Notion (client-side)</h1>
        <p className="text-sm text-slate-600 mb-4">Wgraj swoje pliki .txt (np. z OCR). Aplikacja je połączy, usunie duplikaty, wygeneruje krótkie streszczenie i — opcjonalnie — utworzy stronę w Notion jeśli podasz token.</p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Wybierz pliki .txt (wiele)</label>
          <input type="file" accept=".txt" multiple onChange={handleFiles} className="block w-full" />
        </div>

        <div className="flex gap-2 mb-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={mergeAndClean}>Połącz i oczyść</button>
          <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={() => { downloadText(cleanText || mergedText, 'merged_clean.txt'); }}>Pobierz merged_clean.txt</button>
          <button className="px-4 py-2 bg-slate-500 text-white rounded" onClick={() => copyToClipboard(cleanText || mergedText)}>Kopiuj zawartość</button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Streszczenie ("AI" — lokalne, extractive)</label>
          <div className="flex items-center gap-3 mb-2">
            <input type="range" min={5} max={90} value={summaryPercent} onChange={(e) => setSummaryPercent(e.target.value)} />
            <span className="text-sm">{summaryPercent}%</span>
            <button className="ml-3 px-3 py-1 bg-indigo-600 text-white rounded" onClick={generateSummary}>Generuj streszczenie</button>
            <button className="ml-2 px-3 py-1 bg-yellow-600 text-white rounded" onClick={() => copyToClipboard(summary)}>Kopiuj streszczenie</button>
          </div>
          <textarea className="w-full h-32 p-3 border rounded" value={summary} readOnly />
        </div>

        <div className="mb-4">
          <h2 className="font-medium mb-2">Ustawienia Notion (opcjonalne)</h2>
          <p className="text-xs text-slate-500 mb-2">Jeśli chcesz utworzyć stronę w Notion automatycznie — wklej tutaj swój Integration Token (Bearer) oraz Page ID (parent). Nie wysyłamy niczego na serwer — wszystko wykonuje przeglądarka.</p>
          <input className="w-full mb-2 p-2 border rounded" placeholder="Notion Integration Token (opcjonalnie)" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} />
          <input className="w-full mb-2 p-2 border rounded" placeholder="Parent Page ID (opcjonalnie)" value={notionParent} onChange={(e) => setNotionParent(e.target.value)} />
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-violet-600 text-white rounded" onClick={() => createNotionPage('Merged note', cleanText || mergedText)}>Utwórz stronę w Notion</button>
            <button className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={() => downloadText(summary || cleanText || mergedText, 'all_clean_summary.txt')}>Pobierz wszystko</button>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="font-medium">Podgląd oczyszczonego tekstu</h2>
          <textarea className="w-full h-48 p-3 border rounded" value={cleanText} readOnly />
        </div>

        <div className="text-sm text-slate-600">Status: {status}</div>

        <hr className="my-4" />
        <div className="text-xs text-slate-500">Uwaga: to narzędzie działa **w całości po stronie klienta** (przeglądarka). Nie wysyłamy plików na serwer. Jeśli chcesz integrację z Notion — musisz wkleić swój token. Nie przechowujemy tokenów.</div>
      </div>
    </div>
  );
}
