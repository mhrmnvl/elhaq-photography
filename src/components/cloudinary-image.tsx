import Image from "next/image";
import type * as React from "react";

import type {PublicMediaAsset} from "@/lib/domain";

export type CloudinaryAsset = Pick<PublicMediaAsset, "cloudName" | "publicId" | "width" | "height">;

export function CloudinaryImage({asset, alt, sizes, priority = false, className}: {asset: CloudinaryAsset; alt: string; sizes: string; priority?: boolean; className?: string}): React.ReactElement {
  return <Image src={`${asset.cloudName}|${asset.publicId}`} alt={alt} width={asset.width} height={asset.height} sizes={sizes} priority={priority} className={className ?? "h-auto w-full"} />;
}
