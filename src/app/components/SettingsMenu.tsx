'use client';

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from './ui/popover';
import { cn } from './ui/utils';
import {
	REFLECTION_TONE_OPTIONS,
	type ReflectionTone,
} from '@/lib/reflections/tone';

type SettingsMenuProps = {
	email: string | null;
	reflectionTone: ReflectionTone;
	onReflectionToneChange: (tone: ReflectionTone) => void;
};

export function SettingsMenu({
	email,
	reflectionTone,
	onReflectionToneChange,
}: SettingsMenuProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="font-manrope text-[16px] font-medium leading-[normal] text-[rgba(255,255,255,0.4)] transition-colors hover:text-[rgba(255,255,255,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
				>
					Settings
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-[220px] rounded-[8px] border border-white/15 bg-black/70 p-2 text-white shadow-[0px_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-[16px]"
			>
				{email ? (
					<p className="mb-2 break-all px-2 py-1 font-manrope text-[12px] font-medium leading-[1.35] text-white/45">
						{email}
					</p>
				) : null}
				<div className="mb-2 border-b border-white/10 px-2 pb-2">
					<p className="mb-2 font-roboto-mono text-[10px] font-medium uppercase text-white/35">
						Reflection tone
					</p>
					<div className="grid gap-1">
						{REFLECTION_TONE_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								aria-pressed={reflectionTone === option.value}
								onClick={() =>
									onReflectionToneChange(option.value)
								}
								className={cn(
									'flex w-full items-center justify-between rounded-[4px] px-2 py-2 text-left font-manrope text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35',
									reflectionTone === option.value
										? 'bg-white/15 text-white'
										: 'text-white/65 hover:bg-white/10 hover:text-white',
								)}
							>
								<span>{option.label}</span>
							</button>
						))}
					</div>
				</div>
				<form action="/auth/sign-out" method="post">
					<button
						type="submit"
						className="flex w-full items-center rounded-[4px] px-2 py-2 text-left font-manrope text-[14px] font-medium leading-[normal] text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
					>
						Sign out
					</button>
				</form>
			</PopoverContent>
		</Popover>
	);
}
