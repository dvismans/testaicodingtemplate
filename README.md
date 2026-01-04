# Bun + Hono Template

A production-ready template for building web applications with **Bun**, **Hono**, **HTMX**, and **Pico CSS**.

## Features

- **Typed Config** — Zod-validated environment variables with fail-fast startup
- **Module-scoped Logging** — Color-coded Pino loggers per module
- **Result Types** — neverthrow for explicit error handling
- **Request Tracing** — Unique request ID for every request
- **Server-rendered UI** — HTMX + Pico CSS, minimal client JS
- **Container Ready** — Containerfile + compose.yaml included
- **Test Setup** — Vitest configured with example tests

## Quick Start

### From GitHub Template

1. Click **"Use this template"** → **"Create a new repository"**
2. Clone your new repository
3. Set up the project:

```bash
# Install dependencies
bun install

# Create environment file
cp .env.example .env

# Start development server
bun run dev
```

4. Open http://localhost:3000

### Manual Clone

```bash
# Clone and rename
git clone https://github.com/YOUR_USERNAME/bun-hono-template.git my-project
cd my-project

# Remove template git history
rm -rf .git
git init

# Set up
bun install
cp .env.example .env
bun run dev
```

## Project Structure

```
src/
├── config.ts              # Zod-validated .env parsing
├── logger.ts              # Pino logger factory
├── index.ts               # App entry point
├── api/
│   ├── routes.tsx         # All routes
│   ├── errorHandler.ts    # Global error boundary
│   └── middleware/
│       └── requestId.ts   # Request ID tracing
├── greeting/              # Example domain module
│   ├── schema.ts          # Zod schemas + types
│   ├── transform.ts       # Pure functions
│   ├── service.ts         # Side effects
│   ├── errors.ts          # Error types
│   └── __tests__/         # Co-located tests
└── ui/
    ├── layouts/
    │   └── Base.tsx       # HTML shell
    ├── pages/
    │   └── Home.tsx       # Page components
    └── components/
        ├── GreetingForm.tsx
        └── GreetingResult.tsx
```

## Configuration

All configuration lives in `.env`. The app validates config at startup and crashes immediately if invalid.

```bash
# .env
PORT=3000
NODE_ENV=development
APP_NAME=MyApp
LOG_LEVEL=debug
```

Add new config variables in `src/config.ts`:

```typescript
const ConfigSchema = z.object({
  // Add your new config here
  MY_NEW_VAR: z.string().default("value"),
});
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start with hot reload |
| `bun run start` | Start production server |
| `bun run test` | Run tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run typecheck` | TypeScript type check |
| `bun run lint` | Lint with Biome |
| `bun run lint:fix` | Auto-fix lint issues |

### Container Commands

| Command | Description |
|---------|-------------|
| `bun run container:build` | Build container image |
| `bun run container:up` | Start container |
| `bun run container:down` | Stop container |
| `bun run container:logs` | View container logs |
| `bun run container:restart` | Rebuild and restart |

## Customizing for Your Project

### 1. Update package.json

```json
{
  "name": "your-project-name",
  "description": "Your project description"
}
```

### 2. Update .env

```bash
APP_NAME=YourAppName
```

### 3. Replace the greeting module

The `src/greeting/` module is an example. Replace it with your domain:

```bash
# Remove example module
rm -rf src/greeting

# Create your domain module
mkdir -p src/users
touch src/users/{schema,transform,service,errors,index}.ts
mkdir src/users/__tests__
```

### 4. Update routes

Edit `src/api/routes.tsx` to add your endpoints.

### 5. Update UI

- `src/ui/layouts/Base.tsx` — Navigation, footer
- `src/ui/pages/` — Your pages
- `src/ui/components/` — Reusable components

## Architecture Patterns

### Data First
Define Zod schemas before writing logic. Schemas are the source of truth.

```typescript
// src/users/schema.ts
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
});

export type User = z.infer<typeof UserSchema>;
```

### Pure Transformations
Write pure functions for business logic. Side effects happen at the edges.

```typescript
// src/users/transform.ts
export const formatUserName = (user: User): string =>
  user.name.trim().split(' ').map(capitalize).join(' ');
```

### Result Types
Use neverthrow for operations that can fail.

```typescript
// src/users/service.ts
import { ok, err, Result } from 'neverthrow';

export const findUser = (id: string): Result<User, UserError> => {
  const user = db.get(id);
  return user ? ok(user) : err({ type: 'NOT_FOUND', id });
};
```

### HTMX for Interactivity
Server returns HTML fragments. No client-side state management.

```tsx
// Form with HTMX
<form hx-post="/api/users" hx-target="#result" hx-swap="innerHTML">
  <input name="email" type="email" required />
  <button type="submit">Create User</button>
</form>
```

## Adding a New Domain Module

1. Create the module structure:

```bash
mkdir -p src/orders/{__tests__}
```

2. Define schema (`src/orders/schema.ts`):

```typescript
import { z } from 'zod';

export const OrderSchema = z.object({
  id: z.string().uuid(),
  items: z.array(z.object({
    sku: z.string(),
    quantity: z.number().positive(),
  })),
  total: z.number().positive(),
});

export type Order = z.infer<typeof OrderSchema>;
```

3. Add transformations (`src/orders/transform.ts`):

```typescript
export const calculateTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);
```

4. Add service (`src/orders/service.ts`):

```typescript
import { createLogger } from '../logger';
const log = createLogger('orders');

export const createOrder = async (data: CreateOrderInput) => {
  log.info({ operation: 'createOrder' }, 'Creating order');
  // ... implementation
};
```

5. Export public API (`src/orders/index.ts`):

```typescript
export { OrderSchema, type Order } from './schema';
export { calculateTotal } from './transform';
export { createOrder } from './service';
```

6. Add routes in `src/api/routes.tsx`.

## Deployment

### Using Podman/Docker

```bash
# Build and run locally
bun run container:up

# View logs
bun run container:logs
```

### Manual Deployment

```bash
# Sync to server
rsync -avz --exclude node_modules --exclude .git ./ user@server:~/app/

# SSH and start
ssh user@server 'cd ~/app && bun install && bun run start'
```

## License

MIT

