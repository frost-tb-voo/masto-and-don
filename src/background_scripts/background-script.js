console.log('load background-script.');
//var browser = chrome;

const uuid = require('uuid');
const MastodonAPI = require('../mastodon.js/mastodon');

function onError(err) {
  if (err) {
    console.error(err);
    notify(err);
  }
}

function notify(data) {
  var content = '';
  if (data) {
    content = data;
  }
  // console.log("background script received message");
  var title = browser.i18n.getMessage("notificationTitle");
  var message = browser.i18n.getMessage("notificationContent", content);
  browser.notifications.create({
    "type": "basic",
    "message": message,
    "title": title,
    "iconUrl": browser.extension.getURL("icons/mastoandon-48.png"),
  });
}

var notifications = {};

function notifyMessage(message) {
  var notificationId = notifications.length;
  notifications.notificationId = {
    id: notificationId,
    title: message.title,
    url: message.link_url,
  };
  var iconUrl = message.icon;
  if (!iconUrl) {
    iconUrl = browser.extension.getURL("icons/mastoandon-48.png");
  }
  browser.notifications.create(notificationId, {
    "type": "basic",
    "message": message.message,
    "title": message.title,
    "iconUrl": iconUrl,
  });
}



var browser_id;

function loadStorage() {
  return new Promise(function (resolve, reject) {
    browser.storage.local.get('mstdn', function (_results) {
      var cacheList = [];
      var results = _results.mstdn;
      if (results) {
        // console.log('in storage, ' + JSON.stringify(results, null, 2));
        browser_id = results.browser_id;
        var hostnames = Object.keys(results);
        for (var hostname of hostnames) {
          if ('browser_id' == hostname) {
            continue;
          }
          var curValue = results[hostname];
          if (Object.keys(curValue).length == 1) {
            // console.log('revoked ' + hostname);
            continue;
          }
          cacheList.push(curValue);
        }
        cacheList.sort(function (a, b) {
          if (a.hostname < b.hostname) return -1;
          if (a.hostname > b.hostname) return 1;
          return 0;
        });
        // console.log('Load browser_id ' + browser_id);
      }
      initStorage().then(function () {
        resolve(cacheList);
      }).catch(function (err) {
        reject(err);
      });
    });
  });
}

function initStorage() {
  return new Promise(function (resolve, reject) {
    if (!browser_id) {
      browser_id = uuid.v4();
      browser.storage.local.set({
        'mstdn': {
          browser_id: browser_id
        }
      }, function () {
        // console.log('Init storage.local');
        resolve();
      });
      // console.log('Create browser_id ' + browser_id);
    } else {
      resolve();
    }
  });
}

function updateStorage(newCache) {
  var hostname = newCache.hostname;
  return new Promise(function (resolve, reject) {
    loadStorage().then(function (cacheList) {
      var newCacheData = {};
      newCacheData.browser_id = browser_id;
      for (var cache of cacheList) {
        if (cache.hostname != hostname) {
          newCacheData[cache.hostname] = cache;
        }
      }
      newCacheData[hostname] = newCache;

      browser.storage.local.set({
        'mstdn': newCacheData
      }, function () {
        // console.log('Update storage.local ' + JSON.stringify(newCache, null, 2));
        loadStorage().then(function (newCacheList) {
          // console.log('Sending background update');
          _cacheList = newCacheList;
          if (browser != chrome) {
            var sending = browser.runtime.sendMessage({
              updated: true,
              cache_list: _cacheList,
              instances: _instances,
            });
            sending.then(resolve, function (err) {
              if (err == 'Error: Could not establish connection. Receiving end does not exist.') {} else {
                // console.log(err);
              }
              resolve(err);
            });
          } else {
            browser.runtime.sendMessage({
              updated: true,
              cache_list: _cacheList,
              instances: _instances,
            }, function (message) {
              if (message) {
                resolve(message);
              } else {
                if (browser.runtime) {
                  resolve(browser.runtime.lastError);
                } else {
                  resolve('');
                }
              }
            });
          }
        }).catch(reject);
      });
    }, reject);
  });
}

function openPopupPage() {
  // console.log("injecting");
  browser.tabs.create({
    "url": "/popup_scripts/index.html"
  });
}

browser.browserAction.onClicked.addListener(openPopupPage);

