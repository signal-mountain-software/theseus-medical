import React from 'react';
import { Auth } from '@aws-amplify/auth';
import { recordExists, cl, switchActiveAccount, dbClient, lambda, getMarqueeMessage, deepCopy } from '../../util/AVAUtilities';
import { makeDate, makeTime } from '../../util/AVADateTime';
import { getImage } from '../../util/AVAPeople';
import { AVATextStyle, AVAclasses, AVADefaults, hexToRgb, isDark } from '../../util/AVAStyles';
import QuickAdd from './QuickAdd';

import Card from '@material-ui/core/Card';
import CardActionArea from '@material-ui/core/CardActionArea';
import CardContent from '@material-ui/core/CardContent';
import CardMedia from '@material-ui/core/CardMedia';

import { Snackbar } from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';

import makeStyles from '@material-ui/core/styles/makeStyles';
// import useMediaQuery from '@material-ui/core/useMediaQuery';
import Marquee from "react-fast-marquee";

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
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import IconButton from '@material-ui/core/IconButton';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import LinearProgress from '@material-ui/core/LinearProgress';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import EditIcon from '@material-ui/icons/PersonOutlineOutlined';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import SubscriptionIcon from '@material-ui/icons/CardMembership';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import NewReleasesOutlinedIcon from '@material-ui/icons/NewReleasesOutlined';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import SearchIcon from '@material-ui/icons/Search';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import FavoriteIcon from '@material-ui/icons/Favorite';
import FavoriteBorderIcon from '@material-ui/icons/FavoriteBorder';

import Tooltip from '@material-ui/core/Tooltip';
import QuickSearch from './QuickSearch';

/***** NEW V3 CODE ****/

