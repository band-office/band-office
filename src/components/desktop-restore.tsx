"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

export function DesktopRestore() {
  const [available, setAvailable] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAvailable(Boolean(window.bandosDesktop?.isDesktop)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!available) return null;

  async function restore() {
    if (!window.confirm("Restore a Band Office backup? The current database will be preserved as a recovery snapshot, then Band Office will restart.")) return;
    setWorking(true);
    setMessage("");
    const result = await window.bandosDesktop!.restoreBackup(passphrase);
    if (result.error) setMessage(result.error);
    else if (result.scheduled) setMessage("Backup verified. Band Office is restarting with the restored database.");
    setWorking(false);
  }

  return <div className="desktop-restore">
    <div><strong>Restore a desktop backup</strong><span>The selected archive is verified before the current database is replaced.</span></div>
    <label className="field"><span>Backup passphrase</span><input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="off" placeholder="Leave blank for a readable ZIP" /></label>
    <button className="button danger" type="button" onClick={() => void restore()} disabled={working}><RotateCcw size={16} />{working ? "Verifying…" : "Choose backup and restore"}</button>
    {message ? <p className={message.startsWith("Backup verified") ? "inline-success" : "inline-error"}>{message}</p> : null}
  </div>;
}
