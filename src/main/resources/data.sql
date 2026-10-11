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
     '5 linii: 3 poziome i 2 skośne|WILD (Złota Cebula) zastępuje każdy symbol|Neonowy mnożnik: wygrana z WILD na linii ×2|NEON JACKPOT: cały ekran tego samego symbolu ×10',
     true),
    ('zloty-faraon', 'Złoty Faraon', 'LINES', 5, 3, 20, '20,40,100,200,400,1000,2000',
     20, 2000, 96.00, 'MEDIUM_HIGH',
     '20 linii wygrywających|WILD (Złota Relikwia Cebuli) zastępuje symbole poza scatterem|3 lub więcej scatterów (piramida): 10 darmowych spinów|W darmowych spinach WILD rozszerza się na cały bęben, a wygrane są ×2|3 scattery w darmowych spinach: +10 spinów',
     true),
    ('krysztalowa-kaskada', 'Kryształowa Kaskada', 'CLUSTER', 6, 5, null, '20,40,100,200,400,1000,2000',
     20, 2000, 96.00, 'HIGH',
     'Wygrane klastrowe: 5 lub więcej takich samych symboli połączonych poziomo lub pionowo|Kaskady: wygrane symbole pękają, a na ich miejsce spadają nowe|4 lub więcej scatterów (Serce Jaskini): 10 darmowych spinów|W darmowych spinach spadają kule mnożników ×2…×100, sumowane i mnożone przez wygraną sekwencji kaskad',
     true);
