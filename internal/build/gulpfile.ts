import path from 'path'
import { copyFile, mkdir } from 'fs/promises'
import { copy } from 'fs-extra'
import { parallel, series } from 'gulp'
import {
  buildOutput,
  epOutput, // dist/element-plus
  epPackage, // packages/element-plus/package.json的路径
  projRoot,
} from '@element-plus/build-utils'
import { buildConfig, run, runTask, withTaskName } from './src'
import type { TaskFunction } from 'gulp'
import type { Module } from './src'

// 拷贝element-plus的package.json、根目录README.md、global.d.ts到dist/element-plus
export const copyFiles = () =>
  Promise.all([
    copyFile(epPackage, path.join(epOutput, 'package.json')),
    copyFile(
      path.resolve(projRoot, 'README.md'),
      path.resolve(epOutput, 'README.md')
    ),
    copyFile(
      path.resolve(projRoot, 'global.d.ts'),
      path.resolve(epOutput, 'global.d.ts')
    ),
  ])

// 将生成的类型声明文件同时拷贝到es(esm)和lib(cjs)下
// 将dist/types/packages(类型声明文件)拷贝到dist/element-plus/es和dist/element-plus/lib
export const copyTypesDefinitions: TaskFunction = (done) => {
  const src = path.resolve(buildOutput, 'types', 'packages')
  const copyTypes = (module: Module) =>
    // withTaskName的作用是给函数加一个displayName属性，这样在gulp执行时，就可以显示出函数的名字
    withTaskName(`copyTypes:${module}`, () =>
      copy(src, buildConfig[module].output.path, { recursive: true })
    )

  return parallel(copyTypes('esm'), copyTypes('cjs'))(done)
}

// 创建dist/element-plus/dist目录
// 拷贝dist/element-plus/theme-chalk/index.css到dist/element-plus/dist/index.css
export const copyFullStyle = async () => {
  await mkdir(path.resolve(epOutput, 'dist'), { recursive: true })
  await copyFile(
    path.resolve(epOutput, 'theme-chalk/index.css'),
    path.resolve(epOutput, 'dist/index.css')
  )
}

// 默认执行任务
// withTaskName只是给函数加上displayName属性，这样在gulp执行时，就可以显示出函数的名字
// 1. 清除dist目录
// 2. 创建dist/element-plus目录
// 3. 并行执行任务
//  runTask: 在 internal/build目录下，使用child_process执行 pnpm run start xxx 即执行src/tasks中的gulp的xxx任务
//  a. buildModules
//    编译出package.json中main和module
//    将packages下的文件(排除test、mock等相关文件夹)，以js、ts、vue文件作为入口，使用rollup编译为esm和cjs，保持原有文件目录结构。「所有第三方包作为外部模块不进行打包」
//    element-plus作为根目录，其下的文件被提到顶层，其他文件夹作为子文件夹，保持原有目录结构
//    theme-chalk下都是样式文件，因此未被打包
//  b. buildFullBundle 打包完整bundle，除了vue，全部打包进bundle，并在package.json中声明unpkg、jsDelivr字段，以作为这两个公共CDN的默认入口
//  c. generateTypesDefinitions 生成packages下的类型声明文件到dist/types/packages下
//  e. buildHelper 为组件生成代码提示文件(vetur和webstorm)
//  f. 串行任务
//    1. buildThemeChalk 复制源文件(scss)、编译组件的样式文件(css)到dist/theme-chalk下；生成全量样式文件(index.css)
//    2. copyFullStyle 将全量样式文件index.css移动到dist目录
// 4. 并行执行任务
//  a. copyTypesDefinitions 将上面生成的类型声明文件，按照目录结构同时拷贝到es(esm)和lib(cjs)下
//  b. copyFiles 将element-plus的package.json、根目录README.md、global.d.ts拷贝到dist/element-plus

export default series(
  withTaskName('clean', () => run('pnpm run clean')),
  withTaskName('createOutput', () => mkdir(epOutput, { recursive: true })),

  parallel(
    runTask('buildModules'),
    runTask('buildFullBundle'),
    runTask('generateTypesDefinitions'),
    runTask('buildHelper'),
    series(
      withTaskName('buildThemeChalk', () =>
        run('pnpm run -C packages/theme-chalk build')
      ),
      copyFullStyle
    )
  ),

  parallel(copyTypesDefinitions, copyFiles)
)

export * from './src'
