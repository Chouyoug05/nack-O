import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

function isLegacyBrowser(): boolean {
  return typeof window !== "undefined" && (window as any).__NACK_LEGACY_BROWSER__ === true;
}

/* ==========================================================================
   Mode LEGACY (iPad 3 / iOS 9) :
   Le Select Radix (portal + FocusScope + positionner + animations) est
   remplacé par un <select> natif. Sur iOS 9 le <select> natif ouvre le
   picker iOS (roulette), 100% compatible et zéro gel.
   Même API : les 8 fichiers consommateurs fonctionnent sans modification.
   ========================================================================== */

type LegacySelectItem = { value: string; label: string; disabled?: boolean };

type LegacySelectContextValue = {
  value: string | undefined;
  onChange: (value: string) => void;
  registerItem: (item: LegacySelectItem) => () => void;
  placeholder: string;
  setPlaceholder: (placeholder: string) => void;
  disabled: boolean;
};

const LegacySelectContext = React.createContext<LegacySelectContextValue | null>(null);

function useLegacySelect(): LegacySelectContextValue {
  const ctx = React.useContext(LegacySelectContext);
  if (!ctx) throw new Error("useLegacySelect must be used within <Select>");
  return ctx;
}

function LegacySelectRoot({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled,
}: {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [items, setItems] = React.useState<LegacySelectItem[]>([]);
  const [placeholder, setPlaceholder] = React.useState("");
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const registerItem = React.useCallback((item: LegacySelectItem) => {
    setItems((prev) => (prev.some((i) => i.value === item.value) ? prev : [...prev, item]));
    return () => setItems((prev) => prev.filter((i) => i.value !== item.value));
  }, []);

  const ctx = React.useMemo<LegacySelectContextValue>(
    () => ({
      value: currentValue,
      onChange: (v) => {
        if (isControlled) onValueChange?.(v);
        else setInternalValue(v);
      },
      registerItem,
      placeholder,
      setPlaceholder,
      disabled: !!disabled,
    }),
    [currentValue, isControlled, onValueChange, registerItem, placeholder, disabled],
  );

  return <LegacySelectContext.Provider value={ctx}>{children}</LegacySelectContext.Provider>;
}

const Select = ({ children, value, defaultValue, onValueChange, disabled, ...props }: SelectPrimitive.SelectProps) => {
  if (isLegacyBrowser()) {
    return (
      <LegacySelectRoot value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
        {children}
      </LegacySelectRoot>
    );
  }
  return (
    <SelectPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled} {...props}>
      {children}
    </SelectPrimitive.Root>
  );
};

const SelectGroup = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Group>
>(({ children, ...props }, ref) => {
  if (isLegacyBrowser()) return <>{children}</>;
  return (
    <SelectPrimitive.Group ref={ref} {...props}>
      {children}
    </SelectPrimitive.Group>
  );
});
SelectGroup.displayName = SelectPrimitive.Group.displayName;

const SelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ placeholder, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setPlaceholder } = useLegacySelect();
    React.useLayoutEffect(() => {
      setPlaceholder(placeholder ?? "");
      return () => setPlaceholder("");
    }, [placeholder, setPlaceholder]);
    return null;
  }
  return (
    <SelectPrimitive.Value ref={ref} placeholder={placeholder} {...props}>
      {children}
    </SelectPrimitive.Value>
  );
});
SelectValue.displayName = SelectPrimitive.Value.displayName;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { value, onChange, placeholder, items, disabled } = useLegacySelect();
    return (
      <select
        ref={ref as React.Ref<HTMLSelectElement>}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {(value === undefined || value === "") && placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {items.map((item) => (
          <option key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) return null;
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  );
});
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) return null;
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  );
});
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  if (isLegacyBrowser()) {
    // Les <SelectItem> enfants s'enregistrent via le contexte — pas de rendu ici.
    return <>{children}</>;
  }
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) return null;
  return <SelectPrimitive.Label ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />;
});
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, value, disabled, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { registerItem } = useLegacySelect();
    const labelRef = React.useRef<HTMLSpanElement>(null);
    const [label, setLabel] = React.useState("");

    React.useLayoutEffect(() => {
      if (labelRef.current) {
        const text = labelRef.current.textContent ?? "";
        setLabel(text);
      }
    });

    React.useLayoutEffect(() => {
      if (value === undefined) return;
      return registerItem({ value, label, disabled });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, label, disabled, registerItem]);

    // Contenu caché uniquement pour extraire le libellé (support JSX children)
    return (
      <span ref={labelRef} className="sr-only">
        {children}
      </span>
    );
  }
  return (
    <SelectPrimitive.Item
      ref={ref}
      value={value}
      disabled={disabled}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) return null;
  return <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
});
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
