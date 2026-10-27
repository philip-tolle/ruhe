# Ruhe – Meilenstein 9: Energie-Basis

*Stand: 27.10.2026 · ergänzt die Haupt-Spec `docs/superpowers/specs/2026-10-21-ruhe-design.md` sowie die Specs zu M4 bis M8. Wo dieses Dokument etwas anders regelt, gilt dieses Dokument.*

## 1. Ziel & Rahmen

Der Nutzer möchte Ruhe zu einer Achtsamkeits- und Hilfs-App ausbauen, die ihm hilft, seine persönliche Energie hochzuhalten und sich stetig weiterzuentwickeln, mit High-Energy-Prinzipien und Brain Hacks. Gewünscht sind Hilfen für vier Momente: morgens (Energie-Start), tagsüber (Tief und Fokus-Reset), abends (Reflexion und Wachstum) und durchgängig (Energie im Blick).

Das Vorhaben ist zu groß für einen Meilenstein und wird in vier Etappen gebaut, jede mit eigener Spec und eigenem Plan:

| Etappe | Meilenstein | Inhalt |
|---|---|---|
| A. Energie-Basis | **M9 (dieses Dokument)** | Energie-Check-in, Brain-Hack-Bibliothek mit „Jetzt-Reset“, Fokus-Sprint, Wochenmuster |
| B. Morgen-Start | M10 | Morgenroutine: aktivieren, Tagesintention, „Big Domino“ |
| C. Abend-Logbuch | M11 | Energie gegeben/gekostet, Gelerntes, Wachstum, Wochenrückblick |
| D. Prinzipien & Wachstum | M12 | eigene Prinzipien und Buch-Erkenntnisse (nur lokal), Prinzip der Woche, Wachstumsfelder |

**Vom Nutzer entschieden (Brainstorming 27.10.2026):**

1. **Reihenfolge:** Etappe A zuerst.
2. **Quellen:** Chris Surel („Das High Energy Prinzip“), Henry Hildebrandt („Brainhacks“, 2025), Energie-Management nach Loehr/Schwartz, Brendon Burchard („High Performance Habits“), Neuro-Protokolle (Huberman) und gut belegte Prinzipien ohne feste Quelle.
3. **Inhalte:** Claude schreibt eigene Karten in eigenen Worten mit Quellenhinweis; der Nutzer gibt sie frei. Später kommen Karten aus den Buchnotizen des Nutzers dazu (eigene Worte) und eigene Prinzipien, die nur auf dem Handy liegen (Etappe D).
4. **Platz:** ein neuer Reiter „Energie“; „Heute“ bekommt eine kleine Energie-Karte als Abkürzung.
5. **Check-in:** vier Bereiche nach Loehr/Schwartz (Körper, Gefühl, Geist, Sinn), je 5 Stufen.
6. **Hack-Form:** Karten mit visuell starker Erklärung und Timer; die Stimme kommt später für die wichtigsten Hacks.
7. **Aussehen:** Entwurf „A vorher + B beim Üben“: Die Karte zeigt Schritte und Wirkung auf einen Blick (Entwurf A), nach „Starten“ führt eine Live-Grafik durch die Übung (Entwurf B). Entwürfe: Artifact „Hack-Karten Entwürfe“.
8. **Erinnerung:** ohne Server. Die App fragt beim Öffnen, für feste Zeiten richtet der Nutzer Wecker oder Kalender-Erinnerungen ein (Anleitung im README).
9. **Verlauf:** aktueller Stand als vier Akkus, ein Wochenraster (7 Tage × 4 Bereiche) und ein, zwei Sätze zum Muster.
10. **Wirkung:** Nach einem Hack fragt die App mit einem Tipp nach dem Zielbereich; mit der Zeit schlägt der Reset zuerst vor, was beim Nutzer wirkt („Was bei dir wirkt“).
11. **Fokus-Sprint:** gehört in Etappe A.
12. **Technischer Weg:** Hacks als Abläufe in Daten; ein Player spielt jeden Hack.
13. **Abschnitte 1–4** des Designs (Ansicht, Start-Bibliothek, Daten und Logik, Technik) wurden wie vorgestellt freigegeben, mit neuen Aquarell-Motiven (Kostenrahmen unter 0,50 $).

### Erfolgskriterien

- Ein Check-in dauert höchstens fünf Tipps (vier Bereiche, Speichern).
- Vom Öffnen des Reiters bis zum laufenden, passenden Hack sind es höchstens zwei Tipps („Starten“ auf der Reset-Karte, ggf. „Starten“ auf der Hack-Karte).
- Jeder der 16 Hacks lässt sich starten, führt Schritt für Schritt bzw. im Takt und endet mit Klangschale; Hacks und Sprints laufen bei gesperrtem Bildschirm weiter.
- Nach einigen Tagen zeigt „Energie“ ein Wochenraster, Muster-Sätze und „Was bei dir wirkt“.
- Alle neuen Daten überstehen Neuladen, Backup und Import; alte Daten bleiben gültig.

### Nicht-Ziele (Etappe A)

