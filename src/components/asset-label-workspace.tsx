"use client";

import { Barcode, CheckSquare2, Printer, QrCode, Search, SquareX } from "lucide-react";
import { useMemo, useState } from "react";
import { AssetLabelCard, LabelAsset } from "@/components/asset-label-card";
import { normalizeAssetCode } from "@/lib/asset-codes";
import { AssetLabelFormat, AssetLabelLayout, labelLayouts, paginateLabels } from "@/lib/asset-labels";

export function AssetLabelWorkspace({ assets, initialAssetId }: { assets: LabelAsset[]; initialAssetId?: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState<AssetLabelFormat>("qrcode");
  const [layout, setLayout] = useState<AssetLabelLayout>("shipping");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialAssetId && assets.some((asset) => asset.id === initialAssetId) ? [initialAssetId] : []);

  const categories = useMemo(() => [...new Set(assets.map((asset) => asset.category))].sort(), [assets]);
  const statuses = useMemo(() => [...new Set(assets.map((asset) => asset.status))].sort(), [assets]);
  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return assets.filter((asset) => (!category || asset.category === category)
      && (!status || asset.status === status)
      && (!needle || [asset.tag, asset.name, asset.location, asset.category].some((value) => value?.toLocaleLowerCase().includes(needle))));
  }, [assets, category, query, status]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedAssets = useMemo(() => assets.filter((asset) => selectedSet.has(asset.id)), [assets, selectedSet]);
  const pages = useMemo(() => paginateLabels(selectedAssets, labelLayouts[layout].capacity), [layout, selectedAssets]);
  const duplicateTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) {
      const tag = normalizeAssetCode(asset.tag);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([tag]) => tag);
  }, [assets]);

  function toggleAsset(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function selectVisible() {
    setSelectedIds((current) => [...new Set([...current, ...filteredAssets.map((asset) => asset.id)])]);
  }

  return <div className="label-workspace">
    <aside className="label-controls no-print">
      <header><div><h2>Inventory selection</h2><p>{selectedAssets.length} selected</p></div><button aria-label="Clear selection" className="icon-button" disabled={selectedAssets.length === 0} title="Clear selection" type="button" onClick={() => setSelectedIds([])}><SquareX size={17} /></button></header>
      <label className="search-control"><Search size={17} /><input aria-label="Search label inventory" placeholder="Search tags, assets, or locations" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="label-filter-grid">
        <label className="field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      <div className="label-selection-actions"><button className="button secondary small" disabled={filteredAssets.length === 0} type="button" onClick={selectVisible}><CheckSquare2 size={15} />Select visible</button><span>{filteredAssets.length} shown</span></div>
      <div className="label-asset-list">
        {filteredAssets.map((asset) => <label className={selectedSet.has(asset.id) ? "label-asset-option selected" : "label-asset-option"} key={asset.id}><input aria-label={`Select ${asset.tag}`} type="checkbox" checked={selectedSet.has(asset.id)} onChange={() => toggleAsset(asset.id)} /><span><strong>{asset.tag}</strong><small>{asset.name}</small><span>{asset.location ?? asset.category}</span></span></label>)}
        {filteredAssets.length === 0 ? <p className="panel-empty">No tagged assets match these filters.</p> : null}
      </div>
    </aside>

    <section className="label-preview">
      <div className="label-preview-toolbar no-print">
        <div><strong>{selectedAssets.length} labels</strong><span>{pages.length} {pages.length === 1 ? "sheet" : "sheets"}</span></div>
        <div className="label-output-controls">
          <div aria-label="Label code format" className="segmented-control" role="group">
            <button aria-pressed={format === "qrcode"} type="button" onClick={() => setFormat("qrcode")}><QrCode size={16} />QR</button>
            <button aria-pressed={format === "code128"} type="button" onClick={() => setFormat("code128")}><Barcode size={16} />Code 128</button>
          </div>
          <label className="compact-select"><span>Sheet</span><select value={layout} onChange={(event) => setLayout(event.target.value as AssetLabelLayout)}>{Object.entries(labelLayouts).map(([value, option]) => <option key={value} value={value}>{option.name} · {option.detail}</option>)}</select></label>
          <button className="button primary" disabled={selectedAssets.length === 0 || duplicateTags.length > 0} type="button" onClick={() => window.print()}><Printer size={16} />Print labels</button>
        </div>
      </div>
      {duplicateTags.length > 0 ? <p className="inline-error no-print" role="alert">Duplicate asset tags must be corrected before printing: {duplicateTags.join(", ")}</p> : null}
      {pages.length > 0 ? <div className="label-pages">{pages.map((pageAssets, pageIndex) => <div className="label-sheet" data-layout={layout} key={`${layout}-${pageIndex}`}>{pageAssets.map((asset) => <AssetLabelCard asset={asset} format={format} key={asset.id} />)}</div>)}</div> : <div className="label-empty"><QrCode size={28} /><strong>No labels selected</strong><span>Select inventory records to build a print sheet.</span></div>}
    </section>
  </div>;
}
