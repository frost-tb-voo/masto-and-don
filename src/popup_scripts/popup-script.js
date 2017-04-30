console.log('load popup-script.');
//var browser = chrome;

require('material-design-lite');

function onFailed(error) {
  console.error(error);
}

function addNewHost(event) {
  event.preventDefault();
  // console.log(event);
  var target = event.target;
  while ((target.tagName != "BUTTON" || !target.getAttribute('hostname')) && target.parentNode) {
    target = target.parentNode;
  }
  //// console.log(target);
  if (target.tagName != "BUTTON")
    return;

  var hostname = target.getAttribute('hostname');
  if (!hostname) {
    return;
  }
  // console.log("popup script sending message " + event.type);

  if (browser != chrome) {
    var sending = browser.runtime.sendMessage({
      add: true,
      hostname: hostname
    });
    sending.then(onReceived, onFailed);
  } else {
    browser.runtime.sendMessage({
      add: true,
      hostname: hostname
    }, function (message) {
      if (message) {
        onReceived(message);
      } else {
        if (browser.runtime) {
          onFailed(browser.runtime.lastError);
        }
      }
    });
  }
}

function deleteHost(event) {
  event.preventDefault();
  // console.log(event);
  var target = event.target;
  while ((target.tagName != "BUTTON" || !target.getAttribute('hostname')) && target.parentNode) {
    target = target.parentNode;
  }
  //// console.log(target);
  if (target.tagName != "BUTTON")
    return;

  var hostname = target.getAttribute('hostname');
  // console.log("popup script sending message " + event.type);

  if (browser != chrome) {
    var sending = browser.runtime.sendMessage({
      delete: true,
      hostname: hostname
    });
    sending.then(onReceived, onFailed);
  } else {
    browser.runtime.sendMessage({
      delete: true,
      hostname: hostname
    }, function (message) {
      if (message) {
        onReceived(message);
      } else {
        if (browser.runtime) {
          onFailed(browser.runtime.lastError);
        }
      }
    });
  }
}

function switchNotification(event) {
  // console.log(event);
  var target = event.target;
  while ((target.tagName != "INPUT" || !target.getAttribute('id') || !target.getAttribute('hostname')) && target.parentNode) {
    target = target.parentNode;
  }
  //// console.log(target);
  if (target.tagName != "INPUT")
    return;

  var id = target.getAttribute('id');
  var hostname = target.getAttribute('hostname');
  var checked = target.checked;
  // console.log("popup script sending message " + id + ' -> ' + checked + ' for ' + hostname);

  if (browser != chrome) {
    var sending = browser.runtime.sendMessage({
      switch: true,
      hostname: hostname,
      target: id,
      checked: checked,
    });
    sending.then(onReceived, onFailed);
  } else {
    browser.runtime.sendMessage({
      switch: true,
      hostname: hostname,
      target: id,
      checked: checked,
    }, function (message) {
      if (message) {
        onReceived(message);
      } else {
        if (browser.runtime) {
          onFailed(browser.runtime.lastError);
        }
      }
    });
  }
}

