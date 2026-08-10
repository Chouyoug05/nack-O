import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

function isLegacyBrowser(): boolean {
  return typeof window !== "undefined" && (window as any).__NACK_LEGACY_BROWSER__ === true;
}

/* ==========================================================================
   Mode LEGACY (iPad 3 / iOS 9) :
   Remplace le popover Radix (portal + FocusScope + positionner + animations)
   par un <div> en position:fixed calculé depuis le trigger.
   Pas de portail, pas de piège à focus, pas d'animations.
   ========================================================================== */

type LegacyPopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  registerTrigger: (el: HTMLElement | null) => void;
  getTrigger: () => HTMLElement | null;
};

const LegacyPopoverContext = React.createContext<LegacyPopoverContextValue | null>(null);

function useLegacyPopover(): LegacyPopoverContextValue {
  const ctx = React.useContext(LegacyPopoverContext);
  if (!ctx) throw new Error("useLegacyPopover must be used within <Popover>");
  return ctx;
}

function LegacyPopoverRoot({
  children,
  open,
  defaultOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState<boolean>(defaultOpen ?? false);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? !!open : internalOpen;

  const setOpen = React.useCallback(
    (v: boolean) => {
      if (isControlled) onOpenChange?.(v);
      else setInternalOpen(v);
    },
    [isControlled, onOpenChange],
  );

  const registerTrigger = React.useCallback((el: HTMLElement | null) => {
    triggerRef.current = el;
  }, []);

  const getTrigger = React.useCallback(() => triggerRef.current, []);

  const ctx = React.useMemo<LegacyPopoverContextValue>(
    () => ({ open: isOpen, setOpen, registerTrigger, getTrigger }),
    [isOpen, setOpen, registerTrigger, getTrigger],
  );

  return <LegacyPopoverContext.Provider value={ctx}>{children}</LegacyPopoverContext.Provider>;
}

const Popover = ({ children, open, defaultOpen, onOpenChange, ...props }: PopoverPrimitive.PopoverProps) => {
  if (isLegacyBrowser()) {
    return (
      <LegacyPopoverRoot open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        {children}
      </LegacyPopoverRoot>
    );
  }
  return (
    <PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} {...props}>
      {children}
    </PopoverPrimitive.Root>
  );
};

const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ asChild, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { open, setOpen, registerTrigger } = useLegacyPopover();
    const handleClick = (e: React.MouseEvent) => {
      registerTrigger(e.currentTarget as HTMLElement);
      setOpen(!open);
    };
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        onClick: (e: React.MouseEvent) => {
          const childOnClick = (children.props as Record<string, unknown>).onClick as
            | ((ev: React.MouseEvent) => void)
            | undefined;
          if (childOnClick) childOnClick(e);
          handleClick(e);
        },
      });
    }
    return (
      <button type="button" ref={ref} {...props} onClick={handleClick}>
        {children}
      </button>
    );
  }
  return (
    <PopoverPrimitive.Trigger ref={ref} asChild={asChild} {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  );
});
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;

type ContentPosition = { top: number; left: number };

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { open, setOpen, getTrigger } = useLegacyPopover();
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = React.useState<ContentPosition | null>(null);

    React.useLayoutEffect(() => {
      if (!open) return;
      const el = contentRef.current;
      const trigger = getTrigger();
      if (!el || !trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const width = el.getBoundingClientRect().width || 320;
      const mw = window.innerWidth;
      const top = Math.min(triggerRect.bottom + sideOffset, mw - 8);
      let left: number;
      if (align === "end") left = triggerRect.right - width;
      else if (align === "start") left = triggerRect.left;
      else left = triggerRect.left + (triggerRect.width - width) / 2;
      left = Math.max(8, Math.min(left, mw - width - 8));
      setPos({ top, left });
    }, [open, align, sideOffset, getTrigger]);

    React.useLayoutEffect(() => {
      if (!open) return;
      const handler = (e: Event) => {
        const t = e.target as Node;
        if (contentRef.current && contentRef.current.contains(t)) return;
        const trigger = getTrigger();
        if (trigger && trigger.contains(t)) return;
        setOpen(false);
      };
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler);
      return () => {
        document.removeEventListener("mousedown", handler);
        document.removeEventListener("touchstart", handler);
      };
    }, [open, setOpen, getTrigger]);

    if (!open) return null;

    return (
      <div
        ref={(node) => {
          contentRef.current = node;
          if (typeof ref === "function") ref(node as never);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        {...props}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
          className,
        )}
        style={pos ? { position: "fixed", top: pos.top, left: pos.left } : undefined}
      >
        {children}
      </div>
    );
  }
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
