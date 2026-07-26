import React from 'react';
import Box from '@material-ui/core/Box';
import { Slider, Typography, Button, Switch, TextField, Checkbox } from '@material-ui/core';
import { AVATextStyle, AVAclasses, AVADefaults } from '../../util/AVAStyles';
import { s3, cloudfront, isMobile, getObject, dbClient } from '../../util/AVAUtilities';
import { createPersonPhotoThumbFromFile } from '../../util/AVAPeople';
import QuickSearch from './QuickSearch';
import Select from 'react-dropdown-select';
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";

export default ({ currentValues, reactData, errorList, setError, updateReactData, updateField }) => {

  const AVAClass = AVAclasses();
  const hiddenFileInput = React.useRef(null);
  const voiceAudioPlayer = React.useRef(new Audio());
  const [showDirectoryQuickSearch, setShowDirectoryQuickSearch] = React.useState(false);
  const [directoryQuickSearch, setDirectoryQuickSearch] = React.useState({
    selections: [],
    linkedPersonFilter: { raw: '', lower: '' }
  });
  const [directoryPartnerName, setDirectoryPartnerName] = React.useState('');
  const directoryPartnerId = currentValues?.peopleRec?.directory_partner;
  const currentPersonId = currentValues?.peopleRec?.person_id;
  const currentFirstName = currentValues?.peopleRec?.name?.first;
  const currentLastName = currentValues?.peopleRec?.name?.last;
  const personId = currentValues?.peopleRec?.person_id;
  const standardImageUrl = personId ? getObject(personId, 'image') : '';
  const thumbnailImageSrc = reactData.myImage || currentValues?.peopleRec?.person_photo || '';
  const [profileImageSrc, setProfileImageSrc] = React.useState(thumbnailImageSrc || standardImageUrl || '');

  React.useEffect(() => {
    let active = true;
    const resolveDirectoryPartnerName = async () => {
      const partnerId = directoryPartnerId;
      if (!partnerId) {
        if (active) { setDirectoryPartnerName(''); }
        return;
      }

      const selfId = currentPersonId;
      if (partnerId === selfId) {
        const selfName = `${currentFirstName || ''} ${currentLastName || ''}`.trim();
        if (active) { setDirectoryPartnerName(selfName || partnerId); }
        return;
      }

      const peopleRec = await dbClient
        .get({
          Key: { person_id: partnerId },
          TableName: 'People'
        })
        .promise()
        .catch(() => null);

      if (!active) { return; }
      const foundName = `${peopleRec?.Item?.name?.first || ''} ${peopleRec?.Item?.name?.last || ''}`.trim();
      setDirectoryPartnerName(foundName || partnerId);
    };

    resolveDirectoryPartnerName();
    return () => {
      active = false;
    };
  }, [directoryPartnerId, currentPersonId, currentFirstName, currentLastName]);

  React.useEffect(() => {
    const audioEl = voiceAudioPlayer.current;
    audioEl.preload = 'auto';
    return () => {
      audioEl.pause();
      audioEl.src = '';
    };
  }, []);

  React.useEffect(() => {
    let isCancelled = false;
    const safeSetImage = (src) => {
      if (!isCancelled) {
        setProfileImageSrc(src || '');
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
      safeSetImage(thumbnailImageSrc || standardImageUrl || '');

      if (thumbnailImageSrc && (await canLoadImage(thumbnailImageSrc))) {
        safeSetImage(thumbnailImageSrc);
      }

      if (standardImageUrl && (await canLoadImage(standardImageUrl))) {
        safeSetImage(standardImageUrl);
      }
    };

    void loadProfileImage();
    return () => {
      isCancelled = true;
    };
  }, [thumbnailImageSrc, standardImageUrl]);

  const languageTable = [
    { label: "English", value: "en" },
    { label: "Afrikaans", value: "af" },
    { label: "Albanian", value: "sq" },
    { label: "Amharic", value: "am" },
    { label: "Arabic", value: "ar" },
    { label: "Armenian", value: "hy" },
    { label: "Azerbaijani", value: "az" },
    { label: "Bengali", value: "bn" },
    { label: "Bosnian", value: "bs" },
    { label: "Bulgarian", value: "bg" },
    { label: "Catalan", value: "ca" },
    { label: "Chinese (Simplified)", value: "zh" },
    { label: "Chinese (Traditional)", value: "zh-TW" },
    { label: "Croatian", value: "hr" },
    { label: "Czech", value: "cs" },
    { label: "Danish", value: "da" },
    { label: "Dari", value: "fa-AF" },
    { label: "Dutch", value: "nl" },
    //    { label: "English", value: "en-US" },
    { label: "Estonian", value: "et" },
    { label: "Farsi (Persian)", value: "fa" },
    { label: "Filipino, Tagalog", value: "tl" },
    { label: "Finnish", value: "fi" },
    { label: "French", value: "fr" },
    { label: "French (Canada)", value: "fr-CA" },
    { label: "Georgian", value: "ka" },
    { label: "German", value: "de" },
    { label: "Greek", value: "el" },
    { label: "Gujarati", value: "gu" },
    { label: "Haitian Creole", value: "ht" },
    { label: "Hausa", value: "ha" },
    { label: "Hebrew", value: "he" },
    { label: "Hindi", value: "hi" },
    { label: "Hungarian", value: "hu" },
    { label: "Icelandic", value: "is" },
    { label: "Indonesian", value: "id" },
    { label: "Irish", value: "ga" },
    { label: "Italian", value: "it" },
    { label: "Japanese", value: "ja" },
    { label: "Kannada", value: "kn" },
    { label: "Kazakh", value: "kk" },
    { label: "Korean", value: "ko" },
    { label: "Latvian", value: "lv" },
    { label: "Lithuanian", value: "lt" },
    { label: "Macedonian", value: "mk" },
    { label: "Malay", value: "ms" },
    { label: "Malayalam", value: "ml" },
    { label: "Maltese", value: "mt" },
    { label: "Marathi", value: "mr" },
    { label: "Mongolian", value: "mn" },
    { label: "Norwegian (Bokmål)", value: "no" },
    { label: "Pashto", value: "ps" },
    { label: "Polish", value: "pl" },
    { label: "Portuguese (Brazil)", value: "pt" },
    { label: "Portuguese (Portugal)", value: "pt-PT" },
    { label: "Punjabi", value: "pa" },
    { label: "Romanian", value: "ro" },
    { label: "Russian", value: "ru" },
    { label: "Serbian", value: "sr" },
    { label: "Sinhala", value: "si" },
    { label: "Slovak", value: "sk" },
    { label: "Slovenian", value: "sl" },
    { label: "Somali", value: "so" },
    { label: "Spanish", value: "es" },
    { label: "Spanish (Mexico)", value: "es-MX" },
    { label: "Swahili", value: "sw" },
    { label: "Swedish", value: "sv" },
    { label: "Tamil", value: "ta" },
    { label: "Telugu", value: "te" },
    { label: "Thai", value: "th" },
    { label: "Turkish", value: "tr" },
    { label: "Ukrainian", value: "uk" },
    { label: "Urdu", value: "ur" },
    { label: "Uzbek", value: "uz" },
    { label: "Vietnamese", value: "vi" },
    { label: "Welsh", value: "cy" }
  ];

  const voicesTable = [
    { label: "Sally", value: "Polly.Salli", sample: 'https://ava-audio.s3.us-east-1.amazonaws.com/Voice_Salli.mp3' },
    { label: "Joanna", value: "Polly.Joanna", sample: 'https://ava-audio.s3.us-east-1.amazonaws.com/Voice_Joanna.mp3' },
    { label: "Ruth", value: "Polly.Ruth", sample: 'https://ava-audio.s3.us-east-1.amazonaws.com/Voice_Ruth.mp3' },
    { label: "Stephen", value: "Polly.Stephen", sample: 'https://ava-audio.s3.us-east-1.amazonaws.com/Voice_Stephen.mp3' },
    { label: "Matthew", value: "Polly.Matthew", sample: 'https://ava-audio.s3.us-east-1.amazonaws.com/Voice_Matthew.mp3' },
  ];

  if (!currentValues.peopleRec.preferred_language) {
    currentValues.peopleRec.preferred_language = 'en';
  }
  else if (Array.isArray(currentValues.peopleRec.preferred_language)) {
    currentValues.peopleRec.preferred_language = currentValues.peopleRec.preferred_language[0] || 'en';
  }
  const foundLanguage = languageTable.find(l => l.value === currentValues.peopleRec.preferred_language);
  let myAnswer = {
    label: foundLanguage?.label || 'English',
    value: foundLanguage?.value || 'en'
  };

  if (!currentValues.peopleRec.preferred_voice) {
    currentValues.peopleRec.preferred_voice = voicesTable[0].value;
  }
  else if (Array.isArray(currentValues.peopleRec.preferred_voice)) {
    currentValues.peopleRec.preferred_voice = currentValues.peopleRec.preferred_voice[0];
  }

  const playVoiceSample = async (voiceValue) => {
    const selectedVoice = voicesTable.find(v => v.value === voiceValue);
    if (!selectedVoice || !selectedVoice.sample) {
      return;
    }

    const audioEl = voiceAudioPlayer.current;
    audioEl.pause();
    audioEl.currentTime = 0;
    if (audioEl.src !== selectedVoice.sample) {
      audioEl.src = selectedVoice.sample;
      audioEl.load();
    }

    if (audioEl.readyState < 3) {
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        const timeoutId = setTimeout(() => {
          audioEl.removeEventListener('canplaythrough', onCanPlayThrough);
          finish();
        }, 350);
        const onCanPlayThrough = () => {
          clearTimeout(timeoutId);
          audioEl.removeEventListener('canplaythrough', onCanPlayThrough);
          finish();
        };
        audioEl.addEventListener('canplaythrough', onCanPlayThrough);
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {
      const fallbackAudio = new Audio(selectedVoice.sample);
      fallbackAudio.play().catch(() => { });
    });
  };
  console.log(myAnswer);

  const defaultHandle = () => {
    let source_address = currentValues.peopleRec.name.first.split(' ')[0];
    source_address += '_';
    source_address += currentValues.peopleRec.name.last.split(' ').reduce(
      (tempName, currentValue, currentIndex) =>
        (currentValue ? (tempName + '_' + currentValue.charAt(0).toUpperCase() + currentValue.slice(1)) : tempName)
    );
    source_address += '-' + (reactData.client_name || currentValues.peopleRec.client_id || '').split(' ').reduce(
      (tempName, currentValue, currentIndex) =>
        tempName + ((currentIndex === 0) ? '' : '_') + currentValue.charAt(0).toUpperCase() + currentValue.slice(1)
    );
    return source_address;
  };

  let upload;
  async function handleSaveFile({
    photo: pTarget,
    temp
  }) {
    let pType = pTarget.type;
    upload = s3.upload({
      partSize: 10 * 1024 * 1024,
      queueSize: 4,
      Bucket: 'theseus-medical-storage',
      Key: `${temp ? 'TEMP__' : 'public/patients/'}${pTarget.name}`,
      Body: pTarget,
      ACL: 'public-read-write',
      ContentType: pType
    });
    let s3Resp = await performUpload();
    if (!temp) {
      s3.deleteObject({
        Bucket: 'theseus-medical-storage',
        Key: `TEMP__${reactData.imageEditing}`,
      }).promise();
      await cloudfront
        .createInvalidation({
          DistributionId: 'E3DXPQ4WCODC8A',
          InvalidationBatch: {
            CallerReference: new Date().getTime().toString(),
            Paths: {
              Quantity: 1,
              Items: [`/${currentValues.peopleRec.person_id}.jpg`]
            }
          }
        })
        .promise()
        .catch(err => { console.log(`clearing cache - cloudfront invalidation error`); });
    }
    return s3Resp;

    function performUpload() {
      return new Promise(function (resolve, reject) {
        upload
          .send((err, good) => {
            if (err) {
              reject({});
            }
            else {
              resolve(good);
            }
          });
      });
    };
  };

  return (
    <Box
      key={`personalizationSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box flexGrow={1}
        display="flex"
        flexDirection='column'
        alignItems="flex-start"
        justifyContent="center"
      >
        <Box width={300} style={{ marginLeft: '16px' }}>
          <Slider
            value={currentValues.sessionRec.customizations?.font_size || 1}
            onChange={async (event, newValue) => {
              AVADefaults({ fontSize: newValue });
              await updateField({
                updateList:
                  [{
                    tableName: 'sessionRec',
                    fieldName: 'customizations.font_size',
                    newData: newValue
                  }]
              });
            }}
            aria-labelledby="continuous-slider"
            step={.1}
            min={1}
            max={5}
          />
        </Box>
        <Typography key={`default-fontsize`}
          style={{
            fontSize: `${currentValues.sessionRec.customizations?.font_size || 1}rem`,
            lineHeight: 1.2,
            overflow: ('hidden')
          }}
        >
          {`This is the default font size for ${currentValues.peopleRec.name?.first} ${currentValues.peopleRec.name?.last}`}
        </Typography>
      </Box>
      <Typography
        style={AVATextStyle({ margin: { top: 2, bottom: 0.4 } })}
      >
        {`Load and customize your photo here`}
      </Typography>
      {reactData.imageEditing
        ?
        <Box display='flex'
          flexDirection='column'
          justifyContent='center'
          alignItems='center'
          marginTop={2}
        >
          <Cropper
            zoomTo={0.5}
            style={{ width: "100%", height: "400px" }}
            aspectRatio={1 / 1}
            src={reactData.imageEditing}
            viewMode={0}
            minCropBoxHeight={150}
            minCropBoxWidth={150}
            background={false}
            responsive={true}
            dragMode={'move'}
            movable={true}
            autoCropArea={1}
            checkOrientation={false}
            onInitialized={(instance) => {
              updateReactData({
                cropperInstance: instance
              }, true);
            }}
          />
          <Box display='flex'
            flexDirection='row'
            justifyContent='flex-start'
            alignItems='center'
            marginTop={1}
          >
            <Button
              onClick={async () => {
                reactData.cropperInstance.rotate(90);
              }}
              className={AVAClass.AVAButton}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
            >
              {'Rotate'}
            </Button>
            <Button
              onClick={async () => {
                reactData.cropperInstance.destroy();
                updateReactData({
                  imageEditing: false
                }, true);
              }}
              className={AVAClass.AVAButton}
              style={{ marginLeft: 3, backgroundColor: 'white', color: 'red' }}
              size='small'
            >
              {'Cancel edits'}
            </Button>
            <Button
              className={AVAClass.AVAButton}
              size='small'
              style={{ marginLeft: 3, backgroundColor: 'white', color: 'green' }}
              onClick={async () => {
                let newPhoto;
                reactData.cropperInstance
                  .getCroppedCanvas()
                  .toBlob((async (pBlob) => {
                    let editedPhoto = new File([pBlob], `${currentValues.peopleRec.person_id}.jpg`, { type: 'image/jpeg' });
                    const personThumb = await createPersonPhotoThumbFromFile(editedPhoto);
                    newPhoto = await handleSaveFile({ photo: editedPhoto, temp: false });
                    if (personThumb) {
                      await updateField({
                        updateList: [{
                          tableName: 'peopleRec',
                          fieldName: 'person_photo',
                          newData: personThumb
                        }]
                      });
                    }
                    updateReactData({
                      imageEditing: false,
                      myImage: personThumb || newPhoto.Location,
                      OKtoSave: true,
                    }, true);
                  }), 'image/jpeg');
              }}
            >
              {'Keep this photo'}
            </Button>
          </Box>

        </Box>
        :
        <Box display='flex'
          flexDirection='column'
          justifyContent='center'
          alignItems='flex-start'
          marginTop={1}
        >
          <Box
            style={{ marginLeft: '40px', objectFit: 'cover', objectPosition: 'center' }}
            component="img"
            width={150}
            height={150}
            border={1}
            alt=''
            src={profileImageSrc}
          />
          <Box display='flex'
            flexDirection='row'
            justifyContent='center'
            alignItems='center'
            marginTop={1}
          >
            <Button
              onClick={async () => {
                hiddenFileInput.current.click();
              }}
              className={AVAClass.AVAButton}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
            >
              {'Upload a new Photo'}
            </Button>
            {reactData.myImage &&
              <Button
                className={AVAClass.AVAButton}
                style={{ marginLeft: 3, backgroundColor: 'white', color: 'black' }}
                size='small'
                onClick={async () => {
                  updateReactData({
                    imageEditing: getObject(currentValues.peopleRec.person_id, 'image')
                  }, true);
                }}
              >
                {'Edit this photo'}
              </Button>
            }
          </Box>
        </Box>
      }
      <input
        type="file"
        style={{ display: 'none' }}
        ref={hiddenFileInput}
        onChange={async (event) => {
          const photoFile = event.target.files?.[0];
          if (!photoFile) {
            return;
          }
          let s3Data = await handleSaveFile({ photo: photoFile, temp: true });
          updateReactData({
            imageEditing: s3Data.Location,
          }, true);
        }}
      />


      <React.Fragment>
        <Box
          key={`selectBox_filterdrop`}
          display='flex' flexGrow={1} flexDirection='column'
          marginTop={2}
          pt={1} pb={1}
        >
          <React.Fragment>
            <Select
              options={languageTable}
              searchBy={'label'}
              style={{
                fontSize: '1rem',
                marginLeft: -5,
                marginBottom: -4,
                marginTop: 1,
                borderWidth: 0
              }}
              dropdownHandle={true}
              variant={'standard'}
              dropdownPosition={'auto'}
              values={(currentValues.peopleRec.preferred_language
                ? [myAnswer]
                : [{ label: 'English', value: 'en' }]
              )}
              clearable={true}
              clearOnSelect={false}
              placeholder={'Please select your preferred language'}
              clearOnBlur={false}
              key={`selectBox_filterdrop_select`}
              searchable={true}
              multi={false}
              closeOnClickInput={true}
              closeOnSelect={true}
              create={true}
              keepSelectedInList={true}
              noDataLabel={''}
              onChange={async (values) => {
                if (values.length > 0) {
                  await updateField({
                    updateList:
                      [{
                        tableName: 'peopleRec',
                        fieldName: 'preferred_language',
                        newData: values[0].value
                      }]
                  });
                }
              }}
            />
            <Box display='flex'
              flexDirection='row'
              minWidth={'100%'}
              paddingTop={'4px'}
              key={`select_wrapper_box`}
              borderTop={1}
            >
              <Typography
                style={AVATextStyle({ size: 0.9, opacity: '40%', margin: { left: 0, top: 0, bottom: 0.5 } })}
              >
                {`My preferred language`}
              </Typography>
            </Box>

            <Typography
              style={AVATextStyle({ margin: { top: 2, bottom: 0.4 } })}
            >
              {`You can customize the voice AVA uses when we call you on the phone. Tap a voice below to preview and select.`}
            </Typography>
            <Box display='flex'
              flexDirection='row'
              justifyContent='flex-start'
              alignItems='center'
              marginTop={1}
              flexWrap='wrap'
            >
              {voicesTable.map((voiceOption) => (
                <Button
                  key={`voice_sample_${voiceOption.value}`}
                  onClick={async () => {
                    if (currentValues.peopleRec.preferred_voice !== voiceOption.value) {
                      await updateField({
                        updateList:
                          [{
                            tableName: 'peopleRec',
                            fieldName: 'preferred_voice',
                            newData: voiceOption.value
                          }]
                      });
                    }
                    playVoiceSample(voiceOption.value);
                  }}
                  className={AVAClass.AVAButton}
                  style={{
                    marginLeft: 0,
                    marginRight: 6,
                    marginBottom: 4,
                    backgroundColor: 'white',
                    fontWeight: currentValues.peopleRec.preferred_voice === voiceOption.value ? 700 : 400,
                    color: currentValues.peopleRec.preferred_voice === voiceOption.value ? 'red' : null
                  }}
                  size='small'
                >
                  {`${currentValues.peopleRec.preferred_voice === voiceOption.value ? '✓ ' : ''}${voiceOption.label}`}
                </Button>
              ))}
            </Box>
          </React.Fragment>
        </Box>
        <Typography
          style={AVATextStyle({ margin: { top: 2, bottom: 0.4 } })}
        >
          {`When someone receives a message from me via e-Mail, use this as my e-Mail name`}
        </Typography>
        <TextField
          multiline
          style={isMobile ? AVATextStyle({ width: '60%', margin: { left: 0.5 } }) : AVATextStyle({ margin: { left: 1 } })}
          key={`email_handle`}
          error={errorList.hasOwnProperty(`email_sourceAddress`)}
          defaultValue={currentValues.peopleRec.email_sourceAddress || defaultHandle()}
          helperText='e-Mail name'
          onBlur={async (event) => {
            if (event.target.value !== (currentValues.peopleRec.email_sourceAddress || defaultHandle())) {
              const validateEmail = (email) => {
                let eRegEx = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                let response = eRegEx.test(email);
                return response;
              };
              event.target.value = event.target.value.replace(' ', '.');
              if (!validateEmail(`${event.target.value}@ava.io`)) {
                setError({
                  errorField: 'email_sourceAddress',
                  errorValue: event.target.value,
                  isError: true,
                  errorMessage: `${event.target.value} isn't a useable in an e-Mail address.`
                });
                return;
              }
              else if (!event.target.value || !event.target.value.trim()) {
                // empty; revert to default
                event.target.value = defaultHandle();
              }
              else {
                await updateField({
                  updateList:
                    [{
                      tableName: 'peopleRec',
                      fieldName: 'email_sourceAddress',
                      newData: event.target.value
                    }],
                  errorObj: {
                    errorField: 'email_sourceAddress',
                    isError: false
                  }
                });
              }
            }
          }}
        />




        <Typography
          style={AVATextStyle({ margin: { top: 2, bottom: 0.4 } })}
        >
          {`If requested, use this information to identify me in messages I send`}
        </Typography>
        <TextField
          multiline
          style={isMobile ? AVATextStyle({ width: '60%', margin: { left: 0.5 } }) : AVATextStyle({ margin: { left: 1 } })}
          key={`message_tag`}
          defaultValue={currentValues.peopleRec.message_tag || ''}
          helperText='Message Tag'
          onBlur={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'message_tag',
                  newData: event.target.value
                }]
            });
          }}
        />
      </React.Fragment>


      {!reactData.new_messaging_required &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {'Messaging Version'}
          </Typography>
          <Box flexGrow={2} display='flex' alignItems='center'
            justifyContent='flex-start' marginBottom={1} flexDirection='row'>
            <Typography
              style={AVATextStyle({
                size: 0.8, margin: { right: 0.8 },
                bold: !currentValues.peopleRec.useNewMessaging
              })}
            >
              {'Legacy'}
            </Typography>
            <Switch
              checked={currentValues.peopleRec.useNewMessaging}
              onClick={async (event) => {
                await updateField({
                  updateList:
                    [{
                      tableName: 'peopleRec',
                      fieldName: 'useNewMessaging',
                      newData: !currentValues.peopleRec.useNewMessaging
                    }]
                });
              }}
              name="MessagingStyle"
              color="primary"
            />
            <Typography
              style={AVATextStyle({
                size: 0.8, margin: { left: 0.8 },
                bold: currentValues.peopleRec.useNewMessaging
              })}
            >
              {'New'}
            </Typography>
          </Box>
        </React.Fragment>
      }



      <Typography
        style={AVATextStyle({ margin: { top: 2, bottom: 0.4 } })}
      >
        {`Enter (optional) text below to display with ${currentValues.peopleRec.name?.first || 'this person'}'s directory listing`}
      </Typography>
      <TextField
        multiline
        style={isMobile ? AVATextStyle({ width: '60%', margin: { left: 0.5 } }) : AVATextStyle({ margin: { left: 1 } })}
        key={`role_or_title`}
        defaultValue={currentValues.peopleRec.role_or_title || ''}
        helperText='Role/Title'
        onBlur={async (event) => {
          await updateField({
            updateList:
              [{
                tableName: 'peopleRec',
                fieldName: 'role_or_title',
                newData: event.target.value
              }]
          });
        }}
      />

      
              <React.Fragment>
                <Typography
                  style={AVATextStyle({ margin: { top: 1.5 } })}
                >
                  {`Directory Option`}
                </Typography>
                <Box
                  display='flex'
                  flexDirection='column'
                  marginLeft={-0.5}
                  marginTop={-0}
                  flexWrap={'wrap'}
                >
                  {[{ option: 'include', label: 'Include my info' },
                  { option: 'exclude', label: 'Exclude me' },
                  { option: 'no_contact', label: `Include me, but do not show my Contact Info` },
                  { option: 'merge', label: `Show with someone else${directoryPartnerName ? ` (${directoryPartnerName})` : ''}` },
                  ].map((this_option, tIndex) => (
                    <Box
                      display='flex'
                      flexDirection='row'
                      alignItems={'center'}
                      key={`Directory_option__${tIndex}`}
                      style={{ marginRight: '24px' }}
                    >
                      <Checkbox
                        aria-label={`Directory_option__${tIndex}`}
                        name={`Directory_option__${tIndex}`}
                        key={`Directory_option__${tIndex}`}
                        style={{ paddingTop: '2px', paddingBottom: '2px' }}
                        size='small'
                        checked={((currentValues.peopleRec.directory_option === this_option.option)
                          || ((this_option.option === 'include')
                            && (!currentValues.peopleRec.directory_option || currentValues.peopleRec.directory_option === 'normal')))
                        }
                        onClick={async () => {
                          if (this_option.option === 'merge') {
                            if (currentValues.peopleRec.directory_option === 'merge') {
                              return;
                            }
                            setDirectoryQuickSearch({
                              selections: [],
                              linkedPersonFilter: { raw: '', lower: '' }
                            });
                            setShowDirectoryQuickSearch(true);
                            return;
                          }
                          await updateField({
                            updateList:
                              [{
                                tableName: 'peopleRec',
                                fieldName: 'directory_option',
                                newData: this_option.option
                              },
                              {
                                tableName: 'peopleRec',
                                fieldName: 'directory_partner',
                                newData: null
                              }]
                          });
                        }}
                        disableRipple
                        inputProps={{ 'aria-labelledby': `message_routing_3` }}
                      />
                      <Typography style={AVATextStyle({ size: 0.8, margin: { left: -0.4 } })} >
                        {`${this_option.label}`}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </React.Fragment>

      {showDirectoryQuickSearch &&
        <QuickSearch
          reactData={directoryQuickSearch}
          updateReactData={(newData) => {
            setDirectoryQuickSearch(prev => Object.assign({}, prev, newData));
          }}
          options={{
            keepSelections: true,
            withGroups: false,
            withPreferred: false,
            hidePeople: false,
            pickOne: true,
            showAll: true,
            title: 'Select the account to show with',
            buttonText: { empty: 'Cancel', selected: 'Select' }
          }}
          onClose={async (selections) => {
            setShowDirectoryQuickSearch(false);
            if (Array.isArray(selections) && selections.length > 0 && selections[0].person_id) {
              await updateField({
                updateList: [{
                  tableName: 'peopleRec',
                  fieldName: 'directory_option',
                  newData: 'merge'
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'directory_partner',
                  newData: selections[0].person_id
                }]
              });
            }
            else {
              await updateField({
                updateList: [{
                  tableName: 'peopleRec',
                  fieldName: 'directory_partner',
                  newData: null
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'directory_option',
                  newData: 'include'
                }]
              });
            }
          }}
        />
      }
      




    </Box >
  );
};
