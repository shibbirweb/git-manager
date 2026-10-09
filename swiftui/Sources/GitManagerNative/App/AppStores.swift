// Parts of the window's state kept apart from AppModel, so a change re-renders only the views that show it: every
// view observing AppModel ran its body again when a diff opened or the memory readout ticked (every 2 seconds).
// AppModel forwards openDiff and memoryBytes here, so its callers do not change.

import Foundation

/// The diff in the main area: MainArea and the Changes rows (their selection) observe it.
@MainActor
final class DiffStore: ObservableObject {
    static let shared = DiffStore()

    @Published var openDiff: OpenDiff?
    /// The first diff's file name while its texts are read: its tab shows at once over an empty editor, as on the
    /// page. With a diff open, that diff stays until the new one is ready.
    @Published var pendingName: String?
}

/// The status bar's memory readout.
@MainActor
final class MemoryReadout: ObservableObject {
    static let shared = MemoryReadout()

    @Published var bytes: UInt64?
}
