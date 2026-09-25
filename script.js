/* ==========================================================================
   Nova Auto Care — Follow-Up Automation Simulator
   100% client-side demo. No real messages are ever sent.
   ========================================================================== */

const STORAGE_KEY = 'novaAutoCare_followup_v1';
const BUSINESS_NAME = 'Nova Auto Care';

const SEQUENCE_LABELS = {
  NEW_LEAD: 'New Lead',
  APPOINTMENT_BOOKED: 'Appointment Booked',
  MISSED_APPOINTMENT: 'Missed Appointment',
  COMPLETED_SERVICE: 'Completed Service'
};

const DEFAULT_SEQUENCES = {
  NEW_LEAD: [
    { key: 'welcome', name: 'Welcome Message', delayDays: 0 },
    { key: 'checkin', name: 'Check-In', delayDays: 1 },
    { key: 'encourage', name: 'Encouragement', delayDays: 3 },
    { key: 'lastFollowup', name: 'Last Follow-Up', delayDays: 7 }
  ],
  APPOINTMENT_BOOKED: [
    { key: 'confirmation', name: 'Confirmation', delayDays: 0 },
    { key: 'reminder', name: 'Reminder', delayDays: 2 },
    { key: 'sameDayReminder', name: 'Same-Day Reminder', delayDays: 3 },
    { key: 'thankYouAppt', name: 'Thank You', delayDays: 4 }
  ],
  MISSED_APPOINTMENT: [
    { key: 'recovery', name: 'Recovery Message', delayDays: 0 }
  ],
  COMPLETED_SERVICE: [
    { key: 'thankYouService', name: 'Thank You', delayDays: 0 },
    { key: 'reviewRequest', name: 'Review Request', delayDays: 3 }
  ]
};

const DEFAULT_TEMPLATES = {
  welcome: "Hi {{first_name}}! Thanks for contacting {{business_name}}. How can we help with your {{service}}?",
  checkin: "Hi {{first_name}}, just checking in — still interested in getting your {{service}} sorted? Happy to answer any questions.",
  encourage: "Hi {{first_name}}, we'd love to help you get your vehicle serviced. We have openings this week for {{service}} — want us to hold a spot?",
  lastFollowup: "Hi {{first_name}}, this is our last follow-up about your {{service}}. Reply anytime and we'll pick it right back up — {{business_name}}.",
  confirmation: "You're booked! {{first_name}}, your {{service}} appointment is confirmed for {{appointment_date}}. See you then!",
  reminder: "Hi {{first_name}}, friendly reminder — your {{service}} appointment is coming up on {{appointment_date}}.",
  sameDayReminder: "Hi {{first_name}}, just a reminder your {{service}} appointment is today ({{appointment_date}}). See you soon!",
  thankYouAppt: "Thanks for visiting {{business_name}}, {{first_name}}! Let us know if you need anything else.",
  recovery: "Hi {{first_name}}, we missed you for your {{service}} appointment. No worries — want to grab a new time?",
  thankYouService: "Thanks for choosing {{business_name}} for your {{service}}, {{first_name}}! We hope your ride feels great.",
  reviewRequest: "Hi {{first_name}}, glad we could help with your {{service}}! Would you mind leaving us a quick review? It really helps our shop."
};

const TEMPLATE_LABELS = {
  welcome: 'Welcome Message', checkin: 'Check-In', encourage: 'Encouragement',
  lastFollowup: 'Last Follow-Up', confirmation: 'Appointment Confirmation',
  reminder: 'Appointment Reminder', sameDayReminder: 'Same-Day Reminder',
  thankYouAppt: 'Post-Appointment Thank You', recovery: 'Missed Appointment Recovery',
  thankYouService: 'Post-Service Thank You', reviewRequest: 'Review Request'
};

let state = loadState();
let selectedConversationLeadId = null;

