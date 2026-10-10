import SwiftUI

/// Předplatné: what is free and what the AI plan adds (src/subscription.js).
/// During the invitation-only pilot everything is free and nothing can be
/// bought; the page is ready for the paid split (AI_PAYWALL_ENABLED). The
/// purchase itself (App Store) comes with the Apple Developer Program.
struct SubscriptionView: View {
    @Environment(AppModel.self) private var model
    @State private var status: SubscriptionStatus?
    @State private var error: String?

    var body: some View {
        SettingsPage(title: "Předplatné") {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(Palette.onAccent)
                    .frame(width: 56, height: 56)
                    .background(Palette.indigo, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                Text("Loadwise AI").font(Typo.sentence(30, relativeTo: .title)).foregroundStyle(Palette.ink)
                Text(headline).font(Typo.small).foregroundStyle(Palette.secondary).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 8)

            if let features = status?.features, !features.isEmpty {
                SettingsGroup(title: "Co je v čem") {
                    HStack {
                        Spacer()
                        Text("Zdarma").font(Typo.caption.weight(.semibold)).foregroundStyle(Palette.muted).frame(width: 56)
                        Text("AI").font(Typo.caption.weight(.semibold)).foregroundStyle(Palette.indigo).frame(width: 40)
                    }
                    .padding(.horizontal, 16).padding(.top, 10)
                    ForEach(Array(features.enumerated()), id: \.offset) { index, feature in
                        if index > 0 { SettingsDivider() }
                        HStack(spacing: 8) {
                            Text(verbatim: feature.name).font(.subheadline).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 8)
                            mark(!feature.ai).frame(width: 56)
                            mark(true, color: Palette.indigo).frame(width: 40)
                        }
                        .padding(.horizontal, 16).padding(.vertical, 11)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel(feature.name + ", " + L10n.tr(feature.ai ? "v AI předplatném" : "zdarma"))
                    }
                }
            } else if error == nil {
                ProgressView().frame(maxWidth: .infinity)
            }

            VStack(spacing: 8) {
                PrimaryButton(title: buttonTitle, systemImage: status?.hasAI == true ? "checkmark" : "sparkles") {}
                    .disabled(true)
                    .opacity(0.55)
                Text(buttonNote).font(Typo.caption).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }

            if let terms = status?.terms {
                Text(verbatim: terms).font(Typo.caption).foregroundStyle(Palette.faint).fixedSize(horizontal: false, vertical: true)
            }
            if let error { Text(error).font(Typo.small).foregroundStyle(Palette.rust) }
        }
        .task { await load() }
    }

    private var headline: String {
        guard let status else { return L10n.tr("AI kouč, čtení jídla z fotky, hodnocení tréninků a dne.") }
        if status.hasAI { return L10n.tr("Máš AI předplatné. Všechny AI funkce jsou odemčené.") }
        if status.pilot { return L10n.tr("Během pilotu pro pozvané je všechno zdarma, AI funkce taky. Později budou AI funkce součástí předplatného.") }
        return L10n.tr("AI kouč, čtení jídla z fotky a hodnocení tréninků jsou součástí AI předplatného. Všechno ostatní zůstává zdarma.")
    }

    private var buttonTitle: String {
        if status?.hasAI == true { return L10n.tr("Předplatné je aktivní") }
        return L10n.tr("Předplatit AI")
    }

    private var buttonNote: String {
        if status?.hasAI == true { return "" }
        if status?.pilot ?? true { return L10n.tr("V pilotu není co platit. Předplatné spustíme později a předem oznámíme cenu.") }
        return L10n.tr("Předplatné zatím nejde koupit v aplikaci.")
    }

    @ViewBuilder
    private func mark(_ on: Bool, color: Color = Palette.green) -> some View {
        Image(systemName: on ? "checkmark" : "minus")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(on ? color : Palette.faint)
    }

    private func load() async {
        if model.demo { status = .demo; return }
        do {
            status = try await model.api.subscription()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// In an AI feature without the subscription: what it is and the way to it,
/// instead of an error.
struct AISubscriptionCard: View {
    let open: () -> Void

    var body: some View {
        Card {
            Label("AI je součástí předplatného", systemImage: "sparkles").font(.headline).foregroundStyle(Palette.ink)
            Text("Kouč, čtení jídla z fotky a hodnocení tréninků patří do AI předplatného. Zápisy, přehledy a plány zůstávají zdarma.")
                .font(Typo.small).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            Button(action: open) {
                Text("Zobrazit předplatné").font(Typo.bodyStrong).foregroundStyle(Palette.onButton)
                    .frame(maxWidth: .infinity).frame(height: 46).background(Palette.button, in: Capsule())
            }
            .buttonStyle(.plain)
        }
    }
}
