

## Minska headerns höjd

Headern har just nu `py-3` (12px padding top/bottom). Planen är att minska detta till `py-1` (4px) så att headern blir smalare, medan bilden (72px) fortfarande får plats.

### Tekniska detaljer

**Fil: `src/pages/Index.tsx`** (rad ~322)
- Ändra `py-3` till `py-1` på headerns inre div
- Bilden behåller sin storlek `w-[72px] h-[72px]`

