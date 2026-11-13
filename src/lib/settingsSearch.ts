import type { SettingsCategory } from "@/components/SettingsPanel";

export interface SettingEntry { label: string; category: SettingsCategory; keywords: string; anchor: string }
export const SETTING_ENTRIES: SettingEntry[] = [
  { label: "Maxpuls", category: "profile", keywords: "puls hjärta pulszoner", anchor: "Maxpuls" },
  { label: "FTP", category: "profile", keywords: "watt cykel", anchor: "FTP" },
  { label: "Vikt", category: "profile", keywords: "kropp kroppsvikt", anchor: "Vikt (kg)" },
  { label: "Längd", category: "profile", keywords: "kropp centimeter", anchor: "Längd (cm)" },
  { label: "Ålder", category: "profile", keywords: "kroppsdata", anchor: "Ålder" },
  { label: "Profilbild", category: "profile", keywords: "avatar foto", anchor: "Profil" },
  { label: "Tema", category: "appearance", keywords: "färg mörkt ljust utseende", anchor: "" },
  { label: "Moduler", category: "appearance", keywords: "meny visa dölj", anchor: "Moduler" },
  { label: "Delning och synlighet", category: "privacy", keywords: "integritet privat topplista träningsplan pass blockering", anchor: "Så syns du just nu" },
  { label: "GPS", category: "training", keywords: "tempo röst distans", anchor: "GPS" },
  { label: "Ljud-feedback", category: "training", keywords: "ljud feedback", anchor: "Ljud-feedback" },
  { label: "Vilotimer", category: "training", keywords: "vila timer set", anchor: "Vilotimer efter set" },
  { label: "Håll skärmen vaken", category: "training", keywords: "skärm lås", anchor: "Håll skärmen vaken" },
  { label: "Strava", category: "training", keywords: "koppling synk export", anchor: "Strava" },
  { label: "Kostmål", category: "nutrition", keywords: "kalorier protein fett kolhydrater makro mål", anchor: "" },
  { label: "Periodisk fasta", category: "nutrition", keywords: "fasta kost", anchor: "Periodisk fasta i Kost" },
  { label: "Notiser", category: "permissions", keywords: "push påminnelse behörighet", anchor: "" },
  { label: "Statistikens sektioner", category: "stats", keywords: "statistik visa dölj", anchor: "Sektioner" },
  { label: "Viktkurvans tidsperiod", category: "stats", keywords: "vikt graf statistik", anchor: "Viktkurvans tidsperiod" },
  { label: "Konditionsövningar", category: "stats", keywords: "löpning cykel statistik", anchor: "Konditionsövningar" },
  { label: "Lösenord", category: "account", keywords: "konto inloggning lösenord", anchor: "Lösenord" },
  { label: "E-post", category: "account", keywords: "email återställning konto", anchor: "E-post" },
  { label: "Medlemskap", category: "account", keywords: "köp kvitto prenumeration", anchor: "" },
];
export const normalizeSearch = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
export function searchSettings(query: string) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return terms.length ? SETTING_ENTRIES.filter(e => terms.every(t => normalizeSearch(`${e.label} ${e.keywords}`).includes(t))) : [];
}