- Keine Stimme für Hacks (später, für die wichtigsten).
- Kein Morgen-Start, kein Logbuch, keine eigenen Prinzipien (Etappen B–D).
- Keine Push-Benachrichtigungen, kein Server. Das Nicht-Ziel der Haupt-Spec „Keine täglichen Erinnerungs-Benachrichtigungen“ gilt weiter.
- Kein Bearbeiten oder Löschen einzelner früherer Check-ins, Läufe oder Sprints.
- Keine Kurvendiagramme. Das Wochenraster ist die einzige Grafik des Verlaufs; das Nicht-Ziel der Haupt-Spec „Keine ausführliche Statistik (Stimmungstagebuch, Diagramme)“ wird für den Reiter „Energie“ insoweit gelockert.
- Hacks und Sprints zählen nicht in die Meditationsstatistik (Minuten, Serien, Kalender unter „Ich“) und nicht in „Zuletzt genutzt“.
- Keine medizinischen Versprechen. Die Karten erklären, warum etwas wirken kann, und nennen ihre Quelle.

### Quellen und Recht

- Keine Texte, Übungen im Wortlaut oder Gliederungen aus Büchern; das Repo ist öffentlich.
- Ideen und allgemeine Prinzipien werden in eigenen Worten beschrieben, mit Quelle („angelehnt an …“) oder Studienangabe.
- Zu den Büchern von Surel und Hildebrandt liegen nur Verlags- und Podcast-Beschreibungen vor. Übernommen wird daraus nur Allgemeines (Surel: Wechsel von Belastung und Erholung, „Big Domino“, 80/20). Hildebrandt erscheint als Leseempfehlung („Weiterlesen: Henry Hildebrandt, Brainhacks, 2025“) bei den Geist-Hacks, bis Buchnotizen des Nutzers vorliegen.
- Persönliches (Check-ins, Vorhaben der Sprints, später eigene Werte und Prinzipien) liegt nur lokal auf dem Handy, nie im Repo.

## 2. Die vier Bereiche

| Bereich | Kennung | Farbe | Leitfrage im Check-in |
|---|---|---|---|
| Körper | `koerper` | `#F0A58C` | wach, kräftig, ausgeruht? |
| Gefühl | `gefuehl` | `#F3B6C8` | ruhig, zuversichtlich, verbunden? |
| Geist | `geist` | `#9FE0CF` | klar, fokussiert, aufnahmefähig? |
| Sinn | `sinn` | `#C7B8F5` | ausgerichtet, motiviert, im Einklang? |

- Feste Reihenfolge überall: Körper, Gefühl, Geist, Sinn.
- **Stufen:** 1 „leer“, 2 „schwach“, 3 „mittel“, 4 „gut“, 5 „voll“.
- Die Farben gelten in allen drei Stimmungen (morgen, tag, abend). Als Textfarbe auf Karten müssen sie in jeder Stimmung mindestens 4,5:1 erreichen (WCAG AA); der bestehende Kontrast-Test wird um sie erweitert. Bedeutung trägt immer auch der Name, nie die Farbe allein.

## 3. Was man sieht

### 3.1 Reiterleiste

- Sechs Reiter in dieser Reihenfolge: Heute, **Energie**, Meditieren, Atmen, Klänge, Ich.
- „Energie“ hat ein Blitz-Symbol im Stil der übrigen Linien-Symbole.
- Auf einem 360 px breiten Handy passen alle sechs Beschriftungen ohne Abschneiden; nötigenfalls wird die Schrift der Beschriftungen auf 11 px verkleinert. Jede Tippfläche bleibt mindestens 48 px hoch und so breit wie ihr Sechstel der Leiste.

### 3.2 Reiter „Energie“

Von oben nach unten (Entwurf: Artboard „Reiter Energie“):

1. **Kopf:** Überschrift „Energie“, darunter „Letzter Check-in vor 2 Std.“ bzw. „Noch kein Check-in heute“.
2. **Dein Akku:**
   - Mit frischem Check-in (§6.1): vier kleine Akkus in den Bereichsfarben, gefüllt nach Stufe, darunter Name und „4 von 5“; darunter „Neuer Check-in“.
   - Sonst: „Wie voll ist dein Akku?“ und „Check-in“.
3. **Jetzt-Reset** (hervorgehoben mit Goldrand):
   - Mit frischem Check-in: „Dein Geist ist gerade am niedrigsten.“, darunter der vorgeschlagene Hack mit Motiv des Bereichs, Titel, „Geist · 3 Min“ und, falls zutreffend, „wirkt bei dir“; Knöpfe „Starten“ (öffnet die Hack-Karte) und „Anderer“.
   - Ohne frischen Check-in: „Was braucht gerade Energie?“ mit vier Knöpfen (Körper, Gefühl, Geist, Sinn); ein Tipp zeigt den Vorschlag für diesen Bereich.
