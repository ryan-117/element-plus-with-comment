import { NOOP } from '@vue/shared'

import type { App, Directive } from 'vue'
import type { SFCInstallWithContext, SFCWithInstall } from './typescript'

/**
 * 接收vue组件，给组件挂载install方法，用于全局注册，并且将子组件作为属性挂载到主组件上
 * @param main 组件1
 * @param extra { [name2]: 组件2, [name3]: 组件3... }
 * @returns
 *
 * 如 with(ElButton, { ElButtonGroup })
 * 首先给ElButton和ElButtonGroup挂载install方法，用于全局注册
 * 然后ElButton.ElButtonGroup = ElButtonGroup
 */
export const withInstall = <T, E extends Record<string, any>>(
  main: T,
  extra?: E
) => {
  ;(main as SFCWithInstall<T>).install = (app): void => {
    for (const comp of [main, ...Object.values(extra ?? {})]) {
      app.component(comp.name, comp)
    }
  }

  if (extra) {
    for (const [key, comp] of Object.entries(extra)) {
      ;(main as any)[key] = comp
    }
  }
  return main as SFCWithInstall<T> & E
}

/**
 * 注册install方法，给方法挂载_context属性，同时让该方法在全局组件实例上可直接访问
 * @param fn
 * @param name
 * @returns
 * 如 withInstallFunction(message, '$message')
 * message.install = (app) => {
 *  message._context = app._context
 *  app.config.globalProperties.$message = message
 * }
 *
 * 在组件中：
 * import { getCurrentInstance } from 'vue'
 * const { proxy } = getCurrentInstance()
 * proxy.$message.success('xxx')
 */
export const withInstallFunction = <T>(fn: T, name: string) => {
  ;(fn as SFCWithInstall<T>).install = (app: App) => {
    ;(fn as SFCInstallWithContext<T>)._context = app._context
    app.config.globalProperties[name] = fn
  }

  return fn as SFCInstallWithContext<T>
}

/**
 * 在install方法中注册指令
 * @param directive
 * @param name
 * @returns
 */
export const withInstallDirective = <T extends Directive>(
  directive: T,
  name: string
) => {
  ;(directive as SFCWithInstall<T>).install = (app: App): void => {
    app.directive(name, directive)
  }

  return directive as SFCWithInstall<T>
}

/**
 * 挂载空的install方法
 */
export const withNoopInstall = <T>(component: T) => {
  ;(component as SFCWithInstall<T>).install = NOOP

  return component as SFCWithInstall<T>
}
