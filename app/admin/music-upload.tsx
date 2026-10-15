"use client";
import { useId, useRef, useState } from "react";

type UploadRow = { name: string; status: "waiting" | "uploading" | "done" | "error"; message?: string };
export default function MusicUpload({ onUploaded }: { onUploaded: () => void | Promise<void> }) {
  const id = useId();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [notice, setNotice] = useState("");

  async function upload(files: File[]) {
    setDragging(false);
    if (!files.length) return;
    if (locked.current) { setNotice("Yükleme devam ediyor. Yeni dosyaları işlem bitince ekleyebilirsin."); return; }
    if (files.length > 20) { setNotice("Bir seferde en fazla 20 dosya ekleyebilirsin."); return; }
    locked.current = true; setBusy(true); setNotice("");
    const results: UploadRow[] = files.map(file => ({ name: file.name, status: "waiting" }));
    const update = (index: number, status: UploadRow["status"], message?: string) => {
      results[index] = { name: files[index].name, status, message };
      setRows([...results]);
    };
    setRows([...results]);
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (!file.type.startsWith("audio/") && !file.name.toLowerCase().endsWith(".mp3")) { update(index, "error", "Yalnızca ses dosyası seç."); continue; }
        if (!file.size || file.size > 30 * 1024 * 1024) { update(index, "error", "Dosya boş olmamalı ve 30 MB sınırını aşmamalı."); continue; }
        update(index, "uploading");
        try {
          const body = new FormData(); body.append("file", file); body.append("playlist", "1");
          const response = await fetch("/api/admin/media", { method: "POST", body });
          const data = await response.json().catch(() => null);
          if (!response.ok) { update(index, "error", data?.error || "Yükleme tamamlanamadı."); continue; }
          if (!data?.addedToPlaylist) { update(index, "error", "Sonuç doğrulanamadı. Tekrar eklemeden önce listeyi kontrol et."); continue; }
          update(index, "done");
        } catch { update(index, "error", "Bağlantı kesildi. Tekrar eklemeden önce listeyi yenileyip kontrol et."); }
      }
    } finally {
      // Refresh once, after the queue; never retry an uncertain upload automatically.
      try { await onUploaded(); } catch { setNotice("Liste yenilenemedi. Sayfayı yenileyerek kontrol edebilirsin."); }
      locked.current = false; setBusy(false);
    }
  }

  return <section className="mb-5 rounded-[22px] border border-[#ff571b]/25 bg-[#ff571b]/5 p-5" aria-labelledby={id + "-title"}>
    <h2 id={id + "-title"} className="font-bold">Müzik dosyalarını ekle</h2>
    <p className="mt-2 text-sm text-zinc-400">Sürükleyip bırak; dosyalar otomatik yüklensin ve radyo listesine eklensin. Şarkı adını daha sonra düzenleyebilirsin.</p>
    <div onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }} className={"mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition-colors " + (dragging ? "border-[#ff6427] bg-[#ff571b]/15" : "border-white/15 bg-[#0e1218]")}>
      <div aria-hidden="true" className="mb-3 text-3xl text-[#ff7a45]">♫</div>
      <p className="font-bold">{busy ? "Dosyalar yükleniyor…" : "Ses dosyalarını buraya bırak"}</p>
      <p id={id + "-hint"} className="mt-2 text-xs leading-6 text-zinc-400">MP3 ve diğer ses dosyaları · Dosya başına en fazla 30 MB · Bir seferde 20 dosya<br/>Başarıyla eklenen parçalar radyo listesinde yayına alınır.</p>
      <input id={id} type="file" accept="audio/*,.mp3" multiple disabled={busy} aria-describedby={id + "-hint"} className="mt-5 max-w-full rounded-xl border border-white/10 bg-[#141820] p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#ff571b] file:px-4 file:py-2 file:font-bold file:text-white disabled:opacity-50" onChange={event => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; void upload(files); }} aria-label="Müzik dosyalarını seç" />
    </div>
    <div role="status" aria-live="polite" className="mt-3 text-sm text-zinc-300">{notice || (rows.length ? rows.filter(row => row.status === "done").length + " / " + rows.length + " dosya listeye eklendi." : "")}</div>
    {rows.length > 0 && <ul className="mt-3 space-y-2" aria-label="Yükleme sonuçları" aria-busy={busy}>{rows.map((row, index) => <li key={index} className="rounded-xl border border-white/10 bg-[#0e1218] px-4 py-3 text-sm"><span className="break-all font-semibold">{row.name}</span><p className={"mt-1 text-xs " + (row.status === "error" ? "text-red-300" : row.status === "done" ? "text-emerald-300" : "text-zinc-400")}>{row.message || ({ waiting: "Sırada", uploading: "Yükleniyor ve listeye ekleniyor…", done: "✓ Radyo listesine eklendi", error: "Eklenemedi" })[row.status]}</p></li>)}</ul>}
  </section>;
}
