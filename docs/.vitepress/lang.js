// 优先读取用户之前手动切换的语言，如果没有则读取浏览器语言，如果浏览器语言不在支持列表中，则使用默认语言defaultLang
;(() => {
  const supportedLangs = window.supportedLangs // .vitepress/crowdin下的语言列表 ['en-US', 'zh-CN']
  const cacheKey = 'preferred_lang' // 缓存用户手动切换的语言
  const defaultLang = 'en-US'
  // docs supported languages
  const langAlias = {
    en: 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
  }
  let userPreferredLang = localStorage.getItem(cacheKey) || navigator.language // navigator.language 浏览器使用的语言
  const language =
    langAlias[userPreferredLang] ||
    (supportedLangs.includes(userPreferredLang)
      ? userPreferredLang
      : defaultLang)
  localStorage.setItem(cacheKey, language)
  userPreferredLang = language
  // 当前路由与用户语言不一致时，自动跳转到用户语言
  if (!location.pathname.startsWith(`/${userPreferredLang}`)) {
    const toPath = [`/${userPreferredLang}`]
      .concat(location.pathname.split('/').slice(2))
      .join('/')
    location.pathname =
      toPath.endsWith('.html') || toPath.endsWith('/')
        ? toPath
        : toPath.concat('/')
  }
  if (navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'LANG',
      lang: userPreferredLang,
    })
  }
})()
