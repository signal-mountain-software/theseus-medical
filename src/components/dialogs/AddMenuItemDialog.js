import React from 'react';
import useSession from '../../hooks/useSession';

import { recordExists, cl, dbClient, deepCopy, s3 } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import QuickSearch from '../sections/QuickSearch';

import {
  Box, Typography, Dialog, Button, TextField, FormControlLabel, IconButton,
  Radio, RadioGroup, LinearProgress, CircularProgress, Switch, Snackbar
} from '@material-ui/core/';
import Alert from '@material-ui/lab/Alert';
import CancelIcon from '@material-ui/icons/Cancel';

// The three named star-values that can appear as access rules in available_to
// and need to be selectable (and pre-selected) in the QuickSearch dialog.
const SPECIAL_ACCESS_VALUES = [
  { person_id: '*all', first: '* Everybody', last: '' },
  { person_id: '*admin', first: '* Administrators', last: '' },
  { person_id: '*support', first: '* Support Staff', last: '' },
];

function deriveMenuIdBase(titleText = '') {
  const normalized = `${titleText}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'menu_item';
}

function normalizeHexColor(value) {
  if (!value || typeof value !== 'string') { return null; }
  const trimmed = value.trim();
  const shortHex = /^#([0-9a-fA-F]{3})$/;
  const longHex = /^#([0-9a-fA-F]{6})$/;
  if (shortHex.test(trimmed)) {
    const [, hexPart] = trimmed.match(shortHex);
    return `#${hexPart[0]}${hexPart[0]}${hexPart[1]}${hexPart[1]}${hexPart[2]}${hexPart[2]}`;
  }
  if (longHex.test(trimmed)) { return trimmed; }
  return null;
}

function isHeicUrl(url) { return /\.(heic|heif)(\?.*)?$/i.test((url || '').trim()); }

function isHeicFile(file) {
  if (!file) { return false; }
  return /^image\/hei[cf]/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');
}

// Shared decode step used by both HEIC conversion paths below - loaded on demand since
// heic2any is only needed for this rare format.
async function convertHeicBlobToJpegBlob(sourceBlob) {
  const heic2any = (await import('heic2any')).default;
  const convertedResult = await heic2any({ blob: sourceBlob, toType: 'image/jpeg', quality: 0.8 });
  return Array.isArray(convertedResult) ? convertedResult[0] : convertedResult;
}

async function convertHeicFileToJpegFile(sourceFile) {
  try {
    const jpegBlob = await convertHeicBlobToJpegBlob(sourceFile);
    const baseName = (sourceFile.name || 'photo').replace(/\.(heic|heif)$/i, '');
    return new File([jpegBlob], `${baseName}.jpg`, { type: 'image/jpeg' });
  }
  catch (error) {
    console.warn('HEIC file conversion failed:', error.message);
    return null;
  }
}

async function convertHeicUrlToJpegFile(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) { return null; }
    const sourceBlob = await response.blob();
    const jpegBlob = await convertHeicBlobToJpegBlob(sourceBlob);
    const urlBaseName = decodeURIComponent(url.split('/').pop() || '').split('?')[0].replace(/\.(heic|heif)$/i, '');
    return new File([jpegBlob], `${urlBaseName || 'photo'}.jpg`, { type: 'image/jpeg' });
  }
  catch (error) {
    console.warn('HEIC url conversion failed:', error.message);
    return null;
  }
}

