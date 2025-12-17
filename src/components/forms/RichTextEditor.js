import React, { useRef, useMemo, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';

// Global style injection for Quill tooltip positioning fix
// The tooltip needs to be visible but Quill's default positioning conflicts with our layout
if (typeof document !== 'undefined') {
    const styleId = 'quill-tooltip-fix';
    // Remove existing style if present to allow re-injection
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
        existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        /* Ensure Quill tooltip appears above toolbar and other elements */
        .ql-snow.ql-tooltip,
        .ql-snow .ql-tooltip,
        .ql-tooltip,
        div.ql-tooltip {
            z-index: 99999 !important;
        }
        .ql-snow .ql-tooltip {
            background-color: #fff !important;
            border: 1px solid #ccc !important;
            box-shadow: 0px 2px 8px rgba(0,0,0,0.15) !important;
        }
        .ql-snow .ql-tooltip[data-mode="link"]::before {
            content: "Enter link:";
        }
        .ql-snow .ql-tooltip.ql-editing {
            z-index: 99999 !important;
        }
    `;
    document.head.appendChild(style);
}

const useStyles = makeStyles((theme) => ({
    editorContainer: {
        position: 'relative',
        paddingTop: '50px', // Space for tooltip when it appears above selection
        overflow: 'visible', // Ensure tooltip can overflow container
        '& .quill': {
            backgroundColor: theme.palette.background.paper,
            borderRadius: theme.shape.borderRadius,
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'visible', // Ensure tooltip can overflow
        },
        '& .ql-toolbar': {
            backgroundColor: theme.palette.type === 'dark' ? '#424242' : '#f5f5f5',
            borderTopLeftRadius: theme.shape.borderRadius,
            borderTopRightRadius: theme.shape.borderRadius,
            borderBottom: `1px solid ${theme.palette.divider}`,
            position: 'relative',
            // Remove z-index to prevent stacking context issues with tooltip
        },
        '& .ql-container': {
            borderBottomLeftRadius: theme.shape.borderRadius,
            borderBottomRightRadius: theme.shape.borderRadius,
            fontSize: theme.typography.fontSize,
            fontFamily: theme.typography.fontFamily,
            minHeight: '150px',
            maxHeight: '400px',
            overflow: 'auto',
        },
        '& .ql-editor': {
            minHeight: '150px',
            color: theme.palette.text.primary,
            '&.ql-blank::before': {
                color: theme.palette.text.secondary,
                fontStyle: 'italic',
            },
        },
        '& .ql-stroke': {
            stroke: theme.palette.text.primary,
        },
        '& .ql-fill': {
            fill: theme.palette.text.primary,
        },
        '& .ql-picker-label': {
            color: theme.palette.text.primary,
        },
        '& .ql-picker-options': {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
        },
        // Fix for tooltip/popup appearing behind toolbar
        '& .ql-tooltip': {
            zIndex: '99999 !important',
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[3],
            color: theme.palette.text.primary,
            '& input[type=text]': {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.default,
                border: `1px solid ${theme.palette.divider}`,
            },
            '& a.ql-action::after': {
                borderRight: `1px solid ${theme.palette.divider}`,
            },
            '& a.ql-remove::before': {
                color: theme.palette.error.main,
            },
        },
    },
    compact: {
        '& .ql-container': {
            minHeight: '100px',
        },
        '& .ql-editor': {
            minHeight: '100px',
        },
    },
}));

/**
 * Rich Text Editor Component using Quill
 * 
 * @param {string} value - HTML content value
 * @param {function} onChange - Callback when content changes (receives HTML string)
 * @param {string} placeholder - Placeholder text
 * @param {boolean} compact - Use compact mode with smaller height
 * @param {boolean} readOnly - Make editor read-only
 * @param {object} modules - Custom Quill modules configuration
 * @param {array} formats - Allowed formats
 */
const RichTextEditor = React.forwardRef(({
    value = '',
    onChange,
    placeholder = 'Enter message...',
    compact = false,
    readOnly = false,
    modules: customModules,
    formats: customFormats,
    ...props
}, ref) => {
    const classes = useStyles();
    const quillRef = useRef(null);

    // Expose the quillRef to parent components
    React.useImperativeHandle(ref, () => ({
        getEditor: () => quillRef.current?.getEditor(),
        editingArea: quillRef.current?.editingArea
    }));

    // Default toolbar configuration - optimized for messaging
    const defaultModules = useMemo(() => ({
        toolbar: [
            [{ 'size': ['small', false, 'large', 'huge'] }],  // Font size selector for inline changes
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['blockquote', 'code-block'],
            ['link', 'image'],
            ['clean']
        ],
        clipboard: {
            // Better paste handling for rich content
            matchVisual: false,
        }
    }), []);

    // Default formats
    const defaultFormats = [
        'size',  // Add size to allowed formats
        'bold', 'italic', 'underline', 'strike',
        'color', 'background',
        'list', 'bullet',
        'align',
        'blockquote', 'code-block',
        'link', 'image'
    ];

    const modules = customModules || defaultModules;
    const formats = customFormats || defaultFormats;

    // Set bounds to constrain tooltip to editor container
    useEffect(() => {
        if (quillRef.current) {
            const quill = quillRef.current.getEditor();
            const container = quillRef.current.editingArea;
            if (container) {
                quill.root.setAttribute('data-placeholder', placeholder);
                // Set bounds to editor container to position tooltip within it
                quill.root.parentElement.style.position = 'relative';
            }
        }

        // Nuclear option: repeatedly force z-index on tooltip
        const forceTooltipZIndex = () => {
            const tooltips = document.querySelectorAll('.ql-tooltip');
            tooltips.forEach(tooltip => {
                if (tooltip && quillRef.current) {
                    tooltip.style.setProperty('z-index', '99999', 'important');
                    tooltip.style.setProperty('position', 'fixed', 'important');

                    // Get the editor container position
                    const editorContainer = quillRef.current.editingArea?.parentElement;
                    if (editorContainer) {
                        const rect = editorContainer.getBoundingClientRect();
                        // Position in the 50px gap above the editor (below template name)
                        // Move it higher up and align with the left edge of the editor
                        tooltip.style.setProperty('top', `${rect.top - 45}px`, 'important');
                        tooltip.style.setProperty('left', `${rect.left}px`, 'important');
                        tooltip.style.setProperty('transform', 'none', 'important');
                    }
                }
            });
        };

        // Run immediately
        forceTooltipZIndex();

        // Keep forcing it
        const interval = setInterval(forceTooltipZIndex, 100);

        // Also use MutationObserver
        const observer = new MutationObserver(forceTooltipZIndex);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        return () => {
            clearInterval(interval);
            observer.disconnect();
        };
    }, [placeholder]);

    const handleChange = (content, delta, source, editor) => {
        if (onChange) {
            // Pass both HTML and plain text
            onChange(content, editor.getText());
        }
    };

    return (
        <Box className={`${classes.editorContainer} ${compact ? classes.compact : ''}`}>
            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={value}
                onChange={handleChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                readOnly={readOnly}
                {...props}
            />
        </Box>
    );
});

export default RichTextEditor;
