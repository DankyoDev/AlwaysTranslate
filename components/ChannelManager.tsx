/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Divider } from "@components/Divider";
import { ChannelStore, GuildStore, SearchableSelect, TextInput, UserStore, useState, useStateFromStores } from "@webpack/common";

import { GLOBAL_ENGINE_OPTIONS, LANGUAGES } from "../constants";
import { addChannel, clearGuildScope, clearUserScope, removeChannel, type ScopeConfig,settings, updateGuildScope, updateUserScope } from "../settings";
import { readScope, type ScopeTarget } from "../utils/scopes";
import { Button, Forms } from "./LegacyWebpack";
import { openScopeEditor } from "./ScopeEditor";

const langLabel = (value: string) => LANGUAGES.find(l => l.value === value)?.label ?? value;

function summarize(scope: ScopeConfig): string {
    const parts: string[] = [];

    if (scope.enabled !== undefined) parts.push(scope.enabled ? "on" : "off");
    if (scope.targetLang !== undefined) parts.push(`yo: ${langLabel(scope.targetLang)}`);
    if (scope.sourceLang !== undefined) parts.push(`ellos: ${langLabel(scope.sourceLang)}`);
    if (scope.engine !== undefined) parts.push(GLOBAL_ENGINE_OPTIONS.find(o => o.value === scope.engine)?.label ?? scope.engine);
    if (scope.outgoingLang !== undefined) parts.push(`salida: ${langLabel(scope.outgoingLang)}`);
    if (scope.outgoing !== undefined) parts.push(`saliente ${scope.outgoing ? "sí" : "no"}`);

    return parts.join(" · ");
}

function OverrideRow({ name, target, onRemove }: { name: string; target: ScopeTarget; onRemove(): void; }) {
    const summary = summarize(readScope(target));

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--background-modifier-accent)" }}>
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-normal)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {summary || "Override vacío"}
                </div>
            </div>
            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => openScopeEditor(target.kind === "guild" ? "guild" : target.kind === "channel" ? "channel" : "user", target.id)}>
                Editar
            </Button>
            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={onRemove}>
                Quitar
            </Button>
        </div>
    );
}

function channelName(id: string): string {
    try {
        const channel = ChannelStore.getChannel?.(id);
        if (channel?.name) return channel.guild_id ? `#${channel.name}` : channel.name;
    } catch { }

    return id;
}

function guildName(id: string): string {
    try {
        return GuildStore.getGuild?.(id)?.name ?? id;
    } catch {
        return id;
    }
}

function userName(id: string): string {
    try {
        const user = UserStore.getUser?.(id);
        return user?.globalName || user?.username || id;
    } catch {
        return id;
    }
}

