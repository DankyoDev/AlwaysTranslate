/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app,IpcMainInvokeEvent,safeStorage,shell } from "electron";
import fs from "fs/promises";
import path from "path";

const requests = new Map<string, AbortController>();

// ─── Debug log file ───
// Only written when the "Debug log" setting is enabled; the renderer decides.
const LOG_FILE = () => path.join(app.getPath("userData"), "AlwaysTranslate.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024;

async function fileSize(file: string) {
    try {
        return (await fs.stat(file)).size;
    } catch {
        return 0;
    }
}

export async function batLogAppend(_: IpcMainInvokeEvent, text: string): Promise<boolean> {
    try {
        const file = LOG_FILE();

        // Rotate once the file gets too big
        if (await fileSize(file) > MAX_LOG_SIZE) {
            const rotated = `${file}.1`;
            await fs.rm(rotated, { force: true });
            await fs.rename(file, rotated).catch(() => { });
        }

        await fs.appendFile(file, text, "utf-8");
        return true;
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to write debug log", e);
        return false;
    }
}

export async function batLogClear(): Promise<boolean> {
    try {
        await fs.writeFile(LOG_FILE(), "", "utf-8");
        return true;
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to clear debug log", e);
        return false;
    }
}

export async function batLogOpen(): Promise<string> {
    return shell.openPath(LOG_FILE());
}

export async function batLogPath(): Promise<string> {
    return LOG_FILE();
}

// ─── Encrypted secret storage (API keys) ───
// Values are encrypted with the OS keychain (DPAPI on Windows) through Electron's safeStorage.
const SECRETS_FILE = () => path.join(app.getPath("userData"), "AlwaysTranslateSecrets.json");

async function readSecrets(): Promise<Record<string, string>> {
    try {
        return JSON.parse(await fs.readFile(SECRETS_FILE(), "utf-8"));
    } catch {
        return {};
    }
}

async function writeSecrets(data: Record<string, string>) {
    const file = SECRETS_FILE();
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 4), "utf-8");
    await fs.rename(tmp, file);
}

export function batSecretAvailable() {
    try {
        return safeStorage.isEncryptionAvailable();
    } catch {
        return false;
    }
}

export async function batSecretGet(_: IpcMainInvokeEvent, name: string): Promise<string> {
    if (!batSecretAvailable()) return "";

    try {
        const data = await readSecrets();
        const encoded = data[name];
        if (!encoded) return "";

        return safeStorage.decryptString(Buffer.from(encoded, "base64"));
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to read secret", name, e);
        return "";
    }
}

export async function batSecretSet(_: IpcMainInvokeEvent, name: string, value: string): Promise<boolean> {
    if (!batSecretAvailable()) return false;

    try {
        const data = await readSecrets();

        if (!value) delete data[name];
        else data[name] = safeStorage.encryptString(value).toString("base64");

        await writeSecrets(data);
        return true;
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to store secret", name, e);
        return false;
    }
}

async function translationFetch(event: IpcMainInvokeEvent, requestId: string, url: string, init: RequestInit, timeout: number) {
    const key = event.sender.id + ":" + requestId;
    const controller = new AbortController();
    requests.set(key, controller);
    const timer = setTimeout(() => controller.abort(), Math.min(timeout, 20_000));
    try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        return { ok: res.ok, status: res.status, data: await res.text() };
    } catch (e) {
        return { ok: false, status: -1, data: controller.signal.aborted ? "Translation timed out or cancelled" : "Network connection failed" };
    } finally {
        clearTimeout(timer);
        requests.delete(key);
    }
}

export async function batCancelRequest(event: IpcMainInvokeEvent, requestId: string) {
    requests.get(event.sender.id + ":" + requestId)?.abort();
}

export async function batDeeplFetch(event: IpcMainInvokeEvent, isFree: boolean, apiKey: string, payload: string, requestId: string) {
    const url = isFree
        ? "https://api-free.deepl.com/v2/translate"
        : "https://api.deepl.com/v2/translate";

    return translationFetch(event, requestId, url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `DeepL-Auth-Key ${apiKey}`
            },
            body: payload
        }, 30000);
}

export async function batDeeplUsageFetch(_: IpcMainInvokeEvent, isFree: boolean, apiKey: string) {
    const url = isFree
        ? "https://api-free.deepl.com/v2/usage"
        : "https://api.deepl.com/v2/usage";

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `DeepL-Auth-Key ${apiKey}`
            }
        });

        const text = await res.text();
        return { ok: res.ok, status: res.status, data: text };
    } catch (e) {
        return { ok: false, status: -1, data: String(e) };
    }
}

export async function batGeminiFetch(event: IpcMainInvokeEvent, apiUrl: string, apiKey: string, payload: string, requestId: string) {
    return translationFetch(event, requestId, `${apiUrl}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: payload
        }, 300000);
}

export async function batDeepSeekFetch(event: IpcMainInvokeEvent, apiUrl: string, apiKey: string, payload: string, requestId: string) {
    return translationFetch(event, requestId, apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: payload
        }, 300000);
}

export async function batDeepSeekBalanceFetch(_: IpcMainInvokeEvent, apiKey: string) {
    try {
        const res = await fetch("https://api.deepseek.com/user/balance", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json"
            }
        });

        const text = await res.text();
        return { ok: res.ok, status: res.status, data: text };
    } catch (e) {
        return { ok: false, status: -1, data: String(e) };
    }
}

export async function batCacheLoad(_: IpcMainInvokeEvent): Promise<string | null> {
    try {
        const cachePath = path.join(app.getPath("userData"), "AlwaysTranslateCache.json");
        return await fs.readFile(cachePath, "utf-8");
    } catch {
        return null;
    }
}

export async function batCacheSave(_: IpcMainInvokeEvent, data: string): Promise<boolean> {
    try {
        const cachePath = path.join(app.getPath("userData"), "AlwaysTranslateCache.json");
        await fs.writeFile(cachePath, data, "utf-8");
        return true;
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to save cache file:", e);
        return false;
    }
}

export async function batDictLoad(_: IpcMainInvokeEvent): Promise<string | null> {
    try {
        const dictPath = path.join(app.getPath("userData"), "AlwaysTranslateDict.json");
        return await fs.readFile(dictPath, "utf-8");
    } catch {
        return null;
    }
}

export async function batDictSave(_: IpcMainInvokeEvent, data: string): Promise<boolean> {
    try {
        const dictPath = path.join(app.getPath("userData"), "AlwaysTranslateDict.json");
        await fs.writeFile(dictPath, data, "utf-8");
        return true;
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to save dictionary file:", e);
        return false;
    }
}
