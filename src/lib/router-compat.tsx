// Thin compatibility layer mapping react-router-dom-style APIs to TanStack Router.
// The original Segilly app uses simple absolute paths and basic navigation only.
import { forwardRef } from "react";
import {
  Link as TSLink,
  useNavigate as useTSNavigate,
  useLocation as useTSLocation,
  useRouterState,
} from "@tanstack/react-router";

type AnyProps = Record<string, any>;

export const Link = forwardRef<HTMLAnchorElement, AnyProps>(function Link(
  { to, children, replace, ...rest },
  ref,
) {
  return (
    <TSLink ref={ref as any} to={to} replace={replace} {...rest}>
      {children}
    </TSLink>
  );
});

export function useNavigate() {
  const nav = useTSNavigate();
  return (to: string, opts?: { replace?: boolean }) => {
    nav({ to, replace: opts?.replace });
  };
}

export function useLocation() {
  const loc = useTSLocation();
  return {
    pathname: loc.pathname,
    search: loc.searchStr,
    hash: loc.hash,
    state: loc.state,
  };
}

// NavLink with `className` callback or string, plus `end` (exact match).
type NavLinkProps = AnyProps & {
  to: string;
  end?: boolean;
  className?: string | ((args: { isActive: boolean }) => string);
  children?: React.ReactNode | ((args: { isActive: boolean }) => React.ReactNode);
};

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { to, end, className, children, ...rest },
  ref,
) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(to + "/");
  const cls = typeof className === "function" ? className({ isActive }) : className;
  const kids = typeof children === "function" ? children({ isActive }) : children;
  return (
    <TSLink ref={ref as any} to={to} className={cls} {...rest}>
      {kids}
    </TSLink>
  );
});

export type { NavLinkProps };
