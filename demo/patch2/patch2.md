<!--
 * @Author: liangtengfeng liangtengfeng@meizu.com
 * @Date: 2022-06-14 11:23:01
 * @LastEditors: liangtengfeng liangtengfeng@meizu.com
 * @LastEditTime: 2022-06-14 17:51:09
 * @FilePath: /vue2/demo/patch2/patch2.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->

# vue2 patch 过程（二）-- diff 算法

## 前文回顾

首先，我们先梳理一下 vue 建立的流程

1. 当我们调用`new Vue()` 时，会调用`new Watcher(vm, updateComponent)`，即是新建一个渲染 watcher
2. 首次创建渲染 watcher 时，会调用`updateComponent`,
3. 进入`updateComponent`过程，首先调用生成`vnode`的生成函数，从而得到最新的`vnode`，
4. 得到新的`vnode`之后，和旧的`vnode`，传入`patch`函数，进行“打补丁”过程，也是校对新旧节点，对节点进行增，删，改

### patch

patch 主体函数如下

```javascript
function patch(oldVnode, vnode) {
  if (isUndef(vnode)) {
    // 没有新vnode，只有旧vnode，移除节点,就会触发destory钩子
    if (isDef(oldVnode)) invokeDestroyHook(oldVnode);
    return;
  }
  // 省略...

  if (isUndef(oldVnode)) {
    // 首次渲染组件时会出现这种情况）
    // 旧vnode不存在，新vnode存在，也就是新增了节点
    createElm(vnode, insertedVnodeQueue);
  } else {
    // 新旧节点都存在的情况

    const isRealElement = isDef(oldVnode.nodeType);
    if (!isRealElement && sameVnode(oldVnode, vnode)) {
      // 不是元素节点并且新vnode跟oldNode相等，表示是修改，去做对比
      // patch existing root node
      patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly);
    } else {
      if (isRealElement) {
        // 创建一个空vnode替代真正的dom节点
        oldVnode = emptyNodeAt(oldVnode);
      }

      // replacing existing element
      // 旧vnode的真正元素节点
      const oldElm = oldVnode.elm;
      // 旧vnode的父节点
      const parentElm = nodeOps.parentNode(oldElm);
      // 通过虚拟节点创建真实的元素并插入到它的父节点中
      // create new node
      createElm(
        vnode,
        insertedVnodeQueue,
        // extremely rare edge case: do not insert if old element is in a
        // leaving transition. Only happens when combining transition +
        // keep-alive + HOCs. (#4590)
        oldElm._leaveCb ? null : parentElm,
        nodeOps.nextSibling(oldElm)
      );
      // 省略销毁oldVnode
    }
  }
}
```

我们操作 dom 无非就是增，删，改，那其实`patch`过程也是跟这三种情况有关系，主要分为这几种情况处理

- 新节点不存在，旧节点存在，代表要`移除`;
- 新节点存在，旧节点不存在，代表要`新增`;
- 新旧节点存在，旧节点不是真实元素且新旧节点是同个节点，代表要`修改`；
- 新旧节点都存在，旧节点是真实元素，这种情况一般是初始化渲染，旧节点是容器元素的 dom`<div id="app"></div>`;

移除，新增，上次分享也提及过，本次主要是讲解`修改`，`patchVnode`过程，也即是我们平常所说的`diff`算法

## diff 过程

### patchVnode

我们从`patch`知道，新旧节点相同才会调用`patchVnode`，我们必须知道这里的`sameVnode(oldVnode, vnode)`相同，并不是完全的一模一样，不包括`children`的，sameVnode 主要依赖`key`,`tag`,`data`等属性来区分。

所以 patchVnode 的作用很明显了，就是处理 children 的，具体是内容是什么，让我们先看看函数的主流程

```javascript
function patchVnode() {
  // 新旧vnode 引用相等，直接返回
  if (oldVnode === vnode) {
    return;
  }

  // ... 省略

  if (isUndef(vnode.text)) {
    // 非文本节点
    if (isDef(oldCh) && isDef(ch)) {
      // 旧vnode与新vnode都有children,并且不相等
      if (oldCh !== ch)
        updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly);
    } else if (isDef(ch)) {
      // 新vnode存在children，旧vnode没有children
      if (process.env.NODE_ENV !== "production") {
        checkDuplicateKeys(ch);
      }
      // 旧vnode是文本节点，直接清空文本
      if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, "");
      // 新增节点
      addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
    } else if (isDef(oldCh)) {
      // 新vnode不存在children, 旧vnode存在children
      // 移除所有旧vnode的children
      removeVnodes(oldCh, 0, oldCh.length - 1);
    } else if (isDef(oldVnode.text)) {
      // 旧vnode是文本节点,就清空文本
      nodeOps.setTextContent(elm, "");
    }
  } else if (oldVnode.text !== vnode.text) {
    // 文本节点，直接替换文本内容
    nodeOps.setTextContent(elm, vnode.text);
  }
  // ... 省略
}
```
