import React from 'react';

import { Box, Button, Dialog, FormControlLabel, LinearProgress, Radio, RadioGroup, TextField, Typography } from '@material-ui/core';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { cl, dbClient, recordExists, s3, uuid } from '../../util/AVAUtilities';
import useSession from '../../hooks/useSession';

export default ({ currentValues }) => {
  const AVAClass = AVAclasses();
  const { state } = useSession();

  const [reactData, setReactData] = React.useState({
    documents: [],
    loading: false,
    saving: false,
    addDialogOpen: false,
    sourceType: 'url',
    description: '',
    comments: '',
    url: '',
    uploadFile: null,
    uploadFileName: '',
    uploadProgress: 0,
  });

  const uploadInputRef = React.useRef(null);

  const person_id = currentValues?.peopleRec?.person_id;

  const updateReactData = (newData) => {
    setReactData((prevValues) => (Object.assign({}, prevValues, newData)));
  };

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

  const uploadDocumentFile = async (fileToUpload) => {
    const bucketName = `125549937716-${state.session.client_id.toLowerCase().replace(/[^a-zA-Z0-9-]/g, '-')}`;
    const nowTime = new Date().getTime();
    const safeName = `${fileToUpload.name || 'upload.bin'}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const keyName = `people_documents/${person_id}/${nowTime}_${safeName}`;
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
        uploadProgress: progressPercent
      });
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

    updateReactData({ uploadProgress: 100 });

    return uploadResponse;
  };

  const loadDocuments = React.useCallback(async () => {
    if (!person_id) {
      updateReactData({ documents: [] });
      return;
    }

    updateReactData({ loading: true });
    const docsRec = await dbClient
      .query({
        KeyConditionExpression: 'person_id = :p',
        TableName: 'PeopleDocuments',
        ExpressionAttributeValues: {
          ':p': person_id
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error reading PeopleDocuments': error });
      });

    let docsList = [];
    if (recordExists(docsRec)) {
      docsList = (docsRec.Items || []).sort((a, b) => {
        const aTime = new Date(a?.added?.added_on || 0).getTime();
        const bTime = new Date(b?.added?.added_on || 0).getTime();
        return bTime - aTime;
      });
    }

    updateReactData({
      documents: docsList,
      loading: false
    });
  }, [person_id]);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const openAddDialog = () => {
    updateReactData({ addDialogOpen: true });
  };

  const closeAddDialog = () => {
    if (reactData.saving) {
      return;
    }
    updateReactData({
      addDialogOpen: false,
      sourceType: 'url',
      description: '',
      comments: '',
      url: '',
      uploadFile: null,
      uploadFileName: '',
      uploadProgress: 0,
    });
  };

  const addDocument = async () => {
    if (!person_id || reactData.saving) {
      return;
    }

    const sourceType = reactData.sourceType || 'url';
    const description = (reactData.description || '').trim();
    const comments = (reactData.comments || '').trim();
    let url = (reactData.url || '').trim();

    if (!description) {
      return;
    }
    if ((sourceType === 'url') && !url) {
      return;
    }
    if ((sourceType === 'upload') && !reactData.uploadFile) {
      return;
    }

    updateReactData({ saving: true, uploadProgress: 0 });

    if (sourceType === 'upload') {
      try {
        const uploadResponse = await uploadDocumentFile(reactData.uploadFile);
        url = uploadResponse?.Location || '';
      }
      catch (error) {
        cl({ 'Error uploading PeopleDocuments file': error });
        updateReactData({ saving: false, uploadProgress: 0 });
        return;
      }
    }

    if (!url) {
      updateReactData({ saving: false, uploadProgress: 0 });
      return;
    }

    const nowISO = new Date().toISOString();
    const document_id = `${new Date().getTime()}.${uuid(6)}`;

    await dbClient
      .put({
        TableName: 'PeopleDocuments',
        Item: {
          person_id,
          document_id,
          description,
          url,
          added: {
            added_by: state.session.user_id,
            added_on: nowISO
          },
          comments
        }
      })
      .promise()
      .catch((error) => {
        cl({ 'Error writing PeopleDocuments': error });
      });

    updateReactData({
      saving: false,
      addDialogOpen: false,
      sourceType: 'url',
      description: '',
      comments: '',
      url: '',
      uploadFile: null,
      uploadFileName: '',
      uploadProgress: 0,
    });

    await loadDocuments();
  };

  return (
    <Box px={2} pt={2} pb={2} display='flex' flexDirection='column' style={{ maxHeight: '60vh' }}>
      {!person_id &&
        <Typography style={AVATextStyle({ size: 0.9, margin: { bottom: 1 } })}>
          Save this person profile first, then you can add person documents.
        </Typography>
      }

      {person_id &&
        <React.Fragment>
          <Dialog
            open={reactData.addDialogOpen}
            onClose={closeAddDialog}
            maxWidth='sm'
            fullWidth
          >
            <Box p={2} display='flex' flexDirection='column'>
              <Typography style={AVATextStyle({ size: 1.0, bold: true, margin: { bottom: 0.5 } })}>
                Add Document
              </Typography>

              <TextField
                margin='dense'
                label='Document Name'
                value={reactData.description}
                onChange={(event) => {
                  updateReactData({ description: event.target.value });
                }}
                fullWidth
                disabled={reactData.saving}
              />

              <TextField
                margin='dense'
                label='Comments'
                value={reactData.comments}
                onChange={(event) => {
                  updateReactData({ comments: event.target.value });
                }}
                fullWidth
                multiline
                minRows={2}
                disabled={reactData.saving}
              />

              <Typography style={AVATextStyle({ size: 0.9, margin: { top: 1, bottom: 0.25 } })}>
                Source
              </Typography>
              <RadioGroup
                row
                value={reactData.sourceType}
                onChange={(event) => {
                  updateReactData({
                    sourceType: event.target.value,
                    uploadProgress: 0
                  });
                }}
              >
                <FormControlLabel value='url' control={<Radio color='primary' />} label='URL' />
                <FormControlLabel value='upload' control={<Radio color='primary' />} label='Upload' />
              </RadioGroup>

              {reactData.sourceType === 'url' &&
                <TextField
                  margin='dense'
                  label='URL'
                  value={reactData.url}
                  onChange={(event) => {
                    updateReactData({ url: event.target.value });
                  }}
                  fullWidth
                  disabled={reactData.saving}
                />
              }

              {reactData.sourceType === 'upload' &&
                <Box mt={1}>
                  <input
                    type='file'
                    ref={uploadInputRef}
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const selectedFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
                      updateReactData({
                        uploadFile: selectedFile,
                        uploadFileName: selectedFile ? selectedFile.name : '',
                        uploadProgress: 0
                      });
                    }}
                  />
                  <Box display='flex' alignItems='center' justifyContent='space-between'>
                    <Button
                      className={AVAClass.AVAButton}
                      variant='contained'
                      color='primary'
                      size='small'
                      onClick={() => {
                        if (uploadInputRef.current) {
                          uploadInputRef.current.click();
                        }
                      }}
                      disabled={reactData.saving}
                    >
                      Choose File
                    </Button>
                    <Typography style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}>
                      {reactData.uploadFileName || 'No file selected'}
                    </Typography>
                  </Box>

                  {(reactData.saving || reactData.uploadProgress > 0) &&
                    <Box mt={1}>
                      <LinearProgress variant='determinate' value={reactData.uploadProgress || 0} />
                      <Typography style={AVATextStyle({ size: 0.75, margin: { top: 0.3 } })}>
                        {`Upload progress: ${reactData.uploadProgress || 0}%`}
                      </Typography>
                    </Box>
                  }
                </Box>
              }

              <Box mt={2} display='flex' justifyContent='flex-end'>
                <Button
                  className={AVAClass.AVAButton}
                  size='small'
                  onClick={closeAddDialog}
                  disabled={reactData.saving}
                >
                  Cancel
                </Button>
                <Button
                  className={AVAClass.AVAButton}
                  color='primary'
                  variant='contained'
                  size='small'
                  onClick={addDocument}
                  disabled={reactData.saving}
                >
                  Add Document
                </Button>
              </Box>
            </Box>
          </Dialog>

          <Box mt={1} mb={1}>
            <Typography style={AVATextStyle({ size: 1.0, bold: true, margin: { bottom: 0.5 } })}>
              Documents
            </Typography>
          </Box>

          <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

            {reactData.loading &&
              <Typography style={AVATextStyle({ size: 0.8 })}>
                Loading...
              </Typography>
            }

            {!reactData.loading && (reactData.documents.length === 0) &&
              <Typography style={AVATextStyle({ size: 0.8 })}>
                No documents added yet.
              </Typography>
            }

            {!reactData.loading && reactData.documents.map((docRec) => (
              <Box key={`people_doc_${docRec.document_id}`} mb={1.2}>
                <Typography
                  style={AVATextStyle({ size: 0.9, bold: true })}
                  onClick={() => {
                    if (docRec.url) {
                      window.open(docRec.url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  {docRec.description || docRec.document_id}
                </Typography>
                {!!docRec.comments &&
                  <Typography style={AVATextStyle({ size: 0.78, margin: { left: 1.5 } })}>
                    {docRec.comments}
                  </Typography>
                }
              </Box>
            ))}
          </Box>

          <Box mt={1.5} display='flex' justifyContent='flex-end'>
            <Button
              className={AVAClass.AVAButton}
              color='primary'
              variant='contained'
              size='small'
              onClick={openAddDialog}
            >
              Add Document
            </Button>
          </Box>
        </React.Fragment>
      }
    </Box>
  );
};
