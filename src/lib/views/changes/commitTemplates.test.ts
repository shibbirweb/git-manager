import { describe, expect, it } from "vitest";
import {
  expandTemplate,
  isoDate,
  MAX_COMMIT_TEMPLATES,
  parseCommitTemplates,
  splitGitTemplate,
  subjectLength,
  subjectWarning,
  ticketFromBranch,
  validateTemplateName,
} from "./commitTemplates";

const DATE = new Date(2026, 9, 3, 12, 0, 0);

describe("commit templates", () => {
  it("finds the ticket in a branch name", () => {
    expect(ticketFromBranch("feat/GM-8-terminal-git-menu")).toBe("GM-8");
    expect(ticketFromBranch("ABC-123")).toBe("ABC-123");
    expect(ticketFromBranch("bugfix/KPDV2-2109-export")).toBe("KPDV2-2109");
    expect(ticketFromBranch("feature/abc-123-fix-login")).toBe("ABC-123");
    expect(ticketFromBranch("release-2")).toBeNull();
    expect(ticketFromBranch("fix-12-crash")).toBeNull();
    expect(ticketFromBranch("main")).toBeNull();
    expect(ticketFromBranch("x86-64")).toBeNull();
    expect(ticketFromBranch("MYGM-12")).toBe("MYGM-12");
    expect(ticketFromBranch(null)).toBeNull();
    expect(ticketFromBranch("")).toBeNull();
  });

  it("fills in the placeholders and finds the caret", () => {
    const context = { branch: "feat/GM-12-search", userName: "Ann Lee", date: DATE };
    expect(expandTemplate("feat:[{ticket}] {cursor}", context)).toEqual({ text: "feat:[GM-12] ", cursor: 13 });
    expect(expandTemplate("{branch} by {user} on {date}", context).text).toBe("feat/GM-12-search by Ann Lee on 2026-10-03");
    expect(expandTemplate("a{cursor}b{cursor}c", context)).toEqual({ text: "abc", cursor: 1 });
    expect(expandTemplate("{unknown} {ticket", context)).toEqual({ text: "{unknown} {ticket", cursor: null });
    const detached = { branch: null, userName: null, date: DATE };
    expect(expandTemplate("[{ticket}] {branch}{user}", detached).text).toBe("[] ");
  });

  it("formats the date in local time", () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("validates templates from settings.json", () => {
    expect(parseCommitTemplates("nope")).toEqual([]);
    expect(
      parseCommitTemplates([
        { name: " Feature ", text: "feat: " },
        { name: "", text: "x" },
        { name: "No text" },
        { name: "x".repeat(81), text: "x" },
        { name: "Huge", text: "x".repeat(10_001) },
        null,
        { name: "Fix", text: "fix: ", extra: true },
      ]),
    ).toEqual([
      { name: "Feature", text: "feat: " },
      { name: "Fix", text: "fix: " },
    ]);
    const many = Array.from({ length: 60 }, (_, index) => ({ name: `t${index}`, text: "" }));
    expect(parseCommitTemplates(many)).toHaveLength(MAX_COMMIT_TEMPLATES);
  });

  it("checks template names", () => {
    const templates = [
      { name: "Feature", text: "" },
      { name: "Fix", text: "" },
    ];
    expect(validateTemplateName("  ", templates, 0)).toBe("Give the template a name");
    expect(validateTemplateName("fix", templates, 0)).toBe("Another template has this name");
    expect(validateTemplateName("Fix", templates, 1)).toBeNull();
    expect(validateTemplateName("x".repeat(81), templates, 0)).not.toBeNull();
  });

  it("splits a commit.template file into text and comments", () => {
    expect(splitGitTemplate("\n# Why is this change needed?\n#\n# Ticket:\n")).toEqual({
      text: "",
      comments: "Why is this change needed?\nTicket:",
    });
    expect(splitGitTemplate("feat: \r\n\r\n# Explain\r\nBody line\n\n")).toEqual({ text: "feat: \n\nBody line", comments: "Explain" });
    expect(splitGitTemplate("; note\nsubject", ";")).toEqual({ text: "subject", comments: "note" });
  });

  it("measures the subject line", () => {
    expect(subjectLength("")).toBe(0);
    expect(subjectLength("\n\nfeat: x  \nbody that is long")).toBe(7);
    expect(subjectLength("ü".repeat(5))).toBe(5);
    expect(subjectWarning("a".repeat(72))).toBeNull();
    expect(subjectWarning("a".repeat(73))).toBe("Subject is 73 characters; keep it to 72");
    expect(subjectWarning("a".repeat(11), 10)).not.toBeNull();
  });
});
