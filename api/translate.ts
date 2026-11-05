/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings } from "../settings";
import { noteDetectedLanguage } from "../utils/detectedLanguage";
import { Logger, preview } from "../utils/logger";
import { shouldTranslate } from "../utils/message";
import { getDictRegex, sanitizeTranslation } from "../utils/string";
import { getGeminiActiveQuotaLock, showApiToast, showGeminiQuotaToast } from "./breaker";
import { buildContextText } from "./context";
import { googleTranslate, isSameLanguage } from "./google";
import { DeeplChannelWorker, deeplWorkers, GeminiChannelWorker, geminiWorkers, reScheduleAllWorkers,resetAllWorkers } from "./worker";

export { reScheduleAllWorkers };

export function resetTranslationQueues() {
    resetAllWorkers();
}

/**
 * Unified translation entry point with concurrency control.
 */
export async function translate(
    channelId: string,
    messageId: string,
    text: string,
    sourceLang: string,
    targetLang: string,
    engine: string,
    apiKeys: { deepl: string, gemini: string, deepseek: string },
    isManual = false,
    dictMatches: Record<string, string> = {},
    customPrompt?: string,
    context?: string
): Promise<string> {
    if (engine?.startsWith("gemini") || engine?.startsWith("deepseek")) {
        const isDeepSeek = engine.startsWith("deepseek");
        const engineKey = isDeepSeek ? apiKeys.deepseek : apiKeys.gemini;

        if (!isDeepSeek) {
            const activeLock = getGeminiActiveQuotaLock(engineKey);
            if (activeLock) {
                showGeminiQuotaToast(activeLock.kind, activeLock.until, isManual);
                return "";
            }
        }

        const result = await new Promise<string>(resolve => {
            const dmPrompt = customPrompt ?? "";

            if (!geminiWorkers.has(channelId)) {
                geminiWorkers.set(channelId, new GeminiChannelWorker(channelId));
            }

            const worker = geminiWorkers.get(channelId)!;
            const taskId = crypto.randomUUID();
            worker.enqueue({
                id: taskId, messageId, channelId, text, resolve, targetLang, apiKey: engineKey, engine, dmPrompt, isManual, dictMatches, context,
                model: isDeepSeek ? settings.store.deepseekModel : settings.store.geminiModel,
                endpoint: isDeepSeek ? settings.store.deepseekBaseUrl : undefined
            });
            Logger.debug("Translate", "queued AI task", {
                taskId, channelId, engine, targetLang,
                chars: text.length,
                contextLines: context ? context.split("\n").length : 0,
                prompt: dmPrompt ? preview(dmPrompt, 80) : "(none)",
                queued: worker.getQueuedCount?.() ?? "?",
            });
            if (!messageId) {
                worker.flushNow();
            }
        });

        if (result !== "") {
            return result;
        }

        if (!isDeepSeek) {
            const retryLock = getGeminiActiveQuotaLock(engineKey);
            if (retryLock) showGeminiQuotaToast(retryLock.kind, retryLock.until, isManual);
        }

        return "";
    }

    // Google Translate: free endpoint, no key, one request per message
    if (engine === "google") {
        const attempt = async () => {
            Logger.debug("Google", "request", { sourceLang, targetLang, chars: text.length });

            const result = await googleTranslate(text, sourceLang, targetLang);

            Logger.debug("Google", "response", {
                sourceLanguage: result.sourceLanguage || "(unknown)",
                chars: result.text.length,
                preview: preview(result.text),
            });

            return result;
        };

        try {
            let result;

            try {
                result = await attempt();
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                if (message.toLowerCase().includes("rate limit")) throw e;

                Logger.warn("Google", "request failed, retrying once", e);
                await new Promise(resolve => setTimeout(resolve, 500));
                result = await attempt();
            }

            // Already in the language I read: nothing to show
            if (result.sourceLanguage && isSameLanguage(result.sourceLanguage, targetLang)) {
                Logger.debug("Google", "skipped: already in target language", { sourceLanguage: result.sourceLanguage, targetLang });
                return "";
            }

            if (channelId) noteDetectedLanguage(channelId, result.sourceLanguage);

            return result.text;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (message.toLowerCase().includes("rate limit")) {
                Logger.warn("Google", "rate limit reached, cooling down", message);
                showApiToast("google", "límite de peticiones alcanzado, reintentando en un minuto", 60_000);
            } else {
                Logger.warn("Google", "request failed", e);
            }
            return "";
        }
    }

    // DeepL uses Batching
    if (engine === "deepl") {
        Logger.debug("DeepL", "queueing task", { channelId, chars: text.length, targetLang });
        const result = await new Promise<string>(resolve => {
            const key = `deepl|||${sourceLang}|||${targetLang}|||${apiKeys.deepl}`;
            if (!deeplWorkers.has(key)) {
                deeplWorkers.set(key, new DeeplChannelWorker(key));
            }

            const worker = deeplWorkers.get(key)!;
            worker.enqueue({
                id: crypto.randomUUID(), messageId, channelId, text, resolve, targetLang, apiKey: apiKeys.deepl, engine: "deepl", dmPrompt: ""
            });
            if (!messageId) {
                worker.flushNow();
            }
        });

        if (result !== "") {
            return result;
        }

        return "";
    }



    // Default fallback (should not be reached unless engine is unknown)
    return Promise.resolve("");
}



