export type TabId = 'heute' | 'meditieren' | 'atmen' | 'klaenge' | 'ich'

export const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'heute', label: 'Heute' },
  { id: 'meditieren', label: 'Meditieren' },
  { id: 'atmen', label: 'Atmen' },
  { id: 'klaenge', label: 'Klänge' },
  { id: 'ich', label: 'Ich' },
]
