/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Menu, Popout, useRef, useState } from "@webpack/common";

export interface DropdownOption {
    label: string;
    value: string;
}

/**
 * Small self-contained dropdown built on Vencord's Popout + Menu, so it does not
 * depend on Discord's Select API and always reflects the current value.
 */
export function Dropdown({ options, value, onChange }: {
    options: DropdownOption[];
    value: string;
    onChange(value: string): void;
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const current = options.find(option => option.value === value);

    return (
        <Popout
            position="bottom"
            align="left"
            shouldShow={open}
            onRequestClose={() => setOpen(false)}
            targetElementRef={triggerRef}
            renderPopout={() => (
                <div style={{ maxHeight: 320, overflowY: "auto", minWidth: 240 }}>
                    <Menu.Menu navId="always-translate-dropdown" onClose={() => setOpen(false)}>
                        {options.map(option => (
                            <Menu.MenuRadioItem
                                key={option.value}
                                id={`at-dropdown-${option.value}`}
                                group="always-translate-dropdown"
                                label={option.label}
                                checked={option.value === value}
                                action={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                            />
                        ))}
                    </Menu.Menu>
                </div>
            )}
        >
            {() => (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        borderRadius: 4,
                        border: "1px solid var(--background-modifier-accent)",
                        background: "var(--background-secondary)",
                        color: "var(--text-normal)",
                        cursor: "pointer",
                        fontSize: 14,
                        textAlign: "left",
                    }}
                >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {current?.label ?? value}
                    </span>
                    <span style={{ opacity: 0.6 }}>▾</span>
                </button>
            )}
        </Popout>
    );
}
