import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import LegacyModal from "@/components/ui/LegacyModal";

function isLegacyBrowser(): boolean {
  return typeof window !== "undefined" && (window as any).__NACK_LEGACY_BROWSER__ === true;
}

/* ==========================================================================
   Mode LEGACY (iPad 3 / iOS 9) :
   On remplace TOUT le stack Radix (portal + FocusScope + aria-hidden + animations)
   par un simple <div> HTML. Aucune animation, aucun focus trap.
   Les composants exportés gardent la MÊME API, donc les 21 fichiers qui
   consomment `@/components/ui/dialog` fonctionnent sans modification.
   ========================================================================== */

type LegacyDialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const LegacyDialogContext = React.createContext<LegacyDialogContextValue>({
  open: false,
  setOpen: () => {},
});

function LegacyDialogRoot({
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

  const setOpen = React.useCallback((v: boolean) => {
    if (isControlled) {
      onOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  }, [isControlled, onOpenChange]);

  return (
    <LegacyDialogContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </LegacyDialogContext.Provider>
  );
}

const Dialog = ({ children, open, defaultOpen, onOpenChange, ...props }: DialogPrimitive.DialogProps) => {
  if (isLegacyBrowser()) {
    return (
      <LegacyDialogRoot open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        {children}
      </LegacyDialogRoot>
    );
  }
  return (
    <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} {...props}>
      {children}
    </DialogPrimitive.Root>
  );
};

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>(({ asChild, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setOpen } = React.useContext(LegacyDialogContext);
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
    <DialogPrimitive.Trigger ref={ref} asChild={asChild} {...props}>
      {children}
    </DialogPrimitive.Trigger>
  );
});
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName;

const DialogPortal = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>) => {
  if (isLegacyBrowser()) return <>{children}</>;
  return <DialogPrimitive.Portal {...props}>{children}</DialogPrimitive.Portal>;
};
DialogPortal.displayName = DialogPrimitive.Portal.displayName;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) {
    // L'overlay est déjà géré par LegacyModal (div .legacy-modal-overlay)
    return null;
  }
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { open, setOpen } = React.useContext(LegacyDialogContext);
    return (
      <LegacyModal open={open} onClose={() => setOpen(false)} className={className}>
        {children}
      </LegacyModal>
    );
  }
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) {
    return <h2 ref={ref as React.Ref<HTMLHeadingElement>} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
  }
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
});
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  if (isLegacyBrowser()) {
    return <p ref={ref as React.Ref<HTMLParagraphElement>} className={cn("text-sm text-muted-foreground", className)} {...props} />;
  }
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ asChild, children, ...props }, ref) => {
  if (isLegacyBrowser()) {
    const { setOpen } = React.useContext(LegacyDialogContext);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        onClick: (e: React.MouseEvent) => {
          setOpen(false);
          const childOnClick = (children.props as Record<string, unknown>).onClick as
            | ((ev: React.MouseEvent) => void)
            | undefined;
          if (childOnClick) childOnClick(e);
        },
      });
    }
    return (
      <button type="button" ref={ref} {...props} onClick={() => setOpen(false)}>
        {children}
      </button>
    );
  }
  return (
    <DialogPrimitive.Close ref={ref} asChild={asChild} {...props}>
      {children}
    </DialogPrimitive.Close>
  );
});
DialogClose.displayName = DialogPrimitive.Close.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
