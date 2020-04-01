'use strict'

const _ = str => { return browser.i18n.getMessage(str) || '_(' + str + ')' }
browser.browserAction.setTitle({ title: 'yassd' })

var mediaList = {}

const mediaExtFilterList = {
  urls: [
    '*://*/*.m3u8',
    '*://*/*.m3u8?*',
    '*://*/*.mpd',
    '*://*/*.mpd?*',
    '*://*/*.f4m',
    '*://*/*.f4m?*',
    '*://*/*.ism',
    '*://*/*.ism/*',
    '*://*/*.vtt',
    '*://*/*.vtt/*'
  ]
}

async function addStream (requestDetails) {
  if (Object.keys(mediaList).includes(requestDetails.url)) {
    return
  }

  const storageLocal = await browser.storage.local.get()
  const profile = storageLocal[`profile[${storageLocal.activeProfile}]`]
  if (profile.filterStreamURL !== '' && !new RegExp(profile.filterStreamURL).test(requestDetails.url)) {
    return
  }

  mediaList[requestDetails.url] = requestDetails
  const media = mediaList[requestDetails.url]
  media.tab = await browser.tabs.get(media.tabId)

  const url = new URL(requestDetails.url)
  let filename = url.href.split('?')[0]
  for (let ext of mediaExtFilterList.urls.filter(url => url.endsWith('/*'))) {
    ext = ext.slice(ext.lastIndexOf('.'), ext.lastIndexOf('/'))
    const f = filename.split(ext + '/')
    if (f.length > 1) {
      filename = f[0] + ext
    }
  }
  filename = filename.slice(filename.lastIndexOf('/') + 1)

  media.filename = filename.slice(0, filename.lastIndexOf('.'))
  media.ext = filename.split('.').pop()
  media.originUrlFilename = media.originUrl.split('/').filter(v => v.length > 0).pop()
  media.documentUrlFilename = media.documentUrl.split('/').filter(v => v.length > 0).pop()
  media.time = new Date().getTime() / 1000
  media.menuTitle = `[ ${media.tab.title} | ${media.originUrlFilename} ]` +
        ` - ${media.filename}.${media.ext} `

  refreshCounter()
}

function fromRqH (media, re, str, prop, alt, esc) {
  const m = re.exec(str)
  if (m === null) {
    return str
  }
  const val = media.requestHeaders.filter(h => h.name.toLowerCase() === prop)
  if (val.length > 0) {
    return str.replace(re, esc(val[0].value.toString()))
  } else {
    return str.replace(re, alt)
  }
}

async function exportMediaElement (info) {
  const storageLocal = await browser.storage.local.get()
  const profile = storageLocal[`profile[${storageLocal.activeProfile}]`]
  const list = []
  const esc = (str) => {
    let escQuote = "'"
    if (profile.escapeMethod === 'escapeMethodWindows') {
      escQuote = "''"
    } else if (profile.escapeMethod === 'escapeMethodLinux') {
      escQuote = "'\"'\"'"
    }
    return str.replace("'", escQuote)
  }
  info.forEach(url => {
    const media = mediaList[url]

    const stream = esc(media.url)
    const filename = esc(media.filename)
    const ext = esc(media.filename)
    const timestamp = Math.round(media.time)
    const tabtitle = esc(media.tab.title)
    const originUrlFilename = esc(media.originUrlFilename)
    const documentUrlFilename = esc(media.documentUrlFilename)

    // parse command string
    const cmd = profile.command.split('$')
    let repl = ''
    for (let i = 0; i < cmd.length; i++) {
      // escape $ as $$
      if (cmd[i] === '') {
        cmd[i] = '$'
        i++
        continue
      }
      repl = cmd[i].replace(/^{stream}/, `${stream}`)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      repl = cmd[i].replace(/^{filename}/, `${filename}`)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      repl = cmd[i].replace(/^{ext}/, `${ext}`)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      repl = cmd[i].replace(/^{timestamp}/, `${timestamp}`)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      repl = cmd[i].replace(/^{tabtitle}/, `${tabtitle}`)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      repl = cmd[i].replace(/^{documentUrlFilename}/, `${documentUrlFilename}`)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      repl = cmd[i].replace(/^{originUrlFilename}/, `${originUrlFilename}`)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      repl = fromRqH(media, /^{useragent}/, cmd[i], 'user-agent', esc(navigator.userAgent), esc)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      repl = fromRqH(media, /^{referer}/, cmd[i], 'referer', '', esc)
      if (repl !== cmd[i]) { cmd[i] = repl; continue }
      {
        // ${cookie:pre|join|post|} => "pre"+cokies.join("join")+"post"
        const re = /^{cookie:\|([^|]*)\|([^|]*)\|([^|])*\|}/
        const m = re.exec(cmd[i])
        if (m !== null && m.length === 4) {
          const cookies = media.requestHeaders.filter(h => h.name.toLowerCase() === 'cookie').map(c => c.value)
          if (cookies.length > 0) {
            repl = cmd[i].replace(re, m[1] + cookies.map(esc).join(m[2]) + m[3])
            if (repl !== cmd[i]) { cmd[i] = repl; continue }
          } else {
            repl = cmd[i].replace(re, '')
            if (repl !== cmd[i]) { cmd[i] = repl; continue }
          }
        }
      }
    }
    list.push(cmd.join(''))
  })
  if (list.length === 0) {
    return
  }
  if (profile.saveTo === 'saveToFile') {
    browser.downloads.download({
      filename: 'yassd_' + Math.round(new Date().getTime() / 1000) + '_' + (profile.escapeMethod === 'escapeMethodLinux' ? '.sh' : '.bat'),
      url: URL.createObjectURL(new File([list.join('\n')], { type: 'application/octet-stream' })),
      saveAs: true,
      conflictAction: 'overwrite'
    })
  } else {
    navigator.clipboard.writeText(list.join('\n'))
  }
}

