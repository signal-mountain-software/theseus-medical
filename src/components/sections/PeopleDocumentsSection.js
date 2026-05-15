import React from 'react';

import { Box, Button, Dialog, FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Radio, RadioGroup, Select, TextField, Typography } from '@material-ui/core';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { cl, dbClient, recordExists, s3, uuid } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { makeName } from '../../util/AVAPeople';
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
    category: 'General',
  });

  const uploadInputRef = React.useRef(null);
  const [expandedCategories, setExpandedCategories] = React.useState(new Set());
  const docCategories = [...new Set(['General', ...([state.session?.client_style?.document_categories].flat().filter(Boolean))])].sort();

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
      const sorted = (docsRec.Items || []).sort((a, b) => {
        const aTime = new Date(a?.added?.added_on || 0).getTime();
        const bTime = new Date(b?.added?.added_on || 0).getTime();
        return bTime - aTime;
      });
      // Resolve person IDs to display names
      const uniqueIds = [...new Set(sorted.map(d => d.added?.added_by).filter(Boolean))];
      const nameMap = {};
      await Promise.all(uniqueIds.map(async id => {
        nameMap[id] = await makeName(id);
      }));
      docsList = sorted.map(d => ({
        ...d,
        added: d.added ? { ...d.added, added_by_name: nameMap[d.added.added_by] || d.added.added_by } : d.added
      }));
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
      category: 'General',
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
          category: reactData.category || 'General',
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
      category: 'General',
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
            PaperProps={{ style: { borderRadius: '30px', padding: '8px' } }}
          >
            <Box p={2} display='flex' flexDirection='column'>
              <Typography style={AVATextStyle({ size: 1.0, bold: true, margin: { bottom: 0.5 } })}>
                Add Document
              </Typography>

              <FormControl size='small' fullWidth style={{ marginTop: '8px', marginBottom: '8px' }}>
                <InputLabel id='doc-category-label'>Category</InputLabel>
                <Select
                  labelId='doc-category-label'
                  value={reactData.category || 'General'}
                  onChange={(event) => {
                    updateReactData({ category: event.target.value });
                  }}
                  disabled={reactData.saving}
                >
                  {docCategories.map(c => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>

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
                  style={{ backgroundColor: 'white', color: 'black' }}
                  size='small'
                  onClick={closeAddDialog}
                  disabled={reactData.saving}
                >
                  Cancel
                </Button>
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'white', color: 'black' }}
                  size='small'
                  onClick={addDocument}
                  disabled={reactData.saving}
                >
                  Add Document
                </Button>
              </Box>
            </Box>
          </Dialog>

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

            {!reactData.loading && (() => {
              const DOCS_PER_CATEGORY = 5;
              const docsByCategory = {};
              reactData.documents.forEach(docRec => {
                const cat = docRec.category || 'General';
                if (!docsByCategory[cat]) { docsByCategory[cat] = []; }
                docsByCategory[cat].push(docRec);
              });
              return Object.keys(docsByCategory).sort().map(cat => {
                const docsInCat = docsByCategory[cat];
                const isExpanded = expandedCategories.has(cat);
                const visibleDocs = isExpanded ? docsInCat : docsInCat.slice(0, DOCS_PER_CATEGORY);
                const hiddenCount = docsInCat.length - DOCS_PER_CATEGORY;
                return (
                  <Box key={`doc_category_${cat}`} mb={2}>
                    <Typography style={AVATextStyle({ bold: true, size: 1.0 })}>
                      {cat}
                    </Typography>
                    <Box pl={2} mt={0.5}>
                      {visibleDocs.map(docRec => (
                        <Box
                          key={`people_doc_${docRec.document_id}`}
                          onClick={() => {
                              if (docRec.url) {
                                window.open(docRec.url, '_blank', 'noopener,noreferrer');
                              }
                            }}
                          mb={0.5}
                          pb={0.5}
                          style={{ borderBottom: '1px solid #e0e0e0' }}
                        >
                          <Typography
                            style={{ ...AVATextStyle({ size: 0.9, bold: true }), cursor: docRec.url ? 'pointer' : 'default' }}
                          >
                            {docRec.description || docRec.document_id}
                          </Typography>
                          {!!docRec.comments &&
                            <Typography style={AVATextStyle({ size: 0.6 })}>
                              {docRec.comments}
                            </Typography>
                          }
                          <Typography style={AVATextStyle({ size: 0.6 })}>
                            {[docRec.added?.added_by_name, docRec.added?.added_on ? makeDate(docRec.added.added_on).absolute : ''].filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                      ))}
                      {hiddenCount > 0 &&
                        <Button
                          size='small'
                          style={{
                            borderRadius: '12px',
                            border: '1px solid #bbb',
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            marginTop: '4px',
                            paddingLeft: '10px',
                            paddingRight: '10px',
                            minHeight: 0,
                          }}
                          onClick={() => {
                            setExpandedCategories(prev => {
                              const next = new Set(prev);
                              if (next.has(cat)) { next.delete(cat); } else { next.add(cat); }
                              return next;
                            });
                          }}
                        >
                          {isExpanded ? 'less...' : `more... (${hiddenCount} more)`}
                        </Button>
                      }
                    </Box>
                  </Box>
                );
              });
            })()}
          </Box>

          <Box mt={1.5} display='flex' justifyContent='flex-end'>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'white', color: 'black' }}
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
