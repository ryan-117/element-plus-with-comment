import { buildProps } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'
import type Aaa from './aaa.vue'

export const aaaProps = buildProps({})

export type AaaProps = ExtractPropTypes<typeof aaaProps>
export type AaaInstance = InstanceType<typeof Aaa>