// --- Tokenizer Helpers ---
const PRESERVE_BASE = /<@[!&]?\d+>|<#\d+>|<[^>]+>|https?:\/\/[^\s]+|```[\s\S]*?```|`[^`]+`/gmu;

export function getGeminiBatchState(channelId: string, messageId: string) {
    const worker = geminiWorkers.get(channelId);
    if (!worker) return null;

    const task = Array.from(worker.registry.values()).find(t => t.messageId === messageId);
    if (!task) return null;

    if (task.status === "PROCESSING") {
        return { isProcessing: true, isFired: true };
    }

    if (worker.state === "PROCESSING") {
        return {
            deadline: Date.now() + 5000,
            leaderIds: worker.leaderIds,
            isProcessing: false,
            isFired: false,
            isPaused: true
        };
    }

    const ecoThreshold = settings.store.APIEcoModeThreshold || 1;
    const maxWaitMs = (settings.store.APIMaxBatchWait ?? 0) * 1000;
    return {
        deadline: worker.deadline,
        leaderIds: worker.leaderIds,
        isProcessing: false,
        isFired: false,
        ecoProgress: (worker.thresholdMetTime || worker.getQueuedCount() >= ecoThreshold) ? 1 : worker.getQueuedCount() / ecoThreshold,
        startTime: worker.firstMessageTime,
        maxWaitMs
    };
}

function tokenizeText(text: string, hideEmojis: boolean, hideMentions: boolean): { textToTranslate: string, tokens: string[] } {
    const tokens: string[] = [];
    let textToTranslate = text;

    if (hideEmojis) {
        // Remove emojis completely
        textToTranslate = textToTranslate
            .replace(/<a?:\w+:\d+>/g, "")
            .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
    }

    if (hideMentions) {
        // Remove mentions completely
        textToTranslate = textToTranslate.replace(/<@[!&]?\d+>/g, "");
    }

    // Tokenize remaining special elements (URLs, code blocks, etc.)
    textToTranslate = textToTranslate.replace(PRESERVE_BASE, match => {
        const id = tokens.length;
        tokens.push(match);
        return `[token${id}]`;
    });

    return { textToTranslate, tokens };
}

function restoreTokens(text: string, tokens: string[]): string {
    return text.replace(/\[\s*token(\d+)\s*\]/gi, (match, idStr) => {
        const id = parseInt(idStr, 10);
        return tokens[id] !== undefined ? tokens[id] : match;
    });
}

