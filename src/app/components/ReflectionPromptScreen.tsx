import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
	EnterActionButton,
	FadeScreen,
	DockWithImporter,
	ScreenHeader,
} from './shared/screen-primitives';

interface ReflectionPromptScreenProps {
	currentDate: string;
	currentTime: string;
	onStart: () => void;
}

export function ReflectionPromptScreen({
	currentDate,
	currentTime,
	onStart,
}: ReflectionPromptScreenProps) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Enter') onStart();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () =>
			window.removeEventListener('keydown', handleKeyDown);
	}, [onStart]);

	return (
		<FadeScreen>
			{/* Header */}
			<ScreenHeader
				currentDate={currentDate}
				currentTime={currentTime}
			/>

			{/* Content */}
			<div className="screen-content-rail screen-content-rail-lower">
				<div className="screen-content-grid">
					<div className="screen-content-grid-start">
						<motion.div
							className="screen-prompt-block"
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 0.3 }}
						>
								<p className="font-inter font-medium text-[20px] text-[rgba(255,255,255,0.9)] tracking-[-0.3px] leading-[1.5]">
									If the version of you from February
									2025 could see today&apos;s entries, what
									would he admit he was wrong about?
								</p>
						</motion.div>

						<motion.div
							className="screen-action-row"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, delay: 0.6 }}
						>
							<EnterActionButton
								label="START REFLECTION"
								onClick={onStart}
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
