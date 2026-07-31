import React from 'react';
import { Auth } from '@aws-amplify/auth';
import { recordExists, getObject, cl, switchActiveAccount, dbClient, lambda, getMarqueeMessage, deepCopy } from '../../util/AVAUtilities';
import { makeDate, makeTime } from '../../util/AVADateTime';
import { getImage } from '../../util/AVAPeople';
import { AVATextStyle, AVAclasses, AVADefaults, hexToRgb, isDark } from '../../util/AVAStyles';
import { clearPushSubscriptionFromDB, initPushNotifications, unsubscribeFromPush, isPushSupported, isPushOptedIn, syncAlertDeliveryMethod } from '../../util/AVAPushNotifications';
import { getActivityDetail } from '../../util/AVAActivityLoaderV3';
import { loadAndQueueNotifications, markNotificationShown, priorityToSeverity, getNotificationDisplayOptions, INITIAL_NOTIFICATION_CHECK_TIME, playNotificationSound } from '../../util/AVANotifications';
import QuickAdd from './QuickAdd';

import Card from '@material-ui/core/Card';
import CardActionArea from '@material-ui/core/CardActionArea';
import CardContent from '@material-ui/core/CardContent';
import CardMedia from '@material-ui/core/CardMedia';

import { Snackbar } from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useTheme from '@material-ui/core/styles/useTheme';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import Marquee from "react-fast-marquee";
import ReactPlayer from 'react-player';

import { useCookies } from 'react-cookie';
import { useIdleTimer } from 'react-idle-timer';
import useSession from '../../hooks/useSession';
import SwitchPatientDialog from '../dialogs/SwitchPatientDialog';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';

import Box from '@material-ui/core/Box';
import Avatar from '@material-ui/core/Avatar';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import IconButton from '@material-ui/core/IconButton';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import LinearProgress from '@material-ui/core/LinearProgress';
import Switch from '@material-ui/core/Switch';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import EditIcon from '@material-ui/icons/PersonOutlineOutlined';
import CreateIcon from '@material-ui/icons/Create';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import SubscriptionIcon from '@material-ui/icons/CardMembership';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import NewReleasesOutlinedIcon from '@material-ui/icons/NewReleasesOutlined';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import SearchIcon from '@material-ui/icons/Search';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import CancelIcon from '@material-ui/icons/Cancel';
import DeleteIcon from '@material-ui/icons/Delete';
import LastPageIcon from '@material-ui/icons/LastPage';
import GetAppIcon from '@material-ui/icons/GetApp';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import FavoriteIcon from '@material-ui/icons/Favorite';
import FavoriteBorderIcon from '@material-ui/icons/FavoriteBorder';
import PhoneIcon from '@material-ui/icons/Phone';
import NotificationsActiveIcon from '@material-ui/icons/NotificationsActive';
import NotificationsOffIcon from '@material-ui/icons/NotificationsOff';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';

import Tooltip from '@material-ui/core/Tooltip';
import QuickSearch from './QuickSearch';

/***** NEW V3 CODE ****/

import { stringToColor, s3 } from '../../util/AVAUtilities';
import FormManagement from '../dialogs/FormManagement';
import FormFillB from '../forms/FormFillB';
import ClientMaintenance from '../dialogs/ClientMaintenance';
import MessageForm from '../forms/MessageForm';
import ShowGroup from '../dialogs/ShowGroup';
import ShowCalendar from '../dialogs/ShowCalendar';
import AVAConfirm from '../forms/AVAConfirm';
import LoadSpreadsheet from '../forms/LoadSpreadsheet';
import NewCalendarEvent from '../dialogs/NewCalendarEvent';
import MessageMonitorV3 from '../forms/MessageMonitorV3';
import CheckInCheckOut from '../forms/CheckInCheckOut';
import MarqueeMaintenance from '../dialogs/MarqueeMaintenance';
import MessageTemplateManager from '../dialogs/MessageTemplateManager';
import GroupPhotoDirectory from '../forms/GroupPhotoDirectory';
import TaskManager from '../dialogs/TaskManager';
import MultiObservationFormD from '../forms/MultiObservationFormV3';
import MultiObservationFormC from '../forms/MultiObservationFormC';
import RequestDashboardV3 from '../dialogs/RequestDashboardV3';
import IosInstall from '../dialogs/IosInstall';
import ShowMenuB from '../dialogs/ShowMenuB';
import useIosCheck from '../../hooks/useIosCheck';
import useWebPrompt from '../../hooks/useWebPrompt';

const SESSION_POLICY_STATE_KEY = 'AVA_session_policy_state';

const useStyles = makeStyles(theme => ({
  root: {
    maxWidth: 100,
    minWidth: 100,
    maxHeight: 100,
    minHeight: 100,
  },
  cardcontentdetail: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '2px',
    paddingRight: '2px',
    justifyContent: 'center',
    padding: 0
  },
  media: {
    height: 20,
    minHeight: 20,
    width: '100%',
    flexShrink: 0,
  },
  wholeCard: {
    height: 100,
    display: 'flex',
    flexDirection: 'column',
  },
  avatar: {
    marginTop: 0,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    height: 60,
    width: 60,
    paddingTop: 0,
    fontSize: '1.3rem',
  },
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  messageArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  clientBackground: {
    backgroundColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).backgroundColor : null
  },
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
  },
  profileArea: {
    alignItems: 'center'
  },
  popUpMenuRow: {
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  linkTooltip: {
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    maxWidth: 280,
    fontSize: theme.typography.fontSize * 0.85,
    lineHeight: 1.25,
  },
}));