4. **Fokus-Sprint:** Motiv „fokus“, Feld „Woran arbeitest du?“ (freiwillig, höchstens 80 Zeichen), Auswahl 25 / 50 / 90 Min, Hintergrundauswahl (dieselbe gegliederte Auswahl wie beim Timer, mit „Keiner“), „Sprint starten“.
5. **Brain Hacks:** Filter „Alle · Körper · Gefühl · Geist · Sinn“ (gemerkt nur für die Sitzung), darunter Kacheln in zwei Spalten: kleines Bereichs-Motiv, Titel, „Bereich · n Min“.
6. **Deine Woche:** Wochenraster (§6.4), Muster-Sätze (§6.5), Fokus-Zeile (§6.6), „Was bei dir wirkt“ (§6.3).

### 3.3 Check-in (Blatt von unten)

Entwurf: Artboard „Energie-Check-in“.

- Überschrift „Wie voll ist dein Akku?“, darunter „Ein Tipp je Bereich, 1 = leer, 5 = voll.“
- Vier Zeilen: Name in Bereichsfarbe, rechts das Wort der gewählten Stufe (oder „–“), darunter die Leitfrage, darunter fünf Punkte (Tippfläche je mindestens 44 × 44 px). Gewählt: Punkte bis zur Stufe gefüllt.
- Jede Zeile startet leer. „Speichern“ ist erst aktiv, wenn alle vier gesetzt sind; es speichert und schließt.
- „Später“, Zurück-Geste und Tippen daneben schließen ohne Speichern.
- Screenreader: Die Punkte einer Zeile sind eine Gruppe mit dem Bereichsnamen; jeder Punkt heißt „Geist: 2 von 5, schwach“ und meldet, ob er gewählt ist.

### 3.4 Hack-Karte (Entwurf A)

Ein Blatt mit:

- Zurück, Chip „Bereich · n Min“, Kleinüberschrift „BRAIN HACK“, Titel, ein Satz Nutzen, Bereichs-Motiv.
- **So geht’s:** die Schritte nummeriert mit je einem Linien-Symbol, Titel und Erklärung.
- **Warum es wirkt:** ein kleines Wirkungsbild (zwei Zustände mit Pfeil, z. B. „Alarm → Ruhe“) und zwei, drei Sätze.
- Optional: Sicherheitshinweis (eigener Kasten), „Passt dazu: Atemübung Box-Atmung“ (Verweis auf eine Übung der App), „Weiterlesen: …“.
- Unten „Starten · m:ss“ und die Quelle in kleiner Schrift.

### 3.5 Hack-Player (Entwurf B)

Vollbild wie der Atem-Player, mit Titel, Bereichs-Chip, Restzeit groß, Fortschrittsbalken, „Pause/Weiter“ und „Beenden“ (mit Rückfrage wie bei den Sitzungen). Je nach Führungsart:

- **Takt:** eine Atemkurve über einen ganzen Zyklus, ein leuchtender Punkt läuft im Takt mit; darunter groß die aktuelle Anweisung („Tief einatmen …“, „… kurz nachatmen“, „Lang ausatmen …“) und „Runde 4 von 8“. Ohne Ton bis auf die Klangschale am Ende.
- **Schritte:** groß der aktuelle Schritt mit Titel und Erklärung, darunter „Schritt 2 von 4“ und die Restzeit des Schritts. Beim Schrittwechsel ein leiser Hinweiston und, wenn Vibration an ist und der Bildschirm an ist, ein kurzes Vibrieren.
- **Ring:** ein Ring-Timer, darunter alle Schritte als ruhige Liste.

„Warum es wirkt“ lässt sich im Player aufklappen. Screenreader: Die aktuelle Anweisung bzw. der Schritt wird beim Wechsel angesagt (höflich, `aria-live="polite"`).

**Ende:** Klangschale (und Vibration, wenn an), dann im selben Blatt:

- Titel „Geschafft“ und die Wirkungsfrage (§6.2): eine Reihe „{Bereich} jetzt?“ mit fünf Punkten, oder zwei Reihen „vorher“ und „jetzt“.
- „Fertig“ schließt und speichert, was gewählt ist; „Noch einmal“ startet denselben Hack neu.
- Wird der Hack vorzeitig beendet, folgt dasselbe Ende, sofern er zählt (§5.2); sonst schließt der Player.

### 3.6 Fokus-Sprint im Player

- Vollbild mit Motiv „fokus“, Restzeit groß, darunter das Vorhaben (oder „Fokus-Sprint“), „Pause/Weiter“ und „Beenden“ mit Rückfrage.
- Kein Vorlauf, keine Intervall-Schalen; Klangschale am Ende; der Hintergrund läuft wie beim Timer und blendet am Ende aus.
- **Ende:** „Sprint geschafft“ mit der tatsächlichen Zeit, ein Pausen-Vorschlag (§6.7) mit „Starten“, und „Check-in“ (öffnet das Check-in-Blatt) sowie „Fertig“.

### 3.7 Karte auf „Heute“

- Neue Karte „Dein Akku“ zwischen Begrüßung und „Vorschlag des Tages“.
- Mit frischem Check-in: die vier kleinen Akkus und eine Zeile „Geist am niedrigsten · Jetzt-Reset“; Tippen öffnet den Reiter „Energie“.
- Sonst: „Wie voll ist dein Akku?“ und „Check-in“ (öffnet das Check-in-Blatt direkt auf „Heute“).
- Die übrigen Karten von „Heute“ bleiben unverändert.

