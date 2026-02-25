import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
	EnterIcon,
	FadeScreen,
	ScreenHeader,
} from './shared/screen-primitives';

interface GratitudeScreenProps {
	userName: string;
	greeting: string;
	currentDate: string;
	currentTime: string;
	onComplete: () => void;
}

export function GratitudeScreen({
	userName,
	greeting,
	currentDate,
	currentTime,
	onComplete,
}: GratitudeScreenProps) {
	const [selectedValue, setSelectedValue] = useState<number | null>(
		null,
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const num = parseInt(e.key);
			if (num >= 1 && num <= 5) {
				setSelectedValue(num);
			}
			if (e.key === 'Enter' && selectedValue !== null) {
				onComplete();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () =>
			window.removeEventListener('keydown', handleKeyDown);
	}, [selectedValue, onComplete]);

	return (
		<FadeScreen className="items-start">
			{/* Header */}
			<ScreenHeader
				currentDate={currentDate}
				currentTime={currentTime}
			/>

			{/* Content */}
			<div className="flex flex-1 flex-col items-center justify-center w-full">
				<div className="screen-content-grid">
					<div className="flex flex-col gap-[32px] items-start w-[384px] max-w-full">
						<motion.p
							className="font-manrope font-semibold leading-[normal] text-[20px] text-[rgba(255,255,255,0.6)]"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							{greeting}, {userName}.
						</motion.p>

						<motion.div
							className="w-full"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.4 }}
						>
							<p className="font-inter font-medium text-[20px] text-[rgba(255,255,255,0.9)] tracking-[-0.3px] leading-[normal]">
								On a scale of 1-5, how grateful are
								you feeling today?
							</p>
						</motion.div>

						<motion.div
							className="flex gap-[8px] w-full"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.6 }}
						>
							{[1, 2, 3, 4, 5].map((num) => (
								<button
									key={num}
									onClick={() =>
										setSelectedValue(num)
									}
									className={`flex-1 relative rounded-[3px] cursor-pointer transition-all duration-200 ${
										selectedValue === num
											? 'bg-[rgba(255,255,255,0.9)]'
											: 'hover:bg-[rgba(255,255,255,0.05)]'
									}`}
								>
									<div
										aria-hidden="true"
										className={`absolute border border-solid inset-0 pointer-events-none rounded-[3px] ${
											selectedValue === num
												? 'border-[rgba(255,255,255,0.2)]'
												: 'border-[rgba(255,255,255,0.2)]'
										}`}
									/>
									<div className="flex flex-col items-center justify-center px-[24px] py-[12px]">
										<p
											className={`font-inter font-normal leading-[normal] text-[20px] ${
												selectedValue === num
													? 'text-[#1e1e1e]'
													: 'text-[rgba(255,255,255,0.8)]'
											}`}
										>
											{num}
										</p>
									</div>
								</button>
							))}
						</motion.div>

						<AnimatePresence>
							{selectedValue !== null && (
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
									exit={{
										opacity: 0,
										y: -6,
										filter: 'blur(2px)',
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
										ENTER
									</p>
									<EnterIcon />
								</motion.button>
							)}
						</AnimatePresence>
					</div>
				</div>
			</div>
		</FadeScreen>
	);
}
