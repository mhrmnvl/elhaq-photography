import type {AdminMediaAsset} from "@/lib/domain";

export function mergeMediaItems(current: readonly AdminMediaAsset[], incoming: readonly AdminMediaAsset[], requestItemIds: ReadonlySet<string>): AdminMediaAsset[] {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !requestItemIds.has(item.id) && !incomingIds.has(item.id))];
}