// --- Dictionary Cache ---
let cachedDictHash = "";
let cachedDictRegex: RegExp | null = null;

function applyCustomDictionary(text: string, caseSensitive: boolean, dict: Record<string, string>): { replacedText: string, matches: Record<string, string> } {
    const dictKeys = Object.keys(dict);
    const matches: Record<string, string> = {};

    if (dictKeys.length === 0) return { replacedText: text, matches };

    // Cache invalidation logic
    const currentHash = JSON.stringify([dictKeys, caseSensitive]);
    if (currentHash !== cachedDictHash) {
        dictKeys.sort((a, b) => b.length - a.length);
        cachedDictRegex = getDictRegex(dictKeys, caseSensitive);
        cachedDictHash = currentHash;
    }

    if (cachedDictRegex) {
        const replacedText = text.replace(cachedDictRegex, match => {
            const matchedKey = dictKeys.find(k => caseSensitive ? k === match : k.toLowerCase() === match.toLowerCase());
            if (matchedKey && dict[matchedKey]) {
                matches[matchedKey] = dict[matchedKey];
                return dict[matchedKey];
            }
            return match;
        });
        return { replacedText, matches };
    }

    return { replacedText: text, matches };
}

export async function safeTranslate(
    content: string,
    sourceLang: string,
    targetLang: string,
    engine: string,
    apiKeys: { deepl: string, gemini: string, deepseek: string },
    channelId?: string,
    messageId?: string,
    isManual = false,
    customPrompt?: string,
    glossary: Record<string, string> = {},
    isOutgoing = false
): Promise<string | null> {
    if (!isOutgoing && !shouldTranslate(content, targetLang)) {
        Logger.debug("Translate", "skipped by language heuristic", { targetLang, chars: content.length, preview: preview(content) });
        return null;
    }

    // 1. Tokenize (Extract mentions, code blocks, emojis)
    let { textToTranslate, tokens } = tokenizeText(content.trim(), settings.store.hideEmojis, settings.store.hideMentions);

    // 2. Custom Dictionary Substitution
    const isAI = engine?.startsWith("gemini") || engine?.startsWith("deepseek");
    const { replacedText, matches } = applyCustomDictionary(textToTranslate, settings.store.dictionaryCaseSensitive, glossary);

    Logger.debug("Translate", "prepared", {
        messageId: messageId || "(outgoing)",
        channelId: channelId || "(none)",
        engine,
        sourceLang,
        targetLang,
        chars: content.length,
        tokens: tokens.length,
        dictionaryMatches: Object.keys(matches).length,
        manual: isManual,
        prompt: customPrompt ? preview(customPrompt) : "(none)",
        glossaryTerms: Object.keys(glossary).length,
    });

    // For AI, we keep original text and pass dictionary rules to prompt.
    // For DeepL, we inline replace the text.
    textToTranslate = isAI ? textToTranslate : replacedText;

    // 3. Translate
    const result = await translate(
        channelId || "",
        messageId || "",
        textToTranslate,
        sourceLang,
        targetLang,
        engine,
        apiKeys,
        isManual,
        matches,
        customPrompt,
        isAI ? buildContextText(channelId || "", messageId || undefined) : undefined
    );

    if (!result) {
        Logger.debug("Translate", "no result (skipped, same language or failed)", { messageId, engine });
        return null;
    }

    if (result === textToTranslate) {
        Logger.debug("Translate", "unchanged output, nothing to show", { messageId, engine });
        return null;
    }

    // 4. Remove LLM artifacts, then restore tokens
    const sanitized = sanitizeTranslation(result, content);
    if (sanitized !== result) {
        Logger.debug("Translate", "sanitized LLM punctuation", {
            before: preview(result),
            after: preview(sanitized),
        });
    }

    const finalText = restoreTokens(sanitized, tokens);
    Logger.debug("Translate", "done", { messageId, chars: finalText.length, preview: preview(finalText) });

    return finalText;
}
