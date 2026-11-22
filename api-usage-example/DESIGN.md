---
name: Misja AED
description: Państwowa aplikacja ratunkowa. Biel, granat i jedno czerwone pole 112, szkło matowe tylko na warstwach nad mapą.
colors:
  ink-navy: "#0f1d33"
  ink-slate: "#33415a"
  paper-white: "#ffffff"
  paper-mist: "#f2f5f9"
  line-soft: "#c9d2df"
  line-strong: "#6b7a92"
  state-red: "#b00d26"
  state-red-ink: "#8f0a1f"
  state-red-tint: "#fdecef"
  access-green-ink: "#064e26"
  access-green-tint: "#e3f4ea"
  caution-amber-ink: "#6b4200"
  caution-amber-tint: "#fff1d6"
  focus-blue: "#0a3fa8"
  focus-blue-tint: "#e6eefb"
  slate-tint: "#e9edf3"
typography:
  display:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(3.25rem, 16vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.2
  title:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.25
rounded:
  sheet: "28px"
  search: "22px"
  control: "16px"
  field: "14px"
  tab: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.control}"
    height: "60px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "#1d2f4f"
  button-quiet:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.control}"
    height: "60px"
  button-quiet-hover:
    backgroundColor: "{colors.slate-tint}"
  sos-bar:
    backgroundColor: "{colors.state-red}"
    textColor: "{colors.paper-white}"
    height: "84px"
  sos-bar-hover:
    backgroundColor: "{colors.state-red-ink}"
  badge-ok:
    backgroundColor: "{colors.access-green-tint}"
    textColor: "{colors.access-green-ink}"
    rounded: "{rounded.pill}"
  badge-maybe:
    backgroundColor: "{colors.caution-amber-tint}"
    textColor: "{colors.caution-amber-ink}"
    rounded: "{rounded.pill}"
  badge-no:
    backgroundColor: "{colors.state-red-tint}"
    textColor: "{colors.state-red-ink}"
    rounded: "{rounded.pill}"
  map-button:
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.field}"
    size: "44px"
  search-input:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.field}"
    height: "52px"
---

# Design System: Misja AED

## Overview

**Creative North Star: "Karta odpowiedzi"**

Aplikacja najpierw odpowiada, potem pokazuje mapę. Jedna karta mówi, gdzie jest najbliższy AED, ile kroków do niego i czy można go użyć teraz. Całość jest białym, państwowym wnętrzem z granatowym tekstem o kontraście AAA, jednym czerwonym polem 112 pod kciukiem i matową szklaną warstwą nad mapą. Nie ma ozdób: ikony niosą znaczenie, a nie dekorację.

Gęstość jest niska, a cele dotykowe duże, bo użytkownik jest w stresie, trzyma telefon jedną ręką i patrzy pod słońce. Typografia jest ciężka i duża tam, gdzie liczy się liczba (odległość), a spokojna tam, gdzie jest opis. Szkło jest tu materiałem nawigacji i arkuszy, nigdy nośnikiem krytycznej treści.

**Key Characteristics:**
- Biel i granat jako tło i tekst; czerwień jako sygnał, nie dekoracja.
- Szkło matowe (bez załamania światła) na arkuszu, wyszukiwarce i przyciskach mapy; zastępowane litym kolorem na życzenie systemu.
- Znaczenie zawsze podwójne: ikona i tekst, kształt i kolor.
- Duże, zaokrąglone cele dotykowe (min. 44 px, główne 60 px).
- Jeden autorski ruch: arkusz wynurza się nad mapą.

## Colors

Paleta państwowa: biel, granat i czerwień, z trzema parami ink/tint dla stanów dostępności.

