# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project..

## 🚀 Features
- Fast Refresh (HMR)
- Optimized build setup
- ESLint integration

## Environment Variables Troubleshooting

If the frontend application fails to connect to backend APIs:
- **VITE_ Prefix Requirement**: Ensure all client-side variables are prefixed with `VITE_` (e.g. `VITE_API_URL`). Non-prefixed variables are excluded from Vite build bundles.
- **Docker Setup**: Verify that environment variables are correctly forwarded in `docker-compose` or local runtime environments.
- **Caching Issues**: Clear build caches and restart the development server after updating `.env` files:
    `npm run dev -- --force`
