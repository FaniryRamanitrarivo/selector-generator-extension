import type { GeneratedSelector } from "@/content/selector/generated-selector";
import type { InspectionOptions } from "@/content/inspector/inspector";

// Reports accumulate in browser.storage.local across an entire manual test
// session (many sites, many clicks) so they can be reviewed/exported once at
// the end, rather than downloading one JSON file per bug found.
const STORAGE_KEY = "bugReports";

export interface SelectorBugReport {
    id: string;
    createdAt: string;
    pageUrl: string;
    pageTitle: string;
    targetOuterHTML: string;
    options: InspectionOptions;
    generationTimeMs: number;
    results: GeneratedSelector[];
    comment: string;
}

export type NewBugReportInput = Omit<SelectorBugReport, "id" | "createdAt">;

export async function loadBugReports(): Promise<SelectorBugReport[]> {

    const stored = await browser.storage.local.get(STORAGE_KEY);
    const reports = stored[STORAGE_KEY];

    return Array.isArray(reports) ? reports : [];

}

export async function addBugReport(
    input: NewBugReportInput
): Promise<SelectorBugReport[]> {

    const reports = await loadBugReports();

    const report: SelectorBugReport = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
    };

    const next = [...reports, report];

    await browser.storage.local.set({ [STORAGE_KEY]: next });

    return next;

}

export async function clearBugReports(): Promise<void> {
    await browser.storage.local.remove(STORAGE_KEY);
}

// Triggers a normal browser download from the sidebar page itself — no
// "downloads" permission needed since this is a same-page <a download> click,
// not the chrome.downloads API.
export function downloadBugReportsAsJson(reports: SelectorBugReport[]): void {

    const blob = new Blob(
        [JSON.stringify(reports, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `selector-bug-reports-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();

    URL.revokeObjectURL(url);

}
