/**
 * Single source of truth for contact field definitions.
 * Used by:
 *  - TemplateForm (frontend) for variable insertion
 *  - Campaign variable mapping UI
 *  - buildTemplateComponents() for resolving variables at send time
 */

const CONTACT_FIELDS = [
    { key: 'firstName',    label: 'First Name',           modelField: 'firstName' },
    { key: 'lastName',     label: 'Last Name',            modelField: 'lastName' },
    { key: 'phoneNumber',  label: 'Phone Number',         modelField: 'phoneNumber' },
    { key: 'countryCode',  label: 'Country Code',         modelField: 'countryCode' },
    { key: 'email',        label: 'Email',                modelField: 'email' },
    { key: 'companyName',  label: 'Company Name',         modelField: 'companyName' },
    { key: 'sheetName',    label: 'Sheet Name',           modelField: 'sheetName' },
    { key: 'tags',         label: 'Tags',                 modelField: 'tags' },
];

/**
 * Resolve a field key to its actual value from a contact document.
 * Checks standard fields first, then customAttributes map.
 */
function resolveContactField(contact, fieldKey) {
    // Direct model field
    const def = CONTACT_FIELDS.find(f => f.key === fieldKey);
    const modelField = def ? def.modelField : fieldKey;

    let value = contact[modelField];

    // Handle arrays (e.g. tags) — join into comma-separated string
    if (Array.isArray(value)) {
        value = value.join(', ');
    }

    // Fallback to customAttributes
    if (!value && contact.customAttributes) {
        value = typeof contact.customAttributes.get === 'function'
            ? contact.customAttributes.get(fieldKey)
            : contact.customAttributes[fieldKey];
    }

    return value || '';
}

module.exports = { CONTACT_FIELDS, resolveContactField };