function createCol(hostname, instance, cache) {
  var tr = document.createElement('tr');

  var instance_up = document.createElement('td');
  instance_up.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  var up_icon = document.createElement('i');
  up_icon.setAttribute('class', 'material-icons');
  if (instance && instance.up) {
    up_icon.appendChild(document.createTextNode('event_available'));
  } else {
    up_icon.appendChild(document.createTextNode('event_busy'));
  }
  instance_up.appendChild(up_icon);
  tr.appendChild(instance_up);

  var instance_name = document.createElement('td');
  instance_name.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  var alink = document.createElement('a');
  alink.setAttribute('href', 'https://' + hostname);
  alink.appendChild(document.createTextNode(hostname));
  instance_name.appendChild(alink);
  tr.appendChild(instance_name);

  var instance_users = document.createElement('td');
  instance_users.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  if (instance && instance.users) {
    instance_users.appendChild(document.createTextNode(instance.users));
  }
  tr.appendChild(instance_users);

  var https_rank = document.createElement('td');
  https_rank.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  if (instance && instance.https_rank) {
    https_rank.appendChild(document.createTextNode(instance.https_rank));
  }
  tr.appendChild(https_rank);

  var instance_uptime = document.createElement('td');
  instance_uptime.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  if (instance && instance.uptime) {
    var uptime = Math.floor(instance.uptime - 0);
    instance_uptime.appendChild(document.createTextNode(uptime));
  }
  tr.appendChild(instance_uptime);

  var followRequests_sw = document.createElement('td');
  followRequests_sw.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  if (cache) {
    var label = document.createElement('label');
    label.setAttribute('class', 'mdl-switch mdl-js-switch mdl-js-ripple-effect');
    label.setAttribute('for', 'follow_requests_' + hostname);
    var input = document.createElement('input');
    input.setAttribute('class', 'mdl-switch__input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', 'follow_requests_' + hostname);
    if (!cache.offFollowRequests) {
      input.setAttribute('checked', true);
    }
    input.setAttribute('hostname', hostname);
    input.addEventListener("change", switchNotification, false);
    label.appendChild(input);
    var span = document.createElement('span');
    span.setAttribute('class', 'mdl-switch__label');
    label.appendChild(span);
    followRequests_sw.appendChild(label);
  }
  tr.appendChild(followRequests_sw);

  var notification_sw = document.createElement('td');
  notification_sw.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  if (cache) {
    // var span = document.createElement('span');
    // span.setAttribute('class', 'mdl-badge mdl-badge--overlap');
    // span.setAttribute('data-badge', '1');
    // notification_sw.appendChild(span);

    var label = document.createElement('label');
    label.setAttribute('class', 'mdl-switch mdl-js-switch mdl-js-ripple-effect');
    label.setAttribute('for', 'notifications_' + hostname);
    var input = document.createElement('input');
    input.setAttribute('class', 'mdl-switch__input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', 'notifications_' + hostname);
    if (!cache.offNotifications) {
      input.setAttribute('checked', true);
    }
    input.setAttribute('hostname', hostname);
    input.addEventListener("change", switchNotification, false);
    label.appendChild(input);
    var span = document.createElement('span');
    span.setAttribute('class', 'mdl-switch__label');
    label.appendChild(span);
    notification_sw.appendChild(label);
  }
  tr.appendChild(notification_sw);

  var home_sw = document.createElement('td');
  home_sw.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  if (cache) {
    var label = document.createElement('label');
    label.setAttribute('class', 'mdl-switch mdl-js-switch mdl-js-ripple-effect');
    label.setAttribute('for', 'home_' + hostname);
    var input = document.createElement('input');
    input.setAttribute('class', 'mdl-switch__input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', 'home_' + hostname);
    if (!cache.offHome) {
      input.setAttribute('checked', true);
    }
    input.setAttribute('hostname', hostname);
    input.addEventListener("change", switchNotification, false);
    label.appendChild(input);
    var span = document.createElement('span');
    span.setAttribute('class', 'mdl-switch__label');
    label.appendChild(span);
    home_sw.appendChild(label);
  }
  tr.appendChild(home_sw);

  var public_sw = document.createElement('td');
  public_sw.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  if (cache) {
    var label = document.createElement('label');
    label.setAttribute('class', 'mdl-switch mdl-js-switch mdl-js-ripple-effect');
    label.setAttribute('for', 'public_' + hostname);
    var input = document.createElement('input');
    input.setAttribute('class', 'mdl-switch__input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', 'public_' + hostname);
    if (!cache.offPublic) {
      input.setAttribute('checked', true);
    }
    input.setAttribute('hostname', hostname);
    input.addEventListener("change", switchNotification, false);
    label.appendChild(input);
    var span = document.createElement('span');
    span.setAttribute('class', 'mdl-switch__label');
    label.appendChild(span);
    public_sw.appendChild(label);
  }
  tr.appendChild(public_sw);

  var td = document.createElement('td');
  td.setAttribute('class', 'mdl-data-table__cell--non-numeric');
  var new_button = document.createElement('button');
  if (instance && instance.up) {} else {
    new_button.setAttribute('disabled', true);
  }
  var func_icon = document.createElement('i');
  func_icon.setAttribute('class', 'material-icons');
  new_button.appendChild(func_icon);
  new_button.setAttribute('hostname', hostname);
  if (cache) {
    new_button.setAttribute('class', 'mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab mdl-js-ripple-effect');
    new_button.addEventListener("click", deleteHost, true);
    new_button.addEventListener("onclick", deleteHost, true);
    func_icon.appendChild(document.createTextNode('remove'));
  } else {
    new_button.setAttribute('class', 'mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab mdl-js-ripple-effect mdl-button--colored');
    new_button.addEventListener("click", addNewHost, true);
    new_button.addEventListener("onclick", addNewHost, true);
    func_icon.appendChild(document.createTextNode('add'));
  }
  td.appendChild(new_button);
  tr.appendChild(td);

  return tr;
}

