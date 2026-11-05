/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addContextMenuPatch, addGlobalContextMenuPatch, type GlobalContextMenuPatchCallback, type NavContextMenuPatchCallback, removeContextMenuPatch, removeGlobalContextMenuPatch } from "@api/ContextMenu";
import { addMessageAccessory, removeMessageAccessory } from "@api/MessageAccessories";
import { plugins } from "@api/PluginManager";
import { Divider } from "@components/Divider";
import { openPluginModal } from "@components/settings";
import definePlugin from "@utils/types";
import { ComponentDispatch, Menu, SelectedChannelStore } from "@webpack/common";

import { resetTranslationQueues,safeTranslate } from "./api/translate";
import { ApiKeysManager } from "./components/ApiKeyInput";
import { ChannelManager } from "./components/ChannelManager";
import { ClearCacheButton } from "./components/ClearCacheButton";
import { ColorPickerInput } from "./components/ColorPickerInput";
import { DebugLogSection } from "./components/DebugLog";
import { GithubLinkInjector } from "./components/GithubLinkInjector";
import { TranslateHeaderButton } from "./components/HeaderBarIcon";
import { Forms } from "./components/LegacyWebpack";
import { openScopeEditor } from "./components/ScopeEditor";
import { SettingsPresets } from "./components/SettingsPresets";
import { TranslationAccessory } from "./components/TranslationAccessory";
import { normalizeTranslationEngines, settings } from "./settings";
import { TranslationCache } from "./utils/cache";
import { getRecentChannelUsers } from "./utils/channelUsers";
import { detectChannelLanguage, getDetectedLanguage } from "./utils/detectedLanguage";
import { initDebugLog, Logger, preview } from "./utils/logger";
import { getGuildIdForChannel, resolveConfig } from "./utils/scopes";
import { getApiKeys, initSecrets } from "./utils/secrets";


function hasMenuItem(children: any[], id: string): boolean {
    for (const child of children) {
        if (!child) continue;

        if (Array.isArray(child)) {
            if (hasMenuItem(child, id)) return true;
            continue;
        }

        if (child?.props?.id === id) return true;

        const nested = child?.props?.children;
        if (Array.isArray(nested) && hasMenuItem(nested, id)) return true;
    }

    return false;
}

function describeArg(arg: any): any {
    if (!arg || typeof arg !== "object") return typeof arg;

    return {
        id: arg.id,
        username: arg.username,
        type: arg.type,
        hasMessage: !!arg.message,
        keys: Object.keys(arg).slice(0, 14),
    };
}

/**
 * A single global patch covers every context menu, so it does not depend on the
 * navId of this Discord build. It inspects the menu arguments instead.
 */
const scopedMenuPatch: GlobalContextMenuPatchCallback = (navId, children, ...args) => {
    Logger.debug("Menu", "context menu opened", { navId, args: args.map(describeArg) });

    if (!(Menu as any).MenuItem) {
        Logger.warn("Menu", "Menu.MenuItem is missing, cannot add items", { navId });
        return;
    }

    const addItem = (kind: "channel" | "guild" | "user", label: string, action: () => void) => {
        const id = `always-translate-${kind}-settings`;
        if (hasMenuItem(children, id)) return;

        children.push(<Menu.MenuItem id={id} label={label} action={action} />);
        Logger.debug("Menu", "item added", { navId, kind, label });
    };

    // Message context menu: props.message
    const messageArg = args.find(arg => arg?.message?.author?.id);
    if (messageArg) {
        const { author } = messageArg.message;
        addItem("user", `AlwaysTranslate: ajustes de ${author.globalName ?? author.username}`, () => openScopeEditor("user", author.id));
        return;
    }

    // Channel / thread / group DM
    const channel = args.find(arg => arg && typeof arg === "object" && typeof arg.type === "number" && typeof arg.name === "string" && arg.id);
    if (channel) {
        addItem("channel", "AlwaysTranslate: ajustes del canal…", () => openScopeEditor("channel", channel.id));
        return;
    }

    // Guild
    const guild = args.find(arg => arg && typeof arg === "object" && typeof arg.name === "string" && arg.id
        && (arg.ownerId !== undefined || arg.memberCount !== undefined || arg.roles !== undefined || arg.icon !== undefined));
    if (guild) {
        addItem("guild", "AlwaysTranslate: ajustes del servidor…", () => openScopeEditor("guild", guild.id));
        return;
    }

    // User
    const user = args.find(arg => arg && typeof arg === "object" && typeof arg.username === "string" && arg.id);
    if (user) {
        addItem("user", `AlwaysTranslate: ajustes de ${user.globalName ?? user.username}`, () => openScopeEditor("user", user.id));
    }
};

