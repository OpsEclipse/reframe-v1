"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { FileText, Trash2, X } from "lucide-react";
import {
  groupArchiveEntries,
  type ArchiveEntryReference,
} from "@/lib/entries/archive";
import type { ExtractedEntry } from "@/lib/ingestion/types";

const MODAL_RIGHT_OFFSET_PX = 84;
const MODAL_BOTTOM_OFFSET_PX = 80;

interface EntriesResponse {
  count: number;
  entries: ArchiveEntryReference[];
}

interface EntryDetailResponse {
  entry_id: string;
  entry_date: string | null;
  source_file: string | null;
  content: ExtractedEntry;
  error?: string;
}

interface OldEntriesArchiveProps {
  isVisible: boolean;
  onClose: () => void;
}

function parseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const candidate = payload as { error?: unknown };
    if (typeof candidate.error === "string") return candidate.error;
  }
  return fallback;
}

export function OldEntriesArchive({
  isVisible,
  onClose,
}: OldEntriesArchiveProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [entries, setEntries] = useState<ArchiveEntryReference[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntryDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragConstraints, setDragConstraints] = useState({
    top: 0,
    right: MODAL_RIGHT_OFFSET_PX,
    bottom: MODAL_BOTTOM_OFFSET_PX,
    left: 0,
  });

  const groups = useMemo(() => groupArchiveEntries(entries), [entries]);
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.entry_id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  const updateDragConstraints = useCallback(() => {
    if (!popupRef.current) return;
    const { width: modalWidth, height: modalHeight } =
      popupRef.current.getBoundingClientRect();
    setDragConstraints({
      top: -Math.max(
        0,
        window.innerHeight - modalHeight - MODAL_BOTTOM_OFFSET_PX,
      ),
      right: MODAL_RIGHT_OFFSET_PX,
      bottom: MODAL_BOTTOM_OFFSET_PX,
      left: -Math.max(
        0,
        window.innerWidth - modalWidth - MODAL_RIGHT_OFFSET_PX,
      ),
    });
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    updateDragConstraints();
    window.addEventListener("resize", updateDragConstraints);
    return () => window.removeEventListener("resize", updateDragConstraints);
  }, [isVisible, updateDragConstraints]);

  useEffect(() => {
    if (!isVisible) return;

    let isActive = true;
    setIsLoadingList(true);
    setListError(null);

    fetch("/api/entries")
      .then(async (response) => {
        const payload = (await response.json()) as
          | EntriesResponse
          | { error?: string };
        if (!response.ok) {
          throw new Error(parseError(payload, "Failed to load old entries."));
        }
        return payload as EntriesResponse;
      })
      .then((payload) => {
        if (isActive) {
          setEntries(Array.isArray(payload.entries) ? payload.entries : []);
        }
      })
      .catch((error) => {
        if (isActive) {
          setListError(
            error instanceof Error
              ? error.message
              : "Failed to load old entries.",
          );
        }
      })
      .finally(() => {
        if (isActive) setIsLoadingList(false);
      });

    return () => {
      isActive = false;
    };
  }, [isVisible]);

  const openEntry = useCallback((entryId: string) => {
    setSelectedEntryId(entryId);
    setDetail(null);
    setDetailError(null);
    setDeleteError(null);
    setIsConfirmingDelete(false);
    setIsLoadingDetail(true);

    fetch(`/api/entries/${encodeURIComponent(entryId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as
          | EntryDetailResponse
          | { error?: string };
        if (!response.ok) {
          throw new Error(
            parseError(payload, "Entry content could not be loaded."),
          );
        }
        return payload as EntryDetailResponse;
      })
      .then(setDetail)
      .catch((error) => {
        setDetailError(
          error instanceof Error
            ? error.message
            : "Entry content could not be loaded.",
        );
      })
      .finally(() => setIsLoadingDetail(false));
  }, []);

  const closeViewer = useCallback(() => {
    setSelectedEntryId(null);
    setDetail(null);
    setDetailError(null);
    setDeleteError(null);
    setIsConfirmingDelete(false);
    setIsDeleting(false);
  }, []);

  const deleteSelectedEntry = useCallback(async () => {
    if (!selectedEntryId) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/entries/${encodeURIComponent(selectedEntryId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to delete entry."));
      }
      setEntries((current) =>
        current.filter((entry) => entry.entry_id !== selectedEntryId),
      );
      closeViewer();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete entry.",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [closeViewer, selectedEntryId]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={popupRef}
          className="absolute bottom-[80px] right-[84px] z-20 w-[432px] rounded-[2px] bg-[#333332] text-white"
          drag
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={dragConstraints}
          dragElastic={0}
          dragMomentum={false}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex w-full flex-col overflow-hidden rounded-[inherit]">
            <div className="relative border-b border-white/10">
              <div
                className="flex w-full touch-none select-none items-center justify-between p-[8px]"
                onPointerDown={(event) => dragControls.start(event)}
              >
                <div className="flex items-center gap-[8px]">
                  <FileText size={16} className="text-white/90" />
                  <p className="font-manrope text-[12px] font-semibold text-white">
                    We&apos;re seeing old entries
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close old entries"
                  onClick={onClose}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="flex size-[18px] items-center justify-center bg-white/10 text-white/80 transition-colors hover:bg-white/20"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="max-h-[460px] overflow-auto px-[18px] py-[16px]">
              {isLoadingList ? (
                <p className="font-manrope text-[12px] text-white/60">
                  Loading old entries...
                </p>
              ) : listError ? (
                <p className="font-manrope text-[12px] text-[#ffb3b3]">
                  {listError}
                </p>
              ) : groups.length === 0 ? (
                <p className="font-manrope text-[12px] text-white/60">
                  No old entries yet.
                </p>
              ) : (
                <div className="flex flex-col gap-[20px]">
                  {groups.map((group) => (
                    <section key={group.key} className="flex flex-col gap-[10px]">
                      <p className="font-manrope text-[12px] font-semibold text-white/50">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-4 gap-x-[14px] gap-y-[16px]">
                        {group.entries.map((entry) => (
                          <button
                            key={entry.entry_id}
                            type="button"
                            onDoubleClick={() => openEntry(entry.entry_id)}
                            className="flex min-h-[86px] flex-col items-center justify-start gap-[6px] rounded-[4px] px-[4px] py-[6px] text-center transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                          >
                            <FileText size={36} className="text-white/85" />
                            <span className="w-full break-words font-manrope text-[11px] leading-[1.2] text-white/80">
                              {entry.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedEntryId && (
            <div className="absolute bottom-0 left-[-360px] w-[340px] rounded-[2px] bg-[#2b2b2a] shadow-[0px_18px_48px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between border-b border-white/10 p-[8px]">
                <p className="font-manrope text-[12px] font-semibold text-white">
                  {selectedEntry?.entry_date ?? "Undated entry"}
                </p>
                <button
                  type="button"
                  aria-label="Close entry viewer"
                  onClick={closeViewer}
                  className="flex size-[18px] items-center justify-center bg-white/10 text-white/80 transition-colors hover:bg-white/20"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="flex max-h-[420px] flex-col gap-[12px] overflow-auto p-[16px]">
                {selectedEntry?.source_file ? (
                  <p className="font-manrope text-[11px] text-white/45">
                    {selectedEntry.source_file}
                  </p>
                ) : null}

                {isLoadingDetail ? (
                  <p className="font-manrope text-[12px] text-white/60">
                    Opening entry...
                  </p>
                ) : detailError ? (
                  <p className="font-manrope text-[12px] text-[#ffb3b3]">
                    {detailError}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap font-manrope text-[13px] leading-[1.55] text-white/82">
                    {detail?.content.entry_text ?? ""}
                  </p>
                )}

                {deleteError ? (
                  <p className="font-manrope text-[12px] text-[#ffb3b3]">
                    {deleteError}
                  </p>
                ) : null}

                <div className="flex gap-[8px]">
                  {isConfirmingDelete ? (
                    <>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => void deleteSelectedEntry()}
                        className="flex flex-1 items-center justify-center gap-[6px] rounded-[3px] bg-[#ffb3b3] px-[10px] py-[9px] font-inter text-[12px] text-black disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {isDeleting ? "DELETING" : "CONFIRM DELETE"}
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setIsConfirmingDelete(false)}
                        className="rounded-[3px] border border-white/20 px-[10px] py-[9px] font-inter text-[12px] text-white disabled:opacity-60"
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="flex items-center gap-[6px] rounded-[3px] border border-white/20 px-[10px] py-[9px] font-inter text-[12px] text-white transition-colors hover:bg-white/10"
                    >
                      <Trash2 size={14} />
                      DELETE
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[2px] border border-white/5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.25)]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
