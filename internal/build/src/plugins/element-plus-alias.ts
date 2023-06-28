import { PKG_NAME, PKG_PREFIX } from '@element-plus/build-constants'

import type { Plugin } from 'rollup'

// [rollup插件](https://www.rollupjs.com/guide/plugin-development)
// 将@element-plus/theme-chalk开头的import路径替换为element-plus/theme-chalk，并标记为外部模块
export function ElementPlusAlias(): Plugin {
  const themeChalk = 'theme-chalk'
  const sourceThemeChalk = `${PKG_PREFIX}/${themeChalk}` as const // @element-plus/theme-chalk
  const bundleThemeChalk = `${PKG_NAME}/${themeChalk}` as const // element-plus/theme-chalk

  return {
    name: 'element-plus-alias-plugin',
    resolveId(id) {
      if (!id.startsWith(sourceThemeChalk)) return // 交由下一个插件或默认处理
      return {
        id: id.replaceAll(sourceThemeChalk, bundleThemeChalk),
        external: 'absolute', // 标记为外部模块，与顶层的external选项作用一致
      }
    },
  }
}