const SettingsHeader = ({ title }: { title: string }) => (
    <>
        <Divider style={{ marginTop: 24, marginBottom: 16 }} />
        <Forms.FormTitle tag="h2">{title}</Forms.FormTitle>
    </>
);

// Wire up dynamic COMPONENT settings (avoids circular imports)
settings.def.ui_githubLink.component = GithubLinkInjector;
settings.def.header_translation.component = () => <SettingsHeader title="Traducción" />;
settings.def.header_management.component = () => <SettingsHeader title="Canales y mensajes salientes" />;
settings.def.header_design.component = () => <SettingsHeader title="Apariencia" />;
settings.def.channelManager.component = ChannelManager;
settings.def.ui_apiKeys.component = ApiKeysManager;


settings.def.ui_translationColor.component = ColorPickerInput;
settings.def.ui_clearCache.component = ClearCacheButton;
settings.def.ui_presets.component = () => <SettingsPresets />;
settings.def.ui_debugLog.component = () => <DebugLogSection />;

/**
 * The chat-input ("textarea-context") menu is known to go through Vencord's
 * context menu patch system, so this always works even when Discord's new
 * context menus are not patchable.
 */
const textareaMenuPatch: NavContextMenuPatchCallback = children => {
    if (!(Menu as any).MenuItem) return;

    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return;

    const id = "always-translate-textarea";
    if (hasMenuItem(children, id)) return;

    const guildId = getGuildIdForChannel(channelId);
    const recentUsers = getRecentChannelUsers(channelId);

    children.push(
        <Menu.MenuItem id={id} label="AlwaysTranslate">
            <Menu.MenuItem
                id="always-translate-textarea-channel"
                label="Ajustes del canal…"
                action={() => openScopeEditor("channel", channelId)}
            />
            {guildId && (
                <Menu.MenuItem
                    id="always-translate-textarea-guild"
                    label="Ajustes del servidor…"
                    action={() => openScopeEditor("guild", guildId)}
                />
            )}
            {guildId && recentUsers.length > 0 && (
                <Menu.MenuItem id="always-translate-textarea-users" label="Ajustes de usuario…">
                    {recentUsers.map(user => (
                        <Menu.MenuItem
                            key={user.id}
                            id={`always-translate-textarea-user-${user.id}`}
                            label={user.name}
                            action={() => openScopeEditor("user", user.id)}
                        />
                    ))}
                </Menu.MenuItem>
            )}
            <Menu.MenuItem
                id="always-translate-textarea-open"
                label="Abrir ajustes completos…"
                action={() => openPluginModal(plugins.AlwaysTranslate)}
            />
        </Menu.MenuItem>
    );

    Logger.debug("Menu", "textarea item added", { channelId, guildId, users: recentUsers.length });
};

export let pluginStarted = false;

let translatingActiveCount = 0;
let lifecycleGeneration = 0;

