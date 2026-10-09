import SwiftUI

/// Tréninkové zóny: run and bike separately, thresholds, the zone preset (the
/// same presets as Intervals.icu) and the resulting zones.
struct ZonesSettingsView: View {
    let store: SettingsStore
    @State private var sport = "run"
    @State private var ftp = ""
    @State private var lthr = ""
    @State private var maxHr = ""
    @State private var runPace = ""
    @State private var runLthr = ""
    @State private var powerModel = "coggan7"
    @State private var hrModel = "frielLthr"
    @State private var paceModel = "friel"
    @State private var original: JSONObject = [:]

    var body: some View {
        SettingsPage(title: "Zóny") {
            Picker("Sport", selection: $sport) {
                Text("Běh").tag("run")
                Text("Kolo").tag("bike")
            }
            .pickerStyle(.segmented)

            if let training = store.training {
                if sport == "run" { run(training) } else { bike(training) }
                Text("Prázdné prahy se berou z Intervals.icu. Zápis zón zpět do Intervals.icu přijde, až aplikace dostane oprávnění měnit tam nastavení.")
                    .font(Typo.caption).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            } else if store.demo {
                Text("V ukázce se zóny nenačítají.").font(Typo.small).foregroundStyle(Palette.muted)
            } else if store.loaded {
                Text("Zóny se nepodařilo načíst.").font(Typo.small).foregroundStyle(Palette.muted)
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .toolbar { SaveButton(enabled: changes != original, saving: store.saving) { Task { await save() } } }
        .onAppear(perform: fill)
        .onChange(of: store.training) { fill() }
    }

    // MARK: Run

    @ViewBuilder
    private func run(_ t: TrainingProfileResponse) -> some View {
        SettingsGroup(title: "Prahové hodnoty") {
            SettingsField(title: "Prahové tempo", text: $runPace, unit: "/km", keyboard: .numbersAndPunctuation, placeholder: t.resolved.runThresholdPace.map(Self.pace) ?? "m:ss")
            SettingsDivider()
            SettingsField(title: "Prahový tep", text: $runLthr, unit: "bpm", keyboard: .numberPad, placeholder: t.resolved.runLthr.map { Fmt.int($0) } ?? "–")
        }
        SettingsGroup(title: "Tempové zóny", footer: "Procenta jsou z prahové rychlosti.") {
            SettingsPicker(title: "Předvolba", selection: $paceModel, options: t.paceZoneModels.map { ($0.id, $0.label) })
            ForEach(t.paceZones) { z in
                SettingsDivider()
                ZoneRow(name: z.name, percent: z.percentHigh.map { Fmt.decimal($0, digits: $0.rounded() == $0 ? 0 : 1) + " %" },
                        range: paceRange(z))
            }
        }
        if let zones = t.runHrZones, !zones.isEmpty {
            SettingsGroup(title: "Tepové zóny pro běh") {
                ForEach(Array(zones.enumerated()), id: \.element.id) { i, z in
                    if i > 0 { SettingsDivider() }
                    ZoneRow(name: z.name, percent: nil, range: bpmRange(z))
                }
            }
        }
    }

    // MARK: Bike

    @ViewBuilder
    private func bike(_ t: TrainingProfileResponse) -> some View {
        SettingsGroup(title: "Prahové hodnoty") {
            SettingsField(title: "FTP", text: $ftp, unit: "W", keyboard: .numberPad, placeholder: t.resolved.ftp.map { Fmt.int($0) } ?? "–")
            SettingsDivider()
            SettingsField(title: "Prahový tep", text: $lthr, unit: "bpm", keyboard: .numberPad, placeholder: t.resolved.lthr.map { Fmt.int($0) } ?? "–")
            SettingsDivider()
            SettingsField(title: "Maximální tep", text: $maxHr, unit: "bpm", keyboard: .numberPad, placeholder: t.resolved.maxHr.map { Fmt.int($0) } ?? "–")
        }
        SettingsGroup(title: "Výkonové zóny", footer: "Procenta jsou z FTP.") {
            SettingsPicker(title: "Předvolba", selection: $powerModel, options: t.powerZoneModels.map { ($0.id, $0.label) })
            ForEach(t.powerZones) { z in
                SettingsDivider()
                ZoneRow(name: z.name, percent: z.percentHigh.map { Fmt.int($0) + " %" }, range: wattRange(z))
            }
        }
        SettingsGroup(title: "Tepové zóny pro kolo") {
            SettingsPicker(title: "Předvolba", selection: $hrModel, options: t.hrZoneModels.map { ($0.id, $0.label) })
            ForEach(t.hrZones) { z in
                SettingsDivider()
                ZoneRow(name: z.name, percent: nil, range: bpmRange(z))
            }
        }
    }

    // MARK: Values

    static func pace(_ seconds: Double) -> String {
        let s = Int(seconds.rounded())
        return "\(s / 60):" + String(format: "%02d", s % 60)
    }

    private func paceRange(_ z: TrainingProfileResponse.PaceZone) -> String {
        switch (z.paceSlow, z.paceFast) {
        case (let slow?, let fast?): return Self.pace(fast) + "–" + Self.pace(slow)
        case (nil, let fast?): return "nad " + Self.pace(fast)
        case (let slow?, nil): return "pod " + Self.pace(slow)
        default: return "–"
        }
    }

    private func bpmRange(_ z: TrainingProfileResponse.HRZone) -> String {
        switch (z.bpmLow, z.bpmHigh) {
        case (let low?, let high?): return Fmt.int(low) + "–" + Fmt.int(high)
        case (nil, let high?): return "do " + Fmt.int(high)
        case (let low?, nil): return Fmt.int(low) + "+"
        default: return "–"
        }
    }

    private func wattRange(_ z: TrainingProfileResponse.PowerZone) -> String {
        switch (z.wattsLow, z.wattsHigh) {
        case (let low?, let high?): return Fmt.int(low) + "–" + Fmt.int(high) + " W"
        case (let low?, nil): return Fmt.int(low) + "+ W"
        default: return "–"
        }
    }

    private func fill() {
        let p = store.training?.profile ?? [:]
        ftp = p["ftp"]?.string ?? ""
        lthr = p["lthr"]?.string ?? ""
        maxHr = p["maxHr"]?.string ?? ""
        runPace = (p["runThresholdPace"]?.number).map(Self.pace) ?? ""
        runLthr = p["runLthr"]?.string ?? ""
        powerModel = p["powerZoneModel"]?.string ?? "coggan7"
        hrModel = p["hrZoneModel"]?.string ?? "frielLthr"
        paceModel = p["paceZoneModel"]?.string ?? "friel"
        original = changes
    }

    private var changes: JSONObject {
        [
            "ftp": .field(ftp), "lthr": .field(lthr), "maxHr": .field(maxHr),
            // "4:35" goes as text, the server reads m:ss.
            "runThresholdPace": runPace.trimmingCharacters(in: .whitespaces).isEmpty ? .null : .string(runPace),
            "runLthr": .field(runLthr),
            "powerZoneModel": .string(powerModel), "hrZoneModel": .string(hrModel), "paceZoneModel": .string(paceModel)
        ]
    }

    private func save() async {
        if await store.saveTraining(changes) { fill() }
    }
}

/// "Z2 Aerobní · 87,7 % · 5:14–5:55".
struct ZoneRow: View {
    let name: String
    let percent: String?
    let range: String

    var body: some View {
        HStack(spacing: 10) {
            Text(name).font(.subheadline).foregroundStyle(Palette.ink).lineLimit(1)
            Spacer(minLength: 6)
            if let percent { Text(percent).font(.caption).foregroundStyle(Palette.faint) }
            Text(range).font(Typo.number(17)).foregroundStyle(Palette.ink).frame(minWidth: 82, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
    }
}
