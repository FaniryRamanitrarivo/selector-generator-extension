import { useEffect, useState } from "react";

import { MessageType } from "@/messaging/messages";
import { sendMessage } from "@/messaging/messenger";
import type { GeneratedSelector } from "@/content/selector/generated-selector";

const MAX_ALTERNATIVES = 5;

export default function App() {

    const [inspecting, setInspecting] = useState(false);
    const [multiResultMode, setMultiResultMode] = useState(false);
    const [results, setResults] = useState<GeneratedSelector[]>([]);
    const [copiedSelector, setCopiedSelector] = useState<string | null>(null);

    useEffect(() => {

        const listener = (message: { type?: string; payload?: GeneratedSelector[] }) => {

            if (message.type === MessageType.ELEMENT_SELECTED) {
                setResults(message.payload ?? []);
                setInspecting(false);
            }

        };

        browser.runtime.onMessage.addListener(listener);

        return () => browser.runtime.onMessage.removeListener(listener);

    }, []);

    function startInspection() {

        setResults([]);
        setInspecting(true);

        sendMessage({
            type: MessageType.START_INSPECTION,
            payload: { multiResultMode }
        });

    }

    function cancelInspection() {

        setInspecting(false);

        sendMessage({
            type: MessageType.STOP_INSPECTION
        });

    }

    async function copySelector(selector: string) {

        await navigator.clipboard.writeText(selector);

        setCopiedSelector(selector);
        setTimeout(() => setCopiedSelector(current => current === selector ? null : current), 1500);

    }

    const [best, ...alternatives] = results;

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
                        En attente d'un clic sur la page...
                    </p>
                )}

            </section>

            <section className="mt-4">

                {!inspecting && results.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
                        Aucun sélecteur généré pour l'instant.
                    </p>
                )}

                {best && (
                    <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4">

                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium tracking-wide text-blue-700 uppercase">
                                Meilleur sélecteur
                            </span>
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                                {best.count} {best.count > 1 ? "correspondances" : "correspondance"}
                            </span>
                        </div>

                        <code className="block overflow-x-auto rounded-lg bg-white p-2 text-sm text-slate-800">
                            {best.selector}
                        </code>

                        <button
                            onClick={() => copySelector(best.selector)}
                            className="self-start rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
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
