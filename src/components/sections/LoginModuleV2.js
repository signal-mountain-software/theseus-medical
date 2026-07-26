import React from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Auth } from 'aws-amplify';
import { useCookies } from 'react-cookie';

import { dbClient, deepCopy, uuid } from '../../util/AVAUtilities';
import { sendMessages } from '../../util/AVAMessages';
import useSession from '../../hooks/useSession';
import { SET_ACCESSLIST, SET_CALENDAR, SET_GROUPS, SET_PATIENT, SET_PROFILE, SET_SESSION, SET_USER } from '../../contexts/Session/actions';
import { Alert } from '@material-ui/lab';
import { AVAclasses, AVADefaults } from '../../util/AVAStyles';
import { accountAccess, getAllGroups, getGroupsBelongTo, getPersonGroups } from '../../util/AVAGroups';
import useIosCheck from '../../hooks/useIosCheck';
import { getAllOccurrences, v2buildCalendar, createNewOccurrences } from '../../util/AVACalendars';
import { addDays } from '../../util/AVADateTime';
import MakeAVAMenu from '../../util/MakeAVAMenu';
import QuickAdd from './QuickAdd';
import useMediaQuery from '@material-ui/core/useMediaQuery';

const SESSION_POLICY_STATE_KEY = 'AVA_session_policy_state';
const THROTTLE_RETRY_DELAY_MS = 12000;

