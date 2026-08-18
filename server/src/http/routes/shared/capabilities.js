import {
  STREAM_MODE, RADIO_HOSTS_MODE, DATA_WRITES_PERSIST, MEDIA_WRITES_PERSIST, DONATIONS_ENABLED,
} from '../../../config/env.js';
import { getErrorPayload } from '../../../middleware/auth.js';
import { getActiveDonationProvider } from '../../../donations/donationRegistry.js';

export function describeCapabilities(mediaProvider, dataProvider) {
  const canWriteMedia = typeof mediaProvider?.uploadAudio === 'function';
  const canReadMedia  = typeof mediaProvider?.getAudioBuffer === 'function';
  const canDropMedia  = typeof mediaProvider?.deleteAudio === 'function';

  const canAddTrack    = typeof dataProvider?.addTrack === 'function';
  const canUpdateTrack = typeof dataProvider?.updateTrackMetadataById === 'function';
  const canDeleteTrack = typeof dataProvider?.deleteTrackById === 'function';

  const libraryWritesPersist = DATA_WRITES_PERSIST && MEDIA_WRITES_PERSIST;

  return {
    uploadTracks: canWriteMedia && canAddTrack && libraryWritesPersist,

    editTrackMetadata: canReadMedia && canWriteMedia && canUpdateTrack && libraryWritesPersist,

    moveTrackMode: canReadMedia && canWriteMedia && canDropMedia && canUpdateTrack && libraryWritesPersist,

    deleteTracks: canDropMedia && canDeleteTrack && libraryWritesPersist,

    artistArts: typeof mediaProvider?.uploadArt === 'function' && libraryWritesPersist,

    helperAdmins: typeof dataProvider?.createAdmin === 'function' && DATA_WRITES_PERSIST,

    adminAccount: typeof dataProvider?.changeAdminPassword === 'function' && DATA_WRITES_PERSIST,

    ipModeration: typeof dataProvider?.banIp === 'function' && DATA_WRITES_PERSIST,

    editSettings: DATA_WRITES_PERSIST,

    auditLog: DATA_WRITES_PERSIST,

    history: DATA_WRITES_PERSIST,

    jingles: STREAM_MODE
      && typeof dataProvider?.createJingle === 'function'
      && typeof mediaProvider?.uploadJingle === 'function'
      && libraryWritesPersist,

    backgroundMusic: STREAM_MODE && RADIO_HOSTS_MODE
      && typeof dataProvider?.createBackgroundMusic === 'function'
      && typeof mediaProvider?.uploadBackgroundMusic === 'function'
      && libraryWritesPersist,

    phrases: STREAM_MODE
      && typeof dataProvider?.createPhrase === 'function'
      && typeof mediaProvider?.uploadPhrase === 'function'
      && libraryWritesPersist,

    donations: DONATIONS_ENABLED && Boolean(getActiveDonationProvider()) && DATA_WRITES_PERSIST,
  };
}

export function requireCapability(capability, { mediaProvider, dataProvider }, errorKey = 'common.featureUnavailable') {
  return (req, res, next) => {
    if (describeCapabilities(mediaProvider, dataProvider)[capability]) return next();
    return res.status(400).json(getErrorPayload(null, errorKey));
  };
}
