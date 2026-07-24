import { AlertCircle, CheckCircle2 } from "lucide-react";

export function FlashMessage({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  const isError = Boolean(error);
  return (
    <div className={isError ? "flash flash-error" : "flash flash-success"} role="status">
      {isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span>{error ?? success}</span>
    </div>
  );
}
