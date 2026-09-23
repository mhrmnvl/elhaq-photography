import {revalidatePath} from "next/cache";

const basePaths = ["/en", "/id", "/en/portfolio", "/id/portfolio", "/en/about", "/id/about", "/en/contact", "/id/contact"] as const;

export function invalidatePublicPaths(slug?: string): void {
  const paths = slug ? [...basePaths, `/en/portfolio/${slug}`, `/id/portfolio/${slug}`] : basePaths;

  for (const path of paths) {
    try {
      revalidatePath(path, "layout");
    } catch (error) {
      console.error(JSON.stringify({code: "PUBLIC_PATH_INVALIDATION_FAILED", path, error}));
    }
  }
}
