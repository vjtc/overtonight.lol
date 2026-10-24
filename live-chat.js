import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const configUrl = window.OVT_SUPABASE_URL;
const configKey = window.OVT_SUPABASE_ANON_KEY;
const configured = configUrl && configKey && !configUrl.includes('YOUR_') && !configKey.includes('YOUR_');
const backdrop = document.getElementById('authBackdrop');
const authForm = document.getElementById('authForm');
const usernameWrap = document.getElementById('usernameWrap');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const authSubmit = document.getElementById('authSubmit');
const authSwitch = document.getElementById('authSwitch');
const authSwitchText = document.getElementById('authSwitchText');
const authError = document.getElementById('authError');
const authConfigHelp = document.getElementById('authConfigHelp');
let mode = 'login', supabase = null, currentUser = null, currentProfile = null, currentChannel = 'general';
const $ = id => document.getElementById(id);
function setMode(next) {
  mode = next; authError.textContent = '';
  const signup = mode === 'signup';
  usernameWrap.classList.toggle('auth-hidden', !signup);
  $('authPassword').autocomplete = signup ? 'new-password' : 'current-password';
  $('authUsername').required = signup;
  authTitle.textContent = signup ? 'Create your account' : 'Welcome back';
  authSubtitle.textContent = signup ? 'Choose a username and join the community.' : 'Sign in to join the live conversation.';
  authSubmit.textContent = signup ? 'Create account' : 'Sign in';
  authSwitchText.textContent = signup ? 'Already have an account?' : 'New here?';
  authSwitch.textContent = signup ? 'Sign in' : 'Create an account';
}
authSwitch.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));
if (!configured) {
  authConfigHelp.classList.remove('auth-hidden');
  authError.textContent = 'Live chat is not configured yet. Follow the setup steps included in this ZIP.';
  authForm.addEventListener('submit', e => { e.preventDefault(); authError.textContent = 'Add your Supabase URL and publishable/anon key to supabase-config.js, then run supabase-setup.sql.'; });
} else {
  supabase = createClient(configUrl, configKey);
  authForm.addEventListener('submit', async e => {
    e.preventDefault(); authSubmit.disabled = true; authError.textContent = '';
    const email = $('authEmail').value.trim(); const password = $('authPassword').value;
    try {
      if (mode === 'signup') {
        const username = $('authUsername').value.trim();
        if (!/^[A-Za-z0-9_]{2,24}$/.test(username)) throw new Error('Username must be 2–24 characters: letters, numbers, or underscores.');
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw error;
        if (data.user && data.session) await createProfile(data.user, username);
        if (data.user && !data.session) authError.textContent = 'Check your email to confirm your account, then sign in.';
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error;
      }
    } catch (err) { authError.textContent = err.message || 'Authentication failed.'; }
    finally { authSubmit.disabled = false; }
  });
  supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => initialise(session?.user || null), 0); });
  supabase.auth.getSession().then(({ data }) => initialise(data.session?.user || null));
}
async function createProfile(user, username) {
  const { error } = await supabase.from('profiles').upsert({ id: user.id, username }, { onConflict: 'id' });
  if (error) throw error;
}
async function initialise(user) {
  currentUser = user;
  if (!user) { backdrop.style.display = 'flex'; $('profileName').textContent = 'Guest'; $('profileStatus').textContent = 'Sign in required'; return; }
  let { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) { authError.textContent = error.message; return; }
  if (!profile) {
    const suggested = user.user_metadata?.username || user.email?.split('@')[0] || 'member';
    const username = suggested.replace(/[^A-Za-z0-9_]/g, '').slice(0,24) || 'member';
    const { data: created, error: createError } = await supabase.from('profiles').insert({ id: user.id, username }).select().single();
    if (createError) { backdrop.style.display='flex'; authError.textContent='Profile setup failed: '+createError.message; return; }
    profile = created;
  }
  currentProfile = profile; backdrop.style.display = 'none'; $('profileName').textContent = profile.username; $('profileAvatar').textContent = profile.username[0].toUpperCase(); $('profileStatus').textContent = 'Online'; $('chatHint').textContent = 'Live chat · messages sync in real time';
  await loadMessages(currentChannel);
  supabase.removeAllChannels();
  supabase.channel('public-live-chat').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
    if (payload.eventType === 'INSERT' && payload.new.channel === currentChannel) renderMessage(payload.new);
    if (payload.eventType === 'UPDATE' && payload.new.channel === currentChannel) updateMessage(payload.new);
    if (payload.eventType === 'DELETE') document.querySelector(`[data-message-id="${payload.old.id}"]`)?.remove();
  }).subscribe();
}
function renderMessage(row) {
  if (document.querySelector(`[data-message-id="${row.id}"]`)) return;
  const welcome = document.querySelector('#messages .welcome'); if (welcome) welcome.remove();
  const el = window.addMessage(row.username, (row.username || '?')[0].toUpperCase(), row.content, new Date(row.created_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));
  el.dataset.messageId = row.id; el.dataset.userId = row.user_id; el.dataset.own = String(row.user_id === currentUser?.id);
  if (row.edited_at) { el.dataset.edited = 'true'; const tag = document.createElement('span'); tag.className='edited-indicator'; tag.textContent='(edited)'; el.querySelector('.msg-body').append(tag); }
  $('messages').scrollTop = $('messages').scrollHeight;
}
function updateMessage(row) {
  const el = document.querySelector(`[data-message-id="${row.id}"]`); if (!el) return;
  const content = el.querySelector('.msg-text'); if (content && !content.querySelector('textarea')) content.textContent = row.content;
  if (row.edited_at && !el.querySelector('.edited-indicator')) { const tag=document.createElement('span');tag.className='edited-indicator';tag.textContent='(edited)';el.querySelector('.msg-body').append(tag); }
}
async function loadMessages(channel) {
  currentChannel = channel; $('messages').innerHTML = '';
  const { data, error } = await supabase.from('chat_messages').select('*').eq('channel', channel).order('created_at', {ascending:true}).limit(300);
  if (error) { $('chatHint').textContent = 'Could not load messages: '+error.message; return; }
  if (!data.length) { const welcome=document.createElement('div');welcome.className='welcome';const h=document.createElement('h2');h.textContent='Welcome to #'+channel;const p=document.createElement('p');p.textContent='This is the beginning of the conversation.';welcome.append(h,p);$('messages').append(welcome); }
  data.forEach(renderMessage);
}
// Use the authenticated database for sending; prevent the demo-only handler from also adding a local copy.
$('messageForm').addEventListener('submit', async e => {
  if (!supabase || !currentUser || !currentProfile) { e.preventDefault(); e.stopImmediatePropagation(); if (!configured) { backdrop.style.display='flex'; } return; }
  e.preventDefault(); e.stopImmediatePropagation();
  const input = $('messageInput'); const content = input.value.trim(); if (!content) return;
  const active = document.querySelector('[data-channel].active'); const channel = active?.dataset.channel || 'general';
  if (channel === 'Lounge' || channel === 'Listening Room') { $('chatHint').textContent='Voice chat needs a separate audio service; text channels are live.'; return; }
  const reply = document.getElementById('replyLabel').textContent;
  const fullContent = reply ? `${reply}\n${content}` : content;
  const { error } = await supabase.from('chat_messages').insert({ channel, user_id: currentUser.id, username: currentProfile.username, content: fullContent });
  if (error) { $('chatHint').textContent='Message failed: '+error.message; return; }
  input.value=''; document.getElementById('cancelReply').click();
}, true);
// Channel navigation loads messages from the database instead of static demo content.
document.querySelectorAll('[data-channel]').forEach(button => button.addEventListener('click', () => { if (supabase && currentUser) loadMessages(button.dataset.channel); }));
// Persist inline edits and deletions when the UI performs them.
const observer = new MutationObserver(records => {
  if (!supabase || !currentUser) return;
  for (const record of records) {
    for (const node of record.removedNodes) {
      if (node.nodeType === 1 && node.classList?.contains('message') && node.dataset.messageId && node.dataset.userId === currentUser.id) {
        supabase.from('chat_messages').delete().eq('id', node.dataset.messageId).eq('user_id', currentUser.id).then(({error})=>{if(error) console.error('Delete failed',error.message);});
      }
    }
  }
});
observer.observe($('messages'), {childList:true});
// Observe edits after the inline editor has committed its new text.
$('messages').addEventListener('focusout', async e => {
  const message = e.target.closest('.message'); if (!message?.dataset.messageId || message.dataset.userId !== currentUser?.id) return;
  const content = message.querySelector('.msg-text')?.textContent?.trim(); if (!content) return;
  const {error} = await supabase.from('chat_messages').update({content, edited_at:new Date().toISOString()}).eq('id',message.dataset.messageId).eq('user_id',currentUser.id);
  if (error) console.error('Edit failed',error.message);
}, true);
$('signOutBtn').addEventListener('click', async () => { if (supabase) await supabase.auth.signOut(); });
