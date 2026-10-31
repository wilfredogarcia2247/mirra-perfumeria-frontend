import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Tablets (p. ej. Redmi Pad 2 en la tienda): pantalla táctil, ancha y alta. No aplica en PC (mouse)
      // ni en celulares (angostos, o bajos cuando están acostados).
      //   tablet:  vertical y horizontal · tabletv: solo vertical (~800 px) · tableth: solo horizontal (~1280 px)
      screens: {
        tablet: { raw: '(pointer: coarse) and (min-width: 700px) and (min-height: 600px)' },
        tabletv: { raw: '(pointer: coarse) and (min-width: 700px) and (max-width: 1023px) and (min-height: 600px)' },
        tableth: { raw: '(pointer: coarse) and (min-width: 1024px) and (min-height: 600px)' },
      },
      fontFamily: {
        'bell-mt': ['Bell MT', 'serif'],
        'montserrat': ['Montserrat', 'sans-serif'],
      },
      colors: {
        // Nueva paleta de colores
        gray: {
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#878787',
          600: '#6b6b6b',
          700: '#4f4f4f',
          800: '#333333',
          900: '#1a1a1a',
        },
        primary: {
          DEFAULT: '#ca9e67',
          100: '#f5eee6',
          200: '#e8d9c5',
          300: '#dcc4a4',
          400: '#d1b083',
          500: '#ca9e67',
          600: '#b58a53',
          700: '#a07746',
          800: '#8b6439',
          900: '#76522d',
        },

        // Paleta de acentos: rosas, tierra, amarillos, verdes, azules y neutrales
        rose: {
          50: '#fff5f7',
          100: '#ffeef2',
          200: '#ffd6e6',
          300: '#ff9fcf',
          400: '#ff6fae',
          500: '#ff2d6f',
          600: '#e62460',
          700: '#a81a45',
          800: '#7a1130',
          900: '#4d0a21',
        },
        earth: {
          50: '#fff8f3',
          100: '#fff1e6',
          200: '#f7dcc4',
          300: '#e8b68d',
          400: '#d69a6b',
          500: '#b76b44',
          600: '#9a4f33',
          700: '#7a3d2a',
          800: '#5b2e22',
          900: '#3e2017',
        },
        amber: {
          50: '#fffaf0',
          100: '#fff4d9',
          200: '#ffe7a8',
          300: '#ffd166',
          400: '#ffb84a',
          500: '#ff9f1f',
          600: '#e08510',
          700: '#a8680d',
          800: '#7a4b0a',
          900: '#53330a',
        },
        green: {
          50: '#f6fff5',
          100: '#ecffea',
          200: '#d6ffd1',
          300: '#9fe79f',
          400: '#5fcf6a',
          500: '#2aab3a',
          600: '#238a31',
          700: '#196726',
          800: '#124c1c',
          900: '#0c3714',
        },
        sky: {
          50: '#f3fbff',
          100: '#e8f7ff',
          200: '#cfeefd',
          300: '#9fdff9',
          400: '#66c6f2',
          500: '#2ba7e6',
          600: '#238fcf',
          700: '#1a6aa0',
          800: '#124d78',
          900: '#0b334f',
        },
        neutral: {
          50: '#fdfdfc',
          100: '#fbfaf7',
          200: '#f4f2ee',
          300: '#e9e6df',
          400: '#dcd6cc',
          500: '#cfc6bb',
          600: '#b9ac9a',
          700: '#948773',
          800: '#6f6050',
          900: '#4a3f33',
        },

        // Semantic tokens mapped to the palette
        brand: {
          DEFAULT: '#ca9e67',
          foreground: '#ffffff',
        },
        'brand-dark': {
          DEFAULT: '#b58a53',
          foreground: '#ffffff',
        },
        site: {
          DEFAULT: '#faf8f5',
        },
        surface: {
          DEFAULT: '#fff',
          muted: '#f5f1ea',
        },

        // CSS-var based theme tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
