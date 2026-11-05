/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button as VencordButton, type ButtonProps } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";

/**
 * Recent Vencord versions no longer re-export Discord's old design system components
 * (Forms, Button, Toasts) from @webpack/common. This shim keeps the plugin markup
 * unchanged while rendering Vencord's own components instead.
 */

const Sizes = {
    SMALL: "small",
    MEDIUM: "medium",
    MIN: "min",
    XS: "xs",
    NONE: "none",
} as const;

const Colors = {
    PRIMARY: "primary",
    BRAND: "primary",
    GREEN: "positive",
    RED: "dangerPrimary",
    LINK: "link",
    TRANSPARENT: "none",
} as const;

const Looks = {
    FILLED: "filled",
    OUTLINED: "outlined",
    BLANK: "blank",
    LINK: "link",
} as const;

const variantMap: Record<string, ButtonProps["variant"]> = {
    primary: "primary",
    brand: "primary",
    green: "positive",
    positive: "positive",
    red: "dangerPrimary",
    dangerPrimary: "dangerPrimary",
    link: "link",
    none: "none",
};

type LegacyButtonProps = Omit<ButtonProps, "variant"> & {
    color?: string;
    look?: string;
};

function ButtonImpl({ color, look: _look, size, ...rest }: LegacyButtonProps) {
    return (
        <VencordButton
            variant={variantMap[color ?? "primary"] ?? "primary"}
            size={(size as ButtonProps["size"]) ?? "medium"}
            {...rest}
        />
    );
}

export const Button = Object.assign(ButtonImpl, { Sizes, Colors, Looks });

export const Forms = {
    FormTitle: (props: any) => <Heading tag={props.tag ?? "h5"} {...props} />,
    FormText: (props: any) => <Paragraph {...props} />,
};
