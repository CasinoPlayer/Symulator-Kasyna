# Prace w toku zapisane jako łaty (patch)

Dwie części projektu powstawały w osobnych kopiach roboczych (git worktree) i nie były jeszcze scalone
z gałęzią. Żeby nic nie przepadło, ich stan zapisano tu jako łaty względem commita `7f66301`.

| Plik | Zawartość |
|---|---|
| `gra-s1-przegladarka.patch` | runtime gier w PixiJS i gra „Cebulowy 777” w przeglądarce (bębny, efekty, big win, atrapa spinów) |

To stan **w trakcie pracy** — może się nie kompilować ani nie przechodzić testów.

Jak nałożyć (na świeżej gałęzi od commita bazowego):

```bash
git switch -c scalanie 7f66301
git apply --3way wip/gra-s1-przegladarka.patch
```

Po scaleniu właściwych wersji ten katalog zostanie usunięty.
