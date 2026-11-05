/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { plugins } from "@api/PluginManager";
import { openPluginModal } from "@components/settings";
import { findComponentByCodeLazy } from "@webpack";
import { Menu, Popout, SelectedChannelStore, useRef, useState, useStateFromStores } from "@webpack/common";

import { reScheduleAllWorkers } from "../api/translate";
import { deeplWorkers, geminiWorkers } from "../api/worker";
import { CHANNEL_ENGINE_OPTIONS, GLOBAL_ENGINE_OPTIONS, LANGUAGES } from "../constants";
import { addChannel, getGuildScope, settings, updateChannel, updateGuildScope } from "../settings";
import { triggerManualBatch } from "../utils/manual";
import { getGuildIdForChannel, resolveConfig } from "../utils/scopes";
import { getApiKeys } from "../utils/secrets";
import { showTranslationToast } from "../utils/toast";
import { DeepLIcon, DeepSeekIcon,GeminiIcon } from "./Icons";
import { openScopeEditor } from "./ScopeEditor";

const HeaderBarIconNative = findComponentByCodeLazy(
    ".HEADER_BAR_BADGE_BOTTOM,",
    'position:"bottom"'
);

export function TranslateIcon(props: any) {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" {...props}>
            <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
        </svg>
    );
}

