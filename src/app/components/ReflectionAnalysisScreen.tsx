import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
	EnterIcon,
	FadeScreen,
	ScreenHeader,
} from './shared/screen-primitives';

const zigzagPath =
	'M17.6551 0L8.82759 4H26.4827H44.1379H61.7931H79.4482H97.1034H114.759H132.414H150.069H167.724H185.379H203.034H220.69H238.345H256H273.655H291.31H308.966H326.621H344.276H361.931H379.586H397.241H414.897H432.552H450.207H467.862H485.517H503.172L494.345 0L485.517 4L476.69 0L467.862 4L459.034 0L450.207 4L441.379 0L432.552 4L423.724 0L414.897 4L406.069 0L397.241 4L388.414 0L379.586 4L370.759 0L361.931 4L353.103 0L344.276 4L335.448 0L326.621 4L317.793 0L308.966 4L300.138 0L291.31 4L282.483 0L273.655 4L264.828 0L256 4L247.172 0L238.345 4L229.517 0L220.69 4L211.862 0L203.034 4L194.207 0L185.379 4L176.552 0L167.724 4L158.897 0L150.069 4L141.241 0L132.414 4L123.586 0L114.759 4L105.931 0L97.1034 4L88.2758 0L79.4482 4L70.6207 0L61.7931 4L52.9655 0L44.1379 4L35.3103 0L26.4827 4L17.6551 0Z';

// ─── Typewriter Hook ──────────────────────────────────────────────────────────
// Types text character by character with natural, variable speed.
// When `active` goes false, displayed text is preserved (not wiped).
function useTypewriter(
	text: string,
	active: boolean,
	baseSpeed = 44,
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
				delay += 230 + Math.random() * 140;
			else if ([',', ';', ':'].includes(char))
				delay += 95 + Math.random() * 50;
			else if (char === '\n') delay += 180;
			else if (char === ' ') delay *= 0.72;

			timerRef.current = setTimeout(type, Math.max(14, delay));
		}

		// Small initial pause before the first character
		timerRef.current = setTimeout(type, 280);

		return () => {
			cancelRef.current = true;
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [active, text]); // intentionally excludes baseSpeed from deps

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
		<div className="bg-[rgba(255,255,255,0.05)] flex gap-[4px] items-center px-[8px] py-[4px] rounded-[4px] text-[10px]">
			<p className="text-[rgba(255,255,255,0.6)]">3+</p>
			<p className="text-[rgba(255,255,255,0.25)]">ENTRIES</p>
		</div>
	);
}