function defaultState() {
  return { simDay: 0, leads: [], messages: [], activity: [], sequences: JSON.parse(JSON.stringify(DEFAULT_SEQUENCES)), templates: { ...DEFAULT_TEMPLATES }, nextLeadId: 1, nextMsgId: 1 };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, sequences: parsed.sequences || JSON.parse(JSON.stringify(DEFAULT_SEQUENCES)), templates: { ...DEFAULT_TEMPLATES, ...(parsed.templates || {}) } };
  } catch (e) {
    console.warn('Could not load saved state, starting fresh.', e);
    return defaultState();
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Could not save state.', e); }
}

/* ---------- helpers ---------- */

function fillTemplate(text, lead) {
  return text
    .replace(/{{\s*first_name\s*}}/g, lead.name.split(' ')[0] || lead.name)
    .replace(/{{\s*service\s*}}/g, lead.service)
    .replace(/{{\s*business_name\s*}}/g, BUSINESS_NAME)
    .replace(/{{\s*appointment_date\s*}}/g, lead.appointmentDate || 'a date to be confirmed');
}

function logActivity(text) {
  state.activity.unshift({ day: state.simDay, text });
  state.activity = state.activity.slice(0, 40);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2400);
}

function findLead(id) { return state.leads.find(l => l.id === id); }

/* ---------- campaign scheduling ---------- */

function scheduleSequence(lead, campaignKey) {
  const steps = state.sequences[campaignKey];
  if (!steps) return;
  lead.activeCampaign = campaignKey;
  lead.campaignActive = true;
  steps.forEach((step, idx) => {
    state.messages.push({
      id: state.nextMsgId++,
      leadId: lead.id,
      campaign: campaignKey,
      stepIndex: idx,
      stepName: step.name,
      templateKey: step.key,
      scheduledDay: state.simDay + step.delayDays,
      status: 'Scheduled',
      sentDay: null
    });
  });
  logActivity(`${SEQUENCE_LABELS[campaignKey]} sequence started for ${lead.name}.`);
}

function addLead(data) {
  const lead = {
    id: state.nextLeadId++,
    name: data.name, phone: data.phone, service: data.service,
    appointmentDate: data.appointmentDate || '',
    leadDate: new Date().toISOString().slice(0, 10),
    status: 'New',
    campaignActive: true,
    optedOut: false,
    activeCampaign: null,
    responded: false
  };
  state.leads.push(lead);
  scheduleSequence(lead, 'NEW_LEAD');
  saveState();
  renderAll();
  showToast(`${lead.name} added — welcome sequence scheduled.`);
}

function triggerCampaign(leadId, campaignKey, newStatus) {
  const lead = findLead(leadId);
  if (!lead || lead.optedOut) return;
  // cancel any still-scheduled messages from a previous sequence
  state.messages.forEach(m => { if (m.leadId === leadId && m.status === 'Scheduled') m.status = 'Failed'; });
  lead.status = newStatus;
  scheduleSequence(lead, campaignKey);
  saveState();
  renderAll();
  showToast(`${SEQUENCE_LABELS[campaignKey]} sequence started for ${lead.name}.`);
}

function stopCampaign(leadId) {
  const lead = findLead(leadId);
  if (!lead) return;
  lead.campaignActive = false;
  logActivity(`Campaign stopped for ${lead.name}.`);
  saveState(); renderAll();
  showToast(`Campaign stopped for ${lead.name}.`);
}

function resumeCampaign(leadId) {
  const lead = findLead(leadId);
  if (!lead || lead.optedOut) return;
  lead.campaignActive = true;
  logActivity(`Campaign resumed for ${lead.name}.`);
  saveState(); renderAll();
  showToast(`Campaign resumed for ${lead.name}.`);
}

function optOutLead(leadId) {
  const lead = findLead(leadId);
  if (!lead) return;
  lead.optedOut = true;
  lead.campaignActive = false;
  lead.status = 'Opted Out';
  state.messages.forEach(m => { if (m.leadId === leadId && m.status === 'Scheduled') m.status = 'Failed'; });
  logActivity(`${lead.name} opted out. All future messages cancelled.`);
  saveState(); renderAll();
  showToast(`${lead.name} opted out — future messages cancelled.`);
}

/* ---------- the simulator clock ---------- */

