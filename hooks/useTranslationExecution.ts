/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "@webpack/common";

import { safeTranslate } from "../api/translate";
import { TranslationCache } from "../utils/cache";
import { Logger } from "../utils/logger";

interface UseTranslationExecutionProps {
    messageId: string;
    channelId: string;
    content: string;
    cacheKey: string;
    currentEngine: string;
    sourceLang: string;
    resolvedTarget: string;
    shouldTranslateContent: boolean;
    allowed: boolean;
    isManual: boolean;
    skipMessage: boolean;
    deeplApiKey?: string;
    geminiApiKey?: string;
    deepseekApiKey?: string;
    cachedTranslated: string | undefined;
    cacheRevision: number;
    aiPrompt: string;
    glossary: Record<string, string>;
    /** Only start translating once the message is near the viewport */
    enabled: boolean;
}

/**
 * Hook to manage the execution of the API translation request and caching logic.
 */
export function useTranslationExecution({
    messageId,
    channelId,
    content,
    cacheKey,
    currentEngine,
    sourceLang,
    resolvedTarget,
    shouldTranslateContent,
    allowed,
    isManual,
    skipMessage,
    deeplApiKey,
    geminiApiKey,
    deepseekApiKey,
    cachedTranslated,
    cacheRevision,
    aiPrompt,
    glossary,
    enabled
}: UseTranslationExecutionProps) {
    const [translatedText, setTranslatedText] = useState<string | null>(cachedTranslated ?? null);
    const [isTranslating, setIsTranslating] = useState(false);

    // Sync state if cache updates synchronously (e.g. from manual batch)
    useEffect(() => {
        if (cachedTranslated && translatedText !== cachedTranslated) {
            setTranslatedText(cachedTranslated);
            setIsTranslating(false);
        }
    }, [cachedTranslated]);

    useEffect(() => {
        // If we already have the text from cache, we don't need to fetch
        if (cachedTranslated) {
            Logger.debug("Execute", "cache hit", { messageId, chars: cachedTranslated.length });
            return;
        }

        // Lazy loading: wait until the message is close to the viewport
        if (!enabled) {
            Logger.debug("Execute", "waiting for viewport", { messageId });
            setIsTranslating(false);
            return;
        }

        const skipReason = !content ? "empty content"
            : (!allowed && !isManual) ? "scope disabled"
                : skipMessage ? "own/optimistic/empty message"
                    : !shouldTranslateContent ? "shouldTranslate=false (already target language or ignored)"
                        : currentEngine === "disable" ? "engine disabled"
                            : null;

        if (skipReason) {
            Logger.debug("Execute", "skipped", { messageId, reason: skipReason, engine: currentEngine, targetLang: resolvedTarget });
            setIsTranslating(false);
            setTranslatedText(null);
            return;
        }

        Logger.debug("Execute", "evaluate", {
            messageId,
            channelId,
            engine: currentEngine,
            sourceLang,
            targetLang: resolvedTarget,
            manual: isManual,
            allowed,
            visible: enabled,
            cacheKey,
        });

        let cancelled = false;
        let timeoutId: NodeJS.Timeout;

        const run = async () => {
            if (cancelled) return;

            setTranslatedText(null);

            const cache = TranslationCache.getInstance();
            const generation = cache.getGeneration(cacheKey);
            let promise = TranslationCache.getInstance().getPending(cacheKey, content);
            if (promise) {
                Logger.debug("Execute", "reusing in-flight request", { messageId });
            } else {
                Logger.debug("Execute", "requesting translation", { messageId, chars: content.length, engine: currentEngine });
                promise = safeTranslate(
                    content,
                    sourceLang,
                    resolvedTarget,
                    currentEngine,
                    { deepl: deeplApiKey || "", gemini: geminiApiKey || "", deepseek: deepseekApiKey || "" },
                    channelId,
                    messageId,
                    isManual,
                    aiPrompt,
                    glossary
                );
                TranslationCache.getInstance().setPending(cacheKey, content, promise);
            }

            setIsTranslating(true);
            try {
                const result = await promise;
                if (cache.getGeneration(cacheKey) !== generation) return;
                if (result) cache.set(cacheKey, result, currentEngine);
                Logger.debug("Execute", "result", { messageId, translated: !!result, chars: result?.length ?? 0 });
                if (!cancelled) setTranslatedText(result);
            } catch (e) {
                Logger.warn("Translate", "Translation request failed", e);
            } finally {
                if (!cancelled) setIsTranslating(false);
            }
        };

        // Scroll debounce: skip API calls if user scrolls past message quickly
        if (currentEngine === "deepl") {
            timeoutId = setTimeout(run, 500);
        } else if (currentEngine === "google") {
            // Free endpoint, avoid bursting a whole channel at once
            timeoutId = setTimeout(run, 200);
        } else {
            run();
        }

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [
        cacheKey,
        cacheRevision,
        content,
        allowed,
        isManual,
        resolvedTarget,
        currentEngine,
        sourceLang,
        deeplApiKey,
        geminiApiKey,
        deepseekApiKey,
        skipMessage,
        shouldTranslateContent,
        cachedTranslated,
        channelId,
        messageId,
        enabled
    ]);

    return {
        translatedText,
        isTranslating
    };
}