function requestHosts() {
  const instanceManagingUrl = 'https://instances.mastodon.xyz/instances.json';
  var params = {};

  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", instanceManagingUrl, true);
    xhr.onload = function (e) {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          var responseText = xhr.responseText;
          // // console.log(responseText);
          var instanceData = JSON.parse(responseText);

          var instances = [];
          for (var instance of instanceData) {
            if (!instance.openRegistrations) {
              continue;
            }
            if (instance.users >= 1000) {
              // // console.log(JSON.stringify(instance));
              instances.push(instance);
              continue;
            }
            if (instance.users < 10) {
              continue;
            }
            if (instance.uptime < 95) {
              continue;
            }
            if (instance.https_score < 95) {
              continue;
            }
            if (instance.https_rank != 'A+') {
              continue;
            }
            // // console.log(JSON.stringify(instance));
            instances.push(instance);
          }
          instances.sort(function (a, b) {
            if (a.users < b.users) return 1;
            if (a.users > b.users) return -1;
            return 0;
          });
          resolve(instances);
        } else {
          var statusText = xhr.statusText;
          reject(statusText);
        }
      }
    };
    xhr.onerror = function (e) {
      var statusText = xhr.statusText;
      reject(statusText);
    };
    xhr.send(params);
    // // console.log('/instances.json ' + params);
  });
}



var _instances = [];
var _cacheList = [];

function openPopup(message, sender, sendResponse) {
  if (!message.popup) {
    return;
  }
  loadStorage().then(function (cacheList) {
    _cacheList = cacheList;
    if (sendResponse) {
      sendResponse({
        cache_list: _cacheList,
        instances: _instances,
      });
    }
  }).catch(function (err) {
    onError(err);
  });
  if (_instances.length) {} else {
    requestHosts().then(function (instances) {
      _instances = instances;
      if (sendResponse) {
        sendResponse({
          cache_list: _cacheList,
          instances: _instances,
        });
      }
    }).catch(function (err) {
      onError(err);
    });
  }
  // console.log('popup update from background');
  sendResponse({
    cache_list: _cacheList,
    instances: _instances,
  });
}

browser.runtime.onMessage.addListener(openPopup);

function getCache(hostname) {
  return new Promise(function (resolve, reject) {
    loadStorage().then(function (cacheList) {
      // console.log('cacheList size ' + cacheList.length);
      for (var cache of cacheList) {
        if (cache.hostname == hostname) {
          resolve(cache);
          return;
        }
      }
      resolve(null);
    }).catch(function (err) {
      reject(err);
    });
  })
}

function addNewHost(message, sender, sendResponse) {
  if (!message.add) {
    return;
  }
  // console.log('receive ' + JSON.stringify(message, null, 2));
  var hostname = message.hostname;

  getCache(hostname).then(function (cache) {
    if (cache && cache.access_token) {
      // console.log('load access_token for ' + hostname);
      return;
    }

    if (cache && cache.uuid) {
      // console.log('update uuid ' + hostname);
      getClientId(hostname).then(function (reservedResult) {
        var reserved = JSON.parse(reservedResult);
        var client_id = reserved.client_id;
        var uuid = reserved.uuid;
        cache.uuid = uuid;
        updateStorage(cache).then(function () {
          if (!cache.code) {
            // console.log('code not yet accepted ' + hostname);
            openGetCodePage(hostname, client_id);
          } else {
            // console.log('code already accepted ' + hostname);
            getApiKey(hostname, cache.code)
              .then(function (access_token) {
                // XXX
              }).catch(function (err) {
                onError(err);
                // invalid uuid
                cache.uuid = '';
                updateStorage(cache).then().catch();
              });
          }
        }).catch(function (err) {
          onError(err);
        });
      }).catch(function (err) {
        onError(err);
      });
    } else {
      // console.log('not yet reserved ' + hostname);
      getClientId(hostname).then(function (reservedResult) {
        // console.log(reservedResult);
        var reserved = JSON.parse(reservedResult);
        var client_id = reserved.client_id;
        var uuid = reserved.uuid;
        updateStorage({
          hostname: hostname,
          uuid: uuid
        }).then(function () {
          openGetCodePage(hostname, client_id);
        }).catch(function (err) {
          onError(err);
        });
      }).catch(function (err) {
        onError(err);
      });
    }
  }).catch(function (err) {
    onError(err);
  });
}

