import {
  BarChart3,
  Code2,
  Compass,
  Info,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavTab =
  | "lockin"
  | "rooms"
  | "dashboard"
  | "explore"
  | "profile"
  | "dev"
  | "about";

export type NavItem = {
  id: NavTab;
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "lockin", label: "Lock In", href: "/", icon: Target },
  { id: "rooms", label: "Rooms", href: "/rooms", icon: Users },
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { id: "explore", label: "Explore", href: "/explore", icon: Compass },
  { id: "profile", label: "Profile", href: "/profile", icon: UserRound },
  { id: "dev", label: "Developer Mode", href: "/dev", icon: Code2 },
  { id: "about", label: "About", href: "/about", icon: Info },
];

export function navTabFromPathname(pathname: string): NavTab {
  if (pathname === "/") return "lockin";
  if (pathname.startsWith("/rooms")) return "rooms";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/explore")) return "explore";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/dev")) return "dev";
  if (pathname.startsWith("/about")) return "about";
  return "lockin";
}
