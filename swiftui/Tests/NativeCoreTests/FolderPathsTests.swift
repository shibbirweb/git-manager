// Workspace folder paths, checked against what the current app's workspacePaths.ts and tones.ts decide.

import NativeCore
import Testing

private let roots = ["/w/acme", "/w/design-system", "/w/acme/storefront/vendor-ws"]

@Test func theDeepestWorkspaceFolderHoldsAPath() {
    #expect(FolderPaths.root(of: "/w/acme/storefront/src/cart.ts", roots: roots) == "/w/acme")
    #expect(FolderPaths.root(of: "/w/acme/storefront/vendor-ws/a.ts", roots: roots) == "/w/acme/storefront/vendor-ws")
    #expect(FolderPaths.root(of: "/w/design-system", roots: roots) == "/w/design-system")
    #expect(FolderPaths.root(of: "/w/acme-old/x", roots: roots) == nil)
}

@Test func tonesReachUpToTheWorkspaceFolderOnly() {
    #expect(FolderPaths.folders(of: "/w/acme/storefront/src/cart.ts", roots: roots)
        == ["/w/acme/storefront/src", "/w/acme/storefront", "/w/acme"])
    #expect(FolderPaths.folders(of: "/w/design-system/README.md", roots: roots) == ["/w/design-system"])
    #expect(FolderPaths.folders(of: "/elsewhere/file", roots: roots) == [])
    #expect(FolderPaths.parent("/w") == "/")
}