### 3.8 Motive

Fünf neue Aquarell-Motive im Stil der vorhandenen 43 („zart mit feiner Goldlinie“), ausgewählt vom Nutzer aus Varianten:

| Motiv | Kennung | Idee |
|---|---|---|
| Körper | `energie-koerper` | Laufschuh oder Sonne über Hügel |
| Gefühl | `energie-gefuehl` | Herz aus Wasserfarbe, sanfte Welle |
| Geist | `energie-geist` | klarer Kristall oder Glühbirne |
| Sinn | `energie-sinn` | Kompass oder Leitstern |
| Fokus | `fokus` | Sanduhr oder Schreibtischlampe |

Größen: Hack-Karte 96 px, Reset-Karte und Sprint-Karte 72 px, Kacheln 40 px. Sie sind Schmuck (`alt=""`); die Bedeutung trägt der Text.

## 4. Start-Bibliothek

16 Hacks, 4 je Bereich. Führung: **Takt** (Atemkurve), **Schritte** (Schritt-Text mit Zeit je Schritt), **Ring** (ein Timer).

| Kennung | Titel | Bereich | Min | Führung | Kern | Quelle | Hinweis/Fenster |
|---|---|---|---|---|---|---|---|
| `bewegungs-snack` | Bewegungs-Snack | Körper | 2 | Schritte | 4 × 30 s: Kniebeugen, auf der Stelle laufen, Arme kreisen, Wadenheben | Forschung zu „Exercise Snacks“ (u. a. Gibala) | – |
| `tageslicht` | Tageslicht tanken | Körper | 5 | Ring | raus, in den Himmel schauen (nie in die Sonne), gehen | Cajochen 2007, wach machende Wirkung von Licht | Reset nur 7–17 Uhr |
| `wach-atmung` | Wach-Atmung | Körper | 1 | Takt | betont ein, locker aus, danach ausatmen und kurz halten | Balban u. a. 2023 (zyklisches Hyperventilieren) | Sicherheitshinweis: nicht beim Fahren, im Wasser oder bei Schwindel; sitzen |
| `power-pause` | Power-Pause | Körper | 10 | Ring | hinlegen, Augen zu, sanftes Wecken mit der Klangschale | Brooks & Lack 2006, 10-Minuten-Nickerchen | Reset nur 11–16 Uhr |
| `seufzer` | Physiologischer Seufzer | Gefühl | 1 | Takt | zweimal ein, lang aus | Balban u. a. 2023 | – |
| `kaltes-gesicht` | Kaltes Gesicht | Gefühl | 1 | Schritte | kaltes Wasser ins Gesicht, Luft anhalten, der Tauchreflex senkt den Puls | Physiologie des Tauchreflexes | Hinweis: bei Herzproblemen vorher ärztlich abklären |
| `gefuehl-benennen` | Gefühl benennen | Gefühl | 2 | Schritte | das Gefühl genau in Worte fassen | Lieberman u. a. 2007, „Putting feelings into words“ | – |
| `drei-gute-dinge` | Drei gute Dinge | Gefühl | 2 | Schritte | drei Dinge, die heute gut waren, und warum | Seligman u. a. 2005 | – |
| `kopf-leeren` | Kopf leeren | Geist | 3 | Ring | alles Offene aufschreiben | Masicampo & Baumeister 2011 | Weiterlesen: Hildebrandt |
| `naechster-schritt` | Nächster kleiner Schritt | Geist | 2 | Schritte | „Wenn X, dann tue ich Y“ für die nächsten 5 Minuten | Gollwitzer 1999, Wenn-dann-Pläne | Weiterlesen: Hildebrandt |
| `ablenkung-aus` | Ablenkung aus | Geist | 1 | Schritte | Handy weg, Tabs zu, eine einzige Sache | Leroy 2009, Aufmerksamkeitsrest | Weiterlesen: Hildebrandt |
| `augen-pause` | Augen-Pause | Geist | 2 | Ring | in die Ferne schauen, Blick weit werden lassen | 20-20-20-Regel der Augenärzte | Weiterlesen: Hildebrandt |
| `big-domino` | Big Domino | Sinn | 3 | Schritte | die eine Sache, die heute alles andere leichter macht | angelehnt an Chris Surel | – |
| `werte-anker` | Werte-Anker | Sinn | 2 | Schritte | einen deiner Werte wählen: Wie lebst du ihn in der nächsten Stunde? | Cohen & Sherman 2014, Selbstbestätigung | ohne persönliche Werte im Repo |
| `kleiner-fortschritt` | Kleiner Fortschritt | Sinn | 2 | Schritte | einen Fortschritt von heute bemerken und festhalten | Amabile & Kramer 2011, „Progress Principle“ | – |
| `wofuer` | Wofür? | Sinn | 2 | Schritte | Warum ist dir wichtig, woran du gerade arbeitest? | Motivationspsychologie (Sinn und Ziele) | – |

