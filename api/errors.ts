/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const TRANSLATION_TIMEOUT_MS = 20_000;

export function describeApiError(status: number | null, code: string | null, message: string): string {
    const text = message.toLowerCase();
    if (/timeout|timed out|time limit/.test(text)) return "La traducción tardó demasiado (20 s)";
    if (/api key.*missing|missing api key/.test(text)) return "Falta la clave de API";
    if (code === "API_KEY_INVALID" || /api.?key.*(?:invalid|not valid)|invalid.*api.?key|invalid auth/.test(text) || status === 401) return "Clave de API no válida";
    if (status === 403) return "Acceso denegado: revisa permisos o región";
    if (status === 402) return "Saldo de API insuficiente";
    if (status === 404) return "Modelo o endpoint no encontrado";
    if (status === 456 || /quota exceeded|daily|per day/.test(text)) return "Cuota de API agotada";
    if (status === 429 || code === "RESOURCE_EXHAUSTED" || /rate limit|too many requests/.test(text)) return "Límite de peticiones alcanzado";
    if (status !== null && status >= 500) return "Servidor de la API no disponible";
    if (status === -1 || /network|fetch failed|enotfound|econnreset|failed to fetch/.test(text)) return "Fallo de conexión de red";
    if (/safety|blocked/.test(text)) return "Traducción bloqueada por el filtro de contenido";
    if (/empty response|missing content/.test(text)) return "La API no devolvió traducción";
    if (/parse|invalid response|json/.test(text)) return "Respuesta de API no válida";
    if (status === 400 || status === 422) return "Petición no válida: revisa modelo e idioma";
    if (/abort|cancel/.test(text)) return "Traducción cancelada";
    return status ? `API request failed (HTTP ${status})` : "La traducción falló";
}

export function httpError(status: number, raw: string) {
    let code: string | null = null;
    let message = raw;
    try {
        const body = JSON.parse(raw);
        message = body.error?.message ?? body.message ?? raw;
        code = body.error?.details?.find((detail: { reason?: string }) => detail.reason)?.reason ?? body.error?.code ?? null;
    } catch { }

    return Object.assign(new Error(describeApiError(status, code, message)), {
        status,
        code,
        detail: message && message !== raw ? message : undefined,
    });
}
