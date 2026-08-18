import { PRIVILEGES } from '../../../config/privileges.js';
import { t } from '../../../i18n/index.js';

export const requireJinglesPrivilege = (req, res, next) => {
  const privs = Array.isArray(req.admin?.privileges) ? req.admin.privileges : [];
  if (req.admin?.role === 'super_admin' || privs.includes(PRIVILEGES.JINGLES_UPLOADER)) {
    return next();
  }
  return res.status(403).json({ error: t('common.insufficientPrivilegesForAction') });
};