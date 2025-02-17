/**
 * Inject all the overwrites into the page.
 */

const allowedMessages = [
    'getDevMode',
    'initClickToLoad',
    'enableSocialTracker',
    'openShareFeedbackPage',
    'getYouTubeVideoDetails',
    'updateYouTubeCTLAddedFlag',
    'getYoutubePreviewsEnabled',
    'setYoutubePreviewsEnabled'
]
const messageSecret = randomString()

function inject (code) {
    const elem = document.head || document.documentElement
    // Inject into main page
    try {
        const e = document.createElement('script')
        e.textContent = `(() => {
            ${code}
        })();`
        elem.appendChild(e)
        e.remove()
    } catch (e) {
    }
}

function randomString () {
    const num = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
    return num.toString().replace('0.', '')
}

function init () {
    const randomMethodName = '_d' + randomString()
    const randomPassword = '_p' + randomString()
    const reusableMethodName = '_rm' + randomString()
    const reusableSecret = '_r' + randomString()
    const initialScript = `
      /* global contentScopeFeatures */
      contentScopeFeatures.load({
          platform: {
              name: 'extension'
          }
      })
      // Define a random function we call later.
      // Use define property so isn't enumerable
      Object.defineProperty(window, '${randomMethodName}', {
          enumerable: false,
          // configurable, To allow for deletion later
          configurable: true,
          writable: false,
          // Use proxy to ensure stringification isn't possible
          value: new Proxy(function () {}, {
              apply(target, thisArg, args) {
                  if ('${randomPassword}' === args[0]) {
                      contentScopeFeatures.init(args[1])
                  } else {
                      // TODO force enable all features if password is wrong
                      console.error("Password for hidden function wasn't correct! The page is likely attempting to attack the feature by DuckDuckGo");
                  }
                  // This method is single use, clean up
                  delete window.${randomMethodName};
              }
          })
      });

      // Define a random update function we call later.
      // Use define property so isn't enumerable
      Object.defineProperty(window, '${reusableMethodName}', {
        // Use proxy to ensure stringification isn't possible
          value: new Proxy(function () {}, {
              apply(target, thisArg, args) {
                  if ('${reusableSecret}' === args[0]) {
                      contentScopeFeatures.update(args[1])
                  }
              }
          })
      });
    `
    inject(initialScript)

    chrome.runtime.sendMessage({
        messageType: 'registeredContentScript',
        options: {
            documentUrl: window.location.href
        }
    },
    (message) => {
        if (!message) {
            // Remove injected function only as background has disabled feature
            inject(`delete window.${randomMethodName}`)
            return
        }
        if (message.debug) {
            window.addEventListener('message', (m) => {
                if (m.data.action && m.data.message) {
                    chrome.runtime.sendMessage({ messageType: 'debuggerMessage', options: m.data })
                }
            })
        }
        message.messageSecret = messageSecret
        const stringifiedArgs = JSON.stringify(message)
        const callRandomFunction = `
                window.${randomMethodName}('${randomPassword}', ${stringifiedArgs});
            `
        inject(callRandomFunction)
    })

    chrome.runtime.onMessage.addListener((message) => {
        // forward update messages to the embedded script
        if (message && message.type === 'update') {
            const stringifiedArgs = JSON.stringify(message)
            const callRandomUpdateFunction = `
                window.${reusableMethodName}('${reusableSecret}', ${stringifiedArgs});
            `
            inject(callRandomUpdateFunction)
        }
    })

    window.addEventListener('sendMessageProxy' + messageSecret, (m) => {
        const messageType = m.detail.messageType
        if (!allowedMessages.includes(messageType)) {
            return console.warn('Ignoring invalid sendMessage messageType', messageType)
        }
        chrome.runtime.sendMessage(m && m.detail, response => {
            const msg = { func: messageType, response }
            const stringifiedArgs = JSON.stringify({ detail: msg })
            const callRandomUpdateFunction = `
                window.${reusableMethodName}('${reusableSecret}', ${stringifiedArgs});
            `
            inject(callRandomUpdateFunction)
        })
    })
}

init()
