/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/** <slot name="header" :hello="info" v-bind="{a:2}">默认内容</slot>
 * Runtime helper for rendering <slot>
 */
export function renderSlot (
  name: string, // 插槽名称 header
  fallbackRender: ?((() => Array<VNode>) | Array<VNode>), // 插槽默认内容 function(){return [_v("默认内容")]}
  props: ?Object, //{hello: <Object>info}
  bindObject: ?Object // {a:2}
): ?Array<VNode> {
  const scopedSlotFn = this.$scopedSlots[name]
  let nodes
  if (scopedSlotFn) {
    // scoped slot
    props = props || {}
    if (bindObject) {
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn('slot v-bind without argument expects an Object', this)
      }
      props = extend(extend({}, bindObject), props)
    }
    // 如果没有内容将使用默认内容fallbackRender替换
    nodes =
      scopedSlotFn(props) ||
      (typeof fallbackRender === 'function' ? fallbackRender() : fallbackRender)
  } else {
    nodes =
      this.$slots[name] ||
      (typeof fallbackRender === 'function' ? fallbackRender() : fallbackRender)
  }

  const target = props && props.slot
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
