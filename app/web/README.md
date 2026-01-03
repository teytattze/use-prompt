# Use Open Prompt - Web Application

A Next.js web application for the Use Open Prompt platform - a prompt registry for sharing prompts globally.

## Project Structure

```
app/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with metadata and fonts
│   │   ├── page.tsx            # Home page
│   │   └── global.css          # Global styles and theme variables
│   │
│   ├── component/              # Reusable UI components
│   │   └── ui/                 # Base UI components (button, card, input, etc.)
│   │
│   ├── feature/                # Feature modules
│   │   ├── create-prompt/      # Prompt creation feature
│   │   └── view-prompt/        # Prompt viewing feature
│   │
│   ├── lib/                    # Shared utilities
│   │   ├── http/               # HTTP client and DTOs
│   │   │   ├── http-client.ts  # Axios instance configuration
│   │   │   └── http-dto.ts     # HTTP response envelope schema
│   │   ├── service.ts          # Service input type definitions
│   │   └── util.ts             # Utility functions (cn, etc.)
│   │
│   └── service/                # Business logic and API services
│       └── prompt/             # Prompt-related services
│           ├── create-prompt-service.ts
│           └── prompt-dto.ts
│
├── public/                     # Static assets
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── postcss.config.mjs          # PostCSS/Tailwind configuration
├── components.json             # shadcn UI configuration
└── turbo.json                  # Turborepo configuration
```

## Tech Stack

- **Framework**: Next.js with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with OKLCH color space
- **UI Components**: Base UI, shadcn, Lucide icons
- **Validation**: Zod
- **HTTP Client**: Axios
- **Build Tool**: Turborepo (monorepo)

## UI Components

The `/src/component/ui` directory contains reusable components:

| Component       | Description                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| `button`        | Button with variants (default, outline, secondary, ghost, destructive, link) |
| `card`          | Card container with header, title, description, content, footer              |
| `field`         | Form field system with label, description, error handling                    |
| `input`         | Text input field                                                             |
| `textarea`      | Multi-line text input                                                        |
| `label`         | Form label                                                                   |
| `badge`         | Badge/tag component                                                          |
| `select`        | Dropdown select                                                              |
| `combobox`      | Searchable dropdown                                                          |
| `dropdown-menu` | Menu component                                                               |
| `input-group`   | Grouped input fields                                                         |
| `alert-dialog`  | Alert dialog                                                                 |
| `separator`     | Visual divider                                                               |

## Services

### Prompt Service

Located in `/src/service/prompt/`:

- `createPromptService()` - Creates a new prompt via `POST /v1/prompt`
- `PromptDto` - Prompt data model with id, title, body

## Scripts

```bash
bun dev       # Start development server
bun build     # Build for production
bun start     # Start production server
bun lint      # Run ESLint
bun check-types  # TypeScript type checking
```

## Theme

The application uses CSS custom properties with OKLCH color space for light/dark theme support. Theme variables are defined in `global.css`.
