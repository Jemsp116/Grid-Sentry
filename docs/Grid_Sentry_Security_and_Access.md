# Security and Access Document
## Project: Grid Sentry

**Version:** 1.0 (Draft)
**Author:** Jems
**Status:** Pre-development
**Written for:** a non-technical reader — plain English throughout, with technical terms explained the first time they appear

---

## 1. Authentication Method

**Recommended approach: Email + password login, combined with two types of "tickets" (tokens) that prove who you are.**

Here's the plain-English version of how this works:

- When someone logs in, the system gives them two things: a **short-lived pass** (called an access token) that expires after 15 minutes, and a **longer-lived pass** (called a refresh token) that lasts 7 days and is used to quietly get a new short-lived pass without making the user log in again.
- The short-lived pass expiring quickly limits the damage if it's ever stolen — it becomes useless in 15 minutes.
- The longer-lived pass is stored in a way that JavaScript in the browser can't read it (this blocks a common attack called cross-site scripting, or XSS, where a malicious script tries to steal your login).
- Because this is a security monitoring tool, we also keep a record of every long-lived pass that's ever been issued, so that if we need to force someone to be logged out immediately (for example, if we discover their account was compromised), we can do that instantly instead of waiting for the pass to naturally expire.

**Why this fits this app specifically:** a SOC dashboard has admins who can create rules, block IPs, and suspend other users — this is exactly the kind of tool attackers would want to break into. The ability to instantly revoke access, rather than just "wait for it to expire," is essential here in a way it wouldn't be for, say, a to-do list app.

We are **not** recommending "log in with Google/Microsoft" (SSO) for version one, because it adds complexity that isn't needed yet — it's a reasonable thing to add later once there's an actual team using the tool.

---

## 2. User Roles — What Each Role Can and Cannot Do

There are three roles. Every single action in the app must check a person's role before allowing it — this is called **enforcing permissions on the server**, meaning the check happens on the computer running the app, not just by hiding buttons in the browser (hiding a button is not security — a technically savvy person could still try to perform the action directly).

### Viewer
**Can do:**
- Log in and see the overview dashboard (charts, counts)
- View the alert feed and click into individual alerts to see details
- Search and view logs
- View the Geo-IP map

**Cannot do:**
- Change an alert's status (cannot mark something as resolved)
- Create, edit, or disable detection rules
- Suspend any user account
- Add or remove anything from the IP blocklist
- View the audit log (this is considered administrative information)

**Who this is for:** someone who needs visibility — for example, a manager who wants to check on security status but shouldn't be making changes.

### Analyst
**Can do:**
- Everything a Viewer can do
- Change an alert's status (New → Investigating → Resolved / False Positive)
- Add notes to alerts
- Manually add an IP to the blocklist (in response to something they find while investigating)

**Cannot do:**
- Create, edit, or disable detection rules (this is restricted to Admin, since a bad rule could either miss real attacks or flood the team with false alarms)
- Suspend a user account
- View or change other users' roles
- View the audit log

**Who this is for:** the day-to-day person doing the actual security monitoring work.

### Admin
**Can do:**
- Everything an Analyst can do
- Create, edit, enable/disable, and delete detection rules
- Suspend or reactivate any user account
- View the full audit log
- Change another user's role

**Cannot do:**
- Nothing is restricted for Admin within the app — but see Section 5 (Edge Cases) for important limits we still recommend putting on Admin power (for example, an Admin should not be able to suspend the only other remaining Admin account, or themselves, without a safeguard — see below).

**Who this is for:** the person responsible for the tool itself, not just for individual alerts — typically the team lead or the person who built the system.

---

## 3. Row-Level Security Rules (Database)

"Row-level security" means: even if two people are both allowed to *use* a feature, the system still controls *which specific pieces of data* each of them is allowed to see or touch. In plain terms — just because you're allowed into a room doesn't mean you're allowed to open every drawer in it.

Here are the specific rules for this app:

- **Alerts:** Any Analyst or Admin can view and edit any alert — alerts are not private to whoever is "assigned" to them, because security incidents often need multiple people to look at the same thing. However, the system should still record *who* changed *what* (this is what the audit log is for).
- **Alert notes:** Anyone who can view an alert can view all notes on it — notes are a shared investigation trail, not private messages. Notes cannot be edited or deleted after being written, only added to — this protects the integrity of the investigation record.
- **Rules:** Only Admins can view the rule builder screen at all. Rules should show who created them, but any Admin can edit any other Admin's rule — rules are a shared team asset.
- **User accounts:** A user can always view and edit their own basic profile (like their password), but only an Admin can view the full user list, view another person's role, or suspend anyone.
- **Audit log:** Only Admins can view this. Regular Analysts should never be able to see it, even indirectly through some other screen, because the audit log could reveal, for example, that another analyst's account was flagged as suspicious.
- **A suspended user's data is never deleted** — their past alert resolutions, notes, and rule contributions must remain visible to everyone else, because deleting them would destroy the historical investigation record. Suspension blocks *future* access, not *past* history.