async function refreshMenu () {
  browser.menus.removeAll()
  browser.menus.create({
    id: 'yassdMenu',
    title: 'yassd'
  })

  // list profiles
  browser.menus.create({
    id: 'yassdMenuProfileList',
    title: _('yassdMenuProfileList'),
    parentId: 'yassdMenu'
  })
  const storageLocal = await browser.storage.local.get()
  Object.keys(storageLocal)
    .filter(e => e.startsWith('profile['))
    .map(e => e.slice('profile['.length, -1))
    .sort()
    .forEach(p => browser.menus.create({
      type: 'radio',
      id: `yassdMenuProfile[${p}]`,
      checked: (storageLocal.activeProfile === p),
      title: p,
      parentId: 'yassdMenuProfileList'
    }))

  // all media
  browser.menus.create({
    id: 'yassdMenuAll',
    title: _('yassdMenuAll'),
    parentId: 'yassdMenu'
  })
  browser.menus.create({
    id: 'yassdMenuAllClear',
    title: _('yassdMenuAllClear'),
    parentId: 'yassdMenuAll'
  })
  browser.menus.create({
    type: 'separator',
    parentId: 'yassdMenuAll'
  })
  browser.menus.create({
    id: 'yassdMenuAllCopyAll',
    title: _('yassdMenuAllCopyAll'),
    parentId: 'yassdMenuAll'
  })
  browser.menus.create({
    type: 'separator',
    parentId: 'yassdMenuAll'
  })
  Object.values(mediaList)
    .forEach(v => {
      browser.menus.create({
        id: `yassdMenuAllCopy[${v.url}]`,
        title: v.menuTitle,
        parentId: 'yassdMenuAll',
        icons: {
          16: 'data/icon-16.png'
        }
      })
    })

  // tab media
  browser.menus.create({
    id: 'yassdMenuClear',
    title: _('yassdMenuClear'),
    parentId: 'yassdMenu'
  })
  browser.menus.create({
    type: 'separator',
    parentId: 'yassdMenu'
  })
  browser.menus.create({
    id: 'yassdMenuCopyAll',
    title: _('yassdMenuCopyAll'),
    parentId: 'yassdMenu'
  })
  browser.menus.create({
    type: 'separator',
    parentId: 'yassdMenu'
  })
  const tab = await browser.tabs.query({ active: true, currentWindow: true })
  Object.values(mediaList)
    .filter(v => v.tabId === tab[0].id)
    .forEach(v => {
      browser.menus.create({
        id: `yassdMenuCopy[${v.url}]`,
        title: v.menuTitle,
        parentId: 'yassdMenu',
        icons: {
          16: 'data/icon-16.png'
        }
      })
    })

  browser.menus.refresh()
}

function refreshCounter () {
  browser.tabs.query({ active: true, currentWindow: true }).then(tab => {
    const c = Object.values(mediaList)
      .filter(v => v.tabId === tab[0].id)
      .length.toString()
    browser.browserAction.setBadgeText({
      text: c > 0 ? c : ''
    })
  })
}

async function clearTabMedia (info, tab) {
  Object.values(mediaList)
    .filter(v => v.tabId === tab.id)
    .forEach(v => { delete mediaList[v.url] })
  refreshCounter()
}

function clearMedia () {
  mediaList = {}
  refreshCounter()
}

// filter media requests
browser.webRequest.onSendHeaders.addListener(async (d) => addStream(d), mediaExtFilterList, ['requestHeaders'])

// build menu on the fly
browser.menus.onShown.addListener(async () => refreshMenu())
// icon click clears tab media
browser.browserAction.onClicked.addListener(clearTabMedia)
// refresh counter on tab/window change
browser.tabs.onActivated.addListener(refreshCounter)
browser.windows.onFocusChanged.addListener(refreshCounter)

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'yassdMenuClear') {
    clearTabMedia(info, tab)
  } else if (info.menuItemId === 'yassdMenuCopyAll') {
    exportMediaElement(Object.keys(mediaList)
      .filter(k => mediaList[k].tabId === tab.id))
  } else if (info.menuItemId === 'yassdMenuAllClear') {
    clearMedia()
  } else if (info.menuItemId === 'yassdMenuAllCopyAll') {
    exportMediaElement(Object.keys(mediaList))
  } else if (info.parentMenuItemId === 'yassdMenuProfileList') {
    browser.storage.local.set({
      activeProfile: info.menuItemId.slice('yassdMenuProfile['.length, -1)
    })
  } else if (info.menuItemId.startsWith('yassdMenuCopy[')) {
    exportMediaElement([info.menuItemId.slice('yassdMenuCopy['.length, -1)])
  } else if (info.menuItemId.startsWith('yassdMenuAllCopy[')) {
    exportMediaElement([info.menuItemId.slice('yassdMenuAllCopy['.length, -1)])
  }
})
