"use client";

import NextLink from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { useRouteTransition } from "./route-transition";

/** Keep native links, prefetch, modified clicks and SSR; coordinate local navigation. */
export const TransitionLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(
  function TransitionLink({ href, onNavigate, replace, ...props }, ref) {
    const { navigate } = useRouteTransition();
    return <NextLink {...props} href={href} ref={ref} replace={replace} onNavigate={event => {
      if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) {
        onNavigate?.(event);
        return;
      }
      onNavigate?.(event);
      event.preventDefault();
      void navigate(href, { replace });
    }} />;
  }
);
