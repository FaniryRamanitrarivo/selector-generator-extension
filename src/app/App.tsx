import { useEffect, useState } from "react";

import { MessageType } from "@/messaging/messages";
import { sendMessage } from "@/messaging/messenger";
import type { GeneratedSelector } from "@/content/selector/generated-selector";
import type { ElementSelectedPayload, SelectionState } from "@/content/inspector/inspector";
import { getSelectorQualityLabel, getSelectorQualityTier, SELECTOR_QUALITY_STYLES, type SelectorQualityTier } from "./selector-quality";
import { CheckIcon, ChevronIcon, ClipboardIcon, ClockIcon, TargetIcon } from "./icons";

const MAX_ALTERNATIVES = 5;

// Below this, generation is imperceptible to the user; above it, the pipeline
// is doing real work (e.g. ContainerSelector's combined-fragment fallback
// walking many ancestors) worth calling out; past the upper bound it's the
// kind of run that visibly stalls the page — see CLAUDE.md notes on
// utility-CSS pages (Tailwind etc.) producing this exact symptom.
const GENERATION_TIME_WARNING_MS = 150;
const GENERATION_TIME_BAD_MS = 600;

function getGenerationTimeTier(ms: number): SelectorQualityTier {
    if (ms < GENERATION_TIME_WARNING_MS) return "good";
    if (ms < GENERATION_TIME_BAD_MS) return "warning";
    return "bad";
}

