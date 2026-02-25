import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
	EnterActionButton,
	FadeScreen,
	DockWithImporter,
	ScreenHeader,
} from './shared/screen-primitives';

interface CompletedWritingScreenProps {
	currentDate: string;
	currentTime: string;
	promptText: string;
	writtenText: string;
	onComplete: () => void;
}

export function CompletedWritingScreen({
	currentDate,
	currentTime,
	promptText,
	writtenText,
	onComplete,
}: CompletedWritingScreenProps) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Enter') onComplete();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () =>
			window.removeEventListener('keydown', handleKeyDown);
	}, [onComplete]);

	return (
		<FadeScreen>
			{/* Header */}
			<ScreenHeader
				currentDate={currentDate}
				currentTime={currentTime}
				className="shrink-0"
			/>

			{/* Content */}
			<div className="screen-content-rail screen-content-rail-lower">
				<div className="screen-content-grid">
					<div className="screen-content-grid-start">
						{/* Faded prompt */}
						<motion.div
							className="screen-prompt-block"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							<p className="font-inter font-medium text-[20px] text-[rgba(255,255,255,0.2)] tracking-[-0.3px] leading-[normal]">
								{promptText}
							</p>
						</motion.div>

						{/* Date/time */}
						<motion.div
							className="w-full"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							<ScreenHeader
								currentDate={currentDate}
								currentTime={currentTime}
							/>
						</motion.div>

						{/* Written text */}
						<motion.div
							className="w-full"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.3 }}
						>
							<p className="font-inter font-medium text-[24px] text-[rgba(255,255,255,0.7)] tracking-[-0.36px] leading-[normal] whitespace-pre-wrap">
								{writtenText}
							</p>
						</motion.div>

						{/* COMPLETE button */}
						<motion.div
							className="screen-action-row"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, delay: 0.5 }}
						>
							<EnterActionButton
								label="COMPLETE"
								onClick={onComplete}
								tone="dark"
								variant="solid"
							/>
						</motion.div>
					</div>
				</div>
			</div>

			{/* Dock */}
			<DockWithImporter />
		</FadeScreen>
	);
}
