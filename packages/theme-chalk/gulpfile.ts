import path from 'path'
import chalk from 'chalk'
import { dest, parallel, series, src } from 'gulp'
import gulpSass from 'gulp-sass'
import dartSass from 'sass'
import autoprefixer from 'gulp-autoprefixer'
import cleanCSS from 'gulp-clean-css'
import rename from 'gulp-rename'
import consola from 'consola'
import { epOutput } from '@element-plus/build-utils'

/**
 * 复制源样式文件(scss)，编译为css，压缩，输出到packages/theme-chalk/dist/下
 *
 * 样式文件目录的规则：
 *    所有组件的样式文件入口都在src的根目录下，以[name].scss命名，如button.scss
 *    index.scss引入所有组件的样式文件入口，编译出的css是全量样式
 *    若组件样式比较复杂，则创建[name]文件夹，将样式文件拆分到该文件夹下，如date-picker
 */

const distFolder = path.resolve(__dirname, 'dist')
const distBundle = path.resolve(epOutput, 'theme-chalk')

/**
 * 编译压缩src下的scss文件，输出到packages/theme-chalk/dist/下
 * 所有组件的样式文件入口都在src的根目录下，因此以src/*.scss作为入口
 * compile theme-chalk scss & minify
 * not use sass.sync().on('error', sass.logError) to throw exception
 * [gulp-sass](https://github.com/dlmanning/gulp-sass)
 * @returns
 */
function buildThemeChalk() {
  const sass = gulpSass(dartSass)
  const noElPrefixFile = /(index|base|display)/
  // 编译src目录下所有组件的入口scss文件
  return src(path.resolve(__dirname, 'src/*.scss'))
    .pipe(sass.sync()) // 同步编译
    .pipe(autoprefixer({ cascade: false })) // 根据browserslist添加浏览器前缀
    .pipe(
      cleanCSS({}, (details) => {
        // 压缩、优化、清除注释等
        consola.success(
          `${chalk.cyan(details.name)}: ${chalk.yellow(
            details.stats.originalSize / 1000
          )} KB -> ${chalk.green(details.stats.minifiedSize / 1000)} KB`
        )
      })
    )
    .pipe(
      rename((path) => {
        // 文件名添加el-前缀 排除/(index|base|display)/
        if (!noElPrefixFile.test(path.basename)) {
          path.basename = `el-${path.basename}`
        }
      })
    )
    .pipe(dest(distFolder))
}

/**
 * 编译黑暗模式的css变量(src/dark/)，输出到packages/theme-chalk/dist/dark下
 * Build dark Css Vars
 * @returns
 */
function buildDarkCssVars() {
  const sass = gulpSass(dartSass)
  return src(path.resolve(__dirname, 'src/dark/css-vars.scss'))
    .pipe(sass.sync())
    .pipe(autoprefixer({ cascade: false }))
    .pipe(
      cleanCSS({}, (details) => {
        consola.success(
          `${chalk.cyan(details.name)}: ${chalk.yellow(
            details.stats.originalSize / 1000
          )} KB -> ${chalk.green(details.stats.minifiedSize / 1000)} KB`
        )
      })
    )
    .pipe(dest(`${distFolder}/dark`))
}

/**
 * copy from packages/theme-chalk/dist to dist/element-plus/theme-chalk
 */
export function copyThemeChalkBundle() {
  return src(`${distFolder}/**`).pipe(dest(distBundle))
}

/**
 * copy source file to packages
 */

export function copyThemeChalkSource() {
  return src(path.resolve(__dirname, 'src/**')).pipe(
    dest(path.resolve(distBundle, 'src'))
  )
}

// 编译样式文件，复制源文件(scss)
// a. copyThemeChalkSource 将src下所有源文件(.scss)复制到dist/element-plus/theme-chalk/src
// b. 串行任务
//    1. buildThemeChalk 编译压缩src下所有scss文件，输出到packages/theme-chalk/dist/下，并给文件添加el-前缀(排除/(index|base|display)/文件)，如el-date-picker.css
//    2. buildDarkCssVars  编译黑暗模式的css变量(src/dark/)，输出到packages/theme-chalk/dist/dark下
//    3. copyThemeChalkBundle 将上面输出的源文件(scss)和编译出的样式文件(css)复制到/dist/element-plus/theme-chalk下
export const build = parallel(
  copyThemeChalkSource,
  series(buildThemeChalk, buildDarkCssVars, copyThemeChalkBundle)
)

export default build