function generateMenuThumb(file) {
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
          if (luma >= 28) { brightCount += 1; }
          sampleCount += 1;
        }
        if (!sampleCount) { return true; }
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
          resolve(canvasToDataUrl(canvas));
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

    if (!file.type.startsWith('video/')) { resolve(null); return; }

    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let settled = false;
    const cleanup = () => { URL.revokeObjectURL(url); video.removeAttribute('src'); };
    const done = (value) => {
      if (settled) { return; }
      settled = true;
      cleanup();
      resolve(value);
    };

    const captureFrame = () => {
      try {
        if (!video.videoWidth || !video.videoHeight) { return null; }
        const canvas = toThumbCanvas(video.videoWidth, video.videoHeight, (ctx, sx, sy, side) => {
          ctx.drawImage(video, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
        });
        if (isCanvasMostlyBlack(canvas)) { return null; }
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
      const maxTime = (Number.isFinite(duration) && duration > 0) ? Math.max(0, duration - 0.05) : 0;
      const candidateTimes = [0, 0.15, 0.33, 0.6, 0.85]
        .map((fraction) => (Number.isFinite(duration) && duration > 0 ? Math.min(maxTime, duration * fraction) : 0))
        .filter((time, index, times) => times.findIndex((t) => Math.abs(t - time) < 0.05) === index);

      let candidateIndex = 0;
      const tryNextFrame = () => {
        if (candidateIndex >= candidateTimes.length) { done(null); return; }
        const targetTime = candidateTimes[candidateIndex];
        candidateIndex += 1;
        const captureAtCurrentTime = () => {
          const thumb = captureFrame();
          if (thumb) { done(thumb); } else { tryNextFrame(); }
        };
        if (targetTime <= 0) {
          if (video.readyState >= 2) { captureAtCurrentTime(); } else { video.onloadeddata = captureAtCurrentTime; }
          return;
        }
        video.onseeked = captureAtCurrentTime;
        try {
          video.currentTime = targetTime;
        }
        catch {
          if (video.readyState >= 2) { captureAtCurrentTime(); } else { video.onloadeddata = captureAtCurrentTime; }
        }
      };
      tryNextFrame();
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}

function describeAvailableTo(available_to) {
  const rules = available_to || [];
  if (rules.length === 0 || rules.includes('*none')) { return 'No access assigned'; }

  const denyRules = rules.filter(r => r.startsWith('!'));
  const allowRules = rules.filter(r => !r.startsWith('!'));

  const starRules = allowRules.filter(r => r.trimStart().startsWith('*'));
  const groupIds = allowRules.filter(r => r.startsWith('group:')).map(r => r.slice(6));
  const personIds = allowRules.filter(r => r.startsWith('person:')).map(r => r.slice(7));

  const parts = [];
  if (starRules.length > 0) { parts.push(...starRules); }
  if (groupIds.length > 0) { parts.push(`${groupIds.length} Group${groupIds.length === 1 ? '' : 's'}`); }
  if (personIds.length > 0) { parts.push(`${personIds.length} ${personIds.length === 1 ? 'Person' : 'People'}`); }

  const denyGroupCount = denyRules.filter(r => r.startsWith('!group:')).length;
  const denyPersonCount = denyRules.filter(r => r.startsWith('!person:')).length;
  const denyStarRules = denyRules.filter(r => !r.startsWith('!group:') && !r.startsWith('!person:'));
  const denyParts = [];
  if (denyGroupCount > 0) { denyParts.push(`${denyGroupCount} Group${denyGroupCount === 1 ? '' : 's'}`); }
  if (denyPersonCount > 0) { denyParts.push(`${denyPersonCount} ${denyPersonCount === 1 ? 'Person' : 'People'}`); }
  denyStarRules.forEach(r => denyParts.push(r.slice(1)));
  if (denyParts.length > 0) { parts.push(`except ${denyParts.join(', ')}`); }

  return parts.length > 0 ? parts.join(', ') : 'Everyone';
}

function getUploadSettings(fileSize) {
  const basePartSize = 10 * 1024 * 1024;
  const baseQueueSize = 4;
  if (!fileSize) { return { partSize: basePartSize, queueSize: baseQueueSize }; }
  if (fileSize >= 1024 * 1024 * 1024) { return { partSize: Math.max(basePartSize, 50 * 1024 * 1024), queueSize: Math.max(baseQueueSize, 8) }; }
  if (fileSize >= 200 * 1024 * 1024) { return { partSize: Math.max(basePartSize, 20 * 1024 * 1024), queueSize: Math.max(baseQueueSize, 6) }; }
  return { partSize: basePartSize, queueSize: baseQueueSize };
}

const initialDialogState = () => ({
  type: null,
  linkSource: 'url',
  title: '',
  url: '',
  uploadFiles: [],
  uploadFileIndex: 0,
  uploadFileName: '',
  uploadProgress: 0,
  saving: false,
  targets: [],
  phone: '',
  availableTo: [],
  color: null,
  accessReviewed: false,
  denyMode: false,
  showMessageTargetSearch: false,
  showAccessToSearch: false,
  selections: [],
  groupInfo: null,
  linkedPersonFilter: { raw: '', lower: '' },
  special_values: SPECIAL_ACCESS_VALUES,
  alert: null,
});

/*
  Shared "Add a menu item" dialog, factored out of MainMenuV3.js's inline addMenuDialog +
  handleAddMenuItem (see src/components/sections/MainMenuV3.js for the original, still-in-use
  inline copy) so GroupMenuOptionsSection.js can offer the same card-creation flow under a
  group's private menu without duplicating ~900 lines of dialog/upload/HEIC-conversion logic.
  Fully self-contained: owns its own local state and QuickSearch wiring (QuickSearch only needs
  a reactData-shaped object + an updater, not a specific host component's state).

  Props:
    open          - whether to render the dialog
    client_id     - MenuV3 partition key to write under
    parentMenuId  - existing MenuV3 menu_id that will receive the new item(s) as children
    onClose(result) - called on cancel (result === null) or after a successful save, where
                      result = { success: true, parentMenuId, createdItems: [{menu_id, menuItemRec}] }
*/
export default ({ open, client_id, parentMenuId, onClose }) => {
  const { state } = useSession();
  const AVAClass = AVAclasses();
  const is_support = !!(state.user?.account_class && ['master', 'support', 'admin'].includes(state.user.account_class));

  const uploadInputRef = React.useRef(null);
  const [dlg, setDlg] = React.useState(initialDialogState);
  const updateDlg = (patch) => setDlg(prev => ({ ...prev, ...patch }));

  // Default available_to for the new item: current user + active patient (if different) plus
  // whatever the parent menu item itself already restricts access to - mirrors MainMenuV3's
  // makeDefaultAvailableTo, but sourced from a fresh read of the parent record instead of an
  // in-memory hierarchy, since this component doesn't maintain one.
  React.useEffect(() => {
    if (!open || !parentMenuId || !client_id) { return; }
    let cancelled = false;
    (async () => {
      const parentRes = await dbClient.get({ TableName: 'MenuV3', Key: { client_id, menu_id: parentMenuId } })
        .promise().catch(error => { cl({ 'AddMenuItemDialog: error reading parent menu': error }); return null; });
      if (cancelled) { return; }
      const parentItem = recordExists(parentRes) ? parentRes.Item : null;
      const userId = state.session.user_id;
      const patientId = state.session.patient_id;
      const personEntries = [
        ...(userId ? [`person:${userId}`] : []),
        ...(patientId && patientId !== userId ? [`person:${patientId}`] : []),
      ];
      updateDlg({ availableTo: [...new Set([...personEntries, ...(parentItem?.available_to || [])])] });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parentMenuId, client_id]);

  const addDialogNeedsReview = (availableTo) => {
    if (dlg.accessReviewed) { return false; }
    const userId = state.session.user_id;
    const patientId = state.session.patient_id;
    const defaultPersonEntries = new Set([
      ...(userId ? [`person:${userId}`] : []),
      ...(patientId && patientId !== userId ? [`person:${patientId}`] : []),
    ]);
    return (availableTo || []).every(r => r.startsWith('*') || defaultPersonEntries.has(r));
  };

  async function deriveUniqueMenuId(titleText = '') {
    const baseId = deriveMenuIdBase(titleText);
    let candidateId = baseId;
    let suffix = 2;
    while (true) {
      const existingRec = await dbClient.get({ TableName: 'MenuV3', Key: { client_id, menu_id: candidateId } })
        .promise().catch(error => { cl({ 'AddMenuItemDialog: error checking existing MenuV3 item': error }); });
      if (!recordExists(existingRec)) { return candidateId; }
      candidateId = `${baseId}_${suffix}`;
      suffix += 1;
    }
  }

  async function uploadMenuLinkFile(fileToUpload) {
    const bucketName = `125549937716-${client_id.toLowerCase().replace(/[^a-zA-Z0-9-]/g, '-')}`;
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
      updateDlg({ uploadProgress: progressPercent });
    });

    const uploadResponse = await new Promise((resolve, reject) => {
      uploadTask.send((err, good) => { if (err) { reject(err); } else { resolve(good); } });
    });

    updateDlg({ uploadProgress: 100 });
    return uploadResponse;
  }

  async function handleAddMenuItem() {
    const titleText = (dlg.title || '').trim();
    const itemType = dlg.type || (!is_support ? 'link' : null);
    const phoneDigits = (dlg.phone || '').replace(/\D/g, '');
    const linkSource = dlg.linkSource || 'url';
    const urlText = (dlg.url || '').trim();
    const uploadFiles = dlg.uploadFiles || [];
    const messageTargets = ([dlg.targets].flat())
      .filter((targetRec) => !!(targetRec && (targetRec.person_id || targetRec.group_id || targetRec.rIndex !== undefined)))
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
          return { group_id: targetRec.group_id, group_name: targetRec.group_name || targetRec.group_id };
        }
        return { rIndex: targetRec.rIndex };
      });

    if (!titleText) {
      updateDlg({ alert: { severity: 'warning', title: 'Missing title', message: 'Please provide a title for the new card.' } });
      return;
    }
    if ((itemType === 'link') && (linkSource === 'url') && !urlText) {
      updateDlg({ alert: { severity: 'warning', title: 'Missing URL', message: 'Please provide a URL when the card type is Link.' } });
      return;
    }
    if ((itemType === 'link') && (linkSource === 'upload') && uploadFiles.length === 0) {
      updateDlg({ alert: { severity: 'warning', title: 'Missing file', message: 'Please choose a file to upload when link source is Upload.' } });
      return;
    }
    if ((itemType === 'message_target') && (messageTargets.length === 0)) {
      updateDlg({ alert: { severity: 'warning', title: 'Missing targets', message: 'Choose one or more people or groups for this one-tap Message.' } });
      return;
    }
    if ((itemType === 'phone_dial') && (phoneDigits.length !== 10)) {
      updateDlg({ alert: { severity: 'warning', title: 'Invalid phone number', message: 'Please enter a 10-digit US phone number.' } });
      return;
    }
    if (!parentMenuId) {
      updateDlg({ alert: { severity: 'error', title: 'Missing parent', message: 'Unable to determine which parent menu should receive this new card.' } });
      return;
    }

    updateDlg({ saving: true, uploadProgress: 0 });

    const parentRec = await dbClient.get({ TableName: 'MenuV3', Key: { client_id, menu_id: parentMenuId } })
      .promise().catch(error => { cl({ 'AddMenuItemDialog: error reading parent MenuV3 record': error }); });

    if (!recordExists(parentRec)) {
      updateDlg({ saving: false, alert: { severity: 'error', title: 'Parent not found', message: 'Unable to find the parent menu for this level.' } });
      return;
    }

    // Multi-file upload: upload each file, create one menu card per file, then return.
    if ((itemType === 'link') && (linkSource === 'upload')) {
      const createdCells = [];
      const failedFiles = [];
      for (let fi = 0; fi < uploadFiles.length; fi++) {
        let fileToUpload = uploadFiles[fi];
        updateDlg({ uploadFileIndex: fi, uploadProgress: 0 });
        let fileUrl = '';
        let thumbDataUrl = null;
        try {
          if (isHeicFile(fileToUpload)) {
            const convertedFile = await convertHeicFileToJpegFile(fileToUpload);
            if (convertedFile) { fileToUpload = convertedFile; }
          }
          thumbDataUrl = await generateMenuThumb(fileToUpload);
          if (!thumbDataUrl && fileToUpload?.type?.startsWith('video/')) {
            thumbDataUrl = 'https://ava-icons.s3.amazonaws.com/movie.png';
          }
          const uploadResponse = await uploadMenuLinkFile(fileToUpload);
          fileUrl = uploadResponse?.Location || '';
        }
        catch (error) {
          cl({ 'AddMenuItemDialog: error uploading menu link file': error });
          failedFiles.push(fileToUpload.name || `file ${fi + 1}`);
          continue;
        }
        if (!fileUrl) { failedFiles.push(fileToUpload.name || `file ${fi + 1}`); continue; }
        const cardTitle = uploadFiles.length === 1 ? titleText : `${titleText} ${fi + 1}`;
        const newMenuId = await deriveUniqueMenuId(cardTitle);
        const newMenuRec = {
          client_id,
          menu_id: newMenuId,
          available_to: dlg.availableTo,
          description: { long: cardTitle, short: cardTitle },
          menu_itemType: 'link',
          url: fileUrl,
          ...(thumbDataUrl ? { icon_thumb: thumbDataUrl } : {}),
          ...(dlg.color ? { color: dlg.color } : {})
        };
        if (parentRec.Item.hasOwnProperty('newItem_availableTo')) {
          newMenuRec.available_to = [];
          parentRec.Item.newItem_availableTo.forEach(p => {
            if (p === '*match') { (state.patient?.groups || []).forEach(g => { newMenuRec.available_to.push(`group:${g}`); }); }
            else { newMenuRec.available_to.push(p); }
          });
        }
        await dbClient.put({ TableName: 'MenuV3', Item: newMenuRec }).promise()
          .catch(error => { cl({ 'AddMenuItemDialog: error creating new MenuV3 record': error }); });
        createdCells.push({ menu_id: newMenuId, menuItemRec: newMenuRec });
      }
      if (createdCells.length === 0) {
        updateDlg({
          saving: false, uploadProgress: 0, uploadFileIndex: 0,
          alert: {
            severity: 'error', title: 'Upload failed',
            message: failedFiles.length > 0
              ? `All uploads failed: ${failedFiles.slice(0, 5).join(', ')}${failedFiles.length > 5 ? ` (+${failedFiles.length - 5} more)` : ''}`
              : 'No files were uploaded successfully.'
          }
        });
        return;
      }
      const updatedChildren = [...(parentRec.Item.children || [])];
      createdCells.forEach(({ menu_id }) => { if (!updatedChildren.includes(menu_id)) updatedChildren.unshift(menu_id); });
      await dbClient.update({
        TableName: 'MenuV3',
        Key: { client_id, menu_id: parentMenuId },
        UpdateExpression: 'set #c = :c',
        ExpressionAttributeNames: { '#c': 'children' },
        ExpressionAttributeValues: { ':c': updatedChildren }
      }).promise().catch(error => { cl({ 'AddMenuItemDialog: error updating parent MenuV3 children': error }); });
      onClose({ success: true, parentMenuId, createdItems: createdCells });
      return;
    }

    let finalLinkUrl = urlText;
    let convertedIconThumb = null;
    if ((itemType === 'link') && isHeicUrl(urlText)) {
      const convertedFile = await convertHeicUrlToJpegFile(urlText);
      if (convertedFile) {
        const uploadResponse = await uploadMenuLinkFile(convertedFile).catch(error => { cl({ 'AddMenuItemDialog: error uploading converted HEIC file': error }); return null; });
        if (uploadResponse?.Location) {
          finalLinkUrl = uploadResponse.Location;
          convertedIconThumb = await generateMenuThumb(convertedFile);
        }
      }
    }
    const newMenuId = await deriveUniqueMenuId(titleText);
    const newMenuItemType = (itemType === 'message_target') ? 'function' : (itemType === 'phone_dial') ? 'link' : itemType;
    const newMenuRec = {
      client_id,
      menu_id: newMenuId,
      available_to: dlg.availableTo,
      description: { long: titleText, short: titleText },
      menu_itemType: newMenuItemType,
      ...(convertedIconThumb ? { icon_thumb: convertedIconThumb } : {}),
      ...(dlg.color ? { color: dlg.color } : {})
    };

    if (itemType === 'link') { newMenuRec.url = finalLinkUrl; }
    else if (itemType === 'phone_dial') { newMenuRec.url = `tel:+1${phoneDigits}`; }
    else if (itemType === 'message_target') {
      newMenuRec.call = { target: 'MessageForm', params: { options: { newMessage: true, recipients: deepCopy(messageTargets) } } };
    }
    else {
      newMenuRec.children = ['add_item_instructions'];
      if (Object.prototype.hasOwnProperty.call(parentRec.Item, 'allow_add')) {
        newMenuRec.allow_add = deepCopy([parentRec.Item.allow_add].flat());
      }
    }

    await dbClient.put({ TableName: 'MenuV3', Item: newMenuRec }).promise()
      .catch(error => { cl({ 'AddMenuItemDialog: error creating new MenuV3 record': error }); });

    const updatedChildren = [...(parentRec.Item.children || [])];
    if (!updatedChildren.includes(newMenuId)) { updatedChildren.unshift(newMenuId); }

    await dbClient.update({
      TableName: 'MenuV3',
      Key: { client_id, menu_id: parentMenuId },
      UpdateExpression: 'set #c = :c',
      ExpressionAttributeNames: { '#c': 'children' },
      ExpressionAttributeValues: { ':c': updatedChildren }
    }).promise().catch(error => { cl({ 'AddMenuItemDialog: error updating parent MenuV3 children': error }); });

    onClose({ success: true, parentMenuId, createdItems: [{ menu_id: newMenuId, menuItemRec: newMenuRec }] });
  }

  if (!open) { return null; }

  return (
    <React.Fragment>
      <Dialog
        open={open}
        onClose={() => { if (!dlg.saving) { onClose(null); } }}
        maxWidth='sm'
        PaperProps={{ style: { borderRadius: '30px', borderWidth: 2, borderStyle: 'solid', borderColor: 'black' } }}
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
            value={dlg.title}
            onChange={(e) => updateDlg({ title: e.target.value })}
          />
          {is_support &&
            <React.Fragment>
              <Typography style={AVATextStyle({ size: 0.95, margin: { top: 1.5, bottom: 0.25 } })}>{'Type'}</Typography>
              <RadioGroup
                row
                value={dlg.type || ''}
                onChange={(e) => {
                  updateDlg({
                    type: e.target.value,
                    targets: (e.target.value === 'message_target') ? dlg.targets : [],
                    selections: (e.target.value === 'message_target') ? dlg.selections : [],
                    phone: (e.target.value === 'phone_dial') ? (dlg.phone || '') : ''
                  });
                }}
              >
                <FormControlLabel value='menu' control={<Radio color='primary' />} label='Sub-Menu' />
                <FormControlLabel value='link' control={<Radio color='primary' />} label='Document, Video, Picture, or Link' />
                <FormControlLabel value='message_target' control={<Radio color='primary' />} label='One-tap Message' />
                <FormControlLabel value='phone_dial' control={<Radio color='primary' />} label='Auto-dial Phone' />
              </RadioGroup>
            </React.Fragment>
          }

          {(dlg.type === 'link' || !is_support) &&
            <React.Fragment>
              <Typography style={AVATextStyle({ size: 0.95, margin: { top: 2, bottom: 0.25 } })}>
                {`Where can we find the Item you're adding?`}
              </Typography>
              <RadioGroup
                row
                value={dlg.linkSource || 'url'}
                onChange={(e) => updateDlg({ linkSource: e.target.value, uploadProgress: 0 })}
              >
                <FormControlLabel value='url' control={<Radio color='primary' />} label='URL' />
                <FormControlLabel value='upload' control={<Radio color='primary' />} label='Upload' />
              </RadioGroup>

              {(dlg.linkSource || 'url') === 'url' &&
                <TextField fullWidth margin='dense' label='URL' value={dlg.url} onChange={(e) => updateDlg({ url: e.target.value })} />
              }

              {(dlg.linkSource || 'url') === 'upload' &&
                <Box mt={1}>
                  <input
                    type='file'
                    ref={uploadInputRef}
                    multiple={true}
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const newFiles = event.target.files ? Array.from(event.target.files) : [];
                      if (newFiles.length === 0) return;
                      event.target.value = '';
                      const existing = dlg.uploadFiles || [];
                      const remaining = Math.max(0, 50 - existing.length);
                      const updated = [...existing, ...newFiles.slice(0, remaining)];
                      updateDlg({
                        uploadFiles: updated,
                        uploadFileIndex: 0,
                        uploadFileName: updated.length === 1 ? updated[0].name : `${updated.length} files queued`,
                        uploadProgress: 0
                      });
                    }}
                  />
                  <Box display='flex' alignItems='center' justifyContent='space-between'>
                    <Button
                      className={AVAClass.AVAButton}
                      variant='contained'
                      color='primary'
                      onClick={() => { if (uploadInputRef.current) { uploadInputRef.current.click(); } }}
                      disabled={dlg.saving || (dlg.uploadFiles || []).length >= 50}
                    >
                      {'Choose File(s) to Upload'}
                    </Button>
                    <Typography style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}>
                      {(dlg.uploadFiles || []).length === 0 ? 'No file selected' : `${(dlg.uploadFiles || []).length} file${(dlg.uploadFiles || []).length > 1 ? 's' : ''} queued`}
                    </Typography>
                  </Box>
                  {(dlg.uploadFiles || []).length > 0 && !dlg.saving &&
                    <Box mt={0.5} display='flex' flexDirection='column'>
                      {(dlg.uploadFiles || []).map((f, fi) => (
                        <Box key={`queued_${fi}`} display='flex' alignItems='center'>
                          <IconButton
                            size='small'
                            style={{ padding: 2 }}
                            onClick={() => {
                              const updated = (dlg.uploadFiles || []).filter((_, i) => i !== fi);
                              updateDlg({
                                uploadFiles: updated,
                                uploadFileName: updated.length === 0 ? '' : updated.length === 1 ? updated[0].name : `${updated.length} files queued`
                              });
                            }}
                          >
                            <CancelIcon style={{ fontSize: '1rem', opacity: 0.6 }} />
                          </IconButton>
                          <Typography style={AVATextStyle({ size: 0.75, margin: { left: 0.5 } })} noWrap>{f.name}</Typography>
                        </Box>
                      ))}
                    </Box>
                  }
                  {(dlg.saving || dlg.uploadProgress > 0) &&
                    <Box mt={1}>
                      <LinearProgress variant='determinate' value={dlg.uploadProgress || 0} />
                      <Typography style={AVATextStyle({ size: 0.75, margin: { top: 0.3 } })}>
                        {(dlg.uploadFiles || []).length > 1
                          ? `Uploading file ${(dlg.uploadFileIndex || 0) + 1} of ${(dlg.uploadFiles || []).length}: ${dlg.uploadProgress || 0}%`
                          : `Upload progress: ${dlg.uploadProgress || 0}%`}
                      </Typography>
                    </Box>
                  }
                </Box>
              }
            </React.Fragment>
          }

          {dlg.type === 'phone_dial' &&
            <React.Fragment>
              <Typography style={AVATextStyle({ size: 0.95, margin: { top: 2, bottom: 0.25 } })}>{'Phone number to dial (10 digits, US only)'}</Typography>
              <TextField
                fullWidth
                margin='dense'
                label='Phone Number'
                value={dlg.phone || ''}
                inputProps={{ maxLength: 14 }}
                onChange={(e) => updateDlg({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                helperText={(dlg.phone || '').length === 10
                  ? `Will dial: +1-${(dlg.phone).slice(0, 3)}-${(dlg.phone).slice(3, 6)}-${(dlg.phone).slice(6)}`
                  : `${(dlg.phone || '').length}/10 digits entered`}
              />
            </React.Fragment>
          }

          {dlg.type === 'message_target' &&
            <React.Fragment>
              <Typography style={AVATextStyle({ size: 0.95, margin: { top: 2, bottom: 0.25 } })}>{'Who should this one-tap message send to?'}</Typography>
              <Box display='flex' flexDirection='row' alignItems='center' justifyContent='space-between'>
                <Button
                  className={AVAClass.AVAButton}
                  variant='contained'
                  color='primary'
                  onClick={() => updateDlg({ showMessageTargetSearch: true, selections: deepCopy(dlg.targets || []) })}
                  disabled={dlg.saving}
                >
                  {'Choose People / Groups'}
                </Button>
                <Typography style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}>
                  {`${(dlg.targets || []).length} target${((dlg.targets || []).length === 1) ? '' : 's'} selected`}
                </Typography>
              </Box>
            </React.Fragment>
          }

          <Box display='flex' flexDirection='row' alignItems='center' mt={2} style={{ marginBottom: 4 }}>
            <Typography style={AVATextStyle({ size: 0.8, margin: { right: 1 } })}>{'Color'}</Typography>
            <Box style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0, border: '2px solid #bbb', backgroundColor: dlg.color || '#f5f5f5', marginRight: 8 }} />
            <input
              type='text'
              placeholder='#rrggbb'
              value={dlg.color || ''}
              onChange={(e) => updateDlg({ color: e.target.value || null })}
              onBlur={(e) => updateDlg({ color: normalizeHexColor(e.target.value) })}
              disabled={dlg.saving}
              style={{ width: 90, fontSize: '0.82rem', fontFamily: 'monospace', padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}
            />
            {!dlg.color &&
              <Typography style={{ marginLeft: 8, fontSize: '0.78rem', color: '#aaa', fontStyle: 'italic' }}>{'Inherited from parent'}</Typography>
            }
            {dlg.color &&
              <Button size='small' style={{ marginLeft: 8, minWidth: 0, padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => updateDlg({ color: null })} disabled={dlg.saving}>
                {'Clear'}
              </Button>
            }
          </Box>

          <Box display='flex' flexDirection='row' alignItems='flex-start' justifyContent='space-between' mt={2}>
            <Box display='flex' flexDirection='column'>
              <Typography style={AVATextStyle({ size: 0.8, bold: true })}>{'Who can see this?'}</Typography>
              <Typography style={AVATextStyle({ size: 0.8 })}>{describeAvailableTo(dlg.availableTo)}</Typography>
            </Box>
            <Box display='flex' flexDirection='column' alignItems='flex-end'>
              <Button
                className={AVAClass.AVAButton}
                size='small'
                style={{ backgroundColor: dlg.denyMode ? '#ffcdd2' : '#c8e6c9' }}
                onClick={() => {
                  const isDenyMode = !!dlg.denyMode;
                  const existingSelections = (dlg.availableTo || [])
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
                  updateDlg({
                    showAccessToSearch: true,
                    groupInfo: null,
                    linkedPersonFilter: { raw: '', lower: '' },
                    selections: existingSelections,
                    special_values: SPECIAL_ACCESS_VALUES,
                  });
                }}
                disabled={dlg.saving}
              >
                {`${dlg.accessReviewed ? 'Change' : 'Set'} ${dlg.denyMode ? 'Exclusions' : 'Access'}`}
              </Button>
              <FormControlLabel
                style={{ marginTop: 4 }}
                control={<Switch size='small' checked={!!dlg.denyMode} onChange={(e) => updateDlg({ denyMode: e.target.checked })} disabled={dlg.saving} />}
                label={<Typography style={AVATextStyle({ size: 0.75 })}>{dlg.denyMode ? 'Deny access' : 'Allow access'}</Typography>}
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
              onClick={async () => { await handleAddMenuItem(); }}
              disabled={dlg.saving || addDialogNeedsReview(dlg.availableTo)}
            >
              {'Add'}
            </Button>
            <Button
              className={AVAClass.AVAButton}
              variant='contained'
              size='small'
              onClick={() => { if (!dlg.saving) { onClose(null); } }}
              disabled={dlg.saving}
            >
              {'Cancel'}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {dlg.showMessageTargetSearch &&
        <QuickSearch
          reactData={dlg}
          updateReactData={updateDlg}
          options={{
            title: 'Select One-tap Message Targets',
            withGroups: true, withPreferred: true, showAll: true, pickAndGo: true, keepSelections: true,
            buttonText: { empty: 'Done', selected: 'Use Selected Targets' }
          }}
          onClose={(selectedTargets) => {
            const cleanTargets = ([selectedTargets].flat()).filter(t => !!(t && (t.person_id || t.group_id || t.rIndex !== undefined)));
            updateDlg({ showMessageTargetSearch: false, targets: cleanTargets, selections: cleanTargets });
          }}
        />
      }

      {dlg.showAccessToSearch &&
        <QuickSearch
          reactData={dlg}
          updateReactData={updateDlg}
          options={{
            title: 'Who Can See This Menu Item?',
            withGroups: true, showGroupList: true, showAll: true, pickAndGo: true, keepSelections: true, withSpecialValues: true,
            buttonText: { empty: 'Done (no restrictions)', selected: 'Use These' }
          }}
          onClose={(selections) => {
            const cleanSelections = ([selections].flat()).filter(s => s && (s.person_id || s.group_id));
            const isDenyMode = !!dlg.denyMode;
            const knownStarValues = new Set(['*all', '*admin', '*support']);
            const keptRules = (dlg.availableTo || []).filter(r =>
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
            updateDlg({ showAccessToSearch: false, availableTo: newAvailableTo, accessReviewed: true, selections: cleanSelections });
          }}
        />
      }

      {dlg.alert &&
        <Snackbar open={!!dlg.alert} autoHideDuration={5000} onClose={() => updateDlg({ alert: null })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => updateDlg({ alert: null })} severity={dlg.alert.severity}>
            {dlg.alert.message}
          </Alert>
        </Snackbar>
      }
    </React.Fragment>
  );
};
