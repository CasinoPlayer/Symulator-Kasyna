-- Dane startowe aplikacji. Tabele tworzy Hibernate z encji, a ten plik Spring Boot uruchamia zaraz potem.
-- LAB 01: dopiszcie tu konta wszystkich osób z zespołu (reguła R1.03).
-- LAB 02: dopiszcie dane do swoich tabel (kolejność: najpierw tabele, na które wskazują klucze obce).
insert into user_account (email, display_name, role, created_at) values
    ('ola@student.merito.pl',   'Ola',   'USER',    current_timestamp),
    ('kuba@student.merito.pl',  'Kuba',  'USER',    current_timestamp),
    ('firma@example.com',       'Firma', 'PARTNER', current_timestamp),
    ('admin@example.com',       'Admin', 'ADMIN',   current_timestamp);

-- LAB 01 (R1.03): konta zespołu Cebulion Casino (rola USER)
insert into user_account (email, display_name, role, created_at) values
    ('s428425@student.wroclaw.merito.pl', 'Konrad Paulus',      'USER', current_timestamp),
    ('s433776@student.wroclaw.merito.pl', 'Dominik Pacanowski', 'USER', current_timestamp),
    ('s156704@student.wroclaw.merito.pl', 'Dawid Majewski',     'USER', current_timestamp);

-- LAB 02: trzy automaty Cebulion Casino (parametry z briefu projektu, docs/projekt/07).
-- Poziomy zakładu to kolumna tekstowa (konwerter BetLevelsConverter): min_bet/max_bet = pierwszy/ostatni poziom.
-- line_count = null dla gry klastrowej. features: punkty opisu funkcji gry rozdzielone znakiem |.
insert into slot_machine (code, name, engine_type, reel_count, row_count, line_count, bet_levels,
                          min_bet, max_bet, target_rtp, volatility, features, active) values
    ('cebulowy-777', 'Cebulowy 777', 'LINES', 3, 3, 5, '10,20,50,100,200,500,1000',
     10, 1000, 95.00, 'LOW_MEDIUM',
     '5 linii: 3 poziome i 2 skośne|WILD (Złota Cebula) zastępuje każdy symbol|Neonowy mnożnik: wygrana z WILD na linii ×2|NEON JACKPOT: cały ekran tego samego symbolu ×10|Wypłata linii = mnożnik z tabeli × stawka na linię (zakład ÷ 5); maksymalna wygrana 1 000× zakładu',
     true),
    ('zloty-faraon', 'Złoty Faraon', 'LINES', 5, 3, 20, '20,40,100,200,400,1000,2000',
     20, 2000, 96.00, 'MEDIUM_HIGH',
     '20 linii wygrywających|WILD (Złota Relikwia Cebuli) zastępuje symbole poza scatterem|3 lub więcej scatterów (piramida): 10 darmowych spinów|W darmowych spinach WILD rozszerza się na cały bęben, a wygrane są ×2|3 scattery w darmowych spinach: +10 spinów (łącznie najwyżej 50)|Wypłata linii = mnożnik z tabeli × stawka na linię (zakład ÷ 20), scatter × zakład całkowity; maksymalna wygrana 5 000× zakładu',
     true),
    ('krysztalowa-kaskada', 'Kryształowa Kaskada', 'CLUSTER', 6, 5, null, '20,40,100,200,400,1000,2000',
     20, 2000, 96.00, 'HIGH',
     'Wygrane klastrowe: 5 lub więcej takich samych symboli połączonych poziomo lub pionowo|Kaskady: wygrane symbole pękają, a na ich miejsce spadają nowe|4 lub więcej scatterów (Serce Jaskini): 10 darmowych spinów|W darmowych spinach spadają kule mnożników ×2…×100, sumowane i mnożone przez wygraną sekwencji kaskad|3 scattery w darmowych spinach: +5 spinów (łącznie najwyżej 50)|Wypłata klastra = mnożnik z tabeli za jego rozmiar × zakład całkowity; maksymalna wygrana 10 000× zakładu',
     true);

-- Matematyka gier (docs/projekt/07-gry-i-matematyka.md): symbole, wagi, wypłaty, taśmy bębnów i linie.
-- Wartości są skalibrowane symulacją (testy *MathTest): S1 ~95%, S2 ~96%, S3 ~96% RTP. Zmiana dowolnej liczby
-- zmienia RTP, więc po edycji trzeba uruchomić testy matematyki (mvn verify) i zaktualizować dokument 07.
-- pays: "liczba:mnożnik" (linie: dokładna liczba symboli od lewej, mnożnik stawki na linię;
--        klastry i scatter: "co najmniej tyle", mnożnik zakładu całkowitego).
-- weight: gry liniowe = ile razy symbol jest na taśmach gry podstawowej (informacyjnie, test pilnuje zgodności);
--         gra klastrowa = waga losowania pola (kula mnożnika tylko w darmowych spinach).
-- Taśmy: bębny rozdzielone |, symbole przecinkami (ReelStrips); linie: indeksy rzędów od 0 = górny (Paylines).

