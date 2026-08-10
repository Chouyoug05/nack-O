import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

function isLegacyBrowser(): boolean {
  return typeof window !== "undefined" && (window as any).__NACK_LEGACY_BROWSER__ === true;
}

/* ==========================================================================
   Mode LEGACY (iPad 3 / iOS 9) :
   Remplace le menu Radix (portal + FocusScope + positionner + animations)
   par un <div> en position:fixed calculé depuis le trigger.
   Pas de portail, pas de piège à focus, pas d'animations.
   ========================================================================== */

type LegacyDropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  registerTrigger: (el: HTMLElement | null) => void;
  getTrigger: () => HTMLElement | null;
};

const LegacyDropdownContext = React.createContext<LegacyDropdownContextValue | null>(null);

function useLegacyDropdown(): LegacyDropdownContextValue {
  const ctx = React.useContext(LegacyDropdownContext);
  if (!ctx) throw new Error("useLegacyDropdown must be used within <DropdownMenu>");
  return ctx;
}

function LegacyDropdownRoot({
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

  const ctx = React.useMemo<LegacyDropdownContextValue>(
    () => ({ open: isOpen, setOpen, registerTrigger, getTrigger }),
    [isOpen, setOpen, registerTrigger, getTrigger],
  );

  return <LegacyDropdownContext.Provider value={ctx}>{children}</LegacyDropdownContext.Provider>;
}

const DropdownMenu = ({ children, open, defaultOpen, onOpenChange, ...props }: DropdownMenuPrimitive.DropdownMenuProps) => {
  if (isLegacyBrowser()) {
    return (
      <LegacyDropdownRoot open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        {children}
      </LegacyDropdownRoot>
    );
  }
  return (
    <DropdownMenuPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} {...props}>
      {children}
    </DropdownMenuPrimitive.Root>
  );
};

const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ asChild, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { open, setOpen, registerTrigger } = useLegacyDropdown();
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
    <DropdownMenuPrimitive.Trigger ref={ref} asChild={asChild} {...props}>
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
});
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;

const DropdownMenuGroup = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Group>
>(({ children, ...props }, ref) => {
  if (isLegacyBrowser()) return <>{children}</>;
  return (
    <DropdownMenuPrimitive.Group ref={ref} {...props}>
      {children}
    </DropdownMenuPrimitive.Group>
  );
});
DropdownMenuGroup.displayName = DropdownMenuPrimitive.Group.displayName;

const DropdownMenuPortal = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Portal>) => {
  if (isLegacyBrowser()) return <>{children}</>;
  return <DropdownMenuPrimitive.Portal {...props}>{children}</DropdownMenuPrimitive.Portal>;
};
DropdownMenuPortal.displayName = DropdownMenuPrimitive.Portal.displayName;

const DropdownMenuSub = ({ children, ...props }: DropdownMenuPrimitive.DropdownMenuSubProps) => {
  if (isLegacyBrowser()) return <>{children}</>;
  return <DropdownMenuPrimitive.Sub {...props}>{children}</DropdownMenuPrimitive.Sub>;
};

const DropdownMenuRadioGroup = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioGroup>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioGroup>
>(({ children, ...props }, ref) => {
  if (isLegacyBrowser()) return <>{children}</>;
  return (
    <DropdownMenuPrimitive.RadioGroup ref={ref} {...props}>
      {children}
    </DropdownMenuPrimitive.RadioGroup>
  );
});
DropdownMenuRadioGroup.displayName = DropdownMenuPrimitive.RadioGroup.displayName;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    return (
      <button
        type="button"
        ref={ref}
        className={cn(
          "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
          inset && "pl-8",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronRight className="ml-auto h-4 w-4" />
      </button>
    );
  }
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[state=open]:bg-accent focus:bg-accent",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) return null;
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  );
});
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

type ContentPosition = { top: number; left?: number; right?: number };

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, align = "center", children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { open, setOpen, getTrigger } = useLegacyDropdown();
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = React.useState<ContentPosition | null>(null);

    React.useLayoutEffect(() => {
      if (!open) return;
      const el = contentRef.current;
      const trigger = getTrigger();
      if (!el || !trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const width = el.getBoundingClientRect().width || 224;
      const mw = window.innerWidth;
      const top = Math.min(triggerRect.bottom + sideOffset, mw - 8);
      if (align === "end") {
        const left = Math.max(8, Math.min(triggerRect.right - width, mw - width - 8));
        setPos({ top, left });
      } else {
        const left = Math.max(8, Math.min(triggerRect.left, mw - width - 8));
        setPos({ top, left });
      }
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
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          className,
        )}
        style={pos ? { position: "fixed", top: pos.top, left: pos.left } : undefined}
      >
        {children}
      </div>
    );
  }
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, onClick, disabled, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setOpen } = useLegacyDropdown();
    return (
      <div
        role="menuitem"
        ref={ref}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
          inset && "pl-8",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
          setOpen(false);
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      disabled={disabled}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, onCheckedChange, disabled, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setOpen } = useLegacyDropdown();
    return (
      <div
        role="menuitemcheckbox"
        aria-checked={!!checked}
        ref={ref}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onClick={(e) => {
          if (disabled) return;
          onCheckedChange?.(!checked);
          setOpen(false);
        }}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {checked && <Check className="h-4 w-4" />}
        </span>
        {children}
      </div>
    );
  }
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      disabled={disabled}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, checked, onCheckedChange, disabled, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setOpen } = useLegacyDropdown();
    return (
      <div
        role="menuitemradio"
        aria-checked={!!checked}
        ref={ref}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onClick={(e) => {
          if (disabled) return;
          onCheckedChange?.(!checked);
          setOpen(false);
        }}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {checked && <Circle className="h-2 w-2 fill-current" />}
        </span>
        {children}
      </div>
    );
  }
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      checked={checked}
      disabled={disabled}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="h-2 w-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => {
  if (isLegacyBrowser()) {
    return <div ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />;
  }
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) {
    return <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
  }
  return <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
});
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />;
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
