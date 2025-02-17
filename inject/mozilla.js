/* global contentScopeFeatures */

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

function randomString () {
    const num = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
    return num.toString().replace('0.', '')
}

function init () {
    contentScopeFeatures.load({
        platform: {
            name: 'extension'
        }
    })

    chrome.runtime.sendMessage({
        messageType: 'registeredContentScript',
        options: {
            documentUrl: window.location.href
        }
    },
    (message) => {
        // Background has disabled features
        if (!message) {
            return
        }
        if (message.debug) {
            window.addEventListener('message', (m) => {
                if (m.data.action && m.data.message) {
                    chrome.runtime.sendMessage({
                        messageType: 'debuggerMessage',
                        options: m.data
                    })
                }
            })
        }
        message.messageSecret = messageSecret
        contentScopeFeatures.init(message)
    })

    chrome.runtime.onMessage.addListener((message) => {
        // forward update messages to the embedded script
        if (message && message.type === 'update') {
            contentScopeFeatures.update(message)
        }
    })

    window.addEventListener('sendMessageProxy' + messageSecret, (m) => {
        const messageType = m.detail.messageType
        if (!allowedMessages.includes(messageType)) {
            return console.warn('Ignoring invalid sendMessage messageType', messageType)
        }
        chrome.runtime.sendMessage(m && m.detail, response => {
            const msg = { func: messageType, response }
            contentScopeFeatures.update({ detail: msg })
        })
    })
}

init()
