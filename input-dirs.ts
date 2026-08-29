import { join } from "node:path";

export function normalizePosix(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function normalizeInputDirs(input: string | string[]): string[] {
	const list = Array.isArray(input) ? input : [input];
	const seen = new Set<string>();
	const out: string[] = [];

	for (const dir of list) {
		if (typeof dir !== "string") continue;
		const normalized = normalizePosix(dir.trim());
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		out.push(normalized);
	}

	return out;
}

export function toAbsoluteInputDirs(
	inputDirs: string[],
	cwd: string = process.cwd(),
): string[] {
	return inputDirs.map((dir) => normalizePosix(join(cwd, dir)));
}

export function isPathInsideDir(filePath: string, dirAbs: string): boolean {
	const file = normalizePosix(filePath);
	const dir = normalizePosix(dirAbs);
	return file === dir || file.startsWith(`${dir}/`);
}

export function matchInputDir(
	filePath: string,
	inputDirsAbs: string[],
): string | null {
	const file = normalizePosix(filePath);
	let best: string | null = null;

	for (const dir of inputDirsAbs) {
		const normalizedDir = normalizePosix(dir);
		if (file === normalizedDir || file.startsWith(`${normalizedDir}/`)) {
			if (!best || normalizedDir.length > best.length) {
				best = normalizedDir;
			}
		}
	}

	return best;
}

export function relativeFromInput(
	filePath: string,
	inputDirAbs: string,
): string {
	const file = normalizePosix(filePath);
	const dir = normalizePosix(inputDirAbs);
	if (file === dir) return "";
	if (file.startsWith(`${dir}/`)) return file.slice(dir.length + 1);
	return file;
}

export type SourceRecordResult = "added" | "duplicate" | "clash";

export function recordSource(
	relativePath: string,
	inputAbs: string,
	seen: Map<string, string>,
): SourceRecordResult {
	const existing = seen.get(relativePath);
	if (!existing) {
		seen.set(relativePath, inputAbs);
		return "added";
	}
	if (normalizePosix(existing) === normalizePosix(inputAbs)) {
		return "duplicate";
	}
	return "clash";
}
