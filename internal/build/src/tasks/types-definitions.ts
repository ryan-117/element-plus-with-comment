import process from 'process'
import path from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import consola from 'consola'
import * as vueCompiler from 'vue/compiler-sfc'
import glob from 'fast-glob'
import chalk from 'chalk'
import { Project } from 'ts-morph'
import {
  buildOutput,
  epRoot,
  excludeFiles,
  pkgRoot,
  projRoot,
} from '@element-plus/build-utils'
import { pathRewriter } from '../utils'
import type { CompilerOptions, SourceFile } from 'ts-morph'

const TSCONFIG_PATH = path.resolve(projRoot, 'tsconfig.web.json')
const outDir = path.resolve(buildOutput, 'types')

/**
 * 生成类型定义文件，包括/packages下的所有文件和/typings/env.d.ts
 * [ts-morph](https://ts-morph.com/) 是一个用来访问和操作typescript AST的库，可以重构、生成、检查和分析ts代码、生成类型定义等
 *
 * 1. 将packages下的所有文件作为源文件，并且对vue文件做处理，只提取script部分(对setup类型的脚本使用@vue/compiler-sfc编译为普通脚本)
 * 2. 类型检查
 * 3. 生成类型声明文件到dist/types 目录结构以types为根目录与源文件一致
 */

/**
 * fork = require( https://github.com/egoist/vue-dts-gen/blob/main/src/index.ts
 */
export const generateTypesDefinitions = async () => {
  const compilerOptions: CompilerOptions = {
    emitDeclarationOnly: true,
    outDir, // 输出目录
    baseUrl: projRoot,
    preserveSymlinks: true,
    skipLibCheck: true,
    noImplicitAny: false,
  }
  // ts-morph的标准操作，创建一个ts项目
  const project = new Project({
    compilerOptions,
    tsConfigFilePath: TSCONFIG_PATH,
    skipAddingFilesFromTsConfig: true, // 默认会加载tsConfigFilePath中的files和include配置作为源文件
  })

  const sourceFiles = await addSourceFiles(project)
  consola.success('Added source files')

  typeCheck(project)
  consola.success('Type check passed!')

  // emit 生成js和类型声明文件，emitOnlyDtsFiles: true 指定只生成类型声明文件
  await project.emit({
    emitOnlyDtsFiles: true,
  })

  const tasks = sourceFiles.map(async (sourceFile) => {
    const relativePath = path.relative(pkgRoot, sourceFile.getFilePath())
    consola.trace(
      chalk.yellow(
        `Generating definition for file: ${chalk.bold(relativePath)}`
      )
    )

    const emitOutput = sourceFile.getEmitOutput()
    const emitFiles = emitOutput.getOutputFiles()
    if (emitFiles.length === 0) {
      throw new Error(`Emit no file: ${chalk.bold(relativePath)}`)
    }

    const subTasks = emitFiles.map(async (outputFile) => {
      const filepath = outputFile.getFilePath()
      // TODO 类型声明文件已经创建，目录都已存在了，感觉这里是冗余操作，测试屏蔽掉貌似没有问题
      // await mkdir(path.dirname(filepath), {
      //   recursive: true,
      // })

      // 对生成的类型文件内容做后续处理
      // 将 @element-plus/theme-chalk 替换为 element-plus/theme-chalk
      // 将 @element-plus 替换为 element-plus/es
      await writeFile(
        filepath,
        pathRewriter('esm')(outputFile.getText()),
        'utf8'
      )

      consola.success(
        chalk.green(
          `Definition for file: ${chalk.bold(relativePath)} generated`
        )
      )
    })

    await Promise.all(subTasks)
  })

  await Promise.all(tasks)
}

// 将packages下所有文件和/typings/env.d.ts作为ts-morph项目的源文件
async function addSourceFiles(project: Project) {
  // 加载源文件/typings/env.d.ts
  project.addSourceFileAtPath(path.resolve(projRoot, 'typings/env.d.ts'))

  const globSourceFile = '**/*.{js?(x),ts?(x),vue}'
  const filePaths = excludeFiles(
    // /packages下除了element-plus外的所有文件(路径)
    await glob([globSourceFile, '!element-plus/**/*'], {
      cwd: pkgRoot,
      absolute: true,
      onlyFiles: true,
    })
  )
  const epPaths = excludeFiles(
    // element-plus的所有文件(路径)
    await glob(globSourceFile, {
      cwd: epRoot,
      onlyFiles: true,
    })
  )

  const sourceFiles: SourceFile[] = []
  // 将packages下所有文件作为源文件添加到ts-morph创建的项目中，并且对vue文件进行特殊处理
  await Promise.all([
    ...filePaths.map(async (file) => {
      // 非element-plus下的文件，如果是vue文件，需要将其转换为js文件
      // 1. 对于vue文件，只提取script脚本
      // 2. 如果不是setup脚本，直接输出脚本内容
      // 3. 如果是setup脚本，将其编译为标准js内容输出
      if (file.endsWith('.vue')) {
        const content = await readFile(file, 'utf-8')
        const hasTsNoCheck = content.includes('@ts-nocheck')

        // vue-compiler将vue文件解析成sfc对象(即template、script、style等)
        const sfc = vueCompiler.parse(content)
        const { script, scriptSetup } = sfc.descriptor
        if (script || scriptSetup) {
          let content =
            (hasTsNoCheck ? '// @ts-nocheck\n' : '') + (script?.content ?? '')

          if (scriptSetup) {
            // 将vue setup语法转为标准js语法 如：
            /**
                <script setup>
                  import {ref} from 'vue'
                  const a = ref(1)
                </script>
             */
            // 转换后：
            /**
                "import {ref} from 'vue'\n" +
                '\n' +
                'export default {\n' +
                '  setup(__props, { expose: __expose }) {\n' +
                '  __expose();\n' +
                '\n' +
                'const a = ref(1)\n' +
                '\n' +
                'const __returned__ = { a, ref }\n' +
                "Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })\n" +
                'return __returned__\n' +
                '}\n' +
                '\n' +
                '}',
             */
            const compiled = vueCompiler.compileScript(sfc.descriptor, {
              id: 'xxx',
            })
            content += compiled.content
          }

          const lang = scriptSetup?.lang || script?.lang || 'js'
          const sourceFile = project.createSourceFile(
            `${path.relative(process.cwd(), file)}.${lang}`,
            content
          )
          sourceFiles.push(sourceFile)
        }
      } else {
        const sourceFile = project.addSourceFileAtPath(file)
        sourceFiles.push(sourceFile)
      }
    }),
    ...epPaths.map(async (file) => {
      // 这里之所以将element-plus单独拿出来，是因为在执行buildModules任务时，将element-plus的层级提到了顶层
      // 这里的file路径是被提取后的路径，并不是源码真实路径，因此要先用epRoot的相对路径读取文件内容，再createSourceFile
      // 另外，这里没有处理vue文件的逻辑，因此要保证element-plus里没有.vue文件出现
      const content = await readFile(path.resolve(epRoot, file), 'utf-8')
      sourceFiles.push(
        project.createSourceFile(path.resolve(pkgRoot, file), content)
      )
    }),
  ])

  return sourceFiles
}

function typeCheck(project: Project) {
  const diagnostics = project.getPreEmitDiagnostics()
  if (diagnostics.length > 0) {
    consola.error(project.formatDiagnosticsWithColorAndContext(diagnostics))
    const err = new Error('Failed to generate dts.')
    consola.error(err)
    throw err
  }
}