function simulateNextMessage() {
  const candidates = state.messages.filter(m => {
    if (m.status !== 'Scheduled') return false;
    const lead = findLead(m.leadId);
    return lead && lead.campaignActive && !lead.optedOut;
  });
  if (candidates.length === 0) {
    showToast('Nothing due — add a lead or start a campaign.');
    return;
  }
  candidates.sort((a, b) => a.scheduledDay - b.scheduledDay || a.id - b.id);
  const msg = candidates[0];
  const lead = findLead(msg.leadId);
  state.simDay = Math.max(state.simDay, msg.scheduledDay);

  const templateText = state.templates[msg.templateKey] || '';
  msg.body = fillTemplate(templateText, lead);
  msg.sentDay = state.simDay;

  const roll = Math.random();
  if (roll < 0.08) {
    msg.status = 'Failed';
    logActivity(`Message to ${lead.name} (${msg.stepName}) failed to deliver.`);
  } else if (roll < 0.30) {
    msg.status = 'Replied';
    lead.responded = true;
    if (lead.status === 'New') lead.status = 'Contacted';
    logActivity(`${lead.name} replied to "${msg.stepName}".`);
  } else {
    msg.status = 'Sent';
    if (lead.status === 'New') lead.status = 'Contacted';
    logActivity(`Sent "${msg.stepName}" to ${lead.name} (Day ${state.simDay}).`);
  }

  saveState();
  renderAll();
}

/* ==========================================================================
   RENDERING
   ========================================================================== */

function renderAll() {
  document.getElementById('simDayValue').textContent = state.simDay;
  renderStats();
  renderQueue();
  renderActivity();
  renderLeadsTable();
  renderRulesGrid();
  renderTemplates();
  renderConversationList();
  renderThread(selectedConversationLeadId);
}

function renderStats() {
  const activeCampaigns = state.leads.filter(l => l.campaignActive && !l.optedOut).length;
  const sent = state.messages.filter(m => m.status === 'Sent' || m.status === 'Replied').length;
  const responses = state.messages.filter(m => m.status === 'Replied').length;
  const conversion = state.leads.length ? Math.round((state.leads.filter(l => l.status === 'Completed').length / state.leads.length) * 100) : 0;
  const due = state.messages.filter(m => {
    if (m.status !== 'Scheduled') return false;
    const lead = findLead(m.leadId);
    return lead && lead.campaignActive && !lead.optedOut && m.scheduledDay <= state.simDay;
  }).length;
  const recovered = state.leads.filter(l => l.activeCampaign === 'MISSED_APPOINTMENT' && l.responded).length;

  document.getElementById('statActiveCampaigns').textContent = activeCampaigns;
  document.getElementById('statMessagesSent').textContent = sent;
  document.getElementById('statResponses').textContent = responses;
  document.getElementById('statConversion').textContent = conversion + '%';
  document.getElementById('statDue').textContent = due;
  document.getElementById('statRecovered').textContent = recovered;
}

