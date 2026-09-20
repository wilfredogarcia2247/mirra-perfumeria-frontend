import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      closeButton
      duration={1400}
      visibleToasts={3}
      offset={12}
      className="toaster group"
      toastOptions={{
        duration: 1400,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md group-[.toaster]:rounded-md group-[.toaster]:px-3 group-[.toaster]:py-2 group-[.toaster]:text-[11px] group-[.toaster]:min-h-0 group-[.toaster]:max-w-[240px] group-[.toaster]:translate-x-0",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[10px]",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:h-7 group-[.toast]:px-2 group-[.toast]:text-[10px]",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:h-7 group-[.toast]:px-2 group-[.toast]:text-[10px]",
          closeButton: "group-[.toast]:bg-muted group-[.toast]:text-foreground",
        },
      }}
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        left: 'auto',
        bottom: 'auto',
        zIndex: 9999,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