browser.runtime.onMessage.addListener(addNewHost);

function deleteHost(message, sender, sendResponse) {
  if (!message.delete) {
    return;
  }
  // console.log('receive ' + JSON.stringify(message, null, 2));
  var hostname = message.hostname;
  postRevoke(hostname).then(function () {
    // console.log('Revoke ' + hostname);
    var cache = {};
    cache.hostname = hostname;
    return updateStorage(cache);
  }).then(function () {
    // console.log('Remove storage.local');
  }).catch(onError);
}

browser.runtime.onMessage.addListener(deleteHost);

function getClientId(hostname) {
  const reserveUrl = 'https://devflex.server-on.net/oauth/tokens/reserve';

  return new Promise(function (resolve, reject) {
    var params = JSON.stringify({
      browser_id: browser_id,
      hostname: hostname
    }, null, 2);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", reserveUrl, true);
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.onload = function (e) {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          resolve(xhr.responseText);
        } else {
          reject(xhr.statusText);
        }
      }
    };
    xhr.onerror = function (e) {
      reject(xhr.statusText);
    };
    xhr.send(params);
    // console.log('/oauth/tokens/reserve ' + params);
  });
}

function postRevoke(hostname) {
  const reserveUrl = 'https://devflex.server-on.net/oauth/tokens/revoke';

  return new Promise(function (resolve, reject) {
    var params = JSON.stringify({
      browser_id: browser_id,
      hostname: hostname
    }, null, 2);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", reserveUrl, true);
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.onload = function (e) {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          resolve(xhr.responseText);
        } else {
          reject(xhr.statusText);
        }
      }
    };
    xhr.onerror = function (e) {
      reject(xhr.statusText);
    };
    xhr.send(params);
    // console.log('/oauth/tokens/revoke ' + params);
  });
}

function openGetCodePage(hostname, client_id) {
  // console.log("injecting");
  browser.tabs.create({
    "url": "https://" + hostname + "/oauth/authorize?" +
      "client_id=" + client_id + "&" +
      "redirect_uri=urn:ietf:wg:oauth:2.0:oob&" +
      "scope=read+follow&" +
      "response_type=code"
  });
}

function getApiKey(hostname, code) {
  const tokenUrl = 'https://devflex.server-on.net/oauth/tokens';

  return new Promise(function (resolve, reject) {
    getCache(hostname).then(function (target) {
      if (!target) {
        reject('not reserved ' + hostname);
        return;
      }
      var uuid = target.uuid;
      if (!uuid) {
        reject('not reserved ' + hostname);
        return;
      }
      if (target.access_token) {
        // console.log('already accepted for ' + hostname);
        resolve(target.access_token);
        return;
      }
      var params = JSON.stringify({
        browser_id: browser_id,
        hostname: hostname,
        uuid: uuid,
        code: code,
      }, null, 2);

      var xhr = new XMLHttpRequest();
      xhr.open("POST", tokenUrl, true);
      xhr.setRequestHeader('content-type', 'application/json');
      xhr.onload = function (e) {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            var responseText = xhr.responseText;
            // console.log(responseText);
            var tokenData = JSON.parse(responseText);
            var access_token = tokenData.access_token;
            target.access_token = access_token;
            updateStorage(target).then(function () {
              notifyMessage({
                title: 'Add a new host!',
                message: 'Create access_token for ' + hostname
              });
              resolve(access_token);
            }).catch(function (err) {
              reject(err);
            });
          } else {
            var statusText = xhr.statusText;
            reject(statusText);
          }
        }
      };
      xhr.onerror = function (e) {
        var statusText = xhr.statusText;
        reject(statusText);
      };
      xhr.send(params);
      // console.log('/oauth/tokens ' + params);
    }).catch(function (err) {
      reject(err);
    });
  });
}

