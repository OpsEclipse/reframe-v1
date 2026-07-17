import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
	EnterIcon,
	FadeScreen,
	ScreenHeader,
} from './shared/screen-primitives';
import { DockWithImporter } from './shared/dock-with-importer';

interface PostReflectionActivityScreenProps {
	currentDate: string;
	currentTime: string;
	disabledOption: 'reflect' | 'write' | 'both';
	onSelectReflect: () => void;
	onSelectWrite: () => void;
}

function formatCountdown(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function PostReflectionActivityScreen({
	currentDate,
	currentTime,
	disabledOption,
	onSelectReflect,
	onSelectWrite,
}: PostReflectionActivityScreenProps) {
	const [cooldownSeconds, setCooldownSeconds] = useState(45038); // ~12:30:38
	const [selectedOption, setSelectedOption] = useState<
		number | null
	>(
		disabledOption === 'both'
			? null
			: disabledOption === 'reflect'
				? 2
				: 1,
	);

	const isReflectDisabled =
		disabledOption === 'reflect' || disabledOption === 'both';
	const isWriteDisabled =
		disabledOption === 'write' || disabledOption === 'both';
	const disabledOptionNumber =
		disabledOption === 'both'
			? -1
			: disabledOption === 'reflect'
				? 1
				: 2;
	const activeOptionNumber =
		disabledOption === 'both'
			? -1
			: disabledOption === 'reflect'
				? 2
				: 1;
	const reflectCooldownText = `REFLECT AGAIN IN ${formatCountdown(cooldownSeconds)}`;
	const writeCooldownText = `WRITE AGAIN IN ${formatCountdown(cooldownSeconds)}`;

	useEffect(() => {
		const interval = setInterval(() => {
			setCooldownSeconds((s) => Math.max(0, s - 1));
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		if (disabledOption !== 'both')
			setSelectedOption(activeOptionNumber);
	}, [activeOptionNumber, disabledOption]);

	const handleContinue = useCallback(() => {
		if (selectedOption === 1) onSelectReflect();
		if (selectedOption === 2) onSelectWrite();
	}, [selectedOption, onSelectReflect, onSelectWrite]);

	useEffect(() => {
		if (disabledOption === 'both') return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === '1' && !isReflectDisabled)
				setSelectedOption(1);
			if (e.key === '2' && !isWriteDisabled)
				setSelectedOption(2);
			if (
				e.key === 'Enter' &&
				selectedOption !== null &&
				selectedOption !== disabledOptionNumber
			) {
				handleContinue();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () =>
			window.removeEventListener('keydown', handleKeyDown);
	}, [
		selectedOption,
		disabledOption,
		isReflectDisabled,
		isWriteDisabled,
		disabledOptionNumber,
		handleContinue,
	]);

	return (
		<FadeScreen className="screen-root-relative">
			{/* Header */}
			<ScreenHeader
				currentDate={currentDate}
				currentTime={currentTime}
				className="shrink-0"
			/>

			{/* Content */}
			<div className="screen-content-rail">
				<div className="screen-content-grid">
					<div className="screen-content-column">
						<motion.p
							className="font-inter font-medium text-[20px] text-[rgba(255,255,255,0.9)] tracking-[-0.3px] leading-[normal]"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							What would you like to do today?
						</motion.p>

						<motion.div
							className="flex flex-col gap-[16px] w-full"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.4 }}
						>
							{/* REFLECT option */}
							{isReflectDisabled ? (
								<div className="relative w-full">
									<div className="flex gap-[24px] items-center w-full opacity-10 blur-[2px] pointer-events-none">
										<div className="flex flex-col items-center justify-center px-[16px] py-[8px] relative rounded-[3px] w-[35px] shrink-0">
											<div
												aria-hidden="true"
												className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]"
											/>
											<p className="font-inter font-normal leading-[normal] text-[16px] text-[rgba(255,255,255,0.8)]">
												1
											</p>
										</div>
										<div className="flex flex-1 flex-col gap-[4px]">
											<p className="font-inter font-medium text-[16px] text-[rgba(255,255,255,0.9)] leading-[normal]">
												REFLECT
											</p>
											<p className="font-inter font-medium text-[14px] text-[rgba(255,255,255,0.6)] leading-[normal]">
												We explore sites, ask
												questions, and run
												through your workflow
												together
											</p>
										</div>
									</div>
									<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
										<p className="font-inter font-medium leading-[normal] text-[14px] text-[rgba(255,255,255,0.62)] text-center">
											{reflectCooldownText}
										</p>
									</div>
								</div>
							) : (
								<button
									onClick={() =>
										setSelectedOption(1)
									}
									className="flex gap-[24px] items-center w-full cursor-pointer group text-left"
								>
									<div
										className={`flex flex-col items-center justify-center px-[16px] py-[8px] relative rounded-[3px] w-[35px] shrink-0 transition-colors ${
											selectedOption === 1
												? 'bg-[rgba(255,255,255,0.9)]'
												: ''
										}`}
									>
										<div
											aria-hidden="true"
											className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]"
										/>
										<p
											className={`font-inter font-normal leading-[normal] text-[16px] ${
												selectedOption === 1
													? 'text-[#1e1e1e]'
													: 'text-[rgba(255,255,255,0.8)]'
											}`}
										>
											1
										</p>
									</div>
									<div className="flex flex-1 flex-col gap-[4px]">
										<p className="font-inter font-medium text-[16px] text-[rgba(255,255,255,0.9)] leading-[normal]">
											REFLECT
										</p>
										<p className="font-inter font-medium text-[14px] text-[rgba(255,255,255,0.6)] leading-[normal]">
											We explore sites, ask
											questions, and run through
											your workflow together
										</p>
									</div>
								</button>
							)}

							{/* WRITE option */}
							{isWriteDisabled ? (
								<div className="relative w-full">
									<div className="flex gap-[24px] items-center w-full opacity-10 blur-[2px] pointer-events-none">
										<div className="flex flex-col items-center justify-center px-[16px] py-[8px] relative rounded-[3px] w-[35px] shrink-0">
											<div
												aria-hidden="true"
												className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]"
											/>
											<p className="font-inter font-normal leading-[normal] text-[16px] text-[rgba(255,255,255,0.8)]">
												2
											</p>
										</div>
										<div className="flex flex-1 flex-col gap-[4px]">
											<p className="font-inter font-medium text-[16px] text-[rgba(255,255,255,0.9)] leading-[normal]">
												WRITE
											</p>
											<p className="font-inter font-medium text-[14px] text-[rgba(255,255,255,0.6)] leading-[1.5]">
												Record your current
												thoughts and feelings
												to build your ongoing
												personal archive
											</p>
										</div>
									</div>
									<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
										<p className="font-inter font-medium leading-[normal] text-[14px] text-[rgba(255,255,255,0.62)] text-center">
											{writeCooldownText}
										</p>
									</div>
								</div>
							) : (
								<button
									onClick={() =>
										setSelectedOption(2)
									}
									className="flex gap-[24px] items-center w-full cursor-pointer group text-left"
								>
									<div
										className={`flex flex-col items-center justify-center px-[16px] py-[8px] relative rounded-[3px] w-[35px] shrink-0 transition-colors ${
											selectedOption === 2
												? 'bg-[rgba(255,255,255,0.9)]'
												: ''
										}`}
									>
										<div
											aria-hidden="true"
											className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]"
										/>
										<p
											className={`font-inter font-normal leading-[normal] text-[16px] ${
												selectedOption === 2
													? 'text-[#1e1e1e]'
													: 'text-[rgba(255,255,255,0.8)]'
											}`}
										>
											2
										</p>
									</div>
									<div className="flex flex-1 flex-col gap-[4px]">
										<p className="font-inter font-medium text-[16px] text-[rgba(255,255,255,0.9)] leading-[normal]">
											WRITE
										</p>
										<p className="font-inter font-medium text-[14px] text-[rgba(255,255,255,0.6)] leading-[1.5]">
											Record your current
											thoughts and feelings to
											build your ongoing
											personal archive
										</p>
									</div>
								</button>
							)}

							<AnimatePresence>
								{selectedOption !== null &&
									selectedOption ===
										activeOptionNumber && (
										<motion.button
											onClick={handleContinue}
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
											exit={{
												opacity: 0,
												y: -6,
												filter: 'blur(2px)',
											}}
											transition={{
												duration: 0.55,
												ease: [
													0.16, 1, 0.3, 1,
												],
											}}
										>
											<div
												aria-hidden="true"
												className="action-border"
											/>
											<p className="action-label-light">
												ENTER
											</p>
											<EnterIcon />
										</motion.button>
									)}
							</AnimatePresence>
						</motion.div>
					</div>
				</div>
			</div>

			{/* Dock */}
			<DockWithImporter />
		</FadeScreen>
	);
}
