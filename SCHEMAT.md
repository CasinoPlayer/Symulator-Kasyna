# Schemat bazy danych

Plik generują reguły projektu (panel Maven → Lifecycle → verify). Nie edytujcie go ręcznie.

Tabele: 7 · kolumny: 65 · relacje: 6 × @ManyToOne, 1 × @OneToMany, 1 × @OneToOne, 0 × @ManyToMany

| Tabela | Encja | Kolumny | Klucze obce |
|---|---|---|---|
| player_machine_stats | PlayerMachineStats | 9 | slot_machine_id, user_id |
| slot_machine | SlotMachine | 17 | — |
| slot_symbol | SlotSymbol | 7 | slot_machine_id |
| spin_round | SpinRound | 13 | slot_machine_id, user_id |
| user_account | UserAccount | 5 | — |
| wallet | Wallet | 6 | user_id |
| wallet_transaction | WalletTransaction | 8 | wallet_id |

```mermaid
erDiagram
    player_machine_stats {
        Long id PK
        BigDecimal biggest_win
        Instant biggest_win_at
        Instant last_played_at
        Long slot_machine_id FK
        long spins
        BigDecimal total_wagered
        BigDecimal total_won
        Long user_id FK
    }
    slot_machine {
        Long id PK
        boolean active
        BetLevels bet_levels
        String code
        EngineType engine_type
        String features
        ReelStrips free_reel_strips
        Integer line_count
        BigDecimal max_bet
        BigDecimal min_bet
        String name
        Paylines paylines
        int reel_count
        ReelStrips reel_strips
        int row_count
        BigDecimal target_rtp
        Volatility volatility
    }
    slot_symbol {
        Long id PK
        String code
        SymbolKind kind
        Payouts pays
        Long slot_machine_id FK
        int sort_order
        int weight
    }
    spin_round {
        Long id PK
        BigDecimal bet
        Instant created_at
        String idempotency_key
        BigDecimal multiplier
        String result_json
        long seed
        Instant settled_at
        Long slot_machine_id FK
        SpinStatus status
        WinTier tier
        BigDecimal total_win
        Long user_id FK
    }
    user_account {
        Long id PK
        LocalDateTime created_at
        String display_name
        String email
        AccountRole role
    }
    wallet {
        Long id PK
        BigDecimal balance
        Instant last_rescue_at
        Instant updated_at
        Long user_id FK
        long version
    }
    wallet_transaction {
        Long id PK
        BigDecimal amount
        BigDecimal balance_after
        Instant created_at
        String game_code
        Long spin_round_id
        TransactionType type
        Long wallet_id FK
    }
    slot_machine ||--o{ player_machine_stats : "slot_machine_id"
    slot_machine ||--o{ slot_symbol : "slot_machine_id"
    slot_machine ||--o{ spin_round : "slot_machine_id"
    user_account ||--o{ player_machine_stats : "user_id"
    user_account ||--o{ spin_round : "user_id"
    user_account ||--o| wallet : "user_id"
    wallet ||--o{ wallet_transaction : "wallet_id"
```
