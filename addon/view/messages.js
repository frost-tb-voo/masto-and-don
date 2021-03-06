function getBrowser() {
  try {
    return browser;
  } catch (err) {
    return chrome;
  }
}

function runtimeSendMessage(query) {
  return new Promise(function (resolv, reject) {
    try {
      let querying = getBrowser().runtime.sendMessage(query);
      if (!querying) {
        getBrowser().runtime.sendMessage(query, resolv);
        return;
      }
      querying.then(resolv).catch(reject);
    } catch (err) {
      try {
        getBrowser().runtime.sendMessage(query, resolv);
      } catch (err) {
        reject('browser.runtime.sendMessage unsupported!');
      }
    }
  });
}

function restoreConfig() {
  runtimeSendMessage({
    popup: true
  }).then((message) => {
    console.log(JSON.stringify(message, null, 1));
    updateSupportingMessage(message.message);
    if (Object.keys(message.config).includes('domains')) {
      domains = message.config.domains;
    }
    if (Object.keys(message.config).includes('languagesUnchecked')) {
      let languagesUnchecked = message.config.languagesUnchecked;
      for (let language of languagesUnchecked) {
        if (language && !languages.includes(language)) {
          languages.push(language);
          createNewLanguageFilter(language);
        }
        let checkbox = document.getElementById('checkbox-' + language);
        checkbox.removeAttribute('checked');
      }
    }
    if (Object.keys(message.config).includes('instanceInfoSwitchChecked')) {
      let instanceInfoSwitchChecked = message.config.instanceInfoSwitchChecked;
      let instanceInfoSwitch = document.getElementById('instance-info-switch');
      if (instanceInfoSwitchChecked) {
        instanceInfoSwitch.setAttribute('checked', true);
      } else {
        instanceInfoSwitch.removeAttribute('checked');
      }
    }
    if (Object.keys(message.config).includes('schemeSwitchChecked')) {
      let schemeSwitchChecked = message.config.schemeSwitchChecked;
      if (schemeSwitchChecked) {
        targetScheme = 'http:';
        targetWsScheme = 'ws:';
      } else {
        targetScheme = 'https:';
        targetWsScheme = 'wss:';
      }
      let schemeSwitch = document.getElementById('scheme-switch');
      if (schemeSwitchChecked) {
        schemeSwitch.setAttribute('checked', true);
      } else {
        schemeSwitch.removeAttribute('checked');
      }
    }
    requestTimelinesApi();
  }, console.error);
}

restoreConfig();

function setLocale() {
  {
    let dom = document.getElementById('register-text-description');
    let message = getBrowser().i18n.getMessage('registerText');
    dom.appendChild(document.createTextNode(message));
  } {
    let dom = document.getElementById('instance-info-switch-description');
    let message = getBrowser().i18n.getMessage('instanceInfoSwitch');
    dom.appendChild(document.createTextNode(message));
  } {
    let dom = document.getElementById('scheme-switch-description');
    let message = getBrowser().i18n.getMessage('schemeSwitch');
    dom.appendChild(document.createTextNode(message));
  }
}

setLocale();

function updateSupportingMessage(message) {
  let consoleDiv = document.getElementById('div-console');
  if (consoleDiv) {
    consoleDiv.textContent = message;
  }
}

function requestStreaming(newDomain, access_token) {
  let target = 'public';
  target = 'list'; //401
  target = 'user'; //401
  target = 'public/local'; //401
  target = 'local'; //401
  target = 'hashtag';
  target = 'playlist';
  target = 'public';
  let path = '/api/v1/streaming/';

  let connection = new WebSocket(targetWsScheme + '//' + newDomain + path + '?stream=' + target + '&access_token=' + access_token);
  connection.onopen = function (evt) {
    console.log('ws:' + newDomain + ':' + JSON.stringify(evt, null, 1));
    updateSupportingMessage('Open streaming ' + newDomain);
  };

  connection.onmessage = function (evt) {
    if (!evt.data) {
      console.log('ws:' + newDomain + ':' + JSON.stringify(evt, null, 1));
      return;
    }
    let data = JSON.parse(evt.data);
    if (!data) {
      return;
    }
    if (data.event != 'update') {
      console.log('ws:' + newDomain + ':' + data.event);
    }
    if (!data.payload) {
      return;
    }
    let toot = JSON.parse(data.payload);
    // console.log('ws:' + JSON.stringify(toot, null, 1));
    if (toot.account) {
      let url = toot.url.replace(/users\/(.+)\/statuses/, '@$1');
      url = toot.url.replace(/users\/(.+)\/updates/, '@$1');
      if (Object.keys(toots_domain).includes(url)) {
        return;
      }
      toots_domain[url] = newDomain;
      showNewToot(toot, newDomain);
    }
  }
}

