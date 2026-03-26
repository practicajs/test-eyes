# Complete CSS Token Definitions

Copy this into your `src/index.css` (or equivalent) to bootstrap the Practica design system in a new project.

## Tailwind CSS v4 Setup

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
    --radius-2xl: calc(var(--radius) + 8px);
    --radius-3xl: calc(var(--radius) + 12px);
    --radius-4xl: calc(var(--radius) + 16px);
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-card: var(--card);
    --color-card-foreground: var(--card-foreground);
    --color-popover: var(--popover);
    --color-popover-foreground: var(--popover-foreground);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-secondary: var(--secondary);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-destructive: var(--destructive);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);
    --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

:root {
    --radius: 0.75rem;
    --background: oklch(0.91 0.004 265);
    --foreground: oklch(0.16 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.16 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.16 0 0);
    --primary: oklch(0.68 0.12 199);
    --primary-foreground: oklch(1 0 0);
    --secondary: oklch(0.94 0.015 199);
    --secondary-foreground: oklch(0.2 0 0);
    --muted: oklch(0.93 0.003 265);
    --muted-foreground: oklch(0.45 0 0);
    --accent: oklch(0.93 0.015 199);
    --accent-foreground: oklch(0.2 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.87 0.005 265);
    --input: oklch(0.87 0.005 265);
    --ring: oklch(0.68 0.12 199);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

## Google Fonts HTML

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
```

## shadcn/ui Configuration (components.json)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```
