// The Log's commit graph lanes, ported from src/lib/log/graph.ts (GraphBuilder) and checked against its tests. Fed
// commits in log order (children before parents), page after page; the lane state stays between calls, so the rows
// are the same as laying out the whole history at once.

public enum GraphSegmentKind: Int16, Sendable {
    /// From the top of lane `from` to the bottom of lane `to`.
    case pass = 0
    /// From the top of lane `from` to the node.
    case incoming = 1
    /// From the node to the bottom of lane `to`.
    case outgoing = 2
}

public struct GraphSegment: Equatable, Sendable {
    public let kind: GraphSegmentKind
    public let from: Int
    public let to: Int
    public let color: Int
}

public struct GraphRow: Equatable, Sendable {
    /// The column of the commit's node.
    public let lane: Int
    /// The node's color index.
    public let color: Int
    /// How many lane columns the row needs.
    public let width: Int
    /// Flat kind, from, to, color quadruples: 100k rows of 20 lanes stay small, as in graph.ts's typed arrays.
    public let edges: [Int32]

    public var segments: [GraphSegment] {
        var result: [GraphSegment] = []
        var index = 0
        while index + 3 < edges.count {
            let kind = GraphSegmentKind(rawValue: Int16(edges[index])) ?? .pass
            let from = Int(edges[index + 1])
            let to = Int(edges[index + 2])
            result.append(GraphSegment(kind: kind, from: from, to: to, color: Int(edges[index + 3])))
            index += 4
        }
        return result
    }
}

public struct GraphCommit: Sendable {
    public let commitId: String
    public let parents: [String]

    public init(commitId: String, parents: [String]) {
        self.commitId = commitId
        self.parents = parents
    }
}

public final class GraphBuilder {
    private struct Lane {
        let expect: String
        let color: Int
    }

    private var lanes: [Lane?] = []
    private var nextColor = 0
    private let colorCount: Int
    /// The widest row so far.
    public private(set) var maxWidth = 0

    public init(colorCount: Int = 8) {
        self.colorCount = max(1, colorCount)
    }

    public func push(_ commits: [GraphCommit]) -> [GraphRow] {
        commits.map(next)
    }

    public func next(_ commit: GraphCommit) -> GraphRow {
        var edges: [Int32] = []
        let widthBefore = lanes.count
        let incoming = lanes.indices.filter { lanes[$0]?.expect == commit.commitId }

        let lane: Int
        let color: Int
        if let first = incoming.first {
            lane = first
            color = lanes[first]?.color ?? 0
        } else {
            lane = firstFree()
            color = allocateColor()
        }
        for index in incoming {
            edges += [1, Int32(index), Int32(lane), Int32(lanes[index]?.color ?? color)]
        }
        for (index, current) in lanes.enumerated() {
            if let current, current.expect != commit.commitId {
                edges += [0, Int32(index), Int32(index), Int32(current.color)]
            }
        }
        for index in incoming {
            lanes[index] = nil
        }

        let parents = Self.uniqueParents(commit.parents)
        if let firstParent = parents.first {
            setLane(lane, Lane(expect: firstParent, color: color))
            edges += [2, Int32(lane), Int32(lane), Int32(color)]
            for parent in parents.dropFirst() {
                var target = lanes.firstIndex { $0?.expect == parent } ?? -1
                if target == -1 {
                    target = firstFree()
                    setLane(target, Lane(expect: parent, color: allocateColor()))
                }
                edges += [2, Int32(lane), Int32(target), Int32(lanes[target]?.color ?? color)]
            }
        }

        let width = max(widthBefore, lanes.count, lane + 1)
        while let last = lanes.last, last == nil {
            lanes.removeLast()
        }
        maxWidth = max(maxWidth, width)
        return GraphRow(lane: lane, color: color, width: width, edges: edges)
    }

    private func firstFree() -> Int {
        lanes.firstIndex { $0 == nil } ?? lanes.count
    }

    private func setLane(_ index: Int, _ value: Lane) {
        while lanes.count < index {
            lanes.append(nil)
        }
        if index == lanes.count {
            lanes.append(value)
        } else {
            lanes[index] = value
        }
    }

    private func allocateColor() -> Int {
        let color = nextColor % colorCount
        nextColor += 1
        return color
    }

    private static func uniqueParents(_ parents: [String]) -> [String] {
        var result: [String] = []
        for parent in parents where !result.contains(parent) {
            result.append(parent)
        }
        return result
    }
}
