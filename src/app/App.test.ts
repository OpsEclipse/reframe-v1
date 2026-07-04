import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("App reflection archetype flow", () => {
	const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

	it("registers the archetype analysis screen", () => {
		expect(source).toContain("import { ArchetypeAnalysisScreen }");
		expect(source).toContain("| 'archetypeAnalysis'");
		expect(source).toContain("archetypeAnalysis: 'size-full'");
		expect(source).toContain("case 'archetypeAnalysis'");
	});

	it("routes reflection analysis through archetype analysis before the prompt", () => {
		expect(source).toContain(
			"const handleAnalysisComplete = useCallback(\n\t\t() => setScreen('archetypeAnalysis'),",
		);
		expect(source).toContain(
			"const handleArchetypeComplete = useCallback(\n\t\t() => setScreen('reflectionPrompt'),",
		);
		expect(source).toContain("onComplete={handleArchetypeComplete}");
	});
});
