import { useState, useEffect, useContext } from 'react';
import { Variable, User, Type, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

const VariableMapper = ({ template, listId, mappings, onMappingsChange }) => {
    const { token } = useContext(AuthContext);
    const [contactFields, setContactFields] = useState([]);
    const [sampleContacts, setSampleContacts] = useState([]);

    // Extract variables from template
    const variables = (template.variables || []).map((v, i) => {
        const index = parseInt(v.replace(/[{}]/g, ''));
        const def = (template.variableDefinitions || []).find(d => d.index === index);
        return { index, placeholder: v, attribute: def?.attribute || '', fallback: def?.fallback || '' };
    });

    // Fetch contact fields and sample contacts
    useEffect(() => {
        const config = { headers: { 'x-auth-token': token } };
        const fetchData = async () => {
            try {
                const [fieldsRes, contactsRes] = await Promise.all([
                    axios.get(`${API_URL}/templates/contact-fields`, config),
                    listId ? axios.get(`${API_URL}/contacts?listId=${listId}&limit=2`, config) : Promise.resolve({ data: [] })
                ]);
                setContactFields(fieldsRes.data);
                const contacts = Array.isArray(contactsRes.data) ? contactsRes.data : (contactsRes.data?.contacts || []);
                setSampleContacts(contacts.slice(0, 2));
            } catch {
                // Fields fallback
                setContactFields([
                    { key: 'firstName', label: 'First Name' },
                    { key: 'lastName', label: 'Last Name' },
                    { key: 'phoneNumber', label: 'Phone Number' },
                    { key: 'email', label: 'Email' },
                    { key: 'companyName', label: 'Company Name' },
                ]);
            }
        };
        if (token) fetchData();
    }, [token, listId]);

    // Auto-populate mappings from template variableDefinitions
    useEffect(() => {
        if (variables.length === 0) return;
        if (mappings.length > 0) return; // already configured

        const autoMappings = variables.map(v => ({
            parameterIndex: v.index,
            componentType: 'body',
            source: v.attribute ? 'field' : 'static',
            fieldName: v.attribute || '',
            staticValue: v.fallback || ''
        }));
        onMappingsChange(autoMappings);
    }, [variables.length]);

    if (variables.length === 0) {
        return (
            <div className="text-center py-6 text-gray-400 text-sm">
                This template has no variables — no mapping needed.
            </div>
        );
    }

    const updateMapping = (index, updates) => {
        const next = mappings.map((m, i) => i === index ? { ...m, ...updates } : m);
        onMappingsChange(next);
    };

    // Build preview text by substituting variables with sample contact data
    const buildPreview = (contact) => {
        let text = template.body || '';
        for (const mapping of mappings) {
            const placeholder = `{{${mapping.parameterIndex}}}`;
            let value = '';
            if (mapping.source === 'static') {
                value = mapping.staticValue || '';
            } else if (mapping.fieldName && contact) {
                value = contact[mapping.fieldName] || '';
            }
            text = text.replace(placeholder, value || `[{{${mapping.parameterIndex}}}]`);
        }
        return text;
    };

    const isComplete = mappings.length >= variables.length && mappings.every(m =>
        (m.source === 'field' && m.fieldName) || (m.source === 'static' && m.staticValue)
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Map Template Variables</h3>
                {!isComplete && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <AlertTriangle size={14} /> Incomplete
                    </span>
                )}
            </div>

            <div className="space-y-3">
                {variables.map((v, i) => {
                    const mapping = mappings[i] || { parameterIndex: v.index, componentType: 'body', source: 'field', fieldName: v.attribute, staticValue: '' };
                    return (
                        <div key={v.index} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            {/* Variable label */}
                            <div className="flex items-center gap-2 min-w-[100px]">
                                <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold">
                                    {`{{${v.index}}}`}
                                </div>
                                {v.attribute && (
                                    <span className="text-xs text-gray-400">{v.attribute}</span>
                                )}
                            </div>

                            {/* Source toggle */}
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                                <button
                                    type="button"
                                    onClick={() => updateMapping(i, { source: 'field', staticValue: '' })}
                                    className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${mapping.source === 'field' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <User size={12} /> Contact Field
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateMapping(i, { source: 'static', fieldName: '' })}
                                    className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${mapping.source === 'static' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <Type size={12} /> Static Value
                                </button>
                            </div>

                            {/* Value input */}
                            {mapping.source === 'field' ? (
                                <select
                                    value={mapping.fieldName || ''}
                                    onChange={(e) => updateMapping(i, { fieldName: e.target.value })}
                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none bg-white"
                                >
                                    <option value="">Select field...</option>
                                    {contactFields.map(f => (
                                        <option key={f.key} value={f.key}>{f.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={mapping.staticValue || ''}
                                    onChange={(e) => updateMapping(i, { staticValue: e.target.value })}
                                    placeholder="Enter static value..."
                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none"
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Live Preview */}
            {sampleContacts.length > 0 && mappings.length > 0 && (
                <div className="mt-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Preview with real contacts</h4>
                    <div className="space-y-2">
                        {sampleContacts.map((contact, i) => (
                            <div key={i} className="p-3 bg-green-50 rounded-lg border border-green-100 text-sm text-gray-700">
                                <span className="text-xs text-green-600 font-medium block mb-1">
                                    {contact.firstName} {contact.lastName || ''}
                                </span>
                                <p className="whitespace-pre-wrap">{buildPreview(contact)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VariableMapper;
