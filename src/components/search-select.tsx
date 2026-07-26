"use client";

import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AssetScanner } from "@/components/asset-scanner";

export type SearchOption = { value: string; label: string; meta?: string; scanCodes?: string[]; groupIds?: string[] };

export function SearchSelect({
  name,
  label,
  placeholder,
  options,
  defaultValue = "",
  scanLabel,
  relatedSelect,
  onSelectionChange,
}: {
  name: string;
  label: string;
  placeholder: string;
  options: SearchOption[];
  defaultValue?: string;
  scanLabel?: string;
  relatedSelect?: { name: string; label: string; options: Array<{ value: string; label: string }>; defaultValue?: string };
  onSelectionChange?: (value: string) => void;
}) {
  const initial = options.find((option) => option.value === defaultValue);
  const [selected, setSelected] = useState(initial ?? null);
  const [query, setQuery] = useState(initial?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return options.filter((option) => terms.every((term) => `${option.label} ${option.meta ?? ""}`.toLowerCase().includes(term))).slice(0, 10);
  }, [options, query]);

  function choose(option: SearchOption) {
    setSelected(option);
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(0);
    onSelectionChange?.(option.value);
  }

  return (
    <div className="field search-select-field" ref={rootRef} onBlur={(event) => {
      if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <div className="search-select-label"><span>{label}</span>{scanLabel ? <AssetScanner buttonLabel={scanLabel} iconOnly records={options.filter((option) => option.scanCodes?.length).map((option) => ({ value: option.value, label: option.label, codes: option.scanCodes ?? [] }))} onResolved={(record) => { const option = options.find((candidate) => candidate.value === record.value); if (option) choose(option); }} /> : null}</div>
      <input type="hidden" name={name} value={selected?.value ?? ""} />
      <div className="search-select-input">
        <Search size={17} />
        <input
          aria-label={label}
          autoComplete="off"
          placeholder={placeholder}
          required
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setSelected(null); onSelectionChange?.(""); setOpen(true); setActiveIndex(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1))); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
            if (event.key === "Enter" && open && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]); }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {query ? <button type="button" aria-label={`Clear ${label}`} onClick={() => { setQuery(""); setSelected(null); onSelectionChange?.(""); setOpen(true); }}><X size={15} /></button> : null}
      </div>
      {open ? <div className="search-select-menu" role="listbox" aria-label={`${label} results`}>
        {results.length ? results.map((option, index) => <button className={index === activeIndex ? "search-option active" : "search-option"} type="button" role="option" aria-selected={selected?.value === option.value} key={option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}><strong>{option.label}</strong>{option.meta ? <small>{option.meta}</small> : null}</button>) : <div className="search-no-results">No matching records</div>}
      </div> : null}
      {selected ? <small className="selection-confirmed">Selected record ready</small> : <small>Type to filter, then choose a result.</small>}
      {relatedSelect && selected ? <label className="related-select"><span>{relatedSelect.label}</span><select key={selected.value} name={relatedSelect.name} defaultValue={relatedSelect.defaultValue ?? ""}><option value="">No group context</option>{relatedSelect.options.filter((option) => selected.groupIds?.includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
    </div>
  );
}
