const FORM_TYPES = [
  'service_booking',
  'contact_individual',
  'contact_corporate',
  'event_registration',
  'artisoul_tribe',
];

const REQUIRED_FIELDS = {
  service_booking: ['name', 'phone', 'email', 'service'],
  contact_individual: ['name', 'phone', 'email', 'subject', 'message'],
  contact_corporate: ['name', 'phone', 'email', 'org', 'type', 'brief'],
  event_registration: ['name', 'phone', 'email', 'event'],
  artisoul_tribe: ['name', 'email'],
};

const MESSAGE_FIELD = {
  service_booking: 'notes',
  contact_individual: 'message',
  contact_corporate: 'brief',
  event_registration: 'access',
  artisoul_tribe: 'worth',
};

const DETAIL_FIELDS = {
  service_booking: ['service', 'date', 'time', 'mode'],
  contact_individual: ['subject'],
  contact_corporate: ['type', 'org', 'qty', 'when', 'budget'],
  event_registration: ['event', 'places'],
  artisoul_tribe: ['draw'],
};

function validateSubmission(formType, fields) {
  if (!FORM_TYPES.includes(formType)) {
    throw new Error(`Unknown form type: ${formType}`);
  }
  const missing = REQUIRED_FIELDS[formType].filter((f) => !fields[f] || !String(fields[f]).trim());
  if (missing.length) {
    throw new Error(`Missing required field(s): ${missing.join(', ')}`);
  }
}

function buildRow(formType, fields) {
  const details = {};
  DETAIL_FIELDS[formType].forEach((k) => {
    if (fields[k]) details[k] = fields[k];
  });

  return {
    form_type: formType,
    name: fields.name,
    phone: fields.phone || null,
    email: fields.email || null,
    message: fields[MESSAGE_FIELD[formType]] || null,
    details,
  };
}

module.exports = { FORM_TYPES, REQUIRED_FIELDS, MESSAGE_FIELD, DETAIL_FIELDS, validateSubmission, buildRow };