export function TranslateHeaderButton() {
    const buttonRef = useRef(null);
    const [show, setShow] = useState(false);

    // Reactively update when channel changes
    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getChannelId());

    // Reactively update when settings change
    const {
        channelList = [],
        translationEngine = "google",
        translateOutgoing = false,
        hideOriginal = false,
        translationMode = "global",
        manualTranslationEngine = "google",
        APIEcoModeThreshold = 3,
        APIMaxBatchWait = 10
    } = settings.use(["channelList", "translationEngine", "translateOutgoing", "hideOriginal", "translationMode", "manualTranslationEngine", "APIEcoModeThreshold", "APIMaxBatchWait", "guildOverrides"]);


    const channelConfig = channelList.find(c => c.id === channelId);
    const isChannelListed = !!channelConfig;

    const guildId = getGuildIdForChannel(channelId);
    const guildScope = guildId ? getGuildScope(guildId) : undefined;
    const resolved = resolveConfig({ channelId, guildId, isDM: !guildId });

    const effectiveEngine = resolved.engine;
    const isActive = resolved.enabled;

    const triLabel = (value?: boolean) => value === undefined ? "Heredar" : value ? "Sí" : "No";

    const ActiveIcon = (props: any) => {
        if (!isActive) return <TranslateIcon {...props} />;

        if (effectiveEngine === "deepl") return <DeepLIcon {...props} />;
        if (effectiveEngine?.startsWith("deepseek")) return <DeepSeekIcon {...props} />;
        if (effectiveEngine?.startsWith("gemini")) return <GeminiIcon {...props} />;
        return <TranslateIcon {...props} />;
    };

    const renderMenu = () => {
        if (!channelId) return null;
        const engineLabel = (value: string) => value === "disable" ? "Desactivado" : GLOBAL_ENGINE_OPTIONS.find(o => o.value === value)?.label ?? value;
        const currentEngine = channelConfig?.engine || "default";
        const currentLanguage = channelConfig?.lang || "auto";
        const presets = [
            { name: "Tiempo real", threshold: 1, wait: 0 },
            { name: "Equilibrado", threshold: 3, wait: 10 },
            { name: "Económico", threshold: 10, wait: 30 },
            { name: "Dormido", threshold: 250, wait: 0 }
        ];
        const selectedPreset = presets.find(p => p.threshold === APIEcoModeThreshold && p.wait === APIMaxBatchWait);
        return (
            <Menu.Menu navId="bat-translate-menu" onClose={() => setShow(false)} aria-label="Ajustes de AlwaysTranslate">
                <Menu.MenuGroup label="Este canal">
                    <Menu.MenuItem id="auto-engine-select" label={`Traducción automática: ${isActive ? engineLabel(effectiveEngine) : "Desactivado"}`}
                        subtext={!isChannelListed && translationMode !== "global" ? "Elige un motor para activarla." : "Desactivado conserva los ajustes del canal."}>
                        {CHANNEL_ENGINE_OPTIONS.map(opt => (
                            <Menu.MenuRadioItem key={opt.value} id={`engine-${opt.value}`} group="bat-auto-engine"
                                label={opt.value === "default" ? `Seguir predeterminado (${engineLabel(translationEngine)})` : engineLabel(opt.value)}
                                checked={!isChannelListed && translationMode !== "global" ? opt.value === "disable" : currentEngine === opt.value}
                                dontCloseOnActionIf={() => true}
                                action={() => {
                                    addChannel(channelId, "auto");
                                    updateChannel(channelId, { engine: opt.value === "default" ? undefined : opt.value });
                                }} />
                        ))}
                    </Menu.MenuItem>
                    <Menu.MenuItem id="lang-select" label={`Idioma del canal: ${LANGUAGES.find(l => l.value === currentLanguage)?.label ?? currentLanguage}`}
                        subtext="Su idioma. Auto: solo entrantes.">
                        {LANGUAGES.map(lang => (
                            <Menu.MenuRadioItem key={lang.value} id={`lang-${lang.value}`} group="bat-channel-language"
                                label={lang.label} checked={currentLanguage === lang.value} dontCloseOnActionIf={() => true}
                                action={() => {
                                    const exists = settings.store.channelList.some(c => c.id === channelId);
                                    addChannel(channelId, lang.value);
                                    // Keep excluded channels off when saving a language.
                                    updateChannel(channelId, { lang: lang.value,
                                        ...(!exists && settings.store.translationMode !== "global" ? { engine: "disable" } : {}) });
                                }} />
                        ))}
                    </Menu.MenuItem>
                    <Menu.MenuItem id="channel-translate" label={`Traducir este canal: ${triLabel(channelConfig?.enabled)}`}>
                        {[
                            { label: "Heredar", value: undefined },
                            { label: "Sí", value: true },
                            { label: "No", value: false },
                        ].map((opt, i) => (
                            <Menu.MenuRadioItem key={i} id={`channel-translate-${i}`} group="bat-channel-enabled"
                                label={opt.label} checked={channelConfig?.enabled === opt.value} dontCloseOnActionIf={() => true}
                                action={() => { addChannel(channelId, "auto"); updateChannel(channelId, { enabled: opt.value }); }} />
                        ))}
                    </Menu.MenuItem>
                    <Menu.MenuItem id="channel-scope-settings" label="Ajustes del canal…"
                        action={() => {
                            setShow(false);
                            openScopeEditor("channel", channelId, "Traducción del canal");
                        }} />
                </Menu.MenuGroup>
                <Menu.MenuSeparator />
                <Menu.MenuGroup label="Este servidor">
                    <Menu.MenuItem id="guild-translate" label={`Traducir este servidor: ${triLabel(guildScope?.enabled)}`} disabled={!guildId}>
                        {[
                            { label: "Heredar", value: undefined },
                            { label: "Sí", value: true },
                            { label: "No", value: false },
                        ].map((opt, i) => (
                            <Menu.MenuRadioItem key={i} id={`guild-translate-${i}`} group="bat-guild-enabled"
                                label={opt.label} checked={guildScope?.enabled === opt.value} dontCloseOnActionIf={() => true}
                                action={() => { if (guildId) updateGuildScope(guildId, { enabled: opt.value }); }} />
                        ))}
                    </Menu.MenuItem>
                    <Menu.MenuItem id="guild-scope-settings" label="Ajustes del servidor…" disabled={!guildId}
                        action={() => {
                            if (!guildId) return;
                            setShow(false);
                            openScopeEditor("guild", guildId, "Traducción del servidor");
                        }} />
                </Menu.MenuGroup>
                <Menu.MenuSeparator />
                <Menu.MenuGroup label="Todos los canales — ajustes compartidos">
                    <Menu.MenuItem id="translation-scope" label={`Ámbito automático: ${translationMode === "global" ? "Todos los canales" : "Solo canales seleccionados"}`} disabled />
                    <Menu.MenuItem id="manual-engine-select" label={`Motor del botón manual: ${engineLabel(manualTranslationEngine)}`}>
                        {GLOBAL_ENGINE_OPTIONS.map(opt => (
                            <Menu.MenuRadioItem key={opt.value} id={`manual-engine-${opt.value}`} group="bat-manual-engine"
                                label={engineLabel(opt.value)} checked={manualTranslationEngine === opt.value} dontCloseOnActionIf={() => true}
                                action={() => { settings.store.manualTranslationEngine = opt.value; }} />
                        ))}
                    </Menu.MenuItem>
                    <Menu.MenuItem id="eco-preset-select" label={`Cadencia de lotes: ${selectedPreset?.name ?? "Personalizado"}`}
                        subtext="Gemini y DeepSeek · Todos los canales">
                        {presets.map(preset => (
                            <Menu.MenuRadioItem key={preset.name} id={`preset-${preset.name.toLowerCase()}`} group="bat-batch-preset"
                                label={preset.name} subtext={`${preset.threshold} mensajes / ${preset.wait ? `hasta ${preset.wait}s` : "sin temporizador"}`}
                                checked={selectedPreset === preset} dontCloseOnActionIf={() => true}
                                action={() => {
                                    settings.store.APIEcoModeThreshold = preset.threshold;
                                    settings.store.APIMaxBatchWait = preset.wait;
                                    reScheduleAllWorkers();
                                }} />
                        ))}
                    </Menu.MenuItem>
                    <Menu.MenuCheckboxItem id="toggle-outgoing" label="Traducir mis mensajes salientes" checked={translateOutgoing}
                        dontCloseOnActionIf={() => true} action={() => { settings.store.translateOutgoing = !settings.store.translateOutgoing; }} />
                    <Menu.MenuCheckboxItem id="toggle-hide-original" label="Ocultar mensajes originales" checked={hideOriginal}
                        dontCloseOnActionIf={() => true} action={() => { settings.store.hideOriginal = !settings.store.hideOriginal; }} />
                </Menu.MenuGroup>
                <Menu.MenuSeparator />
                <Menu.MenuItem id="open-settings" label="Abrir ajustes completos" action={() => {
                    setShow(false);
                    openPluginModal(plugins.AlwaysTranslate);
                }} />
            </Menu.Menu>
        );
    };
    // If Vencord's ContextMenuAPI patch did not register the menu components,
    // fall back to opening the settings modal instead of rendering a broken menu.
    const menuAvailable = !!(Menu as any).MenuItem && !!(Menu as any).MenuGroup;

    if (!menuAvailable) {
        return (
            <HeaderBarIconNative
                tooltip="AlwaysTranslate (abre ajustes)"
                icon={ActiveIcon}
                onClick={() => openPluginModal(plugins.AlwaysTranslate)}
            />
        );
    }

    return (
        <Popout
            position="bottom"
            align="right"
            animation={Popout.Animation.NONE}
            shouldShow={show}
            onRequestClose={() => setShow(false)}
            targetElementRef={buttonRef}
            renderPopout={renderMenu}
        >
            {(_, { isShown }) => (
                <HeaderBarIconNative
                    ref={buttonRef}
                    onClick={() => setShow(v => !v)}
                    tooltip={isShown ? null : "AlwaysTranslate"}
                    icon={ActiveIcon}
                    selected={isShown}
                />
            )}
        </Popout>
    );
}

