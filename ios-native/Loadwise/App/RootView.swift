import SwiftUI

enum AppTab: Hashable {
    case today, training, food, health
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    // "-tab training" (simulator screenshots) opens another tab first.
    @State private var tab: AppTab = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-tab"), i + 1 < args.count else { return .today }
        let tabs: [String: AppTab] = ["training": .training, "food": .food, "health": .health]
        return tabs[args[i + 1]] ?? .today
    }()
    @State private var showAdd = false
    @State private var showSettings = false
    @State private var showCoach = false

    var body: some View {
        if model.updateRequired {
            UpdateRequiredView()
        } else {
            screens
        }
    }

    @ViewBuilder private var screens: some View {
        switch model.phase {
        case .signedOut:
            LoginView()
        case .signedIn:
            ZStack(alignment: .bottom) {
                Group {
                    switch tab {
                    case .today: TodayView(openSettings: { showSettings = true }, openCoach: { showCoach = true })
                    case .training: TrainingView()
                    case .food: FoodView()
                    case .health: HealthView()
                    }
                }
                if model.offline {
                    OfflineBanner()
                        .frame(maxHeight: .infinity, alignment: .top)
                        .padding(.top, 4)
                }
                TabBar(tab: $tab, onAdd: { showAdd = true })
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
            }
            .sheet(isPresented: $showAdd) { AddSheet() }
            .sheet(isPresented: $showSettings) { SettingsView() }
            .sheet(isPresented: $showCoach) { CoachView() }
        }
    }
}

/// The server no longer serves this build: data would not load or would come
/// out wrong, so the app asks for the new version instead of the screens.
struct UpdateRequiredView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "arrow.down.app")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Palette.ink)
            Text("Je potřeba nová verze").font(Typo.sentence(30, relativeTo: .title)).foregroundStyle(Palette.ink)
            Text("Server se změnil a tahle verze aplikace už jeho data nepřečte správně. Nainstaluj novou verzi přes Sideloadly. Data zůstávají uložená na serveru.")
                .font(.subheadline)
                .foregroundStyle(Palette.muted)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.background)
    }
}

/// "Bez připojení": the screens show what was saved on the phone.
struct OfflineBanner: View {
    var body: some View {
        Label("Bez připojení · uložená data", systemImage: "wifi.slash")
            .font(.footnote.weight(.medium))
            .foregroundStyle(Palette.ink)
            .padding(.horizontal, 14).frame(height: 32)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(Palette.hairline, lineWidth: 1))
            .allowsHitTesting(false)
    }
}

/// The floating pill at the bottom with the "+" in the middle.
struct TabBar: View {
    @Binding var tab: AppTab
    var onAdd: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            item(.today, "sun.max", "Dnes")
            item(.training, "waveform.path.ecg", "Trénink")
            Button(action: onAdd) {
                Image(systemName: "plus")
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(Palette.onButton)
                    .frame(width: 44, height: 44)
                    .background(Palette.button, in: Circle())
            }
            .frame(maxWidth: .infinity)
            .accessibilityLabel("Přidat záznam")
            item(.food, "fork.knife", "Jídlo")
            item(.health, "heart", "Zdraví")
        }
        .frame(height: 60)
        .background(.ultraThinMaterial, in: Capsule())
        .background(Palette.card.opacity(0.6), in: Capsule())
        .overlay(Capsule().stroke(Palette.hairline, lineWidth: 1))
        .shadow(color: .black.opacity(0.1), radius: 15, y: 10)
    }

    private func item(_ value: AppTab, _ symbol: String, _ label: String) -> some View {
        Button { tab = value } label: {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(tab == value ? Palette.ink : Palette.faint)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(tab == value ? .isSelected : [])
    }
}

/// The "+" in the tab bar: food, water or weight.
struct AddSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var food = false
    @State private var weight = false
    @State private var workout = false
    @State private var water: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                Text("Co přidáme?").font(Typo.sentence(30, relativeTo: .title)).foregroundStyle(Palette.ink)
                Spacer()
                Button("Zavřít") { dismiss() }.font(.subheadline).foregroundStyle(Palette.muted)
            }
            HStack(spacing: 10) {
                tile("Jídlo", "fork.knife") { food = true }
                tile(water ?? "Voda 250 ml", "drop.fill") {
                    Task {
                        water = "Přidávám…"
                        await model.addWater(ml: 250)
                        water = "Přidáno ✓"
                    }
                }
                tile("Váha", "scalemass") { weight = true }
                tile("Trénink", "figure.run") { workout = true }
            }
            Spacer()
        }
        .padding(24)
        .presentationDetents([.height(240)])
        .presentationBackground(Palette.background)
        .sheet(isPresented: $food, onDismiss: { dismiss() }) { AddFoodSheet(meal: MealSlot.now()) }
        .sheet(isPresented: $weight, onDismiss: { dismiss() }) { WeightEntrySheet() }
        .sheet(isPresented: $workout, onDismiss: { dismiss() }) { ManualWorkoutSheet() }
    }

    private func tile(_ title: String, _ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: symbol).font(.system(size: 21))
                Text(title).font(.footnote.weight(.medium)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity).frame(height: 84)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