function TimelineEntry({
	label,
	text,
	color = 'white',
	strokeColor = 'white',
	strokeOpacity = '0.4',
	active,
	onDone,
}: {
	label: string;
	text: string;
	color?: 'white' | 'gold';
	strokeColor?: string;
	strokeOpacity?: string;
	active: boolean;
	onDone?: () => void;
}) {
	return (
		<motion.div
			className="flex flex-col gap-[16px] items-start w-full"
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
						text={text}
						active={active}
						onDone={onDone}
					/>
				</p>
			</div>
		</motion.div>
	);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface ReflectionAnalysisScreenProps {
	currentDate: string;
	currentTime: string;
	userName: string;
	onComplete: () => void;
}

export function ReflectionAnalysisScreen({
	currentDate,
	currentTime,
	userName,
	onComplete,
}: ReflectionAnalysisScreenProps) {
	// -1 = card animating in; 0-11 = typewriter phases; 12 = ENTER visible
	const [phase, setPhase] = useState(-1);
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollRafRef = useRef<number | undefined>(undefined);

	// Begin typing after the journal card slides in
	useEffect(() => {
		const t = setTimeout(() => setPhase(0), 1350);
		return () => clearTimeout(t);
	}, []);

	const advance = useCallback(() => setPhase((p) => p + 1), []);

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
			if (e.key === 'Enter' && phase >= 12) onComplete();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [phase, onComplete]);

	const mono =
		'font-roboto-mono font-medium text-[16px] text-[rgba(255,255,255,0.9)]';
	const inter =
		'font-inter font-medium leading-[1.5] text-[16px] text-[rgba(255,255,255,0.9)]';

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
						OCTOBER 2024, A YEAR AGO
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
									I feel stuck again. I keep
									thinking I should be further ahead
									by now. Everyone else seems to be
									building something real, and
									I&apos;m just trying.
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

						{/* 1 — stationary */}
						{phase >= 1 && (
							<p className={mono}>
								<TypewriterText
									text="A year ago today, you believed you were stationary."
									active={phase === 1}
									onDone={
										phase === 1
											? advance
											: undefined
									}
								/>
							</p>
						)}

						{/* 2 — "stuck" */}
						{phase >= 2 && (
							<p className={mono}>
								<TypewriterText
									text={`You used the word "stuck."`}
									active={phase === 2}
									onDone={
										phase === 2
											? advance
											: undefined
									}
								/>
							</p>
						)}

						{/* 3 — "behind" */}
						{phase >= 3 && (
							<p className={mono}>
								<TypewriterText
									text={`You used the word "behind."`}
									active={phase === 3}
									onDone={
										phase === 3
											? advance
											: undefined
									}
								/>
							</p>
						)}

						{/* 4 — motion vs direction */}
						{phase >= 4 && (
							<p className={mono}>
								<TypewriterText
									text="You compared motion without measuring direction."
									active={phase === 4}
									onDone={
										phase === 4
											? advance
											: undefined
									}
								/>
							</p>
						)}

						{/* 5 — entries show change */}
						{phase >= 5 && (
							<p className={mono}>
								<TypewriterText
									text="But if we look, your entries show change:"
									active={phase === 5}
									onDone={
										phase === 5
											? advance
											: undefined
									}
								/>
							</p>
						)}

						{/* 6-8 — timeline entries */}
						{phase >= 6 && (
							<div className="flex flex-col gap-[48px] w-full">
								<TimelineEntry
									label="IN APRIL 2025"
									text="You took on a project you weren't sure you could handle."
									active={phase === 6}
									onDone={
										phase === 6
											? advance
											: undefined
									}
								/>
								{phase >= 7 && (
									<TimelineEntry
										label="4 MONTHS LATER, IN AUGUST 2025"
										text="You wrote about being exhausted from responsibility."
										active={phase === 7}
										onDone={
											phase === 7
												? advance
												: undefined
										}
									/>
								)}
								{phase >= 8 && (
									<TimelineEntry
										label="AND FINALLY, ON DECEMBER 16 2025"
										text="You described leading something start to finish."
										color="gold"
										strokeColor="#FCC84E"
										strokeOpacity="1"
										active={phase === 8}
										onDone={
											phase === 8
												? advance
												: undefined
										}
									/>
								)}
							</div>
						)}

						{/* 9 — not stuck, early */}
						{phase >= 9 && (
							<p className={inter}>
								<TypewriterText
									text={
										'You were not stuck.\nYou were early.'
									}
									active={phase === 9}
									onDone={
										phase === 9
											? advance
											: undefined
									}
								/>
							</p>
						)}

						{/* 10 — pattern */}
						{phase >= 10 && (
							<p className={inter}>
								<TypewriterText
									text={
										'There is a pattern in your archive:\nYou call the beginning of growth \u201cfailure.\u201d'
									}
									active={phase === 10}
									onDone={
										phase === 10
											? advance
											: undefined
									}
								/>
							</p>
						)}

						{/* 11 — closing question */}
						{phase >= 11 && (
							<p className={inter}>
								<TypewriterText
									text="Why do you only recognize movement once it becomes undeniable?"
									active={phase === 11}
									onDone={
										phase === 11
											? advance
											: undefined
									}
								/>
							</p>
						)}

						{/* 12 — ENTER button */}
						{phase >= 12 && (
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
		</FadeScreen>
	);
}
