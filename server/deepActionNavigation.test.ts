import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CANONICAL_DESTINATION_BY_ID } from "../shared/routeRegistry";

const smartDiscoverySource = readFileSync(
  resolve(process.cwd(), "client/src/pages/SmartDiscovery.tsx"),
  "utf8",
);

describe("Deep Action navigation and ASHA prompt safeguards", () => {
  it("keeps canonical question destinations distinct from the Smart Discovery workspace", () => {
    expect(CANONICAL_DESTINATION_BY_ID.now.path).toBe("/app/now");
    expect(CANONICAL_DESTINATION_BY_ID.why.path).toBe("/app/why");
    expect(CANONICAL_DESTINATION_BY_ID.outlook.path).toBe("/app/outlook");
    expect(CANONICAL_DESTINATION_BY_ID.watch.path).toBe("/app/watch");
    expect(CANONICAL_DESTINATION_BY_ID.act.path).toBe("/app/act");
  });

  it("uses a shared native-submit guard for the entire ASHA workspace", () => {
    expect(smartDiscoverySource).toContain("onSubmitCapture={preventUnexpectedSubmission}");
    expect(smartDiscoverySource).toContain("event.preventDefault();");
    expect(smartDiscoverySource).toContain('querySelectorAll<HTMLButtonElement>("button:not([type])")');
    expect(smartDiscoverySource).toContain('button.type = "button"');
  });

  it("dispatches predefined ASHA prompts in place and retains the submitted context on failure", () => {
    expect(smartDiscoverySource).toContain("const handlePromptAction");
    expect(smartDiscoverySource).toContain("event.stopPropagation();");
    expect(smartDiscoverySource).toContain("void handleSubmit(prompt);");
    const pipelineErrorBranch = smartDiscoverySource.slice(
      smartDiscoverySource.indexOf("} catch (err: unknown)"),
      smartDiscoverySource.indexOf("} finally {", smartDiscoverySource.indexOf("} catch (err: unknown)")),
    );
    expect(pipelineErrorBranch).not.toContain("setConversation(prev => prev.slice(0, -1));");
  });

  it("keeps Deep Action specialist navigation inside Wouter", () => {
    expect(smartDiscoverySource).toContain("navigate(path);");
    expect(smartDiscoverySource).toContain('navigate("/app/symbol-intelligence");');
    expect(smartDiscoverySource).not.toContain("window.location.href =");
  });
});