function receiveUserCode(message, sender, sendResponse) {
  if (!message.content) {
    return;
  }
  // console.log('receiveUserCode ' + JSON.stringify(message, null, 2));
  var hostname = message.hostname;
  var code = message.code;
  getApiKey(hostname, code)
    .then(function (access_token) {
      // XXX
    }).catch(function (err) {
      onError(err + ', and retry now.');
      // invalid uuid
      updateStorage({
        hostname: hostname,
        code: code
      }).then(function () {
        // retry, update uuid
        getClientId(hostname)
          .then(function (reservedResult) {
            var reserved = JSON.parse(reservedResult);
            var client_id = reserved.client_id;
            var uuid = reserved.uuid;
            updateStorage({
              hostname: hostname,
              uuid: uuid,
              code: code
            }).then(function () {
              // get access_token
              getApiKey(hostname, code)
                .then(function (access_token) {
                  // XXX
                }).catch(function (err) {
                  onError(err);
                  // invalid uuid
                  updateStorage({
                    hostname: hostname,
                    code: code
                  }).then().catch();
                });
            }).catch(function (err) {
              onError(err);
            });
          }).catch(function (err) {
            onError(err);
          });
      }).catch(function (err) {
        onError(err);
      });
    });
}

browser.runtime.onMessage.addListener(receiveUserCode);



var pollingIndex = 0;

function pollingScheduler() {
  // console.log('Polling start.');
  loadStorage().then(function (cacheList) {
    var messageQueue = [];
    Promise.all(cacheList.map(function (cache) {
      var hostname = cache.hostname;
      if (!cache.access_token) {
        return;
      }
      return new Promise(function (resolve, reject) {
        var messagesForHost = [];
        GET_follow_requests(hostname)
          .then(function (messages) {
            // console.log(JSON.stringify(messages, null, 2) + ' from GET_follow_requests');
            for (var message of messages) {
              messagesForHost.push(message);
            }
            return GET_notifications(hostname);
          })
          .then(function (messages) {
            // console.log(JSON.stringify(messages, null, 2) + ' from GET_notifications');
            for (var message of messages) {
              messagesForHost.push(message);
            }
            return GET_timelines_home(hostname);
          })
          .then(function (messages) {
            // console.log(JSON.stringify(messages, null, 2) + ' from GET_timelines_home');
            for (var message of messages) {
              messagesForHost.push(message);
            }
            return GET_timelines_public(hostname);
          })
          .then(function (messages) {
            //// console.log(JSON.stringify(messages) + ' from GET_timelines_public');
            for (var message of messages) {
              messagesForHost.push(message);
            }
            if (messagesForHost.length) {
              // console.log('queue content length = ' + messagesForHost.length);
              messageQueue.push(messagesForHost);
            }
            resolve();
          }).catch(reject);
      });
    })).then(function () {
      if (messageQueue.length) {
        // console.log('queue = ' + messageQueue.length);
        if (pollingIndex >= messageQueue.length) {
          pollingIndex = 0;
        }
        var messagesForHost = messageQueue[pollingIndex];
        for (var message of messagesForHost) {
          // console.log(JSON.stringify(message, null, 2) + ' from all');
          notifyMessage(message);
          break;
        }
        pollingIndex++;
      }
      setTimeout(pollingScheduler, 20000);
    }).catch(function (err) {
      onError(err);
      setTimeout(pollingScheduler, 20000);
    });
  }).catch(function (err) {
    onError(err);
    setTimeout(pollingScheduler, 20000);
  });
}
pollingScheduler();

function GET_follow_requests(hostname) {
  return new Promise(function (resolve, reject) {
    var messages = [];
    getCache(hostname).then(function (cache) {
      if (!cache) {
        notify('cache not found for ' + hostname);
        resolve(messages);
        return;
      }
      if (!cache.access_token) {
        notify('token not found for ' + hostname);
        resolve(messages);
        return;
      }
      if (cache.offFollowRequests) {
        // console.log('Skip GET_follow_requests');
        resolve(messages);
        return;
      }
      var api = new MastodonAPI({
        instance: "https://" + hostname,
        api_user_token: cache.access_token
      });

      api.get("follow_requests", [], function (data) {
        // returns all users account id 1 is following in the id range from 420 to 1337
        // you don't have to supply the parameters, you can also just go with .get(endpoint, callback)
        // console.log(JSON.stringify(data, null, 2));
        if (!cache.follow_requests) {
          cache.follow_requests = [];
        }
        var unread = [];
        for (var account of data) {
          //// console.log(JSON.stringify(twoot, null, 2));
          var sameOne;
          for (var follow_request of cache.follow_requests) {
            if (account.acct == follower.acct) {
              sameOne = follow_request;
              break; // TODO
            }
          }
          if (sameOne) {
            continue;
          }
          unread.push(account);
        }
        if (!unread.length) {
          // empty
          resolve(messages);
          return;
        }

        for (var account of unread) {
          var created_at = account.created_at;
          var display_name = account.display_name;
          var username = account.username;
          var avatar = account.avatar;
          var note = '';
          if (account.note) {
            note = account.note;
          }
          var message = {
            title: unread.length + ' follow_requests in ' + hostname + '!',
            message: created_at + ' : ' + display_name + '(' + username + ') :\n' + note,
            link_url: 'https://' + hostname + '/web/follow_requests',
            icon: avatar
          };
          messages.push(message);
        }
        for (var account of unread) {
          // console.log('follow_requests ' + JSON.stringify(account, null, 2));
          cache.follow_requests.push(account.acct);
        }
        updateStorage(cache).then(function () {
          resolve(messages);
        }).catch(function (err) {
          reject(err);
        });
      });
    });
  });
}

