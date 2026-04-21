# takos-slide

A presentation editor and MCP server built on the Takos platform. Create, edit,
and present slides through a browser-based GUI or programmatically via the MCP
(Model Context Protocol) API.

The checked-in `.takos/app.yml` deploys the browser UI and publishes the MCP
server at `/mcp` on the same Takos worker. The standalone/self-host runtime can
still be started with `deno task mcp`.

## Tech Stack

- **Frontend**: Solid.js + Tailwind CSS + Canvas 2D rendering
- **Backend**: Hono HTTP server with MCP Streamable HTTP transport
- **State**: Jotai atoms (client), PresentationStore (server via Takos storage
  API)
- **Rendering**: Canvas 2D (client and server via `npm:canvas`)
- **PDF Export**: jsPDF
- **Runtime**: Deno

## Getting Started

```bash
deno install --allow-scripts=npm:canvas

# Start the development server (Vite, port 3002)
deno task dev

# Start the MCP server (Hono, port 3003)
deno task mcp

# Build for production
deno task build
```

Screenshot/export features use `npm:canvas`. On a fresh machine you may also
need the native `canvas` prerequisites for your OS.

`deno task build` produces the static browser bundle and generates
`dist/worker.js` for the Takos deploy path. The worker serves both the SPA and
the `/mcp` endpoint.

The managed worker bundle avoids loading native `npm:canvas` at startup.
`slide_screenshot` remains available only in runtimes where the server-side
canvas renderer can be loaded.

### Environment Variables

| Variable                 | Description                                      | Default                 |
| ------------------------ | ------------------------------------------------ | ----------------------- |
| `TAKOS_API_URL`          | Takos platform API URL                           | `http://localhost:8787` |
| `TAKOS_ACCESS_TOKEN`     | Access token for storage API                     | (empty)                 |
| `TAKOS_SPACE_ID`         | Storage space ID                                 | (required)              |
| `PORT`                   | MCP server port                                  | `3003`                  |
| `MCP_AUTH_TOKEN`         | Bearer token for `/mcp`                          | managed auto-secret     |
| `MCP_AUTH_REQUIRED`      | Set `1` to fail closed when the token is missing | `0`                     |
| `TAKOS_NATIVE_RENDERING` | Set `1` to enable native canvas screenshot tools | runtime-dependent       |

In managed Takos deploys, `.takos/app.yml` publishes `slide-mcp` with
`spec.authSecretRef: MCP_AUTH_TOKEN` and sets `MCP_AUTH_REQUIRED=1`. Takos
generates the `MCP_AUTH_TOKEN` service secret env when it is missing, and MCP
clients resolve that token from the owner service.

## Available MCP Tools

### Presentation Management

| Tool              | Description                                    |
| ----------------- | ---------------------------------------------- |
| `slide_list`      | List all presentations                         |
| `slide_create`    | Create a new presentation with one blank slide |
| `slide_get`       | Get full presentation data                     |
| `slide_delete`    | Delete a presentation                          |
| `slide_set_title` | Rename a presentation                          |

### Slide Operations

| Tool                   | Description                            |
| ---------------------- | -------------------------------------- |
| `slide_add`            | Add a blank slide                      |
| `slide_remove`         | Remove a slide                         |
| `slide_reorder`        | Move a slide to a new position         |
| `slide_set_background` | Set slide background color or gradient |
| `slide_duplicate`      | Duplicate a slide                      |

### Element Operations

| Tool                   | Description                                  |
| ---------------------- | -------------------------------------------- |
| `slide_add_text`       | Add a text box element                       |
| `slide_add_shape`      | Add a shape (rect, ellipse, triangle, arrow) |
| `slide_add_image`      | Add an image element                         |
| `slide_remove_element` | Remove an element                            |
| `slide_update_element` | Update element properties                    |
| `slide_move_element`   | Move an element to a new position            |
| `slide_resize_element` | Resize an element                            |

### Visual Output

| Tool               | Description                   |
| ------------------ | ----------------------------- |
| `slide_screenshot` | Render a slide as a PNG image |

### Export

| Tool                    | Description                       |
| ----------------------- | --------------------------------- |
| `slide_export_json`     | Export presentation as JSON       |
| `slide_export_pdf`      | Export presentation as a PDF file |
| `slide_get_slide_count` | Get the number of slides          |

### Transitions

| Tool                   | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `slide_set_transition` | Set a transition effect for a slide (fade, slide-left, slide-right, slide-up, zoom) |

### Templates

| Tool                         | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| `slide_list_templates`       | List available bundled templates                 |
| `slide_create_from_template` | Create a new presentation from a template        |
| `slide_add_from_template`    | Add a template slide to an existing presentation |

## Architecture Overview

```
src/
  server.ts              # Hono HTTP server entry point
  mcp.ts                 # MCP tool definitions (25 tools)
  presentation-store.ts  # Server-side state management (Takos storage API)
  types/index.ts         # Shared TypeScript type definitions
  lib/
    canvas-renderer.ts   # Client-side Canvas 2D rendering
    server-renderer.ts   # Server-side rendering (npm:canvas) for screenshots
    pdf-exporter.ts      # PDF generation via jsPDF
    templates.ts         # Built-in slide templates
    storage.ts           # Client-side localStorage persistence
    takos-storage.ts     # Takos platform storage API client
  pages/
    PresentPage.tsx      # Fullscreen presentation mode with transitions
```

## Data Model

### Presentation

A presentation contains an ordered list of slides with metadata (title,
timestamps).

### Slide

Each slide has a background color/gradient, an ordered list of elements, and an
optional transition effect.

### SlideElement

Elements can be one of three types:

- **text** -- Styled text box with font size, colour, alignment, bold/italic
- **shape** -- Geometric shape (rect, ellipse, triangle, arrow) with fill and
  stroke
- **image** -- Image element referenced by URL

All elements share common positioning properties: x, y, width, height, rotation.

### SlideTransition

Transitions define the animation played when navigating to a slide during
presentation mode. Supported types: `none`, `fade`, `slide-left`, `slide-right`,
`slide-up`, `zoom`. Duration is specified in milliseconds.

### SlideTemplate

Built-in templates provide pre-configured slide layouts: `blank`, `title-slide`,
`title-content`, `two-column`, `section-header`.

Internal slide coordinate space is 960x540 (16:9 aspect ratio).

## Development Guide

- Types are defined in `src/types/index.ts` and shared between client and server
- Server rendering (`server-renderer.ts`) mirrors client rendering
  (`canvas-renderer.ts`) logic
- MCP tools in `src/mcp.ts` delegate to `PresentationStore` methods
- The store persists data through the Takos storage API as JSON files
- Use `deno lint` and `deno fmt` for code quality
- Run tests with `deno test --allow-all`
