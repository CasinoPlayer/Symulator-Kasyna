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