- Die vollständigen Karten-Texte (Nutzen-Satz, Schritte, „Warum es wirkt“, Hinweise) schreibt Claude in eigenen Worten; der Nutzer gibt sie vor dem Einbau frei (Plan, eigener Schritt). Bis zur Freigabe ist ein Hack nicht eingebaut.
- Quellenangaben werden beim Schreiben der Texte noch einmal geprüft; eine Angabe, die sich nicht bestätigen lässt, wird allgemeiner formuliert statt erfunden.

## 5. Hack-Format und Ablauf

### 5.1 `content/hacks.json`

```jsonc
{
  "hacks": [
    {
      "id": "seufzer",                       // Kleinbuchstaben, Ziffern, Bindestrich
      "title": "Physiologischer Seufzer",
      "area": "gefuehl",                     // koerper | gefuehl | geist | sinn
      "minutes": 1,                          // Nenndauer auf Karte und Kachel
      "benefit": "Fährt Stress in einer Minute spürbar herunter.",
      "guide": "takt",                       // takt | schritte | ring
      "steps": [                             // Karte „So geht’s“; bei „schritte“ mit Sekunden
        { "title": "Tief einatmen", "detail": "durch die Nase, bis die Lunge fast voll ist", "icon": "einatmen", "seconds": 0 }
      ],
      "cycle": [                             // nur bei „takt“: ein Zyklus der Atemkurve
        { "phase": "ein", "seconds": 2, "say": "Tief einatmen …" },
        { "phase": "nach", "seconds": 1, "say": "… kurz nachatmen" },
        { "phase": "aus", "seconds": 5, "say": "Lang ausatmen …" }
      ],
      "why": { "from": "Alarm", "to": "Ruhe", "text": "…" },
      "source": "Balban u. a., Cell Reports Medicine 2023",
      "further": null,                       // z. B. "Henry Hildebrandt, Brainhacks (2025)"
      "caution": null,                       // Sicherheitshinweis oder null
      "window": null,                        // z. B. { "from": 7, "to": 17 } (volle Stunden, Ortszeit)
      "link": null                           // z. B. { "kind": "breath", "id": "box" }
    }
  ]
}
```

Regeln (ein Unit-Test prüft jeden Eintrag):

- **Kennungen:** eindeutig.
- **Inhalt:** `area` ist gültig, `minutes` ist eine ganze Zahl von 1 bis 10, `source` ist nicht leer.
- **`schritte`:** Jeder Schritt hat mindestens 10 s, und die Summe ergibt `minutes × 60`.
- **`ring`:** `steps` ohne Sekunden (nur Liste); die Dauer ist `minutes × 60`.
- **`takt`:**
  - `cycle` hat mindestens zwei Phasen, Phasen `ein | nach | aus | halten`, je 0,5–30 s.
  - Ein Eintrag darf als Gruppe `{ "repeat": n, "phases": [...] }` mehrere Phasen wiederholen (für die Wach-Atmung).
  - Die Laufzeit ist die Zahl der Zyklen `round(minutes × 60 / Zyklusdauer)`, mindestens 1, mal Zyklusdauer.
- **Symbole:** `icon` nennt ein Symbol aus einer festen Liste von Linien-Symbolen.
- **Verweise:** `link` zeigt auf eine vorhandene Übung, sonst ist der Eintrag ungültig.

### 5.2 Programme in der Engine

Zwei neue Programmarten neben `timer` und `breath`; sie laufen wie diese über die Audio-Uhr, mit Media-Session und Sperrbildschirm-Steuerung:

- **`hack`:**
  - `ref` = Hack-Kennung, Titel = Hack-Titel.
  - Hinweistöne zu den Schrittwechseln (nur bei `schritte`), Klangschale am Ende, kein Hintergrund.
  - Der Hinweiston ist ein kurzer, leiser Sinuston mit weicher Hüllkurve, in Web Audio erzeugt (keine neue Datei).
- **`focus`:**
  - `ref` = `focus`, Titel = „Fokus-Sprint · 50 Min“.
  - Kein Vorlauf, Klangschale am Ende, Hintergrund wie beim Timer.

Das Ergebnis einer Sitzung trägt die Art mit. Die Verbindung zur Statistik leitet weiter:

- `hack` → Hack-Lauf
- `focus` → Fokus-Sprint
- alles andere → Sitzung wie bisher

Der bisherige Abschluss-Bildschirm erscheint für `hack` und `focus` nicht; ihr Ende zeigen ihre Player (§3.5, §3.6).

**Mindestdauer:**
- Ein Hack-Lauf zählt ab 30 s gehörter Zeit, ein Sprint ab 5 Minuten.
- Gespeichert wird die tatsächliche Zeit.
- Darunter wird nichts gespeichert, und der Player schließt.

Startet man während eines Hacks oder Sprints etwas anderes, endet er wie heute jede laufende Sitzung und zählt nach denselben Regeln.

## 6. Daten und Logik

### 6.1 Speicher

Im bestehenden Datenstand (`localStorage['ruhe.v1']`, `version` bleibt 1), neue optionale Felder:

