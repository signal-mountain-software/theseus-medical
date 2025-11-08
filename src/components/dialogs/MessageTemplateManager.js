import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    TextField,
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    Paper,
    Divider,
    Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import SaveIcon from '@material-ui/icons/Save';
import CloseIcon from '@material-ui/icons/Close';
import RichTextEditor from '../forms/RichTextEditor';
import { dbClient } from '../../util/AVAUtilities';
import { AVAclasses } from '../../util/AVAStyles';
import useSession from '../../hooks/useSession';
import { useSnackbar } from 'notistack';

const useStyles = makeStyles((theme) => ({
    dialog: {
        margin: 0,
        maxWidth: '100%',
        maxHeight: '100%',
        width: '100%',
        height: '100%',
    },
    dialogContent: {
        padding: theme.spacing(3),
        overflow: 'hidden',
    },
    container: {
        display: 'flex',
        height: 'calc(100vh - 200px)',
        gap: theme.spacing(2),
    },
    sidebar: {
        width: '375px',
        borderRight: `1px solid ${theme.palette.divider}`,
        paddingRight: theme.spacing(2),
        overflowY: 'auto',
    },
    editorSection: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(2),
    },
    templateList: {
        maxHeight: 'calc(100vh - 300px)',
        overflowY: 'auto',
    },
    selectedTemplate: {
        backgroundColor: theme.palette.action.selected,
    },
    templateName: {
        marginBottom: theme.spacing(1),
    },
    actionButtons: {
        display: 'flex',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(2),
    },
    previewPaper: {
        padding: theme.spacing(2),
        marginTop: theme.spacing(1),
        backgroundColor: theme.palette.background.default,
        maxHeight: '150px',
        overflow: 'auto',
    },
    closeButtonContainer: {
        display: 'flex',
        justifyContent: 'center',
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
    confirmDialog: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2000,
        minWidth: '400px',
    },
}));

/**
 * Message Template Manager
 * Create, edit, and manage message templates with rich text formatting
 */
