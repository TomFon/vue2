/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher; // 当前活跃的观察者
  id: number; // Dep 的唯一Id
  subs: Array<Watcher>; // 与watcher一对多的关系映射

  constructor () {
    this.id = uid++
    this.subs = []
  }
  // 添加watcher
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }
  // 移除watcher
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }
  // 通知watcher收集我
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
  // 通知watcher触发更新
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // 同步更新时，对watcher进行排列
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.

// 记录栈顶观察者
Dep.target = null
// 观察者栈
const targetStack = []

// 推入栈
export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

// 推出栈
export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
