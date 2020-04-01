'use strict'

const newProfileDefaultOptions = {
  profileName: '',
  saveTo: 'saveToClipboard',
  filterStreamURL: '.*\\.m3u8',
  escapeMethod: 'escapeMethodLinux',
  command: '<exe> ' +
    '-i \'${stream}\' -o \'${filename}_${timestamp}_${tabtitle}.${ext}\' ' +
    '${cookie:|-first \'|\' -next \'|\'|} -useragent ${useragent} -referer ${referer}'
}

function loadProfiles () {
  browser.storage.local.get().then(storageLocal => {
    const profileList = [_('profileSelectNew')]
    profileList.push(
      ...Object.keys(storageLocal)
        .filter(e => e.startsWith('profile['))
        .map(e => e.slice('profile['.length, -1))
        .sort()
    )

    const replSelect = document.createElement('select')
    {
      let profileSelect = document.getElementById('profileSelect')
      replSelect.id = 'profileSelect'
      for (const e of profileList) {
        const opt = document.createElement('option')
        opt.value = e
        opt.textContent = e
        replSelect.appendChild(opt)
      }
      replSelect.firstChild.value = 'profileSelectNew'
      profileSelect.parentElement.replaceChild(replSelect, profileSelect)
      profileSelect = null
    }

    let active = 'profileSelectNew'
    let profile = newProfileDefaultOptions
    if ('activeProfile' in storageLocal) {
      const active_ = storageLocal.activeProfile
      if (profileList.indexOf(active_) > 0) { // ignore profileSelectNew at [0]
        active = active_
        profile = storageLocal[`profile[${active}]`]
      }
    }
    for (const id of Object.keys(profile)) {
      if (document.getElementById(id) !== null) {
        document.getElementById(id).value = profile[id]
      }
    }
    replSelect.value = active
    replSelect.addEventListener('change', uaChangeProfile)
  })
}

function uaChangeProfile () {
  browser.storage.local.set({
    activeProfile: document.getElementById('profileSelect').value
  })
  loadProfiles()
}

function uaDeleteProfile () {
  const pname = document.getElementById('profileSelect').value
  if (pname === 'profileSelectNew') {
    loadProfiles()
    return
  }
  browser.storage.local.remove(`profile[${pname}]`)
  browser.storage.local.set({
    activeProfile: 'profileSelectNew'
  })
  loadProfiles()
}

function uaSave () {
  const pname = document.getElementById('profileName').value
  if (pname === '') {
    alert('Error: Profile name not set.')
    return
  }
  if (pname === 'profileSelectNew') {
    alert('Error: Invalid profile name.')
    return
  }

  browser.storage.local.set({
    [`profile[${pname}]`]: [...document.getElementsByClassName('savable')].reduce((o, e) => { o[e.id] = e.value; return o }, {}),
    activeProfile: pname
  })

  loadProfiles()
}

// i18n translations
const _ = str => { return browser.i18n.getMessage(str) || '_(' + str + ')' }
const labels = document.getElementsByTagName('label')
for (const label of labels) {
  label.textContent = _(label.htmlFor)
}

const options = document.getElementsByTagName('option')
for (const option of options) {
  option.textContent = _(option.value)
}

// input event handler
document.getElementById('buttonSave').addEventListener('click', uaSave)
document.getElementById('buttonDeleteProfile').addEventListener('click', uaDeleteProfile)

loadProfiles()