export default ({ start_at }) => {

  const theme = useTheme();
  const [, isIOS] = useIosCheck();
  const [webInstallPrompt, , onWebInstall] = useWebPrompt();
  const isMobile = useMediaQuery('(max-width:800px)');
  const isAlreadyInstalled = !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone);
  const canInstall = !isAlreadyInstalled && (isIOS || !!webInstallPrompt);

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();
  const { roles, session } = state;
  const clientUseTileUI = (state.session?.client_style?.ui_tiles === true);
  const canToggleUiMode = !clientUseTileUI;
  const resolvedSessionClientLogo = state.session?.client_logo_thumb || state.session?.client_logo || process.env.REACT_APP_AVA_LOGO;

  const [cookies, , removeCookie] = useCookies(['AVAuser']);

  const [reactData, setReactData] = React.useState({
    /**** NEW V3 CODE ****/
    menu_hierarchy: [],
    level_active_parent: [],
    v3_favorites: [],
    start_at: start_at || '__top__',
    is_master: state.user?.account_class && (state.user.account_class === 'master'),
    is_admin: state.user?.account_class && (['master', 'admin'].includes(state.user.account_class)),
    is_support: state.user?.account_class && (['master', 'support', 'admin'].includes(state.user.account_class)),
    AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`,
    OGpatient: state.session ? { patient_id: state.session.patient_id, patient_display_name: state.session.patient_display_name } : {},
    greetingName: '',
    greetingWords: '',
    loading: 'Initializing',
    current_time: new Date(),
    showPersonSelect: false,
    showClientSelect: false,
    popupMenuOpen: false,
    showProfileEdit: false,
    showAddAccount: false,
    showQuickSearch: false,
    editFavorites: !clientUseTileUI,
    showPasswordEdit: false,
    groupData: {},
    anchorEl: null,
    lastActiveTime: new Date(),
    idleState: true,
    enteredIdleStateTime: new Date(),
    marqueeData: [],
    marqueeVersion: 0,
    renderFunctionCall: false,
    addMenuDialog: false,
    addMenuDialogLevel: null,
    addMenuDialogParent: null,
    addMenuDialogType: null,
    addMenuDialogLinkSource: 'url',
    addMenuDialogTitle: '',
    addMenuDialogUrl: '',
    addMenuDialogUploadFiles: [],
    addMenuDialogUploadFileIndex: 0,
    addMenuDialogUploadFileName: '',
    addMenuDialogUploadProgress: 0,
    addMenuDialogSaving: false,
    addMenuDialogTargets: [],
    addMenuDialogPhone: '',
    addMenuDialogAvailableTo: [],
    addMenuDialogColor: null,
    addMenuDialogAccessReviewed: false,
    addMenuDialogDenyMode: false,
    showAddAccessToSearch: false,
    deleteMenuConfirm: false,
    deleteMenuTarget: null,
    editDescriptionDialog: false,
    editDescriptionMenuId: null,
    editDescriptionShort: '',
    editDescriptionLong: '',
    editDescriptionAvailableTo: [],
    editDescriptionColor: null,
    editDescriptionParent: null,
    editDescriptionCanDelete: false,
    editDescriptionDenyMode: false,
    editDescriptionItemType: null,
    editDescriptionTargets: [],
    showAccessToSearch: false,
    showAddMessageTargetSearch: false,
    showEditMessageTargetSearch: false,
    uiTilesOverrideLoaded: false,
    uiTilesOverride: null,
    showLiveLink: false,
    liveLinkUrl: '',
    liveLinkTitle: '',
    liveLinkSiblings: [],
    liveLinkCurrentIndex: -1,
    showIosInstall: false,
    alert: false,
    notification: null,
    notificationQueue: [],
    notificationCurrentIndex: 0,
    notificationSoundNeeded: false,
    lastNotificationCheckTime: INITIAL_NOTIFICATION_CHECK_TIME,
    testMode: ["T", "L"].includes(window.location.href.split('//')[1].slice(0, 1).toUpperCase()),
    levelPages: {}    // tracks current page (0-indexed) per level for paginated display
  });

  const useTileUI = ((reactData.uiTilesOverride === null) || (reactData.uiTilesOverride === undefined))
    ? clientUseTileUI
    : !!reactData.uiTilesOverride;
  const previousUseTileUIRef = React.useRef(useTileUI);

  const normalizeHexColor = (value) => {
    if (!value || typeof value !== 'string') { return null; }
    const trimmed = value.trim();
    const shortHex = /^#([0-9a-fA-F]{3})$/;
    const longHex = /^#([0-9a-fA-F]{6})$/;
    if (shortHex.test(trimmed)) {
      const [, hexPart] = trimmed.match(shortHex);
      return `#${hexPart[0]}${hexPart[0]}${hexPart[1]}${hexPart[1]}${hexPart[2]}${hexPart[2]}`;
    }
    if (longHex.test(trimmed)) {
      return trimmed;
    }
    return null;
  };

  const resolvedClientBackground = state.session?.client_style?.backgroundColor
    || AVADefaults({ client_style: 'get' })?.backgroundColor
    || '#ffffff';
  const resolvedClientBackgroundHex = normalizeHexColor(resolvedClientBackground);
  const isThemeDark = theme?.palette?.type === 'dark';
  const chromeTextColor = isThemeDark
    ? (theme?.palette?.text?.primary || 'cornsilk')
    : (resolvedClientBackgroundHex && isDark(resolvedClientBackgroundHex)
      ? 'cornsilk'
      : '#111111');

  const [forceRedisplay, setForce] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    newData.current_time = new Date();
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) {
      setForce((prevForce) => !prevForce);
    }
  };

  const oneMinute = 1000 * 60;
  const oneHour = 60 * oneMinute;
  const msBeforeSleeping = 1 * oneMinute;
  const policyLogoutInProgressRef = React.useRef(false);

  const normalizeCookieValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      }
      catch {
        return null;
      }
    }
    return value;
  };

  const readSessionPolicyState = () => {
    try {
      const raw = localStorage.getItem(SESSION_POLICY_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    }
    catch {
      return null;
    }
  };

  const writeSessionPolicyState = (nextState) => {
    try {
      localStorage.setItem(SESSION_POLICY_STATE_KEY, JSON.stringify(nextState));
    }
    catch {
      // Ignore storage write failures; policy enforcement will gracefully fallback.
    }
  };

  const getEffectivePolicy = React.useCallback(() => {
    const policy = state.session?.session_policy;
    if (!policy || typeof policy !== 'object') {
      return null;
    }

    return {
      mode: policy.mode || 'persistent',
      absolute_session_max_hours: Number(policy.absolute_session_max_hours),
      idle_timeout_minutes: Number(policy.idle_timeout_minutes),
      force_reauth_on_resume: !!policy.force_reauth_on_resume,
      force_reauth_on_refresh: !!policy.force_reauth_on_refresh,
      enforce_on_sensitive_actions: !!policy.enforce_on_sensitive_actions,
      logout_message: policy.logout_message || 'Session expired. Please sign in again.',
    };
  }, [state.session]);

  const forcePolicyLogout = React.useCallback(async (reason, message) => {
    if (policyLogoutInProgressRef.current) {
      return false;
    }
    policyLogoutInProgressRef.current = true;

    const userId = state.session?.user_id || state.session?.person_id;
    const clientId = state.session?.client_id;

    await accessLog(userId || '*unknown*', '*na*', `Session policy sign-out: ${reason}`);
    removeCookie('AVAuser', { path: '/' });
    localStorage.removeItem(SESSION_POLICY_STATE_KEY);
    if (userId) {
      await clearPushSubscriptionFromDB(userId).catch(() => null);
    }
    await Auth.signOut().catch(() => null);

    const jumpTo = window.location.origin;
    const messageText = encodeURIComponent(message || 'Session expired. Please sign in again.');
    const reasonText = encodeURIComponent(reason || 'unknown');
    window.location.replace(`${jumpTo}?client=${clientId}&session_msg=${messageText}&session_reason=${reasonText}`);
    return false;
  }, [removeCookie, state.session]);

  const validateSessionPolicy = React.useCallback(async ({ trigger = 'activity' } = {}) => {
    if (!state.session) {
      return true;
    }

    const policy = getEffectivePolicy();
    if (!policy) {
      return true;
    }

    if ((trigger === 'resume') && policy.force_reauth_on_resume) {
      return forcePolicyLogout('forced_resume', policy.logout_message);
    }

    if ((trigger === 'refresh') && policy.force_reauth_on_refresh) {
      return forcePolicyLogout('forced_refresh', policy.logout_message);
    }

    const userCookie = normalizeCookieValue(cookies?.AVAuser);
    if (!userCookie?.user_id) {
      return forcePolicyLogout('cookie_missing', policy.logout_message);
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const sessionUserId = state.session?.user_id || state.session?.person_id;
    const sessionClientId = state.session?.client_id;
    let policyState = readSessionPolicyState();

    if (!policyState
      || policyState.client_id !== sessionClientId
      || (policyState.user_id && sessionUserId && policyState.user_id !== sessionUserId)) {
      const startedAt = nowIso;
      const maxHours = Number.isFinite(policy.absolute_session_max_hours) && policy.absolute_session_max_hours > 0
        ? policy.absolute_session_max_hours
        : null;
      const expiresAt = maxHours ? new Date(nowMs + (maxHours * oneHour)).toISOString() : null;
      policyState = {
        version: 1,
        client_id: sessionClientId,
        user_id: sessionUserId,
        started_at: startedAt,
        last_active_at: nowIso,
        expires_at: expiresAt,
      };
      writeSessionPolicyState(policyState);
    }

    const parsedExpires = Date.parse(policyState.expires_at || '');
    if (Number.isFinite(parsedExpires) && nowMs > parsedExpires) {
      return forcePolicyLogout('absolute_expired', policy.logout_message);
    }

    const idleMinutes = Number(policy.idle_timeout_minutes);
    if (Number.isFinite(idleMinutes) && idleMinutes > 0) {
      const lastActiveMs = Date.parse(policyState.last_active_at || policyState.started_at || nowIso);
      if (Number.isFinite(lastActiveMs) && (nowMs - lastActiveMs) > (idleMinutes * oneMinute)) {
        return forcePolicyLogout('idle_timeout', policy.logout_message);
      }
    }

    if (trigger !== 'idle') {
      policyState.last_active_at = nowIso;
      writeSessionPolicyState(policyState);
    }

    return true;
  }, [cookies, forcePolicyLogout, getEffectivePolicy, oneHour, oneMinute, state.session]);

  const addMenuUploadInputRef = React.useRef(null);
  const tileContainerRef = React.useRef(null);
  const prevMenuDepthRef = React.useRef(0);
  const deferredStartAtRef = React.useRef(null);
  const subjectGroupsRef = React.useRef(null);
  // Cache for the optional 'favorites' MenuV3 template record.
  // undefined = not yet fetched; null = fetched but not found; object = found record.
  const favoritesMenuTemplateRef = React.useRef(undefined);
  const activePersonId = state.session?.patient_id || state.session?.person_id;

  const loadSubjectGroups = async () => {
    const personId = activePersonId;
    if (!personId) { return; }
    const personRec = await dbClient
      .get({
        TableName: 'People',
        Key: { person_id: personId }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error loading subject groups for menu auth': error });
      });
    if (recordExists(personRec)) {
      subjectGroupsRef.current = new Set(personRec.Item.groups || []);
    }
  };

  const loadUserUiTilesOverride = async () => {
    const session_id = state.session?.patient_id;
    const client_id = state.session?.client_id;
    if (!session_id || !client_id) {
      return null;
    }

    const sessionRec = await dbClient
      .get({
        TableName: 'SessionsV2',
        Key: { session_id }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading SessionsV2 for user UI mode': error });
      });

    if (!recordExists(sessionRec)) {
      return null;
    }

    const savedOverride = sessionRec.Item?.customizations?.menu_v3_mode?.[client_id]?.ui_tiles;
    if (typeof savedOverride === 'boolean') {
      return savedOverride;
    }
    return null;
  };

  const saveUserUiTilesOverride = async (nextUseTileUI) => {
    const session_id = state.session?.patient_id;
    const client_id = state.session?.client_id;
    if (!session_id || !client_id) {
      return;
    }

    const sessionRec = await dbClient
      .get({
        TableName: 'SessionsV2',
        Key: { session_id }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading SessionsV2 before saving UI mode': error });
      });

    let customizations = deepCopy(sessionRec?.Item?.customizations || {});
    if (!customizations.menu_v3_mode) {
      customizations.menu_v3_mode = {};
    }
    if (!customizations.menu_v3_mode[client_id]) {
      customizations.menu_v3_mode[client_id] = {};
    }

    customizations.menu_v3_mode[client_id].ui_tiles = !!nextUseTileUI;
    customizations.menu_v3_mode[client_id].updated_at = new Date().toISOString();

    await dbClient
      .update({
        TableName: 'SessionsV2',
        Key: { session_id },
        UpdateExpression: 'set #c = :c',
        ExpressionAttributeNames: {
          '#c': 'customizations'
        },
        ExpressionAttributeValues: {
          ':c': customizations
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error saving SessionsV2 UI mode': error });
      });
  };

  const rebuildMenuHierarchy = async ({ includeLoadingState = false } = {}) => {
    if (!state.session) {
      updateReactData({
        loading: false,
        alert: {
          severity: 'warning',
          title: 'Log-in not yet complete',
          message: `Sign-in hasn't completed yet.  Please tap here to reload your AVA Menu.`,
          action: [{ text: 'Reload Menu', function: () => { rebuildMenuHierarchy({ includeLoadingState: true }); } }]
        }
      }, true);
      return [];
    }

    const policyOk = await validateSessionPolicy({ trigger: 'refresh' });
    if (!policyOk) {
      return [];
    }

    if (includeLoadingState) {
      updateReactData({
        loading: 'Building your AVA menu'
      }, true);
    }

    // Capture start_at before any resets so we can act on it after the build
    const savedStartAt = reactData.start_at;

    reactData.menu_hierarchy = [];
    favoritesMenuTemplateRef.current = undefined; // Re-fetch template on each full rebuild
    const new_menuHierarchy = await getMenuItem('__top__', 0);
    let reactUpd = {
      menu_hierarchy: new_menuHierarchy,
      loading: false,
      ...(savedStartAt && savedStartAt !== '__top__' ? { start_at: '__top__' } : {})
    };
    const favoriteList = normalizeFavorites(state.patient?.v3_favorites || []);
    if (favoriteList && favoriteList.length > 0) {
      const menuWithFavorites = await applyFavoritesCardToHierarchy(new_menuHierarchy, favoriteList);
      reactUpd.menu_hierarchy = menuWithFavorites;
      reactUpd.v3_favorites = favoriteList;
    }

    const persistedOpenMenuIds = await loadPersistedOpenMenuIds();
    if (persistedOpenMenuIds.length > 0) {
      reactUpd.menu_hierarchy = await applyPersistedOpenMenuIds(reactUpd.menu_hierarchy, persistedOpenMenuIds);
    }

    // Auto-activate start_at after the full hierarchy is built.
    // The item may be at any depth, so we first search the hierarchy then fall back to a direct DB fetch.
    if (savedStartAt && savedStartAt !== '__top__') {
      // Resolve the item — search the built hierarchy first, then fall back to a direct DB fetch
      let startAtItem = null;
      let startAtLevel = 1;

      for (let li = 0; li < reactUpd.menu_hierarchy.length; li++) {
        const cell = (reactUpd.menu_hierarchy[li] || []).find((c) => c.menu_id === savedStartAt);
        if (cell) { startAtItem = cell.menuItemRec; startAtLevel = li; break; }
      }

      if (!startAtItem) {
        const startAtRec = await dbClient
          .get({
            TableName: 'MenuV3',
            Key: { client_id: state.session.client_id, menu_id: savedStartAt }
          })
          .promise()
          .catch((error) => {
            cl({ 'Error fetching start_at menu item': error });
          });
        if (recordExists(startAtRec)) {
          startAtItem = startAtRec.Item;
          startAtLevel = 1;
          if (startAtItem.menu_itemType === 'menu') {
            if (!reactUpd.menu_hierarchy[1]) { reactUpd.menu_hierarchy[1] = []; }
            if (!reactUpd.menu_hierarchy[1].some((c) => c.menu_id === savedStartAt)) {
              reactUpd.menu_hierarchy[1].push({ menu_id: savedStartAt, menuItemRec: startAtItem, parent: '__top__' });
            }
          }
        }
      }

      if (startAtItem) {
        if (state.groups && state.accessList) {
          // Background data is ready — activate now
          if (startAtItem.menu_itemType === 'function') {
            void activityLog(startAtItem.menu_id, `Auto-run on load: ${startAtItem.description?.long}`);
            if (startAtItem.activity) {
              const activityDetail = await getActivityDetail({ activity_code: startAtItem.activity }, state);
              reactUpd.renderFunctionCall = {
                target: 'MultiObservationFormD',
                params: {
                  fact: { ...activityDetail.activityRec, activity_key: startAtItem.activity },
                  factName: activityDetail.activityRec?.name || '',
                  options: {
                    listValues: activityDetail.rows,
                    qualifiers: activityDetail.qualifiers
                  },
                  defaults: activityDetail.activityRec?.default_object || {}
                }
              };
            }
            else {
              reactUpd.renderFunctionCall = startAtItem.call || false;
            }
          }
          else if (startAtItem.menu_itemType === 'menu') {
            reactData.menu_hierarchy = reactUpd.menu_hierarchy;
            await batchGetMenuItems(startAtItem.children || [], startAtLevel + 1, startAtItem);
            reactUpd.menu_hierarchy = reactData.menu_hierarchy;
          }
        }
        else {
          // Background data (groups/accessList) not yet loaded — defer until useEffect fires
          deferredStartAtRef.current = { item: startAtItem, level: startAtLevel };
        }
      }
    }

    // Derive level_active_parent from the built hierarchy so active-parent
    // highlighting is correct on entry, not only after a tile is tapped.
    const derivedActiveParent = [];
    for (let L = 1; L < (reactUpd.menu_hierarchy || []).length; L++) {
      const firstCell = (reactUpd.menu_hierarchy[L] || []).find(c => c.parent);
      if (firstCell) { derivedActiveParent[L] = firstCell.parent; }
    }
    reactUpd.level_active_parent = derivedActiveParent;

    updateReactData(reactUpd, true);
    return reactUpd.menu_hierarchy || [];
  };

  const onIdle = async () => {
    const policyOk = await validateSessionPolicy({ trigger: 'idle' });
    if (!policyOk) {
      return;
    }

    let now = new Date();
    let minutesSinceActive = 0;
    if (!reactData.idleState) {
      cl(`Entering idle state at ${now.toLocaleString()}.`);
      updateReactData({
        idleState: true,
        enteredIdleStateTime: now,
      }, true);
    }
    else {
      minutesSinceActive = Math.floor((now.getTime() - reactData.enteredIdleStateTime.getTime()) / oneMinute);
      cl(`Still idle at ${new Date().toLocaleString()}.  Idle for ${minutesSinceActive} minutes.`);
    }
    if ((minutesSinceActive > 60) || (state.session?.kiosk_mode && state.profile?.kiosk_mode)) {
      window.location.replace(`${window.location.href.split('?')[0]}?rel=${now.getTime()}`);
    }
    else if ((now.getTime() - reactData.lastActiveTime.getTime()) > (5 * oneMinute)) {
      cl(`Update while idle at ${now.toLocaleString()}.`);
      await updateMarquee();
      await rebuildMenuHierarchy();
      await loadMenuNotifications();
      updateReactData({
        lastActiveTime: now,
      }, true);
    }
    reset();
  };

  const updateMarquee = async () => {
    let options = {
      belongsTo: (state.groups ? state.groups.belongsTo : {}),
      client_weather: state.session.client_weather,
      critical_only: state.session.client_style?.marquee_critical_only || false
    };
    let marqueeData = [];
    marqueeData.push(...(await getMarqueeMessage(session.client_id, options)));
    let urgentMessage = marqueeData.find(m => {
      return (m.criticalMessage);
    });
    if (reactData.testMode) {
      let m = `--- TEST MODE ACTIVE --- User: ${state.session.user_id} Client: ${state.session.client_id}`;
      if (state.session.user_id !== state.session.patient_id) {
        m += ` Proxy: ${state.session.patient_id}`;
      }
      marqueeData.push({ message: m });
    }
    if (urgentMessage) {
      marqueeData = [urgentMessage];
    }
    else {
      if (!state.session.client_style?.marquee_critical_only && !marqueeData.some(m => { return (m.priorityMessage); })) {
        marqueeData.unshift(
          { message: `${reactData.greetingWords}, ${reactData.greetingName}!` },
          { message: `AVA for ${state.session.client_name}` }
        );
      }
    }

    if (!state.session.client_style?.marquee_critical_only) {
      const todayMessage = `Today is ${reactData.current_time.toLocaleDateString('en-US', {
        timeZone: state.session.client_timezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })}`;
      const weatherIndex = marqueeData.findIndex((line) => {
        return typeof line?.message === 'string' && /weather/i.test(line.message);
      });
      if (weatherIndex >= 0) {
        marqueeData.splice(weatherIndex, 0, { message: todayMessage });
      }
      else {
        marqueeData.unshift({ message: todayMessage });
      }
    }

    updateReactData({
      marqueeData: marqueeData,
      marqueeVersion: reactData.marqueeVersion++
    }, false);
  };

  async function onAction() {
    const policyOk = await validateSessionPolicy({ trigger: 'activity' });
    if (!policyOk) {
      return;
    }

    let now = new Date();
    if ((reactData.idleState) || ((now.getTime() - reactData.lastActiveTime.getTime()) > oneMinute)) {
      cl(`Action/Update at ${now.toLocaleString()}.  Last active at ${reactData.lastActiveTime.toLocaleString()}`);
      await updateMarquee();
      // await rebuildMenuHierarchy();
      updateReactData({
        lastActiveTime: now,
        idleState: false,
      }, true);
    }
    reset();
  };

  const { start, reset, pause } = useIdleTimer({
    onIdle,
    onAction,
    timeout: msBeforeSleeping,
    throttle: 500
  });

  React.useEffect(() => {
    if (reactData.renderFunctionCall) {
      pause();
    }
    else {
      start();
    }
  }, [reactData.renderFunctionCall, pause, start]);

  // Fire any start_at activation that was deferred because groups/accessList weren't loaded yet
  React.useEffect(() => {
    if (!state.groups || !state.accessList || !deferredStartAtRef.current) { return; }
    const { item: deferredItem, level: deferredLevel } = deferredStartAtRef.current;
    deferredStartAtRef.current = null;
    if (deferredItem.menu_itemType === 'function') {
      void activityLog(deferredItem.menu_id, `Auto-run on load: ${deferredItem.description?.long}`);
      if (deferredItem.activity) {
        (async () => {
          const activityDetail = await getActivityDetail({ activity_code: deferredItem.activity }, state);
          updateReactData({
            renderFunctionCall: {
              target: 'MultiObservationFormD',
              params: {
                fact: { ...activityDetail.activityRec, activity_key: deferredItem.activity },
                factName: activityDetail.activityRec?.name || '',
                options: {
                  listValues: activityDetail.rows,
                  qualifiers: activityDetail.qualifiers
                },
                defaults: activityDetail.activityRec?.default_object || {}
              }
            }
          }, true);
        })();
      }
      else {
        updateReactData({ renderFunctionCall: deferredItem.call || false }, true);
      }
    }
    else if (deferredItem.menu_itemType === 'menu') {
      (async () => {
        for (const childItem of (deferredItem.children || [])) {
          await getMenuItem(childItem, deferredLevel + 1, deferredItem);
        }
        updateReactData({ menu_hierarchy: reactData.menu_hierarchy }, true);
      })();
    }
  }, [state.groups, state.accessList]); // eslint-disable-line react-hooks/exhaustive-deps

  let nowTime = new Date().getTime();

  /**** NEW V3 CODE ****/

  const getSubjectContextForMenu = () => {
    const subjectRec = state.patient || state.user || {};
    const subjectAccountClass = subjectRec?.account_class || '';
    const subjectPersonId = subjectRec?.person_id || state.session?.patient_id || state.session?.person_id;

    return {
      subjectAccountClass,
      subjectPersonId,
      isSubjectAdmin: ['master', 'admin'].includes(subjectAccountClass),
      isSubjectSupport: ['master', 'support', 'admin'].includes(subjectAccountClass)
    };
  };

  const authorizedToMenuItem = (available_to) => {
    if (reactData.is_master) {
      return true;
    }

    const {
      isSubjectAdmin,
      isSubjectSupport,
      subjectPersonId
    } = getSubjectContextForMenu();

    if (!available_to) {
      return true;
    }
    if (available_to.length === 0 || available_to.includes('*none')) {
      return false;
    }
    const denied = available_to.some(r => {
      if (!r.startsWith('!')) { return false; }
      const raw = r.slice(1);
      if (raw === '*all') { return true; }
      if (raw === '*admin') { return isSubjectAdmin; }
      if (raw === '*support') { return isSubjectSupport; }
      if (raw.startsWith('group:')) { return !!(subjectGroupsRef.current?.has(raw.slice(6))); }
      if (raw.startsWith('person:')) { return subjectPersonId === raw.slice(7); }
      return false;
    });
    if (denied) { return false; }
    for (let this_rule of available_to) {
      // If the rule contains "&&", ALL parts must be satisfied (AND logic)
      const ruleParts = this_rule.includes('&&')
        ? this_rule.split('&&').map(p => p.trim())
        : [this_rule.trim()];
      const allMet = ruleParts.every(rule => {
        switch (rule.split(':')[0]) {
          case '*all': return true;
          case '*admin': return isSubjectAdmin;
          case '*support': return isSubjectSupport;
          case 'group': {
            const check_group = rule.split(':')[1];
            return !!(subjectGroupsRef.current?.has(check_group));
          }
          case 'person': return subjectPersonId === rule.split(':')[1];
          default: return false;
        }
      });
      if (allMet) { return true; }
    }
    return false;
  };

  const getMenuItem = async (itemCode, menu_level, parent = false) => {
    let menuItemRec = await dbClient
      .get({
        Key: { client_id: state.session.client_id, menu_id: itemCode },
        TableName: 'MenuV3'
      })
      .promise()
      .catch(error => {
        console.error('Error fetching menu item:', error.message);
      });
    if (recordExists(menuItemRec)) {
      // console.log(`Fetched menu item ${itemCode} from database.`);
      const this_item = menuItemRec.Item;
      if (!this_item.hasOwnProperty('available_to') || authorizedToMenuItem(this_item.available_to)) {
        if (!reactData.menu_hierarchy[menu_level]) { reactData.menu_hierarchy[menu_level] = []; }
        if (!this_item.color) {
          // if I have a parent, use their color.  If not, use the client default color.  If that's not set, use gray
          if (parent && !parent.hidden) { this_item.color = parent.color; }
          else { this_item.color = stringToColor(this_item.menu_id); }
        }
        if (state.session.client_style?.suppress_card_image) { this_item.icon = null; }
        else if (!this_item.icon) { this_item.icon = resolvedSessionClientLogo; }
        const targetParentId = parent?.menu_id || null;
        const alreadyLoaded = reactData.menu_hierarchy[menu_level].some((existingCell) => {
          return (existingCell.menu_id === itemCode) && (existingCell.parent === targetParentId);
        });
        if (!alreadyLoaded) {
          reactData.menu_hierarchy[menu_level].push({
            menu_id: itemCode,
            menuItemRec: this_item,
            parent: targetParentId
          });
        }
        if (this_item.hidden && this_item.menu_itemType === 'menu') {  // hidden menu item? process children immediately
          await batchGetMenuItems(this_item.children || [], menu_level + 1, this_item);
        }
      }
    }
    else {
      console.log(`Menu item ${itemCode} not found in database.`);
    }
    return reactData.menu_hierarchy;
  };

  const MENU_PAGE_SIZE = 50;  // items shown per page per menu level (prev/next navigation)

  /**
   * Generate a tiny base64 JPEG thumbnail from an uploaded image/video File object.
   * Stored in icon_thumb on the MenuV3 record so the grid can display instantly
   * without any additional fetches after BatchGet.
   */
  const generateMenuThumb = (file) => {
    return new Promise((resolve) => {
      if (!file || !file.type) { resolve(null); return; }

      const THUMB_SIZE = 64;
      const toThumbCanvas = (sourceWidth, sourceHeight, draw) => {
        const canvas = document.createElement('canvas');
        canvas.width = THUMB_SIZE;
        canvas.height = THUMB_SIZE;
        const ctx = canvas.getContext('2d');
        const side = Math.min(sourceWidth, sourceHeight);
        const sx = (sourceWidth - side) / 2;
        const sy = (sourceHeight - side) / 2;
        draw(ctx, sx, sy, side);
        return canvas;
      };

      const canvasToDataUrl = (canvas) => canvas.toDataURL('image/jpeg', 0.55);

      // Some uploaded videos begin with fade-in or black leader frames.
      // Reject near-black captures so cards do not render as black squares.
      const isCanvasMostlyBlack = (canvas) => {
        try {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let sampleCount = 0;
          let brightCount = 0;
          let totalLuma = 0;
          for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const luma = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
            totalLuma += luma;
            if (luma >= 28) {
              brightCount += 1;
            }
            sampleCount += 1;
          }
          if (!sampleCount) {
            return true;
          }
          const avgLuma = totalLuma / sampleCount;
          const brightRatio = brightCount / sampleCount;
          return (avgLuma < 26) || (brightRatio < 0.03);
        }
        catch {
          return false;
        }
      };

      if (file.type.startsWith('image/')) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          try {
            const canvas = toThumbCanvas(img.naturalWidth, img.naturalHeight, (ctx, sx, sy, side) => {
              ctx.drawImage(img, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
            });
            const thumb = canvasToDataUrl(canvas);
            resolve(thumb);
          }
          catch {
            resolve(null);
          }
          finally {
            URL.revokeObjectURL(url);
          }
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
        return;
      }

      if (!file.type.startsWith('video/')) {
        resolve(null);
        return;
      }

      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      let settled = false;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
      };
      const done = (value) => {
        if (settled) { return; }
        settled = true;
        cleanup();
        resolve(value);
      };

      const captureFrame = () => {
        try {
          if (!video.videoWidth || !video.videoHeight) {
            return null;
          }
          const canvas = toThumbCanvas(video.videoWidth, video.videoHeight, (ctx, sx, sy, side) => {
            ctx.drawImage(video, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
          });
          if (isCanvasMostlyBlack(canvas)) {
            return null;
          }
          return canvasToDataUrl(canvas);
        }
        catch {
          return null;
        }
      };

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        const duration = Number(video.duration);
        const maxTime = (Number.isFinite(duration) && duration > 0)
          ? Math.max(0, duration - 0.05)
          : 0;
        const candidateTimes = [0, 0.15, 0.33, 0.6, 0.85]
          .map((fraction) => (Number.isFinite(duration) && duration > 0 ? Math.min(maxTime, duration * fraction) : 0))
          .filter((time, index, times) => times.findIndex((t) => Math.abs(t - time) < 0.05) === index);

        let candidateIndex = 0;
        const tryNextFrame = () => {
          if (candidateIndex >= candidateTimes.length) {
            done(null);
            return;
          }

          const targetTime = candidateTimes[candidateIndex];
          candidateIndex += 1;

          const captureAtCurrentTime = () => {
            const thumb = captureFrame();
            if (thumb) {
              done(thumb);
            }
            else {
              tryNextFrame();
            }
          };

          if (targetTime <= 0) {
            if (video.readyState >= 2) {
              captureAtCurrentTime();
            }
            else {
              video.onloadeddata = captureAtCurrentTime;
            }
            return;
          }

          video.onseeked = captureAtCurrentTime;
          try {
            video.currentTime = targetTime;
          }
          catch {
            if (video.readyState >= 2) {
              captureAtCurrentTime();
            }
            else {
              video.onloadeddata = captureAtCurrentTime;
            }
          }
        };

        tryNextFrame();
      };
      video.onerror = () => done(null);
      video.src = url;
    });
  };

  /**
   * Same as generateMenuThumb but from a URL instead of a File.
   * Uses crossOrigin='anonymous' so canvas.toDataURL() is allowed on S3 public-read images.
   */
  const generateMenuThumbFromUrl = (imageUrl) => {
    return new Promise((resolve) => {
      if (!imageUrl || typeof imageUrl !== 'string') { resolve(null); return; }
      if (!/\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(imageUrl.trim())) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const THUMB_SIZE = 64;
          const canvas = document.createElement('canvas');
          canvas.width = THUMB_SIZE;
          canvas.height = THUMB_SIZE;
          const ctx = canvas.getContext('2d');
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
          resolve(canvas.toDataURL('image/jpeg', 0.55));
        } catch (_e) {
          resolve(null);  // tainted canvas (CORS) — skip silently
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  };

  // Guard against backfilling the same menu_id twice concurrently
  const _thumbBackfillInProgress = React.useRef(new Set());

  /**
   * For legacy items loaded without icon_thumb: generate a thumb from S3 in small
   * background batches, save it to DynamoDB, update the in-memory record, and trigger
   * a re-render.  This runs fire-and-forget so it never blocks page load or navigation.
   */
  const backfillMenuThumbs = async (menuItems) => {
    const BATCH = 5;  // concurrent image fetches per round — don't hammer the browser
    const looksLikeImageUrl = (value) => {
      if (!value || typeof value !== 'string') { return false; }
      return /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(value.trim());
    };
    const resolveThumbSourceUrl = (item) => {
      const menuType = item.menu_type || item.menu_itemType;
      if ((menuType === 'link') || (menuType === 'live_link')) {
        return getLinkThumbnailUrl(item.url, item.icon);
      }
      if (menuType === 'menu') {
        return item.icon || null;
      }
      return null;
    };
    const candidates = menuItems.filter(item =>
      !item.icon_thumb &&
      looksLikeImageUrl(resolveThumbSourceUrl(item)) &&
      !_thumbBackfillInProgress.current.has(item.menu_id)
    );
    if (candidates.length === 0) { return; }
    candidates.forEach(item => _thumbBackfillInProgress.current.add(item.menu_id));

    for (let i = 0; i < candidates.length; i += BATCH) {
      const chunk = candidates.slice(i, i + BATCH);
      const results = await Promise.all(
        chunk.map(async (item) => {
          const thumbSourceUrl = resolveThumbSourceUrl(item);
          const thumb = await generateMenuThumbFromUrl(thumbSourceUrl);
          return { item, thumb };
        })
      );
      let anyUpdated = false;
      for (const { item, thumb } of results) {
        _thumbBackfillInProgress.current.delete(item.menu_id);
        if (!thumb) { continue; }
        // Save to DynamoDB — happens once, silently
        dbClient.update({
          TableName: 'MenuV3',
          Key: { client_id: state.session.client_id, menu_id: item.menu_id },
          UpdateExpression: 'set icon_thumb = :t',
          ExpressionAttributeValues: { ':t': thumb }
        }).promise().catch((err) => {
          console.warn(`Failed to save icon_thumb for ${item.menu_id}:`, err.message);
        });
        // Update the in-memory record immediately so the current render benefits too
        item.icon_thumb = thumb;
        anyUpdated = true;
      }
      if (anyUpdated) {
        // Lightweight re-render to show newly generated thumbs
        updateReactData({ menu_hierarchy: reactData.menu_hierarchy }, true);
      }
    }
  };

  /**
   * Load pending notifications for current user and queue for display.
   * Called after menu rebuild, on component return, and on idle recovery.
   */
  const loadMenuNotifications = async () => {
    try {
      if (!state.session || !state.session.client_id || !state.session.user_id) {
        return;
      }

      const result = await loadAndQueueNotifications({
        dbClient,
        clientId: state.session.client_id,
        userId: state.session.user_id,
        lastCheckTime: reactData.lastNotificationCheckTime,
        authorizedToMenuItem
      });

      // Policy: after initial app-start notification discovery, always attempt sound for attention,
      // regardless of per-notification play_sound flags.
      const isPostInitialCheck = result.effectiveLastCheckTime !== INITIAL_NOTIFICATION_CHECK_TIME;

      if (result.success && result.notificationQueue.length > 0) {
        // Queue loaded; display first notification
        const firstNotif = result.notificationQueue[0];
        const displayOptions = getNotificationDisplayOptions(firstNotif);
        updateReactData({
          notificationQueue: result.notificationQueue,
          notificationCurrentIndex: 0,
          //    notificationSoundNeeded: isPostInitialCheck,
          lastNotificationCheckTime: result.lastCheckTime,
          notification: {
            severity: priorityToSeverity(firstNotif.priority || 'low'),
            title: firstNotif.title,
            message: firstNotif.message,
            notification_id: firstNotif.notification_id,
            action_url: firstNotif.action_url,
            dismissible: firstNotif.dismissible !== false,
            persist_until_dismissed: !!firstNotif.persist_until_dismissed,
            position_vertical: firstNotif.position_vertical,
            position_horizontal: firstNotif.position_horizontal,
            autoHideDuration: displayOptions.autoHideDuration,
            anchorOrigin: displayOptions.anchorOrigin
          }
        }, true);
        if (isPostInitialCheck) {
          playNotificationSound();
        }
      } else {
        // No new notifications, just update check time
        updateReactData({
          notificationSoundNeeded: false,
          lastNotificationCheckTime: result.lastCheckTime
        });
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  };

  /**
   * Move to next notification in queue and display.
   */
  const showNextNotification = async () => {
    const queue = reactData.notificationQueue || [];
    const nextIndex = (reactData.notificationCurrentIndex || 0) + 1;

    if (nextIndex < queue.length) {
      const nextNotif = queue[nextIndex];
      const displayOptions = getNotificationDisplayOptions(nextNotif);
      updateReactData({
        notificationCurrentIndex: nextIndex,
        notification: {
          severity: priorityToSeverity(nextNotif.priority || 'low'),
          title: nextNotif.title,
          message: nextNotif.message,
          notification_id: nextNotif.notification_id,
          action_url: nextNotif.action_url,
          dismissible: nextNotif.dismissible !== false,
          persist_until_dismissed: !!nextNotif.persist_until_dismissed,
          position_vertical: nextNotif.position_vertical,
          position_horizontal: nextNotif.position_horizontal,
          autoHideDuration: displayOptions.autoHideDuration,
          anchorOrigin: displayOptions.anchorOrigin
        }
      }, true);
    } else {
      // No more notifications
      updateReactData({
        notification: null,
        notificationQueue: [],
        notificationCurrentIndex: 0
      }, true);
    }
  };

  /**
   * Dismiss current notification and load next, or clear if queue exhausted.
   */
  const dismissNotification = async () => {
    const currentNotificationId = reactData.notification?.notification_id;
    if (currentNotificationId && state.session?.user_id) {
      void markNotificationShown({
        dbClient,
        notificationId: currentNotificationId,
        userId: state.session.user_id
      });
    }

    await showNextNotification();
  };

  /**
   * Fetch a list of child menu IDs in parallel using DynamoDB BatchGet (up to 100 keys/request).
   * Preserves the order defined in the parent's children array.
   * Falls back to sequential getMenuItem for any items not returned by BatchGet.
   */
  const batchGetMenuItems = async (childIds, menu_level, parent) => {
    if (!childIds || childIds.length === 0) { return; }
    const BATCH_SIZE = 100;
    // Build an ordered index so we can sort results back into children order
    const orderIndex = Object.fromEntries(childIds.map((id, i) => [id, i]));
    const allFetched = [];
    for (let i = 0; i < childIds.length; i += BATCH_SIZE) {
      const chunk = childIds.slice(i, i + BATCH_SIZE);
      const result = await dbClient
        .batchGet({
          RequestItems: {
            MenuV3: {
              Keys: chunk.map(id => ({ client_id: state.session.client_id, menu_id: id }))
            }
          }
        })
        .promise()
        .catch(error => {
          console.error('BatchGet error fetching menu items:', error.message);
          return { Responses: {} };
        });
      const fetched = result?.Responses?.MenuV3 || [];
      allFetched.push(...fetched);
    }
    // Sort back to original children order
    allFetched.sort((a, b) => {
      const ia = orderIndex[a.menu_id] ?? 9999;
      const ib = orderIndex[b.menu_id] ?? 9999;
      return ia - ib;
    });
    if (!reactData.menu_hierarchy[menu_level]) { reactData.menu_hierarchy[menu_level] = []; }
    const hiddenChildren = [];
    for (const this_item of allFetched) {
      if (!this_item.hasOwnProperty('available_to') || authorizedToMenuItem(this_item.available_to)) {
        if (!this_item.color) {
          if (parent && !parent.hidden) { this_item.color = parent.color; }
          else { this_item.color = stringToColor(this_item.menu_id); }
        }
        if (state.session.client_style?.suppress_card_image) { this_item.icon = null; }
        else if (!this_item.icon) { this_item.icon = resolvedSessionClientLogo; }
        const targetParentId = parent?.menu_id || null;
        const alreadyLoaded = reactData.menu_hierarchy[menu_level].some(
          (existingCell) => existingCell.menu_id === this_item.menu_id && existingCell.parent === targetParentId
        );
        if (!alreadyLoaded) {
          reactData.menu_hierarchy[menu_level].push({
            menu_id: this_item.menu_id,
            menuItemRec: this_item,
            parent: targetParentId
          });
        }
        if (this_item.hidden && this_item.menu_itemType === 'menu') {
          hiddenChildren.push({ children: this_item.children || [], level: menu_level + 1, parent: this_item });
        }
      }
    }
    // Recurse into hidden pass-through menus
    for (const { children, level, parent: hiddenParent } of hiddenChildren) {
      await batchGetMenuItems(children, level, hiddenParent);
    }

    // Backfill icon_thumb for legacy items that were saved without one — fire and forget
    const levelItems = (reactData.menu_hierarchy[menu_level] || []).map(c => c.menuItemRec);
    void backfillMenuThumbs(levelItems);
  };

  const normalizeFavorites = (favoriteList) => {
    if (!Array.isArray(favoriteList)) {
      return [];
    }
    const cleaned = favoriteList.filter((menuId) => {
      return (typeof menuId === 'string') && (menuId.trim() !== '') && (menuId !== '__v3_favorites__');
    });
    return [...new Set(cleaned)];
  };

  const applyFavoritesCardToHierarchy = async (menuHierarchy, favoriteList) => {
    const normalizedFavorites = normalizeFavorites(favoriteList);
    const newHierarchy = (menuHierarchy || []).map((levelList) => {
      return Array.isArray(levelList) ? [...levelList] : [];
    });

    if (!newHierarchy[1]) {
      newHierarchy[1] = [];
    }

    newHierarchy[1] = newHierarchy[1].filter((cell) => {
      return cell.menu_id !== '__v3_favorites__';
    });

    if ((normalizedFavorites.length > 0) && (reactData.start_at === '__top__')) {
      // Fetch (and cache) an optional 'favorites' MenuV3 template record for this client.
      if (favoritesMenuTemplateRef.current === undefined) {
        const templateResult = await dbClient
          .get({
            TableName: 'MenuV3',
            Key: { client_id: state.session.client_id, menu_id: 'favorites' }
          })
          .promise()
          .catch((error) => {
            cl({ 'Error fetching favorites menu template': error });
          });
        favoritesMenuTemplateRef.current = recordExists(templateResult) ? templateResult.Item : null;
      }
      const template = favoritesMenuTemplateRef.current;

      // User's personal favorites are prepended; any extra children from the template
      // that aren't already in the personal list are appended after them.
      const templateExtras = template
        ? (template.children || []).filter((id) => !normalizedFavorites.includes(id))
        : [];

      newHierarchy[1].unshift({
        menu_id: '__v3_favorites__',
        parent: '__top__',
        menuItemRec: {
          menu_id: '__v3_favorites__',
          description: template?.description || {
            short: 'Favorites',
            long: `${reactData.greetingName ? (reactData.greetingName + "'s") : 'Your'} Favorites`
          },
          menu_itemType: 'menu',
          children: [...normalizedFavorites, ...templateExtras],
          color: template?.color || stringToColor('__v3_favorites__'),
          icon_thumb: template?.icon_thumb || null,
          icon: template?.icon || template?.icon_thumb || resolvedSessionClientLogo
        }
      });
    }

    return newHierarchy;
  };

  const refreshFavoritesBranchInHierarchy = async (menuHierarchy, favoriteList) => {
    let refreshedHierarchy = await applyFavoritesCardToHierarchy(menuHierarchy, favoriteList);
    const favoritesCellObj = findMenuCellWithLevel(refreshedHierarchy, '__v3_favorites__');
    if (!favoritesCellObj) {
      return refreshedHierarchy;
    }

    const hasOpenFavoritesBranch = refreshedHierarchy.some((levelCells) => {
      return Array.isArray(levelCells) && levelCells.some((cell) => cell.parent === '__v3_favorites__');
    });

    if (!hasOpenFavoritesBranch) {
      return refreshedHierarchy;
    }

    const descendantsToRemove = new Set(['__v3_favorites__']);
    refreshedHierarchy = refreshedHierarchy.map((levelCells) => {
      const thisLevel = Array.isArray(levelCells) ? levelCells : [];
      return thisLevel.filter((cell) => {
        if (descendantsToRemove.has(cell.parent)) {
          descendantsToRemove.add(cell.menu_id);
          return false;
        }
        return true;
      });
    });

    reactData.menu_hierarchy = refreshedHierarchy;
    const favoritesMenuItem = favoritesCellObj.cell.menuItemRec;
    for (const favoriteMenuId of (favoritesMenuItem.children || [])) {
      await getMenuItem(favoriteMenuId, favoritesCellObj.levelIndex + 1, favoritesMenuItem);
    }

    return reactData.menu_hierarchy;
  };

  const saveFavorites = async (favoriteList) => {
    if (!activePersonId) {
      return false;
    }
    const normalizedFavorites = normalizeFavorites(favoriteList);
    await dbClient
      .update({
        TableName: 'People',
        Key: { person_id: activePersonId },
        UpdateExpression: 'set v3_favorites = :f',
        ExpressionAttributeValues: {
          ':f': normalizedFavorites
        }
      })
      .promise();
    return true;
  };

  const getOpenMenuModeKey = () => (useTileUI ? 'ui_tiles' : 'accessible');

  const getOpenMenuSessionContext = () => {
    const session_id = state.session?.patient_id;
    const client_id = state.session?.client_id;
    return { session_id, client_id };
  };

  const collectOpenMenuIdsFromHierarchy = (menuHierarchy) => {
    const hierarchy = Array.isArray(menuHierarchy) ? menuHierarchy : [];
    const openParents = new Set();

    hierarchy.forEach((levelCells, levelIndex) => {
      if (levelIndex === 0 || !Array.isArray(levelCells)) {
        return;
      }
      levelCells.forEach((cell) => {
        if (cell?.parent) {
          openParents.add(cell.parent);
        }
      });
    });

    return [...openParents];
  };

  const loadPersistedOpenMenuIds = async () => {
    const { session_id, client_id } = getOpenMenuSessionContext();
    if (!session_id || !client_id) {
      return [];
    }

    const sessionRec = await dbClient
      .get({
        TableName: 'SessionsV2',
        Key: { session_id }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading SessionsV2 for menu persistence': error });
      });

    if (!recordExists(sessionRec)) {
      return [];
    }

    const modeKey = getOpenMenuModeKey();
    return [sessionRec.Item?.customizations?.menu_v3_open?.[client_id]?.[modeKey]]
      .flat()
      .filter((menu_id) => (typeof menu_id === 'string') && (menu_id.trim() !== ''));
  };

  const persistOpenMenuIds = async (openMenuIds = []) => {
    const { session_id, client_id } = getOpenMenuSessionContext();
    if (!session_id || !client_id) {
      return;
    }

    const sessionRec = await dbClient
      .get({
        TableName: 'SessionsV2',
        Key: { session_id }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading SessionsV2 before menu persistence save': error });
      });

    let customizations = deepCopy(sessionRec?.Item?.customizations || {});
    if (!customizations.menu_v3_open) {
      customizations.menu_v3_open = {};
    }
    if (!customizations.menu_v3_open[client_id]) {
      customizations.menu_v3_open[client_id] = {
        ui_tiles: [],
        accessible: []
      };
    }

    const modeKey = getOpenMenuModeKey();
    customizations.menu_v3_open[client_id][modeKey] = [...new Set([openMenuIds].flat().filter((menu_id) => {
      return (typeof menu_id === 'string') && (menu_id.trim() !== '');
    }))];
    customizations.menu_v3_open[client_id].updated_at = new Date().toISOString();

    await dbClient
      .update({
        TableName: 'SessionsV2',
        Key: { session_id },
        UpdateExpression: 'set #c = :c',
        ExpressionAttributeNames: {
          '#c': 'customizations'
        },
        ExpressionAttributeValues: {
          ':c': customizations
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error saving SessionsV2 menu persistence': error });
      });
  };

  const findMenuCellWithLevel = (menuHierarchy, menu_id) => {
    for (let levelIndex = 0; levelIndex < menuHierarchy.length; levelIndex++) {
      const levelCells = menuHierarchy[levelIndex] || [];
      const foundCell = levelCells.find((cell) => cell.menu_id === menu_id);
      if (foundCell) {
        return { levelIndex, cell: foundCell };
      }
    }
    return null;
  };

  const applyPersistedOpenMenuIds = async (menuHierarchy, persistedOpenMenuIds = []) => {
    const pendingMenuIds = [...new Set([persistedOpenMenuIds].flat().filter((menu_id) => {
      return (typeof menu_id === 'string') && (menu_id.trim() !== '');
    }))];
    if (pendingMenuIds.length === 0) {
      return menuHierarchy;
    }

    reactData.menu_hierarchy = menuHierarchy;
    const pendingSet = new Set(pendingMenuIds);
    let guardCount = 0;
    while ((pendingSet.size > 0) && (guardCount < 20)) {
      let progress = false;
      for (const menu_id of [...pendingSet]) {
        const foundObj = findMenuCellWithLevel(reactData.menu_hierarchy, menu_id);
        if (!foundObj) {
          continue;
        }
        const this_menuCell = foundObj.cell;
        const this_menuItem = this_menuCell.menuItemRec;
        if (this_menuItem?.menu_itemType === 'menu') {
          for (const this_child of (this_menuItem.children || [])) {
            await getMenuItem(this_child, foundObj.levelIndex + 1, this_menuItem);
          }
        }
        pendingSet.delete(menu_id);
        progress = true;
      }
      if (!progress) {
        break;
      }
      guardCount += 1;
    }

    return reactData.menu_hierarchy;
  };

  const persistOpenMenusFromHierarchy = async (menuHierarchy) => {
    const openMenuIds = collectOpenMenuIdsFromHierarchy(menuHierarchy);
    await persistOpenMenuIds(openMenuIds);
  };

  const canManageMenuChildren = (menuItemRec) => {
    return !!(
      menuItemRec &&
      Object.prototype.hasOwnProperty.call(menuItemRec, 'allow_add') &&
      authorizedToMenuItem(menuItemRec.allow_add)
    );
  };

  const isPowerPointLink = (url = '') => {
    if (!url || typeof url !== 'string') {
      return false;
    }
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return false;
    }
    const withoutHash = trimmedUrl.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    return /\.(ppt|pptx)$/i.test(withoutQuery);
  };

  const buildLiveLinkEmbedUrl = (url) => {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      return '';
    }

    if (isPowerPointLink(normalizedUrl) && !/view\.officeapps\.live\.com\/op\/embed\.aspx/i.test(normalizedUrl)) {
      const encodedSource = encodeURIComponent(normalizedUrl);
      const objRef = getObject(encodedSource, 'url');
      return `https://view.officeapps.live.com/op/embed.aspx?src=${objRef}`;
    }

    return normalizedUrl;
  };

  const canPlayAsMedia = (url) => {
    if (!url || typeof url !== 'string') {
      return false;
    }
    return ReactPlayer.canPlay(url.trim());
  };

  const getLinkThumbnailUrl = (url, fallbackIcon) => {
    if (!url || typeof url !== 'string') {
      return fallbackIcon || null;
    }
    const trimmed = url.trim();
    if (/\.(jpe?g|png|gif|webp|svg|bmp)(\?.*)?$/i.test(trimmed)) {
      return trimmed;
    }
    const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/i);
    if (ytMatch) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/0.jpg`;
    }
    return fallbackIcon || null;
  };

  const findMenuCellInHierarchy = (menu_id) => {
    if (!menu_id) {
      return null;
    }
    return reactData.menu_hierarchy
      .flat()
      .find((candidateCell) => candidateCell.menu_id === menu_id) || null;
  };

  const isDescendantMenu = (menu_id, possibleAncestorId) => {
    if (!menu_id || !possibleAncestorId) {
      return false;
    }
    const hierarchyCells = reactData.menu_hierarchy.flat();
    const parentById = hierarchyCells.reduce((acc, cell) => {
      if (!acc[cell.menu_id]) {
        acc[cell.menu_id] = cell.parent;
      }
      return acc;
    }, {});

    let currentParent = parentById[menu_id];
    let guard = 0;
    while (currentParent && guard < 50) {
      if (currentParent === possibleAncestorId) {
        return true;
      }
      currentParent = parentById[currentParent];
      guard += 1;
    }
    return false;
  };

  const saveParentChildrenList = async (parentId, childrenList = []) => {
    const parentRec = await dbClient
      .get({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: parentId
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading parent during menu move': error });
      });

    if (!recordExists(parentRec)) {
      return false;
    }

    const expressionNames = { '#c': 'children' };
    const expressionValues = { ':c': childrenList };
    let updateExpression = 'set #c = :c';

    if (Object.prototype.hasOwnProperty.call(parentRec.Item, 'menu_items')) {
      expressionNames['#m'] = 'menu_items';
      expressionValues[':m'] = childrenList;
      updateExpression += ', #m = :m';
    }

    await dbClient
      .update({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: parentId
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues
      })
      .promise()
      .catch((error) => {
        cl({ 'Error saving parent children list during menu move': error });
      });

    return true;
  };

  const moveMenuItemToNewParent = async ({ draggedMenuId, sourceParentId, targetParentId }) => {
    if (!draggedMenuId || !sourceParentId || !targetParentId) {
      return false;
    }

    if (sourceParentId === targetParentId) {
      return false;
    }

    const sourceParentRec = await dbClient
      .get({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: sourceParentId
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading source parent during menu move': error });
      });

    const targetParentRec = await dbClient
      .get({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: targetParentId
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading target parent during menu move': error });
      });

    if (!recordExists(sourceParentRec) || !recordExists(targetParentRec)) {
      return false;
    }

    const sourceChildren = [...new Set([sourceParentRec.Item.children || []].flat())]
      .filter((childId) => childId !== draggedMenuId);

    const targetChildren = [...new Set([targetParentRec.Item.children || []].flat())];
    if (!targetChildren.includes(draggedMenuId)) {
      targetChildren.push(draggedMenuId);
    }

    const savedSource = await saveParentChildrenList(sourceParentId, sourceChildren);
    if (!savedSource) {
      return false;
    }

    const savedTarget = await saveParentChildrenList(targetParentId, targetChildren);
    if (!savedTarget) {
      return false;
    }

    return true;
  };

  const handleMenuCardDrop = async (event, targetCell) => {
    event.preventDefault();
    event.stopPropagation();

    const targetMenu = targetCell?.menuItemRec;
    if (!(targetMenu?.menu_itemType === 'menu') || !canManageMenuChildren(targetMenu)) {
      return;
    }

    let dragPayload;
    try {
      dragPayload = JSON.parse(event.dataTransfer.getData('application/json') || '{}');
    }
    catch {
      dragPayload = {};
    }

    const draggedMenuId = dragPayload.menu_id;
    const sourceParentId = dragPayload.parent_id;
    const targetParentId = targetCell.menu_id;

    if (!draggedMenuId || !sourceParentId || !targetParentId) {
      return;
    }

    if (draggedMenuId === targetParentId) {
      updateReactData({
        alert: {
          severity: 'warning',
          title: 'Invalid move',
          message: 'A menu cannot be moved into itself.'
        }
      }, true);
      return;
    }

    if (sourceParentId === targetParentId) {
      return;
    }

    if (isDescendantMenu(targetParentId, draggedMenuId)) {
      updateReactData({
        alert: {
          severity: 'warning',
          title: 'Invalid move',
          message: 'A menu cannot be moved into one of its descendants.'
        }
      }, true);
      return;
    }

    const sourceParentCell = findMenuCellInHierarchy(sourceParentId);
    if (!canManageMenuChildren(sourceParentCell?.menuItemRec)) {
      return;
    }

    const moveWorked = await moveMenuItemToNewParent({
      draggedMenuId,
      sourceParentId,
      targetParentId
    });

    if (!moveWorked) {
      updateReactData({
        alert: {
          severity: 'error',
          title: 'Move failed',
          message: 'Unable to move this item right now. Please try again.'
        }
      }, true);
      return;
    }

    const refreshedHierarchy = await rebuildMenuHierarchy({ includeLoadingState: false });
    void persistOpenMenusFromHierarchy(refreshedHierarchy);

    updateReactData({
      alert: {
        severity: 'success',
        title: 'Item moved',
        message: 'The item was moved successfully.'
      }
    }, true);
  };

  const handleSaveDescription = async () => {
    const { editDescriptionMenuId, editDescriptionShort, editDescriptionLong, editDescriptionAvailableTo, editDescriptionColor, editDescriptionItemType, editDescriptionTargets } = reactData;
    let saveWorked = true;
    const colorExpr = editDescriptionColor ? ', color = :c' : ' REMOVE color';
    const exprValues = {
      ':d': { short: editDescriptionShort, long: editDescriptionLong },
      ':a': editDescriptionAvailableTo || []
    };
    if (editDescriptionColor) { exprValues[':c'] = editDescriptionColor; }
    await dbClient
      .update({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: editDescriptionMenuId
        },
        UpdateExpression: `set #d = :d, available_to = :a${colorExpr}`,
        ExpressionAttributeNames: { '#d': 'description' },
        ExpressionAttributeValues: exprValues
      })
      .promise()
      .catch((error) => {
        saveWorked = false;
        cl({ 'Error updating MenuV3 description': error });
      });

    if (saveWorked && editDescriptionItemType === 'message_target') {
      const updatedCall = {
        target: 'MessageForm',
        params: {
          options: {
            newMessage: true,
            recipients: deepCopy(editDescriptionTargets || [])
          }
        }
      };
      await dbClient
        .update({
          TableName: 'MenuV3',
          Key: {
            client_id: state.session.client_id,
            menu_id: editDescriptionMenuId
          },
          UpdateExpression: 'set #c = :call',
          ExpressionAttributeNames: { '#c': 'call' },
          ExpressionAttributeValues: { ':call': updatedCall }
        })
        .promise()
        .catch((error) => {
          saveWorked = false;
          cl({ 'Error updating MenuV3 recipients': error });
        });
    }

    if (saveWorked) {
      for (const level of reactData.menu_hierarchy) {
        if (!level) { continue; }
        for (const cell of level) {
          if (cell.menu_id === editDescriptionMenuId && cell.menuItemRec) {
            cell.menuItemRec.description = { short: editDescriptionShort, long: editDescriptionLong };
            cell.menuItemRec.available_to = editDescriptionAvailableTo || [];
            cell.available_to = editDescriptionAvailableTo || [];
            if (editDescriptionColor) { cell.menuItemRec.color = editDescriptionColor; }
            else { delete cell.menuItemRec.color; }
            if (editDescriptionItemType === 'message_target') {
              if (!cell.menuItemRec.call) { cell.menuItemRec.call = { target: 'MessageForm', params: { options: {} } }; }
              cell.menuItemRec.call.params = cell.menuItemRec.call.params || {};
              cell.menuItemRec.call.params.options = cell.menuItemRec.call.params.options || {};
              cell.menuItemRec.call.params.options.recipients = deepCopy(editDescriptionTargets || []);
            }
          }
        }
      }
    }

    updateReactData({
      editDescriptionDialog: false,
      editDescriptionMenuId: null,
      editDescriptionShort: '',
      editDescriptionLong: '',
      editDescriptionAvailableTo: [],
      editDescriptionColor: null,
      editDescriptionParent: null,
      editDescriptionCanDelete: false,
      editDescriptionDenyMode: false,
      editDescriptionItemType: null,
      editDescriptionTargets: [],
      menu_hierarchy: reactData.menu_hierarchy.map(level => level ? [...level] : level),
      alert: saveWorked
        ? { severity: 'success', title: 'Saved', message: 'Description updated.' }
        : { severity: 'error', title: 'Save failed', message: 'Unable to update description. Please try again.' }
    }, true);
  };

  const handleDeleteMenuItem = async (deleteTarget) => {
    const menuId = deleteTarget?.menu_id;
    const parentId = deleteTarget?.parent_id;
    const menuLabel = deleteTarget?.label || menuId;

    if (!menuId || !parentId) {
      updateReactData({
        deleteMenuConfirm: false,
        deleteMenuTarget: null,
        alert: {
          severity: 'error',
          title: 'Delete failed',
          message: 'Unable to determine which menu item should be deleted.'
        }
      }, true);
      return;
    }

    if (['__top__', '__v3_favorites__', 'add_item_instructions'].includes(menuId)) {
      updateReactData({
        deleteMenuConfirm: false,
        deleteMenuTarget: null,
        alert: {
          severity: 'warning',
          title: 'Delete blocked',
          message: 'This menu item cannot be deleted.'
        }
      }, true);
      return;
    }

    const sourceParentCell = findMenuCellInHierarchy(parentId);
    if (!canManageMenuChildren(sourceParentCell?.menuItemRec)) {
      updateReactData({
        deleteMenuConfirm: false,
        deleteMenuTarget: null,
        alert: {
          severity: 'warning',
          title: 'Permission denied',
          message: 'You are not authorized to delete this item.'
        }
      }, true);
      return;
    }

    const menuRec = await dbClient
      .get({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: menuId
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading MenuV3 item during delete': error });
      });

    if (!recordExists(menuRec)) {
      updateReactData({
        deleteMenuConfirm: false,
        deleteMenuTarget: null,
        alert: {
          severity: 'error',
          title: 'Delete failed',
          message: 'The selected menu item no longer exists.'
        }
      }, true);
      return;
    }

    const hasVisibleChildren = (menuRec.Item.children || []).some((childId) => {
      return childId !== 'add_item_instructions';
    });

    if ((menuRec.Item.menu_itemType === 'menu') && hasVisibleChildren) {
      updateReactData({
        deleteMenuConfirm: false,
        deleteMenuTarget: null,
        alert: {
          severity: 'warning',
          title: 'Delete blocked',
          message: 'Please delete or move child items before deleting this menu.'
        }
      }, true);
      return;
    }

    const parentRec = await dbClient
      .get({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: parentId
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading parent MenuV3 during delete': error });
      });

    if (!recordExists(parentRec)) {
      updateReactData({
        deleteMenuConfirm: false,
        deleteMenuTarget: null,
        alert: {
          severity: 'error',
          title: 'Delete failed',
          message: 'The parent menu could not be loaded.'
        }
      }, true);
      return;
    }

    const updatedChildren = [...(parentRec.Item.children || [])].filter((childId) => childId !== menuId);
    const parentSaved = await saveParentChildrenList(parentId, updatedChildren);

    if (!parentSaved) {
      updateReactData({
        deleteMenuConfirm: false,
        deleteMenuTarget: null,
        alert: {
          severity: 'error',
          title: 'Delete failed',
          message: 'Unable to update the parent menu for this deletion.'
        }
      }, true);
      return;
    }

    let deleteWorked = true;
    await dbClient
      .delete({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: menuId
        }
      })
      .promise()
      .catch((error) => {
        deleteWorked = false;
        cl({ 'Error deleting MenuV3 item': error });
      });

    if (!deleteWorked) {
      updateReactData({
        deleteMenuConfirm: false,
        deleteMenuTarget: null,
        alert: {
          severity: 'error',
          title: 'Delete failed',
          message: 'Unable to remove this item right now. Please try again.'
        }
      }, true);
      return;
    }

    const currentFavorites = normalizeFavorites(reactData.v3_favorites);
    const nextFavorites = currentFavorites.filter((favoriteId) => favoriteId !== menuId);
    if (nextFavorites.length !== currentFavorites.length) {
      try {
        await saveFavorites(nextFavorites);
      }
      catch (error) {
        cl({ 'Error saving favorites during menu delete': error });
      }
    }

    const refreshedHierarchy = await rebuildMenuHierarchy({ includeLoadingState: false });
    const refreshedWithFavorites = await applyFavoritesCardToHierarchy(refreshedHierarchy, nextFavorites);
    void persistOpenMenusFromHierarchy(refreshedWithFavorites);

    updateReactData({
      deleteMenuConfirm: false,
      deleteMenuTarget: null,
      v3_favorites: nextFavorites,
      menu_hierarchy: refreshedWithFavorites,
      alert: {
        severity: 'success',
        title: 'Item deleted',
        message: `${menuLabel} was deleted.`
      }
    }, true);
  };

  const toggleFavoriteMenuItem = async (menuId) => {
    if (!menuId || menuId === '__v3_favorites__') {
      return;
    }

    const currentFavorites = normalizeFavorites(reactData.v3_favorites);
    const isFavoriteNow = currentFavorites.includes(menuId);
    const nextFavorites = isFavoriteNow
      ? currentFavorites.filter((thisId) => thisId !== menuId)
      : [menuId, ...currentFavorites.filter((thisId) => thisId !== menuId)];
    const nextHierarchy = await refreshFavoritesBranchInHierarchy(reactData.menu_hierarchy, nextFavorites);

    updateReactData({
      v3_favorites: nextFavorites,
      menu_hierarchy: nextHierarchy
    }, true);

    try {
      await saveFavorites(nextFavorites);
    }
    catch (error) {
      cl({ 'Error writing v3_favorites': error });
      const rollbackHierarchy = await refreshFavoritesBranchInHierarchy(reactData.menu_hierarchy, currentFavorites);
      updateReactData({
        v3_favorites: currentFavorites,
        menu_hierarchy: rollbackHierarchy,
        alert: {
          severity: 'error',
          title: 'Favorites not saved',
          message: 'Unable to save your Favorites right now.'
        }
      }, true);
    }
  };

  React.useEffect(() => {
    async function initialize() {
      if (state.session) {
        const tempName = (state.patient?.name ? state.patient.name.first : (state.session?.patient_display_name || state.session?.person_id));
        // Load the user's stored tile-mode preference FIRST so the menu renders
        // in the correct mode from the start — eliminates the accessibility→tile flash.
        // We set uiTilesOverride now but keep uiTilesOverrideLoaded=false so the
        // second useEffect's guard won't trigger a redundant rebuild.
        const [userUiTilesOverride] = await Promise.all([
          loadUserUiTilesOverride(),
          loadSubjectGroups()
        ]);
        updateReactData({
          greetingName: tempName || 'AVA User',
          greetingWords: makeGreeting(),
          ...(userUiTilesOverride !== null ? {
            uiTilesOverride: userUiTilesOverride,
            editFavorites: !userUiTilesOverride,
          } : {}),
        }, true);
        // Build the menu directly (uiTilesOverride is now set so useTileUI is correct).
        await rebuildMenuHierarchy({ includeLoadingState: true });
        // Mark loaded AFTER the build — this arms the second useEffect so it will
        // rebuild when the user later toggles the display mode.
        updateReactData({ uiTilesOverrideLoaded: true }, false);
        await updateMarquee();
        await loadMenuNotifications();
      }
      else {
        updateReactData({
          loading: false,
          alert: {
            severity: 'warning',
            title: 'Log-in not yet complete',
            message: `Sign-in hasn't completed yet.  Please tap here to reload your AVA Menu.`,
            action: [{ text: 'Reload Menu', function: () => { rebuildMenuHierarchy({ includeLoadingState: true }); } }]
          }
        }, true);
      }
    }
    initialize();
    return () => { };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild the menu when the user toggles the display mode after initial load.
  // The guard on uiTilesOverrideLoaded prevents a redundant rebuild during
  // initialization (the direct call in initialize() covers the first build).
  React.useEffect(() => {
    if (!reactData.uiTilesOverrideLoaded) {
      return;
    }
    rebuildMenuHierarchy({ includeLoadingState: true });
  }, [reactData.uiTilesOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (previousUseTileUIRef.current !== useTileUI) {
      previousUseTileUIRef.current = useTileUI;
      updateReactData({ editFavorites: !useTileUI }, true);
    }
  }, [useTileUI]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const handleResume = () => {
      void validateSessionPolicy({ trigger: 'resume' });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleResume();
      }
    };

    window.addEventListener('focus', handleResume);
    window.addEventListener('pageshow', handleResume);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('pageshow', handleResume);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [validateSessionPolicy]);

  React.useEffect(() => {
    if (!useTileUI || !tileContainerRef.current) { return; }
    const currentDepth = reactData.menu_hierarchy.filter(
      (level) => Array.isArray(level) && level.some((c) => !c.menuItemRec?.hidden)
    ).length;
    if (currentDepth > prevMenuDepthRef.current) {
      tileContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    prevMenuDepthRef.current = currentDepth;
  }, [forceRedisplay]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderSectionRegistry = {
    ClientMaintenance,
    FormManagement,
    FormFillB,
    MessageForm,
    ShowGroup,
    ShowCalendar,
    NewCalendarEvent,
    LoadSpreadsheet,
    PeopleMaintenance,
    SwitchPatientDialog,
    MessageMonitorV3,
    RequestDashboardV3,
    CheckInCheckOut,
    MarqueeMaintenance,
    MessageTemplateManager,
    GroupPhotoDirectory,
    TaskManager,
    MultiObservationFormD,
    MultiObservationFormC,
    ShowMenuB,
    QuickAdd,
    QuickSearch,
  };

  function renderFunction(call_instructions) {

    if (!call_instructions?.target) {
      return null;
    }

    const replaceTokens = (sourceValue) => {
      if (sourceValue === '<sessionRec>') {
        return state.session;
      }
      else if (sourceValue === '<personRec>') {
        return state.patient;
      }
      else if (sourceValue === '<patient_id>') {
        return state.session.patient_id;
      }
      else if (sourceValue === '<patient_name>') {
        return state.session.patient_display_name || state.patient?.name?.first || '';
      }
      else if (sourceValue === '<user_id>') {
        return state.session.user_id;
      }
      else if (sourceValue === '<client_id>') {
        return state.session.client_id;
      }
      else if (sourceValue === '<today_ymd>') {
        return makeDate(reactData.current_time, { timeZone: state.session.client_timezone }).ymd;
      }
      if (Array.isArray(sourceValue)) {
        return sourceValue.map((entry) => replaceTokens(entry));
      }
      if (sourceValue && typeof sourceValue === 'object') {
        return Object.keys(sourceValue).reduce((result, this_key) => {
          result[this_key] = replaceTokens(sourceValue[this_key]);
          return result;
        }, {});
      }
      return sourceValue;
    };

    let SectionToRender = call_instructions.target;
    if (typeof SectionToRender === 'string') {
      SectionToRender = renderSectionRegistry[SectionToRender] || null;
    }

    if (!SectionToRender) {
      updateReactData({
        alert: {
          severity: 'error',
          title: 'Unknown section target',
          message: `Unable to render target: ${call_instructions.target}`
        },
        renderFunctionCall: false
      }, true);
      return null;
    }

    const buildAlertFromCloseResponse = (closeResponse) => {
      if (!closeResponse || !closeResponse.message) {
        return false;
      }

      if (typeof closeResponse.message === 'string') {
        return {
          severity: 'warning',
          title: 'Notice',
          message: closeResponse.message
        };
      }

      if (typeof closeResponse.message === 'object') {
        return {
          severity: closeResponse.message.severity || 'warning',
          title: closeResponse.message.title || 'Notice',
          message: closeResponse.message.message || ''
        };
      }

      return false;
    };

    const props = replaceTokens(call_instructions.params || {});
    return (
      <SectionToRender
        calendarMode={props.options?.mode || 'signUp'}
        client={state.session.client_id}
        client_id={state.session.client_id}
        defaultObject={props.defaults || []}
        defaults={props.defaults || {}}
        defaultValue={props.defaults || null}
        eventClient={props.options?.client_id || state.session.client_id}
        fact={props.fact || null}
        factName={props.factName || props.fact?.name || props.fact?.factName || ''}
        isAppointment={props.options?.isAppointment}
        listValues={props.options?.listValues || props.fact?.listValues || []}
        OGpatient={reactData.OGpatient}
        options={props.options || {}}
        open={true}
        patient={state.session}
        pClient={state.session.client_id}
        peopleList={props.options?.peopleList || props.options?.OGvaluesList}
        personalEvent={props.options?.personalEvent}
        person_id={state.session.person_id}
        personRec={state.patient}
        picture={props.options?.picture || null}
        pMessageList={[]}
        pPerson={state.session.patient_id}
        prompt={props.options?.prompt || props.fact?.prompt || null}
        pSession={state.session}
        qualifiers={props.options?.qualifiers || props.fact?.qualifiers || null}
        request={props.request || {}}
        showMenu={true}
        showNewEvent={props.options?.showNewEvent}
        onReset={() => {
          start();
          updateReactData({
            renderFunctionCall: false
          }, true);
          void loadMenuNotifications();
        }}
        onAbort={() => {
          start();
          updateReactData({
            renderFunctionCall: false
          }, true);
          void loadMenuNotifications();
        }}
        onSave={(saveResponse) => {
          const closeAlert = buildAlertFromCloseResponse(saveResponse);
          start();
          const reactUpd = {
            renderFunctionCall: false
          };
          if (closeAlert) {
            reactUpd.alert = closeAlert;
          }
          updateReactData(reactUpd, true);
          void loadMenuNotifications();
        }}
        onClose={(closeResponse) => {
          const closeAlert = buildAlertFromCloseResponse(closeResponse);
          start();
          const reactUpd = {
            renderFunctionCall: false
          };
          if (closeAlert) {
            reactUpd.alert = closeAlert;
          }
          updateReactData(reactUpd, true);
          void loadMenuNotifications();
        }}
      />);
  }

  function deriveMenuIdBase(titleText = '') {
    const normalized = `${titleText}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized || 'menu_item';
  }

  async function deriveUniqueMenuId(titleText = '') {
    const baseId = deriveMenuIdBase(titleText);
    let candidateId = baseId;
    let suffix = 2;

    while (true) {
      const existingRec = await dbClient
        .get({
          TableName: 'MenuV3',
          Key: {
            client_id: state.session.client_id,
            menu_id: candidateId
          }
        })
        .promise()
        .catch((error) => {
          cl({ 'Error checking existing MenuV3 item': error });
        });

      if (!recordExists(existingRec)) {
        return candidateId;
      }

      candidateId = `${baseId}_${suffix}`;
      suffix += 1;
    }
  }

  const getUploadSettings = (fileSize) => {
    const basePartSize = 10 * 1024 * 1024;
    const baseQueueSize = 4;
    if (!fileSize) {
      return { partSize: basePartSize, queueSize: baseQueueSize };
    }
    if (fileSize >= 1024 * 1024 * 1024) {
      return { partSize: Math.max(basePartSize, 50 * 1024 * 1024), queueSize: Math.max(baseQueueSize, 8) };
    }
    if (fileSize >= 200 * 1024 * 1024) {
      return { partSize: Math.max(basePartSize, 20 * 1024 * 1024), queueSize: Math.max(baseQueueSize, 6) };
    }
    return { partSize: basePartSize, queueSize: baseQueueSize };
  };

  async function uploadMenuLinkFile(fileToUpload) {
    const bucketName = `125549937716-${state.session.client_id.toLowerCase().replace(/[^a-zA-Z0-9-]/g, '-')}`;
    const nowTime = new Date().getTime();
    const safeName = `${fileToUpload.name || 'upload.bin'}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const keyName = `menu_links/${nowTime}_${safeName}`;
    const uploadSettings = getUploadSettings(fileToUpload?.size);

    const uploadTask = s3.upload({
      partSize: uploadSettings.partSize,
      queueSize: uploadSettings.queueSize,
      Bucket: bucketName,
      Key: keyName,
      Body: fileToUpload,
      ACL: 'public-read',
      ContentType: fileToUpload?.type || 'application/octet-stream'
    });

    uploadTask.on('httpUploadProgress', (progressEvent) => {
      const loaded = progressEvent?.loaded || 0;
      const total = progressEvent?.total || fileToUpload?.size || 0;
      const progressPercent = total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : 0;
      updateReactData({
        addMenuDialogUploadProgress: progressPercent
      }, true);
    });

    const uploadResponse = await new Promise((resolve, reject) => {
      uploadTask.send((err, good) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(good);
        }
      });
    });

    updateReactData({
      addMenuDialogUploadProgress: 100
    }, true);

    return uploadResponse;
  }

  async function handleAddMenuItem() {
    const titleText = (reactData.addMenuDialogTitle || '').trim();
    const itemType = reactData.addMenuDialogType || (!reactData.is_support ? 'link' : null);
    const phoneDigits = (reactData.addMenuDialogPhone || '').replace(/\D/g, '');
    const linkSource = reactData.addMenuDialogLinkSource || 'url';
    const urlText = (reactData.addMenuDialogUrl || '').trim();
    const uploadFiles = reactData.addMenuDialogUploadFiles || [];
    const messageTargets = ([reactData.addMenuDialogTargets].flat())
      .filter((targetRec) => {
        return !!(targetRec && (targetRec.person_id || targetRec.group_id || targetRec.rIndex !== undefined));
      })
      .map((targetRec) => {
        if (targetRec.person_id) {
          return {
            person_id: targetRec.person_id,
            person_name: targetRec.person_name || `${targetRec.person_firstName || ''} ${targetRec.person_lastName || ''}`.trim(),
            person_firstName: targetRec.person_firstName,
            person_lastName: targetRec.person_lastName
          };
        }
        if (targetRec.group_id) {
          return {
            group_id: targetRec.group_id,
            group_name: targetRec.group_name || targetRec.group_id
          };
        }
        return {
          rIndex: targetRec.rIndex
        };
      });

    if (!titleText) {
      updateReactData({
        alert: {
          severity: 'warning',
          title: 'Missing title',
          message: 'Please provide a title for the new card.'
        }
      }, true);
      return;
    }

    if ((itemType === 'link') && (linkSource === 'url') && !urlText) {
      updateReactData({
        alert: {
          severity: 'warning',
          title: 'Missing URL',
          message: 'Please provide a URL when the card type is Link.'
        }
      }, true);
      return;
    }

    if ((itemType === 'link') && (linkSource === 'upload') && uploadFiles.length === 0) {
      updateReactData({
        alert: {
          severity: 'warning',
          title: 'Missing file',
          message: 'Please choose a file to upload when link source is Upload.'
        }
      }, true);
      return;
    }

    if ((itemType === 'message_target') && (messageTargets.length === 0)) {
      updateReactData({
        alert: {
          severity: 'warning',
          title: 'Missing targets',
          message: 'Choose one or more people or groups for this one-tap Message.'
        }
      }, true);
      return;
    }

    if ((itemType === 'phone_dial') && (phoneDigits.length !== 10)) {
      updateReactData({
        alert: {
          severity: 'warning',
          title: 'Invalid phone number',
          message: 'Please enter a 10-digit US phone number.'
        }
      }, true);
      return;
    }

    if (!reactData.addMenuDialogParent && reactData.addMenuDialogParent !== '__top__') {
      updateReactData({
        alert: {
          severity: 'error',
          title: 'Missing parent',
          message: 'Unable to determine which parent menu should receive this new card.'
        }
      }, true);
      return;
    }

    updateReactData({ addMenuDialogSaving: true, addMenuDialogUploadProgress: 0 }, true);

    const parentRec = await dbClient
      .get({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: reactData.addMenuDialogParent
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading parent MenuV3 record': error });
      });

    if (!recordExists(parentRec)) {
      updateReactData({
        addMenuDialogSaving: false,
        alert: {
          severity: 'error',
          title: 'Parent not found',
          message: 'Unable to find the parent menu for this level.'
        }
      }, true);
      return;
    }

    // Multi-file upload: upload each file, create one menu card per file, then return.
    if ((itemType === 'link') && (linkSource === 'upload')) {
      const createdCells = [];
      const failedFiles = [];
      for (let fi = 0; fi < uploadFiles.length; fi++) {
        const fileToUpload = uploadFiles[fi];
        updateReactData({ addMenuDialogUploadFileIndex: fi, addMenuDialogUploadProgress: 0 }, true);
        let fileUrl = '';
        let thumbDataUrl = null;
        try {
          // Generate thumbnail client-side before uploading — stored in DB, no extra fetches needed
          thumbDataUrl = await generateMenuThumb(fileToUpload);
          if (!thumbDataUrl && fileToUpload?.type?.startsWith('video/')) {
            thumbDataUrl = 'https://ava-icons.s3.amazonaws.com/movie.png';
          }
          const uploadResponse = await uploadMenuLinkFile(fileToUpload);
          fileUrl = uploadResponse?.Location || '';
        }
        catch (error) {
          cl({ 'Error uploading menu link file': error });
          failedFiles.push(fileToUpload.name || `file ${fi + 1}`);
          continue;
        }
        if (!fileUrl) {
          failedFiles.push(fileToUpload.name || `file ${fi + 1}`);
          continue;
        }
        const cardTitle = uploadFiles.length === 1 ? titleText : `${titleText} ${fi + 1}`;
        const newMenuId = await deriveUniqueMenuId(cardTitle);
        const newMenuRec = {
          client_id: state.session.client_id,
          menu_id: newMenuId,
          available_to: reactData.addMenuDialogAvailableTo,
          description: { long: cardTitle, short: cardTitle },
          menu_itemType: 'link',
          url: fileUrl,
          ...(thumbDataUrl ? { icon_thumb: thumbDataUrl } : {}),
          ...(reactData.addMenuDialogColor ? { color: reactData.addMenuDialogColor } : {})
        };
        if (parentRec.Item.hasOwnProperty('newItem_availableTo')) {
          newMenuRec.available_to = [];
          parentRec.Item.newItem_availableTo.forEach(p => {
            if (p === '*match') {
              state.patient.groups.forEach(g => { newMenuRec.available_to.push(`group:${g}`); });
            }
            else { newMenuRec.available_to.push(p); }
          });
        }
        await dbClient.put({ TableName: 'MenuV3', Item: newMenuRec }).promise()
          .catch((error) => { cl({ 'Error creating new MenuV3 record': error }); });
        createdCells.push({ menu_id: newMenuId, menuItemRec: newMenuRec, parent: reactData.addMenuDialogParent });
      }
      if (createdCells.length === 0) {
        updateReactData({
          addMenuDialogSaving: false,
          addMenuDialogUploadProgress: 0,
          addMenuDialogUploadFileIndex: 0,
          alert: {
            severity: 'error',
            title: 'Upload failed',
            message: failedFiles.length > 0
              ? `All uploads failed: ${failedFiles.slice(0, 5).join(', ')}${failedFiles.length > 5 ? ` (+${failedFiles.length - 5} more)` : ''}`
              : 'No files were uploaded successfully.'
          }
        }, true);
        return;
      }
      const updatedChildren = [...(parentRec.Item.children || [])];
      createdCells.forEach(({ menu_id }) => {
        if (!updatedChildren.includes(menu_id)) updatedChildren.unshift(menu_id);
      });
      await dbClient.update({
        TableName: 'MenuV3',
        Key: { client_id: state.session.client_id, menu_id: reactData.addMenuDialogParent },
        UpdateExpression: 'set #c = :c',
        ExpressionAttributeNames: { '#c': 'children' },
        ExpressionAttributeValues: { ':c': updatedChildren }
      }).promise().catch((error) => { cl({ 'Error updating parent MenuV3 children': error }); });
      const updatedMenuHierarchy = [...reactData.menu_hierarchy];
      const targetLevel = reactData.addMenuDialogLevel;
      if (!updatedMenuHierarchy[targetLevel]) updatedMenuHierarchy[targetLevel] = [];
      updatedMenuHierarchy[targetLevel] = [...createdCells, ...updatedMenuHierarchy[targetLevel]];
      const successMsg = createdCells.length === 1
        ? `${createdCells[0].menuItemRec.description.short} was added to this level.`
        : `${createdCells.length} cards were added to this level.${failedFiles.length > 0 ? ` (${failedFiles.length} file${failedFiles.length > 1 ? 's' : ''} failed)` : ''}`;
      updateReactData({
        addMenuDialog: false,
        addMenuDialogLevel: null,
        addMenuDialogParent: null,
        addMenuDialogType: null,
        addMenuDialogLinkSource: 'url',
        addMenuDialogTitle: '',
        addMenuDialogUrl: '',
        addMenuDialogUploadFiles: [],
        addMenuDialogUploadFileIndex: 0,
        addMenuDialogUploadFileName: '',
        addMenuDialogUploadProgress: 0,
        addMenuDialogSaving: false,
        addMenuDialogTargets: [],
        addMenuDialogPhone: '',
        addMenuDialogAvailableTo: [],
        addMenuDialogColor: null,
        addMenuDialogAccessReviewed: false,
        addMenuDialogDenyMode: false,
        showAddMessageTargetSearch: false,
        showAddAccessToSearch: false,
        selections: [],
        menu_hierarchy: updatedMenuHierarchy,
        alert: {
          severity: failedFiles.length > 0 ? 'warning' : 'success',
          title: failedFiles.length > 0 ? 'Some uploads failed' : 'Cards added',
          message: successMsg
        }
      }, true);
      return;
    }

    let finalLinkUrl = urlText;
    const newMenuId = await deriveUniqueMenuId(titleText);
    const newMenuItemType = (itemType === 'message_target') ? 'function' : (itemType === 'phone_dial') ? 'link' : itemType;
    const newMenuRec = {
      client_id: state.session.client_id,
      menu_id: newMenuId,
      available_to: reactData.addMenuDialogAvailableTo,
      description: {
        long: titleText,
        short: titleText,
      },
      menu_itemType: newMenuItemType,
      ...(reactData.addMenuDialogColor ? { color: reactData.addMenuDialogColor } : {})
    };

    if (itemType === 'link') {
      newMenuRec.url = finalLinkUrl;
    }
    else if (itemType === 'phone_dial') {
      newMenuRec.url = `tel:+1${phoneDigits}`;
    }
    else if (itemType === 'message_target') {
      const callObj = {
        target: 'MessageForm',
        params: {
          options: {
            newMessage: true,
            recipients: deepCopy(messageTargets)
          }
        }
      };
      newMenuRec.call = callObj;
    }
    else {
      newMenuRec.children = ['add_item_instructions'];
      if (Object.prototype.hasOwnProperty.call(parentRec.Item, 'allow_add')) {
        newMenuRec.allow_add = deepCopy([parentRec.Item.allow_add].flat());
      }
    }

    await dbClient
      .put({
        TableName: 'MenuV3',
        Item: newMenuRec
      })
      .promise()
      .catch((error) => {
        cl({ 'Error creating new MenuV3 record': error });
      });

    const updatedChildren = [...(parentRec.Item.children || [])];
    if (!updatedChildren.includes(newMenuId)) {
      updatedChildren.unshift(newMenuId);
    }

    await dbClient
      .update({
        TableName: 'MenuV3',
        Key: {
          client_id: state.session.client_id,
          menu_id: reactData.addMenuDialogParent
        },
        UpdateExpression: 'set #c = :c',
        ExpressionAttributeNames: {
          '#c': 'children'
        },
        ExpressionAttributeValues: {
          ':c': updatedChildren
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error updating parent MenuV3 children': error });
      });

    const updatedMenuHierarchy = [...reactData.menu_hierarchy];
    const targetLevel = reactData.addMenuDialogLevel;
    if (!updatedMenuHierarchy[targetLevel]) {
      updatedMenuHierarchy[targetLevel] = [];
    }
    updatedMenuHierarchy[targetLevel] = [
      {
        menu_id: newMenuId,
        menuItemRec: newMenuRec,
        parent: reactData.addMenuDialogParent
      },
      ...updatedMenuHierarchy[targetLevel],
    ];

    updateReactData({
      addMenuDialog: false,
      addMenuDialogLevel: null,
      addMenuDialogParent: null,
      addMenuDialogType: null,
      addMenuDialogLinkSource: 'url',
      addMenuDialogTitle: '',
      addMenuDialogUrl: '',
      addMenuDialogUploadFiles: [],
      addMenuDialogUploadFileIndex: 0,
      addMenuDialogUploadFileName: '',
      addMenuDialogUploadProgress: 0,
      addMenuDialogSaving: false,
      addMenuDialogTargets: [],
      addMenuDialogPhone: '',
      addMenuDialogAvailableTo: [],
      addMenuDialogColor: null,
      addMenuDialogAccessReviewed: false,
      addMenuDialogDenyMode: false,
      showAddMessageTargetSearch: false,
      showAddAccessToSearch: false,
      selections: [],
      menu_hierarchy: updatedMenuHierarchy,
      alert: {
        severity: 'success',
        title: 'Card added',
        message: `${titleText} was added to this level.`
      }
    }, true);
  }

  const accessLog = async (pUser, pPwd, pMessage) => {
    var payload =
    {
      'test': false,
      'action': "add_entry",
      'request': {
        'attempted_user': pUser,
        'attempted_password': pPwd,
        'result': pMessage
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:AccessLogMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        cl('Access log call failed.  Error is', JSON.stringify(err));
      });
  };

  const activityLog = async (pCode, pName) => {
    let postTime = new Date().getTime();
    await dbClient
      .put({
        TableName: 'ActivityLog',
        Item: {
          timestamp: postTime,
          user_id: state.session?.user_id,
          person_id: state.session?.person_id,
          activity_code: pCode,
          activity_name: pName,
          AVA_version: reactData.AVA_version
        }
      })
      .promise()
      .catch(error => {
        cl(`Bad put to ActivityLog - caught error is: ${error}`);
      });
  };

  function makeExpiration() {
    const policy = getEffectivePolicy();
    const policyState = readSessionPolicyState();
    const candidateExpirations = [];

    const absoluteExpiryMs = Date.parse(policyState?.expires_at || '');
    if (Number.isFinite(absoluteExpiryMs)) {
      candidateExpirations.push(absoluteExpiryMs);
    }

    const idleMinutes = Number(policy?.idle_timeout_minutes);
    if (Number.isFinite(idleMinutes) && idleMinutes > 0) {
      const idleAnchorMs = Date.parse(policyState?.last_active_at || policyState?.started_at || '');
      if (Number.isFinite(idleAnchorMs)) {
        candidateExpirations.push(idleAnchorMs + (idleMinutes * oneMinute));
      }
    }

    let displayExpiryMs = candidateExpirations.length > 0
      ? Math.min(...candidateExpirations)
      : null;

    if (!Number.isFinite(displayExpiryMs)) {
      let cognitoExpiresRaw = null;
      try {
        cognitoExpiresRaw = JSON.parse(sessionStorage.getItem('cognito_expires'));
      }
      catch {
        cognitoExpiresRaw = null;
      }
      const cognitoExpiresSeconds = Number(cognitoExpiresRaw);
      displayExpiryMs = (Number.isFinite(cognitoExpiresSeconds) && cognitoExpiresSeconds > 0)
        ? (cognitoExpiresSeconds * 1000)
        : (nowTime + oneHour);
    }

    const sTime = new Date(displayExpiryMs);
    return `Sess exp ${sTime.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;
  }

  function makeGreeting() {
    if (session?.custom_greeting) {
      return session.custom_greeting;
    }
    else {
      return `Good ${makeTime(new Date()).dayPart}`;
    }
  }

  function proxyAuthority() {
    // You are always in your own proxy list.  You shuld only have proxy authority here if there is someone else in yourlist too
    if (reactData.is_master) {
      return true;
    }
    if (state.session.responsible_for && (state.session.responsible_for.length > 0)) {
      return true;
    }
    if (state.accessList && state.accessList.hasOwnProperty(session.client_id) && state.accessList[session.client_id].hasOwnProperty('count')) {
      if ((state.accessList[session.client_id].count.proxy > 1) || (state.accessList[session.client_id].count.full > 1)) {
        return true;
      }
    }
    return false;
  }

  const createAccountAuthority = () => {
    if (state.accessList && state.accessList.hasOwnProperty(session.client_id) && state.accessList[session.client_id].hasOwnProperty('count')) {
      if (state.user?.account_class && (['master', 'support', 'admin'].includes(state.user.account_class))) {
        return true;
      }
    }
    return false;
  };

  const firstVisibleLevelIndex = reactData.menu_hierarchy.findIndex((menuLevel) => {
    return Array.isArray(menuLevel) && menuLevel.some((cell) => !cell.menuItemRec.hidden);
  });

  const withMobileTextCap = (styleObj, { maxPx = 22, minPx = 13 } = {}) => {
    if (!isMobile || !styleObj) {
      return styleObj;
    }
    const nextStyle = { ...styleObj };
    const rawFontSize = nextStyle.fontSize;
    if ((typeof rawFontSize === 'string') && rawFontSize.endsWith('rem')) {
      const remValue = Number.parseFloat(rawFontSize);
      if (Number.isFinite(remValue)) {
        const estimatedPx = remValue * 16;
        const clampedPx = Math.min(maxPx, Math.max(minPx, estimatedPx));
        nextStyle.fontSize = `${clampedPx}px`;
      }
    }
    nextStyle.wordBreak = 'break-word';
    nextStyle.overflowWrap = 'anywhere';
    return nextStyle;
  };

  const withMenuMobileTextCap = (styleObj) => {
    return withMobileTextCap(styleObj, { maxPx: useTileUI ? 18 : 20, minPx: 13 });
  };

  const describeAvailableTo = (available_to) => {
    const rules = available_to || [];
    if (rules.length === 0 || rules.includes('*none')) { return 'No access assigned'; }

    const denyRules = rules.filter(r => r.startsWith('!'));
    const allowRules = rules.filter(r => !r.startsWith('!'));

    // Separate star-rules from group: and person: entries
    const starRules = allowRules.filter(r => r.trimStart().startsWith('*'));
    const groupIds = allowRules.filter(r => r.startsWith('group:')).map(r => r.slice(6));
    const personIds = allowRules.filter(r => r.startsWith('person:')).map(r => r.slice(7));

    const parts = [];

    // Star rules pass through as-is
    if (starRules.length > 0) {
      parts.push(...starRules);
    }

    if (groupIds.length > 0) {
      parts.push(`${groupIds.length} Group${groupIds.length === 1 ? '' : 's'}`);
    }
    if (personIds.length > 0) {
      parts.push(`${personIds.length} ${personIds.length === 1 ? 'Person' : 'People'}`);
    }

    const denyGroupCount = denyRules.filter(r => r.startsWith('!group:')).length;
    const denyPersonCount = denyRules.filter(r => r.startsWith('!person:')).length;
    const denyStarRules = denyRules.filter(r => !r.startsWith('!group:') && !r.startsWith('!person:'));
    const denyParts = [];
    if (denyGroupCount > 0) { denyParts.push(`${denyGroupCount} Group${denyGroupCount === 1 ? '' : 's'}`); }
    if (denyPersonCount > 0) { denyParts.push(`${denyPersonCount} ${denyPersonCount === 1 ? 'Person' : 'People'}`); }
    denyStarRules.forEach(r => denyParts.push(r.slice(1)));
    if (denyParts.length > 0) { parts.push(`except ${denyParts.join(', ')}`); }

    return parts.length > 0 ? parts.join(', ') : 'Everyone';
  };

  // The three named star-values that can appear as access rules in available_to
  // and need to be selectable (and pre-selected) in the QuickSearch dialog.
  const SPECIAL_ACCESS_VALUES = [
    { person_id: '*all', first: '* Everybody', last: '' },
    { person_id: '*admin', first: '* Administrators', last: '' },
    { person_id: '*support', first: '* Support Staff', last: '' },
  ];

  // Returns the initialized available_to array for a new menu item:
  // the current user and (if different) the active patient, plus whatever
  // the parent menu item already restricts access to.
  const makeDefaultAvailableTo = (parentId) => {
    const userId = state.session.user_id;
    const patientId = state.session.patient_id;
    const parentCell = reactData.menu_hierarchy.flat().find(c => c.menu_id === parentId);
    const parentAvailableTo = parentCell?.menuItemRec?.available_to || [];
    const personEntries = [
      ...(userId ? [`person:${userId}`] : []),
      ...(patientId && patientId !== userId ? [`person:${patientId}`] : []),
    ];
    return [...new Set([...personEntries, ...parentAvailableTo])];
  };

  // Returns true when the Add button should be blocked pending a security review.
  // That is: the user has not yet opened the "Set" dialog AND the current
  // available_to contains only the auto-defaulted person entries (user / patient)
  // plus generic "*..." entries — i.e. no explicit group or third-party restrictions
  // have been set yet.
  const addDialogNeedsReview = (availableTo) => {
    if (reactData.addMenuDialogAccessReviewed) { return false; }
    const userId = state.session.user_id;
    const patientId = state.session.patient_id;
    const defaultPersonEntries = new Set([
      ...(userId ? [`person:${userId}`] : []),
      ...(patientId && patientId !== userId ? [`person:${patientId}`] : []),
    ]);
    return (availableTo || []).every(r => r.startsWith('*') || defaultPersonEntries.has(r));
  };

  const renderNotificationMessage = (message) => {
    if (typeof message !== 'string') {
      return message;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return '';
    }

    const sanitizedMessage = trimmedMessage
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
      .replace(/\son\w+=(['"]).*?\1/gi, '')
      .replace(/\s(href|src)=(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');

    return <span dangerouslySetInnerHTML={{ __html: sanitizedMessage }} />;
  };

  function renderAccessibleSubMenu(parentMenuId, level_index, accessibleDepth = 1) {
    if (useTileUI) {
      return null;
    }

    const childCells = (reactData.menu_hierarchy[level_index] || [])
      .filter((cell) => !cell.menuItemRec.hidden && (cell.parent === parentMenuId));

    if (childCells.length === 0) {
      return null;
    }

    return (
      <Box
        key={`accessible_submenu_${parentMenuId}_${level_index}`}
        display='flex'
        flexDirection='column'
        ml={3}
        mr={1}
        mt={!useTileUI ? 0 : 1}
        mb={!useTileUI ? 0 : 1}
      >
        {childCells.map((childCell, childIndex) => {
          return renderMenuCardCell(childCell, level_index, childIndex, `accessible_${parentMenuId}_`, accessibleDepth);
        })}
      </Box>
    );
  }

  function renderMenuCardCell(this_cell, level_index, item_index, keyPrefix = 'menuLevel', accessibleDepth = 0) {
    const this_item = this_cell.menuItemRec;
    const menuItemType = this_item.menu_itemType;
    const normalizedMenuType = this_item.menu_type || menuItemType;
    const isFavoriteCard = this_item.menu_id === '__v3_favorites__';
    const isFavorite = (reactData.v3_favorites || []).includes(this_item.menu_id);
    const canAddFromThisRow = (!useTileUI) && (menuItemType === 'menu') && !!(
      Object.prototype.hasOwnProperty.call(this_item, 'allow_add') &&
      authorizedToMenuItem(this_item.allow_add)
    );
    const sourceParentCell = this_cell.parent ? findMenuCellInHierarchy(this_cell.parent) : null;
    const canDragThisCard = !!(this_cell.parent && canManageMenuChildren(sourceParentCell?.menuItemRec));
    const canDeleteThisCard = !!(
      this_cell.parent &&
      canManageMenuChildren(sourceParentCell?.menuItemRec) &&
      !['__top__', '__v3_favorites__', 'add_item_instructions'].includes(this_item.menu_id)
    );
    const canDropOnThisCard = !!((menuItemType === 'menu') && canManageMenuChildren(this_item));
    const isLinkCard = ['link', 'live_link'].includes(normalizedMenuType);
    const isTelLink = isLinkCard && String(this_item.url || '').trim().toLowerCase().startsWith('tel:');
    const allowNestedAccessibleThumb = (!useTileUI)
      && (accessibleDepth > 0)
      && isLinkCard
      && !isTelLink
      && !!this_item.icon_thumb;
    const hideCardImage = (!useTileUI) && (accessibleDepth > 0) && !allowNestedAccessibleThumb;
    // Prefer canonical icon URLs for non-link cards in both modes; keep icon_thumb
    // only as a fallback for legacy records without icon.
    const cardImageUrl = (isLinkCard && !isTelLink)
      ? getLinkThumbnailUrl(this_item.url, this_item.icon || this_item.icon_thumb)
      : (this_item.icon || this_item.icon_thumb);
    const hasLinkThumbnail = (isLinkCard && !isTelLink) && !!(cardImageUrl && cardImageUrl !== this_item.icon);
    const parentColor = (level_index > 0)
      ? reactData.menu_hierarchy[level_index - 1]?.find((parentCell) => parentCell.menu_id === this_cell.parent)?.menuItemRec?.color
      : null;
    const tileColor = this_item.color || parentColor || stringToColor(this_item.menu_id);
    // const tileOpacity = Math.max(0.5, 1 - (level_index * 0.2));
    const tileOpacity = 1;
    const isActiveParent = (menuItemType === 'menu') &&
      (reactData.level_active_parent?.[level_index + 1] === this_item.menu_id);
    const hasChildren = (menuItemType === 'menu') && Array.isArray(this_item.children) && (this_item.children.length > 0);
    const accessibleChildrenExpanded = (!useTileUI) && hasChildren &&
      (reactData.menu_hierarchy[level_index + 1] || []).some((cell) => cell.parent === this_item.menu_id);

    const cardTile = (
      <Card className={classes.root}
        key={`${keyPrefix}${level_index}_card${item_index}`}
        style={{
          marginRight: useTileUI ? '8px' : 0,
          marginLeft: useTileUI ? '8px' : 0,
          marginTop: useTileUI ? null : (accessibleDepth === 0 ? '16px' : 0),
          paddingRight: useTileUI ? null : 0,
          borderRadius: ('30px 30px 30px 30px'),
          backgroundColor: hexToRgb(tileColor, tileOpacity),
          textDecoration: 'none',
          position: 'relative',
          width: useTileUI ? undefined : '100%',
          maxWidth: useTileUI ? undefined : '100%',
          minWidth: useTileUI ? undefined : '100%',
          boxSizing: 'border-box',
          minHeight: useTileUI ? undefined : 86,
          maxHeight: useTileUI ? undefined : 'none',
          marginBottom: useTileUI ? 10 : 2,
          ...((isActiveParent && useTileUI) ? {
            outline: `8px solid black`,
            boxShadow: '10px 10px 10px',
            filter: 'brightness(1.18)',
          } : {}),
        }}
        onContextMenu={async (e) => {
          e.preventDefault();
          const canEditFromAlert = (reactData.is_admin || reactData.is_support);
          updateReactData({
            alert: {
              severity: 'info',
              title: this_item.description?.short,
              message: <div>
                ID: {this_item.menu_id}<br />
                Type: {this_item.menu_itemType}{this_item.url && <><br />URL: {this_item.url.length > 60 ? this_item.url.slice(0, 60) + '…' : this_item.url}</>}<br />
                Security: {describeAvailableTo(this_item.available_to)}<br />
              </div>,
              editMenuItem: canEditFromAlert
                ? {
                  menu_id: this_item.menu_id,
                  description_short: this_item.description?.short || '',
                  description_long: this_item.description?.long || '',
                  available_to: deepCopy(this_item.available_to || []),
                  color: this_item.color || null,
                  parent: this_cell.parent || null,
                  can_delete: canDeleteThisCard,
                  item_type: (this_item.call?.target === 'MessageForm' && Array.isArray(this_item.call?.params?.options?.recipients) && this_item.call.params.options.recipients.length > 0) ? 'message_target' : null,
                  targets: deepCopy(this_item.call?.params?.options?.recipients || []),
                }
                : null,
            }
          }, true);
        }}
        onClick={async () => {
          if (this_item.menu_itemType === 'menu') {
            if (useTileUI) {
              for (let levelToClear = level_index + 1; levelToClear < reactData.menu_hierarchy.length; levelToClear++) {
                reactData.menu_hierarchy[levelToClear] = [];
              }
              // Ensure the next level slot always exists, even if no children load (e.g. empty addable menu)
              if (!reactData.menu_hierarchy[level_index + 1]) {
                reactData.menu_hierarchy[level_index + 1] = [];
              }
              reactData.level_active_parent[level_index + 1] = this_item.menu_id;
              // Reset to first page when opening a new menu level
              reactData.levelPages = Object.assign({}, reactData.levelPages, { [level_index + 1]: 0 });
              await batchGetMenuItems(this_item.children, level_index + 1, this_item);
            }
            else {
              const nextLevelCells = reactData.menu_hierarchy[level_index + 1] || [];
              const hasLoadedChildren = nextLevelCells.some((cell) => {
                return cell.parent === this_item.menu_id;
              });

              if (hasLoadedChildren) {
                const collapsedIds = new Set([this_item.menu_id]);
                for (let levelToTrim = level_index + 1; levelToTrim < reactData.menu_hierarchy.length; levelToTrim++) {
                  const levelCells = reactData.menu_hierarchy[levelToTrim] || [];
                  const remainingCells = [];

                  for (const levelCell of levelCells) {
                    if (collapsedIds.has(levelCell.parent)) {
                      collapsedIds.add(levelCell.menu_id);
                    }
                    else {
                      remainingCells.push(levelCell);
                    }
                  }

                  reactData.menu_hierarchy[levelToTrim] = remainingCells;
                }
              }
              else {
                // Reset to first page when opening a menu
                reactData.levelPages = Object.assign({}, reactData.levelPages, { [level_index + 1]: 0 });
                await batchGetMenuItems(this_item.children, level_index + 1, this_item);
              }
            }

            updateReactData({
              menu_hierarchy: reactData.menu_hierarchy,
              level_active_parent: reactData.level_active_parent,
              levelPages: reactData.levelPages
            }, true);
            void persistOpenMenusFromHierarchy(reactData.menu_hierarchy);
          }
          else if (this_item.menu_itemType === 'function') {
            void activityLog(this_item.menu_id, this_item.description?.long);
            if (this_item.activity) {
              const activityDetail = await getActivityDetail({ activity_code: this_item.activity }, state);
              updateReactData({
                renderFunctionCall: {
                  target: 'MultiObservationFormD',
                  params: {
                    fact: { ...activityDetail.activityRec, activity_key: this_item.activity },
                    factName: activityDetail.activityRec?.name || '',
                    options: {
                      listValues: activityDetail.rows,
                      qualifiers: activityDetail.qualifiers
                    },
                    defaults: activityDetail.activityRec?.default_object || {}
                  }
                }
              }, true);
            }
            else {
              updateReactData({
                renderFunctionCall: this_item.call || false
              }, true);
            }
          }
          else if (!isTelLink && (normalizedMenuType === 'live_link' || (useTileUI && hasLinkThumbnail && normalizedMenuType === 'link'))) {
            const frameUrl = buildLiveLinkEmbedUrl(this_item.url);
            if (!frameUrl) {
              updateReactData({
                alert: {
                  severity: 'warning',
                  title: 'Missing URL',
                  message: 'This Live Link does not have a URL configured.'
                }
              }, true);
              return;
            }
            const urlSiblings = (reactData.menu_hierarchy[level_index] || [])
              .filter(cell => {
                const sibItem = cell.menuItemRec;
                if (!sibItem || !sibItem.url) { return false; }
                if (cell.parent !== this_cell.parent) { return false; }
                const sibType = sibItem.menu_type || sibItem.menu_itemType;
                const sibIsTel = String(sibItem.url || '').trim().toLowerCase().startsWith('tel:');
                if (sibIsTel) { return false; }
                const sibCardImageUrl = getLinkThumbnailUrl(sibItem.url, sibItem.icon || sibItem.icon_thumb);
                const sibHasLinkThumbnail = !!(sibCardImageUrl && sibCardImageUrl !== sibItem.icon);
                return (sibType === 'live_link' || (useTileUI && sibHasLinkThumbnail && sibType === 'link'));
              })
              .map(cell => ({
                url: buildLiveLinkEmbedUrl(cell.menuItemRec.url),
                title: cell.menuItemRec.description?.short || cell.menuItemRec.menu_id
              }));
            const currentSiblingIndex = urlSiblings.findIndex(s => s.url === frameUrl);
            updateReactData({
              showLiveLink: true,
              liveLinkUrl: frameUrl,
              liveLinkTitle: this_item.description?.short || this_item.menu_id,
              liveLinkSiblings: urlSiblings,
              liveLinkCurrentIndex: currentSiblingIndex
            }, true);
          }
        }}
        draggable={canDragThisCard}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('application/json', JSON.stringify({
            menu_id: this_cell.menu_id,
            parent_id: this_cell.parent
          }));
        }}
        onDragOver={(event) => {
          if (canDropOnThisCard) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={async (event) => {
          await handleMenuCardDrop(event, this_cell);
        }}
      >
        <CardActionArea className={classes.wholeCard}
          key={`${keyPrefix}cardActionArea_card-${level_index}.${item_index}`}
          style={{
            flexDirection: useTileUI ? 'column' : 'row',
            alignItems: useTileUI ? 'stretch' : 'center',
            minHeight: useTileUI ? undefined : 86,
            height: useTileUI ? 100 : 'auto',
            width: useTileUI ? undefined : '100%',
            minWidth: 0,
            paddingTop: useTileUI ? undefined : 12,
            paddingBottom: useTileUI ? undefined : 12,
            paddingRight: useTileUI ? undefined : 8,
          }}
        >
          {useTileUI && reactData.editFavorites && !isFavoriteCard && normalizedMenuType !== 'menu' &&
            <Box
              display='flex'
              justifyContent='center'
              alignItems='center'
              width='100%'
              style={{ minHeight: 20 }}
            >
              <IconButton
                component='div'
                size='small'
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  await toggleFavoriteMenuItem(this_item.menu_id);
                }}
                style={{
                  color: (isDark(tileColor) ? 'cornsilk' : 'black')
                }}
                title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                {isFavorite ? <FavoriteIcon fontSize='small' /> : <FavoriteBorderIcon fontSize='small' />}
              </IconButton>
            </Box>
          }
          {cardImageUrl && !hideCardImage && (!useTileUI || !reactData.editFavorites) &&
            <Box style={hasLinkThumbnail && useTileUI ? { position: 'relative', width: '100%' } : undefined}>
              <CardMedia
                className={classes.media}
                key={`${keyPrefix}cardMedia_card-${level_index}.${item_index}`}
                image={cardImageUrl}
                title="Menu Media"
                style={hasLinkThumbnail
                  ? (useTileUI
                    ? { height: 100, width: '100%', borderRadius: '30px 30px 30px 30px' }
                    : {
                      width: 64,
                      minWidth: 64,
                      maxWidth: 64,
                      height: 64,
                      minHeight: 64,
                      marginLeft: 18,
                      marginRight: -8,
                      borderRadius: '16px',
                    }
                  )
                  : (useTileUI
                    ? undefined
                    : {
                      width: 64,
                      minWidth: 64,
                      maxWidth: 64,
                      height: 64,
                      minHeight: 64,
                      marginLeft: 18,
                      marginRight: -8,
                      borderRadius: '16px',
                      backgroundSize: '80%',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      backgroundColor: isDark(tileColor) ? 'rgba(255,255,255,0.85)' : undefined,
                    }
                  )
                }
              />
              {hasLinkThumbnail && useTileUI &&
                <Box style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  borderRadius: '0 0 30px 30px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)',
                  padding: '18px 8px 6px 8px',
                }}>
                  <Typography style={{
                    color: 'white',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    lineHeight: 1.2,
                  }}>
                    {this_item.description?.short || this_item.menu_id}
                  </Typography>
                </Box>
              }
            </Box>
          }
          {!(hasLinkThumbnail && !hideCardImage && !reactData.editFavorites) &&
            <CardContent className={classes.cardcontentdetail}
              key={`${keyPrefix}cardContent_card-${level_index}.${item_index}`}
              style={useTileUI
                ? undefined
                : {
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  paddingRight: 12,
                  paddingTop: 4,
                  paddingBottom: 4,
                  flexGrow: 1,
                  minWidth: 0,
                }
              }
            >
              <Box
                display='flex' flexDirection='column'
                alignItems={useTileUI ? 'center' : 'flex-start'} justifyContent={'center'}
                key={`${keyPrefix}cardContentBox-${level_index}.${item_index}`}
              >
                {(() => {
                  const menuLabel = useTileUI
                    ? (this_item.description?.short || this_item.menu_id)
                    : (this_item.description?.long || this_item.description?.short || this_item.menu_id);
                  const labelContent = (
                    <Typography
                      key={`${keyPrefix}cardContentLink-${level_index}.${item_index}`}
                      style={withMenuMobileTextCap(
                        AVATextStyle({ align: useTileUI ? 'center' : 'left', margin: { left: useTileUI ? 0 : (hideCardImage ? 2 : 1) }, size: useTileUI ? 1 : 1.8, bold: true, color: (isDark(tileColor) ? 'cornsilk' : 'black') })
                      )}
                    >
                      {menuLabel}
                    </Typography>
                  );
                  if (normalizedMenuType === 'link') {
                    if (isTelLink) {
                      return (
                        <a href={this_item.url} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <Box display='flex' flexDirection={useTileUI ? 'column' : 'row'} alignItems='center'
                            justifyContent={useTileUI ? 'center' : 'flex-start'}>
                            <PhoneIcon style={{ fontSize: useTileUI ? '2rem' : '1.4rem', marginBottom: useTileUI ? 4 : 0, marginRight: useTileUI ? 0 : 6 }} />
                            {labelContent}
                          </Box>
                        </a>
                      );
                    }
                    return (
                      <a
                        href={this_item.url + (!this_item.url?.includes('?') ? ('?a=' + new Date().getTime()) : '')}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {labelContent}
                      </a>
                    );
                  }
                  else {
                    return <div>{labelContent}</div>;
                  }
                })()}
              </Box>
            </CardContent>
          }
          {!useTileUI && !isMobile && hasChildren &&
            <Box
              display='flex'
              justifyContent='flex-end'
              alignItems='center'
              style={{ minHeight: 20, minWidth: isMobile ? 40 : 72, marginRight: 10 }}
            >
              {isMobile
                ? (accessibleChildrenExpanded
                  ? <VisibilityOffIcon fontSize='small' style={{ color: (isDark(tileColor) ? 'cornsilk' : 'black') }} />
                  : <VisibilityIcon fontSize='small' style={{ color: (isDark(tileColor) ? 'cornsilk' : 'black') }} />)
                : (
                  <Typography
                    style={withMobileTextCap(AVATextStyle({
                      size: 1,
                      bold: true,
                      color: (isDark(tileColor) ? 'cornsilk' : 'black')
                    }), { maxPx: 15, minPx: 12 })}
                  >
                    {accessibleChildrenExpanded ? 'Hide' : 'Show'}
                  </Typography>
                )}
            </Box>
          }
          {canAddFromThisRow && !isMobile &&
            <Box
              display='flex'
              justifyContent='flex-end'
              alignItems='center'
              style={{ minHeight: 20, marginRight: reactData.editFavorites ? 0 : 8 }}
            >
              <IconButton
                component='div'
                size='small'
                aria-label={`add_card_row_${this_item.menu_id}`}
                style={{ color: (isDark(tileColor) ? 'cornsilk' : 'black') }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  updateReactData({
                    addMenuDialog: true,
                    addMenuDialogLevel: level_index + 1,
                    addMenuDialogParent: this_item.menu_id,
                    addMenuDialogType: null,
                    addMenuDialogLinkSource: 'url',
                    addMenuDialogTitle: '',
                    addMenuDialogUrl: '',
                    addMenuDialogUploadFiles: [],
                    addMenuDialogUploadFileIndex: 0,
                    addMenuDialogUploadFileName: '',
                    addMenuDialogUploadProgress: 0,
                    addMenuDialogSaving: false,
                    addMenuDialogTargets: [],
                    addMenuDialogPhone: '',
                    addMenuDialogAvailableTo: makeDefaultAvailableTo(this_item.menu_id),
                    addMenuDialogAccessReviewed: false,
                    addMenuDialogDenyMode: false,
                    showAddMessageTargetSearch: false,
                    selections: [],
                  }, true);
                }}
              >
                <AddCircleOutlineIcon fontSize='small' />
              </IconButton>
            </Box>
          }
          {!useTileUI && reactData.editFavorites && !isFavoriteCard && normalizedMenuType !== 'menu' &&
            <Box
              display='flex'
              justifyContent='flex-end'
              alignItems='center'
              style={{ minHeight: 20, marginRight: 8 }}
            >
              <IconButton
                component='div'
                size='small'
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  await toggleFavoriteMenuItem(this_item.menu_id);
                }}
                style={{
                  color: (isDark(tileColor) ? 'cornsilk' : 'black')
                }}
                title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                {isFavorite ? <FavoriteIcon fontSize='small' /> : <FavoriteBorderIcon fontSize='small' />}
              </IconButton>
            </Box>
          }
        </CardActionArea>
      </Card>
    );

    const wrappedCard = ((['link', 'live_link'].includes(normalizedMenuType)) && this_item.description?.long)
      ? (
        <Tooltip
          key={`${keyPrefix}${level_index}_tooltip${item_index}`}
          title={<Typography variant='caption'>{this_item.description.long}</Typography>}
          placement='top'
          classes={{ tooltip: classes.linkTooltip }}
        >
          <div>{cardTile}</div>
        </Tooltip>
      )
      : cardTile;

    if (!useTileUI) {
      return (
        <React.Fragment key={`${keyPrefix}${level_index}_frag${item_index}`}>
          {wrappedCard}
          {renderAccessibleSubMenu(this_item.menu_id, level_index + 1, accessibleDepth + 1)}
        </React.Fragment>
      );
    }

    return wrappedCard;
  }



  // ******************

  return (
    <React.Fragment>
      <Dialog
        open={true || forceRedisplay}
        p={2}
        classes={{ paper: classes.clientBackground }}
        fullScreen
      >
        <React.Fragment>
          {/* Header with Avatar, Message, and VertMenu */}
          <Box
            display='flex' flexDirection='row'
            className={classes.messageArea}
            key={'topBox'}
          >
            <Box
              display='flex' flexDirection='row'
              flexGrow={1}
              className={classes.profileArea}
              key={'personBox'}
              onClick={async () => {
                if (!state.hasOwnProperty('groups') || !state.groups.hasOwnProperty('adminHierarchy')) {
                  updateReactData({
                    alert: {
                      severity: 'warning',
                      title: 'Still loading Group information',
                      message: `AVA is still loading.  Wait just a moment and try again, please.`
                    }
                  }, true);
                }
                else {
                  pause();
                  updateReactData({
                    groupData: state.groups,
                    showPasswordEdit: false,
                    popupMenuOpen: false,
                    showProfileEdit: true
                  }, true);
                }
              }}
            >
              <Tooltip
                className={classes.avatar}
                title={
                  <Typography variant='caption'>
                    {session?.kiosk_mode ? 'View/Update not available' : `View/Update ${reactData.greetingName}'${reactData.greetingName.slice(-1) === 's' ? '' : 's'} Profile`}
                  </Typography>
                }
                placement='bottom-start'>
                <Avatar src={getImage(state.patient?.person_id)} alt={reactData.greetingName} />
              </Tooltip>
              <Box
                flexGrow={1}
                display='flex'
                overflow='auto'
                flexDirection='column'>
                <Typography
                  style={withMenuMobileTextCap(AVATextStyle({ size: 1.5, margin: { right: 1 }, color: chromeTextColor }))}
                  id='scroll-dialog-title'
                >
                  {`${reactData.greetingWords},`}
                </Typography>
                <Typography
                  style={withMenuMobileTextCap(AVATextStyle({ size: 1.5, margin: { right: 1 }, color: chromeTextColor }))}
                  id='scroll-dialog-title'
                >
                  {`${reactData.greetingName}!`}
                </Typography>
              </Box>
            </Box>
            {/* AVA Logo and Pop-up Menu */}
            <Box
              display='flex'
              overflow='hidden'
              flexDirection='column'
              justifyContent={'center'}
              alignItems={'center'}
            >
              <Tooltip
                className={classes.avatar}
                style={{ marginBottom: '4px' }}
                onClick={(event) => {
                  updateReactData({
                    anchorEl: event.currentTarget,
                    popupMenuOpen: true
                  }, true);
                }}
                title={
                  <Typography variant='caption'>
                    {`Administration Menu`}
                  </Typography>
                }
                placement='bottom-start'>
                <Avatar
                  src={resolvedSessionClientLogo}
                  alt={reactData.greetingName}
                />
              </Tooltip>
              {(isMobile
                ? [makeDate(reactData.current_time, { timeZone: state.session.client_timezone }).timeShort]
                : makeDate(reactData.current_time, { timeZone: state.session.client_timezone }).absolute.split(' at ')
              ).map((tLine, tX) => (
                <Typography
                  key={`time_${tX}`}
                  style={withMenuMobileTextCap(AVATextStyle({ align: 'center', size: 0.8, color: chromeTextColor }))}
                  id='scroll-dialog-title'
                >
                  {tLine}
                </Typography>
              ))}
            </Box>
            <Menu
              id='hidden-menu'
              anchorEl={reactData.anchorEl}
              open={reactData.popupMenuOpen}
              classes={{ paper: classes.clientPopUp }}
              onClose={() => {
                updateReactData({
                  popupMenuOpen: false
                }, true);
              }}
              keepMounted>
              <MenuList className={classes.popUpMenu}>
                {(state.session?.patient_id !== state.session?.user_id) && (
                  <MenuItem onClick={async () => {
                    updateReactData({
                      popupMenuOpen: false
                    }, true);
                    await switchActiveAccount(
                      session,
                      (session.user_homeClient || session.client_id),
                      {
                        id: session.user_id,
                        name: session.user_display_name
                      }
                    );
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'switch2self'}
                    >
                      <HomeIcon />
                      <Typography className={classes.popUpMenuRow} >{`Switch to My Profile (${session.user_id})`}</Typography>
                    </Box>
                  </MenuItem>
                )}
                {(state.session?.patient_id !== state.session?.user_id) && (
                  <MenuItem onClick={async () => {
                    //  let sessionObject = JSON.parse(sessionStorage.getItem('AVASessionData'));
                    updateReactData({
                      popupMenuOpen: false
                    }, true);
                    await switchActiveAccount(
                      session,
                      (state.session?.client_id || state.session?.user_homeClient),
                      {
                        id: state.session?.patient_id,
                        name: reactData.greetingName
                      },
                      { resetUser: true }
                    );
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'switch2self'}
                    >
                      <HomeIcon />
                      <Typography className={classes.popUpMenuRow} >{`Reload as ${state.session?.patient_id}`}</Typography>
                    </Box>
                  </MenuItem>
                )}
                {!state.session?.kiosk_mode && (
                  <MenuItem onClick={async () => {
                    if (!state.hasOwnProperty('groups') || !state.groups.hasOwnProperty('adminHierarchy')) {
                      updateReactData({
                        alert: {
                          severity: 'warning',
                          title: 'Still loading Group information',
                          message: `AVA is still loading.  Wait just a moment and try again, please.`
                        }
                      }, true);
                    }
                    else {
                      pause();
                      updateReactData({
                        groupData: state.groups,
                        showPasswordEdit: true,
                        popupMenuOpen: false,
                        showProfileEdit: true
                      }, true);
                    }
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowSwitch'}
                    >
                      <EditIcon />
                      <Typography className={classes.popUpMenuRow} >
                        {`Manage ${(state.session?.patient_id === state.session?.user_id) ? 'my' : reactData.greetingName + "'" + ((reactData.greetingName.slice(-1) === 's') ? '' : 's')} Password`}
                      </Typography>
                    </Box>
                  </MenuItem>
                )
                }
                {(
                  state.hasOwnProperty('accessList') &&
                  state.accessList.hasOwnProperty('subscription') &&
                  state.accessList.subscription.subscription_active
                )
                  &&
                  <MenuItem onClick={() => {
                    window.open(`https://families.avaseniorliving.com/p/login/9AQ4hT0kI91OcFidQQ`);
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowSwitch'}
                    >
                      <SubscriptionIcon />
                      <Typography className={classes.popUpMenuRow} >{'Manage Subscription'}</Typography>
                    </Box>
                  </MenuItem>
                }
                {proxyAuthority()
                  &&
                  <MenuItem onClick={() => {
                    updateReactData({
                      showPersonSelect: true,
                      popupMenuOpen: false
                    }, true);
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowSwitch'}
                    >
                      <SwapHorizIcon />
                      <Typography className={classes.popUpMenuRow} >{'Switch Account'}</Typography>
                    </Box>
                  </MenuItem>
                }
                {proxyAuthority() && reactData.is_master
                  &&
                  <MenuItem onClick={() => {
                    updateReactData({
                      showClientSelect: true,
                      popupMenuOpen: false
                    }, true);
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowSwitch'}
                    >
                      <SwapHorizIcon />
                      <Typography className={classes.popUpMenuRow} >{'Switch Client'}</Typography>
                    </Box>
                  </MenuItem>
                }
                {createAccountAuthority()
                  &&
                  <MenuItem onClick={async () => {
                    pause();
                    updateReactData({
                      groupData: state.groups,
                      showAddAccount: true,
                      popupMenuOpen: false
                    }, true);
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowCreate'}
                    >
                      <PersonAddIcon />
                      <Typography className={classes.popUpMenuRow} >{'Create Account'}</Typography>
                    </Box>
                  </MenuItem>
                }
                <MenuItem onClick={async () => {
                  pause();
                  updateReactData({
                    showQuickSearch: true,
                    popupMenuOpen: false
                  }, true);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowCreate'}
                  >
                    <SearchIcon />
                    <Typography className={classes.popUpMenuRow} >{'Quick Search'}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem onClick={() => {
                  updateReactData({
                    editFavorites: !reactData.editFavorites,
                    popupMenuOpen: false
                  }, true);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowEditFavorites'}
                  >
                    <EditIcon />
                    <Typography className={classes.popUpMenuRow} >
                      {reactData.editFavorites ? 'Stop Editing Favorites' : 'Edit Favorites'}
                    </Typography>
                  </Box>
                </MenuItem>
                {canToggleUiMode &&
                  <MenuItem onClick={async () => {
                    const nextUseTileUI = !useTileUI;
                    void persistOpenMenusFromHierarchy(reactData.menu_hierarchy);
                    await saveUserUiTilesOverride(nextUseTileUI);
                    updateReactData({
                      uiTilesOverride: nextUseTileUI,
                      editFavorites: !nextUseTileUI,
                      popupMenuOpen: false,
                    }, true);
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowUiMode'}
                    >
                      <SwapHorizIcon />
                      <Typography className={classes.popUpMenuRow} >
                        {useTileUI ? 'Use Accessibility Mode' : 'Use Tile Mode'}
                      </Typography>
                    </Box>
                  </MenuItem>
                }
                {!isPushSupported() &&
                  <MenuItem disabled>
                    <Box display='flex' flexDirection='row' alignItems='center' key={'vRowPushUnsupported'}>
                      <NotificationsOffIcon />
                      <Typography className={classes.popUpMenuRow}>
                        {`Alerts unavailable SW:${'serviceWorker' in navigator ? 1 : 0} PM:${'PushManager' in window ? 1 : 0} N:${'Notification' in window ? 1 : 0} SA:${navigator.standalone ? 1 : 0}`}
                      </Typography>
                    </Box>
                  </MenuItem>
                }
                {isPushSupported() && Notification.permission === 'denied' &&
                  <MenuItem disabled>
                    <Box display='flex' flexDirection='row' alignItems='center' key={'vRowPushDenied'}>
                      <NotificationsOffIcon />
                      <Typography className={classes.popUpMenuRow}>{'Alerts blocked'}</Typography>
                    </Box>
                  </MenuItem>
                }
                {isPushSupported() && Notification.permission !== 'denied' &&
                  <MenuItem onClick={async () => {
                    if (isPushOptedIn(session.user_id)) {
                      await unsubscribeFromPush(session.user_id);
                      // Check if any active subscriptions remain for this person
                      const remaining = await dbClient.query({
                        TableName: 'PushSubscriptions',
                        IndexName: 'person-index',
                        KeyConditionExpression: 'person_id = :pid',
                        FilterExpression: 'sub_status = :active',
                        ExpressionAttributeValues: { ':pid': session.user_id, ':active': 'active' },
                      }).promise().catch(() => ({ Items: [] }));
                      await syncAlertDeliveryMethod(session.user_id, (remaining.Items?.length || 0) > 0);
                      updateReactData({
                        popupMenuOpen: false,
                        alert: { severity: 'info', message: 'Alert messaging has been disabled for your account on this device.' }
                      }, true);
                    } else {
                      const result = await initPushNotifications(session.user_id);
                      if (result.success) {
                        await syncAlertDeliveryMethod(session.user_id, true);
                        updateReactData({
                          popupMenuOpen: false,
                          alert: { severity: 'success', message: 'Alert messaging is now enabled for your account on this device.' }
                        }, true);
                      } else {
                        const message = result.reason === 'storage_error'
                          ? 'Push notification storage needs to be cleared. In Chrome: click the lock icon in the address bar → Site settings → Clear data, then reload AVA and try again. (Or in DevTools: Application → Storage → Clear site data.)'
                          : 'Notifications could not be enabled. Please check your browser settings and try again.';
                        updateReactData({
                          popupMenuOpen: false,
                          alert: { severity: 'warning', message }
                        }, true);
                      }
                    }
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowPushNotify'}
                    >
                      {isPushOptedIn(session.user_id) ? <NotificationsOffIcon /> : <NotificationsActiveIcon />}
                      <Typography className={classes.popUpMenuRow}>
                        {isPushOptedIn(session.user_id) ? 'Disable Alert Notifications' : 'Enable Alert Notifications'}
                      </Typography>
                    </Box>
                  </MenuItem>
                }
                {canInstall &&
                  <MenuItem onClick={() => {
                    updateReactData({ popupMenuOpen: false }, true);
                    if (isIOS) {
                      updateReactData({ showIosInstall: true }, true);
                    } else {
                      onWebInstall();
                    }
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowInstall'}
                    >
                      <GetAppIcon />
                      <Typography className={classes.popUpMenuRow} >{'Install to Home Screen'}</Typography>
                    </Box>
                  </MenuItem>
                }
                <MenuItem onClick={async () => {
                  await accessLog(session.user_id, `*na*`, `Manual sign-out`);
                  removeCookie("AVAuser", { path: '/' });
                  await clearPushSubscriptionFromDB(session.user_id);
                  Auth.signOut().then(() => {
                    let jumpTo = window.location.origin;
                    window.location.replace(`${jumpTo}?client=${state.session.client_id}`);
                  });
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowSignOut'}
                  >
                    <ExitToAppIcon />
                    <Typography className={classes.popUpMenuRow} >{'Sign Out'}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  onClick={async () => {
                    window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
                  }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'restart_menu_option'}
                  >
                    <AutorenewIcon />
                    <Typography className={classes.popUpMenuRow} >{'Restart AVA'}</Typography>
                  </Box>
                </MenuItem>
                {(window.location.href.split('//')[1].slice(0, 1).toUpperCase() !== 'T') &&
                  <MenuItem
                    onClick={async () => {
                      window.location.replace(`https://test.smsoftware.io?rel=${new Date().getTime()}`);
                    }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'use_beta_menu_option'}
                    >
                      <NewReleasesOutlinedIcon />
                      <Typography className={classes.popUpMenuRow} >{'Use Beta Version'}</Typography>
                    </Box>
                  </MenuItem>
                }
                {(window.location.href.split('//')[1].slice(0, 1).toUpperCase() === 'T') &&
                  <MenuItem
                    onClick={async () => {
                      window.location.replace(`https://dev.smsoftware.io?rel=${new Date().getTime()}`);
                    }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'use_public_menu_option'}
                    >
                      <NewReleasesOutlinedIcon />
                      <Typography className={classes.popUpMenuRow} >{'Use Public Version'}</Typography>
                    </Box>
                  </MenuItem>
                }
                <MenuItem>
                  <Box
                    display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                    key={'menu_footer'}
                  >
                    <Typography className={classes.popUpFooter} >{`AVA vers ${reactData.AVA_version} - menu v3`}</Typography>
                    <Typography className={classes.popUpFooter} >{makeExpiration()}
                    </Typography>
                    <Typography className={classes.popUpFooter} >{`User ${state.session?.user_id}${state.session?.patient_id !== state.session?.user_id ? (' (' + state.session?.patient_id + ')') : ''}`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>

          {/* AVA Menu */}
          {reactData.menu_hierarchy && reactData.menu_hierarchy.length > 0 &&
            <Paper
              component={Box} className={classes.clientBackground} variant='outlined' overflow={'auto'}
              style={{ flexGrow: '1' }}
            >
              <Box
                display='flex' flexDirection='column'
                key={'master_menu_column'}
                flexWrap={'wrap'}
                mt={0} mb={2} ml={1} mr={1}
              >
                {reactData.menu_hierarchy.map((this_level, level_index) => {
                  if (!useTileUI && (level_index !== firstVisibleLevelIndex)) {
                    return null;
                  }
                  const level_visible = this_level.some(c => !c.menuItemRec.hidden);
                  const firstVisibleCell = this_level.find(c => !c.menuItemRec.hidden);
                  const levelHasVisibleChildren = reactData.menu_hierarchy[level_index + 1]?.some(c => !c.menuItemRec.hidden);
                  // Also show divider when the next level is empty but will display an add tile
                  const nextLevelParentId = reactData.level_active_parent?.[level_index + 1];
                  const nextLevelParentCell = nextLevelParentId
                    ? reactData.menu_hierarchy.flat().find(c => c.menu_id === nextLevelParentId)
                    : null;
                  const nextLevelIsEmptyAddable = useTileUI && !levelHasVisibleChildren && !!(
                    nextLevelParentCell?.menuItemRec &&
                    Object.prototype.hasOwnProperty.call(nextLevelParentCell.menuItemRec, 'allow_add') &&
                    authorizedToMenuItem(nextLevelParentCell.menuItemRec.allow_add)
                  );
                  const parentMenuId = firstVisibleCell?.parent || reactData.level_active_parent?.[level_index] || reactData.start_at;
                  const parentCell = reactData.menu_hierarchy
                    .flat()
                    .find((candidateCell) => candidateCell.menu_id === parentMenuId);
                  const level_addButton = useTileUI && !!(
                    parentCell?.menuItemRec &&
                    Object.prototype.hasOwnProperty.call(parentCell.menuItemRec, 'allow_add') &&
                    authorizedToMenuItem(parentCell.menuItemRec.allow_add)
                  );
                  const addTile = (useTileUI && level_addButton) ? (
                    <Card
                      key={`addTile_${level_index}`}
                      style={{
                        marginRight: '8px',
                        marginLeft: '8px',
                        borderRadius: '30px 30px 30px 30px',
                        backgroundColor: 'rgba(0, 0, 0, 0.06)',
                        border: '2px dashed rgba(0, 0, 0, 0.25)',
                        marginBottom: 10,
                        cursor: 'pointer',
                        boxShadow: 'none',
                      }}
                      onClick={() => {
                        updateReactData({
                          addMenuDialog: true,
                          addMenuDialogLevel: level_index,
                          addMenuDialogParent: parentMenuId,
                          addMenuDialogType: null,
                          addMenuDialogLinkSource: 'url',
                          addMenuDialogTitle: '',
                          addMenuDialogUrl: '',
                          addMenuDialogUploadFiles: [],
                          addMenuDialogUploadFileIndex: 0,
                          addMenuDialogUploadFileName: '',
                          addMenuDialogUploadProgress: 0,
                          addMenuDialogSaving: false,
                          addMenuDialogTargets: [],
                          addMenuDialogPhone: '',
                          addMenuDialogAvailableTo: makeDefaultAvailableTo(parentMenuId),
                          addMenuDialogAccessReviewed: false,
                          addMenuDialogDenyMode: false,
                          showAddMessageTargetSearch: false,
                          selections: [],
                        }, true);
                      }}
                    >
                      <CardActionArea
                        className={classes.wholeCard}
                        style={{ flexDirection: 'column', alignItems: 'stretch' }}
                      >
                        <Box
                          display='flex'
                          justifyContent='center'
                          alignItems='center'
                          style={{ minHeight: 60, minWidth: 90, padding: 8 }}
                        >
                          <AddCircleOutlineIcon style={{ fontSize: 40, opacity: 0.55 }} />
                        </Box>
                      </CardActionArea>
                    </Card>
                  ) : null;
                  return (
                    (level_visible || levelHasVisibleChildren || (!level_visible && level_addButton)) &&
                    <React.Fragment key={`menuLevelFrag${level_index}`}>
                      {level_visible &&
                        <Box
                          ref={tileContainerRef}  // by rule, this will apply only to the final element actually rendered
                          display='flex'
                          flexDirection='row'
                          alignItems='center'
                          style={{ scrollMarginTop: '60px', paddingTop: (level_index === firstVisibleLevelIndex ? '16px' : null) }}
                          width='100%'
                          key={`menuLevelRow${level_index}`}
                        >
                          <Box
                            display='flex' flexDirection='row'
                            key={`menuLevel${level_index}`}
                            flexWrap={useTileUI ? 'wrap' : 'nowrap'}
                            mt={2} mb={2} ml={1} mr={1}
                            style={{ flexGrow: 1, rowGap: useTileUI ? '10px' : '0px', flexDirection: useTileUI ? 'row' : 'column' }}
                          >
                            {(() => {
                              const activeParent = reactData.level_active_parent?.[level_index];
                              const visibleItems = this_level.filter(c => !c.menuItemRec.hidden && (!useTileUI || !activeParent || c.parent === activeParent));
                              const currentPage = reactData.levelPages?.[level_index] ?? 0;
                              const totalPages = Math.ceil(visibleItems.length / MENU_PAGE_SIZE) || 1;
                              const safePage = Math.min(currentPage, totalPages - 1);
                              const pageStart = safePage * MENU_PAGE_SIZE;
                              const pageItems = visibleItems.slice(pageStart, pageStart + MENU_PAGE_SIZE);
                              const hasPrev = safePage > 0;
                              const hasNext = safePage < totalPages - 1;
                              return (
                                <>
                                  {pageItems.map((this_cell, item_index) =>
                                    renderMenuCardCell(this_cell, level_index, pageStart + item_index)
                                  )}
                                  {(hasPrev || hasNext) && (
                                    <Box
                                      key={`pageNav_level${level_index}`}
                                      display='flex'
                                      alignItems='center'
                                      justifyContent='center'
                                      width='100%'
                                      style={{ marginTop: 10, marginBottom: 4, gap: 8 }}
                                    >
                                      <Button
                                        variant='contained'
                                        size='small'
                                        disabled={!hasPrev}
                                        onClick={() => {
                                          updateReactData({
                                            levelPages: Object.assign({}, reactData.levelPages, { [level_index]: safePage - 1 })
                                          }, true);
                                        }}
                                        style={{
                                          backgroundColor: hasPrev ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.2)',
                                          color: hasPrev ? 'white' : 'rgba(255,255,255,0.4)',
                                          borderRadius: '20px',
                                          textShadow: 'none',
                                          boxShadow: hasPrev ? '0 2px 6px rgba(0,0,0,0.4)' : 'none',
                                          minWidth: 72
                                        }}
                                      >
                                        ‹ Prev
                                      </Button>
                                      <Typography
                                        variant='caption'
                                        style={{
                                          backgroundColor: 'rgba(0,0,0,0.6)',
                                          color: 'white',
                                          borderRadius: '12px',
                                          padding: '2px 10px',
                                          fontWeight: 600
                                        }}
                                      >
                                        {`${safePage + 1} / ${totalPages}`}
                                      </Typography>
                                      <Button
                                        variant='contained'
                                        size='small'
                                        disabled={!hasNext}
                                        onClick={() => {
                                          updateReactData({
                                            levelPages: Object.assign({}, reactData.levelPages, { [level_index]: safePage + 1 })
                                          }, true);
                                        }}
                                        style={{
                                          backgroundColor: hasNext ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.2)',
                                          color: hasNext ? 'white' : 'rgba(255,255,255,0.4)',
                                          borderRadius: '20px',
                                          textShadow: 'none',
                                          boxShadow: hasNext ? '0 2px 6px rgba(0,0,0,0.4)' : 'none',
                                          minWidth: 72
                                        }}
                                      >
                                        Next ›
                                      </Button>
                                    </Box>
                                  )}
                                </>
                              );
                            })()}
                            {addTile}
                          </Box>
                        </Box>
                      }
                      {!level_visible && level_addButton && (
                        <Box
                          ref={tileContainerRef}
                          display='flex'
                          flexDirection='row'
                          alignItems='center'
                          style={{ scrollMarginTop: '60px', paddingTop: (level_index === firstVisibleLevelIndex ? '16px' : null) }}
                          width='100%'
                          key={`menuLevelEmptyAddRow${level_index}`}
                        >
                          <Box
                            display='flex' flexDirection='row'
                            key={`menuLevelEmpty${level_index}`}
                            flexWrap='wrap'
                            mt={2} mb={2} ml={1} mr={1}
                            style={{ flexGrow: 1, rowGap: '10px' }}
                          >
                            {addTile}
                          </Box>
                        </Box>
                      )}
                      {(levelHasVisibleChildren || nextLevelIsEmptyAddable) && (level_index >= firstVisibleLevelIndex) &&
                        <Box
                          key={`menuLevelDivider${level_index}`}
                          width='100%'
                          ml={0} mr={0}
                          my={1}
                          style={{ borderTop: '1px solid rgba(0, 0, 0, 0.2)' }}
                        />
                      }
                    </React.Fragment>
                  );
                })}
              </Box>
            </Paper>
          }

          {/* Message Box */}
          {reactData.menu_hierarchy &&
            <Box
              display='flex' flexDirection='column' justifyContent='center' alignItems='center'
              key={'lowerloadingBoxWrapper'}
              id={'lowerloadingBoxWrapper'}
              ml={2} mr={2} mb={1} mt={1}
            >
              <React.Fragment>
                <Box
                  display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                  flexWrap='wrap' textOverflow='ellipsis' width='100%' overflow={'hidden'}
                  key={'loadingBox'}
                  id={'loadingBox'}
                >
                  {(reactData.loading || !state.hasOwnProperty('groups') || !state.groups.hasOwnProperty('adminHierarchy') || !state.accessList?.[state.session.client_id]) &&
                    <React.Fragment>
                      <Typography style={withMenuMobileTextCap(AVATextStyle({ size: 1.5, align: 'center', color: chromeTextColor }))}  >{`Loading ${reactData.loading ? 'Your Menu' : 'AVA Data'}`}</Typography>
                      <Typography style={AVATextStyle({ size: 0.8, align: 'center', color: chromeTextColor })} >
                        {`AVA version ${reactData.AVA_version}`}
                      </Typography>
                    </React.Fragment>
                  }
                </Box>
                {(reactData.marqueeData?.length > 0) &&
                  <Marquee
                    speed={75}
                  >
                    {reactData.marqueeData.map((marqueeLine, marqueeIndex) => (
                      <Typography
                        key={`marquee_${marqueeIndex}_${reactData.marqueeVersion}`}
                        style={withMenuMobileTextCap(AVATextStyle(Object.assign(
                          { size: 2, margin: { top: 0.6, left: 20, bottom: 1.4 }, bold: true, align: 'center', color: chromeTextColor },
                          marqueeLine.style,
                          isThemeDark ? { color: chromeTextColor } : {}
                        )))} >
                        {marqueeLine.message}
                      </Typography>
                    ))}
                  </Marquee>
                }
              </React.Fragment>
            </Box>
          }

          {reactData.showPersonSelect &&
            <SwitchPatientDialog
              open={reactData.showPersonSelect}
              roles={roles}
              onClose={() => {
                updateReactData({
                  showPersonSelect: false
                }, true);
              }}
            />
          }

          {reactData.showClientSelect &&
            <SwitchPatientDialog
              open={reactData.showClientSelect}
              options={{ mode: 'client' }}
              roles={roles}
              onClose={() => {
                updateReactData({
                  showClientSelect: false
                }, true);
              }}
            />
          }

          {reactData.showProfileEdit &&
            <PeopleMaintenance
              patient={state.patient}
              person_id={state.session.patient_id}
              onClose={() => {
                updateReactData({
                  showProfileEdit: false
                }, true);
              }}
            />
          }

          {reactData.showAddAccount &&
            <React.Fragment>
              {session.new_account_form
                ?
                <QuickAdd
                  open={reactData.showAddAccount}
                  onClose={() => {
                    updateReactData({
                      showAddAccount: false
                    }, true);
                  }}
                />
                :
                <PeopleMaintenance
                  person_id={null}
                  options={{
                    mode: 'add',
                    newPerson: true,
                    sectionToShow: 'ProfileSection'
                  }}
                  initialValues={{
                    peopleRec: {
                      client_id: state.session.client_id,
                      groups: ['ALL', '__top__'],
                      address: {}
                    },
                    sessionRec: {
                      client_id: state.session.client_id
                    }
                  }}
                  onClose={() => {
                    updateReactData({
                      showAddAccount: false
                    }, true);
                  }}
                />
              }
            </React.Fragment>
          }

          {reactData.showQuickSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              onClose={() => {
                updateReactData({
                  showQuickSearch: false
                }, true);
              }}
            />
          }

          {reactData.showAddMessageTargetSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              options={{
                title: 'Select One-tap Message Targets',
                withGroups: true,
                withPreferred: true,
                showAll: true,
                pickAndGo: true,
                keepSelections: true,
                buttonText: {
                  empty: 'Done',
                  selected: 'Use Selected Targets'
                }
              }}
              onClose={(selectedTargets) => {
                const cleanTargets = ([selectedTargets].flat()).filter((targetRec) => {
                  return !!(targetRec && (targetRec.person_id || targetRec.group_id || targetRec.rIndex !== undefined));
                });
                updateReactData({
                  showAddMessageTargetSearch: false,
                  addMenuDialogTargets: cleanTargets,
                  selections: cleanTargets
                }, true);
              }}
            />
          }

          {reactData.showEditMessageTargetSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              options={{
                title: 'Select One-tap Message Targets',
                withGroups: true,
                withPreferred: true,
                showAll: true,
                pickAndGo: true,
                keepSelections: true,
                buttonText: {
                  empty: 'Done',
                  selected: 'Use Selected Targets'
                }
              }}
              onClose={(selectedTargets) => {
                const cleanTargets = ([selectedTargets].flat()).filter((targetRec) => {
                  return !!(targetRec && (targetRec.person_id || targetRec.group_id || targetRec.rIndex !== undefined));
                });
                updateReactData({
                  showEditMessageTargetSearch: false,
                  editDescriptionTargets: cleanTargets,
                  selections: cleanTargets
                }, true);
              }}
            />
          }

          {reactData.showAddAccessToSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              options={{
                title: 'Who Can See This Menu Item?',
                withGroups: true,
                showGroupList: true,
                showAll: true,
                pickAndGo: true,
                keepSelections: true,
                withSpecialValues: true,
                buttonText: {
                  empty: 'Done (no restrictions)',
                  selected: 'Use These'
                }
              }}
              onClose={(selections) => {
                const cleanSelections = ([selections].flat()).filter(s => s && (s.person_id || s.group_id));
                const isDenyMode = !!reactData.addMenuDialogDenyMode;
                const knownStarValues = new Set(['*all', '*admin', '*support']);
                // Keep entries from the opposite side so both allow and deny rules can co-exist.
                const keptRules = (reactData.addMenuDialogAvailableTo || []).filter(r =>
                  isDenyMode
                    ? !r.startsWith('!')  // keep allow-side entries when editing deny side
                    : r.startsWith('!') || (!r.startsWith('group:') && !r.startsWith('person:') && !knownStarValues.has(r))  // keep deny entries + unusual allow entries
                );
                const mappedSelections = cleanSelections.map(s => {
                  let entry;
                  if (s.group_id) { entry = `group:${s.group_id}`; }
                  else if (s.person_id && s.person_id.startsWith('*')) { entry = s.person_id; }
                  else { entry = `person:${s.person_id}`; }
                  return isDenyMode ? `!${entry}` : entry;
                });
                const newAvailableTo = (cleanSelections.length === 0 && !isDenyMode)
                  ? ['*all', ...keptRules]
                  : [...keptRules, ...mappedSelections];
                updateReactData({
                  showAddAccessToSearch: false,
                  addMenuDialogAvailableTo: newAvailableTo,
                  addMenuDialogAccessReviewed: true,
                  selections: cleanSelections,
                }, true);
              }}
            />
          }

          {reactData.showAccessToSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              options={{
                title: 'Who Can See This Menu Item?',
                withGroups: true,
                showGroupList: true,
                showAll: true,
                pickAndGo: true,
                keepSelections: true,
                withSpecialValues: true,
                buttonText: {
                  empty: 'Done (no restrictions)',
                  selected: 'Use These'
                }
              }}
              onClose={(selections) => {
                const cleanSelections = ([selections].flat()).filter(s => s && (s.person_id || s.group_id));
                const isDenyMode = !!reactData.editDescriptionDenyMode;
                const knownStarValues = new Set(['*all', '*admin', '*support']);
                const keptRules = (reactData.editDescriptionAvailableTo || []).filter(r =>
                  isDenyMode
                    ? !r.startsWith('!')
                    : r.startsWith('!') || (!r.startsWith('group:') && !r.startsWith('person:') && !knownStarValues.has(r))
                );
                const mappedSelections = cleanSelections.map(s => {
                  let entry;
                  if (s.group_id) { entry = `group:${s.group_id}`; }
                  else if (s.person_id && s.person_id.startsWith('*')) { entry = s.person_id; }
                  else { entry = `person:${s.person_id}`; }
                  return isDenyMode ? `!${entry}` : entry;
                });
                const newAvailableTo = (cleanSelections.length === 0 && !isDenyMode)
                  ? ['*all', ...keptRules]
                  : [...keptRules, ...mappedSelections];
                updateReactData({
                  showAccessToSearch: false,
                  editDescriptionAvailableTo: newAvailableTo,
                  selections: cleanSelections,
                }, true);
              }}
            />
          }

          {reactData.renderFunctionCall &&
            renderFunction(reactData.renderFunctionCall)
          }

          {reactData.showLiveLink &&
            <Dialog
              open={reactData.showLiveLink}
              onClose={() => {
                updateReactData({
                  showLiveLink: false,
                  liveLinkUrl: '',
                  liveLinkTitle: '',
                  liveLinkSiblings: [],
                  liveLinkCurrentIndex: -1
                }, true);
              }}
              maxWidth={false}
              PaperProps={{
                style: {
                  width: '90vw',
                  maxWidth: '90vw',
                  height: '90vh',
                  maxHeight: '90vh',
                  borderRadius: '20px',
                  overflow: 'hidden'
                }
              }}
            >
              <Box display='flex' flexDirection='column' width='100%' height='100%'>
                <Box display='flex' justifyContent='space-between' alignItems='center' p={1} style={{ minHeight: 52, flexShrink: 0 }}>
                  <Typography style={AVATextStyle({ margin: { left: 1.2 }, size: 1.5, bold: true })}>
                    {reactData.liveLinkTitle || 'Live Link'}
                  </Typography>
                  <Box display='flex' alignItems='center' style={{ gap: 4 }}>
                    {(reactData.liveLinkSiblings?.length > 1) &&
                      <IconButton
                        size='small'
                        disabled={reactData.liveLinkCurrentIndex <= 0}
                        onClick={() => {
                          const newIndex = reactData.liveLinkCurrentIndex - 1;
                          const sibling = reactData.liveLinkSiblings[newIndex];
                          updateReactData({ liveLinkUrl: sibling.url, liveLinkTitle: sibling.title, liveLinkCurrentIndex: newIndex }, true);
                        }}
                      >
                        <NavigateBeforeIcon />
                      </IconButton>
                    }
                    {(reactData.liveLinkSiblings?.length > 1) &&
                      <IconButton
                        size='small'
                        disabled={reactData.liveLinkCurrentIndex >= (reactData.liveLinkSiblings.length - 1)}
                        onClick={() => {
                          const newIndex = reactData.liveLinkCurrentIndex + 1;
                          const sibling = reactData.liveLinkSiblings[newIndex];
                          updateReactData({ liveLinkUrl: sibling.url, liveLinkTitle: sibling.title, liveLinkCurrentIndex: newIndex }, true);
                        }}
                      >
                        <NavigateNextIcon />
                      </IconButton>
                    }
                    <IconButton
                      size='small'
                      title='Download'
                      onClick={async () => {
                        const url = reactData.liveLinkUrl;
                        const fileName = url.split('/').pop().split('?')[0] || 'download';
                        try {
                          const response = await fetch(url);
                          const blob = await response.blob();
                          const objectUrl = URL.createObjectURL(blob);
                          const anchor = document.createElement('a');
                          anchor.href = objectUrl;
                          anchor.download = fileName;
                          anchor.click();
                          URL.revokeObjectURL(objectUrl);
                        } catch {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      <GetAppIcon />
                    </IconButton>
                    <Button
                      className={AVAClass.AVAButton}
                      variant='contained'
                      size='small'
                      onClick={() => {
                        updateReactData({
                          showLiveLink: false,
                          liveLinkUrl: '',
                          liveLinkTitle: '',
                          liveLinkSiblings: [],
                          liveLinkCurrentIndex: -1
                        }, true);
                      }}
                    >
                      {'Close'}
                    </Button>
                  </Box>
                </Box>
                <Box
                  width='100%'
                  display='flex'
                  justifyContent='center'
                  alignItems='center'
                  style={{
                    height: 'calc(100% - 52px)',
                    minHeight: 0,
                    paddingBottom: 24,
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  {/\.(jpe?g|png|gif|webp|svg|bmp)(\?.*)?$/i.test((reactData.liveLinkUrl || '').trim())
                    ? <Box
                      component='img'
                      src={reactData.liveLinkUrl}
                      alt={reactData.liveLinkTitle || ''}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                    : canPlayAsMedia(reactData.liveLinkUrl)
                      ?
                      <ReactPlayer
                        url={reactData.liveLinkUrl}
                        width='100%'
                        height='100%'
                        playing
                        controls
                        muted
                      />
                      :
                      <iframe
                        title={reactData.liveLinkTitle || 'Live Link'}
                        src={reactData.liveLinkUrl}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none'
                        }}
                        allow='autoplay; fullscreen'
                        allowFullScreen
                      />
                  }
                </Box>
              </Box>
            </Dialog>
          }

          {reactData.addMenuDialog &&
            <Dialog
              open={reactData.addMenuDialog}
              onClose={() => {
                if (!reactData.addMenuDialogSaving) {
                  updateReactData({
                    addMenuDialog: false,
                    addMenuDialogLevel: null,
                    addMenuDialogParent: null,
                    addMenuDialogType: null,
                    addMenuDialogLinkSource: 'url',
                    addMenuDialogTitle: '',
                    addMenuDialogUrl: '',
                    addMenuDialogUploadFiles: [],
                    addMenuDialogUploadFileIndex: 0,
                    addMenuDialogUploadFileName: '',
                    addMenuDialogUploadProgress: 0,
                    addMenuDialogSaving: false,
                    addMenuDialogTargets: [],
                    addMenuDialogPhone: '',
                    addMenuDialogAvailableTo: [],
                    addMenuDialogColor: null,
                    addMenuDialogAccessReviewed: false,
                    addMenuDialogDenyMode: false,
                    showAddMessageTargetSearch: false,
                    showAddAccessToSearch: false,
                    selections: [],
                  }, true);
                }
              }}
              maxWidth='sm'
              PaperProps={{
                style: {
                  borderRadius: '30px',
                  borderWidth: 2,
                  borderStyle: 'solid',
                  borderColor: 'black'
                }
              }}
              fullWidth
            >
              <Box p={2}>
                <Typography style={AVATextStyle({ size: 1.2, bold: true, margin: { bottom: 0.5 } })}>
                  {'Add Something New'}
                </Typography>
                <TextField
                  fullWidth
                  margin='dense'
                  label='Title'
                  value={reactData.addMenuDialogTitle}
                  onChange={(e) => {
                    updateReactData({ addMenuDialogTitle: e.target.value }, true);
                  }}
                />
                {reactData.is_support &&
                  <React.Fragment>
                    <Typography style={AVATextStyle({ size: 0.95, margin: { top: 1.5, bottom: 0.25 } })}>
                      {'Type'}
                    </Typography>
                    <RadioGroup
                      row
                      value={reactData.addMenuDialogType || ''}
                      onChange={(e) => {
                        updateReactData({
                          addMenuDialogType: e.target.value,
                          addMenuDialogTargets: (e.target.value === 'message_target') ? reactData.addMenuDialogTargets : [],
                          selections: (e.target.value === 'message_target') ? reactData.selections : [],
                          addMenuDialogPhone: (e.target.value === 'phone_dial') ? (reactData.addMenuDialogPhone || '') : ''
                        }, true);
                      }}
                    >
                      <FormControlLabel value='menu' control={<Radio color='primary' />} label='Sub-Menu' />
                      <FormControlLabel value='link' control={<Radio color='primary' />} label='Document, Video, Picture, or Link' />
                      <FormControlLabel value='message_target' control={<Radio color='primary' />} label='One-tap Message' />
                      <FormControlLabel value='phone_dial' control={<Radio color='primary' />} label='Auto-dial Phone' />
                    </RadioGroup>
                  </React.Fragment>
                }

                {(reactData.addMenuDialogType === 'link' || !reactData.is_support) &&
                  <React.Fragment>
                    <Typography style={AVATextStyle({ size: 0.95, margin: { top: 2, bottom: 0.25 } })}>
                      {`Where can we find the Item you're adding?`}
                    </Typography>
                    <RadioGroup
                      row
                      value={reactData.addMenuDialogLinkSource || 'url'}
                      onChange={(e) => {
                        updateReactData({
                          addMenuDialogLinkSource: e.target.value,
                          addMenuDialogUploadProgress: 0
                        }, true);
                      }}
                    >
                      <FormControlLabel value='url' control={<Radio color='primary' />} label='URL' />
                      <FormControlLabel value='upload' control={<Radio color='primary' />} label='Upload' />
                    </RadioGroup>

                    {(reactData.addMenuDialogLinkSource || 'url') === 'url' &&
                      <TextField
                        fullWidth
                        margin='dense'
                        label='URL'
                        value={reactData.addMenuDialogUrl}
                        onChange={(e) => {
                          updateReactData({ addMenuDialogUrl: e.target.value }, true);
                        }}
                      />
                    }

                    {(reactData.addMenuDialogLinkSource || 'url') === 'upload' &&
                      <Box mt={1}>
                        <input
                          type='file'
                          ref={addMenuUploadInputRef}
                          multiple={true}
                          style={{ display: 'none' }}
                          onChange={(event) => {
                            const newFiles = event.target.files ? Array.from(event.target.files) : [];
                            if (newFiles.length === 0) return;
                            // Reset value so the same file(s) can be picked again if needed
                            event.target.value = '';
                            const existing = reactData.addMenuDialogUploadFiles || [];
                            const remaining = Math.max(0, 50 - existing.length);
                            const updated = [...existing, ...newFiles.slice(0, remaining)];
                            updateReactData({
                              addMenuDialogUploadFiles: updated,
                              addMenuDialogUploadFileIndex: 0,
                              addMenuDialogUploadFileName: updated.length === 1 ? updated[0].name : `${updated.length} files queued`,
                              addMenuDialogUploadProgress: 0
                            }, true);
                          }}
                        />
                        <Box display='flex' alignItems='center' justifyContent='space-between'>
                          <Button
                            className={AVAClass.AVAButton}
                            variant='contained'
                            color='primary'
                            onClick={() => {
                              if (addMenuUploadInputRef.current) {
                                addMenuUploadInputRef.current.click();
                              }
                            }}
                            disabled={reactData.addMenuDialogSaving || (reactData.addMenuDialogUploadFiles || []).length >= 50}
                          >
                            {'Choose File(s) to Upload'}
                          </Button>
                          <Typography style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}>
                            {(reactData.addMenuDialogUploadFiles || []).length === 0
                              ? 'No file selected'
                              : `${(reactData.addMenuDialogUploadFiles || []).length} file${(reactData.addMenuDialogUploadFiles || []).length > 1 ? 's' : ''} queued`}
                          </Typography>
                        </Box>
                        {(reactData.addMenuDialogUploadFiles || []).length > 0 && !reactData.addMenuDialogSaving &&
                          <Box mt={0.5} display='flex' flexDirection='column'>
                            {(reactData.addMenuDialogUploadFiles || []).map((f, fi) => (
                              <Box key={`queued_${fi}`} display='flex' alignItems='center'>
                                <IconButton
                                  size='small'
                                  style={{ padding: 2 }}
                                  onClick={() => {
                                    const updated = (reactData.addMenuDialogUploadFiles || []).filter((_, i) => i !== fi);
                                    updateReactData({
                                      addMenuDialogUploadFiles: updated,
                                      addMenuDialogUploadFileName: updated.length === 0 ? '' : updated.length === 1 ? updated[0].name : `${updated.length} files queued`
                                    }, true);
                                  }}
                                >
                                  <CancelIcon style={{ fontSize: '1rem', opacity: 0.6 }} />
                                </IconButton>
                                <Typography style={AVATextStyle({ size: 0.75, margin: { left: 0.5 } })} noWrap>
                                  {f.name}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        }
                        {(reactData.addMenuDialogSaving || reactData.addMenuDialogUploadProgress > 0) &&
                          <Box mt={1}>
                            <LinearProgress variant='determinate' value={reactData.addMenuDialogUploadProgress || 0} />
                            <Typography style={AVATextStyle({ size: 0.75, margin: { top: 0.3 } })}>
                              {(reactData.addMenuDialogUploadFiles || []).length > 1
                                ? `Uploading file ${(reactData.addMenuDialogUploadFileIndex || 0) + 1} of ${(reactData.addMenuDialogUploadFiles || []).length}: ${reactData.addMenuDialogUploadProgress || 0}%`
                                : `Upload progress: ${reactData.addMenuDialogUploadProgress || 0}%`}
                            </Typography>
                          </Box>
                        }
                      </Box>
                    }
                  </React.Fragment>
                }

                {reactData.addMenuDialogType === 'phone_dial' &&
                  <React.Fragment>
                    <Typography style={AVATextStyle({ size: 0.95, margin: { top: 2, bottom: 0.25 } })}>
                      {'Phone number to dial (10 digits, US only)'}
                    </Typography>
                    <TextField
                      fullWidth
                      margin='dense'
                      label='Phone Number'
                      value={reactData.addMenuDialogPhone || ''}
                      inputProps={{ maxLength: 14 }}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                        updateReactData({ addMenuDialogPhone: digits }, true);
                      }}
                      helperText={(reactData.addMenuDialogPhone || '').length === 10
                        ? `Will dial: +1-${(reactData.addMenuDialogPhone).slice(0, 3)}-${(reactData.addMenuDialogPhone).slice(3, 6)}-${(reactData.addMenuDialogPhone).slice(6)}`
                        : `${(reactData.addMenuDialogPhone || '').length}/10 digits entered`
                      }
                    />
                  </React.Fragment>
                }

                {reactData.addMenuDialogType === 'message_target' &&
                  <React.Fragment>
                    <Typography style={AVATextStyle({ size: 0.95, margin: { top: 2, bottom: 0.25 } })}>
                      {'Who should this one-tap message send to?'}
                    </Typography>
                    <Box display='flex' flexDirection='row' alignItems='center' justifyContent='space-between'>
                      <Button
                        className={AVAClass.AVAButton}
                        variant='contained'
                        color='primary'
                        onClick={() => {
                          updateReactData({
                            showAddMessageTargetSearch: true,
                            selections: deepCopy(reactData.addMenuDialogTargets || [])
                          }, true);
                        }}
                        disabled={reactData.addMenuDialogSaving}
                      >
                        {'Choose People / Groups'}
                      </Button>
                      <Typography style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}>
                        {`${(reactData.addMenuDialogTargets || []).length} target${((reactData.addMenuDialogTargets || []).length === 1) ? '' : 's'} selected`}
                      </Typography>
                    </Box>
                  </React.Fragment>
                }
                <Box display='flex' flexDirection='row' alignItems='center' mt={2} style={{ marginBottom: 4 }}>
                  <Typography style={AVATextStyle({ size: 0.8, margin: { right: 1 } })}>{'Color'}</Typography>
                  <Box style={{
                    width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                    border: '2px solid #bbb',
                    backgroundColor: reactData.addMenuDialogColor || '#f5f5f5',
                    marginRight: 8
                  }} />
                  <input
                    type='text'
                    placeholder='#rrggbb'
                    value={reactData.addMenuDialogColor || ''}
                    onChange={(e) => updateReactData({ addMenuDialogColor: e.target.value || null }, true)}
                    onBlur={(e) => {
                      const normalized = normalizeHexColor(e.target.value);
                      updateReactData({ addMenuDialogColor: normalized }, true);
                    }}
                    disabled={reactData.addMenuDialogSaving}
                    style={{ width: 90, fontSize: '0.82rem', fontFamily: 'monospace', padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}
                  />
                  {!reactData.addMenuDialogColor &&
                    <Typography style={{ marginLeft: 8, fontSize: '0.78rem', color: '#aaa', fontStyle: 'italic' }}>
                      {'Inherited from parent'}
                    </Typography>
                  }
                  {reactData.addMenuDialogColor &&
                    <Button size='small' style={{ marginLeft: 8, minWidth: 0, padding: '2px 6px', fontSize: '0.75rem' }}
                      onClick={() => updateReactData({ addMenuDialogColor: null }, true)}
                      disabled={reactData.addMenuDialogSaving}
                    >
                      {'Clear'}
                    </Button>
                  }
                </Box>
                <Box display='flex' flexDirection='row' alignItems='flex-start' justifyContent='space-between' mt={2}>
                  <Box display='flex' flexDirection='column'>
                    <Typography style={AVATextStyle({ size: 0.8, bold: true })}>{'Who can see this?'}</Typography>
                    <Typography style={AVATextStyle({ size: 0.8 })}>
                      {describeAvailableTo(reactData.addMenuDialogAvailableTo)}
                    </Typography>
                  </Box>
                  <Box display='flex' flexDirection='column' alignItems='flex-end'>
                    <Button
                      className={AVAClass.AVAButton}
                      size='small'
                      style={{ backgroundColor: reactData.addMenuDialogDenyMode ? '#ffcdd2' : '#c8e6c9' }}
                      onClick={() => {
                        const isDenyMode = !!reactData.addMenuDialogDenyMode;
                        const existingSelections = (reactData.addMenuDialogAvailableTo || [])
                          .filter(r => isDenyMode ? r.startsWith('!') : (r.startsWith('group:') || r.startsWith('person:') || r.startsWith('*')))
                          .map(r => {
                            const raw = isDenyMode ? r.slice(1) : r;
                            if (raw.startsWith('group:')) { return { group_id: raw.slice(6) }; }
                            if (raw.startsWith('*')) {
                              const sv = SPECIAL_ACCESS_VALUES.find(s => s.person_id === raw);
                              return { person_id: raw, person_name: sv ? sv.first : raw };
                            }
                            const personId = raw.slice(7);
                            let personName = null;
                            if (personId === state.session.patient_id) {
                              personName = reactData.greetingName || null;
                            } else if (personId === state.session.user_id) {
                              personName = state.session.user_display_name || null;
                            } else if (reactData.accessList) {
                              const found = reactData.accessList.find(p => p.person_id === personId);
                              if (found) { personName = (`${found.first || ''} ${found.last || ''}`).trim() || null; }
                            }
                            return { person_id: personId, ...(personName ? { person_name: personName } : {}) };
                          });
                        updateReactData({
                          showAddAccessToSearch: true,
                          groupInfo: null,
                          linkedPersonFilter: { raw: '', lower: '' },
                          selections: existingSelections,
                          special_values: SPECIAL_ACCESS_VALUES,
                        }, true);
                      }}
                      disabled={reactData.addMenuDialogSaving}
                    >
                      {`${reactData.addMenuDialogAccessReviewed ? 'Change' : 'Set'} ${reactData.addMenuDialogDenyMode ? 'Exclusions' : 'Access'}`}
                    </Button>
                    <FormControlLabel
                      style={{ marginTop: 4 }}
                      control={
                        <Switch
                          size='small'
                          checked={!!reactData.addMenuDialogDenyMode}
                          onChange={(e) => updateReactData({ addMenuDialogDenyMode: e.target.checked }, true)}
                          disabled={reactData.addMenuDialogSaving}
                        />
                      }
                      label={<Typography style={AVATextStyle({ size: 0.75 })}>{reactData.addMenuDialogDenyMode ? 'Deny access' : 'Allow access'}</Typography>}
                    />
                  </Box>
                </Box>
                <Box display='flex' justifyContent='center' mt={2}>
                  <Button
                    className={AVAClass.AVAButton}
                    variant='contained'
                    color='primary'
                    size='small'
                    style={{ marginRight: 12 }}
                    onClick={async () => {
                      await handleAddMenuItem();
                    }}
                    disabled={reactData.addMenuDialogSaving || addDialogNeedsReview(reactData.addMenuDialogAvailableTo)}
                  >
                    {'Add'}
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    variant='contained'
                    size='small'
                    onClick={() => {
                      if (!reactData.addMenuDialogSaving) {
                        updateReactData({
                          addMenuDialog: false,
                          addMenuDialogLevel: null,
                          addMenuDialogParent: null,
                          addMenuDialogType: null,
                          addMenuDialogLinkSource: 'url',
                          addMenuDialogTitle: '',
                          addMenuDialogUrl: '',
                          addMenuDialogUploadFiles: [],
                          addMenuDialogUploadFileIndex: 0,
                          addMenuDialogUploadFileName: '',
                          addMenuDialogUploadProgress: 0,
                          addMenuDialogSaving: false,
                          addMenuDialogTargets: [],
                          addMenuDialogPhone: '',
                          addMenuDialogAvailableTo: [],
                          addMenuDialogColor: null,
                          addMenuDialogAccessReviewed: false,
                          addMenuDialogDenyMode: false,
                          showAddMessageTargetSearch: false,
                          showAddAccessToSearch: false,
                          selections: [],
                        }, true);
                      }
                    }}
                    disabled={reactData.addMenuDialogSaving}
                  >
                    {'Cancel'}
                  </Button>
                </Box>
              </Box>
            </Dialog>
          }

        </React.Fragment >
      </Dialog >

      {
        reactData.alert &&
        <Snackbar
          open={!!reactData.alert}
          autoHideDuration={(reactData.alert.severity === 'success') ? 5000 : ((reactData.alert.severity === 'info') ? 150000 : null)}
          onClose={() => {
            updateReactData({
              alert: false
            }, true);
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
        >
          <Alert
            severity={reactData.alert.severity || 'info'}
            variant='filled'
            style={{
              paddingLeft: '24px',
              paddingRight: '48px',
              borderRadius: '30px',
              borderWidth: 4,
              borderColor: 'black',
              width: 'calc(100vw - 24px)',
              maxWidth: '420px',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
            action={reactData.alert.editMenuItem
              ? (
                <IconButton
                  size='small'
                  aria-label='Edit menu item'
                  style={{ color: 'white' }}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const edit = reactData.alert.editMenuItem;
                    updateReactData({
                      alert: false,
                      editDescriptionDialog: true,
                      editDescriptionMenuId: edit.menu_id,
                      editDescriptionShort: edit.description_short,
                      editDescriptionLong: edit.description_long,
                      editDescriptionAvailableTo: deepCopy(edit.available_to || []),
                      editDescriptionColor: edit.color || null,
                      editDescriptionParent: edit.parent || null,
                      editDescriptionCanDelete: !!edit.can_delete,
                      editDescriptionItemType: edit.item_type || null,
                      editDescriptionTargets: deepCopy(edit.targets || []),
                    }, true);
                  }}
                >
                  <CreateIcon fontSize='small' />
                </IconButton>
              )
              : null}
            onClose={() => {
              updateReactData({
                alert: false
              }, true);
            }}
          >
            {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
            <div style={{ maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {reactData.alert.message}
            </div>
          </Alert>
        </Snackbar>
      }

      {
        reactData.notification &&
        <Dialog
          open={!!reactData.notification}
          onClose={(_event, reason) => {
            if (reason === 'escapeKeyDown') {
              dismissNotification();
            }
          }}
          fullWidth
          maxWidth='sm'
          PaperProps={{
            style: {
              borderRadius: '30px',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.25)',
              maxHeight: '85vh',
              overflow: 'hidden',
              width: 'min(92vw, 560px)'
            }
          }}
          BackdropProps={{
            style: {
              backgroundColor: 'rgba(0, 0, 0, 0.35)'
            }
          }}
        >
          <DialogTitle style={{
            padding: '16px 20px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.12)',
            fontSize: '1.1rem',
            fontWeight: 600,
            backgroundColor: reactData.notification.severity === 'error'
              ? '#fdecea'
              : reactData.notification.severity === 'warning'
                ? '#fff8e1'
                : null
          }}>
            {reactData.notification.title || 'Notification'}
          </DialogTitle>
          <DialogContent dividers style={{
            padding: '64px 20px',
            maxHeight: '60vh',
            minHeight: '40vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            <div style={{
              ...withMenuMobileTextCap(AVATextStyle({ size: 1, align: 'center' })),
              width: '100%',
              maxWidth: '100%',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5
            }}>
              {renderNotificationMessage(reactData.notification.message)}
            </div>
          </DialogContent>
          <DialogActions style={{ padding: '12px 16px 16px', justifyContent: 'flex-end' }}>
            {reactData.notification.action_url &&
              <Button
                className={AVAClass.AVAButton}
                color='primary'
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  window.open(reactData.notification.action_url, '_blank');
                  dismissNotification();
                }}
              >
                Open
              </Button>
            }
            <Button
              className={AVAClass.AVAButton}
              variant='contained'
              color='secondary'
              onClick={dismissNotification}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      }

      {reactData.deleteMenuConfirm &&
        <AVAConfirm
          promptText={[
            `[bold][color:red]Delete ${reactData.deleteMenuTarget?.label || 'this menu item'}?`,
            'This action permanently removes the selected menu item.',
            'You can only delete menu items that do not currently have children.'
          ]}
          cancelText='Cancel'
          confirmText='Delete'
          onCancel={() => {
            updateReactData({
              deleteMenuConfirm: false,
              deleteMenuTarget: null
            }, true);
          }}
          onConfirm={async () => {
            await handleDeleteMenuItem(reactData.deleteMenuTarget);
          }}
          options={{
            bgColor: 'white'
          }}
        />
      }
      {reactData.editDescriptionDialog &&
        <Dialog
          open={reactData.editDescriptionDialog}
          onClose={() => updateReactData({ editDescriptionDialog: false, editDescriptionDenyMode: false, editDescriptionColor: null, editDescriptionItemType: null, editDescriptionTargets: [] }, true)}
          classes={{ paper: classes.clientPopUp }}
          fullWidth
        >
          <Box p={3} display='flex' flexDirection='column'>
            {/* Title row: "Edit Menu Item" + optional trash-can delete button */}
            <Box display='flex' alignItems='center' justifyContent='space-between' style={{ marginBottom: 16 }}>
              <Typography variant='h6'>Edit Menu Item</Typography>
              {reactData.editDescriptionCanDelete &&
                <IconButton
                  size='small'
                  style={{ color: '#c62828' }}
                  title='Delete this item'
                  onClick={() => {
                    updateReactData({
                      editDescriptionDialog: false,
                      deleteMenuConfirm: true,
                      deleteMenuTarget: {
                        menu_id: reactData.editDescriptionMenuId,
                        parent_id: reactData.editDescriptionParent,
                        label: reactData.editDescriptionShort || reactData.editDescriptionMenuId
                      }
                    }, true);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              }
            </Box>
            <TextField
              label='Short description'
              value={reactData.editDescriptionShort}
              onChange={(e) => updateReactData({ editDescriptionShort: e.target.value }, true)}
              variant='outlined'
              fullWidth
              style={{ marginBottom: 16 }}
            />
            <TextField
              label='Long description'
              value={reactData.editDescriptionLong}
              onChange={(e) => updateReactData({ editDescriptionLong: e.target.value }, true)}
              variant='outlined'
              fullWidth
              multiline
              rows={3}
              style={{ marginBottom: 24 }}
            />
            <Box display='flex' alignItems='center' style={{ marginBottom: 16 }}>
              <Typography variant='caption' style={{ color: 'gray', marginRight: 12, whiteSpace: 'nowrap' }}>{'Color'}</Typography>
              <Box style={{
                width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                border: '2px solid #bbb',
                backgroundColor: reactData.editDescriptionColor || '#f5f5f5',
                marginRight: 8
              }} />
              <input
                type='text'
                placeholder='#rrggbb'
                value={reactData.editDescriptionColor || ''}
                onChange={(e) => updateReactData({ editDescriptionColor: e.target.value || null }, true)}
                onBlur={(e) => {
                  const normalized = normalizeHexColor(e.target.value);
                  updateReactData({ editDescriptionColor: normalized }, true);
                }}
                style={{ width: 90, fontSize: '0.82rem', fontFamily: 'monospace', padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}
              />
              {!reactData.editDescriptionColor &&
                <Typography style={{ marginLeft: 8, fontSize: '0.78rem', color: '#aaa', fontStyle: 'italic' }}>
                  {'Inherited from parent'}
                </Typography>
              }
              {reactData.editDescriptionColor &&
                <Button size='small' style={{ marginLeft: 8, minWidth: 0, padding: '2px 6px', fontSize: '0.75rem' }}
                  onClick={() => updateReactData({ editDescriptionColor: null }, true)}
                >
                  {'Clear'}
                </Button>
              }
            </Box>
            <Box display='flex' alignItems='flex-start' justifyContent='space-between' style={{ marginBottom: 16 }}>
              <Box display='flex' flexDirection='column'>
                <Typography variant='caption' style={{ color: 'gray' }}>{'Who can see this item'}</Typography>
                <Typography variant='body2'>
                  {describeAvailableTo(reactData.editDescriptionAvailableTo)}
                </Typography>
              </Box>
              <Box display='flex' flexDirection='column' alignItems='flex-end'>
                <Button
                  className={AVAClass.AVAButton}
                  style={{ marginLeft: 8, backgroundColor: reactData.editDescriptionDenyMode ? '#ffcdd2' : '#c8e6c9' }}
                  size='small'
                  onClick={() => {
                    const isDenyMode = !!reactData.editDescriptionDenyMode;
                    const existingSelections = (reactData.editDescriptionAvailableTo || [])
                      .filter(r => isDenyMode ? r.startsWith('!') : (r.startsWith('group:') || r.startsWith('person:') || r.startsWith('*')))
                      .map(r => {
                        const raw = isDenyMode ? r.slice(1) : r;
                        if (raw.startsWith('group:')) { return { group_id: raw.slice(6) }; }
                        if (raw.startsWith('*')) {
                          const sv = SPECIAL_ACCESS_VALUES.find(s => s.person_id === raw);
                          return { person_id: raw, person_name: sv ? sv.first : raw };
                        }
                        return { person_id: raw.slice(7) };
                      });
                    updateReactData({
                      showAccessToSearch: true,
                      groupInfo: null,
                      linkedPersonFilter: { raw: '', lower: '' },
                      selections: existingSelections,
                      special_values: SPECIAL_ACCESS_VALUES,
                    }, true);
                  }}
                >
                  {reactData.editDescriptionDenyMode ? 'Edit Exclusions' : 'Edit Access'}
                </Button>
                <FormControlLabel
                  style={{ marginTop: 4 }}
                  control={
                    <Switch
                      size='small'
                      checked={!!reactData.editDescriptionDenyMode}
                      onChange={(e) => updateReactData({ editDescriptionDenyMode: e.target.checked }, true)}
                    />
                  }
                  label={<Typography variant='caption'>{reactData.editDescriptionDenyMode ? 'Deny access' : 'Allow access'}</Typography>}
                />
              </Box>
            </Box>
            {reactData.editDescriptionItemType === 'message_target' &&
              <Box display='flex' alignItems='center' justifyContent='space-between' style={{ marginBottom: 16 }}>
                <Box display='flex' flexDirection='column'>
                  <Typography variant='caption' style={{ color: 'gray' }}>{'Message recipients'}</Typography>
                  <Typography variant='body2'>
                    {`${(reactData.editDescriptionTargets || []).length} target${(reactData.editDescriptionTargets || []).length === 1 ? '' : 's'} selected`}
                  </Typography>
                </Box>
                <Button
                  className={AVAClass.AVAButton}
                  style={{ marginLeft: 8 }}
                  size='small'
                  onClick={() => {
                    updateReactData({
                      showEditMessageTargetSearch: true,
                      selections: deepCopy(reactData.editDescriptionTargets || [])
                    }, true);
                  }}
                >
                  {'Edit Recipients'}
                </Button>
              </Box>
            }
            {/* Bottom row: Move to End + Cancel (left), Save (right) */}
            <Box display='flex' justifyContent='space-between' alignItems='center'>
              <Box display='flex' style={{ gap: 8 }}>
                {reactData.editDescriptionParent &&
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: '#1565c0', color: 'white' }}
                    size='small'
                    startIcon={<LastPageIcon />}
                    onClick={async () => {
                      const parentId = reactData.editDescriptionParent;
                      const menuId = reactData.editDescriptionMenuId;
                      const parentRec = await dbClient
                        .get({ TableName: 'MenuV3', Key: { client_id: state.session.client_id, menu_id: parentId } })
                        .promise().catch(() => null);
                      if (recordExists(parentRec)) {
                        const children = [...new Set([parentRec.Item.children || []].flat())];
                        const reordered = [...children.filter(id => id !== menuId), menuId];
                        await saveParentChildrenList(parentId, reordered);
                        // Reorder sibling cells in local hierarchy to match the new children order
                        const updatedHierarchy = reactData.menu_hierarchy.map(level => {
                          if (!level) { return level; }
                          const hasSiblings = level.some(cell => cell.parent === parentId);
                          if (!hasSiblings) { return [...level]; }
                          const siblings = level.filter(cell => cell.parent === parentId);
                          const others = level.filter(cell => cell.parent !== parentId);
                          const reorderedSiblings = reordered
                            .map(id => siblings.find(cell => cell.menu_id === id))
                            .filter(Boolean);
                          // preserve any siblings not in the reordered list (shouldn't happen, but safe)
                          const extra = siblings.filter(cell => !reordered.includes(cell.menu_id));
                          return [...others, ...reorderedSiblings, ...extra];
                        });
                        updateReactData({
                          editDescriptionDialog: false,
                          editDescriptionColor: null,
                          menu_hierarchy: updatedHierarchy,
                          alert: { severity: 'success', title: 'Moved', message: `"${reactData.editDescriptionShort || menuId}" moved to end.` }
                        }, true);
                      }
                    }}
                  >
                    Move to End
                  </Button>
                }
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'red', color: 'white' }}
                  size='small'
                  onClick={() => updateReactData({ editDescriptionDialog: false, editDescriptionDenyMode: false, editDescriptionColor: null, editDescriptionItemType: null, editDescriptionTargets: [] }, true)}
                >
                  Cancel
                </Button>
              </Box>
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'green', color: 'white' }}
                size='small'
                onClick={handleSaveDescription}
              >
                Save
              </Button>
            </Box>
          </Box>
        </Dialog>
      }
      {reactData.showIosInstall &&
        <IosInstall
          open={reactData.showIosInstall}
          onClose={() => updateReactData({ showIosInstall: false }, true)}
        />
      }
    </React.Fragment >
  );
};