let domains = [
  'mastodon.social',
];

async function register(evt) {
  if (evt) {
    evt.preventDefault();
  }
  let registerText = document.getElementById('register-text');
  let newDomain = registerText.value;
  if (newDomain && !domains.includes(newDomain)) {
    domains.push(newDomain);
    await requestTimelinesApi();
  }
}

document
  .getElementById('register-form')
  .addEventListener('submit', register, false);

let targetScheme = 'https:';
let targetWsScheme = 'wss:';

function changeScheme(evt) {
  let schemeSwitchChecked = document.getElementById('scheme-switch').checked;
  if (schemeSwitchChecked) {
    targetScheme = 'http:';
    targetWsScheme = 'ws:';
  } else {
    targetScheme = 'https:';
    targetWsScheme = 'wss:';
  }
}

document
  .getElementById('scheme-switch')
  .addEventListener('change', changeScheme, false);

async function saveConfig(evt) {
  let languagesUnchecked = [];
  for (let language of languages) {
    let checkbox = document.getElementById('checkbox-' + language);
    if (checkbox.checked) {
      continue;
    }
    languagesUnchecked.push(language);
  }
  let instanceInfoSwitchChecked = document.getElementById('instance-info-switch').checked;
  let schemeSwitchChecked = document.getElementById('scheme-switch').checked;
  changeScheme(evt);
  await register(evt);

  runtimeSendMessage({
    popup: true,
    config: {
      domains: domains,
      languagesUnchecked: languagesUnchecked,
      instanceInfoSwitchChecked: instanceInfoSwitchChecked,
      schemeSwitchChecked: schemeSwitchChecked,
    }
  }).then((message) => {
    console.log(JSON.stringify(message, null, 1));
    updateSupportingMessage(message.message);
  }, console.error);
}

document
  .getElementById('save-config-button')
  .addEventListener('click', saveConfig);

let minIds = {};
let toots_domain = {};
let connecting = false;

async function requestTimelinesApi(isFetchingPrevious) {
  let toots = [];
  if (connecting) {
    return;
  }
  connecting = true;
  for (let fetchingDomain of domains) {
    let path = '/api/v1/timelines/public';
    if (isFetchingPrevious && minIds[fetchingDomain]) {
      path += '?max_id=' + minIds[fetchingDomain] + '&limit=20';
    }
    updateSupportingMessage('Connecting to ' + fetchingDomain + ' ...');
    try {
      let response = await fetch(targetScheme + '//' + fetchingDomain + path);
      console.log(fetchingDomain + ' : ' + response.status);
      let data = await response.json();
      for (let toot of data) {
        let url = toot.url.replace(/users\/(.+)\/statuses/, '@$1');
        url = toot.url.replace(/users\/(.+)\/updates/, '@$1');
        if (Object.keys(toots_domain).includes(url)) {
          continue;
        }
        toots.push(toot);
        toots_domain[url] = fetchingDomain;
      }
    } catch (err) {
      updateSupportingMessage('err:' + JSON.stringify(err, null, 1));
    }
  }
  if (!isFetchingPrevious) {
    toots.sort((aa, bb) => {
      return new Date(aa.created_at) - new Date(bb.created_at);
    });
  } else {
    toots.sort((aa, bb) => {
      return new Date(bb.created_at) - new Date(aa.created_at);
    });
  }
  for (let fetchingDomain of domains) {
    await createNewDomain(fetchingDomain);
  }
  for (let toot of toots) {
    let url = toot.url.replace(/users\/(.+)\/statuses/, '@$1');
    url = toot.url.replace(/users\/(.+)\/updates/, '@$1');
    let fetchingDomain = toots_domain[url];
    if (!isFetchingPrevious) {
      await showNewToot(toot, fetchingDomain, false);
    } else {
      await showNewToot(toot, fetchingDomain, true);
    }
  }
  updateSupportingMessage('Updated at ' + new Date());
  document
    .getElementById('config-button')
    .addEventListener('click', configSwitch);
  connecting = false;
}