const MessageTemplateManager = ({ open, onClose, onSelectTemplate }) => {
    const classes = useStyles();
    const AVAClass = AVAclasses();
    const { state } = useSession();
    const { enqueueSnackbar } = useSnackbar();

    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [templateHtml, setTemplateHtml] = useState('');
    const [templatePlainText, setTemplatePlainText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isNewTemplate, setIsNewTemplate] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [closeConfirm, setCloseConfirm] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [originalHtml, setOriginalHtml] = useState('');

    // Load templates on mount
    useEffect(() => {
        if (open) {
            loadTemplates();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const result = await dbClient
                .query({
                    TableName: 'MessageTemplates',
                    KeyConditionExpression: 'client_id = :client_id',
                    ExpressionAttributeValues: {
                        ':client_id': state.session.client_id,
                    },
                })
                .promise();

            if (result.Items) {
                setTemplates(result.Items.sort((a, b) =>
                    (a.template_name || '').localeCompare(b.template_name || '')
                ));
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            enqueueSnackbar('Failed to load templates', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTemplate = (template) => {
        setSelectedTemplate(template);
        setTemplateName(template.template_name || '');

        // Join template_body array to get HTML content
        const htmlContent = Array.isArray(template.template_body)
            ? template.template_body.join('')
            : (template.template_body || '');

        setTemplateHtml(htmlContent);
        setOriginalHtml(htmlContent);
        setTemplatePlainText(template.plain_text || '');
        setIsEditing(true); // Go directly into edit mode
        setIsNewTemplate(false);
    };

    const handleNewTemplate = () => {
        setSelectedTemplate(null);
        setTemplateName('');
        setTemplateHtml('');
        setOriginalHtml('');
        setTemplatePlainText('');
        setIsEditing(true);
        setIsNewTemplate(true);
    };

    const handleCancelEdit = () => {
        // Check for unsaved changes
        if (isEditing && templateHtml !== originalHtml) {
            setCancelConfirm(true);
            return;
        }
        // Reset to initial state
        setSelectedTemplate(null);
        setTemplateName('');
        setTemplateHtml('');
        setOriginalHtml('');
        setTemplatePlainText('');
        setIsEditing(false);
        setIsNewTemplate(false);
    };

    const confirmCancel = () => {
        setCancelConfirm(false);
        // Reset to initial state
        setSelectedTemplate(null);
        setTemplateName('');
        setTemplateHtml('');
        setOriginalHtml('');
        setTemplatePlainText('');
        setIsEditing(false);
        setIsNewTemplate(false);
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            enqueueSnackbar('Please enter a template name', { variant: 'warning' });
            return;
        }

        if (!templatePlainText.trim()) {
            enqueueSnackbar('Template content cannot be empty', { variant: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const timestamp = new Date().toISOString();
            const templateId = isNewTemplate
                ? `${state.session.client_id}_${Date.now()}`
                : selectedTemplate.template_id;

            // Split HTML into chunks to avoid DynamoDB size limits
            // Split at ~5000 char chunks (well under 400KB limit but manageable)
            const chunkSize = 5000;
            const templateBodyArray = [];
            for (let i = 0; i < templateHtml.length; i += chunkSize) {
                templateBodyArray.push(templateHtml.substring(i, i + chunkSize));
            }

            const templateData = {
                client_id: state.session.client_id,
                template_id: templateId,
                template_name: templateName.trim(),
                template_body: templateBodyArray,
                plain_text: templatePlainText.trim(),
                updated_by: state.user.person_id,
                updated_at: timestamp,
                ...(isNewTemplate && {
                    created_by: state.user.person_id,
                    created_at: timestamp,
                }),
            };

            await dbClient
                .put({
                    TableName: 'MessageTemplates',
                    Item: templateData,
                })
                .promise();

            enqueueSnackbar(
                isNewTemplate ? 'Template created successfully' : 'Template updated successfully',
                { variant: 'success' }
            );

            // Reload templates and reset to initial state
            await loadTemplates();
            setSelectedTemplate(null);
            setTemplateName('');
            setTemplateHtml('');
            setTemplatePlainText('');
            setIsEditing(false);
            setIsNewTemplate(false);
        } catch (error) {
            console.error('Error saving template:', error);
            enqueueSnackbar('Failed to save template', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (template) => {
        console.log('Delete button clicked for template:', template);
        setDeleteConfirm(template);
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;

        setLoading(true);
        try {
            await dbClient
                .delete({
                    TableName: 'MessageTemplates',
                    Key: {
                        client_id: deleteConfirm.client_id,
                        template_id: deleteConfirm.template_id,
                    },
                })
                .promise();

            enqueueSnackbar('Template deleted successfully', { variant: 'success' });

            // Clear selection if deleted template was selected
            if (selectedTemplate?.template_id === deleteConfirm.template_id) {
                setSelectedTemplate(null);
                setTemplateName('');
                setTemplateHtml('');
                setTemplatePlainText('');
            }

            setDeleteConfirm(null);
            await loadTemplates();
        } catch (error) {
            console.error('Error deleting template:', error);
            enqueueSnackbar('Failed to delete template', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleEditorChange = (html, plainText) => {
        setTemplateHtml(html);
        setTemplatePlainText(plainText);
    };

    const handleUseTemplate = () => {
        if (onSelectTemplate && selectedTemplate) {
            onSelectTemplate({
                name: templateName,
                html: templateHtml,
                plainText: templatePlainText,
            });
            onClose();
        }
    };

    const handleClose = () => {
        if (isEditing && templateHtml !== originalHtml) {
            setCloseConfirm(true);
            return;
        }
        onClose();
    };

    const confirmClose = () => {
        setCloseConfirm(false);
        onClose();
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                fullScreen
                classes={{ paper: classes.dialog }}
            >
                <DialogTitle>
                    Message Template Manager
                    <Typography variant="body2" color="textSecondary">
                        Create and manage reusable message templates
                    </Typography>
                </DialogTitle>

                <DialogContent className={classes.dialogContent}>
                    <Box className={classes.container}>
                        {/* Sidebar - Template List */}
                        <Box className={classes.sidebar}>
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                startIcon={<AddIcon />}
                                onClick={handleNewTemplate}
                                disabled={loading}
                                style={{ marginBottom: 16 }}
                            >
                                New Template
                            </Button>

                            <Typography variant="subtitle2" gutterBottom>
                                Saved Templates ({templates.length})
                            </Typography>

                            <List className={classes.templateList}>
                                {templates.map((template) => {
                                    const tooltipTitle = template.updated_at ? (
                                        <>
                                            <div>Updated on {new Date(template.updated_at).toLocaleDateString()}</div>
                                            {template.updated_by && <div>by {template.updated_by}</div>}
                                        </>
                                    ) : 'No update date';

                                    return (
                                        <React.Fragment key={template.template_id}>
                                            <Tooltip title={tooltipTitle} placement="right" arrow>
                                                <ListItem
                                                    button
                                                    onClick={() => handleSelectTemplate(template)}
                                                    className={
                                                        selectedTemplate?.template_id === template.template_id
                                                            ? classes.selectedTemplate
                                                            : ''
                                                    }
                                                >
                                                    <ListItemText
                                                        primary={template.template_name}
                                                    />
                                                </ListItem>
                                            </Tooltip>
                                            <Divider />
                                        </React.Fragment>
                                    );
                                })}
                                {templates.length === 0 && !loading && (
                                    <Typography
                                        variant="body2"
                                        color="textSecondary"
                                        align="center"
                                        style={{ marginTop: 16 }}
                                    >
                                        No templates yet. Create one to get started!
                                    </Typography>
                                )}
                            </List>
                        </Box>

                        {/* Editor Section */}
                        <Box className={classes.editorSection}>
                            {selectedTemplate || isNewTemplate ? (
                                <>
                                    {/* Action Buttons */}
                                    <Box className={classes.actionButtons}>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<SaveIcon />}
                                            onClick={handleSaveTemplate}
                                            disabled={loading}
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<CloseIcon />}
                                            onClick={handleCancelEdit}
                                            disabled={loading}
                                        >
                                            Cancel
                                        </Button>
                                        {onSelectTemplate && (
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                onClick={handleUseTemplate}
                                            >
                                                Use This Template
                                            </Button>
                                        )}
                                        <Box flex={1} />
                                        {!isNewTemplate && selectedTemplate && (
                                            <Button
                                                variant="outlined"
                                                color="secondary"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => {
                                                    console.log('Delete button onClick triggered');
                                                    console.log('isNewTemplate:', isNewTemplate);
                                                    console.log('selectedTemplate:', selectedTemplate);
                                                    handleDeleteTemplate(selectedTemplate);
                                                }}
                                                disabled={loading}
                                            >
                                                Delete
                                            </Button>
                                        )}
                                    </Box>

                                    {/* Template Name */}
                                    <TextField
                                        fullWidth
                                        label="Template Name"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        variant="outlined"
                                        size="small"
                                        disabled={loading}
                                        className={classes.templateName}
                                        required
                                    />

                                    {/* Rich Text Editor */}
                                    <Box flex={1}>
                                        <RichTextEditor
                                            value={templateHtml}
                                            onChange={handleEditorChange}
                                            placeholder="Enter your template content here..."
                                        />
                                    </Box>
                                </>
                            ) : (
                                <Box
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    height="100%"
                                >
                                    <Typography variant="body1" color="textSecondary">
                                        Select a template from the list or create a new one
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </DialogContent>

                {/* Delete Confirmation Dialog */}
                {deleteConfirm && (
                    <Paper className={classes.confirmDialog} elevation={8}>
                        <Box p={3}>
                            <Typography variant="h6" gutterBottom>
                                Confirm Delete
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                                Are you sure you want to delete "{deleteConfirm.template_name}"?
                            </Typography>
                            <Box mt={3} display="flex" justifyContent="flex-end" style={{ gap: '16px' }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => setDeleteConfirm(null)}
                                    size="medium"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    onClick={confirmDelete}
                                    size="medium"
                                    disabled={loading}
                                >
                                    Delete
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                )}

                {/* Unsaved Changes Confirmation Dialog */}
                {closeConfirm && (
                    <Paper className={classes.confirmDialog} elevation={8}>
                        <Box p={3}>
                            <Typography variant="h6" gutterBottom>
                                Unsaved Changes
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                                You have unsaved changes. Close anyway?
                            </Typography>
                            <Box mt={3} display="flex" justifyContent="flex-end" style={{ gap: '16px' }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => setCloseConfirm(false)}
                                    size="medium"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    onClick={confirmClose}
                                    size="medium"
                                >
                                    Close Anyway
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                )}

                {/* Cancel Edit Confirmation Dialog */}
                {cancelConfirm && (
                    <Paper className={classes.confirmDialog} elevation={8}>
                        <Box p={3}>
                            <Typography variant="h6" gutterBottom>
                                Unsaved Changes
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                                You have unsaved changes. Discard changes and cancel?
                            </Typography>
                            <Box mt={3} display="flex" justifyContent="flex-end" style={{ gap: '16px' }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => setCancelConfirm(false)}
                                    size="medium"
                                >
                                    Continue Editing
                                </Button>
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    onClick={confirmCancel}
                                    size="medium"
                                >
                                    Discard Changes
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                )}

                <Box className={classes.closeButtonContainer}>
                    <Button
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'red', color: 'white' }}
                        size="small"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Close
                    </Button>
                </Box>
            </Dialog>
        </>
    );
};

export default MessageTemplateManager;
