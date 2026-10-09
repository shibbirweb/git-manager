import NativeCore
import Testing

@Suite struct ResultRowLayoutTests {
    @Test func fileRowPlacesItsPieces() {
        let row = ResultRowLayout.file(left: 4, right: 700, nameWidth: 80.5, folderWidth: 120, countWidth: 6.25)
        #expect(row.icon == 12)
        #expect(row.name == 31)
        #expect(row.folder == 117.5)
        #expect(row.folderRoom == 120)
        #expect(row.count == 685.75)
    }

    @Test func aLongFolderGivesWay() {
        let row = ResultRowLayout.file(left: 4, right: 300, nameWidth: 100, folderWidth: 400, countWidth: 6)
        // The count at 286, 12 points of gaps before it, the folder from 137.
        #expect(row.folder == 137)
        #expect(row.folderRoom == 137)
    }

    @Test func lineRowRightAlignsItsNumber() {
        let row = ResultRowLayout.line(left: 4, numberWidth: 20.5)
        #expect(row.number == 29.5)
        #expect(row.text == 58)
    }

    @Test func rowUnderAPoint() {
        #expect(ResultRowLayout.row(at: 1, scrollTop: 0, paddingTop: 2, count: 5) == nil)
        #expect(ResultRowLayout.row(at: 2, scrollTop: 0, paddingTop: 2, count: 5) == 0)
        #expect(ResultRowLayout.row(at: 30, scrollTop: 0, paddingTop: 2, count: 5) == 1)
        #expect(ResultRowLayout.row(at: 10, scrollTop: 52, paddingTop: 2, count: 5) == 2)
        #expect(ResultRowLayout.row(at: 200, scrollTop: 0, paddingTop: 2, count: 5) == nil)
    }
}