function GET_notifications(hostname) {
  return new Promise(function (resolve, reject) {
    var messages = [];
    getCache(hostname).then(function (cache) {
      if (!cache) {
        notify('cache not found for ' + hostname);
        resolve(messages);
        return;
      }
      if (!cache.access_token) {
        notify('token not found for ' + hostname);
        resolve(messages);
        return;
      }
      if (cache.offNotifications) {
        // console.log('Skip GET_notifications');
        resolve(messages);
        return;
      }
      var api = new MastodonAPI({
        instance: "https://" + hostname,
        api_user_token: cache.access_token
      });

      api.get("notifications", [], function (data) {
        // returns all users account id 1 is following in the id range from 420 to 1337
        // you don't have to supply the parameters, you can also just go with .get(endpoint, callback)
        var unread = [];
        for (var notification of data) {
          //// console.log(JSON.stringify(twoot, null, 2));
          var id = notification.id;
          if (cache.lastNotification && id <= cache.lastNotification) {
            break; // TODO
          }
          unread.push(notification);
        }
        if (!unread.length) {
          // empty
          resolve(messages);
          return;
        }

        var doc = document.implementation.createHTMLDocument("");
        var dom = doc.createElement('html');
        for (var notification of unread) {
          var created_at = notification.created_at;
          var display_name = notification.account.display_name;
          var username = notification.account.username;
          var avatar = notification.account.avatar;
          var type = notification.type;
          var status = notification.status;

          var message = {
            title: unread.length + ' notifications in ' + hostname + '!',
            message: created_at + ' : ' + display_name + '(' + username + ') :\n' + type,
            link_url: 'https://' + hostname + '/web/notifications',
            icon: avatar
          };
          messages.push(message);
        }
        for (var notification of unread) {
          // console.log('notifications ' + JSON.stringify(notification, null, 2));
          var id = notification.id;
          cache.lastNotification = id;
          updateStorage(cache).then(function () {
            resolve(messages);
          }).catch(function (err) {
            reject(err);
          });
          break;
        }
      });
    });
  });
}

function GET_timelines_home(hostname) {
  return new Promise(function (resolve, reject) {
    var messages = [];
    getCache(hostname).then(function (cache) {
      if (!cache) {
        notify('cache not found for ' + hostname);
        resolve(messages);
        return;
      }
      if (!cache.access_token) {
        notify('token not found for ' + hostname);
        resolve(messages);
        return;
      }
      if (cache.offHome) {
        // console.log('Skip GET_timelines_home');
        resolve(messages);
        return;
      }
      var api = new MastodonAPI({
        instance: "https://" + hostname,
        api_user_token: cache.access_token
      });

      api.get("timelines/home", [], function (data) {
        // returns all users account id 1 is following in the id range from 420 to 1337
        // you don't have to supply the parameters, you can also just go with .get(endpoint, callback)

        var unread = [];
        for (var twoot of data) {
          //// console.log(JSON.stringify(twoot, null, 2));
          var id = twoot.id;
          if (cache.lastHome && id <= cache.lastHome) {
            break;
          }
          unread.push(twoot);
        }
        if (!unread.length) {
          // empty
          resolve(messages);
          return;
        }

        var doc = document.implementation.createHTMLDocument("");
        var dom = doc.createElement('html');
        for (var twoot of unread) {
          var created_at = twoot.created_at;
          var display_name = twoot.account.display_name;
          var username = twoot.account.username;
          var avatar = twoot.account.avatar;

          dom.innerHTML = twoot.content;
          var content = dom.textContent;

          var message = {
            title: unread.length + ' home twoots in ' + hostname + '!',
            message: created_at + ' : ' + display_name + '(' + username + ') :\n' + content,
            link_url: 'https://' + hostname + '/web/timelines/home',
            icon: avatar
          };
          messages.push(message);
        }
        for (var twoot of unread) {
          // console.log('timelines/home ' + JSON.stringify(twoot, null, 2));
          var id = twoot.id;
          cache.lastHome = id;
          updateStorage(cache).then(function () {
            resolve(messages);
          }).catch(function (err) {
            reject(err);
          });
          break;
        }

      });
    });
  });
}

