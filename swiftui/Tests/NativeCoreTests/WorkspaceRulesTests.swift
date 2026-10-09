// The workspace rules, checked against what the current app's repo.svelte.ts, Header.svelte and sections.ts decide.

import NativeCore
import Testing

private let payments = WorkspaceRepo(root: "/w/acme/payments-api", name: "payments-api", relativePath: "payments-api")
private let storefront = WorkspaceRepo(root: "/w/acme/storefront", name: "storefront", relativePath: "storefront")
private let single = WorkspaceRepo(root: "/w/storefront", name: "storefront", relativePath: "")

@Test func activeRepositoryIsRememberedThenAFolderThenTheFirst() {
    let repos = [payments, storefront]
    #expect(WorkspaceRules.pickActive(repos, folderRoots: ["/w/acme"])?.root == payments.root)
    #expect(WorkspaceRules.pickActive(repos, folderRoots: ["/w/acme"], remembered: storefront.root) == storefront)
    #expect(WorkspaceRules.pickActive(repos, folderRoots: [storefront.root]) == storefront)
    #expect(WorkspaceRules.pickActive([], folderRoots: ["/w/acme"]) == nil)
}

@Test func repositoryPillShowsForSeveralOrANestedRepository() {
    #expect(WorkspaceRules.showsRepoPicker([payments, storefront], workspaceRoot: "/w/acme"))
    #expect(WorkspaceRules.showsRepoPicker([storefront], workspaceRoot: "/w/acme"))
    #expect(!WorkspaceRules.showsRepoPicker([single], workspaceRoot: "/w/storefront"))
    #expect(!WorkspaceRules.showsRepoPicker([], workspaceRoot: "/w/acme"))
}

@Test func unionKeepsFolderOrderAndDropsRepeats() {
    let acme = WorkspaceInfo(root: "/w/acme", name: "acme", repos: [payments, storefront])
    let inner = WorkspaceInfo(root: storefront.root, name: "storefront", repos: [storefront])
    #expect(WorkspaceRules.unionRepos([acme, inner]) == [payments, storefront])
    #expect(WorkspaceRules.workspaceName(["acme", "design-system"]) == "acme, design-system")
}

@Test func commitTargetAndItsChoices() {
    let repos = [payments, storefront]
    #expect(WorkspaceRules.commitTarget(repos, preferredRoot: nil, activeRoot: storefront.root) == storefront)
    #expect(WorkspaceRules.commitTarget(repos, preferredRoot: payments.root, activeRoot: storefront.root) == payments)
    #expect(WorkspaceRules.commitTarget(repos, preferredRoot: "/gone", activeRoot: nil) == payments)
    let counts = [payments.root: 20]
    #expect(WorkspaceRules.commitChoices(repos, changeCounts: counts, targetRoot: payments.root) == [payments])
    #expect(WorkspaceRules.commitChoices(repos, changeCounts: counts, targetRoot: storefront.root) == repos)
}

@Test func labelsAndPaths() {
    #expect(WorkspaceRules.choiceLabel(payments, staged: 4) == "payments-api, 4 staged")
    #expect(WorkspaceRules.choiceLabel(payments, staged: 0) == "payments-api")
    let nested = WorkspaceRepo(root: "/w/x/apps/web", name: "web", relativePath: "apps/web")
    #expect(WorkspaceRules.showsRelativePath(nested))
    #expect(!WorkspaceRules.showsRelativePath(payments))
    #expect(WorkspaceRules.choiceLabel(nested, staged: 1) == "web (apps/web), 1 staged")
    #expect(WorkspaceRules.folderPath(storefront, filePath: "src/app.ts") == "storefront/src/app.ts")
    #expect(WorkspaceRules.folderPath(single, filePath: "src/app.ts") == "src/app.ts")
    #expect(WorkspaceRules.opLabel("merge") == "Merging")
    #expect(WorkspaceRules.opLabel("none") == nil)
}