export const ManualBatchChatBarIcon: ChatBarButtonFactory = ({ isMainChat }) => {
    const { manualTranslationEngine = "google" } = settings.use(["manualTranslationEngine"]);

    if (!isMainChat || manualTranslationEngine === "disable") return null;

    const isGemini = manualTranslationEngine.startsWith("gemini");
    const isDeepSeek = manualTranslationEngine.startsWith("deepseek");
    const isDeepl = manualTranslationEngine === "deepl";
    const isGoogle = manualTranslationEngine === "google";

    const Icon = isGoogle ? TranslateIcon : isDeepSeek ? DeepSeekIcon : (isGemini ? GeminiIcon : DeepLIcon);
    const engineName = isGoogle ? "Google Translate" : isDeepSeek ? "DeepSeek" : (isGemini ? "Gemini" : "DeepL");

    return (
        <ChatBarButton
            buttonProps={{ className: "bat-gemini-chatbar-wrapper" }}
            tooltip="Traducir ahora"
            onClick={() => {
                const keys = getApiKeys();
                if (isGemini && !keys.gemini) {
                    showTranslationToast("Se necesita la clave de Gemini para la traducción manual. Configúrala en los ajustes de AlwaysTranslate.");
                    return;
                }
                if (isDeepSeek && !keys.deepseek) {
                    showTranslationToast("Se necesita la clave de DeepSeek para la traducción manual. Configúrala en los ajustes de AlwaysTranslate.");
                    return;
                }
                if (isDeepl && !keys.deepl) {
                    showTranslationToast("Se necesita la clave de DeepL para la traducción manual. Configúrala en los ajustes de AlwaysTranslate.");
                    return;
                }
                triggerManualBatch(isGemini || isDeepSeek);
                if (isGemini || isDeepSeek) {
                    geminiWorkers.forEach(w => w.flushNow());
                } else if (isDeepl) {
                    deeplWorkers.forEach(w => w.flushNow());
                }
            }}
        >
            <Icon width={24} height={24} className="bat-gemini-chatbar-icon" />
        </ChatBarButton>
    );
};
