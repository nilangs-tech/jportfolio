"use client";
import { useState } from "react";
import { Shell, HostedNotice } from "@/components/LocalPageShell";

const MODE = process.env.NEXT_PUBLIC_APP_MODE ?? "hosted";

export default function UploadPage() {
  const [portfolioId, setPortfolioId] = useState("portfolio_1");
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<string>("");
  const [saved, setSaved] = useState<string[]>([]);

  if (MODE !== "local") return <HostedNotice feature="Statement upload" />;

  async function upload() {
    if (!files || files.length === 0) { setStatus("Choose one or more files first."); return; }
    setStatus("Uploading…");
    const fd = new FormData();
    fd.append("portfolioId", portfolioId);
    Array.from(files).forEach((f) => fd.append("file", f));
    const res = await fetch("/api/upload-statement", { method: "POST", body: fd });
    const data = await res.json();
    if (data.ok) { setSaved(data.saved); setStatus(`Saved ${data.count} file(s) to the vault.`); }
    else setStatus(`Error: ${data.error}`);
  }

  return (
    <Shell title="📤 Upload Statements" subtitle="Files are saved into the Obsidian vault — Portfolio 1 or Portfolio 2.">
      <div className="card">
        <div className="table-controls">
          <label style={{ fontSize: 12, fontWeight: 600 }}>Portfolio:</label>
          <select className="search-input" style={{ width: "auto" }} value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
            <option value="portfolio_1">Portfolio 1</option>
            <option value="portfolio_2">Portfolio 2</option>
          </select>
        </div>
        <input type="file" multiple onChange={(e) => setFiles(e.target.files)} style={{ margin: "10px 0" }} />
        <div><button className="btn" onClick={upload}>Upload to vault</button></div>
        {status ? <p className="note" style={{ fontSize: 13, color: "var(--text2)" }}>{status}</p> : null}
        {saved.length ? <ul className="note">{saved.map((s) => <li key={s}>{s}</li>)}</ul> : null}
        <p className="note">Next: go to <a className="tool-link" href="/reconcile">Reconcile</a> to process the uploaded statements.</p>
      </div>
    </Shell>
  );
}
