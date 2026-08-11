import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import LegacyModal from "@/components/ui/LegacyModal";

function isLegacyBrowser(): boolean {
  return typeof window !== "undefined" && (window as any).__NACK_LEGACY_BROWSER__ === true;
}

/* ==========================================================================
   Mode LEGACY (iPad 3 / iOS 9) :
   Remplace le stack Radix AlertDialog (portal + FocusScope + animations)
   par LegacyModal (simple <div>). Même API que le composant Radix.
   ========================================================================== */

type LegacyAlertContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const LegacyAlertContext = React.createContext<LegacyAlertContextValue>({
  open: false,
  setOpen: () => {},
});

function LegacyAlertRoot({
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
  const isControlled = open !== undefined;
  const isOpen = isControlled ? !!open : internalOpen;

  const setOpen = React.useCallback(
    (v: boolean) => {
      if (isControlled) onOpenChange?.(v);
      else setInternalOpen(v);
    },
    [isControlled, onOpenChange],
  );

  return (
    <LegacyAlertContext.Provider value={{ open: isOpen, setOpen }}>{children}</LegacyAlertContext.Provider>
  );
}

const AlertDialog = ({ children, open, defaultOpen, onOpenChange, ...props }: AlertDialogPrimitive.AlertDialogProps) => {
  if (isLegacyBrowser()) {
    return (
      <LegacyAlertRoot open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        {children}
      </LegacyAlertRoot>
    );
  }
  return (
    <AlertDialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} {...props}>
      {children}
    </AlertDialogPrimitive.Root>
  );
};

const AlertDialogTrigger = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Trigger>
>(({ asChild, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setOpen } = React.useContext(LegacyAlertContext);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        onClick: (e: React.MouseEvent) => {
          setOpen(true);
          const childOnClick = (children.props as Record<string, unknown>).onClick as
            | ((ev: React.MouseEvent) => void)
            | undefined;
          if (childOnClick) childOnClick(e);
        },
      });
    }
    return (
      <button type="button" ref={ref} {...props} onClick={() => setOpen(true)}>
        {children}
      </button>
    );
  }
  return (
    <AlertDialogPrimitive.Trigger ref={ref} asChild={asChild} {...props}>
      {children}
    </AlertDialogPrimitive.Trigger>
  );
});
AlertDialogTrigger.displayName = AlertDialogPrimitive.Trigger.displayName;

const AlertDialogPortal = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Portal>) => {
  if (isLegacyBrowser()) return <>{children}</>;
  return <AlertDialogPrimitive.Portal {...props}>{children}</AlertDialogPrimitive.Portal>;
};
AlertDialogPortal.displayName = AlertDialogPrimitive.Portal.displayName;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) {
    // L'overlay est déjà géré par LegacyModal
    return null;
  }
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
      ref={ref}
    />
  );
});
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { open, setOpen } = React.useContext(LegacyAlertContext);
    return (
      <LegacyModal open={open} onClose={() => setOpen(false)} className={className}>
        {children}
      </LegacyModal>
    );
  }
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) {
    return <h2 ref={ref as React.Ref<HTMLHeadingElement>} className={cn("text-lg font-semibold", className)} {...props} />;
  }
  return <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />;
});
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) {
    return <p ref={ref as React.Ref<HTMLParagraphElement>} className={cn("text-sm text-muted-foreground", className)} {...props} />;
  }
  return <AlertDialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />;
});
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, onClick, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setOpen } = React.useContext(LegacyAlertContext);
    return (
      <button
        type="button"
        ref={ref}
        className={cn(buttonVariants(), className)}
        onClick={(e) => {
          onClick?.(e);
          setOpen(false);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <AlertDialogPrimitive.Action
      ref={ref}
      className={cn(buttonVariants(), className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Action>
  );
});
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setOpen } = React.useContext(LegacyAlertContext);
    return (
      <button
        type="button"
        ref={ref}
        className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
        onClick={() => setOpen(false)}
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Cancel>
  );
});
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
