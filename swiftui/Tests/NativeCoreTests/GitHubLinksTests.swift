// The welcome screen's GitHub links, checked against releases.ts and URLSearchParams.

import NativeCore
import Testing

@Test func bugReportCarriesVersionAndPlatformLikeURLSearchParams() {
    #expect(GitHubLinks.bugReport(version: "0.1.0-beta.6", platform: "macOS 26.4")
        == "https://github.com/shibbirweb/git-manager/issues/new?template=bug_report.yml&labels=bug"
        + "&version=0.1.0-beta.6&platform=macOS+26.4")
    #expect(GitHubLinks.bugReport(version: nil, platform: "Win/11")
        == "https://github.com/shibbirweb/git-manager/issues/new?template=bug_report.yml&labels=bug"
        + "&platform=Win%2F11")
}

@Test func featureRequestUsesItsTemplate() {
    #expect(GitHubLinks.featureRequest()
        == "https://github.com/shibbirweb/git-manager/issues/new?template=feature_request.yml&labels=enhancement")
}