function showNewToot(toot, domain, isAppending) {
  let acct = toot.account.acct;
  let acct_domain = acct.replace(/^(.+)@(.+)$/, '$2');
  if (!acct.includes('@')) {
    acct_domain = domain;
    if (!minIds[domain]) {
      minIds[domain] = toot.id;
    }
    if (minIds[domain] > toot.id) {
      minIds[domain] = toot.id;
    }
  }

  let url = toot.url;
  let created_at = toot.created_at;
  let username = toot.account.username;
  let display_name = toot.account.display_name;
  if (!display_name) {
    display_name = username;
  }
  let avatar = toot.account.avatar;
  let headerImage = toot.account.header;
  let reblogs_count = toot.reblogs_count;
  let favourites_count = toot.favourites_count;

  let created_at_zone = new Date(created_at);
  let month = created_at_zone.getMonth() + 1;
  let created_at_string = month + '/' + created_at_zone.getDate() + ' ' + created_at_zone.getHours() + ':' + created_at_zone.getMinutes();

  let content = toot.content;

  let language = toot.language;
  if (language && !languages.includes(language)) {
    languages.push(language);
    createNewLanguageFilter(language);
  }

  createNewDomainFilter(acct_domain);

  let tlId = 'tl-' + acct_domain;
  // tlId = 'all';
  let eventList = document.getElementById(tlId);
  if (!eventList) {
    return;
  }

  let container = document.createElement('div');
  if (language) {
    container.setAttribute('class', 'timeline-step ' + language);
  } else {
    container.setAttribute('class', 'timeline-step');
  }
  container.setAttribute('background', avatar);
  container.style.background = 'url("' + avatar + '")';
  container.style.backgroundPosition = 'right top';
  container.style.backgroundRepeat = 'no-repeat';
  container.style.backgroundSize = '120px';

  let sHeader = document.createElement('div');
  sHeader.setAttribute('class', 'step-header');
  container.appendChild(sHeader);

  let sIcon = document.createElement('div');
  sIcon.setAttribute('class', 'step-icon');
  sHeader.appendChild(sIcon);

  let sText = document.createElement('div');
  sText.setAttribute('class', 'step-text');
  sHeader.appendChild(sText);

  let statusLink = document.createElement('a');
  statusLink.setAttribute('href', url);
  statusLink.setAttribute('target', '_blank');
  statusLink.appendChild(document.createTextNode(created_at_string));
  sText.appendChild(statusLink);

  sText.appendChild(document.createTextNode(' '));

  let usernameLink = document.createElement('a');
  usernameLink.setAttribute('href', targetScheme + '//' + acct_domain + '/@' + username);
  usernameLink.setAttribute('target', '_blank');
  usernameLink.appendChild(document.createTextNode(display_name));
  sText.appendChild(usernameLink);

  let sContent = document.createElement('div');
  sContent.setAttribute('class', 'step-content');
  container.appendChild(sContent);

  let sConnector = document.createElement('div');
  sConnector.setAttribute('class', 'step-connector');
  sContent.appendChild(sConnector);

  let sInner = document.createElement('div');
  sInner.setAttribute('class', 'step-inner');
  sInner.style.backgroundColor = 'rgba(255,255,255,0.80)'
  sInner.appendChild(createDom(content));
  sContent.appendChild(sInner);

  if (!isAppending) {
    eventList.insertBefore(container, eventList.firstChild.nextSibling);
  } else {
    eventList.insertBefore(container, eventList.lastChild);
  }
  if (!domains.includes(acct_domain)) {
    eventList.parentElement.style.display = 'none';
  }
}

function createDom(data) {
  let doc;
  if (document.implementation.createHTMLDocument) {
    doc = document.implementation.createHTMLDocument("");
    // let dom = doc.createElement('html');
    // dom.innerHTML = data;
    let range = doc.createRange();
    range.selectNodeContents(doc.documentElement);
    range.deleteContents();
    doc.documentElement.appendChild(range.createContextualFragment(data));
  } else {
    // before Firefox 3.6.x
    let doctype = document.implementation.createDocumentType(
      'html',
      '-//W3C//DTD HTML 4.01 Transitional//EN',
      'http://www.w3.org/TR/html4/loose.dtd'
    );
    doc = document.implementation.createDocument(null, 'html', doctype); {
      // Create a base tag
      let range = doc.createRange();
      range.selectNodeContents(doc.documentElement);
      let content = doc.adoptNode(range.createContextualFragment('<base href="' + url + '">'));
      doc.documentElement.appendChild(content);
    } {
      let range = doc.createRange();
      range.selectNodeContents(doc.documentElement);
      let content = doc.adoptNode(range.createContextualFragment(data));
      doc.documentElement.appendChild(content);
    }
  }
  return doc.documentElement;
}

