"use client";

import * as React from "react";
import {Check, ImageIcon, ImagePlus, Loader2, Search, UploadCloud} from "lucide-react";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {MediaUpload} from "@/components/admin/media-upload";
import {mergeMediaItems} from "@/components/admin/media-picker";
import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import type {AdminMediaAsset} from "@/lib/domain";
import {cn} from "@/lib/utils";

export type MediaPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  selectedId?: string | null;
  onSelect: (mediaId: string, asset?: AdminMediaAsset) => void;
  onSelectMultiple?: (assets: AdminMediaAsset[]) => void;
  confirmLabel?: string;
};

type LoadState = "loading" | "ready" | "error";

export function MediaPickerDialog({
  open,
  onOpenChange,
  title = "Select media",
  description = "Choose a photo from your media library or upload a new one.",
  selectedId = null,
  onSelect,
  onSelectMultiple,
  confirmLabel,
}: MediaPickerDialogProps): React.ReactElement {
  const isMultiple = Boolean(onSelectMultiple);
  const [items, setItems] = React.useState<AdminMediaAsset[]>([]);
  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [selectedIds, setSelectedIds] = React.useState<string[]>(selectedId ? [selectedId] : []);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"upload" | "library">("upload");
  const [uploadedAssets, setUploadedAssets] = React.useState<AdminMediaAsset[]>([]);

  const itemsRef = React.useRef<AdminMediaAsset[]>([]);
  const requestSequence = React.useRef(0);

  React.useEffect(() => {
    if (open) {
      setSelectedIds(selectedId ? [selectedId] : []);
      setSearchQuery("");
      setActiveTab("upload");
      setUploadedAssets([]);
    }
  }, [open, selectedId]);

  const updateItems = (update: (current: AdminMediaAsset[]) => AdminMediaAsset[]): void => {
    setItems((current) => {
      const next = update(current);
      itemsRef.current = next;
      return next;
    });
  };

  const requestMedia = React.useCallback(async (): Promise<void> => {
    const requestId = ++requestSequence.current;
    const requestItemIds = new Set(itemsRef.current.map((item) => item.id));
    try {
      const response = await fetch("/api/admin/media");
      if (!response.ok) throw new Error(`Media request failed (${response.status})`);
      const data = (await response.json()) as {items: AdminMediaAsset[]};
      if (requestId !== requestSequence.current) return;
      updateItems((current) => mergeMediaItems(current, data.items, requestItemIds));
      setLoadState("ready");
    } catch {
      if (requestId === requestSequence.current) setLoadState("error");
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const requestId = ++requestSequence.current;
    const requestItemIds = new Set(itemsRef.current.map((item) => item.id));

    void fetch("/api/admin/media")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Media request failed (${response.status})`);
        return (await response.json()) as {items: AdminMediaAsset[]};
      })
      .then((data) => {
        if (cancelled || requestId !== requestSequence.current) return;
        updateItems((current) => mergeMediaItems(current, data.items, requestItemIds));
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled && requestId === requestSequence.current) setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.publicId.toLowerCase().includes(query));
  }, [items, searchQuery]);

  const handleConfirm = (): void => {
    if (selectedIds.length === 0) return;
    const selectedAssets = items.filter((item) => selectedIds.includes(item.id));
    if (isMultiple && onSelectMultiple) {
      onSelectMultiple(selectedAssets);
      if (selectedAssets[0]) {
        onSelect(selectedAssets[0].id, selectedAssets[0]);
      }
    } else {
      const firstId = selectedIds[0];
      const asset = items.find((item) => item.id === firstId);
      if (firstId) {
        onSelect(firstId, asset);
      }
    }
    onOpenChange(false);
  };

  const handleUploadComplete = (media: AdminMediaAsset): void => {
    updateItems((current) => [media, ...current.filter((item) => item.id !== media.id)]);
    setSelectedIds((current) => isMultiple ? [...current.filter((id) => id !== media.id), media.id] : [media.id]);
    setUploadedAssets((current) => [media, ...current.filter((item) => item.id !== media.id)]);
  };

  const handleUploadRemove = (_id: string, mediaId: string | null): void => {
    if (mediaId) {
      setUploadedAssets((current) => current.filter((asset) => asset.id !== mediaId));
      setItems((current) => current.filter((asset) => asset.id !== mediaId));
      setSelectedIds((current) => current.filter((id) => id !== mediaId));
    }
  };

  const handleUploadConfirm = (): void => {
    if (uploadedAssets.length === 0) return;
    if (onSelectMultiple) {
      onSelectMultiple(uploadedAssets);
    } else {
      const latest = uploadedAssets[0];
      onSelect(latest.id, latest);
    }
    onOpenChange(false);
  };

  const toggleSelect = (item: AdminMediaAsset): void => {
    if (isMultiple) {
      setSelectedIds((current) =>
        current.includes(item.id)
          ? current.filter((id) => id !== item.id)
          : [...current, item.id]
      );
    } else {
      setSelectedIds((current) => (current.includes(item.id) ? [] : [item.id]));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "upload" | "library")} variant="line" className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-1">
            <TabsList variant="line" className="border-b border-border">
              <TabsTrigger value="upload" className="gap-1.5 text-xs">
                <UploadCloud className="size-3.5" />
                <span>Upload new</span>
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-1.5 text-xs">
                <ImageIcon className="size-3.5" />
                <span>Media library</span>
                {items.length > 0 ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                    {items.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <TabsContent value="upload" forceMount className="data-[state=inactive]:hidden m-0 py-2 outline-none">
              <div className="max-w-lg mx-auto py-4">
                <MediaUpload onComplete={handleUploadComplete} onRemove={handleUploadRemove} />
              </div>
            </TabsContent>

            <TabsContent value="library" forceMount className="data-[state=inactive]:hidden m-0 space-y-4 outline-none">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search media by filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {loadState === "loading" && items.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="size-6 animate-spin" />
                  <span className="text-xs">Loading media assets...</span>
                </div>
              ) : null}

              {loadState === "error" && items.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-destructive">Failed to load media assets.</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void requestMedia()}>
                    Try again
                  </Button>
                </div>
              ) : null}

              {loadState === "ready" && filteredItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <ImageIcon className="size-8 mx-auto opacity-50" />
                  <p className="text-xs">
                    {searchQuery ? "No media assets matched your search." : "No media uploaded yet."}
                  </p>
                  {!searchQuery ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setActiveTab("upload")}>
                      Upload your first photo
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {filteredItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 items-start">
                  {filteredItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSelect(item)}
                        onDoubleClick={() => {
                          if (isMultiple && onSelectMultiple) {
                            const nextIds = selectedIds.includes(item.id) ? selectedIds : [...selectedIds, item.id];
                            const chosen = items.filter((it) => nextIds.includes(it.id));
                            onSelectMultiple(chosen.length > 0 ? chosen : [item]);
                            onSelect(item.id, item);
                          } else {
                            onSelect(item.id, item);
                          }
                          onOpenChange(false);
                        }}
                        title={`${item.publicId} (${item.width} × ${item.height})`}
                        aria-pressed={isSelected}
                        className={cn(
                          "group relative block aspect-square w-full overflow-hidden rounded-xl border p-0 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "border-[var(--line)] ring-2 ring-sidebar-primary/80 shadow-xs hover:border-[#964242]/50 hover:ring-[#964242]/15"
                            : "border-border hover:border-foreground/40 shadow-2xs"
                        )}
                      >
                        {/* Edge-to-edge 1:1 image container ensuring strictly uniform card dimensions */}
                        <div className="absolute inset-0 size-full overflow-hidden pointer-events-none">
                          <CloudinaryImage
                            asset={item}
                            alt=""
                            sizes="(min-width: 640px) 25vw, 50vw"
                            className="size-full object-cover transition-transform duration-200 group-hover:scale-103"
                          />
                        </div>

                        {/* Top-right selection indicator - transparent directly on photo, no background, fixed position */}
                        {isSelected ? (
                          <div
                            className="absolute top-2.5 right-2.5 z-20 flex items-center justify-center pointer-events-none"
                            title="Click to deselect"
                          >
                            <svg
                              className="size-5 block group-hover:hidden text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <svg
                              className="size-5 hidden group-hover:block text-[#E26D6D] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M6 6l12 12M18 6l-12 12" />
                            </svg>
                          </div>
                        ) : null}

                        {/* Photo title & metadata label - transparent gradient scrim like before */}
                        <div
                          className={cn(
                            "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-2.5 pt-7 transition-opacity duration-150 flex flex-col justify-end pointer-events-none",
                            isSelected
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                          )}
                        >
                          <p className="truncate text-[11px] font-medium leading-tight text-white drop-shadow-xs">
                            {item.publicId}
                          </p>
                          <p className="text-[10px] text-white/80 font-mono mt-0.5 drop-shadow-xs">
                            {item.width} × {item.height} px
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-4 border-t border-border bg-muted/10 flex sm:justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground truncate hidden sm:flex items-center gap-1.5">
            {activeTab === "upload" ? (
              <span>
                {uploadedAssets.length > 0
                  ? `${uploadedAssets.length} photo${uploadedAssets.length > 1 ? "s" : ""} uploaded and ready.`
                  : "Upload photos, then click the button below to add."}
              </span>
            ) : selectedIds.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {selectedIds.length} {selectedIds.length === 1 ? "photo" : "photos"} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  (Deselect all)
                </button>
              </div>
            ) : (
              <span>{isMultiple ? "Click photos to select multiple" : "Click a photo to select"}</span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {activeTab === "upload" ? (
              <Button
                type="button"
                size="sm"
                disabled={uploadedAssets.length === 0}
                onClick={handleUploadConfirm}
                className="gap-1.5 cursor-pointer bg-[var(--charcoal)] text-[var(--ivory)] hover:bg-[var(--charcoal)]/90"
              >
                <Check className="size-3.5" />
                <span>
                  {confirmLabel
                    ? confirmLabel
                    : uploadedAssets.length > 1
                    ? `Add ${uploadedAssets.length} photos`
                    : "Add photo"}
                </span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={handleConfirm}
                className="gap-1.5 cursor-pointer bg-[var(--charcoal)] text-[var(--ivory)] hover:bg-[var(--charcoal)]/90"
              >
                <Check className="size-3.5" />
                <span>
                  {confirmLabel
                    ? isMultiple && selectedIds.length > 1
                      ? `${confirmLabel} (${selectedIds.length})`
                      : confirmLabel
                    : selectedIds.length > 1
                    ? `Add ${selectedIds.length} photos`
                    : "Use selected photo"}
                </span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

