import { Activity, Bell, Brain, CircleHelp, Crosshair, Gauge, MessageSquare, Network, Search, Target, Telescope, User, type LucideIcon } from "lucide-react";
import type { RouteIconKey } from "@shared/routeRegistry";
const ICONS: Record<RouteIconKey, LucideIcon> = { activity: Activity, network: Network, telescope: Telescope, bell: Bell, crosshair: Crosshair, message: MessageSquare, search: Search, help: CircleHelp, user: User, gauge: Gauge, brain: Brain, target: Target };
export function getRouteIcon(key: RouteIconKey): LucideIcon { return ICONS[key]; }
