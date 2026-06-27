import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import {
	EnterIcon,
	FadeScreen,
	ScreenHeader,
} from './shared/screen-primitives';
import {
	formatEntryReferenceDate,
	getEntryReferenceLabel,
} from '@/lib/reflections/reference-label';

const zigzagPath =
	'M17.6551 0L8.82759 4H26.4827H44.1379H61.7931H79.4482H97.1034H114.759H132.414H150.069H167.724H185.379H203.034H220.69H238.345H256H273.655H291.31H308.966H326.621H344.276H361.931H379.586H397.241H414.897H432.552H450.207H467.862H485.517H503.172L494.345 0L485.517 4L476.69 0L467.862 4L459.034 0L450.207 4L441.379 0L432.552 4L423.724 0L414.897 4L406.069 0L397.241 4L388.414 0L379.586 4L370.759 0L361.931 4L353.103 0L344.276 4L335.448 0L326.621 4L317.793 0L308.966 4L300.138 0L291.31 4L282.483 0L273.655 4L264.828 0L256 4L247.172 0L238.345 4L229.517 0L220.69 4L211.862 0L203.034 4L194.207 0L185.379 4L176.552 0L167.724 4L158.897 0L150.069 4L141.241 0L132.414 4L123.586 0L114.759 4L105.931 0L97.1034 4L88.2758 0L79.4482 4L70.6207 0L61.7931 4L52.9655 0L44.1379 4L35.3103 0L26.4827 4L17.6551 0Z';