async function createNewDomain(acct_domain) {
  let tlId = 'tl-' + acct_domain;
  // tlId = 'all';
  let eventList = document.getElementById(tlId);
  if (!eventList) {
    let tlId = 'tl-' + acct_domain;
    console.log('create event list for ' + acct_domain)
    let eventList = await createNewTimeline(acct_domain, tlId);

    let tl = document.getElementById('tl');
    let td = document.createElement('td');
    td.appendChild(eventList);
    tl.appendChild(td);

    createNewDomainFilter(acct_domain);
    requestStreaming(acct_domain, '');
  }
}

async function createNewTimeline(acct_domain, tlId) {
  let eventList = document.createElement('div');
  eventList.style.minWidth = '320px';
  eventList.setAttribute('class', 'timeline-wrapper');
  eventList.setAttribute('id', tlId);
  let h2 = document.createElement('h2');
  h2.setAttribute('class', 'timeline-header');
  let domainLink = document.createElement('a');
  h2.appendChild(domainLink);
  let descriptionDiv = document.createElement('div');
  h2.appendChild(descriptionDiv);
  eventList.appendChild(h2);

  let handlerDom = document.createElement('div');
  handlerDom.style.color = '#ffffff';
  handlerDom.style.height = '100%';
  handlerDom.appendChild(document.createTextNode('more'));
  window.addEventListener('scroll', (evt) => {
    let clientHeight = document.documentElement.clientHeight;
    let top = handlerDom.getBoundingClientRect().top;
    let bottom = handlerDom.getBoundingClientRect().bottom;
    if (clientHeight > top || clientHeight > bottom) {
      requestTimelinesApi(true);
    }
  });
  eventList.appendChild(handlerDom);

  let instanceInfoSwitch = document.getElementById('instance-info-switch');
  if (!instanceInfoSwitch.checked) {
    let headerDiv = document.createElement('div');
    headerDiv.style.backgroundColor = 'rgba(255,255,255,0.80)';

    let domainLink = document.createElement('a');
    domainLink.setAttribute('href', targetScheme + '//' + acct_domain + '/about/more');
    domainLink.setAttribute('target', '_blank');
    domainLink.appendChild(document.createTextNode('(' + acct_domain + ')'));
    domainLink.style.margin = '1px';
    domainLink.style.padding = '1px';
    headerDiv.appendChild(domainLink);

    h2.appendChild(headerDiv);
    return eventList;
  }

  let path = '/api/v1/instance';
  updateSupportingMessage('Connecting to ' + acct_domain + ' ...');
  try {
    let response = await fetch(targetScheme + '//' + acct_domain + path);
    console.log(acct_domain + ' : ' + response.status);
    let data = await response.json();

    let uri = data.uri;
    let title = data.title;
    let description = data.description;
    let thumbnail = data.thumbnail;
    let urls = data.urls;

    h2.style.background = 'url("' + thumbnail + '")';
    h2.style.backgroundPosition = 'center top';
    h2.style.backgroundRepeat = 'no-repeat';
    h2.style.backgroundSize = '100%';

    let headerDiv = document.createElement('div');
    headerDiv.style.backgroundColor = 'rgba(255,255,255,0.80)';

    let domainLink = document.createElement('a');
    domainLink.setAttribute('href', targetScheme + '//' + uri + '/about/more');
    domainLink.setAttribute('target', '_blank');
    domainLink.appendChild(document.createTextNode(title + ' (' + uri + ')'));
    domainLink.style.margin = '1px';
    domainLink.style.padding = '1px';
    headerDiv.appendChild(domainLink);

    // let descriptionDiv = document.createElement('div');
    // descriptionDiv.innerHTML = description;
    // headerDiv.appendChild(descriptionDiv);

    h2.appendChild(headerDiv);
  } catch (err) {
    updateSupportingMessage('err:' + JSON.stringify(err, null, 1));
  }

  return eventList;
}

