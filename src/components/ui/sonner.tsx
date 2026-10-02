import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      closeButton={false}
      duration={3500}
      visibleToasts={4}
      offset={16}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-[hsl(32,30%,18%)] !text-[hsl(32,20%,92%)] !border-[hsl(32,25%,26%)] !shadow-2xl !rounded-2xl !px-5 !py-4 !text-[13px] !font-medium !max-w-[360px] !w-[360px] !gap-3.5",
          title:
            "!text-[hsl(32,20%,96%)] !font-semibold !text-[14px] !leading-tight",
          description:
            "!text-[hsl(32,12%,65%)] !text-[13px] !leading-snug !mt-1",
          success:
            "!bg-[hsl(32,30%,18%)] !border-[hsl(32,25%,26%)]",
          error:
            "!bg-[hsl(0,28%,16%)] !text-[hsl(0,20%,92%)] !border-[hsl(0,22%,26%)]",
          info:
            "!bg-[hsl(32,30%,18%)] !border-[hsl(32,25%,26%)]",
          warning:
            "!bg-[hsl(38,35%,16%)] !border-[hsl(38,30%,26%)]",
          icon:
            "!text-[hsl(32,55%,65%)]",
        },
      }}
      style={{
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        right: 'auto',
        bottom: 'auto',
        zIndex: 9999,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
