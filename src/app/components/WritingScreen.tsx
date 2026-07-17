import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
	EnterIcon,
	FadeScreen,
	ScreenHeader,
} from './shared/screen-primitives';
import { DockWithImporter } from './shared/dock-with-importer';

interface WritingScreenProps {
	currentDate: string;
	currentTime: string;
	promptText: string;
	onComplete: (text: string) => void;
}

export function WritingScreen({
	currentDate,
	currentTime,
	promptText,
	onComplete,
}: WritingScreenProps) {
	const [text, setText] = useState('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				e.key === 'Enter' &&
				e.metaKey &&
				text.trim().length > 0
			) {
				onComplete(text);
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () =>
			window.removeEventListener('keydown', handleKeyDown);
	}, [text, onComplete]);

	return (
		<FadeScreen>
			{/* Header */}
			<ScreenHeader
				currentDate={currentDate}
				currentTime={currentTime}
				className="shrink-0"
			/>

			{/* Content */}
			<div className="screen-content-rail">
				<div className="screen-content-grid">
					<div className="screen-content-grid-start">
						<motion.div
							className="screen-prompt-block"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							<p className="font-inter font-medium text-[20px] text-[rgba(255,255,255,0.9)] tracking-[-0.3px] leading-[normal]">
								{promptText}
							</p>
						</motion.div>

						<motion.div
							className="w-full"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.4 }}
						>
							<textarea
								ref={textareaRef}
								value={text}
								onChange={(e) =>
									setText(e.target.value)
								}
								placeholder="Start writing..."
								className="w-full bg-transparent border-none outline-none resize-none font-inter font-medium text-[24px] text-[rgba(255,255,255,0.7)] tracking-[-0.36px] leading-[normal] placeholder:text-[rgba(255,255,255,0.4)] min-h-[120px] max-h-[300px] overflow-y-auto"
							/>
						</motion.div>

						<AnimatePresence>
							{text.trim().length > 0 && (
								<motion.button
									onClick={() => onComplete(text)}
									className="action-outline screen-action-inline"
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
