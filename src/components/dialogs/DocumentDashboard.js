import React from 'react';
import { cl, dbClient, recordExists } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { getPerson, getImage } from '../../util/AVAPeople';
import AVAConfirm from '../forms/AVAConfirm';
import FormFill from '../forms/FormFill';
import useSession from '../../hooks/useSession';

import CloseIcon from '@material-ui/icons/HighlightOff';
import Button from '@material-ui/core/Button';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';

import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  freeInput: {
    marginLeft: '2px',
    marginRight: 2,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  imageArea: {
    minWidth: '50px',
    maxWidth: '50px',
    minHeight: '50px',
    maxHeight: '50px',
    marginRight: theme.spacing(1),
  },
  personArea: {
    marginTop: '20px',
    minHeight: '30px',
    maxHeight: '50px',
  },
  formControlLbl: {
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 2,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 5,
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  makeIconStyle: {
    marginRight: theme.spacing(1),
  },
  locationLine: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  preferenceLine: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  mrowhead: {
    marginTop: 10,
    fontSize: theme.typography.fontSize * 1.2,
    fontWeight: 'bold'
  },
  mrowdetail: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  mrowqual: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: 10,
  },
  techInfoLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(2),
  },
  techInfoLine2: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(4),
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
  firstName: {
    fontSize: theme.typography.fontSize * 1.4,
    marginRight: theme.spacing(1),
  },
  timeLine: {
    fontSize: theme.typography.fontSize * 1.4,
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  lastName: {
    fontWeight: 'bold',
    fontSize: theme.typography.fontSize * 1.8,
    marginTop: theme.spacing(-0.75),
  },
  messageArea: {
    alignItems: 'start',
    justifyContent: 'flex-start',
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(0),
    marginRight: theme.spacing(0),
  },
  title: {
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  subTitle: {
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.2
  },
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  popUpMenuRow: {
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
  },
}));

