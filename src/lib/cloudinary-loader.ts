import type {ImageLoaderProps} from "next/image";

import type {PublicMediaAsset} from "@/lib/domain";

export function buildCloudinaryDerivative(asset: PublicMediaAsset, width: number): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/.test(asset.cloudName)) throw new Error("INVALID_CLOUD_NAME");
  const segments = asset.publicId.split("/");
  if (!/^[A-Za-z0-9_./-]+$/.test(asset.publicId) || segments.some((segment) => segment === "" || segment === "." || segment === "..")) throw new Error("INVALID_PUBLIC_ID");
  if (!Number.isInteger(width) || width < 1 || width > 2400) throw new Error("INVALID_IMAGE_WIDTH");
  const publicId = segments.map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${asset.cloudName}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

export default function cloudinaryLoader({src, width}: ImageLoaderProps): string {
  const separator = src.indexOf("|");
  if (separator < 1 || separator === src.length - 1) throw new Error("INVALID_IMAGE_SOURCE");
  const asset = {cloudName: src.slice(0, separator), publicId: src.slice(separator + 1), id: "loader", secureUrl: "", width, height: width, alt: {en: "", id: ""}};
  return buildCloudinaryDerivative(asset, width);
}