import { stringToColor, s3 } from '../../util/AVAUtilities';
import FormManagement from '../dialogs/FormManagement';
import ClientMaintenance from '../dialogs/ClientMaintenance';
import MessageForm from '../forms/MessageForm';
import ShowGroup from '../dialogs/ShowGroup';
import ShowCalendar from '../dialogs/ShowCalendar';
import AVAConfirm from '../forms/AVAConfirm';
import LoadSpreadsheet from '../forms/LoadSpreadsheet';

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

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();
  const { roles, session } = state;
  const clientUseTileUI = (state.session?.client_style?.ui_tiles === true);
  const canToggleUiMode = !clientUseTileUI;

  const [, , removeCookie] = useCookies(['AVAuser']);

  const [reactData, setReactData] = React.useState({
    /**** NEW V3 CODE ****/
    menu_hierarchy: [],
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
    popupMenuOpen: false,
    showProfileEdit: false,
    showAddAccount: false,
    showQuickSearch: false,
    editFavorites: false,
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
    addMenuDialogUploadFile: null,
    addMenuDialogUploadFileName: '',
    addMenuDialogUploadProgress: 0,
    addMenuDialogSaving: false,
    addMenuDialogTargets: [],
    deleteMenuConfirm: false,
    deleteMenuTarget: null,
    showAddMessageTargetSearch: false,
    uiTilesOverrideLoaded: false,
    uiTilesOverride: null,
    alert: false,
    testMode: ["T", "L"].includes(window.location.href.split('//')[1].slice(0, 1).toUpperCase())
  });

  const useTileUI = ((reactData.uiTilesOverride === null) || (reactData.uiTilesOverride === undefined))
    ? clientUseTileUI
    : !!reactData.uiTilesOverride;

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

  const addMenuUploadInputRef = React.useRef(null);
  const activePersonId = state.session?.patient_id || state.session?.person_id;

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
      return [];
    }
    if (includeLoadingState) {
      updateReactData({
        loading: 'Building your AVA menu'
      }, true);
    }
    reactData.menu_hierarchy = [];
    const new_menuHierarchy = await getMenuItem(reactData.start_at, 0);
    let reactUpd = {
      menu_hierarchy: new_menuHierarchy,
      loading: false
    };
    const favoriteList = normalizeFavorites(state.patient?.v3_favorites || []);
    if (favoriteList && favoriteList.length > 0) {
      const menuWithFavorites = applyFavoritesCardToHierarchy(new_menuHierarchy, favoriteList);
      reactUpd.menu_hierarchy = menuWithFavorites;
      reactUpd.v3_favorites = favoriteList;
    }

    const persistedOpenMenuIds = await loadPersistedOpenMenuIds();
    if (persistedOpenMenuIds.length > 0) {
      reactUpd.menu_hierarchy = await applyPersistedOpenMenuIds(reactUpd.menu_hierarchy, persistedOpenMenuIds);
    }

    updateReactData(reactUpd, true);
    return reactUpd.menu_hierarchy || [];
  };

  const onIdle = async () => {
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
    updateReactData({
      marqueeData: marqueeData,
      marqueeVersion: reactData.marqueeVersion++
    }, false);
  };

  async function onAction() {
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

  let nowTime = new Date().getTime();

  /**** NEW V3 CODE ****/

  const authorizedToMenuItem = (available_to) => {
    if (!available_to || available_to.length === 0) { return true; }
    for (let this_rule of available_to) {
      switch (this_rule.split(':')[0]) {
        case '*all': return true;
        case '*admin': { if (reactData.is_admin) { return true; } break; }
        case '*support': { if (reactData.is_support) { return true; } break; }
        case 'group': {
          const check_group = this_rule.split(':')[1];
          if ((state.groups?.belongsTo
            && state.groups.belongsTo.hasOwnProperty(check_group)
            && state.groups.belongsTo[check_group].belongs_to === true
          ) || state.patient.groups.includes(check_group)) { return true; } break;
        }
        case 'person': { if (state.session?.person_id === this_rule.split(':')[1]) { return true; } break; }
        default: { }
      }
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
      const this_item = menuItemRec.Item;
      if (!this_item.available_to || authorizedToMenuItem(this_item.available_to)) {
        if (!reactData.menu_hierarchy[menu_level]) { reactData.menu_hierarchy[menu_level] = []; }
        if (!this_item.color) {
          // if I have a parent, use their color.  If not, use the client default color.  If that's not set, use gray
          if (parent && !parent.hidden) { this_item.color = parent.color; }
          else { this_item.color = stringToColor(this_item.menu_id); }
        }
        if (state.session.client_style?.suppress_card_image) { this_item.icon = null; }
        else if (!this_item.icon) { this_item.icon = state.session.client_logo; }
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
        if (this_item.hidden && this_item.menu_itemType === 'menu') {  // hidden menu item? process childen immediately
          for (const childItem of this_item.children) {
            await getMenuItem(childItem, menu_level + 1, this_item);
          }
        }
        else if (this_item.menu_itemType === 'function' && itemCode === reactData.start_at) {
          void activityLog(this_item.menu_id, `Auto-run on load: ${this_item.description?.long}`);
          renderFunction(this_item.call_instructions);
        }
      }
    }
    return reactData.menu_hierarchy;
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

  const applyFavoritesCardToHierarchy = (menuHierarchy, favoriteList) => {
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
      newHierarchy[1].unshift({
        menu_id: '__v3_favorites__',
        parent: '__top__',
        menuItemRec: {
          menu_id: '__v3_favorites__',
          description: {
            short: 'Favorites',
            long: 'Your Favorites'
          },
          menu_itemType: 'menu',
          children: normalizedFavorites,
          color: stringToColor('__v3_favorites__'),
          icon: state.session?.client_logo
        }
      });
    }

    return newHierarchy;
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
    const refreshedWithFavorites = applyFavoritesCardToHierarchy(refreshedHierarchy, nextFavorites);
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
    const nextHierarchy = applyFavoritesCardToHierarchy(reactData.menu_hierarchy, nextFavorites);

    updateReactData({
      v3_favorites: nextFavorites,
      menu_hierarchy: nextHierarchy
    }, true);

    try {
      await saveFavorites(nextFavorites);
    }
    catch (error) {
      cl({ 'Error writing v3_favorites': error });
      const rollbackHierarchy = applyFavoritesCardToHierarchy(reactData.menu_hierarchy, currentFavorites);
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
        const userUiTilesOverride = await loadUserUiTilesOverride();
        updateReactData({
          greetingName: tempName || 'AVA User',
          greetingWords: makeGreeting(),
          uiTilesOverrideLoaded: true,
          uiTilesOverride: userUiTilesOverride
        }, true);
        await updateMarquee();
      }
    }
    initialize();
    return () => { };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!reactData.uiTilesOverrideLoaded) {
      return;
    }
    rebuildMenuHierarchy({ includeLoadingState: true });
  }, [reactData.uiTilesOverrideLoaded, reactData.uiTilesOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderSectionRegistry = {
    ClientMaintenance,
    FormManagement,
    MessageForm,
    ShowGroup,
    ShowCalendar,
    LoadSpreadsheet,
    PeopleMaintenance,
    SwitchPatientDialog,
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

    const props = replaceTokens(call_instructions.params || {});
    return (
      <SectionToRender
        client={state.session.client_id}
        client_id={state.session.client_id}
        person_id={state.session.person_id}
        pPerson={state.session.patient_id}
        pClient={state.session.client_id}
        pSession={state.session}
        personRec={state.patient}
        pMessageList={[]}
        defaults={props.defaults || {}}
        options={props.options || {}}
        patient={state.session}
        OGpatient={reactData.OGpatient}
        peopleList={props.options?.OGvaluesList}
        defaultObject={props.defaults || []}
        eventClient={props.options?.client_id || state.session.client_id}
        calendarMode={props.options?.mode || 'signUp'}
        onReset={() => {
          start();
          updateReactData({
            renderFunctionCall: false
          }, true);
        }}
        onAbort={() => {
          start();
          updateReactData({
            renderFunctionCall: false
          }, true);
        }}
        onClose={() => {
          start();
          updateReactData({
            renderFunctionCall: false
          }, true);
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
    const itemType = reactData.addMenuDialogType;
    const linkSource = reactData.addMenuDialogLinkSource || 'url';
    const urlText = (reactData.addMenuDialogUrl || '').trim();
    const uploadFile = reactData.addMenuDialogUploadFile;
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

    if ((itemType === 'link') && (linkSource === 'upload') && !uploadFile) {
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
          message: 'Choose one or more people or groups for this Message Target.'
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

    let finalLinkUrl = urlText;
    if ((itemType === 'link') && (linkSource === 'upload')) {
      try {
        const uploadResponse = await uploadMenuLinkFile(uploadFile);
        finalLinkUrl = uploadResponse?.Location || '';
      }
      catch (error) {
        cl({ 'Error uploading menu link file': error });
        updateReactData({
          addMenuDialogSaving: false,
          addMenuDialogUploadProgress: 0,
          alert: {
            severity: 'error',
            title: 'Upload failed',
            message: `Unable to upload ${uploadFile?.name || 'selected file'} to bucket ${uploadFile?.bucketName}.`
          }
        }, true);
        return;
      }
      if (!finalLinkUrl) {
        updateReactData({
          addMenuDialogSaving: false,
          addMenuDialogUploadProgress: 0,
          alert: {
            severity: 'error',
            title: 'Upload failed',
            message: 'Upload did not return a URL for this file.'
          }
        }, true);
        return;
      }
    }

    const newMenuId = await deriveUniqueMenuId(titleText);
    const newMenuItemType = (itemType === 'message_target') ? 'function' : itemType;
    const newMenuRec = {
      client_id: state.session.client_id,
      menu_id: newMenuId,
      available_to: [...(parentRec.Item.available_to || [])],
      description: {
        long: titleText,
        short: titleText,
      },
      menu_itemType: newMenuItemType,
    };

    if (parentRec.Item.hasOwnProperty('newItem_availableTo')) {
      newMenuRec.available_to = [];
      parentRec.Item.newItem_availableTo.forEach(p => {
        if (p === '*match') {
          state.patient.groups.forEach(g => {
            if (g !== 'ALL' && !g.includes('__')) {
              newMenuRec.available_to.push(`group:${g}`);
            }
          });
        }
        else { newMenuRec.available_to.push(p); }
      });
    }

    if (itemType === 'link') {
      newMenuRec.url = finalLinkUrl;
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
      newMenuRec.call_instructions = callObj;
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
      updatedChildren.push(newMenuId);
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
      ...updatedMenuHierarchy[targetLevel],
      {
        menu_id: newMenuId,
        menuItemRec: newMenuRec,
        parent: reactData.addMenuDialogParent
      }
    ];

    updateReactData({
      addMenuDialog: false,
      addMenuDialogLevel: null,
      addMenuDialogParent: null,
      addMenuDialogType: null,
      addMenuDialogLinkSource: 'url',
      addMenuDialogTitle: '',
      addMenuDialogUrl: '',
      addMenuDialogUploadFile: null,
      addMenuDialogUploadFileName: '',
      addMenuDialogUploadProgress: 0,
      addMenuDialogSaving: false,
      addMenuDialogTargets: [],
      showAddMessageTargetSearch: false,
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
    let cognito_expires = JSON.parse(sessionStorage.getItem('cognito_expires'));
    let sTime = new Date(cognito_expires ? (cognito_expires * 1000) : (nowTime + oneHour));
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
        mt={1}
        mb={1}
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
    const hideCardImage = (!useTileUI) && (accessibleDepth > 0);
    const parentColor = (level_index > 0)
      ? reactData.menu_hierarchy[level_index - 1]?.find((parentCell) => parentCell.menu_id === this_cell.parent)?.menuItemRec?.color
      : null;
    const tileColor = this_item.color || parentColor || stringToColor(this_item.menu_id);
    const cardTile = (
      <Card className={classes.root}
        key={`${keyPrefix}${level_index}_card${item_index}`}
        style={{
          marginRight: useTileUI ? '8px' : '6px',
          marginLeft: useTileUI ? '8px' : '6px',
          borderRadius: ('30px 30px 30px 30px'),
          backgroundColor: hexToRgb(tileColor, 1),
          textDecoration: 'none',
          position: 'relative',
          width: useTileUI ? undefined : 'calc(100% - 12px)',
          maxWidth: useTileUI ? undefined : 'calc(100% - 12px)',
          minWidth: useTileUI ? undefined : 'calc(100% - 12px)',
          minHeight: useTileUI ? undefined : 86,
          maxHeight: useTileUI ? undefined : 'none',
          marginBottom: useTileUI ? 10 : 10,
        }}
        onContextMenu={async (e) => {
          e.preventDefault();
          updateReactData({
            alert: {
              severity: 'info',
              title: this_item.description?.short,
              message: <div>
                ID: {this_item.menu_id}<br />
                Type: {this_item.menu_itemType}{this_item.url && <><br />URL: {this_item.url}</>}<br />
                Security: {this_item.available_to.join(', ')}<br />
                Location: Level {level_index} / Item {item_index}<br />
                {canDeleteThisCard &&
                  <Box mt={1.5}>
                    <Button
                      size='small'
                      variant='contained'
                      color='secondary'
                      className={AVAClass.AVAButton}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        updateReactData({
                          alert: false,
                          deleteMenuConfirm: true,
                          deleteMenuTarget: {
                            menu_id: this_item.menu_id,
                            parent_id: this_cell.parent,
                            label: this_item.description?.short || this_item.menu_id
                          }
                        }, true);
                      }}
                    >
                      {'Delete Menu Item'}
                    </Button>
                  </Box>
                }
              </div>
            }
          }, true);
        }}
        onClick={async () => {
          if (this_item.menu_itemType === 'menu') {
            if (useTileUI) {
              for (let levelToClear = level_index + 1; levelToClear < reactData.menu_hierarchy.length; levelToClear++) {
                reactData.menu_hierarchy[levelToClear] = [];
              }

              for (let this_child of this_item.children) {
                await getMenuItem(this_child, level_index + 1, this_item);
              }
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
                for (let this_child of this_item.children) {
                  await getMenuItem(this_child, level_index + 1, this_item);
                }
              }
            }

            updateReactData({
              menu_hierarchy: reactData.menu_hierarchy
            }, true);
            void persistOpenMenusFromHierarchy(reactData.menu_hierarchy);
          }
          else if (this_item.menu_itemType === 'function') {
            void activityLog(this_item.menu_id, this_item.description?.long);
            updateReactData({
              renderFunctionCall: this_item.call || false
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
          }}
        >
          {useTileUI && reactData.editFavorites && !isFavoriteCard &&
            <Box
              display='flex'
              justifyContent='center'
              alignItems='center'
              width='100%'
              style={{ minHeight: 20 }}
            >
              <IconButton
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
          {this_item.icon && menuItemType !== 'link' && !reactData.editFavorites && !hideCardImage &&
            <CardMedia
              className={classes.media}
              key={`${keyPrefix}cardMedia_card-${level_index}.${item_index}`}
              image={this_item.icon}
              title="Menu Media"
              style={useTileUI
                ? undefined
                : {
                  width: 64,
                  minWidth: 64,
                  maxWidth: 64,
                  height: 64,
                  minHeight: 64,
                  marginLeft: 10,
                  marginRight: 8,
                  borderRadius: '16px'
                }
              }
            />
          }
          <CardContent className={classes.cardcontentdetail}
            key={`${keyPrefix}cardContent_card-${level_index}.${item_index}`}
            style={useTileUI
              ? undefined
              : {
                justifyContent: 'flex-start',
                alignItems: 'center',
                textAlign: 'left',
                paddingRight: 12,
                flexGrow: 1,
              }
            }
          >
            <Box
              display='flex' flexDirection='column'
              alignItems={'center'} justifyContent={'center'}
              key={`${keyPrefix}cardContentBox-${level_index}.${item_index}`}
            >
              {(() => {
                const menuLabel = useTileUI
                  ? (this_item.description?.short || this_item.menu_id)
                  : (this_item.description?.long || this_item.description?.short || this_item.menu_id);
                const labelContent = (
                  <Typography
                    key={`${keyPrefix}cardContentLink-${level_index}.${item_index}`}
                    style={AVATextStyle({ align: 'center', margin: { left: useTileUI ? 0 : (hideCardImage ? 2 : 1) }, size: useTileUI ? 1 : 1.8, bold: true, color: (isDark(tileColor) ? 'cornsilk' : 'black') })}
                  >
                    {menuLabel}
                  </Typography>
                );
                if (menuItemType === 'link') {
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
          {canAddFromThisRow &&
            <Box
              display='flex'
              justifyContent='flex-end'
              alignItems='center'
              style={{ minHeight: 20, marginRight: reactData.editFavorites ? 0 : 8 }}
            >
              <IconButton
                size='small'
                aria-label={`add_card_row_${this_item.menu_id}`}
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
                    addMenuDialogUploadFile: null,
                    addMenuDialogUploadFileName: '',
                    addMenuDialogUploadProgress: 0,
                    addMenuDialogSaving: false,
                    addMenuDialogTargets: [],
                    showAddMessageTargetSearch: false,
                    selections: [],
                  }, true);
                }}
              >
                <AddCircleOutlineIcon fontSize='small' />
              </IconButton>
            </Box>
          }
          {!useTileUI && reactData.editFavorites && !isFavoriteCard &&
            <Box
              display='flex'
              justifyContent='flex-end'
              alignItems='center'
              style={{ minHeight: 20, marginRight: 8 }}
            >
              <IconButton
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

    const wrappedCard = ((menuItemType === 'link') && this_item.description?.long)
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
                  style={AVATextStyle({ size: 1.5, margin: { right: 1 } })}
                  id='scroll-dialog-title'
                >
                  {`${reactData.greetingWords},`}
                </Typography>
                <Typography
                  style={AVATextStyle({ size: 1.5, margin: { right: 1 } })}
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
                  src={state.session?.client_logo || process.env.REACT_APP_AVA_LOGO}
                  alt={reactData.greetingName}
                />
              </Tooltip>
              {makeDate(reactData.current_time, { timeZone: state.session.client_timezone }).absolute.split(' at ').map((tLine, tX) => (
                <Typography
                  key={`time_${tX}`}
                  style={AVATextStyle({ align: 'center', size: 0.8 })}
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
                <MenuItem onClick={async () => {
                  await accessLog(session.user_id, `*na*`, `Manual sign-out`);
                  removeCookie("AVAuser", { path: '/' });
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
                    <Typography className={classes.popUpFooter} >{`AVA vers ${reactData.AVA_version}`}</Typography>
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
                  const parentMenuId = firstVisibleCell?.parent || reactData.start_at;
                  const parentCell = reactData.menu_hierarchy
                    .flat()
                    .find((candidateCell) => candidateCell.menu_id === parentMenuId);
                  const level_addButton = useTileUI && !!(
                    parentCell?.menuItemRec &&
                    Object.prototype.hasOwnProperty.call(parentCell.menuItemRec, 'allow_add') &&
                    authorizedToMenuItem(parentCell.menuItemRec.allow_add)
                  );
                  return (
                    level_visible &&
                    <React.Fragment key={`menuLevelFrag${level_index}`}>
                      <Box
                        display='flex'
                        flexDirection='row'
                        alignItems='center'
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
                          {this_level.filter(c => !c.menuItemRec.hidden).map((this_cell, item_index) => {
                            return renderMenuCardCell(this_cell, level_index, item_index);
                          })}
                        </Box>
                        <Box
                          display='flex'
                          flexDirection='column'
                          justifyContent='center'
                          alignItems='center'
                          key={`menuLevelActions${level_index}`}
                          mr={0.5}
                        >
                          {level_addButton &&
                            <IconButton
                              size='small'
                              aria-label={`add_card_level_${level_index}`}
                              onClick={() => {
                                updateReactData({
                                  addMenuDialog: true,
                                  addMenuDialogLevel: level_index,
                                  addMenuDialogParent: parentMenuId,
                                  addMenuDialogType: null,
                                  addMenuDialogLinkSource: 'url',
                                  addMenuDialogTitle: '',
                                  addMenuDialogUrl: '',
                                  addMenuDialogUploadFile: null,
                                  addMenuDialogUploadFileName: '',
                                  addMenuDialogUploadProgress: 0,
                                  addMenuDialogSaving: false,
                                  addMenuDialogTargets: [],
                                  showAddMessageTargetSearch: false,
                                  selections: [],
                                }, true);
                              }}
                            >
                              <AddCircleOutlineIcon fontSize='small' />
                            </IconButton>
                          }
                        </Box>
                      </Box >
                      {(reactData.menu_hierarchy.length > 1) && (level_index > 0) &&
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
                      <Typography style={AVATextStyle({ size: 1.5, align: 'center' })}  >{`Loading ${reactData.loading ? 'Your Menu' : 'AVA Data'}`}</Typography>
                      <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >
                        {`AVA version ${reactData.AVA_version}`}
                      </Typography>
                    </React.Fragment>
                  }
                </Box>
                <Marquee
                  speed={75}
                >
                  {reactData.marqueeData &&
                    reactData.marqueeData.map((marqueeLine, marqueeIndex) => (
                      <Typography
                        key={`marquee_${marqueeIndex}_${reactData.marqueeVersion}`}
                        style={AVATextStyle(Object.assign({ size: 2, margin: { top: 0.6, left: 20, bottom: 1.4 }, bold: true, align: 'center' }, marqueeLine.style))} >
                        {marqueeLine.message}
                      </Typography>
                    ))}
                </Marquee>
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

          {reactData.showProfileEdit &&
            <PeopleMaintenance
              patient={state.patient}
              person_id={state.session.patient_id}
              onClose={(updatedPerson) => {
                if (updatedPerson.saveCompleted) {
                  sessionStorage.removeItem('AVASessionData');
                  window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
                }
                else {
                  updateReactData({
                    showProfileEdit: false
                  }, true);
                }
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
                title: 'Select Message Targets',
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

          {reactData.renderFunctionCall &&
            renderFunction(reactData.renderFunctionCall)
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
                    addMenuDialogUploadFile: null,
                    addMenuDialogUploadFileName: '',
                    addMenuDialogUploadProgress: 0,
                    addMenuDialogSaving: false,
                    addMenuDialogTargets: [],
                    showAddMessageTargetSearch: false,
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
                      selections: (e.target.value === 'message_target') ? reactData.selections : []
                    }, true);
                  }}
                >
                  <FormControlLabel value='menu' control={<Radio color='primary' />} label='Sub-Menu' />
                  <FormControlLabel value='link' control={<Radio color='primary' />} label='Document, Video, or Link' />
                  {reactData.is_admin && <FormControlLabel value='message_target' control={<Radio color='primary' />} label='Message Target' />}
                </RadioGroup>

                {reactData.addMenuDialogType === 'link' &&
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
                          style={{ display: 'none' }}
                          onChange={(event) => {
                            const selectedFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
                            updateReactData({
                              addMenuDialogUploadFile: selectedFile,
                              addMenuDialogUploadFileName: selectedFile ? selectedFile.name : '',
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
                            disabled={reactData.addMenuDialogSaving}
                          >
                            {'Choose File'}
                          </Button>
                          <Typography style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}>
                            {reactData.addMenuDialogUploadFileName || 'No file selected'}
                          </Typography>
                        </Box>
                        {(reactData.addMenuDialogSaving || reactData.addMenuDialogUploadProgress > 0) &&
                          <Box mt={1}>
                            <LinearProgress variant='determinate' value={reactData.addMenuDialogUploadProgress || 0} />
                            <Typography style={AVATextStyle({ size: 0.75, margin: { top: 0.3 } })}>
                              {`Upload progress: ${reactData.addMenuDialogUploadProgress || 0}%`}
                            </Typography>
                          </Box>
                        }
                      </Box>
                    }
                  </React.Fragment>
                }

                {reactData.addMenuDialogType === 'message_target' &&
                  <React.Fragment>
                    <Typography style={AVATextStyle({ size: 0.95, margin: { top: 2, bottom: 0.25 } })}>
                      {'Who should this message target include?'}
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
                    disabled={reactData.addMenuDialogSaving}
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
                          addMenuDialogUploadFile: null,
                          addMenuDialogUploadFileName: '',
                          addMenuDialogUploadProgress: 0,
                          addMenuDialogSaving: false,
                          addMenuDialogTargets: [],
                          showAddMessageTargetSearch: false,
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
            style={{ paddingLeft: '24px', paddingRight: '48px', borderRadius: '30px', borderWidth: 4, borderColor: 'black' }}
            onClose={() => {
              updateReactData({
                alert: false
              }, true);
            }}
          >
            {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
            {reactData.alert.message}
          </Alert>
        </Snackbar>
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
    </React.Fragment >
  );
};