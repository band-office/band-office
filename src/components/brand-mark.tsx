import Image from "next/image";

export function BrandMark({ size, reverse = false }: { size: number; reverse?: boolean }) {
  return <Image src={reverse ? "/brand/band-office-mark-reverse.png" : "/brand/band-office-mark.png"} alt="" width={size} height={size} priority aria-hidden="true" />;
}
