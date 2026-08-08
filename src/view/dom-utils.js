/**
 * Create a DOM element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {object} attrs - Attributes to set
 * @param {Array|string|Node} children - Child elements or text
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'dataset') {
            for (const [dataKey, dataValue] of Object.entries(value)) {
                el.dataset[dataKey] = dataValue;
            }
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    }
    
    if (Array.isArray(children)) {
        for (const child of children) {
            if (child instanceof Node) {
                el.appendChild(child);
            } else if (child !== null && child !== undefined) {
                el.appendChild(document.createTextNode(String(child)));
            }
        }
    } else if (children instanceof Node) {
        el.appendChild(children);
    } else if (children !== null && children !== undefined) {
        el.appendChild(document.createTextNode(String(children)));
    }
    
    return el;
}

/**
 * Create a button with common attributes
 */
export function createButton(text, className = '', onClick = null) {
    const attrs = { className };
    if (onClick) {
        attrs.onclick = onClick;
    }
    return createElement('button', attrs, text);
}

/**
 * Create a select dropdown
 */
export function createSelect(options, selectedValue = null, className = '', onChange = null) {
    const attrs = { className };
    if (onChange) {
        attrs.onchange = onChange;
    }
    const select = createElement('select', attrs);
    
    for (const opt of options) {
        const option = createElement('option', { value: opt.value }, opt.label);
        if (opt.value === selectedValue) {
            option.selected = true;
        }
        select.appendChild(option);
    }
    
    return select;
}

/**
 * Create an input field
 */
export function createInput(type = 'text', value = '', placeholder = '', className = '') {
    return createElement('input', {
        type,
        value,
        placeholder,
        className
    });
}

/**
 * Clear all children from an element
 */
export function clearElement(el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
    return el;
}

/**
 * Replace content of an element
 */
export function replaceContent(el, newContent) {
    clearElement(el);
    if (Array.isArray(newContent)) {
        for (const child of newContent) {
            if (child instanceof Node) {
                el.appendChild(child);
            } else if (child !== null && child !== undefined) {
                el.appendChild(document.createTextNode(String(child)));
            }
        }
    } else if (newContent instanceof Node) {
        el.appendChild(newContent);
    } else if (newContent !== null && newContent !== undefined) {
        el.appendChild(document.createTextNode(String(newContent)));
    }
    return el;
}
