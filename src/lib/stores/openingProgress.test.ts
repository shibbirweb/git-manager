import { describe, expect, it } from "vitest";
import { baseName, loadingChangesText, openFailure, openingTitle } from "./openingProgress";

describe("opening progress text", () => {
  it("names the folder being opened", () => {
    expect(baseName("/work/acme/")).toBe("acme");
    expect(baseName("C:\\work\\acme")).toBe("acme");
    expect(openingTitle(["/work/acme"])).toBe("Opening acme");
    expect(openingTitle(["/a", "/b", "/c"])).toBe("Opening 3 folders");
  });

  it("counts the repositories still loading", () => {
    expect(loadingChangesText(0, 5)).toBe("Reading changes 1 of 5");
    expect(loadingChangesText(4, 5)).toBe("Reading changes 5 of 5");
    expect(loadingChangesText(0, 1)).toBe("Reading changes");
  });

  it("names the folder and the error when opening fails", () => {
    expect(openFailure(["/work/acme"], "No app window answered the IPC bridge")).toEqual({
      title: "Could not open acme",
      detail: "/work/acme\nNo app window answered the IPC bridge",
    });
    // The backend's own message already names the path, so it is not repeated.
    expect(openFailure(["/work/gone"], "Folder does not exist: /work/gone")).toEqual({
      title: "Could not open gone",
      detail: "Folder does not exist: /work/gone",
    });
    expect(openFailure(["/a", "/b"], "boom")).toEqual({ title: "Could not open 2 folders", detail: "/a\n/b\nboom" });
    expect(openFailure([], " ")).toEqual({ title: "Could not open the workspace", detail: "Unknown error" });
  });
});
