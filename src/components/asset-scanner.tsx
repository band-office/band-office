"use client";

import { Camera, Keyboard, ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeAssetCode } from "@/lib/asset-codes";

export type AssetScanRecord = {
  value: string;
  label: string;
  codes: string[];
  href?: string;
};

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = {
  new(options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
};

const preferredFormats = ["qr_code", "code_128", "code_39", "code_93", "data_matrix", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"];

function barcodeDetector() {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

export function AssetScanner({
  records,
  buttonLabel = "Scan inventory",
  iconOnly = false,
  onResolved,
}: {
  records: AssetScanRecord[];
  buttonLabel?: string;
  iconOnly?: boolean;
  onResolved?: (record: AssetScanRecord) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState("");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRunningRef = useRef(false);
  const scanTimerRef = useRef<number | null>(null);

  function stopCamera() {
    cameraRunningRef.current = false;
    if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  }

  function close() {
    stopCamera();
    setOpen(false);
    setEntry("");
    setError("");
  }

  function resolve(rawValue: string) {
    const code = normalizeAssetCode(rawValue);
    if (!code) {
      setError("Enter or scan an asset tag.");
      return false;
    }
    const matches = records.filter((record) => record.codes.some((candidate) => normalizeAssetCode(candidate) === code));
    if (matches.length === 0) {
      setError(`No inventory record matches ${rawValue.trim()}.`);
      return false;
    }
    if (matches.length > 1) {
      setError(`More than one inventory record matches ${rawValue.trim()}. Search manually to choose the correct asset.`);
      return false;
    }
    const record = matches[0];
    close();
    if (onResolved) onResolved(record);
    else if (record.href) router.push(record.href);
    return true;
  }

  async function startCamera() {
    setError("");
    const Detector = barcodeDetector();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera scanning is not available here. Use a connected scanner or enter the asset tag.");
      return;
    }
    setCameraState("starting");
    try {
      const supported = await Detector.getSupportedFormats();
      const formats = preferredFormats.filter((format) => supported.includes(format));
      if (formats.length === 0) throw new Error("No compatible barcode formats are available.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("The camera preview could not start.");
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats });
      cameraRunningRef.current = true;
      setCameraState("active");

      const scanFrame = async () => {
        if (!cameraRunningRef.current || !videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes[0]?.rawValue && resolve(barcodes[0].rawValue)) return;
        } catch {
          // Individual frames can fail while the camera focuses; keep the session alive.
        }
        scanTimerRef.current = window.setTimeout(scanFrame, 180);
      };
      await scanFrame();
    } catch (cameraError) {
      stopCamera();
      setError(cameraError instanceof Error ? cameraError.message : "The camera could not start.");
    }
  }

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      cameraRunningRef.current = false;
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resolve(entry);
  }

  const dialog = open ? createPortal(<div className="scanner-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
    <section aria-labelledby="asset-scanner-title" aria-modal="true" className="scanner-dialog" role="dialog" onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
      <header><div><span className="large-icon"><ScanLine size={20} /></span><div><h2 id="asset-scanner-title">Scan inventory</h2><p>{records.length} tagged records available</p></div></div><button aria-label="Close scanner" className="icon-button" title="Close scanner" type="button" onClick={close}><X size={18} /></button></header>
      <form className="scanner-entry" onSubmit={submit}>
        <label className="field"><span>Asset tag or barcode</span><div className="scanner-input"><Keyboard size={17} /><input ref={inputRef} autoComplete="off" value={entry} onChange={(event) => { setEntry(event.target.value); setError(""); }} /></div></label>
        <button className="button primary" type="submit">Find asset</button>
      </form>
      <div className={cameraState === "idle" ? "scanner-camera idle" : "scanner-camera active"}>
        <video aria-label="Camera barcode preview" muted playsInline ref={videoRef} />
        {cameraState === "active" ? <span className="scanner-reticle" aria-hidden="true" /> : null}
        {cameraState === "idle" ? <button className="button secondary" type="button" onClick={startCamera}><Camera size={17} />Use camera</button> : <button className="button secondary camera-stop" disabled={cameraState === "starting"} type="button" onClick={stopCamera}>{cameraState === "starting" ? "Starting camera" : "Stop camera"}</button>}
      </div>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </section>
  </div>, document.body) : null;

  return <>
    <button
      aria-label={buttonLabel}
      className={iconOnly ? "scanner-trigger icon-button" : "button secondary scanner-trigger"}
      disabled={records.length === 0}
      title={buttonLabel}
      type="button"
      onClick={() => setOpen(true)}
    >
      <ScanLine size={17} />{iconOnly ? null : buttonLabel}
    </button>
    {dialog}
  </>;
}