---

## 4. Error Handling Guide

This section covers what should happen when something goes wrong, at each major point in the system. The guiding principle throughout: **never show the user (or an attacker) more information than they need**, but **always give the user enough information to know what to do next.**

| Failure Point | What Happens | What the User Sees |
|---|---|---|
| Wrong email/password on login | System rejects the login | A generic "Incorrect email or password" message — deliberately **not** saying which one was wrong, so an attacker can't use error messages to guess valid emails |
| Login attempt on a suspended account | System rejects the login | "This account has been suspended. Contact your administrator." (This is one case where being specific is actually helpful, since it's not a guessing risk.) |
| Access token expired mid-use | System silently tries to use the refresh token to get a new one | User sees nothing — this should be invisible and automatic, unless the refresh token has also expired or been revoked |
| Refresh token expired or revoked (e.g., user was suspended while active) | System immediately logs the user out | Redirected to login screen with the message "Your session has ended. Please log in again." |
| A Viewer or Analyst tries to access something restricted to Admin (e.g., by typing a URL directly) | Server rejects the request before any data is returned | A "You don't have permission to view this" page — never a blank/broken page, and never partial data |
| Log ingestion pipeline goes down (Vector/log shipper stops sending data) | System should detect that no new logs have arrived in an unusually long time | A visible warning banner on the dashboard: "No new logs received in over X minutes — check the ingestion pipeline," so the team knows their monitoring has a blind spot, rather than silently assuming everything is fine |
| OpenSearch (log storage) is unreachable | Log search and alert detail screens fail gracefully | A clear "Log storage is temporarily unavailable" message — the rest of the app (like viewing already-known alert status) should keep working if possible, rather than the whole app crashing |
| A detection rule is badly written and matches almost everything (alert flood) | The system should have a safety limit | If a single rule generates an unusually high number of alerts in a short time, the system should automatically pause that rule and notify Admins, rather than flooding the alert feed and burying real threats |
| Someone submits a rule with invalid or disallowed content in the rule builder | Server rejects it before saving | A clear message identifying exactly which field was invalid — but the server must **re-validate everything itself**, never trusting that the browser already checked it |
| Network/database failure while performing an action (e.g., suspending a user) | The action should not partially complete | Either the whole action succeeds (user suspended AND session killed AND audit log written) or none of it does — the user sees "Something went wrong, please try again," and no half-finished state is left behind |
| Someone tries to block an IP address that's already blocked | System should recognize the duplicate | A friendly message: "This IP is already on the blocklist," not an error/crash |

---

## 5. Edge Cases to Handle Before Launch

These are situations that are easy to forget about while building the "happy path," but which will definitely come up in real use:

1. **The last remaining Admin account.** What happens if someone tries to suspend or demote the only Admin account? The system should block this — there must always be at least one active Admin, or the whole team could get permanently locked out.
2. **An Admin suspending themselves.** Should probably be blocked, or at minimum require a confirmation step, since it could accidentally lock the person out with no one else around to undo it.
3. **A suspended user's currently-open browser tab.** If someone is actively using the dashboard when they get suspended, their very next action should fail and log them out — not let them finish whatever they were doing.
4. **Two Admins editing the same rule at the same time.** Decide (even if the answer is a simple one) what happens — e.g., "last save wins" is acceptable for V1, but this should be a deliberate decision, not an accident.
5. **A rule that references a log field that doesn't exist in a particular log source.** The rule engine should skip/ignore gracefully rather than crashing the whole detection process for all rules.
6. **Clock/timezone confusion.** All timestamps (alerts, logs, audit entries) should be stored in one consistent timezone (UTC is standard) and only converted to the viewer's local time for display — otherwise "when did this happen" becomes genuinely confusing during an investigation.
7. **Extremely large search results.** If someone searches logs with very broad filters (e.g., no filters at all, over a huge time range), the system needs a limit (like showing the first 500 results with a way to narrow down) rather than trying to return millions of rows and crashing the browser.
8. **An IP block that should expire.** If a temporary block's expiry time passes, does it automatically unblock? This should be a clear, deliberate rule (e.g., yes it auto-expires) rather than blocks silently lasting forever.
9. **A false positive rule causing repeated alerts for the same legitimate behavior.** Analysts should have an easy way to say "don't alert on this specific pattern again" without having to fully disable a rule that's otherwise useful.
10. **Someone's role is changed while they're logged in.** If an Admin demotes someone to Viewer mid-session, that change should take effect on their very next action, not only after they log out and back in.
11. **Deleted vs. disabled rules.** Decide whether rules can ever truly be deleted, or only disabled — since past alerts reference a rule, deleting it outright could break the ability to look back at old alert history. Recommendation: never hard-delete a rule that has ever fired; only allow disabling it.