export default definePlugin({
    name: "AlwaysTranslate",
    description: "Real-time message translation (Google, Gemini, DeepSeek, DeepL) with per-server, per-channel and per-user overrides.",
    authors: [{ name: "komi-juru", id: 682762388143210549n }],
    github: "https://github.com/komi-juru/AlwaysTranslate",
    settings,

    // 🔄 Lifecycle 🔄

    async start() {
        const generation = ++lifecycleGeneration;

        initDebugLog();
        Logger.info("Lifecycle", "Plugin starting", {
            debugLog: settings.store.debugLog,
            engine: settings.store.translationEngine,
            targetLang: settings.store.targetLang,
        });

        Logger.info("Menu", "registered components", Object.fromEntries(
            ["Menu", "MenuItem", "MenuGroup", "MenuSeparator", "MenuCheckboxItem", "MenuRadioItem"]
                .map(key => [key, typeof (Menu as any)[key]])
        ));

        resetTranslationQueues();
        normalizeTranslationEngines();
        await Promise.all([TranslationCache.getInstance().init(), initSecrets()]);
        if (generation !== lifecycleGeneration) return;

        Logger.info("Lifecycle", "Plugin started", {
            cache: TranslationCache.getInstance().getTotalCount(),
        });

        pluginStarted = true;
        addGlobalContextMenuPatch(scopedMenuPatch);
        addContextMenuPatch("textarea-context", textareaMenuPatch);
        addMessageAccessory("AlwaysTranslate", props => <TranslationAccessory message={props.message} />, 0);
    },

    stop() {
        lifecycleGeneration++;
        pluginStarted = false;
        removeGlobalContextMenuPatch(scopedMenuPatch);
        removeContextMenuPatch("textarea-context", textareaMenuPatch);
        TranslationCache.getInstance().flush();
        resetTranslationQueues();
        removeMessageAccessory("AlwaysTranslate");

        // Restore any hidden original messages
        document.querySelectorAll('[id^="message-content-"]').forEach(el => {
            (el as HTMLElement).style.display = "";
        });

        // Force remove leftover translation UIs
        document.querySelectorAll(".bat-translation").forEach(el => el.remove());
    },

    // 🛠️ Header Bar Patch 🛠️

    patches: [
        {
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(trailing:.{0,50}?)\i\.Fragment,(?=\{children:\[)/,
                replace: "$1$self.TrailingWrapper,",
            },
        },
    ],

    TrailingWrapper({ children }: any) {
        return (
            <>
                <TranslateHeaderButton />
                {children}
            </>
        );
    },

    // 📤 Outgoing Message Translation 📤

    async onBeforeMessageSend(channelId: string, message: any) {
        if (!pluginStarted) return;
        if (!message.content) return;

        const resolved = resolveConfig({
            channelId,
            guildId: getGuildIdForChannel(channelId)
        });

        Logger.debug("Outgoing", "resolved config", {
            channelId,
            enabled: resolved.enabled,
            outgoing: resolved.outgoing,
            engine: resolved.engine,
            sourceLang: resolved.sourceLang,
            targetLang: resolved.targetLang,
            scope: resolved.scope,
        });

        if (!resolved.enabled || !resolved.outgoing) {
            Logger.debug("Outgoing", "skipped", !resolved.enabled ? "translation disabled for this scope" : "outgoing translation disabled");
            return;
        }

        const { ignorePrefix } = settings.store;
        if (ignorePrefix && message.content.startsWith(ignorePrefix)) {
            Logger.debug("Outgoing", "skipped: ignore prefix", ignorePrefix);
            message.content = message.content.slice(ignorePrefix.length);
            return;
        }

        const apiKeys = getApiKeys();

        // Outgoing target: explicit outgoing language, else the scope source,
        // else the language the channel is actually written in.
        let targetLang: string = resolved.outgoingLang;
        if (targetLang === "auto") targetLang = resolved.sourceLang;
        if (targetLang === "auto") {
            targetLang = getDetectedLanguage(channelId)
                ?? await detectChannelLanguage(channelId)
                ?? resolved.targetLang;
        }

        if (targetLang === "auto") {
            targetLang = document.documentElement.lang.split("-")[0] || "en";
        }

        // Logical Error Prevention:
        // If the final target language for this outgoing message is the user's own client language,
        // it means we are trying to translate from Native -> Native (e.g. Korean -> Korean).
        // This happens if the channel's language is "auto" and we don't know the foreigner's language.
        const clientLang = document.documentElement.lang.split("-")[0] || "en";
        if (targetLang === clientLang) {
            Logger.debug("Outgoing", "skipped: target equals client language", { targetLang, clientLang });
            return;
        }

        const currentEngine = resolved.engine;
        const customPrompt = resolved.outgoingPrompt.trim();

        Logger.debug("Outgoing", "translating", {
            channelId,
            engine: currentEngine,
            targetLang,
            chars: message.content.length,
            prompt: customPrompt || "(none)",
        });




        translatingActiveCount++;
        if (translatingActiveCount === 1) {
            document.body.classList.add("bat-translating-active");
        }

        try {
            const result = await safeTranslate(
                message.content,
                "auto",
                targetLang,
                currentEngine,
                apiKeys,
                channelId,
                undefined,
                customPrompt,
                true
            );

            if (result) {
                Logger.debug("Outgoing", "translated", { chars: result.length, preview: preview(result) });
                TranslationCache.getInstance().setOutgoing(channelId, result, message.content);

                if (settings.store.previewOutgoing) {
                    message.content = "";
                    message.invalid = true;
                    // Use a slight delay to ensure Discord has cleared the chatbox after the Enter keypress
                    setTimeout(() => {
                        ComponentDispatch.dispatchToLastSubscribed("TEXTAREA_FOCUS");
                        ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { rawText: result, plainText: result });
                    }, 50);
                } else {
                    message.content = result;
                }
            } else {
                Logger.debug("Outgoing", "no translation produced (same language, skipped or failed)");
            }
        } catch (e) {
            Logger.error("Outgoing", "translation failed", e);
        } finally {
            translatingActiveCount--;
            if (translatingActiveCount === 0) {
                document.body.classList.remove("bat-translating-active");
            }
        }
    },
});
