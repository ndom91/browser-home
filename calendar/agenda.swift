// Prints today's events from the macOS calendar store as JSON.
// Exit codes: 0 ok, 2 access denied, 3 access request failed, 4 permission prompt timed out.

import AppKit
import EventKit
import Foundation

struct Event: Codable {
    let id: String
    let title: String
    let start: String
    let end: String
    let allDay: Bool
    let calendar: String
    let color: String?
    let location: String?
    let notes: String?
    let url: String?
    let status: String?
    let attendees: [String]
}

func fail(_ code: Int32, _ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(code)
}

// macOS privacy checks (TCC) ask the "responsible process", which is normally
// the app that launched us: the terminal, or node under launchd. Node has no
// calendar usage description, so it would be denied. Re-spawning ourselves with
// the disclaim flag makes this binary (and its embedded Info.plist) responsible,
// so one grant works from any parent. Private API, also used by Chromium/LLDB.
@_silgen_name("responsibility_spawnattrs_setdisclaim")
func responsibility_spawnattrs_setdisclaim(_ attr: UnsafeMutablePointer<posix_spawnattr_t?>, _ disclaim: Int32) -> Int32

let disclaimedEnv = "BROWSER_HOME_AGENDA_DISCLAIMED"
var childPid: pid_t = 0

if ProcessInfo.processInfo.environment[disclaimedEnv] == nil {
    var attr: posix_spawnattr_t?
    posix_spawnattr_init(&attr)
    _ = responsibility_spawnattrs_setdisclaim(&attr, 1)
    setenv(disclaimedEnv, "1", 1)

    let path = Bundle.main.executablePath ?? CommandLine.arguments[0]
    let rc = posix_spawn(&childPid, path, nil, &attr, CommandLine.unsafeArgv, environ)
    posix_spawnattr_destroy(&attr)
    if rc != 0 { fail(3, "posix_spawn failed: \(String(cString: strerror(rc)))") }

    // If node times us out, take the child down too. Otherwise it lingers,
    // waiting on a permission prompt nobody is watching.
    for sig in [SIGTERM, SIGINT] {
        signal(sig) { s in
            kill(childPid, s)
            _exit(128 + s)
        }
    }

    var status: Int32 = 0
    while waitpid(childPid, &status, 0) == -1 && errno == EINTR {}
    // WIFEXITED / WEXITSTATUS are macros Swift can't import.
    let exited = (status & 0x7f) == 0
    exit(exited ? (status >> 8) & 0xff : 1)
}

func hex(_ cg: CGColor?) -> String? {
    guard let cg, let c = NSColor(cgColor: cg)?.usingColorSpace(.sRGB) else { return nil }
    return String(format: "#%02x%02x%02x",
                  Int(round(c.redComponent * 255)),
                  Int(round(c.greenComponent * 255)),
                  Int(round(c.blueComponent * 255)))
}

func myStatus(_ e: EKEvent) -> String? {
    guard let me = e.attendees?.first(where: { $0.isCurrentUser }) else { return nil }
    switch me.participantStatus {
    case .accepted: return "accepted"
    case .declined: return "declined"
    case .tentative: return "tentative"
    case .pending: return "pending"
    default: return nil
    }
}

// Other people on the invite, without rooms or resources.
func others(_ e: EKEvent) -> [String] {
    (e.attendees ?? [])
        .filter { !$0.isCurrentUser && $0.participantType == .person }
        .compactMap { p in
            if let name = p.name, !name.isEmpty, !name.contains("@") { return name }
            return p.url.absoluteString.replacingOccurrences(of: "mailto:", with: "")
        }
}

let store = EKEventStore()

if EKEventStore.authorizationStatus(for: .event) != .fullAccess {
    let sem = DispatchSemaphore(value: 0)
    var granted = false
    var requestError: Error?
    store.requestFullAccessToEvents { ok, err in
        granted = ok
        requestError = err
        sem.signal()
    }
    // Don't wait forever if the parent died or nobody answers the prompt.
    if sem.wait(timeout: .now() + 60) == .timedOut {
        fail(4, "timed out waiting for calendar permission")
    }
    if let requestError { fail(3, "calendar access request failed: \(requestError.localizedDescription)") }
    if !granted { fail(2, "calendar access denied; grant it in System Settings > Privacy & Security > Calendars") }
}

let cal = Calendar.current
let dayStart = cal.startOfDay(for: Date())
let dayEnd = cal.date(byAdding: .day, value: 1, to: dayStart)!
let predicate = store.predicateForEvents(withStart: dayStart, end: dayEnd, calendars: nil)

let iso = ISO8601DateFormatter()
let events = store.events(matching: predicate)
    .sorted { $0.startDate < $1.startDate }
    .map { e in
        Event(
            id: e.calendarItemIdentifier + "@" + iso.string(from: e.startDate),
            title: e.title ?? "(no title)",
            start: iso.string(from: e.startDate),
            end: iso.string(from: e.endDate),
            allDay: e.isAllDay,
            calendar: e.calendar.title,
            color: hex(e.calendar.cgColor),
            location: e.location,
            notes: e.notes,
            url: e.url?.absoluteString,
            status: myStatus(e),
            attendees: others(e)
        )
    }

let encoder = JSONEncoder()
FileHandle.standardOutput.write(try encoder.encode(events))