function renderQueue() {
  const tbody = document.querySelector('#queueTable tbody');
  tbody.innerHTML = '';
  const scheduled = state.messages
    .filter(m => m.status === 'Scheduled')
    .sort((a, b) => a.scheduledDay - b.scheduledDay || a.id - b.id)
    .slice(0, 12);

  scheduled.forEach(m => {
    const lead = findLead(m.leadId);
    if (!lead) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(lead.name)}</td>
      <td>${SEQUENCE_LABELS[m.campaign]}</td>
      <td>${escapeHtml(m.stepName)}</td>
      <td>Day ${m.scheduledDay}</td>
      <td>${statusBadge(lead.optedOut ? 'Opted Out' : (lead.campaignActive ? 'Scheduled' : 'Paused'))}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('queueEmpty').style.display = scheduled.length ? 'none' : 'block';
}

function renderActivity() {
  const feed = document.getElementById('activityFeed');
  feed.innerHTML = '';
  if (state.activity.length === 0) {
    feed.innerHTML = '<li class="empty-note">No activity yet.</li>';
    return;
  }
  state.activity.forEach(a => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="a-time">Day ${a.day}</span>${escapeHtml(a.text)}`;
    feed.appendChild(li);
  });
}

function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, '');
}

function statusBadge(status) {
  return `<span class="badge badge-${statusClass(status)}">${status}</span>`;
}

function renderLeadsTable() {
  const tbody = document.querySelector('#leadsTable tbody');
  tbody.innerHTML = '';
  state.leads.slice().reverse().forEach(lead => {
    const tr = document.createElement('tr');
    const campaignLabel = lead.optedOut ? 'Opted Out' : lead.activeCampaign ? `${SEQUENCE_LABELS[lead.activeCampaign]} (${lead.campaignActive ? 'Active' : 'Stopped'})` : '—';
    tr.innerHTML = `
      <td>${escapeHtml(lead.name)}</td>
      <td>${escapeHtml(lead.phone)}</td>
      <td>${escapeHtml(lead.service)}</td>
      <td>${lead.leadDate}</td>
      <td>${statusBadge(lead.status)}</td>
      <td>${escapeHtml(campaignLabel)}</td>
      <td class="row-actions"></td>
    `;
    const actionsCell = tr.querySelector('.row-actions');
    actionsCell.appendChild(makeActionButtons(lead));
    tbody.appendChild(tr);
  });
  document.getElementById('leadsEmpty').style.display = state.leads.length ? 'none' : 'block';
}

function makeActionButtons(lead) {
  const wrap = document.createElement('div');
  wrap.className = 'row-actions';

  const addBtn = (label, cls, onClick, disabled) => {
    const b = document.createElement('button');
    b.className = `btn btn-small ${cls || ''}`;
    b.textContent = label;
    b.disabled = !!disabled;
    b.onclick = onClick;
    wrap.appendChild(b);
  };

  if (!lead.optedOut) {
    addBtn('Book Appt', '', () => triggerCampaign(lead.id, 'APPOINTMENT_BOOKED', 'Booked'), lead.status === 'Booked');
    addBtn('Missed Appt', '', () => triggerCampaign(lead.id, 'MISSED_APPOINTMENT', 'Missed'));
    addBtn('Mark Completed', '', () => triggerCampaign(lead.id, 'COMPLETED_SERVICE', 'Completed'), lead.status === 'Completed');
    if (lead.campaignActive) addBtn('Stop', 'btn-danger', () => stopCampaign(lead.id));
    else addBtn('Resume', 'btn-success', () => resumeCampaign(lead.id));
    addBtn('Opt Out', 'btn-danger', () => optOutLead(lead.id));
  } else {
    addBtn('Opted Out', '', null, true);
  }
  return wrap;
}

function renderRulesGrid() {
  const grid = document.getElementById('rulesGrid');
  grid.innerHTML = '';
  Object.keys(state.sequences).forEach(key => {
    const card = document.createElement('div');
    card.className = 'rule-card';
    const steps = state.sequences[key];
    card.innerHTML = `
      <span class="rule-trigger">${SEQUENCE_LABELS[key]} →</span>
      <h3>${steps.map(s => s.name).join(' → ')}</h3>
      <ul class="rule-steps"></ul>
    `;
    const ul = card.querySelector('.rule-steps');
    steps.forEach((step, idx) => {
      const li = document.createElement('li');
      li.className = 'rule-step';
      li.innerHTML = `
        <span class="step-name">${idx + 1}. ${escapeHtml(step.name)}</span>
        <input type="number" min="0" max="30" value="${step.delayDays}" data-seq="${key}" data-idx="${idx}">
        <span class="step-unit">days</span>
      `;
      ul.appendChild(li);
    });
    grid.appendChild(card);
  });

  grid.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('change', e => {
      const seq = e.target.dataset.seq;
      const idx = parseInt(e.target.dataset.idx, 10);
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      state.sequences[seq][idx].delayDays = val;
      saveState();
      showToast('Delay updated — applies to new campaigns.');
    });
  });
}

function renderTemplates() {
  const list = document.getElementById('templatesList');
  list.innerHTML = '';
  Object.keys(state.templates).forEach(key => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `
      <h3>${TEMPLATE_LABELS[key] || key}</h3>
      <div class="template-meta">key: ${key}</div>
      <textarea data-key="${key}">${escapeHtml(state.templates[key])}</textarea>
      <div class="template-actions">
        <button class="btn btn-small btn-primary" data-save="${key}">Save Template</button>
      </div>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll('button[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.save;
      const textarea = list.querySelector(`textarea[data-key="${key}"]`);
      state.templates[key] = textarea.value;
      saveState();
      showToast('Template saved.');
    });
  });
}

