/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";
import { useEffect, useState } from "@webpack/common";

import { settings } from "../settings";
import { Logger } from "./logger";

export type SecretName = "gemini" | "deepseek" | "deepl";

const Native = VencordNative.pluginHelpers.AlwaysTranslate as PluginNative<typeof import("../native")>;

const secrets: Record<SecretName, string> = { gemini: "", deepseek: "", deepl: "" };
const listeners = new Set<() => void>();
const saveTimers: Partial<Record<SecretName, number>> = {};

let available = false;
let initialised = false;

function notify() {
    listeners.forEach(listener => listener());
}

function nativeSupportsSecrets(): boolean {
    return typeof Native?.batSecretAvailable === "function";
}

/** Whether the OS keychain (safeStorage) is usable. */
export function isSecretStorageAvailable() {
    return available;
}

export function getSecret(name: SecretName) {
    return secrets[name] ?? "";
}

export function getApiKeys() {
    return {
        gemini: secrets.gemini,
        deepseek: secrets.deepseek,
        deepl: secrets.deepl,
    };
}

export function onSecretsChange(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Re-renders the component when a secret changes. */
export function useApiKeys() {
    const [, forceRender] = useState(0);

    useEffect(() => onSecretsChange(() => forceRender(v => v + 1)), []);

    return getApiKeys();
}

export async function setSecret(name: SecretName, value: string) {
    secrets[name] = value.trim();
    notify();

    if (!nativeSupportsSecrets()) return;

    // Debounce disk writes while the user is still typing
    if (saveTimers[name]) clearTimeout(saveTimers[name]);

    saveTimers[name] = window.setTimeout(() => {
        delete saveTimers[name];

        Native.batSecretSet(name, secrets[name])
            .catch(e => Logger.error("Secrets", `Failed to store ${name} key`, e));
    }, 500);
}

function loadLegacySecrets() {
    secrets.gemini = settings.store.geminiApiKey ?? "";
    secrets.deepseek = settings.store.deepseekApiKey ?? "";
    secrets.deepl = settings.store.deeplApiKey ?? "";
}

/**
 * Loads the encrypted API keys and migrates any plaintext key left in settings
 * by older versions. Must run before any translation starts.
 */
export async function initSecrets() {
    if (initialised) return;
    initialised = true;

    if (!nativeSupportsSecrets()) {
        Logger.warn(
            "Secrets",
            "Native secret storage is not registered yet. Restart Discord so the new native code is loaded. "
            + "Using plaintext settings in the meantime."
        );
        loadLegacySecrets();
        return;
    }

    available = await Native.batSecretAvailable().catch(() => false);
    if (!available) {
        Logger.warn("Secrets", "OS encryption is unavailable, API keys will only be kept in memory.");
        loadLegacySecrets();
        return;
    }

    Logger.info("Secrets", "secure storage available", { available: true });

    for (const name of ["gemini", "deepseek", "deepl"] as const) {
        secrets[name] = await Native.batSecretGet(name).catch(() => "");
    }

    // Migrate plaintext keys from older versions
    const legacy: Array<[SecretName, string | undefined]> = [
        ["gemini", settings.store.geminiApiKey],
        ["deepseek", settings.store.deepseekApiKey],
        ["deepl", settings.store.deeplApiKey],
    ];

    let migrated = false;

    for (const [name, value] of legacy) {
        if (!value?.trim()) continue;

        if (!secrets[name]) await setSecret(name, value);
        migrated = true;
    }

    if (migrated) {
        settings.store.geminiApiKey = "";
        settings.store.deepseekApiKey = "";
        settings.store.deeplApiKey = "";
        Logger.info("Secrets", "Migrated plaintext API keys to encrypted storage");
    }

    Logger.info("Secrets", "loaded", {
        keys: (["gemini", "deepseek", "deepl"] as const).filter(name => !!secrets[name]),
    });

    notify();
}