-- cebulowy-777
insert into slot_symbol (slot_machine_id, code, kind, weight, pays, sort_order) values
    ((select id from slot_machine where code = 'cebulowy-777'), 'wisnie', 'NORMAL', 21, '3:1.5', 1),
    ((select id from slot_machine where code = 'cebulowy-777'), 'cytryna', 'NORMAL', 18, '3:2.5', 2),
    ((select id from slot_machine where code = 'cebulowy-777'), 'sliwka', 'NORMAL', 12, '3:4', 3),
    ((select id from slot_machine where code = 'cebulowy-777'), 'arbuz', 'NORMAL', 12, '3:5', 4),
    ((select id from slot_machine where code = 'cebulowy-777'), 'dzwonek', 'NORMAL', 9, '3:10', 5),
    ((select id from slot_machine where code = 'cebulowy-777'), 'bar', 'NORMAL', 9, '3:14', 6),
    ((select id from slot_machine where code = 'cebulowy-777'), 'siodemka', 'NORMAL', 6, '3:50', 7),
    ((select id from slot_machine where code = 'cebulowy-777'), 'wild', 'WILD', 9, '3:100', 8);
-- 3 taśmy po 32 symbole
update slot_machine set
    reel_strips =
     'wisnie,siodemka,bar,wisnie,sliwka,cytryna,wild,arbuz,siodemka,wisnie,wisnie,wisnie,arbuz,dzwonek,sliwka,arbuz,wisnie,sliwka,dzwonek,cytryna,bar,cytryna,bar,dzwonek,cytryna,cytryna,cytryna,arbuz,wisnie,wild,sliwka,wild|' ||
     'dzwonek,wisnie,wisnie,wisnie,wild,dzwonek,cytryna,wild,wisnie,dzwonek,sliwka,wild,wisnie,siodemka,cytryna,cytryna,cytryna,sliwka,arbuz,bar,arbuz,wisnie,arbuz,sliwka,cytryna,bar,arbuz,wisnie,sliwka,bar,siodemka,cytryna|' ||
     'bar,wisnie,sliwka,dzwonek,cytryna,cytryna,cytryna,wild,sliwka,siodemka,cytryna,sliwka,arbuz,wisnie,bar,wisnie,sliwka,bar,wisnie,arbuz,wild,dzwonek,siodemka,wisnie,wisnie,wisnie,arbuz,cytryna,dzwonek,cytryna,arbuz,wild',
    paylines = '1,1,1|0,0,0|2,2,2|0,1,2|2,1,0'
where code = 'cebulowy-777';

-- zloty-faraon (WILD tylko na bębnach 2–4, bez własnej wypłaty; scatter co najwyżej 1 na bęben w oknie)
insert into slot_symbol (slot_machine_id, code, kind, weight, pays, sort_order) values
    ((select id from slot_machine where code = 'zloty-faraon'), '10', 'NORMAL', 22, '3:12,4:50,5:200', 1),
    ((select id from slot_machine where code = 'zloty-faraon'), 'j', 'NORMAL', 20, '3:12,4:50,5:200', 2),
    ((select id from slot_machine where code = 'zloty-faraon'), 'q', 'NORMAL', 20, '3:12,4:50,5:250', 3),
    ((select id from slot_machine where code = 'zloty-faraon'), 'k', 'NORMAL', 20, '3:20,4:80,5:300', 4),
    ((select id from slot_machine where code = 'zloty-faraon'), 'a', 'NORMAL', 20, '3:25,4:100,5:400', 5),
    ((select id from slot_machine where code = 'zloty-faraon'), 'ankh', 'NORMAL', 15, '3:30,4:125,5:500', 6),
    ((select id from slot_machine where code = 'zloty-faraon'), 'oko', 'NORMAL', 15, '3:40,4:150,5:600', 7),
    ((select id from slot_machine where code = 'zloty-faraon'), 'skarabeusz', 'NORMAL', 15, '3:50,4:200,5:750', 8),
    ((select id from slot_machine where code = 'zloty-faraon'), 'anubis', 'NORMAL', 10, '3:75,4:300,5:1000', 9),
    ((select id from slot_machine where code = 'zloty-faraon'), 'faraon', 'NORMAL', 10, '3:100,4:500,5:2500', 10),
    ((select id from slot_machine where code = 'zloty-faraon'), 'wild', 'WILD', 3, null, 11),
    ((select id from slot_machine where code = 'zloty-faraon'), 'scatter', 'SCATTER', 5, '3:1,4:10,5:100', 12);
