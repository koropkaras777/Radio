export function PlaybackHistory({ history, showOnlyOne, setShowOnlyOne, isBlurred, setIsBlurred, artPanelStyle, th, t }) {
  return (
    <div className={`${th.bgPanelCls} rounded-lg p-6 mt-6`} style={artPanelStyle}>
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-2xl font-semibold ${th.textPanel}`}>{t('historyTitle')}</h2>
        <div className="flex items-center gap-4">
          <label className={`flex items-center gap-2 cursor-pointer ${th.checkboxLabel}`}>
            <input
              type="checkbox"
              checked={showOnlyOne}
              onChange={(e) => setShowOnlyOne(e.target.checked)}
              className={`w-4 h-4 rounded border-gray-600 ${th.tileBg} focus:ring-0 ${showOnlyOne ? th.accentInput : ''}`}
            />
            {t('onlyOne')}
          </label>
          <button
            onClick={() => setIsBlurred(!isBlurred)}
            className={`p-2 rounded-full transition-all duration-300 ${isBlurred ? th.blurBtn : `${th.bgPanelCls} ${th.textSecondary} hover:opacity-80`}`}
            title={isBlurred ? t('showTitles') : t('hideTitles')}
          >
            <span className="text-lg leading-none flex items-center justify-center">
              {isBlurred ? '👁️‍🗨️' : '👁️'}
            </span>
          </button>
        </div>
      </div>

      <ul className="space-y-2 mt-4">
        {history.slice(0, showOnlyOne ? 1 : 10).map((track, index) => (
          <li
            key={`${track.id ?? track.trackId}-${index}`}
            className={`p-3 rounded transition-all duration-300 ${isBlurred ? th.blurredPlaylistItem : th.tileBg}`}
          >
            <div className={`flex items-center gap-3 transition-all duration-500 ${isBlurred ? 'blur-md select-none opacity-50' : 'blur-0'}`}>
              <span className={th.playlistTrackNum}>#{index + 1}</span>
              <div className="flex flex-col gap-1">
                <span className={`font-semibold block leading-tight ${th.textSecondary}`}>{track.title}</span>
                <span className={th.playlistArtist}>{track.artist || t('unknownArtist')}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
