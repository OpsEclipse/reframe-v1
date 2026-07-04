'use client';

import {
	useState,
	useEffect,
	useCallback,
	type ReactNode,
} from 'react';
import { AnimatePresence } from 'motion/react';
import { GreetingScreen } from './components/GreetingScreen';
import { GratitudeScreen } from './components/GratitudeScreen';
import { ActivityScreen } from './components/ActivityScreen';
import { JournalEntryScreen } from './components/JournalEntryScreen';
import { ReflectionAnalysisScreen } from './components/ReflectionAnalysisScreen';
import { ArchetypeAnalysisScreen } from './components/ArchetypeAnalysisScreen';
import { ReflectionPromptScreen } from './components/ReflectionPromptScreen';
import { WritingScreen } from './components/WritingScreen';
import { CompletedWritingScreen } from './components/CompletedWritingScreen';
import { PostReflectionActivityScreen } from './components/PostReflectionActivityScreen';

type Screen =
	| 'greeting'
	| 'gratitude'
	| 'activity'
	| 'journalEntry'
	| 'reflectionAnalysis'
	| 'archetypeAnalysis'
	| 'reflectionPrompt'
	| 'reflectionWriting'
	| 'completedReflectionWriting'
	| 'writing'
	| 'completedWriting'
	| 'postReflectionActivity'
	| 'postWriting'
	| 'completedPostWriting'
	| 'complete';

type PostActivityDisabledOption = 'reflect' | 'write' | 'both';

type ReflectionBlock =
	| { type: 'paragraph'; text: string }
	| {
			type: 'entry_reference';
			entry_id: string;
			quote: string;
			text: string;
	  };

interface ActiveReflectionSession {
	sessionId: string;
	primaryEntry: {
		entry_id: string;
		entry_date: string | null;
		entry_text: string;
	};
	relatedEntries: Array<{
		entry_id: string;
		entry_date: string | null;
		entry_text: string;
	}>;
	reflection: {
		primary_entry_id: string;
		blocks: ReflectionBlock[];
		writing_prompt: { text: string };
	};
}

interface ReflectionSessionResponse {
	session_id: string;
	primary_entry: ActiveReflectionSession['primaryEntry'];
	related_entries: ActiveReflectionSession['relatedEntries'];
	reflection: ActiveReflectionSession['reflection'];
}

const SCREEN_WRAPPER_CLASS: Record<Screen, string> = {
	greeting: 'size-full',
	gratitude: 'size-full',
	activity: 'size-full',
	journalEntry: 'size-full',
	reflectionAnalysis: 'size-full',
	archetypeAnalysis: 'size-full',
	reflectionPrompt: 'size-full',
	reflectionWriting: 'size-full',
	completedReflectionWriting: 'size-full',
	writing: 'size-full',
	completedWriting: 'size-full',
	postReflectionActivity: 'size-full',
	postWriting: 'size-full',
	completedPostWriting: 'size-full',
	complete: 'size-full',
};

const WRITE_PROMPT_TEXT = "What's on your mind today?";
const GREETING_HOLD_MS = 2500;

function getGreeting(hour: number): string {
	if (hour < 12) return 'Good morning';
	if (hour < 17) return 'Good afternoon';
	return 'Good evening';
}

function getCurrentDate(now: Date): string {
	return now.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
	});
}

function getCurrentTime(now: Date): string {
	return now.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: false,
	});
}

