export type ActiveTab = 'oefenen' | 'leerpad' | 'voortgang';

interface Props {
  active: ActiveTab;
  onChange: (tab: ActiveTab) => void;
}

const TABS: Array<{ id: ActiveTab; icon: string; label: string }> = [
  { id: 'oefenen', icon: '📘', label: 'Oefenen' },
  { id: 'leerpad', icon: '🗺️', label: 'Leerpad' },
  { id: 'voortgang', icon: '📊', label: 'Voortgang' },
];

/** Floating bottom tab bar switching between the three main views. */
export function TabBar({ active, onChange }: Props) {
  return (
    <div className="tabbar-wrap">
      <nav className="tabbar" aria-label="Hoofdmenu">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${active === t.id ? ' active' : ''}`}
            data-tab={t.id}
            onClick={() => onChange(t.id)}
            aria-current={active === t.id ? 'page' : undefined}
          >
            <span className="ico" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
