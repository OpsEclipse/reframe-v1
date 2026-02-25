import {
	useState,
	useCallback,
	type ButtonHTMLAttributes,
	type ReactNode,
} from 'react';
import {
	motion,
	AnimatePresence,
	type MotionProps,
} from 'motion/react';
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

function ImporterPopup({
	isVisible,
	onClose,
}: {
	isVisible: boolean;
	onClose: () => void;
}) {
	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					className="absolute bottom-[80px] right-[24px] bg-[#333332] rounded-[2px] w-[384px] z-20"
					initial={{ opacity: 0, y: 10, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 10, scale: 0.95 }}
					transition={{ duration: 0.3 }}
				>
					<div className="flex flex-col items-end justify-center overflow-clip rounded-[inherit] w-full">
						{/* Header */}
						<div className="relative w-full">
							<div
								aria-hidden="true"
								className="absolute border-[rgba(255,255,255,0.1)] border-b border-solid inset-0 pointer-events-none"
							/>
							<div className="flex items-center justify-between p-[8px] w-full">
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

						{/* Body */}
						<div className="flex flex-col items-center justify-center pb-[24px] pt-[48px] px-[64px] w-full">
							<div className="flex flex-col gap-[8px] items-start leading-[normal] text-center whitespace-pre-wrap">
								<p className="font-manrope font-semibold text-[20px] text-white w-[256px]">
									Bring in your journal
								</p>
								<p className="font-manrope font-normal text-[12px] text-[rgba(255,255,255,0.6)] w-[256px]">
									Upload a PDF of your past entries
									so the archive can read, connect,
									and reflect on your earlier
									thoughts.
								</p>
							</div>
						</div>

						{/* Upload area */}
						<div className="flex flex-col items-center p-[24px] w-full">
							<div className="flex flex-col gap-[12px] items-center w-full">
								<button className="bg-[rgba(255,255,255,0.9)] relative rounded-[3px] w-full cursor-pointer hover:bg-white transition-colors">
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
								<p className="font-manrope font-semibold leading-[normal] text-[12px] text-[rgba(255,255,255,0.6)] text-center w-[256px]">
									or drag and drop
								</p>
							</div>
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
