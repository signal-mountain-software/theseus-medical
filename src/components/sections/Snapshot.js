import React from 'react';

import useSession from '../../hooks/useSession';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import { Box, Typography, Button } from '@material-ui/core/';
import { formatPhone, createPersonPhotoThumbFromUrl, persistPersonPhotoThumb } from '../../util/AVAPeople';
import { getPersonGroups, isLeaf } from '../../util/AVAGroups';
import { deepCopy, titleCase, getObject, s3, cloudfront, cl } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import SendIcon from '@material-ui/icons/Send';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import TextsmsIcon from '@material-ui/icons/Textsms';

import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import MakeMessage from '../forms/MakeMessage';

export default ({ currentValues, reactData, updateReactData }) => {

  const { state } = useSession();
  const isMounted = React.useRef(false);
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm')); // checks if current device is a smart phone
  const thumbBackfillInProgressRef = React.useRef({});
  const canonicalUploadInProgressRef = React.useRef({});

  const AVAClass = AVAclasses();
  const personId = currentValues?.peopleRec?.person_id;
  const standardImageUrl = personId ? getObject(personId, 'image') : '';
  const resolvePhotoSourceCandidate = (sourceValue) => {
    const pickSourceString = (value) => {
      if (!value) { return ''; }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || '';
      }
      if (Array.isArray(value)) {
        for (const entry of value) {
          const found = pickSourceString(entry);
          if (found) { return found; }
        }
        return '';
      }
      if (typeof value === 'object') {
        const preferredKeys = ['url', 'location', 'Location', 'value', 'src', 'href', 'photo_source', 'photoSource'];
        for (const key of preferredKeys) {
          const found = pickSourceString(value[key]);
          if (found) { return found; }
        }
        for (const nested of Object.values(value)) {
          const found = pickSourceString(nested);
          if (found) { return found; }
        }
      }
      return '';
    };

    const rawCandidate = pickSourceString(sourceValue);
    if (!rawCandidate) {
      return '';
    }

    if (rawCandidate.startsWith('http://') || rawCandidate.startsWith('https://') || rawCandidate.startsWith('data:image/')) {
      return rawCandidate;
    }

    if (rawCandidate.startsWith('s3://')) {
      const withoutPrefix = rawCandidate.slice(5);
      const firstSlash = withoutPrefix.indexOf('/');
      if (firstSlash > 0) {
        const bucket = withoutPrefix.slice(0, firstSlash);
        const key = withoutPrefix.slice(firstSlash + 1);
        return `https://${bucket}.s3.amazonaws.com/${encodeURI(key)}`;
      }
      return '';
    }

    return getObject(rawCandidate);
  };

  const peoplePhotoSourceUrl = resolvePhotoSourceCandidate(
    currentValues?.peopleRec?.photo_source || currentValues?.peopleRec?.photoSource
  );
  const thumbnailImageSrc = reactData.myImage || currentValues?.peopleRec?.person_photo || '';
  const [snapshotImageSrc, setSnapshotImageSrc] = React.useState(thumbnailImageSrc || standardImageUrl || peoplePhotoSourceUrl || '');

  const parseS3UrlToBucketAndKey = (locationUrl) => {
    if (!locationUrl || (typeof locationUrl !== 'string')) {
      return null;
    }
    if (locationUrl.startsWith('s3://')) {
      const withoutPrefix = locationUrl.replace('s3://', '');
      const firstSlash = withoutPrefix.indexOf('/');
      if (firstSlash < 1) {
        return null;
      }
      return {
        bucket: withoutPrefix.slice(0, firstSlash),
        key: decodeURIComponent(withoutPrefix.slice(firstSlash + 1))
      };
    }
    try {
      const parsed = new URL(locationUrl);
      const host = String(parsed.hostname || '').toLowerCase();
      let bucket = '';
      let key = decodeURIComponent(String(parsed.pathname || '').replace(/^\/+/, ''));

      const bucketInHost = host.match(/^(.*?)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i);
      if (bucketInHost?.[1]) {
        bucket = bucketInHost[1];
      }
      else if (host === 's3.amazonaws.com' || /^s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(host)) {
        const parts = key.split('/').filter(Boolean);
        if (parts.length > 1) {
          bucket = parts.shift();
          key = parts.join('/');
        }
      }

      if (!bucket || !key) {
        return null;
      }
      return { bucket, key };
    }
    catch (_error) {
      return null;
    }
  };

  const uploadPhotoSourceToCanonical = async (photoUrl) => {
    if (!personId || !photoUrl) {
      return false;
    }
    if (canonicalUploadInProgressRef.current[personId]) {
      return false;
    }

    canonicalUploadInProgressRef.current[personId] = true;
    try {
      const targetBucket = 'theseus-medical-storage';
      const targetKey = `public/patients/${personId}.jpg`;

      let canonicalSaved = false;
      const source = parseS3UrlToBucketAndKey(photoUrl);

      if (source?.bucket && source?.key) {
        try {
          const encodedSourceKey = source.key.split('/').map(pathPart => encodeURIComponent(pathPart)).join('/');
          await s3.copyObject({
            CopySource: `${source.bucket}/${encodedSourceKey}`,
            Bucket: targetBucket,
            Key: targetKey,
            ACL: 'public-read-write'
          }).promise();
          canonicalSaved = true;
        }
        catch (copyError) {
          cl({ snapshot_canonical_copy_warning: copyError, personId, photoUrl });
        }
      }

      if (!canonicalSaved) {
        const sourceResponse = await fetch(photoUrl);
        if (!sourceResponse.ok) {
          return false;
        }
        const sourceBlob = await sourceResponse.blob();
        if (!sourceBlob || sourceBlob.size === 0) {
          return false;
        }

        await s3.upload({
          Bucket: targetBucket,
          Key: targetKey,
          Body: sourceBlob,
          ACL: 'public-read-write',
          ContentType: sourceBlob.type || 'image/jpeg'
        }).promise();
      }

      await cloudfront
        .createInvalidation({
          DistributionId: 'E3DXPQ4WCODC8A',
          InvalidationBatch: {
            CallerReference: new Date().getTime().toString(),
            Paths: {
              Quantity: 1,
              Items: [`/${personId}.jpg`]
            }
          }
        })
        .promise()
        .catch(() => { });

      return true;
    }
    catch (error) {
      cl({ snapshot_canonical_upload_error: error, personId, photoUrl });
      return false;
    }
    finally {
      delete canonicalUploadInProgressRef.current[personId];
    }
  };

  React.useEffect(() => {
    let isCancelled = false;
    const safeSetImage = (src) => {
      if (!isCancelled) {
        setSnapshotImageSrc(src || '');
      }
    };

    const canLoadImage = (src) => {
      return new Promise((resolve) => {
        if (!src) {
          resolve(false);
          return;
        }
        const preload = new Image();
        preload.onload = () => resolve(true);
        preload.onerror = () => resolve(false);
        preload.src = src;
      });
    };

    const loadProfileImage = async () => {
      safeSetImage(thumbnailImageSrc || standardImageUrl || peoplePhotoSourceUrl || '');
      let loadedThumbnailSrc = '';

      if (thumbnailImageSrc) {
        const thumbLoaded = await canLoadImage(thumbnailImageSrc);
        if (thumbLoaded) {
          loadedThumbnailSrc = thumbnailImageSrc;
          safeSetImage(thumbnailImageSrc);
        }
      }

      let resolvedFullImageSrc = '';
      let resolvedFromPhotoSourceFallback = false;
      if (standardImageUrl && (await canLoadImage(standardImageUrl))) {
        resolvedFullImageSrc = standardImageUrl;
      }
      else if (peoplePhotoSourceUrl && (await canLoadImage(peoplePhotoSourceUrl))) {
        resolvedFullImageSrc = peoplePhotoSourceUrl;
        resolvedFromPhotoSourceFallback = true;
      }

      if (!resolvedFullImageSrc) {
        if (!loadedThumbnailSrc) {
          safeSetImage('');
        }
        return;
      }

      if (resolvedFromPhotoSourceFallback && personId) {
        const uploadedToCanonical = await uploadPhotoSourceToCanonical(resolvedFullImageSrc);
        if (uploadedToCanonical) {
          const refreshedCanonicalUrl = getObject(personId, 'image');
          if (refreshedCanonicalUrl && (await canLoadImage(refreshedCanonicalUrl))) {
            resolvedFullImageSrc = refreshedCanonicalUrl;
            resolvedFromPhotoSourceFallback = false;
          }
        }
      }

      safeSetImage(resolvedFullImageSrc);

      const hasUsableThumb = !!loadedThumbnailSrc;
      const isBackfillInProgress = !!thumbBackfillInProgressRef.current[personId];
      if (!personId || hasUsableThumb || isBackfillInProgress) {
        return;
      }

      thumbBackfillInProgressRef.current[personId] = true;
      try {
        let generatedThumb = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          let thumbCandidates = [resolvedFullImageSrc];
          if (personId) {
            thumbCandidates.unshift(getObject(personId, 'image'));
          }
          thumbCandidates = thumbCandidates.filter(Boolean);

          for (const candidate of thumbCandidates) {
            generatedThumb = await createPersonPhotoThumbFromUrl(candidate);
            if (generatedThumb) {
              break;
            }
          }
          if (generatedThumb) {
            break;
          }
        }
        if (!generatedThumb && resolvedFromPhotoSourceFallback && standardImageUrl) {
          generatedThumb = await createPersonPhotoThumbFromUrl(standardImageUrl);
        }
        if (!generatedThumb) {
          return;
        }

        await persistPersonPhotoThumb(personId, generatedThumb);
        if (isCancelled) {
          return;
        }

        currentValues.peopleRec.person_photo = generatedThumb;
        updateReactData({
          myImage: generatedThumb,
          currentValues
        }, true);
      }
      finally {
        delete thumbBackfillInProgressRef.current[personId];
      }
    };

    void loadProfileImage();

    return () => {
      isCancelled = true;
    };
  }, [standardImageUrl, peoplePhotoSourceUrl, personId, thumbnailImageSrc]);

  const getCategoryColor = (categoryName) => {
    const palette = [
      '#e3f2fd', // light blue
      '#e8f5e9', // light green
      '#fff3e0', // light orange
      '#f3e5f5', // light purple
      '#e0f7fa', // light cyan
      '#fce4ec', // light pink
      '#f9fbe7', // light lime
      '#fff8e1', // light amber
    ];
    if (!categoryName) { return palette[0]; }
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
      hash = (hash * 31 + categoryName.charCodeAt(i)) & 0xffff;
    }
    return palette[hash % palette.length];
  };

  const sanitizeLocation = (value) => {
    if (!value) return '';
    return String(value)
      .replace(/undefined/g, '')
      .trim()
      .replace(/^[\s,;:]+|[\s,;:]+$/g, '');
  };

  const makeName = (person_id) => {
    let peopleList = state.accessList?.[state.session.client_id].list;
    let foundPerson = peopleList?.find(p => p.person_id === person_id);
    if (foundPerson) {
      return `${foundPerson.name.first} ${foundPerson.name.last}`;
    }
    else {
      return null;
    }
  };

  const makeLocation = () => {
    const addressStyle = state.session?.profile_style?.address_on_snapshot;
    if (addressStyle === '*none') { return ''; }
    if (addressStyle === 'short') {
      const city = currentValues.peopleRec.address?.city || currentValues.peopleRec.address?.address?.city;
      const stateVal = currentValues.peopleRec.address?.state || currentValues.peopleRec.address?.address?.state;
      const parts = [city && titleCase(city), stateVal].filter(Boolean);
      return sanitizeLocation(parts.join(', '));
    }
    if (currentValues.peopleRec.hasOwnProperty('address') && currentValues.peopleRec.address) {
      if ((!currentValues.peopleRec.address || Object.keys(currentValues.peopleRec.address).length === 0) && currentValues.peopleRec.location) {
        return sanitizeLocation(currentValues.peopleRec.location);
      }
      else {
        // adress is expected to be address.adress, address.adress2, address.city, address.state, address.zip - 
        // if street exists, convert that to new style - address.address  
        if (currentValues.peopleRec.address.street) {
          if (!currentValues.peopleRec.address.address) {
            currentValues.peopleRec.address.address = currentValues.peopleRec.address.street;
          }
           delete currentValues.peopleRec.address.street;
        }
        if (currentValues.peopleRec.address.address1) {
          if (!currentValues.peopleRec.address.address) {
            currentValues.peopleRec.address.address = currentValues.peopleRec.address.address1;
          }
           delete currentValues.peopleRec.address.address1;
        }
        // Filter out nullish values and join with spaces
        let addressParts = '';
        if (currentValues.peopleRec.address.address
          && currentValues.peopleRec.address.address.trim() !== ''
          && currentValues.peopleRec.address.address.includes('undefined') !== true
        ) {
          addressParts += titleCase(currentValues.peopleRec.address.address) + " ";
        }
        if (currentValues.peopleRec.address.address2
          && currentValues.peopleRec.address.address2.trim() !== ''
          && currentValues.peopleRec.address.address2.includes('undefined') !== true
        ) {
          addressParts += titleCase(currentValues.peopleRec.address.address2) + " ";
        }
        if (currentValues.peopleRec.address.city
          && currentValues.peopleRec.address.city.trim() !== ''
          && currentValues.peopleRec.address.city.includes('undefined') !== true
        ) {
          addressParts += titleCase(currentValues.peopleRec.address.city) + ", ";
        }
        if (currentValues.peopleRec.address.state
          && currentValues.peopleRec.address.state.trim() !== ''
          && currentValues.peopleRec.address.state.includes('undefined') !== true
        ) {
          addressParts += currentValues.peopleRec.address.state + " ";
        }
        const zipValue = currentValues.peopleRec.address.zip_code || currentValues.peopleRec.address.zip;
        if (zipValue
          && zipValue.trim() !== ''
          && zipValue.includes('undefined') !== true
        ) {
          addressParts += zipValue;
        }
        return sanitizeLocation(addressParts);
      }
    }
    else {
      return sanitizeLocation(currentValues.peopleRec.location);
    }
  };

  React.useEffect(() => {
    async function initialize() {
      let reactUpdObj = {};
      const personId = currentValues.peopleRec.person_id;
      const clientId = state.session.client_id;
      const allGroups = await getPersonGroups(personId, clientId);
      const personLeafGroups = [];
      for (const g of allGroups) {
        if (await isLeaf(g, allGroups, clientId)) { personLeafGroups.push(g.trim()); }
      }
      reactUpdObj.personLeafGroups = personLeafGroups;
      if (!reactData.accessList) {
        if (!state.accessList) {
          if (isMounted.current) {
            updateReactData({
              alert: {
                severity: 'warning',
                title: 'Still loading Account information',
                message: `AVA is still loading.  Wait just a moment and try again, please.`
              }
            }, true);
          }
        }
        else {
          reactUpdObj.accessList = deepCopy(state.accessList[state.session.client_id].list);
          if (!currentValues.peopleRec.hasOwnProperty('proxy_allowed_from')) {
            currentValues.peopleRec.proxy_allowed_from = {};
            reactUpdObj.currentValues = currentValues;
          }
        }
      }
      if (Object.keys(reactUpdObj).length > 0) {
        updateReactData(reactUpdObj, true);
      }
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box display='flex' alignItems='center'
        style={{ marginBottom: '16px' }}
        flexWrap={'wrap'}
        justifyContent='flex-start' flexDirection='row'>
        <Box
          component="img"
          width={150}
          height={150}
          border={1}
          mr={2}
          alt=''
          src={snapshotImageSrc}
          style={{ objectFit: 'cover', objectPosition: 'center' }}
        />
        <Box
          key={`profileSection_masterBox`}
          flexGrow={2} pr={2} pt={0} pb={2} display='flex' flexDirection='column'
        >
          <Typography
            style={AVATextStyle({ margin: { top: 1 }, bold: true, size: 2 })}
          >
            {`${currentValues.peopleRec.name?.first} ${currentValues.peopleRec.name?.last}`}
          </Typography>
          <Typography
            style={AVATextStyle({ bold: true, size: 1 })}
          >
            {makeLocation()}
          </Typography>
          {currentValues.peopleRec.checkout_message &&
            <Typography
              style={AVATextStyle({ bold: true, size: 1 })}
            >
              {currentValues.peopleRec.checkout_message}
            </Typography>
          }

          {/* Display leaf groups sourced from PeopleGroups table */}
          {reactData.personLeafGroups && reactData.personLeafGroups.length > 0 && (() => {
            const leafGroups = reactData.personLeafGroups;
            return (
              <Box display='flex' flexDirection='column' style={{ marginTop: '12px' }}>
                <Typography style={AVATextStyle({ size: 0.8 })}>
                  {'Groups:'}
                </Typography>
                {leafGroups.map((group_id, idx) => {
                  // Find the group name
                  const groupInfo = state.groups?.adminHierarchy?.find(g => g.id === group_id);
                  const groupName = groupInfo?.name ||
                    state.groups?.publicGroups?.[group_id]?.group_name ||
                    state.groups?.privateGroups?.[group_id]?.group_name ||
                    null;

                  if (!groupName) { return null; }

                  // Find the parent's name
                  const parentId = groupInfo?.belongs_to;
                  const parentInfo = parentId ? state.groups?.adminHierarchy?.find(g => g.id === parentId) : null;
                  const parentName = parentInfo?.name || null;

                  return (
                    <Typography
                      key={`group__${idx}`}
                      style={AVATextStyle({ size: 0.8, margin: { left: 1 }, bold: true })}
                    >
                      {parentName ? `${parentName} / ${groupName}` : groupName}
                    </Typography>
                  );
                })}
              </Box>
            );
          })()}

          {(Object.keys(reactData.local_customFields).length > 0) && Object.keys(reactData.local_customFields).map((this_customField, cFNdx) => (
            (currentValues.peopleRec?.local_data?.[this_customField] &&
              <Box
                key={`local_box__${cFNdx}`}
                display='flex' flexDirection='row'
                style={{ marginTop: ((cFNdx === 0) ? '12px' : '4px') }}
              >
                <Typography
                  key={`local_prompt__${cFNdx}a`}
                  style={AVATextStyle({ size: 0.8 })}
                >
                  {`${reactData.local_customFields[this_customField].prompt || titleCase(this_customField.replace(/[^a-z^A-Z^0-9]/g, " "))}:`}
                </Typography>
                <Typography
                  key={`local_prompt__${cFNdx}b`}
                  style={AVATextStyle({ size: 0.8, margin: { left: 0.5 }, bold: true })}
                >
                  {currentValues.peopleRec?.local_data?.[this_customField]}
                </Typography>
              </Box>
            )
          ))}
          {(Object.keys(reactData.form_fields).length > 0) && Object.keys(reactData.form_fields).map((this_formField, cFNdx) => (
            <React.Fragment
              key={`fraglocal_box__${cFNdx}`}
            >
              {reactData.form_fields[this_formField].snapshot && reactData.form_fields[this_formField].value &&
                <Box
                  key={`local_box__${cFNdx}`}
                  display='flex' flexDirection='row'
                  style={{ marginTop: ((cFNdx === 0) ? '12px' : '4px') }}
                >
                  <Typography
                    key={`local_prompt__${cFNdx}c`}
                    style={AVATextStyle({ size: 0.8 })}
                  >
                    {reactData.form_fields[this_formField].fieldRec.prompt.value}
                  </Typography>
                  <Typography
                    key={`local_prompt__${cFNdx}d`}
                    style={AVATextStyle({ size: 0.8, margin: { left: 0.5 }, bold: true })}
                  >
                    {reactData.form_fields[this_formField].fieldRec?.value?.type === 'date'
                      ? makeDate(reactData.form_fields[this_formField].value).absolute_withAge
                      : reactData.form_fields[this_formField].value
                    }
                  </Typography>
                </Box>
              }
            </React.Fragment>
          ))}

        </Box>
      </Box>
      {(currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms) &&
        <a href={`tel:${currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms}`}
          key={`callCell`}
          style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography
            style={AVATextStyle({ margin: { top: 0.5 }, size: 1.5 })}
          >
            {`${isMobile ? 'Cell' : 'Cell phone:'} ${(formatPhone(currentValues.peopleRec?.contact_info?.cell?.number
              ? currentValues.peopleRec.contact_info.cell.number
              : (currentValues.peopleRec?.messaging?.sms || '')
            ))}`}
          </Typography>
        </a>
      }
      {(currentValues.peopleRec?.contact_info?.work?.number) &&
        <a href={`tel:${currentValues.peopleRec?.contact_info?.work?.number}`}
          key={`callWork_text`}
          style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography
            style={AVATextStyle({ margin: { top: 0.5 }, size: 1.5 })}
          >
            {`${isMobile ? 'Work' : 'Work phone:'} ${(formatPhone(currentValues.peopleRec?.contact_info?.work?.number))}`}
          </Typography>
        </a>
      }
      {(currentValues.peopleRec?.contact_info?.home?.number || currentValues.peopleRec?.contact_info?.landline?.number || currentValues.peopleRec?.messaging?.voice) &&
        <a href={`tel:${currentValues.peopleRec?.contact_info?.home?.number || currentValues.peopleRec?.contact_info?.landline?.number || currentValues.peopleRec?.messaging?.voice}`}
          key={`callHome_text`}
          style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography
            style={AVATextStyle({ margin: { top: 0.5 }, size: 1.5 })}
          >
            {`${isMobile ? 'Home' : 'Home phone:'} ${(formatPhone(currentValues.peopleRec?.contact_info?.home?.number
              || currentValues.peopleRec?.contact_info?.landline?.number
              || currentValues.peopleRec?.messaging?.voice
              || '')
            )}`}
          </Typography>
        </a>
      }
      {(currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email) &&
        <a href={`mailto:${currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email}`}
          key={`eMailMe_text`}
          style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography
            style={AVATextStyle({ margin: { top: 0.5 }, size: 1.5 })}
          >
            {`${isMobile ? '' : 'e-Mail: '}${currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email}`}
          </Typography>
        </a>
      }
      {(currentValues.familyRecs && currentValues.familyRecs.length > 0) &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`${currentValues.peopleRec.name?.first}'s family:`}
          </Typography>
          <Box
            display='flex'
            flexDirection='row'
            alignItems={'flex-start'}

            key={`family_primary`}
          >
            <Typography
              style={AVATextStyle({ margin: { top: 0, left: 1 }, bold: true })}
              onClick={async () => {
                updateReactData({
                  viewFamilyMember: currentValues.familyRecs[0]?.primary_contact?.id || currentValues.peopleRec.person_id
                }, true);
              }}
            >
              {`${makeName(currentValues.familyRecs[0]?.primary_contact?.id) || currentValues.familyRecs[0]?.primary_contact?.name?.trim() || currentValues.familyRecs[0]?.primary_contact?.id || 'None Recorded'}`}
            </Typography>
            <Typography style={AVATextStyle({ margin: { top: 0, left: 0.5, right: -0.8 }, bold: true })}>
              {'- Primary'}
            </Typography>
          </Box>
          {currentValues.familyRecs[0]?.other_members && currentValues.familyRecs[0].other_members.sort((p1, p2) => {
            if (p1.role !== p2.role) {
              return ((p1.role > p2.role) ? 1 : -1);
            }
            else {
              return ((p1.name > p2.name) ? 1 : -1);
            }
          }).map((this_member, memberNdx) => (
            <Box
              display='flex'
              flexDirection='row'
              alignItems={'flex-start'}

              key={`family_${memberNdx}`}
            >
              <Typography
                style={AVATextStyle({ margin: { top: 0, left: 1 }, bold: true })}
                onClick={async () => {
                  updateReactData({
                    viewFamilyMember: this_member.id
                  }, true);
                }}
              >
                {`${makeName(this_member?.id) || this_member?.name.trim() || this_member?.id || 'Unknown Person'}`}
              </Typography>
              <Typography style={AVATextStyle({ margin: { top: 0, left: 0.5, right: -0.8 }, bold: true })}>
                {this_member.role && this_member.role === 'primary' ? '- Primary' : (this_member.relationship ? ('- ' + this_member.relationship) : '')}
              </Typography>
            </Box>
          ))}
        </React.Fragment>
      }
      {currentValues.peopleRec.proxy_allowed_from &&
        (Object.keys(currentValues.peopleRec.proxy_allowed_from).length > 0) &&
        reactData.accessList &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`${currentValues.peopleRec.name?.first}'s Caregiver(s):`}
          </Typography>
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            {reactData.accessList.map((this_item, tIndex) => (
              currentValues.peopleRec.proxy_allowed_from.hasOwnProperty(this_item.person_id) &&
              <Button
                className={AVAClass.AVAButton_noBorder}
                key={`parent_button__${tIndex}`}
                onClick={async () => {
                  updateReactData({
                    viewFamilySnapshot: this_item.person_id
                  }, true);
                }}
                style={{ marginLeft: '18px', backgroundColor: 'white', color: 'black' }}
                size='small'
                startIcon={<SendIcon size='small' />}
              >
                <Box display='flex' alignItems='center'
                  key={`parent_box__${tIndex}`}
                  justifyContent='flex-end' flexDirection='column'>
                  <Typography
                    key={`parent_name__${tIndex}`}
                    style={AVATextStyle({ margin: { top: 0, left: 0 }, bold: true })}
                  >
                    {`${this_item.first} ${this_item.last}`}
                  </Typography>
                </Box>
              </Button>
            )
            )}
          </Box>
        </React.Fragment>
      }
      {currentValues.peopleRec.hasOwnProperty('person_notes') &&
        (currentValues.peopleRec.person_notes.length > 0) &&
        (currentValues.peopleRec.person_notes.some(n => n.urgent)) &&
        <Box display='flex' alignItems='flex-start' justifyContent='flex-start' flexDirection='column'>
          <Typography
            key={`note_head`}
            style={AVATextStyle({ margin: { top: 1, bottom: 0.2 } })}
          >
            {`Notes:`}
          </Typography>
          {currentValues.peopleRec.person_notes.filter(n => n.urgent).map((this_note, uNx) => (
            <Box
              display='flex'
              alignItems='flex-start'
              justifyContent='flex-start'
              flexDirection='column'
              key={`note_box-${uNx}`}
              style={{
                marginTop: '4px',
                marginBottom: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                width: '87%',
                backgroundColor: getCategoryColor(this_note.category),
                ...(this_note.urgent ? {
                  borderLeft: '4px solid #f54927',
                  paddingLeft: '6px',
                } : {}),
              }}
            >
              {!!this_note.name &&
                <Typography
                  key={`note_name-${uNx}`}
                  style={AVATextStyle({ margin: { top: 0.25, bottom: 0 }, size: 0.9, bold: this_note.urgent || false })}
                >
                  {this_note.name}
                </Typography>
              }
              {!!this_note.noteText &&
                <Typography
                  key={`note_text-${uNx}`}
                  style={AVATextStyle({ margin: { top: 0.25, bottom: 0 }, size: 0.85 })}
                >
                  {this_note.noteText}
                </Typography>
              }
              <Typography
                key={`note_tag-${uNx}`}
                style={AVATextStyle({ margin: { top: 0, bottom: 0.25 }, size: 0.6 })}
              >
                {[this_note.user_name, this_note.last_update].filter(Boolean).join(' \u00b7 ')}
              </Typography>
            </Box>
          ))}
        </Box>
      }
      <Box
        display='flex'
        alignItems={'center'}
        justifyContent='space-between' flexDirection='row'
        key={`bottom_row`}
        style={{ marginTop: '24px' }}
      >
        <Box
          display='flex'
          alignItems={'center'}
          justifyContent='flex-start' flexDirection='row'
          key={`bottom_buttons`}
          flexWrap={'wrap'}
          style={{}}
        >
          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            <Button
              key={`sendMessagesButton`}
              onClick={async () => {
                updateReactData({
                  sendMessage: true
                }, true);
              }}
              className={AVAClass.AVAButton}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<SendIcon size='small' />}
            >
              <Box display='flex' alignItems='center'
                key={`sendMessages`}
                justifyContent='flex-end' flexDirection='column'>
                <Typography
                  key={`sendMessage`}
                  style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                >
                  {`Message`}
                </Typography>
              </Box>
            </Button>
          }
          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms) &&
            <React.Fragment>
              <Button
                className={AVAClass.AVAButton}
                key={`callCellButton`}
                style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
                size='small'
                startIcon={<PhoneInTalkIcon size='small' />}
              >
                <a href={`tel:${currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms}`}
                  key={`callCell_button`}
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Typography
                    key={`callCell_words`}
                    style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                  >
                    {`Call Cell`}
                  </Typography>
                </a>
              </Button>
              <Button
                className={AVAClass.AVAButton}
                key={`textCellButton`}
                style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
                size='small'
                startIcon={<TextsmsIcon size='small' />}
              >
                <a href={`sms:${currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms}`}
                  key={`callCell_button`}
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Typography
                    key={`textCell_words`}
                    style={AVATextStyle({ margin: { right: 0.5 }, size: 1.2 })}
                  >
                    {`Text Msg`}
                  </Typography>
                </a>
              </Button>
            </React.Fragment>
          }






          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec?.contact_info?.home?.number || currentValues.peopleRec?.contact_info?.landline?.number || currentValues.peopleRec?.messaging?.voice) &&
            <Button
              className={AVAClass.AVAButton}
              key={`callHomeButton`}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<PhoneInTalkIcon size='small' />}
            >
              <a href={`tel:${currentValues.peopleRec?.contact_info?.home?.number || currentValues.peopleRec?.contact_info?.landline?.number || currentValues.peopleRec?.messaging?.voice}`}
                key={`callHome_button`}
                style={{ color: 'inherit', textDecoration: 'none' }}>
                <Typography
                  key={`callHome_words`}
                  style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                >
                  {`Call Home`}
                </Typography>
              </a>
            </Button>
          }


          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email) &&
            <Button
              className={AVAClass.AVAButton}
              key={`eMailButton`}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<SendIcon size='small' />}
            >
              <a href={`mailto:${currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email}`}
                key={`eMailMe`}
                style={{ color: 'inherit', textDecoration: 'none' }}>
                <Typography
                  key={`eMail_words`}
                  style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                >
                  {`e-Mail`}
                </Typography>
              </a>
            </Button>

          }





















          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec.contact_info?.work?.number) &&
            <Button
              className={AVAClass.AVAButton}
              key={`callWorkButton`}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<PhoneInTalkIcon size='small' />}
            >
              <a href={`tel:${currentValues.peopleRec.contact_info.work.number}`}
                key={`callWork`}
                style={{ color: 'inherit', textDecoration: 'none' }}>
                <Typography
                  key={`callWork_words`}
                  style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                >
                  {`Call Work`}
                </Typography>
              </a>
            </Button>
          }
        </Box>
      </Box>
      {(reactData.administrative_account || (state.session.user_id === currentValues.peopleRec.person_id)) &&
        <Box display='flex' alignItems='center'
          justifyContent='flex-end' flexDirection='row'>
          <Typography
            style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
          >
            {`User ID: ${currentValues.peopleRec.person_id}`}
          </Typography>
        </Box>
      }

      {reactData.sendMessage &&
        <MakeMessage
          titleText={`Send a message to ${currentValues.peopleRec.name?.first} ${currentValues.peopleRec.name?.last}`}
          promptText={['Subject', `What should your message to ${currentValues.peopleRec.name?.first} say?`]}
          promptUse={['subject', 'message']}
          buttonText={'Send'}
          sender={{
            "client_id": state.session.client_id,
            "patient_id": state.session.user_id,
            "patient_display_name": state.session.user_display_name
          }}
          pRecipientID={currentValues.peopleRec.person_id}
          pRecipientName={`${currentValues.peopleRec.name?.first} ${currentValues.peopleRec.name?.last}`}
          onCancel={() => {
            updateReactData({
              sendMessage: false
            }, true);
          }}
          onComplete={() => {
            updateReactData({
              sendMessage: false
            }, true);
          }}
          setMethod={null}
          allowCancel={true}
        />
      }

      {reactData.viewFamilySnapshot &&
        <PeopleMaintenance
          person_id={reactData.viewFamilySnapshot}
          initialValues={{ color: 'green' }}
          options={{ sectionToShow: 'Snapshot' }}
          onClose={() => {
            updateReactData({
              viewFamilySnapshot: false
            }, true);
          }}
        />
      }

      {reactData.viewFamilyMember &&
        <PeopleMaintenance
          person_id={reactData.viewFamilyMember}
          initialValues={{ color: 'turquoise' }}
          onClose={() => {
            updateReactData({
              viewFamilyMember: false
            }, true);
          }}
        />
      }
    </Box>
  );
};
