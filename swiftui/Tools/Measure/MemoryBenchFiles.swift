// gm-measure memory's repository and report (MemoryBench.swift).

import Foundation
import MeasureKit

extension MemoryBench {
    /// A repository in `workDir`/bench with MemoryBench.fileName committed, then every eighth line changed.
    static func makeRepo(in workDir: String, lines: Int) throws -> String {
        let repoPath = (workDir as NSString).appendingPathComponent("bench")
        let filePath = (repoPath as NSString).appendingPathComponent(fileName)
        try FileManager.default.createDirectory(
            atPath: (filePath as NSString).deletingLastPathComponent, withIntermediateDirectories: true
        )
        let original = phpSource(lines: lines)
        try original.joined(separator: "\n").appending("\n").write(toFile: filePath, atomically: true, encoding: .utf8)
        try git(["init", "-q", "-b", "main"], in: repoPath)
        try git(["add", "."], in: repoPath)
        try git(["commit", "-q", "-m", "Inventory"], in: repoPath)
        let changed = original.enumerated().map { index, line in
            index % 8 == 4 ? line + " // v2" : line
        }
        try changed.joined(separator: "\n").appending("\n").write(toFile: filePath, atomically: true, encoding: .utf8)
        print("Repository with a \(lines)-line PHP file: \(repoPath)")
        return repoPath
    }

    /// Git without the user's configuration, so the repository is the same on every machine.
    private static func git(_ arguments: [String], in repoPath: String) throws {
        let environment = ["GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_NOSYSTEM=1"]
        let identity = ["-c", "user.name=gm-measure", "-c", "user.email=gm-measure@example.com"]
        let result = try AppLauncher.run(
            "/usr/bin/env", environment + ["git"] + identity + arguments, in: repoPath
        )
        if result.status != 0 {
            throw ToolError("git \(arguments.joined(separator: " ")): \(result.output)")
        }
    }

    /// Plausible PHP: a class of small methods, each with a doc comment, so both apps highlight real code.
    static func phpSource(lines: Int) -> [String] {
        var out = [
            "<?php", "", "declare(strict_types=1);", "", "namespace Acme\\Store;", "", "final class Inventory", "{",
        ]
        var method = 0
        while out.count < lines - 1 {
            method += 1
            out += [
                "    /**",
                "     * Reserves stock for item \(method) and returns what is left.",
                "     */",
                "    public function reserve\(method)(array $items, int $quantity = \(method % 9 + 1)): int",
                "    {",
                "        $left = $this->stock[\(method)] ?? 0;",
                "        foreach ($items as $sku => $count) {",
                "            if ($count > $left) {",
                "                throw new \\RuntimeException(\"Not enough stock for {$sku}\");",
                "            }",
                "            $left -= $count * $quantity;",
                "        }",
                "        return $this->stock[\(method)] = max(0, $left);",
                "    }",
                "",
            ]
        }
        return Array(out.prefix(lines - 1)) + ["}"]
    }

    /// The walk's time and frames: the current app reports its frame stats, the native app its frame and slow
    /// frame counts.
    private static func scrollSummary(_ run: AppRun) -> String {
        let duration = run.scroll["durationMs"] as? Int ?? 0
        if let stats = run.scroll["frames"] as? [String: Any] {
            let frames = stats["frames"] as? Int ?? 0
            let dropped = stats["droppedFrames"] as? Int ?? 0
            return "\(run.kind.rawValue) \(duration) ms, \(frames) frames, \(dropped) dropped"
        }
        let frames = run.scroll["frames"] as? Int ?? 0
        let slow = run.scroll["slowFrames"] as? Int ?? 0
        return "\(run.kind.rawValue) \(duration) ms, \(frames) frames, \(slow) slow"
    }

    static func write(_ runs: [AppRun], lines: Int, speed: Int, outDir: String) throws {
        var text = "# Memory with a big file\n\n"
        text += "A \(lines)-line PHP file with every eighth line changed, shown as a diff (nothing folds) and "
        text += "scrolled down and back at \(speed) points a frame. Memory as Activity Monitor counts it, all "
        text += "processes of the app; deltas against idle.\n\n"
        text += "| App | Phase | Average MB | Peak MB | Average vs idle |\n| --- | --- | --- | --- | --- |\n"
        var json: [[String: Any]] = []
        for run in runs {
            let idle = run.phases.first?.avgMb ?? 0
            for phase in run.phases {
                let delta = phase.avgMb - idle
                text += "| \(run.kind.rawValue) | \(phase.name) | \(format(phase.avgMb)) | \(format(phase.maxMb)) | "
                text += "\(delta >= 0 ? "+" : "")\(format(delta)) |\n"
            }
            json.append([
                "app": run.kind.rawValue,
                "phases": run.phases.map { ["name": $0.name, "avgMb": $0.avgMb, "maxMb": $0.maxMb] },
                "scroll": run.scroll,
            ])
        }
        text += "\nScrolling: " + runs.map(scrollSummary).joined(separator: "; ") + ".\n"
        let reportPath = (outDir as NSString).appendingPathComponent("report.md")
        try text.write(toFile: reportPath, atomically: true, encoding: .utf8)
        let data = try JSONSerialization.data(withJSONObject: ["lines": lines, "speed": speed, "apps": json],
                                              options: [.prettyPrinted, .sortedKeys])
        try data.write(to: URL(fileURLWithPath: (outDir as NSString).appendingPathComponent("report.json")))
        print(text)
        print("Saved in \(outDir)")
    }
}
