import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import consola from 'consola'
import { docRoot, errorAndExit } from '@element-plus/build-utils'

// 将.vitepress/crowdin下的语言文件合并为.vitepress/i18n下的语言文件json
// 当前项目中只有默认的英文文件，其他语言需要在crowdin下载https://crowdin.com/project/element-plus/zh-CN
/**
 * 如源文件有：
 * 1. en-US/pages/home.json
    {
      "title": "component doc"
    }

    2. zh-CN/pages/home.json
    {
      "title": "组件文档"
    }

    经crowdin-generate.ts处理后，生成i18n/pages/home.json

    {
      "en-US": {
        "title": "component doc"
      },
      "zh-CN": {
        "title": "组件文档"
      }
    }

    在代码中使用时，docs会取页面访问路径的第一段来取语言, 如https://element-plus.org/zh-CN  则取zh-CN语言，默认是en-US。
    <script lang="ts" setup>
      import { useLang } from '../../composables/lang'
      import homeLocale from '../../../i18n/pages/home.json'

      const lang = useLang() // 从页面路径取语言 如 https://element-plus.org/zh-CN 则lang: 'zh-CN'
      const homeLang = computed(() => homeLocale[lang.value])
    </script>
    <template>
      <h4>{{ homeLang['title'] }}</h4>
    </template>
 */

// NB: this file is only for generating files that enables developers to develop the website.
const componentLocaleRoot = path.resolve(docRoot, '.vitepress/crowdin')

const exists = 'File already exists'

async function main() {
  const localeOutput = path.resolve(docRoot, '.vitepress/i18n')
  if (fs.existsSync(localeOutput)) {
    throw new Error(exists)
  }

  // 移除mac系统中可能产生的.DS_Store文件夹
  const DSPath = path.resolve(componentLocaleRoot, '.DS_Store')
  fs.existsSync(DSPath) && fs.rmSync(DSPath, { recursive: true })

  consola.trace(chalk.cyan('Starting for build doc for developing'))
  // all language should be identical since it is mirrored from crowdin.
  const dirs = await fs.promises.readdir(componentLocaleRoot, {
    withFileTypes: true,
  })
  const languages = dirs.map((dir) => dir.name) // .vitepress/crowdin下的所有语言文件夹 en-US、zh-CN...
  const langWithoutEn = languages.filter((l) => l !== 'en-US') // 排除en-US

  await fs.promises.mkdir(localeOutput) // 创建.vitepress/i18n文件夹

  // build lang.json for telling `header>language-select` how many languages are there
  await fs.promises.writeFile(
    path.resolve(localeOutput, 'lang.json'), // 创建.vitepress/i18n/lang.json
    JSON.stringify(languages),
    'utf-8'
  )

  // loop through en-US

  const enUS = path.resolve(componentLocaleRoot, 'en-US') // .vitepress/crowdin/en-US文件夹路径
  // we do not include en-US since we are currently using it as template
  const languagePaths = langWithoutEn.map((l) => {
    return {
      name: l,
      pathname: path.resolve(componentLocaleRoot, l),
    }
  })

  consola.debug(languagePaths)
  // 获取en-US下的所有文件，以enUS为模板，遍历其他语言文件夹
  await traverseDir(enUS, languagePaths, localeOutput)
}

// 以enUS为模板，遍历.vitepress/crowdin下的其他语言文件夹，将所有语言文件合并为.vitepress/i18n下的语言文件json
async function traverseDir(
  dir: string,
  paths: { name: string; pathname: string }[],
  targetPath: string
) {
  const contents = await fs.promises.readdir(dir, { withFileTypes: true })

  await Promise.all(
    contents.map(async (c) => {
      if (c.isDirectory()) {
        await fs.promises.mkdir(path.resolve(targetPath, c.name), {
          recursive: true,
        })

        return traverseDir(
          path.resolve(dir, c.name),
          paths.map((p) => {
            return {
              ...p,
              pathname: path.resolve(p.pathname, c.name),
            }
          }),
          path.resolve(targetPath, c.name)
        )
      } else if (c.isFile()) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const content = require(path.resolve(dir, c.name))

        const contentToWrite = {
          'en-US': content,
        }

        await Promise.all(
          paths.map(async (p) => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const content = require(path.resolve(p.pathname, c.name))

            contentToWrite[p.name] = content
          })
        )

        return fs.promises.writeFile(
          path.resolve(targetPath, c.name),
          JSON.stringify(contentToWrite, null, 2),
          {
            encoding: 'utf-8',
          }
        )
      }
    })
  )
}

main()
  .then(() => {
    consola.success(chalk.green('Locale for website development generated'))
  })
  .catch((err) => {
    if (err.message === exists) {
      // do nothing
    } else {
      errorAndExit(err)
    }
  })