function GET_timelines_public(hostname) {
  return new Promise(function (resolve, reject) {
    var messages = [];
    getCache(hostname).then(function (cache) {
      if (!cache) {
        notify('cache not found for ' + hostname);
        resolve(messages);
        return;
      }
      if (!cache.access_token) {
        notify('token not found for ' + hostname);
        resolve(messages);
        return;
      }
      if (cache.offPublic) {
        // console.log('Skip GET_timelines_public');
        resolve(messages);
        return;
      }
      var api = new MastodonAPI({
        instance: "https://" + hostname,
        api_user_token: cache.access_token
      });

      api.get("timelines/public", [], function (data) {
        // returns all users account id 1 is following in the id range from 420 to 1337
        // you don't have to supply the parameters, you can also just go with .get(endpoint, callback)

        var unread = [];
        for (var twoot of data) {
          //// console.log(JSON.stringify(twoot, null, 2));
          var id = twoot.id;
          if (cache.lastPublic && id <= cache.lastPublic) {
            break;
          }
          unread.push(twoot);
        }
        if (!unread.length) {
          // empty
          resolve(messages);
          return;
        }

        var doc = document.implementation.createHTMLDocument("");
        var dom = doc.createElement('html');
        for (var twoot of unread) {
          var created_at = twoot.created_at;
          var display_name = twoot.account.display_name;
          var username = twoot.account.username;
          var avatar = twoot.account.avatar;

          dom.innerHTML = twoot.content;
          var content = dom.textContent;

          var message = {
            title: unread.length + ' public twoots in ' + hostname + '!',
            message: created_at + ' : ' + display_name + '(' + username + ') :\n' + content,
            link_url: 'https://' + hostname + '/web/timelines/public',
            icon: avatar
          };
          messages.push(message);
        }
        for (var twoot of unread) {
          //// console.log('timelines/public ' + JSON.stringify(twoot, null, 2));
          var id = twoot.id;
          cache.lastPublic = id;
          updateStorage(cache).then(function () {
            resolve(messages);
          }).catch(function (err) {
            reject(err);
          });
          break;
        }
      });
    });
  });
}



function notificationClicked(notificationId) {
  // console.log('notification clicked ' + JSON.stringify(notificationId, null, 2));
  if (notifications.notificationId) {
    // console.log('notification clicked ' + JSON.stringify(notifications.notificationId, null, 2));
    if (notifications.notificationId.url) {
      browser.tabs.create({
        "url": notifications.notificationId.url
      });
    }
  }
}

browser.notifications.onClicked.addListener(notificationClicked);



function switchNotification(message, sender, sendResponse) {
  if (!message.switch) {
    return;
  }
  // console.log('operation switch : ' + JSON.stringify(message, null, 2));
  var hostname = message.hostname;
  var target = message.target;
  var checked = message.checked;
  getCache(hostname).then(function (cache) {
    if (target.startsWith('follow_requests_')) {
      cache.offFollowRequests = !checked;
    }
    if (target.startsWith('notifications_')) {
      cache.offNotifications = !checked;
    }
    if (target.startsWith('home_')) {
      cache.offHome = !checked;
    }
    if (target.startsWith('public_')) {
      cache.offPublic = !checked;
    }
    updateStorage(cache).then(function () {
      // XXX
    }).catch(function (err) {
      onError(err);
    });
  }).catch(function (err) {
    onError(err);
  });
}

browser.runtime.onMessage.addListener(switchNotification);