```ts
type EnergyArea = 'koerper' | 'gefuehl' | 'geist' | 'sinn'
type EnergyLevel = 1 | 2 | 3 | 4 | 5

interface EnergyCheckin { id: string; at: string /* ISO */; levels: Record<EnergyArea, EnergyLevel> }
interface HackRun { id: string; at: string; hack: string; area: EnergyArea; seconds: number; before?: EnergyLevel; after?: EnergyLevel }
interface FocusSprint { id: string; at: string; planned: 25 | 50 | 90; seconds: number; task?: string /* ≤ 80 Zeichen */ }

interface AppData {
  // … wie bisher
  energyCheckins?: EnergyCheckin[]
  hackRuns?: HackRun[]
  focusSprints?: FocusSprint[]
}
interface Settings {
  // … wie bisher
  focus: { minutes: 25 | 50 | 90; sound: BackgroundId | null } // Standard { 50, 'kaffee-und-notizen' }
}
```

- **Frisch** ist ein Check-in, der höchstens 3 Stunden alt ist (Reset und Erinnerung).
- **Prüfung beim Laden und beim Import:** Jeder Eintrag wird einzeln geprüft; ein ungültiger fällt weg, der Rest bleibt.
  - Ein Check-in braucht alle vier Stufen.
  - Ein Lauf mit unbekanntem Hack bleibt erhalten (der Katalog kann sich ändern), zählt aber nicht in Vorschläge.
  - `task` wird auf 80 Zeichen gekürzt.
- **Backup:** Export enthält die drei Listen; Import fügt nur Einträge mit unbekannter `id` hinzu, nie doppelt. Die Meldung nach dem Import zählt die neuen Sitzungen wie bisher und nennt zusätzlich neue Check-ins, Läufe und Sprints.
- **Keine Obergrenze:** Bei 4 Check-ins am Tag sind das etwa 120 KB im Jahr.

### 6.2 Wirkung eines Hacks

- Der Zielbereich ist der Bereich des Hacks.
- **Vorher:**
  - Gibt es einen Check-in, der höchstens 2 Stunden vor dem Start liegt, ist dessen Stufe im Zielbereich der Vorher-Wert, und am Ende kommt nur „{Bereich} jetzt?“.
  - Sonst zeigt das Ende zwei Reihen, „vorher“ und „jetzt“.
- Beides ist freiwillig. Ein Lauf ohne Antwort zählt als gemacht.
- **Bewertet** ist ein Lauf mit Vorher- und Jetzt-Wert. Seine Wirkung ist `after − before`.

### 6.3 „Was bei dir wirkt“

- Je Hack der Durchschnitt der Wirkung über alle bewerteten Läufe.
- Angezeigt werden die drei Hacks mit dem größten Durchschnitt, die mindestens 2 bewertete Läufe haben und deren Durchschnitt über 0 liegt. Bei Gleichstand gewinnt der mit mehr bewerteten Läufen.
- Format: „1 · Kopf leeren · Geist · +1,2 Stufen“ (eine Nachkommastelle, Komma).
- Ohne Treffer: „Bewerte nach einem Hack kurz, wie es dir jetzt geht. Ab zwei Bewertungen je Hack siehst du hier, was bei dir wirkt.“
- Auf Reset-Karte und Kachel steht „wirkt bei dir“, wenn der Hack unter diesen drei ist.

### 6.4 Wochenraster

- Spalten: die letzten 7 Kalendertage bis heute (Ortszeit), beschriftet „Mo“ … „So“. Zeilen: die vier Bereiche.
- Feld: Durchschnitt der Stufen dieses Bereichs an diesem Tag, gerundet auf eine ganze Stufe. Die Deckkraft der Bereichsfarbe ist 0,2 / 0,4 / 0,6 / 0,8 / 1,0 für Stufe 1–5.
- Tage ohne Check-in: gestrichelter Rahmen, kein Füllton.
- Screenreader: jedes Feld z. B. „Geist, Dienstag: 2,5 von 5“ bzw. „Geist, Dienstag: kein Check-in“.
- Eine Tagesgrenze ist Mitternacht Ortszeit; ein Check-in um 0:30 Uhr gehört zum neuen Tag.

### 6.5 Muster-Sätze

- Erst ab 7 Check-ins in den letzten 14 Tagen; vorher: „Ab sieben Check-ins in zwei Wochen zeigt dir die App hier deine Muster.“
- Höchstens zwei Sätze, die ersten zutreffenden in dieser Reihenfolge:
  1. **Schwächster Bereich** (Durchschnitt der letzten 14 Tage), bei Gleichstand nach der festen Reihenfolge: „Am niedrigsten ist zurzeit dein {Bereich}.“
  2. **Tageszeit:**
     - Tageszeiten wie die Stimmungen der App: morgens 5–11, tagsüber 11–17, abends 17–5 Uhr.
     - Ein Bereich liegt in einer Tageszeit im Schnitt mindestens eine Stufe unter seinem Schnitt zu den übrigen Zeiten, bei mindestens 3 Check-ins in dieser Tageszeit.
     - Satz: „Dein {Bereich} ist {morgens|tagsüber|abends} am niedrigsten.“ Gewinnt der größte Abstand.
     - Ist derselbe Bereich schon in Satz 1 genannt, entfällt Satz 1 zugunsten von Satz 2.
  3. **Trend:**
     - Je Bereich der Schnitt der letzten 7 Tage gegen die 7 Tage davor, bei mindestens 2 Check-ins in jeder Woche.
     - Ab einem Unterschied von 0,5 Stufen: „Dein {Bereich} liegt diese Woche {eine halbe Stufe|1 Stufe|1,5 Stufen …} {höher|tiefer} als in der Woche davor.“ (gerundet auf halbe Stufen). Gewinnt der größte Unterschied.

