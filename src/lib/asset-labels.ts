import bwipjs from "bwip-js/browser";

export type AssetLabelFormat = "qrcode" | "code128";
export type AssetLabelLayout = "address" | "shipping" | "square";

export const labelLayouts: Record<AssetLabelLayout, { name: string; detail: string; capacity: number }> = {
  address: { name: "Address", detail: "30 per letter sheet", capacity: 30 },
  shipping: { name: "Shipping", detail: "10 per letter sheet", capacity: 10 },
  square: { name: "2-inch square", detail: "12 per letter sheet", capacity: 12 },
};

export function createAssetLabelSvg(tag: string, format: AssetLabelFormat) {
  const text = tag.trim();
  if (!text) throw new Error("An asset tag is required to generate a label.");

  return bwipjs.toSVG(format === "qrcode"
    ? { bcid: "qrcode", text, scale: 3, paddingwidth: 1, paddingheight: 1 }
    : { bcid: "code128", text, scale: 2, height: 9, paddingwidth: 1, paddingheight: 1 });
}

export function paginateLabels<T>(items: T[], capacity: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += capacity) pages.push(items.slice(index, index + capacity));
  return pages;
}
