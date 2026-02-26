import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  motion,
  AnimatePresence,
  useDragControls,
  type MotionProps,
} from 'motion/react';
import { getMaxFileMb, getMaxFiles, hasSupportedExtension, isSupportedContentType } from '@/lib/ingestion/limits';
import type { ExtractedEntry, IngestionFileStatus, IngestionStatus } from '@/lib/ingestion/types';
import { cn } from '../ui/utils';

interface FadeScreenProps extends MotionProps {
  children: ReactNode;
  className?: string;
}

export function FadeScreen({
  children,
  className,
  ...motionProps
}: FadeScreenProps) {
  return (
    <motion.div
      className={cn('screen-root', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

interface ScreenHeaderProps {
  currentDate: string;
  currentTime: string;
  className?: string;
}

export function ScreenHeader({
  currentDate,
  currentTime,
  className,
}: ScreenHeaderProps) {
  return (
    <div className={cn('screen-header', className)}>
      <p className="screen-header-date">{currentDate}</p>
      <p className="screen-header-time">{currentTime}</p>
    </div>
  );
}

interface EnterIconProps {
  tone?: 'light' | 'dark';
}

export function EnterIcon({ tone = 'light' }: EnterIconProps) {
  const fill = tone === 'dark' ? 'black' : 'white';

  return (
    <div className="relative size-[16px] shrink-0">
      <svg
        className="absolute block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <path
          d="M7.33359 5.99994L8.28026 6.9466L5.88693 9.33327H12.0003V2.6666H13.3336V10.6666H5.88693L8.28026 13.0533L7.33359 13.9999L3.33359 9.99994L7.33359 5.99994Z"
          fill={fill}
          fillOpacity="0.5"
        />
      </svg>
    </div>
  );
}

interface EnterActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'light' | 'dark';
  variant?: 'outline' | 'solid';
}

export function EnterActionButton({
  label,
  tone = 'light',
  variant = 'outline',
  className,
  ...buttonProps
}: EnterActionButtonProps) {
  return (
    <button
      className={cn(
        variant === 'solid'
          ? 'action-solid'
          : 'action-outline',
        className,
      )}
      {...buttonProps}
    >
      <div aria-hidden="true" className="action-border" />
      <p
        className={
          tone === 'dark'
            ? 'action-label-dark'
            : 'action-label-light'
        }
      >
        {label}
      </p>
      <EnterIcon tone={tone} />
    </button>
  );
}

const CLIENT_ID_STORAGE_KEY = 'veap_anonymous_client_id';
const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES: IngestionStatus[] = ['COMPLETED', 'PARTIAL_FAILED', 'FAILED'];
const MODAL_RIGHT_OFFSET_PX = 24;
const MODAL_BOTTOM_OFFSET_PX = 80;

type UploadState = 'pending' | 'uploading' | 'uploaded' | 'failed';

interface LocalUploadFile {
  clientFileId: string;
  file: File;
  name: string;
  contentType: string;
  size: number;
  key?: string;
  uploadState: UploadState;
  uploadError?: string;
}

interface PresignUpload {
  clientFileId: string;
  key: string;
  putUrl: string;
  expiresInSeconds: number;
}

interface PresignResponse {
  ingestionId: string;
  uploads: PresignUpload[];
}

interface SubmitResponse {
  ingestionId: string;
  status: IngestionStatus;
  pollUrl: string;
}

interface StatusResponse {
  ingestionId: string;
  status: IngestionStatus;
  totals: {
    total: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  };
  files: Array<{
    clientFileId: string;
    status: IngestionFileStatus;
    errorMessage?: string | null;
  }>;
}

interface ResultsResponse {
  ingestionId: string;
  entries: ExtractedEntry[];
}

function PrimaryDockIcon({ onClick }: { onClick: () => void }) {
  return (
    <div className="dock-shell">
      <button
        onClick={onClick}
        className="dock-glass cursor-pointer bg-[rgba(235,235,235,0.3)] transition-colors hover:bg-[rgba(255,255,255,0.4)]"
      >
        <div
          aria-hidden="true"
          className="dock-glass-border"
        />
        <div className="dock-icon-frame">
          <svg
            width="40"
            height="40"
            fill="none"
            viewBox="0 0 40 40"
          >
            <path
              d="M33.0361 10.0001C33.5202 10.0002 33.9984 10.1058 34.4375 10.3095C34.8766 10.5132 35.266 10.81 35.5788 11.1794C35.8916 11.5488 36.1202 11.9819 36.2486 12.4486C36.3771 12.9152 36.4024 13.4043 36.3228 13.8817L33.5461 30.5484C33.4163 31.3267 33.0146 32.0337 32.4125 32.5437C31.8104 33.0537 31.0469 33.3335 30.2578 33.3334H9.74781C8.95875 33.3335 8.19523 33.0537 7.5931 32.5437C6.99098 32.0337 6.58928 31.3267 6.45948 30.5484L3.68281 13.8817C3.60319 13.4043 3.6285 12.9152 3.75698 12.4486C3.88547 11.9819 4.11404 11.5488 4.42682 11.1794C4.73959 10.81 5.12907 10.5132 5.56817 10.3095C6.00726 10.1058 6.48545 10.0002 6.96948 10.0001H33.0361Z"
              fill="white"
              fillOpacity="0.9"
            />
            <path
              d="M30.0019 5.0001C30.4439 5.0001 30.8678 5.17569 31.1804 5.48825C31.4929 5.80081 31.6685 6.22474 31.6685 6.66677C31.6685 7.10879 31.4929 7.53272 31.1804 7.84528C30.8678 8.15784 30.4439 8.33343 30.0019 8.33343H10.0019C9.55985 8.33343 9.13593 8.15784 8.82336 7.84528C8.5108 7.53272 8.33521 7.10879 8.33521 6.66677C8.33521 6.22474 8.5108 5.80081 8.82336 5.48825C9.13593 5.17569 9.55985 5.0001 10.0019 5.0001H30.0019Z"
              fill="white"
              fillOpacity="0.9"
              opacity="0.3"
            />
          </svg>
        </div>
      </button>
    </div>
  );
}

function normalizeContentType(file: File): string {
  const lowerType = file.type.toLowerCase();
  if (lowerType) {
    return lowerType;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.heic')) return 'image/heic';
  if (lowerName.endsWith('.heif')) return 'image/heif';
  return 'application/octet-stream';
}

function getOrCreateClientId(): string {
  const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (stored) {
    return stored;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
  return created;
}

function isTerminalStatus(status: IngestionStatus | null): boolean {
  if (!status) {
    return false;
  }
  return TERMINAL_STATUSES.includes(status);
}

function parseErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const candidate = payload as { error?: unknown };
  return typeof candidate.error === 'string' ? candidate.error : fallback;
}

function ImporterPopup({
  isVisible,
  onClose,
}: {
  isVisible: boolean;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);
  const clientIdRef = useRef<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const [files, setFiles] = useState<LocalUploadFile[]>([]);
  const [ingestionId, setIngestionId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<IngestionStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusTotals, setStatusTotals] = useState<StatusResponse['totals'] | null>(null);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragConstraints, setDragConstraints] = useState({
    top: 0,
    right: MODAL_RIGHT_OFFSET_PX,
    bottom: MODAL_BOTTOM_OFFSET_PX,
    left: 0,
  });
  const [serverFileStatuses, setServerFileStatuses] = useState<Record<string, {
    status: IngestionFileStatus;
    errorMessage?: string | null;
  }>>({});

  const maxFiles = getMaxFiles();
  const maxFileMb = getMaxFileMb();

  const getClientId = useCallback(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = getOrCreateClientId();
    }
    return clientIdRef.current;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollInFlightRef.current = false;
  }, []);

  const resetState = useCallback(() => {
    stopPolling();
    uploadInFlightRef.current = false;
    setFiles([]);
    setIngestionId(null);
    setWorkflowStatus(null);
    setStatusTotals(null);
    setResultCount(null);
    setError(null);
    setServerFileStatuses({});
    setIsSubmitting(false);
  }, [stopPolling]);

  const fetchResults = useCallback(
    async (targetIngestionId: string) => {
      const response = await fetch(`/api/ingestion/${targetIngestionId}/results`, {
        headers: {
          'x-client-id': getClientId(),
        },
      });

      if (response.status === 409) {
        return;
      }

      const payload = (await response.json()) as ResultsResponse | { error?: string };
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload, 'Failed to fetch ingestion results.'));
      }

      const successPayload = payload as ResultsResponse;
      setResultCount(Array.isArray(successPayload.entries) ? successPayload.entries.length : 0);
    },
    [getClientId],
  );

  const pollStatus = useCallback(
    async (targetIngestionId: string) => {
      if (pollInFlightRef.current) {
        return;
      }

      pollInFlightRef.current = true;

      try {
        const response = await fetch(`/api/ingestion/${targetIngestionId}/status`, {
          headers: {
            'x-client-id': getClientId(),
          },
        });

        const payload = (await response.json()) as StatusResponse | { error?: string };
        if (!response.ok) {
          throw new Error(parseErrorMessage(payload, 'Failed to fetch ingestion status.'));
        }

        const successPayload = payload as StatusResponse;
        setWorkflowStatus(successPayload.status);
        setStatusTotals(successPayload.totals);

        const nextStatuses: Record<string, { status: IngestionFileStatus; errorMessage?: string | null }> = {};
        for (const file of successPayload.files) {
          nextStatuses[file.clientFileId] = {
            status: file.status,
            errorMessage: file.errorMessage,
          };
        }
        setServerFileStatuses(nextStatuses);

        if (isTerminalStatus(successPayload.status)) {
          stopPolling();
          if (successPayload.status === 'COMPLETED' || successPayload.status === 'PARTIAL_FAILED') {
            await fetchResults(targetIngestionId);
          }
        }
      } catch (pollError) {
        stopPolling();
        setError(pollError instanceof Error ? pollError.message : 'Polling failed.');
      } finally {
        pollInFlightRef.current = false;
      }
    },
    [fetchResults, getClientId, stopPolling],
  );

  const startPolling = useCallback(
    (targetIngestionId: string) => {
      stopPolling();
      void pollStatus(targetIngestionId);
      pollIntervalRef.current = setInterval(() => {
        void pollStatus(targetIngestionId);
      }, POLL_INTERVAL_MS);
    },
    [pollStatus, stopPolling],
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const updateDragConstraints = useCallback(() => {
    if (!popupRef.current) {
      return;
    }

    const { width: modalWidth, height: modalHeight } = popupRef.current.getBoundingClientRect();
    const availableLeftTravel = Math.max(
      0,
      window.innerWidth - modalWidth - MODAL_RIGHT_OFFSET_PX,
    );
    const availableTopTravel = Math.max(
      0,
      window.innerHeight - modalHeight - MODAL_BOTTOM_OFFSET_PX,
    );

    setDragConstraints({
      top: -availableTopTravel,
      right: MODAL_RIGHT_OFFSET_PX,
      bottom: MODAL_BOTTOM_OFFSET_PX,
      left: -availableLeftTravel,
    });
  }, []);

  useEffect(() => {
    if (!isVisible || !popupRef.current) {
      return;
    }

    updateDragConstraints();

    window.addEventListener('resize', updateDragConstraints);
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', updateDragConstraints);
      };
    }

    const popupNode = popupRef.current;
    const resizeObserver = new ResizeObserver(() => {
      updateDragConstraints();
    });
    resizeObserver.observe(popupNode);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDragConstraints);
    };
  }, [isVisible, updateDragConstraints]);

  const startUploadBatch = useCallback(
    async (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) {
        return;
      }

      if (uploadInFlightRef.current) {
        setError('An upload is already in progress.');
        return;
      }

      uploadInFlightRef.current = true;

      try {
        setError(null);
        setStatusTotals(null);
        setResultCount(null);
        setServerFileStatuses({});
        stopPolling();

        if (selectedFiles.length > maxFiles) {
          setError(`You can upload up to ${maxFiles} files at once.`);
          return;
        }

        const oversized = selectedFiles.find((file) => file.size > maxFileMb * 1024 * 1024);
        if (oversized) {
          setError(`${oversized.name} exceeds the ${maxFileMb} MB limit.`);
          return;
        }

        const unsupported = selectedFiles.find((file) => {
          const normalizedType = normalizeContentType(file);
          return !isSupportedContentType(normalizedType) || !hasSupportedExtension(file.name);
        });
        if (unsupported) {
          setError(`${unsupported.name} is not a supported file type.`);
          return;
        }

        const localFiles: LocalUploadFile[] = selectedFiles.map((file) => ({
          clientFileId: crypto.randomUUID(),
          file,
          name: file.name,
          contentType: normalizeContentType(file),
          size: file.size,
          uploadState: 'pending',
        }));

        setFiles(localFiles);
        setWorkflowStatus('UPLOADING');

        const presignResponse = await fetch('/api/ingestion/presign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': getClientId(),
          },
          body: JSON.stringify({
            files: localFiles.map((file) => ({
              clientFileId: file.clientFileId,
              name: file.name,
              contentType: file.contentType,
              size: file.size,
            })),
          }),
        });

        const presignPayload = (await presignResponse.json()) as PresignResponse | { error?: string };
        if (!presignResponse.ok) {
          throw new Error(parseErrorMessage(presignPayload, 'Failed to start upload batch.'));
        }

        const successPayload = presignPayload as PresignResponse;
        setIngestionId(successPayload.ingestionId);

        const uploadById = new Map(successPayload.uploads.map((upload) => [upload.clientFileId, upload]));
        setFiles((current) =>
          current.map((file) => ({
            ...file,
            key: uploadById.get(file.clientFileId)?.key,
          })),
        );

        const uploadedStates = await Promise.all(
          localFiles.map(async (file) => {
            const upload = uploadById.get(file.clientFileId);
            if (!upload) {
              setFiles((current) =>
                current.map((item) =>
                  item.clientFileId === file.clientFileId
                    ? {
                        ...item,
                        uploadState: 'failed',
                        uploadError: 'Missing upload target from presign API.',
                      }
                    : item,
                ),
              );
              return false;
            }

            setFiles((current) =>
              current.map((item) =>
                item.clientFileId === file.clientFileId
                  ? {
                      ...item,
                      uploadState: 'uploading',
                      uploadError: undefined,
                    }
                  : item,
              ),
            );

            try {
              const uploadResponse = await fetch(upload.putUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': file.contentType,
                },
                body: file.file,
              });

              if (!uploadResponse.ok) {
                throw new Error(`Upload failed with status ${uploadResponse.status}.`);
              }

              setFiles((current) =>
                current.map((item) =>
                  item.clientFileId === file.clientFileId
                    ? {
                        ...item,
                        uploadState: 'uploaded',
                        uploadError: undefined,
                      }
                    : item,
                ),
              );

              return true;
            } catch (uploadError) {
              setFiles((current) =>
                current.map((item) =>
                  item.clientFileId === file.clientFileId
                    ? {
                        ...item,
                        uploadState: 'failed',
                        uploadError:
                          uploadError instanceof Error
                            ? uploadError.message
                            : 'Upload failed.',
                      }
                    : item,
                ),
              );
              return false;
            }
          }),
        );

        const hasFailures = uploadedStates.some((state) => !state);
        setWorkflowStatus(hasFailures ? 'FAILED' : 'READY_TO_SUBMIT');

        if (hasFailures) {
          setError('Some files failed to upload. Retry or start a new batch.');
        }
      } catch (uploadBatchError) {
        setWorkflowStatus('FAILED');
        setError(uploadBatchError instanceof Error ? uploadBatchError.message : 'Failed to upload files.');
      } finally {
        uploadInFlightRef.current = false;
      }
    },
    [getClientId, maxFileMb, maxFiles, stopPolling],
  );

  const handleInputFiles = useCallback(
    (fileList: FileList | null) => {
      if (
        isSubmitting ||
        workflowStatus === 'UPLOADING' ||
        workflowStatus === 'QUEUED' ||
        workflowStatus === 'PROCESSING'
      ) {
        return;
      }

      if (!fileList || fileList.length === 0) {
        return;
      }
      void startUploadBatch(Array.from(fileList));
    },
    [isSubmitting, startUploadBatch, workflowStatus],
  );

  const handleSubmit = useCallback(async () => {
    if (!ingestionId) {
      setError('No upload batch exists yet.');
      return;
    }

    const submitFiles = files
      .filter((file) => file.uploadState === 'uploaded' && typeof file.key === 'string')
      .map((file) => ({
        clientFileId: file.clientFileId,
        key: file.key as string,
        name: file.name,
        contentType: file.contentType,
        size: file.size,
      }));

    if (submitFiles.length === 0 || submitFiles.length !== files.length) {
      setError('All files must finish uploading before submit.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submitResponse = await fetch('/api/ingestion/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': getClientId(),
        },
        body: JSON.stringify({
          ingestionId,
          files: submitFiles,
        }),
      });

      const payload = (await submitResponse.json()) as SubmitResponse | { error?: string };
      if (!submitResponse.ok) {
        throw new Error(parseErrorMessage(payload, 'Failed to submit ingestion batch.'));
      }

      const successPayload = payload as SubmitResponse;
      setWorkflowStatus(successPayload.status);
      setServerFileStatuses(
        Object.fromEntries(
          submitFiles.map((file) => [
            file.clientFileId,
            {
              status: 'QUEUED' as IngestionFileStatus,
              errorMessage: null,
            },
          ]),
        ),
      );

      startPolling(successPayload.ingestionId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit ingestion batch.');
      setWorkflowStatus('FAILED');
    } finally {
      setIsSubmitting(false);
    }
  }, [files, getClientId, ingestionId, startPolling]);

  const handleRetryUploads = useCallback(() => {
    const retryFiles = files.map((file) => file.file);
    if (retryFiles.length > 0) {
      void startUploadBatch(retryFiles);
    }
  }, [files, startUploadBatch]);

  const uploadedCount = files.filter((file) => file.uploadState === 'uploaded').length;
  const failedUploadCount = files.filter((file) => file.uploadState === 'failed').length;
  const canSubmit =
    workflowStatus === 'READY_TO_SUBMIT' &&
    files.length > 0 &&
    files.every((file) => file.uploadState === 'uploaded') &&
    !isSubmitting;

  const statusLabel = (() => {
    if (workflowStatus === 'UPLOADING') {
      return `Uploading ${uploadedCount}/${files.length} files`;
    }

    if (workflowStatus === 'READY_TO_SUBMIT') {
      return `${uploadedCount} files uploaded. Ready to submit.`;
    }

    if (workflowStatus === 'QUEUED' || workflowStatus === 'PROCESSING') {
      if (statusTotals) {
        return `Processing ${statusTotals.completed + statusTotals.failed}/${statusTotals.total}`;
      }
      return 'Processing started';
    }

    if (workflowStatus === 'COMPLETED') {
      return `Completed${typeof resultCount === 'number' ? ` • ${resultCount} entries extracted` : ''}`;
    }

    if (workflowStatus === 'PARTIAL_FAILED') {
      return `Completed with partial failures${typeof resultCount === 'number' ? ` • ${resultCount} entries extracted` : ''}`;
    }

    if (workflowStatus === 'FAILED') {
      if (failedUploadCount > 0) {
        return `${failedUploadCount} uploads failed`;
      }
      return 'Ingestion failed';
    }

    return `Supports PDF, JPG, PNG, HEIC up to ${maxFileMb} MB`;
  })();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={popupRef}
          className="absolute bottom-[80px] right-[24px] bg-[#333332] rounded-[2px] w-[384px] z-20"
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
          <div className="flex flex-col items-end justify-center overflow-clip rounded-[inherit] w-full">
            <div className="relative w-full">
              <div
                aria-hidden="true"
                className="absolute border-[rgba(255,255,255,0.1)] border-b border-solid inset-0 pointer-events-none"
              />
              <div
                className="flex items-center justify-between p-[8px] w-full cursor-move select-none touch-none"
                onPointerDown={(event) => {
                  dragControls.start(event);
                }}
              >
                <div className="flex gap-[8px] items-center justify-center">
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 16 16"
                  >
                    <path
                      d="M13.2152 4C13.4088 4.00007 13.6001 4.04231 13.7758 4.12378C13.9514 4.20524 14.1072 4.32398 14.2323 4.47174C14.3574 4.6195 14.4488 4.79274 14.5002 4.97941C14.5516 5.16607 14.5617 5.36169 14.5299 5.55267L13.4192 12.2193C13.3673 12.5307 13.2066 12.8135 12.9658 13.0175C12.7249 13.2214 12.4195 13.3334 12.1039 13.3333H3.89989C3.58427 13.3334 3.27886 13.2214 3.03801 13.0175C2.79716 12.8135 2.63648 12.5307 2.58456 12.2193L1.47389 5.55267C1.44204 5.36169 1.45217 5.16607 1.50356 4.97941C1.55496 4.79274 1.64639 4.6195 1.7715 4.47174C1.89661 4.32398 2.0524 4.20524 2.22803 4.12378C2.40367 4.04231 2.59495 4.00007 2.78856 4H13.2152Z"
                      fill="white"
                      fillOpacity="0.9"
                    />
                    <path
                      d="M12 2C12.1768 2 12.3464 2.07024 12.4714 2.19526C12.5964 2.32029 12.6667 2.48986 12.6667 2.66667C12.6667 2.84348 12.5964 3.01305 12.4714 3.13807C12.3464 3.2631 12.1768 3.33333 12 3.33333H4C3.82319 3.33333 3.65362 3.2631 3.5286 3.13807C3.40357 3.01305 3.33333 2.84348 3.33333 2.66667C3.33333 2.48986 3.40357 2.32029 3.5286 2.19526C3.65362 2.07024 3.82319 2 4 2H12Z"
                      fill="white"
                      fillOpacity="0.9"
                      opacity="0.3"
                    />
                  </svg>
                  <p className="font-manrope font-semibold leading-[normal] text-[12px] text-white">
                    Importer
                  </p>
                </div>
                <button
                  onClick={onClose}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  className="bg-[rgba(255,255,255,0.1)] flex items-center p-[2px] cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    viewBox="0 0 7.364 9.583"
                  >
                    <path
                      clipRule="evenodd"
                      d="M3.68814 4.38286L6.51664 7.21136C6.61095 7.30243 6.73725 7.35283 6.86834 7.35169C6.99944 7.35055 7.12485 7.29797 7.21755 7.20527C7.31026 7.11256 7.36284 6.98716 7.36398 6.85606C7.36512 6.72496 7.31472 6.59866 7.22364 6.50436L4.39514 3.67586L7.22364 0.847356C7.31472 0.753055 7.36512 0.626754 7.36398 0.495655C7.36284 0.364557 7.31026 0.239151 7.21755 0.146447C7.12485 0.0537427 6.99944 0.00115811 6.86834 1.89013e-05C6.73725 -0.00112031 6.61095 0.0492769 6.51664 0.140356L3.68814 2.96886L0.859644 0.140356C0.764919 0.0515283 0.639351 0.00303865 0.509509 0.00514705C0.379668 0.00725544 0.25574 0.0597966 0.163949 0.151653C0.0721575 0.243509 0.0197039 0.367474 0.0176874 0.497317C0.0156708 0.627159 0.0642494 0.752693 0.153144 0.847356L2.98114 3.67586L0.152644 6.50436C0.104889 6.55048 0.0667979 6.60565 0.0405934 6.66665C0.0143889 6.72766 0.000595787 6.79327 1.88785e-05 6.85966C-0.00055803 6.92605 0.0120927 6.99188 0.0372332 7.05333C0.0623736 7.11478 0.0995002 7.17061 0.146447 7.21755C0.193393 7.2645 0.249219 7.30163 0.310667 7.32677C0.372115 7.35191 0.437955 7.36456 0.504345 7.36398C0.570734 7.3634 0.636344 7.34961 0.697346 7.32341C0.758348 7.2972 0.813521 7.25911 0.859644 7.21136L3.68814 4.38286Z"
                      fill="white"
                      fillOpacity="0.9"
                      fillRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center pb-[24px] pt-[40px] px-[32px] w-full">
              <div className="flex flex-col gap-[8px] items-center leading-[normal] text-center">
                <p className="font-manrope font-semibold text-[20px] text-white w-[320px]">
                  Bring in your journal
                </p>
                <p className="font-manrope font-normal text-[12px] text-[rgba(255,255,255,0.6)] w-[320px]">
                  Upload past entries so the archive can read, connect, and reflect on your earlier thoughts.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center px-[24px] pb-[24px] w-full gap-[12px]">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif"
                className="hidden"
                onChange={(event) => {
                  handleInputFiles(event.target.files);
                  event.currentTarget.value = '';
                }}
              />

              <div
                className={cn(
                  'flex flex-col gap-[12px] items-center w-full rounded-[3px] border border-dashed px-[12px] py-[12px] transition-colors',
                  isDragging ? 'border-white bg-[rgba(255,255,255,0.08)]' : 'border-[rgba(255,255,255,0.2)]',
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  handleInputFiles(event.dataTransfer.files);
                }}
              >
                <button
                  className="bg-[rgba(255,255,255,0.9)] relative rounded-[3px] w-full cursor-pointer hover:bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={
                    isSubmitting ||
                    workflowStatus === 'UPLOADING' ||
                    workflowStatus === 'QUEUED' ||
                    workflowStatus === 'PROCESSING'
                  }
                >
                  <div
                    aria-hidden="true"
                    className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]"
                  />
                  <div className="flex gap-[8px] items-center justify-center p-[12px] w-full">
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      viewBox="0 0 16 16"
                    >
                      <path
                        d="M7.33333 8.66667H3.33333V7.33333H7.33333V3.33333H8.66667V7.33333H12.6667V8.66667H8.66667V12.6667H7.33333V8.66667Z"
                        fill="black"
                        fillOpacity="0.4"
                      />
                    </svg>
                    <p className="font-inter font-normal leading-[normal] text-[14px] text-black">
                      UPLOAD JOURNAL
                    </p>
                  </div>
                </button>
                <p className="font-manrope font-semibold leading-[normal] text-[12px] text-[rgba(255,255,255,0.6)] text-center">
                  or drag and drop
                </p>
              </div>

              <p className="font-manrope text-[12px] text-[rgba(255,255,255,0.75)] text-center w-full">
                {statusLabel}
              </p>

              {files.length > 0 && (
                <div className="w-full max-h-[148px] overflow-auto rounded-[3px] border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.12)]">
                  {files.map((file) => {
                    const serverStatus = serverFileStatuses[file.clientFileId];
                    const statusText = serverStatus
                      ? serverStatus.status === 'FAILED'
                        ? `Failed${serverStatus.errorMessage ? `: ${serverStatus.errorMessage}` : ''}`
                        : serverStatus.status === 'COMPLETED'
                          ? 'Processed'
                          : serverStatus.status === 'PROCESSING'
                            ? 'Processing'
                            : 'Queued'
                      : file.uploadState === 'uploaded'
                        ? 'Uploaded'
                        : file.uploadState === 'uploading'
                          ? 'Uploading'
                          : file.uploadState === 'failed'
                            ? `Upload failed${file.uploadError ? `: ${file.uploadError}` : ''}`
                            : 'Pending upload';

                    return (
                      <div
                        key={file.clientFileId}
                        className="flex items-center justify-between gap-[12px] px-[10px] py-[8px] border-b border-[rgba(255,255,255,0.08)] last:border-b-0"
                      >
                        <p className="font-manrope text-[12px] text-[rgba(255,255,255,0.9)] truncate">
                          {file.name}
                        </p>
                        <p className="font-manrope text-[11px] text-[rgba(255,255,255,0.65)] whitespace-nowrap">
                          {statusText}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {error && (
                <p className="font-manrope text-[12px] text-[#ffb3b3] text-center w-full">{error}</p>
              )}

              <div className="flex gap-[8px] w-full">
                <button
                  onClick={resetState}
                  className="flex-1 border border-[rgba(255,255,255,0.2)] rounded-[3px] px-[10px] py-[10px] font-inter text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                >
                  RESET
                </button>

                {workflowStatus === 'FAILED' && files.length > 0 && (
                  <button
                    onClick={handleRetryUploads}
                    className="flex-1 border border-[rgba(255,255,255,0.2)] rounded-[3px] px-[10px] py-[10px] font-inter text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                  >
                    RETRY UPLOADS
                  </button>
                )}

                {canSubmit && (
                  <button
                    onClick={() => {
                      void handleSubmit();
                    }}
                    className="flex-1 bg-[rgba(255,255,255,0.9)] rounded-[3px] px-[10px] py-[10px] font-inter text-[12px] text-black hover:bg-white transition-colors"
                  >
                    SUBMIT
                  </button>
                )}
              </div>

              {ingestionId && (
                <p className="font-manrope text-[10px] text-[rgba(255,255,255,0.45)] text-center break-all">
                  Ingestion ID: {ingestionId}
                </p>
              )}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[2px] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.25)]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DockWithImporter() {
  const [showImporter, setShowImporter] = useState(false);
  const toggleImporter = useCallback(
    () => setShowImporter((v) => !v),
    [],
  );

  return (
    <>
      <PrimaryDockIcon onClick={toggleImporter} />
      <ImporterPopup
        isVisible={showImporter}
        onClose={() => setShowImporter(false)}
      />
    </>
  );
}