export default ({ request = {}, onClose }) => {
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();

  let options = {};
  if (Array.isArray(request)) {
    request.forEach((req) => {
      if (typeof (req) === 'string') {
        let [key, value] = req.split('=');
        options[key] = value;
      }
      else {
        Object.assign(options, req);
      }
    });
  }
  else if (typeof (request) === 'string') {
    options.formTypeList = [request];
  }
  else {
    options = Object.assign({}, request);
  }

  /*
    expect options to contain
      formTypeList []   when missing, use *all
      peopleList []       can be *self, *user, *person, *all, or list of person_id's  (default *person)
      assignedToList []      can be *nobody, *self, *user, *person, *anybody, or list of person_id's  (default null - don't care if assigned or not)
  */

  const handleAbort = () => {
    onClose();
  };

  const [reactData, setReactData] = React.useState({
    formType_filter: options.formTypeList || ['*all'],
    people_filter: options.peopleList || ['*person'],
    assignedTo_filter: options.assignedToList || null,
    user_fontSize: AVADefaults({ fontSize: 'get' }) || 1.5,
    initialized: false,
    stage: 'initialize',
    version__number: 0,
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) {
      setForceRedisplay(!forceRedisplay);
    }
  };

  React.useEffect(() => {
    async function initialize() {
      await loadDocuments();
      updateReactData({
        initialized: true,
        stage: 'complete'
      }, true);
      setForceRedisplay('ready');
    }
    if (reactData.stage === 'initialize') {
      initialize();
    }
  }, [reactData.form_id]);  // eslint-disable-line react-hooks/exhaustive-deps


  // **********************************


  async function loadDocuments() {
    let queryObj = makeQueryObj();
    let loopCount = 0;
    let unSortedList = [];
    let rememberedNames = {};
    let rememberedForms = {};
    let queryResult;
    do {
      queryResult = await dbClient
        .query(queryObj)
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading ${queryObj.TableName} id ${error}`);
        });
      if (recordExists(queryResult)) {
        unSortedList = unSortedList.concat(queryResult.Items);
        let sortedList = await makeSortedObj(unSortedList);
        updateReactData({
          documentList: sortedList,
          stage: 'building'
        }, true);
        queryResult.ExclusiveStartKey = queryResult.LastEvaluatedKey;
      }
      loopCount++;
    } while (queryResult.ExclusiveStartKey && (loopCount < 10));
    return;

    async function makeSortedObj(rawList) {
      let buildDocList = [];
      for (let d = 0; d < rawList.length; d++) {
        let this_document = rawList[d];
        let foundAt = buildDocList.findIndex(this_docObj => {
          return (this_docObj.person_id === this_document.person_id);
        });
        if (foundAt === -1) {
          if (!rememberedNames.hasOwnProperty(this_document.person_id)) {
            let personResult = await getPerson(this_document.person_id);
            if (!personResult) {
              rememberedNames[this_document.person_id] = this_document.person_id;
            }
            else {
              rememberedNames[this_document.person_id] = personResult.name
                ? (`${personResult.name.first.trim()} ${personResult.name.last.trim()}`)
                : (personResult.display_name || personResult.person_id);
            }
          }
          if (!rememberedForms.hasOwnProperty(this_document.form_id)) {
            rememberedForms[this_document.form_id] = await makeFormName(this_document);
          }
          let gotImage = getImage(this_document.person_id);
          let goodImage = await checkURL(gotImage);
          buildDocList.push({
            person_id: this_document.person_id,
            person_name: rememberedNames[this_document.person_id],
            person_image: goodImage ? gotImage : null,
            person_expanded: false,
            formTypes: [{
              form_id: this_document.form_id,
              form_expanded: false,
              form_name: rememberedForms[this_document.form_id],
              documentList: [this_document]
            }]
          });
        }
        else {
          let foundForm = buildDocList[foundAt].formTypes.findIndex(this_form => {
            return (this_form.form_id === this_document.form_id);
          });
          if (foundForm < 0) {
            if (!rememberedForms.hasOwnProperty(this_document.form_id)) {
              rememberedForms[this_document.form_id] = await makeFormName(this_document);
            }
            buildDocList[foundAt].formTypes.push({
              form_id: this_document.form_id,
              form_name: rememberedForms[this_document.form_id],
              documentList: [this_document]
            });
          }
          else {
            buildDocList[foundAt].formTypes[foundForm].documentList.push(this_document);
          }
        }
      };
      buildDocList.forEach(personObj => {
        personObj.formTypes.forEach(this_type => {
          this_type.documentList.sort((a, b) => { return ((a.completed_timestamp > b.completed_timestamp) ? -1 : 1); });
        });
        personObj.formTypes.sort((a, b) => { return ((a.form_name < b.form_name) ? -1 : 1); });
      });
      buildDocList.sort((a, b) => { return ((a.person_name < b.person_name) ? -1 : 1); });
      return buildDocList;

      async function checkURL(url) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            return false;
          }
          else {
            return true;
          }
        }
        catch (error) {
          return false;
        }
      } 
    }

    async function makeFormName(this_document) {
      let formRec = await dbClient
        .get({
          Key: {
            client_id: this_document.client_id || state.session.client_id,
            form_id: this_document.form_id
          },
          TableName: "Forms"
        })
        .promise()
        .catch(error => {
          cl(`***ERR reading Groups*** caught error is: ${error}`, this_document.form_id);
        });
      if (!recordExists(formRec)) {
        return this_document.form_id;
      }
      else {
        return formRec.Item.form_name;
      }
    }

    function makeQueryObj() {
      let queryObj = { TableName: 'Documents' };
      queryObj.KeyConditionExpression = 'client_id = :c';
      queryObj.ExpressionAttributeValues = { ':c': state.session.client_id };
      queryObj.ScanIndexForward = false;
      /*
        expect reactData to contain
          formType_filter []   list or *all
          people_filter []       *self, *user, *person, *all, or list of person_id's
          assignedTo_filter []     *none, *self, *user, *person, *all, or list of person_id's
      */
      if (!reactData.formType_filter.includes('*all')) {
        // selecting on form type - use form id index and filter on people and assigned to
        queryObj.IndexName = 'form_id-index';
        queryObj.KeyConditionExpression += ' and form_id in (';
        reactData.formType_filter.forEach((filter, ndx) => {
          queryObj.KeyConditionExpression += `${ndx > 0 ? ', ' : ''}:t${ndx}`;
          queryObj.ExpressionAttributeValues[`:t${ndx}`] = filter;
        });
        queryObj.KeyConditionExpression += ')';
        queryObj = peopleFilter(queryObj);
        queryObj = assignedToFilter(queryObj);
      }
      else if ((reactData.assignedTo_filter)
        && (!reactData.assignedTo_filter.includes('*anybody'))
        && (!reactData.assignedTo_filter.includes('*nobody'))
      ) {
        // selecting on assigned to but not form type - use assigned to index and filter on people
        queryObj.IndexName = 'assigned_to-index';
        queryObj.KeyConditionExpression += ' and assigned_to in (';
        reactData.assignedTo_filter.forEach((filter, ndx) => {
          queryObj.KeyConditionExpression += `${ndx > 0 ? ', ' : ''}:a${ndx}`;
          switch (filter) {
            case '*user':
            case '*self': {
              queryObj.ExpressionAttributeValues[`:a${ndx}`] = state.session.user_id;
              break;
            }
            case '*person': {
              queryObj.ExpressionAttributeValues[`:a${ndx}`] = state.patient.person_id;
              break;
            }
            default: {
              queryObj.ExpressionAttributeValues[`:a${ndx}`] = filter;
            }
          }
        });
        queryObj.KeyConditionExpression += ')';
        queryObj = peopleFilter(queryObj);
      }
      else {
        if (!reactData.people_filter.includes('*all')) {
          if (reactData.people_filter.length === 1) {
            queryObj.KeyConditionExpression += ' and begins_with (document_id, :p)';
            switch (reactData.people_filter[0]) {
              case '*user': {
                queryObj.ExpressionAttributeValues[':p'] = `${state.session.user_id}%%`;
                break;
              }
              case '*self':
              case '*person': {
                queryObj.ExpressionAttributeValues[':p'] = `${state.patient.person_id}%%`;
                break;
              }
              default: {
                queryObj.ExpressionAttributeValues[':p'] = `${reactData.people_filter[0]}%%`;
              }
            }
          }
          else {
            queryObj.FilterExpression = 'person_id in (';
            reactData.people_filter.forEach((filter, ndx) => {
              queryObj.KeyConditionExpression += `${ndx > 0 ? ', ' : ''}:p${ndx}`;
              switch (filter) {
                case '*user': {
                  queryObj.ExpressionAttributeValues[`:p${ndx}`] = state.session.user_id;
                  break;
                }
                case '*self':
                case '*person': {
                  queryObj.ExpressionAttributeValues[`:p${ndx}`] = state.patient.person_id;
                  break;
                }
                default: {
                  queryObj.ExpressionAttributeValues[`:p${ndx}`] = filter;
                }
              }
            });
            queryObj.FilterExpression += ')';
          }
        }
        queryObj = assignedToFilter(queryObj);
      }
      return queryObj;
    }

    function peopleFilter(queryObj) {
      if (!reactData.people_filter.includes('*all')) {
        if (queryObj.FilterExpression) {
          queryObj.FilterExpression += ' and ';
        }
        else {
          queryObj.FilterExpression = '';
        }
        queryObj.FilterExpression = 'person_id in (';
        reactData.people_filter.forEach((filter, ndx) => {
          queryObj.KeyConditionExpression += `${ndx > 0 ? ', ' : ''}:p${ndx}`;
          switch (filter) {
            case '*user': {
              queryObj.ExpressionAttributeValues[`:p${ndx}`] = state.session.user_id;
              break;
            }
            case '*self':
            case '*person': {
              queryObj.ExpressionAttributeValues[`:p${ndx}`] = state.patient.person_id;
              break;
            }
            default: {
              queryObj.ExpressionAttributeValues[`:p${ndx}`] = filter;
            }
          }
        });
        queryObj.FilterExpression += ')';
      }
      return queryObj;
    }

    function assignedToFilter(queryObj) {
      if (reactData.assignedTo_filter) {
        if (queryObj.FilterExpression) {
          queryObj.FilterExpression += ' and ';
        }
        else {
          queryObj.FilterExpression = '';
        }
        if (reactData.assignedTo_filter.includes('*anybody')) {
          queryObj.ExpressionAttributeNames['#a'] = 'assigned_to';
          queryObj.ExpressionAttributeValues[':zero'] = 0;
          queryObj.FilterExpression += 'attribute_exists(#a) and (size (#a) > :zero)';
        }
        else if (reactData.assignedTo_filter.includes('*nobody')) {
          queryObj.ExpressionAttributeNames['#a'] = 'assigned_to';
          queryObj.ExpressionAttributeValues[':zero'] = 0;
          queryObj.FilterExpression += 'attribute_not_exists(#a) or (size (#a) = :zero)';
        }
        else {
          queryObj.FilterExpression += 'assigned_to in (';
          reactData.assignedTo_filter.forEach((filter, ndx) => {
            queryObj.FilterExpression += `${ndx > 0 ? ', ' : ''}a${ndx}`;
            switch (filter) {
              case '*self':
              case '*user': {
                queryObj.ExpressionAttributeValues[`:a${ndx}`] = state.session.user_id;
                break;
              }
              case '*person': {
                queryObj.ExpressionAttributeValues[`:a${ndx}`] = state.patient.person_id;
                break;
              }
              default: {
                queryObj.ExpressionAttributeValues[`:a${ndx}`] = filter;
              }
            }
          });
          queryObj.FilterExpression += ')';
        }
      }
      return queryObj;
    }
  };


  // **********************************


  // **********************************


  // ******************

  return (
    <Dialog
      open={(reactData.version > 0) || true}
      key={`wholeScreen__${reactData?.formRec?.form_name || 'notReady'}`}
      onClose={handleAbort}
      classes={{ paper: classes.radius_rounded }}
      fullScreen
    >
      {(reactData.stage !== 'initialize') &&
        <React.Fragment>
          <Box m={2}>
            <Typography style={AVATextStyle({
              size: 1.8, bold: true, margin: {
                bottom: 1,
                top: 1,
              }
            })}>
              Documents
            </Typography>
          </Box>
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
            {reactData.documentList.map((this_person, personNdx) => (
              <React.Fragment
                key={`personFrag__${this_person.person_name}`}
              >
                <Box
                  display='flex'
                  flexDirection='row'
                  alignItems={'center'}
                  justifyContent={'space-between'}
                  className={classes.personArea}
                  onClick={() => {
                    reactData.documentList[personNdx].person_expanded = !this_person.person_expanded;
                    updateReactData({
                      documentList: reactData.documentList
                    }, true);
                  }}
                >
                  <Box
                    display='flex'
                    flexDirection='row'
                    justifyContent='flex-start'
                    alignItems='center'
                  >
                    {!!this_person.person_image &&
                      <Box
                        className={classes.imageArea}
                        component="img"
                        alt={''}
                        src={this_person.person_image}
                      />
                    }
                    <Typography
                      key={`person__${this_person.person_name}`}
                      style={AVATextStyle({
                        size: 1.3,
                        bold: true,
                        margin: {
                          left: 0
                        }
                      })}>
                      {this_person.person_name}
                    </Typography>
                  </Box>
                  <Typography
                    key={`person__hide_${this_person.person_name}`}
                    style={AVATextStyle({
                      size: 0.5,
                      bold: true,
                      margin: {
                        left: 0
                      }
                    })}>
                    {(this_person.person_expanded
                      ? 'Hide'
                      : `Show ${(this_person.formTypes.length > 1) ? (this_person.formTypes.length + ' forms') : 'form'}`
                    )}
                  </Typography>
                </Box>
                {this_person.person_expanded &&
                  this_person.formTypes.map((this_form, formNdx) => (
                    <React.Fragment
                      key={`formFrag__${personNdx}_${formNdx}`}
                    >
                      <Box
                        display='flex'
                        flexDirection='row'
                        alignItems={'center'}
                        justifyContent={'space-between'}
                        marginTop={1}
                        onClick={() => {
                          reactData.documentList[personNdx].formTypes[formNdx].form_expanded = !this_form.form_expanded;
                          updateReactData({
                            documentList: reactData.documentList
                          }, true);
                        }}
                      >
                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                          <Typography
                            key={`form__${personNdx}_${formNdx}`}
                            style={AVATextStyle({
                              size: 1.3,
                              margin: {
                                left: 1
                              }
                            })}>
                            {this_form.form_name}
                          </Typography>
                        </Box>
                        <Typography
                          key={`person__hide_${this_person.person_name}`}
                          style={AVATextStyle({
                            size: 0.5,
                            bold: false,
                            margin: {
                              left: 0
                            }
                          })}>
                          {(this_form.form_expanded
                            ? 'Hide'
                            : `Show ${(this_form.documentList.length > 1) ? (this_form.documentList.length + ' documents') : 'document'}`
                          )}
                        </Typography>
                      </Box>
                      {this_form.form_expanded &&
                        this_form.documentList.map((this_document, documentNdx) => (
                          <React.Fragment
                            key={`docFrag__${personNdx}_${formNdx}_${documentNdx}`}
                          >
                            <Typography
                              key={`doc__${personNdx}_${formNdx}_${documentNdx}`}
                              onClick={() => {
                                updateReactData({
                                  stage: 'viewDoc',
                                  signatureData: (this_document.signature_field
                                    ? this_document.values[this_document.signature_field]
                                    : null
                                  ),
                                  selectedDoc_id: this_document.document_id,
                                  incomplete: !!this_document.incomplete
                                }, true);
                              }}
                              style={AVATextStyle({
                                size: 0.8, margin: {
                                  top: 0.5,
                                  bottom: 0.5,
                                  left: 2
                                },
                                color: (this_document.incomplete ? 'red' : '')
                              })}>
                              {this_document.title || makeDate(this_document.completed_timestamp).absolute}
                            </Typography>
                          </React.Fragment>
                        ))}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            ))}
          </DialogContent>
          <DialogActions className={classes.buttonArea} >
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => {
                onClose();
              }}
              startIcon={<CloseIcon fontSize="small" />}
            >
              {'Exit'}
            </Button>
          </DialogActions>
        </React.Fragment>
      }
      {(reactData.stage === 'viewDoc') &&
        <FormFill
          request={{
            document_id: reactData.selectedDoc_id,
            signatureImage: (!reactData.incomplete ? reactData.signatureData : null),
            viewMode: !reactData.incomplete,
            incompleteMode: reactData.incomplete
          }}
          onClose={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }}
        />
      }
      {(reactData.stage === 'error') &&
        <AVAConfirm
          promptText={['Error', 'Something went wrong', ...reactData.errorMessage]}
          cancelText={'Try again'}
          confirmText={'*none*'}
          onCancel={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }}
        />
      }
    </Dialog>
  );
};