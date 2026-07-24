"use client";

import { useMemo } from "react";
import { AssetLabelFormat, createAssetLabelSvg } from "@/lib/asset-labels";

export type LabelAsset = {
  id: string;
  tag: string;
  name: string;
  category: string;
  status: string;
  location: string | null;
};

export function AssetLabelCard({ asset, format }: { asset: LabelAsset; format: AssetLabelFormat }) {
  const svg = useMemo(() => createAssetLabelSvg(asset.tag, format), [asset.tag, format]);

  return <article className={`label-card ${format}`}>
    <span className="label-code" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
    <span className="label-copy"><strong>{asset.tag}</strong><small>{asset.name}</small><span>{asset.location ?? asset.category}</span></span>
  </article>;
}