### 6.6 Fokus-Zeile

„Diese Woche: 4 Sprints, 3 Std. 20 Min Fokus“ (letzte 7 Tage, gespeicherte Sprints, tatsächliche Zeit, „1 Sprint“ im Singular, Minuten ohne Stunden unter 60 Min). Ohne Sprint in der Woche entfällt die Zeile.

### 6.7 Jetzt-Reset und Pausen-Vorschlag

**Zielbereich:** Mit frischem Check-in ist es der niedrigste Bereich, bei Gleichstand nach der festen Reihenfolge. Sonst wählt ihn der Nutzer.

**Reihenfolge der Hacks im Bereich:**
1. Hacks mit mindestens 2 bewerteten Läufen und Durchschnitt über 0, absteigend nach Durchschnitt.
2. Hacks mit weniger als 2 bewerteten Läufen.
3. Hacks mit Durchschnitt ≤ 0, absteigend nach Durchschnitt.
4. Gleichstand in jeder Gruppe: zuerst der am längsten nicht gelaufene (nie gelaufen zählt als am längsten), dann die Reihenfolge des Katalogs.

**Weitere Regeln:**
- **Zeitfenster:** Hacks mit `window`, das die aktuelle Stunde nicht enthält, fallen aus dem Reset heraus. In der Bibliothek bleiben sie startbar.
- **„Anderer“:** geht zum nächsten Hack der Reihenfolge. Am Ende der Liste geht es zum Bereich mit der nächsthöheren Stufe (ohne frischen Check-in zum nächsten Bereich der festen Reihenfolge), nach dem letzten Bereich wieder von vorn.
- **Pausen-Vorschlag nach einem Sprint:**
  - Mit frischem Check-in: der erste Hack der Reset-Reihenfolge im niedrigeren der Bereiche Körper und Geist (bei Gleichstand Körper).
  - Ohne frischen Check-in: nach einem 25-Minuten-Sprint die „Augen-Pause“, nach 50 oder 90 Minuten der „Bewegungs-Snack“.
  - Das Zeitfenster gilt auch hier; fällt der Hack heraus, folgt der nächste der Reihenfolge.

### 6.8 Erinnerung beim Öffnen

- Es gibt kein Pop-up. Die Akku-Karten auf „Heute“ und „Energie“ zeigen die Check-in-Frage, solange kein frischer Check-in vorliegt.
- **README, Abschnitt „Erinnerungen einrichten“:**
  - wie man auf Android im Uhr- bzw. Wecker-App oder im Kalender wiederkehrende Erinnerungen anlegt (z. B. 9, 13, 17 Uhr);
  - wie man die App schnell öffnet (Startbildschirm-Symbol).

## 7. Technik

| Teil | Ort | Inhalt |
|---|---|---|
| Bereiche, Stufen, Farben | `src/lib/energy/areas.ts` | Konstanten, Wörter, Leitfragen |
| Hack-Katalog | `content/hacks.json`, `src/lib/energy/hacks.ts` | Laden, Prüfen, Laufzeit eines Hacks, Ablauf-Plan (Schritte bzw. Zyklen mit Zeitpunkten) |
| Auswertung | `src/lib/energy/insights.ts` | frisch, Vorher-Wert, Wirkung, „Was bei dir wirkt“, Wochenraster, Muster-Sätze, Fokus-Zeile |
| Reset | `src/lib/energy/reset.ts` | Zielbereich, Reihenfolge, „Anderer“, Pausen-Vorschlag |
| Daten | `src/lib/stats/schema.ts`, `persist.ts`, `backup.ts`, `store.svelte.ts` | neue Felder, Prüfung, Speichern, Zusammenführen |
| Programme | `src/lib/audio/program.ts` (+ Hinweiston) | `hackProgram`, `focusProgram` |
| Verbindung | `src/lib/session-wiring.ts`, `session-ui.svelte.ts` | Weiterleitung nach Art, Start von Hack und Sprint |
| Oberfläche | `src/screens/Energie.svelte`, `src/components/energy/…` | Reiter, Check-in-Blatt, Akku, Reset, Bibliothek, Hack-Karte, Hack-Player (Takt, Schritte, Ring), Sprint-Player, Wochenraster |
| Heute | `src/screens/Heute.svelte` | Karte „Dein Akku“ |
| Reiter | `src/lib/ui/tabs.ts`, `TabBar.svelte` | sechster Reiter |
| Motive | `public/images/motive/`, `content/motive.json` | fünf neue Motive |

- Alle Rechenregeln sind reine Funktionen mit der aktuellen Zeit als Parameter (testbar ohne Uhr).
- Die Live-Grafik der Takt-Hacks folgt der Audio-Uhr der Engine (wie die Atem-Blüte), damit Bild und Klangschale zusammenpassen.
- Die Engine-Erweiterung folgt dem Muster von `timerProgram`/`breathProgram`.

