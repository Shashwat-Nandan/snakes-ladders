import React from "react";
import ReactDOM from "react-dom/client";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { HomePage } from "./pages/HomePage";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page-shell">
          <section className="boot-panel panel">
            <p className="section-label">Something went wrong</p>
            <h1>An unexpected error occurred.</h1>
            <p>{this.state.error.message}</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function RootLayout() {
  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search) => ({
    room: typeof search.room === "string" ? search.room.toUpperCase() : "",
  }),
  component: HomePage,
});

const routeTree = rootRoute.addChildren([indexRoute]);

const router = createRouter({
  routeTree,
});

ReactDOM.createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>
);