function renderConversationList() {
  const ul = document.getElementById('conversationLeadList');
  ul.innerHTML = '';
  if (state.leads.length === 0) {
    ul.innerHTML = '<li class="empty-note">No leads yet.</li>';
    return;
  }
  state.leads.slice().reverse().forEach(lead => {
    const li = document.createElement('li');
    li.className = lead.id === selectedConversationLeadId ? 'selected' : '';
    li.innerHTML = `${escapeHtml(lead.name)}<span>${lead.status}${lead.optedOut ? ' · opted out' : ''}</span>`;
    li.onclick = () => { selectedConversationLeadId = lead.id; renderConversationList(); renderThread(lead.id); };
    ul.appendChild(li);
  });
}

function renderThread(leadId) {
  const header = document.getElementById('threadHeader');
  const messagesEl = document.getElementById('threadMessages');
  const controls = document.getElementById('threadControls');
  const lead = findLead(leadId);

  if (!lead) {
    header.innerHTML = '<p class="empty-note">Select a lead to view their message timeline.</p>';
    messagesEl.innerHTML = '';
    controls.innerHTML = '';
    return;
  }

  header.innerHTML = `
    <h3>${escapeHtml(lead.name)}</h3>
    <div class="meta">${escapeHtml(lead.phone)} · ${escapeHtml(lead.service)} ${statusBadge(lead.status)} ${lead.activeCampaign ? statusBadge(lead.campaignActive ? 'Active' : 'Stopped') : ''}</div>
  `;

  const msgs = state.messages
    .filter(m => m.leadId === leadId)
    .sort((a, b) => a.scheduledDay - b.scheduledDay || a.id - b.id);

  if (msgs.length === 0) {
    messagesEl.innerHTML = '<p class="empty-note">No messages yet.</p>';
  } else {
    messagesEl.innerHTML = msgs.map(m => {
      const body = m.body || fillTemplate(state.templates[m.templateKey] || '', lead);
      return `
        <div class="msg-bubble">
          <div>${escapeHtml(body)}</div>
          <div class="msg-meta">
            <span>${escapeHtml(m.stepName)} · ${SEQUENCE_LABELS[m.campaign]}</span>
            <span>${m.status === 'Scheduled' ? `Due Day ${m.scheduledDay}` : `Day ${m.sentDay}`} · ${statusBadge(m.status)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  controls.innerHTML = '';
  const btnWrap = makeActionButtons(lead);
  controls.appendChild(btnWrap);
}

/* ---------- utils ---------- */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ==========================================================================
   EVENTS
   ========================================================================== */

document.getElementById('tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`view-${btn.dataset.tab}`).classList.add('active');
});

document.getElementById('leadForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('leadName').value.trim();
  const phone = document.getElementById('leadPhone').value.trim();
  const service = document.getElementById('leadService').value.trim();
  const appointmentDate = document.getElementById('leadAppointment').value.trim();
  if (!name || !phone || !service) return;
  addLead({ name, phone, service, appointmentDate });
  e.target.reset();
});

document.getElementById('simulateBtn').addEventListener('click', simulateNextMessage);

/* ---------- init ---------- */

function seedDemoData() {
  if (state.leads.length > 0) return;
  addLead({ name: 'Sarah Johnson', phone: '(555) 214-8890', service: 'Oil Change', appointmentDate: '' });
}

renderAll();
if (state.leads.length === 0) {
  seedDemoData();
}