export default function App({ userName }: { userName: string }) {
	const [screen, setScreen] = useState<Screen>('greeting');
	const [writtenText, setWrittenText] = useState('');
	const [activeReflection, setActiveReflection] =
		useState<ActiveReflectionSession | null>(null);
	const [reflectionError, setReflectionError] = useState<
		string | null
	>(null);
	const [{ greeting, currentDate, currentTime }] = useState(() => {
		const now = new Date();
		return {
			greeting: getGreeting(now.getHours()),
			currentDate: getCurrentDate(now),
			currentTime: getCurrentTime(now),
		};
	});
	const [
		postActivityDisabledOption,
		setPostActivityDisabledOption,
	] = useState<PostActivityDisabledOption>('reflect');
	const [, setCompletedCount] = useState(0);

	const handleGratitudeComplete = useCallback(
		() => setScreen('activity'),
		[],
	);

	// Activity screen: choose REFLECT or WRITE
	const startReflectionSession = useCallback(async () => {
		setWrittenText('');
		setActiveReflection(null);
		setReflectionError(null);
		setScreen('journalEntry');

		try {
			const response = await fetch('/api/reflections/session', {
				method: 'POST',
			});
			const data =
				(await response.json()) as Partial<ReflectionSessionResponse> & {
					error?: string;
				};

			if (!response.ok) {
				throw new Error(
					data.error ??
						`Reflection session failed with status ${response.status}`,
				);
			}

			const sessionData = data as ReflectionSessionResponse;
			setActiveReflection({
				sessionId: sessionData.session_id,
				primaryEntry: sessionData.primary_entry,
				relatedEntries: sessionData.related_entries ?? [],
				reflection: sessionData.reflection,
			});
		} catch (error) {
			setReflectionError(
				error instanceof Error
					? error.message
					: 'Unable to start a reflection session.',
			);
		}
	}, []);

	const handleSelectReflect = useCallback(
		() => void startReflectionSession(),
		[startReflectionSession],
	);
	const handleSelectWrite = useCallback(
		() => {
			setWrittenText('');
			setScreen('writing');
		},
		[],
	);

	// Reflect flow
	const handleJournalContinue = useCallback(
		() => setScreen('reflectionAnalysis'),
		[],
	);
	const handleAnalysisComplete = useCallback(
		() => setScreen('archetypeAnalysis'),
		[],
	);
	const handleArchetypeComplete = useCallback(
		() => setScreen('reflectionPrompt'),
		[],
	);
	const handleStartReflection = useCallback(
		() => setScreen('reflectionWriting'),
		[],
	);
	const handleReflectionWritingComplete = useCallback(
		(text: string) => {
			setWrittenText(text);
			setScreen('completedReflectionWriting');
		},
		[],
	);
	const handleCompletedReflectionWriting = useCallback(() => {
		setCompletedCount((c) => {
			const next = c + 1;
			setPostActivityDisabledOption(
				next >= 2 ? 'both' : 'reflect',
			);
			return next;
		});
		setScreen('postReflectionActivity');
	}, []);
	const saveActiveReflectionWriting = useCallback(async () => {
		if (!activeReflection) {
			throw new Error('No active reflection session to save.');
		}

		const response = await fetch(
			`/api/reflections/session/${activeReflection.sessionId}/entry`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entry_text: writtenText }),
			},
		);
		const payload = (await response.json()) as { error?: string };

		if (!response.ok) {
			throw new Error(
				payload.error ??
					`Reflection writing failed to save with status ${response.status}`,
			);
		}
	}, [activeReflection, writtenText]);

	// Write flow (from initial activity)
	const handleWritingComplete = useCallback(
		(text: string) => {
			setWrittenText(text);
			setScreen('completedWriting');
		},
		[],
	);
	const handleCompletedWriting = useCallback(() => {
		setCompletedCount((c) => {
			const next = c + 1;
			setPostActivityDisabledOption(
				next >= 2 ? 'both' : 'write',
			);
			return next;
		});
		setScreen('postReflectionActivity');
	}, []);

	// Post-reflection activity: write again
	const handlePostSelectReflect = useCallback(
		() => void startReflectionSession(),
		[startReflectionSession],
	);
	const handlePostSelectWrite = useCallback(
		() => {
			setWrittenText('');
			setScreen('postWriting');
		},
		[],
	);
	const handlePostWritingComplete = useCallback(
		(text: string) => {
			setWrittenText(text);
			setScreen('completedPostWriting');
		},
		[],
	);
	const handleCompletedPostWriting = useCallback(() => {
		setCompletedCount((c) => {
			const next = c + 1;
			setPostActivityDisabledOption(
				next >= 2 ? 'both' : 'write',
			);
			return next;
		});
		setScreen('postReflectionActivity');
	}, []);

	useEffect(() => {
		if (screen === 'greeting') {
			const timer = setTimeout(
				() => setScreen('gratitude'),
				GREETING_HOLD_MS,
			);
			return () => clearTimeout(timer);
		}
	}, [screen]);

	const gradientTo =
		screen === 'complete'
			? '#020202'
			: 'var(--app-stage-gradient-end)';

	let screenNode: ReactNode;

	switch (screen) {
		case 'greeting':
			screenNode = (
				<GreetingScreen
					userName={userName}
					greeting={greeting}
				/>
			);
			break;
		case 'gratitude':
			screenNode = (
				<GratitudeScreen
					userName={userName}
					greeting={greeting}
					currentDate={currentDate}
					currentTime={currentTime}
					onComplete={handleGratitudeComplete}
				/>
			);
			break;
		case 'activity':
			screenNode = (
				<ActivityScreen
					currentDate={currentDate}
					currentTime={currentTime}
					onSelectReflect={handleSelectReflect}
					onSelectWrite={handleSelectWrite}
				/>
			);
			break;
		case 'journalEntry':
			screenNode = (
				<JournalEntryScreen
					currentDate={currentDate}
					currentTime={currentTime}
					entry={activeReflection?.primaryEntry}
					error={reflectionError}
					onContinue={handleJournalContinue}
				/>
			);
			break;
		case 'reflectionAnalysis':
			screenNode = (
				<ReflectionAnalysisScreen
					currentDate={currentDate}
					currentTime={currentTime}
					userName={userName}
					entry={activeReflection?.primaryEntry}
					relatedEntries={activeReflection?.relatedEntries}
					reflection={activeReflection?.reflection}
					onComplete={handleAnalysisComplete}
				/>
			);
			break;
		case 'archetypeAnalysis':
			screenNode = (
				<ArchetypeAnalysisScreen
					onComplete={handleArchetypeComplete}
				/>
			);
			break;
		case 'reflectionPrompt':
			screenNode = (
				<ReflectionPromptScreen
					currentDate={currentDate}
					currentTime={currentTime}
					promptText={
						activeReflection?.reflection.writing_prompt.text ??
						''
					}
					onStart={handleStartReflection}
				/>
			);
			break;
		case 'reflectionWriting':
			screenNode = (
				<WritingScreen
					currentDate={currentDate}
					currentTime={currentTime}
					promptText={
						activeReflection?.reflection.writing_prompt.text ??
						''
					}
					onComplete={handleReflectionWritingComplete}
				/>
			);
			break;
		case 'completedReflectionWriting':
			screenNode = (
				<CompletedWritingScreen
					currentDate={currentDate}
					currentTime={currentTime}
					promptText={
						activeReflection?.reflection.writing_prompt.text ??
						''
					}
					writtenText={writtenText}
					onSave={saveActiveReflectionWriting}
					onComplete={handleCompletedReflectionWriting}
				/>
			);
			break;
		case 'writing':
			screenNode = (
				<WritingScreen
					currentDate={currentDate}
					currentTime={currentTime}
					promptText={WRITE_PROMPT_TEXT}
					onComplete={handleWritingComplete}
				/>
			);
			break;
		case 'completedWriting':
			screenNode = (
				<CompletedWritingScreen
					currentDate={currentDate}
					currentTime={currentTime}
					promptText={WRITE_PROMPT_TEXT}
					writtenText={writtenText}
					onComplete={handleCompletedWriting}
				/>
			);
			break;
		case 'postReflectionActivity':
			screenNode = (
				<PostReflectionActivityScreen
					currentDate={currentDate}
					currentTime={currentTime}
					disabledOption={postActivityDisabledOption}
					onSelectReflect={handlePostSelectReflect}
					onSelectWrite={handlePostSelectWrite}
				/>
			);
			break;
		case 'postWriting':
			screenNode = (
				<WritingScreen
					currentDate={currentDate}
					currentTime={currentTime}
					promptText={WRITE_PROMPT_TEXT}
					onComplete={handlePostWritingComplete}
				/>
			);
			break;
		case 'completedPostWriting':
			screenNode = (
				<CompletedWritingScreen
					currentDate={currentDate}
					currentTime={currentTime}
					promptText={WRITE_PROMPT_TEXT}
					writtenText={writtenText}
					onComplete={handleCompletedPostWriting}
				/>
			);
			break;
		case 'complete':
			screenNode = <div className="size-full" />;
			break;
	}

	return (
		<div className="app-shell">
			<div
				className="app-stage"
				style={{
					background: `linear-gradient(to bottom, var(--app-stage-gradient-start), ${gradientTo})`,
				}}
			>
				<div className="app-stage-content">
					<AnimatePresence mode="wait">
						<div
							key={screen}
							className={SCREEN_WRAPPER_CLASS[screen]}
						>
							{screenNode}
						</div>
					</AnimatePresence>
				</div>
				<div className="app-stage-shadow" />
				<div
					aria-hidden="true"
					className="app-stage-border"
				/>
			</div>
		</div>
	);
}
