declare module "react-simple-maps" {
  import type { ComponentType, ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

  export type RsmGeography = {
    rsmKey: string;
    svgPath?: string;
    properties: {
      name: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  export type GeographyStyle = {
    default?: CSSProperties;
    hover?: CSSProperties;
    pressed?: CSSProperties;
  };

  export const ComposableMap: ComponentType<{
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    className?: string;
    children?: ReactNode;
  }>;

  export const Geographies: ComponentType<{
    geography: unknown;
    children: (props: { geographies: RsmGeography[] }) => ReactNode;
  }>;

  export const Geography: ComponentType<{
    geography: RsmGeography;
    title?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: GeographyStyle;
  } & Omit<ComponentPropsWithoutRef<"path">, "style">>;
}
