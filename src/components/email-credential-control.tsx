"use client";

import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, Trash2 } from "lucide-react";

export function EmailCredentialControl({ environmentCredential }: { environmentCredential: boolean }) {
  const [desktop, setDesktop] = useState(false);
  const [available, setAvailable] = useState(false);
  const [stored, setStored] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [restartRequired, setRestartRequired] = useState(false);

  useEffect(() => {
    const bridge = window.bandosDesktop;
    void Promise.resolve().then(async () => {
      setDesktop(Boolean(bridge));
      if (!bridge) return;
      const status = await bridge.emailCredentialStatus();
      setAvailable(status.available);
      setStored(status.stored);
    });
  }, []);

  async function save() {
    const result = await window.bandosDesktop?.storeEmailCredential(password);
    if (result?.error) return setMessage(result.error);
    const invalidated = await fetch("/api/communications/credential-changed", { method: "POST" });
    if (!invalidated.ok) return setMessage("Credential stored, but mailbox verification could not be reset. Restart and save the connection settings before sending.");
    setPassword("");
    setStored(Boolean(result?.stored));
    setRestartRequired(Boolean(result?.restartRequired));
    setMessage("SMTP credential stored.");
  }

  async function clear() {
    const result = await window.bandosDesktop?.clearEmailCredential();
    const invalidated = await fetch("/api/communications/credential-changed", { method: "POST" });
    if (!invalidated.ok) return setMessage("Credential cleared, but mailbox verification could not be reset. Restart and save the connection settings before sending.");
    setStored(false);
    setRestartRequired(Boolean(result?.restartRequired));
    setMessage("Stored SMTP credential cleared.");
  }

  if (!desktop) {
    return <div className="credential-state"><KeyRound size={18} /><div><strong>{environmentCredential ? "Credential loaded" : "Credential not loaded"}</strong><small>Environment variable: BANDOS_SMTP_PASSWORD</small></div></div>;
  }

  return <div className="credential-control">
    <div className="credential-state"><KeyRound size={18} /><div><strong>{stored ? "Secure credential stored" : "No secure credential stored"}</strong><small>{available ? "Operating-system encrypted storage" : "Secure storage unavailable"}</small></div></div>
    {available ? <div className="credential-actions"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="SMTP password or app password" autoComplete="new-password" /><button className="button secondary" type="button" onClick={() => void save()} disabled={!password}>Store</button>{stored ? <button className="icon-button" type="button" onClick={() => void clear()} aria-label="Clear stored credential" title="Clear stored credential"><Trash2 size={16} /></button> : null}</div> : null}
    {message ? <small className="credential-message">{message}</small> : null}
    {restartRequired ? <button className="button primary" type="button" onClick={() => void window.bandosDesktop?.restart()}><RefreshCw size={16} />Restart BandOS</button> : null}
  </div>;
}
