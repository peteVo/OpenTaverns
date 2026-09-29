# Blackout visual QA

Hallmark sequence completed against real Edge browser renders at 1440×900 desktop and 390×844 phone. The art direction is a civic night-shift field sheet: warm paper, deep slate, muted coral, restrained amber, Fraunces headlines, and a connected four-system schematic. The schematic loses continuity when a system goes Offline. Reduced-motion preference removes link transitions. The UI uses no terminal, hacker, military, or generic analytics motifs.

## Pass 1 — assignment and private flow

Screens covered collection, lobby and QR, private role reveal, Incident, assignment, Operator and Disruptor response, waiting, resolution, Audit, critical and Offline system, both victories, and truth timeline. The assignment screenshot exposed a missing decision aid: the Shift Lead could choose people without seeing order targets, team sizes, or required progress near the selection. The assignment panel now shows both Work Orders and their structured success/failure consequences. It also explains the tap cycle and disables Publish until both local teams are full. An unrelated server update no longer clears an unpublished draft.

The private-action browser pass verified that opening Rules leaves an unlocked Diagnose selection intact. The follow-up reconnect check revealed that a refresh lost that choice, so the unsubmitted selection now survives in per-tab session storage for the current Work Order. Locking remains deliberate and irreversible on the server.

## Pass 2 — reading and disclosure

The Rules sheet initially inherited the browser's default dialog width on phones, leaving a strip of dimmed game visible and narrowing the text. It now fills the mobile viewport while retaining a bounded overlay and visible game edges on desktop. Long text remains sectioned with a horizontal mobile section rail, quick rules, and a close control. The smallest system and post-game timeline labels were enlarged. A later rule review also found that the server could Audit an earlier round but the UI listed only current orders; the vote now shows all resolved unaudited orders with their public teams.

The final screenshots are [desktop assignment](images/qa/blackout-assignment-desktop-final.png), [phone private response](images/qa/blackout-operator-mobile-final.png), [phone Rules](images/qa/blackout-rules-mobile-final.png), and [phone truth timeline](images/qa/blackout-truth-mobile-final.png). The browser scenario test also captured every other required phase in `test-results` and checked mobile overflow, role privacy, Rules preservation, and console errors.

The visual distinction passes the product check: the system map is a central game object and the private response takes priority on phones. The screen could not be directly reskinned as an enterprise monitor without changing its role reveal, work teams, accusation evidence, and post-game deception timeline.
