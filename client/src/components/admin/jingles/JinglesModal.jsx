import { useEffect, useState } from 'react';
import { MediaLibraryPane } from './MediaLibraryPane.jsx';
import { MediaTabBar } from './MediaTabBar.jsx';

// ─── JinglesModal ────────────────────────────────────────────────────────────
export function JinglesModal({ open, onClose, isNight, lang = 'uk', showToast, nightMode = true, radioHostsMode = false }) {
  const [activeTab, setActiveTab] = useState('jingle');
  const [tabsLocked, setTabsLocked] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab('jingle');
      setTabsLocked(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <MediaLibraryPane
      key={activeTab}
      kind={activeTab}
      onClose={onClose}
      isNight={isNight}
      lang={lang}
      showToast={showToast}
      nightMode={nightMode}
      onSelectionModeChange={setTabsLocked}
      tabs={(
        <MediaTabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          locked={tabsLocked}
          isNight={isNight}
          lang={lang}
          showBackgroundMusic={radioHostsMode}
        />
      )}
    />
  );
}