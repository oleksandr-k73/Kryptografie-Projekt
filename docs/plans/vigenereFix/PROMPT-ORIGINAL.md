# Ursprünglicher Prompt für die Untersuchung der Problem mit Vigenere-Knacken

Bei Vigenere funktioniert das Knacken immer noch nicht. Der Geheimtext "Zfcurbctpdqrau" mit dem Schlüssel "Brick" soll "Youshallntpass" ergeben. Stattdessen gibt mir das Programm folgende Kandidaten: 
Schlüssel: NZSLZ | Score: 1.83 | Wörterbuch: 0% | Nderkbodeielcv
Schlüssel: GJSLQ | Score: 1.61 | Wörterbuch: 0% | Utertiederlbcv
Schlüssel: XKUVF | Score: 1.59 | Wörterbuch: 0% | Dscherdbucuaal
Schlüssel: XJQYW | Score: 1.58 | Wörterbuch: 0% | Dtgenrefrlubei
Schlüssel: WGDCP | Score: 1.57 | Wörterbuch: 0% | Ewtaushsnsvere
Ermittle, warum keiner der Kandidaten die Überprüfung mit dem Wörterbuch passiert. Erstelle Tests zu MINDESTENS diesen Fällen:
1. Wörter können in zusammengesetzten Texten nicht erkannt werden (Bei "You shallnt pass" würde dann das Programm schon). 
2. Die Sprache spielt eine Rolle. Wenn es spezifisch nach Englisch umgestellt sein würde, hätte das Programm die richtige Lösung gefunden.   
3. Es werden nicht genügend Kandidaten geprürft. Probiere mit 1 Million, 10 Millionen und n^(Länge des Schlüssels) Kandidaten. Dokumentiere die Ergenisse und Auswirungen auf die Leistung.

Probiere außerdem mit  "APCZX XTPMPH" und Schlüssellänge 5. Welche Tests bei solchen Fällen (kurzer Geheimtext, relativ langer Schlüssel) kann man erstellen, um den Erfolg einer Knackimplementierung sicherzustellen? (Z. B.: Bruteforce)

Finde AUF JEDEN FALL zusätzlich eigene Testfälle und untersuche das Problem, bis es schließlich vollständig behoben sein kann. Du darfst vorerst nur installierte Bibliotheken benutzen; neue nur nach meinem Erlaubnis. Notiere aber, welche du am Besten benötigen würdest. Gib mir den Plan nur dann, wenn:
1. das Problem zumindest für 10000 verschiedene Geheimtexte (kurz und lang; NUR DIE SCHLÜSSELLÄNGE BEKANNT, die relativ zur Textlänge sowohl kurz als auch läng bzw. deckungsgleich sein kann) konsistent behoben ist,
2. du es eindeutig identifiziert hast.