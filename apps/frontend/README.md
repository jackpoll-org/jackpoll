# Survey System

<p align="center">
  <img src="https://img.shields.io/badge/status-MVP%20planning-2563eb?style=for-the-badge" alt="Status Badge" />
  <img src="https://img.shields.io/badge/license-MIT%20or%20Apache--2.0-16a34a?style=for-the-badge" alt="License Badge" />
  <img src="https://img.shields.io/badge/open%20source-yes-f59e0b?style=for-the-badge" alt="Open Source Badge" />
  <img src="https://img.shields.io/badge/built%20for-school%20project-7c3aed?style=for-the-badge" alt="School Project Badge" />
</p>

<p align="center">
  <img src="docs/badges/gdpr-ready.svg" alt="GDPR ready" />
  &nbsp;
  <img src="docs/badges/dsgvo-konform.svg" alt="DSGVO konform" />
</p>

<p align="center">
  <b>Ein Open-Source-System zum Erstellen, Teilen und Auswerten von Umfragen und Quizzen.</b>
</p>

---

## Übersicht

Survey System ist eine freie Alternative zu proprietären Formular- und Umfragetools. Das Projekt orientiert sich bei den Grundfunktionen an öffentlich beschriebenen Kernfunktionen von Google Forms, darunter mehrere Fragetypen, Drag-and-drop, bedingte Folgefragen, Einbettung, Zusammenarbeit, Quizfunktionen und grafische Auswertung. [cite:1][cite:17][cite:18]

## Inhaltsverzeichnis

- [Features](#features)
- [Architekturidee](#architekturidee)
- [MVP](#mvp)
- [Roadmap](#roadmap)
- [Lizenz](#lizenz)

---

## Features

### 1. Auth System

- Registrierung, Login und Logout
- Rollen und Rechte, zum Beispiel **Admin**, **Editor** und **Viewer**
- Passwort-Reset und E-Mail-Verifizierung
- Optionale OAuth-Anbindung, zum Beispiel Google oder GitHub
- Team- und Projektzugehörigkeiten für kollaboratives Arbeiten

### 2. Formular-Builder

Ein visueller Builder zum Erstellen und Bearbeiten von Umfragen mit frei verschiebbaren Elementen per Drag-and-drop. Google beschreibt diese freie Umstrukturierung von Formularinhalten als Kernfunktion. [cite:1][cite:17]

#### Fragentypen

- Kurzantwort
- Multiple Choice
- Kontrollkästchen
- Drop-down
- Multiple-Choice-Raster
- Kontrollkästchen-Raster

Diese Fragetypen werden in den offiziellen Hilfeseiten zu Google-Quizzen als unterstützte Fragetypen genannt und sind daher eine sinnvolle Basis für euer eigenes System. [cite:18]

#### Weitere Builder-Funktionen

- Dateiupload für Bilder
- Antwortvalidierung bei fehlerhaften Eingaben
- Freies Drag-and-drop von Fragen
- Folgefragen je nach Antwort
- Umfragen einbetten
- Mitarbeitende einladen
- Bestätigungsnachricht anpassen
- Quiz-Modus mit Fragen, Punkten und eigener Erweiterung für Zeitlimit

Google beschreibt Datei-Uploads, Antwortvalidierung, Einbettung, Zusammenarbeit und Quizfunktionen offiziell; ein Zeitlimit gehört jedoch nicht zu den ausdrücklich beschriebenen Standardfunktionen und sollte daher als eigene Erweiterung gekennzeichnet werden. [cite:17][cite:18]

### 3. Auswertung

Antworten sollen in Echtzeit gesammelt, aufbereitet und grafisch dargestellt werden. Google beschreibt automatische Diagramme, grafische Zusammenfassungen und weiterführende Auswertung über verknüpfte Tabellen. [cite:1][cite:17]

#### Geplante Diagrammtypen

- Balkendiagramme
- Kreisdiagramme
- Liniendiagramme
- Häufigkeitsverteilungen
- Quiz-Statistiken wie Durchschnitt und Punktespannen
- CSV-Export und Tabellenanbindung

---

## Architekturidee

```text
Frontend (React / Vue / Svelte)
        |
        v
API / Backend (Node.js / Python / Go)
        |
        +--> Auth Service
        +--> Survey Builder Service
        +--> Response Service
        +--> Analytics Service
        |
        v
Database (PostgreSQL / MySQL)
        |
        +--> File Storage (S3-kompatibel)
```

### Empfohlene Module

- **Frontend:** React, Vue oder Svelte
- **Backend:** Node.js, Python oder Go
- **Datenbank:** PostgreSQL oder MySQL
- **Storage:** S3-kompatibler Dateispeicher für Bilder
- **Charts:** Chart.js, Apache ECharts oder Recharts
- **Auth:** JWT oder Session-basierte Authentifizierung

---

## MVP

Für eine erste Version reicht ein klarer, kleiner Kern:

- Auth System
- Formular-Builder mit sechs Grundfragetypen
- Bild-Upload
- Antwortvalidierung
- Bedingte Folgefragen
- Teilen per Link und Einbettung
- Kollaboration mit Rollen
- Quiz-Modus ohne Zeitlimit in Version 1
- Ergebnisansicht mit Basisdiagrammen

---

## Roadmap

### Phase 1
- Auth und Projektverwaltung
- Form Builder
- Grundlegende Fragetypen
- Antworten speichern

### Phase 2
- Kollaboration
- Bedingte Logik
- Einbettung
- Uploads

### Phase 3
- Quizmodus
- Erweiterte Validierung
- Dashboards und Diagramme
- Exporte und API

### Phase 4
- Zeitlimit für Quizze
- Plugin-System
- Mehrsprachigkeit
- Barrierefreiheit
- Theme-System

---

## Lizenz

Empfohlen: **MIT** oder **Apache-2.0** für maximale Offenheit und einfache Mitwirkung.

---

## Inspiration

Die Funktionsbasis orientiert sich teilweise an öffentlich dokumentierten Funktionen von Google Forms, unter anderem an Formularerstellung, Quizfunktionen, Zusammenarbeit und grafischer Antwortauswertung. [cite:1][cite:17][cite:18]

## Quellenhinweis

- Google Forms unterstützt mehrere Fragetypen, Drag-and-drop, Teilen per Link oder Einbettung sowie Echtzeit-Auswertung. [cite:1][cite:17]
- Die offizielle Hilfe beschreibt das Erstellen und Bewerten von Quizzen in Google Forms. [cite:18]
- Statische Badges für GitHub-READMEs lassen sich mit Shields.io erzeugen. [cite:30][cite:34]
