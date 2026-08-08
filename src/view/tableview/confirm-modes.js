import { createElement, createInput, createButton } from '../dom-utils.js';

/**
 * Build a confirmation UI with OK and Cancel buttons
 * @param {object} config
 * @param {string} config.prompt - Message or label
 * @param {string} config.inputValue - Pre-filled value (optional)
 * @param {string} config.inputPlaceholder - Placeholder text (optional)
 * @param {string} config.okText - Text for OK button (default: '✓ OK')
 * @param {string} config.cancelText - Text for Cancel button (default: '✕ Cancel')
 * @param {function} config.onConfirm - Called when OK is clicked
 * @param {function} config.onCancel - Called when Cancel is clicked
 * @param {function} config.onChange - Called when input value changes (optional)
 * @param {boolean} config.showInput - Show input field (default: true)
 * @returns {object} { container, input, okBtn, cancelBtn }
 */
export function createConfirmUI(config) {
    const {
        prompt = '',
        inputValue = '',
        inputPlaceholder = '',
        okText = '✓ OK',
        cancelText = '✕ Cancel',
        onConfirm = null,
        onCancel = null,
        onChange = null,
        showInput = true,
        type = 'text'
    } = config;

    const container = createElement('div', {
        className: 'confirm-ui',
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        }
    });

    let input = null;
    
    // Prompt label
    if (prompt) {
        const label = createElement('span', {
            className: 'confirm-prompt',
            style: {
                fontSize: '12px',
                fontWeight: '500',
                color: '#1c2f44',
                marginRight: '4px'
            }
        }, prompt);
        container.appendChild(label);
    }

    // Input field
    if (showInput) {
        input = createInput(type, inputValue, inputPlaceholder, 'confirm-input');
        input.style.padding = '3px 8px';
        input.style.border = '2px solid #2563eb';
        input.style.borderRadius = '4px';
        input.style.fontSize = '12px';
        input.style.outline = 'none';
        input.style.minWidth = '100px';
        
        if (onChange) {
            input.addEventListener('input', (e) => onChange(e.target.value));
        }
        
        container.appendChild(input);
        
        // Auto-focus and select
        setTimeout(() => {
            input.focus();
            input.select();
        }, 20);
    }

    // OK button
    const okBtn = createButton(okText, 'btn btn-success btn-sm confirm-ok', () => {
        if (onConfirm) {
            const value = input ? input.value : null;
            onConfirm(value);
        }
    });
    container.appendChild(okBtn);

    // Cancel button
    const cancelBtn = createButton(cancelText, 'btn btn-secondary btn-sm confirm-cancel', () => {
        if (onCancel) onCancel();
    });
    // Style cancel button
    cancelBtn.style.background = '#eef2f7';
    cancelBtn.style.color = '#1c2f44';
    container.appendChild(cancelBtn);

    // Keyboard shortcuts
    const keyHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            okBtn.click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelBtn.click();
        }
    };

    const target = input || container;
    target.addEventListener('keydown', keyHandler);

    // Return for cleanup
    return {
        container,
        input,
        okBtn,
        cancelBtn,
        cleanup: () => {
            target.removeEventListener('keydown', keyHandler);
        }
    };
}

/**
 * Create a delete confirmation UI (read-only prompt + Confirm/Cancel)
 */
export function createDeleteConfirmUI(config) {
    const { itemName, onConfirm, onCancel, confirmText = '✓ Confirm' } = config;
    
    return createConfirmUI({
        prompt: itemName,
        showInput: false,
        okText: confirmText,
        cancelText: '✕ Cancel',
        onConfirm,
        onCancel
    });
}

/**
 * Create an add/rename confirmation UI (input + OK/Cancel)
 */
export function createEditConfirmUI(config) {
    const { 
        value = '', 
        placeholder = '', 
        onConfirm, 
        onCancel, 
        okText = '✓ OK',
        type = 'text'
    } = config;
    
    return createConfirmUI({
        inputValue: value,
        inputPlaceholder: placeholder,
        showInput: true,
        okText,
        cancelText: '✕ Cancel',
        onConfirm,
        onCancel,
        type
    });
}