export function ChannelManager() {
    const {
        channelList = [],
        guildOverrides = {},
        userOverrides = {},
    } = settings.use(["channelList", "guildOverrides", "userOverrides"]);

    const [selectedChannel, setSelectedChannel] = useState<string | undefined>();

    const channelOptions = useStateFromStores([GuildStore, ChannelStore], () => {
        const options: Array<{ label: string; value: string; }> = [];
        const seen = new Set<string>();

        try {
            const guilds = GuildStore?.getGuilds?.() ?? {};
            for (const guildId in guilds) {
                const guild = guilds[guildId];
                const guildChannels = ChannelStore.getMutableGuildChannelsForGuild?.(guildId) ?? {};

                for (const id in guildChannels) {
                    const channel = guildChannels[id];
                    // 0: text, 5: announcement, 11/12: threads
                    if (![0, 5, 11, 12].includes(channel.type) || seen.has(channel.id)) continue;

                    seen.add(channel.id);
                    options.push({ label: `#${channel.name} (${guild.name})`, value: channel.id });
                }
            }

            for (const channel of ChannelStore.getSortedPrivateChannels?.() ?? []) {
                if (!channel?.id || seen.has(channel.id)) continue;

                seen.add(channel.id);
                options.push({ label: `${channel.name ?? channel.id} (DM)`, value: channel.id });
            }
        } catch (e) {
            console.error("[AlwaysTranslate] Channel picker error:", e);
        }

        return options.sort((a, b) => a.label.localeCompare(b.label));
    });

    const guildIds = Object.keys(guildOverrides);
    const userIds = Object.keys(userOverrides);

    return (
        <section aria-label="Overrides de traducción">
            <Forms.FormTitle>Overrides de canal</Forms.FormTitle>
            <Forms.FormText>
                Activa/desactiva por canal, tu idioma, su idioma y el motor. Vacío significa que hereda del servidor.
            </Forms.FormText>

            <div style={{ margin: "8px 0" }}>
                <SearchableSelect
                    options={channelOptions.filter(o => !channelList.some(c => c.id === o.value))}
                    value={selectedChannel}
                    onChange={(value: string) => {
                        if (!value) return;
                        addChannel(value, "auto", { enabled: true });
                        setSelectedChannel(undefined);
                    }}
                    placeholder="Añadir override de canal…"
                    closeOnSelect
                    maxVisibleItems={8}
                />
            </div>

            {channelList.length === 0
                ? <Forms.FormText>Todavía no hay overrides de canal.</Forms.FormText>
                : channelList.map(channel => (
                    <OverrideRow
                        key={channel.id}
                        name={channelName(channel.id)}
                        target={{ kind: "channel", id: channel.id }}
                        onRemove={() => removeChannel(channel.id)}
                    />
                ))}

            <Divider style={{ margin: "16px 0" }} />

            <Forms.FormTitle>Overrides de servidor</Forms.FormTitle>
            <Forms.FormText>
                Añade uno con el ID del servidor o haz clic derecho en un servidor → «AlwaysTranslate: ajustes del servidor…».
            </Forms.FormText>

            <IdAdder
                label="Añadir servidor"
                placeholder="ID del servidor"
                onAdd={id => updateGuildScope(id, { enabled: true })}
            />

            {guildIds.length === 0
                ? <Forms.FormText>Todavía no hay overrides de servidor.</Forms.FormText>
                : guildIds.map(id => (
                    <OverrideRow
                        key={id}
                        name={guildName(id)}
                        target={{ kind: "guild", id }}
                        onRemove={() => clearGuildScope(id)}
                    />
                ))}

            <Divider style={{ margin: "16px 0" }} />

            <Forms.FormTitle>Overrides de usuario</Forms.FormTitle>
            <Forms.FormText>
                Los overrides de usuario mandan sobre canal y servidor. Añade uno con el ID del usuario o haz clic derecho en un usuario.
            </Forms.FormText>

            <IdAdder
                label="Añadir usuario"
                placeholder="ID del usuario"
                onAdd={id => {
                    updateUserScope(id, "guild", { enabled: true });
                    updateUserScope(id, "dm", { enabled: true });
                }}
            />

            {userIds.length === 0
                ? <Forms.FormText>Todavía no hay overrides de usuario.</Forms.FormText>
                : userIds.map(id => (
                    <OverrideRow
                        key={id}
                        name={userName(id)}
                        target={{ kind: "user-guild", id }}
                        onRemove={() => {
                            clearUserScope(id, "guild");
                            clearUserScope(id, "dm");
                        }}
                    />
                ))}
        </section>
    );
}

function IdAdder({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd(id: string): void; }) {
    const [value, setValue] = useState("");

    return (
        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <TextInput value={value} onChange={setValue} placeholder={placeholder} />
            </div>
            <Button
                size={Button.Sizes.SMALL}
                color={Button.Colors.PRIMARY}
                disabled={!value.trim()}
                onClick={() => {
                    onAdd(value.trim());
                    setValue("");
                }}
            >
                {label}
            </Button>
        </div>
    );
}
