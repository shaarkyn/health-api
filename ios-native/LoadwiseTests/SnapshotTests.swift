import SwiftUI
import XCTest
@testable import Loadwise

/// Renders whole screens with the sample data to PNG, in light and dark mode.
/// CI passes SNAPSHOT_DIR (as TEST_RUNNER_SNAPSHOT_DIR) and uploads the images,
/// so the design can be checked without a Mac.
@MainActor
final class SnapshotTests: XCTestCase {
    private var outputDirectory: URL {
        let path = ProcessInfo.processInfo.environment["SNAPSHOT_DIR"]
        return path.map { URL(fileURLWithPath: $0) } ?? FileManager.default.temporaryDirectory.appending(path: "snapshots")
    }

    func testTodayScreen() throws {
        try render("today", glow: Palette.Glow.today) { TodayContent(today: DemoData.today).padding(.top, 50).padding(.bottom, 40).environment(AppModel(demo: true)) }
    }

    func testTrainingScreen() throws {
        try render("training", glow: Palette.Glow.training) { TrainingContent(training: DemoData.training).padding(.top, 50).padding(.bottom, 40).environment(AppModel(demo: true)) }
    }

    func testFormDetailScreen() throws {
        try render("training-form", glow: Palette.Glow.training) { FormDetailContent(training: DemoData.training).padding(.top, 50).padding(.bottom, 40) }
    }

    func testTrainingDemoDecodes() {
        let t = DemoData.training
        XCTAssertEqual(t.week, 41)
        XCTAssertEqual(t.days.count, 7)
        XCTAssertEqual(t.next?.exercises.first, "Dřep")
        XCTAssertEqual(t.event?.phases.map(\.state), ["done", "now", "next"])
        XCTAssertEqual(Fmt.weekdayShort("2026-10-08"), "Čt")
        XCTAssertEqual(Fmt.dayMonth("2026-11-01"), "1. listopadu")
        XCTAssertEqual(Fmt.relativeDay("2026-10-10", today: "2026-10-08"), "v sobotu")
        XCTAssertEqual(Fmt.duration(75), "1 h 15 min")
        XCTAssertEqual(Fmt.plural(24, "den", "dny", "dní"), "dní")
    }

    func testSignInScreen() throws {
        try render("login", height: 844) { LoginView().environment(AppModel()) }
    }

    func testDemoDataDecodes() {
        let today = DemoData.today
        XCTAssertEqual(today.readiness.score, 78)
        XCTAssertEqual(today.plan.count, 2)
        XCTAssertEqual(today.steps.hourly?.reduce(0, +), today.steps.today)
        XCTAssertEqual(Fmt.dayHeading(today.date), "ČTVRTEK 8. ŘÍJNA")
        XCTAssertEqual(Fmt.hoursMinutes(432), "7:12")
        XCTAssertEqual(Fmt.decimal(8.4), "8,4")
    }

    func testDayShift() {
        XCTAssertEqual(AppModel.shift("2026-10-09", by: -1), "2026-10-08")
        XCTAssertEqual(AppModel.shift("2026-03-01", by: -1), "2026-02-28")
        XCTAssertEqual(AppModel.shift("2026-10-25", by: 1), "2026-10-26", "across the end of summer time")
    }

    func testServerResponseDecodes() throws {
        // The shape src/app-today.js returns when there is no data yet.
        let json = """
        {"status":"ok","date":"2026-10-08","readiness":{"score":null,"zone":null,"missing":["hrv"],"flags":[]},"sleep":null,
         "strain":{"score":null,"planned":null},"hrv":null,"restingHR":null,"summary":null,
         "nutrition":{"kcal":null,"target":null,"trainingBonus":null,"protein":{"eaten":null,"target":null},"carbs":{"eaten":null,"target":null},
         "fat":{"eaten":null,"target":null},"water":{"ml":null,"target":null}},"plan":[],"tonight":null,
         "steps":{"today":null,"goal":10000,"week":[],"hourly":null,"usual":null,"hour":12},"weight":null}
        """
        let today = try JSONDecoder().decode(TodaySnapshot.self, from: Data(json.utf8))
        XCTAssertNil(today.readiness.score)
        XCTAssertEqual(today.steps.goal, 10000)
    }

    func testEmptyTrainingDecodes() throws {
        // The shape src/app-training.js returns without any data.
        let json = """
        {"status":"ok","date":"2026-10-08","week":41,"strain":{"score":null,"target":null,"band":null},
         "days":[{"date":"2026-10-05","strain":null,"planned":null,"today":false}],"next":null,"event":null,"form":null,
         "load":{"weeks":[{"start":"2026-10-05","week":41,"load":0,"planned":0}],"intensity":null},"zones":null,"vo2max":null,
         "activeCalories":null,"thisWeek":{"done":0,"planned":0,"doneLoad":0,"plannedLoad":0}}
        """
        let t = try JSONDecoder().decode(TrainingSnapshot.self, from: Data(json.utf8))
        XCTAssertNil(t.next)
        XCTAssertEqual(t.thisWeek.planned, 0)
    }

    private func render<V: View>(_ name: String, glow: Color = Palette.Glow.today, height: CGFloat? = nil, @ViewBuilder _ content: () -> V) throws {
        try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
        for (suffix, scheme) in [("light", ColorScheme.light), ("dark", ColorScheme.dark)] {
            let view = content()
                .frame(width: 390, height: height)
                .background(ScreenBackground(glow: glow))
                .environment(\.colorScheme, scheme)
            let renderer = ImageRenderer(content: view)
            renderer.scale = 2
            let data = try XCTUnwrap(renderer.uiImage?.pngData(), "\(name) did not render")
            try data.write(to: outputDirectory.appending(path: "\(name)-\(suffix).png"))
        }
    }
}
