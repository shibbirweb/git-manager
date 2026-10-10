// The Clone dialog's rules, checked against values from gitOptions.ts (run with Bun).

import NativeCore
import Testing

@Test func folderNameIsTheLastPartWithoutGitOrBundle() {
    let cases = ["https://github.com/owner/repo.git": "repo", "git@github.com:owner/repo.git": "repo",
                 "/w/repo/.git/": "repo", "C:\\w\\x.bundle": "x", "https://h/a/b/": "b", "": ""]
    for (url, expected) in cases {
        #expect(CloneRules.folderName(url) == expected, "\(url)")
    }
}

@Test func urlsAndFolderNamesAreChecked() {
    #expect(CloneRules.urlError("  ") == "Enter a URL")
    #expect(CloneRules.urlError("-x") == "Not a valid URL")
    #expect(CloneRules.urlError("ok") == nil)
    #expect(CloneRules.folderNameError("") == "Enter a folder name")
    for name in [".", "..", "a/b", "a\\b"] {
        #expect(CloneRules.folderNameError(name) == "Not a valid folder name", "\(name)")
    }
    #expect(CloneRules.folderNameError("good") == nil)
}
