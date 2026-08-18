import { t } from '../../../i18n/index.js';

export const requireAnyPrivilege = (...privs) => (req, res, next) => {
  const adminPrivs = Array.isArray(req.admin?.privileges) ? req.admin.privileges : [];
  if (privs.some((p) => adminPrivs.includes(p))) return next();
  return res.status(403).json({
    error: t('common.insufficientPrivilegesForAction'),
  });
};