import { Fragment } from 'react';

// ─── SideMenu ────────────────────────────────────────────────────────────────
export function SideMenu({ menuItems, mobileMenuOpen, setMobileMenuOpen, sideBtnOn, t }) {
  return (
    <>
      {/* Desktop / tablet: full button stack */}
      <div className="hidden sm:flex flex-col-reverse gap-2 items-start">
        {menuItems.map(({ key, node }) => (
          <Fragment key={key}>{node}</Fragment>
        ))}
      </div>

      {/* Mobile: single menu button that opens an animated dropdown with the same buttons */}
      <div className="relative sm:hidden">
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`${sideBtnOn} transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : ''}`}
          title={t('menuBtn')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div
          className={`fixed inset-0 z-40 transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setMobileMenuOpen(false)}
        />

        <div
          className={`absolute bottom-full left-0 mb-2 flex flex-col-reverse gap-2 items-start z-50 ${mobileMenuOpen ? '' : 'pointer-events-none'}`}
        >
          {menuItems.map(({ key, node }, idx) => (
            <div
              key={key}
              onClick={() => setMobileMenuOpen(false)}
              className={`origin-bottom-left transition-all duration-300 ease-out ${mobileMenuOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-75'}`}
              style={{ transitionDelay: `${(mobileMenuOpen ? idx : menuItems.length - 1 - idx) * 40}ms` }}
            >
              {node}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}