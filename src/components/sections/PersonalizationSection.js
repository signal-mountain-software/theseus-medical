import React from 'react';
import Box from '@material-ui/core/Box';
import { Slider, Typography, Button, Switch, TextField } from '@material-ui/core';
import { AVATextStyle, AVAclasses, AVADefaults } from '../../util/AVAStyles';
import { s3, cloudfront, isMobile } from '../../util/AVAUtilities';
import Select from 'react-dropdown-select';
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";

export default ({ currentValues, reactData, errorList, setError, updateReactData, updateField }) => {

  const AVAClass = AVAclasses();
  const hiddenFileInput = React.useRef(null);

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

  if (!currentValues.peopleRec.preferred_language) {
    currentValues.peopleRec.preferred_language = 'en';
  }
  else if (Array.isArray(currentValues.peopleRec.preferred_language)) {
    currentValues.peopleRec.preferred_language = currentValues.peopleRec.preferred_language[0];
  }
  let myAnswer = {
    label: languageTable.find(l => {
      return l.value === currentValues.peopleRec.preferred_language;
    }).label,
    value: currentValues.peopleRec.preferred_language
  };
  console.log(myAnswer);

  const defaultHandle = () => {
    let source_address = currentValues.peopleRec.name.first.split(' ')[0];
    source_address += '_';
    source_address += currentValues.peopleRec.name.last.split(' ').reduce(
      (tempName, currentValue, currentIndex) =>
        (currentValue ? (tempName + '_' + currentValue.charAt(0).toUpperCase() + currentValue.slice(1)) : tempName)
    );
    source_address += '-' + reactData.client_name.split(' ').reduce(
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
                    newPhoto = await handleSaveFile({ photo: editedPhoto, temp: false });
                    updateReactData({
                      imageEditing: false,
                      myImage: newPhoto.Location,
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
            style={{ marginLeft: '40px' }}
            component="img"
            minWidth={150}
            maxWidth={150}
            minHeight={150}
            maxHeight={150}
            border={1}
            alt=''
            src={reactData.myImage}
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
                    imageEditing: reactData.myImage
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
        onChange={async (target) => {
          let s3Data = await handleSaveFile({ photo: target.target.files[0], temp: true });
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
              onInputChange={async (values) => {
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
          </React.Fragment>
        </Box>
        <Typography
          style={AVATextStyle({ italic: true, margin: { top: 2, bottom: 0.4 } })}
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
          style={AVATextStyle({ italic: true, margin: { top: 2, bottom: 0.4 } })}
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




    </Box >
  );
};
