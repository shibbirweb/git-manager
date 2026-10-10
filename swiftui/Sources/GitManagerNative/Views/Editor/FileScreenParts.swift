// The parts of FileScreen that follow every change of the text or the cursor, each in a view of its own so a
// keystroke renders them and not the screen around them: the file bar (Unsaved, "1 of 2"), the overview ruler (its
// ticks only when the text, the folds or the marks change) and the find bar (open or not, its fields and counter).

import NativeCore
import SwiftUI

struct FileBarFollower: View {
    @EnvironmentObject private var editor: EditorModel
    @EnvironmentObject private var changes: EditorChanges
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var files: FilesModel

    let file: OpenFile

    var body: some View {
        FileBar(folderName: model.folderName, relativePath: file.relativePath, tone: files.tones[file.path],
                dirty: editor.session?.dirty ?? false, changeLabel: editor.changeLabel,
                hasChanges: !(editor.session?.marks.isEmpty ?? true), go: { editor.goToChange(forward: $0) })
            // Rendered again only when what it shows changes, not at every cursor move.
            .equatable()
    }
}

struct FileRulerFollower: View {
    @EnvironmentObject private var changes: EditorChanges

    let session: EditorSession

    var body: some View {
        FileRuler(session: session, docRevision: session.docRevision, paintRevision: session.paintRevision)
    }
}

struct FindBarSlot: View {
    @ObservedObject var find: FindState
    let editor: EditorModel

    var body: some View {
        if find.open {
            FindBar(find: find, editor: editor)
        }
    }
}

extension FileBar: Equatable {
    static func == (left: FileBar, right: FileBar) -> Bool {
        left.folderName == right.folderName && left.relativePath == right.relativePath && left.tone == right.tone
            && left.dirty == right.dirty && left.changeLabel == right.changeLabel
            && left.hasChanges == right.hasChanges
    }
}