function onReceived(message) {
  if (!message) {
    return;
  }
  // console.log('receive to popup ' + JSON.stringify(message, null, 2));
  //// console.log('receive to popup');

  let width = window.innerWidth;
  let height = window.innerHeight;
  height -= 20; //Adjust for Save button and horizontal scroll bar
  document.body.setAttribute('style', 'height:' + height + 'px;width:' + width + 'px;');

  var fragment = document.createDocumentFragment();

  var selectDiv = document.createElement('table');
  selectDiv.setAttribute('class', 'mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp');
  fragment.appendChild(selectDiv);

  var thead = document.createElement('thead');
  if (thead) {
    var thead_tr = document.createElement('tr');

    var th_status = document.createElement('th');
    th_status.appendChild(document.createTextNode('status'));
    thead_tr.appendChild(th_status);

    var th_name = document.createElement('th');
    th_name.setAttribute('class', 'mdl-data-table__cell--non-numeric');
    th_name.appendChild(document.createTextNode('hostname'));
    thead_tr.appendChild(th_name);

    var th_users = document.createElement('th');
    th_users.appendChild(document.createTextNode('# of users'));
    thead_tr.appendChild(th_users);

    var th_https = document.createElement('th');
    th_https.setAttribute('class', 'mdl-data-table__cell--non-numeric');
    th_https.appendChild(document.createTextNode('https'));
    th_https.appendChild(document.createElement('br'));
    th_https.appendChild(document.createTextNode('rank'));
    thead_tr.appendChild(th_https);

    var th_uptime = document.createElement('th');
    th_uptime.appendChild(document.createTextNode('uptime'));
    thead_tr.appendChild(th_uptime);

    var th_sw_notification = document.createElement('th');
    th_sw_notification.setAttribute('class', 'mdl-data-table__cell--non-numeric');
    th_sw_notification.appendChild(document.createTextNode('follow'));
    th_sw_notification.appendChild(document.createElement('br'));
    th_sw_notification.appendChild(document.createTextNode('requests'));
    thead_tr.appendChild(th_sw_notification);

    var th_sw_notification = document.createElement('th');
    th_sw_notification.appendChild(document.createTextNode('notifications'));
    thead_tr.appendChild(th_sw_notification);

    var th_swhome = document.createElement('th');
    th_swhome.appendChild(document.createTextNode('home'));
    thead_tr.appendChild(th_swhome);

    var th_swpublic = document.createElement('th');
    th_swpublic.appendChild(document.createTextNode('timeline'));
    thead_tr.appendChild(th_swpublic);

    thead.appendChild(thead_tr);
    selectDiv.appendChild(thead);
  }

  var select = document.createElement('tbody');
  selectDiv.appendChild(select);

  for (var cache of message.cache_list) {
    //// console.log(JSON.stringify(cache, null, 2));
    if (!cache.access_token) {
      continue;
    }
    var instance = false;
    for (var _instance of message.instances) {
      if (_instance.name == cache.hostname) {
        instance = _instance;
        break;
      }
    }
    var hostname = cache.hostname;
    var tr = createCol(hostname, instance, cache);
    select.appendChild(tr);
  }
  for (var instance of message.instances) {
    var cache = false;
    var hostname = instance.name;
    var tr = createCol(hostname, instance, cache);
    select.appendChild(tr);
  }
  if (message.instances && message.instances.length) {} else {
    setTimeout(loadFromBackground, 2000);
  }

  var body = document.getElementById('id_body');
  //// console.log(body);
  var body_content = document.getElementById('id_body_content');
  if (body_content) {
    // console.log('update id_body_content');
    body.removeChild(body_content);
  }
  body_content = document.createElement('div');
  body_content.setAttribute('id', 'id_body_content');
  body.appendChild(body_content);
  body_content.appendChild(fragment);

  var MDLite = require('material-design-lite');
  var componentHandler = MDLite.componentHandler;
  if (!componentHandler) {
    MDLite = require('material-design-lite/material');
    componentHandler = MDLite.componentHandler;
  }
  if (!componentHandler) {
    MDLite = require('./material');
    componentHandler = MDLite.componentHandler;
  }
  componentHandler.upgradeDom();
}

function receiveUpdate(message, sender, sendResponse) {
  if (!message.updated) {
    return;
  }
  // console.log('Receive background update');
  onReceived(message);
}

browser.runtime.onMessage.addListener(receiveUpdate);

function loadFromBackground(event) {
  // console.log("popup script sending message");
  if (event) {
    // console.log(event);
  }
  if (browser != chrome) {
    var sending = browser.runtime.sendMessage({
      popup: true
    });
    sending.then(onReceived, onFailed);
  } else {
    browser.runtime.sendMessage({
      popup: true
    }, function (message) {
      if (message) {
        onReceived(message);
      } else {
        if (browser.runtime) {
          onFailed(browser.runtime.lastError);
        }
      }
    });
  }

}

window.addEventListener("load", loadFromBackground, true);
window.addEventListener("onload", loadFromBackground, true);