## 8. Grenzfälle

- **Erster Start, keine Daten:**
  - Akku-Karte mit Einladung, Reset mit Bereichswahl.
  - „Deine Woche“ zeigt das leere Raster mit gestrichelten Feldern und die beiden Hinweise (Muster, Wirkung).
- **Check-in-Blatt offen beim Wechsel des Reiters:** Das Blatt schließt ohne Speichern.
- **Hack oder Sprint läuft:** Wie bei Timer und Atmen bleibt der Player im Vollbild offen, solange er läuft; die Zurück-Geste fragt vor dem Beenden. Einen anderen Reiter erreicht man erst nach dem Ende.
- **Pause:** Restzeit und Grafik stehen; Weiter setzt fort. Gezählt wird nur gespielte Zeit.
- **Vibration aus oder nicht unterstützt:** keine Vibration, sonst unverändert.
- **Tageswechsel während eines Laufs:** Der Lauf gehört zum Tag seines Starts.
- **Uhrumstellung (Sommer-/Winterzeit):** Tage und Tageszeiten nach Ortszeit des jeweiligen Eintrags.
- **Hack aus dem Katalog entfernt:** Alte Läufe bleiben gespeichert und zählen in keine Anzeige.
- **Unbekannter Hintergrund in `settings.focus.sound`:** fällt auf den Standard zurück.
- **Langes Vorhaben aus einem Wort:** bricht im Player um, statt aus dem Bild zu laufen (wie bei eigenen Atemmustern).
- **360 px:** kein seitliches Scrollen; Raster, Check-in, Kacheln und Reiterleiste passen; alle Tippflächen mindestens 44 px.
- **Große Systemschrift:** Karten wachsen in der Höhe, nichts wird abgeschnitten.

## 9. Tests

- **Unit:**
  - Katalog-Prüfung (§5.1) für alle 16 Hacks;
  - Laufzeit und Ablauf-Plan je Führungsart;
  - frisch / Vorher-Wert, Wirkung, „Was bei dir wirkt“ mit Schwellen und Gleichstand;
  - Wochenraster mit Tagesgrenzen und Lücken;
  - jeder Muster-Satz mit und ohne Bedingung;
  - Reset-Reihenfolge, Zeitfenster, „Anderer“ über Bereichsgrenzen;
  - Pausen-Vorschlag;
  - Prüfen und Zusammenführen der neuen Daten, Backup hin und zurück;
  - Kontrast der Bereichsfarben in allen Stimmungen.
- **Browser (Engine):**
  - `hackProgram` mit Hinweistönen an den Schrittgrenzen und Klangschale am Ende;
  - `focusProgram` mit Hintergrund und ohne Vorlauf;
  - Weiterleitung der Ergebnisse nach Art; Mindestdauern.
- **E2E (Pixel 7 und 360 px):**
  - Reiterleiste mit sechs Reitern;
  - Check-in speichern → Akku-Karte → Reset schlägt Hack des schwächsten Bereichs vor → Hack-Karte → Player → Ende mit einer Wirkungsfrage → Lauf gespeichert;
  - Reset ohne frischen Check-in;
  - „Anderer“;
  - Bibliothek mit Filter;
  - Fokus-Sprint mit Ende, Pausen-Vorschlag und gemerkter Länge und Hintergrund;
  - Karte auf „Heute“ in beiden Zuständen;
  - Wochenraster und Muster-Satz mit vorbereiteten Daten;
  - Backup-Import mit neuen Einträgen.

## 10. Abnahme

- „Handy-Checkliste Meilenstein 9“ im README:
  - Check-in;
  - Reset;
  - ein Takt-, ein Schritte- und ein Ring-Hack bei gesperrtem Bildschirm;
  - Fokus-Sprint mit Lofi;
  - Wochenraster nach einigen Tagen;
  - 360 px und große Schrift;
  - Erinnerungen über den Wecker.
- Kosten: fünf Motive (unter 0,50 $). Keine Vertonung.

## 11. Annahmen

Vom Nutzer nicht einzeln entschieden, von Claude so festgelegt (bei Bedarf änderbar):

- **Zeiten und Schwellen:**
  - Schwelle „frisch“ 3 Stunden, Vorher-Wert bis 2 Stunden.
  - Mindestdauer 30 s (Hack) und 5 Minuten (Sprint).
  - Zeitfenster für „Tageslicht tanken“ (7–17 Uhr) und „Power-Pause“ (11–16 Uhr).
- **Darstellung:**
  - Takt-Hacks ohne Atemgeräusch, Schritte-Hacks mit leisem Hinweiston.
  - Bereichsfarben wie in den Entwürfen.
  - Platz der Karte auf „Heute“ zwischen Begrüßung und „Vorschlag des Tages“.
  - Reiter „Energie“ an zweiter Stelle.
- **Fokus-Sprint:**
  - Vorhaben höchstens 80 Zeichen.
  - Standard 50 Minuten mit „Kaffee & Notizen“.
