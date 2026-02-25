import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
	EnterIcon,
	FadeScreen,
	DockWithImporter,
	ScreenHeader,
} from './shared/screen-primitives';

interface ActivityScreenProps {
	currentDate: string;
	currentTime: string;
	onSelectReflect: () => void;
	onSelectWrite: () => void;
}

export function ActivityScreen({
	currentDate,
	currentTime,
	onSelectReflect,
	onSelectWrite,
}: ActivityScreenProps) {
	const [selectedOption, setSelectedOption] = useState<
		number | null
	>(null);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === '1') setSelectedOption(1);
			if (e.key === '2') setSelectedOption(2);
			if (e.key === 'Enter' && selectedOption !== null) {
				if (selectedOption === 1) onSelectReflect();
				if (selectedOption === 2) onSelectWrite();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () =>
			window.removeEventListener('keydown', handleKeyDown);
	}, [selectedOption, onSelectReflect, onSelectWrite]);

	return (
		<FadeScreen>
			{/* Header */}
			<ScreenHeader
				currentDate={currentDate}
				currentTime={currentTime}
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
							<button
								onClick={() => setSelectedOption(1)}
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
									<p className="font-inter font-medium text-[14px] text-[rgba(255,255,255,0.6)] leading-[1.5]">
										Explore a past journal entry
										and uncover insights or
										patterns you couldn&apos;t see
										at the time
									</p>
								</div>
							</button>

							{/* WRITE option */}
							<button
								onClick={() => setSelectedOption(2)}
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
										Record your current thoughts
										and feelings to build your
										ongoing personal archive
									</p>
								</div>
							</button>
						</motion.div>

						<AnimatePresence>
							{selectedOption !== null && (
								<motion.button
									onClick={() => {
										if (selectedOption === 1)
											onSelectReflect();
										if (selectedOption === 2)
											onSelectWrite();
									}}
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

			{/* Dock */}
			<DockWithImporter />
		</FadeScreen>
	);
}
