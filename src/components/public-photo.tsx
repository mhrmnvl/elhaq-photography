import type * as React from "react";

import {CloudinaryImage} from "@/components/cloudinary-image";
import type {Locale, PublicMediaAsset} from "@/lib/domain";

export function PublicPhoto({asset, locale, large = false}: {asset: PublicMediaAsset; locale: Locale; large?: boolean}): React.ReactElement {
  return <CloudinaryImage asset={asset} alt={asset.alt[locale]} sizes={large ? "100vw" : "(min-width: 768px) 50vw, 100vw"} />;
}