-- 5 taśm po 35 symboli (gra podstawowa) + 5 taśm darmowych spinów (35/40/40/40/35, po 2 WILD na bębnach 2–4)
update slot_machine set
    reel_strips =
     'ankh,oko,q,a,10,j,10,k,anubis,a,skarabeusz,j,k,q,skarabeusz,faraon,a,q,oko,j,k,j,a,10,k,ankh,10,anubis,faraon,10,q,ankh,oko,skarabeusz,scatter|' ||
     '10,ankh,skarabeusz,faraon,a,wild,j,oko,ankh,10,j,q,anubis,k,skarabeusz,k,a,j,anubis,oko,10,j,skarabeusz,q,scatter,oko,10,k,q,ankh,faraon,a,k,q,a|' ||
     'anubis,k,wild,j,oko,j,10,skarabeusz,10,q,faraon,ankh,a,q,skarabeusz,k,oko,scatter,j,skarabeusz,faraon,a,q,10,ankh,a,q,anubis,k,10,j,k,ankh,oko,a|' ||
     'faraon,scatter,j,faraon,q,j,10,skarabeusz,a,k,q,ankh,k,skarabeusz,anubis,skarabeusz,a,10,ankh,j,anubis,wild,ankh,a,10,oko,10,a,oko,k,oko,q,j,q,k|' ||
     'j,10,skarabeusz,ankh,k,anubis,k,q,skarabeusz,10,k,q,faraon,scatter,oko,ankh,a,j,anubis,ankh,q,oko,q,j,oko,10,skarabeusz,a,10,a,faraon,10,k,j,a',
    free_reel_strips =
     'anubis,a,k,10,skarabeusz,k,oko,10,a,10,faraon,j,q,ankh,j,10,oko,j,scatter,ankh,j,skarabeusz,k,q,skarabeusz,a,k,10,anubis,oko,faraon,a,q,ankh,q|' ||
     'k,q,anubis,a,oko,q,j,10,j,oko,a,k,10,q,j,a,anubis,10,k,ankh,10,ankh,faraon,10,wild,oko,j,ankh,skarabeusz,10,scatter,q,j,k,q,a,wild,skarabeusz,k,j|' ||
     'anubis,ankh,a,10,scatter,10,k,q,10,ankh,a,j,q,j,k,a,oko,j,k,ankh,j,wild,skarabeusz,j,faraon,j,k,q,anubis,q,skarabeusz,a,oko,10,wild,q,oko,10,k,10|' ||
     'q,10,a,10,scatter,j,k,j,wild,a,q,a,j,skarabeusz,k,anubis,k,wild,j,q,oko,10,oko,10,k,10,oko,j,q,k,j,ankh,skarabeusz,a,ankh,q,ankh,10,anubis,faraon|' ||
     '10,ankh,k,ankh,skarabeusz,k,j,10,q,10,faraon,anubis,q,oko,ankh,j,skarabeusz,anubis,a,j,10,a,oko,10,q,skarabeusz,q,j,k,a,oko,faraon,k,scatter,a',
    paylines = '1,1,1,1,1|0,0,0,0,0|2,2,2,2,2|0,1,2,1,0|2,1,0,1,2|0,0,1,2,2|2,2,1,0,0|1,0,0,0,1|1,2,2,2,1|1,0,1,2,1|1,2,1,0,1|0,1,0,1,0|2,1,2,1,2|0,1,1,1,0|2,1,1,1,2|1,1,0,1,1|1,1,2,1,1|0,2,0,2,0|2,0,2,0,2|2,2,0,2,2'
where code = 'zloty-faraon';

-- krysztalowa-kaskada (wagi losowania pól; suma w grze podstawowej 1244, w darmowych spinach 1372 z kulami)
insert into slot_symbol (slot_machine_id, code, kind, weight, pays, sort_order) values
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'szafir', 'NORMAL', 300, '5:0.7,6:0.9,7:1.1,8:1.4,9:1.75,10:2.25,12:4.5,15:9,20:30,25:70', 1),
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'szmaragd', 'NORMAL', 270, '5:0.9,6:1.1,7:1.4,8:1.75,9:2.25,10:3,12:6,15:12,20:35,25:90', 2),
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'ametyst', 'NORMAL', 240, '5:1.1,6:1.4,7:1.75,8:2.25,9:3,10:3.5,12:7,15:14,20:45,25:120', 3),
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'topaz', 'NORMAL', 200, '5:1.4,6:1.75,7:2.25,8:3,9:3.5,10:4.5,12:9,15:18,20:60,25:150', 4),
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'rubin', 'NORMAL', 90, '5:2.25,6:3,7:3.5,8:4.5,9:6,10:7,12:14,15:30,20:90,25:250', 5),
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'diament', 'NORMAL', 70, '5:3,6:3.5,7:4.5,8:6,9:7,10:9,12:18,15:35,20:120,25:350', 6),
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'cebula', 'NORMAL', 50, '5:4.5,6:6,7:7,8:9,9:12,10:14,12:30,15:60,20:180,25:600', 7),
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'scatter', 'SCATTER', 24, '4:5,5:10,6:100', 8),
    ((select id from slot_machine where code = 'krysztalowa-kaskada'), 'mnoznik', 'MULTIPLIER', 128, null, 9);