const LoginModuleV2 = ({
  branding = {},
  initialStep = 'user',
  loading = false,
  errorText = '',
  onResolveIdentifier,
  onSubmitUserId,
  onSubmitPassword,
  onForgotPassword,
  onCancel,
  onCreateAccount,
  onReady,
}) => {

  const { state, dispatch } = useSession();
  const [platform] = useIosCheck();
  const [cookies, setCookie, removeCookie] = useCookies(['AVAuser', 'AVAclient', 'AVAaction']);
  const AVAClass = AVAclasses();
  const [step, setStep] = React.useState(initialStep);
  const [userId, setUserId] = React.useState('');
  const [resolvedUserId, setResolvedUserId] = React.useState('');
  const [resolvedSession, setResolvedSession] = React.useState(null);
  const [resolvedPerson, setResolvedPerson] = React.useState(null);
  const [resolvedPatient, setResolvedPatient] = React.useState(null);
  const [password, setPassword] = React.useState('');
  const [tfaCode, setTfaCode] = React.useState('');
  const [tfaInput, setTfaInput] = React.useState('');
  const [tfaNextStep, setTfaNextStep] = React.useState('ready');
  const [tfaMessage, setTfaMessage] = React.useState('');
  const [alertMessage, setAlertMessage] = React.useState('');
  const [authCompleted, setAuthCompleted] = React.useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = React.useState(null);
  const [clientNameOverride, setClientNameOverride] = React.useState('');
  const [clientLogoOverride, setClientLogoOverride] = React.useState('');
  const [altMatchOptions, setAltMatchOptions] = React.useState(null);
  const [altMatchMode, setAltMatchMode] = React.useState('first');
  const [altMatchLabel, setAltMatchLabel] = React.useState('');
  const [altOriginalEntry, setAltOriginalEntry] = React.useState('');
  const [altMatchInputType, setAltMatchInputType] = React.useState('');
  const [showCreateAccount, setShowCreateAccount] = React.useState(false);
  const [createAccountEntry, setCreateAccountEntry] = React.useState('');
  const [createAccountType, setCreateAccountType] = React.useState('');
  const [showQuickAdd, setShowQuickAdd] = React.useState(false);
  const [clientStyle, setClientStyle] = React.useState(branding.clientStyle || state?.session?.client_style || {});
  const bootStateRef = React.useRef({});
  const useSessionPatientRef = React.useRef(false);
  const resolvedSessionRef = React.useRef(null);
  const resolvedPersonRef = React.useRef(null);
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const loginPanelStyle = {
    backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.9)' : 'white',
    color: isDarkMode ? '#f3f4f6' : (clientStyle?.textColor || '#111827'),
    borderRadius: 30,
    padding: 16,
    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(17, 24, 39, 0.15)',
    boxShadow: isDarkMode
      ? '0 12px 30px rgba(0, 0, 0, 0.35)'
      : '0 10px 24px rgba(15, 23, 42, 0.12)'
  };

  const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const isAuthThrottleError = (error) => {
    const code = String(error?.code || error?.name || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return (
      code.includes('toomanyrequest')
      || code.includes('limitexceeded')
      || message.includes('too many request')
      || message.includes('request limit exceeded')
      || message.includes('rate exceeded')
      || message.includes('throttl')
    );
  };

  const namePromptActive = Array.isArray(altMatchOptions) && altMatchOptions.length > 0;
  const namePromptMode = altMatchMode === 'last' ? 'last' : 'first';
  const namePromptLabel = namePromptActive
    ? `${namePromptMode.charAt(0).toUpperCase()}${namePromptMode.slice(1)} name`
    : 'User ID, e-Mail Address, or Phone Number';
  const namePromptMessage = namePromptActive
    ? `There are ${altMatchOptions.length} accounts with that ${altMatchLabel || 'entry'}. Enter your ${namePromptMode} name, so we can pick the right one.`
    : '';

  const clientName = branding.clientName || clientNameOverride || state?.session?.client_name || 'AVA Sign-in';
  const logoUrl = branding.logoUrl || clientLogoOverride || state?.session?.client_logo_thumb || state?.session?.client_logo || state?.session?.client_icon;
  const checkinImage = branding.checkinImage || state?.session?.client_style?.checkin_image;
  const backgroundImage = backgroundImageUrl || branding.backgroundImage || state?.session?.client_style?.checkin_image;
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

  const savedUserCookie = normalizeCookieValue(cookies?.AVAuser);
  const savedClientCookie = normalizeCookieValue(cookies?.AVAclient);
  // const savedActionCookie = normalizeCookieValue(cookies?.AVAaction);

  const getEffectiveCookieExpiryDays = React.useCallback((sessionLike) => {
    const policyHours = Number(sessionLike?.session_policy?.cookie_ttl_hours);
    if (Number.isFinite(policyHours) && policyHours > 0) {
      return (policyHours / 24);
    }

    const allowLegacyFallback = (sessionLike?.session_policy?.fallback_to_legacy_cookie_expiry_days !== false);
    const customExpiryDays = Number(sessionLike?.cookie_expiry_days);
    if (allowLegacyFallback && Number.isFinite(customExpiryDays) && customExpiryDays > 0) {
      return customExpiryDays;
    }

    return 90;
  }, []);

  const persistSessionPolicyState = React.useCallback((sessionLike, personLike) => {
    if (!sessionLike?.session_policy || typeof sessionLike.session_policy !== 'object') {
      return;
    }

    const now = new Date();
    const startedAt = now.toISOString();
    const policyHours = Number(sessionLike?.session_policy?.absolute_session_max_hours);
    const fallbackDays = Number(getEffectiveCookieExpiryDays(sessionLike));
    const fallbackHours = Number.isFinite(fallbackDays) && fallbackDays > 0 ? (fallbackDays * 24) : null;
    const effectiveHours = (Number.isFinite(policyHours) && policyHours > 0) ? policyHours : fallbackHours;
    const expiresAt = effectiveHours ? new Date(now.getTime() + (effectiveHours * 60 * 60 * 1000)).toISOString() : null;

    const policyState = {
      version: 1,
      client_id: sessionLike?.client_id || personLike?.client_id || null,
      user_id: personLike?.person_id || sessionLike?.user_id || sessionLike?.session_id || null,
      started_at: startedAt,
      last_active_at: startedAt,
      expires_at: expiresAt,
      policy: sessionLike?.session_policy || null,
    };

    try {
      localStorage.setItem(SESSION_POLICY_STATE_KEY, JSON.stringify(policyState));
    }
    catch {
      // Ignore storage write failures; policy enforcement will gracefully fallback.
    }
  }, [getEffectiveCookieExpiryDays]);

  const getUrlParams = React.useCallback(() => {
    const params = new URLSearchParams(window.location.search || '');
    const obj = {};
    params.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }, []);

  React.useEffect(() => {
    const params = getUrlParams();
    if (!params?.session_msg) {
      return;
    }

    const reasonText = params?.session_reason ? ` (${params.session_reason})` : '';
    setAlertMessage(`${params.session_msg}${reasonText}`);
  }, [getUrlParams]);

  const getClientNameForId = React.useCallback(async (clientId) => {
    if (!clientId) return '';
    const clientRec = await dbClient
      .get({
        Key: { client_id: clientId, custom_key: 'client_name' },
        TableName: 'Customizations'
      })
      .promise()
      .catch(() => null);

    if (clientRec && clientRec.Item && clientRec.Item.customization_value) {
      return clientRec.Item.customization_value;
    }
    return clientId;
  }, []);

  const getClientStyleForId = React.useCallback(async (clientId) => {
    if (!clientId) return null;
    const clientRec = await dbClient
      .get({
        Key: { client_id: clientId, custom_key: 'client_style' },
        TableName: 'Customizations'
      })
      .promise()
      .catch(() => null);

    if (clientRec && clientRec.Item && clientRec.Item.customization_value) {
      return clientRec.Item.customization_value;
    }
    return null;
  }, []);

  const getClientLogoForId = React.useCallback(async (clientId) => {
    if (!clientId) return '';
    const clientRec = await dbClient
      .get({
        Key: { client_id: clientId, custom_key: 'logo' },
        TableName: 'Customizations'
      })
      .promise()
      .catch(() => null);

    if (clientRec && clientRec.Item) {
      return clientRec.Item.icon_thumb || clientRec.Item.customization_value || clientRec.Item.icon || '';
    }
    return '';
  }, []);

  React.useEffect(() => {
    let isActive = true;
    const loadBackgroundImage = async () => {
      const urlParams = getUrlParams();
      const requiredClientId = urlParams?.client || urlParams?.client_id || urlParams?.create || null;
      const clientId = requiredClientId || resolvedPerson?.client_id || null;
      if (!clientId) {
        setBackgroundImageUrl(null);
        return;
      }
      const [clientStyle, fetchedClientName, fetchedClientLogo] = await Promise.all([
        getClientStyleForId(clientId),
        getClientNameForId(clientId),
        getClientLogoForId(clientId)
      ]);
      if (!isActive) return;
      setClientStyle(clientStyle || {});
      setBackgroundImageUrl(clientStyle?.checkin_image || null);
      setClientNameOverride(fetchedClientName || '');
      setClientLogoOverride(fetchedClientLogo || '');
    };

    loadBackgroundImage();
    return () => {
      isActive = false;
    };
  }, [getUrlParams, getClientStyleForId, getClientNameForId, getClientLogoForId, resolvedPerson]);

  React.useEffect(() => {
    resolvedSessionRef.current = resolvedSession;
  }, [resolvedSession]);

  React.useEffect(() => {
    resolvedPersonRef.current = resolvedPerson;
  }, [resolvedPerson]);

  const detectInputType = (rawInput) => {
    const trimmed = (rawInput || '').trim();
    if (!trimmed) return 'unknown';
    if (trimmed.includes('@')) return 'email';
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length >= 7) return 'phone';
    if (trimmed.split(/\s+/).length >= 2) return 'name';
    return 'user_id';
  };

  const resolveIdentifier = async (rawInput) => {
    const urlParams = getUrlParams();
    const requiredClientId = urlParams?.client || urlParams?.client_id || urlParams?.create || null;
    const inputType = detectInputType(rawInput);
    const normalizedInput = (rawInput || '').trim();
    const effectiveInputType = altMatchInputType || inputType;

    if (altMatchOptions && altMatchOptions.length > 0) {
      const nameValue = normalizedInput.toLowerCase();
      const matches = altMatchOptions.filter((option) => {
        if (altMatchMode === 'last') {
          return (option.lastName || '').toLowerCase() === nameValue;
        }
        return (option.firstName || '').toLowerCase() === nameValue;
      });

      if (matches.length === 1) {
        setAltMatchOptions(null);
        setAltMatchMode('first');
        setAltMatchLabel('');
        setAltOriginalEntry('');
        setAltMatchInputType('');
        setAlertMessage('');
        return {
          userId: matches[0].person_id,
          nextStep: 'password',
          inputType: effectiveInputType,
          resolved: true,
        };
      }

      if (matches.length > 1 && altMatchMode === 'first') {
        setAltMatchOptions(matches);
        setAltMatchMode('last');
        setAlertMessage('Multiple accounts share that first name. Please enter your last name.');
        setUserId('');
      }
      else {
        setAlertMessage(`We could not match that ${altMatchMode === 'last' ? 'last' : 'first'} name. Please try again.`);
      }

      return {
        userId: normalizedInput,
        nextStep: 'user',
        inputType: effectiveInputType,
        resolved: false,
        multipleMatch: true,
      };
    }

    if (onResolveIdentifier) {
      const resolved = await onResolveIdentifier({ rawInput: normalizedInput, inputType });
      if (resolved) {
        return {
          userId: resolved.userId || normalizedInput,
          nextStep: resolved.nextStep || 'password',
          inputType,
          resolved: !!resolved.userId,
        };
      }
    }

    if (normalizedInput) {
      const lookupKey = normalizedInput.toLowerCase();
      const peopleRec = await dbClient
        .get({
          Key: { person_id: lookupKey },
          TableName: 'People'
        })
        .promise()
        .catch(() => null);

      if (peopleRec && peopleRec.Item && peopleRec.Item.person_id) {
        return {
          userId: peopleRec.Item.person_id,
          nextStep: 'password',
          inputType,
          resolved: true,
        };
      }

      let altIdentifier = normalizedInput;
      if (inputType === 'email' || inputType === 'name') {
        altIdentifier = normalizedInput.toLowerCase();
      }
      if (inputType === 'phone') {
        const digitsOnly = normalizedInput.replace(/\D/g, '');
        altIdentifier = digitsOnly.slice(-10);
      }

      if (altIdentifier) {
        const altRec = await dbClient
          .query({
            KeyConditionExpression: 'identifier = :i',
            ExpressionAttributeValues: { ':i': altIdentifier },
            TableName: 'PeopleAccounts',
            IndexName: 'alternate_id-index'
          })
          .promise()
          .catch(() => null);

        if (altRec && Array.isArray(altRec.Items) && altRec.Items.length > 0) {
          const enriched = await Promise.all(altRec.Items.map(async (item) => {
            const personRec = await dbClient
              .get({
                Key: { person_id: item.person_id },
                TableName: 'People'
              })
              .promise()
              .catch(() => null);

            if (!personRec || !personRec.Item) {
              return null;
            }

            if (requiredClientId && personRec.Item.client_id !== requiredClientId) {
              return null;
            }

            return {
              person_id: item.person_id,
              firstName: personRec.Item?.name?.first || '',
              lastName: personRec.Item?.name?.last || '',
            };
          }));

          const altItems = enriched.filter(Boolean);

          if (altItems.length > 1) {
            const label = inputType === 'email' ? 'e-mail address' : (inputType === 'phone' ? 'phone number' : 'entry');
            setAltMatchOptions(altItems);
            setAltMatchMode('first');
            setAltMatchLabel(label);
            setAlertMessage(`There are ${altItems.length} accounts with that ${label}. Enter your first name, so we can pick the right one.`);
            setAltOriginalEntry(normalizedInput);
            setAltMatchInputType(inputType);
            setUserId('');
            return {
              userId: normalizedInput,
              nextStep: 'user',
              inputType,
              resolved: false,
              multipleMatch: true,
            };
          }

          if (altItems.length === 1) {
            return {
              userId: altItems[0].person_id,
              nextStep: 'password',
              inputType,
              resolved: true,
            };
          }
        }
      }
    }

    return {
      userId: normalizedInput,
      nextStep: 'password',
      inputType: effectiveInputType,
      resolved: false,
    };
  };

  const handleCreateAccount = async () => {
    const entry = createAccountEntry || userId;
    const inputType = createAccountType || detectInputType(entry);
    const urlParams = getUrlParams();
    const clientId = urlParams?.client || urlParams?.client_id || urlParams?.create || resolvedPerson?.client_id || resolvedSession?.client_id || savedClientCookie?.client || savedClientCookie?.client_id || null;
    if (clientId) {
      const baseUrl = window.location.href.split('?')[0];
      window.location.replace(`${baseUrl}?create=${clientId}`);
      return;
    }
    if (onCreateAccount) {
      onCreateAccount({ rawInput: entry, inputType });
      return;
    }
    setShowQuickAdd(true);
  };

  const restartFromBeginning = () => {
    setShowQuickAdd(false);
    setUserId('');
    setResolvedUserId('');
    setResolvedSession(null);
    setResolvedPerson(null);
    setResolvedPatient(null);
    setPassword('');
    setTfaCode('');
    setTfaInput('');
    setTfaNextStep('ready');
    setTfaMessage('');
    setAlertMessage('');
    setAltMatchOptions(null);
    setAltMatchMode('first');
    setAltMatchLabel('');
    setAltOriginalEntry('');
    setAltMatchInputType('');
    setShowCreateAccount(false);
    setCreateAccountEntry('');
    setCreateAccountType('');
    setStep('user');
  };

  const fetchSessionV2 = React.useCallback(async (sessionId) => {
    if (!sessionId) return null;
    const sessionRec = await dbClient
      .get({
        Key: { session_id: sessionId.toLowerCase() },
        TableName: 'SessionsV2'
      })
      .promise()
      .catch(() => null);

    if (sessionRec && sessionRec.Item) {
      let user_fontSize = 1;
      if (sessionRec.Item.customizations && sessionRec.Item.customizations.font_size) {
        user_fontSize = sessionRec.Item.customizations.font_size;
      }
      AVADefaults({ fontSize: Math.max(user_fontSize, 1) });
      return sessionRec.Item;
    }
    return null;
  }, []);

  const fetchPerson = React.useCallback(async (personId) => {
    if (!personId) return null;
    const peopleRec = await dbClient
      .get({
        Key: { person_id: personId },
        TableName: 'People'
      })
      .promise()
      .catch(() => null);

    if (peopleRec && peopleRec.Item) {
      return peopleRec.Item;
    }
    return null;
  }, []);

  const resolvePatientFromSession = React.useCallback(async (personRec, sessionRec) => {
    if (!sessionRec) return null;
    const patientId = sessionRec.patient_id || sessionRec.person_id || personRec?.person_id;
    if (!patientId) return null;
    if (personRec && patientId === personRec.person_id) {
      return personRec;
    }
    return fetchPerson(patientId);
  }, [fetchPerson]);

  const applySessionToMemory = React.useCallback((sessionRec, personRec, patientRec) => {
    if (!dispatch || !sessionRec || !personRec || !patientRec) return;
    dispatch({ type: SET_SESSION, payload: sessionRec });
    dispatch({ type: SET_PROFILE, payload: personRec });
    dispatch({ type: SET_USER, payload: personRec });
    dispatch({ type: SET_PATIENT, payload: patientRec });
    bootStateRef.current = {
      ...bootStateRef.current,
      session: sessionRec,
      profile: personRec,
      user: personRec,
      patient: patientRec
    };
    sessionStorage.setItem('AVASessionData', JSON.stringify({ currentProfile: personRec }));
  }, [dispatch]);

  const screenQuiet = () => { };

  const loadSyncInfo = React.useCallback(async (workSession, patientRec) => {
    if (!workSession || !patientRec || !dispatch) return;
    const pSession = deepCopy(workSession);
    let groupsObj = {};
    let membersObj = {};

    const belongsTo = await getGroupsBelongTo(pSession.client_id, pSession.patient_id, { sort: true })
      .catch(() => ({}));
    const groupStructure = await getAllGroups(pSession.patient_id, pSession.client_id)
      .catch(() => ({}));
    const memberGroupIds = await getPersonGroups(pSession.patient_id, pSession.client_id)
      .catch(() => []);
    dispatch({ type: SET_GROUPS, payload: Object.assign({}, groupStructure, { belongsTo, memberGroupIds }) });

    const accessPromise = accountAccess(pSession.patient_id, pSession.client_id)
      .then(accessList => {
        dispatch({ type: SET_ACCESSLIST, payload: accessList });
        bootStateRef.current.accessList = accessList;
      })
      .catch((e) => { console.log('accountAccess threw error', e)});

    const rightNow = new Date();
    const calendarPromise = getAllOccurrences(
      {
        client_id: pSession.client_id,
        this_person: pSession.patient_id,
        start_date: rightNow,
        end_date: addDays(rightNow, 35),
        filter: { group: belongsTo },
      },
    ).then(occList => {
      dispatch({ type: SET_CALENDAR, payload: occList });
      bootStateRef.current.calendar = occList;
    })
      .catch((e) => { console.log({ 'getAllOccurrences threw error': e })});

    await createNewOccurrences({ client: pSession.client_id }).catch(() => null);

    v2buildCalendar(
      {
        client_id: pSession.client_id,
        this_person: pSession.patient_id,
        start_date: rightNow,
        end_date: addDays(rightNow, 35),
        filter: { group: belongsTo },
      },
    ).catch(() => null);

    await Promise.allSettled([accessPromise, calendarPromise]);

    bootStateRef.current.groups = Object.assign({}, { belongsTo }, membersObj, groupsObj);
    MakeAVAMenu(patientRec, pSession.client_id, screenQuiet, null, null, bootStateRef.current)
      .catch(() => null);
  }, [dispatch]);

  const updateSessionV2Record = React.useCallback(async (sessionRec, personRec, patientRec) => {
    if (!sessionRec?.session_id) return;
    const statusPayload = {
      version: `v${process.env.REACT_APP_AVA_VERSION}`,
      environment: window.location.href.split('//')[1]?.charAt(0)?.toUpperCase(),
      time: new Date().toString(),
      signin_status: 'AVA Launch',
      source: 'login-v2'
    };

    const attributeValues = {
      ':s': statusPayload,
    };
    const attributeNames = { '#s': 'status' };
    let updateExpression = 'set #s = :s';

    if (sessionRec.last_login) {
      attributeValues[':p'] = sessionRec.last_login;
      updateExpression += ', last_login = :p';
    }
    if (sessionRec.patient_id) {
      // INVESTIGATE: this might need to set pid to patientRec.person_id (not sessionRec.person_id)
      attributeValues[':pid'] = sessionRec.patient_id;
      updateExpression += ', patient_id = :pid';
    }
    if (patientRec?.person_id) {
      const displayName = patientRec?.name
        ? `${patientRec.name.first || ''} ${patientRec.name.last || ''}`.trim()
        : `Unnamed account (${patientRec.person_id})`;
      attributeValues[':pn'] = displayName;
      updateExpression += ', patient_display_name = :pn';
      sessionRec.patient_display_name = displayName;
    }
    if (platform) {
      attributeValues[':dev'] = platform;
      updateExpression += ', platform = :dev';
      sessionRec.platform = platform;
    }
    if (personRec?.person_id) {
      attributeValues[':uid'] = personRec.person_id;
      updateExpression += ', user_id = :uid';
      sessionRec.user_id = personRec.person_id;
    }
    const pURL = getUrlParams();
    if (pURL) {
      attributeValues[':u'] = pURL;
      updateExpression += ', url_parameters = :u';
      sessionRec.url_parameters = pURL;
    }

    await dbClient
      .update({
        Key: { session_id: sessionRec.session_id },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: attributeValues,
        ExpressionAttributeNames: attributeNames,
        TableName: 'SessionsV2',
      })
      .promise()
      .catch(() => null);
  }, [getUrlParams, platform]);

  const loadClientCustomizations = React.useCallback(async (personRec, sessionRec) => {
    if (!personRec?.client_id || !sessionRec) return sessionRec;
    const customizationsAllRec = await dbClient
      .query({
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': '*all' },
        TableName: 'Customizations',
      })
      .promise()
      .catch(() => null);
    
     const customizationsRec = await dbClient
      .query({
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': personRec.client_id },
        TableName: 'Customizations',
      })
      .promise()
      .catch(() => null);

    if (!customizationsRec || !Array.isArray(customizationsRec.Items)) {
      return sessionRec;
    }

    if (customizationsAllRec && Array.isArray(customizationsAllRec.Items)) { 
      customizationsRec.Items.unshift(...customizationsAllRec.Items);
    }

    const updatedSession = { ...sessionRec };
    const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

    for (let c = 0; c < customizationsRec.Items.length; c++) {
      const cRec = customizationsRec.Items[c];
      AVADefaults({ [cRec.custom_key]: cRec.customization_value });
      switch (cRec.custom_key) {
        case 'logo': {
          updatedSession.client_logo = cRec.icon;
          updatedSession.client_logo_thumb = cRec.icon_thumb || null;
          updatedSession.client_icon = cRec.icon;
          break;
        }
        case 'client_name': {
          updatedSession.client_name = cRec.customization_value;
          break;
        }
        case 'group_assignments': {
          updatedSession.group_assignments = cRec.customization_value;
          updatedSession.inactiveGroupList = ['inactive'];
          const inactiveAssignment = toArray(updatedSession?.group_assignments?.inactive);
          if (inactiveAssignment.length > 0) {
            updatedSession.inactiveGroupList.push(...inactiveAssignment);
          }
          break;
        }
        case 'greeting':
        case 'greetings': {
          const today = new Date();
          const thisYear = today.getFullYear();
          const thisMonth = today.getMonth() + 1;
          const thisDay = today.getDate();
          const mmdd = `${thisMonth}.${thisDay}`;
          const yymmdd = `${thisYear % 100}.${mmdd}`;
          if (cRec.customization_value?.hasOwnProperty?.(yymmdd)) {
            updatedSession.custom_greeting = cRec.customization_value[yymmdd];
          }
          else if (cRec.customization_value?.hasOwnProperty?.(mmdd)) {
            updatedSession.custom_greeting = cRec.customization_value[mmdd];
          }
          break;
        }
        case 'working_hours': {
          updatedSession.working_hours = cRec.customization_value;
          if (updatedSession.working_hours) {
            updatedSession.working_hours.isHoliday = false;
            if (updatedSession.working_hours.holidays) {
              const today = new Date();
              const thisYear = today.getFullYear();
              const thisMonth = today.getMonth() + 1;
              const thisDay = today.getDate();
              const mmdd = `${thisMonth}.${thisDay}`;
              const yymmdd = `${thisYear % 100}.${mmdd}`;
              if (updatedSession.working_hours.holidays.hasOwnProperty(yymmdd)) {
                updatedSession.working_hours.isHoliday = true;
              }
              else if (updatedSession.working_hours.holidays.hasOwnProperty(mmdd)) {
                updatedSession.working_hours.isHoliday = true;
              }
            }
          }
          break;
        }
        default: {
          if (cRec.customization_value) {
            updatedSession[cRec.custom_key] = cRec.customization_value;
          }
          break;
        }
      }
    }

    return updatedSession;
  }, []);

  const computeAdminAccount = React.useCallback(async (personRec, sessionRec) => {
    if (!personRec || !sessionRec) {
      return { updatedPerson: personRec, updatedSession: sessionRec };
    }

    const updatedSession = { ...sessionRec };
    const updatedPerson = { ...personRec };

    updatedSession.adminAccount = false;
    if (updatedPerson.account_class) {
      const clients = Array.isArray(updatedPerson.clients) ? updatedPerson.clients : [];
      if ((updatedPerson.account_class === 'master')
        || ((updatedPerson.account_class === 'support')
          && (clients.some(a => a?.id === updatedSession.client_id)))) {
        updatedSession.adminAccount = true;
      }
    }

    if (!updatedSession.adminAccount) {
      const patientId = updatedSession.patient_id || updatedPerson.person_id;
      const belongsTo = await getGroupsBelongTo(updatedSession.client_id, patientId, { sort: true })
        .catch(() => ({}));

      if (!updatedSession.hasOwnProperty('group_assignments')) {
        updatedSession.adminAccount = true;
      }
      else {
        const groupObject = updatedSession.group_assignments;
        const adminArray = [];
        if (groupObject?.admin) { adminArray.push(...(Array.isArray(groupObject.admin) ? groupObject.admin : [groupObject.admin])); }
        if (groupObject?.staff) { adminArray.push(...(Array.isArray(groupObject.staff) ? groupObject.staff : [groupObject.staff])); }
        if (adminArray.length === 0) {
          updatedSession.adminAccount = true;
        }
        else {
          updatedSession.adminAccount = adminArray.some(g => belongsTo && Object.prototype.hasOwnProperty.call(belongsTo, g));
        }
      }
    }

    if (updatedSession.adminAccount
      && (updatedPerson.account_class !== 'master')
      && (updatedPerson.account_class !== 'support')) {
      updatedPerson.account_class = 'admin';
    }

    return { updatedPerson, updatedSession };
  }, []);

  const bakeCookies = React.useCallback((pUser, pClient, pPerson, pDays = 90) => {
    if (!pUser) return;
    const expirySeconds = Math.max(60, Math.round((Number(pDays) || 90) * 24 * 60 * 60));
    setCookie('AVAuser',
      JSON.stringify({
        user_id: pUser,
        client: pClient,
        person_id: pPerson
      }), { path: '/', maxAge: expirySeconds });
    if (pClient) {
      setCookie('AVAclient', JSON.stringify({
        client: pClient,
      }), { path: '/', maxAge: expirySeconds });
    }
  }, [setCookie]);

  const finalizeLoadedSession = React.useCallback(async (personRec, sessionRec) => {
    const patientRec = useSessionPatientRef.current
      ? await resolvePatientFromSession(personRec, sessionRec)
      : personRec;
    const customizedSession = await loadClientCustomizations(patientRec, sessionRec);
    const { updatedPerson, updatedSession } = await computeAdminAccount(personRec, customizedSession);

    // Always sync session.patient_id to the resolved patientRec so that the
    // dispatched session is self-consistent.
    //
    // - Fresh manual login (useSessionPatientRef = false): patientRec === personRec,
    //   so patient_id is set to the newly-logged-in user's own ID ("pure" login).
    // - Cookie/auto resume (useSessionPatientRef = true): patientRec was resolved
    //   from the stored session (e.g. an adult child resuming as their parent),
    //   so the proxy patient_id is correctly preserved.
    //
    // Without this, whatever patient_id happens to be in the SessionsV2 record at
    // the moment of login is blindly propagated, which can produce a mismatched
    // state.session.patient_id after sign-out + sign-in-as-different-user.
    const resolvedPatientId = (patientRec || updatedPerson)?.person_id;
    if (resolvedPatientId && customizedSession) {
      customizedSession.patient_id = resolvedPatientId;
    }

    if (updatedSession) {
      setResolvedSession(customizedSession || updatedSession);
    }
    if (updatedPerson) {
      setResolvedPerson(updatedPerson);
    }
    if (patientRec) {
      setResolvedPatient(patientRec);
    }

    // Re-bake now that customizations are loaded so per-client policy can override
    // the initial default maxAge set during early auth.
    const effectiveCookieDays = Number(getEffectiveCookieExpiryDays(customizedSession));
    if (effectiveCookieDays > 0 && effectiveCookieDays !== 90) {
      bakeCookies(
        personRec?.person_id,
        customizedSession?.client_id || personRec?.client_id,
        personRec?.person_id,
        effectiveCookieDays
      );
    }

    persistSessionPolicyState(customizedSession || updatedSession, updatedPerson);

    applySessionToMemory(customizedSession || updatedSession, updatedPerson, patientRec || updatedPerson);
    updateSessionV2Record(customizedSession || updatedSession, updatedPerson, patientRec || updatedPerson);
    loadSyncInfo(customizedSession || updatedSession, patientRec || updatedPerson);
    if (onReady && (customizedSession || updatedSession) && updatedPerson && (patientRec || updatedPerson)) {
      onReady({
        session: customizedSession || updatedSession,
        profile: updatedPerson,
        user: updatedPerson,
        patient: patientRec || updatedPerson,
      });
    }
  }, [applySessionToMemory, bakeCookies, computeAdminAccount, getEffectiveCookieExpiryDays, loadClientCustomizations, loadSyncInfo, onReady, persistSessionPolicyState, resolvePatientFromSession, updateSessionV2Record]);

  const getNextStepFromSession = (sessionRec) => {
    if (!sessionRec) return 'user';
    const requiresPassword = !!sessionRec.requirePassword || !!sessionRec.forceSetPassword
      || !!clientStyle?.mandatory_passwords
      || (!!clientStyle?.mandatory_passwords && !sessionRec.last_login);
    return requiresPassword ? 'password' : 'ready';
  };

  React.useEffect(() => {
    let isActive = true;
    const bootstrapFromCookie = async () => {
      const urlParams = getUrlParams();
      const userIdFromUrl = urlParams?.user || urlParams?.user_id || null;
      const requiredClientId = urlParams?.client || urlParams?.client_id || urlParams?.create || null;
      const userIdFromCookie = savedUserCookie?.user_id;
      if (requiredClientId && !userIdFromUrl) {
        setResolvedUserId('');
        setResolvedSession(null);
        setResolvedPerson(null);
        setResolvedPatient(null);
        setStep('user');
        return;
      }

      const candidateUserId = userIdFromUrl || userIdFromCookie;
      const usedCookieUserId = !userIdFromUrl && !!userIdFromCookie;
      useSessionPatientRef.current = usedCookieUserId;

      if (!candidateUserId) {
        return;
      }

      const [personRec, sessionRec] = await Promise.all([
        fetchPerson(candidateUserId),
        fetchSessionV2(candidateUserId)
      ]);

      if (!isActive) return;

      if (!personRec || !sessionRec) {
        removeCookie('AVAuser', { path: '/' });
        setResolvedUserId('');
        setResolvedSession(null);
        setResolvedPerson(null);
        setResolvedPatient(null);
        setStep('user');
        return;
      }

      if (requiredClientId && !userIdFromUrl && personRec?.client_id && personRec.client_id !== requiredClientId) {
        const clientLabel = await getClientNameForId(requiredClientId);
        if (!isActive) return;
        setResolvedUserId('');
        setResolvedSession(null);
        setResolvedPerson(null);
        setResolvedPatient(null);
        setAlertMessage(`This account is not valid for ${clientLabel}`);
        setStep('user');
        return;
      }

      // The URL/cookie had a User ID in it and it is a valid User ID... prepare and continue to the "ready" step
      setAlertMessage('');
      setResolvedUserId(candidateUserId);
      setResolvedSession(sessionRec);
      setResolvedPerson(personRec);
      resolvedSessionRef.current = sessionRec;
      resolvedPersonRef.current = personRec;
      const patientRec = useSessionPatientRef.current
        ? await resolvePatientFromSession(personRec, sessionRec)
        : personRec;
      if (!isActive) return;
      setResolvedPatient(patientRec);
      setStep('ready');
    };

    bootstrapFromCookie();
    return () => {
      isActive = false;
    };
  }, [savedUserCookie, removeCookie, resolvePatientFromSession, fetchPerson, fetchSessionV2, getUrlParams, getClientNameForId]);

  const handleSubmitUser = async () => {
    useSessionPatientRef.current = false;
    if ((userId || '').trim().toLowerCase() === 'client') {
      removeCookie('AVAuser', { path: '/' });
      removeCookie('AVAclient', { path: '/' });
      sessionStorage.removeItem('AVASessionData');
      const baseUrl = window.location.href.split('?')[0];
      window.location.replace(baseUrl);
      return;
    }
    const urlParams = getUrlParams();
    const requiredClientId = urlParams?.client || urlParams?.client_id || urlParams?.create || null;
    const resolved = await resolveIdentifier(userId);
    if (!resolved.resolved) {
      if (!resolved.multipleMatch) {
        setAlertMessage('We could not find an account matching that entry. Please try again.');
        setShowCreateAccount(true);
        setCreateAccountEntry(userId);
        setCreateAccountType(resolved.inputType);
      }
      setStep('user');
      return;
    }

    const resolvedId = resolved.userId || userId;
    const [sessionRec, personRec] = await Promise.all([
      fetchSessionV2(resolvedId),
      fetchPerson(resolvedId)
    ]);
    if (!sessionRec) {
      setResolvedUserId('');
      setResolvedSession(null);
      setResolvedPerson(null);
      setResolvedPatient(null);
      setAlertMessage('This account cannot be used at this time, please contact AVA Support');
      setStep('user');
      return;
    }

    if (requiredClientId && personRec?.client_id && personRec.client_id !== requiredClientId) {
      const clientLabel = await getClientNameForId(requiredClientId);
      setResolvedUserId('');
      setResolvedSession(null);
      setResolvedPerson(null);
      setResolvedPatient(null);
      setAlertMessage(`This account is not valid for ${clientLabel}`);
      setStep('user');
      return;
    }

    setAlertMessage('');
    setShowCreateAccount(false);
    setCreateAccountEntry('');
    setCreateAccountType('');
    setResolvedUserId(resolvedId);
    setResolvedSession(sessionRec);
    setResolvedPerson(personRec);
    resolvedSessionRef.current = sessionRec;
    resolvedPersonRef.current = personRec;
    setResolvedPatient(personRec);

    const computedNextStep = getNextStepFromSession(sessionRec);
    if (!clientStyle?.no_tfa && (resolved.inputType === 'email' || resolved.inputType === 'phone')) {
      const tempPass = uuid(6);
      const clientLabel = await getClientNameForId(personRec?.client_id);
      let prefMethod = resolved.inputType === 'email' ? 'email' : 'sms';
      const my_email = personRec?.contact_info?.email?.address || personRec?.messaging?.email || null;
      const my_phone = personRec?.contact_info?.cell?.number || personRec?.messaging?.sms || null;
      const expectedAddress = (() => {
        if (prefMethod === 'email') {
          if (my_email) { return my_email; }
          else if (my_phone) {
            prefMethod = 'sms'
            return my_phone;
          }
          else {
            return null;
          }
        }
        else {
         if (my_phone) { return my_phone; }
         else if (my_email) {
           prefMethod = 'email';
           return my_email;
         }
         else {
           return null;
         }
        }
      });

      const resolvedAddress = expectedAddress();
      if (!resolvedAddress) {
        setAlertMessage('We could not determine a valid contact method for sending the security code.');
        setStep('user');
        return;
      }
      try {
        await sendMessages({
          client: personRec?.client_id,
          author: sessionRec?.user_id || personRec?.person_id,
          person_id: personRec?.person_id,
          preferred_method: prefMethod,
          messageText: `To access your ${clientLabel} account, use this code: ${tempPass}`,
          recipientList: [personRec?.person_id],
          subject: `Security message from ${clientLabel}`
        });
      }
      catch {
        setAlertMessage('We could not send a security code at this time. Please try again.');
        setStep('user');
        return;
      }

      const promptMessage = prefMethod === 'email'
        ? `We've sent an e-Mail to ${resolvedAddress}. Look for a security code in that message and enter it here.`
        : `We've sent a text to (${String(resolvedAddress).slice(2, 5)}) ${String(resolvedAddress).slice(5, 8)}-${String(resolvedAddress).slice(8)}. Look for a security code in that message and enter it here.`;

      setTfaCode(tempPass);
      setTfaInput('');
      setTfaNextStep(computedNextStep);
      setTfaMessage(promptMessage);
      setAlertMessage('');
      setStep('tfa');
      return;
    }
    if (onSubmitUserId) {
      const result = await onSubmitUserId(resolvedId, {
        rawInput: userId,
        inputType: resolved.inputType,
        nextStep: computedNextStep,
      });
      if (result && result.nextStep) {
        setStep(result.nextStep);
        return;
      }
    }

    setStep(computedNextStep);
  };

  const handleSubmitPassword = async () => {
    const isForceSet = !!(resolvedSession?.forceSetPassword || (clientStyle?.mandatory_passwords && !resolvedSession?.last_login));
    if (!isForceSet && resolvedSession && resolvedSession.last_login) {
      const storedPassword = String(resolvedSession.last_login);
      if (String(password) !== storedPassword) {
        setAlertMessage('Incorrect password. Please try again.');
        setStep('password');
        return;
      }
    }
    const finalUserId = resolvedUserId || userId;
    if (isForceSet) {
      await dbClient.update({
        Key: { session_id: finalUserId },
        UpdateExpression: 'set last_login = :p, forceSetPassword = :f',
        ExpressionAttributeValues: { ':p': password, ':f': false },
        TableName: 'SessionsV2',
      }).promise().catch(() => null);
      const updatedSession = { ...resolvedSessionRef.current, last_login: password, forceSetPassword: false };
      resolvedSessionRef.current = updatedSession;
      setResolvedSession(updatedSession);
    }
    const completePasswordSignIn = () => {
      setAuthCompleted(true);
      bakeCookies(
        finalUserId,
        resolvedSession?.client_id || resolvedPerson?.client_id || savedClientCookie?.client || savedClientCookie?.client_id,
        resolvedPerson?.person_id || finalUserId
      );
      finalizeLoadedSession(resolvedPersonRef.current || resolvedPerson, resolvedSessionRef.current || resolvedSession);
    };
    try {
      await Auth.signIn({
        username: finalUserId,
        password: String(password).trim(),
        clientMetadata: { avaAccount: finalUserId }
      });
      completePasswordSignIn();
    }
    catch (error) {
      if (isAuthThrottleError(error)) {
        setAlertMessage('AVA is logging you in. We need just a moment please, then we will retry automatically.');
        await pause(THROTTLE_RETRY_DELAY_MS);
        try {
          await Auth.signIn({
            username: finalUserId,
            password: String(password).trim(),
            clientMetadata: { avaAccount: finalUserId }
          });
          setAlertMessage('');
          completePasswordSignIn();
          if (onSubmitPassword) {
            await onSubmitPassword(finalUserId, password);
          }
          return;
        }
        catch (retryError) {
          setAlertMessage(retryError?.message || 'Unable to sign in. Please wait a few seconds and try again.');
          setStep('password');
          return;
        }
      }
      setStep('ready');
      return;
    }
    if (!onSubmitPassword) {
      return;
    }
    setAlertMessage('');
    await onSubmitPassword(finalUserId, password);
  };

  const handleSubmitTfa = () => {
    if (String(tfaInput).trim().toLowerCase() === 'ava-override') {
      setAlertMessage('');
      setStep(tfaNextStep || 'ready');
      return;
    }
    if (!tfaCode || String(tfaInput).trim().toLowerCase() !== String(tfaCode).toLowerCase()) {
      setAlertMessage('Incorrect security code. Please try again.');
      setStep('tfa');
      return;
    }
    setAlertMessage('');
    setStep(tfaNextStep || 'ready');
  };

  React.useEffect(() => {
    let isActive = true;
    const runGenericAuth = async () => {
      if (step !== 'ready' || authCompleted) {
        return;
      }
      const genericUser = process.env.REACT_APP_AVA_PU;
      const genericPass = process.env.REACT_APP_AVA_PP;
      if (!genericUser || !genericPass) {
        setAlertMessage('Unable to sign in. Please contact AVA Support.');
        setStep('user');
        return;
      }
      if (!resolvedSessionRef.current || !resolvedPersonRef.current) {
        return;
      }
      try {
        await Auth.signIn({
          username: genericUser,
          password: String(genericPass).trim(),
          clientMetadata: { avaAccount: genericUser }
        });
        if (!isActive) return;
        setAuthCompleted(true);
        bakeCookies(
          resolvedUserId || userId,
          resolvedSession?.client_id || resolvedPerson?.client_id || savedClientCookie?.client || savedClientCookie?.client_id,
          resolvedPerson?.person_id || resolvedUserId || userId
        );
        finalizeLoadedSession(resolvedPersonRef.current || resolvedPerson, resolvedSessionRef.current || resolvedSession);
      }
      catch (error) {
        if (!isActive) return;
        if (isAuthThrottleError(error)) {
          setStep('user');
          setAlertMessage('AVA is logging you in. We need just a moment please, then we will retry automatically.');
          await pause(THROTTLE_RETRY_DELAY_MS);
          if (!isActive) return;
          try {
            await Auth.signIn({
              username: genericUser,
              password: String(genericPass).trim(),
              clientMetadata: { avaAccount: genericUser }
            });
            if (!isActive) return;
            setAlertMessage('');
            setAuthCompleted(true);
            bakeCookies(
              resolvedUserId || userId,
              resolvedSession?.client_id || resolvedPerson?.client_id || savedClientCookie?.client || savedClientCookie?.client_id,
              resolvedPerson?.person_id || resolvedUserId || userId
            );
            finalizeLoadedSession(resolvedPersonRef.current || resolvedPerson, resolvedSessionRef.current || resolvedSession);
            return;
          }
          catch (retryError) {
            if (!isActive) return;
            setAlertMessage(retryError?.message || 'Unable to sign in. Please wait a few seconds and try again.');
            setStep('user');
            return;
          }
        }
        setAlertMessage(error?.message || 'Unable to sign in. Please try again.');
        setStep('user');
      }
    };

    runGenericAuth();
    return () => {
      isActive = false;
    };
  }, [step, authCompleted, resolvedPerson, resolvedSession, resolvedUserId, userId, savedClientCookie, bakeCookies, finalizeLoadedSession]);

  const urlParams = getUrlParams();

  return (
    <Box
      display='flex'
      flexDirection='column'
      alignItems='center'
      width='100%'
      minHeight='100vh'
      data-patient-id={resolvedPatient?.person_id || ''}
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      } : undefined}
    >
      {showQuickAdd && (
        <QuickAdd
          options={{ client_id: urlParams?.client || urlParams?.client_id || urlParams?.create || resolvedPerson?.client_id || resolvedSession?.client_id || savedClientCookie?.client || savedClientCookie?.client_id }}
          onClose={(createdPersonIds, onSaveCallback = null) => {
          // QuickAdd finished - redirect to login with first created person
          if (createdPersonIds && createdPersonIds.length > 0) {
            const firstPersonId = createdPersonIds[0];
            const baseUrl = window.location.href.split('?')[0];
            let loginUrl = `${baseUrl}?user=${firstPersonId}`;
            if (onSaveCallback) { loginUrl += `&${onSaveCallback}=true`; }
            window.location.replace(loginUrl);
          } else {
            // No accounts created, restart
            restartFromBeginning();
          }
        }}
        />
      )}
      {!backgroundImage && checkinImage ? (
        <Box
          display='flex'
          flexDirection='row'
          justifyContent='center'
          alignItems='center'
          width={'100%'}
          minHeight='100vh'
          maxHeight='100vh'
          overflow={'hidden'}
        >
          <Box
            component="img"
            m={2}
            alt=''
            style={{ width: '100%', height: '100%' }}
            src={checkinImage}
          />
        </Box>
      ) : (
        <React.Fragment>
          <Box
            display='flex'
            flexDirection='column'
            justifyContent='flex-start'
            alignItems='center'
            mt={4}
            mb={2}
          >
            {logoUrl && (
              <Box
                display='flex'
                flexDirection='column'
                justifyContent='center'
                alignItems='center'
                minWidth={100}
                maxWidth={100}
                minHeight={100}
                maxHeight={100}
                borderColor={'black'}
                border={2}
                style={{ borderRadius: '120px', overflow: 'hidden', backgroundColor: 'white', textDecoration: 'none' }}
              >
                <Box
                  component="img"
                  minWidth={'80%'}
                  minHeight={'80%'}
                  alt=''
                  src={logoUrl}
                />
              </Box>
            )}
          </Box>

          {step === 'user' && (
            <Box display='flex' justifyContent='center' width='100%'>
              <Box
                display='flex'
                flexDirection='column'
                alignItems='center'
                justifyContent='center'
                width='80%'
                minWidth='40vw'
                maxWidth='500px'
                className={AVAClass.AVAClientBackground}
                style={loginPanelStyle}
              >
                <Typography style={{ marginLeft: 8, marginBottom: 8, fontSize: '2em', fontWeight: 'bold' }} >
                  {clientName}
                </Typography>
                {namePromptActive && (
                  <Typography style={{ marginLeft: 8, marginBottom: 8 }}>
                    {namePromptMessage}
                  </Typography>
                )}
                <TextField
                  label={namePromptLabel}
                  value={userId}
                  onChange={(event) => {
                    setUserId(event.target.value);
                    if (showCreateAccount) {
                      setShowCreateAccount(false);
                      setCreateAccountEntry('');
                      setCreateAccountType('');
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && userId && !loading) {
                      event.preventDefault();
                      handleSubmitUser();
                    }
                  }}
                  fullWidth
                  variant='outlined'
                  margin='normal'
                  disabled={loading}
                  autoFocus
                />
                {alertMessage && (
                  <Box mt={1}>
                    <Alert severity='error'>
                      {alertMessage}
                    </Alert>
                  </Box>
                )}
                {errorText && (
                  <Typography color='error' variant='body2'>
                    {errorText}
                  </Typography>
                )}
                {showCreateAccount && (
                  <Box mt={1}>
                    <Button
                      color='primary'
                      variant='text'
                      onClick={handleCreateAccount}
                      disabled={loading}
                    >
                      Create a new Account
                    </Button>
                  </Box>
                )}
                <Box mt={2} display='flex' justifyContent={namePromptActive ? 'space-between' : 'flex-end'}>
                  {namePromptActive && (
                    <Button
                      className={AVAClass.AVAButton}
                      variant='outlined'
                      onClick={() => {
                        setAltMatchOptions(null);
                        setAltMatchMode('first');
                        setAltMatchLabel('');
                        setAlertMessage('');
                        setUserId(altOriginalEntry || '');
                        setAltOriginalEntry('');
                        setAltMatchInputType('');
                        setShowCreateAccount(false);
                        setCreateAccountEntry('');
                        setCreateAccountType('');
                      }}
                    >
                      Start Over
                    </Button>
                  )}
                  <Button
                    className={AVAClass.AVAButton}
                    variant='outlined'
                    onClick={handleSubmitUser}
                    disabled={loading || !userId}
                  >
                    Continue
                  </Button>
                </Box>
              </Box>
            </Box>
          )}

          {step === 'password' && (
            <Box display='flex' justifyContent='center' width='100%'>
              <Box
                display='flex'
                flexDirection='column'
                alignItems='center'
                justifyContent='center'
                width='80%'
                maxWidth='500px'
                className={AVAClass.AVAClientBackground}
                style={loginPanelStyle}
              >
                <Typography style={{ marginLeft: 8, marginBottom: 8, fontWeight: 'bold' }}>
                  {(resolvedSession?.forceSetPassword || (clientStyle?.mandatory_passwords && !resolvedSession?.last_login))
                    ? 'Create a new Password'
                    : 'Enter your password'}
                </Typography>
                <TextField
                  label='Password'
                  type='password'
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && password && !loading) {
                      event.preventDefault();
                      handleSubmitPassword();
                    }
                  }}
                  variant='outlined'
                  margin='normal'
                  disabled={loading}
                  autoFocus
                />
                {alertMessage && (
                  <Box mt={1}>
                    <Alert severity='error'>
                      {alertMessage}
                    </Alert>
                  </Box>
                )}
                {errorText && (
                  <Typography color='error' variant='body2'>
                    {errorText}
                  </Typography>
                )}
                <Box mt={2} display='flex' justifyContent='space-between'>
                  <Button
                    className={AVAClass.AVAButton}
                    variant='outlined'
                    onClick={() => setStep('user')}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Box>
                    <Button
                      className={AVAClass.AVAButton}
                      variant='outlined'
                      onClick={onForgotPassword}
                      disabled={loading}
                    >
                      Forgot Password
                    </Button>
                    <Button
                      className={AVAClass.AVAButton}
                      variant='outlined'
                      onClick={handleSubmitPassword}
                      disabled={loading || !password}
                      style={{ marginLeft: 8 }}
                    >
                      Sign In
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {step === 'tfa' && (
            <Box display='flex' justifyContent='center' width='100%'>
              <Box
                display='flex'
                flexDirection='column'
                alignItems='center'
                justifyContent='center'
                width='80%'
                maxWidth='500px'
                className={AVAClass.AVAClientBackground}
                style={loginPanelStyle}
              >
                {tfaMessage && (
                  <Typography style={{ marginLeft: 8, marginBottom: 8 }}>
                    {tfaMessage}
                  </Typography>
                )}
                <TextField
                  label='Security code'
                  value={tfaInput}
                  onChange={(event) => setTfaInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && tfaInput && !loading) {
                      event.preventDefault();
                      handleSubmitTfa();
                    }
                  }}
                  variant='outlined'
                  margin='normal'
                  disabled={loading}
                  autoFocus
                />
                {alertMessage && (
                  <Box mt={1}>
                    <Alert severity='error'>
                      {alertMessage}
                    </Alert>
                  </Box>
                )}
                <Box mt={2} display='flex' justifyContent='space-between'>
                  <Button
                    className={AVAClass.AVAButton}
                    variant='outlined'
                    onClick={() => setStep('user')}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    variant='outlined'
                    onClick={handleSubmitTfa}
                    disabled={loading || !tfaInput}
                    style={{ marginLeft: 8 }}
                  >
                    Continue
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </React.Fragment>
      )}
    </Box>
  );
};

export default LoginModuleV2;