### Primary
- **Granat tekstu** (#0f1d33): tekst główny, przyciski główne, aktywna zakładka i język, skupienie klastrów na mapie, pierścień wybranego AED.
- **Czerwień 112** (#b00d26): pasek 112 (największe i jedyne w pełni nasycone pole), numery kroków RKO, dolna połowa flagi w nagłówku, marker AED dostępnego od ręki (tier 0), kursor w polu i zaznaczenie tekstu. Biały tekst na niej ma kontrast 7,2:1.
- **Czerwień ciemna** (#8f0a1f): najechanie na pasek 112 i tekst znaczka „brak dostępu".

### Secondary
- **Zieleń dostępu** (#064e26 na #e3f4ea): znaczek „można użyć".
- **Bursztyn ostrożności** (#6b4200 na #fff1d6): znaczek „może być ograniczony", komunikaty offline, wersja robocza, powiadomienia.
- **Niebieski fokusu** (#0a3fa8, tło #e6eefb): pierścień fokusu, linki, punkt użytkownika na mapie.

### Neutral
- **Biel papieru** (#ffffff): tło aplikacji, pola, przycisk drugorzędny.
- **Mgła papieru** (#f2f5f9): tło metronomu, najechanie na wiersze listy.
- **Szarogranat tekstu** (#33415a): tekst drugorzędny (10:1 na bieli).
- **Linia** (#c9d2df, mocna #6b7a92): separatory i obramowania pól; w trybie wysokiego kontrastu linia przechodzi na mocną.
- **Szary łupek** (#e9edf3): tło zaznaczonej zakładki, tło mapy przed załadowaniem, najechanie.

### Named Rules
**The One Saturated Field Rule.** Pasek 112 jest jedynym w pełni nasyconym polem ekranu. Czerwień poza nim to akcenty małej powierzchni (marker, numer kroku, pasek flagi), nigdy duże tło ani przycisk.

**The Tint Pair Rule.** Każdy stan ma parę ink na tint zmierzoną na kontrast co najmniej 7,8:1. Nowy stan dostaje nową parę, nie przezroczystość.

## Typography

**Display Font:** Source Sans 3 (z system-ui, Segoe UI, Roboto), hostowany lokalnie, zmienna waga 400 do 800
**Body Font:** ta sama rodzina
**Label/Mono Font:** brak; cyfry tabelaryczne ustawione globalnie

**Character:** Jedna humanistyczna bezszeryfowa rodzina w trzech wagach (400, 700, 800), z zestawami łacińskim, łacińskim rozszerzonym i cyrylicą, więc PL, EN i UK wyglądają tak samo. Hierarchię buduje waga i rozmiar, nie dodatkowy krój.

### Hierarchy
- **Display** (800, clamp(3.25rem, 16vw, 4.5rem), 0.95): odległość do AED, największy element arkusza.
- **Headline** (800, 2rem, 1.2): tytuł stron RKO i o aplikacji; liczba 112 w pasku ma 3.25rem.
- **Title** (700, 1.25rem, 1.25): nazwa miejsca, tytuły kroków, tytuł stanu 1.5rem w wadze 800.
- **Body** (400, 1.125rem, 1.5): tekst czytany, do 68ch na stronach tekstowych.
- **Label** (700, 1.0625rem, 1.25): znaczki, przyciski drugorzędne, wiersze list; przyciski główne 1.1875rem.

### Named Rules
**The Number First Rule.** Liczba, od której zależy decyzja (odległość, 112), jest największym tekstem w swojej strefie, w wadze 800.

**The Tabular Rule.** Cyfry są tabelaryczne globalnie, żeby odległości i licznik metronomu nie skakały.

## Layout

Telefon jest układem bazowym: siatka trzech wierszy na 100dvh (nagłówek, treść, pasek 112), jedna kolumna. Nagłówek składa się z paska flagi (6 px), wiersza marki i języka (min. 52 px) oraz zakładek (58 px, ikona nad tekstem). Treść to mapa pełnej szerokości z arkuszem przyklejonym do dołu (do 66% wysokości) i wyszukiwarką u góry (12 px od krawędzi). Pasek 112 ma 84 px, uwzględnia safe-area.

Od 820 px panel (380 do 440 px) przechodzi na lewo, a mapa na prawo; zakładki stają się poziome (44 px). Strony tekstowe mają kolumnę do 44rem. Rytm odstępów to 4, 8, 12, 18, 24 px; w arkuszu odstęp elementów 10 px. Przycisk trasy jest przyklejony do dołu przewijanego arkusza.

## Elevation & Depth

Głębia pochodzi z jednej metafory: szkło matowe unosi się nad mapą. Warstwy szklane to arkusz, wyszukiwarka (formularz i lista wyników) i przyciski mapy: tło białe 92%, `backdrop-filter: blur(18px) saturate(1.5)`, cienka ciemna obwódka (granat 14%) i jasna wewnętrzna krawędź. Wszystko inne jest płaskie na białym i oddzielone linią 1 px.

Przy `prefers-reduced-transparency: reduce` lub `prefers-contrast: more` szkło staje się litą bielą bez rozmycia, obwódka granatowa, a przy wysokim kontraście obramowania 2 px. Na szerokim ekranie arkusz jest panelem płaskim, bez szkła i cienia.

### Shadow Vocabulary
- **Arkusz** (`0 -10px 36px rgb(15 29 51 / 0.2), 0 -1px 0 rgb(15 29 51 / 0.08)`): arkusz dolny, cień w górę.
- **Warstwa** (`0 6px 24px rgb(15 29 51 / 0.16)`): wyszukiwarka i lista wyników.
- **Przycisk mapy** (`0 4px 14px rgb(15 29 51 / 0.18)`): przyciski zoomu i centrowania.
- **Fokus** (`0 0 0 6px #fff`): biała aureola pod pierścieniem fokusu.

### Named Rules
**The Glass Never Carries Critical Text Rule.** Szkło nie leży pod odległością, statusem ani przyciskiem 112 jako jedynym tłem; tekst krytyczny ma lity biały lub czerwony grunt albo szkło o nieprzezroczystości 92% i kontraście co najmniej 12:1.

**The Honest Fallback Rule.** Każda właściwość szkła ma lity odpowiednik pod ustawieniami systemowymi.

## Shapes

Okrągłe, duże formy. Arkusz ma górne rogi 28 px, wyszukiwarka 22 px, przyciski i przyciski wyboru 16 px, pola i przyciski mapy 14 px, zakładki i język 12 px, znaczki są pigułkami (999 px). Metronom ma 20 px, komunikaty 14 px. Markery mapy to koła z białą lub czerwoną obwódką 3 px.

Znaczenie markerów nie opiera się na kolorze: pełne czerwone koło oznacza AED dostępny od ręki (tier 0), puste (białe z czerwoną obwódką) oznacza niepewny lub ograniczony dostęp; klastry to granatowe koła z białą obwódką.

## Components

### Buttons
- **Shape:** zaokrąglone 16 px, wysokość 60 px (mniejsze 48 px), obramowanie 2 px granatowe.
- **Primary:** granat (#0f1d33) z białym tekstem 1.1875rem, waga 700, ikona i tekst wyśrodkowane.
- **Quiet:** biały z granatowym tekstem i obramowaniem; najechanie szary łupek.
- **Hover / Focus:** zmiana tła; fokus wspólny, patrz Do's.

### Znaczki dostępności
Pigułka z ikoną i tekstem (waga 700, 1.0625rem). Trzy rodzaje: zielony (można użyć), bursztynowy (może być ograniczony), czerwony tint (brak dostępu). Ikona wyróżnia każdy stan (potwierdzenie, zegar, osoby, znak zapytania, ostrzeżenie, klucz, kłódka, zakaz); kolor tylko wspiera. Przy wysokim kontraście obramowanie 2 px.

### Pasek 112
Stały, na całą szerokość, czerwony (#b00d26), tekst biały 1.25rem, numer 3.25rem w wadze 800 z ikoną telefonu; link `tel:112`. Fokus: biały pierścień 3 px wewnątrz paska.

### Wyszukiwarka
Szklany formularz z polem 52 px (obramowanie 2 px, #6b7a92), przyciskiem czyszczenia 44 px i przyciskiem szukania 56 na 52 px w granacie. Lista wyników na szkle, wiersze min. 52 px.

### Zakładki i przełącznik języka
Zakładki 58 px (44 px na szerokim ekranie), aktywna z tłem szary łupek i obramowaniem granatowym 2 px. Język: cele 44 px, aktywny granatowy z białym tekstem.

### Arkusz wyniku
Tytuł, odległość (Display), czas marszu i kierunek ze strzałką, znaczek dostępności, nazwa miejsca, fakty (godziny, wnętrze, operator, data sprawdzenia), lepki dolny blok z przyciskami. Lista „inne AED" z wierszami min. 64 px.

### Kroki RKO i metronom
Kroki: numer 2.25rem w wadze 800 czerwony, linia 1 px nad każdym. Metronom: ramka 2 px granatowa, 20 px promień, licznik 3.5rem, pasek 30 segmentów.

## Do's and Don'ts

### Do:
- **Do** trzymać cele dotykowe co najmniej 44 px, a główne akcje 60 px.
- **Do** dawać każdemu stanowi ikonę i tekst; kolor jest wsparciem.
- **Do** używać fokusu: pierścień 3 px #0a3fa8, odsunięcie 3 px, aureola `0 0 0 6px #fff`; na pasku 112 biały pierścień wewnątrz.
- **Do** stosować szkło (biel 92%, `blur(18px) saturate(1.5)`) tylko na warstwach nad mapą i zawsze z litym odpowiednikiem pod `prefers-reduced-transparency` i `prefers-contrast: more`.
- **Do** ograniczać ruch pod `prefers-reduced-motion` (czasy animacji praktycznie zerowe); ruch autorski to jedno wynurzenie arkusza (460 ms, `cubic-bezier(0.16, 1, 0.3, 1)`).
- **Do** mierzyć nową parę kolorów stanu na kontrast co najmniej 7:1.

### Don't:
- **Don't** robić drugiego dużego czerwonego pola ani czerwonego przycisku; czerwień dużej powierzchni należy do paska 112.
- **Don't** kłaść szkła pod odległością, statusem ani tekstem krytycznym bez litego gruntu.
- **Don't** opierać znaczenia markera lub stanu na samym kolorze.
- **Don't** dodawać biblioteki Liquid Glass ani załamania światła; szkło jest wyłącznie matowe.