function formatGenerationTime(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

// Shared so every interactive element (buttons, toggles, breadcrumb, <summary>)
// gets an identical, clearly visible keyboard-focus ring in both themes.
const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 " +
    "focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 dark:ring-offset-slate-900";

export default function App() {

    const [inspecting, setInspecting] = useState(false);
    const [multiResultMode, setMultiResultMode] = useState(false);
    const [devMode, setDevMode] = useState(false);
    const [results, setResults] = useState<GeneratedSelector[]>([]);
    const [copiedSelector, setCopiedSelector] = useState<string | null>(null);
    const [selection, setSelection] = useState<SelectionState | null>(null);
    // Distinguishes "never inspected yet" from "inspected, found nothing" —
    // both used to render the exact same empty-state message.
    const [hasRun, setHasRun] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const [generationTimeMs, setGenerationTimeMs] = useState<number | null>(null);
    // multiResultMode as it was when the currently-displayed results were
    // requested, not the live toggle value — the toggle is disabled while
    // inspecting, but nothing stops the user from flipping it *after*
    // results are already shown, which shouldn't retroactively change how
    // those results are judged (see the non-unique-selector warning below).
    const [resultsMultiResultMode, setResultsMultiResultMode] = useState(false);

    useEffect(() => {

        const listener = (message: { type?: string; payload?: unknown }) => {

            if (message.type === MessageType.ELEMENT_SELECTED) {
                const payload = message.payload as ElementSelectedPayload | undefined;
                setResults(payload?.results ?? []);
                setGenerationTimeMs(payload?.generationTimeMs ?? null);
                setLastError(null);
                setHasRun(true);
                setInspecting(false);
            }

            if (message.type === MessageType.INSPECTION_ERROR) {
                setResults([]);
                setGenerationTimeMs(null);
                setLastError((message.payload as string) ?? "Erreur inconnue.");
                setHasRun(true);
                setInspecting(false);
            }

            if (message.type === MessageType.SELECTION_CHANGED) {
                setSelection(message.payload as SelectionState);
            }

            if (message.type === MessageType.INSPECTION_CANCELLED) {
                setInspecting(false);
                setSelection(null);
            }

        };

        browser.runtime.onMessage.addListener(listener);

        return () => browser.runtime.onMessage.removeListener(listener);

    }, []);

    // Dev mode is a standing preference (like a devtools setting), not a
    // per-inspection choice — persisted so it survives the sidebar panel
    // being unmounted/remounted across tab switches.
    useEffect(() => {

        browser.storage.local.get("devMode").then(stored => {
            if (typeof stored.devMode === "boolean") {
                setDevMode(stored.devMode);
            }
        });

    }, []);

    function toggleDevMode() {

        setDevMode(value => {
            const next = !value;
            browser.storage.local.set({ devMode: next });
            return next;
        });

    }

    function startInspection() {

        setResults([]);
        setLastError(null);
        setGenerationTimeMs(null);
        setSelection(null);
        setInspecting(true);
        setResultsMultiResultMode(multiResultMode);

        sendMessage({
            type: MessageType.START_INSPECTION,
            payload: { multiResultMode, devMode }
        });

    }

    function cancelInspection() {

        setInspecting(false);
        setSelection(null);

        sendMessage({
            type: MessageType.STOP_INSPECTION
        });

    }

    function selectBreadcrumbNode(index: number) {

        sendMessage({
            type: MessageType.SET_SELECTION_INDEX,
            payload: index
        });

    }

    async function copySelector(selector: string) {

        await navigator.clipboard.writeText(selector);

        setCopiedSelector(selector);
        setTimeout(() => setCopiedSelector(current => current === selector ? null : current), 1500);

    }

    const [best, ...alternatives] = results;
    const bestQualityTier = best ? getSelectorQualityTier(best.count, resultsMultiResultMode) : "good";
    const bestQualityStyle = SELECTOR_QUALITY_STYLES[bestQualityTier];
    const bestQualityLabel = getSelectorQualityLabel(bestQualityTier, resultsMultiResultMode);

    const generationTimeTier = generationTimeMs !== null ? getGenerationTimeTier(generationTimeMs) : null;
    const generationTimeStyle = generationTimeTier ? SELECTOR_QUALITY_STYLES[generationTimeTier] : null;

    const bestWarning = !best || bestQualityTier === "good"
        ? null
        : resultsMultiResultMode
            ? "La sélection multiple n'a trouvé qu'un seul élément : aucun groupe à cibler n'a été identifié."
            : bestQualityTier === "bad"
                ? `Ce sélecteur correspond à ${best.count} éléments différents et ne scope pas correctement la cible : il est peu fiable en l'état.`
                : `Ce sélecteur correspond à ${best.count} éléments différents, il ne cible pas un élément unique. Activez « Sélection multiple » si c'est voulu, ou ajustez-le manuellement.`;

    return (
        <main className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">

            <header className="mb-4">
                <h1 className="text-lg font-semibold tracking-tight">
                    Selector Generator
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Cliquez sur un élément de la page pour générer son sélecteur CSS.
                </p>
            </header>

            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">

                <div className="flex flex-col">

                    <span className="mb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                        Options
                    </span>

                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">

                        <label className="flex cursor-pointer items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                            <span>
                                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                                    Mode développeur
                                </span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    Ajustez l'élément ciblé avec les flèches (↑ parent / ↓ enfant) avant de valider.
                                </span>
                            </span>

                            <button
                                type="button"
                                role="switch"
                                aria-checked={devMode}
                                disabled={inspecting}
                                onClick={toggleDevMode}
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${FOCUS_RING} ${
                                    devMode ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                        devMode ? "translate-x-5" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </label>

                        <label className="flex cursor-pointer items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                            <span>
                                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                                    Sélection multiple
                                </span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    Cible tous les éléments similaires (ex. toutes les tailles) plutôt qu'un seul.
                                </span>
                            </span>

                            <button
                                type="button"
                                role="switch"
                                aria-checked={multiResultMode}
                                disabled={inspecting}
                                onClick={() => setMultiResultMode(value => !value)}
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${FOCUS_RING} ${
                                    multiResultMode ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                        multiResultMode ? "translate-x-5" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </label>

                    </div>

                </div>

                <button
                    onClick={inspecting ? cancelInspection : startInspection}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${FOCUS_RING} ${
                        inspecting
                            ? "bg-slate-500 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600"
                            : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    }`}
                >
                    <TargetIcon className="h-4 w-4" aria-hidden="true" />
                    {inspecting ? "Annuler l'inspection" : "Inspecter"}
                </button>

                {inspecting && (
                    <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
                        {devMode
                            ? "Cliquez sur un élément, ajustez avec ↑ / ↓, validez avec ↵."
                            : "En attente d'un clic sur la page..."}
                    </p>
                )}

                {devMode && inspecting && selection && selection.path.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/60">

                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Élément ciblé
                        </span>

                        <ul className="flex flex-col">
                            {selection.path
                                .map((node, originalIndex) => ({ node, originalIndex }))
                                .reverse()
                                .map(({ node, originalIndex }) => {

                                    const depth = selection.path.length - 1 - originalIndex;
                                    const isActive = originalIndex === selection.index;
                                    // The node the user physically clicked — arrow-key adjustment
                                    // may have since moved isActive elsewhere in the chain, so
                                    // this needs its own marker to stay visible either way.
                                    const isClickedElement = originalIndex === 0;

                                    return (
                                        <li key={originalIndex} className="flex items-stretch">

                                            {/* One guide column per ancestor level, forming a
                                                continuous vertical rail down the tree — there are
                                                no siblings to branch to since this is a single
                                                ancestor chain, not a full DOM tree. */}
                                            {Array.from({ length: depth }).map((_, i) => (
                                                <span
                                                    key={i}
                                                    aria-hidden="true"
                                                    className="w-3 shrink-0 border-r border-slate-200 dark:border-slate-800"
                                                />
                                            ))}

                                            <button
                                                type="button"
                                                onClick={() => selectBreadcrumbNode(originalIndex)}
                                                title={isClickedElement ? "Élément cliqué" : undefined}
                                                className={`flex min-w-0 flex-1 items-center gap-1 truncate rounded-md border-l-2 px-2 py-1 text-left font-mono text-xs transition-colors ${FOCUS_RING} ${
                                                    isActive
                                                        ? "border-indigo-500 bg-indigo-50 font-semibold dark:bg-indigo-950/40"
                                                        : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                                }`}
                                            >
                                                {isClickedElement && (
                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                                                )}

                                                <span className={isActive ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"}>
                                                    {node.tagName}
                                                </span>

                                                {node.id && (
                                                    <span className="text-amber-600 dark:text-amber-400">#{node.id}</span>
                                                )}

                                                {node.classes.length > 0 && (
                                                    <span className="truncate text-emerald-600 dark:text-emerald-400">
                                                        .{node.classes.join(".")}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );

                                })}
                        </ul>

                    </div>
                )}

            </section>

            <section className="mt-4" aria-live="polite" aria-atomic="false">

                {!inspecting && !hasRun && (
                    <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                        Aucun sélecteur généré pour l'instant.
                    </p>
                )}

                {!inspecting && hasRun && lastError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        Échec de la génération du sélecteur : {lastError}
                    </p>
                )}

                {!inspecting && hasRun && !lastError && results.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                        Aucun sélecteur n'a pu être généré pour cet élément.
                        {generationTimeMs !== null && (
                            <span className="mt-1 block text-xs">
                                Temps de génération : {formatGenerationTime(generationTimeMs)}
                            </span>
                        )}
                    </p>
                )}

                {best && (
                    <div
                        key={best.selector}
                        className={`animate-fade-in flex flex-col gap-2 rounded-xl border p-4 ${bestQualityStyle.border} ${bestQualityStyle.bg}`}
                    >

                        <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-medium tracking-wide uppercase ${bestQualityStyle.text}`}>
                                Meilleur sélecteur
                            </span>

                            <span className="flex items-center gap-1.5">
                                <span
                                    className={`flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium dark:bg-slate-900 ${bestQualityStyle.text}`}
                                >
                                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${bestQualityStyle.dot}`} />
                                    {bestQualityLabel}
                                </span>

                                <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${bestQualityStyle.badge}`}
                                >
                                    {best.count} {best.count > 1 ? "correspondances" : "correspondance"}
                                </span>

                                {generationTimeMs !== null && generationTimeStyle && (
                                    <span
                                        title="Temps de génération du sélecteur"
                                        className={`flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium dark:bg-slate-900 ${generationTimeStyle.text}`}
                                    >
                                        <ClockIcon aria-hidden="true" className="h-3 w-3" />
                                        {formatGenerationTime(generationTimeMs)}
                                    </span>
                                )}
                            </span>
                        </div>

                        {bestWarning && (
                            <p className={`text-xs ${bestQualityStyle.text}`}>
                                ⚠ {bestWarning}
                            </p>
                        )}

                        {best.insideShadowRoot && (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                ⚠ Cet élément est dans un Shadow DOM — utilisez{" "}
                                <code>hostElement.shadowRoot.querySelector(...)</code>, pas{" "}
                                <code>document.querySelector(...)</code> directement.
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={() => copySelector(best.selector)}
                            title="Copier le sélecteur"
                            className={`group relative block w-full rounded-lg bg-white p-2 pr-8 text-left text-sm break-all whitespace-pre-wrap text-slate-800 transition-colors hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${FOCUS_RING}`}
                        >
                            <code>{best.selector}</code>
                            <ClipboardIcon
                                aria-hidden="true"
                                className="absolute top-2 right-2 h-4 w-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-slate-500"
                            />
                        </button>

                        <button
                            onClick={() => copySelector(best.selector)}
                            className={`flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors ${FOCUS_RING} ${bestQualityStyle.badge} ${bestQualityStyle.badgeHover}`}
                        >
                            {copiedSelector === best.selector
                                ? <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
                                : <ClipboardIcon aria-hidden="true" className="h-3.5 w-3.5" />}
                            {copiedSelector === best.selector ? "Copié !" : "Copier"}
                        </button>

                    </div>
                )}

                {alternatives.length > 0 && (
                    <details className="group mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <summary
                            className={`flex cursor-pointer items-center gap-1.5 rounded text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden dark:text-slate-300 ${FOCUS_RING}`}
                        >
                            <ChevronIcon aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                            Autres options ({Math.min(alternatives.length, MAX_ALTERNATIVES)})
                        </summary>

                        <ul className="mt-2 flex flex-col gap-2">
                            {alternatives.slice(0, MAX_ALTERNATIVES).map(result => {

                                const tier = getSelectorQualityTier(result.count, resultsMultiResultMode);
                                const style = SELECTOR_QUALITY_STYLES[tier];
                                const label = getSelectorQualityLabel(tier, resultsMultiResultMode);

                                return (
                                    <li
                                        key={result.selector}
                                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-950/60"
                                    >
                                        <span
                                            aria-hidden="true"
                                            title={label}
                                            className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                                        />

                                        <code
                                            title={result.selector}
                                            className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-300"
                                        >
                                            {result.selector}
                                        </code>

                                        <span
                                            title={label}
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-white ${style.badge}`}
                                        >
                                            {result.count}
                                        </span>

                                        <button
                                            onClick={() => copySelector(result.selector)}
                                            aria-label="Copier"
                                            title="Copier"
                                            className={`shrink-0 rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
                                        >
                                            {copiedSelector === result.selector
                                                ? <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
                                                : <ClipboardIcon aria-hidden="true" className="h-3.5 w-3.5" />}
                                        </button>
                                    </li>
                                );

                            })}
                        </ul>
                    </details>
                )}

            </section>

        </main>
    );

}
