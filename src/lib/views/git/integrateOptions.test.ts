import { describe, expect, it } from "vitest";
import {
  DEFAULT_MERGE_OPTIONS,
  DEFAULT_REBASE_OPTIONS,
  mergeCommand,
  mergeDoneMessage,
  mergeRequest,
  mergeShowsMessage,
  rebaseCommand,
  rebaseFlagDisabled,
  rebaseRequest,
  toggleMergeFlag,
  toggleRebaseFlag,
  validateRebase,
} from "./integrateOptions";

describe("merge options", () => {
  it("turns off the options a flag excludes", () => {
    const noFf = toggleMergeFlag(DEFAULT_MERGE_OPTIONS, "noFf", true);
    expect(noFf.noFf).toBe(true);
    const ffOnly = toggleMergeFlag(noFf, "ffOnly", true);
    expect(ffOnly).toMatchObject({ ffOnly: true, noFf: false });
    const squash = toggleMergeFlag({ ...ffOnly, noCommit: true }, "squash", true);
    expect(squash).toMatchObject({ squash: true, ffOnly: false, noCommit: false });
    expect(toggleMergeFlag(squash, "squash", false).squash).toBe(false);
    expect(toggleMergeFlag(squash, "noVerify", true)).toMatchObject({ squash: true, noVerify: true });
  });

  it("maps options to the command and the request", () => {
    expect(mergeCommand("feature", DEFAULT_MERGE_OPTIONS)).toBe("git merge --no-edit feature");
    const options = { ...DEFAULT_MERGE_OPTIONS, noFf: true, noVerify: true, message: "  Release 2\n\nbody " };
    expect(mergeCommand("feature/x", options)).toBe('git merge --no-ff --no-verify -m "Release 2" feature/x');
    expect(mergeRequest(options).message).toBe("Release 2\n\nbody");
    expect(mergeCommand("", { ...DEFAULT_MERGE_OPTIONS, noCommit: true, message: "fix" })).toBe(
      "git merge --no-commit -m fix <branch>",
    );
    const squash = { ...DEFAULT_MERGE_OPTIONS, squash: true, message: "dropped" };
    expect(mergeShowsMessage(squash)).toBe(false);
    expect(mergeRequest(squash).message).toBeNull();
    expect(mergeCommand("feature", squash)).toBe("git merge --squash --no-edit feature");
    expect(mergeCommand("f", { ...DEFAULT_MERGE_OPTIONS, message: 'say "hi" $x' })).toBe('git merge -m "say \\"hi\\" \\$x" f');
  });

  it("says what happened", () => {
    expect(mergeDoneMessage("feature", "main", DEFAULT_MERGE_OPTIONS)).toBe("Merged feature into main");
    expect(mergeDoneMessage("feature", "main", { ...DEFAULT_MERGE_OPTIONS, squash: true })).toContain("staged");
    expect(mergeDoneMessage("feature", "main", { ...DEFAULT_MERGE_OPTIONS, noCommit: true })).toContain("without committing");
  });
});

describe("rebase options", () => {
  it("builds the two- and three-argument forms and --root", () => {
    expect(rebaseCommand(DEFAULT_REBASE_OPTIONS)).toBe("git rebase <branch or commit>");
    expect(validateRebase(DEFAULT_REBASE_OPTIONS)).toBe("Choose what to rebase onto");
    const simple = { ...DEFAULT_REBASE_OPTIONS, onto: " main ", rebaseMerges: true, updateRefs: true };
    expect(rebaseCommand(simple)).toBe("git rebase --rebase-merges --update-refs main");
    expect(validateRebase(simple)).toBeNull();
    expect(rebaseRequest(simple)).toMatchObject({ onto: "main", upstream: null, rebaseMerges: true });

    const three = { ...DEFAULT_REBASE_OPTIONS, useOnto: true, onto: "main", upstream: "old-base", branchName: "topic" };
    expect(rebaseCommand(three)).toBe("git rebase --onto main old-base topic");
    expect(validateRebase({ ...three, upstream: "" })).toContain("upstream");
    expect(validateRebase({ ...three, onto: "-x" })).toBe("Not a valid revision");

    const root = { ...DEFAULT_REBASE_OPTIONS, root: true, onto: "ignored" };
    expect(rebaseCommand(root)).toBe("git rebase --root");
    expect(validateRebase(root)).toBeNull();
    expect(rebaseRequest(root).onto).toBeNull();
    expect(rebaseCommand({ ...root, useOnto: true, onto: "fresh" })).toBe("git rebase --onto fresh --root");
  });

  it("keeps --interactive apart from the options it does not take", () => {
    const interactive = toggleRebaseFlag({ ...DEFAULT_REBASE_OPTIONS, rebaseMerges: true, root: true }, "interactive", true);
    expect(interactive).toMatchObject({ interactive: true, rebaseMerges: false, root: false });
    expect(rebaseFlagDisabled(interactive, "updateRefs")).toBe(true);
    expect(rebaseFlagDisabled(interactive, "interactive")).toBe(false);
    expect(rebaseCommand({ ...interactive, onto: "main" })).toBe("git rebase --interactive main");
    const onto = toggleRebaseFlag(interactive, "useOnto", true);
    expect(onto.interactive).toBe(false);
    expect(rebaseFlagDisabled(onto, "interactive")).toBe(true);
  });
});
