import { describe, expect, it } from "vitest";
import { getActionsForPath } from "../client/src/components/RightActionDrawer";
import {
  CANONICAL_DESTINATION_BY_ID,
  EXPERT_WORKSPACE_BY_ID,
  PERSISTENT_UTILITY_BY_ID,
} from "../shared/routeRegistry";

describe("registry-driven contextual actions", () => {
  it("uses the canonical NOW action set for legacy routes", () => {
    const canonical = getActionsForPath(CANONICAL_DESTINATION_BY_ID.now.path);
    const legacy = getActionsForPath("/app/dashboard");
    expect(legacy.map(action => action.id)).toEqual(canonical.map(action => action.id));
    expect(canonical.find(action => action.id === "open-pressure")?.target)
      .toBe(EXPERT_WORKSPACE_BY_ID.pressure.path);
  });

  it("inherits canonical owner actions for expert workspaces", () => {
    const expertActions = getActionsForPath(EXPERT_WORKSPACE_BY_ID["decision-engine"].path);
    const actActions = getActionsForPath(CANONICAL_DESTINATION_BY_ID.act.path);
    expect(expertActions.map(action => action.id)).toEqual(actActions.map(action => action.id));
  });

  it("derives WATCH utility targets from the shared registry", () => {
    const actions = getActionsForPath(CANONICAL_DESTINATION_BY_ID.watch.path);
    expect(actions.find(action => action.id === "alerts")?.target)
      .toBe(PERSISTENT_UTILITY_BY_ID.alerts.path);
  });
});
