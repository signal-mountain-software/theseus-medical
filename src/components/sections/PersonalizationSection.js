import React from 'react';
import Box from '@material-ui/core/Box';
import { Slider, Typography, Button } from '@material-ui/core';
import { AVATextStyle, AVAclasses, AVADefaults } from '../../util/AVAStyles';
import { s3, cloudfront } from '../../util/AVAUtilities';

import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const AVAClass = AVAclasses();
  const hiddenFileInput = React.useRef(null);

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
        alignItems="center"
        justifyContent="center"
      >
        <Box width={300} >
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
        style={AVATextStyle({ italic: true, margin: { top: 3, bottom: 0.4 } })}
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
            justifyContent='center'
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
                      myImage: newPhoto.Location
                    }, true);
                  }), 'image/jpeg');
              }}
            >
              {'Save this photo'}
            </Button>
          </Box>

        </Box>
        :
        <Box display='flex'
          flexDirection='column'
          justifyContent='center'
          alignItems='center'
          marginTop={2}
        >
          <Box
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
    </Box >
  );
};
