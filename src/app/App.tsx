import { useEffect, useState } from "react";

import { MessageType } from "@/messaging/messages";
import { sendMessage } from "@/messaging/messenger";
import type { GeneratedSelector } from "@/content/selector/generated-selector";
import type { SelectionState } from "@/content/inspector/inspector";

const MAX_ALTERNATIVES = 5;

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
    // multiResultMode as it was when the currently-displayed results were
    // requested, not the live toggle value — the toggle is disabled while
    // inspecting, but nothing stops the user from flipping it *after*
    // results are already shown, which shouldn't retroactively change how
    // those results are judged (see the non-unique-selector warning below).
    const [resultsMultiResultMode, setResultsMultiResultMode] = useState(false);

    useEffect(() => {

        const listener = (message: { type?: string; payload?: unknown }) => {

            if (message.type === MessageType.ELEMENT_SELECTED) {
                setResults((message.payload as GeneratedSelector[]) ?? []);
                setLastError(null);
                setHasRun(true);
                setInspecting(false);
            }

            if (message.type === MessageType.INSPECTION_ERROR) {
                setResults([]);
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
    // A "best" selector matching more than one element is only the intended
    // outcome in multi-result mode — otherwise it's a broken promise (the
    // core pitch is precision) that the count badge alone doesn't make
    // obvious enough to notice at a glance.
    const isBestAmbiguous = !!best && !resultsMultiResultMode && best.count > 1;

    return (
        <main className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900">

            <header className="mb-4">
                <h1 className="text-lg font-semibold tracking-tight">
                    Selector Generator
                </h1>
                <p className="text-sm text-slate-500">
                    Cliquez sur un élément de la page pour générer son sélecteur CSS.
                </p>
            </header>

            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

                <label className="flex cursor-pointer items-start justify-between gap-3">
                    <span>
                        <span className="block text-sm font-medium text-slate-800">
                            Mode développeur
                        </span>
                        <span className="block text-xs text-slate-500">
                            Ajustez l'élément ciblé avec les flèches (↑ parent / ↓ enfant) avant de valider.
                        </span>
                    </span>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={devMode}
                        disabled={inspecting}
                        onClick={toggleDevMode}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                            devMode ? "bg-blue-600" : "bg-slate-300"
                        }`}
                    >
                        <span
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                devMode ? "translate-x-5" : "translate-x-0"
                            }`}
                        />
                    </button>
                </label>

                <label className="flex cursor-pointer items-start justify-between gap-3">
                    <span>
                        <span className="block text-sm font-medium text-slate-800">
                            Sélection multiple
                        </span>
                        <span className="block text-xs text-slate-500">
                            Cible tous les éléments similaires (ex. toutes les tailles) plutôt qu'un seul.
                        </span>
                    </span>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={multiResultMode}
                        disabled={inspecting}
                        onClick={() => setMultiResultMode(value => !value)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                            multiResultMode ? "bg-blue-600" : "bg-slate-300"
                        }`}
                    >
                        <span
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                multiResultMode ? "translate-x-5" : "translate-x-0"
                            }`}
                        />
                    </button>
                </label>

                <button
                    onClick={inspecting ? cancelInspection : startInspection}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                        inspecting
                            ? "bg-slate-500 hover:bg-slate-600"
                            : "bg-blue-600 hover:bg-blue-700"
                    }`}
                >
                    {inspecting ? "Annuler l'inspection" : "Inspecter"}
                </button>

                {inspecting && (
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                        {devMode
                            ? "Cliquez sur un élément, ajustez avec ↑ / ↓, validez avec ↵."
                            : "En attente d'un clic sur la page..."}
                    </p>
                )}

                {devMode && inspecting && selection && selection.path.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2">

                        <span className="text-xs font-medium text-slate-500">
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
                                                    className="w-3 shrink-0 border-r border-slate-200"
                                                />
                                            ))}

                                            <button
                                                type="button"
                                                onClick={() => selectBreadcrumbNode(originalIndex)}
                                                title={isClickedElement ? "Élément cliqué" : undefined}
                                                className={`flex min-w-0 flex-1 items-center gap-1 truncate rounded-md border-l-2 px-2 py-1 text-left font-mono text-xs transition-colors ${
                                                    isActive
                                                        ? "border-indigo-500 bg-indigo-50 font-semibold"
                                                        : "border-transparent text-slate-600 hover:bg-slate-100"
                                                }`}
                                            >
                                                {isClickedElement && (
                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                                                )}

                                                <span className={isActive ? "text-indigo-700" : "text-slate-700"}>
                                                    {node.tagName}
                                                </span>

                                                {node.id && (
                                                    <span className="text-amber-600">#{node.id}</span>
                                                )}

                                                {node.classes.length > 0 && (
                                                    <span className="truncate text-emerald-600">
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

            <section className="mt-4">

                {!inspecting && !hasRun && (
                    <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
                        Aucun sélecteur généré pour l'instant.
                    </p>
                )}

                {!inspecting && hasRun && lastError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                        Échec de la génération du sélecteur : {lastError}
                    </p>
                )}

                {!inspecting && hasRun && !lastError && results.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
                        Aucun sélecteur suffisamment robuste n'a été trouvé pour cet élément.
                    </p>
                )}

                {best && (
                    <div
                        className={`flex flex-col gap-2 rounded-xl border p-4 ${
                            isBestAmbiguous ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
                        }`}
                    >

                        <div className="flex items-center justify-between">
                            <span
                                className={`text-xs font-medium tracking-wide uppercase ${
                                    isBestAmbiguous ? "text-amber-700" : "text-blue-700"
                                }`}
                            >
                                Meilleur sélecteur
                            </span>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                                    isBestAmbiguous ? "bg-amber-500" : "bg-blue-600"
                                }`}
                            >
                                {best.count} {best.count > 1 ? "correspondances" : "correspondance"}
                            </span>
                        </div>

                        {isBestAmbiguous && (
                            <p className="text-xs text-amber-700">
                                ⚠ Ce sélecteur correspond à {best.count} éléments différents, il ne cible pas
                                un élément unique. Activez « Sélection multiple » si c'est voulu.
                            </p>
                        )}

                        <code className="block overflow-x-auto rounded-lg bg-white p-2 text-sm text-slate-800">
                            {best.selector}
                        </code>

                        <button
                            onClick={() => copySelector(best.selector)}
                            className={`self-start rounded-md px-3 py-1.5 text-xs font-medium text-white ${
                                isBestAmbiguous ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
                            }`}
                        >
                            {copiedSelector === best.selector ? "Copié !" : "Copier"}
                        </button>

                    </div>
                )}

                {alternatives.length > 0 && (
                    <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700">
                            Autres options ({Math.min(alternatives.length, MAX_ALTERNATIVES)})
                        </summary>

                        <ul className="mt-2 flex flex-col gap-2">
                            {alternatives.slice(0, MAX_ALTERNATIVES).map(result => (
                                <li
                                    key={result.selector}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2"
                                >
                                    <code className="min-w-0 flex-1 truncate text-xs text-slate-700">
                                        {result.selector}
                                    </code>

                                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                                        {result.count}
                                    </span>

                                    <button
                                        onClick={() => copySelector(result.selector)}
                                        className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                    >
                                        {copiedSelector === result.selector ? "Copié !" : "Copier"}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}

            </section>

        </main>
    );

}
