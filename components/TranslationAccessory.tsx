/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { Message } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { Parser, UserStore } from "@webpack/common";

import { useMessageVisibility } from "../hooks/useMessageVisibility";
import { useTranslationExecution } from "../hooks/useTranslationExecution";
import { pluginStarted } from "../index";
import { settings } from "../settings";
import { TranslationCache } from "../utils/cache";
import { getCacheKey } from "../utils/hash";
import { shouldTranslate } from "../utils/message";
import { getGuildIdForChannel, resolveConfig } from "../utils/scopes";
import { useApiKeys } from "../utils/secrets";
import { LoadingIndicator } from "./LoadingIndicator";

const CodeContainerClasses = findCssClassesLazy("markup");

export const TranslationAccessory = ErrorBoundary.wrap(function TranslationAccessory({ message }: { message: Message }) {
    const {
        hideOriginal,
        showSeparator,
        translationColor,
        skipOwnMessages,
        hideEmojis,
        _cacheVersion
    } = settings.use([
        "hideOriginal",
        "showSeparator",
        "translationColor",
        "translationEngine",
        "targetLang",
        "skipOwnMessages",
        "channelList",
        "guildOverrides",
        "userOverrides",
        "translationMode",
        "hideEmojis",
        "geminiModel",
        "deepseekModel",
        "deepseekBaseUrl",
        "hideMentions",
        "_cacheVersion"
    ]);

    const apiKeys = useApiKeys();

    const resolved = resolveConfig({
        channelId: message.channel_id,
        guildId: (message as any).guild_id ?? getGuildIdForChannel(message.channel_id),
        userId: message.author?.id
    });

    const { sourceLang } = resolved;
    let resolvedTarget: string = resolved.targetLang;
    if (resolvedTarget === "auto") {
        resolvedTarget = document.documentElement.lang.split("-")[0] || "en";
    }
    const allowed = resolved.enabled;

    // Quick skip checks for own messages and optimistic messages
    const isOwnMessage = skipOwnMessages && message.author?.id === UserStore.getCurrentUser()?.id;
    const isOptimistic = !/^\d{17,20}$/.test(message.id) || message.state === "SENDING";
    const skipMessage = isOwnMessage || isOptimistic || !message.content;
    const shouldTranslateContent = !skipMessage && shouldTranslate(message.content, resolvedTarget);

    const activeEngine = resolved.engine;
    const cache = TranslationCache.getInstance();
    const displayed = cache.getDisplayed(message.channel_id, message.id, message.content, resolvedTarget);
    const cacheKey = displayed?.cacheKey ?? getCacheKey(message.channel_id, message.id, activeEngine, sourceLang, resolvedTarget, message.content, resolved.aiPrompt);

    let cachedTranslated = displayed?.text ?? cache.peek(cacheKey);

    // Outgoing cache fast-path: instantly display own sent translations
    if (!cachedTranslated && message.author?.id === UserStore.getCurrentUser()?.id) {
        const outgoingHit = cache.getOutgoing(message.channel_id, message.content);
        if (outgoingHit) {
            cachedTranslated = outgoingHit;
            cache.set(cacheKey, outgoingHit, activeEngine);
        }
    }

    const { translatedText, isTranslating, error, retry } = useTranslationExecution({
        messageId: message.id,
        channelId: message.channel_id,
        content: message.content,
        cacheKey,
        currentEngine: activeEngine,
        sourceLang,
        resolvedTarget,
        shouldTranslateContent,
        allowed,
        skipMessage,
        geminiApiKey: apiKeys.gemini,
        deepseekApiKey: apiKeys.deepseek,
        customPrompt: resolved.aiPrompt,
        cachedTranslated,
        cacheRevision: _cacheVersion
    });

    // Visibility Hook (DOM side-effects)
    useMessageVisibility({
        messageId: message.id,
        allowed: allowed && activeEngine !== "disable",
        hideOriginal,
        isTranslating,
        translatedText
    });

    if (!pluginStarted) return null;
    if (activeEngine === "disable") return null;
    if (!allowed) return null;
    if (error && !isTranslating) {
        return (
            <button className="bat-translation-retry" type="button" title={error} onClick={retry}>
                Traducción fallida <span aria-hidden="true">↻</span>
            </button>
        );
    }
    if (!translatedText && !isTranslating) return null;

    const customColor = translationColor || "#9aff99";
    const displayColor = hideOriginal ? undefined : customColor;
    const topMargin = hideOriginal ? 0 : 4;

    const containerClasses = `bat-translation ${hideOriginal ? CodeContainerClasses.markup : ""}`.trim();

    if (isTranslating && !translatedText) {
        return (
            <LoadingIndicator
                displayColor={customColor}
                topMargin={topMargin}
                hideOriginal={hideOriginal}
                showSeparator={showSeparator}
                messageId={message.id}
                channelId={message.channel_id}
            />
        );
    }

    let displayText = translatedText || "";

    if (!hideOriginal) {
        if (hideEmojis) {
            displayText = displayText
                .replace(/<a?:\w+:\d+>/g, "")
                .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
        }
        displayText = displayText.replace(/https?:\/\/[^\s>]+/g, "");
    }

    return (
        <div className={containerClasses} style={{ color: displayColor, marginTop: topMargin }}>
            {(!hideOriginal && showSeparator) && <div className="bat-separator" />}
            {Parser.parse(displayText, true, {
                channelId: message.channel_id,
                messageId: message.id
            })}
        </div>
    );
}, { noop: true });