// ─── Typewriter Hook ──────────────────────────────────────────────────────────
// Types text character by character with natural, variable speed.
// When `active` goes false, displayed text is preserved (not wiped).
function useTypewriter(
	text: string,
	active: boolean,
	baseSpeed = 24,
) {
	const [displayedText, setDisplayedText] = useState('');
	const [isDone, setIsDone] = useState(false);
	const cancelRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	useEffect(() => {
		if (!active) {
			// Cancel in-flight typing but keep whatever is displayed
			cancelRef.current = true;
			if (timerRef.current) clearTimeout(timerRef.current);
			return;
		}

		// Fresh start
		cancelRef.current = false;
		setDisplayedText('');
		setIsDone(false);

		let charIndex = 0;

		function type() {
			if (cancelRef.current) return;

			if (charIndex >= text.length) {
				setIsDone(true);
				return;
			}

			const char = text[charIndex];
			charIndex++;
			setDisplayedText(text.slice(0, charIndex));

			// Natural speed: base ± jitter, longer pauses on punctuation
			let delay = baseSpeed + (Math.random() * 24 - 12);
			if (['.', '!', '?'].includes(char))
				delay += 120 + Math.random() * 80;
			else if ([',', ';', ':'].includes(char))
				delay += 55 + Math.random() * 35;
			else if (char === '\n') delay += 90;
			else if (char === ' ') delay *= 0.72;

			timerRef.current = setTimeout(type, Math.max(14, delay));
		}

		// Small initial pause before the first character
		timerRef.current = setTimeout(type, 280);

		return () => {
			cancelRef.current = true;
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [active, baseSpeed, text]);

	return { displayedText, isDone };
}

// ─── Blinking Cursor ──────────────────────────────────────────────────────────
function Cursor() {
	return (
		<motion.span
			className="inline-block w-[2px] h-[0.82em] bg-white ml-[1.5px]"
			style={{ verticalAlign: 'text-bottom' }}
			animate={{ opacity: [0.7, 0, 0.7] }}
			transition={{
				duration: 0.88,
				repeat: Infinity,
				ease: 'linear',
			}}
		/>
	);
}

// ─── TypewriterText ───────────────────────────────────────────────────────────
// Renders typed text; shows blinking cursor while active; calls onDone
// ~380ms after the last character is typed so there's a natural beat.
function TypewriterText({
	text,
	active,
	onDone,
	className,
}: {
	text: string;
	active: boolean;
	onDone?: () => void;
	className?: string;
}) {
	const { displayedText, isDone } = useTypewriter(text, active);
	const onDoneRef = useRef(onDone);
	onDoneRef.current = onDone;
	const calledRef = useRef(false);

	// Reset the "called" flag whenever this instance becomes inactive (i.e. a new
	// typing session for the same slot would start fresh).
	useEffect(() => {
		if (!active) calledRef.current = false;
	}, [active]);

	// Fire onDone exactly once, with a short post-completion pause.
	useEffect(() => {
		if (!isDone || calledRef.current) return;
		calledRef.current = true;
		const t = setTimeout(() => onDoneRef.current?.(), 380);
		return () => clearTimeout(t);
	}, [isDone]);

	return (
		<span
			className={className}
			style={{ whiteSpace: 'pre-wrap' }}
		>
			{displayedText}
			{active && !isDone && <Cursor />}
		</span>
	);
}

// ─── Smooth Scroll Utility ────────────────────────────────────────────────────
// Eases to the current bottom of the element over `duration` ms using
// ease-in-out sine so it feels organic rather than mechanical.
function smoothScrollToBottom(
	el: HTMLElement,
	rafRef: { current: number | undefined },
	duration = 1500,
) {
	if (rafRef.current !== undefined)
		cancelAnimationFrame(rafRef.current);

	const start = el.scrollTop;
	const startTime = performance.now();

	function step(now: number) {
		const elapsed = now - startTime;
		const t = Math.min(elapsed / duration, 1);
		// ease-in-out sine
		const eased = -(Math.cos(Math.PI * t) - 1) / 2;
		// Recalculate target each frame so it adapts as content grows
		const target = el.scrollHeight - el.clientHeight;
		el.scrollTop = start + (target - start) * eased;
		if (t < 1) rafRef.current = requestAnimationFrame(step);
	}

	rafRef.current = requestAnimationFrame(step);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function EntriesBadge() {
	return (
		<div className="bg-[rgba(255,255,255,0.05)] flex gap-[4px] items-center px-[8px] py-[4px] rounded-[4px] text-[10px] transition-colors group-hover:bg-[rgba(255,255,255,0.1)]">
			<p className="text-[rgba(255,255,255,0.6)]">ENTRY</p>
		</div>
	);
}

function TimelineEntry({
	entryId,
	label,
	quote,
	reflectionText,
	color = 'white',
	strokeColor = 'white',
	strokeOpacity = '0.4',
	active,
	onDone,
	onOpenEntry,
}: {
	entryId: string;
	label: string;
	quote: string;
	reflectionText: string;
	color?: 'white' | 'gold';
	strokeColor?: string;
	strokeOpacity?: string;
	active: boolean;
	onDone?: () => void;
	onOpenEntry: (entryId: string) => void;
}) {
	const [reflectionStarted, setReflectionStarted] =
		useState(false);

	useEffect(() => {
		if (active) setReflectionStarted(false);
	}, [active, quote, reflectionText]);

	return (
		<div className="flex flex-col gap-[24px] w-full">
			<motion.button
				type="button"
				onClick={() => onOpenEntry(entryId)}
				className="group flex flex-col gap-[16px] items-start w-full text-left cursor-pointer rounded-[4px] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[rgba(255,255,255,0.6)]"
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<div className="flex items-center justify-between w-full font-roboto-mono font-medium leading-[normal]">
					<p
						className={`text-[12px] ${color === 'gold' ? 'text-[#fcc84e]' : 'text-[rgba(255,255,255,0.4)]'}`}
					>
						{label}
					</p>
					<EntriesBadge />
				</div>
				<div className="flex gap-[16px] items-center w-full">
					{/* Vertical line */}
					<div className="flex items-center self-stretch">
						<div className="h-full relative w-0">
							<div className="absolute inset-[0_-0.5px]">
								<svg
									className="block size-full"
									fill="none"
									preserveAspectRatio="none"
									viewBox="0 0 1 24"
								>
									<path
										d="M0.5 0V24"
										stroke={strokeColor}
										strokeOpacity={strokeOpacity}
									/>
								</svg>
							</div>
						</div>
					</div>
					<p className="flex-1 font-inter font-medium leading-[1.5] text-[16px] text-[rgba(255,255,255,0.9)]">
						<TypewriterText
							text={`"${quote}"`}
							active={active}
							onDone={() => setReflectionStarted(true)}
						/>
					</p>
				</div>
			</motion.button>
			{reflectionStarted && (
				<p className="font-inter font-medium leading-[1.5] text-[16px] text-[rgba(255,255,255,0.9)]">
					<TypewriterText
						text={reflectionText}
						active={active && reflectionStarted}
						onDone={onDone}
					/>
				</p>
			)}
		</div>
	);
}

type EntryPopupStatus = 'idle' | 'loading' | 'ready' | 'error';

interface EntryPopupContent {
	entry_id: string;
	entry_date: string | null;
	source_file: string | null;
	content: {
		date: string | null;
		entry_text: string;
		source_file: string;
	};
}

function isEntryPopupContent(
	payload: EntryPopupContent | { error?: string },
): payload is EntryPopupContent {
	return (
		'content' in payload &&
		typeof payload.content?.entry_text === 'string'
	);
}

async function readEntryPopupPayload(
	response: Response,
): Promise<EntryPopupContent | { error?: string }> {
	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		return (await response.json()) as
			| EntryPopupContent
			| { error?: string };
	}

	const bodyText = await response.text().catch(() => '');
	if (response.redirected || response.url.includes('/auth/')) {
		return { error: 'Please sign in again before opening entries.' };
	}

	return {
		error:
			bodyText.trim().slice(0, 220) ||
			`Entry endpoint returned ${contentType || 'a non-JSON response'}.`,
	};
}

function EntryPopup({
	entry,
	status,
	error,
	onClose,
}: {
	entry: EntryPopupContent | null;
	status: EntryPopupStatus;
	error: string | null;
	onClose: () => void;
}) {
	return (
		<motion.div
			className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-[24px] py-[32px] backdrop-blur-[3px]"
			onClick={onClose}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
		>
			<motion.div
				role="dialog"
				aria-modal="true"
				aria-labelledby="entry-popup-title"
				onClick={(event) => event.stopPropagation()}
				className="relative flex max-h-full w-[560px] max-w-full flex-col overflow-hidden rounded-[8px] bg-[#ded2c3] text-black shadow-[0_28px_80px_rgba(0,0,0,0.35)]"
				initial={{ opacity: 0, y: 18, scale: 0.98 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, y: 12, scale: 0.98 }}
				transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
			>
				<div className="flex items-center justify-between border-b border-black/10 px-[24px] py-[18px]">
					<div className="flex flex-col gap-[4px]">
						<p
							id="entry-popup-title"
							className="font-roboto-mono text-[12px] font-medium uppercase text-black/45"
						>
							{entry
								? formatEntryReferenceDate(entry.entry_date)
								: 'ENTRY'}
						</p>
						{entry?.source_file && (
							<p className="font-roboto-mono text-[10px] font-medium uppercase text-black/30">
								{entry.source_file}
							</p>
						)}
					</div>
					<button
						type="button"
						aria-label="Close entry"
						onClick={onClose}
						className="flex size-[32px] items-center justify-center rounded-[4px] text-black/45 transition-colors hover:bg-black/5 hover:text-black/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-black/50"
					>
						<X className="size-[16px]" />
					</button>
				</div>
				<div className="overflow-y-auto px-[24px] py-[24px]">
					{status === 'loading' && (
						<p className="font-inter text-[16px] leading-[1.6] text-black/45">
							Loading entry...
						</p>
					)}
					{status === 'error' && (
						<p className="font-inter text-[16px] leading-[1.6] text-black/55">
							{error ?? 'Could not load this entry.'}
						</p>
					)}
					{status === 'ready' && entry && (
						<p className="whitespace-pre-wrap font-inter text-[16px] leading-[1.65] text-black/65">
							{entry.content.entry_text}
						</p>
					)}
				</div>
			</motion.div>
		</motion.div>
	);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface ReflectionAnalysisScreenProps {
	currentDate: string;
	currentTime: string;
	userName: string;
	entry?: {
		entry_id: string;
		entry_date: string | null;
		entry_text: string;
	};
	relatedEntries?: Array<{
		entry_id: string;
		entry_date: string | null;
		entry_text: string;
	}>;
	reflection?: {
		blocks: ReflectionBlock[];
	};
	onComplete: () => void;
}

type ReflectionBlock =
	| { type: 'paragraph'; text: string }
	| {
			type: 'entry_reference';
			entry_id: string;
			quote: string;
			text: string;
	  };

export function ReflectionAnalysisScreen({
	currentDate,
	currentTime,
	userName,
	entry,
	relatedEntries = [],
	reflection,
	onComplete,
}: ReflectionAnalysisScreenProps) {
	// -1 = card animating in; 0 = greeting; blocks start at 1.
	const [phase, setPhase] = useState(-1);
	const [openEntryId, setOpenEntryId] = useState<string | null>(
		null,
	);
	const [entryPopupStatus, setEntryPopupStatus] =
		useState<EntryPopupStatus>('idle');
	const [entryPopupContent, setEntryPopupContent] =
		useState<EntryPopupContent | null>(null);
	const [entryPopupError, setEntryPopupError] = useState<
		string | null
	>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollRafRef = useRef<number | undefined>(undefined);
	const completionPhase = (reflection?.blocks.length ?? 0) + 1;
	const entryDatesById = new Map<string, string | null>([
		...(entry ? [[entry.entry_id, entry.entry_date] as const] : []),
		...relatedEntries.map(
			(relatedEntry) =>
				[
					relatedEntry.entry_id,
					relatedEntry.entry_date,
				] as const,
		),
	]);

	// Begin typing after the journal card slides in
	useEffect(() => {
		if (!entry || !reflection) return;
		setPhase(-1);
		const t = setTimeout(() => setPhase(0), 1350);
		return () => clearTimeout(t);
	}, [entry, reflection]);

	const advance = useCallback(() => setPhase((p) => p + 1), []);
	const openEntryPopup = useCallback((entryId: string) => {
		setOpenEntryId(entryId);
		setEntryPopupContent(null);
		setEntryPopupError(null);
		setEntryPopupStatus('loading');
	}, []);
	const closeEntryPopup = useCallback(() => {
		setOpenEntryId(null);
		setEntryPopupStatus('idle');
		setEntryPopupContent(null);
		setEntryPopupError(null);
	}, []);

	useEffect(() => {
		if (!openEntryId) return;

		const entryIdToLoad = openEntryId;
		const controller = new AbortController();

		async function fetchEntry() {
			try {
				setEntryPopupStatus('loading');
				const response = await fetch(
					`/api/entries/${encodeURIComponent(entryIdToLoad)}`,
					{
						headers: { Accept: 'application/json' },
						signal: controller.signal,
					},
				);
				const payload = await readEntryPopupPayload(response);

				if (!response.ok) {
					throw new Error(
						'error' in payload && payload.error
							? payload.error
							: `Entry failed to load with status ${response.status}`,
						);
				}

				if (!isEntryPopupContent(payload)) {
					throw new Error('Entry response was missing entry text.');
				}

				setEntryPopupContent(payload);
				setEntryPopupStatus('ready');
			} catch (error) {
				if (controller.signal.aborted) return;
				setEntryPopupError(
					error instanceof Error
						? error.message
						: 'Could not load this entry.',
				);
				setEntryPopupStatus('error');
			}
		}

		void fetchEntry();

		return () => controller.abort();
	}, [openEntryId]);

	useEffect(() => {
		if (!openEntryId) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeEntryPopup();
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [closeEntryPopup, openEntryId]);

	// Slow smooth scroll whenever a new phase becomes visible
	useEffect(() => {
		if (phase < 0 || !scrollRef.current) return;
		const el = scrollRef.current;
		const t = setTimeout(
			() => smoothScrollToBottom(el, scrollRafRef, 1500),
			120,
		);
		return () => clearTimeout(t);
	}, [phase]);

	// Enter key shortcut once analysis is complete
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && phase >= completionPhase)
				onComplete();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [completionPhase, phase, onComplete]);

	const mono =
		'font-roboto-mono font-medium text-[16px] text-[rgba(255,255,255,0.9)]';
	const inter =
		'font-inter font-medium leading-[1.5] text-[16px] text-[rgba(255,255,255,0.9)]';

	if (!entry || !reflection) {
		return (
			<FadeScreen>
				<ScreenHeader
					currentDate={currentDate}
					currentTime={currentTime}
					className="shrink-0"
				/>
				<div className="screen-content-rail">
					<p className="font-roboto-mono font-medium text-[12px] text-[rgba(255,255,255,0.4)]">
						READING YOUR REFLECTION
					</p>
				</div>
			</FadeScreen>
		);
	}

	return (
		<FadeScreen>
			{/* Header */}
			<ScreenHeader
				currentDate={currentDate}
				currentTime={currentTime}
				className="shrink-0"
			/>

			{/* Scrollable content */}
			<div
				ref={scrollRef}
				className="flex-1 overflow-y-auto w-full flex flex-col gap-[96px] items-center pb-[80px]"
				style={{ scrollbarWidth: 'none' }}
			>
				{/* ── Journal card: slides up on mount ── */}
				<motion.div
					className="flex flex-col gap-[16px] items-center justify-center shrink-0"
					initial={{ y: 80 }}
					animate={{ y: 0 }}
					transition={{
						duration: 0.8,
						ease: [0.23, 1, 0.32, 1],
					}}
				>
					<p className="font-roboto-mono font-medium leading-[normal] text-[12px] text-[rgba(255,255,255,0.4)]">
						{formatEntryReferenceDate(entry.entry_date)}
					</p>
					<div className="flex flex-col items-start w-[512px] max-w-full">
						{/* Top zigzag */}
						<div className="h-[4px] w-full">
							<svg
								className="block size-full"
								fill="none"
								preserveAspectRatio="none"
								viewBox="0 0 512 4"
							>
								<path
									d="M0 0L8.82759 4H0V0Z"
									fill="#DED2C3"
								/>
								<path d={zigzagPath} fill="#DED2C3" />
								<path
									d="M512 0L503.172 4H512V0Z"
									fill="#DED2C3"
								/>
							</svg>
						</div>
						<div className="bg-[#ded2c3] w-full">
							<div className="flex items-center justify-center p-[48px]">
								<p className="flex-1 font-inter font-normal leading-[normal] text-[16px] text-[rgba(0,0,0,0.4)] tracking-[-0.64px]">
									{entry.entry_text}
								</p>
							</div>
						</div>
						{/* Bottom zigzag (flipped) */}
						<div className="-scale-y-100 w-full">
							<div className="h-[4px] w-full">
								<svg
									className="block size-full"
									fill="none"
									preserveAspectRatio="none"
									viewBox="0 0 512 4"
								>
									<path
										d="M0 0L8.82759 4H0V0Z"
										fill="#DED2C3"
									/>
									<path
										d={zigzagPath}
										fill="#DED2C3"
									/>
									<path
										d="M512 0L503.172 4H512V0Z"
										fill="#DED2C3"
									/>
								</svg>
							</div>
						</div>
					</div>
				</motion.div>

				{/* ── Typewriter analysis ── */}
				{phase >= 0 && (
					<div className="flex flex-col gap-[32px] items-start w-[491px] max-w-full shrink-0">
						{/* 0 — greeting */}
						<p className={mono}>
							<TypewriterText
								text={`${userName},`}
								active={phase === 0}
								onDone={
									phase === 0 ? advance : undefined
								}
							/>
						</p>

						{reflection.blocks.map((block, index) => {
							const blockPhase = index + 1;
							if (phase < blockPhase) return null;

							if (block.type === 'paragraph') {
								return (
									<p
										key={`${block.type}-${index}`}
										className={inter}
									>
										<TypewriterText
											text={block.text}
											active={phase === blockPhase}
											onDone={
												phase === blockPhase
													? advance
													: undefined
											}
										/>
									</p>
								);
							}

							return (
								<TimelineEntry
									key={`${block.entry_id}-${index}`}
									entryId={block.entry_id}
									label={getEntryReferenceLabel(
										block.entry_id,
										entryDatesById,
									)}
									quote={block.quote}
									reflectionText={block.text}
									active={phase === blockPhase}
									onDone={
										phase === blockPhase
											? advance
											: undefined
									}
									onOpenEntry={openEntryPopup}
								/>
							);
						})}

						{phase >= completionPhase && (
							<motion.button
								onClick={onComplete}
								className="action-outline"
								style={{
									willChange:
										'transform, opacity, filter',
								}}
								initial={{
									opacity: 0,
									y: 10,
									filter: 'blur(2px)',
								}}
								animate={{
									opacity: 1,
									y: 0,
									filter: 'blur(0px)',
								}}
								transition={{
									duration: 0.55,
									ease: [0.16, 1, 0.3, 1],
								}}
							>
								<div
									aria-hidden="true"
									className="action-border"
								/>
								<p className="action-label-light">
									START REFLECTION
								</p>
								<EnterIcon />
							</motion.button>
						)}
					</div>
				)}
			</div>
			<AnimatePresence>
				{openEntryId && (
					<EntryPopup
						entry={entryPopupContent}
						status={entryPopupStatus}
						error={entryPopupError}
						onClose={closeEntryPopup}
					/>
				)}
			</AnimatePresence>
		</FadeScreen>
	);
}