function createNewDomainFilter(acct_domain) {
  let filters = document.getElementById('filter-domain');
  let filterId = 'filter-' + acct_domain;
  if (document.getElementById(filterId)) {
    return;
  }

  let form = document.createElement('div');
  form.setAttribute('class', 'mdc-form-field');

  let filter = document.createElement('div');
  filter.setAttribute('class', 'mdc-checkbox');

  let checkbox = document.createElement('input');
  checkbox.setAttribute('class', 'mdc-checkbox__native-control');
  checkbox.setAttribute('type', 'checkbox');
  checkbox.setAttribute('id', 'checkbox-' + acct_domain);

  checkbox.onclick = (event) => {
    if (checkbox.checked) {
      let eventList = document.getElementById('tl-' + acct_domain);
      if (eventList) {
        eventList.parentElement.removeAttribute('style');
      }
      // add into fetching domains
      if (!domains.includes(acct_domain)) {
        domains.push(acct_domain);
        requestTimelinesApi();
      }
    } else {
      let eventList = document.getElementById('tl-' + acct_domain);
      if (eventList) {
        eventList.parentElement.style.display = 'none';
      }
      // remove from fetching domains
      let index = domains.indexOf(acct_domain);
      if (index > -1) {
        domains.splice(index, 1);
      }
    }
  };
  if (domains.includes(acct_domain)) {
    checkbox.setAttribute('checked', 'true');
  }

  let label = document.createElement('label');
  label.setAttribute('for', 'checkbox-' + acct_domain);
  label.appendChild(document.createTextNode(acct_domain));

  let background = document.createElement('div');
  background.setAttribute('class', 'mdc-checkbox__background');
  let checkmark = document.createElement('svg');
  checkmark.setAttribute('class', 'mdc-checkbox__checkmark');
  checkmark.setAttribute('viewBox', '0 0 24 24');
  let path = document.createElement('path');
  path.setAttribute('class', 'mdc-checkbox__checkmark-path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'white');
  path.setAttribute('d', 'M1.73,12.91 8.1,19.28 22.79,4.59');
  checkmark.appendChild(path);
  let mixedmark = document.createElement('div');
  mixedmark.setAttribute('class', 'mdc-checkbox__mixedmark');
  background.appendChild(checkmark);
  background.appendChild(mixedmark);

  filter.appendChild(checkbox);
  filter.appendChild(background);

  form.appendChild(filter);
  form.appendChild(label);
  let div = document.createElement('div');
  div.setAttribute('id', filterId);
  div.appendChild(form);

  filters.appendChild(div);
}

let languages = [];

function createNewLanguageFilter(language) {
  let filters = document.getElementById('filter-language');
  let form = document.createElement('div');
  form.setAttribute('class', 'mdc-form-field');

  let filter = document.createElement('div');
  filter.setAttribute('class', 'mdc-checkbox');

  let checkbox = document.createElement('input');
  checkbox.setAttribute('class', 'mdc-checkbox__native-control');
  checkbox.setAttribute('type', 'checkbox');
  checkbox.setAttribute('id', 'checkbox-' + language);
  checkbox.setAttribute('checked', 'true');
  checkbox.onclick = (event) => {
    if (checkbox.checked) {
      let containers = document.getElementsByClassName(language);
      for (let container of containers) {
        container.removeAttribute('style');
      }
    } else {
      let containers = document.getElementsByClassName(language);
      for (let container of containers) {
        container.style.display = 'none';
      }
    }
  };
  let label = document.createElement('label');
  label.setAttribute('for', 'checkbox-' + language);
  label.appendChild(document.createTextNode(language));

  let background = document.createElement('div');
  background.setAttribute('class', 'mdc-checkbox__background');
  let checkmark = document.createElement('svg');
  checkmark.setAttribute('class', 'mdc-checkbox__checkmark');
  checkmark.setAttribute('viewBox', '0 0 24 24');
  let path = document.createElement('path');
  path.setAttribute('class', 'mdc-checkbox__checkmark-path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'white');
  path.setAttribute('d', 'M1.73,12.91 8.1,19.28 22.79,4.59');
  checkmark.appendChild(path);
  let mixedmark = document.createElement('div');
  mixedmark.setAttribute('class', 'mdc-checkbox__mixedmark');
  background.appendChild(checkmark);
  background.appendChild(mixedmark);

  filter.appendChild(checkbox);
  filter.appendChild(background);

  form.appendChild(filter);
  form.appendChild(label);
  let div = document.createElement('div');
  div.appendChild(form);

  filters.appendChild(div);
}

function configSwitch(event) {
  let filters = document.getElementById('config');
  if (filters.style.display == 'none') {
    filters.style.display = 'inherit';
  } else {
    filters.style.display = 'none';
  }
}